import type { RunResult } from "./engine";

export type Language = "javascript" | "python" | "java" | "cpp";

/** Compiled languages run on Compiler Explorer (through /api/tools/run), not in the browser. */
export const SERVER_LANGUAGES = ["java", "cpp"] as const;
export type ServerLanguage = (typeof SERVER_LANGUAGES)[number];

export type WorkerRequest = { id: number; code: string };

export type WorkerMessage = { id: number } & ({ type: "status"; status: "loading-python" | "running" } | { type: "result"; result: RunResult });
