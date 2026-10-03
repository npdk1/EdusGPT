import type { Metadata } from "next";
import { SetupPanel } from "@/components/setup/SetupPanel";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export const metadata: Metadata = {
  title: "Cài đặt",
  description:
    "Cài đặt EdusGPT: chọn nhà cung cấp AI (Gemini, OpenRouter hay agent CLI), dán API key rồi kiểm tra ngay trên localhost trước khi ghi vào .env, và chọn giao diện sáng hay tối.",
};

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-12 sm:px-6">
      <SetupPanel />
      <ThemeToggle />
    </div>
  );
}