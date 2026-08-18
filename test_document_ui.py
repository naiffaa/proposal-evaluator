import tempfile
from pathlib import Path

import streamlit as st

from services.document_parser import DocumentParser


st.set_page_config(
    page_title="OCI Document Test",
    page_icon="📄",
    layout="wide",
)


st.title("📄 OCI Document Understanding Test")

st.caption(
    "PDF → OCI Object Storage → OCI Document Understanding → Extracted Text"
)

st.divider()


uploaded_file = st.file_uploader(
    "Upload a PDF",
    type=["pdf"],
)


if uploaded_file is not None:
    st.success(
        f"Selected: {uploaded_file.name}"
    )


if st.button(
    "Extract Text with OCI",
    type="primary",
    disabled=uploaded_file is None,
    use_container_width=True,
):
    try:
        with st.status(
            "Processing document with Oracle OCI...",
            expanded=True,
        ) as status:

            status.write(
                "Saving uploaded PDF temporarily..."
            )

            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = (
                    Path(temp_dir)
                    / uploaded_file.name
                )

                with open(
                    temp_path,
                    "wb",
                ) as file_handle:
                    file_handle.write(
                        uploaded_file.getbuffer()
                    )

                status.write(
                    "Connecting to OCI..."
                )

                parser = DocumentParser()

                status.write(
                    "Uploading document to OCI Object Storage..."
                )

                status.write(
                    "Running OCI Document Understanding..."
                )

                result = parser.parse_document(
                    temp_path
                )

            status.update(
                label="Document processed successfully",
                state="complete",
                expanded=False,
            )

        st.success(
            "✅ Text extraction completed successfully."
        )

        col1, col2, col3 = st.columns(3)

        with col1:
            st.metric(
                "File",
                result["file_name"],
            )

        with col2:
            st.metric(
                "Characters",
                len(result["text"]),
            )

        with col3:
            st.metric(
                "Result Files",
                len(
                    result.get(
                        "result_files",
                        []
                    )
                ),
            )

        st.subheader(
            "OCI Processing Details"
        )

        st.code(
            f"""
Object Name:
{result["object_name"]}

Processor Job ID:
{result["processor_job_id"]}

Result Prefix:
{result["result_prefix"]}
            """.strip()
        )

        st.subheader(
            "Extracted Text"
        )

        st.text_area(
            "Document Content",
            value=result["text"],
            height=500,
        )

    except Exception as error:
        st.error(
            "Document processing failed."
        )

        st.exception(
            error
        )