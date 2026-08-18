import tempfile
from pathlib import Path

import streamlit as st

from services.proposal_service import ProposalEvaluationService


# =========================================================
# PAGE CONFIG
# =========================================================

st.set_page_config(
    page_title="AI Proposal Evaluator",
    page_icon="📑",
    layout="wide",
    initial_sidebar_state="collapsed",
)


# =========================================================
# CUSTOM CSS
# =========================================================

st.markdown(
    """
    <style>

    .block-container {
        max-width: 1400px;
        padding-top: 2rem;
        padding-bottom: 4rem;
    }

    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        margin-bottom: 0.2rem;
    }

    .subtitle {
        color: #6b7280;
        font-size: 1rem;
        margin-bottom: 2rem;
    }

    .section-note {
        color: #6b7280;
        font-size: 0.9rem;
    }

    </style>
    """,
    unsafe_allow_html=True,
)


# =========================================================
# SESSION STATE
# =========================================================

if "evaluation_result" not in st.session_state:
    st.session_state.evaluation_result = None

if "evaluation_error" not in st.session_state:
    st.session_state.evaluation_error = None


# =========================================================
# HELPERS
# =========================================================

def format_score(value):
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return "N/A"


def format_percentage(value):
    if value is None:
        return "N/A"

    try:
        return f"{float(value):.2f}%"
    except (TypeError, ValueError):
        return "N/A"


def get_status_icon(status):
    icons = {
        "FULL_MATCH": "✅",
        "PARTIAL_MATCH": "🟡",
        "NO_MATCH": "❌",
        "NOT_PROVIDED": "⚪",
    }

    return icons.get(
        str(status).upper(),
        "•",
    )


def get_rank_icon(rank):
    if rank == 1:
        return "🥇"

    if rank == 2:
        return "🥈"

    if rank == 3:
        return "🥉"

    return "🔹"


def show_string_list(
    title,
    items,
    icon="•",
):
    if not items:
        return

    st.markdown(
        f"**{title}**"
    )

    for item in items:
        st.write(
            f"{icon} {item}"
        )


def show_requirement_results(
    requirement_results,
):
    if not requirement_results:
        st.info(
            "No requirement-level results available."
        )
        return

    st.markdown(
        "**Requirement-by-Requirement Evaluation**"
    )

    for requirement in requirement_results:

        requirement_id = requirement.get(
            "requirement_id",
            "N/A",
        )

        requirement_text = requirement.get(
            "requirement",
            "Requirement",
        )

        status = requirement.get(
            "status",
            "UNKNOWN",
        )

        match_score = requirement.get(
            "match_score",
            0,
        )

        mandatory = requirement.get(
            "mandatory",
            False,
        )

        evidence = requirement.get(
            "proposal_evidence",
            "Not Provided",
        )

        rationale = requirement.get(
            "rationale",
            "",
        )

        source = requirement.get(
            "rfp_source",
            "",
        )

        status_icon = get_status_icon(
            status
        )

        with st.container(
            border=True
        ):

            header_col1, header_col2 = st.columns(
                [5, 1]
            )

            with header_col1:

                st.markdown(
                    f"**{status_icon} "
                    f"{requirement_id} — "
                    f"{requirement_text}**"
                )

            with header_col2:

                st.metric(
                    "Match",
                    f"{format_score(match_score)}%",
                )

            detail_col1, detail_col2 = st.columns(
                2
            )

            with detail_col1:

                st.write(
                    f"**Status:** {status}"
                )

                st.write(
                    "**Mandatory:** "
                    + (
                        "Yes"
                        if mandatory
                        else "No"
                    )
                )

            with detail_col2:

                if source:

                    st.write(
                        f"**RFP Source:** {source}"
                    )

            st.markdown(
                "**Proposal Evidence**"
            )

            st.write(
                evidence
            )

            if rationale:

                st.markdown(
                    "**Rationale**"
                )

                st.write(
                    rationale
                )


