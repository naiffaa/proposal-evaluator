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

# =========================================================
# RFP extraction (RFPs without GEN/REQ numbered IDs)
# =========================================================

# Character size of each RFP section chunk sent to the LLM
# during structured requirement extraction.
RFP_EXTRACTION_CHUNK_CHARS = int(
    os.getenv("RFP_EXTRACTION_CHUNK_CHARS", "9000")
)

# Overlap kept between consecutive extraction chunks so a
# requirement split across a chunk boundary is not lost.
RFP_EXTRACTION_CHUNK_OVERLAP = int(
    os.getenv("RFP_EXTRACTION_CHUNK_OVERLAP", "600")
)

# Parallel workers for chunked RFP requirement extraction.
RFP_EXTRACTION_WORKERS = int(
    os.getenv("RFP_EXTRACTION_WORKERS", "2")
)

# =========================================================
# Evaluation weight configuration
# =========================================================

# Optional JSON file with reviewer-defined criterion weights:
# {
#   "weight_overrides": {
#     "<criterion name or criterion_id>": <weight 0-100>,
#     ...
#   }
# }
# When present and the weights are valid (total ~100 across
# matched criteria), these override the system-derived
# importance weights and are labeled
# weight_source = "system_defined_override".
EVALUATION_WEIGHTS_FILE = os.getenv(
    "EVALUATION_WEIGHTS_FILE",
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "config",
        "evaluation_weights.json",
    ),
)
