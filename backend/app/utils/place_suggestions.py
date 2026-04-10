import os
import re
from typing import Dict, List, Optional

import requests


def _detect_place_mode(question: str) -> str:
    lowered = question.lower()
    if re.search(r"\b(hotel|hotels|stay|stays|accommodation|resort|lodging|homestay)\b", lowered):
        return "hotels"
    if re.search(r"\b(restaurant|restaurants|food|eat|dining|cafe|cafes)\b", lowered):
        return "restaurants"
    return "attractions"


def _score_google_place(item: dict, mode: str) -> float:
    rating = float(item.get("rating", 0) or 0)
    reviews = int(item.get("user_ratings_total", 0) or 0)
    types = {str(value).lower() for value in (item.get("types") or [])}

    score = (rating * 1000) + min(reviews, 50000)

    if mode == "hotels":
        if "lodging" in types:
            score += 8000
        if "hotel" in types or "resort" in types:
            score += 4000
    elif mode == "restaurants":
        if "restaurant" in types:
            score += 8000
        if "cafe" in types or "meal_takeaway" in types:
            score += 2500
    else:
        # Prefer true sightseeing destinations over generic establishments.
        if "tourist_attraction" in types:
            score += 8000
        if "museum" in types or "hindu_temple" in types or "church" in types or "mosque" in types:
            score += 2500
        if "park" in types or "amusement_park" in types or "zoo" in types or "aquarium" in types:
            score += 1500

    return score


def _build_google_place(item: dict, mode: str) -> Optional[Dict]:
    name = str(item.get("name", "")).strip()
    geometry = item.get("geometry") or {}
    coords = geometry.get("location") or {}
    lat_value = coords.get("lat")
    lng_value = coords.get("lng")
    if not name or lat_value is None or lng_value is None:
        return None

    place_id = item.get("place_id")
    return {
        "name": name,
        "lat": float(lat_value),
        "lng": float(lng_value),
        "coords": {"lat": float(lat_value), "lng": float(lng_value)},
        "category": mode,
        "rating": float(item.get("rating", 0) or 0) or None,
        "address": item.get("formatted_address") or item.get("vicinity"),
        "place_id": place_id,
        "google_maps_url": (
            f"https://www.google.com/maps/search/?api=1&query_place_id={place_id}"
            if place_id else None
        ),
        "_score": _score_google_place(item, mode),
        "_reviews": int(item.get("user_ratings_total", 0) or 0),
    }


def _google_place_queries(location: str, lat: float, lon: float, mode: str) -> List[dict]:
    if mode == "hotels":
        return [
            {"query": f"top rated hotels in {location}", "search_kind": "textsearch"},
            {"query": f"best stays in {location}", "search_kind": "textsearch"},
            {
                "location": f"{lat},{lon}",
                "radius": 20000,
                "type": "lodging",
                "keyword": f"best hotels in {location}",
                "search_kind": "nearby",
            },
        ]
    if mode == "restaurants":
        return [
            {"query": f"top rated restaurants in {location}", "search_kind": "textsearch"},
            {"query": f"best local food in {location}", "search_kind": "textsearch"},
            {
                "location": f"{lat},{lon}",
                "radius": 15000,
                "type": "restaurant",
                "keyword": f"best restaurants in {location}",
                "search_kind": "nearby",
            },
        ]
    return [
        {"query": f"must visit places in {location}", "search_kind": "textsearch"},
        {"query": f"top rated tourist attractions in {location}", "search_kind": "textsearch"},
        {"query": f"famous landmarks in {location}", "search_kind": "textsearch"},
        {
            "location": f"{lat},{lon}",
            "radius": 20000,
            "type": "tourist_attraction",
            "keyword": f"tourist attractions in {location}",
            "search_kind": "nearby",
        },
    ]


