from __future__ import annotations

import zipfile
from pathlib import Path

import fitz


def extract_pdf_images(input_path: str, output_zip_path: str) -> int:
    document = fitz.open(input_path)
    extracted_count = 0
    base_name = Path(input_path).stem

    try:
        with zipfile.ZipFile(output_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for page_index in range(len(document)):
                page = document.load_page(page_index)
                images = page.get_images(full=True)

                for image_index, image in enumerate(images, start=1):
                    xref = image[0]
                    image_info = document.extract_image(xref)
                    extension = image_info.get("ext", "png")
                    image_bytes = image_info["image"]
                    archive.writestr(
                        f"{base_name}-page-{page_index + 1}-image-{image_index}.{extension}",
                        image_bytes,
                    )
                    extracted_count += 1
    finally:
        document.close()

    return extracted_count
