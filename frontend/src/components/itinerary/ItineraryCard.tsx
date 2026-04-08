"use client";

import { useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

export default function ItineraryCard({ content }: { content: string }) {
  const [activeTab, setActiveTab] = useState(0);

  // Parse the text into an array of objects
  const days = content.split("Day").slice(1);
  const parsedDays = days.map((dayText, idx) => {
    const lines = dayText.trim().split("\n");
    const title = "Day " + lines[0].trim();
    const places = lines
      .slice(1)
      .filter((line) => line.includes("📍"))
      .map((line) => line.replace("📍", "").trim());
    return { id: idx, title, places };
  });

  // Handle swipe gestures
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;
    if (info.offset.y < -swipeThreshold && activeTab < parsedDays.length - 1) {
      // Swiped up -> go to next day
      setActiveTab((prev) => prev + 1);
    } else if (info.offset.y > swipeThreshold && activeTab > 0) {
      // Swiped down -> go to previous day
      setActiveTab((prev) => prev - 1);
    }
  };

  return (
    <div className="w-full sm:w-[350px] transition-all duration-300 h-[380px]">
      <div className="relative w-full h-full pt-2">
        {parsedDays.map((day, index) => {
          // Calculate distance from the active card
          const offset = index - activeTab;
          const isActive = offset === 0;

          // Hide cards that are past (slid off the top) or too far in the future
          if (offset < -1 || offset > 3) return null;

          return (
            <motion.div
              key={day.id}
              onClick={() => {
                if (offset > 0) setActiveTab(index);
              }}
              drag={isActive ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              initial={false}
              animate={{
                top: offset < 0 ? -150 : (offset === 0 ? 0 : 220 + offset * 25),
                scale: offset < 0 ? 1 : 1 - offset * 0.05,
                opacity: offset < 0 ? 0 : 1 - offset * 0.25,
                zIndex: parsedDays.length - index,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`absolute left-0 right-0 overflow-hidden border shadow-2xl transition-colors rounded-xl backdrop-blur-2xl
                ${isActive 
                  ? "bg-gradient-to-br from-indigo-900/100 to-[#1a1c29]/100 border-indigo-400/50 cursor-grab active:cursor-grabbing" 
                  : "bg-gradient-to-br from-[#2a2d3e]/100 to-[#1a1c29]/100 border-white/10 hover:border-white/30 cursor-pointer"
                }`}
            >
              {/* Card Header */}
              <div className="p-5 flex justify-between items-center bg-transparent relative z-10 select-none">
                <h3 className={`font-semibold tracking-wide text-lg ${isActive ? "text-white" : "text-gray-300"}`}>
                  {day.title}
                </h3>
                {isActive ? (
                  <span className="text-xl">🌴</span>
                ) : (
                  <span className="text-gray-500 opacity-80 text-sm font-medium uppercase tracking-widest">
                    {offset === 1 ? "Next" : ""}
                  </span>
                )}
              </div>

              {/* Expandable Content for Active Card */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "180px" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-5 pb-5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    <div className="space-y-4 pt-3 border-t border-white/10 select-none">
                      {day.places.map((place, i) => (
                        <div key={i} className="flex items-center gap-3 text-gray-200 text-sm font-medium">
                          <span className="text-xl bg-white/5 rounded-full p-1.5 shadow-inner border border-white/5 backdrop-blur-md">📍</span>
                          <span className="tracking-wide">{place}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
      
      {/* Navigation Indicators */}
      {parsedDays.length > 1 && (
        <div className="flex justify-center mt-2 gap-3 relative z-50">
          {parsedDays.map((_, i) => (
            <motion.div
              key={i}
              onClick={() => setActiveTab(i)}
              className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === i ? "w-6 bg-indigo-400" : "w-2 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}