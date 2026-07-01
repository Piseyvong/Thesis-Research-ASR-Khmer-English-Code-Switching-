from __future__ import annotations

import io

import numpy as np
import soundfile as sf

from app.config import settings
from app.services.asr.base import ASRResult
from app.utils.text_quality import normalize_text


class GoogleSpeechService:
    def __init__(
        self,
        project_id: str,
        location: str,
        model: str,
        languages: list[str],
        name: str = "whisper-small",
    ):
        try:
            from google.cloud import speech_v2 as speech
        except Exception as exc:
            raise RuntimeError(
                "Google Speech-to-Text is configured, but google-cloud-speech is not installed. "
                "Run `pip install google-cloud-speech`."
            ) from exc

        self.name = name
        self.project_id = project_id
        self.location = location
        self.model = model
        self.languages = languages
        self._speech = speech
        client_options = None
        if location != "global":
            client_options = {"api_endpoint": f"{location}-speech.googleapis.com"}
        self._client = speech.SpeechClient(client_options=client_options)
        self._recognizer = f"projects/{project_id}/locations/{location}/recognizers/_"

    @classmethod
    def from_settings(cls, name: str = "whisper-small") -> "GoogleSpeechService":
        project_id = (settings.google_cloud_project_id or "").strip()
        if not project_id:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT_ID is required for Google Speech-to-Text")

        languages = [
            language.strip()
            for language in (settings.google_speech_languages or "").split(",")
            if language.strip()
        ]
        if not languages:
            languages = ["km-KH", "en-US"]

        location = (settings.google_speech_location or "us").strip()
        model = (settings.google_speech_model or "chirp_3").strip()

        return cls(
            project_id=project_id,
            location=location,
            model=model,
            languages=languages,
            name=name,
        )

    def transcribe(self, waveform: np.ndarray, sample_rate: int) -> ASRResult:
        audio_bytes = self._waveform_to_wav_bytes(waveform, sample_rate)
        config = self._speech.RecognitionConfig(
            auto_decoding_config=self._speech.AutoDetectDecodingConfig(),
            language_codes=self.languages,
            model=self.model,
        )
        request = self._speech.RecognizeRequest(
            recognizer=self._recognizer,
            config=config,
            content=audio_bytes,
        )
        response = self._client.recognize(request=request)

        transcripts: list[str] = []
        confidences: list[float] = []
        for result in response.results:
            if not result.alternatives:
                continue
            alternative = result.alternatives[0]
            transcript = (alternative.transcript or "").strip()
            if transcript:
                transcripts.append(transcript)
            confidence = float(getattr(alternative, "confidence", 0.0) or 0.0)
            if confidence > 0:
                confidences.append(confidence)

        transcript = " ".join(transcripts).strip()
        normalized = normalize_text(transcript)
        confidence_score = sum(confidences) / len(confidences) if confidences else 0.75 if transcript else 0.0
        return ASRResult(
            transcript=transcript,
            normalized_transcript=normalized,
            confidence_score=float(max(0.0, min(1.0, confidence_score))),
            confidence_method="google_speech_confidence" if confidences else "google_speech_default_confidence",
        )

    @staticmethod
    def _waveform_to_wav_bytes(waveform: np.ndarray, sample_rate: int) -> bytes:
        clipped = np.clip(np.asarray(waveform, dtype=np.float32), -1.0, 1.0)
        buffer = io.BytesIO()
        sf.write(buffer, clipped, sample_rate, format="WAV", subtype="PCM_16")
        return buffer.getvalue()
