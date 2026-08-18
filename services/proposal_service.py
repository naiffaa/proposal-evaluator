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

    Flow:

        RFP
         ↓
    OCI Document Understanding
         ↓
    RFP Agent
         ↓
    Frozen evaluation framework
         ↓
    Vendor proposals
         ↓
    Specialized evaluation agents
         ↓
    Deterministic Python scoring
         ↓
    Compliance / Risk
         ↓
    Ranking Agent
         ↓
    Final structured result

    Important:

    - The RFP is analyzed ONCE per evaluation run.
    - All vendors use the exact same frozen framework.
    - Python determines numerical scores.
    - Python determines deterministic vendor order.
    - RankingAgent determines recommendation eligibility
      using deterministic compliance rules.
    - Top-ranked vendor is NOT automatically recommended.
    """

    def __init__(self):

        # =================================================
        # OCI document processing
        # =================================================

        self.document_parser = (
            DocumentParser()
        )

        # =================================================
        # RFP analysis
        # =================================================

        self.rfp_agent = (
            RFPAgent()
        )

        # =================================================
        # Proposal evaluation agents
        # =================================================

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

        # =================================================
        # Compliance / Risk
        # =================================================

        self.compliance_agent = (
            ComplianceAgent()
        )

        # =================================================
        # Ranking / Recommendation
        # =================================================

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
        Determine which specialized agent should evaluate
        a criterion.

        The criterion itself comes dynamically from
        the RFP.

        No criterion is invented here.
        """

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

        # =================================================
        # Financial / Commercial
        # =================================================

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

        # =================================================
        # Team / Personnel
        # =================================================

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

        # =================================================
        # Experience
        # =================================================

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

        # =================================================
        # Project Plan / Delivery
        # =================================================

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

        # =================================================
        # Technical
        # =================================================

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

        # =================================================
        # Unknown criterion
        # =================================================

        return "unknown"

    # =====================================================
    # Mandatory requirements
    # =====================================================

    def _get_mandatory_requirements(
        self,
        criteria,
    ):
        """
        Collect mandatory requirements directly from
        requirement objects.

        Mandatory is NOT determined from the criterion.
        """

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

        requirements = criterion.get(
            "requirements",
            [],
        )

        if not isinstance(
            requirements,
            list,
        ):
            raise ValueError(
                f"Requirements for criterion "
                f"'{name}' must be a list."
            )

        if not requirements:
            raise ValueError(
                f"Criterion '{name}' has no "
                "evaluation requirements."
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
        """
        Route one RFP criterion to its specialized agent.

        The criterion name, requirements, IDs,
        mandatory flags and weights remain exactly
        as produced by the RFP framework.
        """

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
            f"\nCriterion: {name}"
        )

        print(
            f"Agent type: {agent_type}"
        )

        # =================================================
        # Technical
        # =================================================

        if agent_type == "technical":

            print(
                "Running Technical Agent..."
            )

            return (
                self.technical_agent.evaluate(
                    criterion=name,
                    requirements=requirements,
                    proposal_text=proposal_text,
                )
            )

        # =================================================
        # Experience
        # =================================================

        if agent_type == "experience":

            print(
                "Running Experience Agent..."
            )

            return (
                self.experience_agent.evaluate(
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

        if agent_type == "team":

            print(
                "Running Team Agent..."
            )

            return (
                self.team_agent.evaluate(
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

        if agent_type == "financial":

            print(
                "Running Financial Agent..."
            )

            return (
                self.financial_agent.evaluate(
                    requirements=requirements,
                    proposal_text=proposal_text,
                    vendor_name=vendor_name,
                    criterion=name,
                    criterion_description=description,
                )
            )

        # =================================================
        # Project Plan
        # =================================================

        if agent_type == "project_plan":

            print(
                "Running Project Plan Agent..."
            )

            result = (
                self.project_plan_agent.evaluate(
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

            # Preserve exact RFP criterion name.
            result["criterion"] = (
                name
            )

            return result

        # =================================================
        # Unsupported criterion
        # =================================================

        raise ValueError(
            "No evaluation agent is currently "
            f"configured for criterion '{name}'. "
            "A generic criterion evaluator is required "
            "for this criterion type."
        )

    # =====================================================
    # Evaluate one vendor
    # =====================================================

    def _evaluate_vendor(
        self,
        vendor_name,
        proposal_text,
        criteria,
    ):
        """
        Evaluate one vendor against the exact frozen
        RFP evaluation framework.
        """

        vendor_name = str(
            vendor_name
        ).strip()

        if not vendor_name:
            vendor_name = "Vendor"

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

        # =================================================
        # Evaluate every RFP criterion
        # =================================================

        evaluations = []

        for criterion in criteria:

            result = (
                self._evaluate_criterion(
                    criterion=criterion,
                    proposal_text=proposal_text,
                    vendor_name=vendor_name,
                )
            )

            if not isinstance(
                result,
                dict,
            ):
                raise ValueError(
                    "Evaluation agent returned "
                    "an invalid result."
                )

            evaluations.append(
                result
            )

        # =================================================
        # Deterministic weighted scoring
        # =================================================

        print(
            "\nCalculating deterministic "
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

        # =================================================
        # Compliance / Risk
        # =================================================

        mandatory_requirements = (
            self._get_mandatory_requirements(
                criteria
            )
        )

        compliance_result = {}

        if mandatory_requirements:

            print(
                "Running Compliance Agent..."
            )

            compliance_result = (
                self.compliance_agent.evaluate(
                    mandatory_requirements=(
                        mandatory_requirements
                    ),
                    proposal_text=proposal_text,
                )
            )

            if not isinstance(
                compliance_result,
                dict,
            ):

                compliance_result = {}

        else:

            print(
                "No mandatory RFP requirements found."
            )

        # =================================================
        # Vendor result
        # =================================================

        return {
            "vendor": (
                vendor_name
            ),

            # ---------------------------------------------
            # Deterministic ranking score
            # ---------------------------------------------

            "overallScore": (
                final_score
            ),

            # ---------------------------------------------
            # Full deterministic scoring output
            # ---------------------------------------------

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
                    {}
                )
            ),

            # ---------------------------------------------
            # Compliance / risk output
            # ---------------------------------------------

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

            # ---------------------------------------------
            # Criterion evaluations
            # ---------------------------------------------

            "evaluations": (
                evaluations
            ),
        }

    # =====================================================
    # Main end-to-end evaluation
    # =====================================================

    def evaluate(
        self,
        rfp_path=None,
        proposal_paths=None,
        **kwargs,
    ):
        """
        Complete end-to-end proposal evaluation.

        RFP is analyzed exactly once.

        All proposals use the same frozen framework.
        """

        # =================================================
        # Support alternate parameter names
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
            (str, Path),
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
        # Analyze RFP ONCE
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
            for criterion in criteria
        )

        if abs(
            total_weight - 100.0
        ) > 0.01:

            raise RuntimeError(
                "RFP criteria weights must total 100. "
                f"Current total: "
                f"{round(total_weight, 2)}"
            )

        print(
            f"RFP framework frozen with "
            f"{len(criteria)} criteria."
        )

        print(
            f"Total weight: "
            f"{round(total_weight, 2)}%"
        )

        # =================================================
        # STEP 3
        # Evaluate all proposals
        # =================================================

        vendor_results = []

        for proposal_path in proposal_paths:

            proposal_path = Path(
                proposal_path
            )

            print(
                "\n================================"
            )

            print(
                f"STEP 3 - PARSING PROPOSAL: "
                f"{proposal_path.name}"
            )

            print(
                "================================"
            )

            proposal_document = (
                self.document_parser.parse_document(
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

            # =================================================
            # Vendor identification
            # =================================================
            #
            # For now the filename is used.
            #
            # Later this can be replaced by vendor-name
            # extraction from the proposal itself.
            # =================================================

            vendor_name = (
                proposal_path.stem
            )

            vendor_result = (
                self._evaluate_vendor(
                    vendor_name=vendor_name,
                    proposal_text=proposal_text,
                    criteria=criteria,
                )
            )

            vendor_results.append(
                vendor_result
            )

        # =================================================
        # STEP 4
        # Deterministic numerical ranking
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

        for index, vendor in enumerate(
            vendor_results,
            start=1,
        ):

            vendor["rank"] = (
                index
            )

        # =================================================
        # STEP 5
        # Ranking and eligibility
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

        # =================================================
        # IMPORTANT:
        #
        # Do NOT fallback to highest-scoring vendor.
        #
        # RankingAgent may intentionally return:
        #
        # recommendedVendor = None
        #
        # when no compliant vendor exists.
        #
        # Top-ranked and recommended are separate.
        # =================================================

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
        # Final structured result
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

            # =================================================
            # Vendor evaluation data
            # =================================================

            "totalVendors": (
                len(
                    vendor_results
                )
            ),

            "vendors": (
                vendor_results
            ),

            # =================================================
            # Ranking / advisory decision
            # =================================================

            "ranking": (
                ranking
            ),

            # Highest numerical score
            "topRankedVendor": (
                top_ranked_vendor
            ),

            "topRankedVendorScore": (
                top_ranked_vendor_score
            ),

            # Recommendation may intentionally be None.
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

        # =================================================
        # Logging
        # =================================================

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
        """
        Close HTTP clients used by agents.
        """

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