"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, CloudRain, CloudSun, Droplets, Sun, Thermometer, Wind, X } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";

const conditionIcon = (condition: string | null, size = 18) => {
  if (!condition) return <CloudSun className="text-indigo-400" size={size} />;
  const normalizedCondition = condition.toLowerCase();
  if (normalizedCondition.includes("rain") || normalizedCondition.includes("monsoon")) {
    return <CloudRain className="text-blue-400" size={size} />;
  }
  if (normalizedCondition.includes("cloud") || normalizedCondition.includes("overcast")) {
    return <Cloud className="text-gray-300" size={size} />;
  }
  if (normalizedCondition.includes("sunny") || normalizedCondition.includes("clear") || normalizedCondition.includes("hot")) {
    return <Sun className="text-yellow-400" size={size} />;
  }
  return <Thermometer className="text-indigo-300" size={size} />;
};

export default function WeatherCard() {
  const { widgets } = useTripContext();
  const weather = widgets?.weather;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const modal = open && weather ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(10px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.1)",
          backgroundColor: "#11192f",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "16px",
            padding: "24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                borderRadius: "16px",
                background: "rgba(99,102,241,0.16)",
                padding: "12px",
                display: "flex",
              }}
            >
              {conditionIcon(weather.condition ?? null, 24)}
            </div>
            <div>
              <h2 style={{ color: "white", fontSize: "30px", fontWeight: 700, margin: 0 }}>
                {weather.location ?? "Weather Details"}
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "14px", margin: "6px 0 0" }}>
                Real-time weather in Celsius with season guidance and key travel notes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#d1d5db",
              borderRadius: "9999px",
              padding: "8px",
              cursor: "pointer",
              display: "flex",
            }}
            aria-label="Close weather details"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "24px" }}>
          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div
              style={{
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "20px",
              }}
            >
              <p style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
                Temperature
              </p>
              <p style={{ color: "white", fontSize: "44px", fontWeight: 700, margin: "16px 0 0" }}>
                {weather.temp ?? "--"}
              </p>
              <p style={{ color: "#d1d5db", fontSize: "18px", margin: "8px 0 0" }}>
                {weather.condition ?? "Condition unavailable"}
              </p>
              <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, margin: "14px 0 0" }}>
                Real-time weather for {weather.location ?? "this destination"} in Celsius.
              </p>
            </div>

            <div
              style={{
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "20px",
              }}
            >
              <p style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
                Season
              </p>
              <p style={{ color: "white", fontSize: "34px", fontWeight: 700, margin: "16px 0 0" }}>
                {weather.season ?? "--"}
              </p>
              <p style={{ color: "#d1d5db", fontSize: "16px", lineHeight: 1.8, margin: "16px 0 0" }}>
                {weather.best_time_to_visit ?? "Best season details unavailable"}
              </p>
            </div>

            <div
              style={{
                borderRadius: "20px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: "20px",
              }}
            >
              <p style={{ color: "#6b7280", fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase", margin: 0 }}>
                Key Metrics
              </p>

              <div style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "12px 14px",
                    color: "#d1d5db",
                    fontSize: "14px",
                  }}
                >
                  <Thermometer size={15} color="#a5b4fc" />
                  <span>Feels like: {weather.feels_like ?? "--"}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "12px 14px",
                    color: "#d1d5db",
                    fontSize: "14px",
                  }}
                >
                  <Droplets size={15} color="#67e8f9" />
                  <span>Humidity: {weather.humidity ?? "--"}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "12px 14px",
                    color: "#d1d5db",
                    fontSize: "14px",
                  }}
                >
                  <Wind size={15} color="#6ee7b7" />
                  <span>Wind: {weather.wind_speed ?? "--"}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: "20px",
            }}
          >
            <h3 style={{ color: "white", fontSize: "18px", fontWeight: 600, margin: 0 }}>
              Key Points
            </h3>

            <div
              style={{
                display: "grid",
                gap: "12px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                marginTop: "16px",
              }}
            >
              {(weather.key_points?.length ? weather.key_points : ["Detailed weather insights are not available yet."]).map((point, index) => (
                <div
                  key={`${point}-${index}`}
                  style={{
                    borderRadius: "18px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: "16px",
                    color: "#d1d5db",
                    fontSize: "18px",
                    lineHeight: 1.7,
                  }}
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (weather) setOpen(true);
        }}
        className="w-full rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 px-4 py-3 text-left shadow-lg transition hover:border-indigo-400/30 hover:shadow-indigo-500/10"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-gray-400">Weather</h2>
          {conditionIcon(weather?.condition ?? null, 16)}
        </div>

        {weather ? (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl font-semibold leading-none text-white">{weather.temp ?? "--"}</p>
              <p className="mt-1 line-clamp-1 text-xs text-gray-300">
                {weather.location ?? "Destination"}
                {weather.condition ? ` · ${weather.condition}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {weather.season && (
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    weather.season === "Off Season"
                      ? "bg-orange-500/20 text-orange-300"
                      : "bg-green-500/20 text-green-300"
                  }`}
                >
                  {weather.season}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-xl font-semibold text-gray-600">--</p>
            <p className="text-xs text-gray-600">Ask about a destination</p>
          </div>
        )}
      </button>

      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
