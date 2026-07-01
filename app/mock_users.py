from __future__ import annotations

from typing import Literal

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field


MockUserRole = Literal["employee", "manager"]


class MockUser(BaseModel):
    id: str
    name: str
    email: str
    password: str = Field(repr=False)
    role: MockUserRole
    department: str
    default_manager_id: str | None = None


MOCK_USERS: list[MockUser] = [
    MockUser(
        id="MGR001",
        name="Sok Dara",
        email="dara.manager@company.com",
        password="MgrOps!2026",
        role="manager",
        department="Operations",
    ),
    MockUser(
        id="MGR002",
        name="Chan Sophea",
        email="sophea.manager@company.com",
        password="MgrFin!2026",
        role="manager",
        department="Finance",
    ),
    MockUser(
        id="MGR003",
        name="Lim Vannak",
        email="vannak.manager@company.com",
        password="MgrHR!2026",
        role="manager",
        department="HR/Admin",
    ),
    MockUser(
        id="EMP001",
        name="Pisey",
        email="pisey@company.com",
        password="EmpPisey!2026",
        role="employee",
        department="Marketing",
        default_manager_id="MGR002",
    ),
    MockUser(
        id="EMP002",
        name="Rithy",
        email="rithy@company.com",
        password="EmpRithy!2026",
        role="employee",
        department="Sales",
        default_manager_id="MGR001",
    ),
    MockUser(
        id="EMP003",
        name="Sreynich",
        email="sreynich@company.com",
        password="EmpSrey!2026",
        role="employee",
        department="HR",
        default_manager_id="MGR003",
    ),
    MockUser(
        id="EMP004",
        name="Dara",
        email="dara.employee@company.com",
        password="EmpDara!2026",
        role="employee",
        department="Operations",
        default_manager_id="MGR001",
    ),
]

MOCK_USER_BY_ID = {user.id: user for user in MOCK_USERS}


def list_mock_users() -> list[MockUser]:
    return MOCK_USERS


def list_mock_managers() -> list[MockUser]:
    return [user for user in MOCK_USERS if user.role == "manager"]


def get_mock_user(user_id: str | None) -> MockUser | None:
    if not user_id:
        return None
    return MOCK_USER_BY_ID.get(user_id)


def authenticate_mock_user(email: str, password: str) -> MockUser | None:
    normalized_email = (email or "").strip().casefold()
    normalized_password = (password or "").strip()
    for user in MOCK_USERS:
        if user.email.casefold() == normalized_email and user.password == normalized_password:
            return user
    return None


def public_mock_user_payload(user: MockUser) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "default_manager_id": user.default_manager_id,
    }


def resolve_assigned_manager(manager_id: str | None, fallback_manager_id: str | None = None) -> MockUser:
    manager = get_mock_user(manager_id) or get_mock_user(fallback_manager_id)
    if not manager or manager.role != "manager":
        manager = get_mock_user("MGR001")
    if not manager:
        raise HTTPException(status_code=500, detail="Mock manager configuration is missing")
    return manager


def get_current_mock_user(x_mock_user_id: str | None = Header(default=None, alias="X-Mock-User-Id")) -> MockUser:
    user = get_mock_user(x_mock_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Mock login is required")
    return user


def require_employee_user(x_mock_user_id: str | None = Header(default=None, alias="X-Mock-User-Id")) -> MockUser:
    user = get_current_mock_user(x_mock_user_id)
    if user.role != "employee":
        raise HTTPException(status_code=403, detail="Employee access is required")
    return user


def require_manager_user(x_mock_user_id: str | None = Header(default=None, alias="X-Mock-User-Id")) -> MockUser:
    user = get_current_mock_user(x_mock_user_id)
    if user.role != "manager":
        raise HTTPException(status_code=403, detail="Manager access is required")
    return user
