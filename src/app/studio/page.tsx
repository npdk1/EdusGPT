import type { Metadata } from "next";
import { StudioPanel } from "@/components/studio/StudioPanel";

export const metadata: Metadata = {
  title: "Studio AI",
  description:
    "Soạn bài giảng từ chủ đề, dàn ý hay tài liệu của bạn rồi mở ngay trong trình phát có thể tua.",
};

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <StudioPanel />
    </div>
  );
}
