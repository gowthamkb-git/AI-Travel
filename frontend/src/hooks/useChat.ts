"use client";

import { useCallback, useEffect, useState } from "react";
import { Message } from "@/types";
import { planTrip, restoreTrip, saveTrip } from "@/services/api";
import { useTripContext } from "@/lib/TripContext";
import { useAuth } from "@/lib/AuthContext";
import { detectDestinationFromQuery, restoreTripWidgets } from "@/lib/historyTripRestore";
import { applyLocationMemory } from "@/lib/chatMemory";

const FREE_LIMIT = 2;
const INITIAL_MESSAGE: Message = { role: "assistant", content: "Hi! Tell me where you want to travel" };
const TRIP_QUERY_PATTERN = /\b(plan|trip|travel|visit|itinerary|days?\b|from\b|to\b|budget\b|hotel\b)\b/i;

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

export function useChat() {
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
        token
      );
      const answer = response.answer;

      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
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

      const nextLocation =
        response.destination ??
        response.widgets?.weather?.location ??
        detectDestinationFromQuery(normalizedQuestion) ??
        currentLocation;
      setCurrentLocation(nextLocation);
      setDestinationCoords(response.destination_coords ?? null);
    } catch (err: unknown) {
      let message = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("429") || err.message.includes("rate_limit") || err.message.includes("Rate limit")) {
          message = "Rate limit reached. Please wait a moment and try again.";
        } else {
          message = err.message;
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
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
      setCurrentLocation(enriched.destination ?? restored.destination);
      setDestinationCoords(enriched.destination_coords ?? null);
    } catch {
      setDestinationCoords(null);
    }
  }, [currentCoords, setCurrentCoords, setCurrentLocation, setDestinationCoords, setLastResponse, setPlaceMarkers, setSelectedPlace, setWidgets, token]);

  return { messages, loading, sendMessage, showFreeModal, setShowFreeModal, resetChat, loadTrip, composerResetKey };
}
