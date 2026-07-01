from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class MockEmailRead(BaseModel):
    id: int
    request_id: int | None
    created_at: datetime
    audience: str
    subject: str
    body: str
