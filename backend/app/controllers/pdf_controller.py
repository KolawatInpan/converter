from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from app.services.pdf_merge_service import merge_pdfs
from app.services.pdf_compress_service import compress_pdf
from app.services.pdf_convert_service import (
    bundle_text_files_to_zip,
    convert_images_to_pdf,
    convert_pdf_to_images,
    convert_pdf_to_text,
)
from app.services.pdf_extract_images_service import extract_pdf_images
from app.services.pdf_extract_pages_service import extract_pdf_pages
from app.services.pdf_rearrange_pages_service import rearrange_pdf_pages
from app.services.pdf_remove_pages_service import remove_pdf_pages
from app.services.pdf_protect_service import protect_pdf
from app.services.pdf_split_service import split_pdf
from app.services.pdf_unlock_service import unlock_pdf
from app.utils.file_utils import (
    save_upload_file,
    cleanup_files,
    output_file_name,
    output_pdf_name,
    OUTPUT_DIR,
)
from app.utils.validators import (
    validate_convert_format,
    validate_convert_mode,
    validate_image_or_pdf_for_convert,
    parse_page_order,
    parse_page_selection,
    validate_pages_per_split,
    validate_pdf_password,
    validate_quality,
    validate_split_mode,
    validate_single_pdf,
)
from pypdf import PdfReader


async def merge_controller(files: list[UploadFile]) -> FileResponse:
    for file in files:
        validate_single_pdf(file)

    saved_paths: list[str] = []
    try:
        for file in files:
            saved_paths.append(await save_upload_file(file))

        output_path = str(OUTPUT_DIR / output_pdf_name())
        merge_pdfs(saved_paths, output_path)
        cleanup_files(saved_paths)

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename="merged.pdf",
        )
    except Exception:
        cleanup_files(saved_paths)
        raise


async def compress_controller(file: UploadFile, quality: str) -> FileResponse:
    validate_single_pdf(file)
    validate_quality(quality)

    temp_path: str | None = None
    try:
        temp_path = await save_upload_file(file)
        output_path = str(OUTPUT_DIR / output_pdf_name("compressed"))
        compress_pdf(temp_path, output_path, quality)
        cleanup_files([temp_path])

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename="compressed.pdf",
        )
    except Exception:
        if temp_path:
            cleanup_files([temp_path])
        raise


async def protect_controller(file: UploadFile, password: str) -> FileResponse:
    validate_single_pdf(file)
    validate_pdf_password(password)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        output_path = str(OUTPUT_DIR / output_pdf_name("protected"))
        protect_pdf(temp_path, output_path, password)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{original_name}-protected.pdf",
        )
    except ValueError as exc:
        cleanup_files(generated_paths)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def unlock_controller(file: UploadFile, password: str) -> FileResponse:
    validate_single_pdf(file)
    validate_pdf_password(password)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        output_path = str(OUTPUT_DIR / output_pdf_name("unlocked"))
        unlock_pdf(temp_path, output_path, password)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{original_name}-unlocked.pdf",
        )
    except ValueError as exc:
        cleanup_files(generated_paths)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def convert_controller(
    files: list[UploadFile],
    mode: str,
    target_format: str,
) -> FileResponse:
    validate_convert_mode(mode)
    validate_convert_format(mode, target_format)

    saved_paths: list[str] = []
    generated_paths: list[str] = []
    original_filenames = [file.filename or "file" for file in files]

    try:
        for file in files:
            validate_image_or_pdf_for_convert(file, mode)
            saved_paths.append(await save_upload_file(file))

        if mode == "from-pdf":
            if target_format == "txt":
                if len(saved_paths) == 1:
                    source_path = saved_paths[0]
                    output_path = str(OUTPUT_DIR / output_file_name("converted", ".txt"))
                    convert_pdf_to_text(source_path, output_path)
                    generated_paths.append(output_path)
                    return FileResponse(
                        path=output_path,
                        media_type="text/plain; charset=utf-8",
                        filename=f"{Path(source_path).stem}.txt",
                    )

                text_outputs: list[tuple[str, str]] = []
                for source_path in saved_paths:
                    txt_path = str(OUTPUT_DIR / output_file_name("converted", ".txt"))
                    convert_pdf_to_text(source_path, txt_path)
                    generated_paths.append(txt_path)
                    text_outputs.append((f"{Path(source_path).stem}.txt", txt_path))

                zip_path = str(OUTPUT_DIR / output_file_name("converted-text", ".zip"))
                bundle_text_files_to_zip(text_outputs, zip_path)
                generated_paths.append(zip_path)
                return FileResponse(
                    path=zip_path,
                    media_type="application/zip",
                    filename="pdf-to-text.zip",
                )

            zip_path = str(OUTPUT_DIR / output_file_name(f"converted-{target_format}", ".zip"))
            for source_path in saved_paths:
                convert_pdf_to_images(source_path, zip_path, target_format)
            generated_paths.append(zip_path)

            if len(original_filenames) == 1:
                zip_filename = f"{Path(original_filenames[0]).stem}.zip"
            else:
                zip_filename = f"pdf-to-{target_format}.zip"

            return FileResponse(
                path=zip_path,
                media_type="application/zip",
                filename=zip_filename,
            )

        if target_format not in {"jpg", "png"}:
            raise HTTPException(status_code=400, detail="Only JPG and PNG to PDF are supported right now")

        output_path = str(OUTPUT_DIR / output_pdf_name("converted"))
        convert_images_to_pdf(saved_paths, output_path)
        generated_paths.append(output_path)

        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename="converted.pdf",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        cleanup_files(saved_paths)


