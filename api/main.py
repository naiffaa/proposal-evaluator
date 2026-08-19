import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Annotated
from uuid import uuid4

from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    HTTPException,
    UploadFile,
)
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
# JSON STORAGE
# =========================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)

DATA_DIR = (
    PROJECT_ROOT
    / "data"
)

EVALUATIONS_FILE = (
    DATA_DIR
    / "evaluations.json"
)

STORAGE_LOCK = Lock()


# =========================================================
# STORAGE HELPERS
# =========================================================

def ensure_storage():
    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    if not EVALUATIONS_FILE.exists():
        EVALUATIONS_FILE.write_text(
            "{}",
            encoding="utf-8",
        )


def load_evaluations():
    ensure_storage()

    try:
        content = (
            EVALUATIONS_FILE
            .read_text(
                encoding="utf-8",
            )
            .strip()
        )

        if not content:
            return {}

        data = json.loads(
            content
        )

        if not isinstance(
            data,
            dict,
        ):
            print(
                "Warning: evaluations.json "
                "does not contain a JSON object."
            )

            return {}

        return data

    except json.JSONDecodeError as error:
        print(
            "\n================================"
        )
        print(
            "EVALUATION STORAGE ERROR"
        )
        print(
            "================================"
        )
        print(
            "Could not parse evaluations.json"
        )
        print(
            str(error)
        )

        return {}

    except Exception as error:
        print(
            "\n================================"
        )
        print(
            "EVALUATION STORAGE ERROR"
        )
        print(
            "================================"
        )
        print(
            str(error)
        )

        return {}


def write_evaluations_to_disk():
    """
    Persist the current in-memory EVALUATIONS dictionary.

    Caller must hold STORAGE_LOCK.
    """

    ensure_storage()

    temp_file = (
        EVALUATIONS_FILE
        .with_suffix(
            ".json.tmp"
        )
    )

    temp_file.write_text(
        json.dumps(
            EVALUATIONS,
            indent=2,
            ensure_ascii=False,
            default=str,
        ),
        encoding="utf-8",
    )

    temp_file.replace(
        EVALUATIONS_FILE
    )


def save_evaluation(
    evaluation_id,
    stored_evaluation,
):
    """
    Store or update one evaluation safely.
    """

    with STORAGE_LOCK:
        EVALUATIONS[
            evaluation_id
        ] = stored_evaluation

        write_evaluations_to_disk()


def update_evaluation(
    evaluation_id,
    **updates,
):
    """
    Update fields on one stored evaluation.
    """

    with STORAGE_LOCK:
        current = (
            EVALUATIONS.get(
                evaluation_id
            )
        )

        if not current:
            return

        current.update(
            updates
        )

        EVALUATIONS[
            evaluation_id
        ] = current

        write_evaluations_to_disk()


# =========================================================
# LOAD STORED EVALUATIONS AT STARTUP
# =========================================================

EVALUATIONS = (
    load_evaluations()
)

print(
    "\n================================"
)

print(
    "EVALUATION STORAGE"
)

print(
    "================================"
)

print(
    f"Storage file: {EVALUATIONS_FILE}"
)

print(
    f"Loaded evaluations: {len(EVALUATIONS)}"
)


# =========================================================
# GENERAL HELPERS
# =========================================================

def generate_evaluation_id():
    short_id = (
        uuid4()
        .hex[:8]
        .upper()
    )

    return (
        f"EVAL-{short_id}"
    )


def utc_now_iso():
    return (
        datetime.now(
            timezone.utc
        ).isoformat()
    )


