import os
import platform
import threading
import time
from typing import Optional, Tuple

import httpx
from openai import OpenAI
from oci_genai_auth import OciInstancePrincipalAuth, OciUserPrincipalAuth

from config import (
    OCI_AUTH_MODE,
    OCI_BASE_URL,
    OCI_PROFILE,
    OCI_PROJECT_ID,
    MODEL_NAME,
)

_SHARED_CLIENT_LOCK = threading.Lock()
_SHARED_HTTP_CLIENT: Optional[httpx.Client] = None
_SHARED_OPENAI_CLIENT: Optional[OpenAI] = None


def _running_on_oci_compute() -> bool:
    system_name = platform.system().strip().lower()

    if system_name in {"windows", "darwin"}:
        return False

    explicit_compute_hint = (
        os.getenv("OCI_COMPUTE_INSTANCE", "")
        .strip()
        .lower()
    )

    if explicit_compute_hint in {"1", "true", "yes", "on"}:
        return True

    return system_name == "linux"


def _build_auth():
    auth_mode = OCI_AUTH_MODE.strip().lower()

    if auth_mode not in {
        "auto",
        "config",
        "instance_principal",
    }:
        raise ValueError(
            "OCI_AUTH_MODE must be one of: "
            "auto, config, instance_principal"
        )

    if auth_mode == "config":
        return (
            OciUserPrincipalAuth(
                profile_name=OCI_PROFILE,
            ),
            f"OCI user principal profile '{OCI_PROFILE}'",
        )

    if auth_mode == "instance_principal":
        return (
            OciInstancePrincipalAuth(),
            "Instance Principal",
        )

    if not _running_on_oci_compute():
        return (
            OciUserPrincipalAuth(
                profile_name=OCI_PROFILE,
            ),
            f"OCI user principal profile '{OCI_PROFILE}' (auto-local)",
        )

    try:
        return (
            OciInstancePrincipalAuth(),
            "Instance Principal (auto-detected)",
        )
    except Exception as instance_error:
        print(
            "Instance Principal unavailable. "
            "Using OCI user principal."
        )
        print(
            "Instance Principal reason: "
            f"{type(instance_error).__name__}: "
            f"{instance_error}"
        )

        return (
            OciUserPrincipalAuth(
                profile_name=OCI_PROFILE,
            ),
            f"OCI user principal profile '{OCI_PROFILE}'",
        )


def _get_shared_clients() -> Tuple[
    httpx.Client,
    OpenAI,
]:
    global _SHARED_HTTP_CLIENT
    global _SHARED_OPENAI_CLIENT

    if (
        _SHARED_HTTP_CLIENT is not None
        and _SHARED_OPENAI_CLIENT is not None
    ):
        return (
            _SHARED_HTTP_CLIENT,
            _SHARED_OPENAI_CLIENT,
        )

    with _SHARED_CLIENT_LOCK:
        if (
            _SHARED_HTTP_CLIENT is not None
            and _SHARED_OPENAI_CLIENT is not None
        ):
            return (
                _SHARED_HTTP_CLIENT,
                _SHARED_OPENAI_CLIENT,
            )

        http_auth, auth_description = _build_auth()

        _SHARED_HTTP_CLIENT = httpx.Client(
            auth=http_auth,
            timeout=httpx.Timeout(
                connect=20.0,
                read=600.0,
                write=120.0,
                pool=30.0,
            ),
            limits=httpx.Limits(
                max_connections=30,
                max_keepalive_connections=20,
            ),
        )

        _SHARED_OPENAI_CLIENT = OpenAI(
            base_url=OCI_BASE_URL,
            api_key="not-used",
            project=OCI_PROJECT_ID,
            http_client=_SHARED_HTTP_CLIENT,
        )

        print(
            "LLM authentication: "
            f"{auth_description}"
        )
        print(
            "LLM transport: shared HTTP/OpenAI client initialized"
        )

        return (
            _SHARED_HTTP_CLIENT,
            _SHARED_OPENAI_CLIENT,
        )


class LLMClient:
    def __init__(
        self,
        model: Optional[str] = None,
    ):
        self.model = (
            str(model).strip()
            if model
            else MODEL_NAME
        )

        (
            self.http_client,
            self.client,
        ) = _get_shared_clients()

    def ask(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        label: Optional[str] = None,
    ) -> str:
        if not prompt or not prompt.strip():
            raise ValueError(
                "Prompt cannot be empty."
            )

        request_model = (
            str(model).strip()
            if model
            else self.model
        )

        started = time.perf_counter()

        thread_name = (
            threading
            .current_thread()
            .name
        )

        request_label = label or "LLM"

        print(
            f"[{request_label}] "
            "Starting request | "
            f"model={request_model} | "
            f"prompt_chars={len(prompt)} | "
            f"thread={thread_name}"
        )

        try:
            response = (
                self.client.responses.create(
                    model=request_model,
                    input=prompt,
                )
            )

            output_text = (
                response.output_text
                or ""
            )

            elapsed = (
                time.perf_counter()
                - started
            )

            print(
                f"[{request_label}] "
                "Completed | "
                f"{elapsed:.2f}s | "
                f"output_chars={len(output_text)}"
            )

            return output_text

        except Exception:
            elapsed = (
                time.perf_counter()
                - started
            )

            print(
                f"[{request_label}] "
                "FAILED after "
                f"{elapsed:.2f}s"
            )

            raise

    def close(
        self,
    ):
        return None


def close_shared_llm_client():
    global _SHARED_HTTP_CLIENT
    global _SHARED_OPENAI_CLIENT

    with _SHARED_CLIENT_LOCK:
        if _SHARED_HTTP_CLIENT is not None:
            _SHARED_HTTP_CLIENT.close()

        _SHARED_HTTP_CLIENT = None
        _SHARED_OPENAI_CLIENT = None
