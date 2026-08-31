import json

from services.llm_client import LLMClient


class ProjectPlanAgent:
    """
    Specialized project-plan evaluator.

    Used only when the criterion NAME clearly represents
    project plan / implementation / schedule semantics.
    """

    def __init__(self):
        self.llm = LLMClient()

    def _extract_first_json_object(
        self,
        text,
    ):
        if not isinstance(text, str):
            return None

        start = text.find("{")

        if start < 0:
            return None

        depth = 0
        in_string = False
        escaped = False

        for index in range(
            start,
            len(text),
        ):
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
                    return text[
                        start:index + 1
                    ]

        return None

    def _parse_json(
        self,
        result,
    ):
        if not isinstance(result, str):
            raise ValueError(
                "ProjectPlanAgent response "
                "must be text."
            )

        text = result.strip()

        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]

        if text.endswith("```"):
            text = text[:-3]

        text = text.strip()

        try:
            return json.loads(text)

        except json.JSONDecodeError:
            extracted = (
                self._extract_first_json_object(
                    text
                )
            )

            if extracted:
                try:
                    return json.loads(
                        extracted
                    )
                except json.JSONDecodeError:
                    pass

            raise ValueError(
                "ProjectPlanAgent received "
                "invalid JSON from the LLM."
            )

    def evaluate(
        self,
        requirements,
        proposal_text,
    ):
        prompt = f"""
You are a senior procurement and project delivery evaluator.

Evaluate ONLY the vendor's project plan against the
provided RFP requirements.

Do not assume information not explicitly stated.
Do not reward vague promises.
Use only proposal evidence.

Evaluate:
1. Implementation Methodology
2. Timeline
3. Milestones and Deliverables
4. Dependencies and Assumptions
5. Resources and Governance
6. Delivery Risks

RFP Project Plan Requirements:
{requirements}

Vendor Proposal:
{proposal_text}

Return ONLY valid JSON.
No Markdown.
No text before or after JSON.

{{
  "criterion": "Project Plan",
  "score": 0,
  "rationale": "",
  "strengths": [],
  "gaps": [],
  "evidence": [],
  "risks": [],
  "requirementCoverage": {{
    "implementationMethodology":
      "Met | Partially Met | Not Met | Not Found",
    "timeline":
      "Met | Partially Met | Not Met | Not Found",
    "milestonesAndDeliverables":
      "Met | Partially Met | Not Met | Not Found",
    "dependenciesAndAssumptions":
      "Met | Partially Met | Not Met | Not Found",
    "resourcesAndGovernance":
      "Met | Partially Met | Not Met | Not Found",
    "deliveryRiskManagement":
      "Met | Partially Met | Not Met | Not Found"
  }}
}}
"""

        raw = self.llm.ask(
            prompt,
            label="ProjectPlanAgent",
        )

        result = self._parse_json(raw)

        self._validate_result(result)

        return result

    @staticmethod
    def _validate_result(
        result,
    ):
        required_fields = [
            "criterion",
            "score",
            "rationale",
            "strengths",
            "gaps",
            "evidence",
            "risks",
            "requirementCoverage",
        ]

        missing = [
            field
            for field in required_fields
            if field not in result
        ]

        if missing:
            raise ValueError(
                "ProjectPlanAgent response "
                "is missing fields: "
                +
                ", ".join(missing)
            )

        score = result["score"]

        if not isinstance(
            score,
            (int, float),
        ):
            raise ValueError(
                "ProjectPlanAgent score "
                "must be numeric."
            )

        if score < 0 or score > 100:
            raise ValueError(
                "ProjectPlanAgent score must "
                "be between 0 and 100."
            )

        result["criterion"] = (
            "Project Plan"
        )

    def close(self):
        self.llm.close()
