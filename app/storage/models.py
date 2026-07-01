from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field


class RequestStatus(str, Enum):
    draft = "Draft"
    submitted = "Submitted"
    approved = "Approved"
    rejected = "Rejected"
    returned = "Returned"
    needs_clarification = "Needs clarification"


class RequestRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    employee_name: str = "Employee"
    manager_name: str = "Manager"
    requester_id: str | None = Field(default=None, index=True)
    requester_email: str | None = None
    requester_department: str | None = None
    assigned_manager_id: str | None = Field(default=None, index=True)
    assigned_manager_email: str | None = None
    assigned_manager_department: str | None = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None

    status: RequestStatus = Field(default=RequestStatus.draft)
    approval_decision: str | None = None

    # ASR
    selected_model: str | None = None
    selected_transcript: str | None = None
    selected_confidence: float | None = None
    selection_reason: str | None = None
    asr_candidates_json: str | None = None  # JSON list of ASR candidates

    # LLM
    cleaned_transcript: str | None = None
    english_translation: str | None = None
    form_type: str | None = None
    summary: str | None = None

    fields_json: str | None = None  # JSON string
    missing_fields_json: str | None = None  # JSON list
    follow_up_question: str | None = None

    # Manager actions
    manager_comment: str | None = None


class ChatRole(str, Enum):
    employee = "employee"
    assistant = "assistant"
    manager = "manager"


class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    role: ChatRole
    content: str


class EmailAudience(str, Enum):
    employee = "employee"
    manager = "manager"


class MockEmail(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    request_id: int | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    audience: EmailAudience
    subject: str
    body: str
