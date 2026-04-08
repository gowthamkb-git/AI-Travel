import { motion } from "framer-motion";

export default function DayCard({
  day,
  places,
}: {
  day: string;
  places: string[];
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 backdrop-blur-md"
    >
      <h3 className="text-indigo-400 font-semibold mb-3">
        {day}
      </h3>

      <ul className="space-y-2 text-sm text-gray-200">
        {places.map((place, index) => (
          <li key={index} className="flex items-center gap-2">
            📍 {place}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
