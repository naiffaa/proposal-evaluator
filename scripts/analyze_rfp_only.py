"""
RFP-only analysis. No proposal evaluation.

Parses one RFP and runs RFPAgent to produce the frozen
evaluation framework, then writes it to disk and prints an
inspection report covering:

- project information
- eligibility / mandatory submission gates
- criteria and weights (with weight source)
- subcriteria
- mandatory vs preferred classification

Requires working OCI credentials:
  - local:   OCI_AUTH_MODE=config with an OCI API-key profile
             (override the path with OCI_CONFIG_FILE)
  - compute: OCI_AUTH_MODE=instance_principal

Usage:
    python3 scripts/analyze_rfp_only.py <rfp.pdf> [output.json]
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def preview(value, limit=110):
    text = " ".join(str(value or "").split())

    if len(text) <= limit:
        return text

    return text[:limit] + "..."


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    rfp_path = Path(sys.argv[1])

    if not rfp_path.is_file():
        print(f"File not found: {rfp_path}")
        return 2

    output_path = (
        Path(sys.argv[2])
        if len(sys.argv) > 2
        else REPO_ROOT / "artifacts" / "rfp_analysis.json"
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    from services.document_parser import DocumentParser
    from services.proposal_service import (
        ProposalEvaluationService,
    )
    from agents.rfp_agent import RFPAgent

    # ---------------------------------------------------
    # Parse
    # ---------------------------------------------------

    parser = DocumentParser()

    try:
        document = parser.parse_document(rfp_path)

    finally:
        close = getattr(parser, "close", None)

        if callable(close):
            close()

    rfp_text = str(
        document.get("text", "")
    ).strip()

    if not rfp_text:
        print("Document parser returned empty text.")
        return 1

    print()
    print(
        f"Parsed {len(rfp_text)} characters from "
        f"{document.get('page_count')} page(s) "
        f"via {document.get('extraction_method')}."
    )

    # ---------------------------------------------------
    # Analyze
    # ---------------------------------------------------

    # Reuse the service's weight-config loading so this
    # script and the full pipeline behave identically.
    weight_config = (
        ProposalEvaluationService._load_weight_config(
            ProposalEvaluationService.__new__(
                ProposalEvaluationService
            )
        )
    )

    agent = RFPAgent()

    try:
        analysis = agent.analyze(
            rfp_text,
            weight_config=weight_config,
        )

    finally:
        close = getattr(agent, "close", None)

        if callable(close):
            close()

    output_path.write_text(
        json.dumps(
            analysis,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # ---------------------------------------------------
    # Inspection report
    # ---------------------------------------------------

    metadata = analysis.get("metadata", {})
    project = analysis.get(
        "project_information",
        {},
    )

    print()
    print("=" * 64)
    print("PROJECT INFORMATION")
    print("=" * 64)

    for label, key in [
        ("Project name", "project_name"),
        ("Issuing organization", "issuing_organization"),
        ("Objective", "project_objective"),
        ("Duration", "implementation_duration"),
        ("Submission deadline", "submission_deadline"),
        ("Proposal validity", "proposal_validity"),
    ]:
        print(
            f"{label:22}: "
            f"{preview(project.get(key)) or '(not extracted)'}"
        )

    for label, key in [
        ("Scope of work", "scope_of_work"),
        ("Deliverables", "required_deliverables"),
    ]:
        items = project.get(key, []) or []

        print(f"{label:22}: {len(items)} item(s)")

        for item in items:
            print(f"    - {preview(item, 90)}")

    print()
    print("=" * 64)
    print("ELIGIBILITY / MANDATORY SUBMISSION GATES")
    print("=" * 64)

    gates = analysis.get(
        "eligibility_requirements",
        [],
    )

    print(f"Total gates: {len(gates)}")
    print()

    for gate in gates:
        print(
            f"{gate['id']} "
            f"[{'EXCLUSION' if gate['exclusion_grade'] else 'required '}] "
            f"({gate['category']})"
        )
        print(f"    name    : {preview(gate['name'], 90)}")
        print(
            f"    evidence: "
            f"{preview(gate.get('evidence_expected'), 90)}"
        )
        print(
            f"    source  : "
            f"{preview(gate.get('source_section'), 90)}"
        )

    print()
    print("=" * 64)
    print("CRITERIA AND WEIGHTS")
    print("=" * 64)

    weight_source = analysis.get(
        "evaluation_weight_source"
    )

    print(f"Weight source: {weight_source}")

    if weight_source != "explicit_rfp":
        print(
            "NOTE: the RFP publishes no numeric criterion "
            "weights. These are system-defined and "
            "configurable, NOT official RFP weights."
        )

    print(
        f"Total weight : {metadata.get('total_weight')}%"
    )
    print()

    criteria = analysis.get("criteria", [])

    for criterion in criteria:
        requirements = criterion["requirements"]

        mandatory_count = sum(
            1
            for item in requirements
            if item.get("mandatory")
        )

        preferred_count = sum(
            1
            for item in requirements
            if item.get("requirement_type")
            == "تفضيلي"
        )

        print(
            f"{criterion['criterion_id']} | "
            f"{criterion['weight']:>6.2f}% | "
            f"{criterion['name']}"
        )
        print(
            f"    requirements: {len(requirements)} "
            f"(mandatory {mandatory_count}, "
            f"preferred {preferred_count})"
        )
        print(
            f"    importance  : "
            f"{criterion.get('criterion_importance_score')} "
            f"- {preview(criterion.get('criterion_importance_reason'), 70)}"
        )
        print(
            f"    weight src  : "
            f"{criterion.get('weight_source')}"
        )

        for subcriterion in criterion.get(
            "subcriteria",
            [],
        ):
            pages = subcriterion.get("pages", [])

            page_label = (
                f"p{pages[0]}"
                if len(pages) == 1
                else (
                    f"p{pages[0]}-{pages[-1]}"
                    if pages
                    else "-"
                )
            )

            print(
                f"      - {subcriterion['subcriterion_id']} "
                f"[{subcriterion['importance']}] "
                f"{page_label} "
                f"({subcriterion['requirement_count']} req, "
                f"{subcriterion['mandatory_count']} mandatory) "
                f"{preview(subcriterion['name'], 60)}"
            )

        print()

    print("=" * 64)
    print("MANDATORY CLASSIFICATION")
    print("=" * 64)

    all_requirements = analysis.get(
        "all_requirements",
        [],
    )

    mandatory = [
        item
        for item in all_requirements
        if item.get("mandatory")
    ]

    preferred = [
        item
        for item in all_requirements
        if item.get("requirement_type") == "تفضيلي"
    ]

    standard = [
        item
        for item in all_requirements
        if not item.get("mandatory")
        and item.get("requirement_type") != "تفضيلي"
    ]

    print(
        f"Extraction method : "
        f"{metadata.get('requirement_extraction_method')}"
    )
    print(
        f"Requirements      : {len(all_requirements)}"
    )
    print(
        f"  mandatory       : {len(mandatory)}"
    )
    print(
        f"  preferred       : {len(preferred)}"
    )
    print(
        f"  standard        : {len(standard)}"
    )
    print(
        f"Eligibility gates : {len(gates)}"
    )

    if preferred:
        print()
        print(
            "Preferred requirements (must NOT hard-fail "
            "a vendor):"
        )

        for item in preferred:
            print(
                f"  {item['id']} "
                f"({item.get('source')}): "
                f"{preview(item['requirement'], 80)}"
            )

    categories = {}

    for item in all_requirements:
        category = item.get("category", "unspecified")

        categories[category] = (
            categories.get(category, 0) + 1
        )

    if categories:
        print()
        print("Requirements by category:")

        for category, count in sorted(
            categories.items(),
            key=lambda pair: -pair[1],
        ):
            print(f"  {category:22}: {count}")

    print()
    print(f"Written to {output_path}")
    print(
        "No proposals were evaluated "
        "(RFP analysis only)."
    )

    return 0


if __name__ == "__main__":
    sys.exit(main())
