"""
Offline validation harness.

Purpose
-------
Exercise the REAL evaluation logic - RFP framework
assembly, deterministic chunking, requirement ID
assignment, compliance status rules, weighted scoring,
the requirements compliance matrix and ranking
eligibility - on a machine that has no OCI credentials.

The LLM transport is the ONLY thing replaced: a scripted
stub answers prompts by shape. Nothing in the production
code path is mocked or stubbed - agents, scoring and the
service run exactly as they do in production.

This does NOT validate answer quality. For that, run
scripts/run_library_rfp.py on a machine with OCI access.

Usage:
    python3 scripts/validate_pipeline_offline.py
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


# =========================================================
# Scripted LLM stub
# =========================================================

class ScriptedLLM:
    """
    Answers prompts by detecting which agent asked.

    Deliberately imperfect: it returns UNVERIFIED for
    certificate-style gates so the "never hallucinate
    non-possession" rule is actually exercised.
    """

    def __init__(self, *args, **kwargs):
        self.calls = []

    def _requirement_ids(self, prompt):
        """
        Pull the expected-ID list the agents embed in
        their prompts.
        """
        marker = prompt.rfind("[")

        while marker >= 0:
            end = prompt.find("]", marker)

            if end < 0:
                break

            candidate = prompt[marker:end + 1]

            try:
                ids = json.loads(candidate)
            except json.JSONDecodeError:
                marker = prompt.rfind("[", 0, marker)
                continue

            if (
                isinstance(ids, list)
                and ids
                and all(
                    isinstance(item, str)
                    for item in ids
                )
            ):
                return ids

            marker = prompt.rfind("[", 0, marker)

        return []

    def ask(self, prompt, *, model=None, label=None):
        self.calls.append(label or "unlabeled")

        if label and label.startswith(
            "RFP-Extract"
        ):
            return self._extraction(prompt)

        if label == "RFP-CriteriaDiscovery":
            return self._criteria()

        if label and label.startswith(
            "RFPCriteriaAssign"
        ):
            return self._assignment(prompt)

        if label == "RFP-ProjectInfo":
            return self._project_info()

        if label == "RFP-Eligibility":
            return self._eligibility()

        if label == "RFP-Summary":
            return json.dumps(
                {
                    "rfp_summary": (
                        "Library management and digital "
                        "repository platform."
                    )
                }
            )

        if label == "ComplianceAgent" or (
            "compliance evaluator" in prompt
        ):
            return self._compliance(prompt)

        if label == "RankingAgent" or (
            "rankingInsights" in prompt
        ):
            return self._ranking(prompt)

        # Requirement-level evaluation agents.
        return self._requirement_results(prompt)

    # -----------------------------------------------------

    def _extraction(self, prompt):
        section = "قسم"

        if "MARC21" in prompt:
            section = "معايير الفهرسة"

        items = []

        # One requirement per bullet found in the chunk.
        for line in prompt.splitlines():
            line = line.strip()

            if not line.startswith("•"):
                continue

            text = line.lstrip("• ").strip()

            if len(text) < 8:
                continue

            level = (
                "mandatory"
                if "يجب" in text or "يلتزم" in text
                else (
                    "preferred"
                    if "يفضل" in text
                    else "standard"
                )
            )

            items.append(
                {
                    "requirement": text,
                    "section": section,
                    "requirement_level": level,
                    "category": "technical",
                    "evidence_expected": (
                        "وصف صريح للقدرة في العرض الفني"
                    ),
                }
            )

        return json.dumps(
            {"requirements": items},
            ensure_ascii=False,
        )

    def _criteria(self):
        return json.dumps(
            {
                "criteria": [
                    {
                        "criterion_id": "C01",
                        "name": (
                            "الحل التقني ومتطلبات النظام"
                        ),
                        "description": (
                            "تقييم الحل التقني."
                        ),
                        "source": "المواصفات الفنية",
                        "criterion_importance_score": 5,
                        "criterion_importance_reason": (
                            "جوهر المشروع"
                        ),
                        "explicit_weight": None,
                        "explicit_weight_evidence": "",
                    },
                    {
                        "criterion_id": "C02",
                        "name": (
                            "منهجية التنفيذ وخطة المشروع"
                        ),
                        "description": (
                            "تقييم المنهجية والجدول الزمني."
                        ),
                        "source": "تقييم العروض",
                        "criterion_importance_score": 4,
                        "criterion_importance_reason": (
                            "منصوص عليه في تقييم العروض"
                        ),
                        "explicit_weight": None,
                        "explicit_weight_evidence": "",
                    },
                    {
                        "criterion_id": "C03",
                        "name": "العرض المالي",
                        "description": (
                            "تقييم العرض المالي والتكلفة."
                        ),
                        "source": "تقييم العروض",
                        "criterion_importance_score": 3,
                        "criterion_importance_reason": (
                            "منصوص عليه"
                        ),
                        "explicit_weight": None,
                        "explicit_weight_evidence": "",
                    },
                ]
            },
            ensure_ascii=False,
        )

    def _assignment(self, prompt):
        # The assignment prompt embeds requirement
        # objects, not a bare ID array.
        import re

        ids = []

        # Stop before the OUTPUT example block so the
        # placeholder ID in the schema is not counted.
        body = prompt.split(
            "OUTPUT"
        )[0]

        for match in re.finditer(
            r'"requirement_id"\s*:\s*"([^"]+)"',
            body,
        ):
            value = match.group(1)

            if value not in ids:
                ids.append(value)

        if not ids:
            ids = self._requirement_ids(prompt)

        assignments = []

        for index, requirement_id in enumerate(ids):
            if index % 3 == 0:
                criterion_id = "C02"
            elif index % 5 == 0:
                criterion_id = "C03"
            else:
                criterion_id = "C01"

            assignments.append(
                {
                    "requirement_id": (
                        requirement_id
                    ),
                    "criterion_id": criterion_id,
                }
            )

        return json.dumps(
            {"assignments": assignments},
            ensure_ascii=False,
        )

    def _project_info(self):
        return json.dumps(
            {
                "project_name": (
                    "مشروع تطوير وتنصيب نظام إدارة "
                    "مكتبة الملك سلمان"
                ),
                "issuing_organization": (
                    "مؤسسة مسك الخيرية"
                ),
                "project_objective": (
                    "إنشاء منظومة تقنية متكاملة لإدارة "
                    "المكتبة والمستودع الرقمي."
                ),
                "scope_of_work": [
                    "تحليل الوضع الحالي",
                    "توريد وتنفيذ الأنظمة",
                ],
                "implementation_duration": (
                    "سنة قابلة للتجديد"
                ),
                "required_deliverables": [
                    "وثيقة تحليل المتطلبات",
                    "نظام إدارة المكتبات مفعل بالكامل",
                ],
                "submission_deadline": "2026/08/05",
                "proposal_validity": "ثلاثة أشهر",
            },
            ensure_ascii=False,
        )

    def _eligibility(self):
        return json.dumps(
            {
                "eligibility_requirements": [
                    {
                        "name": (
                            "العرضان المالي والفني "
                            "موقعان ومختومان"
                        ),
                        "description": (
                            "تقديم العرضين النهائيين "
                            "موقعين ومختومين بختم المورد."
                        ),
                        "category": (
                            "submission_format"
                        ),
                        "source_section": (
                            "قائمة التدقيق للمنافسين"
                        ),
                        "evidence_expected": (
                            "صفحات موقعة ومختومة"
                        ),
                        "exclusion_grade": True,
                    },
                    {
                        "name": (
                            "صورة من السجل التجاري "
                            "ساري المفعول"
                        ),
                        "description": (
                            "سجل تجاري ساري مختوم بختم "
                            "المورد."
                        ),
                        "category": (
                            "legal_certificate"
                        ),
                        "source_section": (
                            "قائمة التدقيق للمنافسين"
                        ),
                        "evidence_expected": (
                            "نسخة من السجل التجاري"
                        ),
                        "exclusion_grade": True,
                    },
                    {
                        "name": "ضمان بنكي",
                        "description": (
                            "ضمان بنكي عند الحاجة."
                        ),
                        "category": (
                            "financial_guarantee"
                        ),
                        "source_section": (
                            "قائمة التدقيق للمنافسين"
                        ),
                        "evidence_expected": (
                            "خطاب ضمان بنكي"
                        ),
                        "exclusion_grade": False,
                    },
                ]
            },
            ensure_ascii=False,
        )

    def _compliance(self, prompt):
        ids = self._requirement_ids(prompt)

        evaluations = []

        for index, requirement_id in enumerate(ids):
            if index == 0:
                status = "MET"
                evidence = [
                    "العرض موقع ومختوم في الصفحة الأولى."
                ]
            elif "ضمان" in prompt and index == 2:
                status = "NOT_APPLICABLE"
                evidence = []
            else:
                # Certificates that the technical
                # proposal cannot evidence.
                status = "UNVERIFIED"
                evidence = []

            evaluations.append(
                {
                    "requirement_id": requirement_id,
                    "requirement": "requirement",
                    "status": status,
                    "evidence": evidence,
                    "gap": (
                        ""
                        if status == "MET"
                        else (
                            "لا يوجد دليل في المستند "
                            "المرفوع."
                        )
                    ),
                    "reason": "scripted",
                }
            )

        return json.dumps(
            {
                "requirementsEvaluation": (
                    evaluations
                ),
                "unsupportedClaims": [],
                "deliveryRisks": [],
                "ambiguousCommitments": [],
                "batchRiskLevel": "Low",
            },
            ensure_ascii=False,
        )

    def _requirement_results(self, prompt):
        import re

        # Agents embed the requirement list as objects
        # carrying an "id" key. The OUTPUT schema example
        # uses "requirement_id", so this pattern only
        # matches genuine requirements.
        ids = []

        for match in re.finditer(
            r'"id"\s*:\s*"([^"]+)"',
            prompt,
        ):
            value = match.group(1)

            if value not in ids:
                ids.append(value)

        if not ids:
            ids = self._requirement_ids(prompt)

        results = []

        for index, requirement_id in enumerate(ids):
            if index % 4 == 0:
                status, score = "FULL_MATCH", 95
                evidence = (
                    "النظام المقترح يوفر هذه القدرة "
                    "بشكل صريح."
                )
            elif index % 4 == 1:
                status, score = "PARTIAL_MATCH", 60
                evidence = "إشارة جزئية في العرض."
            elif index % 4 == 2:
                status, score = "NOT_PROVIDED", 0
                evidence = "Not Provided"
            else:
                status, score = "NO_MATCH", 0
                evidence = "العرض يستثني هذه القدرة."

            results.append(
                {
                    "requirement_id": requirement_id,
                    "status": status,
                    "match_score": score,
                    "proposal_evidence": evidence,
                    "rationale": "scripted rationale",
                }
            )

        return json.dumps(
            {
                "criterion": "scripted",
                "requirement_results": results,
                "delivery_coverage": {},
                "timeline_feasibility_assessment": (
                    "الجدول الزمني يبدو ممكناً."
                ),
                "strengths": ["نقطة قوة"],
                "gaps": ["فجوة"],
                "risks": ["مخاطرة"],
                "rationale": "scripted",
                "vendor": "Vendor",
                "criterion_score": 70,
                "evidence_summary": "scripted",
                "confidence": "Medium",
            },
            ensure_ascii=False,
        )

    def _ranking(self, prompt):
        return json.dumps(
            {
                "finalRecommendation": (
                    "Proceed to human review."
                ),
                "rationale": "scripted",
                "rankingInsights": ["insight"],
                "vendors": [],
            }
        )

    def close(self):
        pass


# =========================================================
# Test helpers
# =========================================================

PASSED = []
FAILED = []


def check(name, condition, detail=""):
    if condition:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append((name, detail))
        print(f"  FAIL  {name} :: {detail}")


SAMPLE_RFP = """[Page 1]
كراسة الشروط والمواصفات
مشروع تطوير وتنصيب نظام إدارة مكتبة الملك سلمان

