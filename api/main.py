import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.proposal_service import ProposalEvaluationService


app = FastAPI(
    title="KSF Proposal Evaluation API",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# TEMPORARY IN-MEMORY STORAGE
# =========================================================
#
# This is only for local development/testing.
#
# Restarting FastAPI will clear all stored evaluations.
#
# Later this can be replaced with OCI Database /
# Autonomous Database / another Oracle persistence layer.
# =========================================================

EVALUATIONS = {}


# =========================================================
# HELPERS
# =========================================================

def generate_evaluation_id():
    short_id = uuid4().hex[:8].upper()

    return f"EVAL-{short_id}"


def utc_now_iso():
    return datetime.now(
        timezone.utc
    ).isoformat()


def build_evaluation_summary(
    evaluation_id,
    stored_evaluation,
):
    result = stored_evaluation.get(
        "result",
        {},
    )

    rfp = result.get(
        "rfp",
        {},
    )

    vendors = result.get(
        "vendors",
        [],
    )

    return {
        "id": evaluation_id,

        "rfpName": rfp.get(
            "fileName",
            "RFP",
        ),

        "vendorCount": len(
            vendors
        ),

        "status": stored_evaluation.get(
            "status",
            "COMPLETED",
        ),

        "topRankedVendor": result.get(
            "topRankedVendor"
        ),

        "recommendationStatus": result.get(
            "recommendationStatus"
        ),

        "createdDate": stored_evaluation.get(
            "createdDate"
        ),
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "KSF Proposal Evaluation API",
    }


# =========================================================
# LIST EVALUATIONS
# =========================================================

@app.get("/api/evaluations")
def list_evaluations():

    summaries = []

    for evaluation_id, stored_evaluation in EVALUATIONS.items():

        summaries.append(
            build_evaluation_summary(
                evaluation_id,
                stored_evaluation,
            )
        )

    summaries.sort(
        key=lambda item: item.get(
            "createdDate",
            "",
        ),
        reverse=True,
    )

    return summaries


# =========================================================
# GET ONE EVALUATION
# =========================================================

@app.get("/api/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: str,
):

    stored_evaluation = (
        EVALUATIONS.get(
            evaluation_id
        )
    )

    if not stored_evaluation:

        raise HTTPException(
            status_code=404,
            detail="Evaluation not found.",
        )

    return {
        "id": evaluation_id,
        "status": stored_evaluation.get(
            "status",
            "COMPLETED",
        ),
        "createdDate": stored_evaluation.get(
            "createdDate",
        ),
        "result": stored_evaluation.get(
            "result",
            {},
        ),
    }


# =========================================================
# GET RFP FRAMEWORK
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/rfp"
)
def get_evaluation_rfp(
    evaluation_id: str,
):

    stored_evaluation = (
        EVALUATIONS.get(
            evaluation_id
        )
    )

    if not stored_evaluation:

        raise HTTPException(
            status_code=404,
            detail="Evaluation not found.",
        )

    result = stored_evaluation.get(
        "result",
        {},
    )

    return result.get(
        "rfp",
        {},
    )


# =========================================================
# GET VENDORS
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/vendors"
)
def get_evaluation_vendors(
    evaluation_id: str,
):

    stored_evaluation = (
        EVALUATIONS.get(
            evaluation_id
        )
    )

    if not stored_evaluation:

        raise HTTPException(
            status_code=404,
            detail="Evaluation not found.",
        )

    result = stored_evaluation.get(
        "result",
        {},
    )

    return result.get(
        "vendors",
        [],
    )


# =========================================================
# GET COMPARISON
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/comparison"
)
def get_evaluation_comparison(
    evaluation_id: str,
):

    stored_evaluation = (
        EVALUATIONS.get(
            evaluation_id
        )
    )

    if not stored_evaluation:

        raise HTTPException(
            status_code=404,
            detail="Evaluation not found.",
        )

    result = stored_evaluation.get(
        "result",
        {},
    )

    return result.get(
        "vendors",
        [],
    )


