export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

/** Default timezone for "today", due dates and all displayed times (India Standard Time). Editable in Settings. */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Default spaced-repetition ladder in days. Editable in Settings; stored per user. */
export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 14, 30, 60, 90];

export const PAGE_SIZE = 50;

export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Needed the solution",
  2: "Solved with hints",
  3: "Solved, slow / shaky",
  4: "Solved cleanly",
  5: "Instant, could teach it",
};
