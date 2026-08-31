from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)
from pathlib import Path
import time

from agents.rfp_agent import RFPAgent
from agents.technical_agent import TechnicalAgent
from agents.project_plan_agent import ProjectPlanAgent
from agents.experience_agent import ExperienceAgent
from agents.team_agent import TeamAgent
from agents.financial_agent import FinancialAgent
from agents.generic_criterion_agent import GenericCriterionAgent
from agents.compliance_agent import ComplianceAgent
from agents.ranking_agent import RankingAgent

from services.document_parser import DocumentParser
from utils.scoring import calculate_weighted_score


class ProposalEvaluationService:
    """
    End-to-end proposal evaluation service.

    Dynamic-criteria architecture:

    - The RFP is analyzed once.
    - RFPAgent may discover criterion names dynamically.
    - The service does NOT require every criterion to match
      a fixed hardcoded list.
    - Known specialized criterion types may use their
      specialized agents.
    - Any other dynamically discovered criterion is evaluated
      with GenericCriterionAgent.
    - Every vendor uses the same frozen RFP framework.
    - Vendors are evaluated concurrently.
    - Criteria inside each vendor are evaluated concurrently.
    - Compliance can run alongside criterion evaluation.
    - Python performs deterministic scoring.
    - Python determines vendor order.
    - RankingAgent determines recommendation eligibility.

    This allows the same evaluation service to process RFPs
    from technology, construction, consulting, healthcare,
    logistics, legal, operations and other domains.
    """

    # =====================================================
    # Concurrency
    # =====================================================

    MAX_VENDOR_WORKERS = 3

    MAX_VENDOR_TASK_WORKERS = 2

    CRITERION_LEVEL_AGENT_TYPES = {
        "experience",
        "team",
        "financial",
    }

    def __init__(
        self,
    ):
        self.document_parser = (
            DocumentParser()
        )

        self.rfp_agent = (
            RFPAgent()
        )

        # These persistent specialized agents are kept for
        # compatibility with the existing service lifecycle.
        # Concurrent criterion tasks still create isolated agents.
        self.technical_agent = (
            TechnicalAgent()
        )

        self.project_plan_agent = (
            ProjectPlanAgent()
        )

        self.experience_agent = (
            ExperienceAgent()
        )

        self.team_agent = (
            TeamAgent()
        )

        self.financial_agent = (
            FinancialAgent()
        )

        self.generic_criterion_agent = (
            GenericCriterionAgent()
        )

        self.compliance_agent = (
            ComplianceAgent()
        )

        self.ranking_agent = (
            RankingAgent()
        )

    # =====================================================
    # Text normalization
    # =====================================================

    def _normalize_text(
        self,
        value,
    ):
        if value is None:
            return ""

        return str(
            value
        ).strip().lower()

    # =====================================================
    # Criterion classification
    # =====================================================

    def _classify_criterion(
        self,
        criterion,
    ):
        """
        Safe routing for dynamically discovered criteria.

        Criterion NAME has priority.

        Description is used only for very specific hints.

        If routing is ambiguous, use GenericCriterionAgent
        instead of forcing the criterion into the wrong
        specialized agent.
        """

        if not isinstance(
            criterion,
            dict,
        ):
            raise ValueError(
                "Criterion must be an object."
            )

        name = (
            self._normalize_text(
                criterion.get(
                    "name",
                    "",
                )
            )
        )

        description = (
            self._normalize_text(
                criterion.get(
                    "description",
                    "",
                )
            )
        )

        # -------------------------------------------------
        # Project Plan FIRST
        #
        # Prevents:
        # "إدارة المشروع والجدول الزمني"
        # from being routed to TeamAgent because its
        # description mentions project resources.
        # -------------------------------------------------

        project_name_keywords = [
            "project plan",
            "implementation plan",
            "implementation methodology",
            "delivery plan",
            "project management",
            "timeline",
            "schedule",
            "milestones",
            "خطة المشروع",
            "خطة التنفيذ",
            "منهجية التنفيذ",
            "منهجية العمل",
            "إدارة المشروع",
            "إدارة المشاريع",
            "الجدول الزمني",
            "البرنامج الزمني",
            "المراحل والمخرجات",
            "الحوكمة والتنفيذ",
        ]

        if any(
            keyword in name
            for keyword
            in project_name_keywords
        ):
            return "project_plan"

        # -------------------------------------------------
        # Financial
        # -------------------------------------------------

        financial_name_keywords = [
            "financial",
            "commercial proposal",
            "financial proposal",
            "pricing",
            "التقييم المالي",
            "العرض المالي",
            "الجانب المالي",
            "الأسعار",
            "التسعير",
            "التكلفة التجارية",
        ]

        if any(
            keyword in name
            for keyword
            in financial_name_keywords
        ):
            return "financial"

        # -------------------------------------------------
        # Team
        # -------------------------------------------------

        team_name_keywords = [
            "team qualification",
            "team qualifications",
            "project team",
            "key personnel",
            "key experts",
            "staff qualifications",
            "مؤهلات الفريق",
            "فريق العمل",
            "فريق المشروع",
            "الكوادر",
            "الموارد البشرية",
            "الخبراء",
            "الكفاءات البشرية",
        ]

        if any(
            keyword in name
            for keyword
            in team_name_keywords
        ):
            return "team"

        # -------------------------------------------------
        # Experience
        # -------------------------------------------------

        experience_name_keywords = [
            "vendor experience",
            "company experience",
            "relevant experience",
            "past performance",
            "previous projects",
            "similar projects",
            "خبرة المورد",
            "خبرات المورد",
            "خبرة مقدم العرض",
            "الخبرات السابقة",
            "المشاريع السابقة",
            "مشاريع مماثلة",
            "الخبرة ذات الصلة",
        ]

        if any(
            keyword in name
            for keyword
            in experience_name_keywords
        ):
            return "experience"

        # -------------------------------------------------
        # Clearly technical
        # -------------------------------------------------

        technical_name_keywords = [
            "technical requirements",
            "technical solution",
            "technical architecture",
            "technical proposal",
            "integration",
            "cybersecurity",
            "infrastructure",
            "security",
            "المتطلبات التقنية",
            "المتطلبات الفنية",
            "الحل التقني",
            "الحل الفني",
            "البنية التقنية",
            "البنية المعمارية",
            "التكامل والتشغيل البيني",
            "الأمن السيبراني",
            "البنية التحتية",
        ]

        if any(
            keyword in name
            for keyword
            in technical_name_keywords
        ):
            return "technical"

        # -------------------------------------------------
        # Very specific description fallback only
        # -------------------------------------------------

        if (
            "منهجية التنفيذ والجدول الزمني"
            in description
            or
            "implementation methodology and schedule"
            in description
        ):
            return "project_plan"

        if (
            "مؤهلات أعضاء فريق العمل"
            in description
            or
            "key personnel qualifications"
            in description
        ):
            return "team"

        if (
            "خبرة المورد في مشاريع مماثلة"
            in description
            or
            "similar project experience"
            in description
        ):
            return "experience"

        if (
            "تفاصيل العرض المالي"
            in description
            or
            "explicit financial proposal"
            in description
        ):
            return "financial"

        # -------------------------------------------------
        # Safe dynamic fallback
        # -------------------------------------------------

        return "generic"

    # =====================================================
    # Mandatory requirements
    # =====================================================

    def _get_mandatory_requirements(
        self,
        criteria,
    ):
        mandatory_requirements = []

        for criterion in (
            criteria
        ):
            criterion_name = str(
                criterion.get(
                    "name",
                    "",
                )
            ).strip()

            criterion_id = str(
                criterion.get(
                    "criterion_id",
                    "",
                )
            ).strip()

            requirements = (
                criterion.get(
                    "requirements",
                    [],
                )
            )

            if not isinstance(
                requirements,
                list,
            ):
                continue

            for requirement in (
                requirements
            ):
                if not isinstance(
                    requirement,
                    dict,
                ):
                    continue

                mandatory = (
                    requirement.get(
                        "mandatory",
                        False,
                    )
                )

                if isinstance(
                    mandatory,
                    str,
                ):
                    mandatory = (
                        mandatory
                        .strip()
                        .lower()
                        in {
                            "true",
                            "yes",
                            "1",
                        }
                    )

                else:
                    mandatory = bool(
                        mandatory
                    )

                if not mandatory:
                    continue

                mandatory_requirements.append(
                    {
                        **requirement,

                        "criterion": (
                            criterion_name
                        ),

                        "criterion_id": (
                            criterion_id
                        ),
                    }
                )

        return (
            mandatory_requirements
        )

    # =====================================================
    # Criterion validation
    # =====================================================

    def _validate_criterion(
        self,
        criterion,
    ):
        """
        Validate one frozen dynamic RFP criterion.

        Unknown/dynamic criterion names are valid and are
        routed to GenericCriterionAgent.

        Empty requirements remain allowed only for the
        specialized criterion-level agents that already
        support them:
        - experience
        - team
        - financial

        Dynamically discovered generic criteria are expected
        to contain requirements because RFPAgent removes
        empty criteria after assignment.
        """

        if not isinstance(
            criterion,
            dict,
        ):
            raise ValueError(
                "Each RFP criterion must be an object."
            )

        name = str(
            criterion.get(
                "name",
                "",
            )
        ).strip()

        if not name:
            raise ValueError(
                "RFP criterion is missing a name."
            )

        requirements = (
            criterion.get(
                "requirements",
                [],
            )
        )

        if not isinstance(
            requirements,
            list,
        ):
            raise ValueError(
                f"Requirements for criterion "
                f"'{name}' must be a list."
            )

        agent_type = (
            self._classify_criterion(
                criterion
            )
        )

        if not requirements:
            if (
                agent_type
                in
                self.CRITERION_LEVEL_AGENT_TYPES
            ):
                print(
                    f"Criterion '{name}' has no "
                    "detailed RFP requirements."
                )

                print(
                    f"Using {agent_type} "
                    "criterion-level evaluation."
                )

            else:
                raise ValueError(
                    f"Criterion '{name}' has no "
                    "evaluation requirements. "
                    "Dynamic generic criteria require "
                    "at least one RFP requirement."
                )

        try:
            weight = float(
                criterion.get(
                    "weight",
                    0,
                )
            )

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                f"Invalid weight for criterion: "
                f"{name}"
            ) from error

        if weight < 0:
            raise ValueError(
                f"Criterion weight cannot be "
                f"negative: {name}"
            )

        if weight > 100:
            raise ValueError(
                f"Criterion weight cannot exceed "
                f"100: {name}"
            )

        return (
            criterion
        )

    # =====================================================
    # Evaluate one criterion
    # =====================================================

    def _evaluate_criterion(
        self,
        criterion,
        proposal_text,
        vendor_name,
    ):
        criterion = (
            self._validate_criterion(
                criterion
            )
        )

        name = str(
            criterion[
                "name"
            ]
        ).strip()

        description = str(
            criterion.get(
                "description",
                "",
            )
        ).strip()

        requirements = (
            criterion.get(
                "requirements",
                [],
            )
        )

        agent_type = (
            self._classify_criterion(
                criterion
            )
        )

        print(
            f"\n[{vendor_name}] "
            f"Criterion: {name}"
        )

        print(
            f"[{vendor_name}] "
            f"Agent type: {agent_type}"
        )

        if requirements:
            print(
                f"[{vendor_name}] "
                "Evaluation mode: "
                "requirement-level "
                f"({len(requirements)} requirement(s))"
            )

        else:
            print(
                f"[{vendor_name}] "
                "Evaluation mode: criterion-level"
            )

        agent = None

        try:
            # =================================================
            # Technical
            # =================================================

            if agent_type == "technical":
                print(
                    f"[{vendor_name}] "
                    "Running Technical Agent..."
                )

                agent = (
                    TechnicalAgent()
                )

                result = (
                    agent.evaluate(
                        criterion=name,
                        requirements=requirements,
                        proposal_text=proposal_text,
                    )
                )

            # =================================================
            # Experience
            # =================================================

            elif agent_type == "experience":
                print(
                    f"[{vendor_name}] "
                    "Running Experience Agent..."
                )

                agent = (
                    ExperienceAgent()
                )

                result = (
                    agent.evaluate(
                        requirements=requirements,
                        proposal_text=proposal_text,
                        vendor_name=vendor_name,
                        criterion=name,
                        criterion_description=(
                            description
                        ),
                    )
                )

            # =================================================
            # Team
            # =================================================

            elif agent_type == "team":
                print(
                    f"[{vendor_name}] "
                    "Running Team Agent..."
                )

                agent = (
                    TeamAgent()
                )

                result = (
                    agent.evaluate(
                        requirements=requirements,
                        proposal_text=proposal_text,
                        vendor_name=vendor_name,
                        criterion=name,
                        criterion_description=(
                            description
                        ),
                    )
                )

            # =================================================
            # Financial
            # =================================================

            elif agent_type == "financial":
                print(
                    f"[{vendor_name}] "
                    "Running Financial Agent..."
                )

                agent = (
                    FinancialAgent()
                )

                result = (
                    agent.evaluate(
                        requirements=requirements,
                        proposal_text=proposal_text,
                        vendor_name=vendor_name,
                        criterion=name,
                        criterion_description=(
                            description
                        ),
                    )
                )

            # =================================================
            # Project Plan
            # =================================================

            elif agent_type == "project_plan":
                print(
                    f"[{vendor_name}] "
                    "Running Project Plan Agent..."
                )

                agent = (
                    ProjectPlanAgent()
                )

                result = (
                    agent.evaluate(
                        requirements=requirements,
                        proposal_text=proposal_text,
                    )
                )

                if not isinstance(
                    result,
                    dict,
                ):
                    raise ValueError(
                        "Project Plan Agent returned "
                        "an invalid result."
                    )

                result[
                    "criterion"
                ] = (
                    name
                )

            # =================================================
            # Generic dynamic criterion
            # =================================================

            else:
                print(
                    f"[{vendor_name}] "
                    "Running Generic Criterion Agent..."
                )

                agent = (
                    GenericCriterionAgent()
                )

                result = (
                    agent.evaluate(
                        criterion=name,

                        criterion_description=(
                            description
                        ),

                        requirements=(
                            requirements
                        ),

                        proposal_text=(
                            proposal_text
                        ),

                        vendor_name=(
                            vendor_name
                        ),
                    )
                )

            # =================================================
            # Validate result
            # =================================================

            if not isinstance(
                result,
                dict,
            ):
                raise ValueError(
                    f"Agent returned invalid result "
                    f"for criterion: {name}"
                )

            # Guarantee exact frozen criterion name for scoring.
            result[
                "criterion"
            ] = (
                name
            )

            print(
                f"[{vendor_name}] "
                f"Completed criterion: {name}"
            )

            print(
                f"[{vendor_name}] "
                "Criterion score: "
                f"{result.get('score', 'Unknown')}"
            )

            return (
                result
            )

        finally:
            if agent is not None:
                close_method = getattr(
                    agent,
                    "close",
                    None,
                )

                if callable(
                    close_method
                ):
                    close_method()

    # =====================================================
    # Compliance
    # =====================================================

    def _evaluate_compliance(
        self,
        mandatory_requirements,
        proposal_text,
        vendor_name,
    ):
        if not mandatory_requirements:
            print(
                f"[{vendor_name}] "
                "No mandatory RFP eligibility "
                "requirements found."
            )

            return {
                "riskLevel": "Low",

                "compliant": True,

                "missingRequirements": [],

                "rationale": (
                    "The RFP framework contains no "
                    "explicit mandatory eligibility gates."
                ),
            }

        print(
            f"[{vendor_name}] "
            "Running Compliance Agent against "
            f"{len(mandatory_requirements)} "
            "mandatory requirement(s)..."
        )

        agent = (
            ComplianceAgent()
        )

        try:
            result = (
                agent.evaluate(
                    mandatory_requirements=(
                        mandatory_requirements
                    ),

                    proposal_text=(
                        proposal_text
                    ),
                )
            )

            if not isinstance(
                result,
                dict,
            ):
                return {}

            print(
                f"[{vendor_name}] "
                "Compliance completed."
            )

            return (
                result
            )

        finally:
            close_method = getattr(
                agent,
                "close",
                None,
            )

            if callable(
                close_method
            ):
                close_method()

    # =====================================================
    # Evaluate one vendor
    # =====================================================

    def _evaluate_vendor(
        self,
        vendor_name,
        proposal_text,
        criteria,
    ):
        vendor_name = str(
            vendor_name
        ).strip()

        if not vendor_name:
            vendor_name = (
                "Vendor"
            )

        if not isinstance(
            proposal_text,
            str,
        ):
            raise ValueError(
                "Proposal text must be a string."
            )

        proposal_text = (
            proposal_text.strip()
        )

        if not proposal_text:
            raise ValueError(
                f"Proposal text is empty for "
                f"vendor: {vendor_name}"
            )

        print(
            "\n================================"
        )
        print(
            f"EVALUATING VENDOR: "
            f"{vendor_name}"
        )
        print(
            "================================"
        )

        mandatory_requirements = (
            self._get_mandatory_requirements(
                criteria
            )
        )

        print(
            f"[{vendor_name}] "
            "Mandatory eligibility gates: "
            f"{len(mandatory_requirements)}"
        )

        evaluations_by_index = {}
        compliance_result = {}

        total_tasks = (
            len(criteria)
            +
            1
        )

        worker_count = min(
            self.MAX_VENDOR_TASK_WORKERS,
            total_tasks,
        )

        print(
            f"[{vendor_name}] "
            f"Running {len(criteria)} criteria "
            "+ compliance with "
            f"{worker_count} concurrent worker(s)."
        )

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {}

            for (
                index,
                criterion,
            ) in enumerate(
                criteria
            ):
                future = (
                    executor.submit(
                        self._evaluate_criterion,
                        criterion,
                        proposal_text,
                        vendor_name,
                    )
                )

                future_map[
                    future
                ] = {
                    "type": "criterion",

                    "index": index,

                    "name": str(
                        criterion.get(
                            "name",
                            "",
                        )
                    ),
                }

            compliance_future = (
                executor.submit(
                    self._evaluate_compliance,
                    mandatory_requirements,
                    proposal_text,
                    vendor_name,
                )
            )

            future_map[
                compliance_future
            ] = {
                "type": "compliance",

                "index": None,

                "name": "Compliance",
            }

            for future in (
                as_completed(
                    future_map
                )
            ):
                task_info = (
                    future_map[
                        future
                    ]
                )

                task_type = (
                    task_info[
                        "type"
                    ]
                )

                try:
                    result = (
                        future.result()
                    )

                except Exception as error:
                    task_name = (
                        task_info.get(
                            "name",
                            "Unknown",
                        )
                    )

                    raise RuntimeError(
                        f"{task_name} task failed "
                        f"for vendor "
                        f"'{vendor_name}': "
                        f"{error}"
                    ) from error

                if (
                    task_type
                    ==
                    "criterion"
                ):
                    index = (
                        task_info[
                            "index"
                        ]
                    )

                    if not isinstance(
                        result,
                        dict,
                    ):
                        raise ValueError(
                            "Evaluation agent returned "
                            "an invalid result."
                        )

                    evaluations_by_index[
                        index
                    ] = (
                        result
                    )

                elif (
                    task_type
                    ==
                    "compliance"
                ):
                    if isinstance(
                        result,
                        dict,
                    ):
                        compliance_result = (
                            result
                        )

        evaluations = []

        for index in range(
            len(
                criteria
            )
        ):
            if index not in (
                evaluations_by_index
            ):
                criterion_name = str(
                    criteria[
                        index
                    ].get(
                        "name",
                        "",
                    )
                )

                raise RuntimeError(
                    "Missing evaluation result "
                    f"for criterion: "
                    f"{criterion_name}"
                )

            evaluations.append(
                evaluations_by_index[
                    index
                ]
            )

        print(
            f"\n[{vendor_name}] "
            "Calculating deterministic "
            "weighted score..."
        )

        scoring_result = (
            calculate_weighted_score(
                evaluations=(
                    evaluations
                ),

                criteria=(
                    criteria
                ),
            )
        )

        final_score = float(
            scoring_result[
                "final_score"
            ]
        )

        print(
            f"[{vendor_name}] "
            "Final weighted score: "
            f"{final_score}"
        )

        return {
            "vendor": (
                vendor_name
            ),

            "overallScore": (
                final_score
            ),

            "scoring": (
                scoring_result
            ),

            "overallMandatoryCompliance": (
                scoring_result.get(
                    "overall_mandatory_compliance"
                )
            ),

            "mandatorySummary": (
                scoring_result.get(
                    "mandatory_summary",
                    {},
                )
            ),

            "riskLevel": (
                compliance_result.get(
                    "riskLevel",
                    "Unknown",
                )
            ),

            "compliant": (
                compliance_result.get(
                    "compliant"
                )
            ),

            "missingRequirements": (
                compliance_result.get(
                    "missingRequirements",
                    [],
                )
            ),

            "complianceRationale": (
                compliance_result.get(
                    "rationale",
                    "",
                )
            ),

            "evaluations": (
                evaluations
            ),
        }

    # =====================================================
    # Process one proposal
    # =====================================================

    def _process_proposal(
        self,
        proposal_path,
        criteria,
    ):
        proposal_path = Path(
            proposal_path
        )

        print(
            "\n================================"
        )
        print(
            f"PARSING PROPOSAL: "
            f"{proposal_path.name}"
        )
        print(
            "================================"
        )

        parser = (
            DocumentParser()
        )

        proposal_started = (
            time.perf_counter()
        )

        try:
            parse_started = (
                time.perf_counter()
            )

            proposal_document = (
                parser.parse_document(
                    proposal_path
                )
            )

            print(
                f"[{proposal_path.name}] "
                "Document parsing: "
                f"{time.perf_counter() - parse_started:.2f}s"
            )

            proposal_text = str(
                proposal_document.get(
                    "text",
                    "",
                )
            ).strip()

            if not proposal_text:
                raise RuntimeError(
                    "Document parser returned "
                    "empty text for "
                    f"{proposal_path.name}."
                )

            print(
                f"[{proposal_path.name}] "
                "Proposal extracted successfully "
                f"({len(proposal_text)} characters)"
            )

            vendor_name = (
                proposal_path.stem
            )

            evaluation_started = (
                time.perf_counter()
            )

            vendor_result = (
                self._evaluate_vendor(
                    vendor_name=(
                        vendor_name
                    ),

                    proposal_text=(
                        proposal_text
                    ),

                    criteria=(
                        criteria
                    ),
                )
            )

            print(
                f"[{proposal_path.name}] "
                "Vendor AI evaluation: "
                f"{time.perf_counter() - evaluation_started:.2f}s"
            )

            print(
                f"[{proposal_path.name}] "
                "Total proposal processing: "
                f"{time.perf_counter() - proposal_started:.2f}s"
            )

            return (
                vendor_result
            )

        finally:
            close_method = getattr(
                parser,
                "close",
                None,
            )

            if callable(
                close_method
            ):
                close_method()

    # =====================================================
    # Main evaluation
    # =====================================================

    def evaluate(
        self,
        rfp_path=None,
        proposal_paths=None,
        **kwargs,
    ):
        evaluation_started = (
            time.perf_counter()
        )

        if rfp_path is None:
            rfp_path = (
                kwargs.get(
                    "rfp_file"
                )
                or
                kwargs.get(
                    "rfp"
                )
                or
                kwargs.get(
                    "rfp_file_path"
                )
            )

        if proposal_paths is None:
            proposal_paths = (
                kwargs.get(
                    "proposal_files"
                )
                or
                kwargs.get(
                    "proposals"
                )
                or
                kwargs.get(
                    "vendor_proposals"
                )
                or
                kwargs.get(
                    "proposal_file_paths"
                )
            )

        if rfp_path is None:
            raise ValueError(
                "RFP file path is required."
            )

        if proposal_paths is None:
            raise ValueError(
                "At least one vendor proposal "
                "is required."
            )

        if isinstance(
            proposal_paths,
            (
                str,
                Path,
            ),
        ):
            proposal_paths = [
                proposal_paths
            ]

        proposal_paths = list(
            proposal_paths
        )

        if not proposal_paths:
            raise ValueError(
                "At least one vendor proposal "
                "is required."
            )

        # =================================================
        # STEP 1 - Parse RFP
        # =================================================

        print(
            "\n================================"
        )
        print(
            "STEP 1 - PARSING RFP"
        )
        print(
            "================================"
        )

        rfp_parse_started = (
            time.perf_counter()
        )

        rfp_document = (
            self.document_parser.parse_document(
                rfp_path
            )
        )

        print(
            "RFP parsing total: "
            f"{time.perf_counter() - rfp_parse_started:.2f}s"
        )

        rfp_text = str(
            rfp_document.get(
                "text",
                "",
            )
        ).strip()

        if not rfp_text:
            raise RuntimeError(
                "Document parser returned "
                "empty RFP text."
            )

        print(
            "RFP extracted successfully "
            f"({len(rfp_text)} characters)"
        )

        # =================================================
        # STEP 2 - Analyze RFP once
        # =================================================

        print(
            "\n================================"
        )
        print(
            "STEP 2 - ANALYZING RFP"
        )
        print(
            "================================"
        )

        rfp_analysis_started = (
            time.perf_counter()
        )

        rfp_analysis = (
            self.rfp_agent.analyze(
                rfp_text
            )
        )

        print(
            "RFP analysis total: "
            f"{time.perf_counter() - rfp_analysis_started:.2f}s"
        )

        if not isinstance(
            rfp_analysis,
            dict,
        ):
            raise RuntimeError(
                "RFP Agent returned "
                "an invalid result."
            )

        criteria = (
            rfp_analysis.get(
                "criteria",
                [],
            )
        )

        if (
            not isinstance(
                criteria,
                list,
            )
            or
            not criteria
        ):
            raise RuntimeError(
                "RFP Agent did not return "
                "evaluation criteria."
            )

        # =================================================
        # Validate frozen framework
        # =================================================

        print(
            "\n================================"
        )
        print(
            "VALIDATING RFP FRAMEWORK"
        )
        print(
            "================================"
        )

        for criterion in (
            criteria
        ):
            self._validate_criterion(
                criterion
            )

        total_weight = sum(
            float(
                criterion.get(
                    "weight",
                    0,
                )
            )
            for criterion
            in criteria
        )

        if abs(
            total_weight
            -
            100.0
        ) > 0.01:
            raise RuntimeError(
                "RFP criteria weights must total 100. "
                "Current total: "
                f"{round(total_weight, 2)}"
            )

        total_requirements = sum(
            len(
                criterion.get(
                    "requirements",
                    [],
                )
            )
            for criterion
            in criteria
        )

        mandatory_requirements = (
            self._get_mandatory_requirements(
                criteria
            )
        )

        print(
            "RFP framework frozen with "
            f"{len(criteria)} criteria."
        )

        print(
            "Total requirements: "
            f"{total_requirements}"
        )

        print(
            "Mandatory eligibility gates: "
            f"{len(mandatory_requirements)}"
        )

        print(
            "Total weight: "
            f"{round(total_weight, 2)}%"
        )

        for criterion in (
            criteria
        ):
            print(
                "- "
                f"{criterion.get('name', '')} "
                "| agent="
                f"{self._classify_criterion(criterion)} "
                "| requirements="
                f"{len(criterion.get('requirements', []))} "
                "| weight="
                f"{criterion.get('weight', 0)}%"
            )

        # =================================================
        # STEP 3 - Evaluate proposals
        # =================================================

        print(
            "\n================================"
        )
        print(
            "STEP 3 - EVALUATING PROPOSALS"
        )
        print(
            "================================"
        )

        vendor_results = []

        worker_count = min(
            self.MAX_VENDOR_WORKERS,
            len(
                proposal_paths
            ),
        )

        print(
            f"Evaluating {len(proposal_paths)} "
            "proposal(s) with "
            f"{worker_count} concurrent "
            "vendor worker(s)."
        )

        errors = []

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:
            future_map = {
                executor.submit(
                    self._process_proposal,
                    proposal_path,
                    criteria,
                ): Path(
                    proposal_path
                ).name
                for proposal_path
                in proposal_paths
            }

            for future in (
                as_completed(
                    future_map
                )
            ):
                proposal_name = (
                    future_map[
                        future
                    ]
                )

                try:
                    vendor_result = (
                        future.result()
                    )

                    vendor_results.append(
                        vendor_result
                    )

                    print(
                        "\n================================"
                    )
                    print(
                        "COMPLETED VENDOR: "
                        f"{proposal_name}"
                    )
                    print(
                        "================================"
                    )

                except Exception as error:
                    print(
                        "\n================================"
                    )
                    print(
                        "FAILED VENDOR: "
                        f"{proposal_name}"
                    )
                    print(
                        "================================"
                    )
                    print(
                        f"Error: {error}"
                    )

                    errors.append(
                        {
                            "proposal": (
                                proposal_name
                            ),

                            "error": (
                                str(
                                    error
                                )
                            ),
                        }
                    )

        if errors:
            error_summary = "; ".join(
                (
                    f"{item['proposal']}: "
                    f"{item['error']}"
                )
                for item
                in errors
            )

            raise RuntimeError(
                "One or more vendor proposals "
                "failed during evaluation. "
                f"{error_summary}"
            )

        if not vendor_results:
            raise RuntimeError(
                "No vendor proposals were "
                "successfully evaluated."
            )

        # =================================================
        # STEP 4 - Sort vendors
        # =================================================

        print(
            "\n================================"
        )
        print(
            "STEP 4 - SORTING VENDORS"
        )
        print(
            "================================"
        )

        vendor_results.sort(
            key=lambda item: float(
                item.get(
                    "overallScore",
                    0,
                )
            ),
            reverse=True,
        )

        for (
            index,
            vendor,
        ) in enumerate(
            vendor_results,
            start=1,
        ):
            vendor[
                "rank"
            ] = (
                index
            )

        # =================================================
        # STEP 5 - Ranking / eligibility
        # =================================================

        print(
            "\n================================"
        )
        print(
            "STEP 5 - RUNNING RANKING AGENT"
        )
        print(
            "================================"
        )

        ranking_started = (
            time.perf_counter()
        )

        ranking = (
            self.ranking_agent.rank(
                vendor_results
            )
        )

        print(
            "Ranking agent total: "
            f"{time.perf_counter() - ranking_started:.2f}s"
        )

        if not isinstance(
            ranking,
            dict,
        ):
            raise RuntimeError(
                "Ranking Agent returned "
                "an invalid result."
            )

        recommended_vendor = (
            ranking.get(
                "recommendedVendor"
            )
        )

        recommended_vendor_score = (
            ranking.get(
                "recommendedVendorScore"
            )
        )

        top_ranked_vendor = (
            ranking.get(
                "topRankedVendor"
            )
        )

        top_ranked_vendor_score = (
            ranking.get(
                "topRankedVendorScore"
            )
        )

        recommendation_status = (
            ranking.get(
                "recommendationStatus",
                "UNKNOWN",
            )
        )

        # =================================================
        # STEP 6 - Final result
        # =================================================

        final_result = {
            "rfp": {
                "fileName": (
                    Path(
                        rfp_path
                    ).name
                ),

                "analysis": (
                    rfp_analysis
                ),

                "criteria": (
                    criteria
                ),

                "totalCriteria": (
                    len(
                        criteria
                    )
                ),

                "totalWeight": (
                    round(
                        total_weight,
                        2,
                    )
                ),
            },

            "totalVendors": (
                len(
                    vendor_results
                )
            ),

            "vendors": (
                vendor_results
            ),

            "ranking": (
                ranking
            ),

            "topRankedVendor": (
                top_ranked_vendor
            ),

            "topRankedVendorScore": (
                top_ranked_vendor_score
            ),

            "recommendedVendor": (
                recommended_vendor
            ),

            "recommendedVendorScore": (
                recommended_vendor_score
            ),

            "recommendationStatus": (
                recommendation_status
            ),

            "humanReviewRequired": (
                ranking.get(
                    "humanReviewRequired",
                    True,
                )
            ),
        }

        print(
            "\n================================"
        )
        print(
            "EVALUATION COMPLETE"
        )
        print(
            "================================"
        )

        print(
            "Top Ranked Vendor: "
            f"{top_ranked_vendor}"
        )

        print(
            "Recommended Vendor: "
            f"{recommended_vendor}"
        )

        print(
            "Recommendation Status: "
            f"{recommendation_status}"
        )

        print(
            "Total evaluation time: "
            f"{time.perf_counter() - evaluation_started:.2f}s"
        )

        return (
            final_result
        )

    # =====================================================
    # Cleanup
    # =====================================================

    def close(
        self,
    ):
        agents = [
            self.rfp_agent,
            self.technical_agent,
            self.project_plan_agent,
            self.experience_agent,
            self.team_agent,
            self.financial_agent,
            self.generic_criterion_agent,
            self.compliance_agent,
            self.ranking_agent,
        ]

        for agent in (
            agents
        ):
            close_method = getattr(
                agent,
                "close",
                None,
            )

            if callable(
                close_method
            ):
                close_method()

        parser_close = getattr(
            self.document_parser,
            "close",
            None,
        )

        if callable(
            parser_close
        ):
            parser_close()
