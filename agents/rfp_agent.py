import json
import re
from collections import OrderedDict

from services.llm_client import LLMClient


class RFPAgent:
    """
    Analyze an RFP and create a traceable evaluation framework.

    Architecture:

    1. Numbered requirements are extracted deterministically.
    2. Original requirement IDs are preserved.
    3. Explicit mandatory/preferential labels are preserved.
    4. Explicit RFP criterion weights are used when they are
       clearly stated in the RFP.
    5. If explicit criterion weights are not available, each
       requirement receives an importance score from 1 to 5.
    6. Criterion weights are then derived from the summed
       importance of their requirements, not requirement count.
    7. Python performs all final arithmetic deterministically.

    This avoids the previous behavior where a criterion with
    many low-impact requirements automatically received an
    excessive share of the final score.
    """

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

    IMPORTANCE_LEVELS = {
        1: "Low",
        2: "Moderate",
        3: "Important",
        4: "High",
        5: "Critical",
    }

    def __init__(self):
        self.llm = LLMClient()

    # =====================================================
    # Helpers
    # =====================================================

    def _normalize_text(self, value):
        if value is None:
            return ""

        return re.sub(
            r"\s+",
            " ",
            str(value),
        ).strip()

    def _normalize_search_text(self, value):
        return self._normalize_text(value).lower()

    def _clean_json_response(self, response_text):
        if not isinstance(response_text, str):
            raise ValueError(
                "RFP Agent response must be text."
            )

        text = response_text.strip()

        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        return text.strip()

    # =====================================================
    # Requirement ID
    # =====================================================

    def _canonical_requirement_id(self, match):
        gen_forward = match.group(1)
        req_forward = match.group(2)
        gen_reverse = match.group(3)
        req_reverse = match.group(4)

        if gen_forward:
            return f"GEN-{int(gen_forward):03d}"

        if req_forward:
            return f"REQ-{int(req_forward):04d}"

        if gen_reverse:
            return f"GEN-{int(gen_reverse):03d}"

        if req_reverse:
            return f"REQ-{int(req_reverse):04d}"

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

        for match in self.PAGE_PATTERN.finditer(
            text,
            0,
            position,
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
            position - 1600,
        )

        preceding = text[
            start:position
        ]

        lines = [
            self._normalize_text(line)
            for line
            in preceding.splitlines()
            if self._normalize_text(line)
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

        for line in reversed(lines):
            normalized = line.lower()

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

            if len(line) > 120:
                continue

            if len(line) < 3:
                continue

            return line

        return "RFP"

    # =====================================================
    # Requirement metadata
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

            evidence = self._normalize_text(
                evidence
            )

            if evidence:
                return evidence

        return ""

    def _extract_requirement_status(
        self,
        block,
    ):
        normalized = (
            block
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

        mandatory_pos = normalized.find(
            "إلزامي"
        )

        preferred_pos = normalized.find(
            "تفضيلي"
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
        text = str(block)

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

        for pattern in split_patterns:
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
                :min(cut_positions)
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

        return self._normalize_text(
            text
        )

    # =====================================================
    # Importance model
    # =====================================================

    def _calculate_requirement_importance(
        self,
        requirement,
    ):
        """
        Produce a deterministic importance score from 1 to 5.

        The score uses evidence in the RFP itself:
        - explicit mandatory/preferential status
        - security/privacy/regulatory language
        - patient safety and clinical continuity
        - availability/DR/RTO/RPO/SLA thresholds
        - critical integration/interoperability
        - migration/data integrity
        - explicit quantitative thresholds
        - general operational significance

        No LLM call is required per requirement.
        """

        text = self._normalize_search_text(
            requirement.get(
                "requirement",
                "",
            )
        )

        section = self._normalize_search_text(
            requirement.get(
                "section",
                "",
            )
        )

        evidence = self._normalize_search_text(
            requirement.get(
                "response_evidence_required",
                "",
            )
        )

        combined = (
            f"{section} {text} {evidence}"
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

        # Base score
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

        # Critical domains
        critical_domain_groups = {
            "Cybersecurity / Privacy": [
                "الأمن السيبراني",
                "الأمن",
                "الخصوصية",
                "حماية البيانات",
                "تشفير",
                "التشفير",
                "صلاحيات",
                "التحكم بالوصول",
                "اختراق",
                "security",
                "cybersecurity",
                "privacy",
                "encryption",
                "access control",
                "authentication",
                "authorization",
            ],
            "Patient Safety / Clinical Continuity": [
                "سلامة المريض",
                "سلامة المرضى",
                "patient safety",
                "clinical safety",
                "استمرارية الرعاية",
                "continuity of care",
                "الأدوية",
                "medication",
                "حساسية",
                "allergy",
                "جرعة",
                "dose",
            ],
            "Availability / Disaster Recovery": [
                "التوافر",
                "عالي التوافر",
                "استمرارية الأعمال",
                "التعافي من الكوارث",
                "rto",
                "rpo",
                "disaster recovery",
                "business continuity",
                "high availability",
                "uptime",
                "availability",
                "failover",
            ],
            "Regulatory / Legal Compliance": [
                "امتثال",
                "تنظيمي",
                "قانوني",
                "تشريعي",
                "سياسة إلزامية",
                "compliance",
                "regulatory",
                "legal",
                "law",
                "policy requirement",
            ],
        }

        for domain, keywords in (
            critical_domain_groups.items()
        ):
            if any(
                keyword in combined
                for keyword
                in keywords
            ):
                score = max(
                    score,
                    5,
                )
                reasons.append(
                    domain
                )

        # High-impact domains
        high_impact_groups = {
            "Critical Integration / Interoperability": [
                "التكامل",
                "التشغيل البيني",
                "hl7",
                "fhir",
                "dicom",
                "api",
                "integration",
                "interoperability",
            ],
            "Migration / Data Integrity": [
                "ترحيل البيانات",
                "جودة البيانات",
                "سلامة البيانات",
                "تكامل البيانات",
                "data migration",
                "data quality",
                "data integrity",
                "data validation",
            ],
            "Core Clinical / Operational Capability": [
                "السجل الصحي",
                "السجل الطبي",
                "ehr",
                "emr",
                "المرضى",
                "المريض",
                "patient",
                "clinical",
                "الطوارئ",
                "emergency",
                "المختبر",
                "laboratory",
                "الأشعة",
                "radiology",
                "الصيدلية",
                "pharmacy",
            ],
        }

        for domain, keywords in (
            high_impact_groups.items()
        ):
            if any(
                keyword in combined
                for keyword
                in keywords
            ):
                score = max(
                    score,
                    4,
                )
                reasons.append(
                    domain
                )

        # Explicit measurable threshold / SLA
        threshold_patterns = [
            r"\b\d+(?:\.\d+)?\s*%",
            r"\b\d+\s*(?:ms|sec|second|seconds|minute|minutes|hour|hours)\b",
            r"\b\d+\s*(?:ثانية|ثوان|دقيقة|دقائق|ساعة|ساعات)\b",
            r"\b(rto|rpo|sla)\b",
            r"\b\d+(?:\.\d+)?\s*(?:gb|tb|mb)\b",
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
                "Explicit measurable threshold / SLA"
            )

        # Response evidence that asks for formal proof raises
        # importance at least one level, capped at 5.
        formal_evidence_keywords = [
            "شهادة",
            "تقرير",
            "إثبات",
            "وثيقة",
            "اعتماد",
            "certificate",
            "certification",
            "report",
            "evidence",
            "document",
            "audit",
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

        # Preferential requirements should not become Critical
        # merely because they contain a broad keyword.
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

        # De-duplicate reasons while preserving order.
        clean_reasons = []

        for reason in reasons:
            if reason not in clean_reasons:
                clean_reasons.append(
                    reason
                )

        return {
            "importance_score": (
                score
            ),
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

        for index, match in enumerate(
            matches
        ):
            requirement_id = (
                self._canonical_requirement_id(
                    match
                )
            )

            if not requirement_id:
                continue

            if requirement_id in extracted:
                continue

            block_start = match.end()

            if (
                index + 1
                <
                len(matches)
            ):
                block_end = (
                    matches[
                        index + 1
                    ].start()
                )
            else:
                block_end = len(
                    rfp_text
                )

            raw_block = rfp_text[
                block_start:block_end
            ]

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

            importance = (
                self._calculate_requirement_importance(
                    requirement
                )
            )

            requirement.update(
                importance
            )

            extracted[
                requirement_id
            ] = requirement

        requirements = list(
            extracted.values()
        )

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

        return requirements

    # =====================================================
    # Criterion classification
    # =====================================================

    def _classify_requirement(
        self,
        requirement,
    ):
        text = self._normalize_search_text(
            requirement.get(
                "requirement",
                "",
            )
        )

        section = self._normalize_search_text(
            requirement.get(
                "section",
                "",
            )
        )

        combined = (
            f"{section} {text}"
        )

        # Financial Proposal means vendor commercial/pricing,
        # not hospital operational finance functionality.
        financial_keywords = [
            "العرض المالي",
            "الأسعار المقدمة",
            "جدول الأسعار",
            "التسعير التجاري",
            "تكلفة العرض",
            "قيمة العرض",
            "commercial proposal",
            "financial proposal",
            "pricing schedule",
            "bid price",
            "proposal price",
            "total cost of ownership",
            "tco",
        ]

        if any(
            keyword in combined
            for keyword
            in financial_keywords
        ):
            return "financial"

        team_keywords = [
            "فريق المشروع",
            "الموارد المقترحة",
            "أعضاء الفريق",
            "السيرة الذاتية",
            "الشهادات المهنية",
            "خبرات الفريق",
            "key personnel",
            "key staff",
            "project team",
            "professional certification",
            "professional certifications",
            "key experts",
            "cv",
            "resume",
        ]

        if any(
            keyword in combined
            for keyword
            in team_keywords
        ):
            return "team"

        experience_keywords = [
            "خبرة مقدم العرض",
            "خبرة الشركة",
            "الخبرات السابقة",
            "مشاريع مماثلة",
            "مشروعات مماثلة",
            "مراجع العملاء",
            "vendor experience",
            "company experience",
            "past performance",
            "similar project",
            "similar projects",
            "track record",
            "client references",
        ]

        if any(
            keyword in combined
            for keyword
            in experience_keywords
        ):
            return "experience"

        project_plan_keywords = [
            "الحوكمة",
            "إدارة المشروع",
            "خطة المشروع",
            "الجدول الزمني",
            "إدارة المخاطر",
            "مرحلة الاكتشاف",
            "التحليل والتصميم",
            "خطة التنفيذ",
            "خطة الترحيل",
            "خطة الاختبارات",
            "خطة التدريب",
            "إدارة التغيير",
            "خطة الدعم",
            "project management",
            "project plan",
            "implementation plan",
            "timeline",
            "schedule",
            "migration plan",
            "testing plan",
            "training plan",
            "change management",
        ]

        if any(
            keyword in combined
            for keyword
            in project_plan_keywords
        ):
            return "project_plan"

        return "technical"

    def _group_requirements(
        self,
        requirements,
    ):
        grouped = {
            "technical": [],
            "project_plan": [],
            "experience": [],
            "team": [],
            "financial": [],
        }

        for requirement in requirements:
            requirement_type = (
                self._classify_requirement(
                    requirement
                )
            )

            grouped[
                requirement_type
            ].append(
                requirement
            )

        return grouped

    # =====================================================
    # Explicit weight detection
    # =====================================================

    def _build_explicit_weight_prompt(
        self,
        rfp_text,
    ):
        return f"""
You are reviewing an RFP only to determine whether it
contains EXPLICIT evaluation/scoring weights for vendor
evaluation criteria.

Do NOT infer weights.
Do NOT calculate weights from requirement counts.
Do NOT invent criteria.
Do NOT treat operational percentages, SLAs, penalties,
availability percentages, taxes, discounts, or technical
thresholds as evaluation weights.

A valid explicit weight must clearly state that a named
evaluation criterion contributes a specific percentage or
points to the vendor/bid evaluation score.

Return ONLY valid JSON:

{{
  "explicit_weights_found": true,
  "criteria": [
    {{
      "criterion_type": "technical",
      "weight": 50,
      "source_text": "Exact or near-exact RFP evidence"
    }}
  ]
}}

Allowed criterion_type values:
- technical
- project_plan
- experience
- team
- financial

If no explicit evaluation weights are clearly stated,
return:

{{
  "explicit_weights_found": false,
  "criteria": []
}}

<RFP_DOCUMENT>
{rfp_text}
</RFP_DOCUMENT>
"""

    def _extract_explicit_weights(
        self,
        rfp_text,
        grouped,
    ):
        prompt = (
            self._build_explicit_weight_prompt(
                rfp_text
            )
        )

        response_text = (
            self.llm.ask(
                prompt,
                label="RFP-ExplicitWeights",
            )
        )

        cleaned = (
            self._clean_json_response(
                response_text
            )
        )

        try:
            data = json.loads(
                cleaned
            )
        except json.JSONDecodeError:
            return None

        if not isinstance(
            data,
            dict,
        ):
            return None

        if not data.get(
            "explicit_weights_found",
            False,
        ):
            return None

        raw_criteria = data.get(
            "criteria",
            [],
        )

        if not isinstance(
            raw_criteria,
            list,
        ):
            return None

        allowed_types = {
            key
            for key, value
            in grouped.items()
            if value
        }

        weights = {}
        sources = {}

        for item in raw_criteria:
            if not isinstance(
                item,
                dict,
            ):
                continue

            criterion_type = str(
                item.get(
                    "criterion_type",
                    "",
                )
            ).strip().lower()

            if criterion_type not in (
                allowed_types
            ):
                continue

            try:
                weight = float(
                    item.get(
                        "weight"
                    )
                )
            except (
                TypeError,
                ValueError,
            ):
                continue

            if (
                weight <= 0
                or
                weight > 100
            ):
                continue

            weights[
                criterion_type
            ] = weight

            sources[
                criterion_type
            ] = self._normalize_text(
                item.get(
                    "source_text",
                    "",
                )
            )

        if set(weights) != allowed_types:
            # Do not use a partial explicit scheme because
            # that would silently assign missing criteria 0%.
            return None

        total = round(
            sum(
                weights.values()
            ),
            4,
        )

        if abs(
            total - 100.0
        ) > 0.05:
            return None

        return {
            "weights": weights,
            "sources": sources,
        }

    # =====================================================
    # Importance-derived weights
    # =====================================================

    def _calculate_importance_weights(
        self,
        grouped,
    ):
        non_empty = {
            key: value
            for key, value
            in grouped.items()
            if value
        }

        importance_totals = {
            key: sum(
                float(
                    requirement.get(
                        "importance_score",
                        1,
                    )
                )
                for requirement
                in requirements
            )
            for key, requirements
            in non_empty.items()
        }

        grand_total = sum(
            importance_totals.values()
        )

        if grand_total <= 0:
            raise ValueError(
                "Unable to calculate importance-derived "
                "criterion weights."
            )

        keys = list(
            non_empty.keys()
        )

        weights = {}
        running_total = 0.0

        for index, key in enumerate(
            keys
        ):
            if index == len(keys) - 1:
                weight = round(
                    100.0 - running_total,
                    2,
                )
            else:
                weight = round(
                    (
                        importance_totals[
                            key
                        ]
                        /
                        grand_total
                    )
                    *
                    100.0,
                    2,
                )

                running_total += weight

            weights[
                key
            ] = weight

        return (
            weights,
            importance_totals,
        )

    # =====================================================
    # Criterion display
    # =====================================================

    def _criterion_definition(
        self,
        criterion_type,
    ):
        definitions = {
            "technical": {
                "name": (
                    "Technical Requirements"
                ),
                "description": (
                    "Functional, clinical, integration, "
                    "security, data, architecture, platform "
                    "and non-functional requirements."
                ),
            },
            "project_plan": {
                "name": (
                    "Project Plan & Implementation"
                ),
                "description": (
                    "Governance, project management, "
                    "implementation, migration, testing, "
                    "training, change management and "
                    "delivery requirements."
                ),
            },
            "experience": {
                "name": (
                    "Vendor Experience"
                ),
                "description": (
                    "Vendor experience, references and "
                    "previous implementation requirements."
                ),
            },
            "team": {
                "name": (
                    "Team Qualifications"
                ),
                "description": (
                    "Project team, personnel, qualification "
                    "and professional certification "
                    "requirements."
                ),
            },
            "financial": {
                "name": (
                    "Financial Proposal"
                ),
                "description": (
                    "Vendor pricing, commercial offer, "
                    "cost and financial proposal "
                    "requirements."
                ),
            },
        }

        return definitions[
            criterion_type
        ]

    # =====================================================
    # Build criteria
    # =====================================================

    def _build_criteria(
        self,
        requirements,
        rfp_text,
    ):
        grouped = (
            self._group_requirements(
                requirements
            )
        )

        explicit = (
            self._extract_explicit_weights(
                rfp_text=rfp_text,
                grouped=grouped,
            )
        )

        importance_totals = {}

        if explicit:
            weights = explicit[
                "weights"
            ]

            weight_source = (
                "explicit_rfp"
            )

            weight_sources = explicit[
                "sources"
            ]

            print(
                "Using explicit RFP criterion weights."
            )

        else:
            (
                weights,
                importance_totals,
            ) = (
                self._calculate_importance_weights(
                    grouped
                )
            )

            weight_source = (
                "importance_derived"
            )

            weight_sources = {}

            print(
                "No complete explicit RFP weight scheme "
                "found."
            )

            print(
                "Using importance-derived criterion weights."
            )

        criteria = []

        order = [
            "technical",
            "project_plan",
            "experience",
            "team",
            "financial",
        ]

        for criterion_type in order:
            criterion_requirements = grouped[
                criterion_type
            ]

            if not criterion_requirements:
                continue

            definition = (
                self._criterion_definition(
                    criterion_type
                )
            )

            importance_total = sum(
                float(
                    item.get(
                        "importance_score",
                        1,
                    )
                )
                for item
                in criterion_requirements
            )

            average_importance = round(
                importance_total
                /
                len(
                    criterion_requirements
                ),
                2,
            )

            criteria.append(
                {
                    "name": (
                        definition[
                            "name"
                        ]
                    ),
                    "criterion_type": (
                        criterion_type
                    ),
                    "description": (
                        definition[
                            "description"
                        ]
                    ),
                    "source": (
                        "RFP numbered requirements"
                    ),
                    "weight": (
                        weights.get(
                            criterion_type,
                            0,
                        )
                    ),
                    "weight_source": (
                        weight_source
                    ),
                    "weight_evidence": (
                        weight_sources.get(
                            criterion_type,
                            "",
                        )
                    ),
                    "importance_total": (
                        round(
                            importance_total,
                            2,
                        )
                    ),
                    "average_importance": (
                        average_importance
                    ),
                    "requirements": (
                        criterion_requirements
                    ),
                }
            )

        return criteria

    # =====================================================
    # Mandatory list
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
    # Summary
    # =====================================================

    def _build_summary_prompt(
        self,
        rfp_text,
    ):
        return f"""
You are analyzing an RFP.

The numbered requirements, mandatory status, importance
scores and criterion weights are handled separately.

DO NOT extract requirements.
DO NOT invent requirements.
DO NOT calculate requirement counts.
DO NOT calculate criterion weights.

Your only task is to return a concise factual summary
of the RFP.

Return ONLY valid JSON:

{{
  "rfp_summary": "Concise factual summary"
}}

<RFP_DOCUMENT>
{rfp_text}
</RFP_DOCUMENT>
"""

    def _generate_summary(
        self,
        rfp_text,
    ):
        prompt = (
            self._build_summary_prompt(
                rfp_text
            )
        )

        response_text = (
            self.llm.ask(
                prompt,
                label="RFP-Summary",
            )
        )

        cleaned = (
            self._clean_json_response(
                response_text
            )
        )

        try:
            data = json.loads(
                cleaned
            )
        except json.JSONDecodeError:
            return (
                "RFP framework extracted from "
                "the submitted procurement document."
            )

        summary = str(
            data.get(
                "rfp_summary",
                "",
            )
        ).strip()

        if not summary:
            return (
                "RFP framework extracted from "
                "the submitted procurement document."
            )

        return summary

    # =====================================================
    # Validation
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

        if (
            grouped_count
            !=
            len(
                requirements
            )
        ):
            raise ValueError(
                "Requirement grouping lost data. "
                f"Extracted={len(requirements)}, "
                f"Grouped={grouped_count}"
            )

        requirement_ids = [
            item[
                "id"
            ]
            for item
            in requirements
        ]

        if (
            len(requirement_ids)
            !=
            len(set(requirement_ids))
        ):
            raise ValueError(
                "Duplicate RFP requirement IDs "
                "were detected."
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
            total_weight - 100.0
        ) > 0.05:
            raise ValueError(
                "Criterion weights do not total 100. "
                f"Current total: {total_weight}"
            )

    # =====================================================
    # Main
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

        rfp_text = rfp_text.strip()

        if not rfp_text:
            raise ValueError(
                "RFP text cannot be empty."
            )

        print()
        print(
            "================================"
        )
        print(
            "STEP A - EXTRACTING NUMBERED RFP REQUIREMENTS"
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
            "STEP B - BUILDING CRITERIA & WEIGHTS"
        )
        print(
            "================================"
        )

        criteria = (
            self._build_criteria(
                requirements=(
                    requirements
                ),
                rfp_text=(
                    rfp_text
                ),
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
            "STEP C - RFP SUMMARY"
        )
        print(
            "================================"
        )

        rfp_summary = (
            self._generate_summary(
                rfp_text
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
            next(iter(weight_sources))
            if len(weight_sources) == 1
            else "mixed"
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
            f"Criteria: {len(criteria)}"
        )
        print(
            f"Requirements: {len(requirements)}"
        )
        print(
            f"Mandatory: {len(mandatory_requirements)}"
        )
        print(
            f"Total Weight: {total_weight}%"
        )
        print(
            "Weight Source: "
            f"{overall_weight_source}"
        )

        for criterion in criteria:
            print(
                "- "
                f"{criterion['name']}: "
                f"{len(criterion['requirements'])} "
                "requirements | "
                f"weight={criterion['weight']}% | "
                f"avg_importance="
                f"{criterion['average_importance']} | "
                f"source="
                f"{criterion['weight_source']}"
            )

        return {
            "rfp_summary": (
                rfp_summary
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
                    len(criteria)
                ),
                "requirement_count": (
                    len(requirements)
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
                "requirement_extraction_method": (
                    "deterministic_numbered_parser"
                ),
                "weighting_method": (
                    "explicit_rfp_if_complete_else_"
                    "importance_derived"
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
