import os
import re
from typing import Optional

import requests


STOP_PHRASES = [
    "from my current location",
    "from current location",
    "from my location",
    "from current place",
    "under ",
    "below ",
    "within ",
    "for ",
    "with ",
    "during ",
    "on ",
    "starting ",
]

STOP_WORDS = {
    "my", "current", "location", "place", "trip", "travel", "vacation", "holiday",
    "plan", "itinerary", "days", "day", "night", "nights", "under", "below",
    "within", "budget", "cheap", "luxury", "family", "solo", "couple",
    "can", "could", "would", "please", "make",
}

LOCATION_ALIASES = {
    "chikkamagalore": "Chikkamagaluru",
    "chikmagalur": "Chikkamagaluru",
    "shimoga": "Shivamogga",
    "bangalore": "Bengaluru",
    "bombay": "Mumbai",
    "madras": "Chennai",
    "goa": "Goa, India",
    "panaji": "Panaji, Goa, India",
    "goa, panaji": "Panaji, Goa, India",
    "goa panaji": "Panaji, Goa, India",
    "panaji, goa": "Panaji, Goa, India",
    "panaji goa": "Panaji, Goa, India",
    "bali": "Bali, Indonesia",
}

LOCATION_PRESETS = {
    "goa, india": {"name": "Goa", "state": "Goa", "county": None, "country": "IN", "lat": 15.2993, "lon": 74.1240, "display_name": "Goa, India"},
    "panaji, goa, india": {"name": "Panaji", "state": "Goa", "county": None, "country": "IN", "lat": 15.4909, "lon": 73.8278, "display_name": "Panaji, Goa, India"},
    "bali, indonesia": {"name": "Bali", "state": "Bali", "county": None, "country": "ID", "lat": -8.4095, "lon": 115.1889, "display_name": "Bali, Indonesia"},
}

COUNTRY_HINTS = {
    "india": "IN",
    "indian": "IN",
    "karnataka": "IN",
    "uk": "GB",
    "united kingdom": "GB",
    "england": "GB",
    "france": "FR",
    "japan": "JP",
    "thailand": "TH",
    "uae": "AE",
    "dubai": "AE",
    "singapore": "SG",
    "australia": "AU",
    "canada": "CA",
    "usa": "US",
    "united states": "US",
}


