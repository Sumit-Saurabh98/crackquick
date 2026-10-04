"use client";

import { setTimezone } from "@/lib/dates";

/**
 * Sets the app timezone (from Settings, read on the server in the root layout) for every client
 * component. Rendered before the page so dates are right on first paint.
 */
export function TimezoneInit({ tz }: { tz: string }) {
  setTimezone(tz);
  return null;
}