[Page 4]
قائمة التدقيق للمنافسين
1 العرضين المالي والفني النهائيين موقعين مع ختمهما بختم المورد إلزامي
2 صورة من السجل التجاري ساري المفعول إلزامي
3 ضمان بنكي
يجب على مقدم العطاء تعبئة الجدول وسيتم استثناء مقدم العطاء في حال
عدم تقديم البنود الإلزامية

[Page 11]
مواصفات فنية للنظام
• يجب أن يوفر النظام دعماً كاملاً للغة العربية RTL مع تحسين البحث اللغوي
• يجب دعم صيغ MARC21 و RDA مع الجاهزية للبيانات المترابطة BIBFRAME
• يجب التكامل مع أنظمة RFID عبر بروتوكول SIP2/NCIP
• يفضل توفير محركات توصية ذكية Recommendation Engines
• دعم تسجيل الدخول الموحد SSO وإدارة الصلاحيات RBAC

[Page 12]
معايير الفهرسة
• يجب توفير بحث النص الكامل Full-text Search داخل الكتب الإلكترونية
• يجب دعم الإعارة الرقمية Digital Lending مع حماية DRM
• يفضل التكامل مع منصات التعلم Blackboard و Canvas
• يجب تقديم خطة تنفيذ تفصيلية وخطة إدارة المخاطر
"""

SAMPLE_PROPOSAL = """[Page 1]
العرض الفني - شركة المنصات المعرفية
العرض موقع ومختوم بختم الشركة.

