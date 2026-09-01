import json
import re
import unicodedata
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

from services.llm_client import LLMClient


class RFPAgent:
    """
    Dynamic, domain-agnostic RFP analysis.

    Supports two deterministic requirement-extraction modes:

    1) Canonical IDs:
       GEN-001 / REQ-0001 and reverse variants.

    2) Structured fallback:
       If no GEN/REQ IDs exist, requirements are extracted from:
       - numbered clauses
       - bullet points
       - requirement-like sentences containing mandatory/action language

       Synthetic IDs REQ-0001, REQ-0002, ... are then assigned in
       original document order.

    The LLM does NOT control the final requirement count.
    It only:
    - discovers evaluation criteria
    - assigns already-extracted requirement IDs to criteria
    - summarizes the RFP
    """

    # =====================================================
    # Canonical requirement IDs
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
    # Fallback structured extraction
    # =====================================================

    NUMBERED_LINE_PATTERN = re.compile(
        r"""
        ^\s*
        (?:
            [\.\-]?\s*\d+(?:\.\d+){0,5}\s*[\)\.\-:]?
            |
            [أابتثجحخدذرزسشصضطظعغفقكلمنهوي]\s*[\)\.\-:]
            |
            [A-Za-z]\s*[\)\.\-:]
        )
        \s*
        (?P<body>.+?)
        \s*$
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    BULLET_LINE_PATTERN = re.compile(
        r"""
        ^\s*
        [\-\u2022\u25AA\u25CF\u25E6\u00B7\u25A0\u25B8\u2023]
        \s*
        (?P<body>.+?)
        \s*$
        """,
        flags=re.VERBOSE,
    )

    REQUIREMENT_CUE_PATTERN = re.compile(
        r"""
        (?:
            \bshall\b
            |
            \bmust\b
            |
            \brequired\b
            |
            \bshould\b
            |
            \bvendor\s+shall\b
            |
            \bbidder\s+shall\b
            |
            \bcontractor\s+shall\b
            |
            يجب
            |
            يتعين
            |
            يلتزم
            |
            مطلوب
            |
            على\s+مقدم\s+العرض
            |
            على\s+مقدم\s+الخدمة
            |
            على\s+المورد
            |
            يشترط
            |
            يلزم
            |
            ينبغي
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    MANDATORY_CUE_PATTERN = re.compile(
        r"""
        (?:
            \bshall\b
            |
            \bmust\b
            |
            \brequired\b
            |
            \bmandatory\b
            |
            يجب
            |
            يتعين
            |
            يلتزم
            |
            إلزامي
            |
            إلزامى
            |
            يشترط
            |
            يلزم
            |
            على\s+مقدم\s+العرض
            |
            على\s+مقدم\s+الخدمة
            |
            على\s+المورد
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    HEADING_LIKE_PATTERN = re.compile(
        r"""
        ^\s*
        (?:
            الفصل
            |
            الباب
            |
            القسم
            |
            Chapter
            |
            Section
            |
            Part
        )
        \b
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    REQUIREMENT_SECTION_KEYWORDS = (
        "قائمة التدقيق",
        "قائمة التدقیق",
        "نطاق العمل",
        "نطــاق العمــــل",
        "المخرجات",
        "مواصفات فنية",
        "مواصفات فنیة",
        "المواصفات الفنية",
        "المواصفات الفنیة",
        "المتطلبات الفنية",
        "المتطلبات الفنیة",
        "طريقة تقديم العرض",
        "طريقة تقدیم العرض",
        "تقييم العروض",
        "تقییم العروض",
        "أحكام عامة",
        "التزامات هامة",
        "التزامات ھامة",
        "جدول الدفعات",
        "إدارة المشروع",
        "إدارة معلومات المشروع",
        "إدارة الموارد خلال تنفيذ المشروع",
        "إدارة الموارد خلال تنفیذ المشروع",
        "الشروط",
        "متطلبات",
        "requirements",
        "scope of work",
        "scope",
        "deliverables",
        "technical specifications",
        "specifications",
        "submission requirements",
        "evaluation",
        "terms and conditions",
        "obligations",
        "payment schedule",
        "project management",
        "checklist",
    )

    CONTEXT_SECTION_KEYWORDS = (
        "جدول المحتويات",
        "بيان بالمعلومات",
        "بیان بالمعلومات",
        "معلومات التواصل",
        "جهة الإصدار",
        "جھة الإصدار",
        "نظرة عامة",
        "اختصاصات المؤسسة",
        "الركائز",
        "مراكز الملك سلمان",
        "حالة المشاريع",
        "هدف المشروع",
        "ھدف المشروع",
        "background",
        "overview",
        "about the organization",
        "organization profile",
        "project background",
        "project objective",
        "objectives",
    )

    # =====================================================
    # Dynamic criteria
    # =====================================================

    MIN_CRITERIA = 2
    MAX_CRITERIA = 12

    ASSIGNMENT_BATCH_SIZE = 45
    MAX_ASSIGNMENT_WORKERS = 2
    MAX_ASSIGNMENT_RETRIES = 1

    DISCOVERY_REQUIREMENT_TEXT_LIMIT = 180
    DISCOVERY_RFP_CONTEXT_LIMIT = 40000
    MAX_DISCOVERY_RETRIES = 2

    # Last-resort extraction for RFPs whose PDF text layout
    # is too irregular for the deterministic line parser.
    LLM_EXTRACTION_CHUNK_CHARS = 12000
    MAX_LLM_EXTRACTION_WORKERS = 2
    MAX_LLM_EXTRACTION_RETRIES = 1
    MIN_FALLBACK_REQUIREMENTS = 3

    IMPORTANCE_LEVELS = {
        1: "Low",
        2: "Moderate",
        3: "Important",
        4: "High",
        5: "Critical",
    }

    def __init__(self):
        self.llm = LLMClient()
        self.requirement_extraction_method = "unknown"

    # =====================================================
    # Generic helpers
    # =====================================================

    def _normalize_text(self, value):
        if value is None:
            return ""

        text = str(value)

        # PyMuPDF often extracts Arabic PDFs using Arabic Presentation
        # Forms (e.g. "ﺗﻮﻓﯿﺮ" instead of "توفير"). NFKC converts those
        # glyph forms back to normal Unicode letters so our Arabic
        # regexes, section matching, and source validation work.
        text = unicodedata.normalize(
            "NFKC",
            text,
        )

        # Remove bidi / zero-width formatting characters that commonly
        # appear in Arabic PDFs and can break exact/token matching.
        text = re.sub(
            r"[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]",
            "",
            text,
        )

        # Normalize a few common Arabic/Persian code-point variants
        # without changing the wording.
        text = (
            text
            .replace("ى", "ي")
            .replace("ی", "ي")
            .replace("ک", "ك")
            .replace("ۀ", "ة")
            .replace("ة", "ة")
        )

        return re.sub(
            r"\s+",
            " ",
            text,
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

    def _parse_json(self, response_text, context_label):
        cleaned = self._clean_json_response(
            response_text
        )

        try:
            return json.loads(cleaned)

        except json.JSONDecodeError:
            extracted = self._extract_first_json_object(
                cleaned
            )

            if extracted:
                try:
                    return json.loads(extracted)
                except json.JSONDecodeError:
                    pass

            raise ValueError(
                "%s returned invalid JSON."
                % context_label
            )

    # =====================================================
    # Language
    # =====================================================

    def _detect_document_language(self, text):
        sample = text[:50000]

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

        if arabic_chars > latin_chars:
            return "Arabic"

        if latin_chars > arabic_chars:
            return "English"

        return "mixed"

    # =====================================================
    # Canonical IDs
    # =====================================================

    def _canonical_requirement_id(self, match):
        gen_forward = match.group(1)
        req_forward = match.group(2)
        gen_reverse = match.group(3)
        req_reverse = match.group(4)

        if gen_forward:
            return "GEN-%03d" % int(gen_forward)

        if req_forward:
            return "REQ-%04d" % int(req_forward)

        if gen_reverse:
            return "GEN-%03d" % int(gen_reverse)

        if req_reverse:
            return "REQ-%04d" % int(req_reverse)

        return None

    # =====================================================
    # Source / page
    # =====================================================

    def _find_page_number(self, text, position):
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
            except (TypeError, ValueError):
                continue

        return page_number

    def _extract_source_heading(self, text, position):
        start = max(
            0,
            position - 1800,
        )

        preceding = text[start:position]

        lines = [
            self._normalize_text(line)
            for line in preceding.splitlines()
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
                for ignored in ignored_patterns
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
    # Requirement metadata
    # =====================================================

    def _extract_response_evidence(self, block):
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

            evidence = match.group(1).strip()

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

    def _extract_requirement_status(self, block):
        normalized = str(block).replace(
            "إلزامى",
            "إلزامي",
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

        if has_mandatory and not has_preferred:
            return True, "إلزامي"

        if has_preferred and not has_mandatory:
            return False, "تفضيلي"

        if self.MANDATORY_CUE_PATTERN.search(
            normalized
        ):
            return True, "إلزامي"

        return False, ""

    def _clean_requirement_body(self, block):
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
            text = text[:min(cut_positions)]

        text = re.sub(
            r"\[Page\s+\d+\]",
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

    def _calculate_requirement_importance(
        self,
        requirement,
    ):
        text = self._normalize_search_text(
            requirement.get(
                "requirement",
                "",
            )
        )

        evidence = self._normalize_search_text(
            requirement.get(
                "response_evidence_required",
                "",
            )
        )

        combined = "%s %s" % (
            text,
            evidence,
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
                "Explicit or inferred mandatory requirement"
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
            "سلامة",
            "أمن",
            "خصوصية",
            "حماية",
            "قانون",
            "لائحة",
            "امتثال",
            "ترخيص",
            "اعتماد",
            "استمرارية",
            "تعافي",
            "disqualification",
            "eligibility",
            "pass/fail",
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
            for keyword in critical_keywords
        ):
            score = max(score, 5)
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
            "minimum",
            "maximum",
            "deadline",
            "warranty",
            "penalty",
        ]

        if any(
            keyword in combined
            for keyword in high_keywords
        ):
            score = max(score, 4)
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
            for pattern in threshold_patterns
        ):
            score = max(score, 4)
            reasons.append(
                "Explicit measurable threshold"
            )

        if preferential:
            score = min(score, 3)

        score = int(
            max(
                1,
                min(
                    5,
                    score,
                ),
            )
        )

        unique_reasons = []

        for reason in reasons:
            if reason not in unique_reasons:
                unique_reasons.append(
                    reason
                )

        return {
            "importance_score": score,
            "importance_level": (
                self.IMPORTANCE_LEVELS[
                    score
                ]
            ),
            "importance_reason": "; ".join(
                unique_reasons
            ),
        }

    # =====================================================
    # Canonical GEN/REQ extraction
    # =====================================================

    def _extract_numbered_requirements(
        self,
        rfp_text,
    ):
        matches = list(
            self.REQUIREMENT_ID_PATTERN.finditer(
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

            if index + 1 < len(matches):
                block_end = (
                    matches[index + 1].start()
                )
            else:
                block_end = len(rfp_text)

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

            mandatory, requirement_type = (
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
                    "Page %s"
                    % page_number
                )

            if heading:
                source_parts.append(
                    heading
                )

            source = (
                " - ".join(source_parts)
                or
                "RFP"
            )

            requirement = {
                "id": requirement_id,
                "requirement": requirement_text,
                "source": source,
                "page": page_number,
                "section": heading,
                "mandatory": mandatory,
                "requirement_type": requirement_type,
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
            ] = requirement

        return list(
            extracted.values()
        )

    # =====================================================
    # Structured fallback extraction
    # =====================================================

    def _is_noise_line(self, line):
        normalized = self._normalize_text(
            line
        )

        if not normalized:
            return True

        if len(normalized) < 3:
            return True

        if self.PAGE_PATTERN.fullmatch(
            normalized
        ):
            return True

        if re.fullmatch(
            r"صفحة\s+\d+\s+من\s+\d+",
            normalized,
            flags=re.IGNORECASE,
        ):
            return True

        if re.fullmatch(
            r"\d+",
            normalized,
        ):
            return True

        if normalized.lower() in {
            "rfp",
            "request for proposal",
            "طلب تقديم عروض",
            "كراسة الشروط والمواصفات",
        }:
            return True

        return False

    def _normalize_heading_key(self, value):
        text = self._normalize_search_text(
            value
        )

        text = (
            text
            .replace("ـ", "")
            .replace("أ", "ا")
            .replace("إ", "ا")
            .replace("آ", "ا")
            .replace("ى", "ي")
            .replace("ة", "ه")
        )

        return text

    def _section_is_requirement_bearing(
        self,
        heading,
    ):
        normalized = (
            self._normalize_heading_key(
                heading
            )
        )

        if not normalized:
            return False

        for keyword in (
            self.REQUIREMENT_SECTION_KEYWORDS
        ):
            if (
                self._normalize_heading_key(
                    keyword
                )
                in
                normalized
            ):
                return True

        return False

    def _section_is_context_only(
        self,
        heading,
    ):
        normalized = (
            self._normalize_heading_key(
                heading
            )
        )

        if not normalized:
            return False

        for keyword in (
            self.CONTEXT_SECTION_KEYWORDS
        ):
            if (
                self._normalize_heading_key(
                    keyword
                )
                in
                normalized
            ):
                return True

        return False

    def _looks_like_heading(self, line):
        normalized = self._normalize_text(
            line
        )

        if not normalized:
            return False

        if self.HEADING_LIKE_PATTERN.search(
            normalized
        ):
            return True

        if self._section_is_requirement_bearing(
            normalized
        ):
            return True

        if self._section_is_context_only(
            normalized
        ):
            return True

        if len(normalized) <= 100:
            if not self.REQUIREMENT_CUE_PATTERN.search(
                normalized
            ):
                word_count = len(
                    normalized.split()
                )

                if word_count <= 9:
                    if not re.search(
                        r"[.!؟?؛;]$",
                        normalized,
                    ):
                        return True

        return False

    def _extract_structural_body(
        self,
        line,
    ):
        numbered_match = (
            self.NUMBERED_LINE_PATTERN.match(
                line
            )
        )

        if numbered_match:
            body = self._normalize_text(
                numbered_match.group(
                    "body"
                )
            )

            return (
                "numbered",
                body,
            )

        bullet_match = (
            self.BULLET_LINE_PATTERN.match(
                line
            )
        )

        if bullet_match:
            body = self._normalize_text(
                bullet_match.group(
                    "body"
                )
            )

            return (
                "bullet",
                body,
            )

        # PyMuPDF sometimes places the bullet after bidi reordering,
        # so accept a visible bullet anywhere near the start.
        loose_bullet = re.match(
            r"^\s*.{0,3}?[\u2022\u25AA\u25CF\u25E6\u00B7\u25A0]\s*(.+)$",
            line,
        )

        if loose_bullet:
            body = self._normalize_text(
                loose_bullet.group(1)
            )

            return (
                "bullet",
                body,
            )

        return (
            None,
            None,
        )

    def _flush_fallback_candidate(
        self,
        candidates,
        current_candidate,
    ):
        if not current_candidate:
            return None

        text = self._clean_requirement_body(
            current_candidate.get(
                "text",
                "",
            )
        )

        if len(text) < 10:
            return None

        candidate = dict(
            current_candidate
        )

        candidate["text"] = text

        candidates.append(
            candidate
        )

        return None

    def _extract_structured_fallback_requirements(
        self,
        rfp_text,
    ):
        """
        Deterministic fallback for ordinary RFPs without GEN/REQ IDs.

        It understands common PDF extraction shapes including:
        - .1 item
        - -1 item
        - 1. item
        - 1) item
        - Arabic letter sub-items (أ. / ب- / ت:)
        - bullet items
        - requirement sentences using must/shall/يجب/يلتزم/etc.

        It is section-aware so descriptive background bullets do not
        automatically become evaluation requirements.
        """

        lines = rfp_text.splitlines()

        candidates = []

        current_page = None
        current_heading = "RFP"
        requirement_section = False
        context_section = False

        current_candidate = None

        search_position = 0

        for raw_line in lines:
            line = self._normalize_text(
                raw_line
            )

            line_position = rfp_text.find(
                raw_line,
                search_position,
            )

            if line_position < 0:
                line_position = search_position

            search_position = max(
                line_position + len(raw_line),
                search_position,
            )

            page_match = self.PAGE_PATTERN.search(
                line
            )

            if page_match:
                current_candidate = (
                    self._flush_fallback_candidate(
                        candidates,
                        current_candidate,
                    )
                )

                try:
                    current_page = int(
                        page_match.group(1)
                    )
                except (TypeError, ValueError):
                    pass

                continue

            if self._is_noise_line(
                line
            ):
                continue

            structure_type, body = (
                self._extract_structural_body(
                    line
                )
            )

            # Detect true section headings before considering a plain line
            # as a requirement cue. This is important for headings such as
            # "إدارة المشروع" or "المخرجات".
            if (
                not structure_type
                and
                self._looks_like_heading(
                    line
                )
            ):
                current_candidate = (
                    self._flush_fallback_candidate(
                        candidates,
                        current_candidate,
                    )
                )

                current_heading = line

                requirement_section = (
                    self._section_is_requirement_bearing(
                        current_heading
                    )
                )

                context_section = (
                    self._section_is_context_only(
                        current_heading
                    )
                )

                continue

            cue_match = bool(
                self.REQUIREMENT_CUE_PATTERN.search(
                    line
                )
            )

            should_start_candidate = False
            candidate_text = None

            if structure_type:
                # Structured items inside a procurement requirement section
                # are requirements even when they omit "يجب / shall".
                if requirement_section:
                    should_start_candidate = True
                    candidate_text = body

                # Outside a known requirement section, only keep the item if
                # its own wording clearly expresses an obligation.
                elif cue_match and not context_section:
                    should_start_candidate = True
                    candidate_text = body

            elif cue_match and not context_section:
                should_start_candidate = True
                candidate_text = line

            if should_start_candidate:
                current_candidate = (
                    self._flush_fallback_candidate(
                        candidates,
                        current_candidate,
                    )
                )

                current_candidate = {
                    "text": candidate_text,
                    "position": line_position,
                    "page": current_page,
                    "section": current_heading,
                    "raw": line,
                    "structure_type": (
                        structure_type
                        or
                        "cue"
                    ),
                }

                continue

            # Continuation line: if a requirement has already started,
            # append wrapped PDF text until the next item/heading/page.
            if current_candidate is not None:
                if len(
                    current_candidate[
                        "text"
                    ]
                ) < 1400:
                    current_candidate[
                        "text"
                    ] = (
                        self._normalize_text(
                            current_candidate[
                                "text"
                            ]
                            +
                            " "
                            +
                            line
                        )
                    )

        current_candidate = (
            self._flush_fallback_candidate(
                candidates,
                current_candidate,
            )
        )

        # Exact-text dedupe while preserving document order.
        deduped = []
        seen_texts = set()

        for candidate in candidates:
            normalized_key = (
                self._normalize_search_text(
                    candidate[
                        "text"
                    ]
                )
            )

            if normalized_key in seen_texts:
                continue

            seen_texts.add(
                normalized_key
            )

            deduped.append(
                candidate
            )

        requirements = []

        for index, candidate in enumerate(
            deduped,
            start=1,
        ):
            requirement_id = (
                "REQ-%04d"
                % index
            )

            mandatory, requirement_type = (
                self._extract_requirement_status(
                    candidate[
                        "text"
                    ]
                    +
                    " "
                    +
                    candidate.get(
                        "raw",
                        "",
                    )
                )
            )

            section_key = (
                self._normalize_heading_key(
                    candidate.get(
                        "section",
                        "",
                    )
                )
            )

            # Procurement checklists explicitly represent submission gates.
            if (
                "قائمه التدقيق"
                in section_key
                or
                "قائمه التدقیق"
                in section_key
                or
                "checklist"
                in section_key
            ):
                mandatory = True
                requirement_type = (
                    "إلزامي"
                )

            source_parts = []

            if candidate[
                "page"
            ] is not None:
                source_parts.append(
                    "Page %s"
                    % candidate[
                        "page"
                    ]
                )

            if candidate[
                "section"
            ]:
                source_parts.append(
                    candidate[
                        "section"
                    ]
                )

            requirement = {
                "id": requirement_id,
                "requirement": (
                    candidate[
                        "text"
                    ]
                ),
                "source": (
                    " - ".join(
                        source_parts
                    )
                    or
                    "RFP"
                ),
                "page": (
                    candidate[
                        "page"
                    ]
                ),
                "section": (
                    candidate[
                        "section"
                    ]
                ),
                "mandatory": mandatory,
                "requirement_type": (
                    requirement_type
                ),
                "mandatory_evidence": (
                    requirement_type
                    if mandatory
                    else
                    ""
                ),
                "response_evidence_required": "",
            }

            requirement.update(
                self._calculate_requirement_importance(
                    requirement
                )
            )

            requirements.append(
                requirement
            )

        return requirements


    # =====================================================
    # LLM grounded fallback extraction
    # =====================================================

    def _split_text_for_requirement_extraction(
        self,
        rfp_text,
    ):
        chunks = []

        start = 0
        text_length = len(
            rfp_text
        )

        while start < text_length:
            end = min(
                text_length,
                start
                +
                self.LLM_EXTRACTION_CHUNK_CHARS,
            )

            # Prefer a paragraph/newline boundary.
            if end < text_length:
                boundary = rfp_text.rfind(
                    "\n",
                    start,
                    end,
                )

                if (
                    boundary
                    >
                    start
                    +
                    int(
                        self.LLM_EXTRACTION_CHUNK_CHARS
                        *
                        0.65
                    )
                ):
                    end = boundary

            chunk = rfp_text[
                start:end
            ].strip()

            if chunk:
                chunks.append(
                    {
                        "index": (
                            len(
                                chunks
                            )
                            +
                            1
                        ),
                        "start": start,
                        "text": chunk,
                    }
                )

            if end <= start:
                break

            start = end

        return chunks

    def _build_grounded_extraction_prompt(
        self,
        chunk,
        document_language,
        chunk_number,
        total_chunks,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY NOTE:
The previous response was invalid.

Reason:
%s

Return ONLY valid JSON.
""" % retry_reason

        return """
You are extracting procurement requirements from part of an RFP.

This is chunk %s of %s.

Dominant document language:
%s

Your task is to identify ONLY requirements, obligations,
deliverables, technical specifications, submission requirements,
evaluation requirements, commercial conditions, project-management
requirements, security/privacy requirements, support/training
requirements, or other vendor responsibilities that are explicitly
present in the source text.

DO NOT extract:
- table-of-contents entries
- organization background
- general descriptive history
- headings by themselves
- duplicated requirements
- information that is not an obligation or evaluable requirement

IMPORTANT GROUNDING RULE:
Every extracted item must include a short evidence_quote copied
verbatim from the provided source chunk. If you cannot point to a
source quote, do not extract the item.

MANDATORY:
Set mandatory=true only when the wording is clearly obligatory,
for example يجب / يلتزم / يتعين / إلزامي / shall / must / required,
or when the source explicitly says omission causes rejection or
disqualification.

Return ONLY valid JSON:

{
  "requirements": [
    {
      "requirement": "Concise requirement preserving source meaning",
      "mandatory": true,
      "requirement_type": "إلزامي",
      "evidence_quote": "Short verbatim quote from the source",
      "section": "Closest visible section heading if known"
    }
  ]
}

%s

<RFP_CHUNK>
%s
</RFP_CHUNK>
""" % (
            chunk_number,
            total_chunks,
            document_language,
            retry_section,
            chunk,
        )

    def _validate_grounded_extraction(
        self,
        data,
        chunk_text,
    ):
        if not isinstance(
            data,
            dict,
        ):
            return (
                None,
                "Extraction result must be an object.",
            )

        raw_requirements = data.get(
            "requirements"
        )

        if not isinstance(
            raw_requirements,
            list,
        ):
            return (
                None,
                "Extraction result is missing requirements.",
            )

        normalized_chunk = (
            self._normalize_search_text(
                chunk_text
            )
        )

        cleaned = []

        for index, item in enumerate(
            raw_requirements,
            start=1,
        ):
            if not isinstance(
                item,
                dict,
            ):
                return (
                    None,
                    "Requirement %s must be an object."
                    % index,
                )

            requirement_text = (
                self._normalize_text(
                    item.get(
                        "requirement",
                        "",
                    )
                )
            )

            evidence_quote = (
                self._normalize_text(
                    item.get(
                        "evidence_quote",
                        "",
                    )
                )
            )

            if len(
                requirement_text
            ) < 8:
                continue

            if len(
                evidence_quote
            ) < 6:
                continue

            normalized_evidence = (
                self._normalize_search_text(
                    evidence_quote
                )
            )

            # Exact normalized grounding check.
            if (
                normalized_evidence
                not in
                normalized_chunk
            ):
                # Some PDF extraction inserts/removes punctuation.
                evidence_tokens = [
                    token
                    for token
                    in re.findall(
                        r"[\w\u0600-\u06FF]+",
                        normalized_evidence,
                    )
                    if len(
                        token
                    ) >= 2
                ]

                if evidence_tokens:
                    hit_count = sum(
                        1
                        for token
                        in evidence_tokens
                        if token in normalized_chunk
                    )

                    coverage = (
                        hit_count
                        /
                        len(
                            evidence_tokens
                        )
                    )
                else:
                    coverage = 0.0

                if coverage < 0.8:
                    continue

            mandatory = bool(
                item.get(
                    "mandatory",
                    False,
                )
            )

            requirement_type = (
                self._normalize_text(
                    item.get(
                        "requirement_type",
                        "",
                    )
                )
            )

            if mandatory:
                requirement_type = (
                    requirement_type
                    or
                    "إلزامي"
                )

            cleaned.append(
                {
                    "requirement": (
                        requirement_text
                    ),
                    "mandatory": mandatory,
                    "requirement_type": (
                        requirement_type
                    ),
                    "evidence_quote": (
                        evidence_quote
                    ),
                    "section": (
                        self._normalize_text(
                            item.get(
                                "section",
                                "",
                            )
                        )
                    ),
                }
            )

        return (
            cleaned,
            None,
        )

    def _extract_grounded_chunk(
        self,
        chunk,
        document_language,
        total_chunks,
    ):
        attempts = (
            self.MAX_LLM_EXTRACTION_RETRIES
            +
            1
        )

        retry_reason = None
        last_error = None

        for attempt in range(
            1,
            attempts + 1,
        ):
            prompt = (
                self._build_grounded_extraction_prompt(
                    chunk=chunk["text"],
                    document_language=document_language,
                    chunk_number=chunk["index"],
                    total_chunks=total_chunks,
                    retry_reason=retry_reason,
                )
            )

            response = (
                self.llm.ask(
                    prompt,
                    label=(
                        "RFP-RequirementExtract-%s"
                        % chunk["index"]
                    ),
                )
            )

            try:
                data = (
                    self._parse_json(
                        response,
                        (
                            "RFP requirement extraction "
                            "chunk %s"
                            % chunk["index"]
                        ),
                    )
                )

            except Exception as error:
                last_error = str(
                    error
                )

                if attempt >= attempts:
                    break

                retry_reason = last_error
                continue

            (
                requirements,
                validation_error,
            ) = (
                self._validate_grounded_extraction(
                    data,
                    chunk["text"],
                )
            )

            if not validation_error:
                print(
                    "Grounded extraction chunk %s accepted %s requirements."
                    % (
                        chunk["index"],
                        len(requirements),
                    )
                )

                return (
                    requirements
                )

            last_error = (
                validation_error
            )

            if attempt >= attempts:
                break

            retry_reason = (
                validation_error
            )

        raise RuntimeError(
            "Grounded requirement extraction "
            "chunk %s failed. %s"
            % (
                chunk["index"],
                last_error,
            )
        )

    def _extract_llm_grounded_requirements(
        self,
        rfp_text,
        document_language,
    ):
        chunks = (
            self._split_text_for_requirement_extraction(
                rfp_text
            )
        )

        if not chunks:
            return []

        total_chunks = len(
            chunks
        )

        worker_count = min(
            self.MAX_LLM_EXTRACTION_WORKERS,
            total_chunks,
        )

        print()
        print(
            "================================"
        )
        print(
            "GROUNDED LLM REQUIREMENT FALLBACK"
        )
        print(
            "================================"
        )
        print(
            "Chunks: %s"
            % total_chunks
        )
        print(
            "Parallel workers: %s"
            % worker_count
        )

        results_by_chunk = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for chunk in chunks:
                future = (
                    executor.submit(
                        self._extract_grounded_chunk,
                        chunk,
                        document_language,
                        total_chunks,
                    )
                )

                future_map[
                    future
                ] = (
                    chunk["index"]
                )

            for future in as_completed(
                future_map
            ):
                chunk_index = (
                    future_map[
                        future
                    ]
                )

                results_by_chunk[
                    chunk_index
                ] = (
                    future.result()
                )

                print(
                    "Requirement extraction chunk "
                    "%s/%s completed."
                    % (
                        chunk_index,
                        total_chunks,
                    )
                )

        flattened = []

        for chunk_index in range(
            1,
            total_chunks + 1,
        ):
            for item in (
                results_by_chunk.get(
                    chunk_index,
                    []
                )
            ):
                flattened.append(
                    item
                )

        # Deduplicate semantically identical source requirements by
        # normalized requirement text / evidence quote.
        deduped = []
        seen = set()

        for item in flattened:
            key = (
                self._normalize_search_text(
                    item.get(
                        "requirement",
                        "",
                    )
                )
            )

            evidence_key = (
                self._normalize_search_text(
                    item.get(
                        "evidence_quote",
                        "",
                    )
                )
            )

            dedupe_key = (
                key
                if key
                else evidence_key
            )

            if not dedupe_key:
                continue

            if dedupe_key in seen:
                continue

            seen.add(
                dedupe_key
            )

            deduped.append(
                item
            )

        requirements = []

        for index, item in enumerate(
            deduped,
            start=1,
        ):
            requirement_id = (
                "REQ-%04d"
                % index
            )

            evidence_quote = (
                item.get(
                    "evidence_quote",
                    ""
                )
            )

            source_position = (
                rfp_text.find(
                    evidence_quote
                )
            )

            page_number = None

            if source_position >= 0:
                page_number = (
                    self._find_page_number(
                        rfp_text,
                        source_position,
                    )
                )

            section = (
                item.get(
                    "section",
                    ""
                )
                or
                (
                    self._extract_source_heading(
                        rfp_text,
                        max(
                            0,
                            source_position,
                        ),
                    )
                    if source_position >= 0
                    else
                    "RFP"
                )
            )

            source_parts = []

            if page_number is not None:
                source_parts.append(
                    "Page %s"
                    % page_number
                )

            if section:
                source_parts.append(
                    section
                )

            requirement = {
                "id": requirement_id,
                "requirement": (
                    item[
                        "requirement"
                    ]
                ),
                "source": (
                    " - ".join(
                        source_parts
                    )
                    or
                    "RFP"
                ),
                "page": page_number,
                "section": section,
                "mandatory": bool(
                    item.get(
                        "mandatory",
                        False,
                    )
                ),
                "requirement_type": (
                    item.get(
                        "requirement_type",
                        "",
                    )
                ),
                "mandatory_evidence": (
                    evidence_quote
                    if item.get(
                        "mandatory",
                        False,
                    )
                    else
                    ""
                ),
                "response_evidence_required": "",
                "source_evidence_quote": (
                    evidence_quote
                ),
            }

            requirement.update(
                self._calculate_requirement_importance(
                    requirement
                )
            )

            requirements.append(
                requirement
            )

        return requirements

    def _extract_requirements(
        self,
        rfp_text,
        document_language=None,
    ):
        requirements = (
            self._extract_numbered_requirements(
                rfp_text
            )
        )

        if requirements:
            self.requirement_extraction_method = (
                "deterministic_gen_req_parser"
            )

            print(
                "Canonical GEN/REQ requirement IDs detected."
            )

            return requirements

        print(
            "No GEN/REQ IDs found. "
            "Trying Unicode-normalized section-aware structured fallback extraction."
        )

        structured_requirements = (
            self._extract_structured_fallback_requirements(
                rfp_text
            )
        )

        print(
            "Structured fallback candidates: %s"
            % len(
                structured_requirements
            )
        )

        if (
            len(
                structured_requirements
            )
            >=
            self.MIN_FALLBACK_REQUIREMENTS
        ):
            self.requirement_extraction_method = (
                "deterministic_structured_fallback"
            )

            return (
                structured_requirements
            )

        print(
            "Structured fallback found too few requirements. "
            "Using grounded LLM extraction fallback."
        )

        if document_language is None:
            document_language = (
                self._detect_document_language(
                    rfp_text
                )
            )

        llm_requirements = (
            self._extract_llm_grounded_requirements(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        if llm_requirements:
            self.requirement_extraction_method = (
                "grounded_llm_fallback_with_source_validation"
            )

            return (
                llm_requirements
            )

        self.requirement_extraction_method = (
            "failed"
        )

        return []

    def _print_extraction_stats(
        self,
        requirements,
    ):
        mandatory_count = sum(
            1
            for item in requirements
            if item["mandatory"]
        )

        preferred_count = sum(
            1
            for item in requirements
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
                for item in requirements
                if (
                    item.get(
                        "importance_score"
                    )
                    ==
                    score
                )
            )
            for score in range(
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
            "Extraction method: %s"
            % self.requirement_extraction_method
        )
        print(
            "Requirements found: %s"
            % len(requirements)
        )
        print(
            "Mandatory requirements: %s"
            % mandatory_count
        )
        print(
            "Preferential requirements: %s"
            % preferred_count
        )
        print(
            "Importance distribution: %s"
            % importance_counts
        )

        if requirements:
            print(
                "First requirement: %s"
                % requirements[0]["id"]
            )
            print(
                "Last requirement: %s"
                % requirements[-1]["id"]
            )

    # =====================================================
    # Requirement catalog
    # =====================================================

    def _build_requirement_catalog(
        self,
        requirements,
    ):
        catalog = []

        for requirement in requirements:
            text = self._normalize_text(
                requirement.get(
                    "requirement",
                    "",
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
                    "id": requirement["id"],
                    "section": requirement.get(
                        "section",
                        "",
                    ),
                    "mandatory": requirement.get(
                        "mandatory",
                        False,
                    ),
                    "importance_score": requirement.get(
                        "importance_score",
                        1,
                    ),
                    "requirement": text,
                }
            )

        return catalog

    # =====================================================
    # Criteria discovery
    # =====================================================

    def _effective_min_criteria(
        self,
        requirements,
    ):
        if len(requirements) <= 3:
            return 1

        return self.MIN_CRITERIA

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

        catalog_text = json.dumps(
            catalog,
            ensure_ascii=False,
        )

        rfp_context = rfp_text[
            :self.DISCOVERY_RFP_CONTEXT_LIMIT
        ]

        min_criteria = (
            self._effective_min_criteria(
                requirements
            )
        )

        retry_section = ""

        if retry_reason:
            retry_section = """
==================================================
RETRY
==================================================

The previous response was invalid.

Reason:

%s

Return ONLY one valid JSON object.
Do not use markdown fences.
Do not add explanation before or after the JSON.
""" % retry_reason

        return """
You are a senior procurement evaluator.

Discover the evaluation criteria dynamically from this RFP.

The system is domain-agnostic.

LANGUAGE:
%s

Return names/descriptions in the same dominant language.

RULES:
1. Prefer explicit RFP evaluation criteria.
2. Otherwise infer a small meaningful procurement framework.
3. Return between %s and %s criteria.
4. Do not create empty criteria.
5. Do not assign requirement IDs yet.
6. explicit_weight is only for an actual evaluation percentage/points.
7. Do not confuse SLA/uptime/discount/tax/technical percentages with weights.
8. Give each criterion an importance score from 1 to 5.
9. Criterion importance must not depend on requirement count.

OUTPUT ONLY VALID JSON:

{
  "criteria": [
    {
      "criterion_id": "C01",
      "name": "Criterion name",
      "description": "Concise description",
      "source": "RFP section or basis",
      "criterion_importance_score": 5,
      "criterion_importance_reason": "Short factual reason",
      "explicit_weight": null,
      "explicit_weight_evidence": ""
    }
  ]
}

%s

<RFP_CONTEXT>
%s
</RFP_CONTEXT>

<REQUIREMENT_CATALOG>
%s
</REQUIREMENT_CATALOG>
""" % (
            document_language,
            min_criteria,
            self.MAX_CRITERIA,
            retry_section,
            rfp_context,
            catalog_text,
        )

    def _validate_discovered_criteria(
        self,
        data,
        requirements,
    ):
        if not isinstance(data, dict):
            raise ValueError(
                "Criteria discovery result must be an object."
            )

        raw_criteria = data.get(
            "criteria",
            []
        )

        if not isinstance(
            raw_criteria,
            list,
        ):
            raise ValueError(
                "Criteria discovery is missing criteria."
            )

        min_criteria = (
            self._effective_min_criteria(
                requirements
            )
        )

        if not (
            min_criteria
            <=
            len(raw_criteria)
            <=
            self.MAX_CRITERIA
        ):
            raise ValueError(
                "Dynamic criteria count is outside "
                "the allowed range %s-%s. Received %s."
                % (
                    min_criteria,
                    self.MAX_CRITERIA,
                    len(raw_criteria),
                )
            )

        cleaned = []
        seen_ids = set()
        seen_names = set()

        for index, criterion in enumerate(
            raw_criteria,
            start=1,
        ):
            if not isinstance(
                criterion,
                dict,
            ):
                raise ValueError(
                    "Criterion %s must be an object."
                    % index
                )

            criterion_id = (
                self._normalize_text(
                    criterion.get(
                        "criterion_id",
                        "",
                    )
                )
                or
                "C%02d" % index
            )

            if criterion_id in seen_ids:
                raise ValueError(
                    "Duplicate criterion_id: %s"
                    % criterion_id
                )

            seen_ids.add(
                criterion_id
            )

            name = self._normalize_text(
                criterion.get(
                    "name",
                    "",
                )
            )

            if not name:
                raise ValueError(
                    "Criterion %s is missing a name."
                    % criterion_id
                )

            normalized_name = name.lower()

            if normalized_name in seen_names:
                raise ValueError(
                    "Duplicate criterion name: %s"
                    % name
                )

            seen_names.add(
                normalized_name
            )

            try:
                importance = float(
                    criterion.get(
                        "criterion_importance_score",
                        3,
                    )
                )
            except (TypeError, ValueError):
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
                except (TypeError, ValueError):
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

            cleaned.append(
                {
                    "criterion_id": criterion_id,
                    "name": name,
                    "description": (
                        self._normalize_text(
                            criterion.get(
                                "description",
                                "",
                            )
                        )
                    ),
                    "source": (
                        self._normalize_text(
                            criterion.get(
                                "source",
                                "",
                            )
                        )
                    ),
                    "criterion_importance_score": (
                        round(
                            importance,
                            3,
                        )
                    ),
                    "criterion_importance_reason": (
                        self._normalize_text(
                            criterion.get(
                                "criterion_importance_reason",
                                "",
                            )
                        )
                    ),
                    "explicit_weight": explicit_weight,
                    "explicit_weight_evidence": (
                        self._normalize_text(
                            criterion.get(
                                "explicit_weight_evidence",
                                "",
                            )
                        )
                    ),
                }
            )

        return cleaned

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
            self.MAX_DISCOVERY_RETRIES + 2,
        ):
            prompt = (
                self._build_criteria_discovery_prompt(
                    rfp_text=rfp_text,
                    requirements=requirements,
                    document_language=document_language,
                    retry_reason=retry_reason,
                )
            )

            response = self.llm.ask(
                prompt,
                label="RFP-CriteriaDiscovery",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP criteria discovery",
                )

                return (
                    self._validate_discovered_criteria(
                        data,
                        requirements,
                    )
                )

            except Exception as error:
                last_error = str(error)

                if (
                    attempt
                    >=
                    self.MAX_DISCOVERY_RETRIES + 1
                ):
                    break

                retry_reason = last_error

                print(
                    "Retrying RFP criteria discovery "
                    "(%s/%s) because: %s"
                    % (
                        attempt + 1,
                        self.MAX_DISCOVERY_RETRIES + 1,
                        last_error,
                    )
                )

        raise RuntimeError(
            "RFP criteria discovery failed after "
            "%s attempts. %s"
            % (
                self.MAX_DISCOVERY_RETRIES + 1,
                last_error,
            )
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
            for index in range(
                0,
                len(requirements),
                self.ASSIGNMENT_BATCH_SIZE,
            )
        ]

    def _build_assignment_prompt(
        self,
        criteria,
        batch,
        batch_number,
        total_batches,
        retry_reason=None,
    ):
        criteria_json = json.dumps(
            [
                {
                    "criterion_id": item[
                        "criterion_id"
                    ],
                    "name": item["name"],
                    "description": item[
                        "description"
                    ],
                }
                for item in criteria
            ],
            ensure_ascii=False,
        )

        requirements_json = json.dumps(
            [
                {
                    "requirement_id": item["id"],
                    "section": item.get(
                        "section",
                        "",
                    ),
                    "requirement": item.get(
                        "requirement",
                        "",
                    ),
                }
                for item in batch
            ],
            ensure_ascii=False,
        )

        retry_section = ""

        if retry_reason:
            retry_section = (
                "\nPrevious output invalid: %s\n"
                "Return exactly one assignment for every "
                "requirement_id.\n"
                % retry_reason
            )

        return """
Assign every supplied RFP requirement to exactly one supplied
evaluation criterion.

Batch %s of %s.

RULES:
- use only supplied criterion_id values
- use only supplied requirement_id values
- no omissions
- no duplicates
- no invented IDs
- choose the main semantic evaluation purpose
- return only valid JSON

%s

CRITERIA:
%s

REQUIREMENTS:
%s

OUTPUT:
{
  "assignments": [
    {
      "requirement_id": "REQ-0001",
      "criterion_id": "C01"
    }
  ]
}
""" % (
            batch_number,
            total_batches,
            retry_section,
            criteria_json,
            requirements_json,
        )

    def _validate_assignment_result(
        self,
        data,
        batch,
        criteria,
    ):
        if not isinstance(data, dict):
            return (
                None,
                "Assignment result must be an object.",
            )

        assignments = data.get(
            "assignments"
        )

        if not isinstance(
            assignments,
            list,
        ):
            return (
                None,
                "Assignment result is missing assignments.",
            )

        expected_ids = [
            item["id"]
            for item in batch
        ]

        valid_criterion_ids = {
            item["criterion_id"]
            for item in criteria
        }

        if len(assignments) != len(
            expected_ids
        ):
            return (
                None,
                "Assignment count mismatch. "
                "Expected %s, received %s."
                % (
                    len(expected_ids),
                    len(assignments),
                ),
            )

        assignment_map = {}

        for index, item in enumerate(
            assignments,
            start=1,
        ):
            if not isinstance(
                item,
                dict,
            ):
                return (
                    None,
                    "Assignment %s must be an object."
                    % index,
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
                    "Assignment %s is missing requirement_id."
                    % index,
                )

            if requirement_id not in expected_ids:
                return (
                    None,
                    "Unexpected requirement_id: %s"
                    % requirement_id,
                )

            if requirement_id in assignment_map:
                return (
                    None,
                    "Duplicate requirement_id: %s"
                    % requirement_id,
                )

            if criterion_id not in valid_criterion_ids:
                return (
                    None,
                    "Unexpected criterion_id: %s"
                    % criterion_id,
                )

            assignment_map[
                requirement_id
            ] = criterion_id

        missing = [
            requirement_id
            for requirement_id in expected_ids
            if requirement_id not in assignment_map
        ]

        if missing:
            return (
                None,
                "Missing requirement assignments: %s"
                % missing,
            )

        return (
            {
                requirement_id: (
                    assignment_map[
                        requirement_id
                    ]
                )
                for requirement_id in expected_ids
            },
            None,
        )

    def _assign_batch(
        self,
        criteria,
        batch,
        batch_number,
        total_batches,
    ):
        attempts = (
            self.MAX_ASSIGNMENT_RETRIES + 1
        )

        last_error = None
        retry_reason = None

        for attempt in range(
            1,
            attempts + 1,
        ):
            prompt = self._build_assignment_prompt(
                criteria=criteria,
                batch=batch,
                batch_number=batch_number,
                total_batches=total_batches,
                retry_reason=retry_reason,
            )

            response = self.llm.ask(
                prompt,
                label=(
                    "RFPCriteriaAssign%s"
                    % batch_number
                ),
            )

            try:
                data = self._parse_json(
                    response,
                    (
                        "RFP criterion assignment "
                        "batch %s"
                        % batch_number
                    ),
                )

            except Exception as error:
                last_error = str(error)

                if attempt >= attempts:
                    break

                retry_reason = last_error
                continue

            assignment_map, structure_error = (
                self._validate_assignment_result(
                    data=data,
                    batch=batch,
                    criteria=criteria,
                )
            )

            if not structure_error:
                return assignment_map

            last_error = structure_error

            if attempt >= attempts:
                break

            retry_reason = structure_error

        raise RuntimeError(
            "RFP criterion assignment batch "
            "%s failed. %s"
            % (
                batch_number,
                last_error,
            )
        )

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
            "Requirements: %s"
            % len(requirements)
        )
        print(
            "Criteria: %s"
            % len(criteria)
        )
        print(
            "Assignment batches: %s"
            % total_batches
        )
        print(
            "Parallel assignment workers: %s"
            % worker_count
        )

        results_by_batch = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for batch_index, batch in enumerate(
                batches,
                start=1,
            ):
                future = executor.submit(
                    self._assign_batch,
                    criteria,
                    batch,
                    batch_index,
                    total_batches,
                )

                future_map[
                    future
                ] = batch_index

            for future in as_completed(
                future_map
            ):
                batch_index = (
                    future_map[
                        future
                    ]
                )

                results_by_batch[
                    batch_index
                ] = future.result()

                print(
                    "Criterion assignment batch "
                    "%s/%s completed."
                    % (
                        batch_index,
                        total_batches,
                    )
                )

        global_map = {}

        for batch_index in range(
            1,
            total_batches + 1,
        ):
            batch_result = (
                results_by_batch[
                    batch_index
                ]
            )

            for requirement_id, criterion_id in (
                batch_result.items()
            ):
                if requirement_id in global_map:
                    raise RuntimeError(
                        "Duplicate requirement assignment "
                        "across batches: %s"
                        % requirement_id
                    )

                global_map[
                    requirement_id
                ] = criterion_id

        expected_ids = [
            item["id"]
            for item in requirements
        ]

        if set(global_map.keys()) != set(
            expected_ids
        ):
            raise RuntimeError(
                "Dynamic criterion assignment lost "
                "or invented requirements."
            )

        return global_map

    # =====================================================
    # Criteria build / weighting
    # =====================================================

    def _build_dynamic_criteria(
        self,
        requirements,
        discovered_criteria,
        assignment_map,
    ):
        grouped = {
            criterion[
                "criterion_id"
            ]: []
            for criterion in discovered_criteria
        }

        for requirement in requirements:
            criterion_id = assignment_map[
                requirement["id"]
            ]

            if criterion_id not in grouped:
                raise RuntimeError(
                    "Assignment references unknown criterion: %s"
                    % criterion_id
                )

            grouped[
                criterion_id
            ].append(
                requirement
            )

        active_discovered = [
            criterion
            for criterion in discovered_criteria
            if grouped[
                criterion["criterion_id"]
            ]
        ]

        min_criteria = (
            self._effective_min_criteria(
                requirements
            )
        )

        if len(active_discovered) < min_criteria:
            raise RuntimeError(
                "Dynamic criterion discovery produced "
                "too few active criteria after assignment."
            )

        return (
            active_discovered,
            grouped,
        )

    def _has_complete_explicit_weights(
        self,
        criteria,
    ):
        if not criteria:
            return False

        explicit_weights = []

        for criterion in criteria:
            weight = criterion.get(
                "explicit_weight"
            )

            if weight is None:
                return False

            try:
                weight = float(weight)
            except (TypeError, ValueError):
                return False

            explicit_weights.append(
                weight
            )

        total = round(
            sum(explicit_weights),
            4,
        )

        return abs(
            total - 100.0
        ) <= 0.05

    def _normalize_importance_weights(
        self,
        criteria,
    ):
        total_importance = sum(
            float(
                criterion.get(
                    "criterion_importance_score",
                    3,
                )
            )
            for criterion in criteria
        )

        if total_importance <= 0:
            raise ValueError(
                "Criterion importance total "
                "must be greater than zero."
            )

        weights = {}
        running_total = 0.0

        for index, criterion in enumerate(
            criteria
        ):
            criterion_id = criterion[
                "criterion_id"
            ]

            if index == len(criteria) - 1:
                weight = round(
                    100.0 - running_total,
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

                running_total += weight

            weights[
                criterion_id
            ] = weight

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

        for criterion in discovered_criteria:
            criterion_id = criterion[
                "criterion_id"
            ]

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
                    for item in criterion_requirements
                )
                /
                len(criterion_requirements)
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
                    "criterion_id": criterion_id,
                    "name": criterion["name"],
                    "description": (
                        criterion.get(
                            "description",
                            "",
                        )
                    ),
                    "source": (
                        criterion.get(
                            "source",
                            "RFP",
                        )
                    ),
                    "weight": round(
                        weight,
                        2,
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

        return final_criteria

    # =====================================================
    # Mandatory
    # =====================================================

    def _build_mandatory_requirements(
        self,
        criteria,
    ):
        mandatory = []

        for criterion in criteria:
            for requirement in criterion[
                "requirements"
            ]:
                if not requirement.get(
                    "mandatory",
                    False,
                ):
                    continue

                mandatory.append(
                    {
                        "id": requirement["id"],
                        "requirement_id": (
                            requirement["id"]
                        ),
                        "requirement": (
                            requirement[
                                "requirement"
                            ]
                        ),
                        "criterion": (
                            criterion["name"]
                        ),
                        "criterion_id": (
                            criterion[
                                "criterion_id"
                            ]
                        ),
                        "source": (
                            requirement["source"]
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
        document_language,
    ):
        return """
You are analyzing an RFP.

Dominant document language:
%s

Return a concise factual summary in the same dominant language.

Do not extract requirements.
Do not invent requirements.
Do not calculate counts or weights.

Return ONLY valid JSON:

{
  "rfp_summary": "Concise factual summary"
}

<RFP_DOCUMENT>
%s
</RFP_DOCUMENT>
""" % (
            document_language,
            rfp_text,
        )

    def _generate_summary(
        self,
        rfp_text,
        document_language,
    ):
        prompt = self._build_summary_prompt(
            rfp_text,
            document_language,
        )

        response_text = self.llm.ask(
            prompt,
            label="RFP-Summary",
        )

        try:
            data = self._parse_json(
                response_text,
                "RFP summary",
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

        summary = self._normalize_text(
            data.get(
                "rfp_summary",
                "",
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
    # Validation
    # =====================================================

    def _validate_framework(
        self,
        criteria,
        requirements,
    ):
        if not requirements:
            raise ValueError(
                "No RFP requirements were extracted."
            )

        if not criteria:
            raise ValueError(
                "No evaluation criteria were created."
            )

        grouped_count = sum(
            len(
                criterion[
                    "requirements"
                ]
            )
            for criterion in criteria
        )

        if grouped_count != len(
            requirements
        ):
            raise ValueError(
                "Requirement grouping lost data. "
                "Extracted=%s, Grouped=%s"
                % (
                    len(requirements),
                    grouped_count,
                )
            )

        grouped_ids = []

        for criterion in criteria:
            grouped_ids.extend(
                requirement["id"]
                for requirement in criterion[
                    "requirements"
                ]
            )

        expected_ids = [
            requirement["id"]
            for requirement in requirements
        ]

        if len(grouped_ids) != len(
            set(grouped_ids)
        ):
            raise ValueError(
                "A requirement was assigned to "
                "more than one criterion."
            )

        if set(grouped_ids) != set(
            expected_ids
        ):
            raise ValueError(
                "Requirement grouping mismatch."
            )

        total_weight = round(
            sum(
                float(
                    criterion["weight"]
                )
                for criterion in criteria
            ),
            2,
        )

        if abs(
            total_weight - 100.0
        ) > 0.05:
            raise ValueError(
                "Criterion weights do not total 100. "
                "Current total: %s"
                % total_weight
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
            "STEP A - EXTRACTING RFP REQUIREMENTS"
        )
        print(
            "================================"
        )

        requirements = (
            self._extract_requirements(
                rfp_text,
                document_language=document_language,
            )
        )

        if not requirements:
            raise RuntimeError(
                "No grounded RFP requirements could be extracted. "
                "GEN/REQ parsing, structured extraction, and "
                "source-validated LLM fallback all returned no usable items."
            )

        self._print_extraction_stats(
            requirements
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP B - DISCOVERING DYNAMIC RFP CRITERIA"
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
            "Dynamic criteria discovered: %s"
            % len(discovered_criteria)
        )

        for criterion in discovered_criteria:
            print(
                "- %s | %s | importance=%s"
                % (
                    criterion[
                        "criterion_id"
                    ],
                    criterion["name"],
                    criterion[
                        "criterion_importance_score"
                    ],
                )
            )

        print()
        print(
            "================================"
        )
        print(
            "STEP C - ASSIGNING REQUIREMENTS TO CRITERIA"
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
        ) = self._build_dynamic_criteria(
            requirements=requirements,
            discovered_criteria=discovered_criteria,
            assignment_map=assignment_map,
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP D - CALCULATING CRITERION WEIGHTS"
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

        rfp_summary = self._generate_summary(
            rfp_text=rfp_text,
            document_language=document_language,
        )

        total_weight = round(
            sum(
                float(
                    criterion["weight"]
                )
                for criterion in criteria
            ),
            2,
        )

        weight_sources = {
            criterion.get(
                "weight_source",
                "unknown",
            )
            for criterion in criteria
        }

        overall_weight_source = (
            next(
                iter(weight_sources)
            )
            if len(weight_sources) == 1
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
            "Document language: %s"
            % document_language
        )
        print(
            "Criteria: %s"
            % len(criteria)
        )
        print(
            "Requirements: %s"
            % len(requirements)
        )
        print(
            "Mandatory: %s"
            % len(mandatory_requirements)
        )
        print(
            "Total Weight: %s%%"
            % total_weight
        )
        print(
            "Weight Source: %s"
            % overall_weight_source
        )
        print(
            "Requirement Extraction: %s"
            % self.requirement_extraction_method
        )

        for criterion in criteria:
            mandatory_count = sum(
                1
                for requirement in criterion[
                    "requirements"
                ]
                if requirement.get(
                    "mandatory",
                    False,
                )
            )

            print(
                "- %s | %s | %s requirements | "
                "%s mandatory | weight=%s%% | source=%s"
                % (
                    criterion[
                        "criterion_id"
                    ],
                    criterion["name"],
                    len(
                        criterion[
                            "requirements"
                        ]
                    ),
                    mandatory_count,
                    criterion["weight"],
                    criterion[
                        "weight_source"
                    ],
                )
            )

        return {
            "rfp_summary": rfp_summary,
            "document_language": (
                document_language
            ),
            "criteria": criteria,
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
                "total_weight": total_weight,
                "weight_source": (
                    overall_weight_source
                ),
                "document_language": (
                    document_language
                ),
                "requirement_extraction_method": (
                    self.requirement_extraction_method
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
                "dynamic_criteria": True,
            },
        }

    def close(self):
        self.llm.close()
