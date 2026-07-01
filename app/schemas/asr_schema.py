from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic import ConfigDict


class ASRCandidate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_name: str
    available: bool
    transcript: str | None = None
    normalized_transcript: str | None = None
    confidence_score: float = 0.0
    confidence_method: str | None = None
    raw_confidence_score: float | None = None
    quality_score: float | None = None
    selection_score: float | None = None
    selection_notes: str | None = None
    cleaned_transcript: str | None = None
    english_translation: str | None = None
    extracted_form_type: str | None = None
    extracted_summary: str | None = None
    extracted_missing_fields: list[str] = Field(default_factory=list)
    validation_error: str | None = None
    llm_selected: bool = False
    processing_time_seconds: float = 0.0
    error: str | None = None


class BestTranscriptSelection(BaseModel):
    selected_model: str | None
    selected_transcript: str | None
    selection_reason: str
    all_candidates: list[ASRCandidate]


class LLMCandidateSelectionResult(BaseModel):
    selected_model: str | None = None
    reason: str | None = None
