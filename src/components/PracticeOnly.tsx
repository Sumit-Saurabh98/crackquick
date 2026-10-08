"use client";

import { redirect } from "next/navigation";
import { useCan } from "@/components/ViewerProvider";

/** Pages for practising (Desk, Review, Progress). Management-only roles go to the catalog instead. */
export function PracticeOnly({ children }: { children: React.ReactNode }) {
  if (!useCan("practice.track")) redirect("/questions");
  return children;
}
