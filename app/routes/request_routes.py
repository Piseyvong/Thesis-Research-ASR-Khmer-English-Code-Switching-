from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, select

from app.mock_users import MockUser, get_current_mock_user, require_employee_user, resolve_assigned_manager
from app.schemas.asr_schema import ASRCandidate, BestTranscriptSelection
from app.schemas.request_schema import (
    ChatMessageCreate,
    ChatMessageRead,
    ExtractedFields,
    RequestCreateFromAudioResponse,
    RequestRead,
    RequestUpdateTranscript,
    RequestUpdateFields,
)
from app.services.llm_service import LLMService, LLMNotConfiguredError
from app.services.email_service import EmailService
from app.services.request_form_service import (
    canonical_form_type,
    compute_missing_fields,
    normalize_fields_for_form_type,
    validation_error_message,
)
from app.storage.database import get_session
from app.storage.models import ChatMessage, ChatRole, MockEmail, RequestRecord, RequestStatus
from app.utils.audio_utils import decode_audio_bytes, to_16k_mono
from app.services.asr.model_registry import ModelRegistry
router = APIRouter(tags=["requests"])
PREFERRED_ASR_MODEL = "whisper-small"


def _record_to_read_model(rec: RequestRecord) -> RequestRead:
    fields = ExtractedFields.model_validate_json(rec.fields_json or "{}") if rec.fields_json else None
    missing = json.loads(rec.missing_fields_json or "[]")
    asr_candidates = json.loads(rec.asr_candidates_json or "[]")
    return RequestRead(
        id=rec.id,
        request_number=f"REQ-{rec.id:04d}",
        created_at=rec.created_at,
        updated_at=rec.updated_at,
        submitted_at=rec.submitted_at,
        reviewed_at=rec.reviewed_at,
        status=rec.status.value if hasattr(rec.status, "value") else str(rec.status),
        employee_name=rec.employee_name,
        manager_name=rec.manager_name,
        requester_id=rec.requester_id,
        requester_name=rec.employee_name,
        requester_email=rec.requester_email,
        requester_department=rec.requester_department,
        assigned_manager_id=rec.assigned_manager_id,
        assigned_manager_name=rec.manager_name,
        assigned_manager_email=rec.assigned_manager_email,
        assigned_manager_department=rec.assigned_manager_department,
        approval_decision=rec.approval_decision,
        selected_model=rec.selected_model,
        selected_transcript=rec.selected_transcript,
        selected_confidence=rec.selected_confidence,
        selection_reason=rec.selection_reason,
        asr_candidates=asr_candidates,
        cleaned_transcript=rec.cleaned_transcript,
        english_translation=rec.english_translation,
        form_type=rec.form_type,
        summary=rec.summary,
        fields=fields,
        missing_fields=missing,
        follow_up_question=rec.follow_up_question,
        manager_comment=rec.manager_comment,
    )


def _ensure_request_access(rec: RequestRecord, current_user: MockUser) -> None:
    if current_user.role == "manager":
        if rec.assigned_manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="This request is not assigned to the current manager")
        return

    if rec.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="This request does not belong to the current employee")


def _ensure_employee_request_access(rec: RequestRecord, employee_user: MockUser) -> None:
    if rec.requester_id != employee_user.id:
        raise HTTPException(status_code=403, detail="This request does not belong to the current employee")


def _apply_request_participants(rec: RequestRecord, employee_user: MockUser, assigned_manager_id: str | None = None) -> None:
    assigned_manager = resolve_assigned_manager(assigned_manager_id or rec.assigned_manager_id, employee_user.default_manager_id)
    rec.employee_name = employee_user.name
    rec.requester_id = employee_user.id
    rec.requester_email = employee_user.email
    rec.requester_department = employee_user.department
    rec.manager_name = assigned_manager.name
    rec.assigned_manager_id = assigned_manager.id
    rec.assigned_manager_email = assigned_manager.email
    rec.assigned_manager_department = assigned_manager.department


def _normalize_extraction(extraction, requester_name: str):
    form_type = canonical_form_type(extraction.form_type)
    translated_description = (extraction.english_translation or "").strip()
    field_updates = {"employee_name": requester_name}
    if translated_description:
        field_updates["reason"] = translated_description
        field_updates["purpose"] = translated_description

    merged_fields = extraction.fields.model_copy(update=field_updates)
    normalized_fields = normalize_fields_for_form_type(form_type, merged_fields)
    missing_fields = compute_missing_fields(form_type, normalized_fields)
    return extraction.model_copy(
        update={
            "form_type": form_type or "",
            "fields": normalized_fields,
            "missing_fields": missing_fields,
            "follow_up_question": extraction.follow_up_question if missing_fields else None,
        }
    )


