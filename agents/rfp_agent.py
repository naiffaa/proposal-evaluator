import json
import os
import re
import unicodedata
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor, as_completed

from services.llm_client import LLMClient


class RFPAgent:
    """
    Accurate, domain-agnostic RFP analyzer.

    Main principles:
    - Every extracted requirement must be grounded in the RFP.
    - Python owns chunking, page mapping, ID assignment and deduplication.
    - Requirements are atomic: one independently evaluable item per record.
    - Mandatory, preferred and general requirements are distinguished.
    - Eligibility/disqualification gates are extracted separately.
    - Criteria are discovered dynamically from the actual RFP.
    - Every criterion includes a grounded source quote and explanation.
    - Explicit RFP scoring weights are preserved when complete.
    - Optional system-defined weight overrides are supported.
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

    ALT_PAGE_PATTERN = re.compile(
        r"<PARSED\s+TEXT\s+FOR\s+PAGE:\s*(\d+)\s*/\s*\d+>",
        flags=re.IGNORECASE,
    )

    MANDATORY_CUE_PATTERN = re.compile(
        r"""
        (?:
            \bshall\b|\bmust\b|\brequired\b|\bmandatory\b
            |يجب|يتعين|يلتزم|إلزامي|إلزامى|يشترط|يلزم
            |على\s+مقدم\s+العرض
            |على\s+مقدم\s+الخدمة
            |على\s+المورد
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    PREFERRED_CUE_PATTERN = re.compile(
        r"""
        (?:
            \bpreferred\b|\bpreferably\b|\bdesirable\b|\bnice\s+to\s+have\b
            |تفضيلي|يفضل|يُفضل|من\s+المفضل|مرغوب
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    EXCLUSION_CUE_PATTERN = re.compile(
        r"""
        (?:
            استبعاد|يستبعد|استثناء\s+مقدم|لن\s+يتم\s+قبول|لا\s+يقبل
            |يعتبر\s+العرض\s+لاغ|غير\s+مؤهل|عدم\s+الأهلية
            |\bdisqualif|\breject|\bineligible|\bnot\s+eligible
        )
        """,
        flags=re.IGNORECASE | re.VERBOSE,
    )

    MIN_CRITERIA = 2
    MAX_CRITERIA = 12

    REQUIREMENT_CHUNK_CHARS = 7000
    REQUIREMENT_CHUNK_OVERLAP = 500
    MAX_REQUIREMENT_EXTRACTION_WORKERS = 2
    MAX_REQUIREMENT_EXTRACTION_RETRIES = 2

    MIN_DETERMINISTIC_REQUIREMENTS = 8
    MIN_REQUIREMENTS_PER_10000_CHARS = 2.0

    ASSIGNMENT_BATCH_SIZE = 30
    MAX_ASSIGNMENT_WORKERS = 2
    MAX_ASSIGNMENT_RETRIES = 2

    DISCOVERY_REQUIREMENT_TEXT_LIMIT = 220
    DISCOVERY_RFP_CONTEXT_LIMIT = 40000
    MAX_DISCOVERY_RETRIES = 2

    MAX_CONSOLIDATION_RETRIES = 2
    MIN_NONEXPLICIT_REQUIREMENTS_PER_CRITERION = 3
    MAX_FINAL_CRITERIA = 9

    # Coverage audit: detect sections that look materially under-extracted,
    # then re-extract only those sections instead of re-running the whole RFP.
    MAX_COVERAGE_AUDIT_RETRIES = 2
    MAX_TARGETED_REEXTRACTION_RETRIES = 2
    MAX_COVERAGE_AUDIT_WORKERS = 2
    MIN_SECTION_CHARS_FOR_AUDIT = 500
    MIN_SECTION_REQUIREMENTS = 2
    MAX_TARGETED_SECTION_CHARS = 10000
    MAX_TARGETED_SECTIONS = 6

    PROJECT_INFO_CONTEXT_LIMIT = 40000
    ELIGIBILITY_CONTEXT_LIMIT = 40000
    EVALUATION_FRAMEWORK_CONTEXT_LIMIT = 40000

    MIN_SOURCE_QUOTE_CHARS = 6
    MIN_TOKEN_GROUNDING_COVERAGE = 0.72
    DEDUP_JACCARD_THRESHOLD = 0.92

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
        self.requirement_extraction_quality = {}

    # =====================================================
    # Generic helpers
    # =====================================================

    def _normalize_text(self, value):
        if value is None:
            return ""

        text = unicodedata.normalize(
            "NFKC",
            str(value),
        )

        text = re.sub(
            r"[\u200b\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]",
            "",
            text,
        )

        text = (
            text
            .replace("ى", "ي")
            .replace("ی", "ي")
            .replace("ک", "ك")
            .replace("ۀ", "ة")
        )

        return re.sub(
            r"\s+",
            " ",
            text,
        ).strip()

    def _normalize_search_text(self, value):
        text = self._normalize_text(value).lower()

        return (
            text
            .replace("أ", "ا")
            .replace("إ", "ا")
            .replace("آ", "ا")
            .replace("ة", "ه")
        )

    def _token_set(self, value):
        return set(
            token
            for token in re.findall(
                r"[A-Za-z0-9_\-\u0600-\u06FF]+",
                self._normalize_search_text(value),
            )
            if len(token) >= 2
        )

    def _jaccard_similarity(self, left, right):
        a = self._token_set(left)
        b = self._token_set(right)

        if not a or not b:
            return 0.0

        return len(a & b) / len(a | b)

    def _safe_float(self, value, default=None):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    # =====================================================
    # JSON helpers
    # =====================================================

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
    # Language / page / grounding
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

    def _split_document_pages(self, rfp_text):
        markers = []

        for pattern in (
            self.PAGE_PATTERN,
            self.ALT_PAGE_PATTERN,
        ):
            for match in pattern.finditer(
                rfp_text
            ):
                markers.append(
                    (
                        match.start(),
                        match.end(),
                        int(match.group(1)),
                    )
                )

        if not markers:
            return [
                {
                    "page": None,
                    "start": 0,
                    "end": len(rfp_text),
                    "text": rfp_text,
                }
            ]

        markers.sort(
            key=lambda item: item[0]
        )

        pages = []

        for index, marker in enumerate(markers):
            start_pos = marker[1]
            end_pos = (
                markers[index + 1][0]
                if index + 1 < len(markers)
                else len(rfp_text)
            )

            pages.append(
                {
                    "page": marker[2],
                    "start": start_pos,
                    "end": end_pos,
                    "text": rfp_text[start_pos:end_pos],
                }
            )

        return pages

    def _find_page_number(self, text, position):
        page_number = None

        for pattern in (
            self.PAGE_PATTERN,
            self.ALT_PAGE_PATTERN,
        ):
            for match in pattern.finditer(
                text,
                0,
                position,
            ):
                page_number = int(
                    match.group(1)
                )

        return page_number

    def _quote_is_grounded(self, quote, source_text):
        quote = self._normalize_text(quote)

        if len(quote) < self.MIN_SOURCE_QUOTE_CHARS:
            return False

        normalized_quote = self._normalize_search_text(
            quote
        )

        normalized_source = self._normalize_search_text(
            source_text
        )

        if normalized_quote in normalized_source:
            return True

        quote_tokens = self._token_set(
            normalized_quote
        )

        if not quote_tokens:
            return False

        source_tokens = self._token_set(
            normalized_source
        )

        coverage = (
            len(
                quote_tokens
                &
                source_tokens
            )
            /
            len(
                quote_tokens
            )
        )

        return (
            coverage
            >=
            self.MIN_TOKEN_GROUNDING_COVERAGE
        )

    def _find_quote_page(self, pages, quote):
        normalized_quote = self._normalize_search_text(
            quote
        )

        if not normalized_quote:
            return None

        quote_tokens = self._token_set(
            normalized_quote
        )

        best_page = None
        best_coverage = 0.0

        for page in pages:
            normalized_page = self._normalize_search_text(
                page.get("text", "")
            )

            if normalized_quote in normalized_page:
                return page.get("page")

            if not quote_tokens:
                continue

            page_tokens = self._token_set(
                normalized_page
            )

            coverage = (
                len(
                    quote_tokens
                    &
                    page_tokens
                )
                /
                len(
                    quote_tokens
                )
            )

            if coverage > best_coverage:
                best_coverage = coverage
                best_page = page.get("page")

        if (
            best_coverage
            >=
            self.MIN_TOKEN_GROUNDING_COVERAGE
        ):
            return best_page

        return None

    # =====================================================
    # Requirement status / importance
    # =====================================================

    def _extract_requirement_status(
        self,
        source_text,
        llm_mandatory=None,
        llm_preferred=None,
        obligation_basis_quote="",
    ):
        """
        Mandatory/preferred classification is grounded in source wording.

        Important:
        - The LLM may propose a classification, but Python does not accept
          mandatory=True unless an RFP quote contains mandatory wording.
        - Child bullets may inherit mandatory status only when a grounded
          parent/introductory clause explicitly makes the following list
          obligatory (e.g. "يجب أن يدعم النظام... ويشمل ذلك").
        - Preferred is likewise accepted only when grounded in explicit
          preferred/desirable wording.
        """

        normalized_source = (
            self._normalize_text(
                source_text
            )
            .replace(
                "إلزامى",
                "إلزامي",
            )
        )

        normalized_basis = (
            self._normalize_text(
                obligation_basis_quote
            )
            .replace(
                "إلزامى",
                "إلزامي",
            )
        )

        combined = (
            normalized_source
            +
            " "
            +
            normalized_basis
        ).strip()

        explicit_preferred = bool(
            self.PREFERRED_CUE_PATTERN.search(
                combined
            )
        )

        explicit_mandatory = bool(
            self.MANDATORY_CUE_PATTERN.search(
                combined
            )
        )

        if explicit_preferred:
            return False, True

        if explicit_mandatory:
            return True, False

        # LLM labels without grounded wording are not accepted as mandatory
        # or preferred. The item remains a general evaluable requirement.
        return False, False

    def _requirement_type_label(
        self,
        mandatory,
        preferred,
        document_language,
    ):
        if document_language == "Arabic":
            if mandatory:
                return "إلزامي"

            if preferred:
                return "تفضيلي"

            return "عام"

        if mandatory:
            return "Mandatory"

        if preferred:
            return "Preferred"

        return "General"

    def _calculate_requirement_importance(
        self,
        requirement,
    ):
        combined = self._normalize_search_text(
            "%s %s %s"
            % (
                requirement.get(
                    "requirement",
                    "",
                ),
                requirement.get(
                    "source_quote",
                    "",
                ),
                requirement.get(
                    "evidence_expected",
                    "",
                ),
            )
        )

        mandatory = bool(
            requirement.get(
                "mandatory",
                False,
            )
        )

        preferred = bool(
            requirement.get(
                "preferred",
                False,
            )
        )

        reasons = []

        if mandatory:
            score = 3
            reasons.append(
                "Mandatory wording in the RFP"
            )

        elif preferred:
            score = 1
            reasons.append(
                "Preferred requirement"
            )

        else:
            score = 2
            reasons.append(
                "General evaluable requirement"
            )

        if self.EXCLUSION_CUE_PATTERN.search(
            combined
        ):
            score = 5
            reasons.append(
                "Exclusion / eligibility consequence"
            )

        high_keywords = [
            "امن",
            "خصوصيه",
            "حمايه",
            "امتثال",
            "ترخيص",
            "استمراريه",
            "تعافي",
            "ملكيه فكريه",
            "security",
            "privacy",
            "compliance",
            "license",
            "business continuity",
            "disaster recovery",
            "intellectual property",
            "source code",
        ]

        if any(
            keyword in combined
            for keyword in high_keywords
        ):
            score = max(score, 4)
            reasons.append(
                "High-impact legal / security / continuity signal"
            )

        if preferred:
            score = min(score, 3)

        score = max(
            1,
            min(
                5,
                int(score),
            ),
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
                    list(
                        dict.fromkeys(
                            reasons
                        )
                    )
                )
            ),
        }

    # =====================================================
    # Deterministic numbered extraction
    # =====================================================

    def _canonical_requirement_id(self, match):
        gen_forward = match.group(1)
        req_forward = match.group(2)
        gen_reverse = match.group(3)
        req_reverse = match.group(4)

        if gen_forward:
            return "GEN-%03d" % int(
                gen_forward
            )

        if req_forward:
            return "REQ-%04d" % int(
                req_forward
            )

        if gen_reverse:
            return "GEN-%03d" % int(
                gen_reverse
            )

        if req_reverse:
            return "REQ-%04d" % int(
                req_reverse
            )

        return None

    def _extract_numbered_requirements(
        self,
        rfp_text,
        document_language,
    ):
        matches = list(
            self.REQUIREMENT_ID_PATTERN.finditer(
                rfp_text
            )
        )

        if not matches:
            return []

        extracted = OrderedDict()

        for index, match in enumerate(matches):
            requirement_id = (
                self._canonical_requirement_id(
                    match
                )
            )

            if (
                not requirement_id
                or
                requirement_id in extracted
            ):
                continue

            block_start = match.end()

            block_end = (
                matches[index + 1].start()
                if index + 1 < len(matches)
                else len(rfp_text)
            )

            raw_block = rfp_text[
                block_start:block_end
            ]

            requirement_text = self._normalize_text(
                raw_block
            )

            if len(requirement_text) < 8:
                continue

            source_quote = requirement_text[
                :500
            ]

            mandatory, preferred = (
                self._extract_requirement_status(
                    raw_block
                )
            )

            page_number = self._find_page_number(
                rfp_text,
                match.start(),
            )

            requirement = {
                "id": requirement_id,
                "requirement_id": requirement_id,
                "requirement": requirement_text,
                "description": requirement_text,
                "source_quote": source_quote,
                "source_explanation": (
                    "Extracted directly from a numbered RFP clause."
                ),
                "source": (
                    "Page %s"
                    % page_number
                    if page_number is not None
                    else "RFP"
                ),
                "page": page_number,
                "section": "RFP",
                "mandatory": mandatory,
                "preferred": preferred,
                "requirement_type": (
                    self._requirement_type_label(
                        mandatory,
                        preferred,
                        document_language,
                    )
                ),
                "mandatory_evidence": (
                    source_quote
                    if mandatory
                    else ""
                ),
                "evidence_expected": "",
                "response_evidence_required": "",
                "exclusion_grade": bool(
                    self.EXCLUSION_CUE_PATTERN.search(
                        raw_block
                    )
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

    def _deterministic_extraction_is_credible(
        self,
        requirements,
        rfp_text,
    ):
        if not requirements:
            return False

        if (
            len(requirements)
            <
            self.MIN_DETERMINISTIC_REQUIREMENTS
        ):
            return False

        density = (
            len(requirements)
            /
            max(
                1.0,
                len(rfp_text)
                /
                10000.0,
            )
        )

        return (
            density
            >=
            self.MIN_REQUIREMENTS_PER_10000_CHARS
        )

    # =====================================================
    # Section/page chunking
    # =====================================================

    def _looks_like_heading_line(
        self,
        line,
    ):
        line = self._normalize_text(
            line
        )

        if not line:
            return False

        if len(line) > 110:
            return False

        if (
            self.MANDATORY_CUE_PATTERN.search(
                line
            )
            or
            self.PREFERRED_CUE_PATTERN.search(
                line
            )
        ):
            return False

        heading_keywords = [
            "نطاق",
            "المخرجات",
            "مواصفات",
            "المتطلبات",
            "التقييم",
            "تقييم",
            "طريقة تقديم",
            "أحكام",
            "التزامات",
            "إدارة المشروع",
            "إدارة معلومات",
            "جدول الدفعات",
            "التدريب",
            "الدعم",
            "الأمن",
            "الأمان",
            "الملكية",
            "scope",
            "deliverables",
            "requirements",
            "specifications",
            "evaluation",
            "submission",
            "project management",
            "payment",
            "security",
            "training",
            "support",
        ]

        normalized = self._normalize_search_text(
            line
        )

        if any(
            keyword in normalized
            for keyword in heading_keywords
        ):
            return True

        word_count = len(
            line.split()
        )

        return (
            word_count <= 8
            and
            not re.search(
                r"[.!؟?؛;]$",
                line,
            )
        )

    def _build_requirement_chunks(
        self,
        rfp_text,
    ):
        pages = self._split_document_pages(
            rfp_text
        )

        section_blocks = []

        for page in pages:
            current_heading = "RFP"
            current_lines = []

            for raw_line in (
                page.get(
                    "text",
                    ""
                )
                .splitlines()
            ):
                line = self._normalize_text(
                    raw_line
                )

                if not line:
                    continue

                if self._looks_like_heading_line(
                    line
                ):
                    if current_lines:
                        section_blocks.append(
                            {
                                "page": page.get(
                                    "page"
                                ),
                                "section": current_heading,
                                "text": (
                                    "\n".join(
                                        current_lines
                                    )
                                ),
                            }
                        )

                        current_lines = []

                    current_heading = line
                    continue

                current_lines.append(
                    line
                )

            if current_lines:
                section_blocks.append(
                    {
                        "page": page.get(
                            "page"
                        ),
                        "section": current_heading,
                        "text": (
                            "\n".join(
                                current_lines
                            )
                        ),
                    }
                )

        chunks = []

        current_text = ""
        current_sections = []
        current_page_start = None
        current_page_end = None

        def flush():
            nonlocal current_text
            nonlocal current_sections
            nonlocal current_page_start
            nonlocal current_page_end

            if not current_text.strip():
                return

            chunks.append(
                {
                    "index": (
                        len(chunks) + 1
                    ),
                    "page_start": (
                        current_page_start
                    ),
                    "page_end": (
                        current_page_end
                    ),
                    "sections": list(
                        current_sections
                    ),
                    "text": (
                        current_text.strip()
                    ),
                }
            )

            current_text = ""
            current_sections = []
            current_page_start = None
            current_page_end = None

        for block in section_blocks:
            block_text = (
                "[SECTION: %s]\n%s"
                % (
                    block.get(
                        "section",
                        "RFP",
                    ),
                    block.get(
                        "text",
                        "",
                    ),
                )
            )

            if (
                current_text
                and
                len(current_text)
                +
                len(block_text)
                >
                self.REQUIREMENT_CHUNK_CHARS
            ):
                flush()

            if current_page_start is None:
                current_page_start = (
                    block.get(
                        "page"
                    )
                )

            current_page_end = block.get(
                "page"
            )

            section_name = block.get(
                "section",
                "RFP",
            )

            if section_name not in current_sections:
                current_sections.append(
                    section_name
                )

            if current_text:
                current_text += "\n\n"

            current_text += block_text

        flush()

        if chunks:
            return chunks

        # Last-resort character chunking.
        start = 0

        while start < len(rfp_text):
            end = min(
                len(rfp_text),
                start
                +
                self.REQUIREMENT_CHUNK_CHARS,
            )

            chunks.append(
                {
                    "index": (
                        len(chunks) + 1
                    ),
                    "page_start": (
                        self._find_page_number(
                            rfp_text,
                            start,
                        )
                    ),
                    "page_end": (
                        self._find_page_number(
                            rfp_text,
                            end,
                        )
                    ),
                    "sections": ["RFP"],
                    "text": (
                        rfp_text[
                            start:end
                        ]
                    ),
                }
            )

            if end >= len(rfp_text):
                break

            start = max(
                start + 1,
                end
                -
                self.REQUIREMENT_CHUNK_OVERLAP,
            )

        return chunks

    # =====================================================
    # Atomic grounded requirement extraction
    # =====================================================

    def _build_atomic_extraction_prompt(
        self,
        chunk,
        document_language,
        total_chunks,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
The previous response was rejected.

Reason:
%s

Return ONLY corrected valid JSON.
""" % retry_reason

        return """
You are extracting atomic procurement requirements from an RFP.

Chunk %s of %s.
Dominant document language: %s
Page range: %s - %s
Detected sections: %s

GOAL:
Extract every independently evaluable vendor requirement that is
explicitly supported by this source chunk.

ATOMICITY:
- One item = one independently testable obligation, capability,
  deliverable, commercial condition, submission item,
  project-management obligation, security obligation, or qualification.
- Split combined lists when each element can be evaluated separately.
- Example: RFID + OCR + DRM + AI + unified search should become separate
  atomic requirements when each capability can be independently scored.
- Do not merge many capabilities into one broad requirement.

GROUNDING:
- Every item MUST include source_quote copied from this RFP chunk.
- Do not invent requirements.
- Keep the requirement concise while preserving source meaning.
- description must explain what the requirement means and what should
  be checked in a vendor proposal.

MANDATORY / PREFERRED:
- mandatory=true only when the source explicitly uses mandatory wording
  such as يجب / يلتزم / يتعين / shall / must / required, OR when the
  atomic item is a child of an introductory sentence that explicitly
  makes the following list mandatory.
- preferred=true only when explicitly preferred/desirable.
- If neither is explicit, both false.
- Do NOT mark an item mandatory merely because it appears under scope,
  specifications, deliverables, or a technical feature list.
- If mandatory status is inherited from a parent/introductory sentence,
  return that exact sentence in obligation_basis_quote.
- If mandatory/preferred wording is contained directly in source_quote,
  obligation_basis_quote may be empty.
- exclusion_grade=true only if the source explicitly links failure or
  omission to rejection, exclusion, invalidation, or disqualification.

EVIDENCE EXPECTED:
State the concrete proposal evidence needed to verify the item, such as:
certificate, implementation approach, architecture statement, timeline,
CV, price schedule, compliance statement, license, technical spec,
policy, SLA, or source-code commitment.

EXCLUDE:
- table of contents
- organization history/background
- descriptive project context with no vendor obligation
- headings by themselves
- duplicate paraphrases

Return ONLY valid JSON:

{
  "requirements": [
    {
      "requirement": "Atomic requirement in the RFP language",
      "description": "Brief evaluation explanation",
      "source_quote": "Short verbatim quote from the RFP chunk",
      "source_section": "Closest section heading",
      "mandatory": true,
      "preferred": false,
      "obligation_basis_quote": "Exact parent/introductory quote if mandatory/preferred status is inherited, otherwise empty",
      "exclusion_grade": false,
      "evidence_expected": "Concrete proposal evidence expected"
    }
  ]
}

%s

<RFP_CHUNK>
%s
</RFP_CHUNK>
""" % (
            chunk.get(
                "index"
            ),
            total_chunks,
            document_language,
            chunk.get(
                "page_start"
            ),
            chunk.get(
                "page_end"
            ),
            ", ".join(
                chunk.get(
                    "sections",
                    []
                )
            ),
            retry_section,
            chunk.get(
                "text",
                "",
            ),
        )

    def _validate_atomic_chunk_result(
        self,
        data,
        chunk,
        document_language,
    ):
        if not isinstance(
            data,
            dict,
        ):
            return (
                None,
                "Extraction result must be an object.",
            )

        raw_items = data.get(
            "requirements"
        )

        if not isinstance(
            raw_items,
            list,
        ):
            return (
                None,
                "Extraction result is missing requirements.",
            )

        cleaned = []

        for item in raw_items:
            if not isinstance(
                item,
                dict,
            ):
                continue

            requirement_text = (
                self._normalize_text(
                    item.get(
                        "requirement",
                        "",
                    )
                )
            )

            description = (
                self._normalize_text(
                    item.get(
                        "description",
                        "",
                    )
                )
            )

            source_quote = (
                self._normalize_text(
                    item.get(
                        "source_quote",
                        "",
                    )
                )
            )

            if len(requirement_text) < 6:
                continue

            if not self._quote_is_grounded(
                source_quote,
                chunk.get(
                    "text",
                    "",
                ),
            ):
                continue

            obligation_basis_quote = (
                self._normalize_text(
                    item.get(
                        "obligation_basis_quote",
                        "",
                    )
                )
            )

            if obligation_basis_quote:
                if not self._quote_is_grounded(
                    obligation_basis_quote,
                    chunk.get(
                        "text",
                        "",
                    ),
                ):
                    obligation_basis_quote = ""

            mandatory, preferred = (
                self._extract_requirement_status(
                    source_text=source_quote,
                    llm_mandatory=(
                        item.get(
                            "mandatory"
                        )
                        is True
                    ),
                    llm_preferred=(
                        item.get(
                            "preferred"
                        )
                        is True
                    ),
                    obligation_basis_quote=(
                        obligation_basis_quote
                    ),
                )
            )

            if preferred:
                mandatory = False

            exclusion_grade = bool(
                item.get(
                    "exclusion_grade",
                    False,
                )
            )

            if self.EXCLUSION_CUE_PATTERN.search(
                source_quote
            ):
                exclusion_grade = True

            cleaned.append(
                {
                    "requirement": (
                        requirement_text
                    ),
                    "description": (
                        description
                        or
                        requirement_text
                    ),
                    "source_quote": (
                        source_quote
                    ),
                    "source_section": (
                        self._normalize_text(
                            item.get(
                                "source_section",
                                "",
                            )
                        )
                        or
                        (
                            chunk.get(
                                "sections",
                                ["RFP"],
                            )[0]
                            if chunk.get(
                                "sections"
                            )
                            else
                            "RFP"
                        )
                    ),
                    "mandatory": (
                        mandatory
                    ),
                    "preferred": (
                        preferred
                    ),
                    "requirement_type": (
                        self._requirement_type_label(
                            mandatory,
                            preferred,
                            document_language,
                        )
                    ),
                    "obligation_basis_quote": (
                        obligation_basis_quote
                    ),
                    "exclusion_grade": (
                        exclusion_grade
                    ),
                    "evidence_expected": (
                        self._normalize_text(
                            item.get(
                                "evidence_expected",
                                "",
                            )
                        )
                    ),
                }
            )

        return cleaned, None

    def _extract_atomic_chunk(
        self,
        chunk,
        document_language,
        total_chunks,
    ):
        attempts = (
            self.MAX_REQUIREMENT_EXTRACTION_RETRIES
            +
            1
        )

        last_error = None

        for attempt in range(
            1,
            attempts + 1,
        ):
            prompt = (
                self._build_atomic_extraction_prompt(
                    chunk=chunk,
                    document_language=document_language,
                    total_chunks=total_chunks,
                    retry_reason=last_error,
                )
            )

            response = self.llm.ask(
                prompt,
                label=(
                    "RFP-AtomicExtract-%s"
                    % chunk.get(
                        "index"
                    )
                ),
            )

            try:
                data = self._parse_json(
                    response,
                    (
                        "RFP atomic extraction chunk %s"
                        % chunk.get(
                            "index"
                        )
                    ),
                )

            except Exception as error:
                last_error = str(error)

                if attempt >= attempts:
                    break

                continue

            cleaned, validation_error = (
                self._validate_atomic_chunk_result(
                    data=data,
                    chunk=chunk,
                    document_language=document_language,
                )
            )

            if not validation_error:
                print(
                    "Atomic extraction chunk %s accepted %s items."
                    % (
                        chunk.get(
                            "index"
                        ),
                        len(cleaned),
                    )
                )

                return cleaned

            last_error = validation_error

        raise RuntimeError(
            "Atomic requirement extraction chunk %s failed. %s"
            % (
                chunk.get(
                    "index"
                ),
                last_error,
            )
        )

    def _deduplicate_atomic_items(
        self,
        items,
    ):
        deduped = []

        for item in items:
            duplicate_index = None

            for existing_index, existing in enumerate(
                deduped
            ):
                same_quote = (
                    self._normalize_search_text(
                        item.get(
                            "source_quote",
                            "",
                        )
                    )
                    ==
                    self._normalize_search_text(
                        existing.get(
                            "source_quote",
                            "",
                        )
                    )
                )

                similarity = (
                    self._jaccard_similarity(
                        item.get(
                            "requirement",
                            "",
                        ),
                        existing.get(
                            "requirement",
                            "",
                        ),
                    )
                )

                if (
                    same_quote
                    and
                    similarity
                    >=
                    self.DEDUP_JACCARD_THRESHOLD
                ):
                    duplicate_index = (
                        existing_index
                    )
                    break

            if duplicate_index is None:
                deduped.append(
                    dict(item)
                )
                continue

            existing = deduped[
                duplicate_index
            ]

            if (
                len(
                    item.get(
                        "description",
                        "",
                    )
                )
                >
                len(
                    existing.get(
                        "description",
                        "",
                    )
                )
            ):
                existing[
                    "description"
                ] = item.get(
                    "description",
                    "",
                )

            if (
                not existing.get(
                    "evidence_expected"
                )
                and
                item.get(
                    "evidence_expected"
                )
            ):
                existing[
                    "evidence_expected"
                ] = item.get(
                    "evidence_expected"
                )

            existing[
                "mandatory"
            ] = bool(
                existing.get(
                    "mandatory"
                )
                or
                item.get(
                    "mandatory"
                )
            )

            existing[
                "preferred"
            ] = bool(
                existing.get(
                    "preferred"
                )
                or
                item.get(
                    "preferred"
                )
            )

            existing[
                "exclusion_grade"
            ] = bool(
                existing.get(
                    "exclusion_grade"
                )
                or
                item.get(
                    "exclusion_grade"
                )
            )

        return deduped

    def _extract_atomic_requirements(
        self,
        rfp_text,
        document_language,
    ):
        chunks = self._build_requirement_chunks(
            rfp_text
        )

        if not chunks:
            return []

        total_chunks = len(chunks)

        print()
        print(
            "================================"
        )
        print(
            "ATOMIC GROUNDED REQUIREMENT EXTRACTION"
        )
        print(
            "================================"
        )
        print(
            "Chunks: %s"
            % total_chunks
        )

        worker_count = min(
            self.MAX_REQUIREMENT_EXTRACTION_WORKERS,
            total_chunks,
        )

        results_by_chunk = {}

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for chunk in chunks:
                future = executor.submit(
                    self._extract_atomic_chunk,
                    chunk,
                    document_language,
                    total_chunks,
                )

                future_map[
                    future
                ] = chunk.get(
                    "index"
                )

            for future in as_completed(
                future_map
            ):
                chunk_index = future_map[
                    future
                ]

                results_by_chunk[
                    chunk_index
                ] = future.result()

                print(
                    "Atomic extraction chunk %s/%s completed."
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
            flattened.extend(
                results_by_chunk.get(
                    chunk_index,
                    [],
                )
            )

        deduped = self._deduplicate_atomic_items(
            flattened
        )

        pages = self._split_document_pages(
            rfp_text
        )

        requirements = []

        for index, item in enumerate(
            deduped,
            start=1,
        ):
            requirement_id = (
                "R-%03d"
                % index
            )

            source_quote = item.get(
                "source_quote",
                "",
            )

            page_number = self._find_quote_page(
                pages,
                source_quote,
            )

            section = (
                item.get(
                    "source_section",
                    "",
                )
                or
                "RFP"
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
                "requirement_id": (
                    requirement_id
                ),
                "requirement": (
                    item.get(
                        "requirement",
                        "",
                    )
                ),
                "description": (
                    item.get(
                        "description",
                        "",
                    )
                ),
                "source_quote": (
                    source_quote
                ),
                "source_explanation": (
                    item.get(
                        "description",
                        "",
                    )
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
                "preferred": bool(
                    item.get(
                        "preferred",
                        False,
                    )
                ),
                "requirement_type": (
                    item.get(
                        "requirement_type",
                        self._requirement_type_label(
                            bool(
                                item.get(
                                    "mandatory",
                                    False,
                                )
                            ),
                            bool(
                                item.get(
                                    "preferred",
                                    False,
                                )
                            ),
                            document_language,
                        ),
                    )
                ),
                "mandatory_evidence": (
                    (
                        item.get(
                            "obligation_basis_quote",
                            ""
                        )
                        or
                        source_quote
                    )
                    if item.get(
                        "mandatory"
                    )
                    else
                    ""
                ),
                "obligation_basis_quote": (
                    item.get(
                        "obligation_basis_quote",
                        "",
                    )
                ),
                "evidence_expected": (
                    item.get(
                        "evidence_expected",
                        "",
                    )
                ),
                "response_evidence_required": (
                    item.get(
                        "evidence_expected",
                        "",
                    )
                ),
                "exclusion_grade": bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
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
        document_language,
    ):
        deterministic = (
            self._extract_numbered_requirements(
                rfp_text,
                document_language,
            )
        )

        if self._deterministic_extraction_is_credible(
            deterministic,
            rfp_text,
        ):
            self.requirement_extraction_method = (
                "deterministic_numbered_parser"
            )

            self.requirement_extraction_quality = {
                "deterministic_count": (
                    len(deterministic)
                ),
                "used_llm_fallback": False,
                "quality_gate": "accepted",
            }

            return deterministic

        if deterministic:
            print(
                "Deterministic extraction found %s items but failed "
                "the coverage quality gate."
                % len(deterministic)
            )

        else:
            print(
                "No usable GEN/REQ set found."
            )

        print(
            "Using atomic grounded section-chunked extraction."
        )

        atomic = self._extract_atomic_requirements(
            rfp_text=rfp_text,
            document_language=document_language,
        )

        if atomic:
            self.requirement_extraction_method = (
                "grounded_atomic_section_chunked_llm"
            )

            self.requirement_extraction_quality = {
                "deterministic_count": (
                    len(deterministic)
                ),
                "atomic_count": (
                    len(atomic)
                ),
                "used_llm_fallback": True,
                "quality_gate": (
                    "deterministic_missing_or_undercoverage"
                ),
            }

            return atomic

        if deterministic:
            self.requirement_extraction_method = (
                "deterministic_numbered_parser_after_empty_llm_fallback"
            )
            return deterministic

        self.requirement_extraction_method = (
            "failed"
        )

        return []

    # =====================================================
    # Requirement coverage audit / targeted re-extraction
    # =====================================================

    def _build_section_inventory(
        self,
        rfp_text,
    ):
        """
        Build a deterministic section inventory from the same page/heading
        segmentation used by the extractor.

        Each section record includes:
        - page
        - heading
        - text
        - character count
        - stable section_key
        """

        pages = self._split_document_pages(
            rfp_text
        )

        sections = []

        for page in pages:
            current_heading = "RFP"
            current_lines = []

            def flush_section():
                if not current_lines:
                    return

                section_text = "\n".join(
                    current_lines
                ).strip()

                if not section_text:
                    return

                sections.append(
                    {
                        "section_key": (
                            "SEC-%03d"
                            % (
                                len(sections)
                                +
                                1
                            )
                        ),
                        "page": (
                            page.get(
                                "page"
                            )
                        ),
                        "heading": (
                            current_heading
                        ),
                        "text": (
                            section_text
                        ),
                        "chars": (
                            len(
                                section_text
                            )
                        ),
                    }
                )

            for raw_line in (
                page.get(
                    "text",
                    ""
                )
                .splitlines()
            ):
                line = self._normalize_text(
                    raw_line
                )

                if not line:
                    continue

                if self._looks_like_heading_line(
                    line
                ):
                    flush_section()
                    current_lines = []
                    current_heading = line
                    continue

                current_lines.append(
                    line
                )

            flush_section()

        if not sections:
            sections = [
                {
                    "section_key": "SEC-001",
                    "page": None,
                    "heading": "RFP",
                    "text": rfp_text,
                    "chars": len(
                        rfp_text
                    ),
                }
            ]

        return sections

    def _count_requirements_for_section(
        self,
        section,
        requirements,
    ):
        heading_norm = self._normalize_search_text(
            section.get(
                "heading",
                "",
            )
        )

        page = section.get(
            "page"
        )

        count = 0

        for requirement in requirements:
            req_section = self._normalize_search_text(
                requirement.get(
                    "section",
                    "",
                )
            )

            req_page = requirement.get(
                "page"
            )

            same_heading = bool(
                heading_norm
                and
                req_section
                and
                (
                    heading_norm in req_section
                    or
                    req_section in heading_norm
                )
            )

            same_page = (
                page is not None
                and
                req_page is not None
                and
                page == req_page
            )

            source_quote = requirement.get(
                "source_quote",
                ""
            )

            grounded_in_section = (
                bool(
                    source_quote
                )
                and
                self._quote_is_grounded(
                    source_quote,
                    section.get(
                        "text",
                        "",
                    ),
                )
            )

            if (
                same_heading
                or
                (
                    same_page
                    and
                    grounded_in_section
                )
                or
                grounded_in_section
            ):
                count += 1

        return count

    def _section_requirement_density(
        self,
        section,
        requirements,
    ):
        requirement_count = (
            self._count_requirements_for_section(
                section,
                requirements,
            )
        )

        chars = max(
            1,
            int(
                section.get(
                    "chars",
                    0,
                )
            ),
        )

        return {
            "requirement_count": (
                requirement_count
            ),
            "requirements_per_1000_chars": (
                round(
                    (
                        requirement_count
                        /
                        chars
                        *
                        1000.0
                    ),
                    3,
                )
            ),
        }

    def _build_coverage_audit_prompt(
        self,
        section,
        existing_requirements,
        document_language,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY corrected valid JSON.
""" % retry_reason

        requirement_payload = [
            {
                "id": requirement.get(
                    "id",
                    "",
                ),
                "requirement": requirement.get(
                    "requirement",
                    "",
                ),
                "source_quote": requirement.get(
                    "source_quote",
                    "",
                ),
                "mandatory": requirement.get(
                    "mandatory",
                    False,
                ),
                "preferred": requirement.get(
                    "preferred",
                    False,
                ),
            }
            for requirement in existing_requirements
        ]

        return """
You are auditing requirement-extraction COVERAGE for one RFP section.

Dominant language: %s
Section heading: %s
Page: %s

Your job is NOT to score vendors.
Your job is to determine whether important independently evaluable RFP
requirements in this section are missing from the existing extraction.

AUDIT RULES:
1. Treat one independently testable capability/obligation as one atomic
   requirement.
2. Lists containing distinct capabilities should normally produce separate
   requirements when they can be evaluated independently.
3. Do not count headings, background, or descriptive context.
4. Do not invent requirements.
5. Compare the source section against EXISTING_REQUIREMENTS.
6. coverage_status:
   - COMPLETE: materially all evaluable requirements are already represented
   - PARTIAL: several meaningful requirements are missing or merged too broadly
   - POOR: the extraction misses a large portion of this section
   - NOT_APPLICABLE: section contains little/no evaluable vendor requirement
7. missing_requirement_hints should identify missing atomic topics using
   source wording, but do not create final IDs.
8. If a broad existing requirement improperly merges several independently
   testable items, treat the missing atomic items as coverage gaps.

Return ONLY valid JSON:

{
  "coverage_status": "COMPLETE | PARTIAL | POOR | NOT_APPLICABLE",
  "coverage_score": 0,
  "reason": "",
  "missing_requirement_hints": [
    {
      "topic": "",
      "source_quote": ""
    }
  ]
}

%s

<EXISTING_REQUIREMENTS>
%s
</EXISTING_REQUIREMENTS>

<RFP_SECTION>
%s
</RFP_SECTION>
""" % (
            document_language,
            section.get(
                "heading",
                "RFP",
            ),
            section.get(
                "page"
            ),
            retry_section,
            json.dumps(
                requirement_payload,
                ensure_ascii=False,
            ),
            section.get(
                "text",
                "",
            )[
                :self.MAX_TARGETED_SECTION_CHARS
            ],
        )

    def _validate_coverage_audit_result(
        self,
        data,
        section,
    ):
        if not isinstance(
            data,
            dict,
        ):
            raise ValueError(
                "Coverage audit result must be an object."
            )

        status = (
            self._normalize_text(
                data.get(
                    "coverage_status",
                    "",
                )
            )
            .upper()
        )

        if status not in {
            "COMPLETE",
            "PARTIAL",
            "POOR",
            "NOT_APPLICABLE",
        }:
            raise ValueError(
                "Invalid coverage_status: %s"
                % status
            )

        score = self._safe_float(
            data.get(
                "coverage_score",
                0,
            ),
            default=0.0,
        )

        score = max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

        hints = []

        raw_hints = data.get(
            "missing_requirement_hints",
            []
        )

        if isinstance(
            raw_hints,
            list,
        ):
            for item in raw_hints:
                if not isinstance(
                    item,
                    dict,
                ):
                    continue

                quote = self._normalize_text(
                    item.get(
                        "source_quote",
                        "",
                    )
                )

                if not quote:
                    continue

                if not self._quote_is_grounded(
                    quote,
                    section.get(
                        "text",
                        "",
                    ),
                ):
                    continue

                hints.append(
                    {
                        "topic": (
                            self._normalize_text(
                                item.get(
                                    "topic",
                                    "",
                                )
                            )
                        ),
                        "source_quote": (
                            quote
                        ),
                    }
                )

        return {
            "coverage_status": (
                status
            ),
            "coverage_score": (
                round(
                    score,
                    2,
                )
            ),
            "reason": (
                self._normalize_text(
                    data.get(
                        "reason",
                        "",
                    )
                )
            ),
            "missing_requirement_hints": (
                hints
            ),
        }

    def _audit_single_section(
        self,
        section,
        existing_requirements,
        document_language,
    ):
        last_error = None

        for attempt in range(
            1,
            self.MAX_COVERAGE_AUDIT_RETRIES
            +
            2,
        ):
            response = self.llm.ask(
                self._build_coverage_audit_prompt(
                    section=section,
                    existing_requirements=(
                        existing_requirements
                    ),
                    document_language=(
                        document_language
                    ),
                    retry_reason=(
                        last_error
                    ),
                ),
                label=(
                    "RFP-CoverageAudit-%s"
                    % section.get(
                        "section_key",
                        "SEC",
                    )
                ),
            )

            try:
                data = self._parse_json(
                    response,
                    (
                        "RFP coverage audit %s"
                        % section.get(
                            "section_key",
                            "SEC",
                        )
                    ),
                )

                return (
                    self._validate_coverage_audit_result(
                        data,
                        section,
                    )
                )

            except Exception as error:
                last_error = str(
                    error
                )

                if (
                    attempt
                    >=
                    self.MAX_COVERAGE_AUDIT_RETRIES
                    +
                    1
                ):
                    break

        raise RuntimeError(
            "Coverage audit failed for %s. %s"
            % (
                section.get(
                    "section_key",
                    "SEC",
                ),
                last_error,
            )
        )

    def _select_sections_for_coverage_audit(
        self,
        rfp_text,
        requirements,
    ):
        sections = self._build_section_inventory(
            rfp_text
        )

        candidates = []

        for section in sections:
            if (
                section.get(
                    "chars",
                    0,
                )
                <
                self.MIN_SECTION_CHARS_FOR_AUDIT
            ):
                continue

            density = self._section_requirement_density(
                section,
                requirements,
            )

            heading_norm = self._normalize_search_text(
                section.get(
                    "heading",
                    "",
                )
            )

            important_heading_keywords = [
                "نطاق",
                "مواصفات",
                "متطلبات",
                "حل",
                "تقني",
                "فني",
                "وظائف",
                "تكامل",
                "امن",
                "امان",
                "تدريب",
                "دعم",
                "صيانه",
                "مخرجات",
                "تنفيذ",
                "scope",
                "technical",
                "requirements",
                "specifications",
                "integration",
                "security",
                "training",
                "support",
                "maintenance",
                "deliverables",
                "implementation",
            ]

            important_heading = any(
                keyword in heading_norm
                for keyword in (
                    important_heading_keywords
                )
            )

            suspicious_low_count = (
                density[
                    "requirement_count"
                ]
                <
                self.MIN_SECTION_REQUIREMENTS
            )

            suspicious_low_density = (
                density[
                    "requirements_per_1000_chars"
                ]
                <
                0.45
            )

            if (
                important_heading
                or
                suspicious_low_count
                or
                suspicious_low_density
            ):
                score = 0.0

                if important_heading:
                    score += 3.0

                if suspicious_low_count:
                    score += 2.0

                if suspicious_low_density:
                    score += 2.0

                score += min(
                    3.0,
                    section.get(
                        "chars",
                        0,
                    )
                    /
                    2500.0,
                )

                candidates.append(
                    {
                        "section": (
                            section
                        ),
                        "density": (
                            density
                        ),
                        "priority_score": (
                            score
                        ),
                    }
                )

        candidates.sort(
            key=lambda item: (
                -item[
                    "priority_score"
                ],
                item[
                    "section"
                ].get(
                    "page"
                )
                if item[
                    "section"
                ].get(
                    "page"
                )
                is not None
                else
                9999,
            )
        )

        return candidates[
            :self.MAX_TARGETED_SECTIONS
        ]

    def _run_requirement_coverage_audit(
        self,
        rfp_text,
        requirements,
        document_language,
    ):
        candidates = (
            self._select_sections_for_coverage_audit(
                rfp_text,
                requirements,
            )
        )

        if not candidates:
            return []

        print()
        print(
            "================================"
        )
        print(
            "RFP REQUIREMENT COVERAGE AUDIT"
        )
        print(
            "================================"
        )
        print(
            "Sections selected for audit: %s"
            % len(
                candidates
            )
        )

        worker_count = min(
            self.MAX_COVERAGE_AUDIT_WORKERS,
            len(
                candidates
            ),
        )

        results = []

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for item in candidates:
                section = item[
                    "section"
                ]

                section_requirements = [
                    requirement
                    for requirement in requirements
                    if (
                        self._quote_is_grounded(
                            requirement.get(
                                "source_quote",
                                "",
                            ),
                            section.get(
                                "text",
                                "",
                            ),
                        )
                        or
                        (
                            section.get(
                                "page"
                            )
                            is not None
                            and
                            requirement.get(
                                "page"
                            )
                            ==
                            section.get(
                                "page"
                            )
                        )
                    )
                ]

                future = executor.submit(
                    self._audit_single_section,
                    section,
                    section_requirements,
                    document_language,
                )

                future_map[
                    future
                ] = item

            for future in as_completed(
                future_map
            ):
                item = future_map[
                    future
                ]

                audit = future.result()

                result = dict(
                    item
                )

                result[
                    "audit"
                ] = audit

                results.append(
                    result
                )

                print(
                    "%s | page=%s | existing=%s | status=%s | score=%s"
                    % (
                        item[
                            "section"
                        ].get(
                            "heading",
                            "RFP",
                        ),
                        item[
                            "section"
                        ].get(
                            "page"
                        ),
                        item[
                            "density"
                        ][
                            "requirement_count"
                        ],
                        audit[
                            "coverage_status"
                        ],
                        audit[
                            "coverage_score"
                        ],
                    )
                )

        results.sort(
            key=lambda item: (
                item[
                    "section"
                ].get(
                    "page"
                )
                if item[
                    "section"
                ].get(
                    "page"
                )
                is not None
                else
                9999,
                item[
                    "section"
                ].get(
                    "section_key",
                    "",
                ),
            )
        )

        return results

    def _build_targeted_reextraction_prompt(
        self,
        section,
        existing_requirements,
        audit,
        document_language,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY corrected valid JSON.
""" % retry_reason

        return """
You are performing TARGETED atomic requirement extraction for an RFP
section that failed a coverage audit.

Dominant language: %s
Section heading: %s
Page: %s
Coverage status: %s
Coverage score: %s
Coverage reason: %s

GOAL:
Extract ONLY requirements that are missing from the existing extraction
or requirements that were previously merged too broadly.

ATOMICITY:
- one independently testable capability/obligation per requirement
- split lists of independent capabilities
- examples such as RFID, OCR, DRM, AI, search, APIs, standards,
  integrations, training, support, backup, reporting, cataloguing,
  eBook, repository features, etc. should be separate when they are
  independently evaluable
- do not duplicate an existing requirement merely with different wording

GROUNDING:
- every new item must have source_quote copied from THIS section
- obligation_basis_quote is required only when mandatory status is
  inherited from a parent sentence
- do not invent anything

MANDATORY:
- mandatory=true only when explicit mandatory wording exists in either
  source_quote or obligation_basis_quote
- appearing in a technical/specification section alone does NOT make the
  item mandatory
- preferred=true only when explicitly preferred/desirable

Return ONLY valid JSON:

{
  "requirements": [
    {
      "requirement": "",
      "description": "",
      "source_quote": "",
      "source_section": "",
      "mandatory": false,
      "preferred": false,
      "obligation_basis_quote": "",
      "exclusion_grade": false,
      "evidence_expected": ""
    }
  ]
}

%s

<COVERAGE_GAPS>
%s
</COVERAGE_GAPS>

<EXISTING_REQUIREMENTS>
%s
</EXISTING_REQUIREMENTS>

<RFP_SECTION>
%s
</RFP_SECTION>
""" % (
            document_language,
            section.get(
                "heading",
                "RFP",
            ),
            section.get(
                "page"
            ),
            audit.get(
                "coverage_status"
            ),
            audit.get(
                "coverage_score"
            ),
            audit.get(
                "reason",
                "",
            ),
            retry_section,
            json.dumps(
                audit.get(
                    "missing_requirement_hints",
                    [],
                ),
                ensure_ascii=False,
            ),
            json.dumps(
                [
                    {
                        "id": requirement.get(
                            "id",
                            "",
                        ),
                        "requirement": requirement.get(
                            "requirement",
                            "",
                        ),
                        "source_quote": requirement.get(
                            "source_quote",
                            "",
                        ),
                    }
                    for requirement in (
                        existing_requirements
                    )
                ],
                ensure_ascii=False,
            ),
            section.get(
                "text",
                "",
            )[
                :self.MAX_TARGETED_SECTION_CHARS
            ],
        )

    def _targeted_reextract_section(
        self,
        section,
        existing_requirements,
        audit,
        document_language,
    ):
        last_error = None

        for attempt in range(
            1,
            self.MAX_TARGETED_REEXTRACTION_RETRIES
            +
            2,
        ):
            response = self.llm.ask(
                self._build_targeted_reextraction_prompt(
                    section=section,
                    existing_requirements=(
                        existing_requirements
                    ),
                    audit=audit,
                    document_language=(
                        document_language
                    ),
                    retry_reason=(
                        last_error
                    ),
                ),
                label=(
                    "RFP-TargetedReextract-%s"
                    % section.get(
                        "section_key",
                        "SEC",
                    )
                ),
            )

            try:
                data = self._parse_json(
                    response,
                    (
                        "RFP targeted re-extraction %s"
                        % section.get(
                            "section_key",
                            "SEC",
                        )
                    ),
                )

                cleaned, error = (
                    self._validate_atomic_chunk_result(
                        data=data,
                        chunk={
                            "text": (
                                section.get(
                                    "text",
                                    "",
                                )
                            ),
                            "sections": [
                                section.get(
                                    "heading",
                                    "RFP",
                                )
                            ],
                        },
                        document_language=(
                            document_language
                        ),
                    )
                )

                if error:
                    raise ValueError(
                        error
                    )

                return cleaned

            except Exception as error:
                last_error = str(
                    error
                )

                if (
                    attempt
                    >=
                    self.MAX_TARGETED_REEXTRACTION_RETRIES
                    +
                    1
                ):
                    break

        raise RuntimeError(
            "Targeted requirement re-extraction failed for %s. %s"
            % (
                section.get(
                    "section_key",
                    "SEC",
                ),
                last_error,
            )
        )

    def _requirement_is_duplicate(
        self,
        candidate,
        existing_requirements,
    ):
        candidate_requirement = (
            candidate.get(
                "requirement",
                "",
            )
        )

        candidate_quote = (
            candidate.get(
                "source_quote",
                "",
            )
        )

        for existing in existing_requirements:
            requirement_similarity = (
                self._jaccard_similarity(
                    candidate_requirement,
                    existing.get(
                        "requirement",
                        "",
                    ),
                )
            )

            quote_similarity = (
                self._jaccard_similarity(
                    candidate_quote,
                    existing.get(
                        "source_quote",
                        "",
                    ),
                )
            )

            # Near-identical requirement meaning.
            if (
                requirement_similarity
                >=
                0.88
            ):
                return True

            # Same source sentence and very similar atomic meaning.
            if (
                quote_similarity
                >=
                0.95
                and
                requirement_similarity
                >=
                0.72
            ):
                return True

        return False

    def _convert_targeted_items_to_requirements(
        self,
        targeted_items,
        existing_requirements,
        rfp_text,
        document_language,
    ):
        pages = self._split_document_pages(
            rfp_text
        )

        accepted = []

        for item in targeted_items:
            if self._requirement_is_duplicate(
                item,
                existing_requirements
                +
                accepted,
            ):
                continue

            source_quote = item.get(
                "source_quote",
                "",
            )

            page_number = self._find_quote_page(
                pages,
                source_quote,
            )

            section = (
                item.get(
                    "source_section",
                    "",
                )
                or
                "RFP"
            )

            requirement = {
                "id": "",
                "requirement_id": "",
                "requirement": (
                    item.get(
                        "requirement",
                        "",
                    )
                ),
                "description": (
                    item.get(
                        "description",
                        "",
                    )
                ),
                "source_quote": (
                    source_quote
                ),
                "source_explanation": (
                    item.get(
                        "description",
                        "",
                    )
                ),
                "source": (
                    (
                        "Page %s - %s"
                        % (
                            page_number,
                            section,
                        )
                    )
                    if page_number is not None
                    else
                    section
                ),
                "page": (
                    page_number
                ),
                "section": (
                    section
                ),
                "mandatory": bool(
                    item.get(
                        "mandatory",
                        False,
                    )
                ),
                "preferred": bool(
                    item.get(
                        "preferred",
                        False,
                    )
                ),
                "requirement_type": (
                    self._requirement_type_label(
                        bool(
                            item.get(
                                "mandatory",
                                False,
                            )
                        ),
                        bool(
                            item.get(
                                "preferred",
                                False,
                            )
                        ),
                        document_language,
                    )
                ),
                "mandatory_evidence": (
                    (
                        item.get(
                            "obligation_basis_quote",
                            ""
                        )
                        or
                        source_quote
                    )
                    if item.get(
                        "mandatory",
                        False,
                    )
                    else
                    ""
                ),
                "obligation_basis_quote": (
                    item.get(
                        "obligation_basis_quote",
                        "",
                    )
                ),
                "evidence_expected": (
                    item.get(
                        "evidence_expected",
                        "",
                    )
                ),
                "response_evidence_required": (
                    item.get(
                        "evidence_expected",
                        "",
                    )
                ),
                "exclusion_grade": bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                ),
            }

            requirement.update(
                self._calculate_requirement_importance(
                    requirement
                )
            )

            accepted.append(
                requirement
            )

        return accepted

    def _renumber_requirements(
        self,
        requirements,
    ):
        """
        Synthetic IDs are owned by Python and are re-numbered after targeted
        coverage recovery so every downstream agent sees a stable contiguous
        R-001... sequence for this frozen RFP framework.
        """

        for index, requirement in enumerate(
            requirements,
            start=1,
        ):
            requirement_id = (
                "R-%03d"
                % index
            )

            requirement[
                "id"
            ] = requirement_id

            requirement[
                "requirement_id"
            ] = requirement_id

        return requirements

    def _recover_requirement_coverage(
        self,
        rfp_text,
        requirements,
        document_language,
    ):
        audit_results = (
            self._run_requirement_coverage_audit(
                rfp_text=rfp_text,
                requirements=requirements,
                document_language=document_language,
            )
        )

        targeted_sections = [
            item
            for item in audit_results
            if (
                item[
                    "audit"
                ][
                    "coverage_status"
                ]
                in {
                    "PARTIAL",
                    "POOR",
                }
                and
                (
                    item[
                        "audit"
                    ][
                        "missing_requirement_hints"
                    ]
                    or
                    item[
                        "audit"
                    ][
                        "coverage_score"
                    ]
                    <
                    80.0
                )
            )
        ]

        if not targeted_sections:
            return (
                requirements,
                {
                    "sections_audited": (
                        len(
                            audit_results
                        )
                    ),
                    "sections_reextracted": 0,
                    "requirements_added": 0,
                    "audit_results": (
                        audit_results
                    ),
                },
            )

        recovered_items = []

        for item in targeted_sections:
            section = item[
                "section"
            ]

            existing_for_section = [
                requirement
                for requirement in requirements
                if (
                    self._quote_is_grounded(
                        requirement.get(
                            "source_quote",
                            "",
                        ),
                        section.get(
                            "text",
                            "",
                        ),
                    )
                    or
                    (
                        section.get(
                            "page"
                        )
                        is not None
                        and
                        requirement.get(
                            "page"
                        )
                        ==
                        section.get(
                            "page"
                        )
                    )
                )
            ]

            new_items = (
                self._targeted_reextract_section(
                    section=section,
                    existing_requirements=(
                        existing_for_section
                    ),
                    audit=item[
                        "audit"
                    ],
                    document_language=(
                        document_language
                    ),
                )
            )

            recovered_items.extend(
                new_items
            )

            print(
                "Targeted re-extraction %s added %s candidate item(s)."
                % (
                    section.get(
                        "heading",
                        "RFP",
                    ),
                    len(
                        new_items
                    ),
                )
            )

        converted = (
            self._convert_targeted_items_to_requirements(
                targeted_items=recovered_items,
                existing_requirements=(
                    requirements
                ),
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        combined = list(
            requirements
        )

        combined.extend(
            converted
        )

        combined = (
            self._renumber_requirements(
                combined
            )
        )

        return (
            combined,
            {
                "sections_audited": (
                    len(
                        audit_results
                    )
                ),
                "sections_reextracted": (
                    len(
                        targeted_sections
                    )
                ),
                "requirements_added": (
                    len(
                        converted
                    )
                ),
                "audit_results": (
                    audit_results
                ),
            },
        )

    # =====================================================
    # Project information
    # =====================================================

    def _build_project_information_prompt(
        self,
        rfp_text,
        document_language,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY valid JSON.
""" % retry_reason

        return """
Extract factual project information from this RFP.

Dominant language: %s

RULES:
- Use only facts explicitly stated in the RFP.
- Every material fact must include source_quote.
- Do not infer missing dates, budgets, contacts or durations.
- If unknown, return null or [].
- Preserve the RFP language.

Return ONLY valid JSON:

{
  "title": {"value": null, "source_quote": ""},
  "issuing_entity": {"value": null, "source_quote": ""},
  "project_objective": {"value": null, "source_quote": ""},
  "scope_summary": {"value": null, "source_quote": ""},
  "implementation_duration": {"value": null, "source_quote": ""},
  "important_dates": [
    {"name": "", "value": "", "source_quote": ""}
  ],
  "submission_method": {"value": null, "source_quote": ""},
  "contact_information": [
    {"type": "", "value": "", "source_quote": ""}
  ]
}

%s

<RFP_DOCUMENT>
%s
</RFP_DOCUMENT>
""" % (
            document_language,
            retry_section,
            rfp_text[
                :self.PROJECT_INFO_CONTEXT_LIMIT
            ],
        )

    def _validate_project_information(
        self,
        data,
        rfp_text,
    ):
        if not isinstance(
            data,
            dict,
        ):
            raise ValueError(
                "Project information result must be an object."
            )

        pages = self._split_document_pages(
            rfp_text
        )

        def validate_fact(item):
            if not isinstance(
                item,
                dict,
            ):
                return {
                    "value": None,
                    "source_quote": "",
                    "page": None,
                }

            value = item.get(
                "value"
            )

            quote = self._normalize_text(
                item.get(
                    "source_quote",
                    "",
                )
            )

            if (
                value not in (
                    None,
                    "",
                    [],
                )
                and
                not self._quote_is_grounded(
                    quote,
                    rfp_text,
                )
            ):
                return {
                    "value": None,
                    "source_quote": "",
                    "page": None,
                }

            return {
                "value": value,
                "source_quote": quote,
                "page": (
                    self._find_quote_page(
                        pages,
                        quote,
                    )
                    if quote
                    else None
                ),
            }

        result = {
            "title": validate_fact(
                data.get(
                    "title"
                )
            ),
            "issuing_entity": validate_fact(
                data.get(
                    "issuing_entity"
                )
            ),
            "project_objective": validate_fact(
                data.get(
                    "project_objective"
                )
            ),
            "scope_summary": validate_fact(
                data.get(
                    "scope_summary"
                )
            ),
            "implementation_duration": validate_fact(
                data.get(
                    "implementation_duration"
                )
            ),
            "important_dates": [],
            "submission_method": validate_fact(
                data.get(
                    "submission_method"
                )
            ),
            "contact_information": [],
        }

        for item in data.get(
            "important_dates",
            []
        ):
            if not isinstance(
                item,
                dict,
            ):
                continue

            quote = self._normalize_text(
                item.get(
                    "source_quote",
                    "",
                )
            )

            if not self._quote_is_grounded(
                quote,
                rfp_text,
            ):
                continue

            result[
                "important_dates"
            ].append(
                {
                    "name": (
                        self._normalize_text(
                            item.get(
                                "name",
                                "",
                            )
                        )
                    ),
                    "value": (
                        self._normalize_text(
                            item.get(
                                "value",
                                "",
                            )
                        )
                    ),
                    "source_quote": quote,
                    "page": (
                        self._find_quote_page(
                            pages,
                            quote,
                        )
                    ),
                }
            )

        for item in data.get(
            "contact_information",
            []
        ):
            if not isinstance(
                item,
                dict,
            ):
                continue

            quote = self._normalize_text(
                item.get(
                    "source_quote",
                    "",
                )
            )

            if not self._quote_is_grounded(
                quote,
                rfp_text,
            ):
                continue

            result[
                "contact_information"
            ].append(
                {
                    "type": (
                        self._normalize_text(
                            item.get(
                                "type",
                                "",
                            )
                        )
                    ),
                    "value": (
                        self._normalize_text(
                            item.get(
                                "value",
                                "",
                            )
                        )
                    ),
                    "source_quote": quote,
                    "page": (
                        self._find_quote_page(
                            pages,
                            quote,
                        )
                    ),
                }
            )

        return result

    def _extract_project_information(
        self,
        rfp_text,
        document_language,
    ):
        last_error = None

        for attempt in range(
            1,
            3,
        ):
            response = self.llm.ask(
                self._build_project_information_prompt(
                    rfp_text=rfp_text,
                    document_language=document_language,
                    retry_reason=last_error,
                ),
                label="RFP-ProjectInformation",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP project information",
                )

                return (
                    self._validate_project_information(
                        data,
                        rfp_text,
                    )
                )

            except Exception as error:
                last_error = str(
                    error
                )

        print(
            "Project information extraction failed: %s"
            % last_error
        )

        return {
            "title": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "issuing_entity": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "project_objective": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "scope_summary": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "implementation_duration": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "important_dates": [],
            "submission_method": {
                "value": None,
                "source_quote": "",
                "page": None,
            },
            "contact_information": [],
        }

    # =====================================================
    # Eligibility gates
    # =====================================================

    def _build_eligibility_prompt(
        self,
        rfp_text,
        document_language,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY valid JSON.
""" % retry_reason

        return """
Extract ONLY vendor eligibility / submission gates from this RFP.

Dominant language: %s

STRICT DEFINITION:
An eligibility item is a document, declaration, certificate,
submission condition, deadline condition, bid-validity condition,
single-bid rule, signature/seal condition, or other gate that affects
whether the bid is accepted for evaluation.

DO NOT include ordinary implementation requirements merely because
they are mandatory.

Typical gates:
- signed technical/financial offers
- signed/stamped RFP
- commercial registration
- tax certificate
- social insurance certificate
- Saudization certificate
- bank account certificate
- bank guarantee
- submission deadline
- conflict-of-interest declaration
- required proposal file format
- bid validity
- explicit rejection/disqualification conditions

exclusion_grade=true only when the RFP explicitly says failure,
omission, lateness, or non-compliance can cause rejection,
disqualification, exclusion, or invalidation.

Every item must contain a grounded source_quote.

Return ONLY valid JSON:

{
  "eligibility_requirements": [
    {
      "name": "",
      "description": "",
      "category": "DOCUMENT | SUBMISSION | LEGAL | FINANCIAL | DECLARATION | DEADLINE | OTHER",
      "source_section": "",
      "source_quote": "",
      "evidence_expected": "",
      "exclusion_grade": false
    }
  ]
}

%s

<RFP_DOCUMENT>
%s
</RFP_DOCUMENT>
""" % (
            document_language,
            retry_section,
            rfp_text[
                :self.ELIGIBILITY_CONTEXT_LIMIT
            ],
        )

    def _extract_eligibility_requirements(
        self,
        rfp_text,
        document_language,
    ):
        last_error = None
        pages = self._split_document_pages(
            rfp_text
        )

        for attempt in range(
            1,
            3,
        ):
            response = self.llm.ask(
                self._build_eligibility_prompt(
                    rfp_text=rfp_text,
                    document_language=document_language,
                    retry_reason=last_error,
                ),
                label="RFP-Eligibility",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP eligibility extraction",
                )

            except Exception as error:
                last_error = str(
                    error
                )
                continue

            raw_items = (
                data.get(
                    "eligibility_requirements",
                    []
                )
                if isinstance(
                    data,
                    dict,
                )
                else
                []
            )

            if not isinstance(
                raw_items,
                list,
            ):
                last_error = (
                    "eligibility_requirements must be a list."
                )
                continue

            cleaned = []

            for item in raw_items:
                if not isinstance(
                    item,
                    dict,
                ):
                    continue

                quote = self._normalize_text(
                    item.get(
                        "source_quote",
                        "",
                    )
                )

                if not self._quote_is_grounded(
                    quote,
                    rfp_text,
                ):
                    continue

                category = (
                    self._normalize_text(
                        item.get(
                            "category",
                            "OTHER",
                        )
                    )
                    .upper()
                )

                if category not in {
                    "DOCUMENT",
                    "SUBMISSION",
                    "LEGAL",
                    "FINANCIAL",
                    "DECLARATION",
                    "DEADLINE",
                    "OTHER",
                }:
                    category = "OTHER"

                exclusion_grade = bool(
                    item.get(
                        "exclusion_grade",
                        False,
                    )
                )

                if self.EXCLUSION_CUE_PATTERN.search(
                    quote
                ):
                    exclusion_grade = True

                cleaned.append(
                    {
                        "name": (
                            self._normalize_text(
                                item.get(
                                    "name",
                                    "",
                                )
                            )
                        ),
                        "description": (
                            self._normalize_text(
                                item.get(
                                    "description",
                                    "",
                                )
                            )
                        ),
                        "category": category,
                        "source_section": (
                            self._normalize_text(
                                item.get(
                                    "source_section",
                                    "",
                                )
                            )
                        ),
                        "source_quote": quote,
                        "evidence_expected": (
                            self._normalize_text(
                                item.get(
                                    "evidence_expected",
                                    "",
                                )
                            )
                        ),
                        "exclusion_grade": (
                            exclusion_grade
                        ),
                        "page": (
                            self._find_quote_page(
                                pages,
                                quote,
                            )
                        ),
                    }
                )

            deduped = []

            for item in cleaned:
                is_duplicate = False

                for existing in deduped:
                    if (
                        self._jaccard_similarity(
                            item.get(
                                "name",
                                "",
                            ),
                            existing.get(
                                "name",
                                "",
                            ),
                        )
                        >=
                        0.9
                        and
                        self._jaccard_similarity(
                            item.get(
                                "source_quote",
                                "",
                            ),
                            existing.get(
                                "source_quote",
                                "",
                            ),
                        )
                        >=
                        0.85
                    ):
                        is_duplicate = True
                        break

                if not is_duplicate:
                    deduped.append(
                        item
                    )

            for index, item in enumerate(
                deduped,
                start=1,
            ):
                item[
                    "id"
                ] = (
                    "ELIG-%03d"
                    % index
                )

            return deduped

        print(
            "Eligibility extraction failed: %s"
            % last_error
        )

        return []

    # =====================================================
    # Explicit evaluation framework extraction
    # =====================================================

    def _build_explicit_evaluation_framework_prompt(
        self,
        rfp_text,
        document_language,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY valid JSON.
""" % retry_reason

        return """
Identify the explicit vendor-evaluation framework stated in this RFP.

Dominant language: %s

GOAL:
Find the sections that explicitly describe HOW offers will be compared
or evaluated, such as:
- evaluation of technical offers
- implementation methodology / work plan
- schedule
- deliverables
- prior experience
- team qualifications
- financial offer
- price competitiveness
- payment schedule
- compliance/submission gates

IMPORTANT:
- Do NOT turn every technical feature/module into an evaluation criterion.
- Distinguish:
  A) explicit evaluation dimensions used to compare vendors
  B) technical/functional requirements that should be grouped under
     broader technical criteria
  C) eligibility/submission gates
- Preserve each explicit evaluation dimension when the RFP states it.
- Every item must have a source_quote copied from the RFP.
- If the RFP states no explicit scoring weights, explicit_weight=null.
- Do not infer weights.

Return ONLY valid JSON:

{
  "explicit_evaluation_dimensions": [
    {
      "name": "",
      "description": "",
      "source_section": "",
      "source_quote": "",
      "explicit_weight": null,
      "explicit_weight_evidence": ""
    }
  ]
}

%s

<RFP_DOCUMENT>
%s
</RFP_DOCUMENT>
""" % (
            document_language,
            retry_section,
            rfp_text[
                :self.EVALUATION_FRAMEWORK_CONTEXT_LIMIT
            ],
        )

    def _extract_explicit_evaluation_framework(
        self,
        rfp_text,
        document_language,
    ):
        last_error = None
        pages = self._split_document_pages(
            rfp_text
        )

        for attempt in range(
            1,
            3,
        ):
            response = self.llm.ask(
                self._build_explicit_evaluation_framework_prompt(
                    rfp_text=rfp_text,
                    document_language=document_language,
                    retry_reason=last_error,
                ),
                label="RFP-ExplicitEvaluationFramework",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP explicit evaluation framework",
                )
            except Exception as error:
                last_error = str(error)
                continue

            raw_items = (
                data.get(
                    "explicit_evaluation_dimensions",
                    []
                )
                if isinstance(
                    data,
                    dict,
                )
                else
                []
            )

            if not isinstance(
                raw_items,
                list,
            ):
                last_error = (
                    "explicit_evaluation_dimensions must be a list."
                )
                continue

            cleaned = []

            for item in raw_items:
                if not isinstance(
                    item,
                    dict,
                ):
                    continue

                name = self._normalize_text(
                    item.get(
                        "name",
                        "",
                    )
                )

                quote = self._normalize_text(
                    item.get(
                        "source_quote",
                        "",
                    )
                )

                if not name:
                    continue

                if not self._quote_is_grounded(
                    quote,
                    rfp_text,
                ):
                    continue

                explicit_weight = self._safe_float(
                    item.get(
                        "explicit_weight"
                    ),
                    default=None,
                )

                weight_evidence = self._normalize_text(
                    item.get(
                        "explicit_weight_evidence",
                        "",
                    )
                )

                if explicit_weight is not None:
                    if (
                        explicit_weight <= 0
                        or
                        explicit_weight > 100
                        or
                        not self._quote_is_grounded(
                            weight_evidence,
                            rfp_text,
                        )
                    ):
                        explicit_weight = None
                        weight_evidence = ""

                cleaned.append(
                    {
                        "name": name,
                        "description": (
                            self._normalize_text(
                                item.get(
                                    "description",
                                    "",
                                )
                            )
                        ),
                        "source_section": (
                            self._normalize_text(
                                item.get(
                                    "source_section",
                                    "",
                                )
                            )
                        ),
                        "source_quote": quote,
                        "source_page": (
                            self._find_quote_page(
                                pages,
                                quote,
                            )
                        ),
                        "explicit_weight": (
                            explicit_weight
                        ),
                        "explicit_weight_evidence": (
                            weight_evidence
                        ),
                    }
                )

            return cleaned

        print(
            "Explicit evaluation framework extraction failed: %s"
            % last_error
        )

        return []

    # =====================================================
    # Criteria discovery
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
                    "id": (
                        requirement["id"]
                    ),
                    "section": (
                        requirement.get(
                            "section",
                            "",
                        )
                    ),
                    "mandatory": (
                        requirement.get(
                            "mandatory",
                            False,
                        )
                    ),
                    "preferred": (
                        requirement.get(
                            "preferred",
                            False,
                        )
                    ),
                    "exclusion_grade": (
                        requirement.get(
                            "exclusion_grade",
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
                    "source_quote": (
                        requirement.get(
                            "source_quote",
                            "",
                        )[:240]
                    ),
                }
            )

        return catalog

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
        explicit_evaluation_framework=None,
        retry_reason=None,
    ):
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY valid JSON.
""" % retry_reason

        return """
You are designing the evaluation framework for a procurement RFP.

Dominant language: %s

GOAL:
Create a balanced vendor-evaluation framework that organizes ALL atomic
requirements while staying faithful to HOW the RFP says offers will be
evaluated.

PRIORITY ORDER:
1. Use the explicit evaluation dimensions supplied below as PRIMARY
   anchors. Preserve their meaning instead of replacing them with
   product-feature/module categories.
2. Add broader criteria only when material RFP requirements are not
   reasonably covered by those explicit dimensions.
3. Technical sub-features (RFID, OCR, DRM, cataloguing protocols, search,
   eBook, AI, AR, LMS, APIs, etc.) should normally be grouped under broader
   technical/functional/architecture criteria unless the RFP explicitly
   scores them separately.

RULES:
1. Return between %s and %s criteria.
2. Criteria must represent evaluation dimensions, not a list of software
   modules.
3. Avoid tiny criteria with only one or two narrow feature requirements
   unless they are legally/commercially distinct or explicitly scored.
4. Keep implementation methodology, schedule/delivery, vendor/team
   capability, technical solution, support/operations, compliance/
   eligibility, and financial/commercial dimensions distinct when the RFP
   materially evaluates them separately.
5. Do not create empty criteria.
6. Do not assign requirement IDs yet.
7. Do not make "mandatory" a criterion by itself.
8. Eligibility/compliance may be a criterion only when supported by actual
   submission/legal gates.

GROUNDING:
- Every criterion must include source_quote copied from the RFP.
- explanation must explain why the RFP makes the criterion relevant.

WEIGHTS:
- explicit_weight only if the RFP explicitly ties a percentage/points
  to vendor evaluation scoring.
- Do not confuse SLA %%, VAT %%, payment %%, thresholds or quantities
  with evaluation weights.
- If no explicit evaluation weight exists, return null.
- Give each criterion importance 1-5 based on business impact,
  objectives, mandatory nature, risk and RFP emphasis.
- Requirement count alone must NOT determine criterion importance.

Return ONLY valid JSON:

{
  "criteria": [
    {
      "criterion_id": "C01",
      "name": "Criterion name in RFP language",
      "description": "What this criterion evaluates",
      "explanation": "Why the RFP makes it relevant",
      "source": "RFP section or basis",
      "source_quote": "Short verbatim quote from the RFP",
      "criterion_importance_score": 5,
      "criterion_importance_reason": "Factual reason",
      "explicit_weight": null,
      "explicit_weight_evidence": ""
    }
  ]
}

%s

<EXPLICIT_EVALUATION_FRAMEWORK>
%s
</EXPLICIT_EVALUATION_FRAMEWORK>

<RFP_CONTEXT>
%s
</RFP_CONTEXT>

<ATOMIC_REQUIREMENT_CATALOG>
%s
</ATOMIC_REQUIREMENT_CATALOG>
""" % (
            document_language,
            self._effective_min_criteria(
                requirements
            ),
            self.MAX_CRITERIA,
            retry_section,
            json.dumps(
                explicit_evaluation_framework
                or
                [],
                ensure_ascii=False,
            ),
            rfp_text[
                :self.DISCOVERY_RFP_CONTEXT_LIMIT
            ],
            json.dumps(
                self._build_requirement_catalog(
                    requirements
                ),
                ensure_ascii=False,
            ),
        )

    def _validate_discovered_criteria(
        self,
        data,
        requirements,
        rfp_text,
    ):
        if not isinstance(
            data,
            dict,
        ):
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
                "Dynamic criteria count is outside the allowed range."
            )

        pages = self._split_document_pages(
            rfp_text
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
                "C%02d"
                % index
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

            normalized_name = (
                self._normalize_search_text(
                    name
                )
            )

            if normalized_name in seen_names:
                raise ValueError(
                    "Duplicate criterion name: %s"
                    % name
                )

            seen_names.add(
                normalized_name
            )

            source_quote = self._normalize_text(
                criterion.get(
                    "source_quote",
                    "",
                )
            )

            if not self._quote_is_grounded(
                source_quote,
                rfp_text,
            ):
                raise ValueError(
                    "Criterion %s has an ungrounded source_quote."
                    % criterion_id
                )

            importance = self._safe_float(
                criterion.get(
                    "criterion_importance_score",
                    3,
                ),
                default=3.0,
            )

            importance = max(
                1.0,
                min(
                    5.0,
                    importance,
                ),
            )

            explicit_weight = self._safe_float(
                criterion.get(
                    "explicit_weight"
                ),
                default=None,
            )

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

            if (
                explicit_weight is not None
                and
                not self._quote_is_grounded(
                    explicit_weight_evidence,
                    rfp_text,
                )
            ):
                explicit_weight = None
                explicit_weight_evidence = ""

            cleaned.append(
                {
                    "criterion_id": (
                        criterion_id
                    ),
                    "name": name,
                    "description": (
                        self._normalize_text(
                            criterion.get(
                                "description",
                                "",
                            )
                        )
                    ),
                    "explanation": (
                        self._normalize_text(
                            criterion.get(
                                "explanation",
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
                    "source_quote": (
                        source_quote
                    ),
                    "source_page": (
                        self._find_quote_page(
                            pages,
                            source_quote,
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
                    "explicit_weight": (
                        explicit_weight
                    ),
                    "explicit_weight_evidence": (
                        explicit_weight_evidence
                    ),
                }
            )

        return cleaned

    def _discover_dynamic_criteria(
        self,
        rfp_text,
        requirements,
        document_language,
        explicit_evaluation_framework=None,
    ):
        last_error = None

        for attempt in range(
            1,
            self.MAX_DISCOVERY_RETRIES
            +
            2,
        ):
            response = self.llm.ask(
                self._build_criteria_discovery_prompt(
                    rfp_text=rfp_text,
                    requirements=requirements,
                    document_language=document_language,
                    retry_reason=last_error,
                ),
                label="RFP-CriteriaDiscovery",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP criteria discovery",
                )

                return (
                    self._validate_discovered_criteria(
                        data=data,
                        requirements=requirements,
                        rfp_text=rfp_text,
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

                print(
                    "Retrying criteria discovery because: %s"
                    % last_error
                )

        raise RuntimeError(
            "RFP criteria discovery failed after %s attempts. %s"
            % (
                self.MAX_DISCOVERY_RETRIES
                +
                1,
                last_error,
            )
        )

    # =====================================================
    # Criterion consolidation / anti-fragmentation
    # =====================================================

    def _target_criterion_range(
        self,
        requirement_count,
        explicit_dimension_count,
    ):
        """
        Produce a soft target range based on RFP size.

        This is intentionally not tied directly to requirement count for
        weighting; it is only used to avoid fragmented evaluation frameworks.
        """

        if requirement_count <= 10:
            min_count = 2
            max_count = 4

        elif requirement_count <= 30:
            min_count = 3
            max_count = 6

        elif requirement_count <= 80:
            min_count = 5
            max_count = 8

        else:
            min_count = 6
            max_count = self.MAX_FINAL_CRITERIA

        if explicit_dimension_count:
            min_count = max(
                min_count,
                min(
                    explicit_dimension_count,
                    self.MAX_FINAL_CRITERIA,
                ),
            )

        max_count = max(
            min_count,
            min(
                self.MAX_FINAL_CRITERIA,
                max(
                    max_count,
                    explicit_dimension_count,
                ),
            ),
        )

        return (
            min_count,
            max_count,
        )

    def _criterion_distribution_payload(
        self,
        criteria,
        grouped,
    ):
        payload = []

        for criterion in criteria:
            criterion_id = criterion[
                "criterion_id"
            ]

            criterion_requirements = grouped.get(
                criterion_id,
                [],
            )

            payload.append(
                {
                    "criterion_id": criterion_id,
                    "name": criterion.get(
                        "name",
                        "",
                    ),
                    "description": criterion.get(
                        "description",
                        "",
                    ),
                    "source_quote": criterion.get(
                        "source_quote",
                        "",
                    ),
                    "requirement_count": len(
                        criterion_requirements
                    ),
                    "requirements": [
                        {
                            "id": requirement.get(
                                "id",
                                "",
                            ),
                            "requirement": requirement.get(
                                "requirement",
                                "",
                            ),
                            "mandatory": requirement.get(
                                "mandatory",
                                False,
                            ),
                            "preferred": requirement.get(
                                "preferred",
                                False,
                            ),
                        }
                        for requirement in criterion_requirements
                    ],
                }
            )

        return payload

    def _build_consolidation_prompt(
        self,
        rfp_text,
        requirements,
        current_criteria,
        grouped,
        explicit_evaluation_framework,
        document_language,
        retry_reason=None,
    ):
        min_count, max_count = (
            self._target_criterion_range(
                requirement_count=len(
                    requirements
                ),
                explicit_dimension_count=len(
                    explicit_evaluation_framework
                    or
                    []
                ),
            )
        )

        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
Previous response invalid: %s
Return ONLY corrected valid JSON.
""" % retry_reason

        return """
You are refining an RFP evaluation framework after an initial
requirement-to-criterion assignment.

Dominant language: %s

GOAL:
Produce a balanced FINAL set of evaluation criteria that reflects the
RFP's actual vendor-comparison logic and avoids fragmented categories.

TARGET:
Return between %s and %s final criteria.

PRIORITY:
1. Preserve the meaning of explicit evaluation dimensions from the RFP.
2. Group technical sub-features/modules under broader evaluation
   dimensions instead of creating standalone criteria for each module.
3. Merge narrow administrative/legal clauses into a broader
   compliance/contractual criterion unless the RFP explicitly evaluates
   them independently.
4. Merge delivery handover/final-documentation obligations into
   implementation/delivery when they are part of the same delivery logic.
5. Keep genuinely distinct dimensions separate when materially justified:
   - compliance / eligibility / legal
   - technical solution / architecture / functionality
   - implementation methodology / delivery plan / schedule / deliverables
   - project governance / team / experience
   - security / privacy / continuity
   - training / support / maintenance / operations
   - financial / commercial
6. A criterion with fewer than %s requirements should normally be merged
   into a broader compatible criterion unless it is explicitly and
   independently evaluated by the RFP.
7. Do NOT create a criterion merely because one clause is important.
8. Do NOT create a criterion called "mandatory requirements".
9. Do NOT use requirement count to determine weights.
10. Every final criterion must include a grounded source_quote copied from
    the RFP.
11. source_basis must briefly explain whether the criterion is:
    - EXPLICIT_RFP_EVALUATION_DIMENSION
    - BROADER_RFP_REQUIREMENT_THEME
    - COMBINED_EXPLICIT_AND_THEME

WEIGHTS:
- explicit_weight only when the RFP explicitly assigns that evaluation
  weight to the final criterion.
- Otherwise explicit_weight=null.
- criterion_importance_score is 1-5 and should reflect RFP emphasis,
  business impact, risk and procurement significance.

Return ONLY valid JSON:

{
  "criteria": [
    {
      "criterion_id": "C01",
      "name": "Final criterion name",
      "description": "What it evaluates",
      "explanation": "Why these requirements belong together",
      "source": "RFP section/basis",
      "source_quote": "Short verbatim quote from the RFP",
      "source_basis": "EXPLICIT_RFP_EVALUATION_DIMENSION",
      "criterion_importance_score": 5,
      "criterion_importance_reason": "Factual reason",
      "explicit_weight": null,
      "explicit_weight_evidence": ""
    }
  ]
}

%s

<EXPLICIT_EVALUATION_FRAMEWORK>
%s
</EXPLICIT_EVALUATION_FRAMEWORK>

<CURRENT_CRITERIA_WITH_REQUIREMENTS>
%s
</CURRENT_CRITERIA_WITH_REQUIREMENTS>

<ATOMIC_REQUIREMENT_CATALOG>
%s
</ATOMIC_REQUIREMENT_CATALOG>

<RFP_CONTEXT>
%s
</RFP_CONTEXT>
""" % (
            document_language,
            min_count,
            max_count,
            self.MIN_NONEXPLICIT_REQUIREMENTS_PER_CRITERION,
            retry_section,
            json.dumps(
                explicit_evaluation_framework
                or
                [],
                ensure_ascii=False,
            ),
            json.dumps(
                self._criterion_distribution_payload(
                    current_criteria,
                    grouped,
                ),
                ensure_ascii=False,
            ),
            json.dumps(
                self._build_requirement_catalog(
                    requirements
                ),
                ensure_ascii=False,
            ),
            rfp_text[
                :self.DISCOVERY_RFP_CONTEXT_LIMIT
            ],
        )

    def _validate_consolidated_criteria(
        self,
        data,
        requirements,
        rfp_text,
        explicit_evaluation_framework,
    ):
        if not isinstance(
            data,
            dict,
        ):
            raise ValueError(
                "Criterion consolidation result must be an object."
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
                "Criterion consolidation is missing criteria."
            )

        min_count, max_count = (
            self._target_criterion_range(
                requirement_count=len(
                    requirements
                ),
                explicit_dimension_count=len(
                    explicit_evaluation_framework
                    or
                    []
                ),
            )
        )

        if not (
            min_count
            <=
            len(
                raw_criteria
            )
            <=
            max_count
        ):
            raise ValueError(
                "Final criterion count must be between %s and %s. Received %s."
                % (
                    min_count,
                    max_count,
                    len(
                        raw_criteria
                    ),
                )
            )

        pages = self._split_document_pages(
            rfp_text
        )

        cleaned = []
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
                    "Final criterion %s must be an object."
                    % index
                )

            name = self._normalize_text(
                criterion.get(
                    "name",
                    "",
                )
            )

            if not name:
                raise ValueError(
                    "Final criterion %s is missing a name."
                    % index
                )

            normalized_name = (
                self._normalize_search_text(
                    name
                )
            )

            if normalized_name in seen_names:
                raise ValueError(
                    "Duplicate final criterion name: %s"
                    % name
                )

            seen_names.add(
                normalized_name
            )

            source_quote = self._normalize_text(
                criterion.get(
                    "source_quote",
                    "",
                )
            )

            if not self._quote_is_grounded(
                source_quote,
                rfp_text,
            ):
                raise ValueError(
                    "Final criterion '%s' has an ungrounded source_quote."
                    % name
                )

            importance = self._safe_float(
                criterion.get(
                    "criterion_importance_score",
                    3,
                ),
                default=3.0,
            )

            importance = max(
                1.0,
                min(
                    5.0,
                    importance,
                ),
            )

            explicit_weight = self._safe_float(
                criterion.get(
                    "explicit_weight"
                ),
                default=None,
            )

            explicit_weight_evidence = self._normalize_text(
                criterion.get(
                    "explicit_weight_evidence",
                    "",
                )
            )

            if explicit_weight is not None:
                if (
                    explicit_weight <= 0
                    or
                    explicit_weight > 100
                    or
                    not self._quote_is_grounded(
                        explicit_weight_evidence,
                        rfp_text,
                    )
                ):
                    explicit_weight = None
                    explicit_weight_evidence = ""

            source_basis = (
                self._normalize_text(
                    criterion.get(
                        "source_basis",
                        "BROADER_RFP_REQUIREMENT_THEME",
                    )
                )
                .upper()
            )

            if source_basis not in {
                "EXPLICIT_RFP_EVALUATION_DIMENSION",
                "BROADER_RFP_REQUIREMENT_THEME",
                "COMBINED_EXPLICIT_AND_THEME",
            }:
                source_basis = (
                    "BROADER_RFP_REQUIREMENT_THEME"
                )

            cleaned.append(
                {
                    "criterion_id": (
                        "C%02d"
                        % index
                    ),
                    "name": name,
                    "description": (
                        self._normalize_text(
                            criterion.get(
                                "description",
                                "",
                            )
                        )
                    ),
                    "explanation": (
                        self._normalize_text(
                            criterion.get(
                                "explanation",
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
                    "source_quote": source_quote,
                    "source_page": (
                        self._find_quote_page(
                            pages,
                            source_quote,
                        )
                    ),
                    "source_basis": (
                        source_basis
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
                    "explicit_weight": (
                        explicit_weight
                    ),
                    "explicit_weight_evidence": (
                        explicit_weight_evidence
                    ),
                }
            )

        return cleaned

    def _consolidate_criteria(
        self,
        rfp_text,
        requirements,
        current_criteria,
        grouped,
        explicit_evaluation_framework,
        document_language,
    ):
        last_error = None

        for attempt in range(
            1,
            self.MAX_CONSOLIDATION_RETRIES
            +
            2,
        ):
            response = self.llm.ask(
                self._build_consolidation_prompt(
                    rfp_text=rfp_text,
                    requirements=requirements,
                    current_criteria=current_criteria,
                    grouped=grouped,
                    explicit_evaluation_framework=(
                        explicit_evaluation_framework
                    ),
                    document_language=document_language,
                    retry_reason=last_error,
                ),
                label="RFP-CriteriaConsolidation",
            )

            try:
                data = self._parse_json(
                    response,
                    "RFP criterion consolidation",
                )

                return (
                    self._validate_consolidated_criteria(
                        data=data,
                        requirements=requirements,
                        rfp_text=rfp_text,
                        explicit_evaluation_framework=(
                            explicit_evaluation_framework
                        ),
                    )
                )

            except Exception as error:
                last_error = str(
                    error
                )

                if (
                    attempt
                    >=
                    self.MAX_CONSOLIDATION_RETRIES
                    +
                    1
                ):
                    break

                print(
                    "Retrying criterion consolidation because: %s"
                    % last_error
                )

        raise RuntimeError(
            "RFP criterion consolidation failed after %s attempts. %s"
            % (
                self.MAX_CONSOLIDATION_RETRIES
                +
                1,
                last_error,
            )
        )

    def _criterion_balance_stats(
        self,
        criteria,
    ):
        return [
            {
                "criterion_id": (
                    criterion.get(
                        "criterion_id"
                    )
                ),
                "name": (
                    criterion.get(
                        "name"
                    )
                ),
                "requirement_count": (
                    len(
                        criterion.get(
                            "requirements",
                            []
                        )
                    )
                ),
                "source_basis": (
                    criterion.get(
                        "source_basis",
                        ""
                    )
                ),
            }
            for criterion in criteria
        ]

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
        retry_section = ""

        if retry_reason:
            retry_section = """
RETRY:
%s
Return exactly one assignment for every supplied requirement_id.
""" % retry_reason

        criteria_payload = [
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
                    criterion.get(
                        "description",
                        "",
                    )
                ),
            }
            for criterion in criteria
        ]

        requirement_payload = [
            {
                "requirement_id": (
                    requirement[
                        "id"
                    ]
                ),
                "requirement": (
                    requirement.get(
                        "requirement",
                        "",
                    )
                ),
                "description": (
                    requirement.get(
                        "description",
                        "",
                    )
                ),
                "section": (
                    requirement.get(
                        "section",
                        "",
                    )
                ),
                "source_quote": (
                    requirement.get(
                        "source_quote",
                        "",
                    )
                ),
            }
            for requirement in batch
        ]

        return """
Assign each atomic RFP requirement to exactly one evaluation criterion.

Batch %s of %s.

RULES:
- use only supplied requirement_id values
- use only supplied criterion_id values
- one assignment per requirement
- no omissions
- no duplicates
- no invented IDs
- assign by PRIMARY evaluation purpose
- use semantic meaning, not keyword matching only
- technical capabilities belong in technical/functional criteria even
  when mandatory
- checklist/submission gates belong in compliance/eligibility
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
      "requirement_id": "R-001",
      "criterion_id": "C01"
    }
  ]
}
""" % (
            batch_number,
            total_batches,
            retry_section,
            json.dumps(
                criteria_payload,
                ensure_ascii=False,
            ),
            json.dumps(
                requirement_payload,
                ensure_ascii=False,
            ),
        )

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
                "Assignment count mismatch.",
            )

        assignment_map = {}

        for item in assignments:
            if not isinstance(
                item,
                dict,
            ):
                return (
                    None,
                    "Assignment item must be an object.",
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

        if set(
            assignment_map.keys()
        ) != set(
            expected_ids
        ):
            return (
                None,
                "Missing requirement assignments.",
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
            self.MAX_ASSIGNMENT_RETRIES
            +
            1
        )

        last_error = None

        for attempt in range(
            1,
            attempts + 1,
        ):
            response = self.llm.ask(
                self._build_assignment_prompt(
                    criteria=criteria,
                    batch=batch,
                    batch_number=batch_number,
                    total_batches=total_batches,
                    retry_reason=last_error,
                ),
                label=(
                    "RFPCriteriaAssign%s"
                    % batch_number
                ),
            )

            try:
                data = self._parse_json(
                    response,
                    (
                        "RFP criterion assignment batch %s"
                        % batch_number
                    ),
                )

            except Exception as error:
                last_error = str(
                    error
                )

                if attempt >= attempts:
                    break

                continue

            assignment_map, error = (
                self._validate_assignment_result(
                    data=data,
                    batch=batch,
                    criteria=criteria,
                )
            )

            if not error:
                return assignment_map

            last_error = error

            if attempt >= attempts:
                break

        raise RuntimeError(
            "RFP criterion assignment batch %s failed. %s"
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
            "Batches: %s"
            % total_batches
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
                batch_index = future_map[
                    future
                ]

                results_by_batch[
                    batch_index
                ] = future.result()

                print(
                    "Criterion assignment batch %s/%s completed."
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
            for requirement_id, criterion_id in (
                results_by_batch[
                    batch_index
                ].items()
            ):
                if requirement_id in global_map:
                    raise RuntimeError(
                        "Duplicate requirement assignment across batches."
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
                "Dynamic criterion assignment lost or invented requirements."
            )

        return global_map

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

        active = [
            criterion
            for criterion in discovered_criteria
            if grouped[
                criterion[
                    "criterion_id"
                ]
            ]
        ]

        if len(active) < (
            self._effective_min_criteria(
                requirements
            )
        ):
            raise RuntimeError(
                "Too few active criteria after assignment."
            )

        return active, grouped

    # =====================================================
    # Weighting / overrides
    # =====================================================

    def _load_weight_overrides(
        self,
        explicit_overrides=None,
    ):
        if explicit_overrides is not None:
            if not isinstance(
                explicit_overrides,
                dict,
            ):
                raise ValueError(
                    "weight_overrides must be a dictionary."
                )

            return explicit_overrides

        raw = os.getenv(
            "RFP_WEIGHT_OVERRIDES_JSON",
            "",
        ).strip()

        if not raw:
            return {}

        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            raise ValueError(
                "RFP_WEIGHT_OVERRIDES_JSON must be valid JSON."
            )

        if not isinstance(
            parsed,
            dict,
        ):
            raise ValueError(
                "RFP_WEIGHT_OVERRIDES_JSON must be a JSON object."
            )

        return parsed

    def _resolve_weight_override(
        self,
        criterion,
        overrides,
    ):
        candidates = [
            criterion.get(
                "criterion_id",
                "",
            ),
            criterion.get(
                "name",
                "",
            ),
            self._normalize_search_text(
                criterion.get(
                    "name",
                    "",
                )
            ),
        ]

        for candidate in candidates:
            if candidate in overrides:
                value = self._safe_float(
                    overrides[
                        candidate
                    ],
                    default=None,
                )

                if (
                    value is not None
                    and
                    value >= 0
                ):
                    return value

        return None

    def _has_complete_explicit_weights(
        self,
        criteria,
    ):
        if not criteria:
            return False

        weights = []

        for criterion in criteria:
            value = self._safe_float(
                criterion.get(
                    "explicit_weight"
                ),
                default=None,
            )

            if value is None:
                return False

            weights.append(
                value
            )

        return abs(
            sum(weights)
            -
            100.0
        ) <= 0.05

    def _normalize_importance_weights(
        self,
        criteria,
    ):
        total = sum(
            float(
                criterion.get(
                    "criterion_importance_score",
                    3,
                )
            )
            for criterion in criteria
        )

        if total <= 0:
            raise ValueError(
                "Criterion importance total must be > 0."
            )

        weights = {}
        running = 0.0

        for index, criterion in enumerate(
            criteria
        ):
            criterion_id = criterion[
                "criterion_id"
            ]

            if index == len(criteria) - 1:
                value = round(
                    100.0
                    -
                    running,
                    2,
                )

            else:
                value = round(
                    (
                        float(
                            criterion.get(
                                "criterion_importance_score",
                                3,
                            )
                        )
                        /
                        total
                        *
                        100.0
                    ),
                    2,
                )

                running += value

            weights[
                criterion_id
            ] = value

        return weights

    def _apply_weight_overrides(
        self,
        criteria,
        base_weights,
        overrides,
    ):
        resolved = {}

        for criterion in criteria:
            override = (
                self._resolve_weight_override(
                    criterion,
                    overrides,
                )
            )

            if override is not None:
                resolved[
                    criterion[
                        "criterion_id"
                    ]
                ] = override

        if not resolved:
            return base_weights, {}

        overridden_total = sum(
            resolved.values()
        )

        if overridden_total > 100.0001:
            raise ValueError(
                "System-defined criterion weight overrides exceed 100%."
            )

        remaining = [
            criterion
            for criterion in criteria
            if criterion[
                "criterion_id"
            ]
            not in resolved
        ]

        remaining_weight = (
            100.0
            -
            overridden_total
        )

        if (
            not remaining
            and
            abs(
                remaining_weight
            )
            >
            0.05
        ):
            raise ValueError(
                "Complete weight override set must total 100%."
            )

        final = {
            criterion_id: round(
                value,
                2,
            )
            for criterion_id, value in resolved.items()
        }

        if remaining:
            base_remaining_total = sum(
                float(
                    base_weights[
                        criterion[
                            "criterion_id"
                        ]
                    ]
                )
                for criterion in remaining
            )

            running = sum(
                final.values()
            )

            for index, criterion in enumerate(
                remaining
            ):
                criterion_id = criterion[
                    "criterion_id"
                ]

                if index == len(remaining) - 1:
                    value = round(
                        100.0
                        -
                        running,
                        2,
                    )

                elif base_remaining_total > 0:
                    value = round(
                        (
                            float(
                                base_weights[
                                    criterion_id
                                ]
                            )
                            /
                            base_remaining_total
                            *
                            remaining_weight
                        ),
                        2,
                    )

                    running += value

                else:
                    value = round(
                        remaining_weight
                        /
                        len(remaining),
                        2,
                    )

                    running += value

                final[
                    criterion_id
                ] = value

        return final, resolved

    def _finalize_criteria_weights(
        self,
        discovered_criteria,
        grouped,
        weight_overrides=None,
    ):
        overrides = self._load_weight_overrides(
            explicit_overrides=(
                weight_overrides
            )
        )

        explicit_complete = (
            self._has_complete_explicit_weights(
                discovered_criteria
            )
        )

        if explicit_complete:
            base_weights = {
                criterion[
                    "criterion_id"
                ]: float(
                    criterion[
                        "explicit_weight"
                    ]
                )
                for criterion in discovered_criteria
            }

            base_source = "explicit_rfp"

        else:
            base_weights = (
                self._normalize_importance_weights(
                    discovered_criteria
                )
            )

            base_source = "system_defined"

        final_weights, resolved_overrides = (
            self._apply_weight_overrides(
                criteria=discovered_criteria,
                base_weights=base_weights,
                overrides=overrides,
            )
        )

        final_criteria = []

        for criterion in discovered_criteria:
            criterion_id = criterion[
                "criterion_id"
            ]

            criterion_requirements = grouped[
                criterion_id
            ]

            if criterion_id in resolved_overrides:
                weight_source = (
                    "system_defined_override"
                )

                weight_evidence = (
                    "Configured system weight override."
                )

            elif resolved_overrides:
                weight_source = (
                    "system_defined_adjusted"
                )

                weight_evidence = (
                    "Adjusted to preserve a 100% total after system weight overrides."
                )

            elif base_source == "explicit_rfp":
                weight_source = "explicit_rfp"

                weight_evidence = (
                    criterion.get(
                        "explicit_weight_evidence",
                        "",
                    )
                )

            else:
                weight_source = (
                    "system_defined"
                )

                weight_evidence = (
                    "System-defined from criterion-level importance because "
                    "the RFP did not contain a complete explicit scoring weight scheme."
                )

            average_importance = (
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
                len(
                    criterion_requirements
                )
            )

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
                    "explanation": (
                        criterion.get(
                            "explanation",
                            "",
                        )
                    ),
                    "source": (
                        criterion.get(
                            "source",
                            "RFP",
                        )
                    ),
                    "source_quote": (
                        criterion.get(
                            "source_quote",
                            "",
                        )
                    ),
                    "source_page": (
                        criterion.get(
                            "source_page"
                        )
                    ),
                    "source_basis": (
                        criterion.get(
                            "source_basis",
                            ""
                        )
                    ),
                    "weight": (
                        round(
                            final_weights[
                                criterion_id
                            ],
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
                        criterion.get(
                            "criterion_importance_score",
                            3,
                        )
                    ),
                    "criterion_importance_reason": (
                        criterion.get(
                            "criterion_importance_reason",
                            "",
                        )
                    ),
                    "average_requirement_importance": (
                        round(
                            average_importance,
                            3,
                        )
                    ),
                    "average_importance": (
                        round(
                            average_importance,
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
    # Summary / validation / output
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

                item = dict(
                    requirement
                )

                item[
                    "criterion"
                ] = criterion[
                    "name"
                ]

                item[
                    "criterion_id"
                ] = criterion[
                    "criterion_id"
                ]

                mandatory.append(
                    item
                )

        return mandatory

    def _generate_summary(
        self,
        rfp_text,
        document_language,
    ):
        prompt = """
Summarize this RFP factually in the same dominant language.

Dominant language: %s

Rules:
- concise
- no invented facts
- focus on project purpose, scope and procurement intent
- do not calculate requirement counts or weights

Return ONLY valid JSON:
{
  "rfp_summary": ""
}

<RFP_DOCUMENT>
%s
</RFP_DOCUMENT>
""" % (
            document_language,
            rfp_text[
                :40000
            ],
        )

        response = self.llm.ask(
            prompt,
            label="RFP-Summary",
        )

        try:
            data = self._parse_json(
                response,
                "RFP summary",
            )

        except Exception:
            data = {}

        summary = (
            self._normalize_text(
                data.get(
                    "rfp_summary",
                    "",
                )
            )
            if isinstance(
                data,
                dict,
            )
            else
            ""
        )

        if summary:
            return summary

        if document_language == "Arabic":
            return (
                "تم تحليل وثيقة طلب تقديم العروض واستخراج إطار التقييم والمتطلبات منها."
            )

        return (
            "The RFP was analyzed and its evaluation framework and requirements were extracted."
        )

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

        grouped_ids = []

        for criterion in criteria:
            grouped_ids.extend(
                requirement[
                    "id"
                ]
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
                "A requirement was assigned to more than one criterion."
            )

        if set(grouped_ids) != set(
            expected_ids
        ):
            missing = sorted(
                set(expected_ids)
                -
                set(grouped_ids)
            )

            extra = sorted(
                set(grouped_ids)
                -
                set(expected_ids)
            )

            raise ValueError(
                "Requirement grouping mismatch. Missing=%s Extra=%s"
                % (
                    missing,
                    extra,
                )
            )

        total_weight = round(
            sum(
                float(
                    criterion[
                        "weight"
                    ]
                )
                for criterion in criteria
            ),
            2,
        )

        if abs(
            total_weight
            -
            100.0
        ) > 0.05:
            raise ValueError(
                "Criterion weights do not total 100. Current total: %s"
                % total_weight
            )

    def analyze(
        self,
        rfp_text,
        weight_overrides=None,
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
            "STEP 0 - PROJECT INFORMATION"
        )
        print(
            "================================"
        )

        project_information = (
            self._extract_project_information(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP A - EXTRACTING ATOMIC RFP REQUIREMENTS"
        )
        print(
            "================================"
        )

        requirements = (
            self._extract_requirements(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        if not requirements:
            raise RuntimeError(
                "No grounded atomic RFP requirements could be extracted."
            )

        print()
        print(
            "================================"
        )
        print(
            "STEP A2 - AUDITING REQUIREMENT COVERAGE"
        )
        print(
            "================================"
        )

        (
            requirements,
            coverage_audit_metadata,
        ) = (
            self._recover_requirement_coverage(
                rfp_text=rfp_text,
                requirements=requirements,
                document_language=document_language,
            )
        )

        print(
            "Coverage audit added %s requirement(s). Final atomic count: %s"
            % (
                coverage_audit_metadata.get(
                    "requirements_added",
                    0,
                ),
                len(
                    requirements
                ),
            )
        )

        mandatory_count = sum(
            1
            for requirement in requirements
            if requirement.get(
                "mandatory",
                False,
            )
        )

        preferred_count = sum(
            1
            for requirement in requirements
            if requirement.get(
                "preferred",
                False,
            )
        )

        exclusion_count = sum(
            1
            for requirement in requirements
            if requirement.get(
                "exclusion_grade",
                False,
            )
        )

        print(
            "Requirement extraction method: %s"
            % self.requirement_extraction_method
        )
        self.requirement_extraction_quality[
            "coverage_audit_sections"
        ] = coverage_audit_metadata.get(
            "sections_audited",
            0,
        )

        self.requirement_extraction_quality[
            "coverage_reextracted_sections"
        ] = coverage_audit_metadata.get(
            "sections_reextracted",
            0,
        )

        self.requirement_extraction_quality[
            "coverage_requirements_added"
        ] = coverage_audit_metadata.get(
            "requirements_added",
            0,
        )

        print(
            "Atomic requirements after coverage audit: %s"
            % len(requirements)
        )
        print(
            "Mandatory: %s"
            % mandatory_count
        )
        print(
            "Preferred: %s"
            % preferred_count
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP B - EXTRACTING ELIGIBILITY GATES"
        )
        print(
            "================================"
        )

        eligibility_requirements = (
            self._extract_eligibility_requirements(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        print(
            "Eligibility gates: %s"
            % len(
                eligibility_requirements
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP C - EXTRACTING EXPLICIT EVALUATION FRAMEWORK"
        )
        print(
            "================================"
        )

        explicit_evaluation_framework = (
            self._extract_explicit_evaluation_framework(
                rfp_text=rfp_text,
                document_language=document_language,
            )
        )

        print(
            "Explicit evaluation dimensions: %s"
            % len(
                explicit_evaluation_framework
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP D - DISCOVERING EVALUATION CRITERIA"
        )
        print(
            "================================"
        )

        discovered_criteria = (
            self._discover_dynamic_criteria(
                rfp_text=rfp_text,
                requirements=requirements,
                document_language=document_language,
                explicit_evaluation_framework=(
                    explicit_evaluation_framework
                ),
            )
        )

        print(
            "Criteria discovered: %s"
            % len(
                discovered_criteria
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP E - ASSIGNING REQUIREMENTS TO CRITERIA"
        )
        print(
            "================================"
        )

        initial_assignment_map = (
            self._assign_requirements_to_criteria(
                requirements=requirements,
                criteria=discovered_criteria,
            )
        )

        initial_active_criteria, initial_grouped = (
            self._build_dynamic_criteria(
                requirements=requirements,
                discovered_criteria=discovered_criteria,
                assignment_map=(
                    initial_assignment_map
                ),
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP F - CONSOLIDATING EVALUATION CRITERIA"
        )
        print(
            "================================"
        )

        consolidated_criteria = (
            self._consolidate_criteria(
                rfp_text=rfp_text,
                requirements=requirements,
                current_criteria=(
                    initial_active_criteria
                ),
                grouped=initial_grouped,
                explicit_evaluation_framework=(
                    explicit_evaluation_framework
                ),
                document_language=(
                    document_language
                ),
            )
        )

        print(
            "Consolidated criteria: %s -> %s"
            % (
                len(
                    initial_active_criteria
                ),
                len(
                    consolidated_criteria
                ),
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP G - REASSIGNING REQUIREMENTS TO FINAL CRITERIA"
        )
        print(
            "================================"
        )

        final_assignment_map = (
            self._assign_requirements_to_criteria(
                requirements=requirements,
                criteria=consolidated_criteria,
            )
        )

        active_criteria, grouped = (
            self._build_dynamic_criteria(
                requirements=requirements,
                discovered_criteria=(
                    consolidated_criteria
                ),
                assignment_map=(
                    final_assignment_map
                ),
            )
        )

        print()
        print(
            "================================"
        )
        print(
            "STEP H - FINALIZING WEIGHTS"
        )
        print(
            "================================"
        )

        criteria = (
            self._finalize_criteria_weights(
                discovered_criteria=active_criteria,
                grouped=grouped,
                weight_overrides=weight_overrides,
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
            "STEP I - RFP SUMMARY"
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
                    criterion[
                        "weight"
                    ]
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
            "Language: %s"
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
            % len(
                mandatory_requirements
            )
        )
        print(
            "Preferred: %s"
            % preferred_count
        )
        print(
            "Eligibility gates: %s"
            % len(
                eligibility_requirements
            )
        )
        print(
            "Total Weight: %s%%"
            % total_weight
        )
        print(
            "Weight Source: %s"
            % overall_weight_source
        )

        for criterion in criteria:
            criterion_mandatory = sum(
                1
                for requirement in criterion[
                    "requirements"
                ]
                if requirement.get(
                    "mandatory",
                    False,
                )
            )

            criterion_preferred = sum(
                1
                for requirement in criterion[
                    "requirements"
                ]
                if requirement.get(
                    "preferred",
                    False,
                )
            )

            print(
                "- %s | %s | %s requirements | %s mandatory | "
                "%s preferred | weight=%s%% | source=%s"
                % (
                    criterion[
                        "criterion_id"
                    ],
                    criterion[
                        "name"
                    ],
                    len(
                        criterion[
                            "requirements"
                        ]
                    ),
                    criterion_mandatory,
                    criterion_preferred,
                    criterion[
                        "weight"
                    ],
                    criterion[
                        "weight_source"
                    ],
                )
            )

            print(
                "  source_basis=%s"
                % criterion.get(
                    "source_basis",
                    ""
                )
            )

        return {
            "rfp_summary": (
                rfp_summary
            ),
            "document_language": (
                document_language
            ),
            "project_information": (
                project_information
            ),
            "eligibility_requirements": (
                eligibility_requirements
            ),
            "explicit_evaluation_framework": (
                explicit_evaluation_framework
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
                "preferred_requirement_count": (
                    preferred_count
                ),
                "eligibility_requirement_count": (
                    len(
                        eligibility_requirements
                    )
                ),
                "explicit_evaluation_dimension_count": (
                    len(
                        explicit_evaluation_framework
                    )
                ),
                "exclusion_grade_requirement_count": (
                    exclusion_count
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
                    self.requirement_extraction_method
                ),
                "requirement_extraction_quality": (
                    self.requirement_extraction_quality
                ),
                "coverage_audit": (
                    coverage_audit_metadata
                ),
                "criteria_discovery_method": (
                    "grounded_dynamic_llm_discovery_then_consolidation"
                ),
                "criteria_consolidation_applied": (
                    True
                ),
                "initial_criteria_count": (
                    len(
                        discovered_criteria
                    )
                ),
                "final_criteria_balance": (
                    self._criterion_balance_stats(
                        criteria
                    )
                ),
                "requirement_assignment_method": (
                    "initial_assignment_then_consolidation_then_final_reassignment"
                ),
                "weighting_method": (
                    "system_override_else_explicit_rfp_else_system_defined_importance"
                ),
                "criterion_weight_count_independent": True,
                "dynamic_criteria": True,
                "atomic_requirements": True,
                "source_grounding_required": True,
            },
        }

    def close(self):
        self.llm.close()
