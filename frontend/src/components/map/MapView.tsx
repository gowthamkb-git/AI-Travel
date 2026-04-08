"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { CarFront, ExternalLink, LocateFixed, MapPinned, Navigation, Plane, Route, Train, X } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";
import { buildGoogleMapsEmbedUrl } from "@/lib/googleMaps";
import { getPlaceSuggestions } from "@/services/api";
import { Coords, PlaceMarker, RouteInfo } from "@/types";
import PlacesList from "../places/PlacesList";

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
    const distanceKm = route.distance / 1000;
    const durationMinutes = route.duration / 60;

    return {
      mode: "road",
      label: "Road Route",
      distanceKm,
      durationMinutes,
      path,
      notes: buildRouteNotes("road", distanceKm, durationMinutes, false),
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
  const airportBufferMinutes = 180;
  const durationMinutes = (distanceKm / 720) * 60 + airportBufferMinutes;
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
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenMapReady, setFullscreenMapReady] = useState(false);
  const [geoStatus, setGeoStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [activeMode, setActiveMode] = useState<RouteInfo["mode"]>("road");
  const [googleMapsOpen, setGoogleMapsOpen] = useState(false);
  const lastLocation = useRef<string | null>(null);
  const fullscreenTimerRef = useRef<number | null>(null);

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
    document.body.style.overflow = fullscreen || googleMapsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [fullscreen, googleMapsOpen]);

  useEffect(() => {
    return () => {
      if (fullscreenTimerRef.current) {
        window.clearTimeout(fullscreenTimerRef.current);
      }
    };
  }, []);

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
    if (destinationCoords) return;

    geocode(location).then((coords) => {
      if (!coords) return;
      setDestinationCenter(coords);
    });
  }, [destinationCoords, location, setPlaceMarkers, setSelectedPlace]);

  useEffect(() => {
    if (!suggestionCenter || !location) return;

    let cancelled = false;

    const loadSuggestions = async () => {
      const backendSuggestions = await getPlaceSuggestions(location, lastResponse ?? location).catch(() => ({ location, places: [] }));
      const backendBased = await Promise.all(
        (backendSuggestions.places ?? []).map(async (place) => {
          const coords =
            place.coords ??
            (typeof place.lat === "number" && typeof place.lng === "number"
              ? { lat: place.lat, lng: place.lng }
              : await geocode(`${place.name}, ${backendSuggestions.location || location}`));
          if (!coords) return null;
          return {
            name: place.name,
            coords,
            rating: place.rating ?? null,
            address: place.address ?? null,
            placeId: place.placeId ?? null,
            googleMapsUrl: place.googleMapsUrl ?? null,
            distanceKm: currentCoords ? haversineDistanceKm(currentCoords, coords) : null,
          } satisfies PlaceMarker;
        })
      );

      const merged = (backendBased.filter(Boolean) as PlaceMarker[])
        .map((place) => ({
          ...place,
          distanceKm: currentCoords ? haversineDistanceKm(currentCoords, place.coords) : place.distanceKm ?? null,
        }));

      const unique: PlaceMarker[] = [];
      const seen = new Set<string>();
      for (const place of merged) {
        const key = place.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(place);
        if (unique.length >= 5) break;
      }

      if (cancelled) return;
      setPlaceMarkers(unique);
      setSelectedPlace((currentSelected) => {
        if (!unique.length) return null;
        if (currentSelected) {
          return unique.find((place) => place.name === currentSelected.name) ?? unique[0];
        }
        return unique[0];
      });
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
    setPlaceMarkers,
    setSelectedPlace,
  ]);

  useEffect(() => {
    if (!currentCoords || !activeCenter) return;

    let cancelled = false;

    Promise.all([
      fetchOsrmRoute(currentCoords, activeCenter),
    ]).then(([roadRoute]) => {
      if (cancelled) return;

      const builtRoutes: RouteInfo[] = [];
      if (roadRoute) builtRoutes.push(roadRoute);
      builtRoutes.push(buildEstimatedTrainRoute(currentCoords, activeCenter));
      builtRoutes.push(buildEstimatedPlaneRoute(currentCoords, activeCenter));

      setRoutes(builtRoutes);
      setActiveMode((current) =>
        builtRoutes.some((route) => route.mode === current) ? current : builtRoutes[0]?.mode ?? "road"
      );
    }).catch(() => {
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

  const openFullscreen = () => {
    if (!activeCenter) return;
    setFullscreenMapReady(false);
    setFullscreen(true);
    fullscreenTimerRef.current = window.setTimeout(() => {
      setFullscreenMapReady(true);
    }, 0);
  };

  const openGoogleMapOverlay = () => {
    if (selectedPlace) setGoogleMapsOpen(true);
  };

  const googleMapsUrl = selectedPlace
    ? buildGoogleMapsEmbedUrl(currentCoords, selectedPlace.coords, activeMode)
    : null;

  const modal = fullscreen && activeCenter ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setFullscreen(false);
          setFullscreenMapReady(false);
        }
      }}
    >
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#020817] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-xl font-semibold text-white">
              {selectedPlace?.name ?? location ?? "Expanded Map"}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
              <span>{location ? `Showing routes and places around ${location}` : "Map preview"}</span>
              {activeRoute && (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-200">
                  {activeRoute.label} · {formatDistance(activeRoute.distanceKm)} · {formatDuration(activeRoute.durationMinutes)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFullscreen(false);
              setFullscreenMapReady(false);
            }}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:border-white/20 hover:text-white"
            aria-label="Close expanded map"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="space-y-4">
              <div className="h-[46vh] overflow-hidden rounded-3xl border border-white/10 bg-black/30">
                {fullscreenMapReady ? (
                  <LeafletMap
                    key={`modal-${selectedPlace?.name ?? "destination"}-${activeMode}`}
                    instanceId="modal"
                    center={activeCenter}
                    markers={placeMarkers}
                    zoom={selectedPlace ? 15 : 13}
                    selectedPlace={selectedPlace}
                    currentCoords={currentCoords}
                    activeRoute={activeRoute}
                    onSelectPlace={setSelectedPlace}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-400">
                    Preparing map...
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <Route size={16} className="text-cyan-300" />
                    <span>Route Options</span>
                  </div>
                  {selectedPlace && (
                    <button
                      type="button"
                      onClick={openGoogleMapOverlay}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-200 transition hover:border-cyan-300/30 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink size={13} />
                        Open Real Map
                      </span>
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {routes.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-gray-400">
                      Loading route options...
                    </div>
                  ) : (
                    routes.map((route) => {
                      const meta = modeMeta[route.mode];
                      const Icon = meta.icon;
                      const isActive = activeMode === route.mode;

                      return (
                        <button
                          key={route.mode}
                          type="button"
                          onClick={() => setActiveMode(route.mode)}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            isActive ? meta.border : "border-white/10 bg-white/[0.03] hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={16} className={meta.accent} />
                            <span className="text-sm font-medium text-white">{route.label}</span>
                          </div>
                          <div className="mt-3 text-xl font-semibold text-white">{formatDistance(route.distanceKm)}</div>
                          <div className="mt-1 text-sm text-gray-400">{formatDuration(route.durationMinutes)}</div>
                          {route.estimated && (
                            <div className="mt-2 text-xs text-amber-300">
                              {route.mode === "train" ? "Estimated rail guidance" : "Estimated air guidance"}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm text-white">
                  <Navigation size={16} className="text-cyan-300" />
                  <span>Route Key Points</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(activeRoute?.notes ?? [
                    geoStatus === "granted"
                      ? "Choose a place to see route guidance."
                      : "Allow location access to generate route guidance from your current location.",
                  ]).map((note, index) => (
                    <div
                      key={`${note}-${index}`}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-gray-300"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>

              <PlacesList embedded />
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const googleMapsModal = googleMapsOpen && selectedPlace && googleMapsUrl ? (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) setGoogleMapsOpen(false);
      }}
    >
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#020817] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-xl font-semibold text-white">{selectedPlace.name}</div>
            <div className="mt-1 text-xs text-gray-400">
              Google Maps directions from your current location
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.coords.lat},${selectedPlace.coords.lng}${currentCoords ? `&origin=${currentCoords.lat},${currentCoords.lng}` : ""}&travelmode=${activeMode === "road" ? "driving" : activeMode === "train" ? "transit" : "driving"}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-200 transition hover:border-cyan-300/30 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <ExternalLink size={13} />
                Open in Google Maps
              </span>
            </a>
            <button
              type="button"
              onClick={() => setGoogleMapsOpen(false)}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-300 transition hover:border-white/20 hover:text-white"
              aria-label="Close Google Maps overlay"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <iframe
            title="Google Maps Directions"
            src={googleMapsUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg transition hover:shadow-cyan-500/10">
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
          {activeCenter && (
            <button
              type="button"
              onClick={openFullscreen}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-gray-400 transition hover:border-cyan-300/30 hover:text-white"
              aria-label="Open expanded map"
            >
              <MapPinned size={15} />
            </button>
          )}
        </div>

        <div
          role="button"
          tabIndex={activeCenter ? 0 : -1}
          onClick={openFullscreen}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && activeCenter) {
              event.preventDefault();
              openFullscreen();
            }
          }}
          className="block h-56 w-full text-left"
        >
          {activeCenter && !fullscreen ? (
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
          ) : activeCenter && fullscreen ? (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-sm text-gray-400">
              Expanded map is open
            </div>
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
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveMode(route.mode);
                        }}
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
                  ? "Open the map to compare routes and launch real Google Maps directions."
                  : "Allow location access to generate full route suggestions from where you are."}
              </div>
            </div>
          ) : selectedPlace ? (
            <div className="text-sm text-gray-400">Preparing route guidance for {selectedPlace.name}...</div>
          ) : (
            <div className="text-sm text-gray-400">Suggested places will appear after the destination loads.</div>
          )}
        </div>
      </div>

      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
      {typeof document !== "undefined" && googleMapsModal ? createPortal(googleMapsModal, document.body) : null}
    </>
  );
}
