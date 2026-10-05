import type { Metadata } from "next";
import { StudioPanel } from "@/components/studio/StudioPanel";

export const metadata: Metadata = {
  title: "Tạo Bài Giảng · Create Lesson",
  description:
    "Write a lesson from a topic, an outline or your own material, then open it straight in a player you can scrub.",
};

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <StudioPanel />
    </div>
  );
}
