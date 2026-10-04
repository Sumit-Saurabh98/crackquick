"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlatformImport } from "@/components/PlatformImport";
import { QuestionForm } from "@/components/QuestionForm";

export default function NewQuestionPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"import" | "manual">("import");
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <p className="eyebrow">New</p>
        <h1 className="display text-3xl">Add questions</h1>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button aria-pressed={tab === "import"} onClick={() => setTab("import")} className="chip">
          From LeetCode / GFG
        </button>
        <button aria-pressed={tab === "manual"} onClick={() => setTab("manual")} className="chip">
          Manual
        </button>
      </div>
      {tab === "import" ? (
        <PlatformImport />
      ) : (
        <QuestionForm onSaved={(item) => router.push(`/questions/${item._id}`)} />
      )}
    </div>
  );
}
