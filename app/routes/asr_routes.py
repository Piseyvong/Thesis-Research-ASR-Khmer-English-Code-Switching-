from __future__ import annotations

import time
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.asr_schema import ASRCandidate, BestTranscriptSelection
from app.services.asr.model_registry import ModelRegistry
from app.utils.audio_utils import decode_audio_bytes, to_16k_mono
from app.utils.text_quality import extract_quality_signals, normalize_text, transcript_quality_score

router = APIRouter(tags=["asr"])
PREFERRED_ASR_MODEL = "whisper-small"


def _select_best(candidates: list[ASRCandidate]) -> BestTranscriptSelection:
    available = [c for c in candidates if c.available and not c.error and c.transcript]
    if not available:
        return BestTranscriptSelection(
            selected_model=None,
            selected_transcript=None,
            selection_reason="No ASR models available or all failed.",
            all_candidates=candidates,
        )

    for candidate in available:
        raw_confidence = float(candidate.confidence_score or 0.0)
        normalized = normalize_text(candidate.normalized_transcript or candidate.transcript or "")
        quality_score = transcript_quality_score(normalized)
        signals = extract_quality_signals(normalized)
        token_count = len(normalized.split())
        selection_score = (0.45 * raw_confidence) + (0.55 * quality_score)
        notes = [
            f"raw={raw_confidence:.3f}",
            f"quality={quality_score:.3f}",
            f"tokens={token_count}",
            f"keywords={signals.keyword_hits}",
            f"provinces={signals.province_hits}",
        ]

        if token_count < 2:
            selection_score -= 0.18
            notes.append("penalty=too_short")
        elif token_count < 4:
            selection_score -= 0.08
            notes.append("penalty=short")

        if not signals.keyword_hits and not signals.province_hits and not signals.has_amount and not signals.has_date:
            selection_score -= 0.05
            notes.append("penalty=low_request_signal")

        if signals.repetition:
            selection_score -= 0.08
            notes.append("penalty=repetition")

        candidate.raw_confidence_score = raw_confidence
        candidate.quality_score = quality_score
        candidate.selection_score = float(max(0.0, min(1.0, selection_score)))
        candidate.selection_notes = ";".join(notes)

    preferred = next((candidate for candidate in available if candidate.model_name == PREFERRED_ASR_MODEL), None)
    if preferred:
        preferred.selection_notes = "Selected as the configured development ASR."
        return BestTranscriptSelection(
            selected_model=preferred.model_name,
            selected_transcript=preferred.transcript,
            selection_reason="Selected whisper-small as the configured development ASR.",
            all_candidates=candidates,
        )

    best = max(
        available,
        key=lambda c: (
            c.selection_score if c.selection_score is not None else 0.0,
            c.quality_score if c.quality_score is not None else 0.0,
            c.confidence_score,
        ),
    )
    reason = (
        f"Selected {best.model_name} using calibrated score "
        f"{(best.selection_score or 0.0):.3f} "
        f"(raw {best.raw_confidence_score or 0.0:.3f}, quality {best.quality_score or 0.0:.3f})."
    )
    return BestTranscriptSelection(
        selected_model=best.model_name,
        selected_transcript=best.transcript,
        selection_reason=reason,
        all_candidates=candidates,
    )


@router.post("/transcribe", response_model=BestTranscriptSelection)
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    try:
        waveform, sr = decode_audio_bytes(audio_bytes, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    waveform, sr = to_16k_mono(waveform, sr)

    registry = ModelRegistry.from_env()

    candidates: list[ASRCandidate] = []
    for model_name in ["wav2vec2", "whisper-small", "whisper-medium"]:
        info = next((m for m in registry.describe()["models"] if m["model_name"] == model_name), None)
        if not info:
            candidates.append(ASRCandidate(model_name=model_name, available=False, error="unknown model"))
            continue

        if not info["available"]:
            candidates.append(ASRCandidate(model_name=model_name, available=False, error=info["status"]))
            continue

        model = registry.get(model_name)
        if model is None:
            latest = next((m for m in registry.describe()["models"] if m["model_name"] == model_name), info)
            candidates.append(ASRCandidate(model_name=model_name, available=False, error=latest["status"]))
            continue

        start = time.perf_counter()
        try:
            result = model.transcribe(waveform, sr)
            candidates.append(
                ASRCandidate(
                    model_name=model_name,
                    available=True,
                    transcript=result.transcript,
                    normalized_transcript=result.normalized_transcript,
                    confidence_score=float(result.confidence_score),
                    confidence_method=result.confidence_method,
                    processing_time_seconds=float(time.perf_counter() - start),
                    error=None,
                )
            )
        except Exception as exc:
            candidates.append(
                ASRCandidate(
                    model_name=model_name,
                    available=True,
                    processing_time_seconds=float(time.perf_counter() - start),
                    error=str(exc),
                )
            )

    return _select_best(candidates)
