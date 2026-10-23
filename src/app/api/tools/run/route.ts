import { NextResponse } from "next/server";
import { HttpError } from "@/lib/attempts";
import { consume } from "@/lib/rateLimit";
import { route } from "@/lib/viewer";
import { runCompiled, runnerConfigured } from "@/components/tools/recursion/compiled/run";
import { SERVER_LANGUAGES, type ServerLanguage } from "@/components/tools/recursion/runTypes";

// Compiling and running takes a few seconds (twice if the traced version doesn't compile).
export const maxDuration = 60;

/** Which compiled languages this deployment can run (none until CODE_RUNNER=godbolt is set). */
export const GET = route(async () => NextResponse.json({ languages: runnerConfigured() ? SERVER_LANGUAGES : [] }));

/** Body: { language: "java" | "cpp", code }. Runs it on Compiler Explorer and returns its trace. */
export const POST = route(
  async (req, { viewer }) => {
    if (!runnerConfigured()) throw new HttpError("Java and C++ aren't set up on this server yet.", 503);
    const body = (await req.json().catch(() => ({}))) as { language?: unknown; code?: unknown };
    const language = SERVER_LANGUAGES.find((l) => l === body.language);
    if (!language) throw new HttpError("Unknown language.", 400);
    if (typeof body.code !== "string" || !body.code.trim()) throw new HttpError("Write some code first.", 400);
    if (body.code.length > 50_000) throw new HttpError("That's too much code (50,000 characters at most).", 400);
    await consume(viewer.id, "run");
    return NextResponse.json({ result: await runCompiled(language as ServerLanguage, body.code) });
  },
  { errorStatus: 502 },
);
