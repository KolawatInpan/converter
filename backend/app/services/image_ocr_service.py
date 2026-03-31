import re
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from app.services.uma_skill_dictionary import get_uma_skill_candidates, lookup_uma_skill

try:
    import pytesseract
    from pytesseract import TesseractError
except ImportError:  # pragma: no cover - handled at runtime
    pytesseract = None

    class TesseractError(Exception):
        pass


JAPANESE_CHAR_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{2,}")
HIRAGANA_KATAKANA_RE = re.compile(r"^[\u3040-\u30ff]+$")
SYMBOL_ONLY_RE = re.compile(r"^[\-\|_~.。・ー〇○◯/]+$")
REPEATED_DASH_RE = re.compile(r"[ー\-]{3,}")
UMA_JP_TOKEN_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]{2,}")
UMA_ASCII_NOISE_RE = re.compile(r"[A-Za-z0-9]{2,}")
UMA_COMMON_REPLACEMENTS = (
    ("非橋幹", "非根幹"),
    ("橋幹", "根幹"),
    ("距離見", "距離"),
    ("騰ち", "勝ち"),
    ("ワッショイリ", "ワッショイ！"),
    ("ワッショイ!", "ワッショイ！"),
    ("功書", "巧者"),
    ("コーナー巧書", "コーナー巧者"),
    ("オペレーション・C", "オペレーション・Cacao"),
    ("訳ウマ針", "秋ウマ娘"),
    ("秋ウマ嬢", "秋ウマ娘"),
    ("在回り", "左回り"),
    ("石回り", "右回り"),
    ("ぃ", ""),
)


def _upscale_image(image: Image.Image, *, factor: int = 3) -> Image.Image:
    return image.resize((image.width * factor, image.height * factor), Image.Resampling.LANCZOS)


def _load_base_image(input_path: str) -> Image.Image:
    source = Image.open(input_path)
    if source.mode not in {"L", "RGB"}:
        source = source.convert("RGB")
    grayscale = ImageOps.grayscale(source)
    autocontrast = ImageOps.autocontrast(grayscale)
    sharpened = autocontrast.filter(ImageFilter.SHARPEN)
    upscaled = _upscale_image(sharpened)
    high_contrast = ImageEnhance.Contrast(upscaled).enhance(2.6)
    return high_contrast.filter(ImageFilter.MedianFilter(size=3))


def _binarize(image: Image.Image, threshold: int = 175) -> Image.Image:
    return image.point(lambda value: 255 if value > threshold else 0, mode="1").convert("L")


def _strip_noise_characters(text: str) -> str:
    cleaned = text
    for char in ("〇", "○", "◯", "|", "_", "~", "/", "\\"):
        cleaned = cleaned.replace(char, "")
    cleaned = REPEATED_DASH_RE.sub("", cleaned)
    return cleaned.strip(" -ー")


def _normalize_line(text: str) -> str:
    line = _strip_noise_characters(text.strip())
    if not line:
        return ""
    if SYMBOL_ONLY_RE.fullmatch(line):
        return ""
    if len(line) <= 2 and not JAPANESE_CHAR_RE.search(line) and not LATIN_WORD_RE.search(line):
        return ""
    if len(line) <= 3 and HIRAGANA_KATAKANA_RE.fullmatch(line):
        return ""
    return re.sub(r"\s{2,}", " ", line)


def _apply_uma_post_corrections(text: str) -> str:
    corrected = text.strip()
    corrected = corrected.lstrip("・•*|｜ ")
    corrected = UMA_ASCII_NOISE_RE.sub("", corrected)
    corrected = re.sub(r"\s+", "", corrected)

    for before, after in UMA_COMMON_REPLACEMENTS:
        corrected = corrected.replace(before, after)

    corrected = corrected.replace("圈", "回")
    corrected = corrected.replace("圏", "回")
    corrected = corrected.replace("針", "娘")

    corrected = re.sub(r"\s+([!！])", r"\1", corrected)
    corrected = re.sub(r"[ ]{2,}", " ", corrected)
    return corrected.strip()


