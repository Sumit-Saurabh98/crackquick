import type { Metadata } from "next";
import { RecursionVisualizer } from "@/components/tools/recursion/RecursionVisualizer";

export const metadata: Metadata = { title: "Recursion & Backtracking Visualizer — CrackQuick" };

export default function RecursionToolPage() {
  return <RecursionVisualizer />;
}
