# Evaluation Results

Generated from existing evaluator outputs in `results/` on 2026-06-08 08:55:24.

Input used for the completed run: `data/test_labels_generated.csv` with audio from `data/test_audio/`.
The original `data/test.csv` only contains `id,text,language`; the evaluator requires the labeled schema for accuracy scoring.

## Mathematical Formulas

```text
WER_i = edit_distance_words(reference_i, prediction_i) / number_of_reference_words_i
CER_i = edit_distance_characters(reference_i, prediction_i) / number_of_reference_characters_i
Average WER_m = (1 / N) * sum_i WER_i for ASR model m
Average CER_m = (1 / N) * sum_i CER_i for ASR model m
field_accuracy_i = (form_type_correct_i + amount_correct_i + currency_correct_i + description_correct_i) / 4
joint_accuracy_i = 1 if all four evaluated fields are correct, otherwise 0
joint_system_accuracy_p = (1 / N) * sum_i joint_accuracy_i for pipeline p
failure_rate_p = failed_samples_p / total_samples_p
average_latency_seconds_p = (1 / N) * sum_i latency_seconds_i for pipeline p
```

## ASR Model Comparison

| model_name | num_samples | average_wer | average_cer | failure_rate | average_latency_seconds |
| --- | --- | --- | --- | --- | --- |
| wav2vec2 | 20 | 1.1500 | 0.4991 | 0.0000 | 1.2605 |
| whisper-small | 20 | 0.6168 | 0.4321 | 0.0000 | 4.6146 |
| whisper-medium | 20 | 0.5466 | 0.3345 | 0.0000 | 13.8909 |

- Best average WER: `whisper-medium` with WER `0.5466`.
- Best average CER: `whisper-medium` with CER `0.3345`.

## LLM-Only Extraction Accuracy

| pipeline | num_samples | form_type_accuracy | amount_accuracy | currency_accuracy | description_accuracy | field_accuracy | joint_accuracy | failure_rate | average_latency_seconds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| llm_reference_transcript | 20 | 0.9000 | 0.0000 | 1.0000 | 0.0000 | 0.4750 | 0.0000 | 0.0000 | 2.3429 |

## End-to-End System Accuracy

| pipeline | num_samples | form_type_accuracy | amount_accuracy | currency_accuracy | description_accuracy | field_accuracy | joint_system_accuracy | failure_rate | average_latency_seconds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wav2vec2 | 20 | 0.6000 | 0.1500 | 0.8500 | 0.0000 | 0.4000 | 0.0000 | 0.0500 | 2.9141 |
| whisper-small | 20 | 0.7000 | 0.3500 | 0.6500 | 0.0000 | 0.4250 | 0.0000 | 0.0000 | 6.2764 |
| whisper-medium | 20 | 0.8500 | 0.1000 | 0.9000 | 0.0000 | 0.4625 | 0.0000 | 0.0000 | 14.2689 |

- Highest field accuracy pipeline: `whisper-medium` with field accuracy `0.4625`.
- Highest joint system accuracy: all pipelines tie at `0.0000` in this run.

## Thesis Chart Files

- `results/charts/cer_by_model.png`
- `results/charts/field_accuracy_by_pipeline.png`
- `results/charts/joint_system_accuracy_by_pipeline.png`
- `results/charts/llm_joint_accuracy.png`
- `results/charts/wer_by_model.png`

## Output CSV Files

- `results/asr_model_comparison.csv`
- `results/asr_model_summary.csv`
- `results/llm_extraction_details.csv`
- `results/llm_extraction_summary.csv`
- `results/end_to_end_details.csv`
- `results/end_to_end_summary.csv`

## Notes for Interpretation

- `description_accuracy` is 0.0000 in this run because the expected description text is stricter than the LLM/ASR-produced final description. The detail CSV marks these rows with `manual_review` and keyword-overlap scores.
- `joint_system_accuracy` is 0.0000 for all pipelines because joint accuracy requires all evaluated fields to be correct in the same sample.
- `whisper-medium` has the best ASR WER/CER and the best end-to-end field accuracy in this run, but it also has the highest average latency.

