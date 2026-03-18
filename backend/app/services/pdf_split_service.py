from __future__ import annotations

import zipfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def split_pdf(input_path: str, output_zip_path: str, mode: str, pages_per_split: int = 1) -> str:
    reader = PdfReader(input_path)
    total_pages = len(reader.pages)
    base_name = Path(input_path).stem

    with zipfile.ZipFile(output_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        if mode == "every-page":
            for page_index in range(total_pages):
                writer = PdfWriter()
                writer.add_page(reader.pages[page_index])
                archive.writestr(
                    f"{base_name}-page-{page_index + 1}.pdf",
                    _writer_to_bytes(writer),
                )
            return output_zip_path

        for start in range(0, total_pages, pages_per_split):
            writer = PdfWriter()
            end = min(start + pages_per_split, total_pages)
            for page_index in range(start, end):
                writer.add_page(reader.pages[page_index])

            archive.writestr(
                f"{base_name}-pages-{start + 1}-{end}.pdf",
                _writer_to_bytes(writer),
            )

    return output_zip_path


def _writer_to_bytes(writer: PdfWriter) -> bytes:
    from io import BytesIO

    buffer = BytesIO()
    writer.write(buffer)
    writer.close()
    return buffer.getvalue()
