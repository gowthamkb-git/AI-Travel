import re
from typing import Iterable, Optional

from app.schemas.trip_schema import ChatMessage
from app.utils.destination_resolver import extract_country_hint, format_resolved_location, geocode_location, resolve_destination


LOCATION_REFERENCE_PATTERN = re.compile(
    r"\b(?:there|that place|this city|that city|that location|this place)\b",
    re.IGNORECASE,
)
TOPIC_WITH_REFERENCE_PATTERN = re.compile(
    r"\b(top places|best places|places|hotels|restaurants|weather|budget|plan|trip|itinerary)\s+"
    r"(?:there|that place|this city|that city|that location|this place)\b",
    re.IGNORECASE,
)


def rewrite_question_with_location_memory(question: str, location: Optional[str]) -> str:
    if not question or not location:
        return question

    if TOPIC_WITH_REFERENCE_PATTERN.search(question):
        return TOPIC_WITH_REFERENCE_PATTERN.sub(
            lambda match: f"{match.group(1)} in {location}",
            question,
        )

    if LOCATION_REFERENCE_PATTERN.search(question):
        return LOCATION_REFERENCE_PATTERN.sub(location, question)

    return question


def resolve_locked_destination(
    question: str,
    history: Optional[Iterable[ChatMessage]] = None,
    location_context: Optional[str] = None,
) -> tuple[str, Optional[dict]]:
    normalized_question = rewrite_question_with_location_memory(question, location_context)

    if location_context:
        context_country_hint = extract_country_hint(normalized_question) or extract_country_hint(location_context)
        direct_context = geocode_location(location_context, "", context_country_hint)
        if direct_context:
            location_name = format_resolved_location(direct_context)
            return rewrite_question_with_location_memory(normalized_question, location_name), direct_context

    direct = resolve_destination(normalized_question, location_hint=location_context or "")
    if direct:
        return rewrite_question_with_location_memory(normalized_question, format_resolved_location(direct)), direct

    context_candidates = []
    if location_context:
        context_candidates.append(location_context)
    for message in reversed(list(history or [])):
        if message.role not in {"human", "user", "assistant"}:
            continue
        context_candidates.append(message.content)

    for candidate in context_candidates:
        resolved = resolve_destination(candidate, location_hint=location_context or "")
        if resolved:
            location_name = format_resolved_location(resolved)
            return rewrite_question_with_location_memory(normalized_question, location_name), resolved

    return normalized_question, None
