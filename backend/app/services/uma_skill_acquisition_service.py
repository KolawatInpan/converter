import ast
import json
import os
import time
from typing import Any

import requests


GAMETORA_BASE_URL = "https://beta.gametora.com"
GAMETORA_MANIFEST_URL = f"{GAMETORA_BASE_URL}/data/manifests/umamusume.json"
ACQUISITION_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
ACQUISITION_CACHE_PATH = os.path.join(
    os.path.dirname(__file__),
    "../data/uma_skill_acquisition_cache.json",
)
REQUEST_HEADERS = {"User-Agent": "converter-bot/1.0"}
SUPPORT_RARITY_LABELS = {1: "R", 2: "SR", 3: "SSR"}
SUPPORT_BASE_URL = "https://gametora.com/umamusume/supports"
CHARACTER_BASE_URL = "https://gametora.com/umamusume/characters"

_ACQUISITION_CACHE: dict[str, Any] | None = None


def fetch_skill_acquisition_index(force_refresh: bool = False) -> dict[str, dict[str, list[dict[str, str]]]]:
    cached = load_cached_acquisition_index()
    if cached and not force_refresh:
        return cached

    try:
        manifest = fetch_gametora_manifest()
        skills = fetch_gametora_dataset("skills", manifest)
        support_cards = fetch_gametora_dataset("support-cards", manifest)
        character_cards = fetch_gametora_dataset("character-cards", manifest)

        index = build_skill_acquisition_index(skills, support_cards, character_cards)
        save_cached_acquisition_index(index, build_skill_name_index(skills))
        return index
    except Exception as exc:
        print(f"Warning: failed to refresh GameTora acquisition cache: {exc}")
        stale = load_stale_acquisition_index()
        if stale:
            return stale
        return {}