def _google_places(location: str, lat: float, lon: float, limit: int = 15, question: str = "") -> List[dict]:
    api_key = os.getenv("GPLACES_API_KEY")
    if not api_key:
        return []

    mode = _detect_place_mode(question)
    queries = _google_place_queries(location, lat, lon, mode)

    try:
        candidates: Dict[str, Dict] = {}
        for query in queries:
            search_type = query["search_kind"]
            endpoint = (
                "https://maps.googleapis.com/maps/api/place/textsearch/json"
                if search_type == "textsearch"
                else "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            )
            params = {"key": api_key, **{k: v for k, v in query.items() if k != "search_kind"}}
            response = requests.get(endpoint, params=params, timeout=15)
            if response.status_code != 200:
                continue

            for item in response.json().get("results") or []:
                place = _build_google_place(item, mode)
                if not place:
                    continue

                key = (place.get("place_id") or place["name"]).lower()
                current = candidates.get(key)
                if current is None or place["_score"] > current["_score"]:
                    candidates[key] = place

        if not candidates:
            return []

        ranked = sorted(
            candidates.values(),
            key=lambda item: (item["_score"], item["_reviews"], item.get("rating") or 0),
            reverse=True,
        )

        strong_places = [
            item for item in ranked
            if (item.get("rating") or 0) >= 4.2 and item["_reviews"] >= 100
        ]
        chosen = strong_places[:limit]

        for item in chosen:
            item.pop("_score", None)
            item.pop("_reviews", None)
        return chosen
    except Exception:
        return []


def _search_place_names(location: str, limit: int = 15, question: str = "") -> List[dict]:
    mode = _detect_place_mode(question)
    if mode == "hotels":
        search_terms = [
            f"top hotels in {location}",
            f"best stays in {location}",
            f"lodging in {location}",
        ]
    elif mode == "restaurants":
        search_terms = [
            f"top restaurants in {location}",
            f"best food in {location}",
            f"cafes in {location}",
        ]
    else:
        search_terms = [
            f"top attractions in {location}",
            f"tourist places in {location}",
            f"landmarks in {location}",
        ]
    places: List[dict] = []
    seen = set()

    for query in search_terms:
        try:
            response = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 8,
                },
                headers={"User-Agent": "ai-trip-planner/1.0"},
                timeout=10,
            )
            if response.status_code != 200:
                continue

            for item in response.json():
                raw_name = item.get("name") or str(item.get("display_name", "")).split(",")[0]
                name = raw_name.strip() if raw_name else ""
                if not name:
                    continue
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                places.append({
                    "name": name,
                    "lat": None,
                    "lng": None,
                    "coords": None,
                    "category": mode,
                    "rating": None,
                    "address": None,
                    "place_id": None,
                    "google_maps_url": None,
                })
                if len(places) >= limit:
                    return places
        except Exception:
            continue

    return places


def search_place_names(location: str, limit: int = 15, question: str = "") -> List[dict]:
    return _search_place_names(location, limit, question)


def get_place_suggestions(lat: float, lon: float, location: str = "", limit: int = 15, question: str = "") -> List[dict]:
    google_places = _google_places(location, lat, lon, limit, question)
    if google_places:
        return google_places

    radius = 25000
    mode = _detect_place_mode(question)
    if mode == "hotels":
        query = f"""
    [out:json][timeout:25];
    (
      node(around:{radius},{lat},{lon})[tourism=hotel];
      node(around:{radius},{lat},{lon})[tourism=guest_house];
      node(around:{radius},{lat},{lon})[tourism=hostel];
    );
    out center 30;
    """
    elif mode == "restaurants":
        query = f"""
    [out:json][timeout:25];
    (
      node(around:{radius},{lat},{lon})[amenity=restaurant];
      node(around:{radius},{lat},{lon})[amenity=cafe];
      node(around:{radius},{lat},{lon})[amenity=fast_food];
    );
    out center 30;
    """
    else:
        query = f"""
    [out:json][timeout:25];
    (
      node(around:{radius},{lat},{lon})[tourism=attraction];
      node(around:{radius},{lat},{lon})[tourism=museum];
      node(around:{radius},{lat},{lon})[tourism=viewpoint];
      node(around:{radius},{lat},{lon})[natural=peak];
      node(around:{radius},{lat},{lon})[natural=beach];
      node(around:{radius},{lat},{lon})[leisure=park];
      node(around:{radius},{lat},{lon})[historic];
    );
    out center 30;
    """

    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data=query,
            headers={"Content-Type": "text/plain;charset=UTF-8"},
            timeout=20,
        )
        if response.status_code != 200:
            return []

        data = response.json()
        places: List[dict] = []
        seen = set()
        for item in data.get("elements", []):
            name = (item.get("tags") or {}).get("name")
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            item_lat = item.get("lat") or (item.get("center") or {}).get("lat")
            item_lng = item.get("lon") or (item.get("center") or {}).get("lon")
            places.append({
                "name": name,
                "lat": float(item_lat) if item_lat is not None else None,
                "lng": float(item_lng) if item_lng is not None else None,
                "coords": {"lat": float(item_lat), "lng": float(item_lng)} if item_lat is not None and item_lng is not None else None,
                "category": mode,
                "rating": None,
                "address": None,
                "place_id": None,
                "google_maps_url": None,
            })
            if len(places) >= limit:
                break
        if places:
            return places[:limit]
        if location:
            return _search_place_names(location, limit, question)
        return []
    except Exception:
        if location:
            return _search_place_names(location, limit, question)
        return []
