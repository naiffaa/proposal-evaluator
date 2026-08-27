from __future__ import annotations

import os
from dataclasses import dataclass

import oci

from config import (
    OCI_AUTH_MODE,
    OCI_CONFIG_FILE,
    OCI_PROFILE,
)


@dataclass
class OciAuthContext:
    mode: str
    region: str
    compartment_id: str
    config: dict
    signer: object | None


def _load_local_config() -> OciAuthContext:
    config = oci.config.from_file(
        file_location=OCI_CONFIG_FILE,
        profile_name=OCI_PROFILE,
    )

    region = str(
        config.get("region", "")
    ).strip()

    if not region:
        raise RuntimeError(
            "OCI local config does not contain a region."
        )

    compartment_id = str(
        config.get("tenancy", "")
    ).strip()

    if not compartment_id:
        raise RuntimeError(
            "OCI local config does not contain tenancy OCID."
        )

    return OciAuthContext(
        mode="config",
        region=region,
        compartment_id=compartment_id,
        config=config,
        signer=None,
    )


def _load_instance_principal() -> OciAuthContext:
    signer = (
        oci.auth.signers
        .InstancePrincipalsSecurityTokenSigner()
    )

    region = str(
        signer.region or ""
    ).strip()

    if not region:
        raise RuntimeError(
            "Instance Principal signer did not return a region."
        )

    compartment_id = str(
        signer.tenancy_id or ""
    ).strip()

    if not compartment_id:
        raise RuntimeError(
            "Instance Principal signer did not return tenancy OCID."
        )

    return OciAuthContext(
        mode="instance_principal",
        region=region,
        compartment_id=compartment_id,
        config={
            "region": region,
        },
        signer=signer,
    )


def get_oci_auth_context() -> OciAuthContext:
    mode = OCI_AUTH_MODE

    if mode not in {
        "auto",
        "instance_principal",
        "config",
    }:
        raise ValueError(
            "OCI_AUTH_MODE must be one of: "
            "auto, instance_principal, config"
        )

    if mode == "config":
        context = _load_local_config()

        print(
            "OCI authentication: local config "
            f"profile '{OCI_PROFILE}'"
        )

        return context

    if mode == "instance_principal":
        context = _load_instance_principal()

        print(
            "OCI authentication: Instance Principal"
        )

        return context

    # AUTO MODE:
    # Prefer Instance Principal only when it succeeds quickly.
    # On a normal local machine this will fail and we fall back
    # to ~/.oci/config.
    try:
        context = _load_instance_principal()

        print(
            "OCI authentication: Instance Principal "
            "(auto-detected)"
        )

        return context

    except Exception as instance_error:
        print(
            "Instance Principal unavailable; "
            "falling back to local OCI config."
        )

        print(
            f"Instance Principal reason: "
            f"{type(instance_error).__name__}: "
            f"{instance_error}"
        )

        try:
            context = _load_local_config()

            print(
                "OCI authentication: local config "
                f"profile '{OCI_PROFILE}'"
            )

            return context

        except Exception as config_error:
            raise RuntimeError(
                "Could not authenticate to OCI using either "
                "Instance Principal or local OCI config.\n\n"
                f"Instance Principal error: {instance_error}\n\n"
                f"Local config error: {config_error}\n\n"
                "For local testing, confirm ~/.oci/config exists "
                "and your selected profile contains user, tenancy, "
                "fingerprint, key_file, and region."
            ) from config_error
