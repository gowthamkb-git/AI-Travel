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

export function openPlaceInGoogleMaps(place: PlaceMarker | string) {
  openInNewTab(buildGoogleMapsPlaceUrl(place));
}

export function openDirectionsInGoogleMaps(place: PlaceMarker | string, mode: "driving" | "walking" | "transit" = "driving") {
  openInNewTab(buildGoogleMapsDirectionsUrl(place, mode));
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
