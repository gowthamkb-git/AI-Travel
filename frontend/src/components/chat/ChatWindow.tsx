"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import MessageBubble from "./MessageBubble";
import InputBox from "./InputBox";
import FreeUsageModal from "@/components/auth/FreeUsageModal";

export default function ChatWindow() {
  const { messages, loading, sendMessage, showFreeModal, setShowFreeModal, composerResetKey } = useChat();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages]);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-gray-400 text-sm">AI is planning your trip...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
        <InputBox onSend={sendMessage} resetKey={composerResetKey} />
      </div>

      {showFreeModal && <FreeUsageModal onClose={() => setShowFreeModal(false)} />}
    </>
  );
}
