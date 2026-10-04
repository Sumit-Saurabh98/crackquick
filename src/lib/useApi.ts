"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Fetches `url` (skip with null) and re-fetches on `reload()` or when the url changes. */
export function useApi<T>(url: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: Boolean(url),
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    api<T>(url)
      .then((data) => alive && setState({ data, error: "", loading: false }))
      .catch((e: unknown) =>
        alive &&
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : "Failed to load", loading: false })),
      );
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
