import json
import re

from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)

from services.llm_client import LLMClient
from config import COMPLIANCE_CONTEXT_MAX_CHARS
from utils.proposal_context import (
    build_relevant_context,
    requirement_query_parts,
)


class ComplianceAgent:
    BATCH_SIZE = 20
    MAX_BATCH_WORKERS = 2
    MAX_BATCH_RETRIES = 1

    VALID_STATUSES = {
        "MET",
        "PARTIAL",
        "NOT_MET",
    }

    VALID_RISK_LEVELS = {
        "Low",
        "Medium",
        "High",
    }

    def __init__(self):
        pass

    def _normalize_text(
        self,
        value,
    ):
        if value is None:
            return ""

        return re.sub(
            r"\s+",
            " ",
            str(value),
        ).strip()

    # =====================================================
    # Robust JSON
    # =====================================================

    def _extract_first_json_object(
        self,
        text,
    ):
        if not isinstance(text, str):
            return None

        start = text.find("{")

        if start < 0:
            return None

        depth = 0
        in_string = False
        escaped = False

        for index in range(
            start,
            len(text),
        ):
            char = text[index]

            if in_string:
                if escaped:
                    escaped = False
                    continue

                if char == "\\":
                    escaped = True
                    continue

                if char == '"':
                    in_string = False

                continue

            if char == '"':
                in_string = True
                continue

            if char == "{":
                depth += 1

            elif char == "}":
                depth -= 1

                if depth == 0:
                    return text[
                        start:index + 1
                    ]

        return None

    def _parse_json(
        self,
        result,
    ):
        if not isinstance(result, str):
            raise ValueError(
                "Compliance Agent response "
                "must be text."
            )

        text = result.strip()

        text = re.sub(
            r"^```(?:json)?\s*",
            "",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"\s*```$",
            "",
            text,
        )

        try:
            return json.loads(text)

        except json.JSONDecodeError:
            extracted = (
                self._extract_first_json_object(
                    text
                )
            )

            if extracted:
                try:
                    return json.loads(
                        extracted
                    )
                except json.JSONDecodeError:
                    pass

            raise ValueError(
                "Compliance Agent returned "
                "invalid JSON."
            )

    # =====================================================
    # Requirements
    # =====================================================

    def _get_requirement_id(
        self,
        requirement,
        fallback_index=None,
    ):
        if not isinstance(
            requirement,
            dict,
        ):
            return None

        requirement_id = (
            requirement.get("id")
            or
            requirement.get(
                "requirement_id"
            )
        )

        requirement_id = (
            self._normalize_text(
                requirement_id
            )
        )

        if requirement_id:
            return requirement_id

        if fallback_index is not None:
            return (
                f"MANDATORY-{fallback_index:04d}"
            )

        return None

    def _normalize_requirements(
        self,
        mandatory_requirements,
    ):
        normalized = []
        seen_ids = set()

        for index, requirement in enumerate(
            mandatory_requirements,
            start=1,
        ):
            if not isinstance(
                requirement,
                dict,
            ):
                raise ValueError(
                    "Each mandatory requirement "
                    "must be an object."
                )

            requirement_id = (
                self._get_requirement_id(
                    requirement,
                    fallback_index=index,
                )
            )

            requirement_text = (
                self._normalize_text(
                    requirement.get(
                        "requirement",
                        "",
                    )
                )
            )

            if not requirement_text:
                raise ValueError(
                    "Mandatory requirement "
                    f"'{requirement_id}' "
                    "has empty requirement text."
                )

            if requirement_id in seen_ids:
                raise ValueError(
                    "Duplicate mandatory "
                    "requirement ID: "
                    f"{requirement_id}"
                )

            seen_ids.add(requirement_id)

            normalized.append(
                {
                    **requirement,
                    "id": requirement_id,
                    "requirement_id": (
                        requirement_id
                    ),
                    "requirement": (
                        requirement_text
                    ),
                }
            )

        return normalized

    def _format_requirements(
        self,
        requirements,
    ):
        cleaned = []

        for requirement in requirements:
            cleaned.append(
                {
                    "requirement_id": (
                        requirement[
                            "requirement_id"
                        ]
                    ),
                    "requirement": (
                        requirement[
                            "requirement"
                        ]
                    ),
                    "source": (
                        requirement.get(
                            "source",
                            "",
                        )
                    ),
                    "page": (
                        requirement.get(
                            "page"
                        )
                    ),
                    "criterion": (
                        requirement.get(
                            "criterion",
                            "",
                        )
                    ),
                    "mandatory_evidence": (
                        requirement.get(
                            "mandatory_evidence",
                            "",
                        )
                    ),
                }
            )

        return json.dumps(
            cleaned,
            ensure_ascii=False,
        )

    # =====================================================
    # Deterministic ID repair
    # =====================================================

    def _repair_missing_requirement_ids(
        self,
        evaluations,
        requirements,
    ):
        if (
            not isinstance(evaluations, list)
            or
            len(evaluations)
            !=
            len(requirements)
        ):
            return evaluations, 0

        expected_ids = [
            item["requirement_id"]
            for item in requirements
        ]

        seen = set()

        for index, evaluation in enumerate(
            evaluations
        ):
            if not isinstance(
                evaluation,
                dict,
            ):
                return evaluations, 0

            received = (
                self._normalize_text(
                    evaluation.get(
                        "requirement_id",
                        "",
                    )
                )
            )

            if not received:
                continue

            if received != expected_ids[index]:
                return evaluations, 0

            if received in seen:
                return evaluations, 0

            seen.add(received)

        repaired = 0

        for index, evaluation in enumerate(
            evaluations
        ):
            received = (
                self._normalize_text(
                    evaluation.get(
                        "requirement_id",
                        "",
                    )
                )
            )

            if received:
                continue

            evaluation[
                "requirement_id"
            ] = expected_ids[index]

            repaired += 1

        if repaired:
            print(
                "Compliance deterministic repair: "
                f"restored {repaired} missing "
                "requirement_id field(s)."
            )

        return evaluations, repaired

    # =====================================================
    # Normalizers
    # =====================================================

    def _normalize_list(
        self,
        value,
    ):
        if value is None:
            return []

        if not isinstance(value, list):
            value = [value]

        cleaned = []

        for item in value:
            if isinstance(item, dict):
                cleaned.append(item)
                continue

            text = str(item).strip()

            if text:
                cleaned.append(text)

        return cleaned

    def _normalize_status(
        self,
        value,
    ):
        status = str(
            value or "NOT_MET"
        ).strip().upper()

        if status not in self.VALID_STATUSES:
            return "NOT_MET"

        return status

    def _normalize_risk_level(
        self,
        value,
    ):
        risk = str(
            value or "Medium"
        ).strip().title()

        if risk not in self.VALID_RISK_LEVELS:
            return "Medium"

        return risk

    def _risk_rank(
        self,
        value,
    ):
        return {
            "Low": 1,
            "Medium": 2,
            "High": 3,
        }.get(
            self._normalize_risk_level(
                value
            ),
            2,
        )

    # =====================================================
    # Batch helpers
    # =====================================================

    def _build_batches(
        self,
        requirements,
    ):
        return [
            requirements[
                start:
                start + self.BATCH_SIZE
            ]
            for start in range(
                0,
                len(requirements),
                self.BATCH_SIZE,
            )
        ]

    def _build_batch_context(
        self,
        proposal_text,
        requirements,
    ):
        return (
            build_relevant_context(
                proposal_text=proposal_text,
                query_parts=(
                    requirement_query_parts(
                        requirements
                    )
                ),
                domain_hint="compliance",
                max_chars=(
                    COMPLIANCE_CONTEXT_MAX_CHARS
                ),
                top_k=12,
            )
        )

    def _build_batch_prompt(
        self,
        requirements,
        proposal_context,
        retry_reason=None,
    ):
        requirements_text = (
            self._format_requirements(
                requirements
            )
        )

        expected_ids = [
            item["requirement_id"]
            for item in requirements
        ]

        retry = ""

        if retry_reason:
            retry = f"""
RETRY:
Previous response was invalid:
{retry_reason}

Return exactly one result for every ID:
{json.dumps(expected_ids, ensure_ascii=False)}
"""

        return f"""
You are a senior procurement compliance evaluator.

Evaluate ONLY the supplied mandatory RFP requirements
against evidence in the vendor proposal.

Use ONLY proposal evidence.
Do not invent evidence.
Do not use external knowledge.

Statuses:
MET
PARTIAL
NOT_MET

Return EXACTLY {len(requirements)} evaluations.

IDs in this exact order:
{json.dumps(expected_ids, ensure_ascii=False)}

Every evaluation MUST contain requirement_id.
Never leave requirement_id blank.
Never invent, omit, duplicate or reorder IDs.

MET requires meaningful evidence.
If MET has no evidence Python will downgrade it.

Return ONLY valid JSON:

{{
  "requirementsEvaluation": [
    {{
      "requirement_id": "REQ-0001",
      "requirement": "Requirement",
      "status": "MET",
      "evidence": ["Direct proposal evidence"],
      "gap": "",
      "reason": "Short reason"
    }}
  ],
  "unsupportedClaims": [],
  "deliveryRisks": [],
  "ambiguousCommitments": [],
  "batchRiskLevel": "Low"
}}

{retry}

MANDATORY REQUIREMENTS:
{requirements_text}

RELEVANT PROPOSAL:
<PROPOSAL_DOCUMENT>
{proposal_context}
</PROPOSAL_DOCUMENT>
"""

    # =====================================================
    # Batch validation / execution
    # =====================================================

    def _validate_batch_evaluations(
        self,
        evaluations,
        requirements,
    ):
        if not isinstance(evaluations, list):
            raise ValueError(
                "Compliance batch result is "
                "missing requirementsEvaluation."
            )

        if len(evaluations) != len(requirements):
            raise ValueError(
                "Compliance batch returned "
                f"{len(evaluations)} evaluations "
                f"for {len(requirements)} requirements."
            )

        (
            evaluations,
            repaired,
        ) = (
            self._repair_missing_requirement_ids(
                evaluations,
                requirements,
            )
        )

        expected_ids = [
            item["requirement_id"]
            for item in requirements
        ]

        expected_map = {
            item["requirement_id"]: item
            for item in requirements
        }

        cleaned = []

        for index, evaluation in enumerate(
            evaluations
        ):
            if not isinstance(
                evaluation,
                dict,
            ):
                raise ValueError(
                    "Compliance evaluation "
                    f"{index + 1} must be an object."
                )

            requirement_id = (
                self._normalize_text(
                    evaluation.get(
                        "requirement_id",
                        "",
                    )
                )
            )

            if not requirement_id:
                raise ValueError(
                    "Compliance evaluation "
                    f"{index + 1} is missing "
                    "requirement_id."
                )

            if requirement_id != expected_ids[index]:
                raise ValueError(
                    "Compliance requirement ID/order "
                    "does not match expected RFP batch."
                )

            source_requirement = (
                expected_map[
                    requirement_id
                ]
            )

            status = (
                self._normalize_status(
                    evaluation.get(
                        "status"
                    )
                )
            )

            evidence = (
                self._normalize_list(
                    evaluation.get(
                        "evidence",
                        [],
                    )
                )
            )

            gap = self._normalize_text(
                evaluation.get(
                    "gap",
                    "",
                )
            )

            reason = self._normalize_text(
                evaluation.get(
                    "reason",
                    "",
                )
            )

            if status == "MET" and not evidence:
                status = "PARTIAL"

                if not gap:
                    gap = (
                        "Marked MET without "
                        "supporting evidence."
                    )

            cleaned.append(
                {
                    "requirement_id": (
                        requirement_id
                    ),
                    "requirement": (
                        source_requirement[
                            "requirement"
                        ]
                    ),
                    "source": (
                        source_requirement.get(
                            "source",
                            "",
                        )
                    ),
                    "page": (
                        source_requirement.get(
                            "page"
                        )
                    ),
                    "criterion": (
                        source_requirement.get(
                            "criterion",
                            "",
                        )
                    ),
                    "status": status,
                    "evidence": evidence,
                    "gap": gap,
                    "reason": reason,
                }
            )

        return cleaned

    def _evaluate_batch_once(
        self,
        batch_number,
        requirements,
        proposal_text,
        retry_reason=None,
    ):
        context = (
            self._build_batch_context(
                proposal_text,
                requirements,
            )
        )

        prompt = (
            self._build_batch_prompt(
                requirements,
                context,
                retry_reason,
            )
        )

        print()
        print(
            f"Compliance batch {batch_number}"
        )

        client = LLMClient()

        try:
            raw = client.ask(
                prompt,
                label=(
                    f"ComplianceBatch"
                    f"{batch_number}"
                ),
            )
        finally:
            client.close()

        result = self._parse_json(raw)

        if not isinstance(result, dict):
            raise ValueError(
                "Compliance batch result "
                "must be an object."
            )

        evaluations = (
            self._validate_batch_evaluations(
                result.get(
                    "requirementsEvaluation",
                    [],
                ),
                requirements,
            )
        )

        return {
            "evaluations": evaluations,
            "unsupportedClaims": (
                self._normalize_list(
                    result.get(
                        "unsupportedClaims",
                        [],
                    )
                )
            ),
            "deliveryRisks": (
                self._normalize_list(
                    result.get(
                        "deliveryRisks",
                        [],
                    )
                )
            ),
            "ambiguousCommitments": (
                self._normalize_list(
                    result.get(
                        "ambiguousCommitments",
                        [],
                    )
                )
            ),
            "riskLevel": (
                self._normalize_risk_level(
                    result.get(
                        "batchRiskLevel",
                        "Medium",
                    )
                )
            ),
        }

    def _evaluate_batch(
        self,
        batch_number,
        requirements,
        proposal_text,
    ):
        retry_reason = None
        last_error = None

        for attempt in range(
            1,
            self.MAX_BATCH_RETRIES + 2,
        ):
            try:
                result = (
                    self._evaluate_batch_once(
                        batch_number,
                        requirements,
                        proposal_text,
                        retry_reason,
                    )
                )

                if attempt > 1:
                    print(
                        "Compliance batch "
                        f"{batch_number} retry "
                        "completed successfully."
                    )

                return result

            except Exception as error:
                last_error = str(error)

                if (
                    attempt
                    >=
                    self.MAX_BATCH_RETRIES + 1
                ):
                    break

                retry_reason = last_error

                print(
                    "Retrying compliance batch "
                    f"{batch_number} once: "
                    f"{last_error}"
                )

        raise RuntimeError(
            "Compliance batch "
            f"{batch_number} failed after retry. "
            f"{last_error}"
        )

    # =====================================================
    # Deterministic aggregation
    # =====================================================

    def _calculate_compliance(
        self,
        evaluations,
    ):
        if not evaluations:
            return True, 100.0

        points = 0.0
        statuses = []

        for item in evaluations:
            status = item["status"]
            statuses.append(status)

            if status == "MET":
                points += 1.0
            elif status == "PARTIAL":
                points += 0.5

        score = round(
            (
                points
                /
                len(evaluations)
            )
            *
            100,
            2,
        )

        compliant = all(
            status == "MET"
            for status in statuses
        )

        return compliant, score

    def _calculate_overall_risk(
        self,
        evaluations,
        batch_risks,
    ):
        not_met = sum(
            1
            for item in evaluations
            if item["status"] == "NOT_MET"
        )

        partial = sum(
            1
            for item in evaluations
            if item["status"] == "PARTIAL"
        )

        highest = "Low"

        for risk in batch_risks:
            if (
                self._risk_rank(risk)
                >
                self._risk_rank(highest)
            ):
                highest = (
                    self._normalize_risk_level(
                        risk
                    )
                )

        if not_met >= 5:
            return "High"

        if not_met > 0:
            return (
                "High"
                if highest == "High"
                else "Medium"
            )

        if partial > 0:
            return (
                "High"
                if highest == "High"
                else "Medium"
            )

        return highest

    # =====================================================
    # Main
    # =====================================================

    def evaluate(
        self,
        mandatory_requirements,
        proposal_text,
    ):
        if not isinstance(
            mandatory_requirements,
            list,
        ):
            raise ValueError(
                "Mandatory requirements "
                "must be a list."
            )

        if not isinstance(
            proposal_text,
            str,
        ):
            raise ValueError(
                "Vendor proposal text "
                "must be a string."
            )

        proposal_text = proposal_text.strip()

        if not proposal_text:
            raise ValueError(
                "Vendor proposal text "
                "cannot be empty."
            )

        if not mandatory_requirements:
            return {
                "requirementsEvaluation": [],
                "missingRequirements": [],
                "unsupportedClaims": [],
                "complianceGaps": [],
                "deliveryRisks": [],
                "ambiguousCommitments": [],
                "riskLevel": "Low",
                "rationale": (
                    "No explicit mandatory "
                    "requirements were found."
                ),
                "compliant": True,
                "complianceScore": 100.0,
            }

        requirements = (
            self._normalize_requirements(
                mandatory_requirements
            )
        )

        batches = (
            self._build_batches(
                requirements
            )
        )

        worker_count = min(
            self.MAX_BATCH_WORKERS,
            len(batches),
        )

        print()
        print(
            "================================"
        )
        print(
            "COMPLIANCE BATCHED EVALUATION"
        )
        print(
            "================================"
        )
        print(
            f"Mandatory requirements: "
            f"{len(requirements)}"
        )
        print(
            f"Batch size: {self.BATCH_SIZE}"
        )
        print(
            f"Total batches: {len(batches)}"
        )
        print(
            f"Parallel workers: "
            f"{worker_count}"
        )

        results_by_index = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for batch_index, batch in enumerate(
                batches,
                start=1,
            ):
                future = executor.submit(
                    self._evaluate_batch,
                    batch_index,
                    batch,
                    proposal_text,
                )

                future_map[
                    future
                ] = batch_index

            for future in as_completed(
                future_map
            ):
                batch_index = (
                    future_map[future]
                )

                try:
                    results_by_index[
                        batch_index
                    ] = future.result()

                except Exception as error:
                    raise RuntimeError(
                        "Compliance batch "
                        f"{batch_index} failed: "
                        f"{error}"
                    ) from error

                print(
                    "Compliance batch "
                    f"{batch_index} completed."
                )

        evaluations = []
        unsupported = []
        risks = []
        ambiguous = []
        batch_risks = []

        for batch_index in range(
            1,
            len(batches) + 1,
        ):
            result = (
                results_by_index[
                    batch_index
                ]
            )

            evaluations.extend(
                result["evaluations"]
            )
            unsupported.extend(
                result["unsupportedClaims"]
            )
            risks.extend(
                result["deliveryRisks"]
            )
            ambiguous.extend(
                result[
                    "ambiguousCommitments"
                ]
            )
            batch_risks.append(
                result["riskLevel"]
            )

        expected_ids = [
            item["requirement_id"]
            for item in requirements
        ]

        returned_ids = [
            item["requirement_id"]
            for item in evaluations
        ]

        if expected_ids != returned_ids:
            raise RuntimeError(
                "Merged compliance IDs/order "
                "do not match the RFP."
            )

        compliant, score = (
            self._calculate_compliance(
                evaluations
            )
        )

        risk_level = (
            self._calculate_overall_risk(
                evaluations,
                batch_risks,
            )
        )

        missing = [
            {
                "requirement_id": (
                    item["requirement_id"]
                ),
                "requirement": (
                    item["requirement"]
                ),
                "status": item["status"],
                "gap": item.get(
                    "gap",
                    "",
                ),
            }
            for item in evaluations
            if item["status"] != "MET"
        ]

        gaps = [
            {
                "requirement_id": (
                    item["requirement_id"]
                ),
                "gap": (
                    item.get("gap")
                    or
                    item.get("reason")
                    or
                    ""
                ),
            }
            for item in evaluations
            if item["status"] != "MET"
        ]

        met_count = sum(
            1
            for item in evaluations
            if item["status"] == "MET"
        )

        partial_count = sum(
            1
            for item in evaluations
            if item["status"] == "PARTIAL"
        )

        not_met_count = sum(
            1
            for item in evaluations
            if item["status"] == "NOT_MET"
        )

        rationale = (
            "Mandatory compliance evaluation "
            f"completed against "
            f"{len(evaluations)} requirements. "
            f"MET: {met_count}, "
            f"PARTIAL: {partial_count}, "
            f"NOT_MET: {not_met_count}. "
            f"Compliance score: {score}%."
        )

        return {
            "requirementsEvaluation": (
                evaluations
            ),
            "missingRequirements": missing,
            "unsupportedClaims": unsupported,
            "complianceGaps": gaps,
            "deliveryRisks": risks,
            "ambiguousCommitments": ambiguous,
            "riskLevel": risk_level,
            "rationale": rationale,
            "compliant": compliant,
            "complianceScore": score,
            "summary": {
                "total": len(evaluations),
                "met": met_count,
                "partial": partial_count,
                "notMet": not_met_count,
                "batchCount": len(batches),
            },
        }

    def close(self):
        pass
