from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)
from pathlib import Path

from agents.rfp_agent import RFPAgent
from agents.technical_agent import TechnicalAgent
from agents.project_plan_agent import ProjectPlanAgent
from agents.experience_agent import ExperienceAgent
from agents.team_agent import TeamAgent
from agents.financial_agent import FinancialAgent
from agents.compliance_agent import ComplianceAgent
from agents.ranking_agent import RankingAgent

from services.document_parser import DocumentParser
from utils.scoring import calculate_weighted_score


class ProposalEvaluationService:
    """
    End-to-end proposal evaluation service.

    Important:

    - The RFP is analyzed once per evaluation.
    - All vendors use the same frozen RFP framework.
    - Vendors are evaluated concurrently.
    - Criteria inside each vendor are also evaluated concurrently.
    - Compliance can run alongside criterion evaluation.
    - Python performs deterministic scoring.
    - Python determines vendor order.
    - RankingAgent determines recommendation eligibility.

    Criterion requirements:

    - Technical / Project Plan criteria currently require
      explicit RFP requirements.

    - Experience / Team / Financial criteria may validly
      contain an empty requirements list when the RFP
      provides only an explicit weighted criterion without
      detailed thresholds.

      In that case their agents perform criterion-level
      evaluation instead of requirement-level evaluation.
    """

    # =====================================================
    # Concurrency configuration
    # =====================================================

    MAX_VENDOR_WORKERS = 3

    # Maximum concurrent AI tasks inside ONE vendor.
    #
    # Example with 3 vendors:
    # 3 vendors x 2 tasks = about 6 simultaneous tasks.
    #
    # Keep this conservative to reduce OCI rate-limit risk.
    MAX_VENDOR_TASK_WORKERS = 2

    # Agents currently capable of evaluating a criterion
    # even when the RFP does not provide detailed
    # sub-requirements.
    CRITERION_LEVEL_AGENT_TYPES = {
        "experience",
        "team",
        "financial",
    }

    def __init__(self):

        self.document_parser = (
            DocumentParser()
        )

        self.rfp_agent = (
            RFPAgent()
        )

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
        if not isinstance(
            criterion,
            dict,
        ):
            raise ValueError(
                "Criterion must be an object."
            )

        name = self._normalize_text(
            criterion.get(
                "name",
                "",
            )
        )

        description = self._normalize_text(
            criterion.get(
                "description",
                "",
            )
        )

        combined = (
            f"{name} {description}"
        )

        # -------------------------------------------------
        # Financial
        # -------------------------------------------------

        financial_keywords = [
            "financial",
            "commercial",
            "pricing",
            "price",
            "cost",
            "budget",
            "commercial proposal",
            "financial proposal",
            "cost proposal",
            "tco",
            "total cost",
        ]

        if any(
            keyword in combined
            for keyword in financial_keywords
        ):
            return "financial"

        # -------------------------------------------------
        # Team
        # -------------------------------------------------

        team_keywords = [
            "team qualification",
            "team qualifications",
            "team capability",
            "key personnel",
            "key staff",
            "project team",
            "staff qualification",
            "staff qualifications",
            "personnel qualification",
            "personnel qualifications",
            "professional certification",
            "professional certifications",
            "key experts",
            "resource qualification",
            "resource qualifications",
        ]

        if any(
            keyword in combined
            for keyword in team_keywords
        ):
            return "team"

        # -------------------------------------------------
        # Experience
        # -------------------------------------------------

        experience_keywords = [
            "experience",
            "past performance",
            "previous project",
            "previous projects",
            "similar project",
            "similar projects",
            "track record",
            "references",
            "vendor qualification",
            "vendor qualifications",
            "company qualification",
            "company qualifications",
        ]

        if any(
            keyword in combined
            for keyword in experience_keywords
        ):
            return "experience"

        # -------------------------------------------------
        # Project plan
        # -------------------------------------------------

        project_keywords = [
            "project plan",
            "implementation plan",
            "delivery plan",
            "implementation methodology",
            "delivery methodology",
            "project methodology",
            "timeline",
            "schedule",
            "milestones",
            "project management",
            "implementation approach",
        ]

        if any(
            keyword in combined
            for keyword in project_keywords
        ):
            return "project_plan"

        # -------------------------------------------------
        # Technical
        # -------------------------------------------------

        technical_keywords = [
            "technical",
            "solution",
            "architecture",
            "functional",
            "functionality",
            "technology",
            "system",
            "platform",
            "integration",
            "security",
            "performance",
            "infrastructure",
            "technical approach",
            "technical proposal",
        ]

        if any(
            keyword in combined
            for keyword in technical_keywords
        ):
            return "technical"

        return "unknown"

    # =====================================================
    # Mandatory requirements
    # =====================================================

    def _get_mandatory_requirements(
        self,
        criteria,
    ):
        mandatory_requirements = []

        for criterion in criteria:

            criterion_name = str(
                criterion.get(
                    "name",
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

            for requirement in requirements:

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
                    }
                )

        return mandatory_requirements

    # =====================================================
    # Criterion validation
    # =====================================================

    def _validate_criterion(
        self,
        criterion,
    ):
        """
        Validate one frozen RFP criterion.

        Empty requirements are allowed ONLY for criterion
        types whose evaluation agents explicitly support
        criterion-level evaluation.

        Current supported types:
        - experience
        - team
        - financial
        """

        if not isinstance(
            criterion,
            dict,
        ):
            raise ValueError(
                "Each RFP criterion must be an object."
            )

        # -------------------------------------------------
        # Name
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Requirements
        # -------------------------------------------------

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

        # -------------------------------------------------
        # Agent type
        # -------------------------------------------------

        agent_type = (
            self._classify_criterion(
                criterion
            )
        )

        if agent_type == "unknown":
            raise ValueError(
                "No evaluation agent is currently "
                f"configured for criterion '{name}'."
            )

        # -------------------------------------------------
        # Empty requirement handling
        # -------------------------------------------------

        if not requirements:

            if (
                agent_type
                in self.CRITERION_LEVEL_AGENT_TYPES
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
                    "evaluation requirements, and "
                    f"agent type '{agent_type}' does not "
                    "currently support criterion-level "
                    "evaluation."
                )

        # -------------------------------------------------
        # Weight
        # -------------------------------------------------

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

        return criterion

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
                f"Evaluation mode: requirement-level "
                f"({len(requirements)} requirement(s))"
            )

        else:
            print(
                f"[{vendor_name}] "
                "Evaluation mode: criterion-level"
            )

        # =================================================
        # IMPORTANT:
        #
        # Create an isolated agent for this task.
        #
        # This avoids sharing one HTTP/OpenAI client between
        # multiple concurrent criterion threads.
        # =================================================

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
                        criterion_description=description,
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
                        criterion_description=description,
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
                        criterion_description=description,
                    )
                )

            # =================================================
            # Project plan
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
                ] = name

            # =================================================
            # Unknown
            # =================================================

            else:

                raise ValueError(
                    "No evaluation agent is currently "
                    f"configured for criterion '{name}'. "
                    "A generic criterion evaluator is "
                    "required for this criterion type."
                )

            # =================================================
            # Validate agent result
            # =================================================

            if not isinstance(
                result,
                dict,
            ):
                raise ValueError(
                    f"Agent returned invalid result "
                    f"for criterion: {name}"
                )

            print(
                f"[{vendor_name}] "
                f"Completed criterion: {name}"
            )

            print(
                f"[{vendor_name}] "
                f"Criterion score: "
                f"{result.get('score', 'Unknown')}"
            )

            return result

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
    # Compliance task
    # =====================================================

    def _evaluate_compliance(
        self,
        mandatory_requirements,
        proposal_text,
        vendor_name,
    ):
        """
        Run compliance independently so it can execute
        concurrently with criterion evaluation.

        If the RFP contains no true mandatory eligibility
        gates, compliance must not automatically reject the
        vendor.
        """

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
            f"Running Compliance Agent against "
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
                    proposal_text=proposal_text,
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

            return result

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
            proposal_text
            .strip()
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

        # =================================================
        # Mandatory requirements
        # =================================================

        mandatory_requirements = (
            self._get_mandatory_requirements(
                criteria
            )
        )

        print(
            f"[{vendor_name}] "
            f"Mandatory eligibility gates: "
            f"{len(mandatory_requirements)}"
        )

        # =================================================
        # Concurrent vendor tasks
        #
        # Tasks:
        # - each criterion
        # - compliance
        # =================================================

        evaluations_by_index = {}

        compliance_result = {}

        total_tasks = (
            len(criteria) + 1
        )

        worker_count = min(
            self.MAX_VENDOR_TASK_WORKERS,
            total_tasks,
        )

        print(
            f"[{vendor_name}] "
            f"Running {len(criteria)} criteria "
            f"+ compliance with "
            f"{worker_count} concurrent worker(s)."
        )

        with ThreadPoolExecutor(
            max_workers=worker_count
        ) as executor:

            future_map = {}

            # =============================================
            # Criterion tasks
            # =============================================

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

            # =============================================
            # Compliance task
            # =============================================

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

            # =============================================
            # Collect results as tasks finish
            # =============================================

            for future in as_completed(
                future_map
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
                    task_type ==
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
                    ] = result

                elif (
                    task_type ==
                    "compliance"
                ):

                    if isinstance(
                        result,
                        dict,
                    ):
                        compliance_result = (
                            result
                        )

        # =================================================
        # Restore exact RFP criterion order
        # =================================================

        evaluations = []

        for index in range(
            len(criteria)
        ):

            if (
                index
                not in evaluations_by_index
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

        # =================================================
        # Deterministic weighted scoring
        # =================================================

        print(
            f"\n[{vendor_name}] "
            "Calculating deterministic "
            "weighted score..."
        )

        scoring_result = (
            calculate_weighted_score(
                evaluations=evaluations,
                criteria=criteria,
            )
        )

        final_score = float(
            scoring_result[
                "final_score"
            ]
        )

        print(
            f"[{vendor_name}] "
            f"Final weighted score: "
            f"{final_score}"
        )

        # =================================================
        # Vendor result
        # =================================================

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

        # Dedicated service per vendor.
        worker = (
            ProposalEvaluationService()
        )

        try:

            proposal_document = (
                worker.document_parser.parse_document(
                    proposal_path
                )
            )

            proposal_text = str(
                proposal_document.get(
                    "text",
                    "",
                )
            ).strip()

            if not proposal_text:
                raise RuntimeError(
                    "OCI Document Understanding "
                    f"returned empty text for "
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

            vendor_result = (
                worker._evaluate_vendor(
                    vendor_name=vendor_name,
                    proposal_text=proposal_text,
                    criteria=criteria,
                )
            )

            return vendor_result

        finally:

            worker.close()

    # =====================================================
    # Main evaluation
    # =====================================================

    def evaluate(
        self,
        rfp_path=None,
        proposal_paths=None,
        **kwargs,
    ):
        # =================================================
        # Alternate parameter names
        # =================================================

        if rfp_path is None:

            rfp_path = (
                kwargs.get(
                    "rfp_file"
                )
                or kwargs.get(
                    "rfp"
                )
                or kwargs.get(
                    "rfp_file_path"
                )
            )

        if proposal_paths is None:

            proposal_paths = (
                kwargs.get(
                    "proposal_files"
                )
                or kwargs.get(
                    "proposals"
                )
                or kwargs.get(
                    "vendor_proposals"
                )
                or kwargs.get(
                    "proposal_file_paths"
                )
            )

        # =================================================
        # Validate input
        # =================================================

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
        # STEP 1
        # Parse RFP
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

        rfp_document = (
            self.document_parser.parse_document(
                rfp_path
            )
        )

        rfp_text = str(
            rfp_document.get(
                "text",
                "",
            )
        ).strip()

        if not rfp_text:
            raise RuntimeError(
                "OCI Document Understanding "
                "returned empty RFP text."
            )

        print(
            f"RFP extracted successfully "
            f"({len(rfp_text)} characters)"
        )

        # =================================================
        # STEP 2
        # Analyze RFP once
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

        rfp_analysis = (
            self.rfp_agent.analyze(
                rfp_text
            )
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
            or not criteria
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

        for criterion in criteria:

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
            total_weight -
            100.0
        ) > 0.01:
            raise RuntimeError(
                "RFP criteria weights must total 100. "
                f"Current total: "
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
            f"RFP framework frozen with "
            f"{len(criteria)} criteria."
        )

        print(
            f"Total requirements: "
            f"{total_requirements}"
        )

        print(
            f"Mandatory eligibility gates: "
            f"{len(mandatory_requirements)}"
        )

        print(
            f"Total weight: "
            f"{round(total_weight, 2)}%"
        )

        # =================================================
        # STEP 3
        # Evaluate vendors concurrently
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
            len(proposal_paths),
        )

        print(
            f"Evaluating {len(proposal_paths)} "
            f"proposal(s) with "
            f"{worker_count} concurrent "
            f"vendor worker(s)."
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

            for future in as_completed(
                future_map
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
                        f"COMPLETED VENDOR: "
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
                        f"FAILED VENDOR: "
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
                                str(error)
                            ),
                        }
                    )

        # =================================================
        # Failure handling
        # =================================================

        if errors:

            error_summary = "; ".join(
                (
                    f"{item['proposal']}: "
                    f"{item['error']}"
                )
                for item in errors
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
        # STEP 4
        # Deterministic sorting
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
            ] = index

        # =================================================
        # STEP 5
        # Ranking / eligibility
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

        ranking = (
            self.ranking_agent.rank(
                vendor_results
            )
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
        # STEP 6
        # Final result
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
            f"Top Ranked Vendor: "
            f"{top_ranked_vendor}"
        )

        print(
            f"Recommended Vendor: "
            f"{recommended_vendor}"
        )

        print(
            f"Recommendation Status: "
            f"{recommendation_status}"
        )

        return final_result

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
            self.compliance_agent,
            self.ranking_agent,
        ]

        for agent in agents:

            close_method = getattr(
                agent,
                "close",
                None,
            )

            if callable(
                close_method
            ):
                close_method()