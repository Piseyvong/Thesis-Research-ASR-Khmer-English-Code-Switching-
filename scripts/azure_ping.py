from __future__ import annotations

import sys
from pathlib import Path

from openai import AzureOpenAI

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.config import settings


def main() -> None:
    endpoint = (settings.azure_openai_endpoint or "").strip()
    api_key = (settings.azure_openai_api_key or "").strip()
    api_version = (settings.azure_openai_api_version or "").strip()
    deployment = settings.azure_openai_deployment_name

    print("endpoint:", endpoint)
    print("api_version:", repr(api_version))
    print("deployment:", repr(deployment))
    print("api_key_set:", bool(api_key))

    client = AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
    )

    try:
        resp = client.chat.completions.create(
            model=deployment,
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "user", "content": 'Return strict JSON: {"ok": true}'},
            ],
        )
        print("success:", resp.choices[0].message.content)
    except Exception as e:  # noqa: BLE001
        print("error_type:", type(e).__name__)
        print("error:", str(e))


if __name__ == "__main__":
    main()
