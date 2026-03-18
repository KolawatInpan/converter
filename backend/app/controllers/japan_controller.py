import json

from pydantic import BaseModel, model_validator

from app.services.extract_word import extract_words
from app.services.lookup_dictionary import lookup_dictionary
from app.services.sentence_breakdown import breakdown_sentence


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


async def extract_words_controller(payload: ExtractWordsRequest) -> list[dict]:
    return extract_words(payload.text)


async def dictionary_lookup_controller(payload: DictionaryLookupRequest) -> dict:
    return lookup_dictionary(payload.query)


async def sentence_breakdown_controller(payload: SentenceBreakdownRequest) -> dict:
    return breakdown_sentence(payload.text)
