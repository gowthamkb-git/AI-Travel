"use client";

import { useRouter } from "next/navigation";
import { Plane, X, Zap } from "lucide-react";

export default function FreeUsageModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition">
          <X size={18} />
        </button>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-5">
            <Zap size={26} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">You've used your 2 free trips</h2>
          <p className="text-gray-400 text-sm mb-6">
            Create a free account to unlock <span className="text-white font-medium">50 trip plans/month</span>, save your history, and access all features.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/signup")}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2"
            >
              <Plane size={16} /> Create free account
            </button>
            <button
              onClick={() => router.push("/login")}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-3 rounded-xl font-medium text-sm transition"
            >
              Sign in to existing account
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-4">No credit card required</p>
        </div>
      </div>
    </div>
  );
}
