import json
import math
import re
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.llm_client import LLMClient


class RFPAgent:
    """
    Dynamic, domain-agnostic RFP analysis.

    Core design:

    1. Numbered RFP requirements are extracted deterministically.
       The LLM never controls the requirement count.

    2. Original requirement IDs such as GEN-001 / REQ-0001
       are preserved exactly.

    3. Explicit mandatory / preferential labels are preserved
       from the source document.

    4. Evaluation criteria are NOT hardcoded.
       The LLM discovers the criteria dynamically from the
       actual RFP content and returns them in the same dominant
       language as the RFP.

    5. Requirements are assigned to the discovered criteria
       in controlled LLM batches using requirement IDs.

    6. Python validates that every extracted requirement is
       assigned exactly once and no IDs are lost, duplicated,
       invented, or reordered.

    7. If the RFP contains a complete explicit evaluation-weight
       scheme, those weights are used.

    8. Otherwise the LLM assigns criterion-level importance
       from 1 to 5 based on the actual RFP, and Python normalizes
       those criterion importance scores to a final 100%.

       Requirement count does NOT determine criterion weight.

    9. A concise RFP summary is generated separately.

    This architecture works for technical, construction,
    consulting, logistics, healthcare, legal, operational,
    or other RFP domains without fixed criterion names.
    """

    # =====================================================
    # Requirement extraction
    # =====================================================

    REQUIREMENT_ID_PATTERN = re.compile(
        r"""
        (?:
            \bGEN[\-\s]?(\d{3})\b
            |
            \bREQ[\-\s]?(\d{4})\b
            |
            \b(\d{3})[\-\s]?GEN\b
            |
            \b(\d{4})[\-\s]?REQ\b
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    PAGE_PATTERN = re.compile(
        r"\[Page\s+(\d+)\]",
        flags=re.IGNORECASE,
    )

    # =====================================================
    # Dynamic criteria configuration
    # =====================================================

    MIN_CRITERIA = 2
    MAX_CRITERIA = 12

    ASSIGNMENT_BATCH_SIZE = 45
    MAX_ASSIGNMENT_WORKERS = 2
    MAX_ASSIGNMENT_RETRIES = 1

    # Keep criteria discovery compact enough that the model
    # can reliably finish the JSON response.
    DISCOVERY_REQUIREMENT_TEXT_LIMIT = 180
    DISCOVERY_RFP_CONTEXT_LIMIT = 40000
    MAX_DISCOVERY_RETRIES = 2

    # =====================================================
    # Requirement importance
    # =====================================================

    IMPORTANCE_LEVELS = {
        1: "Low",
        2: "Moderate",
        3: "Important",
        4: "High",
        5: "Critical",
    }

    def __init__(
        self,
    ):
        self.llm = (
            LLMClient()
        )

    # =====================================================
    # Generic helpers
    # =====================================================

    def _normalize_text(
        self,
        value,
    ):
        if value is None:
            return ""

        return re.sub(
            r"\s+",
            " ",
            str(
                value
            ),
        ).strip()

    def _normalize_search_text(
        self,
        value,
    ):
        return (
            self._normalize_text(
                value
            )
            .lower()
        )

    def _clean_json_response(
        self,
        response_text,
    ):
        if not isinstance(
            response_text,
            str,
        ):
            raise ValueError(
                "RFP Agent response must be text."
            )

        text = (
            response_text.strip()
        )

        if text.startswith(
            "```json"
        ):
            text = text[7:]

        elif text.startswith(
            "```"
        ):
            text = text[3:]

        if text.endswith(
            "```"
        ):
            text = text[:-3]

        return (
            text.strip()
        )

    def _extract_first_json_object(
        self,
        text,
    ):
        """
        Extract the first balanced JSON object from a model response.

        This handles common wrappers such as prose or code fences
        without trying to guess arbitrary malformed JSON.
        """

        if not isinstance(
            text,
            str,
        ):
            return None

        start = text.find(
            "{"
        )

        if start < 0:
            return None

        depth = 0
        in_string = False
        escaped = False

        for index in range(
            start,
            len(
                text
            ),
        ):
            char = text[
                index
            ]

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
                        start:
                        index + 1
                    ]

        return None

    def _parse_json(
        self,
        response_text,
        context_label,
    ):
        cleaned = (
            self._clean_json_response(
                response_text
            )
        )

        try:
            return (
                json.loads(
                    cleaned
                )
            )

        except json.JSONDecodeError:
            extracted = (
                self._extract_first_json_object(
                    cleaned
                )
            )

            if extracted:
                try:
                    return (
                        json.loads(
                            extracted
                        )
                    )

                except json.JSONDecodeError:
                    pass

            raise ValueError(
                f"{context_label} returned invalid JSON."
            )

    # =====================================================
    # Language detection
    # =====================================================

    def _detect_document_language(
        self,
        text,
    ):
        """
        Lightweight deterministic language hint.

        The LLM is still instructed to preserve the source
        document language when naming criteria.
        """

        if not isinstance(
            text,
            str,
        ):
            return "unknown"

        sample = text[
            :50000
        ]

        arabic_chars = len(
            re.findall(
                r"[\u0600-\u06FF]",
                sample,
            )
        )

        latin_chars = len(
            re.findall(
                r"[A-Za-z]",
                sample,
            )
        )

        if (
            arabic_chars
            >
            latin_chars
        ):
            return "Arabic"

        if (
            latin_chars
            >
            arabic_chars
        ):
            return "English"

        return "mixed"

    # =====================================================
    # Canonical requirement ID
    # =====================================================

    def _canonical_requirement_id(
        self,
        match,
    ):
        gen_forward = (
            match.group(1)
        )

        req_forward = (
            match.group(2)
        )

        gen_reverse = (
            match.group(3)
        )

        req_reverse = (
            match.group(4)
        )

        if gen_forward:
            return (
                f"GEN-{int(gen_forward):03d}"
            )

        if req_forward:
            return (
                f"REQ-{int(req_forward):04d}"
            )

        if gen_reverse:
            return (
                f"GEN-{int(gen_reverse):03d}"
            )

        if req_reverse:
            return (
                f"REQ-{int(req_reverse):04d}"
            )

        return None

    # =====================================================
    # Page / source
    # =====================================================

    def _find_page_number(
        self,
        text,
        position,
    ):
        page_number = None

        for match in (
            self.PAGE_PATTERN
            .finditer(
                text,
                0,
                position,
            )
        ):
            try:
                page_number = int(
                    match.group(1)
                )

            except (
                TypeError,
                ValueError,
            ):
                continue

        return page_number

    def _extract_source_heading(
        self,
        text,
        position,
    ):
        start = max(
            0,
            position - 1800,
        )

        preceding = text[
            start:position
        ]

        lines = [
            self._normalize_text(
                line
            )
            for line
            in preceding.splitlines()
            if self._normalize_text(
                line
            )
        ]

        if not lines:
            return "RFP"

        ignored_patterns = [
            "طلب تقديم عروض",
            "صفحة",
            "دليل الاستجابة",
            "على مقدم العرض",
            "ممتثل",
        ]

        for line in reversed(
            lines
        ):
            normalized = (
                line.lower()
            )

            if any(
                ignored in normalized
                for ignored
                in ignored_patterns
            ):
                continue

            if re.match(
                r"^(GEN|REQ)[\-\s]?\d+",
                line,
                flags=re.IGNORECASE,
            ):
                continue

            if len(line) > 140:
                continue

            if len(line) < 3:
                continue

            return line

        return "RFP"

    # =====================================================
    # Requirement source metadata
    # =====================================================

    def _extract_response_evidence(
        self,
        block,
    ):
        patterns = [
            r"دليل\s*الاستجابة\s*[:：]?\s*(.+)",
            r"Response\s+Evidence\s*[:：]?\s*(.+)",
        ]

        for pattern in patterns:
            match = re.search(
                pattern,
                block,
                flags=re.IGNORECASE,
            )

            if not match:
                continue

            evidence = (
                match.group(1)
                .strip()
            )

            evidence = re.split(
                r"\n|على مقدم العرض",
                evidence,
                maxsplit=1,
            )[0]

            evidence = (
                self._normalize_text(
                    evidence
                )
            )

            if evidence:
                return evidence

        return ""

    def _extract_requirement_status(
        self,
        block,
    ):
        normalized = (
            str(
                block
            )
            .replace(
                "إلزامى",
                "إلزامي",
            )
        )

        has_mandatory = bool(
            re.search(
                r"\bإلزامي\b",
                normalized,
            )
        )

        has_preferred = bool(
            re.search(
                r"\bتفضيلي\b",
                normalized,
            )
        )

        if (
            has_mandatory
            and
            not has_preferred
        ):
            return (
                True,
                "إلزامي",
            )

        if (
            has_preferred
            and
            not has_mandatory
        ):
            return (
                False,
                "تفضيلي",
            )

        mandatory_pos = (
            normalized.find(
                "إلزامي"
            )
        )

        preferred_pos = (
            normalized.find(
                "تفضيلي"
            )
        )

        if (
            mandatory_pos >= 0
            and
            (
                preferred_pos < 0
                or
                mandatory_pos
                <
                preferred_pos
            )
        ):
            return (
                True,
                "إلزامي",
            )

        if preferred_pos >= 0:
            return (
                False,
                "تفضيلي",
            )

        return (
            False,
            "",
        )

    def _clean_requirement_body(
        self,
        block,
    ):
        text = str(
            block
        )

        split_patterns = [
            r"\|\s*:\s*إلزامي",
            r"\|\s*:\s*تفضيلي",
            r"إلزامي\s+دليل\s*الاستجابة",
            r"تفضيلي\s+دليل\s*الاستجابة",
            r"دليل\s*الاستجابة",
            r"على مقدم العرض بيان حالة الامتثال",
            r"على مقدم العرض بيان حالة االمتثال",
        ]

        cut_positions = []

        for pattern in (
            split_patterns
        ):
            match = re.search(
                pattern,
                text,
                flags=re.IGNORECASE,
            )

            if match:
                cut_positions.append(
                    match.start()
                )

        if cut_positions:
            text = text[
                :min(
                    cut_positions
                )
            ]

        text = re.sub(
            r"\[Page\s+\d+\]",
            " ",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"طلب تقديم عروض منصة إدارة المستشفيات الذكية والمتكاملة",
            " ",
            text,
            flags=re.IGNORECASE,
        )

        text = re.sub(
            r"صفحة\s+\d+\s+من\s+\d+",
            " ",
            text,
            flags=re.IGNORECASE,
        )

        return (
            self._normalize_text(
                text
            )
        )

    # =====================================================
    # Generic requirement-level importance
    # =====================================================

    def _calculate_requirement_importance(
        self,
        requirement,
    ):
        """
        Generic, domain-agnostic requirement importance.

        This does NOT assume the RFP is technical.

        Signals:
        - explicit mandatory / preferential status
        - legal / regulatory / safety / security language
        - pass-fail / disqualification language
        - measurable threshold / SLA / deadline / capacity
        - formal evidence / certification requirement
        - consequence / continuity / criticality wording

        Criterion weight is NOT calculated from requirement count.
        """

        text = (
            self._normalize_search_text(
                requirement.get(
                    "requirement",
                    "",
                )
            )
        )

        evidence = (
            self._normalize_search_text(
                requirement.get(
                    "response_evidence_required",
                    "",
                )
            )
        )

        combined = (
            f"{text} {evidence}"
        )

        mandatory = bool(
            requirement.get(
                "mandatory",
                False,
            )
        )

        preferential = (
            requirement.get(
                "requirement_type"
            )
            ==
            "تفضيلي"
        )

        reasons = []

        if mandatory:
            score = 3
            reasons.append(
                "Explicit mandatory requirement"
            )

        elif preferential:
            score = 1
            reasons.append(
                "Explicit preferential requirement"
            )

        else:
            score = 2
            reasons.append(
                "General RFP requirement"
            )

        critical_keywords = [
            "استبعاد",
            "غير مؤهل",
            "شرط تأهيل",
            "شرط إلزامي",
            "سلامة",
            "أمن",
            "خصوصية",
            "حماية",
            "قانون",
            "نظام",
            "لائحة",
            "امتثال",
            "ترخيص",
            "اعتماد",
            "استمرارية",
            "تعافي",
            "مخالفة",
            "disqualification",
            "eligibility",
            "pass/fail",
            "mandatory gate",
            "safety",
            "security",
            "privacy",
            "legal",
            "regulatory",
            "compliance",
            "license",
            "certification",
            "business continuity",
            "disaster recovery",
        ]

        if any(
            keyword in combined
            for keyword
            in critical_keywords
        ):
            score = max(
                score,
                5,
            )

            reasons.append(
                "Critical qualification / legal / safety signal"
            )

        high_keywords = [
            "أساسي",
            "حرج",
            "جوهري",
            "رئيسي",
            "حد أدنى",
            "حد أقصى",
            "موعد نهائي",
            "ضمان",
            "غرامة",
            "critical",
            "essential",
            "key requirement",
            "minimum",
            "maximum",
            "deadline",
            "warranty",
            "penalty",
        ]

        if any(
            keyword in combined
            for keyword
            in high_keywords
        ):
            score = max(
                score,
                4,
            )

            reasons.append(
                "High-impact requirement wording"
            )

        threshold_patterns = [
            r"\b\d+(?:\.\d+)?\s*%",
            r"\b\d+\s*(?:day|days|week|weeks|month|months|year|years)\b",
            r"\b\d+\s*(?:يوم|أيام|أسبوع|أسابيع|شهر|أشهر|سنة|سنوات)\b",
            r"\b\d+\s*(?:ms|sec|second|seconds|minute|minutes|hour|hours)\b",
            r"\b\d+\s*(?:ثانية|ثوان|دقيقة|دقائق|ساعة|ساعات)\b",
            r"\b(sla|rto|rpo)\b",
        ]

        if any(
            re.search(
                pattern,
                combined,
                flags=re.IGNORECASE,
            )
            for pattern
            in threshold_patterns
        ):
            score = max(
                score,
                4,
            )

            reasons.append(
                "Explicit measurable threshold"
            )

        formal_evidence_keywords = [
            "شهادة",
            "تقرير",
            "إثبات",
            "وثيقة",
            "اعتماد",
            "مرجع",
            "certificate",
            "certification",
            "report",
            "evidence",
            "document",
            "audit",
            "reference",
        ]

        if (
            evidence
            and
            any(
                keyword in evidence
                for keyword
                in formal_evidence_keywords
            )
        ):
            score = min(
                5,
                max(
                    score,
                    3,
                )
                +
                1,
            )

            reasons.append(
                "Formal response evidence requested"
            )

        if preferential:
            score = min(
                score,
                3,
            )

        score = int(
            max(
                1,
                min(
                    5,
                    score,
                ),
            )
        )

        clean_reasons = []

        for reason in reasons:
            if reason not in (
                clean_reasons
            ):
                clean_reasons.append(
                    reason
                )

        return {
            "importance_score": score,

            "importance_level": (
                self.IMPORTANCE_LEVELS[
                    score
                ]
            ),

            "importance_reason": (
                "; ".join(
                    clean_reasons
                )
            ),
        }

    # =====================================================
    # Deterministic numbered extraction
    # =====================================================

    def _extract_numbered_requirements(
        self,
        rfp_text,
    ):
        matches = list(
            self.REQUIREMENT_ID_PATTERN
            .finditer(
                rfp_text
            )
        )

        if not matches:
            return []

        extracted = OrderedDict()

        for (
            index,
            match,
        ) in enumerate(
            matches
        ):
            requirement_id = (
                self._canonical_requirement_id(
                    match
                )
            )

            if not requirement_id:
                continue

            if requirement_id in (
                extracted
            ):
                continue

            block_start = (
                match.end()
            )

            if (
                index + 1
                <
                len(
                    matches
                )
            ):
                block_end = (
                    matches[
                        index + 1
                    ]
                    .start()
                )

            else:
                block_end = len(
                    rfp_text
                )

            raw_block = (
                rfp_text[
                    block_start:block_end
                ]
            )

            requirement_text = (
                self._clean_requirement_body(
                    raw_block
                )
            )

            if not requirement_text:
                continue

            (
                mandatory,
                requirement_type,
            ) = (
                self._extract_requirement_status(
                    raw_block
                )
            )

            page_number = (
                self._find_page_number(
                    rfp_text,
                    match.start(),
                )
            )

            heading = (
                self._extract_source_heading(
                    rfp_text,
                    match.start(),
                )
            )

            response_evidence = (
                self._extract_response_evidence(
                    raw_block
                )
            )

            source_parts = []

            if page_number is not None:
                source_parts.append(
                    f"Page {page_number}"
                )

            if heading:
                source_parts.append(
                    heading
                )

            source = (
                " - ".join(
                    source_parts
                )
                or
                "RFP"
            )

            requirement = {
                "id": requirement_id,

                "requirement": (
                    requirement_text
                ),

                "source": source,

                "page": page_number,

                "section": heading,

                "mandatory": mandatory,

                "requirement_type": (
                    requirement_type
                ),

                "mandatory_evidence": (
                    requirement_type
                    if mandatory
                    else ""
                ),

                "response_evidence_required": (
                    response_evidence
                ),
            }

            requirement.update(
                self._calculate_requirement_importance(
                    requirement
                )
            )

            extracted[
                requirement_id
            ] = (
                requirement
            )

        requirements = list(
            extracted.values()
        )

        mandatory_count = sum(
            1
            for item
            in requirements
            if item[
                "mandatory"
            ]
        )

        preferred_count = sum(
            1
            for item
            in requirements
            if (
                item.get(
                    "requirement_type"
                )
                ==
                "تفضيلي"
            )
        )

        importance_counts = {
            score: sum(
                1
                for item
                in requirements
                if (
                    item.get(
                        "importance_score"
                    )
                    ==
                    score
                )
            )
            for score
            in range(
                1,
                6,
            )
        }

        print()
        print(
            "================================"
        )
        print(
            "DETERMINISTIC RFP EXTRACTION"
        )
        print(
            "================================"
        )
        print(
            "Numbered requirements found: "
            f"{len(requirements)}"
        )
        print(
            "Explicit mandatory requirements: "
            f"{mandatory_count}"
        )
        print(
            "Explicit preferential requirements: "
            f"{preferred_count}"
        )
        print(
            "Importance distribution: "
            f"{importance_counts}"
        )

        if requirements:
            print(
                "First requirement: "
                f"{requirements[0]['id']}"
            )
            print(
                "Last requirement: "
                f"{requirements[-1]['id']}"
            )

        return (
            requirements
        )

    # =====================================================
    # Requirement catalog for LLM
    # =====================================================

    def _build_requirement_catalog(
        self,
        requirements,
    ):
        catalog = []

        for requirement in requirements:
            text = (
                self._normalize_text(
                    requirement.get(
                        "requirement",
                        "",
                    )
                )
            )

            if (
                len(text)
                >
                self.DISCOVERY_REQUIREMENT_TEXT_LIMIT
            ):
                text = (
                    text[
                        :self.DISCOVERY_REQUIREMENT_TEXT_LIMIT
                    ]
                    +
                    "..."
                )

            catalog.append(
                {
                    "id": (
                        requirement[
                            "id"
                        ]
                    ),

                    "section": (
                        requirement.get(
                            "section",
                            ""
                        )
                    ),

                    "mandatory": (
                        requirement.get(
                            "mandatory",
                            False,
                        )
                    ),

                    "importance_score": (
                        requirement.get(
                            "importance_score",
                            1,
                        )
                    ),

                    "requirement": text,
                }
            )

        return (
            catalog
        )

    # =====================================================
    # Dynamic criteria discovery
    # =====================================================

    def _build_criteria_discovery_prompt(
        self,
        rfp_text,
        requirements,
        document_language,
        retry_reason=None,
    ):
        catalog = (
            self._build_requirement_catalog(
                requirements
            )
        )

        catalog_text = (
            json.dumps(
                catalog,
                ensure_ascii=False,
            )
        )

        rfp_context = (
            rfp_text[
                :self.DISCOVERY_RFP_CONTEXT_LIMIT
            ]
        )

        retry_section = ""

        if retry_reason:
            retry_section = f"""
==================================================
RETRY
==================================================

The previous response was invalid.

Reason:

{retry_reason}

Return ONLY one valid JSON object.
Do not use markdown fences.
Do not add explanation before or after the JSON.
Keep descriptions concise.
"""

        return f"""
You are a senior procurement evaluator.

Your task is to DISCOVER the evaluation criteria dynamically
from this specific RFP.

This system is DOMAIN-AGNOSTIC.

The RFP may be about technology, construction, consulting,
logistics, operations, healthcare, legal services, facilities,
professional services, or any other procurement domain.

DO NOT use a fixed list of technical criteria.

==================================================
LANGUAGE
==================================================

Dominant document language hint:

{document_language}

Return criterion names and descriptions in the SAME
dominant language as the RFP.

If the RFP is Arabic, criterion names and descriptions
must be Arabic.

If the RFP is English, use English.

==================================================
CRITERIA DISCOVERY RULES
==================================================

1. Discover criteria from the actual RFP structure,
   requirement themes, evaluation language and sections.

2. Prefer explicit evaluation criteria stated by the RFP.

3. If the RFP does not explicitly define evaluation criteria,
   infer a small, meaningful set of procurement evaluation
   criteria from the content.

4. Criteria must be broad enough to avoid hundreds of tiny
   categories, but specific enough to represent materially
   different evaluation dimensions.

5. Return between {self.MIN_CRITERIA} and
   {self.MAX_CRITERIA} criteria.

6. Do NOT create empty criteria.

7. Do NOT assign requirement IDs yet.
   Requirement assignment happens in a separate controlled step.

==================================================
EXPLICIT WEIGHT RULES
==================================================

8. If the RFP EXPLICITLY states that a criterion contributes
   a specific percentage or points to the vendor/bid evaluation
   score, return that explicit_weight.

9. Do NOT infer explicit weights.

10. Do NOT confuse SLA percentages, uptime percentages,
    discounts, penalties, taxes, technical thresholds,
    or completion percentages with evaluation weights.

11. If a criterion has no explicit evaluation weight,
    explicit_weight must be null.

==================================================
CRITERION IMPORTANCE
==================================================

12. Give every criterion a criterion_importance_score
    from 1 to 5 based on the RFP itself.

13. Criterion importance must NOT depend on how many numbered
    requirements happen to be in that criterion.

14. Base criterion importance on:
    - RFP objectives
    - mandatory nature
    - business impact
    - delivery risk
    - eligibility importance
    - safety / legal / operational impact
    - explicit emphasis in the document

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.
No markdown.
No prose before or after the JSON.

{{
  "criteria": [
    {{
      "criterion_id": "C01",
      "name": "Criterion name in RFP language",
      "description": "Concise description in RFP language",
      "source": "RFP section or basis",
      "criterion_importance_score": 5,
      "criterion_importance_reason": "Short factual reason",
      "explicit_weight": null,
      "explicit_weight_evidence": ""
    }}
  ]
}}

{retry_section}

==================================================
RFP CONTEXT
==================================================

The following is a bounded source excerpt used for high-level
scope and any explicit evaluation language:

<RFP_CONTEXT>
{rfp_context}
</RFP_CONTEXT>

==================================================
NUMBERED REQUIREMENT CATALOG
==================================================

The catalog below is the authoritative breadth signal.
It contains ALL extracted numbered requirement IDs, but each
requirement text is shortened only for criteria discovery.

{catalog_text}
"""

    def _validate_discovered_criteria(
        self,
        data,
    ):
        if not isinstance(
            data,
            dict,
        ):
            raise ValueError(
                "Criteria discovery result must be an object."
            )

        raw_criteria = (
            data.get(
                "criteria",
                []
            )
        )

        if not isinstance(
            raw_criteria,
            list,
        ):
            raise ValueError(
                "Criteria discovery is missing criteria."
            )

        if not (
            self.MIN_CRITERIA
            <=
            len(
                raw_criteria
            )
            <=
            self.MAX_CRITERIA
        ):
            raise ValueError(
                "Dynamic criteria count is outside "
                f"the allowed range "
                f"{self.MIN_CRITERIA}-{self.MAX_CRITERIA}. "
                f"Received {len(raw_criteria)}."
            )

        cleaned = []

        seen_ids = set()
        seen_names = set()

        for (
            index,
            criterion,
        ) in enumerate(
            raw_criteria,
            start=1,
        ):
            if not isinstance(
                criterion,
                dict,
            ):
                raise ValueError(
                    f"Criterion {index} must be an object."
                )

            criterion_id = (
                self._normalize_text(
                    criterion.get(
                        "criterion_id",
                        "",
                    )
                )
            )

            if not criterion_id:
                criterion_id = (
                    f"C{index:02d}"
                )

            if criterion_id in (
                seen_ids
            ):
                raise ValueError(
                    "Duplicate criterion_id: "
                    f"{criterion_id}"
                )

            seen_ids.add(
                criterion_id
            )

            name = (
                self._normalize_text(
                    criterion.get(
                        "name",
                        "",
                    )
                )
            )

            if not name:
                raise ValueError(
                    f"Criterion {criterion_id} "
                    "is missing a name."
                )

            normalized_name = (
                name.lower()
            )

            if normalized_name in (
                seen_names
            ):
                raise ValueError(
                    "Duplicate criterion name: "
                    f"{name}"
                )

            seen_names.add(
                normalized_name
            )

            description = (
                self._normalize_text(
                    criterion.get(
                        "description",
                        "",
                    )
                )
            )

            source = (
                self._normalize_text(
                    criterion.get(
                        "source",
                        "",
                    )
                )
            )

            importance_reason = (
                self._normalize_text(
                    criterion.get(
                        "criterion_importance_reason",
                        "",
                    )
                )
            )

            try:
                importance = float(
                    criterion.get(
                        "criterion_importance_score",
                        3,
                    )
                )

            except (
                TypeError,
                ValueError,
            ):
                importance = 3.0

            importance = max(
                1.0,
                min(
                    5.0,
                    importance,
                ),
            )

            explicit_weight = (
                criterion.get(
                    "explicit_weight"
                )
            )

            if explicit_weight is not None:
                try:
                    explicit_weight = float(
                        explicit_weight
                    )

                except (
                    TypeError,
                    ValueError,
                ):
                    explicit_weight = None

            if (
                explicit_weight is not None
                and
                (
                    explicit_weight <= 0
                    or
                    explicit_weight > 100
                )
            ):
                explicit_weight = None

            explicit_weight_evidence = (
                self._normalize_text(
                    criterion.get(
                        "explicit_weight_evidence",
                        "",
                    )
                )
            )

            cleaned.append(
                {
                    "criterion_id": (
                        criterion_id
                    ),

                    "name": name,

                    "description": (
                        description
                    ),

                    "source": (
                        source
                    ),

                    "criterion_importance_score": (
                        round(
                            importance,
                            3,
                        )
                    ),

                    "criterion_importance_reason": (
                        importance_reason
                    ),

                    "explicit_weight": (
                        explicit_weight
                    ),

                    "explicit_weight_evidence": (
                        explicit_weight_evidence
                    ),
                }
            )

        return (
            cleaned
        )

    def _discover_dynamic_criteria(
        self,
        rfp_text,
        requirements,
        document_language,
    ):
        last_error = None
        retry_reason = None

        for attempt in range(
            1,
            self.MAX_DISCOVERY_RETRIES
            +
            2,
        ):
            prompt = (
                self._build_criteria_discovery_prompt(
                    rfp_text=rfp_text,
                    requirements=requirements,
                    document_language=document_language,
                    retry_reason=retry_reason,
                )
            )

            response = (
                self.llm.ask(
                    prompt,
                    label="RFP-CriteriaDiscovery",
                )
            )

            try:
                data = (
                    self._parse_json(
                        response,
                        "RFP criteria discovery",
                    )
                )

                return (
                    self._validate_discovered_criteria(
                        data
                    )
                )

            except Exception as error:
                last_error = str(
                    error
                )

                if (
                    attempt
                    >=
                    self.MAX_DISCOVERY_RETRIES
                    +
                    1
                ):
                    break

                retry_reason = (
                    last_error
                )

                print(
                    "Retrying RFP criteria discovery "
                    f"({attempt + 1}/"
                    f"{self.MAX_DISCOVERY_RETRIES + 1}) "
                    f"because: {last_error}"
                )

        raise RuntimeError(
            "RFP criteria discovery failed after "
            f"{self.MAX_DISCOVERY_RETRIES + 1} attempts. "
            f"{last_error}"
        )

    # =====================================================
    # Requirement assignment
    # =====================================================

    def _build_assignment_batches(
        self,
        requirements,
    ):
        return [
            requirements[
                index:
                index
                +
                self.ASSIGNMENT_BATCH_SIZE
            ]
            for index
            in range(
                0,
                len(
                    requirements
                ),
                self.ASSIGNMENT_BATCH_SIZE,
            )
        ]

    def _format_criteria_for_assignment(
        self,
        criteria,
    ):
        return [
            {
                "criterion_id": (
                    criterion[
                        "criterion_id"
                    ]
                ),

                "name": (
                    criterion[
                        "name"
                    ]
                ),

                "description": (
                    criterion[
                        "description"
                    ]
                ),
            }
            for criterion
            in criteria
        ]

    def _format_assignment_requirements(
        self,
        batch,
    ):
        return [
            {
                "requirement_id": (
                    item[
                        "id"
                    ]
                ),

                "section": (
                    item.get(
                        "section",
                        "",
                    )
                ),

                "requirement": (
                    item.get(
                        "requirement",
                        "",
                    )
                ),
            }
            for item
            in batch
        ]

    def _build_assignment_prompt(
        self,
        criteria,
        batch,
        batch_number,
        total_batches,
        retry_reason=None,
    ):
        criteria_json = (
            json.dumps(
                self._format_criteria_for_assignment(
                    criteria
                ),
                ensure_ascii=False,
            )
        )

        requirements_json = (
            json.dumps(
                self._format_assignment_requirements(
                    batch
                ),
                ensure_ascii=False,
            )
        )

        retry_section = ""

        if retry_reason:
            retry_section = f"""
==================================================
RETRY
==================================================

The previous output was invalid.

Reason:

{retry_reason}

Return exactly one assignment for every requirement_id.
Do not omit IDs.
Do not invent IDs.
Do not duplicate IDs.
Preserve requirement IDs exactly.
"""

        return f"""
You are assigning RFP requirements to evaluation criteria.

This is assignment batch {batch_number} of {total_batches}.

The criteria were already discovered dynamically from the
same RFP.

==================================================
RULES
==================================================

1. Assign EVERY requirement to exactly ONE criterion.

2. Use only the supplied criterion_id values.

3. Use only the supplied requirement_id values.

4. Do NOT create new criteria.

5. Do NOT omit requirements.

6. Do NOT duplicate requirements.

7. Choose the criterion that best represents the MAIN
   evaluation purpose of the requirement.

8. Use semantic meaning, not keyword matching only.

9. If a requirement could fit multiple criteria, choose the
   single criterion most directly responsible for evaluating it.

10. Return only valid JSON.

{retry_section}

==================================================
CRITERIA
==================================================

{criteria_json}

==================================================
REQUIREMENTS
==================================================

{requirements_json}

==================================================
OUTPUT
==================================================

{{
  "assignments": [
    {{
      "requirement_id": "REQ-0001",
      "criterion_id": "C01"
    }}
  ]
}}
"""

    def _validate_assignment_result(
        self,
        data,
        batch,
        criteria,
    ):
        if not isinstance(
            data,
            dict,
        ):
            return (
                None,
                "Assignment result must be an object."
            )

        assignments = (
            data.get(
                "assignments"
            )
        )

        if not isinstance(
            assignments,
            list,
        ):
            return (
                None,
                "Assignment result is missing assignments."
            )

        expected_ids = [
            item[
                "id"
            ]
            for item
            in batch
        ]

        valid_criterion_ids = {
            item[
                "criterion_id"
            ]
            for item
            in criteria
        }

        if (
            len(
                assignments
            )
            !=
            len(
                expected_ids
            )
        ):
            return (
                None,
                "Assignment count mismatch. "
                f"Expected {len(expected_ids)}, "
                f"received {len(assignments)}."
            )

        assignment_map = {}

        for (
            index,
            item,
        ) in enumerate(
            assignments,
            start=1,
        ):
            if not isinstance(
                item,
                dict,
            ):
                return (
                    None,
                    f"Assignment {index} must be an object."
                )

            requirement_id = (
                self._normalize_text(
                    item.get(
                        "requirement_id",
                        "",
                    )
                )
            )

            criterion_id = (
                self._normalize_text(
                    item.get(
                        "criterion_id",
                        "",
                    )
                )
            )

            if not requirement_id:
                return (
                    None,
                    f"Assignment {index} is missing requirement_id."
                )

            if requirement_id not in (
                expected_ids
            ):
                return (
                    None,
                    "Unexpected requirement_id: "
                    f"{requirement_id}"
                )

            if requirement_id in (
                assignment_map
            ):
                return (
                    None,
                    "Duplicate requirement_id: "
                    f"{requirement_id}"
                )

            if criterion_id not in (
                valid_criterion_ids
            ):
                return (
                    None,
                    "Unexpected criterion_id: "
                    f"{criterion_id}"
                )

            assignment_map[
                requirement_id
            ] = (
                criterion_id
            )

        missing = [
            requirement_id
            for requirement_id
            in expected_ids
            if requirement_id not in (
                assignment_map
            )
        ]

        if missing:
            return (
                None,
                "Missing requirement assignments: "
                f"{missing}"
            )

        ordered = {
            requirement_id: (
                assignment_map[
                    requirement_id
                ]
            )
            for requirement_id
            in expected_ids
        }

        return (
            ordered,
            None,
        )

    def _assign_batch(
        self,
        criteria,
        batch,
        batch_number,
        total_batches,
    ):
        last_error = None

        attempts = (
            self.MAX_ASSIGNMENT_RETRIES
            +
            1
        )

        llm = (
            LLMClient()
        )

        try:
            retry_reason = None

            for attempt in range(
                1,
                attempts + 1,
            ):
                prompt = (
                    self._build_assignment_prompt(
                        criteria=criteria,
                        batch=batch,
                        batch_number=batch_number,
                        total_batches=total_batches,
                        retry_reason=retry_reason,
                    )
                )

                response = (
                    llm.ask(
                        prompt,
                        label=(
                            f"RFPCriteriaAssign"
                            f"{batch_number}"
                        ),
                    )
                )

                try:
                    data = (
                        self._parse_json(
                            response,
                            (
                                "RFP criterion assignment "
                                f"batch {batch_number}"
                            ),
                        )
                    )

                except Exception as error:
                    last_error = str(
                        error
                    )

                    if attempt >= attempts:
                        break

                    retry_reason = (
                        last_error
                    )

                    continue

                (
                    assignment_map,
                    structure_error,
                ) = (
                    self._validate_assignment_result(
                        data=data,
                        batch=batch,
                        criteria=criteria,
                    )
                )

                if not structure_error:
                    return (
                        assignment_map
                    )

                last_error = (
                    structure_error
                )

                if attempt >= attempts:
                    break

                retry_reason = (
                    structure_error
                )

            raise RuntimeError(
                "RFP criterion assignment batch "
                f"{batch_number} failed. "
                f"{last_error}"
            )

        finally:
            llm.close()

    def _assign_requirements_to_criteria(
        self,
        requirements,
        criteria,
    ):
        batches = (
            self._build_assignment_batches(
                requirements
            )
        )

        total_batches = len(
            batches
        )

        worker_count = min(
            self.MAX_ASSIGNMENT_WORKERS,
            total_batches,
        )

        print()
        print(
            "================================"
        )
        print(
            "DYNAMIC REQUIREMENT ASSIGNMENT"
        )
        print(
            "================================"
        )
        print(
            f"Requirements: {len(requirements)}"
        )
        print(
            f"Criteria: {len(criteria)}"
        )
        print(
            f"Assignment batches: {total_batches}"
        )
        print(
            f"Parallel assignment workers: {worker_count}"
        )

        results_by_batch = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
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
                        self._assign_batch,
                        criteria,
                        batch,
                        batch_index,
                        total_batches,
                    )
                )

                future_map[
                    future
                ] = (
                    batch_index
                )

            for future in (
                as_completed(
                    future_map
                )
            ):
                batch_index = (
                    future_map[
                        future
                    ]
                )

                results_by_batch[
                    batch_index
                ] = (
                    future.result()
                )

                print(
                    "Criterion assignment batch "
                    f"{batch_index}/{total_batches} "
                    "completed."
                )

        global_map = {}

        for batch_index in range(
            1,
            total_batches + 1,
        ):
            if batch_index not in (
                results_by_batch
            ):
                raise RuntimeError(
                    "Missing criterion assignment "
                    f"batch {batch_index}."
                )

            for (
                requirement_id,
                criterion_id,
            ) in (
                results_by_batch[
                    batch_index
                ].items()
            ):
                if requirement_id in (
                    global_map
                ):
                    raise RuntimeError(
                        "Duplicate requirement assignment "
                        f"across batches: {requirement_id}"
                    )

                global_map[
                    requirement_id
                ] = (
                    criterion_id
                )

        expected_ids = [
            item[
                "id"
            ]
            for item
            in requirements
        ]

        if set(
            global_map.keys()
        ) != set(
            expected_ids
        ):
            missing = (
                set(
                    expected_ids
                )
                -
                set(
                    global_map.keys()
                )
            )

            extra = (
                set(
                    global_map.keys()
                )
                -
                set(
                    expected_ids
                )
            )

            raise RuntimeError(
                "Dynamic criterion assignment lost "
                "or invented requirements. "
                f"Missing={sorted(missing)}, "
                f"Extra={sorted(extra)}"
            )

        return (
            global_map
        )

    # =====================================================
    # Build criteria from dynamic assignment
    # =====================================================

    def _build_dynamic_criteria(
        self,
        requirements,
        discovered_criteria,
        assignment_map,
    ):
        requirement_map = {
            item[
                "id"
            ]: item
            for item
            in requirements
        }

        grouped = {
            criterion[
                "criterion_id"
            ]: []
            for criterion
            in discovered_criteria
        }

        for requirement in requirements:
            requirement_id = (
                requirement[
                    "id"
                ]
            )

            criterion_id = (
                assignment_map[
                    requirement_id
                ]
            )

            if criterion_id not in (
                grouped
            ):
                raise RuntimeError(
                    "Assignment references unknown criterion: "
                    f"{criterion_id}"
                )

            grouped[
                criterion_id
            ].append(
                requirement_map[
                    requirement_id
                ]
            )

        # Remove empty criteria defensively.
        active_discovered = [
            criterion
            for criterion
            in discovered_criteria
            if grouped[
                criterion[
                    "criterion_id"
                ]
            ]
        ]

        if len(
            active_discovered
        ) < self.MIN_CRITERIA:
            raise RuntimeError(
                "Dynamic criterion discovery produced "
                "too few active criteria after assignment."
            )

        return (
            active_discovered,
            grouped,
        )

    # =====================================================
    # Dynamic weights
    # =====================================================

    def _has_complete_explicit_weights(
        self,
        criteria,
    ):
        if not criteria:
            return False

        explicit_weights = []

        for criterion in criteria:
            weight = (
                criterion.get(
                    "explicit_weight"
                )
            )

            if weight is None:
                return False

            try:
                weight = float(
                    weight
                )

            except (
                TypeError,
                ValueError,
            ):
                return False

            explicit_weights.append(
                weight
            )

        total = round(
            sum(
                explicit_weights
            ),
            4,
        )

        return (
            abs(
                total
                -
                100.0
            )
            <=
            0.05
        )

    def _normalize_importance_weights(
        self,
        criteria,
    ):
        """
        Normalize criterion importance to 100%.

        Requirement count is intentionally ignored.
        """

        total_importance = sum(
            float(
                criterion.get(
                    "criterion_importance_score",
                    3,
                )
            )
            for criterion
            in criteria
        )

        if total_importance <= 0:
            raise ValueError(
                "Criterion importance total "
                "must be greater than zero."
            )

        weights = {}

        running_total = 0.0

        for (
            index,
            criterion,
        ) in enumerate(
            criteria
        ):
            criterion_id = (
                criterion[
                    "criterion_id"
                ]
            )

            if (
                index
                ==
                len(
                    criteria
                )
                -
                1
            ):
                weight = round(
                    100.0
                    -
                    running_total,
                    2,
                )

            else:
                weight = round(
                    (
                        float(
                            criterion[
                                "criterion_importance_score"
                            ]
                        )
                        /
                        total_importance
                    )
                    *
                    100.0,
                    2,
                )

                running_total += (
                    weight
                )

            weights[
                criterion_id
            ] = (
                weight
            )

        return weights

    def _finalize_criteria_weights(
        self,
        discovered_criteria,
        grouped,
    ):
        use_explicit = (
            self._has_complete_explicit_weights(
                discovered_criteria
            )
        )

        if use_explicit:
            importance_weights = None

            print(
                "Using complete explicit RFP "
                "evaluation weights."
            )

        else:
            importance_weights = (
                self._normalize_importance_weights(
                    discovered_criteria
                )
            )

            print(
                "No complete explicit RFP weight "
                "scheme found."
            )

            print(
                "Using dynamic criterion-level "
                "importance weights."
            )

        final_criteria = []

        for criterion in (
            discovered_criteria
        ):
            criterion_id = (
                criterion[
                    "criterion_id"
                ]
            )

            criterion_requirements = (
                grouped[
                    criterion_id
                ]
            )

            average_requirement_importance = (
                sum(
                    float(
                        item.get(
                            "importance_score",
                            1,
                        )
                    )
                    for item
                    in criterion_requirements
                )
                /
                len(
                    criterion_requirements
                )
            )

            if use_explicit:
                weight = float(
                    criterion[
                        "explicit_weight"
                    ]
                )

                weight_source = (
                    "explicit_rfp"
                )

                weight_evidence = (
                    criterion.get(
                        "explicit_weight_evidence",
                        "",
                    )
                )

            else:
                weight = (
                    importance_weights[
                        criterion_id
                    ]
                )

                weight_source = (
                    "dynamic_criterion_importance"
                )

                weight_evidence = ""

            final_criteria.append(
                {
                    "criterion_id": (
                        criterion_id
                    ),

                    "name": (
                        criterion[
                            "name"
                        ]
                    ),

                    "description": (
                        criterion.get(
                            "description",
                            "",
                        )
                    ),

                    "source": (
                        criterion.get(
                            "source",
                            "RFP"
                        )
                    ),

                    "weight": (
                        round(
                            weight,
                            2,
                        )
                    ),

                    "weight_source": (
                        weight_source
                    ),

                    "weight_evidence": (
                        weight_evidence
                    ),

                    "criterion_importance_score": (
                        criterion[
                            "criterion_importance_score"
                        ]
                    ),

                    "criterion_importance_reason": (
                        criterion.get(
                            "criterion_importance_reason",
                            "",
                        )
                    ),

                    "average_requirement_importance": (
                        round(
                            average_requirement_importance,
                            3,
                        )
                    ),

                    # Backward-compatible alias.
                    "average_importance": (
                        round(
                            average_requirement_importance,
                            3,
                        )
                    ),

                    "requirements": (
                        criterion_requirements
                    ),
                }
            )

        return (
            final_criteria
        )

    # =====================================================
    # Mandatory requirements
    # =====================================================

    def _build_mandatory_requirements(
        self,
        criteria,
    ):
        mandatory = []

        for criterion in criteria:
            for requirement in (
                criterion[
                    "requirements"
                ]
            ):
                if not requirement.get(
                    "mandatory",
                    False,
                ):
                    continue

                mandatory.append(
                    {
                        "id": (
                            requirement[
                                "id"
                            ]
                        ),

                        "requirement_id": (
                            requirement[
                                "id"
                            ]
                        ),

                        "requirement": (
                            requirement[
                                "requirement"
                            ]
                        ),

                        "criterion": (
                            criterion[
                                "name"
                            ]
                        ),

                        "criterion_id": (
                            criterion[
                                "criterion_id"
                            ]
                        ),

                        "source": (
                            requirement[
                                "source"
                            ]
                        ),

                        "page": (
                            requirement.get(
                                "page"
                            )
                        ),

                        "mandatory_evidence": (
                            requirement.get(
                                "mandatory_evidence",
                                "إلزامي",
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
                    }
                )

        return mandatory

    # =====================================================
    # RFP summary
    # =====================================================

    def _build_summary_prompt(
        self,
        rfp_text,
        document_language,
    ):
        return f"""
You are analyzing an RFP.

Dominant document language:

{document_language}

Return the summary in the SAME dominant language as the RFP.

The numbered requirements, mandatory status, criteria,
requirement assignment and criterion weights are handled
separately.

DO NOT extract requirements.
DO NOT invent requirements.
DO NOT calculate requirement counts.
DO NOT calculate criterion weights.

Return ONLY valid JSON:

{{
  "rfp_summary": "Concise factual summary in the RFP language"
}}

<RFP_DOCUMENT>
{rfp_text}
</RFP_DOCUMENT>
"""

    def _generate_summary(
        self,
        rfp_text,
        document_language,
    ):
        prompt = (
            self._build_summary_prompt(
                rfp_text,
                document_language,
            )
        )

        response_text = (
            self.llm.ask(
                prompt,
                label="RFP-Summary",
            )
        )

        try:
            data = (
                self._parse_json(
                    response_text,
                    "RFP summary",
                )
            )

        except Exception:
            if document_language == "Arabic":
                return (
                    "تم استخراج إطار طلب تقديم العروض "
                    "من وثيقة المنافسة المقدمة."
                )

            return (
                "RFP framework extracted from "
                "the submitted procurement document."
            )

        summary = (
            self._normalize_text(
                data.get(
                    "rfp_summary",
                    "",
                )
            )
        )

        if summary:
            return summary

        if document_language == "Arabic":
            return (
                "تم استخراج إطار طلب تقديم العروض "
                "من وثيقة المنافسة المقدمة."
            )

        return (
            "RFP framework extracted from "
            "the submitted procurement document."
        )

    # =====================================================
    # Framework validation
    # =====================================================

    def _validate_framework(
        self,
        criteria,
        requirements,
    ):
        if not requirements:
            raise ValueError(
                "No numbered RFP requirements "
                "were extracted."
            )

        if not criteria:
            raise ValueError(
                "No evaluation criteria "
                "were created."
            )

        grouped_count = sum(
            len(
                criterion[
                    "requirements"
                ]
            )
            for criterion
            in criteria
        )

        if grouped_count != len(
            requirements
        ):
            raise ValueError(
                "Requirement grouping lost data. "
                f"Extracted={len(requirements)}, "
                f"Grouped={grouped_count}"
            )

        grouped_ids = []

        for criterion in criteria:
            grouped_ids.extend(
                requirement[
                    "id"
                ]
                for requirement
                in criterion[
                    "requirements"
                ]
            )

        expected_ids = [
            requirement[
                "id"
            ]
            for requirement
            in requirements
        ]

        if len(
            grouped_ids
        ) != len(
            set(
                grouped_ids
            )
        ):
            raise ValueError(
                "A requirement was assigned to "
                "more than one criterion."
            )

        if set(
            grouped_ids
        ) != set(
            expected_ids
        ):
            missing = (
                set(
                    expected_ids
                )
                -
                set(
                    grouped_ids
                )
            )

            extra = (
                set(
                    grouped_ids
                )
                -
                set(
                    expected_ids
                )
            )

            raise ValueError(
                "Requirement grouping mismatch. "
                f"Missing={sorted(missing)}, "
                f"Extra={sorted(extra)}"
            )

        total_weight = round(
            sum(
                float(
                    criterion[
                        "weight"
                    ]
                )
                for criterion
                in criteria
            ),
            2,
        )

        if abs(
            total_weight
            -
            100.0
        ) > 0.05:
            raise ValueError(
                "Criterion weights do not total 100. "
                f"Current total: {total_weight}"
            )

    # =====================================================
    # Main analysis
    # =====================================================

    def analyze(
        self,
        rfp_text,
    ):
        if not isinstance(
            rfp_text,
            str,
        ):
            raise ValueError(
                "RFP text must be a string."
            )

        rfp_text = (
            rfp_text.strip()
        )

        if not rfp_text:
            raise ValueError(
                "RFP text cannot be empty."
            )

        document_language = (
            self._detect_document_language(
                rfp_text
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP A - EXTRACTING NUMBERED "
            "RFP REQUIREMENTS"
        )
        print(
            "================================"
        )

        requirements = (
            self._extract_numbered_requirements(
                rfp_text
            )
        )

        if not requirements:
            raise RuntimeError(
                "No GEN / REQ numbered requirements "
                "were found in the RFP."
            )

        print()
        print(
            "================================"
        )
        print(
            "STEP B - DISCOVERING DYNAMIC "
            "RFP CRITERIA"
        )
        print(
            "================================"
        )

        discovered_criteria = (
            self._discover_dynamic_criteria(
                rfp_text=rfp_text,
                requirements=requirements,
                document_language=document_language,
            )
        )

        print(
            "Dynamic criteria discovered: "
            f"{len(discovered_criteria)}"
        )

        for criterion in (
            discovered_criteria
        ):
            print(
                "- "
                f"{criterion['criterion_id']} | "
                f"{criterion['name']} | "
                "importance="
                f"{criterion['criterion_importance_score']}"
            )

        print()
        print(
            "================================"
        )
        print(
            "STEP C - ASSIGNING REQUIREMENTS "
            "TO DISCOVERED CRITERIA"
        )
        print(
            "================================"
        )

        assignment_map = (
            self._assign_requirements_to_criteria(
                requirements=requirements,
                criteria=discovered_criteria,
            )
        )

        (
            active_discovered_criteria,
            grouped,
        ) = (
            self._build_dynamic_criteria(
                requirements=requirements,
                discovered_criteria=discovered_criteria,
                assignment_map=assignment_map,
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP D - CALCULATING CRITERION "
            "WEIGHTS"
        )
        print(
            "================================"
        )

        criteria = (
            self._finalize_criteria_weights(
                discovered_criteria=(
                    active_discovered_criteria
                ),
                grouped=grouped,
            )
        )

        mandatory_requirements = (
            self._build_mandatory_requirements(
                criteria
            )
        )

        self._validate_framework(
            criteria=criteria,
            requirements=requirements,
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP E - RFP SUMMARY"
        )
        print(
            "================================"
        )

        rfp_summary = (
            self._generate_summary(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        total_weight = round(
            sum(
                float(
                    criterion[
                        "weight"
                    ]
                )
                for criterion
                in criteria
            ),
            2,
        )

        weight_sources = {
            criterion.get(
                "weight_source",
                "unknown",
            )
            for criterion
            in criteria
        }

        overall_weight_source = (
            next(
                iter(
                    weight_sources
                )
            )
            if len(
                weight_sources
            )
            ==
            1
            else
            "mixed"
        )

        print()
        print(
            "================================"
        )
        print(
            "RFP FRAMEWORK COMPLETE"
        )
        print(
            "================================"
        )
        print(
            f"Document language: "
            f"{document_language}"
        )
        print(
            f"Criteria: "
            f"{len(criteria)}"
        )
        print(
            f"Requirements: "
            f"{len(requirements)}"
        )
        print(
            f"Mandatory: "
            f"{len(mandatory_requirements)}"
        )
        print(
            f"Total Weight: "
            f"{total_weight}%"
        )
        print(
            "Weight Source: "
            f"{overall_weight_source}"
        )

        for criterion in criteria:
            mandatory_count = sum(
                1
                for requirement
                in criterion[
                    "requirements"
                ]
                if requirement.get(
                    "mandatory",
                    False,
                )
            )

            print(
                "- "
                f"{criterion['criterion_id']} | "
                f"{criterion['name']} | "
                f"{len(criterion['requirements'])} "
                "requirements | "
                f"{mandatory_count} mandatory | "
                f"weight={criterion['weight']}% | "
                "criterion_importance="
                f"{criterion['criterion_importance_score']} | "
                f"source={criterion['weight_source']}"
            )

        return {
            "rfp_summary": (
                rfp_summary
            ),

            "document_language": (
                document_language
            ),

            "criteria": (
                criteria
            ),

            "mandatory_requirements": (
                mandatory_requirements
            ),

            "all_requirements": (
                requirements
            ),

            "metadata": {
                "criteria_count": (
                    len(
                        criteria
                    )
                ),

                "requirement_count": (
                    len(
                        requirements
                    )
                ),

                "mandatory_requirement_count": (
                    len(
                        mandatory_requirements
                    )
                ),

                "total_weight": (
                    total_weight
                ),

                "weight_source": (
                    overall_weight_source
                ),

                "document_language": (
                    document_language
                ),

                "requirement_extraction_method": (
                    "deterministic_numbered_parser"
                ),

                "criteria_discovery_method": (
                    "dynamic_llm_discovery"
                ),

                "requirement_assignment_method": (
                    "batched_llm_assignment_with_"
                    "deterministic_validation"
                ),

                "weighting_method": (
                    "explicit_rfp_if_complete_else_"
                    "dynamic_criterion_importance"
                ),

                "criterion_weight_count_independent": (
                    True
                ),

                "dynamic_criteria": (
                    True
                ),
            },
        }

    # =====================================================
    # Cleanup
    # =====================================================

    def close(
        self,
    ):
        self.llm.close()
