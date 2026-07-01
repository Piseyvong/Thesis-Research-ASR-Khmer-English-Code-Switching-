from __future__ import annotations

import json
from datetime import datetime

from sqlmodel import Session, select

from app.mock_users import get_mock_user, resolve_assigned_manager
from app.storage.database import engine
from app.storage.models import RequestRecord, RequestStatus, ChatMessage, ChatRole


def seed_if_empty() -> None:
    with Session(engine) as session:
        _backfill_request_ownership(session)
        existing = session.exec(select(RequestRecord).limit(1)).first()
        if existing:
            session.commit()
            return

        employee = get_mock_user("EMP001")
        manager = resolve_assigned_manager(employee.default_manager_id if employee else None)
        sample = RequestRecord(
            employee_name=employee.name if employee else "Pisey",
            manager_name=manager.name,
            requester_id=employee.id if employee else "EMP001",
            requester_email=employee.email if employee else "pisey@company.com",
            requester_department=employee.department if employee else "Marketing",
            assigned_manager_id=manager.id,
            assigned_manager_email=manager.email,
            assigned_manager_department=manager.department,
            status=RequestStatus.draft,
            selected_model=None,
            selected_transcript=None,
            english_translation=None,
            form_type=None,
            fields_json=json.dumps({}),
            missing_fields_json=json.dumps([]),
        )
        session.add(sample)
        session.commit()
        session.refresh(sample)

        session.add(ChatMessage(request_id=sample.id, role=ChatRole.assistant, content="Upload or record audio to start your request."))
        session.commit()


def _backfill_request_ownership(session: Session) -> None:
    rows = session.exec(select(RequestRecord)).all()
    for record in rows:
        employee = None
        if record.requester_id:
            employee = get_mock_user(record.requester_id)

        if employee is None:
            employee = next(
                (
                    candidate
                    for candidate in [get_mock_user("EMP001"), get_mock_user("EMP002"), get_mock_user("EMP003"), get_mock_user("EMP004")]
                    if candidate and candidate.name.casefold() == (record.employee_name or "").casefold()
                ),
                None,
            )

        if employee is None:
            employee = get_mock_user("EMP001")

        manager = resolve_assigned_manager(record.assigned_manager_id or (employee.default_manager_id if employee else None))

        if employee:
            record.employee_name = employee.name
            record.requester_id = employee.id
            record.requester_email = employee.email
            record.requester_department = employee.department

        record.manager_name = manager.name
        record.assigned_manager_id = manager.id
        record.assigned_manager_email = manager.email
        record.assigned_manager_department = manager.department
        session.add(record)
