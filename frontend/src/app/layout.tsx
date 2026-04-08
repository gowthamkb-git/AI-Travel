import type { Metadata } from "next";
import "./globals.css";
import { TripProvider } from "@/lib/TripContext";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "AI Trip Planner",
  description: "Plan your dream trip with AI",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <TripProvider>{children}</TripProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
