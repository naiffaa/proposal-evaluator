import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.llm_client import LLMClient


class ProjectPlanAgent:
    """
    Specialized project-plan evaluator.

    Evaluates project-plan requirements at requirement level in
    controlled batches, then calculates the criterion score
    deterministically in Python.

    This avoids asking the LLM for one large aggregate score and
    makes the result consistent with the other requirement-level
    evaluators.
    """

    BATCH_SIZE = 16
    MAX_WORKERS = 2
    MAX_RETRIES = 2

    # Keep each LLM request bounded. Large full proposals can cause
    # truncated / malformed JSON responses even when the RFP batch is small.
    MAX_PROPOSAL_CONTEXT_CHARS = 24000
    RETRY_CONTEXT_CHARS = 14000
    MAX_PARAGRAPH_CHARS = 1800

    VALID_STATUSES = {
        "FULL_MATCH",
        "PARTIAL_MATCH",
        "NO_MATCH",
        "NOT_PROVIDED",
    }

    STATUS_SCORES = {
        "FULL_MATCH": 100.0,
        "PARTIAL_MATCH": 60.0,
        "NO_MATCH": 20.0,
        "NOT_PROVIDED": 0.0,
    }

    def __init__(self):
        self.llm = LLMClient()

    # =====================================================
    # JSON HELPERS
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
        context_label,
    ):
        if not isinstance(result, str):
            raise ValueError(
                "%s response must be text."
                % context_label
            )

        text = result.strip()

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
                "%s returned invalid JSON."
                % context_label
            )

    # =====================================================
    # REQUIREMENT HELPERS
    # =====================================================

    def _normalize_requirement(
        self,
        requirement,
        index,
    ):
        if not isinstance(
            requirement,
            dict,
        ):
            requirement = {
                "requirement": str(
                    requirement
                ),
            }

        requirement_id = str(
            requirement.get(
                "id",
                requirement.get(
                    "requirement_id",
                    "REQ-%04d"
                    % (
                        index + 1
                    ),
                ),
            )
        ).strip()

        requirement_text = str(
            requirement.get(
                "requirement",
                requirement.get(
                    "text",
                    "",
                ),
            )
        ).strip()

        return {
            "id": requirement_id,
            "requirement": (
                requirement_text
            ),
            "source": str(
                requirement.get(
                    "source",
                    "",
                )
            ).strip(),
            "mandatory": bool(
                requirement.get(
                    "mandatory",
                    False,
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
            "importance_reason": str(
                requirement.get(
                    "importance_reason",
                    "",
                )
            ).strip(),
        }

    def _build_batches(
        self,
        requirements,
    ):
        return [
            requirements[
                index:
                index
                +
                self.BATCH_SIZE
            ]
            for index in range(
                0,
                len(requirements),
                self.BATCH_SIZE,
            )
        ]

    # =====================================================
    # PROPOSAL CONTEXT SELECTION
    # =====================================================

    def _normalize_search_text(
        self,
        value,
    ):
        return re.sub(
            r"\s+",
            " ",
            str(
                value
                or
                ""
            ),
        ).strip().lower()

    def _tokenize_for_relevance(
        self,
        value,
    ):
        text = self._normalize_search_text(
            value
        )

        tokens = re.findall(
            r"[A-Za-z0-9_\-\u0600-\u06FF]+",
            text,
        )

        stopwords = {
            "the",
            "and",
            "for",
            "with",
            "from",
            "that",
            "this",
            "shall",
            "must",
            "required",
            "يجب",
            "على",
            "في",
            "من",
            "إلى",
            "الى",
            "عن",
            "مع",
            "أن",
            "ان",
            "المشروع",
            "مقدم",
            "العرض",
            "الخدمة",
        }

        return {
            token
            for token
            in tokens
            if (
                len(token) >= 3
                and
                token not in stopwords
            )
        }

    def _split_proposal_paragraphs(
        self,
        proposal_text,
    ):
        raw_parts = re.split(
            r"\n\s*\n|\n(?=[^\n]{0,120}$)",
            str(
                proposal_text
                or
                ""
            ),
        )

        paragraphs = []

        for raw in raw_parts:
            cleaned = re.sub(
                r"\s+",
                " ",
                raw,
            ).strip()

            if not cleaned:
                continue

            if (
                len(cleaned)
                >
                self.MAX_PARAGRAPH_CHARS
            ):
                # Split long extracted PDF blocks into bounded pieces.
                for start in range(
                    0,
                    len(cleaned),
                    self.MAX_PARAGRAPH_CHARS,
                ):
                    piece = cleaned[
                        start:
                        start
                        +
                        self.MAX_PARAGRAPH_CHARS
                    ].strip()

                    if piece:
                        paragraphs.append(
                            piece
                        )
            else:
                paragraphs.append(
                    cleaned
                )

        return paragraphs

    def _select_relevant_proposal_context(
        self,
        proposal_text,
        batch,
        max_chars,
    ):
        """
        Select proposal paragraphs most relevant to this requirement batch.

        This prevents sending the entire proposal to every ProjectPlanAgent
        batch, which was causing oversized prompts and malformed/truncated JSON.
        """

        proposal_text = str(
            proposal_text
            or
            ""
        )

        if len(
            proposal_text
        ) <= max_chars:
            return proposal_text

        requirement_text = " ".join(
            str(
                item.get(
                    "requirement",
                    ""
                )
            )
            for item
            in batch
        )

        requirement_tokens = (
            self._tokenize_for_relevance(
                requirement_text
            )
        )

        # Project-plan vocabulary is intentionally bilingual because
        # proposals and RFPs may mix Arabic and English.
        domain_tokens = {
            "implementation",
            "methodology",
            "timeline",
            "schedule",
            "milestone",
            "milestones",
            "deliverable",
            "deliverables",
            "governance",
            "project",
            "manager",
            "management",
            "resource",
            "resources",
            "team",
            "risk",
            "risks",
            "issue",
            "issues",
            "reporting",
            "communication",
            "training",
            "handover",
            "transition",
            "deployment",
            "rollout",
            "acceptance",
            "agile",
            "pmp",
            "تنفيذ",
            "التنفيذ",
            "منهجية",
            "منهجيه",
            "خطة",
            "الخطه",
            "الجدول",
            "الزمني",
            "جدول",
            "زمني",
            "مراحل",
            "مرحلة",
            "معالم",
            "مخرجات",
            "حوكمة",
            "إدارة",
            "ادارة",
            "مدير",
            "فريق",
            "موارد",
            "مخاطر",
            "تقارير",
            "تواصل",
            "تدريب",
            "تسليم",
            "استلام",
            "انتقال",
            "إطلاق",
            "اطلاق",
        }

        query_tokens = (
            requirement_tokens
            |
            domain_tokens
        )

        paragraphs = (
            self._split_proposal_paragraphs(
                proposal_text
            )
        )

        scored = []

        for index, paragraph in enumerate(
            paragraphs
        ):
            paragraph_tokens = (
                self._tokenize_for_relevance(
                    paragraph
                )
            )

            overlap = len(
                paragraph_tokens
                &
                query_tokens
            )

            requirement_overlap = len(
                paragraph_tokens
                &
                requirement_tokens
            )

            score = (
                overlap
                +
                (
                    requirement_overlap
                    *
                    3
                )
            )

            if score > 0:
                scored.append(
                    (
                        score,
                        index,
                        paragraph,
                    )
                )

        # If relevance search finds very little, include proposal start/end
        # as a safe fallback because executive summaries and appendices often
        # contain methodology/team information.
        if not scored:
            return (
                proposal_text[
                    :max_chars
                ]
            )

        scored.sort(
            key=lambda item: (
                -item[0],
                item[1],
            )
        )

        selected = []
        selected_chars = 0

        for score, index, paragraph in scored:
            addition = (
                len(paragraph)
                +
                2
            )

            if (
                selected
                and
                selected_chars
                +
                addition
                >
                max_chars
            ):
                continue

            selected.append(
                (
                    index,
                    paragraph,
                )
            )

            selected_chars += addition

            if selected_chars >= max_chars:
                break

        # Restore source order so the LLM sees coherent proposal flow.
        selected.sort(
            key=lambda item: (
                item[0]
            )
        )

        context = "\n\n".join(
            paragraph
            for _, paragraph
            in selected
        )

        if not context:
            context = (
                proposal_text[
                    :max_chars
                ]
            )

        return context[
            :max_chars
        ]

    # =====================================================
    # PROMPT
    # =====================================================

    def _build_batch_prompt(
        self,
        batch,
        proposal_context,
        batch_number,
        total_batches,
        retry_reason=None,
    ):
        requirement_payload = [
            {
                "requirement_id": (
                    item["id"]
                ),
                "requirement": (
                    item["requirement"]
                ),
                "source": (
                    item["source"]
                ),
                "mandatory": (
                    item["mandatory"]
                ),
            }
            for item in batch
        ]

        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
The previous response was invalid.

Reason:
%s

Return one result for EVERY requirement_id in the exact
same order. Do not omit IDs. Do not invent IDs.
Return ONLY valid JSON.
""" % retry_reason

        return """
You are a senior procurement and project-delivery evaluator.

Evaluate ONLY the vendor proposal against the supplied
project-plan / implementation / schedule requirements.

This is batch %s of %s.

Do not evaluate unrelated technical functionality unless it
directly supports the project-plan requirement.

PROJECT-PLAN EVALUATION DIMENSIONS MAY INCLUDE:
- implementation methodology
- implementation phases
- timeline and schedule
- milestones and deliverables
- dependencies and assumptions
- governance
- project-management approach
- project team responsibilities
- reporting and communication
- risk and issue management
- change management
- training / handover when part of implementation
- resource planning
- acceptance / transition / go-live planning

RULES:
1. Use ONLY explicit evidence from the vendor proposal.
2. Do not assume missing information.
3. Do not reward vague promises.
4. Evaluate every supplied requirement independently.
5. Preserve each requirement_id EXACTLY.
6. Return exactly one result per requirement.
7. Use one of these statuses only:
   FULL_MATCH
   PARTIAL_MATCH
   NO_MATCH
   NOT_PROVIDED
8. match_score must be between 0 and 100.
9. FULL_MATCH requires clear evidence that materially satisfies
   the requirement.
10. PARTIAL_MATCH means some relevant evidence exists but the
    requirement is incomplete.
11. NO_MATCH means the proposal explicitly conflicts with the
    requirement.
12. NOT_PROVIDED means no sufficient evidence was found.
13. proposal_evidence must be concise and grounded in the proposal.
14. If status is NOT_PROVIDED, proposal_evidence should be
    "Not Provided".

%s

RFP REQUIREMENTS:
%s

VENDOR PROPOSAL CONTEXT:
The context below is a bounded selection from the proposal chosen
for relevance to this requirement batch. Treat absence of evidence
as NOT_PROVIDED; do not infer from omitted proposal sections.

%s

Return ONLY valid JSON:

{
  "requirement_results": [
    {
      "requirement_id": "REQ-0001",
      "status": "FULL_MATCH",
      "match_score": 100,
      "proposal_evidence": "Concise proposal evidence",
      "rationale": "Why the evidence satisfies or does not satisfy the requirement"
    }
  ]
}
""" % (
            batch_number,
            total_batches,
            retry_section,
            json.dumps(
                requirement_payload,
                ensure_ascii=False,
            ),
            proposal_context,
        )

    # =====================================================
    # RESPONSE VALIDATION
    # =====================================================

    def _repair_missing_ids_if_safe(
        self,
        raw_results,
        batch,
    ):
        """
        Repair only the very narrow case where:
        - result count exactly matches requirement count
        - present IDs match the exact expected position
        - missing IDs are blank, not wrong/reordered/duplicated

        Never repair an incorrect non-empty ID.
        """

        if not isinstance(
            raw_results,
            list,
        ):
            return raw_results

        if len(raw_results) != len(
            batch
        ):
            return raw_results

        expected_ids = [
            item["id"]
            for item in batch
        ]

        seen_nonempty = set()

        for index, item in enumerate(
            raw_results
        ):
            if not isinstance(
                item,
                dict,
            ):
                return raw_results

            current_id = str(
                item.get(
                    "requirement_id",
                    "",
                )
                or
                ""
            ).strip()

            if not current_id:
                continue

            if current_id != expected_ids[
                index
            ]:
                return raw_results

            if current_id in seen_nonempty:
                return raw_results

            seen_nonempty.add(
                current_id
            )

        repaired = []
        repaired_count = 0

        for index, item in enumerate(
            raw_results
        ):
            copied = dict(
                item
            )

            current_id = str(
                copied.get(
                    "requirement_id",
                    "",
                )
                or
                ""
            ).strip()

            if not current_id:
                copied[
                    "requirement_id"
                ] = (
                    expected_ids[
                        index
                    ]
                )

                repaired_count += 1

            repaired.append(
                copied
            )

        if repaired_count:
            print(
                "ProjectPlanAgent restored %s "
                "missing requirement_id value(s) "
                "deterministically."
                % repaired_count
            )

        return repaired

    def _validate_batch_result(
        self,
        data,
        batch,
    ):
        if not isinstance(
            data,
            dict,
        ):
            return (
                None,
                "Batch response must be an object.",
            )

        raw_results = data.get(
            "requirement_results"
        )

        if not isinstance(
            raw_results,
            list,
        ):
            return (
                None,
                "Batch response is missing requirement_results.",
            )

        raw_results = (
            self._repair_missing_ids_if_safe(
                raw_results,
                batch,
            )
        )

        expected_ids = [
            item["id"]
            for item in batch
        ]

        if len(raw_results) != len(
            expected_ids
        ):
            return (
                None,
                "Requirement result count mismatch. "
                "Expected %s, received %s."
                % (
                    len(expected_ids),
                    len(raw_results),
                ),
            )

        requirement_map = {
            item["id"]: item
            for item in batch
        }

        seen = set()
        cleaned = []

        for index, result in enumerate(
            raw_results
        ):
            if not isinstance(
                result,
                dict,
            ):
                return (
                    None,
                    "Requirement result %s must be an object."
                    % (
                        index + 1
                    ),
                )

            requirement_id = str(
                result.get(
                    "requirement_id",
                    "",
                )
                or
                ""
            ).strip()

            if not requirement_id:
                return (
                    None,
                    "Requirement result %s is missing requirement_id."
                    % (
                        index + 1
                    ),
                )

            if requirement_id not in (
                expected_ids
            ):
                return (
                    None,
                    "Unexpected requirement_id. "
                    "Expected one of %s. Received: %s"
                    % (
                        expected_ids,
                        requirement_id,
                    ),
                )

            if requirement_id in seen:
                return (
                    None,
                    "Duplicate requirement_id: %s"
                    % requirement_id,
                )

            seen.add(
                requirement_id
            )

            status = str(
                result.get(
                    "status",
                    "",
                )
                or
                ""
            ).strip().upper()

            if status not in (
                self.VALID_STATUSES
            ):
                return (
                    None,
                    "Invalid status for %s: %s"
                    % (
                        requirement_id,
                        status,
                    ),
                )

            raw_score = (
                result.get(
                    "match_score"
                )
            )

            try:
                match_score = float(
                    raw_score
                )

            except (
                TypeError,
                ValueError,
            ):
                match_score = (
                    self.STATUS_SCORES[
                        status
                    ]
                )

            match_score = max(
                0.0,
                min(
                    100.0,
                    match_score,
                ),
            )

            proposal_evidence = str(
                result.get(
                    "proposal_evidence",
                    "",
                )
                or
                ""
            ).strip()

            rationale = str(
                result.get(
                    "rationale",
                    "",
                )
                or
                ""
            ).strip()

            if (
                status ==
                "NOT_PROVIDED"
                and
                not proposal_evidence
            ):
                proposal_evidence = (
                    "Not Provided"
                )

            requirement = (
                requirement_map[
                    requirement_id
                ]
            )

            cleaned.append(
                {
                    "requirement_id": (
                        requirement_id
                    ),
                    "requirement": (
                        requirement[
                            "requirement"
                        ]
                    ),
                    "rfp_source": (
                        requirement[
                            "source"
                        ]
                    ),
                    "mandatory": (
                        requirement[
                            "mandatory"
                        ]
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
                    "status": status,
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
            )

        missing = [
            requirement_id
            for requirement_id
            in expected_ids
            if requirement_id not in seen
        ]

        if missing:
            return (
                None,
                "Missing requirement results: %s"
                % missing,
            )

        result_map = {
            item[
                "requirement_id"
            ]: item
            for item in cleaned
        }

        ordered = [
            result_map[
                requirement_id
            ]
            for requirement_id
            in expected_ids
        ]

        return (
            ordered,
            None,
        )

    # =====================================================
    # BATCH EVALUATION
    # =====================================================

    def _evaluate_batch(
        self,
        batch,
        proposal_text,
        batch_number,
        total_batches,
    ):
        attempts = (
            self.MAX_RETRIES
            +
            1
        )

        retry_reason = None
        last_error = None

        for attempt in range(
            1,
            attempts + 1,
        ):
            context_limit = (
                self.MAX_PROPOSAL_CONTEXT_CHARS
                if attempt == 1
                else
                self.RETRY_CONTEXT_CHARS
            )

            proposal_context = (
                self._select_relevant_proposal_context(
                    proposal_text=proposal_text,
                    batch=batch,
                    max_chars=context_limit,
                )
            )

            prompt = (
                self._build_batch_prompt(
                    batch=batch,
                    proposal_context=proposal_context,
                    batch_number=batch_number,
                    total_batches=total_batches,
                    retry_reason=retry_reason,
                )
            )

            print(
                "ProjectPlanAgent batch %s/%s attempt %s/%s | "
                "requirements=%s | proposal_context_chars=%s | "
                "prompt_chars=%s"
                % (
                    batch_number,
                    total_batches,
                    attempt,
                    attempts,
                    len(batch),
                    len(proposal_context),
                    len(prompt),
                )
            )

            raw = self.llm.ask(
                prompt,
                label=(
                    "ProjectPlanAgent-%s"
                    % batch_number
                ),
            )

            try:
                data = self._parse_json(
                    raw,
                    (
                        "ProjectPlanAgent batch %s"
                        % batch_number
                    ),
                )

            except Exception as error:
                last_error = str(
                    error
                )

                print(
                    "ProjectPlanAgent batch %s returned "
                    "unparseable output | output_chars=%s"
                    % (
                        batch_number,
                        len(
                            raw
                            or
                            ""
                        ),
                    )
                )

                if attempt >= attempts:
                    break

                retry_reason = (
                    last_error
                    +
                    " Keep the JSON compact. "
                    "Do not add markdown or prose. "
                    "Use short rationale/evidence strings."
                )

                continue

            (
                cleaned,
                structure_error,
            ) = (
                self._validate_batch_result(
                    data,
                    batch,
                )
            )

            if not structure_error:
                return cleaned

            last_error = (
                structure_error
            )

            if attempt >= attempts:
                break

            retry_reason = (
                structure_error
                +
                " Keep the JSON compact and return exactly "
                "one object per supplied requirement."
            )

            print(
                "Retrying ProjectPlanAgent "
                "batch %s/%s because: %s"
                % (
                    batch_number,
                    total_batches,
                    last_error,
                )
            )

        raise RuntimeError(
            "ProjectPlanAgent batch %s failed after %s attempts. %s"
            % (
                batch_number,
                attempts,
                last_error,
            )
        )

    # =====================================================
    # AGGREGATION
    # =====================================================

    def _aggregate(
        self,
        requirement_results,
    ):
        if not requirement_results:
            return {
                "criterion": "Project Plan",
                "score": 0.0,
                "mandatory_compliance_percentage": 0.0,
                "requirement_results": [],
                "strengths": [],
                "gaps": [],
                "rationale": (
                    "No project-plan requirements were available "
                    "for evaluation."
                ),
            }

        score = (
            sum(
                float(
                    item.get(
                        "match_score",
                        0,
                    )
                )
                for item
                in requirement_results
            )
            /
            len(
                requirement_results
            )
        )

        mandatory_results = [
            item
            for item
            in requirement_results
            if item.get(
                "mandatory",
                False,
            )
        ]

        if mandatory_results:
            mandatory_compliance_percentage = (
                sum(
                    1
                    for item
                    in mandatory_results
                    if item.get(
                        "status"
                    )
                    ==
                    "FULL_MATCH"
                )
                /
                len(
                    mandatory_results
                )
                *
                100.0
            )
        else:
            mandatory_compliance_percentage = (
                100.0
            )

        strongest = sorted(
            requirement_results,
            key=lambda item: (
                float(
                    item.get(
                        "match_score",
                        0,
                    )
                )
            ),
            reverse=True,
        )

        weakest = sorted(
            requirement_results,
            key=lambda item: (
                float(
                    item.get(
                        "match_score",
                        0,
                    )
                )
            ),
        )

        strengths = [
            item[
                "rationale"
            ]
            for item
            in strongest
            if (
                item.get(
                    "status"
                )
                ==
                "FULL_MATCH"
                and
                item.get(
                    "rationale"
                )
            )
        ][:4]

        gaps = [
            item[
                "rationale"
            ]
            for item
            in weakest
            if (
                item.get(
                    "status"
                )
                in {
                    "PARTIAL_MATCH",
                    "NO_MATCH",
                    "NOT_PROVIDED",
                }
                and
                item.get(
                    "rationale"
                )
            )
        ][:5]

        full_count = sum(
            1
            for item
            in requirement_results
            if item.get(
                "status"
            )
            ==
            "FULL_MATCH"
        )

        partial_count = sum(
            1
            for item
            in requirement_results
            if item.get(
                "status"
            )
            ==
            "PARTIAL_MATCH"
        )

        missing_count = sum(
            1
            for item
            in requirement_results
            if item.get(
                "status"
            )
            in {
                "NO_MATCH",
                "NOT_PROVIDED",
            }
        )

        rationale = (
            "Project plan evaluated at requirement level. "
            "%s fully matched, %s partially matched, "
            "%s not matched or not provided."
            % (
                full_count,
                partial_count,
                missing_count,
            )
        )

        return {
            "criterion": (
                "Project Plan"
            ),
            "score": round(
                score,
                2,
            ),
            "mandatory_compliance_percentage": (
                round(
                    mandatory_compliance_percentage,
                    2,
                )
            ),
            "requirement_results": (
                requirement_results
            ),
            "strengths": strengths,
            "gaps": gaps,
            "rationale": rationale,
        }

    # =====================================================
    # PUBLIC EVALUATE
    # =====================================================

    def evaluate(
        self,
        requirements,
        proposal_text,
    ):
        normalized_requirements = [
            self._normalize_requirement(
                requirement,
                index,
            )
            for index, requirement in enumerate(
                requirements
            )
        ]

        if not normalized_requirements:
            return self._aggregate(
                []
            )

        batches = self._build_batches(
            normalized_requirements
        )

        total_batches = len(
            batches
        )

        worker_count = min(
            self.MAX_WORKERS,
            total_batches,
        )

        print()
        print(
            "================================"
        )
        print(
            "PROJECT PLAN REQUIREMENT EVALUATION"
        )
        print(
            "================================"
        )
        print(
            "Requirements: %s"
            % len(
                normalized_requirements
            )
        )
        print(
            "Batches: %s"
            % total_batches
        )
        print(
            "Parallel workers: %s"
            % worker_count
        )

        results_by_batch = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for batch_number, batch in enumerate(
                batches,
                start=1,
            ):
                future = executor.submit(
                    self._evaluate_batch,
                    batch,
                    proposal_text,
                    batch_number,
                    total_batches,
                )

                future_map[
                    future
                ] = batch_number

            for future in as_completed(
                future_map
            ):
                batch_number = (
                    future_map[
                        future
                    ]
                )

                results_by_batch[
                    batch_number
                ] = future.result()

                print(
                    "ProjectPlanAgent batch "
                    "%s/%s completed."
                    % (
                        batch_number,
                        total_batches,
                    )
                )

        requirement_results = []

        for batch_number in range(
            1,
            total_batches + 1,
        ):
            requirement_results.extend(
                results_by_batch[
                    batch_number
                ]
            )

        # Final deterministic coverage validation.
        expected_ids = [
            item["id"]
            for item
            in normalized_requirements
        ]

        received_ids = [
            item[
                "requirement_id"
            ]
            for item
            in requirement_results
        ]

        if received_ids != expected_ids:
            raise RuntimeError(
                "ProjectPlanAgent final requirement coverage "
                "does not match the input requirement order."
            )

        result = self._aggregate(
            requirement_results
        )

        print(
            "ProjectPlanAgent completed | "
            "score=%s | mandatory_compliance=%s"
            % (
                result[
                    "score"
                ],
                result[
                    "mandatory_compliance_percentage"
                ],
            )
        )

        return result

    def close(self):
        self.llm.close()
