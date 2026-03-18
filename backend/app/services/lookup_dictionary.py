from __future__ import annotations

import gzip
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path

from janome.tokenizer import Tokenizer

tokenizer = Tokenizer()

JMDICT_PATHS = [
    Path("backend/data/JMdict_e"),
    Path("backend/data/JMdict_e.xml"),
    Path("backend/data/JMdict_e.gz"),
    Path("backend/data/JMdict"),
    Path("backend/data/JMdict.xml"),
    Path("backend/data/JMdict.gz"),
    Path("data/JMdict_e"),
    Path("data/JMdict_e.xml"),
    Path("data/JMdict_e.gz"),
]

POS_LABELS = {
    "n": "noun",
    "adj-i": "i-adjective",
    "adj-na": "na-adjective",
    "vs": "suru verb",
    "v1": "ichidan verb",
    "v5u": "godan verb",
    "vt": "transitive verb",
    "vi": "intransitive verb",
    "adv": "adverb",
    "exp": "expression",
    "pn": "pronoun",
    "noun (common) (futsuumeishi)": "普通名詞",
    "noun or participle which takes the aux. verb suru": "サ変名詞",
    "noun (temporal) (jisoumeishi)": "時相名詞",
    "adjective (keiyoushi)": "形容詞",
    "adjectival noun (keiyodoshi)": "形容動詞",
    "Godan verb with 'u' ending": "五段動詞",
    "Ichidan verb": "一段動詞",
    "transitive verb": "他動詞",
    "intransitive verb": "自動詞",
    "adverb (fukushi)": "副詞",
    "expression (phrase, clause, etc.)": "表現",
    "pronoun": "代名詞",
    "adjectival nouns or quasi-adjectives (keiyodoshi)": "形容動詞",
    "interjection (kandoushi)": "感動詞",
    "nouns which may take the genitive case particle 'no'": "連体修飾可能",
    "noun, used as a suffix": "接尾語",
    "noun, used as a prefix": "接頭語",
    "counter": "助数詞",
    "pre-noun adjectival (rentaishi)": "連体詞",
    "auxiliary adjective": "補助形容詞",
    "auxiliary verb": "補助動詞",
    "conjunction": "接続詞",
    "copula": "コピュラ",
    "prefix": "接頭辞",
    "suffix": "接尾辞",
    "particle": "助詞",
    "proper noun": "固有名詞",
    "numeric": "数詞",
}

MOCK_DICTIONARY = {
    "大統領": [
        {
            "word": "大統領",
            "reading": "だいとうりょう",
            "pos": ["noun"],
            "meanings": [
                "president (of a nation)",
                "(familiar language) big man, boss, buddy, mate (used vocatively; especially of an actor)",
            ],
        }
    ],
    "寒い": [
        {
            "word": "寒い",
            "reading": "さむい",
            "pos": ["i-adjective"],
            "meanings": [
                "cold (of weather or air)",
                "chilly",
            ],
        }
    ],
    "河川": [
        {
            "word": "河川",
            "reading": "かせん",
            "pos": ["noun"],
            "meanings": [
                "river",
                "stream",
            ],
        }
    ],
    "使う": [
        {
            "word": "使う",
            "reading": "つかう",
            "pos": ["godan verb", "transitive verb"],
            "meanings": [
                "to use",
                "to make use of",
                "to employ",
            ],
        }
    ],
    "一番人気": [
        {
            "word": "一番人気",
            "reading": "いちばんにんき",
            "pos": ["noun"],
            "meanings": [
                "most popular",
                "top favorite",
            ],
        }
    ],
}


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


def build_furigana_segments(word: str, reading: str) -> list[dict[str, str]]:
    stripped_word = word.strip()
    if not stripped_word:
        return []

    token_segments = [
        {
            "text": token.surface,
            "furigana": "" if token.surface == get_token_reading(token) else get_token_reading(token),
        }
        for token in tokenizer.tokenize(stripped_word)
    ]

    token_reading = "".join(segment["furigana"] or segment["text"] for segment in token_segments)
    if token_segments and token_reading == reading:
        return token_segments

    return [
        {
            "text": stripped_word,
            "furigana": "" if stripped_word == reading else reading,
        }
    ]


def build_dictionary_entry(entry: dict[str, object]) -> dict[str, object]:
    word = str(entry["word"])
    reading = str(entry["reading"])
    return {
        "word": word,
        "furigana": reading,
        "segments": build_furigana_segments(word, reading),
        "pos": list(entry["pos"]),
        "meanings": list(entry["meanings"]),
    }


