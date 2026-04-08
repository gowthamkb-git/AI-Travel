"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeInfo, Calculator, Landmark, ReceiptText, Wallet, X } from "lucide-react";
import { useTripContext } from "@/lib/TripContext";

export default function ExpenseCard() {
  const { widgets } = useTripContext();
  const b = widgets?.budget;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const hasBudget = Boolean(b?.total || b?.exchange_text);
  const compactHeadline = b?.total_destination ?? b?.total ?? "Estimated after response";
  const compactSubline = b?.total_local
    ? `About ${b.total_local} from your side`
    : b?.exchange_text ?? "Destination-side estimate shown";

  const modal = open && b ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#11192f] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-purple-500/15 p-3 text-purple-300">
              <Wallet size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white">Budget Details</h2>
              <p className="mt-1 text-sm text-slate-400">
                Total cost in your local currency with the destination equivalent and category breakdown.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:text-white"
            aria-label="Close budget details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Wallet size={14} />
                Your Spend View
              </div>
              <div className="mt-4 text-3xl font-semibold text-white">{b.total_local ?? b.total ?? "--"}</div>
              <div className="mt-2 text-sm text-slate-300">
                {b.local_currency ? `${b.local_currency} from your side` : "Local comparison"}
              </div>
              <div className="mt-3 text-sm text-slate-400">
                {b.per_day_local ?? b.per_day ? `${b.per_day_local ?? b.per_day} per day` : "Per-day estimate unavailable"}
              </div>
            </div>

            <div className="rounded-3xl border border-purple-400/20 bg-purple-400/10 p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-purple-200">
                <Calculator size={14} />
                Conversion View
              </div>
              <div className="mt-4 text-2xl font-semibold text-white">
                {b.same_currency ? "Same currency" : b.local_currency ? "Destination to local comparison" : "Location access needed"}
              </div>
              <div className="mt-3 text-sm leading-6 text-purple-100/90">
                {b.exchange_text ?? "Budget comparison details are not available yet."}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                <Landmark size={14} />
                Destination View
              </div>
              <div className="mt-4 text-3xl font-semibold text-white">{b.total_destination ?? b.total ?? "--"}</div>
              <div className="mt-2 text-sm text-slate-300">
                {b.destination_currency ? `${b.destination_currency} at destination` : "Destination total"}
              </div>
              <div className="mt-3 text-sm text-slate-400">
                {b.per_day_destination ? `${b.per_day_destination} per day` : "Per-day destination estimate unavailable"}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-sm text-white">
                <ReceiptText size={16} className="text-purple-300" />
                Budget Breakdown
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Accommodation", b.breakdown?.accommodation],
                  ["Food", b.breakdown?.food],
                  ["Transport", b.breakdown?.transport],
                  ["Activities", b.breakdown?.activities],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
                    <div className="mt-2 text-lg font-medium text-white">{value || "Not estimated"}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-sm text-white">
                <BadgeInfo size={16} className="text-purple-300" />
                Useful Notes
              </div>
              <div className="mt-4 space-y-3">
                {(b.key_points?.length ? b.key_points : ["Budget details are not available yet."]).map((point, index) => (
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
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (hasBudget) setOpen(true);
        }}
        className="w-full rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-3 text-left shadow-lg transition hover:scale-[1.01]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-gray-400">Total Budget</h2>
          <Wallet className="text-purple-400" size={17} />
        </div>

        {hasBudget ? (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-semibold text-white">{compactHeadline}</p>
            <p className="line-clamp-2 text-xs leading-5 text-gray-400">{compactSubline}</p>
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-lg font-semibold text-gray-600">—</p>
            <p className="text-xs text-gray-600">Estimated after response</p>
          </div>
        )}
      </button>

      {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
