"use client";

import { MouseEvent } from "react";
import { PlaceMarker } from "@/types";
import { useTripContext } from "@/lib/TripContext";
import { openDirectionsInGoogleMaps } from "@/lib/googleMaps";

function normalizePlaceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findMatchingPlace(placeMarkers: PlaceMarker[], placeQuery: string) {
  const normalizedQuery = normalizePlaceName(placeQuery);
  return placeMarkers.find((marker) => {
    const normalizedMarker = normalizePlaceName(marker.name);
    return normalizedMarker === normalizedQuery ||
      normalizedMarker.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedMarker);
  }) ?? null;
}

export default function PlaceInlineLink({
  place,
  placeQuery,
  children,
}: {
  place?: PlaceMarker | null;
  placeQuery?: string;
  children?: React.ReactNode;
}) {
  const { currentCoords, currentLocation, placeMarkers, setSelectedPlace } = useTripContext();

  const matchedPlace = place ?? (placeQuery ? findMatchingPlace(placeMarkers, placeQuery) : null);

  const handlePreview = () => {
    if (matchedPlace) {
      setSelectedPlace(matchedPlace);
    }
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (matchedPlace) {
      setSelectedPlace(matchedPlace);
      openDirectionsInGoogleMaps(matchedPlace, "driving", currentCoords);
      return;
    }

    if (placeQuery) {
      const destinationQuery = currentLocation ? `${placeQuery}, ${currentLocation}` : placeQuery;
      openDirectionsInGoogleMaps(destinationQuery, "driving", currentCoords);
    }
  };

  return (
    <button
      type="button"
      onMouseEnter={handlePreview}
      onFocus={handlePreview}
      onClick={handleClick}
      title={`Open directions to ${place?.name ?? placeQuery ?? "this place"}`}
      className="inline-flex items-center rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200 underline decoration-cyan-300/70 underline-offset-4 transition hover:bg-cyan-400/20 hover:text-white"
    >
      {children ?? matchedPlace?.name ?? placeQuery}
    </button>
  );
}
