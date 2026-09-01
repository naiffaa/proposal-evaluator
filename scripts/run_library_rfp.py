"""
Real end-to-end run against OCI GenAI.

Runs the production pipeline (OCI Document Understanding
fallback + OCI GenAI) on a real RFP and one or more real
vendor proposals, then writes the RFP framework and the
final evaluation to disk for inspection.

Requires working OCI credentials:
  - local:   OCI_AUTH_MODE=config  with ~/.oci/config
  - compute: OCI_AUTH_MODE=instance_principal

Usage:
    python3 scripts/run_library_rfp.py <rfp.pdf> <proposal.pdf> [more.pdf ...]

Output:
    artifacts/rfp_analysis.json
    artifacts/final_evaluation.json
    artifacts/requirements_matrix.csv
"""

import csv
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2

    rfp_path = Path(sys.argv[1])

    proposal_paths = [
        Path(item)
        for item in sys.argv[2:]
    ]

    for path in [rfp_path, *proposal_paths]:
        if not path.is_file():
            print(f"File not found: {path}")
            return 2

    from services.proposal_service import (
        ProposalEvaluationService,
    )

    output_directory = REPO_ROOT / "artifacts"
    output_directory.mkdir(exist_ok=True)

    service = ProposalEvaluationService()

    try:
        result = service.evaluate(
            rfp_path=rfp_path,
            proposal_paths=proposal_paths,
        )

    finally:
        close = getattr(service, "close", None)

        if callable(close):
            close()

    analysis = result["rfp"]["analysis"]

    (
        output_directory / "rfp_analysis.json"
    ).write_text(
        json.dumps(
            analysis,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    (
        output_directory / "final_evaluation.json"
    ).write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # Flat compliance matrix across all vendors.
    matrix_path = (
        output_directory
        / "requirements_matrix.csv"
    )

    with matrix_path.open(
        "w",
        newline="",
        encoding="utf-8-sig",
    ) as handle:
        writer = csv.writer(handle)

        writer.writerow(
            [
                "Vendor",
                "Track",
                "Requirement ID",
                "Criterion",
                "RFP Requirement",
                "RFP Source",
                "Mandatory",
                "Vendor Evidence",
                "Status",
                "Compliance Label",
                "Score",
                "Risk / Comment",
            ]
        )

        for vendor in result["vendors"]:
            for row in vendor.get(
                "requirementsComplianceMatrix",
                [],
            ):
                writer.writerow(
                    [
                        vendor.get("vendor", ""),
                        row.get("track", ""),
                        row.get("requirementId", ""),
                        row.get("criterion", ""),
                        row.get("rfpRequirement", ""),
                        row.get("rfpSource", ""),
                        row.get("mandatory", ""),
                        row.get("vendorEvidence", ""),
                        row.get("status", ""),
                        row.get(
                            "complianceLabel",
                            "",
                        ),
                        row.get("score", ""),
                        row.get("riskComment", ""),
                    ]
                )

    print()
    print("=" * 60)
    print("RUN COMPLETE")
    print("=" * 60)

    metadata = analysis.get("metadata", {})

    print(
        "Extraction method: "
        f"{metadata.get('requirement_extraction_method')}"
    )
    print(
        "Criteria: "
        f"{metadata.get('criteria_count')}"
    )
    print(
        "Requirements: "
        f"{metadata.get('requirement_count')}"
    )
    print(
        "Mandatory (scored): "
        f"{metadata.get('mandatory_requirement_count')}"
    )
    print(
        "Eligibility gates: "
        f"{metadata.get('eligibility_requirement_count')}"
    )
    print(
        "Weight source: "
        f"{result.get('evaluationWeightSource')}"
    )

    print()

    for criterion in analysis["criteria"]:
        print(
            f"- {criterion['criterion_id']} "
            f"{criterion['name']} | "
            f"weight={criterion['weight']}% | "
            f"{len(criterion['requirements'])} reqs"
        )

    print()

    for vendor in result["vendors"]:
        print(
            f"#{vendor.get('rank')} "
            f"{vendor.get('vendor')} | "
            f"score={vendor.get('overallScore')} | "
            "mandatory="
            f"{vendor.get('mandatoryComplianceStatus')} "
            f"({vendor.get('mandatoryCompliancePercentage')}%) | "
            "confidence="
            f"{vendor.get('confidenceLevel')}"
        )

    print()
    print(f"Artifacts written to {output_directory}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
