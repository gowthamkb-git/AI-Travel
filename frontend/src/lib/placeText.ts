"use client";

import { PlaceMarker } from "@/types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PLACE_LINE_PATTERN = /^(\s*(?:[-*]|\u2022|\d+\.)\s+)(?:\*\*)?([^:\n*]{2,80}?)(?:\*\*)?:(?=\s)/gm;
const NON_PLACE_LABEL_PATTERN = /\b(day\s+\d+|morning|afternoon|evening|budget snapshot|season guide|destination|duration|budget|origin|trip overview|current weather|transportation|accommodation|food|activities|total)\b/i;

export function getPlaceLinkId(place: PlaceMarker) {
  return encodeURIComponent(place.name.toLowerCase());
}

export function findPlaceByLinkId(places: PlaceMarker[], linkId: string) {
  return places.find((place) => getPlaceLinkId(place) === linkId) ?? null;
}

export function injectPlaceLinks(content: string, places: PlaceMarker[]) {
  if (!content || !places.length) return content;

  let nextContent = content;
  const orderedPlaces = [...places]
    .filter((place) => place.name && place.coords)
    .sort((a, b) => b.name.length - a.name.length);

  for (const place of orderedPlaces) {
    const placeId = getPlaceLinkId(place);
    const pattern = new RegExp(`(^|[^\\w])(${escapeRegExp(place.name)})(?=[^\\w]|$)`, "gi");

    nextContent = nextContent.replace(pattern, (match, prefix: string, name: string) => {
      if (match.includes("(place://")) return match;
      return `${prefix}[${name}](place://${placeId})`;
    });
  }

  return nextContent;
}

export function injectListedPlaceQueryLinks(content: string) {
  if (!content) return content;

  return content.replace(PLACE_LINE_PATTERN, (match, prefix: string, label: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel || NON_PLACE_LABEL_PATTERN.test(trimmedLabel)) {
      return match;
    }
    return `${prefix}[${trimmedLabel}](place-query://${encodeURIComponent(trimmedLabel)}):`;
  });
}
