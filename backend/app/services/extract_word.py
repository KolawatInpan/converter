from janome.tokenizer import Tokenizer
import re

tokenizer = Tokenizer()

ALLOWED_POS = {"名詞", "動詞", "形容詞", "副詞"}
SKIP_WORDS = {"これ", "それ", "あれ", "ここ", "そこ", "あそこ", "こちら", "どこ", "だれ", "なに", "なん"}
KANJI_RE = re.compile(r"^[一-龯]+$")


def get_pos(token):
    return token.part_of_speech.split(",")[0]


def get_base_form(token):
    base_form = token.base_form
    if not base_form or base_form == "*":
        return token.surface
    return base_form


def is_kanji_word(word):
    return bool(KANJI_RE.match(word))


def should_include(surface, pos):
    return pos in ALLOWED_POS and surface not in SKIP_WORDS


def append_unique(words, seen, word):
    if word not in seen:
        words.append(word)
        seen.add(word)


def is_valid_split_part(word, token):
    return (
        len(word) >= 2
        and get_pos(token) == "名詞"
        and token.surface == word
        and get_base_form(token) == word
    )


def merge_kanji_noun_tokens(tokens, start_index):
    merged_surface = ""
    current_index = start_index

    while current_index < len(tokens):
        token = tokens[current_index]
        surface = token.surface
        pos = get_pos(token)

        if pos != "名詞" or not is_kanji_word(surface):
            break

        merged_surface += surface
        current_index += 1

    if current_index - start_index >= 2:
        return merged_surface, current_index

    token = tokens[start_index]
    return get_base_form(token), start_index + 1


def split_compound_noun(word):
    candidates = []

    for i in range(1, len(word)):
        left = word[:i]
        right = word[i:]

        left_tokens = list(tokenizer.tokenize(left))
        right_tokens = list(tokenizer.tokenize(right))

        if len(left_tokens) != 1 or len(right_tokens) != 1:
            continue

        left_token = left_tokens[0]
        right_token = right_tokens[0]

        if not is_valid_split_part(left, left_token):
            continue
        if not is_valid_split_part(right, right_token):
            continue

        score = 0
        score += min(len(left), len(right)) * 10
        score -= abs(len(left) - len(right))

        candidates.append((score, [left, right]))

    if candidates:
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

    return []

def expand_compound_words(surface, pos):
    if pos != "名詞":
        return []
    if not is_kanji_word(surface):
        return []
    if len(surface) < 4:
        return []
    return split_compound_noun(surface)


def extract_words(text):
    result_bases = []
    base_to_surfaces = {}
    tokens = list(tokenizer.tokenize(text))
    index = 0

    while index < len(tokens):
        token = tokens[index]
        pos = get_pos(token)
        merged, next_index = merge_kanji_noun_tokens(tokens, index)

        is_merged = next_index > index + 1
        base = merged
        actual_surface = merged if is_merged else token.surface

        if not should_include(base, pos):
            index = next_index
            continue

        if base not in base_to_surfaces:
            base_to_surfaces[base] = []
            result_bases.append(base)

        if actual_surface not in base_to_surfaces[base]:
            base_to_surfaces[base].append(actual_surface)

        for sub_word in expand_compound_words(merged, pos):
            if sub_word not in base_to_surfaces:
                base_to_surfaces[sub_word] = [sub_word]
                result_bases.append(sub_word)

        index = next_index

    return [{"base": b, "surfaces": base_to_surfaces[b]} for b in result_bases]


def extract_words_from_multiple_texts(texts):
    all_bases = []
    base_to_surfaces = {}

    for text in texts:
        for entry in extract_words(text):
            base = entry["base"]
            if base not in base_to_surfaces:
                base_to_surfaces[base] = []
                all_bases.append(base)
            for surface in entry["surfaces"]:
                if surface not in base_to_surfaces[base]:
                    base_to_surfaces[base].append(surface)

    return [{"base": b, "surfaces": base_to_surfaces[b]} for b in all_bases]