def show_criterion_evaluation(
    evaluation,
    criterion_score_data=None,
):
    criterion_name = evaluation.get(
        "criterion",
        "Unnamed Criterion",
    )

    score = evaluation.get(
        "score",
        0,
    )

    mandatory_compliance = evaluation.get(
        "mandatory_compliance_percentage"
    )

    confidence = evaluation.get(
        "confidence",
        "N/A",
    )

    st.markdown(
        f"### {criterion_name}"
    )

    metric_col1, metric_col2, metric_col3, metric_col4 = (
        st.columns(4)
    )

    with metric_col1:

        st.metric(
            "Criterion Score",
            f"{format_score(score)}%",
        )

    with metric_col2:

        if criterion_score_data:

            weight = criterion_score_data.get(
                "weight"
            )

            st.metric(
                "Weight",
                (
                    f"{format_score(weight)}%"
                    if weight is not None
                    else "N/A"
                ),
            )

        else:

            st.metric(
                "Weight",
                "N/A",
            )

    with metric_col3:

        if criterion_score_data:

            weighted_score = (
                criterion_score_data.get(
                    "weighted_score"
                )
            )

            st.metric(
                "Weighted Score",
                format_score(
                    weighted_score
                ),
            )

        else:

            st.metric(
                "Weighted Score",
                "N/A",
            )

    with metric_col4:

        st.metric(
            "Mandatory Compliance",
            format_percentage(
                mandatory_compliance
            ),
        )

    if confidence != "N/A":

        st.caption(
            f"Evidence confidence: {confidence}"
        )

    rationale = evaluation.get(
        "rationale",
        "",
    )

    if rationale:

        st.markdown(
            "**Overall Rationale**"
        )

        st.write(
            rationale
        )

    show_string_list(
        "Strengths",
        evaluation.get(
            "strengths",
            [],
        ),
        "✅",
    )

    show_string_list(
        "Gaps",
        evaluation.get(
            "gaps",
            [],
        ),
        "⚠️",
    )

    show_requirement_results(
        evaluation.get(
            "requirement_results",
            [],
        )
    )


# =========================================================
# HEADER
# =========================================================

st.markdown(
    '<div class="main-title">'
    'AI Proposal Evaluation Assistant'
    '</div>',
    unsafe_allow_html=True,
)

st.markdown(
    '<div class="subtitle">'
    'Oracle OCI Document Understanding + '
    'OCI Generative AI + Deterministic Python Scoring'
    '</div>',
    unsafe_allow_html=True,
)

st.divider()


# =========================================================
# UPLOAD SECTION
# =========================================================

st.header(
    "Upload Documents"
)

upload_col1, upload_col2 = st.columns(
    2
)


with upload_col1:

    st.subheader(
        "1. RFP Document"
    )

    rfp_file = st.file_uploader(
        "Upload the RFP document",
        type=[
            "pdf",
        ],
        accept_multiple_files=False,
        key="rfp_upload",
    )

    if rfp_file is not None:

        st.success(
            f"Selected: {rfp_file.name}"
        )


with upload_col2:

    st.subheader(
        "2. Vendor Proposals"
    )

    proposal_files = st.file_uploader(
        "Upload one or more vendor proposals",
        type=[
            "pdf",
        ],
        accept_multiple_files=True,
        key="proposal_upload",
    )

    if proposal_files:

        st.success(
            f"{len(proposal_files)} proposal(s) selected"
        )

        for proposal_file in proposal_files:

            st.write(
                f"• {proposal_file.name}"
            )


# =========================================================
# EVALUATION BUTTON
# =========================================================

st.divider()


can_evaluate = (
    rfp_file is not None
    and proposal_files
    and len(proposal_files) > 0
)


evaluate_button = st.button(
    "Evaluate Proposals",
    type="primary",
    disabled=not can_evaluate,
    use_container_width=True,
)


# =========================================================
# RUN EVALUATION
# =========================================================

