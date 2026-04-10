"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import PlaceInlineLink from "@/components/places/PlaceInlineLink";
import { useTripContext } from "@/lib/TripContext";
import { findPlaceByLinkId, injectListedPlaceQueryLinks, injectPlaceLinks } from "@/lib/placeText";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-white/10">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-indigo-300 mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-indigo-200 mt-5 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-indigo-100 mt-4 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 leading-relaxed mb-3">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="space-y-1.5 mb-4 ml-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="space-y-1.5 mb-4 ml-2 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="flex gap-2 text-gray-300 text-sm leading-relaxed">
      <span className="text-indigo-400 mt-1 shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-indigo-200 italic">{children}</em>
  ),
  hr: () => (
    <hr className="border-white/10 my-5" />
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-indigo-500 pl-4 my-4 text-gray-400 italic">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-white/10 text-indigo-200 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
  ),
};

export default function MessageBubble({
  role,
  content,
}: {
  role: string;
  content: string;
}) {
  const { placeMarkers } = useTripContext();
  const renderedContent = role === "assistant"
    ? injectListedPlaceQueryLinks(injectPlaceLinks(content, placeMarkers))
    : content;

  const components: Components = {
    ...markdownComponents,
    a: ({ href, children }) => {
      if (href?.startsWith("place://")) {
        const linkId = href.replace("place://", "");
        const place = findPlaceByLinkId(placeMarkers, linkId);
        if (!place) {
          return <span>{children}</span>;
        }
        return <PlaceInlineLink place={place}>{children}</PlaceInlineLink>;
      }

      if (href?.startsWith("place-query://")) {
        const placeQuery = decodeURIComponent(href.replace("place-query://", ""));
        return <PlaceInlineLink placeQuery={placeQuery}>{children}</PlaceInlineLink>;
      }

      return (
        href && /^https?:\/\//i.test(href)
          ? (
            <a href={href} className="text-indigo-300 underline underline-offset-4" target="_blank" rel="noreferrer">
              {children}
            </a>
          )
          : <span>{children}</span>
      );
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}
    >
      {role === "assistant" ? (
        <div className="w-full bg-white/[0.03] border border-white/8 rounded-2xl px-8 py-6">
          <div className="flex items-center gap-2 mb-4">
            <Image src="/bot.svg" alt="AI" width={28} height={28} className="rounded-full shrink-0" />
            <span className="text-xs text-gray-500 font-medium uppercase tracking-widest">Trip Planner</span>
          </div>
          <div className="text-gray-200">
            <ReactMarkdown components={components}>{renderedContent}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="max-w-md bg-indigo-600/80 border border-indigo-500 text-white px-5 py-3 rounded-2xl shadow-lg">
          <div className="text-sm leading-relaxed">{content}</div>
        </div>
      )}
    </motion.div>
  );
}