def find_jmdict_path() -> Path | None:
    for path in JMDICT_PATHS:
        if path.exists():
            return path
    return None


def open_jmdict(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return path.open("r", encoding="utf-8")


def normalize_pos_values(raw_values: list[str]) -> list[str]:
    normalized = []
    for raw in raw_values:
        cleaned = raw.strip()
        if not cleaned:
            continue

        if cleaned.startswith("&") and cleaned.endswith(";"):
            cleaned = cleaned[1:-1]

        normalized.append(POS_LABELS.get(cleaned, cleaned))

    deduped = []
    seen = set()
    for value in normalized:
        if value not in seen:
            deduped.append(value)
            seen.add(value)
    return deduped


def parse_entry(entry_elem: ET.Element) -> dict[str, object] | None:
    kebs = [elem.text for elem in entry_elem.findall("./k_ele/keb") if elem.text]
    rebs = [elem.text for elem in entry_elem.findall("./r_ele/reb") if elem.text]

    word = kebs[0] if kebs else (rebs[0] if rebs else None)
    reading = rebs[0] if rebs else word
    if not word or not reading:
        return None

    glosses = []
    pos_values = []

    for sense in entry_elem.findall("./sense"):
        for pos in sense.findall("pos"):
            if pos.text:
                pos_values.append(pos.text)
        for gloss in sense.findall("gloss"):
            if gloss.text:
                glosses.append(gloss.text.strip())

    if not glosses:
        return None

    return {
        "word": word,
        "reading": reading,
        "pos": normalize_pos_values(pos_values),
        "meanings": glosses,
    }


@lru_cache(maxsize=1)
def load_jmdict_index() -> dict[str, list[dict[str, object]]]:
    path = find_jmdict_path()
    if path is None:
        return {}

    index: dict[str, list[dict[str, object]]] = {}

    with open_jmdict(path) as handle:
        context = ET.iterparse(handle, events=("end",))
        for _, elem in context:
            if elem.tag != "entry":
                continue

            parsed = parse_entry(elem)
            if parsed is None:
                elem.clear()
                continue

            keys = {str(parsed["word"]), str(parsed["reading"])}
            for key in keys:
                index.setdefault(key, []).append(parsed)

            elem.clear()

    return index


def lookup_mock_dictionary(query: str) -> list[dict[str, object]]:
    matched_entries = []
    for word, entries in MOCK_DICTIONARY.items():
        if query == word or query in word or word in query:
            matched_entries.extend(entries)
    return matched_entries


def lookup_exact_dictionary_entries(query: str) -> list[dict[str, object]]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    index = load_jmdict_index()
    if index and normalized_query in index:
        return dedupe_entries(index[normalized_query])

    if normalized_query in MOCK_DICTIONARY:
        return dedupe_entries(MOCK_DICTIONARY[normalized_query])

    return []


def get_query_tokens(query: str) -> list[str]:
    tokens = []
    for token in tokenizer.tokenize(query):
        surface = token.surface.strip()
        if len(surface) <= 1:
            continue
        tokens.append(surface)
    return tokens


def dedupe_entries(entries: list[dict[str, object]]) -> list[dict[str, object]]:
    deduped = []
    seen = set()

    for entry in entries:
        key = (str(entry["word"]), str(entry["reading"]))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)

    return deduped


def lookup_jmdict(query: str) -> list[dict[str, object]]:
    index = load_jmdict_index()
    if not index:
        return []

    query_tokens = get_query_tokens(query)
    if len(query_tokens) >= 2:
        token_matches = []
        for token in query_tokens:
            token_matches.extend(index.get(token, []))
        if token_matches:
            return dedupe_entries(token_matches)

    direct_matches = index.get(query, [])
    if direct_matches:
        return dedupe_entries(direct_matches)

    partial_matches = []
    for key, entries in index.items():
        if len(key.strip()) <= 1:
            continue
        if query in key or key in query:
            partial_matches.extend(entries)
            if len(partial_matches) >= 10:
                break
    return dedupe_entries(partial_matches)


def lookup_dictionary(query: str) -> dict[str, object]:
    normalized_query = query.strip()
    if not normalized_query:
        return {"query": "", "results": [], "source": "none"}

    matched_entries = lookup_jmdict(normalized_query)
    source = "jmdict"

    if not matched_entries:
        matched_entries = lookup_mock_dictionary(normalized_query)
        source = "mock"

    return {
        "query": normalized_query,
        "results": [build_dictionary_entry(entry) for entry in matched_entries],
        "source": source,
    }
