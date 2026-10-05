import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { MusicDock } from "@/components/MusicDock";
import { Nav } from "@/components/Nav";
import { TimezoneInit } from "@/components/TimezoneInit";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getTimezone } from "@/lib/dates";
import { dbConnect } from "@/lib/mongodb";
import type { Playlist } from "@/lib/youtube";
import { getSettings } from "@/models/Settings";
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
  description: "Personal spaced-repetition tracker for product-interview DSA prep.",
};

/** Timezone (default IST) and music playlists from Settings; defaults if MongoDB isn't reachable. */
async function appSettings(): Promise<{ tz: string; playlists: Playlist[] }> {
  await connection(); // per request, so a changed setting applies without a rebuild
  try {
    await dbConnect();
    return { tz: getTimezone(), playlists: (await getSettings()).playlists };
  } catch {
    return { tz: DEFAULT_TIMEZONE, playlists: [] };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { tz, playlists } = await appSettings();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TimezoneInit tz={tz} />
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-20 sm:px-6">{children}</main>
        <MusicDock playlists={playlists} />
      </body>
    </html>
  );
}
