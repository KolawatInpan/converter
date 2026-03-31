from fastapi import HTTPException, UploadFile


def validate_single_pdf(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")


def validate_single_image(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    filename = file.filename.lower()
    if not (
        filename.endswith(".jpg")
        or filename.endswith(".jpeg")
        or filename.endswith(".png")
        or filename.endswith(".bmp")
        or filename.endswith(".webp")
    ):
        raise HTTPException(
            status_code=400,
            detail="File must be an image in JPG, PNG, BMP, or WEBP format",
        )


def validate_pdf_password(password: str, *, field_name: str = "password") -> None:
    if not password or not password.strip():
        raise HTTPException(status_code=400, detail=f"{field_name} is required")


def validate_quality(quality: str) -> None:
    allowed = {"low", "medium", "high", "prepress"}
    if quality not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"quality must be one of: {', '.join(sorted(allowed))}"
        )


def validate_convert_mode(mode: str) -> None:
    allowed = {"from-pdf", "to-pdf"}
    if mode not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"mode must be one of: {', '.join(sorted(allowed))}"
        )


def validate_convert_format(mode: str, target_format: str) -> None:
    allowed_by_mode = {
        "from-pdf": {"txt", "png", "jpg"},
        "to-pdf": {"jpg", "png"},
    }
    allowed = allowed_by_mode.get(mode, set())
    if target_format not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"format '{target_format}' is not supported for mode '{mode}'"
        )


def validate_image_or_pdf_for_convert(file: UploadFile, mode: str) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Invalid file")

    filename = file.filename.lower()

    if mode == "from-pdf":
        if not filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail="File must be a PDF")
        return

    if not (
        filename.endswith(".jpg")
        or filename.endswith(".jpeg")
        or filename.endswith(".png")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG files are supported for Convert to PDF right now"
        )


def parse_page_selection(selection: str, total_pages: int, allow_all: bool = False) -> set[int]:
    if not selection.strip():
        raise HTTPException(status_code=400, detail="Please provide page numbers to remove.")

    pages: set[int] = set()

    for raw_part in selection.split(","):
        part = raw_part.strip()
        if not part:
            continue

        if "-" in part:
            start_text, end_text = part.split("-", 1)
            if not start_text.strip().isdigit() or not end_text.strip().isdigit():
                raise HTTPException(status_code=400, detail=f"Invalid page range: {part}")

            start = int(start_text)
            end = int(end_text)

            if start > end:
                raise HTTPException(status_code=400, detail=f"Invalid page range: {part}")

            for page in range(start, end + 1):
                if page < 1 or page > total_pages:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Page {page} is outside the document page count ({total_pages})."
                    )
                pages.add(page)
            continue

        if not part.isdigit():
            raise HTTPException(status_code=400, detail=f"Invalid page number: {part}")

        page = int(part)
        if page < 1 or page > total_pages:
            raise HTTPException(
                status_code=400,
                detail=f"Page {page} is outside the document page count ({total_pages})."
            )
        pages.add(page)

    if not pages:
        raise HTTPException(status_code=400, detail="Please provide at least 1 valid page number.")

    if not allow_all and len(pages) >= total_pages:
        raise HTTPException(status_code=400, detail="You cannot remove every page from the PDF.")

    return pages


def parse_page_order(selection: str, total_pages: int) -> list[int]:
    if not selection.strip():
        raise HTTPException(status_code=400, detail="Please provide the new page order.")

    ordered_pages: list[int] = []

    for raw_part in selection.split(","):
        part = raw_part.strip()
        if not part:
            continue

        if "-" in part:
            start_text, end_text = part.split("-", 1)
            if not start_text.strip().isdigit() or not end_text.strip().isdigit():
                raise HTTPException(status_code=400, detail=f"Invalid page range: {part}")

            start = int(start_text)
            end = int(end_text)

            if start > end:
                raise HTTPException(status_code=400, detail=f"Invalid page range: {part}")

            for page in range(start, end + 1):
                if page < 1 or page > total_pages:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Page {page} is outside the document page count ({total_pages})."
                    )
                ordered_pages.append(page)
            continue

        if not part.isdigit():
            raise HTTPException(status_code=400, detail=f"Invalid page number: {part}")

        page = int(part)
        if page < 1 or page > total_pages:
            raise HTTPException(
                status_code=400,
                detail=f"Page {page} is outside the document page count ({total_pages})."
            )
        ordered_pages.append(page)

    if len(ordered_pages) != total_pages:
        raise HTTPException(
            status_code=400,
            detail=f"Please include all {total_pages} pages exactly once in the new order."
        )

    if len(set(ordered_pages)) != total_pages:
        raise HTTPException(
            status_code=400,
            detail="Each page must appear exactly once in the new order."
        )

    return ordered_pages


def validate_split_mode(mode: str) -> None:
    allowed = {"every-page", "page-count"}
    if mode not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"split mode must be one of: {', '.join(sorted(allowed))}"
        )


def validate_pages_per_split(value: int) -> None:
    if value < 1:
        raise HTTPException(status_code=400, detail="pages_per_split must be at least 1.")
