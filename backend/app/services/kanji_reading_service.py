from __future__ import annotations

import re
from typing import Iterable

import pytesseract
from PIL import Image, ImageChops, ImageFilter, ImageOps
from pytesseract import Output

from app.services.lookup_dictionary import lookup_dictionary

KANJI_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]")
MAX_CANDIDATES = 8
MAX_VARIANTS = 6


def _load_image(image_path: str) -> Image.Image:
    try:
        image = Image.open(image_path)
        return image.convert("RGBA")
    except OSError as exc:
        raise ValueError("Unable to read the handwriting image.") from exc


def _trim_whitespace(image: Image.Image) -> Image.Image:
    background = Image.new(image.mode, image.size, "white")
    difference = ImageChops.difference(image, background)
    bbox = difference.getbbox()
    if bbox is None:
        return image

    cropped = image.crop(bbox)
    width, height = cropped.size
    pad_x = max(12, width // 8)
    pad_y = max(12, height // 8)
    canvas = Image.new(image.mode, (width + pad_x * 2, height + pad_y * 2), "white")
    canvas.paste(cropped, (pad_x, pad_y))
    return canvas


def _prepare_variants(image: Image.Image) -> list[Image.Image]:
    base = _trim_whitespace(image).convert("L")
    variants: list[Image.Image] = []

    for scale in (3, 4):
        resized = base.resize((base.width * scale, base.height * scale), Image.Resampling.LANCZOS)
        autocontrast = ImageOps.autocontrast(resized)
        variants.append(autocontrast)
        variants.append(autocontrast.filter(ImageFilter.MedianFilter(size=3)))

        for threshold in (165, 195):
            binary = autocontrast.point(lambda pixel, t=threshold: 255 if pixel > t else 0, mode="1")
            variants.append(binary.convert("L"))

    return variants[:MAX_VARIANTS]


def _extract_first_kanji(text: str) -> str | None:
    match = KANJI_PATTERN.search(text)
    return match.group(0) if match else None


def _iter_candidate_reads(image: Image.Image) -> Iterable[tuple[str, float]]:
    configs = (
        "--oem 3 --psm 10",
        "--oem 3 --psm 8",
    )

    for config in configs:
        try:
            data = pytesseract.image_to_data(
                image,
                lang="jpn",
                config=config,
                output_type=Output.DICT,
            )
        except (pytesseract.TesseractNotFoundError, RuntimeError) as exc:
            raise RuntimeError(
                "Kanji OCR dependencies are not installed. Please install pytesseract and Tesseract OCR."
            ) from exc

        texts = data.get("text", [])
        confidences = data.get("conf", [])

        for raw_text, raw_confidence in zip(texts, confidences):
            text = str(raw_text or "").strip()
            if not text:
                continue

            character = _extract_first_kanji(text)
            if not character:
                continue

            try:
                confidence = max(0.0, float(raw_confidence))
            except (TypeError, ValueError):
                confidence = 0.0

            yield character, confidence / 100


def _build_dictionary_preview(character: str) -> dict[str, object]:
    lookup = lookup_dictionary(character)
    first_result = lookup["results"][0] if lookup["results"] else None

    return {
        "has_entry": first_result is not None,
        "reading": first_result["furigana"] if first_result else "",
        "meanings": first_result["meanings"][:3] if first_result else [],
    }


def extract_kanji_candidates_from_image(image_path: str) -> dict[str, object]:
    image = _load_image(image_path)
    variants = _prepare_variants(image)

    aggregate: dict[str, dict[str, float]] = {}
    for variant_index, variant in enumerate(variants):
        freshness_bonus = max(0.0, 0.08 - variant_index * 0.004)

        for character, confidence in _iter_candidate_reads(variant):
            bucket = aggregate.setdefault(
                character,
                {
                    "score": 0.0,
                    "best_confidence": 0.0,
                    "hits": 0.0,
                },
            )
            bucket["hits"] += 1
            bucket["best_confidence"] = max(bucket["best_confidence"], confidence)
            bucket["score"] += confidence + 0.2 + freshness_bonus

        if aggregate:
            strong_candidates = [
                metrics
                for metrics in aggregate.values()
                if metrics["best_confidence"] >= 0.7 and metrics["hits"] >= 2
            ]
            if strong_candidates:
                break

    sorted_candidates = sorted(
        aggregate.items(),
        key=lambda item: (
            item[1]["score"],
            item[1]["best_confidence"],
            item[1]["hits"],
            item[0],
        ),
        reverse=True,
    )[:MAX_CANDIDATES]

    candidates = [
        {
            "character": character,
            "score": round(metrics["score"], 4),
            "confidence": round(metrics["best_confidence"], 4),
            "hits": int(metrics["hits"]),
            "dictionary": _build_dictionary_preview(character),
        }
        for character, metrics in sorted_candidates
    ]

    return {
        "best_candidate": candidates[0]["character"] if candidates else "",
        "candidate_count": len(candidates),
        "candidates": candidates,
    }
