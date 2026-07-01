from __future__ import annotations

import argparse
import csv
import math
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


ASR_MODEL_NAMES = ("wav2vec2", "whisper-small", "whisper-medium")

BASE_COLUMNS = (
    "audio_id",
    "audio_path",
    "reference_transcript",
    "expected_form_type",
    "expected_amount",
    "expected_currency",
    "expected_description",
)


@dataclass
class FieldComparison:
    """Field correctness is stored together so all evaluators use the same formulas."""

    form_type_correct: bool
    amount_correct: bool
    currency_correct: bool
    description_correct: bool
    description_match_method: str
    description_overlap: float | None

    @property
    def field_accuracy(self) -> float:
        values = [
            self.form_type_correct,
            self.amount_correct,
            self.currency_correct,
            self.description_correct,
        ]
        return sum(1 for value in values if value) / len(values)

    @property
    def joint_accuracy(self) -> bool:
        return (
            self.form_type_correct
            and self.amount_correct
            and self.currency_correct
            and self.description_correct
        )


def add_common_args(parser: argparse.ArgumentParser) -> argparse.ArgumentParser:
    parser.add_argument("--csv", required=True, help="Evaluation CSV with labeled expected outputs.")
    parser.add_argument("--results-dir", default="results", help="Directory where CSV summaries are written.")
    parser.add_argument(
        "--description-overlap-threshold",
        type=float,
        default=0.60,
        help="Keyword-overlap threshold used when description exact match fails.",
    )
    parser.add_argument(
        "--no-charts",
        action="store_true",
        help="Skip optional matplotlib chart generation.",
    )
    return parser


def read_eval_rows(csv_path: str | Path, required_columns: Iterable[str] = BASE_COLUMNS) -> list[dict[str, str]]:
    """Load the labeled evaluation CSV and fail early if thesis labels are missing."""

    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"Evaluation CSV not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing = [column for column in required_columns if column not in fieldnames]
        if missing:
            raise ValueError(
                f"Evaluation CSV is missing required columns: {missing}. "
                f"Expected columns include: {list(required_columns)}"
            )
        rows = [dict(row) for row in reader]

    if not rows:
        raise ValueError(f"Evaluation CSV has no rows: {path}")
    return rows


def write_csv(path: str | Path, rows: list[dict[str, Any]], fieldnames: list[str] | None = None) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if fieldnames is None:
        fieldnames = sorted({key for row in rows for key in row.keys()})
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def print_table(title: str, rows: list[dict[str, Any]], columns: list[str]) -> None:
    """Print compact console tables so long evaluation runs end with readable summaries."""

    print(f"\n{title}")
    if not rows:
        print("(no rows)")
        return
    widths = {
        col: max(len(col), *(len(_format_cell(row.get(col))) for row in rows))
        for col in columns
    }
    print("  ".join(col.ljust(widths[col]) for col in columns))
    print("  ".join("-" * widths[col] for col in columns))
    for row in rows:
        print("  ".join(_format_cell(row.get(col)).ljust(widths[col]) for col in columns))


def _format_cell(value: Any) -> str:
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        return f"{value:.4f}"
    return "" if value is None else str(value)


def normalize_text(text: Any) -> str:
    """Normalize Khmer/English spacing and Unicode without changing audio IDs."""

    if text is None:
        return ""
    value = unicodedata.normalize("NFC", str(text))
    value = value.strip().casefold()
    value = re.sub(r"\s+", " ", value)
    return value


def tokenize_words(text: Any) -> list[str]:
    norm = normalize_text(text)
    return norm.split() if norm else []


def tokenize_chars(text: Any) -> list[str]:
    return list(normalize_text(text))


