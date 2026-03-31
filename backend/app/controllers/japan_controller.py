import json

from fastapi import HTTPException, UploadFile
from pydantic import BaseModel, model_validator

from app.services.extract_word import extract_words
from app.services.image_ocr_service import extract_text_from_image
from app.services.kanji_reading_service import extract_kanji_candidates_from_image
from app.services.lookup_dictionary import lookup_dictionary
from app.services.sentence_breakdown import breakdown_sentence
from app.services.gametora_uma_service import (
    fetch_uma_database,
    get_uma_entity_detail,
    get_uma_entity_list,
    refresh_uma_database_cache,
    search_uma_database,
)
from app.services.uma_skill_service import (
    fetch_uma_skills,
    refresh_uma_skills_cache,
    fetch_uma_skill_detail,
)
from app.services.skill_matcher_service import (
    search_skill_by_name,
    find_best_skill_match,
    extract_and_match_skills,
    get_skills_by_category,
    get_all_skills,
)
from app.utils.file_utils import cleanup_files, save_upload_file
from app.utils.validators import validate_single_image


class ExtractWordsRequest(BaseModel):
    text: str

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


class DictionaryLookupRequest(BaseModel):
    query: str

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


class SentenceBreakdownRequest(BaseModel):
    text: str

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


class SkillSearchRequest(BaseModel):
    query: str

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


class UmaDbSearchRequest(BaseModel):
    query: str
    entity: str = "all"

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


class SkillMatchRequest(BaseModel):
    ocrTexts: list[str]

    @model_validator(mode="before")
    @classmethod
    def parse_stringified_json(cls, value):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Request body must be valid JSON") from exc
        return value


async def extract_words_controller(payload: ExtractWordsRequest) -> list[dict]:
    return extract_words(payload.text)


async def dictionary_lookup_controller(payload: DictionaryLookupRequest) -> dict:
    return lookup_dictionary(payload.query)


async def sentence_breakdown_controller(payload: SentenceBreakdownRequest) -> dict:
    return breakdown_sentence(payload.text)


async def image_ocr_controller(file: UploadFile, mode: str = "default") -> dict:
    validate_single_image(file)

    temp_path: str | None = None

    try:
        temp_path = await save_upload_file(file)
        if mode not in {"default", "uma-musume"}:
            raise HTTPException(status_code=400, detail="Unsupported OCR mode.")
        return extract_text_from_image(temp_path, mode=mode)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def kanji_reading_controller(file: UploadFile) -> dict:
    validate_single_image(file)

    temp_path: str | None = None

    try:
        temp_path = await save_upload_file(file)
        return extract_kanji_candidates_from_image(temp_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if temp_path:
            cleanup_files([temp_path])


async def fetch_uma_skills_controller() -> list[dict]:
    return get_uma_entity_list("skills")


async def get_legacy_skills_controller() -> dict:
    skills = fetch_uma_skills()
    items: list[dict] = []

    for skill in skills:
        category = str(skill.get("category", "") or "").replace("_", " ").title()
        rarity = str(skill.get("rarity", "") or "").title()
        items.append(
            {
                "id": str(skill.get("id", "")),
                "name": skill.get("name", ""),
                "jpName": skill.get("jpName", ""),
                "description": skill.get("description", ""),
                "rarity": rarity or "Unknown",
                "typeLabel": category or "Other",
                "url": skill.get("wikiUrl", "") or (
                    f"https://umamusu.wiki/Game:Skills/{skill.get('id')}"
                    if skill.get("id") is not None
                    else ""
                ),
                "imageUrl": skill.get("icon", ""),
                "source": "Legacy Wiki",
            }
        )

    return {
        "totalSkills": len(items),
        "skills": items,
    }


async def search_skill_controller(payload: SkillSearchRequest) -> dict:
    results = search_uma_database(payload.query, entity="skills").get("results", [])
    return {
        "query": payload.query,
        "count": len(results),
        "results": results,
    }


async def match_ocr_skills_controller(payload: SkillMatchRequest) -> dict:
    matched = extract_and_match_skills(payload.ocrTexts)
    return {
        "totalTexts": len(payload.ocrTexts),
        "matchedCount": len(matched),
        "matches": matched,
    }


async def get_all_skills_controller() -> dict:
    skills = get_uma_entity_list("skills")
    return {
        "totalSkills": len(skills),
        "skills": skills,
    }


async def refresh_skills_cache_controller() -> dict:
    return refresh_uma_database_cache()


async def get_skill_detail_controller(skill_id: str) -> dict:
    try:
        skills = get_uma_entity_list("skills")
        for item in skills:
            if str(item.get("id")) == str(skill_id):
                return item
        return fetch_uma_skill_detail(skill_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def get_uma_characters_controller() -> dict:
    items = get_uma_entity_list("characters")
    return {"totalItems": len(items), "items": items}


async def get_uma_supports_controller() -> dict:
    items = get_uma_entity_list("supports")
    return {"totalItems": len(items), "items": items}


async def search_uma_database_controller(payload: UmaDbSearchRequest) -> dict:
    entity = payload.entity if payload.entity in {"all", "skills", "supports", "characters"} else "all"
    results = search_uma_database(payload.query, entity=entity)
    return {
        "query": payload.query,
        "entity": entity,
        "count": len(results.get("results", [])),
        **results,
    }


async def refresh_uma_database_cache_controller() -> dict:
    return refresh_uma_database_cache()


async def get_uma_character_detail_controller(item_id: str) -> dict:
    try:
        return get_uma_entity_detail("characters", item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


async def get_uma_support_detail_controller(item_id: str) -> dict:
    try:
        return get_uma_entity_detail("supports", item_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
