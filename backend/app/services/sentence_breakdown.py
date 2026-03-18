from __future__ import annotations

import re

from janome.tokenizer import Tokenizer

from app.services.lookup_dictionary import lookup_dictionary, lookup_exact_dictionary_entries

tokenizer = Tokenizer()

KANJI_RE = re.compile(r"^[一-龯]+$")
LOOKUP_POS = {"名詞", "動詞", "形容詞", "副詞"}


def get_base_form(token) -> str:
    base_form = token.base_form
    if not base_form or base_form == "*":
        return token.surface
    return base_form


def get_pos_label(token) -> str:
    return token.part_of_speech.split(",")[0]


def katakana_to_hiragana(text: str) -> str:
    result = []
    for char in text:
        code = ord(char)
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))
        else:
            result.append(char)
    return "".join(result)


def get_token_reading(token) -> str:
    reading = token.reading
    if not reading or reading == "*":
        return token.surface
    return katakana_to_hiragana(reading)


def is_kanji_word(word: str) -> bool:
    return bool(KANJI_RE.match(word))


def merge_kanji_noun_tokens(tokens, start_index: int) -> tuple[dict[str, str], int]:
    merged_surface = ""
    merged_reading = ""
    current_index = start_index

    while current_index < len(tokens):
        token = tokens[current_index]
        if get_pos_label(token) != "名詞" or not is_kanji_word(token.surface):
            break

        merged_surface += token.surface
        merged_reading += get_token_reading(token)
        current_index += 1

    if current_index - start_index >= 2 and lookup_exact_dictionary_entries(merged_surface):
        return (
            {
                "surface": merged_surface,
                "base": merged_surface,
                "reading": merged_reading,
                "pos": "名詞",
            },
            current_index,
        )

    token = tokens[start_index]
    return (
        {
            "surface": token.surface,
            "base": get_base_form(token),
            "reading": get_token_reading(token),
            "pos": get_pos_label(token),
        },
        start_index + 1,
    )


def lookup_first_dictionary_match(*queries: str) -> dict[str, object] | None:
    for query in queries:
        normalized = query.strip()
        if not normalized:
            continue

        exact_matches = lookup_exact_dictionary_entries(normalized)
        if exact_matches:
            return exact_matches[0]

        result = lookup_dictionary(normalized)
        for entry in result["results"]:
            if entry["word"] == normalized:
                return entry
        if result["results"]:
            return result["results"][0]
    return None


def get_dictionary_reading(entry: dict[str, object], fallback: str) -> str:
    if "furigana" in entry and isinstance(entry["furigana"], str):
        return entry["furigana"]
    if "reading" in entry and isinstance(entry["reading"], str):
        return entry["reading"]
    return fallback


def breakdown_sentence(text: str) -> dict[str, object]:
    tokens = list(tokenizer.tokenize(text))
    analyzed_tokens = []
    index = 0

    while index < len(tokens):
        token_info, next_index = merge_kanji_noun_tokens(tokens, index)
        dictionary_entry = None
        if token_info["pos"] in LOOKUP_POS:
            dictionary_entry = lookup_first_dictionary_match(token_info["base"], token_info["surface"])

        analyzed_tokens.append(
            {
                "surface": token_info["surface"],
                "base": token_info["base"],
                "reading": token_info["reading"],
                "base_reading": get_dictionary_reading(dictionary_entry, token_info["reading"]) if dictionary_entry else token_info["reading"],
                "pos": token_info["pos"],
                "dictionary_pos": list(dictionary_entry["pos"]) if dictionary_entry else [],
                "meanings": list(dictionary_entry["meanings"][:3]) if dictionary_entry else [],
                "dictionary_word": str(dictionary_entry["word"]) if dictionary_entry else token_info["base"],
            }
        )
        index = next_index

    return {
        "text": text,
        "tokens": analyzed_tokens,
    }