async def remove_pages_controller(file: UploadFile, pages: str) -> FileResponse:
    validate_single_pdf(file)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        total_pages = len(PdfReader(temp_path).pages)
        pages_to_remove = parse_page_selection(pages, total_pages)

        output_path = str(OUTPUT_DIR / output_pdf_name("removed-pages"))
        remove_pdf_pages(temp_path, output_path, pages_to_remove)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{original_name}-pages-removed.pdf",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def extract_pages_controller(file: UploadFile, pages: str) -> FileResponse:
    validate_single_pdf(file)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        total_pages = len(PdfReader(temp_path).pages)
        pages_to_extract = sorted(parse_page_selection(pages, total_pages, allow_all=True))

        output_path = str(OUTPUT_DIR / output_pdf_name("extracted-pages"))
        extract_pdf_pages(temp_path, output_path, pages_to_extract)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{original_name}-pages-extracted.pdf",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def rearrange_pages_controller(file: UploadFile, pages: str) -> FileResponse:
    validate_single_pdf(file)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        total_pages = len(PdfReader(temp_path).pages)
        page_order = parse_page_order(pages, total_pages)

        output_path = str(OUTPUT_DIR / output_pdf_name("rearranged-pages"))
        rearrange_pdf_pages(temp_path, output_path, page_order)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/pdf",
            filename=f"{original_name}-pages-rearranged.pdf",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def split_pdf_controller(
    file: UploadFile,
    mode: str,
    pages_per_split: int,
) -> FileResponse:
    validate_single_pdf(file)
    validate_split_mode(mode)
    validate_pages_per_split(pages_per_split)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        output_path = str(OUTPUT_DIR / output_file_name("split-pdf", ".zip"))
        split_pdf(temp_path, output_path, mode, pages_per_split)
        generated_paths.append(output_path)

        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/zip",
            filename=f"{original_name}.zip",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def extract_images_controller(file: UploadFile) -> FileResponse:
    validate_single_pdf(file)

    temp_path: str | None = None
    generated_paths: list[str] = []

    try:
        temp_path = await save_upload_file(file)
        output_path = str(OUTPUT_DIR / output_file_name("extracted-images", ".zip"))
        extracted_count = extract_pdf_images(temp_path, output_path)

        if extracted_count == 0:
            raise HTTPException(status_code=400, detail="No embedded images were found in this PDF.")

        generated_paths.append(output_path)
        original_name = Path(file.filename or "document.pdf").stem
        return FileResponse(
            path=output_path,
            media_type="application/zip",
            filename=f"{original_name}.zip",
        )
    except Exception:
        cleanup_files(generated_paths)
        raise
    finally:
        if temp_path:
            cleanup_files([temp_path])
