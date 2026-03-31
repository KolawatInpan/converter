import json
import os
import time
from typing import Any

import requests


GAMETORA_BASE_URL = "https://beta.gametora.com"
GAMETORA_PUBLIC_BASE_URL = "https://gametora.com"
MANIFEST_URL = f"{GAMETORA_BASE_URL}/data/manifests/umamusume.json"
CACHE_PATH = os.path.join(os.path.dirname(__file__), "../data/gametora_uma_cache.json")
CACHE_TTL_SECONDS = 60 * 60 * 24
REQUEST_HEADERS = {"User-Agent": "converter-bot/1.0"}
DATASET_KEYS = {
    "skills": "skills",
    "supports": "support-cards",
    "characters": "character-cards",
}
SUPPORT_RARITY_LABELS = {1: "R", 2: "SR", 3: "SSR"}
CHARACTER_RARITY_LABELS = {1: "1*", 2: "2*", 3: "3*"}

_CACHE_STORE: dict[str, Any] | None = None


def fetch_uma_database(force_refresh: bool = False) -> dict[str, list[dict[str, Any]]]:
    cached = load_cached_database()
    stale_cached = load_cached_database(allow_stale=True)
    if cached and not force_refresh:
        return cached

    try:
        manifest = fetch_manifest()
        skills_raw = fetch_dataset("skills", manifest)
        supports_raw = fetch_dataset("supports", manifest)
        characters_raw = fetch_dataset("characters", manifest)

        database = {
            "skills": [normalize_skill_entry(item) for item in skills_raw],
            "supports": [normalize_support_entry(item) for item in supports_raw],
            "characters": [normalize_character_entry(item) for item in characters_raw],
        }
        save_cached_database(database)
        return database
    except Exception:
        if stale_cached:
            return stale_cached
        raise


def search_uma_database(query: str, entity: str = "all", limit: int = 12) -> dict[str, list[dict[str, Any]]]:
    database = fetch_uma_database()
    normalized_query = normalize_search_text(query)
    if not normalized_query:
        return {"results": []}

    entities = [entity] if entity in {"skills", "supports", "characters"} else ["skills", "supports", "characters"]
    matches: list[dict[str, Any]] = []

    for entity_name in entities:
        for item in database.get(entity_name, []):
            haystack = normalize_search_text(" ".join([
                str(item.get("name", "")),
                str(item.get("jpName", "")),
                str(item.get("subtitle", "")),
                str(item.get("description", "")),
                str(item.get("typeLabel", "")),
            ]))
            if normalized_query not in haystack:
                continue

            matches.append({
                **item,
                "entity": entity_name,
            })

    matches.sort(key=lambda item: (
        0 if normalize_search_text(str(item.get("name", ""))).startswith(normalized_query) else 1,
        str(item.get("name", "")).lower(),
    ))
    return {"results": matches[:limit]}


def get_uma_entity_list(entity: str) -> list[dict[str, Any]]:
    database = fetch_uma_database()
    return database.get(entity, [])


def get_uma_entity_detail(entity: str, item_id: str) -> dict[str, Any]:
    database = fetch_uma_database()
    for item in database.get(entity, []):
        if str(item.get("id")) == str(item_id):
            return item
    raise ValueError(f"{entity[:-1].title()} not found")


def refresh_uma_database_cache() -> dict[str, Any]:
    database = fetch_uma_database(force_refresh=True)
    return {
        "skills": len(database.get("skills", [])),
        "supports": len(database.get("supports", [])),
        "characters": len(database.get("characters", [])),
        "cachedAt": load_cache_store().get("cachedAt", 0.0),
    }


def fetch_manifest() -> dict[str, str]:
    response = requests.get(MANIFEST_URL, timeout=30, headers=REQUEST_HEADERS)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected GameTora manifest payload.")
    return payload


def fetch_dataset(entity: str, manifest: dict[str, str]) -> list[dict[str, Any]]:
    dataset_key = DATASET_KEYS[entity]
    dataset_hash = manifest.get(dataset_key)
    if not dataset_hash:
        raise RuntimeError(f"Missing manifest key for {entity}")

    url = f"{GAMETORA_BASE_URL}/data/umamusume/{dataset_key}.{dataset_hash}.json"
    response = requests.get(url, timeout=60, headers=REQUEST_HEADERS)
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected payload for {entity}")
    return payload


def normalize_skill_entry(item: dict[str, Any]) -> dict[str, Any]:
    skill_id = str(item.get("id", ""))
    skill_url = f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/skills/{skill_id}" if skill_id else f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/skills"
    image_url = ""
    icon_id = item.get("iconid")
    if icon_id is not None:
        image_url = f"{GAMETORA_PUBLIC_BASE_URL}/images/umamusume/skill_icons/skill_icon_{icon_id}.png"
    description = normalize_text(item.get("desc_en") or item.get("endesc") or item.get("jpdesc"))
    type_tags = ensure_list(item.get("type"))

    return {
        "id": skill_id,
        "name": normalize_text(item.get("name_en") or item.get("enname")),
        "jpName": normalize_text(item.get("jpname")),
        "description": description,
        "rarity": format_skill_rarity(item.get("rarity")),
        "typeTags": type_tags,
        "typeLabel": derive_skill_type_label(description, type_tags),
        "cost": item.get("cost"),
        "url": skill_url,
        "imageUrl": image_url,
        "source": "GameTora",
    }


