import json
import os
import time
import uuid
from pathlib import Path

import oci


class DocumentParser:
    def __init__(
        self,
        profile_name="DEFAULT",
        bucket_name="proposal-evaluator-documents",
        output_prefix="textExtraction",
    ):
        self.profile_name = profile_name
        self.bucket_name = bucket_name
        self.output_prefix = output_prefix

        # ==================================================
        # Load OCI API Key configuration
        # ==================================================

        config_file = os.path.expanduser("~/.oci/config")

        self.config = oci.config.from_file(
            file_location=config_file,
            profile_name=self.profile_name,
        )

        self.region = self.config["region"]

        # Root compartment = tenancy
        # We can change this later if needed.
        self.compartment_id = self.config["tenancy"]

        # ==================================================
        # OCI Clients
        # ==================================================
        #
        # No SecurityTokenSigner.
        # No browser session.
        #
        # OCI SDK automatically signs requests using:
        # user
        # fingerprint
        # tenancy
        # region
        # key_file
        #
        # from ~/.oci/config
        # ==================================================

        self.object_storage = (
            oci.object_storage.ObjectStorageClient(
                self.config
            )
        )

        self.document_client = (
            oci.ai_document.AIServiceDocumentClient(
                self.config
            )
        )

        # ==================================================
        # Object Storage namespace
        # ==================================================

        namespace_response = (
            self.object_storage.get_namespace()
        )

        self.namespace = namespace_response.data

        print()
        print("--------------------------------")
        print("OCI Document Parser initialized")
        print("--------------------------------")
        print(f"Profile: {self.profile_name}")
        print(f"Region: {self.region}")
        print(f"Bucket: {self.bucket_name}")
        print(f"Namespace: {self.namespace}")

    # ======================================================
    # Upload document
    # ======================================================

    def upload_document(self, file_path):
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(
                f"File does not exist: {file_path}"
            )

        if not file_path.is_file():
            raise ValueError(
                f"Path is not a file: {file_path}"
            )

        if file_path.suffix.lower() != ".pdf":
            raise ValueError(
                "Currently this parser accepts PDF files only."
            )

        unique_id = uuid.uuid4().hex[:12]

        safe_filename = (
            file_path.name
            .replace("\\", "_")
            .replace("/", "_")
        )

        object_name = (
            f"uploads/"
            f"{unique_id}_"
            f"{safe_filename}"
        )

        print()
        print("--------------------------------")
        print("Uploading document to OCI")
        print("--------------------------------")
        print(f"File: {file_path.name}")
        print(f"Object: {object_name}")

        try:
            upload_manager = (
                oci.object_storage.UploadManager(
                    self.object_storage
                )
            )

            upload_manager.upload_file(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=object_name,
                file_path=str(file_path),
            )

        except oci.exceptions.ServiceError as error:
            raise RuntimeError(
                "Object Storage upload failed.\n"
                f"Status: {error.status}\n"
                f"Code: {error.code}\n"
                f"Message: {error.message}"
            ) from error

        print("Upload successful.")

        print(
            f"OCI Object: "
            f"{self.bucket_name}/{object_name}"
        )

        return object_name

    # ======================================================
    # Start OCI Document Understanding job
    # ======================================================

    def start_extraction_job(
        self,
        object_name,
    ):
        job_reference = uuid.uuid4().hex[:12]

        result_prefix = (
            f"{self.output_prefix}/"
            f"{job_reference}"
        )

        # ==================================================
        # Input document
        # ==================================================

        input_location = (
            oci.ai_document.models.ObjectStorageLocations(
                object_locations=[
                    oci.ai_document.models.ObjectLocation(
                        namespace_name=self.namespace,
                        bucket_name=self.bucket_name,
                        object_name=object_name,
                    )
                ]
            )
        )

        # ==================================================
        # Output location
        # ==================================================

        output_location = (
            oci.ai_document.models.OutputLocation(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                prefix=result_prefix,
            )
        )

        # ==================================================
        # Text Extraction feature
        # ==================================================

        text_feature = (
            oci.ai_document.models.DocumentTextExtractionFeature(
                generate_searchable_pdf=False,
                selection_mark_detection=False,
            )
        )

        # ==================================================
        # Processor configuration
        # ==================================================

        processor_config = (
            oci.ai_document.models.GeneralProcessorConfig(
                features=[
                    text_feature
                ],
                document_type="OTHERS",
                is_zip_output_enabled=False,
            )
        )

        # ==================================================
        # Create Processor Job
        # ==================================================

        job_details = (
            oci.ai_document.models.CreateProcessorJobDetails(
                compartment_id=self.compartment_id,
                input_location=input_location,
                output_location=output_location,
                processor_config=processor_config,
                display_name=(
                    f"proposalEvaluator-"
                    f"{job_reference}"
                ),
            )
        )

        print()
        print("--------------------------------")
        print("Starting Document Understanding")
        print("--------------------------------")

        try:
            response = (
                self.document_client.create_processor_job(
                    create_processor_job_details=job_details
                )
            )

        except oci.exceptions.ServiceError as error:
            raise RuntimeError(
                "Could not create Document Understanding job.\n"
                f"Status: {error.status}\n"
                f"Code: {error.code}\n"
                f"Message: {error.message}"
            ) from error

        job_id = response.data.id

        print(f"Processor Job ID: {job_id}")
        print(f"Result Prefix: {result_prefix}")

        return job_id, result_prefix

    # ======================================================
    # Wait for analysis
    # ======================================================

    def wait_for_job(
        self,
        job_id,
        timeout_seconds=1200,
        polling_seconds=5,
    ):
        start_time = time.time()

        previous_state = None

        print()
        print("--------------------------------")
        print("Waiting for OCI analysis")
        print("--------------------------------")

        while True:
            try:
                response = (
                    self.document_client.get_processor_job(
                        processor_job_id=job_id
                    )
                )

            except oci.exceptions.ServiceError as error:
                raise RuntimeError(
                    "Could not get Document Understanding "
                    "job status.\n"
                    f"Status: {error.status}\n"
                    f"Code: {error.code}\n"
                    f"Message: {error.message}"
                ) from error

            job = response.data

            state = job.lifecycle_state

            if state != previous_state:
                print(f"Job State: {state}")
                previous_state = state

            if state == "SUCCEEDED":
                print(
                    "Analysis completed successfully."
                )

                return job

            if state in {
                "FAILED",
                "CANCELED",
            }:
                details = getattr(
                    job,
                    "lifecycle_details",
                    None,
                )

                raise RuntimeError(
                    "Document Understanding job failed.\n"
                    f"State: {state}\n"
                    f"Details: {details}"
                )

            elapsed = (
                time.time() - start_time
            )

            if elapsed > timeout_seconds:
                raise TimeoutError(
                    "Document analysis took too long.\n"
                    f"Job ID: {job_id}\n"
                    f"Last State: {state}"
                )

            time.sleep(
                polling_seconds
            )

    # ======================================================
    # Find output JSON files
    # ======================================================

    def find_result_files(
        self,
        result_prefix,
    ):
        print()
        print("--------------------------------")
        print("Finding OCI result files")
        print("--------------------------------")

        try:
            response = (
                oci.pagination.list_call_get_all_results(
                    self.object_storage.list_objects,
                    namespace_name=self.namespace,
                    bucket_name=self.bucket_name,
                    prefix=result_prefix,
                )
            )

        except oci.exceptions.ServiceError as error:
            raise RuntimeError(
                "Could not list Document Understanding "
                "result files.\n"
                f"Status: {error.status}\n"
                f"Code: {error.code}\n"
                f"Message: {error.message}"
            ) from error

        result_objects = []

        for obj in response.data.objects:
            if obj.name.lower().endswith(
                ".json"
            ):
                result_objects.append(
                    obj.name
                )

        if not result_objects:
            raise RuntimeError(
                "OCI completed the job but "
                "no JSON result file was found.\n"
                f"Expected prefix: {result_prefix}"
            )

        result_objects.sort()

        print(
            f"JSON files found: "
            f"{len(result_objects)}"
        )

        for object_name in result_objects:
            print(
                f"- {object_name}"
            )

        return result_objects

    # ======================================================
    # Download output JSON
    # ======================================================

    def download_result_json(
        self,
        object_name,
    ):
        try:
            response = (
                self.object_storage.get_object(
                    namespace_name=self.namespace,
                    bucket_name=self.bucket_name,
                    object_name=object_name,
                )
            )

        except oci.exceptions.ServiceError as error:
            raise RuntimeError(
                "Could not download Document Understanding "
                "JSON result.\n"
                f"Object: {object_name}\n"
                f"Status: {error.status}\n"
                f"Code: {error.code}\n"
                f"Message: {error.message}"
            ) from error

        content = response.data.content

        if isinstance(
            content,
            bytes,
        ):
            content = content.decode(
                "utf-8-sig"
            )

        try:
            return json.loads(
                content
            )

        except json.JSONDecodeError as error:
            raise RuntimeError(
                "Document Understanding output "
                "was not valid JSON.\n"
                f"Object: {object_name}"
            ) from error

    # ======================================================
    # Extract text from OCI JSON response
    # ======================================================

    def extract_text(
        self,
        data,
    ):
        extracted_pages = []

        # OCI output may be wrapped in
        # analyzeDocumentResult
        if (
            isinstance(data, dict)
            and "analyzeDocumentResult" in data
        ):
            data = data[
                "analyzeDocumentResult"
            ]

        if not isinstance(
            data,
            dict,
        ):
            return ""

        pages = data.get(
            "pages",
            []
        )

        if not isinstance(
            pages,
            list,
        ):
            return ""

        for page in pages:
            if not isinstance(
                page,
                dict,
            ):
                continue

            page_lines = []

            # ==============================================
            # Preferred method: lines
            # ==============================================

            lines = page.get(
                "lines",
                []
            )

            if isinstance(
                lines,
                list,
            ):
                for line in lines:
                    if not isinstance(
                        line,
                        dict,
                    ):
                        continue

                    text = line.get(
                        "text"
                    )

                    if (
                        isinstance(text, str)
                        and text.strip()
                    ):
                        page_lines.append(
                            text.strip()
                        )

            # ==============================================
            # Fallback: words
            # ==============================================

            if not page_lines:
                words = page.get(
                    "words",
                    []
                )

                page_words = []

                if isinstance(
                    words,
                    list,
                ):
                    for word in words:
                        if not isinstance(
                            word,
                            dict,
                        ):
                            continue

                        word_text = word.get(
                            "text"
                        )

                        if (
                            isinstance(
                                word_text,
                                str,
                            )
                            and word_text.strip()
                        ):
                            page_words.append(
                                word_text.strip()
                            )

                if page_words:
                    page_lines.append(
                        " ".join(
                            page_words
                        )
                    )

            if page_lines:
                extracted_pages.append(
                    "\n".join(
                        page_lines
                    )
                )

        return "\n\n".join(
            extracted_pages
        ).strip()

    # ======================================================
    # Full parsing workflow
    # ======================================================

    def parse_document(
        self,
        file_path,
    ):
        file_path = Path(
            file_path
        )

        print()
        print("=" * 60)
        print("OCI DOCUMENT PROCESSING")
        print("=" * 60)

        # ==================================================
        # 1. Upload document
        # ==================================================

        object_name = (
            self.upload_document(
                file_path
            )
        )

        # ==================================================
        # 2. Start Document Understanding job
        # ==================================================

        job_id, result_prefix = (
            self.start_extraction_job(
                object_name
            )
        )

        # ==================================================
        # 3. Wait for completion
        # ==================================================

        self.wait_for_job(
            job_id
        )

        # ==================================================
        # 4. Find generated JSON files
        # ==================================================

        result_files = (
            self.find_result_files(
                result_prefix
            )
        )

        # ==================================================
        # 5. Read and combine extracted text
        # ==================================================

        all_text = []

        for result_file in result_files:
            result_json = (
                self.download_result_json(
                    result_file
                )
            )

            text = self.extract_text(
                result_json
            )

            if text:
                all_text.append(
                    text
                )

        final_text = (
            "\n\n".join(
                all_text
            )
            .strip()
        )

        if not final_text:
            raise RuntimeError(
                "OCI analysis completed "
                "but no text was extracted."
            )

        print()
        print("--------------------------------")
        print("Extraction complete")
        print("--------------------------------")
        print(
            f"Characters extracted: "
            f"{len(final_text)}"
        )

        return {
            "file_name": file_path.name,
            "object_name": object_name,
            "processor_job_id": job_id,
            "result_prefix": result_prefix,
            "result_files": result_files,
            "text": final_text,
        }


# =========================================================
# Local Test
# =========================================================

if __name__ == "__main__":
    parser = DocumentParser(
        profile_name="DEFAULT",
        bucket_name="proposal-evaluator-documents",
        output_prefix="textExtraction",
    )

    # Your current test proposal
    test_file = "Technical Proposal 01.pdf"

    try:
        result = parser.parse_document(
            test_file
        )

        print()
        print("=" * 60)
        print(
            "OCI DOCUMENT UNDERSTANDING RESULT"
        )
        print("=" * 60)

        print()
        print(
            f"File: "
            f"{result['file_name']}"
        )

        print(
            f"Object: "
            f"{result['object_name']}"
        )

        print(
            f"Job: "
            f"{result['processor_job_id']}"
        )

        print(
            f"Result Prefix: "
            f"{result['result_prefix']}"
        )

        print()
        print(
            "EXTRACTED TEXT PREVIEW"
        )
        print("-" * 60)

        print(
            result["text"][:5000]
        )

    except Exception as error:
        print()
        print("=" * 60)
        print("ERROR")
        print("=" * 60)

        print(
            type(error).__name__
        )

        print(
            str(error)
        )

        raise