def _normalize_for_skill_compare(value: str) -> str:
    normalized = value.strip()
    normalized = normalized.replace("〇", "").replace("○", "").replace("◯", "")
    normalized = normalized.replace("|", "").replace("_", "").replace("~", "")
    normalized = re.sub(r"\s+", "", normalized)
    return normalized


def _generate_uma_match_candidates(text: str) -> list[str]:
    base = text.strip()
    if not base:
        return []

    variants = [base]
    variants.extend(UMA_JP_TOKEN_RE.findall(base))

    deduped: list[str] = []
    seen: set[str] = set()
    for variant in variants:
        cleaned = variant.strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            deduped.append(cleaned)
    return deduped


def _merge_ocr_lines(primary_text: str, secondary_text: str) -> list[str]:
    """Merge lines from two OCR passes while preserving order and removing duplicates."""
    merged: list[str] = []
    seen: set[str] = set()

    for source_text in (primary_text, secondary_text):
        for raw_line in source_text.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            key = line.lower()
            if key in seen:
                continue
            seen.add(key)
            merged.append(line)

    return merged


def _levenshtein_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    if not left:
        return len(right)
    if not right:
        return len(left)

    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_char in enumerate(right, start=1):
            insertion = current[right_index - 1] + 1
            deletion = previous[right_index] + 1
            substitution = previous[right_index - 1] + (0 if left_char == right_char else 1)
            current.append(min(insertion, deletion, substitution))
        previous = current
    return previous[-1]


def _similarity_ratio(left: str, right: str) -> float:
    longest = max(len(left), len(right))
    if longest == 0:
        return 1.0
    return 1.0 - (_levenshtein_distance(left, right) / longest)


def _match_uma_skill_name(text: str) -> str:
    raw_candidate = text.strip()
    if not raw_candidate:
        return ""

    candidate_variants = _generate_uma_match_candidates(raw_candidate)
    if not candidate_variants:
        return ""

    normalized_raw = _normalize_for_skill_compare(raw_candidate)

    for candidate in candidate_variants:
        exact_entry = lookup_uma_skill(candidate)
        if exact_entry is not None:
            return str(exact_entry["name"])

    best_match = ""
    best_score = 0.0

    for candidate in candidate_variants:
        normalized_candidate = _normalize_for_skill_compare(candidate)
        if not normalized_candidate:
            continue

        for skill_name in get_uma_skill_candidates():
            normalized_skill = _normalize_for_skill_compare(skill_name)
            if not normalized_skill:
                continue

            score = _similarity_ratio(normalized_candidate, normalized_skill)

            if normalized_candidate in normalized_skill or normalized_skill in normalized_candidate:
                score += 0.14

            if len(normalized_candidate) >= 2 and normalized_candidate[:2] == normalized_skill[:2]:
                score += 0.05

            if score > best_score:
                best_match = skill_name
                best_score = score

    if best_score >= 0.62:
        return best_match

    if UMA_JP_TOKEN_RE.search(raw_candidate):
        return ""

    return raw_candidate


def _ocr_block_text(image: Image.Image) -> str:
    """OCR helper for UI list blocks where one line of text is expected."""
    variants = [
        image,
        _binarize(image, threshold=155),
        _binarize(image, threshold=175),
        _binarize(image, threshold=195),
    ]
    configs = [
        "--oem 3 --psm 7",
        "--oem 3 --psm 6",
        "--oem 3 --psm 13",
    ]

    best_text = ""
    best_score = (-10_000, 0, 0, 0)

    try:
        for variant in variants:
            for config in configs:
                raw_text = pytesseract.image_to_string(variant, lang="jpn+eng", config=config)
                normalized = _normalize_line(raw_text)
                if not normalized:
                    continue
                score = _score_line(normalized)
                if score > best_score:
                    best_text = normalized
                    best_score = score
    finally:
        for variant in variants[1:]:
            variant.close()

    return best_text


