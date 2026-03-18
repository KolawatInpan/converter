from fastapi import APIRouter
from app.controllers.japan_controller import (
    extract_words_controller,
    dictionary_lookup_controller,
    sentence_breakdown_controller,
)

router = APIRouter()

router.post("/extract-words")(extract_words_controller)
router.post("/dictionary")(dictionary_lookup_controller)
router.post("/sentence-breakdown")(sentence_breakdown_controller)
