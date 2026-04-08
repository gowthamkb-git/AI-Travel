"use client";

import { WidgetData } from "@/types";

function extractSummaryValue(response: string, index: number): string | null {
  const match = response.match(new RegExp(`^${index}\\.\\s+[^:]+:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

export function detectDestinationFromQuery(query: string): string | null {
  const patterns = [
    /\btrip to\s+([^.!?]+?)(?:\s+for\b|\s+from\b|\s+under\b|$)/i,
    /\btrip plan to\s+([^.!?]+?)(?:\s+for\b|\s+from\b|\s+under\b|$)/i,
    /\bplan for\s+([^.!?]+?)(?:\s+trip\b|\s+for\b|$)/i,
    /\bvacation in\s+([^.!?]+?)(?:\s+for\b|\s+with\b|$)/i,
    /\bvisit\s+([^.!?]+?)(?:\s+for\b|\s+with\b|$)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
  }

  return null;
}

function parseWeather(summary: string | null, destination: string | null) {
  if (!summary || /not available yet/i.test(summary)) {
    return destination ? { location: destination, temp: null, condition: null, season: null } : null;
  }

  const temp = summary.match(/(-?\d+\s*°C)/i)?.[1]?.replace(/\s+/g, "") ?? null;
  const season = summary.match(/\((Peak Season|Off Season)\)/i)?.[1] ?? null;
  const location =
    summary.match(/\bfor\s+(.+?)(?:\s+\((?:Peak Season|Off Season)\)|$)/i)?.[1]?.trim() ??
    destination;
  const conditionText = summary
    .replace(/-?\d+\s*°C/i, "")
    .replace(/\bfor\s+.+?(?:\s+\((?:Peak Season|Off Season)\)|$)/i, "")
    .replace(/\((Peak Season|Off Season)\)/i, "")
    .trim()
    .replace(/\s+/g, " ");

  return {
    temp,
    condition: conditionText || null,
    location: location || null,
    season,
  };
}

function parseCurrency(summary: string | null) {
  if (!summary || /not available yet/i.test(summary)) return null;

  const match = summary.match(/1\s+([A-Z]{3})\s*[≈=]\s*([0-9.]+)\s+([A-Z]{3})\s*\(([^)]+)\)/i);
  if (match) {
    return {
      from_currency: match[1].toUpperCase(),
      rate: match[2],
      to_currency: match[3].toUpperCase(),
      symbol: match[4],
      same_currency: match[1].toUpperCase() === match[3].toUpperCase(),
      exchange_text: summary,
      key_points: [summary],
    };
  }

  const sameCurrency = summary.match(/both use\s+([A-Z]{3})/i);
  if (sameCurrency) {
    return {
      from_currency: sameCurrency[1].toUpperCase(),
      rate: "1.00",
      to_currency: sameCurrency[1].toUpperCase(),
      symbol: null,
      same_currency: true,
      exchange_text: summary,
      key_points: [summary],
    };
  }

  const destinationCurrency = summary.match(/uses\s+([A-Z]{3})/i);
  if (destinationCurrency) {
    return {
      from_currency: null,
      rate: null,
      to_currency: destinationCurrency[1].toUpperCase(),
      symbol: null,
      same_currency: null,
      exchange_text: summary,
      key_points: [summary],
    };
  }

  return null;
}

function parseBudget(response: string, hotelSummary: string | null, totalSummary: string | null) {
  const total =
    totalSummary?.match(/([₹$£€¥][\d,.\w]+)/)?.[1] ??
    response.match(/^\s*(?:[-*•]\s*)?Total:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ??
    null;
  const perDay = response.match(/^\s*(?:[-*•]\s*)?Per Day Budget:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ?? null;
  const accommodation =
    hotelSummary?.match(/([₹$£€¥][\d,.\w]+)/)?.[1] ??
    response.match(/^\s*(?:[-*•]\s*)?Hotel:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ??
    null;
  const food = response.match(/^\s*(?:[-*•]\s*)?Food(?: and Drink)?:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ?? null;
  const transport = response.match(/^\s*(?:[-*•]\s*)?Transportation:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ?? null;
  const activities = response.match(/^\s*(?:[-*•]\s*)?Activities(?: and Entrance Fees)?:\s*([₹$£€¥][\d,.\w]+)/im)?.[1] ?? null;

  if (!total && !perDay && !accommodation && !food && !transport && !activities) return null;

  const destinationMatch = totalSummary?.match(/about\s+([₹$£€¥][\d,.\w]+)/i)?.[1] ?? null;

  return {
    total,
    per_day: perDay,
    currency_symbol: total?.charAt(0) ?? accommodation?.charAt(0) ?? null,
    total_local: total,
    total_destination: destinationMatch,
    per_day_local: perDay,
    per_day_destination: null,
    destination_currency: null,
    local_currency: null,
    same_currency: null,
    exchange_text: totalSummary,
    key_points: totalSummary ? [totalSummary] : [],
    breakdown: accommodation || food || transport || activities
      ? {
          accommodation,
          food,
          transport,
          activities,
        }
      : null,
  };
}

export function restoreTripWidgets(query: string, response: string): { widgets: WidgetData | null; destination: string | null } {
  const weatherSummary = extractSummaryValue(response, 1);
  const hotelSummary = extractSummaryValue(response, 3);
  const currencySummary = extractSummaryValue(response, 4);
  const totalSummary = extractSummaryValue(response, 6);

  const destination =
    weatherSummary?.match(/\bfor\s+(.+?)(?:\s+\((?:Peak Season|Off Season)\)|$)/i)?.[1]?.trim() ??
    detectDestinationFromQuery(query);

  const weather = parseWeather(weatherSummary, destination);
  const currency = parseCurrency(currencySummary);
  const budget = parseBudget(response, hotelSummary, totalSummary);

  const widgets: WidgetData | null = weather || currency || budget
    ? {
        weather,
        currency,
        budget,
      }
    : null;

  return { widgets, destination: weather?.location ?? destination ?? null };
}
