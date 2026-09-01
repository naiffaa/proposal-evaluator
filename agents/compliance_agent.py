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
    """
    Evaluates explicit RFP eligibility/submission gates only.

    Key rules:
    - Missing evidence is UNVERIFIED, not automatic failure.
    - FAIL is deterministic and occurs only when an exclusion-grade gate
      is affirmatively NOT_MET.
    - Ordinary mandatory implementation requirements should not be passed
      to this agent; ProposalEvaluationService supplies eligibility gates.
    """

    BATCH_SIZE = 20
    MAX_BATCH_WORKERS = 2
    MAX_BATCH_RETRIES = 1

    VALID_STATUSES = {
        "MET",
        "PARTIAL",
        "NOT_MET",
        "UNVERIFIED",
        "NOT_APPLICABLE",
    }

    VALID_RISK_LEVELS = {
        "Low",
        "Medium",
        "High",
    }

    def __init__(self):
        pass

    # =====================================================
    # Generic helpers
    # =====================================================

    def _normalize_text(self, value):
        if value is None:
            return ""

        return re.sub(
            r"\s+",
            " ",
            str(value),
        ).strip()

    def _normalize_bool(self, value):
        if isinstance(value, str):
            return (
                value.strip().lower()
                in {
                    "true",
                    "yes",
                    "1",
                    "y",
                }
            )

        return bool(value)

    def _normalize_list(self, value):
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

    # =====================================================
    # Robust JSON
    # =====================================================

    def _extract_first_json_object(self, text):
        if not isinstance(text, str):
            return None

        start = text.find("{")

        if start < 0:
            return None

        depth = 0
        in_string = False
        escaped = False

        for index in range(start, len(text)):
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
                    return text[start:index + 1]

        return None

    def _parse_json(self, result):
        if not isinstance(result, str):
            raise ValueError(
                "Compliance Agent response must be text."
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
            extracted = self._extract_first_json_object(
                text
            )

            if extracted:
                try:
                    return json.loads(extracted)
                except json.JSONDecodeError:
                    pass

            raise ValueError(
                "Compliance Agent returned invalid JSON."
            )

    # =====================================================
    # Requirement normalization
    # =====================================================

    def _get_requirement_id(
        self,
        requirement,
        fallback_index=None,
    ):
        if not isinstance(requirement, dict):
            return None

        requirement_id = (
            requirement.get("id")
            or
            requirement.get("requirement_id")
        )

        requirement_id = self._normalize_text(
            requirement_id
        )

        if requirement_id:
            return requirement_id

        if fallback_index is not None:
            return (
                "ELIG-%03d"
                % fallback_index
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
            if not isinstance(requirement, dict):
                raise ValueError(
                    "Each eligibility requirement must be an object."
                )

            requirement_id = self._get_requirement_id(
                requirement,
                fallback_index=index,
            )

            requirement_text = self._normalize_text(
                requirement.get(
                    "requirement",
                    requirement.get(
                        "description",
                        requirement.get(
                            "name",
                            "",
                        ),
                    ),
                )
            )

            if not requirement_text:
                raise ValueError(
                    "Eligibility requirement '%s' has empty text."
                    % requirement_id
                )

            if requirement_id in seen_ids:
                raise ValueError(
                    "Duplicate eligibility requirement ID: %s"
                    % requirement_id
                )

            seen_ids.add(requirement_id)

            normalized.append(
                {
                    **requirement,
                    "id": requirement_id,
                    "requirement_id": requirement_id,
                    "requirement": requirement_text,
                    "name": self._normalize_text(
                        requirement.get(
                            "name",
                            "",
                        )
                    ),
                    "description": self._normalize_text(
                        requirement.get(
                            "description",
                            "",
                        )
                    ),
                    "category": self._normalize_text(
                        requirement.get(
                            "category",
                            "OTHER",
                        )
                    ),
                    "source_section": self._normalize_text(
                        requirement.get(
                            "source_section",
                            "",
                        )
                    ),
                    "source_quote": self._normalize_text(
                        requirement.get(
                            "source_quote",
                            "",
                        )
                    ),
                    "evidence_expected": self._normalize_text(
                        requirement.get(
                            "evidence_expected",
                            "",
                        )
                    ),
                    "exclusion_grade": self._normalize_bool(
                        requirement.get(
                            "exclusion_grade",
                            False,
                        )
                    ),
                }
            )

        return normalized

    def _format_requirements(self, requirements):
        cleaned = []

        for requirement in requirements:
            cleaned.append(
                {
                    "requirement_id": requirement[
                        "requirement_id"
                    ],
                    "name": requirement.get(
                        "name",
                        "",
                    ),
                    "requirement": requirement[
                        "requirement"
                    ],
                    "description": requirement.get(
                        "description",
                        "",
                    ),
                    "category": requirement.get(
                        "category",
                        "OTHER",
                    ),
                    "source": requirement.get(
                        "source",
                        "",
                    ),
                    "source_section": requirement.get(
                        "source_section",
                        "",
                    ),
                    "source_quote": requirement.get(
                        "source_quote",
                        "",
                    ),
                    "page": requirement.get(
                        "page"
                    ),
                    "evidence_expected": requirement.get(
                        "evidence_expected",
                        "",
                    ),
                    "exclusion_grade": requirement.get(
                        "exclusion_grade",
                        False,
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
            if not isinstance(evaluation, dict):
                return evaluations, 0

            received = self._normalize_text(
                evaluation.get(
                    "requirement_id",
                    "",
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
            received = self._normalize_text(
                evaluation.get(
                    "requirement_id",
                    "",
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
                "restored %s missing requirement_id field(s)."
                % repaired
            )

        return evaluations, repaired

    # =====================================================
    # Status / risk normalization
    # =====================================================

    def _normalize_status(self, value):
        raw = str(
            value
            or
            "UNVERIFIED"
        ).strip().upper()

        aliases = {
            "MET": "MET",
            "PASS": "MET",
            "SUPPORTED": "MET",
            "FULL_MATCH": "MET",

            "PARTIAL": "PARTIAL",
            "PARTIALLY_MET": "PARTIAL",
            "PARTIAL_MATCH": "PARTIAL",

            "NOT_MET": "NOT_MET",
            "FAIL": "NOT_MET",
            "CONTRADICTED": "NOT_MET",
            "NO_MATCH": "NOT_MET",

            "UNVERIFIED": "UNVERIFIED",
            "UNKNOWN": "UNVERIFIED",
            "NOT_FOUND": "UNVERIFIED",
            "NOT_PROVIDED": "UNVERIFIED",
            "MISSING": "UNVERIFIED",

            "NOT_APPLICABLE": "NOT_APPLICABLE",
            "N/A": "NOT_APPLICABLE",
            "NA": "NOT_APPLICABLE",
        }

        normalized = aliases.get(
            raw,
            "UNVERIFIED",
        )

        if normalized not in self.VALID_STATUSES:
            return "UNVERIFIED"

        return normalized

    def _normalize_risk_level(self, value):
        risk = str(
            value
            or
            "Medium"
        ).strip().title()

        if risk not in self.VALID_RISK_LEVELS:
            return "Medium"

        return risk

    def _risk_rank(self, value):
        return {
            "Low": 1,
            "Medium": 2,
            "High": 3,
        }.get(
            self._normalize_risk_level(value),
            2,
        )

    # =====================================================
    # Batching / context
    # =====================================================

    def _build_batches(self, requirements):
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
        return build_relevant_context(
            proposal_text=proposal_text,
            query_parts=requirement_query_parts(
                requirements
            ),
            domain_hint="compliance",
            max_chars=(
                COMPLIANCE_CONTEXT_MAX_CHARS
            ),
            top_k=12,
        )

    def _build_batch_prompt(
        self,
        requirements,
        proposal_context,
        retry_reason=None,
    ):
        requirements_text = self._format_requirements(
            requirements
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
You are a senior procurement eligibility and submission-compliance evaluator.

Evaluate ONLY the supplied RFP eligibility/submission gates against evidence
in the vendor proposal package.

IMPORTANT:
These eligibility gates are separate from ordinary mandatory implementation
requirements. Do not evaluate unrelated technical scope here.

Use ONLY proposal evidence.
Do not invent evidence.
Do not use external knowledge.
Do not assume missing evidence means confirmed non-compliance.

Statuses:
MET
PARTIAL
NOT_MET
UNVERIFIED
NOT_APPLICABLE

STATUS RULES:
- MET: clear proposal evidence satisfies the gate.
- PARTIAL: relevant evidence exists but is incomplete, ambiguous, expired,
  unsigned, missing a required field, or otherwise only partially satisfies it.
- NOT_MET: use ONLY when there is affirmative evidence of non-compliance,
  contradiction, invalid/expired evidence, or an explicit omission confirmed
  by the proposal. Do NOT use NOT_MET merely because evidence was not found.
- UNVERIFIED: the required evidence was not found or cannot be verified from
  the supplied proposal context. This is the default when evidence is absent.
- NOT_APPLICABLE: use only when the RFP gate clearly does not apply.

EXCLUSION-GRADE RULE:
Each requirement includes exclusion_grade.
- exclusion_grade=true means the RFP explicitly links failure/omission to
  rejection, exclusion, invalidation or disqualification.
- Missing evidence alone is still UNVERIFIED unless the proposal clearly
  establishes non-compliance.
- Python calculates PASS/PARTIAL/FAIL/UNKNOWN deterministically.

EVIDENCE EXPECTED:
Use evidence_expected to understand the proof the proposal should contain.

Return EXACTLY {len(requirements)} evaluations.

IDs in this exact order:
{json.dumps(expected_ids, ensure_ascii=False)}

Every evaluation MUST contain requirement_id.
Never leave requirement_id blank.
Never invent, omit, duplicate or reorder IDs.

Return ONLY valid JSON:

{{
  "requirementsEvaluation": [
    {{
      "requirement_id": "ELIG-001",
      "requirement": "Requirement",
      "status": "MET",
      "evidence": ["Direct proposal evidence"],
      "gap": "",
      "reason": "Short reason",
      "confidence": 0.95
    }}
  ],
  "unsupportedClaims": [],
  "deliveryRisks": [],
  "ambiguousCommitments": [],
  "batchRiskLevel": "Low"
}}

{retry}

ELIGIBILITY REQUIREMENTS:
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
                "Compliance batch result is missing requirementsEvaluation."
            )

        if len(evaluations) != len(requirements):
            raise ValueError(
                "Compliance batch returned %s evaluations for %s requirements."
                % (
                    len(evaluations),
                    len(requirements),
                )
            )

        evaluations, repaired = (
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
            if not isinstance(evaluation, dict):
                raise ValueError(
                    "Compliance evaluation %s must be an object."
                    % (
                        index + 1
                    )
                )

            requirement_id = self._normalize_text(
                evaluation.get(
                    "requirement_id",
                    "",
                )
            )

            if not requirement_id:
                raise ValueError(
                    "Compliance evaluation %s is missing requirement_id."
                    % (
                        index + 1
                    )
                )

            if requirement_id != expected_ids[index]:
                raise ValueError(
                    "Compliance requirement ID/order does not match expected RFP batch."
                )

            source_requirement = expected_map[
                requirement_id
            ]

            status = self._normalize_status(
                evaluation.get(
                    "status"
                )
            )

            evidence = self._normalize_list(
                evaluation.get(
                    "evidence",
                    [],
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
                status = "UNVERIFIED"

                if not gap:
                    gap = (
                        "Marked MET without supporting evidence; "
                        "downgraded to UNVERIFIED."
                    )

            confidence = evaluation.get(
                "confidence"
            )

            try:
                confidence = float(confidence)
                confidence = max(
                    0.0,
                    min(
                        1.0,
                        confidence,
                    ),
                )
            except (TypeError, ValueError):
                confidence = None

            cleaned.append(
                {
                    "requirement_id": requirement_id,
                    "requirement": source_requirement[
                        "requirement"
                    ],
                    "name": source_requirement.get(
                        "name",
                        "",
                    ),
                    "description": source_requirement.get(
                        "description",
                        "",
                    ),
                    "category": source_requirement.get(
                        "category",
                        "OTHER",
                    ),
                    "source": source_requirement.get(
                        "source",
                        "",
                    ),
                    "source_section": source_requirement.get(
                        "source_section",
                        "",
                    ),
                    "source_quote": source_requirement.get(
                        "source_quote",
                        "",
                    ),
                    "page": source_requirement.get(
                        "page"
                    ),
                    "criterion": source_requirement.get(
                        "criterion",
                        "",
                    ),
                    "evidence_expected": source_requirement.get(
                        "evidence_expected",
                        "",
                    ),
                    "exclusion_grade": self._normalize_bool(
                        source_requirement.get(
                            "exclusion_grade",
                            False,
                        )
                    ),
                    "status": status,
                    "evidence": evidence,
                    "gap": gap,
                    "reason": reason,
                    "confidence": confidence,
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
        context = self._build_batch_context(
            proposal_text,
            requirements,
        )

        prompt = self._build_batch_prompt(
            requirements,
            context,
            retry_reason,
        )

        print()
        print(
            "Compliance batch %s"
            % batch_number
        )

        client = LLMClient()

        try:
            raw = client.ask(
                prompt,
                label=(
                    "ComplianceBatch%s"
                    % batch_number
                ),
            )
        finally:
            client.close()

        result = self._parse_json(raw)

        if not isinstance(result, dict):
            raise ValueError(
                "Compliance batch result must be an object."
            )

        evaluations = self._validate_batch_evaluations(
            result.get(
                "requirementsEvaluation",
                [],
            ),
            requirements,
        )

        return {
            "evaluations": evaluations,
            "unsupportedClaims": self._normalize_list(
                result.get(
                    "unsupportedClaims",
                    [],
                )
            ),
            "deliveryRisks": self._normalize_list(
                result.get(
                    "deliveryRisks",
                    [],
                )
            ),
            "ambiguousCommitments": self._normalize_list(
                result.get(
                    "ambiguousCommitments",
                    [],
                )
            ),
            "riskLevel": self._normalize_risk_level(
                result.get(
                    "batchRiskLevel",
                    "Medium",
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
                result = self._evaluate_batch_once(
                    batch_number,
                    requirements,
                    proposal_text,
                    retry_reason,
                )

                if attempt > 1:
                    print(
                        "Compliance batch %s retry completed successfully."
                        % batch_number
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
                    "Retrying compliance batch %s once: %s"
                    % (
                        batch_number,
                        last_error,
                    )
                )

        raise RuntimeError(
            "Compliance batch %s failed after retry. %s"
            % (
                batch_number,
                last_error,
            )
        )

    # =====================================================
    # Deterministic aggregation
    # =====================================================

    def _calculate_compliance(self, evaluations):
        """
        PASS:
          All applicable gates are MET or NOT_APPLICABLE.

        PARTIAL:
          Some gates are PARTIAL / UNVERIFIED / non-exclusion NOT_MET,
          but no confirmed exclusion-grade failure exists.

        FAIL:
          At least one exclusion_grade=true gate is affirmatively NOT_MET.

        UNKNOWN:
          Nothing applicable could be meaningfully verified.
        """

        if not evaluations:
            return (
                "PASS",
                True,
                100.0,
            )

        applicable = [
            item
            for item in evaluations
            if item.get(
                "status"
            )
            !=
            "NOT_APPLICABLE"
        ]

        if not applicable:
            return (
                "PASS",
                True,
                100.0,
            )

        exclusion_failures = [
            item
            for item in applicable
            if (
                item.get(
                    "status"
                )
                ==
                "NOT_MET"
                and
                self._normalize_bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                )
            )
        ]

        if exclusion_failures:
            final_status = "FAIL"

        else:
            met_count = sum(
                1
                for item in applicable
                if item.get("status") == "MET"
            )

            partial_count = sum(
                1
                for item in applicable
                if item.get("status") == "PARTIAL"
            )

            unverified_count = sum(
                1
                for item in applicable
                if item.get("status") == "UNVERIFIED"
            )

            non_exclusion_not_met = sum(
                1
                for item in applicable
                if (
                    item.get("status") == "NOT_MET"
                    and
                    not self._normalize_bool(
                        item.get(
                            "exclusion_grade",
                            False,
                        )
                    )
                )
            )

            if (
                met_count == 0
                and
                partial_count == 0
                and
                non_exclusion_not_met == 0
                and
                unverified_count > 0
            ):
                final_status = "UNKNOWN"

            elif (
                partial_count > 0
                or
                unverified_count > 0
                or
                non_exclusion_not_met > 0
            ):
                final_status = "PARTIAL"

            else:
                final_status = "PASS"

        points = 0.0

        for item in applicable:
            item_status = item.get("status")

            if item_status == "MET":
                points += 1.0

            elif item_status == "PARTIAL":
                points += 0.5

        score = round(
            (
                points
                /
                len(applicable)
            )
            *
            100.0,
            2,
        )

        # Backward compatibility: only PASS is definitively compliant.
        compliant = (
            final_status
            ==
            "PASS"
        )

        return (
            final_status,
            compliant,
            score,
        )

    def _calculate_overall_risk(
        self,
        evaluations,
        batch_risks,
    ):
        exclusion_failures = sum(
            1
            for item in evaluations
            if (
                item.get("status") == "NOT_MET"
                and
                self._normalize_bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                )
            )
        )

        non_exclusion_not_met = sum(
            1
            for item in evaluations
            if (
                item.get("status") == "NOT_MET"
                and
                not self._normalize_bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                )
            )
        )

        partial = sum(
            1
            for item in evaluations
            if item.get("status") == "PARTIAL"
        )

        unverified = sum(
            1
            for item in evaluations
            if item.get("status") == "UNVERIFIED"
        )

        highest = "Low"

        for risk in batch_risks:
            if (
                self._risk_rank(risk)
                >
                self._risk_rank(highest)
            ):
                highest = self._normalize_risk_level(
                    risk
                )

        if exclusion_failures > 0:
            return "High"

        if non_exclusion_not_met > 0:
            return (
                "High"
                if highest == "High"
                else
                "Medium"
            )

        if partial > 0 or unverified > 0:
            return (
                "High"
                if highest == "High"
                else
                "Medium"
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
        """
        The parameter name mandatory_requirements is intentionally preserved
        for backward compatibility. ProposalEvaluationService now passes the
        explicit eligibility_requirements collection into this argument.
        """

        if not isinstance(
            mandatory_requirements,
            list,
        ):
            raise ValueError(
                "Eligibility requirements must be a list."
            )

        if not isinstance(
            proposal_text,
            str,
        ):
            raise ValueError(
                "Vendor proposal text must be a string."
            )

        proposal_text = proposal_text.strip()

        if not proposal_text:
            raise ValueError(
                "Vendor proposal text cannot be empty."
            )

        if not mandatory_requirements:
            return {
                "requirementsEvaluation": [],
                "requirement_results": [],
                "breakdown": [],
                "missingRequirements": [],
                "unsupportedClaims": [],
                "complianceGaps": [],
                "deliveryRisks": [],
                "ambiguousCommitments": [],
                "riskLevel": "Low",
                "rationale": (
                    "No explicit eligibility or submission gates were found."
                ),
                "compliant": True,
                "mandatoryComplianceStatus": "PASS",
                "mandatory_compliance_status": "PASS",
                "complianceScore": 100.0,
                "confirmedExclusionFailures": [],
                "summary": {
                    "total": 0,
                    "met": 0,
                    "partial": 0,
                    "notMet": 0,
                    "unverified": 0,
                    "notApplicable": 0,
                    "confirmedExclusionFailures": 0,
                    "finalStatus": "PASS",
                    "batchCount": 0,
                },
            }

        requirements = self._normalize_requirements(
            mandatory_requirements
        )

        batches = self._build_batches(
            requirements
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
            "ELIGIBILITY COMPLIANCE EVALUATION"
        )
        print(
            "================================"
        )
        print(
            "Eligibility gates: %s"
            % len(requirements)
        )
        print(
            "Batch size: %s"
            % self.BATCH_SIZE
        )
        print(
            "Total batches: %s"
            % len(batches)
        )
        print(
            "Parallel workers: %s"
            % worker_count
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
                batch_index = future_map[
                    future
                ]

                try:
                    results_by_index[
                        batch_index
                    ] = future.result()

                except Exception as error:
                    raise RuntimeError(
                        "Compliance batch %s failed: %s"
                        % (
                            batch_index,
                            error,
                        )
                    ) from error

                print(
                    "Compliance batch %s completed."
                    % batch_index
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
            result = results_by_index[
                batch_index
            ]

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
                "Merged compliance IDs/order do not match the RFP eligibility gates."
            )

        (
            mandatory_compliance_status,
            compliant,
            score,
        ) = self._calculate_compliance(
            evaluations
        )

        risk_level = self._calculate_overall_risk(
            evaluations,
            batch_risks,
        )

        missing = [
            {
                "requirement_id": item[
                    "requirement_id"
                ],
                "requirement": item[
                    "requirement"
                ],
                "status": item[
                    "status"
                ],
                "exclusion_grade": item.get(
                    "exclusion_grade",
                    False,
                ),
                "evidence_expected": item.get(
                    "evidence_expected",
                    "",
                ),
                "gap": item.get(
                    "gap",
                    "",
                ),
            }
            for item in evaluations
            if item["status"]
            not in {
                "MET",
                "NOT_APPLICABLE",
            }
        ]

        gaps = [
            {
                "requirement_id": item[
                    "requirement_id"
                ],
                "status": item[
                    "status"
                ],
                "gap": (
                    item.get("gap")
                    or
                    item.get("reason")
                    or
                    ""
                ),
            }
            for item in evaluations
            if item["status"]
            not in {
                "MET",
                "NOT_APPLICABLE",
            }
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

        unverified_count = sum(
            1
            for item in evaluations
            if item["status"] == "UNVERIFIED"
        )

        not_applicable_count = sum(
            1
            for item in evaluations
            if item["status"] == "NOT_APPLICABLE"
        )

        confirmed_exclusion_failures = [
            item
            for item in evaluations
            if (
                item.get("status") == "NOT_MET"
                and
                self._normalize_bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                )
            )
        ]

        rationale = (
            "Eligibility compliance evaluation completed against "
            "%s gate(s). MET: %s, PARTIAL: %s, NOT_MET: %s, "
            "UNVERIFIED: %s, NOT_APPLICABLE: %s. "
            "Confirmed exclusion-grade failures: %s. "
            "Final status: %s. Evidence score: %s%%."
            % (
                len(evaluations),
                met_count,
                partial_count,
                not_met_count,
                unverified_count,
                not_applicable_count,
                len(
                    confirmed_exclusion_failures
                ),
                mandatory_compliance_status,
                score,
            )
        )

        return {
            "requirementsEvaluation": evaluations,
            "requirement_results": evaluations,
            "breakdown": evaluations,
            "missingRequirements": missing,
            "unsupportedClaims": unsupported,
            "complianceGaps": gaps,
            "deliveryRisks": risks,
            "ambiguousCommitments": ambiguous,
            "riskLevel": risk_level,
            "rationale": rationale,
            "compliant": compliant,
            "mandatoryComplianceStatus": (
                mandatory_compliance_status
            ),
            "mandatory_compliance_status": (
                mandatory_compliance_status
            ),
            "complianceScore": score,
            "confirmedExclusionFailures": [
                {
                    "requirement_id": item[
                        "requirement_id"
                    ],
                    "requirement": item[
                        "requirement"
                    ],
                    "reason": item.get(
                        "reason",
                        "",
                    ),
                    "evidence": item.get(
                        "evidence",
                        [],
                    ),
                }
                for item in confirmed_exclusion_failures
            ],
            "summary": {
                "total": len(evaluations),
                "met": met_count,
                "partial": partial_count,
                "notMet": not_met_count,
                "unverified": unverified_count,
                "notApplicable": (
                    not_applicable_count
                ),
                "confirmedExclusionFailures": (
                    len(
                        confirmed_exclusion_failures
                    )
                ),
                "finalStatus": (
                    mandatory_compliance_status
                ),
                "batchCount": len(batches),
            },
        }

    def close(self):
        pass