# Khmer–English Speech Request System (Prototype)

Production-style demo app for Khmer/English code-switching requests.

## Features
- Employee chatbot-style page: upload audio, run each completed local ASR model, translate + extract request fields, edit fields, submit to manager.
- Manager dashboard: review submitted requests, approve/reject/ask clarification, view confidence/model used.
- Architecture-specific local ASR: Wav2Vec2 is loaded as `Wav2Vec2ForCTC`, and Whisper exports are loaded as `WhisperForConditionalGeneration`.
- Incomplete or missing checkpoints are returned as unavailable; they are never downloaded or treated as a different model.
- Confidence scoring is a **proxy** (heuristics) and designed for later calibration.
- Mock email service: generates email content, stores it, and shows it in UI.

## Required environment variables
Create `.env` (copy from `.env.example`) and fill:
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME` (defaults to `gpt-4o`)
- `AZURE_OPENAI_API_VERSION`
- `WAV2VEC_MODEL_PATH`
- `WHISPER_SMALL_MODEL_PATH`
- `WHISPER_MEDIUM_MODEL_PATH`

## Backend setup (FastAPI)
```bash
cd "d:\I5 internship\Prototype"
D:\Users\Asus\anaconda3\python.exe -m venv .venv-runtime
.\.venv-runtime\Scripts\activate
pip install -r requirements.txt

# copy env
copy .env.example .env

python -m uvicorn app.main:app --reload
```
Backend runs at `http://127.0.0.1:8000`.

`torch==2.5.1` is used only as the local inference runtime. Audio decoding uses `soundfile`/`librosa`; `torchaudio` is not required by this application.

### Test which ASR models are loaded
- `GET /api/models`

### Test transcription with completed models
1. Set `WAV2VEC_MODEL_PATH` to the completed Wav2Vec2 CTC export folder.
2. Set `WHISPER_SMALL_MODEL_PATH` to the completed Whisper Small seq2seq export folder.
3. Keep `WHISPER_MEDIUM_MODEL_PATH` pointed at `app/models/M` while training is unfinished; it will be reported as unavailable.
4. Upload a WAV, FLAC, or OGG file to:
   - `POST /api/asr/transcribe` (multipart `file`)

The response includes the result/status for all three slots. Only completed local exports are run.
When request creation compares more than one usable transcript, LLM candidate selection must succeed. A selection failure is reported as an error; the application does not silently select a different transcript through a local ranking fallback.

### Local model formats
Wav2Vec2 CTC export (`app/models/wav2vec2_ctc`) must contain:
- `config.json` with `Wav2Vec2ForCTC`
- `preprocessor_config.json`
- `tokenizer_config.json`
- `vocab.json`
- `model.safetensors` or `pytorch_model.bin`

Whisper seq2seq export (`app/models/small`, and later Medium) must contain:
- `config.json`
- `generation_config.json` (optional but recommended)
- `preprocessor_config.json` or `processor_config.json`
- tokenizer assets such as `tokenizer.json` or `vocab.json` + `merges.txt`
- model weights such as `model.safetensors` or `pytorch_model.bin`

The current `app/models/M` contains a LoRA adapter checkpoint only, so it is listed as incomplete and is not executed. When Medium training is done, provide a completed local inference export before enabling its transcription path.

## Confidence selection (proxy)
The ASR confidence scores are **not calibrated** across model families.
- Wav2Vec2: average token softmax confidence (non-blank), with penalties for blank-heavy decoding, repetition, too-short output, and garbage-like text.
- Whisper: uses transcript-quality heuristics for its current seq2seq generation path.
- Optional transcript-quality heuristic boosts request-domain keywords (amount, location, reason, date, travel, claim, training, material, advance, project, expense) and penalizes loops/repetition.

Because the metrics differ, the final score is a **confidence proxy** intended for ranking, not as a scientific probability.

## Frontend setup (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://127.0.0.1:5173` and calls the backend at `http://127.0.0.1:8000`.

Optional: set `VITE_API_BASE_URL` to point to a different backend.

## Audio recording note
Voice input converts the browser recording to PCM WAV before it is uploaded. Manual audio uploads are accepted as WAV, FLAC, or OGG only. The backend decodes through `soundfile`/libsndfile and returns an explicit error for any unsupported format; there is no alternate decoder fallback.

## Sample data
On first run, the backend seeds a sample employee + manager and a sample request draft.

Note: this prototype uses `SQLModel.metadata.create_all()` (no migrations). If you ran an older version and the DB schema changed, delete `data/app.db` and restart.

## Thesis Evaluation Pipeline
The offline evaluation scripts live in `eval/` and do not change the website runtime behavior. They reuse the local ASR model registry and the existing Azure OpenAI extraction service.

Prepare a labeled CSV with these columns:

```csv
audio_id,audio_path,reference_transcript,expected_form_type,expected_amount,expected_currency,expected_description
```

Run the evaluators from the project root:

```bash
python eval/evaluate_asr.py --csv data/test_labels.csv
python eval/evaluate_llm_extraction.py --csv data/test_labels.csv
python eval/evaluate_end_to_end.py --csv data/test_labels.csv
```

Outputs are written to `results/`:

- `results/asr_model_comparison.csv`
- `results/asr_model_summary.csv`
- `results/llm_extraction_details.csv`
- `results/llm_extraction_summary.csv`
- `results/end_to_end_details.csv`
- `results/end_to_end_summary.csv`
- `results/charts/`

Evaluation formulas used:

```text
WER_i = edit_distance_words(reference_i, prediction_i) / number_of_reference_words_i
CER_i = edit_distance_characters(reference_i, prediction_i) / number_of_reference_characters_i

Average WER_m = (1 / N) * sum_i WER_i for ASR model m
Average CER_m = (1 / N) * sum_i CER_i for ASR model m

field_accuracy_i =
  (form_type_correct_i + amount_correct_i + currency_correct_i + description_correct_i) / 4

joint_accuracy_i =
  1 if all required fields are correct for sample i, otherwise 0

joint_system_accuracy_p =
  (1 / N) * sum_i joint_accuracy_i for end-to-end pipeline p

failure_rate_p =
  number_of_failed_samples_p / total_number_of_samples_p

average_latency_seconds_p =
  (1 / N) * sum_i latency_seconds_i for pipeline p
```

Matching rules:

- `form_type`: exact match after label normalization.
- `amount`: exact numeric match after digit, English number-word, and Khmer number-word normalization where possible.
- `currency`: exact match after normalization such as `USD`, `dollar`, `dollars`, and `ដុល្លារ`.
- `description`: exact normalized text match first; otherwise keyword overlap is used. Rows that do not meet the overlap threshold are marked for manual review.

---

If you want, I can add docker-compose later, but this prototype is optimized for local thesis demos.
