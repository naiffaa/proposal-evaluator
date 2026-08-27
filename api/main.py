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

from fastapi.middleware.cors import (
    CORSMiddleware,
)

from fastapi.responses import (
    FileResponse,
)

from services.proposal_service import (
    ProposalEvaluationService,
)


# =========================================================
# APP
# =========================================================

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

    allow_methods=[
        "*",
    ],

    allow_headers=[
        "*",
    ],
)


# =========================================================
# STORAGE PATHS
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


DOCUMENTS_DIR = (
    DATA_DIR
    / "documents"
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


    DOCUMENTS_DIR.mkdir(
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
    f"Documents directory: {DOCUMENTS_DIR}"
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


def get_persistent_evaluation_directory(
    evaluation_id: str,
):
    return (
        DOCUMENTS_DIR
        / evaluation_id
    )


def get_persistent_rfp_path(
    evaluation_id: str,
    file_name: str,
):
    return (
        get_persistent_evaluation_directory(
            evaluation_id
        )
        / "rfp"
        / Path(
            file_name
        ).name
    )


def get_persistent_proposal_path(
    evaluation_id: str,
    index: int,
    file_name: str,
):
    return (
        get_persistent_evaluation_directory(
            evaluation_id
        )
        / "proposals"
        / str(
            index
        )
        / Path(
            file_name
        ).name
    )


def normalize_document_name(
    value: str | None,
):
    """
    Normalize names so the evaluated vendor name can be
    matched with the original uploaded proposal filename.
    """

    if not value:
        return ""


    text = (
        Path(
            str(
                value
            )
        )
        .stem
        .lower()
    )


    for character in [
        "_",
        "-",
        ".",
        "(",
        ")",
        "[",
        "]",
    ]:
        text = (
            text.replace(
                character,
                " ",
            )
        )


    return (
        " ".join(
            text.split()
        )
    )


def find_top_proposal_document(
    evaluation_id: str,
    stored_evaluation: dict,
):
    """
    Find the original uploaded proposal associated with
    the highest-ranked vendor.
    """

    request_info = (
        stored_evaluation.get(
            "request",
            {},
        )
        or {}
    )


    result = (
        stored_evaluation.get(
            "result",
            {},
        )
        or {}
    )


    proposal_documents = (
        request_info.get(
            "proposalDocuments",
            [],
        )
        or []
    )


    # -----------------------------------------------------
    # Backward compatibility
    # -----------------------------------------------------

    if not proposal_documents:
        proposal_names = (
            request_info.get(
                "proposalNames",
                [],
            )
            or []
        )


        proposal_documents = [
            {
                "index": index,
                "fileName": file_name,
            }

            for (
                index,
                file_name,
            )

            in enumerate(
                proposal_names,
                start=1,
            )
        ]


    if not proposal_documents:
        return None


    top_vendor_name = (
        result.get(
            "topRankedVendor"
        )
    )


    vendors = (
        result.get(
            "vendors",
            [],
        )
        or []
    )


    top_vendor_record = None


    # -----------------------------------------------------
    # Prefer actual rank 1 vendor
    # -----------------------------------------------------

    for vendor in vendors:
        try:
            rank = int(
                vendor.get(
                    "rank",
                    0,
                )
            )

        except (
            TypeError,
            ValueError,
        ):
            rank = 0


        if rank == 1:
            top_vendor_record = vendor
            break


    # -----------------------------------------------------
    # Fallback to topRankedVendor name
    # -----------------------------------------------------

    if (
        top_vendor_record is None
        and top_vendor_name
    ):
        normalized_top = (
            normalize_document_name(
                top_vendor_name
            )
        )


        for vendor in vendors:
            vendor_name = (
                vendor.get(
                    "name"
                )
                or vendor.get(
                    "vendorName"
                )
            )


            normalized_vendor = (
                normalize_document_name(
                    vendor_name
                )
            )


            if (
                normalized_vendor
                == normalized_top
            ):
                top_vendor_record = vendor
                break


    candidate_names = []


    if top_vendor_name:
        candidate_names.append(
            str(
                top_vendor_name
            )
        )


    if top_vendor_record:
        for field_name in [
            "fileName",
            "filename",
            "proposalFileName",
            "proposalFilename",
            "sourceFile",
            "sourceFileName",
            "name",
            "vendorName",
        ]:
            value = (
                top_vendor_record.get(
                    field_name
                )
            )


            if value:
                candidate_names.append(
                    str(
                        value
                    )
                )


    normalized_candidates = [
        normalize_document_name(
            value
        )

        for value
        in candidate_names

        if value
    ]


    # -----------------------------------------------------
    # Exact normalized match
    # -----------------------------------------------------

    for document in proposal_documents:
        file_name = (
            document.get(
                "fileName"
            )
        )


        if not file_name:
            continue


        normalized_file = (
            normalize_document_name(
                file_name
            )
        )


        if (
            normalized_file
            in normalized_candidates
        ):
            return document


    # -----------------------------------------------------
    # Partial / containment match
    # -----------------------------------------------------

    for document in proposal_documents:
        file_name = (
            document.get(
                "fileName"
            )
        )


        if not file_name:
            continue


        normalized_file = (
            normalize_document_name(
                file_name
            )
        )


        for candidate in normalized_candidates:
            if not candidate:
                continue


            if (
                candidate
                in normalized_file
                or normalized_file
                in candidate
            ):
                return document


    return None


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
    Run the evaluation pipeline after returning the
    evaluation ID to the frontend.
    """

    service = None


    temp_path = Path(
        temp_directory
    )


    rfp_path = Path(
        rfp_path_string
    )


    proposal_paths = [
        Path(
            path
        )

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

            completedDate=(
                utc_now_iso()
            ),

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

            completedDate=(
                utc_now_iso()
            ),

            error=str(
                error
            ),
        )


    finally:
        if service is not None:
            try:
                service.close()

            except Exception:
                pass


        # Only delete temporary processing files.
        # Permanent source PDFs are kept in DATA_DIR/documents.

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
                str(
                    cleanup_error
                )
            )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get(
    "/api/health"
)
def health_check():
    return {
        "status": "ok",

        "service": (
            "KSF Proposal Evaluation API"
        ),

        "storedEvaluations": (
            len(
                EVALUATIONS
            )
        ),
    }


# =========================================================
# LIST EVALUATIONS
# =========================================================

@app.get(
    "/api/evaluations"
)
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
# DOWNLOAD ORIGINAL RFP
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/documents/rfp"
)
def download_original_rfp(
    evaluation_id: str,
):
    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )


    request_info = (
        stored_evaluation.get(
            "request",
            {},
        )
        or {}
    )


    file_name = (
        request_info.get(
            "rfpName"
        )
    )


    if not file_name:
        raise HTTPException(
            status_code=404,
            detail=(
                "Original RFP document "
                "information was not found."
            ),
        )


    file_path = (
        get_persistent_rfp_path(
            evaluation_id,
            file_name,
        )
    )


    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Original RFP file is not available. "
                "This evaluation may have been created "
                "before permanent document storage was enabled."
            ),
        )


    return FileResponse(
        path=str(
            file_path
        ),

        media_type="application/pdf",

        filename=(
            Path(
                file_name
            ).name
        ),

        content_disposition_type="attachment",
    )


# =========================================================
# VIEW ORIGINAL RFP INLINE
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/documents/rfp/view"
)
def view_original_rfp(
    evaluation_id: str,
):
    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )


    request_info = (
        stored_evaluation.get(
            "request",
            {},
        )
        or {}
    )


    file_name = (
        request_info.get(
            "rfpName"
        )
    )


    if not file_name:
        raise HTTPException(
            status_code=404,
            detail=(
                "Original RFP document "
                "information was not found."
            ),
        )


    file_path = (
        get_persistent_rfp_path(
            evaluation_id,
            file_name,
        )
    )


    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Original RFP file is not available. "
                "This evaluation may have been created "
                "before permanent document storage was enabled."
            ),
        )


    return FileResponse(
        path=str(
            file_path
        ),

        media_type="application/pdf",

        filename=(
            Path(
                file_name
            ).name
        ),

        content_disposition_type="inline",

        headers={
            "Content-Security-Policy": (
                "frame-ancestors 'self' "
                "http://localhost:3000"
            )
        },
    )


# =========================================================
# DOWNLOAD TOP-RANKED PROPOSAL
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/documents/top-proposal"
)
def download_top_proposal(
    evaluation_id: str,
):
    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )


    if (
        stored_evaluation.get(
            "status"
        )
        != "COMPLETED"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Evaluation must be completed before "
                "the leading proposal can be downloaded."
            ),
        )


    document = (
        find_top_proposal_document(
            evaluation_id,
            stored_evaluation,
        )
    )


    if not document:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not match the top-ranked vendor "
                "to its original proposal document."
            ),
        )


    try:
        proposal_index = int(
            document.get(
                "index"
            )
        )

    except (
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Stored proposal document index is invalid."
            ),
        )


    file_name = (
        document.get(
            "fileName"
        )
    )


    if not file_name:
        raise HTTPException(
            status_code=404,
            detail=(
                "Proposal filename was not found."
            ),
        )


    file_path = (
        get_persistent_proposal_path(
            evaluation_id,
            proposal_index,
            file_name,
        )
    )


    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Original proposal file is not available. "
                "This evaluation may have been created "
                "before permanent document storage was enabled."
            ),
        )


    return FileResponse(
        path=str(
            file_path
        ),

        media_type="application/pdf",

        filename=(
            Path(
                file_name
            ).name
        ),

        content_disposition_type="attachment",
    )


# =========================================================
# VIEW TOP-RANKED PROPOSAL INLINE
# =========================================================

@app.get(
    "/api/evaluations/{evaluation_id}/documents/top-proposal/view"
)
def view_top_proposal(
    evaluation_id: str,
):
    stored_evaluation = (
        get_stored_evaluation(
            evaluation_id
        )
    )


    if (
        stored_evaluation.get(
            "status"
        )
        != "COMPLETED"
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Evaluation must be completed before "
                "the leading proposal can be viewed."
            ),
        )


    document = (
        find_top_proposal_document(
            evaluation_id,
            stored_evaluation,
        )
    )


    if not document:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not match the top-ranked vendor "
                "to its original proposal document."
            ),
        )


    try:
        proposal_index = int(
            document.get(
                "index"
            )
        )

    except (
        TypeError,
        ValueError,
    ):
        raise HTTPException(
            status_code=500,
            detail=(
                "Stored proposal document index is invalid."
            ),
        )


    file_name = (
        document.get(
            "fileName"
        )
    )


    if not file_name:
        raise HTTPException(
            status_code=404,
            detail=(
                "Proposal filename was not found."
            ),
        )


    file_path = (
        get_persistent_proposal_path(
            evaluation_id,
            proposal_index,
            file_name,
        )
    )


    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Original proposal file is not available. "
                "This evaluation may have been created "
                "before permanent document storage was enabled."
            ),
        )


    return FileResponse(
        path=str(
            file_path
        ),

        media_type="application/pdf",

        filename=(
            Path(
                file_name
            ).name
        ),

        content_disposition_type="inline",

        headers={
            "Content-Security-Policy": (
                "frame-ancestors 'self' "
                "http://localhost:3000"
            )
        },
    )


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

    Flow:
    1. Validate uploaded PDFs
    2. Store originals permanently
    3. Create temporary processing copies
    4. Save PROCESSING record
    5. Return evaluation ID
    6. Evaluate in background
    7. Delete only temporary copies
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
    # TEMP PROCESSING DIRECTORY
    # =====================================================

    temp_directory = (
        tempfile.mkdtemp(
            prefix=(
                f"{evaluation_id}_"
            )
        )
    )


    temp_path = (
        Path(
            temp_directory
        )
    )


    # =====================================================
    # PERMANENT SOURCE DIRECTORY
    # =====================================================

    persistent_evaluation_directory = (
        get_persistent_evaluation_directory(
            evaluation_id
        )
    )


    try:

        # =================================================
        # READ RFP
        # =================================================

        rfp_content = (
            await rfp.read()
        )


        if not rfp_content:
            raise HTTPException(
                status_code=400,
                detail="RFP file is empty.",
            )


        safe_rfp_name = (
            Path(
                rfp.filename
            ).name
        )


        # =================================================
        # SAVE ORIGINAL RFP PERMANENTLY
        # =================================================

        persistent_rfp_directory = (
            persistent_evaluation_directory
            / "rfp"
        )


        persistent_rfp_directory.mkdir(
            parents=True,
            exist_ok=True,
        )


        persistent_rfp_path = (
            persistent_rfp_directory
            / safe_rfp_name
        )


        persistent_rfp_path.write_bytes(
            rfp_content
        )


        # =================================================
        # SAVE TEMP RFP FOR AI PIPELINE
        # =================================================

        temp_rfp_directory = (
            temp_path
            / "rfp"
        )


        temp_rfp_directory.mkdir(
            parents=True,
            exist_ok=True,
        )


        rfp_path = (
            temp_rfp_directory
            / safe_rfp_name
        )


        rfp_path.write_bytes(
            rfp_content
        )


        # =================================================
        # SAVE PROPOSALS
        # =================================================

        proposal_paths = []

        proposal_documents = []


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


            safe_proposal_name = (
                Path(
                    proposal.filename
                ).name
            )


            # =============================================
            # SAVE ORIGINAL PROPOSAL PERMANENTLY
            # =============================================

            persistent_proposal_directory = (
                persistent_evaluation_directory
                / "proposals"
                / str(
                    index
                )
            )


            persistent_proposal_directory.mkdir(
                parents=True,
                exist_ok=True,
            )


            persistent_proposal_path = (
                persistent_proposal_directory
                / safe_proposal_name
            )


            persistent_proposal_path.write_bytes(
                proposal_content
            )


            # =============================================
            # SAVE TEMP PROPOSAL FOR AI PIPELINE
            # =============================================

            temp_proposal_directory = (
                temp_path
                / "proposals"
                / str(
                    index
                )
            )


            temp_proposal_directory.mkdir(
                parents=True,
                exist_ok=True,
            )


            proposal_path = (
                temp_proposal_directory
                / safe_proposal_name
            )


            proposal_path.write_bytes(
                proposal_content
            )


            proposal_paths.append(
                proposal_path
            )


            proposal_documents.append(
                {
                    "index": index,

                    "fileName": (
                        safe_proposal_name
                    ),
                }
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
                    safe_rfp_name
                ),

                "vendorCount": (
                    len(
                        proposals
                    )
                ),

                "proposalNames": [
                    document[
                        "fileName"
                    ]

                    for document
                    in proposal_documents
                ],

                "rfpDocument": {
                    "fileName": (
                        safe_rfp_name
                    ),
                },

                "proposalDocuments": (
                    proposal_documents
                ),
            },

            "result": {},
        }


        save_evaluation(
            evaluation_id,
            stored_evaluation,
        )


        # =================================================
        # START BACKGROUND EVALUATION
        # =================================================

        background_tasks.add_task(
            process_evaluation_background,

            evaluation_id,

            temp_directory,

            str(
                rfp_path
            ),

            [
                str(
                    path
                )

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

        print(
            f"Original documents: "
            f"{persistent_evaluation_directory}"
        )


        return {
            "id": evaluation_id,
            "status": "PROCESSING",
        }


    except HTTPException:

        shutil.rmtree(
            temp_path,
            ignore_errors=True,
        )


        shutil.rmtree(
            persistent_evaluation_directory,
            ignore_errors=True,
        )


        raise


    except Exception as error:

        shutil.rmtree(
            temp_path,
            ignore_errors=True,
        )


        shutil.rmtree(
            persistent_evaluation_directory,
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
            str(
                error
            )
        )


        raise HTTPException(
            status_code=500,
            detail=str(
                error
            ),
        )