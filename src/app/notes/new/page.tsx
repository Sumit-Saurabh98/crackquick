"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { NoteForm } from "@/components/notes/NoteForm";
import { Spinner } from "@/components/Spinner";

export default function NewNotePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewNote />
    </Suspense>
  );
}

/** ?category=<id> starts the note in that category. */
function NewNote() {
  const category = useSearchParams().get("category") ?? "";
  return <NoteForm defaultCategory={/^[a-f0-9]{24}$/.test(category) ? category : ""} />;
}
