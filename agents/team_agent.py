import json

from services.llm_client import LLMClient
from config import FAST_MODEL_NAME, PROPOSAL_CONTEXT_MAX_CHARS
from utils.proposal_context import (
    build_relevant_context,
    requirement_query_parts,
)


class TeamAgent:
    VALID_STATUSES = {
        "FULL_MATCH",
        "PARTIAL_MATCH",
        "NO_MATCH",
        "NOT_PROVIDED",
    }

    VALID_CONFIDENCE_LEVELS = {
        "High",
        "Medium",
        "Low",
    }

    MAX_RETRIES = 1

    def __init__(self):
        self.llm = LLMClient(
            model=FAST_MODEL_NAME
        )

    # =====================================================
    # JSON
    # =====================================================

    def _extract_first_json_object(
        self,
        text,
    ):
        if not isinstance(
            text,
            str,
        ):
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

    def _clean_json_response(
        self,
        response_text,
    ):
        if not isinstance(
            response_text,
            str,
        ):
            raise ValueError(
                "Team Agent response must be text."
            )

        text = response_text.strip()

        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

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
                "Team Agent returned invalid JSON."
            )

    # =====================================================
    # Helpers
    # =====================================================

    def _normalize_boolean(
        self,
        value,
    ):
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            return (
                value.strip().lower()
                in {"true", "yes", "1"}
            )

        if isinstance(
            value,
            (int, float),
        ):
            return bool(value)

        return False

    def _normalize_list(
        self,
        value,
    ):
        if value is None:
            return []

        if not isinstance(value, list):
            value = [value]

        return [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]

    def _normalize_confidence(
        self,
        value,
    ):
        confidence = str(
            value or "Medium"
        ).strip().title()

        if (
            confidence
            not in
            self.VALID_CONFIDENCE_LEVELS
        ):
            return "Medium"

        return confidence

    def _prepare_requirements(
        self,
        requirements,
    ):
        if not isinstance(
            requirements,
            list,
        ):
            raise ValueError(
                "Team requirements must be a list."
            )

        if not requirements:
            return []

        prepared = []
        seen = set()

        for index, requirement in enumerate(
            requirements,
            start=1,
        ):
            if not isinstance(
                requirement,
                dict,
            ):
                raise ValueError(
                    f"Team requirement {index} "
                    "must be an object."
                )

            requirement_id = str(
                requirement.get(
                    "id",
                    "",
                )
            ).strip()

            requirement_text = str(
                requirement.get(
                    "requirement",
                    "",
                )
            ).strip()

            if not requirement_id:
                raise ValueError(
                    f"Team requirement {index} "
                    "is missing id."
                )

            if requirement_id in seen:
                raise ValueError(
                    "Duplicate Team requirement ID: "
                    f"{requirement_id}"
                )

            if not requirement_text:
                raise ValueError(
                    f"Team requirement {requirement_id} "
                    "has empty text."
                )

            seen.add(requirement_id)

            prepared.append(
                {
                    "id": requirement_id,
                    "requirement": requirement_text,
                    "source": str(
                        requirement.get(
                            "source",
                            "Not Provided",
                        )
                    ).strip()
                    or
                    "Not Provided",
                    "mandatory": (
                        self._normalize_boolean(
                            requirement.get(
                                "mandatory",
                                False,
                            )
                        )
                    ),
                    "importance_score": (
                        requirement.get(
                            "importance_score"
                        )
                    ),
                    "importance_level": (
                        requirement.get(
                            "importance_level"
                        )
                    ),
                    "importance_reason": (
                        requirement.get(
                            "importance_reason",
                            "",
                        )
                    ),
                    "requirement_type": (
                        str(
                            requirement.get(
                                "requirement_type",
                                "",
                            )
                        ).strip()
                    ),
                    "evidence_expected": (
                        str(
                            requirement.get(
                                "evidence_expected",
                                "",
                            )
                        ).strip()
                    ),
                }
            )

        return prepared

    # =====================================================
    # Safe missing-ID repair
    # =====================================================

    def _repair_missing_requirement_ids(
        self,
        result,
        requirements,
    ):
        if not isinstance(result, dict):
            return result, 0

        items = result.get(
            "requirement_results"
        )

        if (
            not isinstance(items, list)
            or
            len(items) != len(requirements)
        ):
            return result, 0

        expected_ids = [
            item["id"]
            for item in requirements
        ]

        seen = set()

        for index, item in enumerate(items):
            if not isinstance(item, dict):
                return result, 0

            received = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if not received:
                continue

            if received != expected_ids[index]:
                return result, 0

            if received in seen:
                return result, 0

            seen.add(received)

        repaired = 0

        for index, item in enumerate(items):
            received = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if received:
                continue

            item["requirement_id"] = (
                expected_ids[index]
            )

            repaired += 1

        if repaired:
            print(
                "Team Agent deterministic repair: "
                f"restored {repaired} missing "
                "requirement_id field(s)."
            )

        return result, repaired

    def _get_structure_error(
        self,
        result,
        requirements,
    ):
        if not isinstance(result, dict):
            return "Result must be an object."

        items = result.get(
            "requirement_results"
        )

        if not isinstance(items, list):
            return (
                "Team Agent result is missing "
                "requirement_results."
            )

        if len(items) != len(requirements):
            return (
                "Wrong requirement result count. "
                f"Expected {len(requirements)}, "
                f"received {len(items)}."
            )

        expected_ids = [
            item["id"]
            for item in requirements
        ]

        received_ids = []

        for index, item in enumerate(items):
            if not isinstance(item, dict):
                return (
                    f"Result {index + 1} "
                    "must be an object."
                )

            requirement_id = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if not requirement_id:
                return (
                    "Missing requirement_id at "
                    f"position {index + 1}. "
                    f"Expected {expected_ids[index]}."
                )

            received_ids.append(
                requirement_id
            )

        if received_ids != expected_ids:
            return (
                "Requirement IDs/order do not "
                "match the RFP requirements."
            )

        return None

    # =====================================================
    # Requirement-level
    # =====================================================

    def _build_requirement_prompt(
        self,
        requirements,
        proposal_text,
        vendor_name,
        criterion,
        criterion_description,
        retry_reason=None,
    ):
        requirements_json = json.dumps(
            requirements,
            ensure_ascii=False,
        )

        relevant_context = (
            build_relevant_context(
                proposal_text=proposal_text,
                query_parts=[
                    criterion,
                    criterion_description,
                    *requirement_query_parts(
                        requirements
                    ),
                ],
                domain_hint="team",
                max_chars=(
                    PROPOSAL_CONTEXT_MAX_CHARS
                ),
                top_k=8,
            )
        )

        expected_ids = [
            item["id"]
            for item in requirements
        ]

        retry = ""

        if retry_reason:
            retry = f"""
RETRY:
The previous response was invalid:
{retry_reason}

Return exactly one result for each ID:
{json.dumps(expected_ids, ensure_ascii=False)}
"""

        return f"""
You are a Team and Personnel Qualifications evaluator.

Vendor:
{vendor_name}

Criterion:
{criterion}

Description:
{criterion_description or "Not Provided"}

Use ONLY evidence from the vendor proposal.
Do not invent people, qualifications, CVs,
certifications, years, roles, or staffing facts.

Evaluate EVERY supplied requirement.

==================================================
MANDATORY VS PREFERRED WORDING
==================================================

Distinguish carefully between binding obligations and
stated preferences, using the RFP's own wording:

BINDING (obligation):
يجب / يلتزم / إلزامي / لا يحق / shall / must / required
Examples of typically binding team obligations: naming a
dedicated project manager, giving that manager decision
authority, minimum years of experience on similar
projects, providing CVs with qualifications and
certifications, having team members capable in the
required working languages, obtaining approval before
replacing key staff, and providing a competent
replacement during absences.

PREFERENCE (desirable, NOT binding):
يفضل / تفضيلي / يستحسن / preferred / desirable / nice to
have. A common example is a preferred nationality for the
project manager.

Rules:
1. NEVER fail, NO_MATCH, or zero a vendor solely because
   a PREFERENCE is unmet. Record it as a gap and let it
   reduce the score modestly, nothing more.
2. Each requirement carries a requirement_type field.
   When it marks the item as preferred, treat it as a
   preference regardless of how strongly it is phrased.
3. Judge binding requirements strictly on evidence: an
   unnamed role, a missing CV, or an unstated experience
   duration is missing evidence, not an assumed pass.
4. Also consider, when the RFP asks for them: clarity of
   roles and responsibilities, availability/allocation of
   named staff, and replacement / continuity
   arrangements.

Statuses:
FULL_MATCH
PARTIAL_MATCH
NO_MATCH
NOT_PROVIDED

Scores:
FULL_MATCH = 90-100
PARTIAL_MATCH = 1-89.99
NO_MATCH = 0
NOT_PROVIDED = 0

Return ONLY valid JSON.

Return exactly {len(requirements)} requirement_results.

Required IDs in this exact order:
{json.dumps(expected_ids, ensure_ascii=False)}

Every result MUST contain requirement_id.
Never leave requirement_id blank.
Do not invent, omit, duplicate or reorder IDs.

{retry}

{{
  "vendor": "{vendor_name}",
  "criterion": "{criterion}",
  "requirement_results": [
    {{
      "requirement_id": "REQ-0001",
      "status": "FULL_MATCH",
      "match_score": 95,
      "proposal_evidence": "Specific proposal evidence",
      "rationale": "Short factual reason"
    }}
  ],
  "strengths": [],
  "gaps": [],
  "rationale": "",
  "confidence": "Medium"
}}

RFP REQUIREMENTS:
{requirements_json}

RELEVANT PROPOSAL:
<PROPOSAL_DOCUMENT>
{relevant_context}
</PROPOSAL_DOCUMENT>
"""

    def _evaluate_with_requirements(
        self,
        prepared_requirements,
        proposal_text,
        vendor_name,
        criterion,
        criterion_description,
    ):
        retry_reason = None
        last_error = None

        for attempt in range(
            1,
            self.MAX_RETRIES + 2,
        ):
            prompt = (
                self._build_requirement_prompt(
                    requirements=(
                        prepared_requirements
                    ),
                    proposal_text=proposal_text,
                    vendor_name=vendor_name,
                    criterion=criterion,
                    criterion_description=(
                        criterion_description
                    ),
                    retry_reason=retry_reason,
                )
            )

            try:
                response = self.llm.ask(
                    prompt,
                    label="TeamAgent",
                )

                result = (
                    self._clean_json_response(
                        response
                    )
                )

                (
                    result,
                    repaired_ids,
                ) = (
                    self._repair_missing_requirement_ids(
                        result,
                        prepared_requirements,
                    )
                )

                structure_error = (
                    self._get_structure_error(
                        result,
                        prepared_requirements,
                    )
                )

                if not structure_error:
                    return result

                last_error = structure_error

            except Exception as error:
                last_error = str(error)

            if (
                attempt
                >=
                self.MAX_RETRIES + 1
            ):
                break

            retry_reason = last_error

            print(
                "Retrying Team Agent once: "
                f"{last_error}"
            )

        raise RuntimeError(
            "Team Agent failed after retry. "
            f"{last_error}"
        )

    def _validate_requirement_result(
        self,
        result,
        expected,
    ):
        requirement_id = str(
            result.get(
                "requirement_id",
                "",
            )
        ).strip()

        if requirement_id != expected["id"]:
            raise ValueError(
                "Team Agent returned an unexpected "
                "requirement ID.\n"
                f"Expected: {expected['id']}\n"
                f"Received: {requirement_id}"
            )

        status = str(
            result.get(
                "status",
                "",
            )
        ).strip().upper()

        if status not in self.VALID_STATUSES:
            raise ValueError(
                f"Invalid status for "
                f"{requirement_id}: {status}"
            )

        try:
            score = float(
                result.get(
                    "match_score",
                    0,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            score = 0.0

        score = max(
            0.0,
            min(100.0, score),
        )

        if status == "FULL_MATCH":
            score = max(90.0, score)

        elif status == "PARTIAL_MATCH":
            score = max(
                1.0,
                min(89.99, score),
            )

        else:
            score = 0.0

        evidence = str(
            result.get(
                "proposal_evidence",
                "",
            )
        ).strip()

        if (
            not evidence
            or
            status == "NOT_PROVIDED"
        ):
            evidence = "Not Provided"

        rationale = str(
            result.get(
                "rationale",
                "",
            )
        ).strip()

        if not rationale:
            rationale = (
                "No evaluation rationale provided."
            )

        return {
            "requirement_id": requirement_id,
            "requirement": expected[
                "requirement"
            ],
            "rfp_source": expected[
                "source"
            ],
            "mandatory": expected[
                "mandatory"
            ],
            "importance_score": (
                expected.get(
                    "importance_score"
                )
            ),
            "importance_level": (
                expected.get(
                    "importance_level"
                )
            ),
            "importance_reason": (
                expected.get(
                    "importance_reason",
                    "",
                )
            ),
            "status": status,
            "match_score": round(
                score,
                2,
            ),
            "proposal_evidence": evidence,
            "rationale": rationale,
        }

    def _validate_requirement_level_result(
        self,
        result,
        vendor_name,
        criterion,
        criterion_description,
        requirements,
    ):
        items = result[
            "requirement_results"
        ]

        validated = [
            self._validate_requirement_result(
                received,
                expected,
            )
            for expected, received
            in zip(
                requirements,
                items,
            )
        ]

        score = round(
            sum(
                item["match_score"]
                for item in validated
            )
            /
            len(validated),
            2,
        )

        mandatory = [
            item
            for item in validated
            if item["mandatory"]
        ]

        if mandatory:
            mandatory_percentage = round(
                (
                    sum(
                        1
                        for item in mandatory
                        if (
                            item["status"]
                            ==
                            "FULL_MATCH"
                        )
                    )
                    /
                    len(mandatory)
                )
                *
                100,
                2,
            )
        else:
            mandatory_percentage = 100.0

        return {
            "vendor": vendor_name,
            "criterion": criterion,
            "criterion_description": (
                criterion_description
            ),
            "score": score,
            "mandatory_compliance_percentage": (
                mandatory_percentage
            ),
            "requirement_results": validated,
            "summary": {
                "evaluation_mode": (
                    "requirement_level"
                ),
                "requirements_evaluated": (
                    len(validated)
                ),
                "full_matches": sum(
                    1
                    for item in validated
                    if (
                        item["status"]
                        ==
                        "FULL_MATCH"
                    )
                ),
                "partial_matches": sum(
                    1
                    for item in validated
                    if (
                        item["status"]
                        ==
                        "PARTIAL_MATCH"
                    )
                ),
                "no_matches": sum(
                    1
                    for item in validated
                    if (
                        item["status"]
                        ==
                        "NO_MATCH"
                    )
                ),
                "not_provided": sum(
                    1
                    for item in validated
                    if (
                        item["status"]
                        ==
                        "NOT_PROVIDED"
                    )
                ),
            },
            "strengths": self._normalize_list(
                result.get(
                    "strengths",
                    [],
                )
            ),
            "gaps": self._normalize_list(
                result.get(
                    "gaps",
                    [],
                )
            ),
            "rationale": str(
                result.get(
                    "rationale",
                    "",
                )
            ).strip(),
            "confidence": (
                self._normalize_confidence(
                    result.get(
                        "confidence",
                        "Medium",
                    )
                )
            ),
        }

    # =====================================================
    # Criterion-level
    # =====================================================

    def _evaluate_without_requirements(
        self,
        proposal_text,
        vendor_name,
        criterion,
        criterion_description,
    ):
        relevant_context = (
            build_relevant_context(
                proposal_text=proposal_text,
                query_parts=[
                    criterion,
                    criterion_description,
                ],
                domain_hint="team",
                max_chars=(
                    PROPOSAL_CONTEXT_MAX_CHARS
                ),
                top_k=8,
            )
        )

        prompt = f"""
You are a Team and Personnel Qualifications evaluator.

The RFP defines a team criterion without detailed
sub-requirements.

Do not invent additional requirements.

Vendor:
{vendor_name}

Criterion:
{criterion}

Description:
{criterion_description or "Not Provided"}

Evaluate only evidence actually present.

Return ONLY valid JSON:

{{
  "vendor": "{vendor_name}",
  "criterion": "{criterion}",
  "criterion_score": 82,
  "evidence_summary": "",
  "strengths": [],
  "gaps": [],
  "rationale": "",
  "confidence": "Medium"
}}

PROPOSAL:
<PROPOSAL_DOCUMENT>
{relevant_context}
</PROPOSAL_DOCUMENT>
"""

        response = self.llm.ask(
            prompt,
            label="TeamAgent",
        )

        return (
            self._clean_json_response(
                response
            )
        )

    def _validate_criterion_level_result(
        self,
        result,
        vendor_name,
        criterion,
        criterion_description,
    ):
        try:
            score = float(
                result.get(
                    "criterion_score",
                    0,
                )
            )
        except (
            TypeError,
            ValueError,
        ):
            score = 0.0

        score = round(
            max(
                0.0,
                min(100.0, score),
            ),
            2,
        )

        return {
            "vendor": vendor_name,
            "criterion": criterion,
            "criterion_description": (
                criterion_description
            ),
            "score": score,
            "mandatory_compliance_percentage": (
                100.0
            ),
            "requirement_results": [],
            "summary": {
                "evaluation_mode": (
                    "criterion_level"
                ),
                "requirements_evaluated": 0,
                "full_matches": 0,
                "partial_matches": 0,
                "no_matches": 0,
                "not_provided": 0,
                "evidence_summary": str(
                    result.get(
                        "evidence_summary",
                        "Not Provided",
                    )
                ).strip(),
            },
            "strengths": self._normalize_list(
                result.get(
                    "strengths",
                    [],
                )
            ),
            "gaps": self._normalize_list(
                result.get(
                    "gaps",
                    [],
                )
            ),
            "rationale": str(
                result.get(
                    "rationale",
                    "",
                )
            ).strip(),
            "confidence": (
                self._normalize_confidence(
                    result.get(
                        "confidence",
                        "Medium",
                    )
                )
            ),
        }

    # =====================================================
    # Main
    # =====================================================

    def evaluate(
        self,
        requirements,
        proposal_text,
        vendor_name="Vendor",
        criterion="Team Qualifications",
        criterion_description="",
    ):
        if not isinstance(
            proposal_text,
            str,
        ):
            raise ValueError(
                "Vendor proposal text "
                "must be a string."
            )

        proposal_text = (
            proposal_text.strip()
        )

        if not proposal_text:
            raise ValueError(
                "Vendor proposal text "
                "cannot be empty."
            )

        criterion = str(
            criterion
        ).strip()

        if not criterion:
            raise ValueError(
                "Criterion name cannot be empty."
            )

        vendor_name = str(
            vendor_name
        ).strip() or "Vendor"

        criterion_description = str(
            criterion_description
        ).strip()

        prepared = (
            self._prepare_requirements(
                requirements
            )
        )

        if prepared:
            result = (
                self._evaluate_with_requirements(
                    prepared_requirements=(
                        prepared
                    ),
                    proposal_text=proposal_text,
                    vendor_name=vendor_name,
                    criterion=criterion,
                    criterion_description=(
                        criterion_description
                    ),
                )
            )

            return (
                self._validate_requirement_level_result(
                    result=result,
                    vendor_name=vendor_name,
                    criterion=criterion,
                    criterion_description=(
                        criterion_description
                    ),
                    requirements=prepared,
                )
            )

        result = (
            self._evaluate_without_requirements(
                proposal_text=proposal_text,
                vendor_name=vendor_name,
                criterion=criterion,
                criterion_description=(
                    criterion_description
                ),
            )
        )

        return (
            self._validate_criterion_level_result(
                result=result,
                vendor_name=vendor_name,
                criterion=criterion,
                criterion_description=(
                    criterion_description
                ),
            )
        )

    def close(self):
        self.llm.close()
