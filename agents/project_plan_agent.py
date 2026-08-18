import json

from services.llm_client import LLMClient


class ProjectPlanAgent:
    def __init__(self):
        self.llm = LLMClient()

    def evaluate(self, requirements, proposal_text):
        """
        Evaluate the vendor's project plan against the RFP requirements.

        Args:
            requirements:
                Project-plan-related requirements extracted from the RFP.

            proposal_text:
                Full or relevant section of the vendor proposal.

        Returns:
            dict:
                Structured project plan evaluation.
        """

        prompt = f"""
You are a senior procurement and project delivery evaluator.

Your task is to evaluate ONLY the vendor's project plan against the
provided RFP requirements.

Do not assume information that is not explicitly stated in the proposal.
Do not reward vague promises.
Base every conclusion on evidence found in the vendor proposal.

Evaluate the proposal across the following dimensions:

1. Implementation Methodology
   - Is the delivery approach clearly defined?
   - Are phases and activities logically structured?
   - Is the proposed methodology appropriate for the project?

2. Timeline
   - Is there a realistic implementation timeline?
   - Are durations clearly stated?
   - Does the timeline align with the RFP requirements?

3. Milestones and Deliverables
   - Are major milestones identified?
   - Are expected deliverables clearly defined?
   - Are acceptance or completion points explained?

4. Dependencies and Assumptions
   - Does the vendor identify important dependencies?
   - Are assumptions clearly stated?
   - Are external dependencies or client responsibilities identified?

5. Resources and Governance
   - Are project roles and responsibilities defined?
   - Is project governance explained?
   - Are sufficient resources allocated to delivery?

6. Delivery Risks
   - Are implementation risks identified?
   - Are mitigation actions provided?
   - Are there any unclear, unrealistic, or high-risk commitments?

Scoring guidance:

90-100:
Excellent and highly detailed project plan.
Clearly satisfies or exceeds the RFP requirements.

75-89:
Strong project plan with minor gaps or limited detail.

60-74:
Acceptable project plan but with several gaps,
ambiguities, or weak supporting evidence.

40-59:
Weak project plan with significant missing information
or delivery concerns.

0-39:
Major deficiencies or failure to address the RFP requirements.

RFP Project Plan Requirements:
{requirements}

Vendor Proposal:
{proposal_text}

Return ONLY valid JSON.
Do not return Markdown.
Do not add text before or after the JSON.

Use exactly this structure:

{{
  "criterion": "Project Plan",
  "score": 0,
  "rationale": "",
  "strengths": [],
  "gaps": [],
  "evidence": [],
  "risks": [],
  "requirementCoverage": {{
    "implementationMethodology": "Met | Partially Met | Not Met | Not Found",
    "timeline": "Met | Partially Met | Not Met | Not Found",
    "milestonesAndDeliverables": "Met | Partially Met | Not Met | Not Found",
    "dependenciesAndAssumptions": "Met | Partially Met | Not Met | Not Found",
    "resourcesAndGovernance": "Met | Partially Met | Not Met | Not Found",
    "deliveryRiskManagement": "Met | Partially Met | Not Met | Not Found"
  }}
}}
"""

        result = self.llm.ask(prompt)

        try:
            parsed_result = json.loads(result)
        except json.JSONDecodeError as exc:
            raise ValueError(
                "ProjectPlanAgent received invalid JSON from the LLM.\n"
                f"Raw response:\n{result}"
            ) from exc

        self._validate_result(parsed_result)

        return parsed_result

    @staticmethod
    def _validate_result(result):
        """
        Validate the minimum structure returned by the LLM.
        """

        required_fields = [
            "criterion",
            "score",
            "rationale",
            "strengths",
            "gaps",
            "evidence",
            "risks",
            "requirementCoverage"
        ]

        missing_fields = [
            field
            for field in required_fields
            if field not in result
        ]

        if missing_fields:
            raise ValueError(
                "ProjectPlanAgent response is missing fields: "
                + ", ".join(missing_fields)
            )

        score = result["score"]

        if not isinstance(score, (int, float)):
            raise ValueError(
                "ProjectPlanAgent score must be numeric."
            )

        if score < 0 or score > 100:
            raise ValueError(
                "ProjectPlanAgent score must be between 0 and 100."
            )

        if result["criterion"] != "Project Plan":
            result["criterion"] = "Project Plan"