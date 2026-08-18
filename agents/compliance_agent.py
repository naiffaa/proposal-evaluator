import json
import re

from services.llm_client import LLMClient


class ComplianceAgent:
    """
    Evaluates whether a vendor proposal satisfies
    the mandatory requirements defined in the RFP.

    OCI Generative AI performs the semantic evaluation.
    Python calculates the final compliance result and score.
    """

    def __init__(self):
        self.llm = LLMClient()

    def _format_requirements(self, mandatory_requirements):
        """
        Convert requirements into clean text regardless
        of whether the input is a list, dict, or string.
        """

        if isinstance(mandatory_requirements, str):
            return mandatory_requirements

        return json.dumps(
            mandatory_requirements,
            indent=2,
            ensure_ascii=False
        )

    def _parse_json(self, result):
        """
        Safely parse JSON returned by the LLM.

        Handles cases where the model returns:
        ```json
        {...}
        ```
        """

        result = result.strip()

        result = re.sub(
            r"^```(?:json)?\s*",
            "",
            result,
            flags=re.IGNORECASE
        )

        result = re.sub(
            r"\s*```$",
            "",
            result
        )

        try:
            return json.loads(result)

        except json.JSONDecodeError as error:
            raise ValueError(
                "Compliance Agent returned invalid JSON.\n"
                f"Raw response:\n{result}"
            ) from error

    def _calculate_compliance(self, evaluations):
        """
        Calculate compliance deterministically in Python.

        MET = 1 point
        PARTIAL = 0.5 point
        NOT_MET = 0 points

        A proposal is fully compliant only when
        every mandatory requirement is MET.
        """

        if not evaluations:
            return False, 0.0

        total_points = 0

        for evaluation in evaluations:

            status = evaluation.get(
                "status",
                "NOT_MET"
            ).upper()

            if status == "MET":
                total_points += 1

            elif status == "PARTIAL":
                total_points += 0.5

        compliance_score = (
            total_points / len(evaluations)
        ) * 100

        compliant = all(
            evaluation.get(
                "status",
                "NOT_MET"
            ).upper() == "MET"
            for evaluation in evaluations
        )

        return compliant, round(compliance_score, 2)

    def evaluate(
        self,
        mandatory_requirements,
        proposal_text
    ):
        """
        Evaluate a proposal against mandatory RFP requirements.

        Returns a structured dictionary containing:
        - compliance status
        - compliance score
        - requirement-by-requirement assessment
        - missing requirements
        - unsupported claims
        - compliance gaps
        - delivery risks
        - ambiguous commitments
        - overall risk level
        - rationale
        """

        requirements_text = self._format_requirements(
            mandatory_requirements
        )

        prompt = f"""
You are a senior procurement compliance and risk evaluator.

Your task is to evaluate a vendor proposal against the
MANDATORY requirements of an RFP.

You must be strict, evidence-based, and objective.

IMPORTANT RULES:

1. Evaluate ONLY using information explicitly contained
   in the vendor proposal.

2. Do NOT assume that a requirement is satisfied if there
   is no supporting evidence.

3. Do NOT invent evidence.

4. For every mandatory requirement, assign exactly one status:

   MET
   PARTIAL
   NOT_MET

5. MET:
   The proposal clearly and explicitly satisfies
   the requirement.

6. PARTIAL:
   The proposal addresses the requirement but the
   response is incomplete, ambiguous, conditional,
   or lacks sufficient evidence.

7. NOT_MET:
   The proposal does not address the requirement,
   contradicts it, or provides no evidence.

8. Evidence must come from the vendor proposal.

9. Identify unsupported claims separately.

10. Identify delivery, implementation, contractual,
    operational, or compliance risks where relevant.

11. Do NOT calculate the final compliance score.
    Python will calculate it.

12. Return ONLY valid JSON.
    Do not include markdown or text outside the JSON.


MANDATORY RFP REQUIREMENTS:

{requirements_text}


VENDOR PROPOSAL:

{proposal_text}


Return this exact JSON structure:

{{
  "requirementsEvaluation": [
    {{
      "requirement": "Exact or concise requirement description",
      "status": "MET",
      "evidence": [
        "Relevant evidence found in the proposal"
      ],
      "gap": "",
      "reason": "Short explanation of the evaluation"
    }}
  ],

  "missingRequirements": [
    "Mandatory requirement that was not satisfied"
  ],

  "unsupportedClaims": [
    "Claim made by the vendor without sufficient supporting evidence"
  ],

  "complianceGaps": [
    "Important compliance gap"
  ],

  "deliveryRisks": [
    {{
      "risk": "Description of the risk",
      "severity": "Low",
      "reason": "Why this creates a delivery risk"
    }}
  ],

  "ambiguousCommitments": [
    "Ambiguous or conditional vendor commitment"
  ],

  "riskLevel": "Low",

  "rationale": "Concise overall compliance and risk assessment"
}}

For riskLevel use ONLY:

Low
Medium
High

For deliveryRisks severity use ONLY:

Low
Medium
High
"""

        raw_result = self.llm.ask(prompt)

        result = self._parse_json(
            raw_result
        )

        evaluations = result.get(
            "requirementsEvaluation",
            []
        )

        compliant, compliance_score = (
            self._calculate_compliance(
                evaluations
            )
        )

        # Validate the risk level
        risk_level = result.get(
            "riskLevel",
            "Medium"
        )

        if risk_level not in (
            "Low",
            "Medium",
            "High"
        ):
            risk_level = "Medium"

        # Python owns these final deterministic fields
        result["compliant"] = compliant
        result["complianceScore"] = compliance_score
        result["riskLevel"] = risk_level

        return result