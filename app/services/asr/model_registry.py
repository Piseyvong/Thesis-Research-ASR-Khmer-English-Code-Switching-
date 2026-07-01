from __future__ import annotations

import json
import threading
from dataclasses import dataclass
import logging
from pathlib import Path

from app.config import settings
from app.services.asr.wav2vec_service import Wav2Vec2CTCService
from app.services.asr.whisper_service import WhisperService


@dataclass
class ModelInfo:
    model_name: str
    configured_path: str | None
    available: bool
    status: str


class ModelRegistry:
    """Loads completed local ASR exports with their native model architecture."""

    _singleton = None
    _lock = threading.Lock()

    def __init__(self):
        self._models: dict[str, object] = {}
        self._info: dict[str, ModelInfo] = {}
        self._log = logging.getLogger("app.asr")
        # model_registry.py -> asr -> services -> app -> project root
        self._project_root = Path(__file__).resolve().parents[3]

    def _resolve_path(self, path: str) -> str:
        p = Path(path)
        if p.is_absolute():
            return str(p)
        return str((self._project_root / p).resolve())

    @classmethod
    def from_env(cls) -> "ModelRegistry":
        # simple singleton so we don't reload heavy models for every request
        with cls._lock:
            if cls._singleton is None:
                reg = cls()
                reg._init_infos_from_env()
                cls._singleton = reg
            return cls._singleton

    def _init_infos_from_env(self) -> None:
        self._register("wav2vec2", settings.wav2vec_model_path)
        self._register("whisper-small", settings.whisper_small_model_path)
        self._register("whisper-medium", settings.whisper_medium_model_path)

    def _register(self, model_name: str, path: str | None) -> None:
        if not path:
            self._info[model_name] = ModelInfo(model_name, None, False, "not configured")
            return

        resolved = self._resolve_path(path)
        if not Path(resolved).exists():
            self._info[model_name] = ModelInfo(model_name, resolved, False, "path not found")
            return

        invalid_reason = self._validate_export(model_name, Path(resolved))
        if invalid_reason:
            self._info[model_name] = ModelInfo(model_name, resolved, False, invalid_reason)
            return

        self._info[model_name] = ModelInfo(model_name, resolved, True, "configured")

    def _validate_export(self, model_name: str, base: Path) -> str | None:
        if not base.is_dir():
            return "invalid path: expected a model directory"

        if model_name == "wav2vec2":
            required = ["config.json", "preprocessor_config.json", "tokenizer_config.json", "vocab.json"]
            expected_architecture = "Wav2Vec2ForCTC"
            expected_type = "wav2vec2"
        else:
            if (base / "adapter_config.json").exists():
                return "incomplete: adapter-only checkpoint; completed local Whisper export is required"
            required = ["config.json", "preprocessor_config.json", "tokenizer.json"]
            expected_architecture = "WhisperForConditionalGeneration"
            expected_type = "whisper"

        missing = [name for name in required if not (base / name).exists()]
        if not ((base / "model.safetensors").exists() or (base / "pytorch_model.bin").exists()):
            missing.append("model.safetensors or pytorch_model.bin")
        if missing:
            return f"incomplete: missing {', '.join(missing)}"

        try:
            with open(base / "config.json", "r", encoding="utf-8") as config_file:
                config = json.load(config_file)
        except Exception as exc:
            return f"invalid config.json: {exc}"

        architectures = config.get("architectures", [])
        if config.get("model_type") != expected_type or expected_architecture not in architectures:
            return f"invalid architecture: expected {expected_architecture}"
        return None

    def describe(self) -> dict:
        return {
            "models": [
                {
                    "model_name": info.model_name,
                    "configured_path": info.configured_path,
                    "available": self.is_available(info.model_name),
                    "status": info.status,
                }
                for info in self._info.values()
            ]
        }

    def is_available(self, model_name: str) -> bool:
        info = self._info.get(model_name)
        if not info:
            return False
        return bool(info.available and (info.status == "loaded" or info.status.startswith("configured")))

    def get(self, model_name: str):
        info = self._info.get(model_name)
        if not info:
            return None
        if not info.available:
            return None

        if model_name in self._models:
            return self._models[model_name]

        # load lazily
        try:
            if model_name == "wav2vec2":
                model = Wav2Vec2CTCService(info.configured_path)
            elif model_name in {"whisper-small", "whisper-medium"}:
                model = WhisperService(info.configured_path, name=model_name)
            else:
                return None

            self._models[model_name] = model
            self._info[model_name] = ModelInfo(model_name, info.configured_path, True, "loaded")
            return model
        except Exception as e:
            self._log.exception("Failed loading ASR model %s from %s", model_name, info.configured_path)
            self._info[model_name] = ModelInfo(model_name, info.configured_path, False, f"failed: {e}")
            return None
