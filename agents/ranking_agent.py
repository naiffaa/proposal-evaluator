import json

from services.llm_client import LLMClient


class RankingAgent:
    """
    Final vendor ranking and recommendation agent.

    IMPORTANT:

    - Python determines numerical ranking.
    - Python determines vendor eligibility.
    - The LLM does NOT change scores.
    - The LLM does NOT decide whether a non-compliant
      vendor becomes eligible.
    - The LLM only explains trade-offs and the final
      advisory recommendation.
    """

    def __init__(self):
        self.llm = LLMClient()

    # =====================================================
    # JSON cleanup
    # =====================================================

    def _clean_json_response(
        self,
        response_text,
    ):
        """
        Clean common Markdown wrappers before
        parsing the LLM response.
        """

        if not isinstance(
            response_text,
            str,
        ):
            raise ValueError(
                "Ranking Agent response must be text."
            )

        cleaned = (
            response_text.strip()
        )

        if cleaned.startswith(
            "```json"
        ):
            cleaned = cleaned[7:]

        elif cleaned.startswith(
            "```"
        ):
            cleaned = cleaned[3:]

        if cleaned.endswith(
            "```"
        ):
            cleaned = cleaned[:-3]

        return cleaned.strip()

    # =====================================================
    # Validate vendor results
    # =====================================================

    def _validate_vendor_results(
        self,
        vendor_results,
    ):
        """
        Validate minimum data required for ranking.
        """

        if not isinstance(
            vendor_results,
            list,
        ):
            raise TypeError(
                "vendor_results must be a list."
            )

        if not vendor_results:
            raise ValueError(
                "vendor_results cannot be empty."
            )

        seen_vendors = set()

        for vendor in vendor_results:

            if not isinstance(
                vendor,
                dict,
            ):
                raise ValueError(
                    "Each vendor result must be an object."
                )

            vendor_name = str(
                vendor.get(
                    "vendor",
                    "",
                )
            ).strip()

            if not vendor_name:
                raise ValueError(
                    "Each vendor result must contain "
                    "a vendor name."
                )

            if vendor_name in seen_vendors:
                raise ValueError(
                    f"Duplicate vendor found: "
                    f"{vendor_name}"
                )

            seen_vendors.add(
                vendor_name
            )

            if (
                "overallScore"
                not in vendor
            ):
                raise ValueError(
                    f"Vendor '{vendor_name}' "
                    "does not contain overallScore."
                )

            try:
                score = float(
                    vendor[
                        "overallScore"
                    ]
                )

            except (
                TypeError,
                ValueError,
            ) as error:
                raise ValueError(
                    f"Vendor '{vendor_name}' "
                    "has an invalid overallScore."
                ) from error

            if not (
                0 <= score <= 100
            ):
                raise ValueError(
                    f"Vendor '{vendor_name}' "
                    "overallScore must be between "
                    "0 and 100."
                )

    # =====================================================
    # Score reference
    # =====================================================

    def _build_score_reference(
        self,
        vendor_results,
    ):
        """
        Create immutable Python score reference.
        """

        return {
            vendor["vendor"]: round(
                float(
                    vendor[
                        "overallScore"
                    ]
                ),
                2,
            )
            for vendor in vendor_results
        }

    # =====================================================
    # Compliance reference
    # =====================================================

    def _build_compliance_reference(
        self,
        vendor_results,
    ):
        """
        Create deterministic eligibility information.

        A vendor is eligible for recommendation only
        when compliance is explicitly True.

        False:
            Vendor has compliance issues.

        None:
            Compliance was not determined.

        Neither False nor None is treated as eligible.
        """

        compliance_reference = {}

        for vendor in vendor_results:

            vendor_name = vendor[
                "vendor"
            ]

            compliant = vendor.get(
                "compliant"
            )

            mandatory_compliance = (
                vendor.get(
                    "overallMandatoryCompliance"
                )
            )

            risk_level = vendor.get(
                "riskLevel",
                "Unknown",
            )

            eligible = (
                compliant is True
            )

            compliance_reference[
                vendor_name
            ] = {
                "compliant": compliant,
                "eligible": eligible,
                "mandatoryCompliance": (
                    mandatory_compliance
                ),
                "riskLevel": (
                    risk_level
                ),
            }

        return compliance_reference

    # =====================================================
    # Deterministic ranking
    # =====================================================

    def _build_deterministic_ranking(
        self,
        vendor_results,
    ):
        """
        Rank vendors using Python-generated score only.

        Higher score = higher rank.

        Eligibility does NOT change numerical rank.
        """

        ranked = sorted(
            vendor_results,
            key=lambda vendor: float(
                vendor.get(
                    "overallScore",
                    0,
                )
            ),
            reverse=True,
        )

        deterministic_ranking = []

        for index, vendor in enumerate(
            ranked,
            start=1,
        ):

            deterministic_ranking.append(
                {
                    "rank": index,
                    "vendor": (
                        vendor["vendor"]
                    ),
                    "score": round(
                        float(
                            vendor[
                                "overallScore"
                            ]
                        ),
                        2,
                    ),
                    "riskLevel": (
                        vendor.get(
                            "riskLevel",
                            "Unknown",
                        )
                    ),
                    "compliant": (
                        vendor.get(
                            "compliant"
                        )
                    ),
                    "eligible": (
                        vendor.get(
                            "compliant"
                        )
                        is True
                    ),
                    "mandatoryCompliance": (
                        vendor.get(
                            "overallMandatoryCompliance"
                        )
                    ),
                }
            )

        return deterministic_ranking

    # =====================================================
    # Determine recommendation
    # =====================================================

    def _determine_recommendation(
        self,
        deterministic_ranking,
    ):
        """
        Determine recommendation eligibility entirely
        in Python.

        Top-ranked vendor and recommended vendor are
        intentionally separate concepts.
        """

        if not deterministic_ranking:
            return {
                "topRankedVendor": None,
                "topRankedVendorScore": None,
                "recommendedVendor": None,
                "recommendedVendorScore": None,
                "recommendationStatus": (
                    "NO_VENDOR_RESULTS"
                ),
            }

        top_vendor = (
            deterministic_ranking[0]
        )

        eligible_vendors = [
            vendor
            for vendor in deterministic_ranking
            if vendor.get(
                "eligible"
            )
            is True
        ]

        # =================================================
        # No compliant vendor
        # =================================================

        if not eligible_vendors:

            return {
                "topRankedVendor": (
                    top_vendor["vendor"]
                ),
                "topRankedVendorScore": (
                    top_vendor["score"]
                ),
                "recommendedVendor": None,
                "recommendedVendorScore": None,
                "recommendationStatus": (
                    "NO_ELIGIBLE_VENDOR"
                ),
            }

        # =================================================
        # Highest ranked compliant vendor
        # =================================================

        recommended = (
            eligible_vendors[0]
        )

        return {
            "topRankedVendor": (
                top_vendor["vendor"]
            ),
            "topRankedVendorScore": (
                top_vendor["score"]
            ),
            "recommendedVendor": (
                recommended["vendor"]
            ),
            "recommendedVendorScore": (
                recommended["score"]
            ),
            "recommendationStatus": (
                "RECOMMENDED_FOR_REVIEW"
            ),
        }

    # =====================================================
    # Main ranking
    # =====================================================

    def rank(
        self,
        vendor_results,
    ):
        """
        Produce deterministic ranking plus
        LLM-generated procurement explanation.
        """

        # =================================================
        # Validate
        # =================================================

        self._validate_vendor_results(
            vendor_results
        )

        # =================================================
        # Python-controlled references
        # =================================================

        score_reference = (
            self._build_score_reference(
                vendor_results
            )
        )

        compliance_reference = (
            self._build_compliance_reference(
                vendor_results
            )
        )

        deterministic_ranking = (
            self._build_deterministic_ranking(
                vendor_results
            )
        )

        recommendation = (
            self._determine_recommendation(
                deterministic_ranking
            )
        )

        # =================================================
        # Data for LLM explanation
        # =================================================

        vendor_results_json = (
            json.dumps(
                vendor_results,
                indent=2,
                ensure_ascii=False,
            )
        )

        score_reference_json = (
            json.dumps(
                score_reference,
                indent=2,
                ensure_ascii=False,
            )
        )

        compliance_reference_json = (
            json.dumps(
                compliance_reference,
                indent=2,
                ensure_ascii=False,
            )
        )

        ranking_reference_json = (
            json.dumps(
                deterministic_ranking,
                indent=2,
                ensure_ascii=False,
            )
        )

        recommendation_json = (
            json.dumps(
                recommendation,
                indent=2,
                ensure_ascii=False,
            )
        )

        # =================================================
        # LLM prompt
        # =================================================

        prompt = f"""
You are a senior procurement evaluation advisor.

The vendor evaluation has already been completed.

Python has already determined:

- numerical scores
- vendor ranking
- compliance eligibility
- top-ranked vendor
- recommended vendor eligibility

You MUST NOT modify any of these decisions.

==================================================
IMPORTANT DEFINITIONS
==================================================

TOP-RANKED VENDOR:

The vendor with the highest deterministic
Python final score.

RECOMMENDED VENDOR:

The highest-ranked vendor whose compliance status
is explicitly compliant = true.

A top-ranked vendor is NOT automatically recommended.

If no vendor has compliant = true:

recommendedVendor MUST remain null.

In that situation, explain that there is currently
no eligible vendor for recommendation.

==================================================
RULES
==================================================

1. Do NOT calculate numerical scores.

2. Do NOT change any score.

3. Do NOT change rank order.

4. Do NOT declare a non-compliant vendor eligible.

5. Do NOT convert a compliance status from false
   or null to true.

6. Do NOT recommend a vendor when Python has returned:

recommendationStatus = "NO_ELIGIBLE_VENDOR"

7. Use ONLY the supplied evaluation results.

8. Do not invent capabilities, evidence, requirements,
   qualifications, prices, certifications, or risks.

9. Clearly explain important procurement trade-offs.

10. Highlight mandatory requirement gaps and
    compliance risks.

11. The recommendation is advisory.

12. Never state that a procurement award has
    already been made.

13. Human review is always required.

==================================================
OFFICIAL SCORES
==================================================

{score_reference_json}

==================================================
OFFICIAL COMPLIANCE / ELIGIBILITY
==================================================

{compliance_reference_json}

==================================================
OFFICIAL PYTHON RANKING
==================================================

{ranking_reference_json}

==================================================
OFFICIAL RECOMMENDATION DECISION
==================================================

{recommendation_json}

==================================================
FULL EVALUATION RESULTS
==================================================

{vendor_results_json}

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

Do not use Markdown.
Do not use code fences.
Do not include text before or after JSON.

Use exactly this structure:

{{
  "comparisonSummary": "Overall evidence-based comparison",

  "tradeOffs": [
    "Important procurement trade-off"
  ],

  "finalRecommendation": "Advisory explanation based on the official Python decision",

  "rankingInsights": [
    {{
      "vendor": "Vendor name",
      "summary": "Short explanation of the vendor result",
      "keyStrengths": [
        "Evidence-based strength"
      ],
      "keyRisks": [
        "Evidence-based risk"
      ]
    }}
  ]
}}
"""

        # =================================================
        # LLM explanation
        # =================================================

        response_text = (
            self.llm.ask(
                prompt
            )
        )

        cleaned_response = (
            self._clean_json_response(
                response_text
            )
        )

        try:

            narrative = json.loads(
                cleaned_response
            )

        except json.JSONDecodeError as error:

            raise ValueError(
                "Ranking Agent returned invalid JSON.\n\n"
                f"Raw response:\n{response_text}"
            ) from error

        if not isinstance(
            narrative,
            dict,
        ):
            raise ValueError(
                "Ranking Agent result must be an object."
            )

        # =================================================
        # Never trust LLM for official ranking fields
        # =================================================

        result = {
            # ---------------------------------------------
            # Official Python decision
            # ---------------------------------------------

            "recommendationStatus": (
                recommendation[
                    "recommendationStatus"
                ]
            ),

            "topRankedVendor": (
                recommendation[
                    "topRankedVendor"
                ]
            ),

            "topRankedVendorScore": (
                recommendation[
                    "topRankedVendorScore"
                ]
            ),

            "recommendedVendor": (
                recommendation[
                    "recommendedVendor"
                ]
            ),

            "recommendedVendorScore": (
                recommendation[
                    "recommendedVendorScore"
                ]
            ),

            "ranking": (
                deterministic_ranking
            ),

            # ---------------------------------------------
            # LLM narrative only
            # ---------------------------------------------

            "comparisonSummary": str(
                narrative.get(
                    "comparisonSummary",
                    "",
                )
            ).strip(),

            "tradeOffs": (
                narrative.get(
                    "tradeOffs",
                    []
                )
                if isinstance(
                    narrative.get(
                        "tradeOffs",
                        []
                    ),
                    list,
                )
                else []
            ),

            "finalRecommendation": str(
                narrative.get(
                    "finalRecommendation",
                    "",
                )
            ).strip(),

            "rankingInsights": (
                narrative.get(
                    "rankingInsights",
                    []
                )
                if isinstance(
                    narrative.get(
                        "rankingInsights",
                        []
                    ),
                    list,
                )
                else []
            ),

            # ---------------------------------------------
            # Human control
            # ---------------------------------------------

            "humanReviewRequired": True,
        }

        return result

    # =====================================================
    # Cleanup
    # =====================================================

    def close(
        self,
    ):
        self.llm.close()