def normalize_support_entry(item: dict[str, Any]) -> dict[str, Any]:
    support_id = str(item.get("support_id", ""))
    url_name = normalize_text(item.get("url_name"))
    url = f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/supports/{url_name}" if url_name else f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/supports"
    image_url = f"{GAMETORA_PUBLIC_BASE_URL}/images/umamusume/supports/support_card_s_{support_id}.png" if support_id else ""
    character_name = normalize_text(item.get("char_name") or item.get("name_en"))
    rarity_label = SUPPORT_RARITY_LABELS.get(int(item.get("rarity", 0) or 0), str(item.get("rarity", "")))
    type_label = format_token(item.get("type"))

    hints = item.get("hints") if isinstance(item.get("hints"), dict) else {}

    return {
        "id": support_id,
        "name": character_name,
        "jpName": normalize_text(item.get("name_jp")),
        "subtitle": f"{rarity_label} {type_label}".strip(),
        "description": f"Hints: {len(ensure_list(hints.get('hint_skills')))} | Events: {len(ensure_list(item.get('event_skills')))}",
        "rarity": rarity_label,
        "typeLabel": type_label,
        "url": url,
        "imageUrl": image_url,
        "source": "GameTora",
    }


def normalize_character_entry(item: dict[str, Any]) -> dict[str, Any]:
    card_id = str(item.get("card_id", ""))
    url_name = normalize_text(item.get("url_name"))
    url = f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/characters/{url_name}" if url_name else f"{GAMETORA_PUBLIC_BASE_URL}/umamusume/characters"
    char_id = str(item.get("char_id", ""))
    char_group = char_id[:4] if len(char_id) >= 4 else char_id
    image_url = (
        f"{GAMETORA_PUBLIC_BASE_URL}/images/umamusume/characters/thumb/chara_stand_{char_group}_{card_id}.png"
        if char_group and card_id
        else ""
    )
    name = normalize_text(item.get("name_en"))
    title = normalize_text(item.get("title_en_gl") or item.get("title"))
    version = format_token(item.get("version"))
    rarity = CHARACTER_RARITY_LABELS.get(int(item.get("rarity", 0) or 0), str(item.get("rarity", "")))

    subtitle_parts = [part for part in [title, version, rarity] if part]
    return {
        "id": card_id,
        "name": name,
        "jpName": normalize_text(item.get("name_jp")),
        "subtitle": " / ".join(subtitle_parts),
        "description": f"Innate: {len(ensure_list(item.get('skills_innate')))} | Event: {len(ensure_list(item.get('skills_event')))}",
        "rarity": rarity,
        "typeLabel": "",
        "url": url,
        "imageUrl": image_url,
        "source": "GameTora",
    }


def load_cached_database(allow_stale: bool = False) -> dict[str, list[dict[str, Any]]] | None:
    cache_store = load_cache_store()
    cached_at = float(cache_store.get("cachedAt", 0.0))
    if cached_at <= 0:
        return None
    if not allow_stale and (time.time() - cached_at) > CACHE_TTL_SECONDS:
        return None

    items = cache_store.get("items")
    if not isinstance(items, dict):
        return None
    return items


def load_cache_store() -> dict[str, Any]:
    global _CACHE_STORE
    if _CACHE_STORE is not None:
        return _CACHE_STORE

    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as file:
            _CACHE_STORE = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        _CACHE_STORE = {"cachedAt": 0.0, "items": {}}

    if not isinstance(_CACHE_STORE, dict):
        _CACHE_STORE = {"cachedAt": 0.0, "items": {}}

    return _CACHE_STORE


def save_cached_database(database: dict[str, list[dict[str, Any]]]) -> None:
    cache_store = load_cache_store()
    cache_store["cachedAt"] = time.time()
    cache_store["items"] = database

    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as file:
        json.dump(cache_store, file, ensure_ascii=False, indent=2)


def normalize_search_text(value: str) -> str:
    text = normalize_text(value).lower()
    replacements = {
        "○": "o",
        "◯": "o",
        "◎": "doubleo",
        "×": "x",
        "・": "",
        "☆": "",
        "★": "",
        "-": "",
        " ": "",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\xa0", " ").split()).strip()


def ensure_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def format_token(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    return text.replace("_", " ").title()


def format_skill_rarity(value: Any) -> str:
    mapping = {
        1: "Normal",
        3: "Gold",
        5: "Unique",
        6: "Evolution",
    }
    try:
        return mapping.get(int(value), str(value))
    except (TypeError, ValueError):
        return normalize_text(value)


def derive_skill_type_label(description: str, type_tags: list[Any]) -> str:
    normalized_description = normalize_text(description).lower()
    normalized_tags = {normalize_text(tag).lower() for tag in type_tags if normalize_text(tag)}

    if "recovery" in normalized_description or "recover endurance" in normalized_description:
        return "Recovery"
    if "acceleration" in normalized_description:
        return "Acceleration"
    if "velocity" in normalized_description or "speed" in normalized_description:
        return "Speed"
    if "intimidat" in normalized_description or "debuff" in normalized_description:
        return "Debuff"
    if {"heal", "hp"} & normalized_tags:
        return "Recovery"
    if {"accel", "acceleration"} & normalized_tags:
        return "Acceleration"
    if {"speed", "velocity", "nac"} & normalized_tags:
        return "Speed"
    if {"debuff"} & normalized_tags:
        return "Debuff"
    if normalized_tags:
        return format_token(next(iter(normalized_tags)))
    return "Other"
