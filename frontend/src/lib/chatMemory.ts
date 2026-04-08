"use client";

const LOCATION_REFERENCE_PATTERN = /\b(?:there|that place|this city|that city|that location|this place)\b/gi;

export function hasLocationReference(text: string) {
  return new RegExp(LOCATION_REFERENCE_PATTERN.source, "i").test(text);
}

export function applyLocationMemory(text: string, location: string | null) {
  if (!location) return text;

  const query = text.trim();
  if (!query) return text;

  const topicalPattern = /\b(top places|best places|places|hotels|restaurants|weather|budget|plan|trip|itinerary)\s+(?:there|that place|this city|that city|that location|this place)\b/gi;
  if (topicalPattern.test(query)) {
    return query.replace(topicalPattern, (_match, topic: string) => `${topic} in ${location}`);
  }

  if (hasLocationReference(query)) {
    return query.replace(new RegExp(LOCATION_REFERENCE_PATTERN.source, "gi"), location);
  }

  return query;
}
