from __future__ import annotations

import argparse
import sys
from pathlib import Path

from evaluation_utils import (
    ASR_MODEL_NAMES,
    add_common_args,
    add_field_metric_columns,
    compare_fields,
    extraction_to_eval_fields,
    maybe_make_bar_chart,
    print_table,
    read_eval_rows,
    resolve_audio_path,
    summarize_field_rows,
    timed_call,
    write_csv,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.asr.model_registry import ModelRegistry
from app.services.llm_service import LLMService
from app.utils.audio_utils import decode_audio_bytes, to_16k_mono


def run_end_to_end_evaluation(
    csv_path: str,
    results_dir: str = "results",
    description_overlap_threshold: float = 0.60,
    no_charts: bool = False,
) -> tuple[list[dict], list[dict]]:
    """Evaluate the whole thesis pipeline: audio -> ASR transcript -> LLM fields -> final form correctness."""

    rows = read_eval_rows(csv_path)
    registry = ModelRegistry.from_env()
    llm = LLMService.from_env()
    details: list[dict] = []

    for sample in rows:
        audio_path = resolve_audio_path(sample, csv_path)
        base = {
            "audio_id": sample["audio_id"],
            "audio_path": str(audio_path),
            "reference_transcript": sample["reference_transcript"],
            "expected_form_type": sample["expected_form_type"],
            "expected_amount": sample["expected_amount"],
            "expected_currency": sample["expected_currency"],
            "expected_description": sample["expected_description"],
        }

        try:
            audio_bytes = audio_path.read_bytes()
            waveform, sr = decode_audio_bytes(audio_bytes, filename=audio_path.name)
            waveform, sr = to_16k_mono(waveform, sr)
            audio_error = ""
        except Exception as exc:
            waveform, sr = None, None
            audio_error = f"audio_decode_failed: {exc}"

        for model_name in ASR_MODEL_NAMES:
            if audio_error:
                details.append(_failure_row(base, model_name, audio_error))
                continue

            model = registry.get(model_name)
            if model is None:
                info = next((m for m in registry.describe()["models"] if m["model_name"] == model_name), {})
                details.append(_failure_row(base, model_name, info.get("status", "model unavailable")))
                continue

            try:
                asr_result, asr_latency = timed_call(model.transcribe, waveform, sr)
                transcript = asr_result.transcript or ""
                extraction, llm_latency = timed_call(llm.extract_from_transcript, transcript)
                predicted = extraction_to_eval_fields(extraction)
                comparison = compare_fields(sample, predicted, description_overlap_threshold)
                row = {
                    **base,
                    "pipeline": model_name,
                    "asr_transcript": transcript,
                    "predicted_form_type": predicted["form_type"],
                    "predicted_amount": predicted["amount"],
                    "predicted_currency": predicted["currency"],
                    "predicted_description": predicted["description"],
                    "asr_latency_seconds": asr_latency,
                    "llm_latency_seconds": llm_latency,
                    "latency_seconds": asr_latency + llm_latency,
                    "error": "",
                }
                details.append(add_field_metric_columns(row, comparison, "joint_system_accuracy"))
            except Exception as exc:
                details.append(_failure_row(base, model_name, str(exc)))

    summary = summarize_field_rows(details, group_key="pipeline", joint_key="joint_system_accuracy")

    output_dir = Path(results_dir)
    write_csv(
        output_dir / "end_to_end_details.csv",
        details,
        [
            "audio_id",
            "audio_path",
            "pipeline",
            "reference_transcript",
            "asr_transcript",
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
            "joint_system_accuracy",
            "asr_latency_seconds",
            "llm_latency_seconds",
            "latency_seconds",
            "error",
        ],
    )
    write_csv(output_dir / "end_to_end_summary.csv", summary)

    maybe_make_bar_chart(
        summary,
        "pipeline",
        "joint_system_accuracy",
        "Joint system accuracy by pipeline",
        "Joint system accuracy",
        output_dir / "charts" / "joint_system_accuracy_by_pipeline.png",
        disabled=no_charts,
    )
    maybe_make_bar_chart(
        summary,
        "pipeline",
        "field_accuracy",
        "Field accuracy by pipeline",
        "Field accuracy",
        output_dir / "charts" / "field_accuracy_by_pipeline.png",
        disabled=no_charts,
    )

    print_table(
        "End-to-end system accuracy table",
        summary,
        [
            "pipeline",
            "form_type_accuracy",
            "amount_accuracy",
            "currency_accuracy",
            "description_accuracy",
            "field_accuracy",
            "joint_system_accuracy",
            "failure_rate",
            "average_latency_seconds",
        ],
    )
    return details, summary


def _failure_row(base: dict, model_name: str, error: str) -> dict:
    row = {
        **base,
        "pipeline": model_name,
        "asr_transcript": "",
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
        "joint_system_accuracy": 0,
        "asr_latency_seconds": 0.0,
        "llm_latency_seconds": 0.0,
        "latency_seconds": 0.0,
        "error": error,
    }
    return row


def main() -> None:
    parser = add_common_args(argparse.ArgumentParser(description="Evaluate audio-to-final-form system accuracy."))
    args = parser.parse_args()
    try:
        run_end_to_end_evaluation(
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
