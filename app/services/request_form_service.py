from __future__ import annotations

from typing import Any

from app.schemas.request_schema import ExtractedFields
from app.services.prompts import FORM_TAXONOMY

ALL_FIELD_KEYS = tuple(ExtractedFields.model_fields.keys())
SHARED_FIELD_KEYS = (
    "employee_name",
    "amount",
    "currency",
    "location",
    "province_or_city",
    "reason",
    "purpose",
    "priority",
)

FORM_SCHEMAS: dict[str, dict[str, Any]] = {
    "Cash Advance Form": {
        "extra_fields": (),
        "required_fields": ("employee_name", "reason", "province_or_city", "amount", "currency"),
        "money_required": True,
    },
    "Expense Claim Form": {
        "extra_fields": (),
        "required_fields": ("employee_name", "reason", "amount", "currency"),
        "money_required": True,
    },
    "Material Request Form": {
        "extra_fields": ("material_name",),
        "required_fields": ("employee_name", "reason", "material_name"),
        "money_required": False,
    },
    "Training Request Form": {
        "extra_fields": ("date", "training_type"),
        "required_fields": ("employee_name", "reason", "training_type"),
        "money_required": False,
    },
    "Traveling Request Form": {
        "extra_fields": ("travel_type",),
        "required_fields": ("employee_name", "reason", "province_or_city", "travel_type"),
        "money_required": False,
    },
    "Project Expense Form": {
        "extra_fields": ("date", "material_name"),
        "required_fields": ("employee_name", "reason", "amount", "currency"),
        "money_required": True,
    },
}

MISSING_FIELD_ORDER = (
    "form_type",
    "employee_name",
    "reason",
    "province_or_city",
    "amount",
    "currency",
    "date",
    "material_name",
    "training_type",
    "travel_type",
)


def canonical_form_type(form_type: str | None) -> str | None:
    normalized = (form_type or "").strip()
    if not normalized:
        return None

    for option in FORM_TAXONOMY:
        if option.casefold() == normalized.casefold():
            return option

    return normalized


def normalize_fields_for_form_type(form_type: str | None, fields: ExtractedFields | dict | None) -> ExtractedFields:
    canonical = canonical_form_type(form_type)
    schema = FORM_SCHEMAS.get(canonical)
    raw = _raw_field_dict(fields)

    normalized = {key: _clean_string(raw.get(key)) for key in ALL_FIELD_KEYS}

    if normalized["reason"] and not normalized["purpose"]:
        normalized["purpose"] = normalized["reason"]
    elif normalized["purpose"] and not normalized["reason"]:
        normalized["reason"] = normalized["purpose"]

    if normalized["province_or_city"] and not normalized["location"]:
        normalized["location"] = normalized["province_or_city"]
    elif normalized["location"] and not normalized["province_or_city"]:
        normalized["province_or_city"] = normalized["location"]

    if canonical == "Traveling Request Form" and not normalized["travel_type"]:
        normalized["travel_type"] = _infer_travel_type(" ".join(
            value for value in [normalized["reason"], normalized["purpose"]] if value
        ))

    allowed = set(SHARED_FIELD_KEYS)
    if schema:
        allowed.update(schema["extra_fields"])
    else:
        allowed.update(ALL_FIELD_KEYS)

    sanitized = {key: (normalized[key] if key in allowed else None) for key in ALL_FIELD_KEYS}
    return ExtractedFields(**sanitized)


def compute_missing_fields(form_type: str | None, fields: ExtractedFields | dict | None) -> list[str]:
    canonical = canonical_form_type(form_type)
    normalized = normalize_fields_for_form_type(canonical, fields)
    values = normalized.model_dump()
    schema = FORM_SCHEMAS.get(canonical, {"required_fields": ("employee_name", "reason"), "money_required": False})

    missing: list[str] = []

    if not canonical:
        missing.append("form_type")

    if _is_blank(values["employee_name"]):
        missing.append("employee_name")

    if _is_blank(values["reason"]) and _is_blank(values["purpose"]):
        missing.append("reason")

    if "province_or_city" in schema["required_fields"] and _is_blank(values["province_or_city"]) and _is_blank(values["location"]):
        missing.append("province_or_city")

    if "date" in schema["required_fields"] and _is_blank(values["date"]):
        missing.append("date")

    if "material_name" in schema["required_fields"] and _is_blank(values["material_name"]):
        missing.append("material_name")

    if "training_type" in schema["required_fields"] and _is_blank(values["training_type"]):
        missing.append("training_type")

    if "travel_type" in schema["required_fields"] and _is_blank(values["travel_type"]):
        missing.append("travel_type")

    amount_present = not _is_blank(values["amount"])
    amount_required = bool(schema["money_required"])

    if amount_required and not amount_present:
        missing.append("amount")

    if amount_present and _is_blank(values["currency"]):
        missing.append("currency")

    ordered = [field for field in MISSING_FIELD_ORDER if field in missing]
    extras = [field for field in missing if field not in ordered]
    return ordered + extras


def validation_error_message(form_type: str | None, fields: ExtractedFields | dict | None) -> str | None:
    missing = compute_missing_fields(form_type, fields)
    if not missing:
        return None

    labels = ", ".join(missing)
    return f"Missing required fields: {labels}"


def _raw_field_dict(fields: ExtractedFields | dict | None) -> dict[str, Any]:
    if isinstance(fields, ExtractedFields):
        return fields.model_dump()
    if isinstance(fields, dict):
        return fields
    return {}


def _clean_string(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _is_blank(value: Any) -> bool:
    return value is None or str(value).strip() == ""


def _infer_travel_type(text: str) -> str | None:
    import re

    normalized = (text or "").strip().casefold()
    if not normalized:
        return None

    if re.search(r"\bbusiness\s+(trip|travel)\b|\bwork\s+trip\b", normalized):
        return "Business Trip"
    if re.search(r"\bvisit\s+(customer|client)\b|\b(customer|client)\s+visit\b", normalized):
        return "Visit Customer"
    if re.search(r"\b(overseas|international|flight)\b", normalized):
        return "Overseas"
    if re.search(r"\b(local|domestic|province)\b", normalized):
        return "Local"
    if re.search(r"\b(event|conference|seminar|workshop)\b", normalized):
        return "Event"
    if re.search(r"\btrip|travel\b", normalized):
        return "Travel"

    return None
