"use client";

import { Coords, PlaceMarker } from "@/types";

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function buildGoogleMapsPlaceUrl(place: PlaceMarker | string) {
  if (typeof place !== "string") {
    if (place.googleMapsUrl) return place.googleMapsUrl;
    if (place.placeId) {
      return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.placeId)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.coords.lat},${place.coords.lng}`)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

export function buildGoogleMapsDirectionsUrl(place: PlaceMarker | string, mode: "driving" | "walking" | "transit" = "driving") {
  if (typeof place !== "string") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.coords.lat},${place.coords.lng}`)}&travelmode=${mode}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}&travelmode=${mode}`;
}

export function buildGoogleMapsDirectionsUrlWithOrigin(
  place: PlaceMarker | string,
  origin: Coords | null,
  mode: "driving" | "walking" | "transit" = "driving"
) {
  const params = new URLSearchParams({ api: "1", travelmode: mode });

  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  if (typeof place !== "string") {
    params.set("destination", `${place.coords.lat},${place.coords.lng}`);
  } else {
    params.set("destination", place);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function openPlaceInGoogleMaps(place: PlaceMarker | string) {
  openInNewTab(buildGoogleMapsPlaceUrl(place));
}

export function openDirectionsInGoogleMaps(
  place: PlaceMarker | string,
  mode: "driving" | "walking" | "transit" = "driving",
  origin: Coords | null = null
) {
  openInNewTab(origin ? buildGoogleMapsDirectionsUrlWithOrigin(place, origin, mode) : buildGoogleMapsDirectionsUrl(place, mode));
}

export function buildGoogleMapsEmbedUrl(origin: Coords | null, destination: Coords, mode: "road" | "train" | "plane") {
  const destinationValue = `${destination.lat},${destination.lng}`;
  const originValue = origin ? `${origin.lat},${origin.lng}` : "";
  const params = new URLSearchParams({
    output: "embed",
    saddr: originValue,
    daddr: destinationValue,
    dirflg: mode === "road" ? "d" : "r",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}
