"use client";

import { Fragment, useEffect } from "react";
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Coords, PlaceMarker, RouteInfo } from "@/types";
import { openDirectionsInGoogleMaps } from "@/lib/googleMaps";

delete (L.Icon.Default.prototype as { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  center: Coords;
  markers: PlaceMarker[];
  zoom: number;
  selectedPlace?: PlaceMarker | null;
  currentCoords?: Coords | null;
  instanceId?: string;
  activeRoute?: RouteInfo | null;
  onSelectPlace?: (place: PlaceMarker) => void;
}

function Recenter({ center, zoom }: { center: Coords; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

export default function LeafletMap({
  center,
  markers,
  zoom,
  selectedPlace,
  currentCoords,
  instanceId = "default",
  activeRoute,
  onSelectPlace,
}: Props) {
  return (
    <MapContainer
      key={`${instanceId}-${center.lat}-${center.lng}-${zoom}-${selectedPlace?.name ?? "none"}-${markers.length}`}
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      zoomControl
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <Recenter center={center} zoom={zoom} />
      {currentCoords && (
        <>
          <Circle
            center={[currentCoords.lat, currentCoords.lng]}
            radius={500}
            pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.1 }}
          />
          <Marker position={[currentCoords.lat, currentCoords.lng]}>
            <Popup>Your current location</Popup>
          </Marker>
        </>
      )}
      {activeRoute && activeRoute.path.length >= 2 && (
        <Polyline
          positions={activeRoute.path.map((point) => [point.lat, point.lng])}
          pathOptions={{
            color: activeRoute.mode === "road" ? "#60a5fa" : activeRoute.mode === "train" ? "#34d399" : "#fbbf24",
            weight: 5,
            opacity: 0.85,
          }}
        />
      )}
      {markers.map((marker, index) => (
        <Fragment key={`${marker.name}-${index}`}>
          {selectedPlace?.name === marker.name && (
            <Circle
              center={[marker.coords.lat, marker.coords.lng]}
              radius={220}
              pathOptions={{ color: "#22d3ee", fillColor: "#22d3ee", fillOpacity: 0.18 }}
            />
          )}
          <Marker
            position={[marker.coords.lat, marker.coords.lng]}
            eventHandlers={{
              click: () => onSelectPlace?.(marker),
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="font-medium">{marker.name}</div>
                {selectedPlace?.name === marker.name && (
                  <div className="mt-1 text-xs text-cyan-600">Currently focused</div>
                )}
                <button
                  type="button"
                  onClick={() => openDirectionsInGoogleMaps(marker)}
                  className="mt-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-700 transition hover:border-cyan-400/50"
                >
                  Open route in Google Maps
                </button>
              </div>
            </Popup>
          </Marker>
        </Fragment>
      ))}
    </MapContainer>
  );
}
