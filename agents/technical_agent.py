import json
import math

from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)

from services.llm_client import LLMClient
from config import (
    FAST_MODEL_NAME,
    TECHNICAL_CONTEXT_MAX_CHARS,
)

from utils.proposal_context import (
    build_relevant_context,
    requirement_query_parts,
)


class TechnicalAgent:
    """
    Evaluates the Technical Proposal criterion
    requirement-by-requirement against vendor proposal text.

    The LLM evaluates semantic evidence for each requirement.

    Python:
    - validates requirement IDs and structure
    - evaluates requirements in controlled batches
    - runs a limited number of batches concurrently
    - preserves the original RFP requirement order
    - repairs ONLY safely recoverable missing requirement IDs
    - enforces status / score consistency
    - calculates the final criterion score deterministically

    Resilience:
    - one JSON syntax repair attempt per batch
    - deterministic missing-ID repair when structurally safe
    - one full batch retry if structure is still invalid
    """

    VALID_STATUSES = {
        "FULL_MATCH",
        "PARTIAL_MATCH",
        "NO_MATCH",
        "NOT_PROVIDED",
    }

    # =====================================================
    # Performance configuration
    # =====================================================

    BATCH_SIZE = 16

    MAX_BATCH_WORKERS = 2

    def __init__(
        self,
    ):
        self.llm = (
            LLMClient(
                model=FAST_MODEL_NAME
            )
        )

    # =====================================================
    # Boolean normalization
    # =====================================================

    def _normalize_boolean(
        self,
        value,
    ):
        if isinstance(
            value,
            bool,
        ):
            return value

        if isinstance(
            value,
            str,
        ):
            normalized = (
                value
                .strip()
                .lower()
            )

            if normalized in {
                "true",
                "yes",
                "1",
            }:
                return True

            if normalized in {
                "false",
                "no",
                "0",
                "",
            }:
                return False

        if isinstance(
            value,
            (
                int,
                float,
            ),
        ):
            return bool(
                value
            )

        return False

    # =====================================================
    # JSON cleanup
    # =====================================================

    def _strip_json_wrappers(
        self,
        response_text,
    ):
        if not isinstance(
            response_text,
            str,
        ):
            raise ValueError(
                "Technical Agent response "
                "must be text."
            )

        cleaned = (
            response_text
            .strip()
        )

        if cleaned.startswith(
            "```json"
        ):
            cleaned = (
                cleaned[7:]
            )

        elif cleaned.startswith(
            "```"
        ):
            cleaned = (
                cleaned[3:]
            )

        if cleaned.endswith(
            "```"
        ):
            cleaned = (
                cleaned[:-3]
            )

        return (
            cleaned.strip()
        )

    # =====================================================
    # JSON syntax repair
    # =====================================================

    def _repair_json_response(
        self,
        invalid_response,
        llm,
    ):
        """
        Repair JSON syntax only.

        This MUST NOT change semantic evaluation content.
        """

        repair_prompt = f"""
You are a JSON syntax repair utility.

The following text was intended to be valid JSON,
but it contains JSON syntax errors.

Your task is ONLY to repair JSON syntax.

STRICT RULES:

1. Do NOT re-evaluate the proposal.
2. Do NOT change requirement IDs.
3. Do NOT change statuses.
4. Do NOT change match scores.
5. Do NOT add requirements.
6. Do NOT remove requirements.
7. Do NOT change rationale content.
8. Do NOT invent evidence.
9. Preserve factual values.
10. Fix syntax only.
11. Return ONLY valid JSON.
12. Do not use Markdown.
13. Do not use code fences.
14. Do not include explanations.

<INVALID_JSON>
{invalid_response}
</INVALID_JSON>
"""

        repaired_response = (
            llm.ask(
                repair_prompt,
                label="TechnicalJSONRepair",
            )
        )

        return (
            self._strip_json_wrappers(
                repaired_response
            )
        )

    # =====================================================
    # Parse JSON
    # =====================================================

    def _clean_json_response(
        self,
        response_text,
        llm,
    ):
        cleaned = (
            self._strip_json_wrappers(
                response_text
            )
        )

        try:

            return json.loads(
                cleaned
            )

        except json.JSONDecodeError:

            print()
            print(
                "Technical Agent batch returned "
                "invalid JSON."
            )

            print(
                "Attempting one JSON syntax repair..."
            )

            repaired = (
                self._repair_json_response(
                    cleaned,
                    llm,
                )
            )

            try:

                parsed = (
                    json.loads(
                        repaired
                    )
                )

                print(
                    "Technical Agent batch JSON "
                    "repaired successfully."
                )

                return parsed

            except json.JSONDecodeError as error:

                raise ValueError(
                    "Technical Agent returned invalid "
                    "JSON and the repaired response "
                    "remained invalid."
                    "\n\n"
                    f"Original response:\n"
                    f"{response_text}"
                    "\n\n"
                    f"Repaired response:\n"
                    f"{repaired}"
                ) from error

    # =====================================================
    # Requirements
    # =====================================================

    def _prepare_requirements(
        self,
        requirements,
    ):
        if not isinstance(
            requirements,
            list,
        ):
            raise ValueError(
                "Technical requirements must "
                "be a list."
            )

        if not requirements:
            raise ValueError(
                "Technical requirements cannot "
                "be empty."
            )

        prepared = []

        seen_ids = set()

        for (
            index,
            requirement,
        ) in enumerate(
            requirements,
            start=1,
        ):

            if not isinstance(
                requirement,
                dict,
            ):
                raise ValueError(
                    f"Technical requirement "
                    f"{index} must be an object."
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

            source = str(
                requirement.get(
                    "source",
                    "Not Provided",
                )
            ).strip()

            mandatory = (
                self._normalize_boolean(
                    requirement.get(
                        "mandatory",
                        False,
                    )
                )
            )

            if not requirement_id:
                raise ValueError(
                    f"Technical requirement "
                    f"{index} is missing an id."
                )

            if (
                requirement_id
                in seen_ids
            ):
                raise ValueError(
                    "Duplicate technical requirement "
                    f"ID: {requirement_id}"
                )

            seen_ids.add(
                requirement_id
            )

            if not requirement_text:
                raise ValueError(
                    f"Technical requirement "
                    f"{index} has empty "
                    "requirement text."
                )

            if not source:
                source = (
                    "Not Provided"
                )

            prepared.append(
                {
                    "id": (
                        requirement_id
                    ),

                    "requirement": (
                        requirement_text
                    ),

                    "source": (
                        source
                    ),

                    "mandatory": (
                        mandatory
                    ),

                    # Keep importance metadata when available.
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
                }
            )

        return prepared

    # =====================================================
    # Batch splitting
    # =====================================================

    def _split_batches(
        self,
        requirements,
    ):
        return [
            requirements[
                index:
                index + self.BATCH_SIZE
            ]

            for index
            in range(
                0,
                len(
                    requirements
                ),
                self.BATCH_SIZE,
            )
        ]

    # =====================================================
    # SAFE deterministic missing-ID repair
    # =====================================================

    def _repair_missing_requirement_ids(
        self,
        result,
        requirements,
    ):
        """
        Safely restore omitted requirement_id values.

        Repair is allowed ONLY when:

        - result is a dict
        - requirement_results is a list
        - result count exactly matches requirement count
        - every result item is a dict
        - every PRESENT requirement_id already matches the
          expected requirement at the same position
        - no duplicate present IDs exist

        If those conditions are true, blank IDs are filled
        from the frozen RFP order.

        We DO NOT repair:
        - wrong IDs
        - reordered IDs
        - missing results
        - extra results
        - duplicate IDs
        """

        if not isinstance(
            result,
            dict,
        ):
            return (
                result,
                0,
            )

        requirement_results = (
            result.get(
                "requirement_results"
            )
        )

        if not isinstance(
            requirement_results,
            list,
        ):
            return (
                result,
                0,
            )

        if (
            len(
                requirement_results
            )
            !=
            len(
                requirements
            )
        ):
            return (
                result,
                0,
            )

        expected_ids = [
            str(
                item.get(
                    "id",
                    "",
                )
            ).strip()

            for item
            in requirements
        ]

        seen_present_ids = set()

        # =================================================
        # First pass:
        # Verify every ID the LLM DID return.
        # =================================================

        for (
            index,
            item,
        ) in enumerate(
            requirement_results
        ):

            if not isinstance(
                item,
                dict,
            ):
                return (
                    result,
                    0,
                )

            received_id = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if not received_id:
                continue

            expected_id = (
                expected_ids[
                    index
                ]
            )

            if (
                received_id
                !=
                expected_id
            ):
                # There is a real mismatch or reordering.
                # Never auto-repair.
                return (
                    result,
                    0,
                )

            if (
                received_id
                in seen_present_ids
            ):
                # Duplicate IDs are unsafe.
                return (
                    result,
                    0,
                )

            seen_present_ids.add(
                received_id
            )

        # =================================================
        # Second pass:
        # Restore ONLY missing IDs.
        # =================================================

        repaired_count = 0

        for (
            index,
            item,
        ) in enumerate(
            requirement_results
        ):

            received_id = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if received_id:
                continue

            item[
                "requirement_id"
            ] = (
                expected_ids[
                    index
                ]
            )

            repaired_count += 1

        if repaired_count:

            print(
                "Technical deterministic repair: "
                f"restored {repaired_count} missing "
                "requirement_id field(s)."
            )

        return (
            result,
            repaired_count,
        )

    # =====================================================
    # Structural validation
    # =====================================================

    def _get_structure_error(
        self,
        result,
        requirements,
    ):
        if not isinstance(
            result,
            dict,
        ):
            return (
                "Technical Agent result must "
                "be an object."
            )

        requirement_results = (
            result.get(
                "requirement_results"
            )
        )

        if not isinstance(
            requirement_results,
            list,
        ):
            return (
                "Technical Agent result is missing "
                "requirement_results."
            )

        if (
            len(
                requirement_results
            )
            !=
            len(
                requirements
            )
        ):
            return (
                "Technical Agent returned the wrong "
                "number of requirement results. "
                f"Expected {len(requirements)}, "
                f"received "
                f"{len(requirement_results)}."
            )

        expected_ids = [
            item[
                "id"
            ]

            for item
            in requirements
        ]

        received_ids = []

        for (
            index,
            item,
        ) in enumerate(
            requirement_results,
            start=1,
        ):

            if not isinstance(
                item,
                dict,
            ):
                return (
                    "Technical Agent returned "
                    "a non-object result at "
                    f"position {index}."
                )

            requirement_id = str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            if not requirement_id:

                return (
                    "Technical Agent returned a "
                    "requirement result with a "
                    "missing requirement_id. "
                    f"Position {index}, expected "
                    f"{expected_ids[index - 1]}."
                )

            received_ids.append(
                requirement_id
            )

        if (
            len(
                set(
                    received_ids
                )
            )
            !=
            len(
                received_ids
            )
        ):

            return (
                "Technical Agent returned duplicate "
                "requirement IDs."
            )

        if (
            received_ids
            !=
            expected_ids
        ):

            for (
                index,
                (
                    expected_id,
                    received_id,
                ),
            ) in enumerate(
                zip(
                    expected_ids,
                    received_ids,
                ),
                start=1,
            ):

                if (
                    expected_id
                    !=
                    received_id
                ):

                    return (
                        "Technical Agent returned "
                        "unexpected requirement IDs "
                        "or order. "
                        f"Position {index}: "
                        f"expected {expected_id}, "
                        f"received {received_id}."
                    )

        return None

    # =====================================================
    # Validate one requirement
    # =====================================================

    def _validate_requirement_result(
        self,
        result,
        expected_requirement,
    ):
        if not isinstance(
            result,
            dict,
        ):
            raise ValueError(
                "Technical requirement result "
                "must be an object."
            )

        requirement_id = str(
            result.get(
                "requirement_id",
                "",
            )
        ).strip()

        if (
            requirement_id
            !=
            expected_requirement[
                "id"
            ]
        ):
            raise ValueError(
                "Unexpected requirement ID. "
                f"Expected "
                f"{expected_requirement['id']}, "
                f"received {requirement_id}."
            )

        status = str(
            result.get(
                "status",
                "",
            )
        ).strip().upper()

        if (
            status
            not in
            self.VALID_STATUSES
        ):
            raise ValueError(
                f"Invalid match status for "
                f"{requirement_id}: "
                f"{status}"
            )

        try:

            match_score = float(
                result.get(
                    "match_score",
                    0,
                )
            )

        except (
            TypeError,
            ValueError,
        ) as error:

            raise ValueError(
                f"Invalid match score for "
                f"{requirement_id}."
            ) from error

        match_score = max(
            0.0,
            min(
                100.0,
                match_score,
            ),
        )

        if (
            status
            ==
            "FULL_MATCH"
        ):

            match_score = max(
                90.0,
                match_score,
            )

        elif (
            status
            ==
            "PARTIAL_MATCH"
        ):

            match_score = max(
                1.0,
                min(
                    89.99,
                    match_score,
                ),
            )

        elif status in {
            "NO_MATCH",
            "NOT_PROVIDED",
        }:

            match_score = 0.0

        proposal_evidence = str(
            result.get(
                "proposal_evidence",
                "Not Provided",
            )
        ).strip()

        rationale = str(
            result.get(
                "rationale",
                "",
            )
        ).strip()

        if not proposal_evidence:
            proposal_evidence = (
                "Not Provided"
            )

        if (
            status
            ==
            "NOT_PROVIDED"
        ):
            proposal_evidence = (
                "Not Provided"
            )

        if not rationale:
            rationale = (
                "No evaluation rationale provided."
            )

        return {
            "requirement_id": (
                requirement_id
            ),

            "requirement": (
                expected_requirement[
                    "requirement"
                ]
            ),

            "rfp_source": (
                expected_requirement[
                    "source"
                ]
            ),

            "mandatory": (
                expected_requirement[
                    "mandatory"
                ]
            ),

            "importance_score": (
                expected_requirement.get(
                    "importance_score"
                )
            ),

            "importance_level": (
                expected_requirement.get(
                    "importance_level"
                )
            ),

            "importance_reason": (
                expected_requirement.get(
                    "importance_reason",
                    "",
                )
            ),

            "status": (
                status
            ),

            "match_score": round(
                match_score,
                2,
            ),

            "proposal_evidence": (
                proposal_evidence
            ),

            "rationale": (
                rationale
            ),
        }

    # =====================================================
    # Prompt
    # =====================================================

    def _build_batch_prompt(
        self,
        criterion,
        batch_requirements,
        proposal_text,
        batch_number,
        total_batches,
        retry_reason=None,
    ):
        requirements_json = (
            json.dumps(
                batch_requirements,
                indent=2,
                ensure_ascii=False,
            )
        )

        relevant_context = (
            build_relevant_context(
                proposal_text=(
                    proposal_text
                ),

                query_parts=[
                    criterion,

                    *requirement_query_parts(
                        batch_requirements
                    ),
                ],

                domain_hint=(
                    "technical"
                ),

                max_chars=(
                    TECHNICAL_CONTEXT_MAX_CHARS
                ),

                top_k=10,
            )
        )

        expected_ids = [
            item[
                "id"
            ]

            for item
            in batch_requirements
        ]

        retry_section = ""

        if retry_reason:

            retry_section = f"""
==================================================
RETRY
==================================================

The previous output for this SAME batch was invalid.

Failure reason:

{retry_reason}

Return exactly {len(batch_requirements)}
requirement_results.

Required IDs:

{json.dumps(expected_ids)}

Use each ID exactly once and in exactly that order.

EVERY result object MUST contain requirement_id.
"""

        return f"""
You are the Technical Evaluation Agent in an enterprise
proposal evaluation system.

You are evaluating BATCH {batch_number} OF {total_batches}
for the criterion:

{criterion}

This batch contains ONLY the requirements shown below.

==================================================
CORE RULE
==================================================

Evaluate semantic compliance, not literal keyword matching.

Equivalent wording and clear technical paraphrases count
as evidence.

Do not invent unsupported capabilities.

==================================================
STATUS
==================================================

Use exactly one:

FULL_MATCH
PARTIAL_MATCH
NO_MATCH
NOT_PROVIDED

FULL_MATCH:

Clear evidence satisfies the requirement in substance.

PARTIAL_MATCH:

Relevant evidence exists but is incomplete.

NO_MATCH:

The proposal explicitly conflicts with the requirement.

NOT_PROVIDED:

No meaningful evidence exists.

==================================================
EVIDENCE
==================================================

Search the relevant proposal context supplied below.

Consider:

- synonyms
- feature lists
- architecture statements
- integration descriptions
- security descriptions
- functional module descriptions
- tables
- implementation commitments

Do not require identical wording.

Do not require screenshots, certificates, diagrams,
references, or attachments unless the RFP requires them.

==================================================
SCORING
==================================================

FULL_MATCH:
90-100

PARTIAL_MATCH:

80-89:
Most of the requirement is demonstrated.

65-79:
Substantial evidence exists.

40-64:
Relevant but incomplete evidence.

1-39:
Weak relevant evidence.

NO_MATCH:
0

NOT_PROVIDED:
0

Do not calculate the criterion score.

Python calculates it later.

==================================================
OUTPUT RULES
==================================================

Return ONLY valid JSON.

Return exactly {len(batch_requirements)}
requirement_results.

Required IDs in exact order:

{json.dumps(expected_ids)}

CRITICAL:

Every result object MUST contain requirement_id.

Do not omit requirement_id.

Do not add requirements.

Do not remove requirements.

Do not reorder requirements.

Do not use Markdown.

{retry_section}

Use exactly:

{{
  "requirement_results": [
    {{
      "requirement_id": "REQ-0001",
      "status": "FULL_MATCH",
      "match_score": 95,
      "proposal_evidence":
        "Evidence from the vendor proposal",
      "rationale":
        "Why the evidence supports this status"
    }}
  ]
}}

==================================================
BATCH REQUIREMENTS
==================================================

{requirements_json}

==================================================
VENDOR PROPOSAL
==================================================

<PROPOSAL_DOCUMENT>
{relevant_context}
</PROPOSAL_DOCUMENT>
"""

    # =====================================================
    # Run one batch attempt
    # =====================================================

    def _run_batch_attempt(
        self,
        criterion,
        batch_requirements,
        proposal_text,
        batch_number,
        total_batches,
        llm,
        retry_reason=None,
    ):
        prompt = (
            self._build_batch_prompt(
                criterion=(
                    criterion
                ),

                batch_requirements=(
                    batch_requirements
                ),

                proposal_text=(
                    proposal_text
                ),

                batch_number=(
                    batch_number
                ),

                total_batches=(
                    total_batches
                ),

                retry_reason=(
                    retry_reason
                ),
            )
        )

        response = (
            llm.ask(
                prompt,
                label=(
                    f"TechnicalBatch"
                    f"{batch_number}"
                ),
            )
        )

        return (
            self._clean_json_response(
                response,
                llm,
            )
        )

    # =====================================================
    # Evaluate one batch
    # =====================================================

    def _evaluate_batch(
        self,
        criterion,
        batch_requirements,
        proposal_text,
        batch_number,
        total_batches,
    ):
        print()
        print(
            f"Technical batch "
            f"{batch_number}/{total_batches}"
        )

        print(
            "IDs: "
            +
            ", ".join(
                item[
                    "id"
                ]

                for item
                in batch_requirements
            )
        )

        llm = (
            LLMClient(
                model=FAST_MODEL_NAME
            )
        )

        try:

            # =================================================
            # First attempt
            # =================================================

            first_result = (
                self._run_batch_attempt(
                    criterion=(
                        criterion
                    ),

                    batch_requirements=(
                        batch_requirements
                    ),

                    proposal_text=(
                        proposal_text
                    ),

                    batch_number=(
                        batch_number
                    ),

                    total_batches=(
                        total_batches
                    ),

                    llm=(
                        llm
                    ),
                )
            )

            # =================================================
            # SAFE deterministic ID repair
            # =================================================

            (
                first_result,
                first_repaired_ids,
            ) = (
                self._repair_missing_requirement_ids(
                    first_result,
                    batch_requirements,
                )
            )

            first_error = (
                self._get_structure_error(
                    first_result,
                    batch_requirements,
                )
            )

            if not first_error:

                if first_repaired_ids:

                    print(
                        f"Technical batch "
                        f"{batch_number} completed "
                        "after deterministic ID repair."
                    )

                else:

                    print(
                        f"Technical batch "
                        f"{batch_number} completed."
                    )

                return (
                    first_result
                )

            # =================================================
            # Retry same batch only
            # =================================================

            print(
                f"Technical batch "
                f"{batch_number} returned "
                "invalid structure."
            )

            print(
                f"Reason: "
                f"{first_error}"
            )

            print(
                f"Retrying batch "
                f"{batch_number} once..."
            )

            second_result = (
                self._run_batch_attempt(
                    criterion=(
                        criterion
                    ),

                    batch_requirements=(
                        batch_requirements
                    ),

                    proposal_text=(
                        proposal_text
                    ),

                    batch_number=(
                        batch_number
                    ),

                    total_batches=(
                        total_batches
                    ),

                    llm=(
                        llm
                    ),

                    retry_reason=(
                        first_error
                    ),
                )
            )

            # =================================================
            # SAFE repair after retry
            # =================================================

            (
                second_result,
                second_repaired_ids,
            ) = (
                self._repair_missing_requirement_ids(
                    second_result,
                    batch_requirements,
                )
            )

            second_error = (
                self._get_structure_error(
                    second_result,
                    batch_requirements,
                )
            )

            if second_error:

                raise ValueError(
                    f"Technical batch "
                    f"{batch_number} returned invalid "
                    "structure after one retry."
                    "\n\n"
                    f"Batch IDs: "
                    f"{[item['id'] for item in batch_requirements]}"
                    "\n\n"
                    f"First failure:\n"
                    f"{first_error}"
                    "\n\n"
                    f"Retry failure:\n"
                    f"{second_error}"
                )

            if second_repaired_ids:

                print(
                    f"Technical batch "
                    f"{batch_number} retry completed "
                    "after deterministic ID repair."
                )

            else:

                print(
                    f"Technical batch "
                    f"{batch_number} retry completed "
                    "successfully."
                )

            return (
                second_result
            )

        finally:

            close_method = getattr(
                llm,
                "close",
                None,
            )

            if callable(
                close_method
            ):
                close_method()

    # =====================================================
    # Build final result
    # =====================================================

    def _build_final_result(
        self,
        criterion,
        requirements,
        all_batch_results,
    ):
        validated_results = []

        strengths = []

        gaps = []

        for (
            expected,
            received,
        ) in zip(
            requirements,
            all_batch_results,
        ):

            validated_results.append(
                self._validate_requirement_result(
                    received,
                    expected,
                )
            )

        # =================================================
        # Deterministic Technical score
        # =================================================

        criterion_score = (
            sum(
                item[
                    "match_score"
                ]

                for item
                in validated_results
            )
            /
            len(
                validated_results
            )
        )

        criterion_score = round(
            criterion_score,
            2,
        )

        # =================================================
        # Mandatory compliance
        # =================================================

        mandatory_results = [
            item

            for item
            in validated_results

            if item[
                "mandatory"
            ]
        ]

        if mandatory_results:

            mandatory_met = sum(
                1

                for item
                in mandatory_results

                if item[
                    "status"
                ]
                ==
                "FULL_MATCH"
            )

            mandatory_compliance = (
                mandatory_met
                /
                len(
                    mandatory_results
                )
            ) * 100

        else:

            mandatory_compliance = (
                100.0
            )

        # =================================================
        # Summary counts
        # =================================================

        full_match_count = sum(
            1

            for item
            in validated_results

            if item[
                "status"
            ]
            ==
            "FULL_MATCH"
        )

        partial_match_count = sum(
            1

            for item
            in validated_results

            if item[
                "status"
            ]
            ==
            "PARTIAL_MATCH"
        )

        no_match_count = sum(
            1

            for item
            in validated_results

            if item[
                "status"
            ]
            ==
            "NO_MATCH"
        )

        not_provided_count = sum(
            1

            for item
            in validated_results

            if item[
                "status"
            ]
            ==
            "NOT_PROVIDED"
        )

        # =================================================
        # Strengths
        # =================================================

        strongest = sorted(
            validated_results,

            key=lambda item: (
                item[
                    "match_score"
                ]
            ),

            reverse=True,
        )[:5]

        for item in strongest:

            if (
                item[
                    "match_score"
                ]
                >
                0
            ):

                strengths.append(
                    f"{item['requirement']}: "
                    f"{item['status']} "
                    f"({item['match_score']})"
                )

        # =================================================
        # Gaps
        # =================================================

        weakest = sorted(
            validated_results,

            key=lambda item: (
                item[
                    "match_score"
                ]
            ),
        )[:5]

        for item in weakest:

            if (
                item[
                    "status"
                ]
                !=
                "FULL_MATCH"
            ):

                gaps.append(
                    f"{item['requirement']}: "
                    f"{item['status']}"
                )

        rationale = (
            "Technical evaluation completed across "
            f"{len(validated_results)} requirements. "
            f"{full_match_count} full matches, "
            f"{partial_match_count} partial matches, "
            f"{no_match_count} explicit no-matches, "
            f"and {not_provided_count} not provided."
        )

        return {
            "criterion": (
                criterion
            ),

            "score": (
                criterion_score
            ),

            "mandatory_compliance_percentage": (
                round(
                    mandatory_compliance,
                    2,
                )
            ),

            "requirement_results": (
                validated_results
            ),

            "summary": {
                "requirements_evaluated": (
                    len(
                        validated_results
                    )
                ),

                "full_matches": (
                    full_match_count
                ),

                "partial_matches": (
                    partial_match_count
                ),

                "no_matches": (
                    no_match_count
                ),

                "not_provided": (
                    not_provided_count
                ),

                "batch_size": (
                    self.BATCH_SIZE
                ),

                "batches_processed": (
                    math.ceil(
                        len(
                            validated_results
                        )
                        /
                        self.BATCH_SIZE
                    )
                ),

                "batch_workers": (
                    self.MAX_BATCH_WORKERS
                ),
            },

            "strengths": (
                strengths
            ),

            "gaps": (
                gaps
            ),

            "rationale": (
                rationale
            ),
        }

    # =====================================================
    # Main evaluation
    # =====================================================

    def evaluate(
        self,
        criterion,
        requirements,
        proposal_text,
    ):
        if not isinstance(
            criterion,
            str,
        ):
            raise ValueError(
                "Criterion must be a string."
            )

        criterion = (
            criterion.strip()
        )

        if not criterion:

            raise ValueError(
                "Criterion cannot be empty."
            )

        if not isinstance(
            proposal_text,
            str,
        ):

            raise ValueError(
                "Vendor proposal text must "
                "be a string."
            )

        proposal_text = (
            proposal_text.strip()
        )

        if not proposal_text:

            raise ValueError(
                "Vendor proposal text cannot "
                "be empty."
            )

        prepared_requirements = (
            self._prepare_requirements(
                requirements
            )
        )

        batches = (
            self._split_batches(
                prepared_requirements
            )
        )

        total_batches = (
            len(
                batches
            )
        )

        print()
        print(
            "================================"
        )

        print(
            "TECHNICAL PARALLEL BATCHED "
            "EVALUATION"
        )

        print(
            "================================"
        )

        print(
            f"Technical requirements: "
            f"{len(prepared_requirements)}"
        )

        print(
            f"Batch size: "
            f"{self.BATCH_SIZE}"
        )

        print(
            f"Total batches: "
            f"{total_batches}"
        )

        worker_count = min(
            self.MAX_BATCH_WORKERS,
            total_batches,
        )

        print(
            f"Parallel batch workers: "
            f"{worker_count}"
        )

        # =================================================
        # Run batches concurrently
        # =================================================

        batch_results_by_index = {}

        with ThreadPoolExecutor(
            max_workers=(
                worker_count
            )
        ) as executor:

            future_map = {}

            for (
                batch_index,
                batch,
            ) in enumerate(
                batches,
                start=1,
            ):

                future = (
                    executor.submit(
                        self._evaluate_batch,
                        criterion,
                        batch,
                        proposal_text,
                        batch_index,
                        total_batches,
                    )
                )

                future_map[
                    future
                ] = (
                    batch_index
                )

            for future in as_completed(
                future_map
            ):

                batch_index = (
                    future_map[
                        future
                    ]
                )

                try:

                    batch_result = (
                        future.result()
                    )

                except Exception as error:

                    raise RuntimeError(
                        f"Technical batch "
                        f"{batch_index}/"
                        f"{total_batches} "
                        f"failed: {error}"
                    ) from error

                batch_results_by_index[
                    batch_index
                ] = (
                    batch_result
                )

        # =================================================
        # Restore original batch order
        # =================================================

        all_results = []

        for batch_index in range(
            1,
            total_batches + 1,
        ):

            if (
                batch_index
                not in
                batch_results_by_index
            ):

                raise RuntimeError(
                    f"Missing Technical batch "
                    f"{batch_index} result."
                )

            batch_result = (
                batch_results_by_index[
                    batch_index
                ]
            )

            batch_requirement_results = (
                batch_result.get(
                    "requirement_results",
                    [],
                )
            )

            all_results.extend(
                batch_requirement_results
            )

        # =================================================
        # Global count integrity
        # =================================================

        if (
            len(
                all_results
            )
            !=
            len(
                prepared_requirements
            )
        ):

            raise ValueError(
                "Technical batched evaluation "
                "produced an incorrect total "
                "number of results. "
                f"Expected "
                f"{len(prepared_requirements)}, "
                f"received "
                f"{len(all_results)}."
            )

        # =================================================
        # Global ID integrity
        # =================================================

        expected_ids = [
            item[
                "id"
            ]

            for item
            in prepared_requirements
        ]

        received_ids = [
            str(
                item.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            for item
            in all_results
        ]

        if (
            received_ids
            !=
            expected_ids
        ):

            raise ValueError(
                "Technical batched evaluation "
                "produced incorrect global "
                "requirement order."
                "\n"
                f"Expected: "
                f"{expected_ids}"
                "\n"
                f"Received: "
                f"{received_ids}"
            )

        # =================================================
        # Final deterministic result
        # =================================================

        return (
            self._build_final_result(
                criterion=(
                    criterion
                ),

                requirements=(
                    prepared_requirements
                ),

                all_batch_results=(
                    all_results
                ),
            )
        )

    # =====================================================
    # Cleanup
    # =====================================================

    def close(
        self,
    ):
        self.llm.close()