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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLabelIcon(name: string) {
  return L.divIcon({
    className: "place-label-icon",
    html: `<div style="transform:translate(18px,-12px);background:rgba(2,8,23,0.92);color:#e5eefc;border:1px solid rgba(255,255,255,0.12);padding:3px 8px;border-radius:999px;font-size:11px;font-weight:500;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,0.28);">${escapeHtml(name)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function shouldRenderLabel(marker: PlaceMarker) {
  return !marker.category || marker.category === "attractions";
}

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
                  onClick={() => openDirectionsInGoogleMaps(marker, "driving", currentCoords ?? null)}
                  className="mt-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-700 transition hover:border-cyan-400/50"
                >
                  Open route in Google Maps
                </button>
              </div>
            </Popup>
          </Marker>
          {shouldRenderLabel(marker) && (
            <Marker
              position={[marker.coords.lat, marker.coords.lng]}
              icon={buildLabelIcon(marker.name)}
              interactive={false}
              keyboard={false}
            />
          )}
        </Fragment>
      ))}
    </MapContainer>
  );
}
