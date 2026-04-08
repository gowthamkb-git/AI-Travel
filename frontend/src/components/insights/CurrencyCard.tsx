"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, BadgeInfo, DollarSign, Globe2, MapPinned, X } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";

export default function CurrencyCard() {
  const { widgets } = useTripContext();
  const c = widgets?.currency;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const hasCurrency = Boolean(c?.to_currency || c?.exchange_text);
  const compactHeadline = c?.same_currency
    ? `${c.to_currency ?? "Local"} used on both sides`
    : c?.from_currency && c?.to_currency && c?.rate
      ? `1 ${c.from_currency} = ${c.symbol ?? ""}${c.rate}`
      : c?.to_currency
        ? `${c.to_currency} at destination`
        : "Detected after response";

  const compactSubline = c?.same_currency
    ? "No exchange needed"
    : c?.exchange_text ?? (
      c?.from_currency && c?.to_currency
        ? `${c.from_currency} to ${c.to_currency}`
        : "Allow location access to compare with your local currency"
    );

  const modal = open && c ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#11192f] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
              <DollarSign size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Currency Details</h2>
              <p className="mt-1 text-sm text-slate-400">
                Live local-currency insight based on your current region and the destination.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:text-white"
            aria-label="Close currency details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <MapPinned size={14} />
                Your Side
              </div>
              <div className="mt-4 text-3xl font-semibold text-white">{c.from_currency ?? "--"}</div>
              <div className="mt-2 text-sm text-slate-300">{c.user_country ?? "Location access needed"}</div>
              <div className="mt-3 text-sm text-slate-400">
                {c.from_symbol ? `Symbol: ${c.from_symbol}` : "Currency symbol unavailable"}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-200">
                <ArrowRightLeft size={14} />
                Conversion
              </div>
              <div className="mt-4 text-2xl font-semibold text-white">
                {c.same_currency
                  ? "Same currency"
                  : c.rate && c.from_currency && c.to_currency
                    ? `1 ${c.from_currency} ≈ ${c.rate} ${c.to_currency}`
                    : "Destination currency detected"}
              </div>
              <div className="mt-3 text-sm leading-6 text-emerald-100/90">
                {c.exchange_text ?? "Live conversion details will appear here once both currencies are known."}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Globe2 size={14} />
                Destination
              </div>
              <div className="mt-4 text-3xl font-semibold text-white">{c.to_currency ?? "--"}</div>
              <div className="mt-2 text-sm text-slate-300">{c.destination_country ?? "Destination region"}</div>
              <div className="mt-3 text-sm text-slate-400">
                {c.symbol ? `Symbol: ${c.symbol}` : "Currency symbol unavailable"}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 text-sm text-white">
              <BadgeInfo size={16} className="text-emerald-300" />
              Useful Notes
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(c.key_points?.length ? c.key_points : ["Currency details are not available yet."]).map((point, index) => (
                <div
                  key={`${point}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-slate-300"
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
          if (hasCurrency) setOpen(true);
        }}
        className="w-full rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-3 text-left shadow-lg transition hover:scale-[1.01]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-gray-400">Currency</h2>
          <DollarSign className="text-green-400" size={17} />
        </div>

        {hasCurrency ? (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-semibold text-white">{compactHeadline}</p>
            <p className="line-clamp-2 text-xs leading-5 text-gray-400">{compactSubline}</p>
            {c?.same_currency && (
              <span className="mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                Same currency
              </span>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-semibold text-gray-600">—</p>
            <p className="text-xs text-gray-600">Detected after response</p>
          </div>
        )}
      </button>

      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
