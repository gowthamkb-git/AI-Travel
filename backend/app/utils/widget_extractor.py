import re
from app.schemas.trip_schema import WidgetData, WeatherData, CurrencyData, BudgetData, BudgetBreakdown

LOCATION_CURRENCY_MAP = {
    "north goa": ("INR", "₹", 83.0),
    "south goa": ("INR", "₹", 83.0),
    "goa": ("INR", "₹", 83.0),
    "india": ("INR", "₹", 83.0),
    "mumbai": ("INR", "₹", 83.0),
    "delhi": ("INR", "₹", 83.0),
    "bangalore": ("INR", "₹", 83.0),
    "bengaluru": ("INR", "₹", 83.0),
    "kerala": ("INR", "₹", 83.0),
    "rajasthan": ("INR", "₹", 83.0),
    "karnataka": ("INR", "₹", 83.0),
    "shivamogga": ("INR", "₹", 83.0),
    "shimoga": ("INR", "₹", 83.0),
    "uk": ("GBP", "£", 0.79),
    "london": ("GBP", "£", 0.79),
    "france": ("EUR", "€", 0.92),
    "paris": ("EUR", "€", 0.92),
    "germany": ("EUR", "€", 0.92),
    "italy": ("EUR", "€", 0.92),
    "spain": ("EUR", "€", 0.92),
    "japan": ("JPY", "¥", 149.0),
    "tokyo": ("JPY", "¥", 149.0),
    "thailand": ("THB", "฿", 35.0),
    "bangkok": ("THB", "฿", 35.0),
    "dubai": ("AED", "د.إ", 3.67),
    "uae": ("AED", "د.إ", 3.67),
    "singapore": ("SGD", "S$", 1.34),
    "australia": ("AUD", "A$", 1.53),
    "sydney": ("AUD", "A$", 1.53),
    "canada": ("CAD", "C$", 1.36),
    "usa": ("USD", "$", 1.0),
    "new york": ("USD", "$", 1.0),
}

PEAK_MONTHS = ["october", "november", "december", "january", "february", "march"]
OFF_MONTHS = ["june", "july", "august", "september"]


def _detect_location(text: str) -> str | None:
    text_lower = text.lower()
    # Sort by length descending so "north goa" matches before "goa"
    for loc in sorted(LOCATION_CURRENCY_MAP, key=len, reverse=True):
        if loc in text_lower:
            return loc
    return None


def _detect_season(text: str) -> str:
    text_lower = text.lower()
    for m in OFF_MONTHS:
        if m in text_lower:
            return "Off Season"
    for m in PEAK_MONTHS:
        if m in text_lower:
            return "Peak Season"
    return "Peak Season"


def _extract_section(text: str, *headers: str) -> str:
    """Extract text under a markdown section heading."""
    for header in headers:
        pattern = rf"(?i)#{1,4}\s*{re.escape(header)}.*?\n(.*?)(?=\n#{1,4}\s|\Z)"
        m = re.search(pattern, text, re.DOTALL)
        if m:
            return m.group(1)
    return ""


def _extract_weather(text: str, location: str | None) -> WeatherData | None:
    # Only look inside a weather section
    section = _extract_section(text, "Weather", "Current Weather", "Weather Summary")
    search_text = section if section else text

    # Match temperature — prefer °C, fallback to °F converted
    temp = None
    c_match = re.search(r"(\d{1,3})\s*°\s*C", search_text)
    if c_match:
        temp = f"{c_match.group(1)}°C"
    else:
        f_match = re.search(r"(\d{2,3})\s*°\s*F", search_text)
        if f_match:
            c_val = round((int(f_match.group(1)) - 32) * 5 / 9)
            temp = f"{c_val}°C"

    condition = None
    condition_map = {
        "sunny": "Sunny", "clear": "Clear", "cloudy": "Cloudy",
        "overcast": "Overcast", "rainy": "Rainy", "rain": "Rainy",
        "humid": "Humid & Warm", "hot": "Hot & Sunny", "pleasant": "Pleasant",
        "cold": "Cold", "snow": "Snowy", "fog": "Foggy", "windy": "Windy",
        "tropical": "Tropical", "monsoon": "Monsoon",
    }
    sl = search_text.lower()
    for key, val in condition_map.items():
        if re.search(rf"\b{re.escape(key)}\b", sl):
            condition = val
            break

    if not temp and not condition:
        return None

    return WeatherData(
        temp=temp,
        condition=condition,
        location=location.title() if location else None,
        season=_detect_season(text),
    )


