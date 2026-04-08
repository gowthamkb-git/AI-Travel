"use client";

import { createContext, useContext, useEffect, useState, ReactNode, Dispatch, SetStateAction } from "react";
import { Coords, PlaceMarker, WidgetData } from "@/types";

interface TripContextType {
  widgets: WidgetData | null;
  setWidgets: Dispatch<SetStateAction<WidgetData | null>>;
  currentLocation: string | null;
  setCurrentLocation: Dispatch<SetStateAction<string | null>>;
  location: string | null;
  setLocation: Dispatch<SetStateAction<string | null>>;
  lastResponse: string | null;
  setLastResponse: Dispatch<SetStateAction<string | null>>;
  currentCoords: Coords | null;
  setCurrentCoords: Dispatch<SetStateAction<Coords | null>>;
  destinationCoords: Coords | null;
  setDestinationCoords: Dispatch<SetStateAction<Coords | null>>;
  placeMarkers: PlaceMarker[];
  setPlaceMarkers: Dispatch<SetStateAction<PlaceMarker[]>>;
  selectedPlace: PlaceMarker | null;
  setSelectedPlace: Dispatch<SetStateAction<PlaceMarker | null>>;
}

const TripContext = createContext<TripContextType>({
  widgets: null,
  setWidgets: () => {},
  currentLocation: null,
  setCurrentLocation: () => {},
  location: null,
  setLocation: () => {},
  lastResponse: null,
  setLastResponse: () => {},
  currentCoords: null,
  setCurrentCoords: () => {},
  destinationCoords: null,
  setDestinationCoords: () => {},
  placeMarkers: [],
  setPlaceMarkers: () => {},
  selectedPlace: null,
  setSelectedPlace: () => {},
});

export function TripProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<WidgetData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<Coords | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coords | null>(null);
  const [placeMarkers, setPlaceMarkers] = useState<PlaceMarker[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceMarker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const parseJson = <T,>(key: string): T | null => {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      try {
        return JSON.parse(cached) as T;
      } catch {
        localStorage.removeItem(key);
        return null;
      }
    };

    const hydrateFromStorage = window.setTimeout(() => {
      setWidgets(parseJson<WidgetData>("trip_widgets"));
      setCurrentLocation(localStorage.getItem("trip_current_location") || localStorage.getItem("trip_location"));
      setLastResponse(localStorage.getItem("trip_last_response"));
      setCurrentCoords(parseJson<Coords>("current_coords"));
      setDestinationCoords(parseJson<Coords>("trip_destination_coords"));
      setPlaceMarkers(parseJson<PlaceMarker[]>("trip_place_markers") ?? []);
      setSelectedPlace(parseJson<PlaceMarker>("trip_selected_place"));
    }, 0);

    return () => {
      window.clearTimeout(hydrateFromStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentCoords(coords);
        localStorage.setItem("current_coords", JSON.stringify(coords));
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("trip_widgets", JSON.stringify(widgets));
  }, [widgets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (currentLocation) {
      localStorage.setItem("trip_current_location", currentLocation);
      localStorage.setItem("trip_location", currentLocation);
    } else {
      localStorage.removeItem("trip_current_location");
      localStorage.removeItem("trip_location");
    }
  }, [currentLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lastResponse) localStorage.setItem("trip_last_response", lastResponse);
    else localStorage.removeItem("trip_last_response");
  }, [lastResponse]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (destinationCoords) localStorage.setItem("trip_destination_coords", JSON.stringify(destinationCoords));
    else localStorage.removeItem("trip_destination_coords");
  }, [destinationCoords]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("trip_place_markers", JSON.stringify(placeMarkers));
  }, [placeMarkers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedPlace) localStorage.setItem("trip_selected_place", JSON.stringify(selectedPlace));
    else localStorage.removeItem("trip_selected_place");
  }, [selectedPlace]);

  return (
    <TripContext.Provider
      value={{
        widgets,
        setWidgets,
        currentLocation,
        setCurrentLocation,
        location: currentLocation,
        setLocation: setCurrentLocation,
        lastResponse,
        setLastResponse,
        currentCoords,
        setCurrentCoords,
        destinationCoords,
        setDestinationCoords,
        placeMarkers,
        setPlaceMarkers,
        selectedPlace,
        setSelectedPlace,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTripContext() {
  return useContext(TripContext);
}
