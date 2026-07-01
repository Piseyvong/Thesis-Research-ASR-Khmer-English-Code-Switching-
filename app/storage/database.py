from __future__ import annotations

import os
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

from app.config import settings
from app.storage.models import RequestRecord


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    if not database_url.startswith("sqlite"):  # only needed for sqlite file
        return
    # sqlite:///./data/app.db or sqlite:////abs/path
    if database_url.startswith("sqlite:///./"):
        rel_path = database_url.replace("sqlite:///./", "")
        parent = os.path.dirname(rel_path)
        if parent:
            os.makedirs(parent, exist_ok=True)


_ensure_sqlite_parent_dir(settings.database_url)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _apply_sqlite_migrations()


def get_session():
    with Session(engine) as session:
        yield session


def _apply_sqlite_migrations() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    inspector = inspect(engine)
    table_name = getattr(RequestRecord, "__tablename__", "requestrecord")
    if not inspector.has_table(table_name):
        return

    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    migrations = {
        "requester_id": "ALTER TABLE requestrecord ADD COLUMN requester_id VARCHAR",
        "requester_email": "ALTER TABLE requestrecord ADD COLUMN requester_email VARCHAR",
        "requester_department": "ALTER TABLE requestrecord ADD COLUMN requester_department VARCHAR",
        "assigned_manager_id": "ALTER TABLE requestrecord ADD COLUMN assigned_manager_id VARCHAR",
        "assigned_manager_email": "ALTER TABLE requestrecord ADD COLUMN assigned_manager_email VARCHAR",
        "assigned_manager_department": "ALTER TABLE requestrecord ADD COLUMN assigned_manager_department VARCHAR",
        "submitted_at": "ALTER TABLE requestrecord ADD COLUMN submitted_at DATETIME",
        "reviewed_at": "ALTER TABLE requestrecord ADD COLUMN reviewed_at DATETIME",
        "approval_decision": "ALTER TABLE requestrecord ADD COLUMN approval_decision VARCHAR",
    }

    with engine.begin() as connection:
        for column_name, statement in migrations.items():
            if column_name not in existing_columns:
                connection.execute(text(statement))
