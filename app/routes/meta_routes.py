from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.mock_users import authenticate_mock_user, list_mock_users, public_mock_user_payload
from app.services.asr.model_registry import ModelRegistry

router = APIRouter(tags=["meta"])


class MockLoginRequest(BaseModel):
    email: str
    password: str


@router.get("/models")
def list_models():
    registry = ModelRegistry.from_env()
    return registry.describe()


@router.get("/session/users")
def list_session_users():
    return [public_mock_user_payload(user) for user in list_mock_users()]


@router.post("/session/login")
def login_session(payload: MockLoginRequest):
    user = authenticate_mock_user(payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return public_mock_user_payload(user)
