import { TripRequest, TripResponse, TripHistory, User } from "@/types";
import { PlaceMarker } from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const AUTH_TIMEOUT_MS = 10000;

function authHeaders(token?: string | null) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || err.error || "Request failed");
  }
  return res.json();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The server is taking too long to respond. Please check that the backend is running and try again.");
    }
    if (error instanceof Error) {
      throw new Error(error.message || "Unable to reach the server");
    }
    throw new Error("Unable to reach the server");
  } finally {
    window.clearTimeout(timeoutId);
  }
}

// Trip
export async function planTrip(request: TripRequest, token?: string | null): Promise<TripResponse> {
  const res = await fetch(`${BASE_URL}/api/trip/plan`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  return handleResponse(res);
}

export async function restoreTrip(request: TripRequest, token?: string | null): Promise<TripResponse> {
  const res = await fetch(`${BASE_URL}/api/trip/restore`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(request),
  });
  return handleResponse(res);
}

export async function getPlaceSuggestions(
  location: string,
  question?: string
): Promise<{ location: string; places: Array<Partial<PlaceMarker> & { name: string; lat?: number | null; lng?: number | null; rating?: number | null; address?: string | null }> }> {
  const params = new URLSearchParams({ location });
  if (question) params.set("question", question);
  const res = await fetch(`${BASE_URL}/api/trip/place-suggestions?${params.toString()}`);
  const data = await handleResponse(res);
  return {
    location: data.location,
    places: (data.places ?? []).map((place: Partial<PlaceMarker> & { name: string; place_id?: string | null; google_maps_url?: string | null; lat?: number | null; lng?: number | null }) => ({
      ...place,
      placeId: place.placeId ?? place.place_id ?? null,
      googleMapsUrl: place.googleMapsUrl ?? place.google_maps_url ?? null,
      lat: place.lat ?? place.coords?.lat ?? null,
      lng: place.lng ?? place.coords?.lng ?? null,
    })),
  };
}

// Auth
export async function signup(name: string, email: string, password: string) {
  const res = await fetchWithTimeout(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
}

export async function login(email: string, password: string) {
  const res = await fetchWithTimeout(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function uploadAvatar(file: File, token: string): Promise<User> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/api/auth/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return handleResponse(res);
}

export async function getMe(token: string): Promise<User> {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

// History
export async function saveTrip(query: string, response: string, token: string, tripId?: string | null): Promise<TripHistory> {
  const res = await fetch(`${BASE_URL}/api/trips/save`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ query, response, trip_id: tripId ?? null }),
  });
  return handleResponse(res);
}

export async function getHistory(token: string): Promise<TripHistory[]> {
  const res = await fetch(`${BASE_URL}/api/trips/history`, {
    headers: authHeaders(token),
  });
  return handleResponse(res);
}

export async function deleteTrip(tripId: string, token: string): Promise<void> {
  await fetch(`${BASE_URL}/api/trips/${tripId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function transcribeAudio(file: Blob, filename = "recording.webm"): Promise<{ transcript: string }> {
  const form = new FormData();
  form.append("file", file, filename);

  const res = await fetchWithTimeout(`${BASE_URL}/api/transcribe`, {
    method: "POST",
    body: form,
  }, 30000);

  return handleResponse(res);
}
