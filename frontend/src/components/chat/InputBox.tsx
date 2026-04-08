"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { transcribeAudio } from "@/services/api";

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

export default function InputBox({
  onSend,
  resetKey = 0,
}: {
  onSend: (text: string) => void;
  resetKey?: number;
}) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeTypeRef = useRef("audio/webm");
  const transcribingRef = useRef(false);
  const silenceTimeoutRef = useRef<number | null>(null);
  const silenceIntervalRef = useRef<number | null>(null);
  const maxDurationTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isUnmountingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastResetKeyRef = useRef<number | undefined>(undefined);

  const cleanupAudioResources = () => {
    if (silenceTimeoutRef.current) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (silenceIntervalRef.current) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }

    if (maxDurationTimeoutRef.current) {
      window.clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    if (lastResetKeyRef.current === undefined) {
      lastResetKeyRef.current = resetKey;
      return;
    }
    if (resetKey === lastResetKeyRef.current) return;

    lastResetKeyRef.current = resetKey;
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudioResources();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    transcribingRef.current = false;
    setListening(false);
    setIsTranscribing(false);
    setVoiceError("");
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [resetKey]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onerror = null;
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      }
      recognitionRef.current?.stop();
      cleanupAudioResources();
    };
  }, []);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
    setVoiceError("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupAudioResources();
      setListening(false);
      return;
    }

    setListening(false);
    recorder.stop();
  };

  const startSilenceDetection = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const data = new Uint8Array(analyser.frequencyBinCount);

    analyser.fftSize = 2048;
    source.connect(analyser);
    audioContextRef.current = audioContext;

    silenceIntervalRef.current = window.setInterval(() => {
      analyser.getByteFrequencyData(data);
      const maxVolume = data.reduce((max, value) => Math.max(max, value), 0);
      const isSilent = maxVolume < 8;

      if (isSilent) {
        if (!silenceTimeoutRef.current) {
          silenceTimeoutRef.current = window.setTimeout(() => {
            stopRecording();
          }, 5000);
        }
        return;
      }

      if (silenceTimeoutRef.current) {
        window.clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    }, 250);
  };

  const handleMicClick = async () => {
    if (transcribingRef.current) return;
    setVoiceError("");

    if (listening) {
      recognitionRef.current?.stop();
      stopRecording();
      return;
    }

    const BrowserSpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (BrowserSpeechRecognition) {
      try {
        const recognition = new BrowserSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0]?.transcript ?? "")
            .join(" ")
            .trim();

          if (!transcript) return;

          setInput((prev) => {
            const separator = prev.trim() ? " " : "";
            return `${prev}${separator}${transcript}`;
          });
        };

        recognition.onend = () => {
          setListening(false);
          recognitionRef.current = null;
        };

        recognition.onerror = () => {
          setListening(false);
          recognitionRef.current = null;
          setVoiceError("Browser speech recognition could not understand the audio.");
        };

        recognitionRef.current = recognition;
        recognition.start();
        maxDurationTimeoutRef.current = window.setTimeout(() => {
          recognition.stop();
        }, 15000);
        setListening(true);
        return;
      } catch (error) {
        console.error("Browser speech recognition failed", error);
      }
    }

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      audioMimeTypeRef.current = recorder.mimeType || "audio/webm";

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          if (event.data.type) {
            audioMimeTypeRef.current = event.data.type;
          }
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupAudioResources();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setListening(false);
        setVoiceError("Unable to record audio. Please try again.");
      };

      recorder.onstop = async () => {
        if (isUnmountingRef.current) return;

        const chunks = [...audioChunksRef.current];
        const blobType = audioMimeTypeRef.current || recorder.mimeType || "audio/webm";
        const extension = blobType.includes("wav")
          ? "wav"
          : blobType.includes("mp4") || blobType.includes("mpeg")
            ? "mp4"
            : "webm";

        cleanupAudioResources();
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        if (!chunks.length) return;

        try {
          transcribingRef.current = true;
          setIsTranscribing(true);
          const audioBlob = new Blob(chunks, { type: blobType });
          const { transcript } = await transcribeAudio(audioBlob, `recording.${extension}`);

          if (!transcript?.trim()) {
            setVoiceError("No speech was detected in the recording.");
            return;
          }

          setInput((prev) => {
            const separator = prev.trim() ? " " : "";
            return `${prev}${separator}${transcript.trim()}`;
          });
        } catch (error) {
          console.error("Transcription failed", error);
          setVoiceError(error instanceof Error ? error.message : "Failed to transcribe audio");
        } finally {
          transcribingRef.current = false;
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      startSilenceDetection(stream);
      maxDurationTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, 15000);
      setListening(true);
    } catch (error) {
      cleanupAudioResources();
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setListening(false);
      console.error("Microphone access failed", error);
      setVoiceError("Unable to access microphone. Please check permissions and try again.");
    }
  };

  return (
    <div className="border-t border-white/10 px-6 py-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-colors">
          {/* Mic button */}
          <button
            type="button"
            onClick={handleMicClick}
            className={`transition shrink-0 mb-0.5 ${listening ? "text-red-400 hover:text-red-300" : "text-gray-500 hover:text-indigo-400"}`}
            title={listening ? "Stop voice input" : "Start voice input"}
          >
            <Mic size={18} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            suppressHydrationWarning
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Plan your dream trip..."
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-gray-500 resize-none leading-relaxed overflow-y-auto"
            style={{ maxHeight: "160px" }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 mb-0.5 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        {(listening || isTranscribing) && (
          <p className="text-xs text-red-400 mt-2">{listening ? "Listening..." : "Transcribing..."}</p>
        )}
        {voiceError && (
          <p className="text-xs text-red-400 mt-2">{voiceError}</p>
        )}
        <p className="text-center text-xs text-gray-600 mt-2">
          AI may make mistakes. Verify important travel details.
        </p>
      </div>
    </div>
  );
}
