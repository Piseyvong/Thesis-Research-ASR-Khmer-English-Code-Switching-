from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.mock_users import MockUser, require_manager_user
from app.storage.database import get_session
from app.storage.models import RequestRecord, RequestStatus, ChatMessage, ChatRole
from app.schemas.request_schema import RequestRead
from app.routes.request_routes import _record_to_read_model
from app.services.email_service import EmailService

router = APIRouter(tags=["manager"])


class ManagerAction(BaseModel):
    comment: str | None = None
    question: str | None = None


@router.get("/requests", response_model=list[RequestRead])
def list_requests(
    current_user: MockUser = Depends(require_manager_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(RequestRecord)
        .where(RequestRecord.assigned_manager_id == current_user.id)
        .order_by(RequestRecord.created_at.desc())
    ).all()
    return [_record_to_read_model(r) for r in rows]

def _manager_action_impl(
    request_id: int,
    payload: ManagerAction,
    action: str,
    current_user: MockUser | None,
    session: Session,
):
    rec = session.get(RequestRecord, request_id)
    if not rec:
        raise HTTPException(status_code=404, detail="not found")
    if current_user and rec.assigned_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="This request is not assigned to the current manager")
    if rec.status != RequestStatus.submitted:
        raise HTTPException(status_code=400, detail="Only submitted requests can be reviewed")

    if action == "approve":
        rec.status = RequestStatus.approved
        rec.manager_comment = payload.comment
        rec.updated_at = datetime.utcnow()
        rec.reviewed_at = datetime.utcnow()
        rec.approval_decision = "approved"
        session.add(ChatMessage(request_id=request_id, role=ChatRole.manager, content=f"Approved. {payload.comment or ''}".strip()))
        EmailService(session).employee_request_approved(rec)
    elif action == "reject":
        if not (payload.comment or "").strip():
            raise HTTPException(status_code=400, detail="A rejection comment is required")
        rec.status = RequestStatus.rejected
        rec.manager_comment = payload.comment.strip()
        rec.updated_at = datetime.utcnow()
        rec.reviewed_at = datetime.utcnow()
        rec.approval_decision = "rejected"
        session.add(ChatMessage(request_id=request_id, role=ChatRole.manager, content=f"Rejected. {payload.comment or ''}".strip()))
        EmailService(session).employee_request_rejected(rec)
    elif action == "return":
        if not payload.question:
            raise HTTPException(status_code=400, detail="question is required")
        rec.status = RequestStatus.returned
        rec.manager_comment = payload.comment
        rec.updated_at = datetime.utcnow()
        rec.reviewed_at = datetime.utcnow()
        rec.approval_decision = "returned"
        session.add(ChatMessage(request_id=request_id, role=ChatRole.manager, content=f"Returned for correction: {payload.question}"))
        EmailService(session).employee_needs_clarification(rec, payload.question)
    else:
        raise HTTPException(status_code=400, detail="Unknown manager action")

    session.add(rec)
    session.commit()
    session.refresh(rec)
    return _record_to_read_model(rec)


@router.post("/requests/{request_id}/reject", response_model=RequestRead)
def reject(
    request_id: int,
    payload: ManagerAction,
    current_user: MockUser = Depends(require_manager_user),
    session: Session = Depends(get_session),
):
    return _manager_action_impl(request_id, payload, "reject", current_user, session)


@router.post("/requests/{request_id}/approve", response_model=RequestRead)
def approve(
    request_id: int,
    payload: ManagerAction,
    current_user: MockUser = Depends(require_manager_user),
    session: Session = Depends(get_session),
):
    return _manager_action_impl(request_id, payload, "approve", current_user, session)


@router.post("/requests/{request_id}/return", response_model=RequestRead)
def return_for_correction(
    request_id: int,
    payload: ManagerAction,
    current_user: MockUser = Depends(require_manager_user),
    session: Session = Depends(get_session),
):
    return _manager_action_impl(request_id, payload, "return", current_user, session)


@router.post("/requests/{request_id}/clarify", response_model=RequestRead)
def clarify(
    request_id: int,
    payload: ManagerAction,
    current_user: MockUser = Depends(require_manager_user),
    session: Session = Depends(get_session),
):
    return _manager_action_impl(request_id, payload, "return", current_user, session)
