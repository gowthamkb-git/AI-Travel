import re
from typing import Optional

from app.schemas.trip_schema import BudgetBreakdown, BudgetData, Coordinates
from app.utils.currency_insights import _get_rate, _restcountries_currency, _reverse_geocode_country
from app.utils.destination_resolver import resolve_destination


AMOUNT_PATTERN = re.compile(
    r"(?P<symbol>[₹$£€¥₱])\s*(?P<value>\d[\d,]*(?:\.\d+)?)\s*(?P<suffix>k|K|lakh|L)?|"
    r"(?P<code>INR|USD|GBP|EUR|JPY|PHP|AUD|CAD|AED|THB|SGD)\s*(?P<value_code>\d[\d,]*(?:\.\d+)?)\s*(?P<suffix_code>k|K|lakh|L)?",
    re.IGNORECASE,
)

CATEGORY_LABELS = {
    "accommodation": ["hotel", "accommodation", "stay", "lodging"],
    "food": ["food", "meal", "dining", "restaurant", "drink"],
    "transport": ["transport", "transportation", "flight", "cab", "travel", "transfer"],
    "activities": ["activities", "activity", "sightseeing", "entrance", "tickets", "entertainment"],
}

SYMBOL_MAP = {
    "INR": "₹",
    "USD": "$",
    "GBP": "£",
    "EUR": "€",
    "JPY": "¥",
    "PHP": "₱",
    "AUD": "A$",
    "CAD": "C$",
    "AED": "AED",
    "THB": "฿",
    "SGD": "S$",
}

COUNTRY_DAILY_BASE = {
    "IN": 3500,
    "GB": 140,
    "FR": 135,
    "US": 160,
    "ID": 900000,
    "JP": 18000,
    "TH": 2500,
    "AE": 400,
    "SG": 180,
    "AU": 220,
    "CA": 190,
    "PH": 4500,
}


def _extract_day_count(text: str) -> Optional[int]:
    matches = re.findall(r"(?im)^day\s+(\d+)\s*:", text)
    if matches:
        return max(int(match) for match in matches)
    duration_match = re.search(r"\b(\d+)\s*days?\b", text, re.IGNORECASE)
    return int(duration_match.group(1)) if duration_match else None


def _extract_travelers(text: str) -> int:
    match = re.search(r"\b(\d+)\s*(?:members?|people|persons?|travellers?|travelers?|adults?)\b", text, re.IGNORECASE)
    if match:
        return max(int(match.group(1)), 1)
    return 1


def _normalize_amount(value: str, suffix: str | None) -> float:
    amount = float(value.replace(",", ""))
    if not suffix:
        return amount
    suffix_lower = suffix.lower()
    if suffix_lower == "k":
        return amount * 1000
    if suffix_lower in {"l", "lakh"}:
        return amount * 100000
    return amount


def _extract_amount(line: str, currency_code: str, currency_symbol: str | None) -> Optional[float]:
    for match in AMOUNT_PATTERN.finditer(line):
        symbol = match.group("symbol")
        code = (match.group("code") or "").upper()
        value = match.group("value") or match.group("value_code")
        suffix = match.group("suffix") or match.group("suffix_code")
        if not value:
            continue
        if code and code == currency_code:
            return _normalize_amount(value, suffix)
        if symbol and currency_symbol and symbol == currency_symbol:
            return _normalize_amount(value, suffix)
        if symbol and not currency_symbol:
            return _normalize_amount(value, suffix)

    plain_match = re.search(r"\b(\d[\d,]*(?:\.\d+)?)\s*(k|K|lakh|L)?\b", line)
    if plain_match:
        return _normalize_amount(plain_match.group(1), plain_match.group(2))
    return None


