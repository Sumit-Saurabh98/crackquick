"use client";

import type { SettingsJSON } from "@/app/api/settings/route";
import { DEFAULT_REVISION_INTERVALS } from "./constants";
import { useApi } from "./useApi";

/** User settings; `intervals` falls back to the default ladder until loaded. */
export function useSettings() {
  const res = useApi<SettingsJSON>("/api/settings");
  return { ...res, intervals: res.data?.intervals ?? DEFAULT_REVISION_INTERVALS };
}