if evaluate_button:

    st.session_state.evaluation_result = None
    st.session_state.evaluation_error = None

    service = None

    status = st.status(
        "Starting proposal evaluation...",
        expanded=True,
    )

    try:

        with tempfile.TemporaryDirectory() as temp_dir:

            temp_dir = Path(
                temp_dir
            )

            # =============================================
            # SAVE RFP
            # =============================================

            status.write(
                "Preparing RFP document..."
            )

            rfp_path = (
                temp_dir
                / rfp_file.name
            )

            with open(
                rfp_path,
                "wb",
            ) as file_handle:

                file_handle.write(
                    rfp_file.getbuffer()
                )

            # =============================================
            # SAVE PROPOSALS
            # =============================================

            status.write(
                "Preparing vendor proposals..."
            )

            proposal_paths = []

            for uploaded_file in proposal_files:

                proposal_path = (
                    temp_dir
                    / uploaded_file.name
                )

                with open(
                    proposal_path,
                    "wb",
                ) as file_handle:

                    file_handle.write(
                        uploaded_file.getbuffer()
                    )

                proposal_paths.append(
                    proposal_path
                )

            # =============================================
            # INITIALIZE SERVICE
            # =============================================

            status.write(
                "Connecting to Oracle OCI services..."
            )

            service = (
                ProposalEvaluationService()
            )

            # =============================================
            # RUN PIPELINE
            # =============================================

            status.write(
                "Extracting document content with "
                "OCI Document Understanding..."
            )

            status.write(
                "Analyzing RFP evaluation framework..."
            )

            status.write(
                "Evaluating vendor proposals with "
                "OCI Generative AI agents..."
            )

            status.write(
                "Calculating deterministic scores..."
            )

            result = (
                service.evaluate(
                    rfp_path=rfp_path,
                    proposal_paths=proposal_paths,
                )
            )

            st.session_state.evaluation_result = (
                result
            )

            status.update(
                label=(
                    "Evaluation completed successfully"
                ),
                state="complete",
                expanded=False,
            )

    except Exception as error:

        st.session_state.evaluation_error = (
            str(error)
        )

        status.update(
            label="Evaluation failed",
            state="error",
            expanded=True,
        )

        st.error(
            "Proposal evaluation failed."
        )

        st.exception(
            error
        )

    finally:

        if service is not None:

            try:
                service.close()

            except Exception:
                pass


# =========================================================
# DISPLAY RESULT
# =========================================================

result = (
    st.session_state.evaluation_result
)


