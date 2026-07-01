from __future__ import annotations

import argparse
import sys
from pathlib import Path

from evaluation_utils import (
    ASR_MODEL_NAMES,
    add_common_args,
    average,
    cer,
    maybe_make_bar_chart,
    print_table,
    read_eval_rows,
    resolve_audio_path,
    timed_call,
    wer,
    write_csv,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.services.asr.model_registry import ModelRegistry
from app.utils.audio_utils import decode_audio_bytes, to_16k_mono


def run_asr_evaluation(csv_path: str, results_dir: str = "results", no_charts: bool = False) -> tuple[list[dict], list[dict]]:
    """Evaluate each configured ASR model independently for thesis ASR comparison."""

    rows = read_eval_rows(csv_path, required_columns=("audio_id", "audio_path", "reference_transcript"))
    registry = ModelRegistry.from_env()
    details: list[dict] = []

    for sample in rows:
        audio_id = sample["audio_id"]
        audio_path = resolve_audio_path(sample, csv_path)
        reference = sample["reference_transcript"]

        try:
            audio_bytes = audio_path.read_bytes()
            waveform, sr = decode_audio_bytes(audio_bytes, filename=audio_path.name)
            waveform, sr = to_16k_mono(waveform, sr)
        except Exception as exc:
            for model_name in ASR_MODEL_NAMES:
                details.append(
                    {
                        "audio_id": audio_id,
                        "audio_path": str(audio_path),
                        "model_name": model_name,
                        "reference_transcript": reference,
                        "predicted_transcript": "",
                        "sample_wer": 1.0,
                        "sample_cer": 1.0,
                        "latency_seconds": 0.0,
                        "error": f"audio_decode_failed: {exc}",
                    }
                )
            continue

        for model_name in ASR_MODEL_NAMES:
            model = registry.get(model_name)
            if model is None:
                info = next((m for m in registry.describe()["models"] if m["model_name"] == model_name), {})
                details.append(
                    {
                        "audio_id": audio_id,
                        "audio_path": str(audio_path),
                        "model_name": model_name,
                        "reference_transcript": reference,
                        "predicted_transcript": "",
                        "sample_wer": 1.0,
                        "sample_cer": 1.0,
                        "latency_seconds": 0.0,
                        "error": info.get("status", "model unavailable"),
                    }
                )
                continue

            try:
                result, latency = timed_call(model.transcribe, waveform, sr)
                predicted = result.transcript or ""
                details.append(
                    {
                        "audio_id": audio_id,
                        "audio_path": str(audio_path),
                        "model_name": model_name,
                        "reference_transcript": reference,
                        "predicted_transcript": predicted,
                        "sample_wer": wer(reference, predicted),
                        "sample_cer": cer(reference, predicted),
                        "latency_seconds": latency,
                        "confidence_score": result.confidence_score,
                        "confidence_method": result.confidence_method,
                        "error": "",
                    }
                )
            except Exception as exc:
                details.append(
                    {
                        "audio_id": audio_id,
                        "audio_path": str(audio_path),
                        "model_name": model_name,
                        "reference_transcript": reference,
                        "predicted_transcript": "",
                        "sample_wer": 1.0,
                        "sample_cer": 1.0,
                        "latency_seconds": 0.0,
                        "error": str(exc),
                    }
                )

    summary: list[dict] = []
    for model_name in ASR_MODEL_NAMES:
        model_rows = [row for row in details if row["model_name"] == model_name]
        summary.append(
            {
                "model_name": model_name,
                "num_samples": len(model_rows),
                "average_wer": average(float(row["sample_wer"]) for row in model_rows),
                "average_cer": average(float(row["sample_cer"]) for row in model_rows),
                "failure_rate": average(1.0 if row.get("error") else 0.0 for row in model_rows),
                "average_latency_seconds": average(float(row.get("latency_seconds") or 0.0) for row in model_rows),
            }
        )

    output_dir = Path(results_dir)
    write_csv(
        output_dir / "asr_model_comparison.csv",
        details,
        [
            "audio_id",
            "audio_path",
            "model_name",
            "reference_transcript",
            "predicted_transcript",
            "sample_wer",
            "sample_cer",
            "latency_seconds",
            "confidence_score",
            "confidence_method",
            "error",
        ],
    )
    write_csv(output_dir / "asr_model_summary.csv", summary)

    maybe_make_bar_chart(
        summary,
        "model_name",
        "average_wer",
        "WER by model",
        "Average WER",
        output_dir / "charts" / "wer_by_model.png",
        disabled=no_charts,
    )
    maybe_make_bar_chart(
        summary,
        "model_name",
        "average_cer",
        "CER by model",
        "Average CER",
        output_dir / "charts" / "cer_by_model.png",
        disabled=no_charts,
    )

    print_table("ASR model comparison table", summary, ["model_name", "average_wer", "average_cer", "failure_rate"])
    return details, summary


def main() -> None:
    parser = add_common_args(argparse.ArgumentParser(description="Evaluate ASR model WER/CER."))
    args = parser.parse_args()
    try:
        run_asr_evaluation(args.csv, args.results_dir, args.no_charts)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
