from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import torch
from transformers import (
    WhisperForConditionalGeneration,
    WhisperProcessor,
)

from app.services.asr.base import ASRResult
from app.services.asr.confidence import whisper_confidence_proxy
from app.utils.text_quality import normalize_text


WHISPER_LANGUAGE = "khmer"
WHISPER_TASK = "transcribe"


class WhisperService:
    def __init__(self, model_path: str, name: str, device: str | None = None):
        self.model_path = model_path
        self.name = name

        self.processor, self.model = self._load_model(model_path)
        self.forced_decoder_ids = self._khmer_decoder_prompt_ids()
        self._configure_generation()

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        self.model.to(self.device)
        self.model.eval()

    def _load_model(self, model_path: str) -> tuple[WhisperProcessor, WhisperForConditionalGeneration]:
        base = Path(model_path)
        if base.is_file():
            base = base.parent

        if (base / "adapter_config.json").exists():
            raise RuntimeError(
                f"{self.name} is an adapter-only checkpoint and is not a completed local Whisper export."
            )

        try:
            processor = WhisperProcessor.from_pretrained(str(base), local_files_only=True)
            model = WhisperForConditionalGeneration.from_pretrained(
                str(base),
                local_files_only=True,
                low_cpu_mem_usage=True,
            )
            return processor, model
        except Exception as e:
            raise RuntimeError(
                f"Failed to load local {self.name} WhisperForConditionalGeneration export from "
                f"{base}. Original error: {e}"
            ) from e

    def _khmer_decoder_prompt_ids(self) -> list[list[int]]:
        prompt_getter = getattr(self.processor, "get_decoder_prompt_ids", None)
        if prompt_getter is None:
            prompt_getter = getattr(self.processor.tokenizer, "get_decoder_prompt_ids", None)

        if not callable(prompt_getter):
            return [[1, 50323], [2, 50359], [3, 50363]]

        try:
            return prompt_getter(language=WHISPER_LANGUAGE, task=WHISPER_TASK, no_timestamps=True)
        except Exception:
            return prompt_getter(language="km", task=WHISPER_TASK, no_timestamps=True)

    def _configure_generation(self) -> None:
        generation_config = self.model.generation_config
        generation_config.language = WHISPER_LANGUAGE
        generation_config.task = WHISPER_TASK
        generation_config.forced_decoder_ids = self.forced_decoder_ids
        self.model.config.forced_decoder_ids = self.forced_decoder_ids

    @torch.inference_mode()
    def transcribe(self, waveform: np.ndarray, sample_rate: int) -> ASRResult:
        start = time.perf_counter()

        features = self.processor(
            waveform,
            sampling_rate=sample_rate,
            return_tensors="pt",
            return_attention_mask=True,
        )
        input_features = features.input_features.to(self.device)
        attention_mask = features.attention_mask.to(self.device)

        generated = self.model.generate(
            input_features,
            attention_mask=attention_mask,
            forced_decoder_ids=self.forced_decoder_ids,
        )

        transcript = self.processor.batch_decode(
            generated,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0].strip()
        normalized = normalize_text(transcript)
        conf = whisper_confidence_proxy(avg_logprob=None, transcript=transcript)

        _ = time.perf_counter() - start
        return ASRResult(
            transcript=transcript,
            normalized_transcript=normalized,
            confidence_score=conf.score,
            confidence_method=conf.method,
        )
