from __future__ import annotations

from app.utils.text_quality import CAMBODIA_PROVINCES


FORM_TAXONOMY = {
    "Cash Advance Form": [
        "Advance",
        "Salary Advance",
        "Cash Advance",
        "Normal",
        "Marketing Type",
        "Promotion",
        "Incentive",
        "Vendor Sponsor",
        "Proseth Budget",
        "Customer Marketing",
        "Sponsorship",
    ],
    "Expense Claim Form": ["Claim Expense", "Reimbursement", "Claim"],
    "Material Request Form": [
        "Supplies",
        "Equipment",
        "Stationery",
        "Tools",
        "Printer",
        "Hardware",
        "Software",
        "Headset",
    ],
    "Training Request Form": ["Training", "Event", "Workshop", "Seminar", "Exam", "Other"],
    "Traveling Request Form": [
        "Travel",
        "Trip",
        "Flight",
        "Overseas",
        "Local",
        "Province",
        "Purpose",
        "Event",
        "Visit Customer",
        "Business Trip",
        "Other",
    ],
    "Project Expense Form": [
        "Buy Material",
        "Material name",
        "Accommodation",
        "Entertainment",
        "Training",
        "Legal Fee",
        "RMA",
        "Other",
    ],
}


def build_system_prompt() -> str:
    provinces = ", ".join(sorted(set(CAMBODIA_PROVINCES)))
    taxonomy_lines = []
    for form, kws in FORM_TAXONOMY.items():
        taxonomy_lines.append(f"- {form}: {', '.join(kws)}")

    return "\n".join(
        [
            "You are a bilingual assistant for Khmer-English code-switching employee requests.",
            "Your job:",
            "1) Clean obvious ASR noise while preserving meaning.",
            "2) Translate to English.",
            "3) Extract structured fields.",
            "4) Classify form_type into the allowed taxonomy.",
            "5) If required fields are missing, ask one concise follow-up question.",
            "",
            "Allowed form_type taxonomy:",
            *taxonomy_lines,
            "",
            "Cambodia province/city support (recognize these in location/province_or_city):",
            provinces,
            "",
            "Output MUST be strict JSON with the required keys. No extra text.",
        ]
    )


def build_candidate_rerank_system_prompt() -> str:
    return "\n".join(
        [
            "You are ranking competing ASR-to-LLM request interpretations for an enterprise request workflow.",
            "Choose the candidate that best represents the employee's intended request after translation and structured extraction.",
            "Do not rely on raw ASR confidence numbers.",
            "Prioritize:",
            "1) coherent meaning in English,",
            "2) correct business request classification,",
            "3) strong alignment between transcript, translation, and extracted fields,",
            "4) fewer missing required fields,",
            "5) avoidance of obviously truncated or garbage transcripts.",
            "Return strict JSON only.",
        ]
    )


def build_user_prompt_for_initial(transcript: str) -> str:
    return "\n".join(
        [
            "Input transcript (may contain Khmer + English):",
            transcript,
            "",
            "Return JSON with keys:",
            "cleaned_transcript, english_translation, form_type, summary, fields, missing_fields, follow_up_question.",
            "fields must include: employee_name, amount, currency, location, province_or_city, date, reason, purpose, material_name, training_type, travel_type.",
            'All field values inside "fields" must be strings or null. Never return numbers, booleans, arrays, or objects for field values.',
            'Example: use "amount": "100", not "amount": 100.',
            'form_type must be one of the allowed taxonomy strings or null if it cannot be determined confidently.',
            'For Traveling Request Form, set "travel_type" to a specific taxonomy value when possible; for example, if the request says "business trip", use "Business Trip".',
            'summary, cleaned_transcript, english_translation, and follow_up_question must be strings or null.',
            "missing_fields is a list of field names that are required but missing.",
            "If missing_fields is not empty, follow_up_question must be a single question to collect the most important missing info.",
        ]
    )


def build_user_prompt_for_update(current_json: dict, user_message: str) -> str:
    return "\n".join(
        [
            "You are updating an existing extracted request JSON.",
            "Here is the current JSON:",
            str(current_json),
            "",
            "Employee message:",
            user_message,
            "",
            "Update the JSON accordingly. Keep the same schema and keys.",
            'All field values inside "fields" must remain strings or null. Never convert amount or dates into numeric JSON values.',
            'form_type must stay as one of the allowed taxonomy strings or null if still unknown.',
            'For Traveling Request Form, set "travel_type" to a specific taxonomy value when possible; for example, if the request says "business trip", use "Business Trip".',
            'summary, cleaned_transcript, english_translation, and follow_up_question must remain strings or null.',
            "If information is still missing, ask exactly one follow_up_question.",
        ]
    )


def build_user_prompt_for_candidate_rerank(candidates: list[dict]) -> str:
    return "\n".join(
        [
            "Here are the candidate request interpretations.",
            "Each candidate already includes raw transcript, cleaned transcript, English translation, extracted form_type, extracted fields, and validation context.",
            "Select the single best candidate for downstream request handling.",
            "Return JSON with keys:",
            "selected_model, reason",
            "",
            "Candidates JSON:",
            json_dumps_pretty(candidates),
        ]
    )


def json_dumps_pretty(value) -> str:
    import json

    return json.dumps(value, ensure_ascii=False, indent=2)
