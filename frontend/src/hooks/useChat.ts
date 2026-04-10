"use client";

import { useCallback, useEffect, useState } from "react";
import { Message, PlaceMarker } from "@/types";
import { getPlaceSuggestions, planTrip, restoreTrip, saveTrip } from "@/services/api";
import { useTripContext } from "@/lib/TripContext";
import { useAuth } from "@/lib/AuthContext";
import { detectDestinationFromQuery, restoreTripWidgets } from "@/lib/historyTripRestore";
import { applyLocationMemory } from "@/lib/chatMemory";

const FREE_LIMIT = 2;
const INITIAL_MESSAGE: Message = { role: "assistant", content: "Hi! Tell me where you want to travel" };
const TRIP_QUERY_PATTERN = /\b(plan|trip|travel|visit|itinerary|days?\b|from\b|to\b|budget\b|hotel\b)\b/i;
const PLACE_REFRESH_PATTERN = /\b(place|places|must visit|tourist|attraction|sightseeing|hotel|hotels|stay|restaurant|restaurants|food|cafe)\b/i;

function requestBrowserCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  });
}

function toPlaceMarkers(
  places: Array<{
    name: string;
    category?: string | null;
    lat?: number | null;
    lng?: number | null;
    rating?: number | null;
    address?: string | null;
    placeId?: string | null;
    googleMapsUrl?: string | null;
  }>
): PlaceMarker[] {
  return places
    .filter((place) => typeof place.lat === "number" && typeof place.lng === "number")
    .map((place) => ({
      name: place.name,
      coords: { lat: place.lat as number, lng: place.lng as number },
      category: place.category ?? null,
      rating: place.rating ?? null,
      address: place.address ?? null,
      placeId: place.placeId ?? null,
      googleMapsUrl: place.googleMapsUrl ?? null,
    }));
}