def levenshtein_distance(reference: list[str], prediction: list[str]) -> int:
    """Compute edit distance used by WER and CER."""

    rows = len(reference) + 1
    cols = len(prediction) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if reference[i - 1] == prediction[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[-1][-1]


def wer(reference: Any, prediction: Any) -> float:
    """Word Error Rate: WER = (S + D + I) / N = edit_distance_words / reference_words."""

    ref = tokenize_words(reference)
    pred = tokenize_words(prediction)
    if not ref:
        return 0.0 if not pred else 1.0
    return levenshtein_distance(ref, pred) / len(ref)


def cer(reference: Any, prediction: Any) -> float:
    """Character Error Rate: CER = (S + D + I) / N = edit_distance_chars / reference_chars."""

    ref = tokenize_chars(reference)
    pred = tokenize_chars(prediction)
    if not ref:
        return 0.0 if not pred else 1.0
    return levenshtein_distance(ref, pred) / len(ref)


def average(values: Iterable[float]) -> float:
    values = list(values)
    return sum(values) / len(values) if values else 0.0


FORM_ALIASES = {
    "cash advance": "Cash Advance Form",
    "cash advance form": "Cash Advance Form",
    "advance": "Cash Advance Form",
    "expense claim": "Expense Claim Form",
    "expense claim form": "Expense Claim Form",
    "reimbursement": "Expense Claim Form",
    "material request": "Material Request Form",
    "material request form": "Material Request Form",
    "training request": "Training Request Form",
    "training request form": "Training Request Form",
    "travel request": "Traveling Request Form",
    "traveling request": "Traveling Request Form",
    "traveling request form": "Traveling Request Form",
    "project expense": "Project Expense Form",
    "project expense form": "Project Expense Form",
}


def normalize_form_type(value: Any) -> str:
    text = normalize_text(value)
    text = text.replace("_", " ").replace("-", " ")
    text = re.sub(r"\bform\b", "form", text)
    return FORM_ALIASES.get(text, str(value or "").strip())


CURRENCY_ALIASES = {
    "usd": "USD",
    "us dollar": "USD",
    "us dollars": "USD",
    "dollar": "USD",
    "dollars": "USD",
    "$": "USD",
    "ដុល្លារ": "USD",
    "riel": "KHR",
    "riels": "KHR",
    "khr": "KHR",
    "រៀល": "KHR",
}


def normalize_currency(value: Any) -> str:
    text = normalize_text(value)
    return CURRENCY_ALIASES.get(text, text.upper())


EN_NUMBERS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
EN_SCALES = {"hundred": 100, "thousand": 1000, "million": 1000000}

KH_NUMBERS = {
    "សូន្យ": 0,
    "មួយ": 1,
    "ពីរ": 2,
    "បី": 3,
    "បួន": 4,
    "ប្រាំ": 5,
    "ប្រាំមួយ": 6,
    "ប្រាំពីរ": 7,
    "ប្រាំបី": 8,
    "ប្រាំបួន": 9,
    "ដប់": 10,
    "ម្ភៃ": 20,
    "សាមសិប": 30,
    "សែសិប": 40,
    "ហាសិប": 50,
    "ហុកសិប": 60,
    "ចិតសិប": 70,
    "ប៉ែតសិប": 80,
    "កៅសិប": 90,
    "រយ": 100,
    "មួយរយ": 100,
    "ពាន់": 1000,
    "មួយពាន់": 1000,
}


def normalize_amount(value: Any) -> str:
    """Normalize numeric amounts, including common English and Khmer number words."""

    text = normalize_text(value)
    if not text:
        return ""

    numeric = re.search(r"\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?", text)
    if numeric:
        return _clean_number(numeric.group(0))

    kh_value = _parse_khmer_number(text)
    if kh_value is not None:
        return str(kh_value)

    en_value = _parse_english_number(text)
    if en_value is not None:
        return str(en_value)

    return text


def _clean_number(text: str) -> str:
    value = text.replace(",", "")
    if "." in value:
        value = value.rstrip("0").rstrip(".")
    return value


def _parse_english_number(text: str) -> int | None:
    tokens = re.findall(r"[a-z]+", text.casefold().replace("-", " "))
    if not tokens:
        return None
    total = 0
    current = 0
    seen = False
    for token in tokens:
        if token in EN_NUMBERS:
            current += EN_NUMBERS[token]
            seen = True
        elif token == "and":
            continue
        elif token in EN_SCALES:
            scale = EN_SCALES[token]
            if current == 0:
                current = 1
            current *= scale
            if scale >= 1000:
                total += current
                current = 0
            seen = True
        else:
            continue
    return total + current if seen else None


def _parse_khmer_number(text: str) -> int | None:
    compact = re.sub(r"\s+", "", text)
    compact = compact.replace("ដុល្លារ", "").replace("រៀល", "")
    if not compact:
        return None

    if compact in KH_NUMBERS:
        return KH_NUMBERS[compact]

    total = 0
    remainder = compact
    if "ម៉ឺន" in remainder:
        before, remainder = remainder.split("ម៉ឺន", 1)
        total += (KH_NUMBERS.get(before, 1) if before else 1) * 10000
    if "ពាន់" in remainder:
        before, remainder = remainder.split("ពាន់", 1)
        total += (KH_NUMBERS.get(before, 1) if before else 1) * 1000
    if "រយ" in remainder:
        before, remainder = remainder.split("រយ", 1)
        total += (KH_NUMBERS.get(before, 1) if before else 1) * 100
    if remainder:
        if remainder in KH_NUMBERS:
            total += KH_NUMBERS[remainder]
        else:
            tens = {k: v for k, v in KH_NUMBERS.items() if v in {10, 20, 30, 40, 50, 60, 70, 80, 90}}
            for token, value in sorted(tens.items(), key=lambda item: len(item[0]), reverse=True):
                if remainder.startswith(token):
                    total += value
                    tail = remainder[len(token) :]
                    if tail:
                        total += KH_NUMBERS.get(tail, 0)
                    break
    return total if total else None


def compare_description(expected: Any, predicted: Any, overlap_threshold: float = 0.60) -> tuple[bool, str, float | None]:
    expected_norm = normalize_text(expected)
    predicted_norm = normalize_text(predicted)
    if expected_norm == predicted_norm:
        return True, "exact", 1.0
    expected_keywords = set(tokenize_words(expected_norm))
    predicted_keywords = set(tokenize_words(predicted_norm))
    if not expected_keywords:
        return predicted_norm == "", "blank_expected", None
    overlap = len(expected_keywords & predicted_keywords) / len(expected_keywords)
    if overlap >= overlap_threshold:
        return True, "keyword_overlap", overlap
    return False, "manual_review", overlap


def compare_fields(
    expected: dict[str, Any],
    predicted: dict[str, Any],
    description_overlap_threshold: float = 0.60,
) -> FieldComparison:
    desc_ok, desc_method, desc_overlap = compare_description(
        expected.get("expected_description"),
        predicted.get("description"),
        overlap_threshold=description_overlap_threshold,
    )
    return FieldComparison(
        form_type_correct=normalize_form_type(expected.get("expected_form_type"))
        == normalize_form_type(predicted.get("form_type")),
        amount_correct=normalize_amount(expected.get("expected_amount")) == normalize_amount(predicted.get("amount")),
        currency_correct=normalize_currency(expected.get("expected_currency"))
        == normalize_currency(predicted.get("currency")),
        description_correct=desc_ok,
        description_match_method=desc_method,
        description_overlap=desc_overlap,
    )


def extraction_to_eval_fields(extraction: Any) -> dict[str, Any]:
    """Convert the app's LLM extraction object into the four thesis evaluation fields."""

    fields = getattr(extraction, "fields", None)
    reason = getattr(fields, "reason", None) if fields is not None else None
    purpose = getattr(fields, "purpose", None) if fields is not None else None
    amount = getattr(fields, "amount", None) if fields is not None else None
    currency = getattr(fields, "currency", None) if fields is not None else None
    description = reason or purpose or getattr(extraction, "summary", None) or getattr(extraction, "english_translation", None)
    return {
        "form_type": getattr(extraction, "form_type", None),
        "amount": amount,
        "currency": currency,
        "description": description,
    }


def add_field_metric_columns(row: dict[str, Any], comparison: FieldComparison, joint_name: str) -> dict[str, Any]:
    row.update(
        {
            "form_type_correct": int(comparison.form_type_correct),
            "amount_correct": int(comparison.amount_correct),
            "currency_correct": int(comparison.currency_correct),
            "description_correct": int(comparison.description_correct),
            "description_match_method": comparison.description_match_method,
            "description_overlap": comparison.description_overlap,
            "field_accuracy": comparison.field_accuracy,
            joint_name: int(comparison.joint_accuracy),
        }
    )
    return row


def summarize_field_rows(rows: list[dict[str, Any]], group_key: str | None, joint_key: str) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    if group_key is None:
        groups["llm_reference_transcript"] = rows
    else:
        for row in rows:
            groups.setdefault(str(row[group_key]), []).append(row)

    summaries = []
    for group, group_rows in groups.items():
        failures = [row for row in group_rows if row.get("error")]
        valid_rows = group_rows
        count = len(valid_rows)
        summaries.append(
            {
                (group_key or "pipeline"): group,
                "num_samples": count,
                "form_type_accuracy": average(float(r.get("form_type_correct", 0)) for r in valid_rows),
                "amount_accuracy": average(float(r.get("amount_correct", 0)) for r in valid_rows),
                "currency_accuracy": average(float(r.get("currency_correct", 0)) for r in valid_rows),
                "description_accuracy": average(float(r.get("description_correct", 0)) for r in valid_rows),
                "field_accuracy": average(float(r.get("field_accuracy", 0)) for r in valid_rows),
                joint_key: average(float(r.get(joint_key, 0)) for r in valid_rows),
                "failure_rate": len(failures) / count if count else 0.0,
                "average_latency_seconds": average(
                    float(r.get("latency_seconds") or 0.0) for r in valid_rows if r.get("latency_seconds") is not None
                ),
            }
        )
    return summaries


def timed_call(fn, *args, **kwargs):
    start = time.perf_counter()
    result = fn(*args, **kwargs)
    return result, time.perf_counter() - start


def maybe_make_bar_chart(
    rows: list[dict[str, Any]],
    label_key: str,
    value_key: str,
    title: str,
    ylabel: str,
    output_path: str | Path,
    disabled: bool = False,
) -> None:
    """Generate thesis-ready bar charts when matplotlib is installed."""

    if disabled or not rows:
        return
    try:
        import matplotlib.pyplot as plt
    except Exception as exc:
        print(f"Skipping chart {output_path}: matplotlib is not installed ({exc})")
        return

    labels = [str(row[label_key]) for row in rows]
    values = [float(row.get(value_key) or 0.0) for row in rows]
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(9, 5))
    ax.bar(labels, values, color="#2f6f9f")
    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.set_ylim(0, max(1.0, max(values) * 1.15 if values else 1.0))
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    for idx, value in enumerate(values):
        ax.text(idx, value, f"{value:.3f}", ha="center", va="bottom", fontsize=9)
    fig.tight_layout()
    fig.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(fig)


def resolve_audio_path(row: dict[str, Any], csv_path: str | Path) -> Path:
    """Resolve relative audio paths against the CSV directory without altering audio_id."""

    audio_path = Path(row["audio_path"])
    if audio_path.is_absolute():
        return audio_path
    return (Path(csv_path).resolve().parent / audio_path).resolve()
