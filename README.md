# Voice-to-Text Automatic Internal Request Management System

Welcome to this thesis project repository. This project is shared for people who want to understand, review, test, or build on the work behind a Khmer-English code-switching speech system for internal request management.

## Thesis Review Notice

This thesis report is still under review by the committee and jury of the Institute of Technology of Cambodia before final submission to the Ministry of Education, Youth and Sport.

Any thesis report or related document in this repository that is not marked as the final submitted version may still be changed, corrected, or updated after review. Please treat the current documentation as a review-stage academic artifact.

## Project Summary

**Thesis title:** Voice-to-Text Automatic Internal Request Management System

This project explores how speech can be used to create internal business requests. A user can speak in Khmer-English code-switching language, the Automatic Speech Recognition (ASR) model converts the speech into text, and the application can then use a Large Language Model (LLM) API to convert the transcript into structured request information.

The repository contains two main parts:

- **ASR model testing:** code for testing trained ASR model exports on Khmer-English code-switching speech.
- **End-to-end request system:** a demo web application where an end user can speak or upload a request, review the transcript and extracted fields, and submit the structured request for manager review.

The project is intended for academic, research, and demonstration purposes.

## What The System Does

At a high level, the system follows this workflow:

1. A user records or uploads speech.
2. The backend decodes the audio and runs available ASR models.
3. The selected transcript is shown to the user.
4. If an LLM API key is configured, the transcript is sent to the LLM service.
5. The LLM extracts structured request details such as request type, amount, currency, description, and missing fields.
6. The user can review or edit the extracted request before submitting it.
7. A manager can review submitted requests in the dashboard.

The ASR part can be tested with local model weights. The full end-to-end extraction workflow also requires a user-provided LLM API key.

## Important API Key Notice

This repository does **not** provide private API keys or credentials.

API keys are like private passwords. If they are shared publicly, other people may be able to use the account, create security risks, or generate unexpected costs. For that reason, real API keys are stored only in a local `.env` file and are intentionally excluded from GitHub.

If you want to test the full request extraction workflow, you must create your own LLM API key and place it in your own `.env` file. Without a valid LLM API key, the system can still run ASR transcription, but it will not complete the structured request extraction step.

## Repository Structure

```text
.
|-- app/                  # FastAPI backend, ASR services, LLM service, request APIs
|-- data/                 # Sample CSV files and test audio used for evaluation/demo
|-- eval/                 # Offline ASR, LLM, and end-to-end evaluation scripts
|-- frontend/             # React + Vite user interface
|-- results/              # Existing evaluation output files and charts
|-- scripts/              # Utility scripts, including Azure API connectivity check
|-- requirements.txt      # Python backend dependencies
|-- .env.example          # Environment variable template with placeholders only
`-- README.md             # Project documentation
```

Local model files are expected under `app/models/`, but large model weights are ignored by Git because they can be very large. If you have been provided the trained ASR weights separately, place them in the expected folders before testing.

## Thesis Documentation

The thesis report and related documentation should be placed in the folder named:

```text
thesis documentation/
```

If the report in that folder is not marked as the final submitted version, it should be treated as a draft or review-stage document that may be altered after committee and jury review.

## Model And System Components

### ASR Model Testing

The ASR testing part allows users to evaluate trained speech recognition models on Khmer-English code-switching speech. The backend model registry supports local ASR exports such as:

- Wav2Vec2 CTC model exports
- Whisper Small model exports
- Whisper Medium model exports, if a completed local export is available

The `/api/asr/transcribe` endpoint runs available local ASR models and returns transcript candidates with confidence and selection information.

### End-To-End Internal Request System

The web application demonstrates a practical end-user workflow:

- employee login using mock users
- audio upload or voice recording
- speech transcription
- request field extraction with an LLM API
- editable structured request details
- manager dashboard for review
- mock email generation/storage

The ASR model produces text. The LLM API is responsible for turning that text into structured request information. If the LLM API is not configured, the system cannot complete the full extraction workflow.

## How To Use This Repository

### 1. Clone The Repository

```bash
git clone https://github.com/Piseyvong/Thesis-ASR-Khmer-English-Code-Switching-.git
cd Thesis-ASR-Khmer-English-Code-Switching-
```

### 2. Install Backend Dependencies

Create and activate a Python virtual environment, then install the backend requirements.

```bash
python -m venv .venv-runtime
.\.venv-runtime\Scripts\activate
pip install -r requirements.txt
```

On macOS or Linux, activation usually looks like:

```bash
source .venv-runtime/bin/activate
```

### 3. Prepare Environment Variables

Copy the example environment file and fill in your own local values.

```bash
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