# =========================================================
# PROPOSAL EVALUATION
# =========================================================

@app.post("/api/evaluations/run")
async def run_evaluation(
    rfp: Annotated[
        UploadFile,
        File(
            description="RFP PDF document"
        ),
    ],

    proposals: Annotated[
        list[UploadFile],
        File(
            description=(
                "One or more vendor proposal PDFs"
            )
        ),
    ],
):
    """
    Run the complete proposal evaluation pipeline.

    Input:
    - One RFP PDF
    - One or more vendor proposal PDFs

    Output:
    - Evaluation ID
    - Evaluation status
    - Structured result
    """

    # =====================================================
    # VALIDATE RFP
    # =====================================================

    if not rfp.filename:

        raise HTTPException(
            status_code=400,
            detail="RFP file is required.",
        )

    if not rfp.filename.lower().endswith(
        ".pdf"
    ):

        raise HTTPException(
            status_code=400,
            detail="RFP must be a PDF file.",
        )

    # =====================================================
    # VALIDATE PROPOSALS
    # =====================================================

    if not proposals:

        raise HTTPException(
            status_code=400,
            detail=(
                "At least one vendor proposal "
                "is required."
            ),
        )

    for proposal in proposals:

        if not proposal.filename:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Vendor proposal file name "
                    "is missing."
                ),
            )

        if not proposal.filename.lower().endswith(
            ".pdf"
        ):

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Vendor proposal "
                    f"'{proposal.filename}' "
                    "must be a PDF file."
                ),
            )

    service = None

    evaluation_id = (
        generate_evaluation_id()
    )

    created_date = (
        utc_now_iso()
    )

    try:

        # =================================================
        # TEMP DIRECTORY
        # =================================================

        with tempfile.TemporaryDirectory() as temp_dir:

            temp_path = Path(
                temp_dir
            )

            # =================================================
            # SAVE RFP
            # =================================================

            rfp_content = (
                await rfp.read()
            )

            if not rfp_content:

                raise HTTPException(
                    status_code=400,
                    detail="RFP file is empty.",
                )

            rfp_path = (
                temp_path
                / Path(
                    rfp.filename
                ).name
            )

            with open(
                rfp_path,
                "wb",
            ) as file_handle:

                file_handle.write(
                    rfp_content
                )

            # =================================================
            # SAVE PROPOSALS
            # =================================================

            proposal_paths = []

            for proposal in proposals:

                proposal_content = (
                    await proposal.read()
                )

                if not proposal_content:

                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Vendor proposal "
                            f"'{proposal.filename}' "
                            "is empty."
                        ),
                    )

                proposal_path = (
                    temp_path
                    / Path(
                        proposal.filename
                    ).name
                )

                with open(
                    proposal_path,
                    "wb",
                ) as file_handle:

                    file_handle.write(
                        proposal_content
                    )

                proposal_paths.append(
                    proposal_path
                )

            # =================================================
            # INITIALIZE SERVICE
            # =================================================

            service = (
                ProposalEvaluationService()
            )

            # =================================================
            # RUN REAL PIPELINE
            # =================================================

            result = (
                service.evaluate(
                    rfp_path=rfp_path,
                    proposal_paths=proposal_paths,
                )
            )

            # =================================================
            # STORE RESULT
            # =================================================

            EVALUATIONS[
                evaluation_id
            ] = {
                "status": "COMPLETED",
                "createdDate": created_date,
                "result": result,
            }

            # =================================================
            # RETURN RESULT
            # =================================================

            return {
                "id": evaluation_id,
                "status": "completed",
                "result": result,
            }

    except HTTPException:

        raise

    except Exception as error:

        print(
            "\n================================"
        )

        print(
            "API EVALUATION ERROR"
        )

        print(
            "================================"
        )

        print(
            str(error)
        )

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )

    finally:

        if service is not None:

            try:

                service.close()

            except Exception:

                pass