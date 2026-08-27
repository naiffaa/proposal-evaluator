import math
import re
from collections import Counter
from typing import Iterable, Sequence


STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "are", "was",
    "were", "will", "shall", "must", "should", "can", "may", "into",
    "their", "there", "have", "has", "had", "not", "all", "any", "each",
    "every", "only", "within", "under", "over", "using", "use", "used",
    "vendor", "proposal", "requirement", "requirements", "criterion",
    "criteria", "evaluation", "rfp", "provide", "provided", "solution",
    "project", "system",
}


DOMAIN_HINTS = {
    "technical": [
        "technical", "architecture", "platform", "integration", "api",
        "security", "infrastructure", "performance", "availability",
        "functional", "non-functional", "database", "cloud", "network",
        "analytics", "reporting", "data", "disaster recovery", "backup",
    ],
    "experience": [
        "experience", "previous", "past", "project", "implementation",
        "client", "customer", "reference", "track record", "years",
        "delivered", "deployment", "similar", "portfolio",
    ],
    "team": [
        "team", "personnel", "staff", "employee", "cv", "resume",
        "qualification", "certification", "certified", "engineer",
        "architect", "manager", "expert", "specialist", "degree",
    ],
    "financial": [
        "financial", "commercial", "price", "pricing", "cost", "budget",
        "sar", "usd", "fee", "fees", "payment", "discount", "tax",
        "subscription", "implementation cost", "maintenance cost",
        "total cost", "tco",
    ],
    "project_plan": [
        "project plan", "implementation plan", "schedule", "timeline",
        "milestone", "delivery", "methodology", "phase", "workplan",
        "governance", "project management", "risk management",
    ],
    "compliance": [
        "mandatory", "compliance", "eligible", "eligibility", "must",
        "required", "certification", "license", "registration",
        "data residency", "sla", "security", "legal", "pass/fail",
    ],
}


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _tokenize(value: str) -> list[str]:
    text = _normalize_text(value).lower()
    tokens = re.findall(r"[a-z0-9][a-z0-9_./+-]{2,}", text)
    return [
        token
        for token in tokens
        if token not in STOPWORDS
    ]


def _split_paragraphs(text: str) -> list[str]:
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    blocks = [
        block.strip()
        for block in re.split(r"\n\s*\n+", text)
        if block.strip()
    ]

    # OCI line extraction can occasionally produce very large blocks.
    # Split those blocks on lines so retrieval remains granular.
    paragraphs = []
    for block in blocks:
        if len(block) <= 3500:
            paragraphs.append(block)
            continue

        lines = [
            line.strip()
            for line in block.split("\n")
            if line.strip()
        ]

        current = []
        current_len = 0
        for line in lines:
            projected = current_len + len(line) + 1

            if current and projected > 3000:
                paragraphs.append("\n".join(current))
                current = [line]
                current_len = len(line)
            else:
                current.append(line)
                current_len = projected

        if current:
            paragraphs.append("\n".join(current))

    if not paragraphs and text.strip():
        paragraphs = [text.strip()]

    return paragraphs


def _make_chunks(
    text: str,
    target_chars: int = 3000,
    overlap_chars: int = 450,
) -> list[str]:
    paragraphs = _split_paragraphs(text)

    chunks = []
    current = []
    current_len = 0

    for paragraph in paragraphs:
        p_len = len(paragraph)

        if current and current_len + p_len + 2 > target_chars:
            chunk = "\n\n".join(current).strip()
            if chunk:
                chunks.append(chunk)

            # Keep a small tail from the previous chunk for continuity.
            tail = chunk[-overlap_chars:] if chunk else ""
            current = [tail, paragraph] if tail else [paragraph]
            current_len = sum(len(item) for item in current) + 2
        else:
            current.append(paragraph)
            current_len += p_len + 2

    if current:
        chunk = "\n\n".join(current).strip()
        if chunk:
            chunks.append(chunk)

    return chunks


def _query_text(
    query_parts: Sequence[str] | None,
    domain_hint: str | None,
) -> str:
    parts = [
        _normalize_text(part)
        for part in (query_parts or [])
        if _normalize_text(part)
    ]

    if domain_hint:
        parts.extend(DOMAIN_HINTS.get(domain_hint, []))

    return "\n".join(parts)


