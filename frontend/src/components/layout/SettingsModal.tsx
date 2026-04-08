"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Monitor, Globe, Volume2, Palette, Moon, Sun, Info } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface Settings {
  theme: "dark" | "light";
  language: string;
  voiceEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = { theme: "dark", language: "en", voiceEnabled: false };

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
];

const tabs = [
  { id: "general", label: "General", icon: Monitor },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "language", label: "Language", icon: Globe },
  { id: "voice", label: "Voice", icon: Volume2 },
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState("general");
  const [cleared, setCleared] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("app_settings");
    if (saved) setSettings(JSON.parse(saved));
    // Prevent body scroll when modal open
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const save = (updated: Settings) => {
    setSettings(updated);
    localStorage.setItem("app_settings", JSON.stringify(updated));
  };

  const handleClear = () => {
    localStorage.removeItem("free_usage_count");
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  if (!mounted) return null;

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ width: "100%", maxWidth: "680px", height: "560px", display: "flex", flexDirection: "column", backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <h2 style={{ color: "white", fontWeight: 600, fontSize: "15px", margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ color: "#6b7280", background: "none", border: "none", cursor: "pointer", padding: "4px", borderRadius: "8px", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = "white")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left nav */}
          <div style={{ width: "192px", borderRight: "1px solid rgba(255,255,255,0.1)", padding: "12px", flexShrink: 0 }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 12px", borderRadius: "10px", border: "none", cursor: "pointer",
                  fontSize: "14px", marginBottom: "2px", transition: "all 0.15s",
                  backgroundColor: activeTab === tab.id ? "rgba(99,102,241,0.2)" : "transparent",
                  color: activeTab === tab.id ? "#a5b4fc" : "#9ca3af",
                  fontWeight: activeTab === tab.id ? 500 : 400,
                }}
                onMouseEnter={e => { if (activeTab !== tab.id) { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "white"; }}}
                onMouseLeave={e => { if (activeTab !== tab.id) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9ca3af"; }}}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

            {activeTab === "general" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ color: "white", fontWeight: 600, fontSize: "15px", margin: "0 0 4px" }}>General</h3>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Manage your account and app data</p>
                </div>

                {user && (
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "16px" }}>
                    <p style={{ color: "#6b7280", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px", fontWeight: 500 }}>Signed in as</p>
                    <p style={{ color: "white", fontSize: "14px", fontWeight: 500, margin: "0 0 2px" }}>{user.name}</p>
                    <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>{user.email}</p>
                  </div>
                )}

                <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                    <div>
                      <p style={{ color: "white", fontSize: "14px", fontWeight: 500, margin: "0 0 2px" }}>Clear usage data</p>
                      <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>Resets your free trip counter</p>
                    </div>
                    <button
                      onClick={handleClear}
                      style={{
                        fontSize: "12px", padding: "6px 14px", borderRadius: "8px", border: "1px solid",
                        cursor: "pointer", fontWeight: 500, transition: "all 0.15s",
                        backgroundColor: cleared ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: cleared ? "#4ade80" : "#f87171",
                        borderColor: cleared ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)",
                      }}
                    >
                      {cleared ? "✓ Cleared" : "Clear"}
                    </button>
                  </div>
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "16px" }}>
                    <Info size={16} color="#6b7280" style={{ marginTop: "2px", flexShrink: 0 }} />
                    <div>
                      <p style={{ color: "white", fontSize: "14px", fontWeight: 500, margin: "0 0 2px" }}>AI Trip Planner</p>
                      <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>Version 2.0.0 · Powered by Groq</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ color: "white", fontWeight: 600, fontSize: "15px", margin: "0 0 4px" }}>Appearance</h3>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Customize how the app looks</p>
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                    <div>
                      <p style={{ color: "white", fontSize: "14px", fontWeight: 500, margin: "0 0 2px" }}>Theme</p>
                      <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>Choose your preferred color scheme</p>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["dark", "light"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => save({ ...settings, theme: t })}
                          style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: "7px 12px", borderRadius: "8px", border: "none",
                            cursor: "pointer", fontSize: "12px", fontWeight: 500,
                            backgroundColor: settings.theme === t ? "#4f46e5" : "rgba(255,255,255,0.05)",
                            color: settings.theme === t ? "white" : "#9ca3af",
                          }}
                        >
                          {t === "dark" ? <Moon size={13} /> : <Sun size={13} />}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "language" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ color: "white", fontWeight: 600, fontSize: "15px", margin: "0 0 4px" }}>Language</h3>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Set your preferred response language</p>
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {LANGUAGES.map((lang, i) => (
                      <button
                        key={lang.code}
                        onClick={() => save({ ...settings, language: lang.code })}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "13px 16px", border: "none", cursor: "pointer", fontSize: "14px",
                          borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          borderBottom: i < LANGUAGES.length - 2 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          backgroundColor: settings.language === lang.code ? "rgba(99,102,241,0.15)" : "transparent",
                          color: settings.language === lang.code ? "#a5b4fc" : "#d1d5db",
                        }}
                      >
                        {lang.label}
                        {settings.language === lang.code && (
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#818cf8", display: "inline-block" }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "voice" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ color: "white", fontWeight: 600, fontSize: "15px", margin: "0 0 4px" }}>Voice</h3>
                  <p style={{ color: "#6b7280", fontSize: "13px", margin: 0 }}>Voice interaction settings</p>
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
                    <div>
                      <p style={{ color: "white", fontSize: "14px", fontWeight: 500, margin: "0 0 2px" }}>Voice responses</p>
                      <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>Read trip plans aloud — coming soon</p>
                    </div>
                    <div style={{ opacity: 0.4, cursor: "not-allowed", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>Off</span>
                      <div style={{ width: "40px", height: "20px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "10px", position: "relative" }}>
                        <div style={{ width: "16px", height: "16px", backgroundColor: "white", borderRadius: "50%", position: "absolute", top: "2px", left: "2px" }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ backgroundColor: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "12px", padding: "16px" }}>
                  <p style={{ color: "#a5b4fc", fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>🎙 Coming in next update</p>
                  <p style={{ color: "#9ca3af", fontSize: "12px", margin: 0 }}>Voice input and text-to-speech responses are being built.</p>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4338ca")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#4f46e5")}
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
