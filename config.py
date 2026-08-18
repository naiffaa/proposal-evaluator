import os

OCI_PROFILE = os.getenv("OCI_PROFILE", "DEFAULT")

OCI_BASE_URL = (
    "https://inference.generativeai.me-riyadh-1."
    "oci.oraclecloud.com/openai/v1"
)

OCI_PROJECT_ID = (
    "ocid1.generativeaiproject.oc1.me-riyadh-1."
    "amaaaaaaanoy4qya6oowvgdaniuklkt73qcfszsjfdiuouivlk4uyfaqforq"
)

MODEL_NAME = "openai.gpt-oss-120b"