def _score_chunk(
    chunk: str,
    query_tokens: list[str],
    important_phrases: list[str],
) -> float:
    if not chunk:
        return 0.0

    lower = chunk.lower()
    chunk_tokens = _tokenize(chunk)

    if not chunk_tokens:
        return 0.0

    counts = Counter(chunk_tokens)
    unique_query = set(query_tokens)

    lexical = 0.0

    for token in unique_query:
        count = counts.get(token, 0)

        if count:
            lexical += 1.0 + math.log1p(count)

    phrase_bonus = 0.0

    for phrase in important_phrases:
        phrase = phrase.strip().lower()

        if len(phrase) >= 6 and phrase in lower:
            phrase_bonus += 4.0

    # Small density bonus so a compact relevant section can outrank
    # a huge section with scattered matches.
    matched = sum(
        1 for token in unique_query if token in counts
    )

    density = (
        matched / max(1, len(set(chunk_tokens)))
    ) * 30.0

    return lexical + phrase_bonus + density


def build_relevant_context(
    proposal_text: str,
    query_parts: Sequence[str] | None = None,
    domain_hint: str | None = None,
    *,
    max_chars: int = 28000,
    top_k: int = 8,
    min_retrieval_score: float = 1.5,
    include_document_start: bool = True,
) -> str:
    """
    Return proposal excerpts most relevant to the current evaluation task.

    Safety / quality behavior:
    - If the proposal is already short, return the full proposal.
    - If retrieval confidence is weak, return the full proposal rather
      than risking false NOT_PROVIDED results.
    - Preserve original chunk order in the final context.
    """
    proposal_text = str(proposal_text or "").strip()

    if not proposal_text:
        return ""

    if len(proposal_text) <= max_chars:
        return proposal_text

    chunks = _make_chunks(proposal_text)

    if len(chunks) <= 1:
        return proposal_text[:max_chars]

    query = _query_text(query_parts, domain_hint)
    query_tokens = _tokenize(query)

    # Requirement text and criterion names are useful exact phrases.
    important_phrases = [
        _normalize_text(part)
        for part in (query_parts or [])
        if 6 <= len(_normalize_text(part)) <= 180
    ]

    if not query_tokens:
        return proposal_text

    scored = [
        (
            index,
            _score_chunk(
                chunk,
                query_tokens,
                important_phrases,
            ),
            chunk,
        )
        for index, chunk in enumerate(chunks)
    ]

    scored.sort(
        key=lambda item: item[1],
        reverse=True,
    )

    best_score = scored[0][1] if scored else 0.0

    # Avoid aggressive filtering when lexical retrieval cannot
    # confidently find relevant evidence.
    if best_score < min_retrieval_score:
        return proposal_text

    selected_indexes = {
        index
        for index, _, _ in scored[:top_k]
    }

    if include_document_start:
        selected_indexes.add(0)

    # Add neighboring chunks around strong matches. This helps preserve
    # headings and evidence that spans chunk boundaries.
    strongest = [
        index
        for index, score, _ in scored[:max(2, top_k // 2)]
        if score > 0
    ]

    for index in strongest:
        if index - 1 >= 0:
            selected_indexes.add(index - 1)

        if index + 1 < len(chunks):
            selected_indexes.add(index + 1)

    context_parts = []
    current_chars = 0

    for index in sorted(selected_indexes):
        chunk = chunks[index]

        if current_chars + len(chunk) > max_chars:
            remaining = max_chars - current_chars

            if remaining >= 700:
                context_parts.append(chunk[:remaining])

            break

        context_parts.append(chunk)
        current_chars += len(chunk) + 20

    context = "\n\n--- PROPOSAL EXCERPT ---\n\n".join(
        context_parts
    ).strip()

    # If retrieval produced too little context, prefer the full proposal.
    if len(context) < 3000:
        return proposal_text

    return context


def requirement_query_parts(
    requirements: Iterable[dict],
) -> list[str]:
    parts = []

    for requirement in requirements or []:
        if not isinstance(requirement, dict):
            continue

        text = str(
            requirement.get("requirement", "")
        ).strip()

        source = str(
            requirement.get("source", "")
        ).strip()

        if text:
            parts.append(text)

        if source:
            parts.append(source)

    return parts
