from __future__ import annotations

import re
from dataclasses import dataclass


REQUEST_KEYWORDS = {
    # general
    "request",
    "approve",
    "approval",
    "need",
    "please",
    # taxonomy
    "advance",
    "salary advance",
    "cash advance",
    "claim",
    "reimbursement",
    "expense",
    "supplies",
    "equipment",
    "stationery",
    "tools",
    "training",
    "event",
    "workshop",
    "seminar",
    "exam",
    "travel",
    "trip",
    "flight",
    "overseas",
    "local",
    "province",
    "purpose",
    "visit customer",
    "business trip",
    "project",
    "accommodation",
    "entertainment",
    "legal fee",
    "rma",
    # entities
    "amount",
    "usd",
    "khr",
    "riel",
    "dollar",
    "date",
    "reason",
    "location",
}

CAMBODIA_PROVINCES = [
    "phnom penh",
    "banteay meanchey",
    "battambang",
    "kampong cham",
    "kampong chhnang",
    "kampong speu",
    "kampong thom",
    "kampot",
    "kandal",
    "kep",
    "koh kong",
    "kratie",
    "mondulkiri",
    "oddar meanchey",
    "pailin",
    "preah vihear",
    "prey veng",
    "pursat",
    "ratanakiri",
    "siem reap",
    "preah sihanouk",
    "stung treng",
    "svay rieng",
    "takeo",
    "tboung khmum",
]


def normalize_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _has_long_repetition(text: str) -> bool:
    # repeated word/substring patterns
    lowered = text.lower()
    if re.search(r"\b(\w{2,})\b(?:\s+\1\b){2,}", lowered):
        return True
    if re.search(r"(.)\1{6,}", lowered):
        return True
    return False


def _garbage_ratio(text: str) -> float:
    if not text:
        return 1.0
    # ratio of non-letter/digit/space characters
    bad = sum(1 for ch in text if not (ch.isalnum() or ch.isspace() or ("\u1780" <= ch <= "\u17FF")))
    return bad / max(1, len(text))


@dataclass
class QualitySignals:
    keyword_hits: int
    province_hits: int
    has_amount: bool
    has_date: bool
    repetition: bool
    garbage_ratio: float


def extract_quality_signals(text: str) -> QualitySignals:
    norm = normalize_text(text)
    lowered = norm.lower()

    keyword_hits = 0
    for kw in REQUEST_KEYWORDS:
        if kw in lowered:
            keyword_hits += 1

    province_hits = 0
    for p in CAMBODIA_PROVINCES:
        if p in lowered:
            province_hits += 1

    has_amount = bool(re.search(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b", lowered))
    has_date = bool(re.search(r"\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}/\d{1,2}/\d{2,4}\b", lowered))

    repetition = _has_long_repetition(norm)
    garbage_ratio = _garbage_ratio(norm)

    return QualitySignals(
        keyword_hits=keyword_hits,
        province_hits=province_hits,
        has_amount=has_amount,
        has_date=has_date,
        repetition=repetition,
        garbage_ratio=garbage_ratio,
    )


def transcript_quality_score(text: str) -> float:
    """Heuristic score in [0,1]."""
    norm = normalize_text(text)
    if not norm:
        return 0.0

    signals = extract_quality_signals(norm)

    score = 0.45
    score += min(0.25, 0.03 * signals.keyword_hits)
    score += min(0.15, 0.05 * signals.province_hits)
    score += 0.08 if signals.has_amount else 0.0
    score += 0.07 if signals.has_date else 0.0

    if signals.repetition:
        score -= 0.18
    score -= min(0.25, 0.7 * signals.garbage_ratio)

    # length shaping
    if len(norm) < 8:
        score -= 0.2
    elif len(norm) > 350:
        score -= 0.05

    return float(max(0.0, min(1.0, score)))