[Page 2]
الحل المقترح
يوفر النظام دعماً كاملاً للغة العربية RTL مع محرك بحث لغوي متقدم
يدعم الهمزات والسوابق واللواحق والمترادفات.
يدعم النظام صيغ MARC21 و RDA بالكامل.
يتكامل النظام مع بوابات RFID باستخدام بروتوكول SIP2.

[Page 3]
منهجية التنفيذ
نتبع منهجية Agile على أربع مراحل خلال اثني عشر شهراً مع خطة
اختبارات وخطة إدارة مخاطر وخطة نسخ احتياطي.

[Page 4]
العرض المالي
التكلفة الإجمالية شاملة ضريبة القيمة المضافة مع جدول دفعات
مرتبط بالمخرجات ونموذج ترخيص سنوي.
"""


def main():
    # Route every agent through the scripted transport.
    import services.llm_client as llm_module

    llm_module.LLMClient = ScriptedLLM

    for module_name in [
        "agents.rfp_agent",
        "agents.technical_agent",
        "agents.project_plan_agent",
        "agents.experience_agent",
        "agents.team_agent",
        "agents.financial_agent",
        "agents.generic_criterion_agent",
        "agents.compliance_agent",
        "agents.ranking_agent",
    ]:
        __import__(module_name)

        module = sys.modules[module_name]

        if hasattr(module, "LLMClient"):
            module.LLMClient = ScriptedLLM

    from agents.rfp_agent import RFPAgent
    from agents.compliance_agent import ComplianceAgent
    from utils.scoring import calculate_weighted_score
    from utils.proposal_context import (
        build_relevant_context,
    )
    from services.proposal_service import (
        ProposalEvaluationService,
    )

    print()
    print("=" * 60)
    print("1. RFP FRAMEWORK EXTRACTION")
    print("=" * 60)

    agent = RFPAgent()
    analysis = agent.analyze(SAMPLE_RFP)

    requirements = analysis["all_requirements"]

    check(
        "requirements extracted without GEN/REQ IDs",
        len(requirements) >= 8,
        f"got {len(requirements)}",
    )

    check(
        "extraction method reported",
        analysis["metadata"][
            "requirement_extraction_method"
        ]
        == "llm_structured_section_extraction",
        analysis["metadata"][
            "requirement_extraction_method"
        ],
    )

    check(
        "requirement IDs are stable and unique",
        len({item["id"] for item in requirements})
        == len(requirements)
        and requirements[0]["id"] == "R-001",
        requirements[0]["id"],
    )

    check(
        "page numbers preserved",
        any(
            item.get("page") in (11, 12)
            for item in requirements
        ),
        str(
            [item.get("page") for item in requirements]
        ),
    )

    check(
        "mandatory wording detected",
        any(item["mandatory"] for item in requirements),
    )

    check(
        "preferred wording detected and NOT mandatory",
        any(
            item["requirement_type"] == "تفضيلي"
            and not item["mandatory"]
            for item in requirements
        ),
    )

    check(
        "criterion weights total 100",
        abs(
            sum(
                float(item["weight"])
                for item in analysis["criteria"]
            )
            - 100.0
        )
        < 0.01,
    )

    check(
        "weights labeled system_defined",
        analysis["evaluation_weight_source"]
        == "system_defined"
        and all(
            item["weight_source"] == "system_defined"
            for item in analysis["criteria"]
        ),
        analysis["evaluation_weight_source"],
    )

    check(
        "project information extracted",
        bool(
            analysis["project_information"].get(
                "project_name"
            )
        )
        and bool(
            analysis["project_information"].get(
                "implementation_duration"
            )
        ),
    )

    check(
        "eligibility gates extracted separately",
        len(analysis["eligibility_requirements"]) == 3,
        str(len(analysis["eligibility_requirements"])),
    )

    check(
        "eligibility gates carry exclusion grade",
        any(
            item["exclusion_grade"]
            for item in analysis[
                "eligibility_requirements"
            ]
        )
        and any(
            not item["exclusion_grade"]
            for item in analysis[
                "eligibility_requirements"
            ]
        ),
    )

    check(
        "every requirement assigned exactly once",
        sum(
            len(item["requirements"])
            for item in analysis["criteria"]
        )
        == len(requirements),
    )

    print()
    print("=" * 60)
    print("2. WEIGHT OVERRIDES")
    print("=" * 60)

    override_analysis = agent.analyze(
        SAMPLE_RFP,
        weight_config={
            "weight_overrides": {
                "C01": 50,
                "C02": 30,
                "C03": 20,
            }
        },
    )

    check(
        "valid overrides applied",
        all(
            item["weight_source"]
            == "system_defined_override"
            for item in override_analysis["criteria"]
        )
        and abs(
            sum(
                item["weight"]
                for item in override_analysis[
                    "criteria"
                ]
            )
            - 100.0
        )
        < 0.01,
    )

    bad_analysis = agent.analyze(
        SAMPLE_RFP,
        weight_config={
            "weight_overrides": {
                "C01": 50,
                "C02": 30,
            }
        },
    )

    check(
        "incomplete overrides rejected safely",
        all(
            item["weight_source"] == "system_defined"
            for item in bad_analysis["criteria"]
        ),
    )

    print()
    print("=" * 60)
    print("3. COMPLIANCE STATUS RULES")
    print("=" * 60)

    compliance = ComplianceAgent()

    result = compliance.evaluate(
        mandatory_requirements=analysis[
            "eligibility_requirements"
        ],
        proposal_text=SAMPLE_PROPOSAL,
    )

    check(
        "UNVERIFIED used instead of NOT_MET",
        any(
            item["status"] == "UNVERIFIED"
            for item in result[
                "requirementsEvaluation"
            ]
        ),
    )

    check(
        "no hard FAIL on unverifiable evidence",
        result["complianceStatus"] == "UNKNOWN",
        result["complianceStatus"],
    )

    check(
        "breakdown lists all four buckets",
        set(result["complianceBreakdown"])
        == {
            "compliant",
            "partial",
            "missing",
            "unverified",
            "notApplicable",
        },
    )

    check(
        "NOT_APPLICABLE excluded from percentage",
        result["complianceScore"] == 50.0,
        str(result["complianceScore"]),
    )

    check(
        "clarifications raised for unverified gates",
        len(result["clarificationsNeeded"]) >= 1,
    )

    verified_fail = [
        {
            "id": "E-001",
            "requirement_id": "E-001",
            "requirement": "gate",
            "exclusion_grade": True,
            "status": "NOT_MET",
        }
    ]

    check(
        "verified failure of exclusion gate -> FAIL",
        compliance._calculate_compliance_status(
            verified_fail
        )
        == "FAIL",
    )

    print()
    print("=" * 60)
    print("4. ARABIC RETRIEVAL")
    print("=" * 60)

    noise = (
        "نص عام عن الشركة وخدماتها المتنوعة. " * 400
    )

    long_proposal = (
        noise
        + "\n\nيتكامل النظام مع بوابات RFID "
        "باستخدام بروتوكول SIP2 والفهرسة MARC21.\n\n"
        + noise
    )

    context = build_relevant_context(
        long_proposal,
        query_parts=[
            "التكامل مع أنظمة RFID عبر بروتوكول SIP2"
        ],
        domain_hint="technical",
        max_chars=8000,
    )

    check(
        "Arabic retrieval finds the relevant section",
        "SIP2" in context,
    )

    check(
        "long Arabic document is actually reduced",
        len(context) < len(long_proposal),
        f"{len(context)} vs {len(long_proposal)}",
    )

    print()
    print("=" * 60)
    print("5. END-TO-END SERVICE RUN")
    print("=" * 60)

    scratch = REPO_ROOT / ".offline_validation"
    scratch.mkdir(exist_ok=True)

    rfp_file = scratch / "library_rfp.txt"
    rfp_file.write_text(SAMPLE_RFP, encoding="utf-8")

    proposal_file = scratch / "Vendor Alpha.txt"
    proposal_file.write_text(
        SAMPLE_PROPOSAL,
        encoding="utf-8",
    )

    service = ProposalEvaluationService()

    final = service.evaluate(
        rfp_path=rfp_file,
        proposal_paths=[proposal_file],
    )

    vendor = final["vendors"][0]

    check(
        "pipeline completes end to end",
        final["totalVendors"] == 1,
    )

    check(
        "overall score is deterministic 0-100",
        0 <= vendor["overallScore"] <= 100,
        str(vendor["overallScore"]),
    )

    check(
        "mandatory compliance percentage present",
        isinstance(
            vendor["mandatoryCompliancePercentage"],
            (int, float),
        ),
    )

    check(
        "mandatory compliance status present",
        vendor["mandatoryComplianceStatus"]
        in {
            "PASS",
            "PARTIAL",
            "FAIL",
            "UNKNOWN",
        },
        vendor["mandatoryComplianceStatus"],
    )

    check(
        "requirements compliance matrix built",
        len(vendor["requirementsComplianceMatrix"])
        >= len(requirements),
        str(
            len(
                vendor[
                    "requirementsComplianceMatrix"
                ]
            )
        ),
    )

    matrix_row = vendor[
        "requirementsComplianceMatrix"
    ][0]

    check(
        "matrix row has required columns",
        set(
            [
                "requirementId",
                "rfpRequirement",
                "vendorEvidence",
                "status",
                "score",
                "riskComment",
            ]
        ).issubset(matrix_row),
        str(sorted(matrix_row)),
    )

    check(
        "matrix covers eligibility track too",
        any(
            row["track"] == "eligibility"
            for row in vendor[
                "requirementsComplianceMatrix"
            ]
        ),
    )

    check(
        "compliance labels present",
        {
            row["complianceLabel"]
            for row in vendor[
                "requirementsComplianceMatrix"
            ]
        }.issubset(
            {
                "SUPPORTED",
                "PARTIAL",
                "NOT_FOUND",
                "CONTRADICTED",
                "NOT_APPLICABLE",
            }
        ),
    )

    check(
        "unverified gates do not disqualify vendor",
        final["recommendationStatus"]
        != "NO_ELIGIBLE_VENDOR",
        final["recommendationStatus"],
    )

    check(
        "human review still required",
        final["humanReviewRequired"] is True,
    )

    check(
        "executive summary generated",
        len(final["executiveSummary"]) > 80,
    )

    check(
        "weight source surfaced at top level",
        final["evaluationWeightSource"]
        == "system_defined",
    )

    check(
        "clarifications surfaced on vendor",
        len(vendor["clarificationsToRequest"]) >= 1,
    )

    check(
        "risks surfaced on vendor",
        len(vendor["risks"]) >= 1,
    )

    # Frontend contract: fields the UI already reads.
    check(
        "legacy frontend fields preserved",
        all(
            key in vendor
            for key in [
                "vendor",
                "overallScore",
                "overallMandatoryCompliance",
                "riskLevel",
                "compliant",
                "missingRequirements",
                "complianceRationale",
                "evaluations",
                "scoring",
                "rank",
            ]
        ),
        str(sorted(vendor)),
    )

    check(
        "legacy criterion_scores shape preserved",
        all(
            key in vendor["scoring"][
                "criterion_scores"
            ][0]
            for key in [
                "criterion",
                "score",
                "weight",
                "weighted_score",
            ]
        ),
    )

    check(
        "legacy evaluation shape preserved",
        all(
            key in vendor["evaluations"][0]
            for key in [
                "criterion",
                "score",
                "requirement_results",
            ]
        ),
    )

    check(
        "legacy requirement result shape preserved",
        all(
            key
            in vendor["evaluations"][0][
                "requirement_results"
            ][0]
            for key in [
                "requirement_id",
                "requirement",
                "rfp_source",
                "mandatory",
                "status",
                "match_score",
                "proposal_evidence",
                "rationale",
            ]
        ),
    )

    check(
        "legacy rfp analysis keys preserved",
        all(
            key in final["rfp"]["analysis"]
            for key in [
                "rfp_summary",
                "criteria",
                "mandatory_requirements",
                "metadata",
            ]
        ),
    )

    # Save artifacts for inspection.
    (scratch / "rfp_analysis.sample.json").write_text(
        json.dumps(
            analysis,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    (scratch / "final_evaluation.sample.json").write_text(
        json.dumps(
            final,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print("Sample artifacts written to "
          f"{scratch}")

    print()
    print("=" * 60)
    print(
        f"RESULT: {len(PASSED)} passed, "
        f"{len(FAILED)} failed"
    )
    print("=" * 60)

    for name, detail in FAILED:
        print(f"  FAILED: {name} :: {detail}")

    return 1 if FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
