import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { MusicDock } from "@/components/MusicDock";
import { Nav } from "@/components/Nav";
import { SuspendedNotice } from "@/components/SuspendedNotice";
import { TimezoneInit } from "@/components/TimezoneInit";
import { ViewerProvider, type ClientViewer } from "@/components/ViewerProvider";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getViewer } from "@/lib/viewer";
import type { Playlist } from "@/lib/youtube";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrackQuick — DSA mastery tracker",
  description: "Spaced-repetition tracker for product-interview DSA prep.",
};

/** The signed-in user with their timezone (default IST) and playlists; signed out if MongoDB isn't reachable. */
async function session(): Promise<{ viewer: ClientViewer | null; tz: string; playlists: Playlist[]; suspended?: boolean }> {
  try {
    const v = await getViewer(await headers());
    if (v?.suspended) return { viewer: null, tz: v.settings.timezone, playlists: [], suspended: true };
    if (v) {
      const viewer = { id: v.id, name: v.name, email: v.email, role: v.role, permissions: v.permissions };
      return { viewer, tz: v.settings.timezone, playlists: v.settings.playlists };
    }
  } catch {
    // fall through to signed out
  }
  return { viewer: null, tz: DEFAULT_TIMEZONE, playlists: [] };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { viewer, tz, playlists, suspended } = await session();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ViewerProvider viewer={viewer}>
          <TimezoneInit tz={tz} />
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-20 sm:px-6">
            {suspended ? <SuspendedNotice /> : children}
          </main>
          {viewer?.permissions.includes("practice.track") ? <MusicDock playlists={playlists} /> : null}
        </ViewerProvider>
      </body>
    </html>
  );
}
