from fastapi import APIRouter, File, Form, UploadFile
from app.controllers.japan_controller import (
    image_ocr_controller,
    kanji_reading_controller,
    extract_words_controller,
    dictionary_lookup_controller,
    sentence_breakdown_controller,
    fetch_uma_skills_controller,
    get_legacy_skills_controller,
    search_skill_controller,
    match_ocr_skills_controller,
    get_all_skills_controller,
    refresh_skills_cache_controller,
    get_skill_detail_controller,
    get_uma_characters_controller,
    get_uma_supports_controller,
    search_uma_database_controller,
    refresh_uma_database_cache_controller,
    get_uma_character_detail_controller,
    get_uma_support_detail_controller,
)

router = APIRouter()

router.post("/extract-words")(extract_words_controller)
router.post("/dictionary")(dictionary_lookup_controller)
router.post("/sentence-breakdown")(sentence_breakdown_controller)
router.get("/uma-skills")(fetch_uma_skills_controller)
router.get("/legacy-skills")(get_legacy_skills_controller)
router.post("/skill-search")(search_skill_controller)
router.post("/match-skills")(match_ocr_skills_controller)
router.get("/all-skills")(get_all_skills_controller)
router.get("/skills/{skill_id}")(get_skill_detail_controller)
router.post("/refresh-skills-cache")(refresh_skills_cache_controller)
router.get("/uma-characters")(get_uma_characters_controller)
router.get("/uma-supports")(get_uma_supports_controller)
router.get("/uma-characters/{item_id}")(get_uma_character_detail_controller)
router.get("/uma-supports/{item_id}")(get_uma_support_detail_controller)
router.post("/uma-search")(search_uma_database_controller)
router.post("/refresh-uma-database-cache")(refresh_uma_database_cache_controller)


@router.post("/image-ocr")
async def image_ocr(
    file: UploadFile = File(...),
    mode: str = Form("default"),
):
    return await image_ocr_controller(file, mode)


@router.post("/kanji-reading")
async def kanji_reading(
    file: UploadFile = File(...),
):
    return await kanji_reading_controller(file)
