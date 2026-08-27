import os

OCI_PROFILE = os.getenv("OCI_PROFILE", "DEFAULT")

# "auto" = use Instance Principal when available, otherwise ~/.oci/config
# "instance_principal" = force OCI Compute authentication
# "config" = force local ~/.oci/config authentication
OCI_AUTH_MODE = os.getenv("OCI_AUTH_MODE", "auto").strip().lower()
OCI_CONFIG_FILE = os.getenv(
    "OCI_CONFIG_FILE",
    os.path.expanduser("~/.oci/config"),
)

OCI_BASE_URL = (
    "https://inference.generativeai.me-riyadh-1."
    "oci.oraclecloud.com/openai/v1"
)

OCI_PROJECT_ID = os.getenv(
    "OCI_PROJECT_ID",
    "ocid1.generativeaiproject.oc1.me-riyadh-1."
    "amaaaaaaanoy4qya6oowvgdaniuklkt73qcfszsjfdiuouivlk4uyfaqforq",
)

# Keep the current production model as the default.
MODEL_NAME = os.getenv(
    "MODEL_NAME",
    "openai.gpt-oss-120b",
)

# Do NOT force the smaller model until you confirm that your OCI
# project/endpoint can serve it. For now this falls back to MODEL_NAME.
# Later, if available, set:
# FAST_MODEL_NAME=openai.gpt-oss-20b
FAST_MODEL_NAME = os.getenv(
    "FAST_MODEL_NAME",
    MODEL_NAME,
)

# Retrieval limits. These keep repeated proposal prompts much smaller
# while preserving a fallback to the full document when retrieval is weak.
PROPOSAL_CONTEXT_MAX_CHARS = int(
    os.getenv("PROPOSAL_CONTEXT_MAX_CHARS", "28000")
)

TECHNICAL_CONTEXT_MAX_CHARS = int(
    os.getenv("TECHNICAL_CONTEXT_MAX_CHARS", "36000")
)

COMPLIANCE_CONTEXT_MAX_CHARS = int(
    os.getenv("COMPLIANCE_CONTEXT_MAX_CHARS", "32000")
)
