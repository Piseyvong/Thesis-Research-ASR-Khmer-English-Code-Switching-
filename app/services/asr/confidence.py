from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from app.utils.text_quality import transcript_quality_score, normalize_text


@dataclass
class ConfidenceDetail:
    score: float
    method: str
    notes: str


def clamp01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def wav2vec_ctc_confidence(
    token_max_probs: np.ndarray,
    predicted_token_ids: np.ndarray,
    blank_token_id: int,
    transcript: str,
) -> ConfidenceDetail:
    """Compute a confidence proxy for wav2vec2 CTC.

    token_max_probs: (T,) max softmax prob per timestep
    predicted_token_ids: (T,) argmax token ids
    """
    if token_max_probs.size == 0:
        return ConfidenceDetail(0.0, "wav2vec2_ctc_empty", "no logits")

    predicted_token_ids = predicted_token_ids.astype(int)
    blank_mask = predicted_token_ids == int(blank_token_id)
    non_blank = ~blank_mask

    blank_ratio = float(np.mean(blank_mask))
    if np.any(non_blank):
        avg_prob = float(np.mean(token_max_probs[non_blank]))
    else:
        avg_prob = float(np.mean(token_max_probs)) * 0.2

    score = avg_prob
    notes = [f"avg_prob={avg_prob:.3f}", f"blank_ratio={blank_ratio:.3f}"]

    # Penalize blank-heavy decoding
    if blank_ratio > 0.65:
        score *= 0.65
        notes.append("penalty=blank_heavy")

    # Text-based penalties
    norm = normalize_text(transcript)
    quality = transcript_quality_score(norm)
    notes.append(f"quality={quality:.3f}")

    # Combine: mostly model prob, some heuristic quality
    score = 0.75 * score + 0.25 * quality

    # Very short / garbage-like outputs
    if len(norm) < 6:
        score *= 0.6
        notes.append("penalty=too_short")

    return ConfidenceDetail(clamp01(score), "wav2vec2_ctc_avg_token_prob+heuristics", ";".join(notes))


def whisper_confidence_proxy(
    avg_logprob: float | None,
    transcript: str,
) -> ConfidenceDetail:
    """Confidence proxy for Whisper.

    If avg_logprob provided (typically negative), map to [0,1]. Otherwise use heuristics.
    """
    norm = normalize_text(transcript)
    quality = transcript_quality_score(norm)

    if avg_logprob is None or math.isnan(avg_logprob):
        return ConfidenceDetail(quality, "whisper_quality_heuristic", f"quality={quality:.3f}")

    # Less-negative logprob means better confidence.
    # Rough mapping target: -2.5 => ~0.75, -6 => ~0.05.
    mapped = 1 / (1 + math.exp(-1.2 * (avg_logprob + 3.5)))
    score = 0.7 * mapped + 0.3 * quality

    return ConfidenceDetail(clamp01(score), "whisper_avg_logprob+heuristics", f"avg_logprob={avg_logprob:.3f};quality={quality:.3f}")
