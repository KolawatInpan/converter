from fastapi import APIRouter, UploadFile, File, Form
from app.controllers.pdf_controller import (
    merge_controller,
    compress_controller,
    convert_controller,
    extract_images_controller,
    extract_pages_controller,
    protect_controller,
    rearrange_pages_controller,
    remove_pages_controller,
    split_pdf_controller,
    unlock_controller,
)

router = APIRouter()


@router.post("/merge")
async def merge_pdf(files: list[UploadFile] = File(...)):
    return await merge_controller(files)


@router.post("/compress")
async def compress_pdf(
    file: UploadFile = File(...),
    quality: str = Form("medium"),
):
    return await compress_controller(file, quality)


@router.post("/protect")
async def protect_pdf_route(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    return await protect_controller(file, password)


@router.post("/unlock")
async def unlock_pdf_route(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    return await unlock_controller(file, password)


@router.post("/convert")
async def convert_pdf(
    files: list[UploadFile] = File(...),
    mode: str = Form(...),
    target_format: str = Form(...),
):
    return await convert_controller(files, mode, target_format)


@router.post("/remove-pages")
async def remove_pdf_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    return await remove_pages_controller(file, pages)


@router.post("/extract-pages")
async def extract_pdf_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    return await extract_pages_controller(file, pages)


@router.post("/rearrange-pages")
async def rearrange_pdf_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    return await rearrange_pages_controller(file, pages)


@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    mode: str = Form(...),
    pages_per_split: int = Form(1),
):
    return await split_pdf_controller(file, mode, pages_per_split)


@router.post("/extract-images")
async def extract_pdf_images(
    file: UploadFile = File(...),
):
    return await extract_images_controller(file)