function mergePlaceMarkers(existing: PlaceMarker[], incoming: PlaceMarker[]) {
  const merged: PlaceMarker[] = [];
  const seen = new Set<string>();

  for (const place of [...incoming, ...existing]) {
    const key = `${place.name.toLowerCase()}|${place.coords.lat.toFixed(4)}|${place.coords.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
  }

  return merged;
}

async function fetchMarkerBundles(location: string, primaryQuestion: string) {
  const prompts = [
    "must visit tourist attractions there",
    "top rated attractions there",
    "best activities there",
    primaryQuestion,
    "top rated hotels there",
    "top rated restaurants there",
  ];

  const settledResponses = await Promise.allSettled(
    prompts.map((prompt) => getPlaceSuggestions(location, prompt))
  );

  const responses = settledResponses.map((result) =>
    result.status === "fulfilled"
      ? result.value
      : {
          location,
          places: [] as Array<{
            name: string;
            lat?: number | null;
            lng?: number | null;
            rating?: number | null;
            address?: string | null;
            placeId?: string | null;
            googleMapsUrl?: string | null;
          }>,
        }
  );

  return responses.reduce<PlaceMarker[]>((allMarkers, response) => {
    return mergePlaceMarkers(allMarkers, toPlaceMarkers(response.places ?? []));
  }, []);
}

export function useChat() {
  const RETRY_MESSAGE = "Model is busy, retrying...";
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [showFreeModal, setShowFreeModal] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeTripTitle, setActiveTripTitle] = useState<string | null>(null);
  const [composerResetKey, setComposerResetKey] = useState(0);
  const {
    widgets,
    setWidgets,
    currentLocation,
    setCurrentLocation,
    setLastResponse,
    placeMarkers,
    setPlaceMarkers,
    setSelectedPlace,
    currentCoords,
    setCurrentCoords,
    setDestinationCoords,
  } = useTripContext();
  const { token } = useAuth();

  const getFreeCount = () => {
    if (typeof window === "undefined") return 0;
    const rawValue = localStorage.getItem("free_usage_count") || "0";
    const parsed = parseInt(rawValue, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const incFreeCount = () => {
    if (typeof window === "undefined") return;
    localStorage.setItem("free_usage_count", String(getFreeCount() + 1));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cachedMessages = localStorage.getItem("chat_messages");
    if (cachedMessages) {
      try {
        const parsed = JSON.parse(cachedMessages) as Message[];
        const sanitized = parsed.filter(
          (message): message is Message =>
            (message.role === "user" || message.role === "assistant") && typeof message.content === "string"
        );
        setMessages(sanitized.length ? sanitized : [INITIAL_MESSAGE]);
      } catch {
        setMessages([INITIAL_MESSAGE]);
      }
    }

    setActiveTripId(localStorage.getItem("active_trip_id"));
    setActiveTripTitle(localStorage.getItem("active_trip_title"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTripId) localStorage.setItem("active_trip_id", activeTripId);
    else localStorage.removeItem("active_trip_id");
  }, [activeTripId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeTripTitle) localStorage.setItem("active_trip_title", activeTripTitle);
    else localStorage.removeItem("active_trip_title");
  }, [activeTripTitle]);

  const sendMessage = async (text: string) => {
    if (!token && getFreeCount() >= FREE_LIMIT) {
      setShowFreeModal(true);
      return;
    }

    const normalizedQuestion = applyLocationMemory(text, currentLocation);
    const explicitDestination = detectDestinationFromQuery(normalizedQuestion);
    const updatedMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(updatedMessages);
    setLoading(true);

    const history = updatedMessages
      .slice(1, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const resolvedCurrentCoords = currentCoords ?? await requestBrowserCoords();
      if (resolvedCurrentCoords && !currentCoords) {
        setCurrentCoords(resolvedCurrentCoords);
      }

      const response = await planTrip(
        {
          question: normalizedQuestion,
          history,
          model_provider: "groq",
          current_location: resolvedCurrentCoords,
          location_context: currentLocation,
        },
        token,
        () => {
          setMessages((prev) =>
            prev[prev.length - 1]?.content === RETRY_MESSAGE
              ? prev
              : [...prev, { role: "assistant", content: RETRY_MESSAGE }]
          );
        }
      );
      const answer = response.answer;

      setMessages((prev) => {
        const trimmed = prev.filter((message) => message.content !== RETRY_MESSAGE);
        return [...trimmed, { role: "assistant", content: answer }];
      });
      setLastResponse(answer);

      if (!token) incFreeCount();

      if (token) {
        const shouldTrackConversation = Boolean(
          activeTripId || activeTripTitle || TRIP_QUERY_PATTERN.test(text) || answer.includes("## Trip Summary")
        );
        if (shouldTrackConversation) {
          const conversationTitle = activeTripTitle ?? text;
          saveTrip(conversationTitle, answer, token, activeTripId)
            .then((savedTrip) => {
              setActiveTripId(savedTrip.id);
              setActiveTripTitle(savedTrip.query);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("trip-history-updated", { detail: savedTrip }));
              }
            })
            .catch(() => {});
        }
      }

      if (response.widgets) {
        const { weather, currency, budget } = response.widgets;
        if (weather || currency || budget) {
          setWidgets({
            weather: weather ?? widgets?.weather ?? null,
            currency: currency ?? widgets?.currency ?? null,
            budget: budget ?? widgets?.budget ?? null,
          });
        }
      }

      const nextLocation = explicitDestination
        ? (response.destination ?? response.widgets?.weather?.location ?? explicitDestination)
        : (currentLocation ?? response.destination ?? response.widgets?.weather?.location ?? null);
      setCurrentLocation(nextLocation);

      const shouldAcceptDestinationCoords =
        !currentLocation ||
        Boolean(explicitDestination) ||
        (response.destination && response.destination === currentLocation);
      if (shouldAcceptDestinationCoords) {
        setDestinationCoords(response.destination_coords ?? null);
      }

      const shouldRefreshPlaces = Boolean(nextLocation) && (
        placeMarkers.length === 0 ||
        nextLocation !== currentLocation ||
        PLACE_REFRESH_PATTERN.test(normalizedQuestion)
      );
      if (shouldRefreshPlaces && nextLocation) {
        try {
          const markers =
            nextLocation !== currentLocation || placeMarkers.length === 0
              ? await fetchMarkerBundles(nextLocation, normalizedQuestion)
              : toPlaceMarkers((await getPlaceSuggestions(nextLocation, normalizedQuestion)).places ?? []);
          if (markers.length) {
            setPlaceMarkers((current) => mergePlaceMarkers(current, markers));
            setSelectedPlace((current) => current ?? markers[0] ?? null);
          }
        } catch {
          // Keep the current map/place state if suggestion refresh fails.
        }
      }
    } catch (err: unknown) {
      let message = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("Rate limit")) {
          message = "Rate limit reached. Please wait a moment and try again.";
        } else {
          message = err.message;
        }
      }
      setMessages((prev) => {
        const trimmed = prev.filter((item) => item.content !== RETRY_MESSAGE);
        return [...trimmed, { role: "assistant", content: message }];
      });
    } finally {
      setLoading(false);
    }
  };

  const resetChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setWidgets(null);
    setCurrentLocation(null);
    setLastResponse(null);
    setDestinationCoords(null);
    setPlaceMarkers([]);
    setSelectedPlace(null);
    setActiveTripId(null);
    setActiveTripTitle(null);
    setComposerResetKey((value) => value + 1);
    if (typeof window !== "undefined") {
      localStorage.removeItem("chat_messages");
      localStorage.removeItem("active_trip_id");
      localStorage.removeItem("active_trip_title");
      localStorage.removeItem("trip_widgets");
      localStorage.removeItem("trip_current_location");
      localStorage.removeItem("trip_location");
      localStorage.removeItem("trip_last_response");
      localStorage.removeItem("trip_destination_coords");
      localStorage.removeItem("trip_place_markers");
      localStorage.removeItem("trip_selected_place");
    }
  }, [setCurrentLocation, setDestinationCoords, setLastResponse, setPlaceMarkers, setSelectedPlace, setWidgets]);

  const loadTrip = useCallback(async (tripId: string, query: string, response: string) => {
    const restored = restoreTripWidgets(query, response);
    setMessages([
      INITIAL_MESSAGE,
      { role: "user", content: query },
      { role: "assistant", content: response },
    ]);
    setActiveTripId(tripId);
    setActiveTripTitle(query);
    setLastResponse(response);
    setWidgets(restored.widgets);
    setCurrentLocation(restored.destination);
    setDestinationCoords(null);
    setPlaceMarkers([]);
    setSelectedPlace(null);

    try {
      const resolvedCurrentCoords = currentCoords ?? await requestBrowserCoords();
      if (resolvedCurrentCoords && !currentCoords) {
        setCurrentCoords(resolvedCurrentCoords);
      }

      const enriched = await restoreTrip(
        {
          question: query,
          history: [{ role: "assistant", content: response }],
          model_provider: "groq",
          current_location: resolvedCurrentCoords,
          location_context: restored.destination,
        },
        token
      );

      setLastResponse(enriched.answer);
      setWidgets(enriched.widgets ?? restored.widgets);
      const restoredLocation = enriched.destination ?? restored.destination;
      setCurrentLocation(restoredLocation);
      setDestinationCoords(enriched.destination_coords ?? null);

      if (restoredLocation) {
        try {
          const markers = await fetchMarkerBundles(restoredLocation, query);
          if (markers.length) {
            setPlaceMarkers((current) => mergePlaceMarkers(current, markers));
            setSelectedPlace((current) => current ?? markers[0] ?? null);
          }
        } catch {
          // Preserve any existing markers when restore-time suggestions fail.
        }
      }
    } catch {
      setDestinationCoords(null);
    }
  }, [currentCoords, setCurrentCoords, setCurrentLocation, setDestinationCoords, setLastResponse, setPlaceMarkers, setSelectedPlace, setWidgets, token]);

  return { messages, loading, sendMessage, showFreeModal, setShowFreeModal, resetChat, loadTrip, composerResetKey };
}
