import type { Metadata } from "next";
import { LibraryPanel } from "@/components/library/LibraryPanel";
import { LibraryHeader } from "./LibraryHeader";

export const metadata: Metadata = {
  title: "Lesson library",
  description:
    "Every lesson saved on this machine. Open, remove and manage the lessons already written.",
};

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <LibraryHeader />
      <LibraryPanel />
    </div>
  );
}