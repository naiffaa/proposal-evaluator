# Evaluation pipeline

How an RFP becomes a scored, evidence-backed vendor
evaluation, and which parts are deterministic Python
versus LLM judgement.

## Design rule

**The LLM evaluates evidence. Python calculates totals.**

Every number that reaches the user - criterion scores,
weighted totals, compliance percentages, compliance
status, rankings - is computed in Python from validated
per-requirement results. The LLM never returns a final
score.

The system is domain-agnostic. Nothing about libraries,
hospitals, or any other sector is hardcoded in the
agents; all RFP-specific content comes from the
`RFPAgent` output that the downstream agents consume.

---

## Flow

```
PDF ─► DocumentParser ─► RFPAgent ─► frozen framework
                                          │
                    ┌─────────────────────┴──────────────────┐
                    │                                        │
            scored criteria track                  eligibility track
      (Technical / ProjectPlan / Experience /       (ComplianceAgent)
       Team / Financial / Generic agents)                    │
                    │                                        │
                    └─────────────────┬──────────────────────┘
                                      ▼
                     Python: weighted score, compliance
                     status, requirements matrix
                                      ▼
                              RankingAgent
```

### 1. DocumentParser

Local PyMuPDF extraction with `[Page N]` markers; falls
back to OCI Document Understanding for scanned PDFs.

Arabic PDFs commonly extract as Unicode **Arabic
Presentation Forms** (`U+FB50-U+FEFF`) - visually
identical to standard Arabic but different code points.
`_clean_text` folds them with NFKC, because otherwise
every Arabic keyword match downstream silently fails.

Extraction results are cached by file hash and stamped
with `TEXT_PIPELINE_VERSION`. Bump that constant whenever
text post-processing changes so stale cached text is
re-extracted instead of silently reused.

### 2. RFPAgent - building the framework

**Requirement extraction** has two paths:

| Path | When | Method |
|---|---|---|
| `deterministic_numbered_parser` | RFP has `GEN-###` / `REQ-####` IDs | Regex; original IDs preserved |
| `llm_structured_section_extraction` | No numbered IDs (narrative RFPs) | Page-aware chunking + per-chunk LLM transcription |

In the fallback path Python still owns everything that
matters for integrity: chunk boundaries, page mapping,
ID assignment (`R-001`, `R-002`, ...), deduplication,
mandatory/preferred classification and importance
scoring. The LLM only transcribes requirement text that
exists in the chunk it was given.

Each requirement carries `page`, `section`, `mandatory`,
`requirement_type` (`إلزامي` / `تفضيلي`), `category` and
`evidence_expected`.

**Criteria** are discovered dynamically from the RFP,
named in the RFP's own language. Administrative
eligibility gates are explicitly excluded from scored
criteria. Requirements are then assigned to criteria in
validated LLM batches; Python verifies that every
extracted ID is assigned exactly once.

**Eligibility gates** (`eligibility_requirements`) are
extracted separately from a deterministically selected
subset of pages - checklists, certificate lists,
submission rules, exclusion clauses. Each gate carries
`category`, `source_section`, `evidence_expected` and
`exclusion_grade` (whether the RFP says its absence
excludes the bid).

**Project information** (name, objective, scope,
duration, deliverables, deadlines, validity) is extracted
into `project_information`.

### 3. Weights

Weight source is one of:

| `weight_source` | Meaning |
|---|---|
| `explicit_rfp` | The RFP publishes a complete numeric weight scheme |
| `system_defined_override` | Reviewer-configured weights from `config/evaluation_weights.json` |
| `system_defined` | Derived from RFP-driven criterion importance |

`evaluation_weight_source` at the top level is
`explicit_rfp` only when the RFP genuinely published
weights. **Internal weights are never presented as
official RFP weights.**

To configure weights, copy
`config/evaluation_weights.example.json` to
`config/evaluation_weights.json`. Overrides are applied
only if every discovered criterion is matched and the
total is 100; otherwise they are ignored with a warning
and the system-defined weights are used.

Weights always total 100 - enforced in
`utils/scoring.py`, which raises rather than silently
renormalizing.

