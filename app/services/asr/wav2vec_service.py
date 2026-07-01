from __future__ import annotations

import time

import numpy as np
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

from app.services.asr.base import ASRResult
from app.services.asr.confidence import wav2vec_ctc_confidence
from app.utils.text_quality import normalize_text


class Wav2Vec2CTCService:
    name = "wav2vec2"

    def __init__(self, model_path: str, device: str | None = None):
        self.model_path = model_path
        try:
            self.processor = Wav2Vec2Processor.from_pretrained(model_path, local_files_only=True)
            self.model = Wav2Vec2ForCTC.from_pretrained(model_path, local_files_only=True)
        except Exception as exc:
            raise RuntimeError(
                "Failed to load local Wav2Vec2 CTC export. Expected Wav2Vec2ForCTC "
                f"assets in {model_path}. Original error: {exc}"
            ) from exc

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        self.model.to(self.device)
        self.model.eval()

        self.blank_token_id = int(getattr(self.processor.tokenizer, "pad_token_id", 0))

    @torch.inference_mode()
    def transcribe(self, waveform: np.ndarray, sample_rate: int) -> ASRResult:
        start = time.perf_counter()

        inputs = self.processor(
            waveform,
            sampling_rate=sample_rate,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs.input_values.to(self.device)

        logits = self.model(input_values).logits  # (B,T,V)
        probs = torch.softmax(logits, dim=-1)
        max_probs, pred_ids = torch.max(probs, dim=-1)

        pred_ids_np = pred_ids[0].detach().cpu().numpy()
        max_probs_np = max_probs[0].detach().cpu().numpy()

        transcription = self.processor.batch_decode(pred_ids)[0]
        transcription = transcription.strip()
        normalized = normalize_text(transcription)

        conf = wav2vec_ctc_confidence(
            token_max_probs=max_probs_np,
            predicted_token_ids=pred_ids_np,
            blank_token_id=self.blank_token_id,
            transcript=transcription,
        )

        _ = time.perf_counter() - start
        return ASRResult(
            transcript=transcription,
            normalized_transcript=normalized,
            confidence_score=conf.score,
            confidence_method=conf.method,
        )
