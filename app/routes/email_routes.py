from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.storage.database import get_session
from app.storage.models import MockEmail
from app.schemas.email_schema import MockEmailRead

router = APIRouter(tags=["emails"])


@router.get("/emails", response_model=list[MockEmailRead])
def list_emails(session: Session = Depends(get_session)):
    rows = session.exec(select(MockEmail).order_by(MockEmail.created_at.desc())).all()
    return [
        MockEmailRead(
            id=e.id,
            request_id=e.request_id,
            created_at=e.created_at,
            audience=e.audience.value,
            subject=e.subject,
            body=e.body,
        )
        for e in rows
    ]