### 4. Criterion evaluation

`_classify_criterion` routes each discovered criterion by
name to a specialized agent, defaulting safely to
`GenericCriterionAgent`.

All requirement-level agents return, per requirement:
`status` (`FULL_MATCH` / `PARTIAL_MATCH` / `NO_MATCH` /
`NOT_PROVIDED`), `compliance_label` (`SUPPORTED` /
`PARTIAL` / `NOT_FOUND` / `CONTRADICTED`), `match_score`,
`proposal_evidence` and `rationale`; plus criterion-level
`missing_requirements`, `risks` and `confidence`.

Requirements marked preferred are evaluated honestly but
never treated as hard failures.

### 5. Mandatory compliance

`ComplianceAgent` evaluates eligibility gates first, then
scored mandatory requirements, with five statuses:

| Status | Meaning |
|---|---|
| `MET` | Evidence satisfies the requirement |
| `PARTIAL` | Relevant but incomplete evidence |
| `NOT_MET` | **Verified** non-compliance |
| `UNVERIFIED` | Cannot be verified from the uploaded documents |
| `NOT_APPLICABLE` | RFP makes it conditional and the condition does not apply |

`UNVERIFIED` exists so the system never concludes a
vendor lacks a legal certificate merely because the
technical proposal does not include a scan of it. An
unrecognized status also degrades to `UNVERIFIED`, never
to a verified failure.

`mandatory_compliance_status` is computed in Python:

- **FAIL** - a requirement with `exclusion_grade` is
  verified `NOT_MET`
- **PARTIAL** - other verified issues exist
- **UNKNOWN** - no verified issues, but something could
  not be verified
- **PASS** - every applicable requirement is `MET`

`NOT_APPLICABLE` items are excluded from the percentage
denominator.

A vendor is excluded from recommendation **only** on
`FAIL`. `humanReviewRequired` is always true.

### 6. Long documents

`utils/proposal_context.py` retrieves the passages
relevant to the requirements being evaluated instead of
sending whole documents to every agent:

- Arabic-aware tokenization (presentation-form folding,
  alef/ya/ta-marbuta normalization, Arabic stopwords)
- The character budget is spent in **score order**, so
  evidence late in a long document is not crowded out by
  the opening pages; selected passages are then emitted
  in document order
- Falls back to the full document when retrieval
  confidence is low, so a weak query never causes a false
  `NOT_PROVIDED`

---

## Output

Beyond the existing schema, each vendor gains:

| Field | Meaning |
|---|---|
| `mandatoryCompliancePercentage` | Compliance-track percentage |
| `mandatoryComplianceStatus` | `PASS` / `PARTIAL` / `FAIL` / `UNKNOWN` |
| `mandatoryComplianceBreakdown` | Compliant / partial / missing / unverified / not-applicable |
| `requirementsComplianceMatrix` | Flat requirement-by-requirement matrix |
| `strengths`, `gaps`, `risks` | Aggregated across criteria |
| `missingRequirementsDetail` | Structured missing requirements |
| `clarificationsToRequest` | Questions to put to the vendor |
| `confidenceLevel` | Rolled up from per-criterion confidence |
| `scoredMandatoryCompliance` | Legacy scored-track percentage |

Top level gains `executiveSummary`, `evaluationWeightSource`,
and `rfp.projectInformation` / `rfp.eligibilityRequirements`.

All previously existing fields are unchanged.

---

## Validation

```bash
python3 scripts/validate_pipeline_offline.py
```

Runs the real agents, scoring, service and ranking with a
scripted LLM transport - no OCI credentials needed. Only
the transport is replaced; no business logic is mocked.
Covers extraction without numbered IDs, page mapping,
weight rules, compliance status rules, Arabic retrieval,
the compliance matrix, and backward compatibility of
every field the frontend reads.

```bash
python3 scripts/run_library_rfp.py <rfp.pdf> <proposal.pdf> [...]
```

Real end-to-end run against OCI. Writes
`artifacts/rfp_analysis.json`,
`artifacts/final_evaluation.json` and
`artifacts/requirements_matrix.csv`.
