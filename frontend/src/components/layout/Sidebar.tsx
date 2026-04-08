"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, History, Settings, LogOut, ChevronDown, Trash2, Clock, Camera } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { getHistory, deleteTrip, uploadAvatar } from "@/services/api";
import { TripHistory } from "@/types";
import SettingsModal from "./SettingsModal";
import Image from "next/image";
import Link from "next/link";
import { useHydrated } from "@/lib/useHydrated";

interface SidebarProps {
  onNewTrip: () => void;
  onLoadTrip: (tripId: string, query: string, response: string) => void;
}

function Avatar({ name, avatarUrl, size = 8 }: { name: string; avatarUrl?: string | null; size?: number }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const px = size * 4;
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} width={px} height={px} className="rounded-full object-cover shrink-0" style={{ width: px, height: px }} />;
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: px, height: px, fontSize: px * 0.4 }}
    >
      {initial}
    </div>
  );
}

export default function Sidebar({ onNewTrip, onLoadTrip }: SidebarProps) {
  const { user, token, login, logout } = useAuth();
  const hydrated = useHydrated();
  const effectiveUser = hydrated ? user : null;
  const effectiveToken = hydrated ? token : null;
  const [history, setHistory] = useState<TripHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [freeCount, setFreeCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upsertHistoryItem = (incoming: TripHistory) => {
    setHistory((prev) => {
      const next = prev.filter((trip) => trip.id !== incoming.id);
      return [incoming, ...next];
    });
  };

  const refreshHistory = useCallback(async () => {
    if (!effectiveToken) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const trips = await getHistory(effectiveToken);
      setHistory(trips);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [effectiveToken]);

  useEffect(() => {
    if (!hydrated) return;
    refreshHistory();
  }, [hydrated, refreshHistory]);

  useEffect(() => {
    if (!hydrated) return;
    const storedCount = parseInt(localStorage.getItem("free_usage_count") || "0", 10);
    setFreeCount(Number.isNaN(storedCount) ? 0 : storedCount);
  }, [hydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleHistoryUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<TripHistory>;
      if (!customEvent.detail?.id) return;
      upsertHistoryItem(customEvent.detail);
      refreshHistory();
    };

    window.addEventListener("trip-history-updated", handleHistoryUpdated);
    return () => window.removeEventListener("trip-history-updated", handleHistoryUpdated);
  }, [refreshHistory]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!effectiveToken) return;
    await deleteTrip(id, effectiveToken);
    setHistory((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveToken) return;
    try {
      const updatedUser = await uploadAvatar(file, effectiveToken);
      login(effectiveToken, updatedUser);
    } catch {}
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <>
      <div className="h-full flex flex-col bg-[#020617]">
        <div className="p-3 flex flex-col gap-1">
          <div className="flex items-center gap-2.5 px-2 py-3">
            <Image src="/logo.svg" alt="logo" width={32} height={32} className="rounded-lg shrink-0" />
            <span className="text-white font-semibold text-sm">AI Trip Planner</span>
          </div>

          <button
            onClick={onNewTrip}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-3 py-2.5 rounded-xl transition text-sm font-medium text-white"
          >
            <Plus size={16} /> New Trip
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 min-h-0">
          <div className="flex items-center gap-2 px-2 mb-2 mt-2">
            <History size={13} className="text-gray-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">History</span>
          </div>

          {!hydrated ? (
            <p className="text-xs text-gray-600 px-2 py-3">Loading history...</p>
          ) : !effectiveUser ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-gray-600 mb-2">Sign in to save your trip history</p>
              <Link href="/login" className="text-xs text-indigo-400 hover:text-indigo-300 transition">Sign in -&gt;</Link>
            </div>
          ) : historyLoading ? (
            <p className="text-xs text-gray-600 px-2 py-3">Loading trips...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-600 px-2 py-3">No trips yet. Start planning!</p>
          ) : (
            <div className="space-y-0.5">
              {history.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => onLoadTrip(trip.id, trip.query, trip.response)}
                  className="group flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition"
                >
                  <Clock size={12} className="text-gray-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 truncate">{trip.query}</p>
                    <p className="text-xs text-gray-600">{formatDate(trip.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(trip.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/10 flex flex-col gap-1">
          {hydrated && !effectiveUser && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Free trips</span>
                <span className="text-white font-medium">{freeCount}/2</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(freeCount / 2) * 100}%` }} />
              </div>
              <Link href="/signup" className="block text-center text-xs text-indigo-400 hover:text-indigo-300 mt-2 transition">
                Get unlimited -&gt;
              </Link>
            </div>
          )}

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-2 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition text-sm"
          >
            <Settings size={15} /> Settings
          </button>

          <div className="relative" ref={profileRef}>
            {!hydrated ? (
              <div className="h-9 rounded-lg border border-white/10 bg-white/5" />
            ) : effectiveUser ? (
              <>
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/5 transition"
                >
                  <Avatar name={effectiveUser.name} avatarUrl={effectiveUser.avatar_url} size={8} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm text-white truncate font-medium">{effectiveUser.name}</p>
                    <p className="text-xs text-gray-500 truncate">{effectiveUser.email}</p>
                  </div>
                  <ChevronDown size={14} className={`text-gray-500 transition-transform shrink-0 ${showProfile ? "rotate-180" : ""}`} />
                </button>

                {showProfile && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-4 border-b border-white/10 flex items-center gap-3">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Avatar name={effectiveUser.name} avatarUrl={effectiveUser.avatar_url} size={10} />
                        <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Camera size={14} className="text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{effectiveUser.name}</p>
                        <p className="text-xs text-gray-500 truncate">{effectiveUser.email}</p>
                        <span className="inline-block mt-1 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full capitalize">{effectiveUser.plan} plan</span>
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />

                    <button
                      onClick={() => { setShowSettings(true); setShowProfile(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
                    >
                      <Settings size={14} /> Settings
                    </button>
                    <button
                      onClick={() => { logout(); setShowProfile(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex gap-2">
                <Link href="/login" className="flex-1 text-center text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-2 rounded-lg transition">
                  Sign in
                </Link>
                <Link href="/signup" className="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}
