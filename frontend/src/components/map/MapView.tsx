"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { CarFront, LocateFixed, Navigation, Plane, Train } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";
import { getPlaceSuggestions } from "@/services/api";
import { Coords, PlaceMarker, RouteInfo } from "@/types";

async function geocode(query: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function fetchOsrmRoute(from: Coords, to: Coords): Promise<RouteInfo | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    const path = (route.geometry?.coordinates ?? []).map(([lng, lat]: [number, number]) => ({ lat, lng }));
    return {
      mode: "road",
      label: "Road Route",
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      path,
      notes: buildRouteNotes("road", route.distance / 1000, route.duration / 60, false),
      estimated: false,
    };
  } catch {
    return null;
  }
}

function haversineDistanceKm(from: Coords, to: Coords) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(to.lat - from.lat);
  const deltaLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildRouteNotes(mode: "road" | "train" | "plane", distanceKm: number, durationMinutes: number, estimated: boolean) {
  const notes = [
    `${mode === "train" ? "Rail" : mode === "plane" ? "Air" : "Road"} distance is about ${distanceKm.toFixed(1)} km.`,
    `Expected travel time is around ${formatDuration(durationMinutes)}.`,
  ];

  if (mode === "road") {
    notes.push("Road travel is best when you want stopovers, direct hotel transfers, and flexible local detours.");
  } else if (mode === "plane") {
    notes.push("Air travel is usually the fastest option for long-distance or international trips.");
  } else {
    notes.push("Train timing is estimated here. Use the live route handoff for a more practical station-to-station plan.");
  }

  if (estimated) {
    notes.push("This route uses an estimated travel model when a live provider is not available.");
  }

  return notes;
}

function buildEstimatedTrainRoute(from: Coords, to: Coords): RouteInfo {
  const distanceKm = haversineDistanceKm(from, to) * 1.18;
  const durationMinutes = (distanceKm / 58) * 60;
  return {
    mode: "train",
    label: "Train Route",
    distanceKm,
    durationMinutes,
    path: [from, to],
    notes: buildRouteNotes("train", distanceKm, durationMinutes, true),
    estimated: true,
  };
}

function buildEstimatedPlaneRoute(from: Coords, to: Coords): RouteInfo {
  const distanceKm = haversineDistanceKm(from, to) * 1.05;
  const durationMinutes = (distanceKm / 720) * 60 + 180;
  return {
    mode: "plane",
    label: "Plane Route",
    distanceKm,
    durationMinutes,
    path: [from, to],
    notes: buildRouteNotes("plane", distanceKm, durationMinutes, true),
    estimated: true,
  };
}

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return "Distance unavailable";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

