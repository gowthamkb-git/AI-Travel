"use client";

import { MapPin, Navigation } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";
import { openDirectionsInGoogleMaps } from "@/lib/googleMaps";

interface Props {
  embedded?: boolean;
}

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null) return "Enable location to see distance";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

export default function PlacesList({ embedded = false }: Props) {
  const { placeMarkers, selectedPlace, setSelectedPlace, currentCoords } = useTripContext();

  const handlePlaceClick = (place: typeof placeMarkers[number]) => {
    setSelectedPlace(place);
    openDirectionsInGoogleMaps(place);
  };

  return (
    <div
      className={
        embedded
          ? "rounded-2xl border border-white/10 bg-black/30 p-4"
          : "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-lg"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm text-gray-200">Top Places</h2>
          <p className="text-xs text-gray-500">
            Tap a place to focus the map and open its route in Google Maps.
          </p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200">
          {placeMarkers.length} spots
        </span>
      </div>

      {placeMarkers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-gray-500">
          Search for a destination to load suggested places here.
        </div>
      ) : (
        <ul className="space-y-2">
          {placeMarkers.map((place, i) => {
            const isActive = selectedPlace?.name === place.name;

            return (
              <li key={`${place.name}-${i}`}>
                <button
                  type="button"
                  onClick={() => handlePlaceClick(place)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-cyan-400/40 bg-cyan-400/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-white/[0.03] text-gray-200 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 rounded-lg text-left transition hover:text-cyan-200">
                        <MapPin size={15} className={isActive ? "text-cyan-300" : "text-indigo-400"} />
                        <span className="truncate text-sm font-medium">{place.name}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <Navigation size={13} className={currentCoords ? "text-emerald-300" : "text-gray-500"} />
                        <span>{formatDistance(place.distanceKm)}</span>
                        {place.rating != null && <span>| {place.rating.toFixed(1)} rating</span>}
                      </div>
                      {place.address && (
                        <div className="mt-1 truncate text-xs text-gray-500">{place.address}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {isActive && (
                        <span className="rounded-full bg-cyan-300/15 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                          Focused
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