def _clean_candidate(value: str) -> str:
    value = value.strip(" .!?\n\t:-")
    value = re.sub(r"^(?:a|an|the)\s+", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b\d+\s*(?:days?|nights?|weeks?)\b", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:under|below|within)\s+[^\n.;]+", "", value, flags=re.IGNORECASE)
    value = re.split(r"\bfrom\b", value, maxsplit=1, flags=re.IGNORECASE)[0]
    value = re.sub(r"\b(?:trip|travel|vacation|holiday|itinerary)\b", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\b(?:can|could|would|please|make|create|build|help)\b", "", value, flags=re.IGNORECASE)
    for phrase in STOP_PHRASES:
        value = re.split(re.escape(phrase), value, maxsplit=1, flags=re.IGNORECASE)[0]
    value = re.sub(r"\s+", " ", value).strip(" .!?\n\t:-")
    return value


def extract_candidate_locations(text: str) -> list[str]:
    if not text:
        return []

    candidates: list[str] = []
    normalized = text.replace("\n", " ")

    patterns = [
        r"\b(?:trip|travel|vacation|holiday|visit|itinerary|plan)\s+to\s+([^.!?;]+?)(?:\s+for\b|\s+from\b|\s+with\b|\s+under\b|$)",
        r"\bplan\s+for\s+([^.!?;]+?)(?:\s+for\b|\s+from\b|\s+with\b|\s+under\b|$)",
        r"\b(?:make|plan|create|build|organize|arrange)\b.*?\btrip\s+to\s+([^.!?;]+?)(?:\s+for\b|\s+from\b|\s+with\b|\s+under\b|$)",
        r"\b(?:make|plan|create|build|organize|arrange)\b.*?\b([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,4})\s+trip\b",
        r"\bvisit\s+([^.!?;]+?)(?:\s+for\b|\s+from\b|\s+with\b|$)",
        r"\bvacation in\s+([^.!?;]+?)(?:\s+for\b|\s+with\b|$)",
        r"\barrive in\s+([^.!?;]+?)(?:\s+for\b|\s+with\b|$)",
        r"\bstaying in\s+([^.!?;]+?)(?:\s+for\b|\s+with\b|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, normalized, re.IGNORECASE):
            candidate = _clean_candidate(match.group(1))
            if candidate:
                candidates.append(candidate)

    for table_match in re.finditer(r"(?im)^\|\s*\d+\s*\|[^|]+\|\s*([^|]+)\|", text):
        candidate = _clean_candidate(table_match.group(1))
        if candidate and candidate.lower() != "location":
            candidates.append(candidate)

    to_matches = re.findall(
        r"\bto\s+([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,4}|[a-z][a-z.'\-]+(?:\s+[a-z][a-z.'\-]+){0,4})(?:\s+for\b|\s+from\b|\s+with\b|\s+under\b|$)",
        normalized,
        re.IGNORECASE,
    )
    candidates.extend(_clean_candidate(match) for match in to_matches if _clean_candidate(match))

    trip_suffix_matches = re.findall(
        r"\b([A-Z][A-Za-z.'\-]+(?:\s+[A-Z][A-Za-z.'\-]+){0,4}|[a-z][a-z.'\-]+(?:\s+[a-z][a-z.'\-]+){0,4})\s+trip\b",
        normalized,
        re.IGNORECASE,
    )
    candidates.extend(_clean_candidate(match) for match in trip_suffix_matches if _clean_candidate(match))

    alias_normalized = [LOCATION_ALIASES.get(candidate.lower(), candidate) for candidate in candidates]

    deduped: list[str] = []
    seen = set()
    for candidate in alias_normalized:
        lowered = candidate.lower()
        if (
            not candidate
            or lowered in seen
            or lowered in STOP_WORDS
            or len(candidate) < 3
            or re.fullmatch(r"\d+", candidate)
        ):
            continue
        seen.add(lowered)
        deduped.append(candidate)
    return deduped[:8]


def extract_country_hint(text: str) -> Optional[str]:
    lowered = text.lower()
    for key, code in COUNTRY_HINTS.items():
        if re.search(rf"\b{re.escape(key)}\b", lowered):
            return code
    if "₹" in text or " inr" in lowered:
        return "IN"
    if "£" in text or " gbp" in lowered:
        return "GB"
    if "€" in text or " eur" in lowered:
        return "FR"
    if "¥" in text or " jpy" in lowered:
        return "JP"
    return None


def _score_candidate(candidate: dict, normalized_candidate: str, country_hint: Optional[str]) -> int:
    score = 0
    name = str(candidate.get("name", "")).lower()
    state = str(candidate.get("state", "")).lower()
    county = str(candidate.get("county", "")).lower()
    display_name = str(candidate.get("display_name", "")).lower()
    country = str(candidate.get("country", "")).upper()
    query = normalized_candidate.lower()
    query_parts = [part.strip().lower() for part in re.split(r",", query) if part.strip()]

    if name == query:
        score += 60
    elif query in name:
        score += 25

    for part in query_parts[1:]:
        if part and part in state:
            score += 40
        if part and part in county:
            score += 40
        if part and part in display_name:
            score += 25
        if part and part in name:
            score += 15

    if country_hint and country == country_hint:
        score += 80

    if query.startswith("goa") and country == "IN":
        score += 120
    if query.startswith("bali") and country == "ID":
        score += 120

    return score


def _nominatim_to_resolved(candidate: dict) -> dict:
    address = candidate.get("address", {}) or {}
    name = (
        candidate.get("name")
        or address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or candidate.get("display_name", "").split(",")[0]
    )
    return {
        "name": name,
        "state": address.get("state") or address.get("region") or address.get("state_district"),
        "county": address.get("county") or address.get("state_district"),
        "country": address.get("country_code", "").upper() or address.get("country"),
        "lat": float(candidate.get("lat")),
        "lon": float(candidate.get("lon")),
        "display_name": candidate.get("display_name"),
    }


def geocode_with_nominatim(candidate: str, country_hint: Optional[str] = None) -> Optional[dict]:
    try:
        params = {
            "q": candidate,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 5,
        }
        if country_hint:
            params["countrycodes"] = country_hint.lower()
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers={"User-Agent": "ai-trip-planner/1.0"},
            timeout=10,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        if not data:
            return None
        resolved_candidates = [_nominatim_to_resolved(item) for item in data]
        ranked = sorted(
            resolved_candidates,
            key=lambda item: _score_candidate(item, candidate, country_hint),
            reverse=True,
        )
        return ranked[0]
    except Exception:
        return None


def geocode_location(candidate: str, api_key: str, country_hint: Optional[str] = None) -> Optional[dict]:
    preset = LOCATION_PRESETS.get(candidate.lower())
    if preset:
        if country_hint and preset["country"] != country_hint:
            return None
        return preset

    nominatim_match = geocode_with_nominatim(candidate, country_hint)
    if nominatim_match:
        return nominatim_match

    if not api_key:
        return None

    try:
        response = requests.get(
            "https://api.openweathermap.org/geo/1.0/direct",
            params={"q": candidate, "limit": 5, "appid": api_key},
            timeout=10,
        )
        if response.status_code != 200:
            return None
        data = response.json()
        if not data:
            return None

        ranked = sorted(
            data,
            key=lambda item: _score_candidate(item, candidate, country_hint),
            reverse=True,
        )
        return ranked[0]
    except Exception:
        return None


def format_resolved_location(resolved_location: dict) -> str:
    city_name = resolved_location.get("name")
    state = resolved_location.get("state") or resolved_location.get("county")
    country = resolved_location.get("country")
    parts = [part for part in [city_name, state, country] if part]
    return ", ".join(parts)


def resolve_destination(question: str, answer: str = "", location_hint: str = "") -> Optional[dict]:
    api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")

    country_hint = extract_country_hint(question) or extract_country_hint(answer) or extract_country_hint(location_hint)
    primary_candidates = extract_candidate_locations(question) + extract_candidate_locations(location_hint)
    fallback_candidates = extract_candidate_locations(answer)

    for candidate in primary_candidates:
        resolved = geocode_location(candidate, api_key, country_hint)
        if resolved:
            return resolved

    for candidate in fallback_candidates:
        resolved = geocode_location(candidate, api_key, country_hint)
        if resolved:
            return resolved
    return None
