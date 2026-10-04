import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Nav } from "@/components/Nav";
import { TimezoneInit } from "@/components/TimezoneInit";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getTimezone } from "@/lib/dates";
import { dbConnect } from "@/lib/mongodb";
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

/** Settings → Timezone (default IST); falls back to the default if MongoDB isn't reachable. */
async function appTimezone() {
  await connection(); // per request, so a changed setting applies without a rebuild
  try {
    await dbConnect();
    return getTimezone();
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tz = await appTimezone();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TimezoneInit tz={tz} />
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
