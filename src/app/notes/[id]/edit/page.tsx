"use client";

import { useParams } from "next/navigation";
import { ErrorPanel } from "@/components/ErrorPanel";
import { NoteForm } from "@/components/notes/NoteForm";
import { Spinner } from "@/components/Spinner";
import type { NoteJSON } from "@/lib/noteTypes";
import { useApi } from "@/lib/useApi";

export default function EditNotePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useApi<{ item: NoteJSON }>(`/api/notes/${id}`);
  if (error && !data) return <ErrorPanel error={error} />;
  if (!data) return <Spinner />;
  return <NoteForm note={data.item} />;
}