def get_stored_evaluation(
    evaluation_id,
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

    return stored_evaluation


def build_evaluation_summary(
    evaluation_id,
    stored_evaluation,
):
    result = (
        stored_evaluation.get(
            "result",
            {},
        )
        or {}
    )

    request_info = (
        stored_evaluation.get(
            "request",
            {},
        )
        or {}
    )

    rfp = (
        result.get(
            "rfp",
            {},
        )
        or {}
    )

    vendors = (
        result.get(
            "vendors",
            [],
        )
        or []
    )

    return {
        "id": evaluation_id,

        "rfpName": (
            rfp.get(
                "fileName"
            )
            or request_info.get(
                "rfpName"
            )
            or "RFP"
        ),

        "vendorCount": (
            len(vendors)
            if vendors
            else request_info.get(
                "vendorCount",
                0,
            )
        ),

        "status": (
            stored_evaluation.get(
                "status",
                "PROCESSING",
            )
        ),

        "topRankedVendor": (
            result.get(
                "topRankedVendor"
            )
        ),

        "recommendationStatus": (
            result.get(
                "recommendationStatus"
            )
        ),

        "createdDate": (
            stored_evaluation.get(
                "createdDate"
            )
        ),
    }


# =========================================================
# BACKGROUND EVALUATION WORKER
# =========================================================

def process_evaluation_background(
    evaluation_id: str,
    temp_directory: str,
    rfp_path_string: str,
    proposal_path_strings: list[str],
):
    """
    Run the real evaluation pipeline after the API has already
    returned the evaluation ID to the frontend.
    """

    service = None

    temp_path = Path(
        temp_directory
    )

    rfp_path = Path(
        rfp_path_string
    )

    proposal_paths = [
        Path(path)
        for path
        in proposal_path_strings
    ]

    try:
        print(
            "\n================================"
        )
        print(
            "BACKGROUND EVALUATION STARTED"
        )
        print(
            "================================"
        )
        print(
            f"ID: {evaluation_id}"
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
        # SAVE COMPLETED RESULT
        # =================================================

        update_evaluation(
            evaluation_id,
            status="COMPLETED",
            completedDate=utc_now_iso(),
            result=result,
            error=None,
        )

        print(
            "\n================================"
        )
        print(
            "EVALUATION COMPLETED"
        )
        print(
            "================================"
        )
        print(
            f"ID: {evaluation_id}"
        )
        print(
            f"File: {EVALUATIONS_FILE}"
        )

    except Exception as error:
        print(
            "\n================================"
        )
        print(
            "BACKGROUND EVALUATION ERROR"
        )
        print(
            "================================"
        )
        print(
            f"ID: {evaluation_id}"
        )
        print(
            str(error)
        )

        update_evaluation(
            evaluation_id,
            status="FAILED",
            completedDate=utc_now_iso(),
            error=str(error),
        )

    finally:
        if service is not None:
            try:
                service.close()
            except Exception:
                pass

        try:
            if temp_path.exists():
                shutil.rmtree(
                    temp_path,
                    ignore_errors=True,
                )
        except Exception as cleanup_error:
            print(
                "Temporary file cleanup error:"
            )
            print(
                str(cleanup_error)
            )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": (
            "KSF Proposal Evaluation API"
        ),
        "storedEvaluations": len(
            EVALUATIONS
        ),
    }


# =========================================================
# LIST EVALUATIONS
# =========================================================

@app.get("/api/evaluations")
def list_evaluations():
    summaries = []

    for (
        evaluation_id,
        stored_evaluation,
    ) in EVALUATIONS.items():
        summaries.append(
            build_evaluation_summary(
                evaluation_id,
                stored_evaluation,
            )
        )

    summaries.sort(
        key=lambda item: (
            item.get(
                "createdDate",
                "",
            )
        ),
        reverse=True,
    )

    return summaries


# =========================================================
# GET ONE EVALUATION
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}"
)
def get_evaluation(
    evaluation_id: str,
):
    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )

    return {
        "id": evaluation_id,

        "status": (
            stored_evaluation.get(
                "status",
                "PROCESSING",
            )
        ),

        "createdDate": (
            stored_evaluation.get(
                "createdDate"
            )
        ),

        "completedDate": (
            stored_evaluation.get(
                "completedDate"
            )
        ),

        "error": (
            stored_evaluation.get(
                "error"
            )
        ),

        "request": (
            stored_evaluation.get(
                "request",
                {},
            )
        ),

        "result": (
            stored_evaluation.get(
                "result",
                {},
            )
        ),
    }