def _candidate_rerank_payload(candidate: ASRCandidate, extraction) -> dict:
    validation_error = validation_error_message(extraction.form_type, extraction.fields)
    candidate.cleaned_transcript = extraction.cleaned_transcript
    candidate.english_translation = extraction.english_translation
    candidate.extracted_form_type = extraction.form_type or None
    candidate.extracted_summary = extraction.summary
    candidate.extracted_missing_fields = list(extraction.missing_fields)
    candidate.validation_error = validation_error

    return {
        "model_name": candidate.model_name,
        "raw_transcript": candidate.transcript,
        "cleaned_transcript": extraction.cleaned_transcript,
        "english_translation": extraction.english_translation,
        "form_type": extraction.form_type,
        "summary": extraction.summary,
        "fields": extraction.fields.model_dump(),
        "missing_fields": list(extraction.missing_fields),
        "follow_up_question": extraction.follow_up_question,
        "validation_error": validation_error,
    }


def _extract_best_audio_candidate(
    llm: LLMService,
    candidates: list[ASRCandidate],
    requester_name: str,
) -> tuple[BestTranscriptSelection, object]:
    candidate_payloads: list[dict] = []

    for candidate in candidates:
        if not (candidate.available and not candidate.error and candidate.transcript):
            continue

        try:
            extraction = llm.extract_from_transcript(candidate.transcript)
            normalized_extraction = _normalize_extraction(extraction, requester_name)
            payload = _candidate_rerank_payload(candidate, normalized_extraction)
            payload["_normalized_extraction"] = normalized_extraction
            candidate_payloads.append(payload)
        except Exception as exc:
            candidate.validation_error = f"LLM extraction failed: {exc}"

    if not candidate_payloads:
        raise RuntimeError("LLM extraction failed for all ASR candidates")

    preferred_payload = next(
        (payload for payload in candidate_payloads if payload["model_name"] == PREFERRED_ASR_MODEL),
        None,
    )
    if preferred_payload is not None:
        chosen_payload = preferred_payload
        selection_reason = "Selected whisper-small as the configured development ASR."
    elif len(candidate_payloads) == 1:
        chosen_payload = candidate_payloads[0]
        selection_reason = (
            f"Selected {chosen_payload['model_name']} because it was the only candidate with a usable transcript and structured extraction."
        )
    else:
        decision = llm.select_best_candidate(
            [
                {key: value for key, value in payload.items() if not key.startswith("_")}
                for payload in candidate_payloads
            ]
        )
        chosen_payload = next(
            (payload for payload in candidate_payloads if payload["model_name"] == decision.selected_model),
            None,
        )
        if chosen_payload is None:
            raise RuntimeError(f"LLM selected unknown ASR candidate: {decision.selected_model!r}")
        selection_reason = decision.reason or f"Selected {chosen_payload['model_name']} after candidate reranking."

    for candidate in candidates:
        candidate.llm_selected = candidate.model_name == chosen_payload["model_name"]
        if candidate.llm_selected and selection_reason:
            candidate.selection_notes = selection_reason

    return (
        BestTranscriptSelection(
            selected_model=chosen_payload["model_name"],
            selected_transcript=chosen_payload.get("raw_transcript"),
            selection_reason=selection_reason or f"Selected {chosen_payload['model_name']} after candidate reranking.",
            all_candidates=candidates,
        ),
        chosen_payload["_normalized_extraction"],
    )