if result:

    vendors = result.get(
        "vendors",
        [],
    )

    ranking = result.get(
        "ranking",
        {},
    )

    rfp_data = result.get(
        "rfp",
        {},
    )

    criteria = rfp_data.get(
        "criteria",
        [],
    )

    top_ranked_vendor = result.get(
        "topRankedVendor"
    )

    top_ranked_vendor_score = result.get(
        "topRankedVendorScore"
    )

    recommended_vendor = result.get(
        "recommendedVendor"
    )

    recommended_vendor_score = result.get(
        "recommendedVendorScore"
    )

    recommendation_status = result.get(
        "recommendationStatus",
        "UNKNOWN",
    )

    human_review_required = result.get(
        "humanReviewRequired",
        True,
    )

    # =====================================================
    # SUCCESS
    # =====================================================

    st.success(
        "Proposal evaluation completed."
    )

    # =====================================================
    # SUMMARY
    # =====================================================

    st.header(
        "Evaluation Summary"
    )

    summary_col1, summary_col2, summary_col3, summary_col4 = (
        st.columns(4)
    )

    with summary_col1:

        st.metric(
            "Proposals Evaluated",
            len(vendors),
        )

    with summary_col2:

        st.metric(
            "Top Ranked Vendor",
            (
                top_ranked_vendor
                if top_ranked_vendor
                else "Not available"
            ),
        )

    with summary_col3:

        st.metric(
            "Top Score",
            (
                f"{format_score(top_ranked_vendor_score)}%"
                if top_ranked_vendor_score is not None
                else "N/A"
            ),
        )

    with summary_col4:

        total_criteria = rfp_data.get(
            "totalCriteria",
            len(criteria),
        )

        st.metric(
            "Evaluation Criteria",
            total_criteria,
        )

    # =====================================================
    # RECOMMENDATION STATUS
    # =====================================================

    st.subheader(
        "Recommendation"
    )

    recommendation_col1, recommendation_col2 = (
        st.columns(2)
    )

    with recommendation_col1:

        if recommended_vendor:

            st.metric(
                "Recommended Vendor",
                recommended_vendor,
            )

            if recommended_vendor_score is not None:

                st.caption(
                    "Recommended vendor score: "
                    f"{format_score(recommended_vendor_score)}%"
                )

        else:

            st.metric(
                "Recommended Vendor",
                "No eligible vendor",
            )

    with recommendation_col2:

        if (
            recommendation_status
            == "RECOMMENDED_FOR_REVIEW"
        ):

            st.success(
                "Eligible vendor identified for review."
            )

        elif (
            recommendation_status
            == "NO_ELIGIBLE_VENDOR"
        ):

            st.warning(
                "No vendor currently satisfies the "
                "eligibility requirements for recommendation."
            )

        elif (
            recommendation_status
            == "NO_VENDOR_RESULTS"
        ):

            st.warning(
                "No vendor results are available."
            )

        else:

            st.info(
                f"Recommendation status: "
                f"{recommendation_status}"
            )

    if human_review_required:

        st.caption(
            "Human review is required before any procurement decision."
        )

    # =====================================================
    # RANKING AGENT SUMMARY
    # =====================================================

    if isinstance(
        ranking,
        dict,
    ):

        final_recommendation = (
            ranking.get(
                "finalRecommendation"
            )
            or ranking.get(
                "final_recommendation"
            )
            or ranking.get(
                "rationale"
            )
        )

        if final_recommendation:

            st.info(
                final_recommendation
            )

    st.divider()

    # =====================================================
    # VENDOR RANKING
    # =====================================================

    st.header(
        "Vendor Ranking"
    )

    st.caption(
        "Ranking is based on the deterministic weighted score. "
        "A top-ranked vendor is not automatically eligible "
        "for recommendation."
    )

    if not vendors:

        st.warning(
            "No vendor evaluation results returned."
        )

    for vendor in vendors:

        vendor_name = vendor.get(
            "vendor",
            "Vendor",
        )

        rank = vendor.get(
            "rank",
            0,
        )

        overall_score = vendor.get(
            "overallScore",
            0,
        )

        mandatory_compliance = vendor.get(
            "overallMandatoryCompliance"
        )

        risk_level = vendor.get(
            "riskLevel",
            "Unknown",
        )

        compliant = vendor.get(
            "compliant"
        )

        rank_icon = get_rank_icon(
            rank
        )

        # =================================================
        # VENDOR HEADER
        # =================================================

        st.markdown(
            f"## {rank_icon} #{rank} — {vendor_name}"
        )

        metric_col1, metric_col2, metric_col3, metric_col4 = (
            st.columns(4)
        )

        with metric_col1:

            st.metric(
                "Final Weighted Score",
                f"{format_score(overall_score)}%",
            )

        with metric_col2:

            st.metric(
                "Mandatory Compliance",
                format_percentage(
                    mandatory_compliance
                ),
            )

        with metric_col3:

            st.metric(
                "Risk Level",
                risk_level,
            )

        with metric_col4:

            if compliant is True:

                st.metric(
                    "Eligibility",
                    "Eligible",
                )

            elif compliant is False:

                st.metric(
                    "Eligibility",
                    "Not Eligible",
                )

            else:

                st.metric(
                    "Eligibility",
                    "Not Determined",
                )

        if compliant is True:

            st.success(
                "This vendor is compliant and may be considered "
                "for recommendation."
            )

        elif compliant is False:

            st.warning(
                "This vendor is ranked by score but is not currently "
                "eligible for recommendation due to compliance issues."
            )

        # =================================================
        # SCORING BREAKDOWN
        # =================================================

        scoring = vendor.get(
            "scoring",
            {},
        )

        criterion_scores = scoring.get(
            "criterion_scores",
            [],
        )

        score_map = {
            item.get(
                "criterion"
            ): item
            for item in criterion_scores
        }

        with st.expander(
            "Score Breakdown",
            expanded=True,
        ):

            if criterion_scores:

                for criterion_score in criterion_scores:

                    criterion_name = (
                        criterion_score.get(
                            "criterion",
                            "Criterion",
                        )
                    )

                    score = criterion_score.get(
                        "score",
                        0,
                    )

                    weight = criterion_score.get(
                        "weight",
                        0,
                    )

                    weighted_score = (
                        criterion_score.get(
                            "weighted_score",
                            0,
                        )
                    )

                    criterion_mandatory = (
                        criterion_score.get(
                            "mandatory_compliance_percentage"
                        )
                    )

                    score_col1, score_col2, score_col3, score_col4 = (
                        st.columns(4)
                    )

                    with score_col1:

                        st.write(
                            f"**{criterion_name}**"
                        )

                    with score_col2:

                        st.write(
                            f"Score: "
                            f"{format_score(score)}%"
                        )

                    with score_col3:

                        st.write(
                            f"Weight: "
                            f"{format_score(weight)}%"
                        )

                    with score_col4:

                        st.write(
                            f"Contribution: "
                            f"{format_score(weighted_score)}"
                        )

                    if criterion_mandatory is not None:

                        st.caption(
                            "Mandatory compliance: "
                            + format_percentage(
                                criterion_mandatory
                            )
                        )

                    st.progress(
                        max(
                            0.0,
                            min(
                                1.0,
                                float(score) / 100.0,
                            ),
                        )
                    )

            else:

                st.info(
                    "No criterion scoring details available."
                )

        # =================================================
        # DYNAMIC CRITERION RESULTS
        # =================================================

        evaluations = vendor.get(
            "evaluations",
            [],
        )

        for evaluation in evaluations:

            criterion_name = evaluation.get(
                "criterion",
                "Criterion",
            )

            criterion_score_data = (
                score_map.get(
                    criterion_name
                )
            )

            with st.expander(
                f"{criterion_name} — "
                f"{format_score(evaluation.get('score', 0))}%",
                expanded=False,
            ):

                show_criterion_evaluation(
                    evaluation,
                    criterion_score_data,
                )

        # =================================================
        # MANDATORY SUMMARY
        # =================================================

        mandatory_summary = vendor.get(
            "mandatorySummary",
            {},
        )

        with st.expander(
            "Mandatory Requirements Summary"
        ):

            mandatory_col1, mandatory_col2, mandatory_col3, mandatory_col4 = (
                st.columns(4)
            )

            with mandatory_col1:

                st.metric(
                    "Mandatory Requirements",
                    mandatory_summary.get(
                        "total_mandatory_requirements",
                        0,
                    ),
                )

            with mandatory_col2:

                st.metric(
                    "Fully Met",
                    mandatory_summary.get(
                        "fully_met",
                        0,
                    ),
                )

            with mandatory_col3:

                st.metric(
                    "Partially Met",
                    mandatory_summary.get(
                        "partially_met",
                        0,
                    ),
                )

            with mandatory_col4:

                missing_count = (
                    mandatory_summary.get(
                        "no_match",
                        0,
                    )
                    + mandatory_summary.get(
                        "not_provided",
                        0,
                    )
                )

                st.metric(
                    "Missing / Failed",
                    missing_count,
                )

        # =================================================
        # COMPLIANCE / RISK
        # =================================================

        with st.expander(
            "Compliance & Risk"
        ):

            compliance_col1, compliance_col2 = (
                st.columns(2)
            )

            with compliance_col1:

                if compliant is True:

                    st.success(
                        "Compliant"
                    )

                elif compliant is False:

                    st.error(
                        "Compliance issues detected"
                    )

                else:

                    st.info(
                        "Compliance status not determined"
                    )

            with compliance_col2:

                st.metric(
                    "Risk Level",
                    risk_level,
                )

            compliance_rationale = vendor.get(
                "complianceRationale",
                "",
            )

            if compliance_rationale:

                st.markdown(
                    "**Compliance Assessment**"
                )

                st.write(
                    compliance_rationale
                )

            missing_requirements = vendor.get(
                "missingRequirements",
                [],
            )

            if missing_requirements:

                st.markdown(
                    "**Missing Mandatory Requirements**"
                )

                for requirement in missing_requirements:

                    if isinstance(
                        requirement,
                        dict,
                    ):

                        requirement_text = (
                            requirement.get(
                                "requirement"
                            )
                            or requirement.get(
                                "text"
                            )
                            or str(
                                requirement
                            )
                        )

                    else:

                        requirement_text = str(
                            requirement
                        )

                    st.write(
                        f"❌ {requirement_text}"
                    )

        st.divider()

    # =====================================================
    # RFP FRAMEWORK
    # =====================================================

    st.header(
        "RFP Evaluation Framework"
    )

    rfp_analysis = rfp_data.get(
        "analysis",
        {},
    )

    metadata = rfp_analysis.get(
        "metadata",
        {},
    )

    if metadata:

        meta_col1, meta_col2, meta_col3, meta_col4 = (
            st.columns(4)
        )

        with meta_col1:

            st.metric(
                "Criteria",
                metadata.get(
                    "criteria_count",
                    len(criteria),
                ),
            )

        with meta_col2:

            st.metric(
                "Requirements",
                metadata.get(
                    "requirement_count",
                    "N/A",
                ),
            )

        with meta_col3:

            st.metric(
                "Mandatory",
                metadata.get(
                    "mandatory_requirement_count",
                    "N/A",
                ),
            )

        with meta_col4:

            st.metric(
                "Total Weight",
                (
                    f"{metadata.get('total_weight', 100)}%"
                ),
            )

    for criterion in criteria:

        criterion_name = criterion.get(
            "name",
            "Unnamed Criterion",
        )

        weight = criterion.get(
            "weight",
            0,
        )

        description = criterion.get(
            "description",
            "",
        )

        requirements = criterion.get(
            "requirements",
            [],
        )

        with st.expander(
            f"{criterion_name} — "
            f"{format_score(weight)}%"
        ):

            if description:

                st.write(
                    description
                )

            st.markdown(
                f"**Requirements: {len(requirements)}**"
            )

            for requirement in requirements:

                if isinstance(
                    requirement,
                    dict,
                ):

                    requirement_id = (
                        requirement.get(
                            "id",
                            "",
                        )
                    )

                    requirement_text = (
                        requirement.get(
                            "requirement",
                            "",
                        )
                    )

                    mandatory = (
                        requirement.get(
                            "mandatory",
                            False,
                        )
                    )

                    source = requirement.get(
                        "source",
                        "",
                    )

                    with st.container(
                        border=True
                    ):

                        st.markdown(
                            f"**{requirement_id} — "
                            f"{requirement_text}**"
                        )

                        st.write(
                            "**Mandatory:** "
                            + (
                                "Yes"
                                if mandatory
                                else "No"
                            )
                        )

                        if source:

                            st.caption(
                                f"Source: {source}"
                            )

                else:

                    st.write(
                        f"• {requirement}"
                    )

    # =====================================================
    # RAW JSON
    # =====================================================

    with st.expander(
        "Raw Evaluation Result"
    ):

        st.json(
            result
        )