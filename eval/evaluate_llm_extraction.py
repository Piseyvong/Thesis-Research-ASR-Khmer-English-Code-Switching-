from __future__ import annotations

import argparse
import sys
from pathlib import Path

from evaluation_utils import (
    add_common_args,
    add_field_metric_columns,
    compare_fields,
    extraction_to_eval_fields,
    maybe_make_bar_chart,
    print_table,
    read_eval_rows,
    summarize_field_rows,
    timed_call,
    write_csv,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.llm_service import LLMService


def run_llm_evaluation(
    csv_path: str,
    results_dir: str = "results",
    description_overlap_threshold: float = 0.60,
    no_charts: bool = False,
) -> tuple[list[dict], list[dict]]:
    """Evaluate whether the existing LLM extractor maps reference transcripts to correct form fields."""

    rows = read_eval_rows(csv_path)
    llm = LLMService.from_env()
    details: list[dict] = []

    for sample in rows:
        base = {
            "audio_id": sample["audio_id"],
            "reference_transcript": sample["reference_transcript"],
            "expected_form_type": sample["expected_form_type"],
            "expected_amount": sample["expected_amount"],
            "expected_currency": sample["expected_currency"],
            "expected_description": sample["expected_description"],
        }
        try:
            extraction, latency = timed_call(llm.extract_from_transcript, sample["reference_transcript"])
            predicted = extraction_to_eval_fields(extraction)
            comparison = compare_fields(sample, predicted, description_overlap_threshold)
            row = {
                **base,
                "predicted_form_type": predicted["form_type"],
                "predicted_amount": predicted["amount"],
                "predicted_currency": predicted["currency"],
                "predicted_description": predicted["description"],
                "latency_seconds": latency,
                "error": "",
            }
            details.append(add_field_metric_columns(row, comparison, "joint_accuracy"))
        except Exception as exc:
            row = {
                **base,
                "predicted_form_type": "",
                "predicted_amount": "",
                "predicted_currency": "",
                "predicted_description": "",
                "form_type_correct": 0,
                "amount_correct": 0,
                "currency_correct": 0,
                "description_correct": 0,
                "description_match_method": "error",
                "description_overlap": None,
                "field_accuracy": 0.0,
                "joint_accuracy": 0,
                "latency_seconds": 0.0,
                "error": str(exc),
            }
            details.append(row)

    summary = summarize_field_rows(details, group_key=None, joint_key="joint_accuracy")

    output_dir = Path(results_dir)
    write_csv(
        output_dir / "llm_extraction_details.csv",
        details,
        [
            "audio_id",
            "reference_transcript",
            "expected_form_type",
            "predicted_form_type",
            "form_type_correct",
            "expected_amount",
            "predicted_amount",
            "amount_correct",
            "expected_currency",
            "predicted_currency",
            "currency_correct",
            "expected_description",
            "predicted_description",
            "description_correct",
            "description_match_method",
            "description_overlap",
            "field_accuracy",
            "joint_accuracy",
            "latency_seconds",
            "error",
        ],
    )
    write_csv(output_dir / "llm_extraction_summary.csv", summary)

    maybe_make_bar_chart(
        summary,
        "pipeline",
        "joint_accuracy",
        "LLM-only joint accuracy",
        "Joint accuracy",
        output_dir / "charts" / "llm_joint_accuracy.png",
        disabled=no_charts,
    )
    print_table(
        "LLM-only extraction table",
        summary,
        [
            "pipeline",
            "form_type_accuracy",
            "amount_accuracy",
            "currency_accuracy",
            "description_accuracy",
            "field_accuracy",
            "joint_accuracy",
            "failure_rate",
        ],
    )
    return details, summary


def main() -> None:
    parser = add_common_args(argparse.ArgumentParser(description="Evaluate LLM extraction on reference transcripts."))
    args = parser.parse_args()
    try:
        run_llm_evaluation(
            args.csv,
            args.results_dir,
            args.description_overlap_threshold,
            args.no_charts,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
