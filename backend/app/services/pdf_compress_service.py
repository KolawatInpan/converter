import os
import shutil
import subprocess
from pathlib import Path

from dotenv import load_dotenv
from pypdf import PdfReader, PdfWriter

load_dotenv()

QUALITY_MAP = {
    "low": "/screen",
    "medium": "/ebook",
    "high": "/printer",
    "prepress": "/prepress",
}


def _find_ghostscript() -> str | None:
    candidates: list[str] = []

    env_gs_path = os.getenv("GHOSTSCRIPT_PATH")
    if env_gs_path:
        candidates.append(env_gs_path)

    env_gs_cmd = os.getenv("GHOSTSCRIPT_CMD")
    if env_gs_cmd:
        candidates.append(env_gs_cmd)

    candidates.extend(["gswin64c", "gswin64c.exe", "gswin32c", "gswin32c.exe", "gs"])

    program_files = os.getenv("ProgramFiles", r"C:\Program Files")
    gs_root = Path(program_files) / "gs"
    if gs_root.exists():
        installed = sorted(gs_root.glob("gs*\\bin\\gswin64c.exe"), reverse=True)
        candidates.extend(str(p) for p in installed)

    print("Ghostscript candidates:", candidates)

    for candidate in candidates:
        if not candidate:
            continue

        candidate_path = Path(candidate)
        if candidate_path.is_file():
            print("Ghostscript found by file path:", candidate_path)
            return str(candidate_path)

        resolved = shutil.which(candidate)
        if resolved:
            print("Ghostscript found by PATH:", resolved)
            return resolved

    print("Ghostscript not found")
    return None


def _compress_with_ghostscript(input_path: str, output_path: str, quality: str) -> str:
    gs = _find_ghostscript()
    if not gs:
        raise FileNotFoundError(
            "Ghostscript not found. Install it and add to PATH, or set GHOSTSCRIPT_PATH."
        )

    pdf_setting = QUALITY_MAP.get(quality, "/ebook")

    command = [
        gs,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dNOPAUSE",
        "-dBATCH",
        f"-dPDFSETTINGS={pdf_setting}",
        f"-sOutputFile={output_path}",
        input_path,
    ]

    print("Running Ghostscript command:", command)

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
    )

    print("Ghostscript return code:", result.returncode)
    print("Ghostscript stdout:", result.stdout)
    print("Ghostscript stderr:", result.stderr)

    if result.returncode != 0:
        raise RuntimeError(result.stderr or "Ghostscript compression failed")

    if not Path(output_path).exists():
        raise RuntimeError("Ghostscript finished but output file was not created")

    return output_path


def _compress_with_pypdf(input_path: str, output_path: str) -> str:
    print("Falling back to pypdf compression")
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page in reader.pages:
        try:
            page.compress_content_streams()
        except Exception:
            pass
        writer.add_page(page)

    with open(output_path, "wb") as f:
        writer.write(f)

    return output_path


def compress_pdf(input_path: str, output_path: str, quality: str = "medium") -> str:
    try:
        return _compress_with_ghostscript(input_path, output_path, quality)
    except (FileNotFoundError, RuntimeError):
        return _compress_with_pypdf(input_path, output_path)