@router.get("/", response_model=list[RequestRead])
def list_requests(
    current_user: MockUser = Depends(get_current_mock_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(RequestRecord).order_by(RequestRecord.created_at.desc())).all()
    if current_user.role == "manager":
        rows = [row for row in rows if row.assigned_manager_id == current_user.id]
    else:
        rows = [row for row in rows if row.requester_id == current_user.id]
    return [_record_to_read_model(r) for r in rows]


@router.post("/from-audio", response_model=RequestCreateFromAudioResponse)
async def create_from_audio(
    file: UploadFile = File(...),
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    audio_bytes = await file.read()
    try:
        waveform, sr = decode_audio_bytes(audio_bytes, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    waveform, sr = to_16k_mono(waveform, sr)

    # Run each completed local ASR export with its own model architecture.
    registry = ModelRegistry.from_env()
    candidates = await _asr_candidates_from_waveform(registry, waveform, sr)
    if not any(candidate.available and not candidate.error and candidate.transcript for candidate in candidates):
        errors = "; ".join(f"{candidate.model_name}: {candidate.error}" for candidate in candidates)
        raise HTTPException(status_code=500, detail=f"No configured ASR model produced a transcript. {errors}")

    try:
        llm = LLMService.from_env()
        selection, normalized_extraction = _extract_best_audio_candidate(llm, candidates, current_user.name)
    except LLMNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {e}")

    rec = RequestRecord(
        status=RequestStatus.draft,
        selected_model=selection.selected_model,
        selected_transcript=selection.selected_transcript,
        selected_confidence=None,
        selection_reason=selection.selection_reason,
        asr_candidates_json=json.dumps([c.model_dump() for c in selection.all_candidates]),
        cleaned_transcript=normalized_extraction.cleaned_transcript,
        english_translation=normalized_extraction.english_translation,
        form_type=normalized_extraction.form_type,
        summary=normalized_extraction.summary,
        fields_json=normalized_extraction.fields.model_dump_json(),
        missing_fields_json=json.dumps(normalized_extraction.missing_fields),
        follow_up_question=normalized_extraction.follow_up_question,
        updated_at=datetime.utcnow(),
    )
    _apply_request_participants(rec, current_user, rec.assigned_manager_id)
    session.add(rec)
    session.commit()
    session.refresh(rec)

    # Seed chat messages
    session.add(ChatMessage(request_id=rec.id, role=ChatRole.employee, content=f"[Audio uploaded: {file.filename}]"))
    session.add(ChatMessage(request_id=rec.id, role=ChatRole.assistant, content=_assistant_message_for_extraction(normalized_extraction)))
    session.commit()

    # Mock email: submitted? not yet. Only on submit.

    return RequestCreateFromAudioResponse(
        request_id=rec.id,
        asr=selection.model_dump(),
        llm=normalized_extraction,
    )


@router.post("/from-text", response_model=RequestCreateFromAudioResponse)
def create_from_text(
    payload: ChatMessageCreate,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    source_text = (payload.content or "").strip()
    if not source_text:
        raise HTTPException(status_code=400, detail="Text input is required")

    try:
        llm = LLMService.from_env()
        extraction = llm.extract_from_transcript(source_text)
    except LLMNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {e}")

    normalized_extraction = _normalize_extraction(extraction, current_user.name)

    rec = RequestRecord(
        status=RequestStatus.draft,
        selected_model="Text input",
        selected_transcript=source_text,
        selected_confidence=None,
        selection_reason="Request created from typed text input",
        asr_candidates_json=json.dumps([]),
        cleaned_transcript=normalized_extraction.cleaned_transcript,
        english_translation=normalized_extraction.english_translation,
        form_type=normalized_extraction.form_type,
        summary=normalized_extraction.summary,
        fields_json=normalized_extraction.fields.model_dump_json(),
        missing_fields_json=json.dumps(normalized_extraction.missing_fields),
        follow_up_question=normalized_extraction.follow_up_question,
        updated_at=datetime.utcnow(),
    )
    _apply_request_participants(rec, current_user)
    session.add(rec)
    session.commit()
    session.refresh(rec)

    session.add(ChatMessage(request_id=rec.id, role=ChatRole.employee, content=source_text))
    session.add(ChatMessage(request_id=rec.id, role=ChatRole.assistant, content=_assistant_message_for_extraction(normalized_extraction)))
    session.commit()

    return RequestCreateFromAudioResponse(
        request_id=rec.id,
        asr={
            "selected_model": "Text input",
            "selected_transcript": source_text,
            "selection_reason": "Request created from typed text input",
            "all_candidates": [],
        },
        llm=normalized_extraction,
    )


def _assistant_message_for_extraction(extraction) -> str:
    fields = extraction.fields
    amount_parts = [fields.amount, fields.currency]
    amount = " ".join(part for part in amount_parts if part) or "-"
    reason = fields.reason or fields.purpose or "-"
    category = extraction.form_type or "-"
    transcript = extraction.cleaned_transcript or "-"
    translation = extraction.english_translation or "-"

    lines = [
        f"Translated transcript: {translation}",
        f"Transcript: {transcript}",
        f"Category: {category}",
        f"Amount: {amount}",
        f"Reason: {reason}",
    ]

    if extraction.follow_up_question:
        lines.append(f"Follow-up: {extraction.follow_up_question}")

    return "\n".join(lines)


def _assistant_message_for_submission(rec: RequestRecord) -> str:
    fields = ExtractedFields.model_validate_json(rec.fields_json or "{}")
    amount_parts = [fields.amount, fields.currency]
    amount = " ".join(part for part in amount_parts if part) or "-"
    reason = fields.reason or fields.purpose or "-"
    location = fields.province_or_city or fields.location or "-"
    request_number = f"REQ-{rec.id:04d}" if rec.id else "Request"

    return "\n".join([
        f"Request submitted: {request_number}",
        f"Form: {rec.form_type or '-'}",
        f"Amount: {amount}",
        f"Reason: {reason}",
        f"Location: {location}",
        f"Assigned manager: {rec.manager_name or '-'}",
    ])


@router.patch("/{request_id}/transcript", response_model=RequestRead)
def update_transcript(
    request_id: int,
    payload: RequestUpdateTranscript,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_employee_request_access(rec, current_user)

    if rec.status not in {RequestStatus.draft, RequestStatus.returned, RequestStatus.needs_clarification}:
        raise HTTPException(status_code=400, detail="Only draft or returned requests can be updated")

    transcript_text = (payload.content or "").strip()
    if not transcript_text:
        raise HTTPException(status_code=400, detail="Transcript text is required")

    try:
        llm = LLMService.from_env()
        extraction = llm.extract_from_transcript(transcript_text)
    except LLMNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {e}")

    normalized_extraction = _normalize_extraction(extraction, current_user.name)
    rec.selected_transcript = transcript_text
    rec.selection_reason = "Transcript manually corrected by employee."
    rec.cleaned_transcript = normalized_extraction.cleaned_transcript
    rec.english_translation = normalized_extraction.english_translation
    rec.form_type = normalized_extraction.form_type
    rec.summary = normalized_extraction.summary
    rec.fields_json = normalized_extraction.fields.model_dump_json()
    rec.missing_fields_json = json.dumps(normalized_extraction.missing_fields)
    rec.follow_up_question = normalized_extraction.follow_up_question
    rec.updated_at = datetime.utcnow()
    _apply_request_participants(rec, current_user)

    session.add(rec)
    session.commit()
    session.refresh(rec)
    return _record_to_read_model(rec)


async def _asr_candidates_from_waveform(registry: ModelRegistry, waveform, sr) -> list[ASRCandidate]:
    import time

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

    return candidates


@router.get("/{request_id}", response_model=RequestRead)
def get_request(
    request_id: int,
    current_user: MockUser = Depends(get_current_mock_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_request_access(rec, current_user)
    return _record_to_read_model(rec)


@router.get("/{request_id}/chat", response_model=list[ChatMessageRead])
def get_chat(
    request_id: int,
    current_user: MockUser = Depends(get_current_mock_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_request_access(rec, current_user)
    rows = session.exec(select(ChatMessage).where(ChatMessage.request_id == request_id).order_by(ChatMessage.created_at)).all()
    return [ChatMessageRead(id=r.id, created_at=r.created_at, role=r.role.value, content=r.content) for r in rows]


@router.post("/{request_id}/chat", response_model=RequestRead)
def post_chat_message(
    request_id: int,
    payload: ChatMessageCreate,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_employee_request_access(rec, current_user)

    session.add(ChatMessage(request_id=request_id, role=ChatRole.employee, content=payload.content))

    try:
        llm = LLMService.from_env()
        updated = llm.update_with_user_message(
            current_extraction_json=_current_extraction_json(rec),
            user_message=payload.content,
        )
    except LLMNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Azure OpenAI request failed: {e}")

    normalized_extraction = _normalize_extraction(updated, current_user.name)
    rec.cleaned_transcript = normalized_extraction.cleaned_transcript
    rec.english_translation = normalized_extraction.english_translation
    rec.form_type = normalized_extraction.form_type
    rec.summary = normalized_extraction.summary
    rec.fields_json = normalized_extraction.fields.model_dump_json()
    rec.missing_fields_json = json.dumps(normalized_extraction.missing_fields)
    rec.follow_up_question = normalized_extraction.follow_up_question
    rec.updated_at = datetime.utcnow()
    _apply_request_participants(rec, current_user)

    session.add(rec)
    session.add(ChatMessage(request_id=request_id, role=ChatRole.assistant, content=_assistant_message_for_extraction(normalized_extraction)))

    # mock email: employee updated request
    if rec.status in {RequestStatus.submitted, RequestStatus.returned, RequestStatus.needs_clarification}:
        EmailService(session).manager_employee_updated(rec)

    session.commit()
    session.refresh(rec)

    return _record_to_read_model(rec)


def _current_extraction_json(rec: RequestRecord) -> dict:
    try:
        fields = json.loads(rec.fields_json or "{}")
    except Exception:
        fields = {}
    try:
        missing = json.loads(rec.missing_fields_json or "[]")
    except Exception:
        missing = []

    return {
        "cleaned_transcript": rec.cleaned_transcript or "",
        "english_translation": rec.english_translation or "",
        "form_type": rec.form_type or "",
        "summary": rec.summary or "",
        "fields": fields,
        "missing_fields": missing,
        "follow_up_question": rec.follow_up_question,
    }


def _update_fields_impl(
    request_id: int,
    payload: RequestUpdateFields,
    current_user: MockUser | None,
    session: Session,
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    if current_user is not None:
        _ensure_employee_request_access(rec, current_user)

    form_type = canonical_form_type(payload.form_type if payload.form_type is not None else rec.form_type)
    fields_payload = payload.fields.model_copy(
        update={"employee_name": current_user.name if current_user else rec.employee_name}
    )
    normalized_fields = normalize_fields_for_form_type(form_type, fields_payload)
    missing = compute_missing_fields(form_type, normalized_fields)

    rec.form_type = form_type
    rec.fields_json = normalized_fields.model_dump_json()
    rec.missing_fields_json = json.dumps(missing)
    if not missing:
        rec.follow_up_question = None
    rec.updated_at = datetime.utcnow()
    if current_user is not None:
        _apply_request_participants(rec, current_user, payload.assigned_manager_id)
    session.add(rec)
    session.commit()
    session.refresh(rec)

    return _record_to_read_model(rec)


@router.patch("/{request_id}/fields", response_model=RequestRead)
def update_fields(
    request_id: int,
    payload: RequestUpdateFields,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    return _update_fields_impl(request_id, payload, current_user, session)


@router.post("/{request_id}/submit", response_model=RequestRead)
def submit_request(
    request_id: int,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_employee_request_access(rec, current_user)

    if rec.status not in {RequestStatus.draft, RequestStatus.returned, RequestStatus.needs_clarification}:
        raise HTTPException(status_code=400, detail="Only draft or returned requests can be submitted")

    if not rec.assigned_manager_id:
        raise HTTPException(status_code=400, detail="Assigned manager is required before submission")

    fields = ExtractedFields.model_validate_json(rec.fields_json or "{}")
    error_message = validation_error_message(rec.form_type, fields)
    if error_message:
        raise HTTPException(status_code=400, detail=error_message)

    rec.status = RequestStatus.submitted
    rec.updated_at = datetime.utcnow()
    rec.submitted_at = datetime.utcnow()
    rec.reviewed_at = None
    rec.approval_decision = "submitted"
    session.add(rec)
    session.add(ChatMessage(request_id=request_id, role=ChatRole.assistant, content=_assistant_message_for_submission(rec)))

    emails = EmailService(session)
    emails.employee_request_submitted(rec)
    emails.manager_new_request(rec)

    session.commit()
    session.refresh(rec)

    return _record_to_read_model(rec)


@router.delete("/{request_id}")
def delete_request(
    request_id: int,
    current_user: MockUser = Depends(require_employee_user),
    session: Session = Depends(get_session),
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    _ensure_employee_request_access(rec, current_user)

    if rec.status != RequestStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft requests can be deleted")

    chat_rows = session.exec(select(ChatMessage).where(ChatMessage.request_id == request_id)).all()
    email_rows = session.exec(select(MockEmail).where(MockEmail.request_id == request_id)).all()

    for row in chat_rows:
        session.delete(row)
    for row in email_rows:
        session.delete(row)

    session.delete(rec)
    session.commit()

    return {"ok": True, "deleted_request_id": request_id}
