import type { Metadata } from "next";
import { SetupPanel } from "@/components/setup/SetupPanel";

export const metadata: Metadata = {
  title: "Nhà cung cấp AI",
  description:
    "Chọn Cloud Provider (Google Gemini hoặc OpenRouter), dán API key rồi kiểm tra ngay trên localhost trước khi ghi vào .env.",
};

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <SetupPanel />
    </div>
  );
}
