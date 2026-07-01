from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ExtractedFields(BaseModel):
    employee_name: str | None = None
    amount: str | None = None
    currency: str | None = None
    location: str | None = None
    province_or_city: str | None = None
    date: str | None = None
    reason: str | None = None
    purpose: str | None = None
    priority: str | None = None
    material_name: str | None = None
    training_type: str | None = None
    travel_type: str | None = None

    @field_validator("*", mode="before")
    @classmethod
    def normalize_field_value(cls, value):
        if value is None:
            return None

        if isinstance(value, str):
            text = value.strip()
            return text or None

        if isinstance(value, (int, float, bool)):
            text = str(value).strip()
            return text or None

        return value


class LLMExtractionResult(BaseModel):
    cleaned_transcript: str | None = None
    english_translation: str | None = None
    form_type: str | None = None
    summary: str | None = None
    fields: ExtractedFields = Field(default_factory=ExtractedFields)
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None

    @field_validator(
        "cleaned_transcript",
        "english_translation",
        "form_type",
        "summary",
        "follow_up_question",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value):
        if value is None:
            return None

        if isinstance(value, str):
            text = value.strip()
            return text or None

        if isinstance(value, (int, float, bool)):
            text = str(value).strip()
            return text or None

        return value

    @field_validator("missing_fields", mode="before")
    @classmethod
    def normalize_missing_fields(cls, value):
        if value is None:
            return []

        if isinstance(value, list):
            normalized = []
            for item in value:
                if item is None:
                    continue
                text = str(item).strip()
                if text:
                    normalized.append(text)
            return normalized

        text = str(value).strip()
        return [text] if text else []


class RequestCreateFromAudioResponse(BaseModel):
    request_id: int
    asr: dict
    llm: LLMExtractionResult


class RequestRead(BaseModel):
    id: int
    request_number: str
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    status: str
    employee_name: str
    manager_name: str
    requester_id: str | None = None
    requester_name: str
    requester_email: str | None = None
    requester_department: str | None = None
    assigned_manager_id: str | None = None
    assigned_manager_name: str
    assigned_manager_email: str | None = None
    assigned_manager_department: str | None = None
    approval_decision: str | None = None

    selected_model: str | None
    selected_transcript: str | None
    selected_confidence: float | None
    selection_reason: str | None

    asr_candidates: list[dict] = Field(default_factory=list)

    cleaned_transcript: str | None
    english_translation: str | None
    form_type: str | None
    summary: str | None

    fields: ExtractedFields | None
    missing_fields: list[str] = Field(default_factory=list)
    follow_up_question: str | None
    manager_comment: str | None


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageRead(BaseModel):
    id: int
    created_at: datetime
    role: str
    content: str


class RequestUpdateFields(BaseModel):
    form_type: str | None = None
    assigned_manager_id: str | None = None
    fields: ExtractedFields


class RequestUpdateTranscript(BaseModel):
    content: str
