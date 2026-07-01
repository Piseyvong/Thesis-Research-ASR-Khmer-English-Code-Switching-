from __future__ import annotations

import json
from dataclasses import dataclass

from openai import AzureOpenAI

from app.config import settings
from app.schemas.asr_schema import LLMCandidateSelectionResult
from app.schemas.request_schema import LLMExtractionResult
from app.services.prompts import (
    build_candidate_rerank_system_prompt,
    build_system_prompt,
    build_user_prompt_for_candidate_rerank,
    build_user_prompt_for_initial,
    build_user_prompt_for_update,
)


class LLMNotConfiguredError(RuntimeError):
    pass


@dataclass
class LLMService:
    client: AzureOpenAI
    deployment: str
    api_version: str

    @classmethod
    def from_env(cls) -> "LLMService":
        endpoint = (settings.azure_openai_endpoint or "").strip()
        api_key = (settings.azure_openai_api_key or "").strip()
        api_version = (settings.azure_openai_api_version or "").strip()

        if not endpoint or not api_key or not api_version:
            raise LLMNotConfiguredError(
                "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION."
            )
        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
        return cls(client=client, deployment=settings.azure_openai_deployment_name, api_version=api_version)

    def extract_from_transcript(self, transcript: str) -> LLMExtractionResult:
        system = build_system_prompt()
        user = build_user_prompt_for_initial(transcript)

        resp = self.client.chat.completions.create(
            model=self.deployment,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
        )

        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        return LLMExtractionResult.model_validate(data)

    def select_best_candidate(self, candidates: list[dict]) -> LLMCandidateSelectionResult:
        system = build_candidate_rerank_system_prompt()
        user = build_user_prompt_for_candidate_rerank(candidates)

        resp = self.client.chat.completions.create(
            model=self.deployment,
            temperature=0.1,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
        )

        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        return LLMCandidateSelectionResult.model_validate(data)

    def update_with_user_message(self, current_extraction_json: dict, user_message: str) -> LLMExtractionResult:
        system = build_system_prompt()
        user = build_user_prompt_for_update(current_extraction_json, user_message)

        resp = self.client.chat.completions.create(
            model=self.deployment,
            temperature=0.2,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
        )

        content = resp.choices[0].message.content or "{}"
        data = json.loads(content)
        return LLMExtractionResult.model_validate(data)