def _extract_currency(location: str | None) -> CurrencyData | None:
    if not location:
        return None
    entry = LOCATION_CURRENCY_MAP.get(location)
    if not entry:
        return None
    to_code, symbol, rate = entry
    if to_code == "USD":
        return CurrencyData(rate="1", from_currency="USD", to_currency="USD", symbol="$")
    return CurrencyData(
        rate=str(int(rate)) if rate == int(rate) else str(rate),
        from_currency="USD",
        to_currency=to_code,
        symbol=symbol,
    )


def _parse_inr_amount(text: str) -> float | None:
    """Extract a number preceded by ₹ or INR, ignoring $ amounts."""
    m = re.search(r"(?:₹|INR\s*)([0-9,]+(?:\.[0-9]+)?)\s*(lakh|L|k)?", text, re.IGNORECASE)
    if not m:
        return None
    val = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    if suffix in ("lakh", "l"):
        val *= 100000
    elif suffix == "k":
        val *= 1000
    return val


def _parse_any_amount(text: str, symbol: str) -> float | None:
    """Extract amount with the destination's currency symbol."""
    escaped = re.escape(symbol)
    m = re.search(rf"(?:{escaped}|INR\s*)([0-9,]+(?:\.[0-9]+)?)\s*(lakh|L|k)?", text, re.IGNORECASE)
    if not m:
        # fallback: plain number ≥ 1000 (likely a cost figure)
        m2 = re.search(r"\b([1-9][0-9]{3,}(?:,[0-9]+)*)\b", text)
        if m2:
            return float(m2.group(1).replace(",", ""))
        return None
    val = float(m.group(1).replace(",", ""))
    suffix = (m.group(2) or "").lower()
    if suffix in ("lakh", "l"):
        val *= 100000
    elif suffix == "k":
        val *= 1000
    return val


def _format_amount(val: float, symbol: str) -> str:
    if val >= 100000:
        return f"{symbol}{val/100000:.1f}L"
    if val >= 1000:
        return f"{symbol}{int(val/1000)}k"
    return f"{symbol}{int(val)}"


def _extract_budget(text: str, symbol: str) -> BudgetData | None:
    # Focus on cost breakdown section
    section = _extract_section(text, "Cost Breakdown", "Budget", "Total Cost", "Expense")
    search_text = section if section else text

    # Total: look for lines with "total" keyword + a currency amount
    total_val = None
    for line in search_text.splitlines():
        if re.search(r"\btotal\b", line, re.IGNORECASE):
            val = _parse_any_amount(line, symbol)
            if val and val > 500:  # sanity: ignore tiny numbers like "4 days"
                total_val = val
                break

    # Per day: look for lines with "per day" or "daily"
    per_day_val = None
    for line in search_text.splitlines():
        if re.search(r"\bper\s+day\b|\bdaily\b", line, re.IGNORECASE):
            val = _parse_any_amount(line, symbol)
            if val and val > 100:
                per_day_val = val
                break

    # If total not found in section, try deriving from per_day * days
    if not total_val and per_day_val:
        days_m = re.search(r"(\d+)\s*days?", text, re.IGNORECASE)
        if days_m:
            total_val = per_day_val * int(days_m.group(1))

    def find_category(keywords: list[str]) -> str | None:
        for kw in keywords:
            for line in search_text.splitlines():
                if re.search(rf"\b{kw}", line, re.IGNORECASE):
                    val = _parse_any_amount(line, symbol)
                    if val and val > 100:
                        return _format_amount(val, symbol)
        return None

    accommodation = find_category(["accommodation", "hotel", "stay", "lodging"])
    food = find_category(["food", "meal", "dining", "restaurant"])
    transport = find_category(["transport", "flight", "cab", "travel"])
    activities = find_category(["activit", "sightseeing", "entertainment"])

    if not total_val and not per_day_val:
        return None

    breakdown = BudgetBreakdown(
        accommodation=accommodation,
        food=food,
        transport=transport,
        activities=activities,
    ) if any([accommodation, food, transport, activities]) else None

    return BudgetData(
        total=_format_amount(total_val, symbol) if total_val else None,
        per_day=_format_amount(per_day_val, symbol) if per_day_val else None,
        currency_symbol=symbol,
        breakdown=breakdown,
    )


def extract_widgets(text: str) -> WidgetData:
    location = _detect_location(text)
    currency_data = _extract_currency(location)
    symbol = currency_data.symbol if currency_data else "₹"

    weather = _extract_weather(text, location)
    budget = _extract_budget(text, symbol)

    return WidgetData(weather=weather, currency=currency_data, budget=budget)
