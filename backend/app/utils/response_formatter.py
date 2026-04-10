import re
from typing import List

from app.schemas.trip_schema import WidgetData


def _clean_line(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip(" -•\t")


def _dedupe(items: List[str]) -> List[str]:
    seen = set()
    result: List[str] = []
    for item in items:
        key = item.lower()
        if item and key not in seen:
            seen.add(key)
            result.append(item)
    return result


def _extract_days(text: str) -> List[str]:
    matches = re.findall(r"(?im)^day\s+\d+\s*:\s*(.+)$", text)
    return _dedupe([_clean_line(match) for match in matches if _clean_line(match)])


def _extract_locations(text: str) -> List[str]:
    lines = text.splitlines()
    places: List[str] = []
    excluded_phrases = {
        "arrival and exploration",
        "cultural experiences",
        "adventure and wildlife",
        "relaxation and leisure",
        "departure",
    }
    excluded_line_fragments = (
        "meal at a",
        "snacks and drinks",
        "approx.",
        "per person",
        "cost breakdown",
        "budget tips",
        "transportation",
        "accommodation",
        "food and drink",
    )

    for line in lines:
        line = line.strip()
        if not line:
            continue
        lowered_line = line.lower()
        if any(fragment in lowered_line for fragment in excluded_line_fragments):
            continue
        if line.startswith("|"):
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) >= 2 and parts[1].lower() != "activity":
                activity = _clean_line(parts[1])
                if activity and len(activity) > 3 and activity.lower() not in excluded_phrases:
                    places.append(activity)
            continue

        bullet_match = re.match(r"^[•*-]\s+(.+)$", line)
        if bullet_match:
            item = _clean_line(bullet_match.group(1))
            if item and len(item) > 3 and item.lower() not in excluded_phrases:
                places.append(item)

    return _dedupe(places)


def _extract_trip_days(text: str) -> int | None:
    matches = re.findall(r"(?im)^day\s+(\d+)\s*:", text)
    if matches:
        return max(int(match) for match in matches)

    duration_match = re.search(r"\b(\d+)\s*days?\b", text, re.IGNORECASE)
    if duration_match:
        return int(duration_match.group(1))
    return None


def _extract_budget_line(text: str, label: str) -> str | None:
    pattern = rf"(?im)^[•*-]?\s*{re.escape(label)}\s*:\s*(.+)$"
    match = re.search(pattern, text)
    if not match:
        return None

    value = _clean_line(match.group(1))
    if value in {"₹0.00", "0.00", "0", "$0.00"}:
        return None
    return value


def _build_weather_summary(widgets: WidgetData) -> str:
    weather = widgets.weather
    if not weather:
        return "Weather details are not available yet."

    parts = []
    if weather.temp:
        parts.append(weather.temp)
    if weather.condition:
        parts.append(weather.condition)
    if weather.location:
        parts.append(f"for {weather.location}")
    if weather.season:
        parts.append(f"({weather.season})")

    return " ".join(parts) if parts else "Weather details are not available yet."


def _build_currency_summary(widgets: WidgetData) -> str:
    currency = widgets.currency
    if not currency:
        return "Currency conversion details are not available yet."

    if getattr(currency, "exchange_text", None):
        return currency.exchange_text
    if currency.from_currency and currency.to_currency and currency.rate:
        return f"1 {currency.from_currency} ≈ {currency.rate} {currency.to_currency} ({currency.symbol})"
    return f"Local currency: {currency.to_currency or 'Unknown'}"


def _build_budget_summary(widgets: WidgetData, fallback: str) -> str:
    budget = widgets.budget
    if not budget:
        return fallback

    if getattr(budget, "exchange_text", None):
        return budget.exchange_text
    if getattr(budget, "total", None) and getattr(budget, "total_destination", None) and budget.total != budget.total_destination:
        return f"{budget.total} which is about {budget.total_destination} at the destination."
    if getattr(budget, "total", None):
        return budget.total
    return fallback


def _detect_primary_location(answer: str, widgets: WidgetData) -> str | None:
    if widgets.weather and widgets.weather.location:
        return widgets.weather.location

    lines = [line.strip() for line in answer.splitlines() if line.strip()]
    for line in lines:
        if line.startswith("|"):
            parts = [part.strip() for part in line.strip("|").split("|")]
            if len(parts) >= 3 and parts[2].lower() not in {"location", "---"}:
                return parts[2]

    match = re.search(r"\bin\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)", answer)
    if match:
        return match.group(1).strip()

    return None


def _build_itinerary_summary(answer: str) -> str:
    day_count = _extract_trip_days(answer)
    day_titles = _extract_days(answer)

    if day_count and day_titles:
        preview = ", ".join(day_titles[:3])
        if len(day_titles) > 3:
            preview += ", and more"
        return f"{day_count}-day itinerary covering {preview}."

    if day_count:
        return f"{day_count}-day itinerary has been planned."

    return "Itinerary has been generated."


def _build_places_summary(answer: str) -> str:
    places = _extract_locations(answer)
    if not places:
        return "Place highlights are not available yet."

    highlights = ", ".join(places[:5])
    if len(places) > 5:
        highlights += ", and more"
    return highlights


def _build_general_summary(answer: str, widgets: WidgetData) -> str:
    location = _detect_primary_location(answer, widgets)
    day_count = _extract_trip_days(answer)
    places = _extract_locations(answer)

    if location and day_count and places:
        return f"A {day_count}-day trip plan for {location} focused on {', '.join(places[:3])}."
    if location and day_count:
        return f"A {day_count}-day trip plan for {location} is ready."
    if location:
        return f"Trip plan for {location} is ready."
    return "Trip summary is ready."


def _sanitize_zero_costs(answer: str) -> str:
    answer = re.sub(
        r"(?im)^since the total cost of the hotel is .*?, we can proceed with planning the trip\.\s*",
        "Hotel pricing is not available yet, so the itinerary below focuses on destinations, activities, and trip structure.\n\n",
        answer,
    )
    replacements = {
        "Hotel: ₹0.00": "Hotel: Cost not available yet",
        "Transportation: ₹0.00": "Transportation: Cost not available yet",
        "Food and Drink: ₹0.00": "Food and Drink: Cost not available yet",
        "Activities and Entrance Fees: ₹0.00": "Activities and Entrance Fees: Cost not available yet",
        "Total: ₹0.00": "Total: Cost not available yet",
        "Per Day Budget: ₹0.00": "Per Day Budget: Cost not available yet",
    }
    for source, target in replacements.items():
        answer = answer.replace(source, target)
    return answer


def format_trip_response(answer: str, widgets: WidgetData) -> str:
    clean_answer = _sanitize_zero_costs(answer)

    hotel_cost = _extract_budget_line(clean_answer, "Hotel") or "Hotel cost has not been estimated yet."
    total_expense = _build_budget_summary(
        widgets,
        _extract_budget_line(clean_answer, "Total") or "Total trip expense has not been estimated yet.",
    )

    summary = "\n".join(
        [
            "## Trip Summary",
            f"1. Real-time weather info: {_build_weather_summary(widgets)}",
            f"2. Attraction & activity highlights: {_build_places_summary(clean_answer)}",
            f"3. Hotel cost: {hotel_cost}",
            f"4. Currency conversion: {_build_currency_summary(widgets)}",
            f"5. Itinerary planning: {_build_itinerary_summary(clean_answer)}",
            f"6. Total expense: {total_expense}",
            f"7. General summary: {_build_general_summary(clean_answer, widgets)}",
            "",
            "## Detailed Plan",
            clean_answer,
        ]
    )

    return summary
