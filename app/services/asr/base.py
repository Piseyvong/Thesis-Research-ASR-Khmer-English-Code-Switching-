from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np


@dataclass
class ASRResult:
    transcript: str
    normalized_transcript: str
    confidence_score: float
    confidence_method: str


class ASRModel(Protocol):
    name: str

    def transcribe(self, waveform: np.ndarray, sample_rate: int) -> ASRResult:
        ...
