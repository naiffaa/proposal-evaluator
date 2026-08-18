def calculate_weighted_score(
    evaluations,
    criteria,
):
    """
    Calculate the final weighted proposal score.

    The LLM never calculates the final weighted score.
    All arithmetic is performed deterministically in Python.

    Args:
        evaluations:
            List of evaluation result dictionaries.
            Each item should contain:
            - criterion
            - score
            - requirement_results

        criteria:
            List of RFP criteria.
            Each item must contain:
            - name
            - weight

    Returns:
        dict:
            {
                "criterion_scores": [...],
                "final_score": 0.0,
                "overall_mandatory_compliance": 0.0,
                "mandatory_summary": {...}
            }
    """

    # =====================================================
    # Basic validation
    # =====================================================

    if not isinstance(
        evaluations,
        list,
    ):
        raise ValueError(
            "evaluations must be a list."
        )

    if not isinstance(
        criteria,
        list,
    ):
        raise ValueError(
            "criteria must be a list."
        )

    if not criteria:
        raise ValueError(
            "criteria cannot be empty."
        )

    # =====================================================
    # Validate criteria and weights
    # =====================================================

    weights = {}

    total_weight = 0.0

    for criterion in criteria:

        if not isinstance(
            criterion,
            dict,
        ):
            raise ValueError(
                "Each criterion must be an object."
            )

        name = str(
            criterion.get(
                "name",
                "",
            )
        ).strip()

        if not name:
            raise ValueError(
                "Criterion name cannot be empty."
            )

        if name in weights:
            raise ValueError(
                f"Duplicate criterion found: {name}"
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
                f"Invalid weight for criterion: {name}"
            ) from error

        if weight < 0:
            raise ValueError(
                f"Weight cannot be negative: {name}"
            )

        if weight > 100:
            raise ValueError(
                f"Weight cannot exceed 100: {name}"
            )

        weights[name] = weight

        total_weight += weight

    total_weight = round(
        total_weight,
        6,
    )

    if abs(
        total_weight - 100.0
    ) > 0.01:
        raise ValueError(
            f"RFP criterion weights total "
            f"{round(total_weight, 2)}, not 100."
        )

    # =====================================================
    # Map evaluations by criterion
    # =====================================================

    evaluation_map = {}

    for evaluation in evaluations:

        if not isinstance(
            evaluation,
            dict,
        ):
            raise ValueError(
                "Each evaluation must be an object."
            )

        criterion_name = str(
            evaluation.get(
                "criterion",
                "",
            )
        ).strip()

        if not criterion_name:
            raise ValueError(
                "Evaluation is missing criterion name."
            )

        if criterion_name in evaluation_map:
            raise ValueError(
                f"Duplicate evaluation found for "
                f"criterion: {criterion_name}"
            )

        if criterion_name not in weights:
            raise ValueError(
                f"Evaluation criterion "
                f"'{criterion_name}' does not exist "
                "in the RFP criteria."
            )

        evaluation_map[
            criterion_name
        ] = evaluation

    # =====================================================
    # Ensure every RFP criterion was evaluated
    # =====================================================

    for criterion_name in weights:

        if criterion_name not in evaluation_map:
            raise ValueError(
                f"No evaluation result found for "
                f"criterion: {criterion_name}"
            )

    # =====================================================
    # Calculate weighted scores
    # =====================================================

    criterion_scores = []

    final_score = 0.0

    # =====================================================
    # Mandatory requirement tracking
    # =====================================================

    total_mandatory_requirements = 0
    fully_met_mandatory_requirements = 0
    partially_met_mandatory_requirements = 0
    failed_mandatory_requirements = 0
    not_provided_mandatory_requirements = 0

    mandatory_results = []

    # =====================================================
    # Process criteria
    # =====================================================

    for criterion in criteria:

        name = str(
            criterion["name"]
        ).strip()

        weight = float(
            criterion["weight"]
        )

        evaluation = (
            evaluation_map[
                name
            ]
        )

        # =================================================
        # Criterion score
        # =================================================

        try:
            score = float(
                evaluation.get(
                    "score",
                    0,
                )
            )

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                f"Invalid score for criterion: {name}"
            ) from error

        score = max(
            0.0,
            min(
                100.0,
                score,
            ),
        )

        weighted_score = (
            score
            * (
                weight / 100.0
            )
        )

        weighted_score = round(
            weighted_score,
            2,
        )

        final_score += weighted_score

        # =================================================
        # Requirement results
        # =================================================

        requirement_results = (
            evaluation.get(
                "requirement_results",
                [],
            )
        )

        if not isinstance(
            requirement_results,
            list,
        ):
            raise ValueError(
                f"requirement_results must be a list "
                f"for criterion: {name}"
            )

        criterion_mandatory_total = 0
        criterion_mandatory_full = 0
        criterion_mandatory_partial = 0
        criterion_mandatory_failed = 0
        criterion_mandatory_not_provided = 0

        # =================================================
        # Evaluate mandatory requirements directly
        # =================================================

        for requirement in requirement_results:

            if not isinstance(
                requirement,
                dict,
            ):
                raise ValueError(
                    f"Invalid requirement result "
                    f"in criterion: {name}"
                )

            mandatory = requirement.get(
                "mandatory",
                False,
            )

            if isinstance(
                mandatory,
                str,
            ):
                mandatory = (
                    mandatory.strip().lower()
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

            total_mandatory_requirements += 1
            criterion_mandatory_total += 1

            requirement_id = str(
                requirement.get(
                    "requirement_id",
                    "",
                )
            ).strip()

            status = str(
                requirement.get(
                    "status",
                    "",
                )
            ).strip().upper()

            if status == "FULL_MATCH":

                fully_met_mandatory_requirements += 1
                criterion_mandatory_full += 1

            elif status == "PARTIAL_MATCH":

                partially_met_mandatory_requirements += 1
                criterion_mandatory_partial += 1

            elif status == "NOT_PROVIDED":

                not_provided_mandatory_requirements += 1
                criterion_mandatory_not_provided += 1

            elif status == "NO_MATCH":

                failed_mandatory_requirements += 1
                criterion_mandatory_failed += 1

            else:
                raise ValueError(
                    f"Invalid mandatory requirement status "
                    f"'{status}' for "
                    f"{requirement_id or 'unknown requirement'} "
                    f"in criterion: {name}"
                )

            mandatory_results.append(
                {
                    "criterion": name,
                    "requirement_id": requirement_id,
                    "status": status,
                }
            )

        # =================================================
        # Criterion mandatory compliance
        # =================================================

        if criterion_mandatory_total > 0:

            criterion_mandatory_compliance = (
                criterion_mandatory_full
                / criterion_mandatory_total
            ) * 100

            criterion_mandatory_compliance = round(
                criterion_mandatory_compliance,
                2,
            )

        else:
            criterion_mandatory_compliance = None

        criterion_scores.append(
            {
                "criterion": name,
                "score": round(
                    score,
                    2,
                ),
                "weight": round(
                    weight,
                    2,
                ),
                "weighted_score": (
                    weighted_score
                ),
                "mandatory_requirements": (
                    criterion_mandatory_total
                ),
                "mandatory_full_matches": (
                    criterion_mandatory_full
                ),
                "mandatory_partial_matches": (
                    criterion_mandatory_partial
                ),
                "mandatory_no_matches": (
                    criterion_mandatory_failed
                ),
                "mandatory_not_provided": (
                    criterion_mandatory_not_provided
                ),
                "mandatory_compliance_percentage": (
                    criterion_mandatory_compliance
                ),
            }
        )

    # =====================================================
    # Final weighted score
    # =====================================================

    final_score = round(
        final_score,
        2,
    )

    final_score = max(
        0.0,
        min(
            100.0,
            final_score,
        ),
    )

    # =====================================================
    # Overall mandatory compliance
    # =====================================================
    #
    # IMPORTANT:
    #
    # This is calculated from mandatory requirements
    # themselves.
    #
    # FULL_MATCH counts as compliant.
    #
    # PARTIAL_MATCH, NO_MATCH, and NOT_PROVIDED
    # do NOT count as fully compliant.
    #
    # Criteria with zero mandatory requirements are
    # excluded completely.
    # =====================================================

    if total_mandatory_requirements > 0:

        overall_mandatory_compliance = (
            fully_met_mandatory_requirements
            / total_mandatory_requirements
        ) * 100

        overall_mandatory_compliance = round(
            overall_mandatory_compliance,
            2,
        )

    else:
        overall_mandatory_compliance = None

    # =====================================================
    # Mandatory summary
    # =====================================================

    mandatory_summary = {
        "total_mandatory_requirements": (
            total_mandatory_requirements
        ),
        "fully_met": (
            fully_met_mandatory_requirements
        ),
        "partially_met": (
            partially_met_mandatory_requirements
        ),
        "no_match": (
            failed_mandatory_requirements
        ),
        "not_provided": (
            not_provided_mandatory_requirements
        ),
    }

    # =====================================================
    # Final result
    # =====================================================

    return {
        "criterion_scores": (
            criterion_scores
        ),
        "final_score": (
            final_score
        ),
        "overall_mandatory_compliance": (
            overall_mandatory_compliance
        ),
        "mandatory_summary": (
            mandatory_summary
        ),
        "mandatory_results": (
            mandatory_results
        ),
    }