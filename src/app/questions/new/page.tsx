"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlatformImport, PlatformSuggest } from "@/components/PlatformImport";
import { QuestionForm } from "@/components/QuestionForm";
import { Spinner } from "@/components/Spinner";
import { useCan } from "@/components/ViewerProvider";
import { formatDate } from "@/lib/dates";
import type { SubmissionJSON } from "@/lib/submissions";
import { useApi } from "@/lib/useApi";

export default function NewQuestionPage() {
  return useCan("catalog.edit") ? <AddQuestions /> : <SuggestQuestion />;
}

function Tabs({ tab, setTab }: { tab: "import" | "manual"; setTab: (t: "import" | "manual") => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button aria-pressed={tab === "import"} onClick={() => setTab("import")} className="chip">
        From LeetCode / GFG
      </button>
      <button aria-pressed={tab === "manual"} onClick={() => setTab("manual")} className="chip">
        Manual
      </button>
    </div>
  );
}

function AddQuestions() {
  const router = useRouter();
  const [tab, setTab] = useState<"import" | "manual">("import");
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <p className="eyebrow">New</p>
        <h1 className="display text-3xl">Add questions</h1>
      </div>
      <Tabs tab={tab} setTab={setTab} />
      {tab === "import" ? (
        <PlatformImport />
      ) : (
        <QuestionForm mode="create" onSaved={(item) => router.push(`/questions/${item!._id}`)} />
      )}
    </div>
  );
}

/** Same two ways in as admins, but the result is a suggestion; one can be waiting at a time. */
function SuggestQuestion() {
  const router = useRouter();
  const [tab, setTab] = useState<"import" | "manual">("import");
  const pending = useApi<{ items: SubmissionJSON[] }>("/api/submissions?status=pending&mine=1");
  const waiting = pending.data?.items.find((s) => s.kind === "new");
  const sent = () => router.push("/submissions?sent=1");

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <p className="eyebrow">Suggest</p>
        <h1 className="display text-3xl">Suggest a question</h1>
        <p className="mt-1 text-sm text-muted">
          An admin or editor reviews it first. Once approved it joins everyone&apos;s list, yours included. You can have one
          suggestion waiting at a time.
        </p>
      </div>
      {!pending.data && !pending.error ? (
        <Spinner />
      ) : waiting ? (
        <div className="card grid gap-3 p-5">
          <p className="text-sm">
            <span className="text-brass2">“{waiting.questionTitle}”</span> is waiting for review (sent{" "}
            {formatDate(waiting.createdAt)}). You can suggest another once it&apos;s approved or rejected.
          </p>
          <div>
            <Link href="/submissions" className="btn">
              See it in Submissions
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Tabs tab={tab} setTab={setTab} />
          {tab === "import" ? <PlatformSuggest onSent={sent} /> : <QuestionForm mode="suggest-new" onSaved={sent} />}
        </>
      )}
    </div>
  );
}
