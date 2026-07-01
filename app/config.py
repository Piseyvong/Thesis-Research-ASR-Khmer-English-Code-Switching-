from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    _project_root = Path(__file__).resolve().parents[1]
    model_config = SettingsConfigDict(
        env_file=str(_project_root / ".env"),
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    app_env: str = "local"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    database_url: str = "sqlite:///./data/app.db"

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment_name: str = "gpt-4o"
    azure_openai_api_version: str | None = None

    wav2vec_model_path: str | None = None
    whisper_small_model_path: str | None = None
    whisper_medium_model_path: str | None = None

    google_cloud_project_id: str | None = None
    google_speech_location: str = "us"
    google_speech_model: str = "chirp_3"
    google_speech_languages: str = "km-KH,en-US"


settings = Settings()
