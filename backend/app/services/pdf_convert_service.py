from __future__ import annotations

import io
import zipfile
from pathlib import Path

import fitz
from PIL import Image


def convert_pdf_to_text(input_path: str, output_path: str) -> None:
    doc = fitz.open(input_path)
    try:
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text("text"))

        Path(output_path).write_text("\n\n".join(parts), encoding="utf-8")
    finally:
        doc.close()


def convert_pdf_to_images(input_path: str, output_zip_path: str, image_format: str) -> None:
    doc = fitz.open(input_path)
    try:
        archive_mode = "a" if Path(output_zip_path).exists() else "w"
        with zipfile.ZipFile(output_zip_path, archive_mode, compression=zipfile.ZIP_DEFLATED) as archive:
            base_name = Path(input_path).stem
            for page_index, page in enumerate(doc, start=1):
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image_bytes = pix.tobytes("jpeg" if image_format == "jpg" else "png")
                archive.writestr(
                    f"{base_name}-page-{page_index}.{image_format}",
                    image_bytes,
                )
    finally:
        doc.close()


def convert_images_to_pdf(input_paths: list[str], output_path: str) -> None:
    images: list[Image.Image] = []
    try:
        for path in input_paths:
            image = Image.open(path)
            if image.mode != "RGB":
                image = image.convert("RGB")
            images.append(image)

        if not images:
            raise ValueError("No images were provided.")

        first_image, remaining_images = images[0], images[1:]
        first_image.save(output_path, save_all=True, append_images=remaining_images)
    finally:
        for image in images:
            image.close()


def bundle_text_files_to_zip(files: list[tuple[str, str]], output_zip_path: str) -> None:
    with zipfile.ZipFile(output_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for archive_name, text_path in files:
            archive.write(text_path, archive_name)