function formatDuration(durationMinutes: number) {
  if (durationMinutes < 60) return `${Math.round(durationMinutes)} min`;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.round(durationMinutes % 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
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

async function fetchMarkerBundles(location: string) {
  const prompts = [
    "must visit tourist attractions there",
    "top rated attractions there",
    "best activities there",
    "top rated hotels there",
    "top rated restaurants there",
  ];

  const settledResponses = await Promise.allSettled(
    prompts.map((prompt) => getPlaceSuggestions(location, prompt))
  );

  return settledResponses.reduce<Awaited<ReturnType<typeof getPlaceSuggestions>>["places"]>((allPlaces, result) => {
    if (result.status !== "fulfilled") {
      return allPlaces;
    }
    return [...allPlaces, ...(result.value.places ?? [])];
  }, []);
}

const LeafletMap = dynamic(() => import("./LeafletMap"), { ssr: false });

const modeMeta = {
  road: { icon: CarFront, accent: "text-sky-300", border: "border-sky-400/30 bg-sky-400/10" },
  train: { icon: Train, accent: "text-amber-300", border: "border-amber-400/30 bg-amber-400/10" },
  plane: { icon: Plane, accent: "text-fuchsia-300", border: "border-fuchsia-400/30 bg-fuchsia-400/10" },
} as const;

export default function MapView() {
  const {
    location,
    lastResponse,
    currentCoords,
    setCurrentCoords,
    destinationCoords,
    placeMarkers,
    setPlaceMarkers,
    selectedPlace,
    setSelectedPlace,
  } = useTripContext();
  const [destinationCenter, setDestinationCenter] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [activeMode, setActiveMode] = useState<RouteInfo["mode"]>("road");
  const lastLocation = useRef<string | null>(null);
  const lastSuggestionsLocation = useRef<string | null>(null);

  const activeCenter = useMemo(
    () => selectedPlace?.coords ?? destinationCoords ?? destinationCenter,
    [destinationCenter, destinationCoords, selectedPlace]
  );
  const suggestionCenter = destinationCoords ?? destinationCenter;
  const activeRoute = useMemo(
    () => routes.find((route) => route.mode === activeMode) ?? null,
    [activeMode, routes]
  );

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, [setCurrentCoords]);

  useEffect(() => {
    if (!location || location === lastLocation.current) return;
    lastLocation.current = location;
    setPlaceMarkers([]);
    setSelectedPlace(null);
    lastSuggestionsLocation.current = null;
    if (destinationCoords) return;

    geocode(location).then((coords) => {
      if (!coords) return;
      setDestinationCenter(coords);
    });
  }, [destinationCoords, location, setPlaceMarkers, setSelectedPlace]);

  useEffect(() => {
    if (!suggestionCenter || !location) return;
    if (placeMarkers.length > 0 && lastSuggestionsLocation.current === location) return;

    let cancelled = false;

    const loadSuggestions = async () => {
      const bundledPlaces = await fetchMarkerBundles(location).catch(() => []);
      const backendBased = await Promise.all(
        bundledPlaces.map(async (place) => {
          const coords =
            place.coords ??
            (typeof place.lat === "number" && typeof place.lng === "number"
              ? { lat: place.lat, lng: place.lng }
              : await geocode(`${place.name}, ${location}`));
          if (!coords) return null;
          return {
            name: place.name,
            coords,
            category: place.category ?? null,
            rating: place.rating ?? null,
            address: place.address ?? null,
            placeId: place.placeId ?? null,
            googleMapsUrl: place.googleMapsUrl ?? null,
            distanceKm: currentCoords ? haversineDistanceKm(currentCoords, coords) : null,
          } satisfies PlaceMarker;
        })
      );

      const merged = (backendBased.filter(Boolean) as PlaceMarker[]).map((place) => ({
        ...place,
        distanceKm: currentCoords ? haversineDistanceKm(currentCoords, place.coords) : place.distanceKm ?? null,
      }));

      if (cancelled) return;
      lastSuggestionsLocation.current = location;
      setPlaceMarkers((current) => mergePlaceMarkers(current, merged));
      setSelectedPlace((current) => current ?? merged[0] ?? null);
    };

    loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [
    currentCoords,
    suggestionCenter,
    lastResponse,
    location,
    placeMarkers.length,
    setPlaceMarkers,
    setSelectedPlace,
  ]);

  useEffect(() => {
    if (!currentCoords || !activeCenter) return;

    let cancelled = false;

    Promise.all([fetchOsrmRoute(currentCoords, activeCenter)])
      .then(([roadRoute]) => {
        if (cancelled) return;

        const builtRoutes: RouteInfo[] = [];
        if (roadRoute) builtRoutes.push(roadRoute);
        builtRoutes.push(buildEstimatedTrainRoute(currentCoords, activeCenter));
        builtRoutes.push(buildEstimatedPlaneRoute(currentCoords, activeCenter));

        setRoutes(builtRoutes);
        setActiveMode((current) =>
          builtRoutes.some((route) => route.mode === current) ? current : builtRoutes[0]?.mode ?? "road"
        );
      })
      .catch(() => {
        if (cancelled) return;
        const estimatedTrain = buildEstimatedTrainRoute(currentCoords, activeCenter);
        const estimatedPlane = buildEstimatedPlaneRoute(currentCoords, activeCenter);
        setRoutes([estimatedTrain, estimatedPlane]);
        setActiveMode("train");
      });

    return () => {
      cancelled = true;
    };
  }, [activeCenter, currentCoords]);

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg transition hover:shadow-cyan-500/10 flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-200">
            {location ? `Map View for ${location}` : "Map View"}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <LocateFixed size={13} className={geoStatus === "granted" ? "text-emerald-300" : "text-gray-500"} />
            <span>
              {geoStatus === "granted"
                ? "Using your current location for live route guidance"
                : "Allow location access to build routes from your current location"}
            </span>
          </div>
        </div>
      </div>

      <div className="block min-h-0 flex-1 w-full text-left">
        {activeCenter ? (
          <LeafletMap
            key={`panel-${selectedPlace?.name ?? "destination"}-${activeMode}`}
            instanceId="panel"
            center={activeCenter}
            markers={placeMarkers}
            zoom={selectedPlace ? 14 : 12}
            selectedPlace={selectedPlace}
            currentCoords={currentCoords}
            activeRoute={activeRoute}
            onSelectPlace={setSelectedPlace}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            {location ? "Loading map..." : "Search for a destination to explore routes and places"}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        {activeRoute ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white">{activeRoute.label}</div>
                <div className="mt-1 text-xs text-gray-400">
                  {formatDistance(activeRoute.distanceKm)} · {formatDuration(activeRoute.durationMinutes)}
                </div>
              </div>
              <div className="flex gap-2">
                {routes.map((route) => {
                  const meta = modeMeta[route.mode];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={route.mode}
                      type="button"
                      onClick={() => setActiveMode(route.mode)}
                      className={`rounded-full border px-2.5 py-1.5 text-xs transition ${
                        activeMode === route.mode ? meta.border : "border-white/10 bg-white/[0.03] text-gray-300"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon size={13} className={meta.accent} />
                        {route.mode}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-gray-400">
              {geoStatus === "granted"
                ? "Click any highlighted place name or map marker to open Google Maps directions."
                : "Allow location access to generate full route suggestions from where you are."}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-gray-300">
              {(activeRoute?.notes ?? [
                geoStatus === "granted"
                  ? "Choose a place to see route guidance."
                  : "Allow location access to generate route guidance from your current location.",
              ])[0]}
            </div>
          </div>
        ) : selectedPlace ? (
          <div className="text-sm text-gray-400">Preparing route guidance for {selectedPlace.name}...</div>
        ) : (
          <div className="text-sm text-gray-400">
            {placeMarkers.length
              ? `${placeMarkers.length} places are shown directly on the map.`
              : "Suggested places will appear on the map after the destination loads."}
          </div>
        )}
      </div>
    </div>
  );
}