Do not commit the `.env` file.

### 4. Place ASR Model Weights

Place the trained ASR model exports in the configured local model folders. The default `.env.example` paths are:

```env
WAV2VEC_MODEL_PATH=app/models/wav2vec2_ctc
WHISPER_SMALL_MODEL_PATH=app/models/small
WHISPER_MEDIUM_MODEL_PATH=app/models/M
```

For Whisper exports, the folder should include files such as `config.json`, tokenizer files, preprocessor files, and model weights such as `model.safetensors` or `pytorch_model.bin`.

### 5. Run The Backend

```bash
python -m uvicorn app.main:app --reload
```

The backend runs at:

```text
http://127.0.0.1:8000
```

Useful backend checks:

```text
GET /api/models
POST /api/asr/transcribe
```

### 6. Run The Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at:

```text
http://127.0.0.1:5173
```

### 7. Test ASR Only

To test ASR transcription only, use the frontend audio upload/recording flow or send an audio file to:

```text
POST /api/asr/transcribe
```

This part requires the ASR model weights to be available locally.

### 8. Test The Full End-To-End Workflow

To test the complete workflow, including structured request extraction, add your own LLM API credentials to `.env`.

If the LLM API key is missing, invalid, expired, or not authorized for the configured deployment, the system may still transcribe speech, but it will not extract the final structured request fields.

## Example `.env` File

Use placeholders only. Do not publish real credentials.

```env
APP_ENV=local
APP_HOST=127.0.0.1
APP_PORT=8000
DATABASE_URL=sqlite:///./data/app.db

# LLM / Azure OpenAI configuration
AZURE_OPENAI_ENDPOINT=your_own_endpoint_here
AZURE_OPENAI_API_KEY=your_own_api_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name_here
AZURE_OPENAI_API_VERSION=your_api_version_here

# Local ASR model exports
WAV2VEC_MODEL_PATH=app/models/wav2vec2_ctc
WHISPER_SMALL_MODEL_PATH=app/models/small
WHISPER_MEDIUM_MODEL_PATH=app/models/M
```

## Offline Evaluation Scripts

The `eval/` folder contains scripts for thesis evaluation experiments:

```bash
python eval/evaluate_asr.py --csv data/test_labels_generated.csv
python eval/evaluate_llm_extraction.py --csv data/test_labels_generated.csv
python eval/evaluate_end_to_end.py --csv data/test_labels_generated.csv
```

Existing result files and charts are stored in `results/`.

## Security Notes

- Do not commit `.env`.
- Do not upload private API keys.
- Do not publish cloud credentials, service account files, or passwords.
- Keep large local model weights out of normal Git commits unless a proper large-file storage method is used.
- Use `.gitignore` to protect sensitive files, local databases, logs, virtual environments, and generated build files.

## Intended Audience

This README is written for both technical and non-technical readers, including academic reviewers, visa officers, supervisors, and developers. The purpose is to show what the project does, what is required to run it, and why private credentials are not included.

## Academic Purpose

This repository is provided as part of a thesis project and is intended for academic review, research, demonstration, and reproducibility of the system workflow where possible.
