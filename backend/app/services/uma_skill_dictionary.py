from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path


SKILL_DICTIONARY_PATHS = [
    Path("backend/data/uma_skill_dictionary.json"),
    Path("data/uma_skill_dictionary.json"),
]


def _find_skill_dictionary_path() -> Path | None:
    for path in SKILL_DICTIONARY_PATHS:
        if path.exists():
            return path
    return None


def _normalize_skill_key(value: str) -> str:
    normalized = value.strip()
    normalized = normalized.replace("〇", "").replace("○", "").replace("◯", "")
    normalized = normalized.replace("|", "").replace("_", "").replace("~", "")
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


@lru_cache(maxsize=1)
def load_uma_skill_dictionary() -> list[dict[str, object]]:
    path = _find_skill_dictionary_path()
    if path is None:
        return []

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        return []

    entries: list[dict[str, object]] = []
    for item in data:
        if not isinstance(item, dict):
            continue

        name = item.get("name")
        skill_type = item.get("type", "Unknown")
        aliases = item.get("aliases", [])
        if not isinstance(name, str) or not name.strip():
            continue
        if not isinstance(skill_type, str):
            skill_type = "Unknown"
        if not isinstance(aliases, list):
            aliases = []

        entries.append(
            {
                "name": name.strip(),
                "type": skill_type.strip() or "Unknown",
                "aliases": [alias.strip() for alias in aliases if isinstance(alias, str) and alias.strip()],
            }
        )

    return entries


@lru_cache(maxsize=1)
def build_uma_skill_lookup() -> dict[str, dict[str, object]]:
    lookup: dict[str, dict[str, object]] = {}

    for entry in load_uma_skill_dictionary():
        name = str(entry["name"])
        lookup[_normalize_skill_key(name)] = entry

        for alias in entry.get("aliases", []):
            if isinstance(alias, str):
                lookup[_normalize_skill_key(alias)] = entry

    return lookup


def lookup_uma_skill(name_or_alias: str) -> dict[str, object] | None:
    normalized = _normalize_skill_key(name_or_alias)
    if not normalized:
        return None
    return build_uma_skill_lookup().get(normalized)


def get_uma_skill_candidates() -> list[str]:
    return [str(entry["name"]) for entry in load_uma_skill_dictionary()]