# =========================================================
# GET EVALUATION STATUS
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/status"
)
def get_evaluation_status(
    evaluation_id: str,
):
    """
    Lightweight endpoint used by the Processing page.
    """

    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )

    return {
        "id": evaluation_id,

        "status": (
            stored_evaluation.get(
                "status",
                "PROCESSING",
            )
        ),

        "createdDate": (
            stored_evaluation.get(
                "createdDate"
            )
        ),

        "completedDate": (
            stored_evaluation.get(
                "completedDate"
            )
        ),

        "error": (
            stored_evaluation.get(
                "error"
            )
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
        get_stored_evaluation(
            evaluation_id
        )
    )

    result = (
        stored_evaluation.get(
            "result",
            {},
        )
        or {}
    )

    return (
        result.get(
            "rfp",
            {},
        )
        or {}
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
        get_stored_evaluation(
            evaluation_id
        )
    )

    result = (
        stored_evaluation.get(
            "result",
            {},
        )
        or {}
    )

    return (
        result.get(
            "vendors",
            [],
        )
        or []
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
        get_stored_evaluation(
            evaluation_id
        )
    )

    result = (
        stored_evaluation.get(
            "result",
            {},
        )
        or {}
    )

    return (
        result.get(
            "vendors",
            [],
        )
        or []
    )


# =========================================================
# START PROPOSAL EVALUATION
# =========================================================

@app.post(
    "/api/evaluations/run",
    status_code=202,
)
async def run_evaluation(
    background_tasks: BackgroundTasks,

    rfp: Annotated[
        UploadFile,
        File(
            description=(
                "RFP PDF document"
            )
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
    Start a proposal evaluation.

    This endpoint does NOT wait for the complete AI pipeline.

    Flow:
    1. Validate uploaded documents
    2. Save documents temporarily
    3. Create evaluation with PROCESSING status
    4. Return evaluation ID immediately
    5. Run the real evaluation pipeline in the background
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


    # =====================================================
    # CREATE EVALUATION
    # =====================================================

    evaluation_id = (
        generate_evaluation_id()
    )

    created_date = (
        utc_now_iso()
    )


    # =====================================================
    # CREATE PERSISTENT TEMP DIRECTORY
    # =====================================================
    #
    # We cannot use:
    #
    # with tempfile.TemporaryDirectory()
    #
    # because the HTTP request will end before the background
    # evaluation is finished.
    # =====================================================

    temp_directory = (
        tempfile.mkdtemp(
            prefix=(
                f"{evaluation_id}_"
            )
        )
    )

    temp_path = Path(
        temp_directory
    )


    try:
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


        rfp_directory = (
            temp_path
            / "rfp"
        )

        rfp_directory.mkdir(
            parents=True,
            exist_ok=True,
        )


        rfp_path = (
            rfp_directory
            / Path(
                rfp.filename
            ).name
        )


        rfp_path.write_bytes(
            rfp_content
        )


        # =================================================
        # SAVE PROPOSALS
        # =================================================

        proposal_paths = []


        for (
            index,
            proposal,
        ) in enumerate(
            proposals,
            start=1,
        ):
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


            # Each proposal gets its own directory.
            # This prevents duplicate file names from
            # overwriting one another while preserving the
            # original filename for vendor-name extraction.

            proposal_directory = (
                temp_path
                / "proposals"
                / str(index)
            )

            proposal_directory.mkdir(
                parents=True,
                exist_ok=True,
            )


            proposal_path = (
                proposal_directory
                / Path(
                    proposal.filename
                ).name
            )


            proposal_path.write_bytes(
                proposal_content
            )


            proposal_paths.append(
                proposal_path
            )


        # =================================================
        # STORE INITIAL PROCESSING RECORD
        # =================================================

        stored_evaluation = {
            "status": "PROCESSING",

            "createdDate": (
                created_date
            ),

            "completedDate": None,

            "error": None,

            "request": {
                "rfpName": (
                    rfp.filename
                ),

                "vendorCount": (
                    len(proposals)
                ),

                "proposalNames": [
                    proposal.filename
                    for proposal
                    in proposals
                ],
            },

            "result": {},
        }


        save_evaluation(
            evaluation_id,
            stored_evaluation,
        )


        # =================================================
        # START BACKGROUND PIPELINE
        # =================================================

        background_tasks.add_task(
            process_evaluation_background,
            evaluation_id,
            temp_directory,
            str(
                rfp_path
            ),
            [
                str(path)
                for path
                in proposal_paths
            ],
        )


        print(
            "\n================================"
        )

        print(
            "EVALUATION QUEUED"
        )

        print(
            "================================"
        )

        print(
            f"ID: {evaluation_id}"
        )

        print(
            "Status: PROCESSING"
        )


        # =================================================
        # RETURN IMMEDIATELY
        # =================================================

        return {
            "id": evaluation_id,
            "status": "PROCESSING",
        }


    except HTTPException:
        shutil.rmtree(
            temp_path,
            ignore_errors=True,
        )

        raise


    except Exception as error:
        shutil.rmtree(
            temp_path,
            ignore_errors=True,
        )

        print(
            "\n================================"
        )

        print(
            "EVALUATION START ERROR"
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