def _format_amount(value: Optional[float], currency_code: str, currency_symbol: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    symbol = currency_symbol or SYMBOL_MAP.get(currency_code) or currency_code
    if symbol in {"AED", "S$"}:
        return f"{symbol} {value:,.0f}"
    return f"{symbol}{value:,.0f}"


def _extract_breakdown(answer: str, currency_code: str, currency_symbol: Optional[str]) -> tuple[dict[str, Optional[float]], Optional[float], Optional[float]]:
    values = {key: None for key in CATEGORY_LABELS}
    total_value: Optional[float] = None
    per_day_value: Optional[float] = None

    for raw_line in answer.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        lowered = line.lower()
        amount = _extract_amount(line, currency_code, currency_symbol)
        if amount is None:
            continue

        if "per day" in lowered or "daily" in lowered:
            per_day_value = amount
            continue
        if re.search(r"\btotal\b", lowered):
            total_value = amount
            continue

        for category, keywords in CATEGORY_LABELS.items():
            if any(keyword in lowered for keyword in keywords):
                values[category] = amount
                break

    if total_value is None:
        parts = [value for value in values.values() if value is not None]
        if parts:
            total_value = sum(parts)

    return values, total_value, per_day_value


def build_budget_insight(
    question: str,
    answer: str = "",
    current_location: Optional[Coordinates] = None,
    resolved_destination: Optional[dict] = None,
) -> Optional[BudgetData]:
    destination = resolved_destination or resolve_destination(question, answer)
    if not destination:
        return None

    destination_country_code = str(destination.get("country", "")).upper()
    destination_currency_info = _restcountries_currency(destination_country_code) if destination_country_code else None
    if not destination_currency_info:
        return None

    destination_currency = destination_currency_info["currency_code"]
    destination_symbol = destination_currency_info.get("currency_symbol")
    destination_country = destination_currency_info.get("country_name")
    current_geo = _reverse_geocode_country(current_location) if current_location else None
    local_currency_info = (
        _restcountries_currency(current_geo["country_code"])
        if current_geo and current_geo.get("country_code")
        else None
    )

    breakdown_values, total_destination_value, per_day_destination_value = _extract_breakdown(
        answer,
        destination_currency,
        destination_symbol,
    )

    day_count = _extract_day_count(answer) or _extract_day_count(question) or 1
    travelers = _extract_travelers(question)
    heuristic_used = False
    if total_destination_value is None:
        heuristic_used = True
        daily_base = COUNTRY_DAILY_BASE.get(destination_country_code, 120)
        total_destination_value = float(daily_base * day_count * travelers)
        per_day_destination_value = float(daily_base * travelers)
        breakdown_values = {
            "accommodation": total_destination_value * 0.45,
            "food": total_destination_value * 0.22,
            "transport": total_destination_value * 0.13,
            "activities": total_destination_value * 0.20,
        }

    if per_day_destination_value is None:
        per_day_destination_value = total_destination_value / max(day_count, 1)

    local_currency = local_currency_info["currency_code"] if local_currency_info else None
    local_symbol = local_currency_info.get("currency_symbol") if local_currency_info else None
    same_currency = local_currency == destination_currency if local_currency else None
    rate = _get_rate(destination_currency, local_currency) if local_currency and not same_currency else (1.0 if same_currency else None)

    total_local_value = total_destination_value * rate if rate is not None else None
    per_day_local_value = per_day_destination_value * rate if rate is not None else None

    if same_currency is True:
        exchange_text = f"Your current location and {destination_country} use the same currency."
    elif total_local_value is not None and local_currency and local_symbol is not None:
        exchange_text = (
            f"Total trip cost is {_format_amount(total_local_value, local_currency, local_symbol)} "
            f"which is about {_format_amount(total_destination_value, destination_currency, destination_symbol)} in {destination_country}."
        )
    else:
        exchange_text = (
            f"Estimated total is {_format_amount(total_destination_value, destination_currency, destination_symbol)} in {destination_country}."
        )

    key_points = [
        f"Estimated total at the destination is {_format_amount(total_destination_value, destination_currency, destination_symbol)}.",
        (
            f"In your local currency that is about {_format_amount(total_local_value, local_currency, local_symbol)}."
            if total_local_value is not None and local_currency
            else "Allow location access so we can compare this trip in your local currency."
        ),
        (
            f"Daily spend is about {_format_amount(per_day_local_value, local_currency, local_symbol)} for {day_count} day(s)."
            if per_day_local_value is not None and local_currency
            else f"Daily spend is about {_format_amount(per_day_destination_value, destination_currency, destination_symbol)}."
        ),
    ]
    if heuristic_used:
        key_points.append(
            f"This budget uses a destination cost heuristic for {day_count} day(s) and {travelers} traveler(s) because exact prices were not available."
        )
    if same_currency is True:
        key_points.append("No extra budget buffer is needed for exchange-rate changes.")
    elif local_currency:
        key_points.append(
            f"Destination prices are shown in {destination_currency}, while your home-side comparison uses {local_currency}."
        )
    else:
        key_points.append("Current-location currency is not available yet, so only destination-side totals are shown.")

    breakdown = BudgetBreakdown(
        accommodation=_format_amount(breakdown_values["accommodation"], destination_currency, destination_symbol),
        food=_format_amount(breakdown_values["food"], destination_currency, destination_symbol),
        transport=_format_amount(breakdown_values["transport"], destination_currency, destination_symbol),
        activities=_format_amount(breakdown_values["activities"], destination_currency, destination_symbol),
    )
    if not any([breakdown.accommodation, breakdown.food, breakdown.transport, breakdown.activities]):
        breakdown = None

    return BudgetData(
        total=_format_amount(total_destination_value, destination_currency, destination_symbol),
        per_day=_format_amount(per_day_destination_value, destination_currency, destination_symbol),
        currency_symbol=destination_symbol,
        breakdown=breakdown,
        total_local=_format_amount(total_local_value, local_currency, local_symbol),
        total_destination=_format_amount(total_destination_value, destination_currency, destination_symbol),
        per_day_local=_format_amount(per_day_local_value, local_currency, local_symbol),
        per_day_destination=_format_amount(per_day_destination_value, destination_currency, destination_symbol),
        destination_currency=destination_currency,
        local_currency=local_currency,
        same_currency=same_currency,
        exchange_text=exchange_text,
        key_points=key_points,
    )
