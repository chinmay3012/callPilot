"""
CallPilot - Multilingual Support
Automatic language detection and seamless switching (e.g. German, English, Turkish).
"""
import re
from typing import Optional

SUPPORTED_LANGUAGES = frozenset({"en", "de", "tr"})
DEFAULT_LANGUAGE = "en"

# Simple heuristic: common words per language (not full NLP; good for demo)
_LANG_HINTS = {
    "de": [
        "bitte", "danke", "ja", "nein", "arzt", "termin", "zahnarzt", "ich", "sie", "haben",
        "möchte", "brauche", "können", "wann", "wie", "wo", "der", "die", "das", "und",
    ],
    "tr": [
        "lütfen", "teşekkür", "evet", "hayır", "doktor", "randevu", "diş", "ben", "siz", "var",
        "istemek", "ihtiyaç", "olur", "ne zaman", "nasıl", "nerede", "bir", "ve", "ile",
    ],
    "en": [
        "please", "thank", "yes", "no", "doctor", "appointment", "dentist", "i", "you", "have",
        "want", "need", "can", "when", "how", "where", "the", "a", "and", "find",
    ],
}


def detect_language(text: Optional[str]) -> str:
    """
    Detect language from user text. Returns ISO 639-1 code: en, de, or tr.
    Uses simple word-overlap heuristic; in production use a proper detector (e.g. langdetect).
    """
    if not text or not isinstance(text, str):
        return DEFAULT_LANGUAGE
    t = text.strip().lower()
    if not t:
        return DEFAULT_LANGUAGE
    words = set(re.findall(r"[a-zäöüßçğıöşü]+", t))
    scores = {}
    for lang, hints in _LANG_HINTS.items():
        scores[lang] = sum(1 for w in hints if w in words or any(w in w2 for w2 in words))
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else DEFAULT_LANGUAGE


def get_language_hint_for_prompt(detected: str) -> str:
    """Return a one-line instruction for the agent to respond in the detected language."""
    hints = {
        "de": "Respond in German (Deutsch) unless the user switches to another language.",
        "tr": "Respond in Turkish (Türkçe) unless the user switches to another language.",
        "en": "Respond in English unless the user switches to another language.",
    }
    return hints.get(detected, hints["en"])
