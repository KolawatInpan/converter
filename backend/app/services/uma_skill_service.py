import json
import os
import re
import time
import html
from typing import List, Dict, Any

import requests

from app.services.uma_skill_acquisition_service import find_skill_acquisition_entry


WIKI_API_URL = "https://umamusu.wiki/w/api.php"
CACHE_TTL_SECONDS = 1800
DETAIL_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7
DETAIL_CACHE_PATH = os.path.join(os.path.dirname(__file__), "../data/uma_skill_details_cache.json")
_SKILLS_CACHE: dict[str, Any] = {"timestamp": 0.0, "skills": []}
_DETAILS_CACHE: dict[str, Any] | None = None
TABLE_TYPES = ["basic", "debuff", "rare", "ults", "inherited_ults", "evolved"]
TABLE_TYPE_TO_RARITY = {
    "basic": "normal",
    "debuff": "negative",
    "rare": "rare",
    "ults": "unique",
    "inherited_ults": "inherited",
    "evolved": "rare",
}

DETAIL_FIELD_ALIASES = {
    "duration": "duration",
    "targetspeed": "targetSpeed",
    "targetvelocity": "targetSpeed",
    "targetacceleration": "targetAcceleration",
    "conditions": "conditions",
    "conditionswhenvalidskillhasachancetoactivate": "conditions",
    "preconditions": "preconditions",
    "uniqueskillfor": "uniqueSkillFor",
    "upgradesfrom": "upgradesFrom",
    "upgradesto": "upgradesTo",
    "evolvesfrom": "evolvesFrom",
    "evolvedskillfor": "evolvedSkillFor",
    "evolvedskillforsupportcard": "evolvedSkillFor",
    "evolvedforsupportcard": "evolvedSkillFor",
    "inheritedversionof": "inheritedVersionOf",
    "inheritedinto": "inheritedInto",
    "cooldown": "cooldown",
    "trigger": "trigger",
    "effect": "effect",
}


def build_acquisition_info(
    skill_id: str,
    skill_payload: Dict[str, Any],
    details: Dict[str, str],
) -> Dict[str, Any]:
    support_hint_items: list[dict[str, str]] = []
    support_event_items: list[dict[str, str]] = []
    character_items: list[dict[str, str]] = []
    character_event_items: list[dict[str, str]] = []
    support_hints: list[str] = []
    support_events: list[str] = []
    trainees: list[str] = []
    trainee_events: list[str] = []
    upgrade_paths: list[str] = []
    notes: list[str] = []

    indexed_entry = find_skill_acquisition_entry(skill_payload)

    support_hint_items.extend(indexed_entry.get("supportHints", []))
    support_event_items.extend(indexed_entry.get("supportEvents", []))
    character_items.extend(indexed_entry.get("characters", []))
    character_event_items.extend(indexed_entry.get("characterEvents", []))
    upgrade_paths.extend(indexed_entry.get("upgradePaths", []))
    support_hints.extend(item["label"] for item in support_hint_items if item.get("label"))
    support_events.extend(item["label"] for item in support_event_items if item.get("label"))
    trainees.extend(item["label"] for item in character_items if item.get("label"))
    trainee_events.extend(item["label"] for item in character_event_items if item.get("label"))

    unique_skill_for = details.get("uniqueSkillFor")
    if unique_skill_for:
        trainees.append(unique_skill_for)

    inherited_version_of = details.get("inheritedVersionOf")
    if inherited_version_of:
        trainees.append(f"Inherited version of {inherited_version_of}")

    inherited_into = details.get("inheritedInto")
    if inherited_into:
        trainees.append(f"Can be inherited into {inherited_into}")

    evolved_skill_for = details.get("evolvedSkillFor")
    if evolved_skill_for:
        support_hints.append(evolved_skill_for)
        support_hint_items.append({"label": evolved_skill_for, "url": "", "imageUrl": ""})

    if skill_payload.get("category") == "upgraded_card" and not support_hints:
        support_hints.append("Support card evolution skill")
        support_hint_items.append({"label": "Support card evolution skill", "url": "", "imageUrl": ""})

    if skill_payload.get("category") == "ult" and not trainees:
        trainees.append("Unique skill for a trainee-specific card")

    upgrades_from = sanitize_upgrade_text(details.get("upgradesFrom", ""))
    if upgrades_from:
        upgrade_paths.append(f"Upgrades from {upgrades_from}")

    upgrades_to = sanitize_upgrade_text(details.get("upgradesTo", ""))
    if upgrades_to:
        upgrade_paths.append(f"Upgrades to {upgrades_to}")

    evolves_from = sanitize_upgrade_text(details.get("evolvesFrom", ""))
    if evolves_from:
        upgrade_paths.append(f"Evolves from {evolves_from}")

    if indexed_entry:
        notes.append("Acquisition data is cached locally from GameTora.")
    else:
        notes.append("Showing acquisition info from the current wiki detail fallback only.")

    return {
        "supportHints": unique_text_list(support_hints),
        "supportEvents": unique_text_list(support_events),
        "characters": unique_text_list(trainees),
        "characterEvents": unique_text_list(trainee_events),
        "supportHintItems": unique_link_items(support_hint_items),
        "supportEventItems": unique_link_items(support_event_items),
        "characterItems": unique_link_items(character_items),
        "characterEventItems": unique_link_items(character_event_items),
        "upgradePaths": unique_text_list(upgrade_paths),
        "supportCards": unique_text_list(support_hints),
        "events": unique_text_list(support_events + trainee_events),
        "trainees": unique_text_list(trainees),
        "notes": unique_text_list(notes),
    }


