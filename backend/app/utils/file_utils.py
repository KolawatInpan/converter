import os
import uuid
from pathlib import Path
import aiofiles
from fastapi import UploadFile

# Anchor to the backend root regardless of process CWD
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
TEMP_DIR = BACKEND_DIR / "temp"
OUTPUT_DIR = BACKEND_DIR / "output"

TEMP_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


def unique_filename(original_name: str) -> str:
    ext = Path(original_name).suffix
    return f"{uuid.uuid4().hex}{ext}"


def output_pdf_name(prefix: str = "output") -> str:
    return f"{prefix}_{uuid.uuid4().hex}.pdf"


def output_file_name(prefix: str, extension: str) -> str:
    normalized_extension = extension if extension.startswith(".") else f".{extension}"
    return f"{prefix}_{uuid.uuid4().hex}{normalized_extension}"


async def save_upload_file(file: UploadFile) -> str:
    filename = unique_filename(file.filename or "file.pdf")
    file_path = TEMP_DIR / filename
    chunk_size = 1024 * 1024

    async with aiofiles.open(file_path, "wb") as f:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            await f.write(chunk)

    await file.close()

    return str(file_path)


def cleanup_files(paths: list[str]) -> None:
    for path in paths:
        if path and os.path.exists(path):
            os.remove(path)
