import os
from typing import Optional

import requests

from app.schemas.trip_schema import Coordinates, CurrencyData
from app.utils.destination_resolver import resolve_destination


RESTCOUNTRIES_URL = "https://restcountries.com/v3.1/alpha/{code}"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
COUNTRY_CURRENCY_PRESETS = {
    "IN": {"country_code": "IN", "country_name": "India", "currency_code": "INR", "currency_symbol": "₹"},
    "ID": {"country_code": "ID", "country_name": "Indonesia", "currency_code": "IDR", "currency_symbol": "Rp"},
    "PH": {"country_code": "PH", "country_name": "Philippines", "currency_code": "PHP", "currency_symbol": "₱"},
    "US": {"country_code": "US", "country_name": "United States", "currency_code": "USD", "currency_symbol": "$"},
    "GB": {"country_code": "GB", "country_name": "United Kingdom", "currency_code": "GBP", "currency_symbol": "£"},
    "FR": {"country_code": "FR", "country_name": "France", "currency_code": "EUR", "currency_symbol": "€"},
    "JP": {"country_code": "JP", "country_name": "Japan", "currency_code": "JPY", "currency_symbol": "¥"},
    "TH": {"country_code": "TH", "country_name": "Thailand", "currency_code": "THB", "currency_symbol": "฿"},
    "AE": {"country_code": "AE", "country_name": "United Arab Emirates", "currency_code": "AED", "currency_symbol": "AED"},
    "SG": {"country_code": "SG", "country_name": "Singapore", "currency_code": "SGD", "currency_symbol": "S$"},
    "AU": {"country_code": "AU", "country_name": "Australia", "currency_code": "AUD", "currency_symbol": "A$"},
    "CA": {"country_code": "CA", "country_name": "Canada", "currency_code": "CAD", "currency_symbol": "C$"},
}


def _restcountries_currency(country_code: str) -> Optional[dict]:
    preset = COUNTRY_CURRENCY_PRESETS.get(country_code.upper())
    try:
        response = requests.get(
            RESTCOUNTRIES_URL.format(code=country_code),
            params={"fields": "currencies,name,cca2"},
            headers={"User-Agent": "ai-trip-planner/1.0"},
            timeout=10,
        )
        if response.status_code != 200:
            return None

        data = response.json()
        country = data[0] if isinstance(data, list) else data
        currencies = country.get("currencies") or {}
        if not currencies:
            return None

        currency_code, currency_data = next(iter(currencies.items()))
        return {
            "country_code": country.get("cca2", country_code).upper(),
            "country_name": (country.get("name") or {}).get("common"),
            "currency_code": currency_code,
            "currency_symbol": currency_data.get("symbol"),
        }
    except Exception:
        return preset


def _reverse_geocode_country(coords: Coordinates) -> Optional[dict]:
    try:
        response = requests.get(
            NOMINATIM_REVERSE_URL,
            params={
                "lat": coords.lat,
                "lon": coords.lng,
                "format": "jsonv2",
                "addressdetails": 1,
            },
            headers={"User-Agent": "ai-trip-planner/1.0"},
            timeout=10,
        )
        if response.status_code != 200:
            return None

        data = response.json()
        address = data.get("address") or {}
        country_code = str(address.get("country_code", "")).upper()
        if not country_code:
            return None

        return {
            "country_code": country_code,
            "country_name": address.get("country"),
        }
    except Exception:
        return None


def _get_rate(from_currency: str, to_currency: str) -> Optional[float]:
    if from_currency == to_currency:
        return 1.0

    api_key = os.getenv("EXCHANGE_RATE_API_KEY")
    if not api_key:
        return None

    try:
        response = requests.get(
            f"https://v6.exchangerate-api.com/v6/{api_key}/latest/{from_currency}",
            timeout=10,
        )
        if response.status_code != 200:
            return None

        data = response.json()
        rates = data.get("conversion_rates") or {}
        rate = rates.get(to_currency)
        return float(rate) if rate is not None else None
    except Exception:
        return None


def build_currency_insight(
    question: str,
    answer: str = "",
    current_location: Optional[Coordinates] = None,
    resolved_destination: Optional[dict] = None,
) -> Optional[CurrencyData]:
    destination = resolved_destination or resolve_destination(question, answer)
    if not destination:
        return None

    destination_country_code = str(destination.get("country", "")).upper()
    if not destination_country_code:
        return None

    destination_currency = _restcountries_currency(destination_country_code)
    if not destination_currency:
        return None

    current_geo = _reverse_geocode_country(current_location) if current_location else None
    current_currency = (
        _restcountries_currency(current_geo["country_code"])
        if current_geo and current_geo.get("country_code")
        else None
    )

    destination_code = destination_currency["currency_code"]
    destination_symbol = destination_currency.get("currency_symbol")
    destination_country = destination_currency.get("country_name")

    if current_currency:
        current_code = current_currency["currency_code"]
        current_symbol = current_currency.get("currency_symbol")
        current_country = current_currency.get("country_name")
        same_currency = current_code == destination_code
        rate = _get_rate(current_code, destination_code)

        if same_currency:
            exchange_text = f"Your current location and {destination_country} both use {destination_code}."
            key_points = [
                f"Your current region uses {current_code} ({current_symbol or current_code}).",
                f"{destination_country} also uses {destination_code} ({destination_symbol or destination_code}).",
                "No currency exchange is needed for this trip.",
            ]
        else:
            exchange_text = (
                f"1 {current_code} ≈ {rate:.2f} {destination_code}"
                if rate is not None
                else f"{destination_country} uses {destination_code}."
            )
            key_points = [
                f"Your current region uses {current_code} ({current_symbol or current_code}).",
                f"{destination_country} uses {destination_code} ({destination_symbol or destination_code}).",
                exchange_text,
            ]

        return CurrencyData(
            rate=f"{rate:.2f}" if rate is not None else None,
            from_currency=current_code,
            to_currency=destination_code,
            symbol=destination_symbol,
            from_symbol=current_symbol,
            user_country=current_country,
            destination_country=destination_country,
            same_currency=same_currency,
            exchange_text=exchange_text,
            key_points=key_points,
        )

    return CurrencyData(
        rate=None,
        from_currency=None,
        to_currency=destination_code,
        symbol=destination_symbol,
        destination_country=destination_country,
        exchange_text=f"{destination_country} uses {destination_code}.",
        key_points=[
            f"{destination_country} uses {destination_code} ({destination_symbol or destination_code}).",
            "Allow location access to compare it with your local currency automatically.",
        ],
    )