def fetch_uma_skills(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Fetch UMA skills by scraping the wiki skills table.
    Falls back to local JSON data if scraping fails.
    """
    now = time.time()
    cached_skills = _SKILLS_CACHE.get("skills", [])
    cached_at = float(_SKILLS_CACHE.get("timestamp", 0.0))
    if not force_refresh and cached_skills and (now - cached_at) < CACHE_TTL_SECONDS:
        return cached_skills

    try:
        scraped: List[Dict[str, Any]] = []
        seen_ids: set[str] = set()

        for table_type in TABLE_TYPES:
            html_fragment = fetch_skill_table_html(table_type)
            table_skills = parse_skills_from_html(html_fragment, table_type)
            for skill in table_skills:
                skill_id = str(skill.get("id", ""))
                if skill_id and skill_id not in seen_ids:
                    scraped.append(skill)
                    seen_ids.add(skill_id)

        scraped.sort(key=lambda s: int(s.get("id", "0")) if str(s.get("id", "")).isdigit() else 0)
        if scraped:
            _SKILLS_CACHE["skills"] = scraped
            _SKILLS_CACHE["timestamp"] = now
            return scraped
    except Exception as exc:
        print(f"Error scraping UMA skills from invoke tables: {exc}")

    local_skills = load_local_skills()
    _SKILLS_CACHE["skills"] = local_skills
    _SKILLS_CACHE["timestamp"] = now
    return local_skills


def refresh_uma_skills_cache() -> dict[str, Any]:
    """Force refresh skills cache and return cache summary."""
    skills = fetch_uma_skills(force_refresh=True)
    return {
        "totalSkills": len(skills),
        "cachedAt": _SKILLS_CACHE.get("timestamp", 0.0),
    }


def fetch_uma_skill_detail(skill_id: str) -> Dict[str, Any]:
    """Fetch one skill with expanded detail fields from the skill page."""
    skills = fetch_uma_skills()
    base_skill = next((skill for skill in skills if str(skill.get("id")) == str(skill_id)), None)
    if not base_skill:
        raise ValueError("Skill not found")

    cached_detail = load_cached_skill_detail(str(skill_id))
    if cached_detail:
        merged_detail = {**base_skill, **cached_detail}
        cached_details = merged_detail.get("details", {})
        if not isinstance(cached_details, dict):
            cached_details = {}
        merged_detail.setdefault("wikiUrl", f"https://umamusu.wiki/Game:Skills/{skill_id}")
        merged_detail["acquisitionInfo"] = build_acquisition_info(
            str(skill_id),
            merged_detail,
            cached_details,
        )
        return merged_detail

    details: Dict[str, str] = {}
    try:
        html_fragment = fetch_skill_page_html(str(skill_id))
        details = parse_skill_details_from_html(html_fragment)
    except Exception as exc:
        print(f"Warning: failed to fetch detail for skill {skill_id}: {exc}")

    detail_payload: Dict[str, Any] = {
        **base_skill,
        "wikiUrl": f"https://umamusu.wiki/Game:Skills/{skill_id}",
        "details": details,
        "acquisitionInfo": build_acquisition_info(str(skill_id), base_skill, details),
    }

    if "duration" in details:
        detail_payload["duration"] = details["duration"]
    if "targetSpeed" in details:
        detail_payload["targetSpeed"] = details["targetSpeed"]
    if "targetAcceleration" in details:
        detail_payload["targetAcceleration"] = details["targetAcceleration"]
    if "conditions" in details:
        detail_payload["conditions"] = details["conditions"]
    if "preconditions" in details:
        detail_payload["preconditions"] = details["preconditions"]

    save_cached_skill_detail(str(skill_id), detail_payload)
    return detail_payload


def fetch_skill_table_html(table_type: str) -> str:
    """Render one skill table via Lua #invoke and return HTML fragment."""
    invoke_text = f"{{{{#invoke:Game/Skills|skillListTable|{table_type}}}}}"
    response = requests.get(
        WIKI_API_URL,
        params={
            "action": "parse",
            "format": "json",
            "formatversion": "2",
            "contentmodel": "wikitext",
            "prop": "text",
            "text": invoke_text,
        },
        timeout=20,
        headers={"User-Agent": "converter-bot/1.0"},
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("parse", {}).get("text", "")


def fetch_skill_page_html(skill_id: str) -> str:
    """Render one skill page and return HTML fragment."""
    response = requests.get(
        WIKI_API_URL,
        params={
            "action": "parse",
            "format": "json",
            "formatversion": "2",
            "page": f"Game:Skills/{skill_id}",
            "prop": "text",
        },
        timeout=20,
        headers={"User-Agent": "converter-bot/1.0"},
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("parse", {}).get("text", "")


def parse_skills_from_html(html: str, table_type: str) -> List[Dict[str, Any]]:
    """Parse skill rows from rendered Lua table HTML."""
    skills: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", html, flags=re.IGNORECASE | re.DOTALL):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row_html, flags=re.IGNORECASE | re.DOTALL)
        if len(cells) < 6:
            continue

        link_match = re.search(
            r'<a[^>]*href="([^"]*/Game:Skills/\d+)"[^>]*>(.*?)</a>',
            cells[1],
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not link_match:
            continue

        href = link_match.group(1)
        skill_id = extract_skill_id(href)
        if not skill_id or skill_id in seen_ids:
            continue

        name = normalize_text(strip_html(link_match.group(2)))
        if not name:
            continue

        jp_name = ""
        jp_match = re.search(r"<i[^>]*>(.*?)</i>", cells[1], flags=re.IGNORECASE | re.DOTALL)
        if jp_match:
            jp_name = normalize_text(strip_html(jp_match.group(1)))

        icon = ""
        img_match = re.search(r'<img[^>]*src="([^"]+)"', cells[0], flags=re.IGNORECASE)
        if img_match:
            icon = to_absolute_url(img_match.group(1))

        description = normalize_text(strip_html(cells[2]))
        skill_points = parse_int(strip_html(cells[3]))
        eval_points = parse_int(strip_html(cells[4]))
        point_ratio = parse_float(strip_html(cells[5]))

        if point_ratio == 0.0 and skill_points > 0:
            point_ratio = round(eval_points / skill_points, 2)

        skills.append(
            {
                "id": skill_id,
                "name": normalize_text(name),
                "jpName": jp_name,
                "description": description,
                "icon": icon,
                "skillPoints": skill_points,
                "evalPoints": eval_points,
                "pointRatio": point_ratio,
                "rarity": TABLE_TYPE_TO_RARITY.get(table_type, "normal"),
                "category": table_type,
            }
        )
        seen_ids.add(skill_id)

    skills.sort(key=lambda s: int(s.get("id", "0")) if str(s.get("id", "")).isdigit() else 0)
    return skills


def parse_skill_details_from_html(page_html: str) -> Dict[str, str]:
    """Parse key-value rows from infobox/stat tables in a skill page."""
    details: Dict[str, str] = {}

    for row_html in re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, flags=re.IGNORECASE | re.DOTALL):
        header_match = re.search(r"<th[^>]*>(.*?)</th>", row_html, flags=re.IGNORECASE | re.DOTALL)
        value_match = re.search(r"<td[^>]*>(.*?)</td>", row_html, flags=re.IGNORECASE | re.DOTALL)
        if not header_match or not value_match:
            continue

        raw_label = normalize_text(strip_html(header_match.group(1)))
        raw_value = normalize_text(strip_html(value_match.group(1)))
        if not raw_label or not raw_value:
            continue
        if len(raw_label) > 60:
            continue

        key = normalize_detail_key(raw_label)
        if key and key not in details:
            details[key] = raw_value

    plain_text = normalize_text(strip_html(page_html))
    details.update(extract_detail_fields_from_plain_text(plain_text, details))

    return details


def extract_detail_fields_from_plain_text(
    plain_text: str,
    existing_details: Dict[str, str],
) -> Dict[str, str]:
    extracted: Dict[str, str] = {}
    labels = {
        "uniqueSkillFor": "Unique Skill For",
        "evolvedSkillFor": "Evolution For",
        "evolvesFrom": "Evolves From",
        "upgradesFrom": "Upgrades From",
        "upgradesTo": "Upgrades To",
        "inheritedVersionOf": "Inherited Version Of",
        "inheritedInto": "Inherited Into",
        "duration": "Duration",
        "targetSpeed": "Target Speed",
        "targetAcceleration": "Target Acceleration",
        "conditions": "Conditions",
        "preconditions": "Precondition",
    }

    ordered_labels = list(labels.items())
    for key, label in ordered_labels:
        if key in existing_details:
            continue

        pattern = re.escape(label) + r"\s+(.*?)(?=\s+(?:"
        lookaheads = [re.escape(other_label) for other_key, other_label in ordered_labels if other_key != key]
        pattern += "|".join(lookaheads)
        pattern += r")\s+|$)"

        match = re.search(pattern, plain_text, flags=re.IGNORECASE)
        if not match:
            continue

        value = normalize_text(match.group(1))
        if value and value != label:
            extracted[key] = value

    return extracted


def load_details_cache_store() -> dict[str, Any]:
    global _DETAILS_CACHE
    if _DETAILS_CACHE is not None:
        return _DETAILS_CACHE

    try:
        with open(DETAIL_CACHE_PATH, "r", encoding="utf-8") as file:
            _DETAILS_CACHE = json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        _DETAILS_CACHE = {"items": {}}

    if "items" not in _DETAILS_CACHE or not isinstance(_DETAILS_CACHE["items"], dict):
        _DETAILS_CACHE = {"items": {}}

    return _DETAILS_CACHE


def load_cached_skill_detail(skill_id: str) -> Dict[str, Any] | None:
    cache_store = load_details_cache_store()
    items = cache_store.get("items", {})
    cached = items.get(skill_id)
    if not isinstance(cached, dict):
        return None

    cached_at = float(cached.get("cachedAt", 0.0))
    if cached_at <= 0 or (time.time() - cached_at) > DETAIL_CACHE_TTL_SECONDS:
        return None

    payload = cached.get("payload")
    if not isinstance(payload, dict):
        return None

    return payload


def save_cached_skill_detail(skill_id: str, payload: Dict[str, Any]) -> None:
    cache_store = load_details_cache_store()
    cache_store.setdefault("items", {})
    cache_store["items"][skill_id] = {
        "cachedAt": time.time(),
        "payload": payload,
    }

    os.makedirs(os.path.dirname(DETAIL_CACHE_PATH), exist_ok=True)
    with open(DETAIL_CACHE_PATH, "w", encoding="utf-8") as file:
        json.dump(cache_store, file, ensure_ascii=False, indent=2)


def normalize_detail_key(label: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]", "", label.lower())
    if cleaned in DETAIL_FIELD_ALIASES:
        return DETAIL_FIELD_ALIASES[cleaned]
    if not cleaned:
        return ""
    return cleaned


def strip_html(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(without_tags)


def extract_skill_id(href: str) -> str:
    match = re.search(r"/Game:Skills/(\d+)", href)
    if match:
        return match.group(1)
    return ""


def to_absolute_url(path: str) -> str:
    path = html.unescape(path)
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("//"):
        return f"https:{path}"
    if path.startswith("/"):
        return f"https://umamusu.wiki{path}"
    return path


def normalize_text(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


def parse_int(value: str) -> int:
    cleaned = re.sub(r"[^0-9-]", "", value)
    if not cleaned:
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


def parse_float(value: str) -> float:
    cleaned = re.sub(r"[^0-9.\-]", "", value)
    if not cleaned:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def load_local_skills() -> List[Dict[str, Any]]:
    """Load bundled local skills JSON as fallback."""
    skills_file = os.path.join(os.path.dirname(__file__), "../data/uma_skills.json")
    try:
        with open(skills_file, "r", encoding="utf-8") as file:
            data = json.load(file)
        return data.get("skills", [])
    except Exception as exc:
        print(f"Error loading local skills fallback: {exc}")
        return []


def unique_text_list(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []

    for value in values:
        normalized = normalize_text(str(value))
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)

    return result


def unique_link_items(values: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    result: list[dict[str, str]] = []

    for item in values:
        label = normalize_text(str(item.get("label", "")))
        url = normalize_text(str(item.get("url", "")))
        image_url = normalize_text(str(item.get("imageUrl", "")))
        if not label:
            continue
        if label in seen:
            continue
        seen.add(label)
        result.append({"label": label, "url": url, "imageUrl": image_url})

    return result


def sanitize_upgrade_text(value: str) -> str:
    cleaned = normalize_text(value or "")
    if not cleaned:
        return ""

    if ".mw-parser-output" in cleaned:
        cleaned = cleaned.split(".mw-parser-output", 1)[0].strip()

    cleaned = re.sub(r"\{[^}]*\}", " ", cleaned)
    cleaned = re.sub(r"\[[^\]]*\]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if len(cleaned) > 180:
        cleaned = cleaned[:180].rsplit(" ", 1)[0].strip()

    return cleaned
