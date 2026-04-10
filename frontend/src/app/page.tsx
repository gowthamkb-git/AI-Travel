"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import Sidebar from "@/components/layout/Sidebar";
import WidgetsPanel from "@/components/widgets/WidgetsPanel";
import MessageBubble from "@/components/chat/MessageBubble";
import InputBox from "@/components/chat/InputBox";
import FreeUsageModal from "@/components/auth/FreeUsageModal";

export default function Home() {
  const { messages, loading, sendMessage, showFreeModal, setShowFreeModal, resetChat, loadTrip, composerResetKey } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages]);

  return (
    <main className="h-screen w-full flex bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/10 backdrop-blur-xl shrink-0">
        <Sidebar onNewTrip={resetChat} onLoadTrip={loadTrip} />
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col backdrop-blur-xl min-w-0">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/bot.svg"
                      alt="AI thinking"
                      width={32}
                      height={32}
                      className="rounded-full animate-pulse"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-300 text-sm font-medium">Planning your trip...</span>
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
        <InputBox onSend={sendMessage} resetKey={composerResetKey} />
      </div>

      {/* Widgets */}
      <div className="w-[44rem] max-w-[46vw] border-l border-white/10 backdrop-blur-xl shrink-0 min-w-[30rem]">
        <WidgetsPanel />
      </div>

      {showFreeModal && <FreeUsageModal onClose={() => setShowFreeModal(false)} />}
    </main>
  );
}
