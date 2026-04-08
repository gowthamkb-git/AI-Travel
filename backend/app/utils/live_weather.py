import os
from typing import Optional

import requests

from app.schemas.trip_schema import WeatherData
from app.utils.destination_resolver import format_resolved_location, resolve_destination
from app.utils.weather_info import WeatherForecastTool


PEAK_SEASON_TEXT = "October to March is generally the best season to visit."
OFF_SEASON_TEXT = "June to September is usually the off season because of heavier rain."

def _season_for_condition(condition: str) -> str:
    condition = condition.lower()
    if "rain" in condition or "storm" in condition or "monsoon" in condition:
        return "Off Season"
    return "Peak Season"


def _best_time_text(season: str) -> str:
    return OFF_SEASON_TEXT if season == "Off Season" else PEAK_SEASON_TEXT


def _build_key_points(temp: float, condition: str, humidity: int, wind_speed: float, season: str) -> list[str]:
    points = [
        f"Current temperature is around {round(temp)}°C with {condition}.",
        f"Humidity is about {humidity}%, so comfort levels may vary through the day.",
        f"Wind speed is near {wind_speed:.1f} m/s.",
        _best_time_text(season),
    ]

    if temp >= 32:
        points.append("Afternoons may feel quite warm, so morning and evening outings are usually better.")
    elif temp <= 18:
        points.append("Carrying a light jacket is a good idea for early mornings and evenings.")
    else:
        points.append("The weather is comfortable for sightseeing and outdoor exploration.")

    return points


def fetch_live_weather(question: str, answer: str = "", resolved_location: Optional[dict] = None) -> Optional[WeatherData]:
    api_key = os.getenv("OPENWEATHERMAP_API_KEY")
    if not api_key:
        return None

    resolved_location = resolved_location or resolve_destination(question, answer)
    if not resolved_location:
        return None

    lat = resolved_location.get("lat")
    lon = resolved_location.get("lon")
    if lat is None or lon is None:
        return None

    service = WeatherForecastTool(api_key)

    try:
        weather_response = requests.get(
            f"{service.base_url}/weather",
            params={"lat": lat, "lon": lon, "appid": api_key, "units": "metric"},
            timeout=10,
        )
        data = weather_response.json() if weather_response.status_code == 200 else {}
    except Exception:
        return None

    if not data or not data.get("main"):
        return None

    temp = data.get("main", {}).get("temp")
    feels_like = data.get("main", {}).get("feels_like")
    humidity = data.get("main", {}).get("humidity")
    wind_speed = data.get("wind", {}).get("speed")
    condition = data.get("weather", [{}])[0].get("description", "weather conditions")

    display_location = format_resolved_location(resolved_location) or data.get("name")
    season = _season_for_condition(condition)

    return WeatherData(
        temp=f"{round(temp)}°C" if temp is not None else None,
        condition=condition.title() if condition else None,
        location=display_location,
        season=season,
        best_time_to_visit=_best_time_text(season),
        feels_like=f"{round(feels_like)}°C" if feels_like is not None else None,
        humidity=f"{humidity}%" if humidity is not None else None,
        wind_speed=f"{wind_speed:.1f} m/s" if wind_speed is not None else None,
        key_points=_build_key_points(
            float(temp) if temp is not None else 0.0,
            condition,
            int(humidity) if humidity is not None else 0,
            float(wind_speed) if wind_speed is not None else 0.0,
            season,
        ),
    )