def fetch_gametora_manifest() -> dict[str, str]:
    response = requests.get(
        GAMETORA_MANIFEST_URL,
        timeout=30,
        headers=REQUEST_HEADERS,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("Unexpected GameTora manifest response.")
    return payload


def fetch_gametora_dataset(dataset_key: str, manifest: dict[str, str]) -> list[dict[str, Any]]:
    dataset_hash = manifest.get(dataset_key)
    if not dataset_hash:
        raise RuntimeError(f"Missing GameTora dataset key: {dataset_key}")

    dataset_url = f"{GAMETORA_BASE_URL}/data/umamusume/{dataset_key}.{dataset_hash}.json"
    response = requests.get(
        dataset_url,
        timeout=60,
        headers=REQUEST_HEADERS,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise RuntimeError(f"Unexpected GameTora dataset payload for {dataset_key}.")
    return payload


def build_skill_acquisition_index(
    skills: list[dict[str, Any]],
    support_cards: list[dict[str, Any]],
    character_cards: list[dict[str, Any]],
) -> dict[str, dict[str, list[dict[str, str]]]]:
    index: dict[str, dict[str, list[dict[str, str]]]] = {}
    skill_names: dict[str, str] = {}

    for skill in skills:
        skill_id = normalize_skill_id(skill.get("id"))
        if not skill_id:
            continue

        skill_names[skill_id] = get_skill_name(skill)
        ensure_skill_index_entry(index, skill_id)

        gene_version = skill.get("gene_version")
        if isinstance(gene_version, dict):
            inherited_id = normalize_skill_id(gene_version.get("id"))
            if inherited_id:
                skill_names[inherited_id] = get_skill_name(gene_version)
                ensure_skill_index_entry(index, inherited_id)

    for support_card in support_cards:
        item = build_support_card_item(support_card)
        if not item:
            continue

        hints = support_card.get("hints")
        if isinstance(hints, dict):
            for hinted_skill_id in ensure_list(hints.get("hint_skills")):
                skill_id = normalize_skill_id(hinted_skill_id)
                if skill_id:
                    add_unique_item(ensure_skill_index_entry(index, skill_id)["supportHints"], item)

        for event_skill_id in ensure_list(support_card.get("event_skills")):
            skill_id = normalize_skill_id(event_skill_id)
            if skill_id:
                add_unique_item(ensure_skill_index_entry(index, skill_id)["supportEvents"], item)

    for character_card in character_cards:
        item = build_character_card_item(character_card)
        if not item:
            continue

        direct_skill_ids = (
            ensure_list(character_card.get("skills_innate"))
            + ensure_list(character_card.get("skills_awakening"))
            + ensure_list(character_card.get("skills_unique"))
        )
        for evo_item in ensure_list(character_card.get("skills_evo")):
            if isinstance(evo_item, dict):
                direct_skill_ids.append(evo_item.get("new"))
                direct_skill_ids.append(evo_item.get("old"))

        for direct_skill_id in direct_skill_ids:
            skill_id = normalize_skill_id(direct_skill_id)
            if skill_id:
                add_unique_item(ensure_skill_index_entry(index, skill_id)["characters"], item)

        for event_skill_id in ensure_list(character_card.get("skills_event")):
            skill_id = normalize_skill_id(event_skill_id)
            if skill_id:
                add_unique_item(ensure_skill_index_entry(index, skill_id)["characterEvents"], item)

    for skill in skills:
        skill_id = normalize_skill_id(skill.get("id"))
        if not skill_id:
            continue

        pre_evo = skill.get("pre_evo")
        if isinstance(pre_evo, dict):
            old_skill_id = normalize_skill_id(pre_evo.get("old"))
            if old_skill_id:
                add_unique(
                    ensure_skill_index_entry(index, old_skill_id)["upgradePaths"],
                    f"Evolves into {skill_names.get(skill_id, skill_id)}",
                )
                add_unique(
                    ensure_skill_index_entry(index, skill_id)["upgradePaths"],
                    f"Evolves from {skill_names.get(old_skill_id, old_skill_id)}",
                )

        gene_version = skill.get("gene_version")
        if isinstance(gene_version, dict):
            inherited_id = normalize_skill_id(gene_version.get("id"))
            if inherited_id:
                add_unique(
                    ensure_skill_index_entry(index, skill_id)["upgradePaths"],
                    f"Inherited version: {skill_names.get(inherited_id, inherited_id)}",
                )
                add_unique(
                    ensure_skill_index_entry(index, inherited_id)["upgradePaths"],
                    f"Inherited from {skill_names.get(skill_id, skill_id)}",
                )

    for entry in index.values():
        for key in ("supportHints", "supportEvents", "characters", "characterEvents"):
            entry[key] = sorted(entry[key], key=lambda item: item.get("label", "").lower())
        entry["upgradePaths"] = sorted(entry["upgradePaths"], key=str.lower)

    return index


def find_skill_acquisition_entry(skill_payload: dict[str, Any]) -> dict[str, Any]:
    cache_store = load_acquisition_cache_store()
    items = normalize_cached_index(cache_store.get("items", {}))

    skill_id = normalize_skill_id(skill_payload.get("id"))
    if skill_id and skill_id in items:
        return items[skill_id]

    name_index = normalize_name_index(cache_store.get("nameIndex", {}))
    candidate_keys = [
        normalize_skill_lookup_key(skill_payload.get("name")),
        normalize_skill_lookup_key(skill_payload.get("jpName")),
    ]

    for key in candidate_keys:
        matched_skill_id = name_index.get(key)
        if matched_skill_id and matched_skill_id in items:
            return items[matched_skill_id]

    return {}


def load_cached_acquisition_index() -> dict[str, dict[str, list[dict[str, str]]]] | None:
    cache_store = load_acquisition_cache_store()
    cached_at = float(cache_store.get("cachedAt", 0.0))
    if cached_at <= 0 or (time.time() - cached_at) > ACQUISITION_CACHE_TTL_SECONDS:
        return None

    items = cache_store.get("items")
    if not isinstance(items, dict):
        return None
    return normalize_cached_index(items)


def load_stale_acquisition_index() -> dict[str, dict[str, list[dict[str, str]]]] | None:
    cache_store = load_acquisition_cache_store()
    items = cache_store.get("items")
    if not isinstance(items, dict):
        return None
    return normalize_cached_index(items)


def load_acquisition_cache_store() -> dict[str, Any]:
    global _ACQUISITION_CACHE
    if _ACQUISITION_CACHE is not None:
        return _ACQUISITION_CACHE

    try:
        with open(ACQUISITION_CACHE_PATH, "r", encoding="utf-8") as file:
            _ACQUISITION_CACHE = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        _ACQUISITION_CACHE = {"cachedAt": 0.0, "items": {}, "nameIndex": {}}

    if not isinstance(_ACQUISITION_CACHE, dict):
        _ACQUISITION_CACHE = {"cachedAt": 0.0, "items": {}, "nameIndex": {}}

    if "items" not in _ACQUISITION_CACHE or not isinstance(_ACQUISITION_CACHE["items"], dict):
        _ACQUISITION_CACHE["items"] = {}
    if "nameIndex" not in _ACQUISITION_CACHE or not isinstance(_ACQUISITION_CACHE["nameIndex"], dict):
        _ACQUISITION_CACHE["nameIndex"] = {}

    return _ACQUISITION_CACHE


def save_cached_acquisition_index(
    index: dict[str, dict[str, list[dict[str, str]]]],
    name_index: dict[str, str] | None = None,
) -> None:
    cache_store = load_acquisition_cache_store()
    cache_store["cachedAt"] = time.time()
    cache_store["items"] = index
    cache_store["nameIndex"] = name_index or {}

    os.makedirs(os.path.dirname(ACQUISITION_CACHE_PATH), exist_ok=True)
    with open(ACQUISITION_CACHE_PATH, "w", encoding="utf-8") as file:
        json.dump(cache_store, file, ensure_ascii=False, indent=2)


def ensure_skill_index_entry(
    index: dict[str, dict[str, list[Any]]],
    skill_id: str,
) -> dict[str, list[Any]]:
    if skill_id not in index:
        index[skill_id] = {
            "supportHints": [],
            "supportEvents": [],
            "characters": [],
            "characterEvents": [],
            "upgradePaths": [],
        }
    return index[skill_id]


def build_support_card_label(card: dict[str, Any]) -> str:
    name = normalize_label_text(card.get("char_name") or card.get("name_en"))
    rarity_label = SUPPORT_RARITY_LABELS.get(int(card.get("rarity", 0) or 0), "")
    support_type = format_token(card.get("type"))

    if name and rarity_label and support_type:
        return f"{name} ({rarity_label} {support_type})"
    if name and rarity_label:
        return f"{name} ({rarity_label})"
    return name


def build_support_card_item(card: dict[str, Any]) -> dict[str, str] | None:
    label = build_support_card_label(card)
    if not label:
        return None

    url_name = normalize_label_text(card.get("url_name"))
    support_id = normalize_label_text(card.get("support_id"))
    return {
        "label": label,
        "url": f"{SUPPORT_BASE_URL}/{url_name}" if url_name else "",
        "imageUrl": f"https://gametora.com/images/umamusume/supports/support_card_s_{support_id}.png"
        if support_id
        else "",
    }


def build_character_card_label(card: dict[str, Any]) -> str:
    name = normalize_label_text(card.get("name_en") or card.get("char_name"))
    version = format_token(card.get("version"))
    title = normalize_label_text(card.get("title_en_gl") or card.get("title"))

    if name and version:
        return f"{name} ({version})"
    if name and title and title not in name:
        return f"{name} {title}"
    return name


def build_character_card_item(card: dict[str, Any]) -> dict[str, str] | None:
    label = build_character_card_label(card)
    if not label:
        return None

    url_name = normalize_label_text(card.get("url_name"))
    card_id = normalize_label_text(card.get("card_id"))
    char_id = normalize_label_text(card.get("char_id"))
    char_group = char_id[:4] if len(char_id) >= 4 else char_id
    return {
        "label": label,
        "url": f"{CHARACTER_BASE_URL}/{url_name}" if url_name else "",
        "imageUrl": (
            f"https://gametora.com/images/umamusume/characters/thumb/chara_stand_{char_group}_{card_id}.png"
            if char_group and card_id
            else ""
        ),
    }


def get_skill_name(skill: dict[str, Any]) -> str:
    return normalize_label_text(
        skill.get("jpname")
        or skill.get("name_en")
        or skill.get("enname")
        or skill.get("name_jp")
        or skill.get("id")
    )


def ensure_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def normalize_skill_id(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text if text.isdigit() else ""


def normalize_label_text(value: Any) -> str:
    if value is None:
        return ""
    text = " ".join(str(value).replace("\xa0", " ").split())
    return text.strip()


def format_token(value: Any) -> str:
    text = normalize_label_text(value)
    if not text:
        return ""
    return text.replace("_", " ").title()


def add_unique(items: list[str], value: str) -> None:
    normalized = normalize_label_text(value)
    if normalized and normalized not in items:
        items.append(normalized)


def add_unique_item(items: list[dict[str, str]], item: dict[str, str]) -> None:
    label = normalize_label_text(item.get("label"))
    url = normalize_label_text(item.get("url"))
    image_url = normalize_label_text(item.get("imageUrl"))
    if not label:
        return

    for existing in items:
        if normalize_label_text(existing.get("label")) == label:
            if url and not normalize_label_text(existing.get("url")):
                existing["url"] = url
            if image_url and not normalize_label_text(existing.get("imageUrl")):
                existing["imageUrl"] = image_url
            return

    items.append({"label": label, "url": url, "imageUrl": image_url})


def normalize_cached_index(
    items: dict[str, Any],
) -> dict[str, dict[str, list[dict[str, str]]]]:
    normalized_index: dict[str, dict[str, list[dict[str, str]]]] = {}

    for skill_id, entry in items.items():
        if not isinstance(entry, dict):
            continue

        normalized_entry = ensure_skill_index_entry(normalized_index, str(skill_id))
        for key in ("supportHints", "supportEvents", "characters", "characterEvents"):
            normalized_entry[key] = normalize_cached_item_list(entry.get(key))
        normalized_entry["upgradePaths"] = normalize_cached_text_list(entry.get("upgradePaths"))

    return normalized_index


def normalize_cached_item_list(value: Any) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    if not isinstance(value, list):
        return normalized

    for item in value:
        if isinstance(item, dict):
            add_unique_item(
                normalized,
                {
                    "label": normalize_label_text(item.get("label")),
                    "url": normalize_label_text(item.get("url")),
                    "imageUrl": normalize_label_text(item.get("imageUrl")),
                },
            )
        elif isinstance(item, str):
            parsed_item = try_parse_cached_item_string(item)
            if parsed_item:
                add_unique_item(normalized, parsed_item)
            else:
                add_unique_item(normalized, {"label": item, "url": "", "imageUrl": ""})

    return normalized


def normalize_cached_text_list(value: Any) -> list[str]:
    normalized: list[str] = []
    if not isinstance(value, list):
        return normalized

    for item in value:
        if isinstance(item, str):
            add_unique(normalized, item)

    return normalized


def build_skill_name_index(skills: list[dict[str, Any]]) -> dict[str, str]:
    name_index: dict[str, str] = {}

    for skill in skills:
        skill_id = normalize_skill_id(skill.get("id"))
        if not skill_id:
            continue

        for raw_name in (
            skill.get("jpname"),
            skill.get("name_en"),
            skill.get("enname"),
            skill.get("name_jp"),
        ):
            key = normalize_skill_lookup_key(raw_name)
            if key and key not in name_index:
                name_index[key] = skill_id

    return name_index


def normalize_name_index(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, str] = {}
    for key, skill_id in value.items():
        normalized_key = normalize_skill_lookup_key(key)
        normalized_id = normalize_skill_id(skill_id)
        if normalized_key and normalized_id:
            normalized[normalized_key] = normalized_id
    return normalized


def normalize_skill_lookup_key(value: Any) -> str:
    text = normalize_label_text(value)
    if not text:
        return ""

    text = (
        text.replace("\u25cb", "o")
        .replace("\u25ef", "o")
        .replace("\u25ce", "doubleo")
        .replace("\u00d7", "x")
        .replace("\u30fb", "")
        .replace("\u2606", "")
        .replace("\u2605", "")
    )

    text = text.lower()
    text = "".join(ch for ch in text if ch.isalnum())
    return text


def try_parse_cached_item_string(value: str) -> dict[str, str] | None:
    text = normalize_label_text(value)
    if not text.startswith("{") or "label" not in text:
        return None

    try:
        parsed = ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return None

    if not isinstance(parsed, dict):
        return None

    return {
        "label": normalize_label_text(parsed.get("label")),
        "url": normalize_label_text(parsed.get("url")),
        "imageUrl": normalize_label_text(parsed.get("imageUrl")),
    }
