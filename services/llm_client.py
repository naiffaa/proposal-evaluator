import httpx

from openai import OpenAI
from oci_genai_auth import OciUserPrincipalAuth

from config import (
    OCI_PROFILE,
    OCI_BASE_URL,
    OCI_PROJECT_ID,
    MODEL_NAME,
)


class LLMClient:
    def __init__(self):
        self.http_client = httpx.Client(
            auth=OciUserPrincipalAuth(
                profile_name=OCI_PROFILE
            )
        )

        self.client = OpenAI(
            base_url=OCI_BASE_URL,
            api_key="not-used",
            project=OCI_PROJECT_ID,
            http_client=self.http_client,
        )

    def ask(self, prompt: str) -> str:
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty.")

        response = self.client.responses.create(
            model=MODEL_NAME,
            input=prompt,
        )

        return response.output_text

    def close(self):
        self.http_client.close()