def _ocr_by_separator_blocks(image: Image.Image) -> str:
    """Detect horizontal separators and OCR text blocks between them.

    This is useful for list-like UI screenshots where each row contains one skill name.
    """
    width, height = image.size
    left = max(0, int(width * 0.02))
    right = max(left + 1, int(width * 0.76))
    probe = _binarize(image.crop((left, 0, right, height)), threshold=170)
    probe_width, probe_height = probe.size

    separator_rows: list[int] = []
    for y in range(probe_height):
        dark = 0
        for x in range(probe_width):
            if probe.getpixel((x, y)) < 160:
                dark += 1
        # Long thin horizontal line across the row area
        if dark >= max(18, int(probe_width * 0.55)):
            separator_rows.append(y)

    if not separator_rows:
        return ""

    merged_separators: list[int] = []
    start = separator_rows[0]
    end = separator_rows[0]
    for y in separator_rows[1:]:
        if y - end <= 3:
            end = y
            continue
        merged_separators.append((start + end) // 2)
        start = y
        end = y
    merged_separators.append((start + end) // 2)

    boundaries = [0] + merged_separators + [height]
    extracted_lines: list[str] = []
    seen: set[str] = set()

    for index in range(len(boundaries) - 1):
        top = boundaries[index]
        bottom = boundaries[index + 1]
        block_height = bottom - top
        if block_height < max(40, height // 18):
            continue

        # Most UI rows put the label in the upper part of each row block.
        text_top = max(0, top + int(block_height * 0.06))
        text_bottom = min(height, top + int(block_height * 0.42))
        if text_bottom - text_top < 18:
            continue

        block = image.crop((left, text_top, right, text_bottom))
        try:
            line = _ocr_block_text(block)
        finally:
            block.close()

        if not line:
            continue

        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        extracted_lines.append(line)

    return "\n".join(extracted_lines)


def _score_line(text: str) -> tuple[int, int, int, int]:
    japanese_chars = len(JAPANESE_CHAR_RE.findall(text))
    latin_chars = len(re.findall(r"[A-Za-z]", text))
    latin_words = len(LATIN_WORD_RE.findall(text))
    penalty = 0

    if " " in text and japanese_chars > 0:
        penalty += 6
    if re.search(r"[\u4e00-\u9fff]{2,}\s+[\u4e00-\u9fff]{1,3}$", text):
        penalty += 12

    return (
        japanese_chars * 12 + latin_chars * 4 - latin_words * 2 - penalty,
        japanese_chars,
        latin_chars,
        len(text),
    )


def _extract_text_regions(image: Image.Image) -> list[tuple[int, int]]:
    width, height = image.size
    scan_width = max(1, int(width * 0.62))
    binary = _binarize(image)
    rows: list[int] = []

    for y in range(height):
        dark_pixels = 0
        for x in range(scan_width):
            if binary.getpixel((x, y)) < 180:
                dark_pixels += 1
        if dark_pixels >= max(8, scan_width // 35):
            rows.append(y)

    if not rows:
        return []

    regions: list[tuple[int, int]] = []
    start = rows[0]
    end = rows[0]

    for y in rows[1:]:
        if y - end <= max(10, height // 90):
            end = y
            continue
        regions.append((start, end))
        start = y
        end = y
    regions.append((start, end))

    filtered_regions: list[tuple[int, int]] = []
    min_height = max(18, height // 45)
    pad_y = max(8, height // 60)
    for start_y, end_y in regions:
        if end_y - start_y + 1 < min_height:
            continue
        top = max(0, start_y - pad_y)
        bottom = min(height, end_y + pad_y)
        filtered_regions.append((top, bottom))

    return filtered_regions


def _crop_line_image(image: Image.Image, region: tuple[int, int]) -> list[Image.Image]:
    width, _height = image.size
    left = max(0, int(width * 0.03))
    right = max(left + 1, int(width * 0.68))
    top, bottom = region

    line = image.crop((left, top, right, bottom))
    binary_line = _binarize(line)
    return [line, binary_line]


def _ocr_single_line(images: list[Image.Image]) -> str:
    configs = [
        "--oem 3 --psm 7",
        "--oem 3 --psm 13",
    ]
    languages = ["jpn+eng", "jpn"]

    best_text = ""
    best_score = (-10_000, 0, 0, 0)

    for image in images:
        for language in languages:
            for config in configs:
                raw_text = pytesseract.image_to_string(image, lang=language, config=config)
                normalized = _normalize_line(raw_text)
                if not normalized:
                    continue
                score = _score_line(normalized)
                if score > best_score:
                    best_text = normalized
                    best_score = score

    return best_text


def _ocr_by_regions(image: Image.Image) -> str:
    regions = _extract_text_regions(image)
    if not regions:
        return ""

    lines: list[str] = []
    for region in regions:
        line_images = _crop_line_image(image, region)
        try:
            text = _ocr_single_line(line_images)
            if text:
                lines.append(text)
        finally:
            for line_image in line_images:
                line_image.close()

    return "\n".join(lines).strip()


def _ocr_full_image(image: Image.Image) -> str:
    variants = [
        image,
        _binarize(image),
        image.crop((0, 0, max(1, int(image.width * 0.68)), image.height)),
        _binarize(image.crop((0, 0, max(1, int(image.width * 0.68)), image.height))),
    ]
    configs = [
        "--oem 3 --psm 6",
        "--oem 3 --psm 11",
    ]
    languages = ["jpn+eng", "jpn"]

    best_text = ""
    best_score = (-10_000, 0, 0, 0)

    try:
        for variant in variants:
            for language in languages:
                for config in configs:
                    raw_text = pytesseract.image_to_string(variant, lang=language, config=config)
                    normalized_lines = [_normalize_line(line) for line in raw_text.splitlines()]
                    normalized = "\n".join(line for line in normalized_lines if line)
                    if not normalized:
                        continue
                    score = _score_line(normalized.replace("\n", " "))
                    if score > best_score:
                        best_text = normalized
                        best_score = score
    finally:
        for variant in variants[1:]:
            variant.close()

    return best_text


def extract_text_from_image(
    input_path: str,
    *,
    language: str = "jpn+eng",
    mode: str = "default",
) -> dict:
    if pytesseract is None:
        raise RuntimeError(
            "OCR dependencies are not installed. Please install pytesseract and Tesseract OCR."
        )

    image_name = Path(input_path).stem
    processed_image: Image.Image | None = None

    try:
        processed_image = _load_base_image(input_path)
        region_text = _ocr_by_regions(processed_image)
        fallback_text = _ocr_full_image(processed_image)
        separator_text = _ocr_by_separator_blocks(processed_image)

        region_score = _score_line(region_text.replace("\n", " ")) if region_text else (-10_000, 0, 0, 0)
        fallback_score = _score_line(fallback_text.replace("\n", " ")) if fallback_text else (-10_000, 0, 0, 0)
        text = region_text if region_score >= fallback_score else fallback_text
        if mode == "uma-musume":
            merged_primary = "\n".join(_merge_ocr_lines(region_text, fallback_text))
            source_lines = _merge_ocr_lines(merged_primary, separator_text)
            corrected_lines: list[str] = []
            seen_corrected: set[str] = set()
            for line in source_lines:
                corrected = _apply_uma_post_corrections(line)
                corrected = _match_uma_skill_name(corrected)
                if corrected:
                    key = corrected.lower()
                    if key in seen_corrected:
                        continue
                    seen_corrected.add(key)
                    corrected_lines.append(corrected)
            text = "\n".join(corrected_lines)
    except TesseractError as exc:
        raise RuntimeError(
            "Japanese OCR data is not available. Ensure Tesseract language data for 'jpn' is installed."
        ) from exc
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Tesseract OCR is not installed on the server. Please install the Tesseract binary first."
        ) from exc
    finally:
        if processed_image is not None:
            processed_image.close()

    if not text:
        raise ValueError("No text could be recognized from this image.")

    return {
        "filename": image_name,
        "language": language,
        "text": text,
    }
