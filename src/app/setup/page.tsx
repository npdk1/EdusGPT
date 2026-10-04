import type { Metadata } from "next";
import { SetupPanel } from "@/components/setup/SetupPanel";
import { VoiceSettings } from "@/components/setup/VoiceSettings";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export const metadata: Metadata = {
  title: "Cài đặt · Settings",
  description:
    "Set up EdusGPT: pick an AI provider (Gemini, OpenRouter or a CLI agent), paste an API key and test it on localhost before it is written to .env, then choose the light or dark appearance. — Cài đặt EdusGPT: chọn nhà cung cấp AI, dán API key rồi kiểm tra ngay trên localhost trước khi ghi vào .env, và chọn giao diện sáng hay tối.",
};

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-12 sm:px-6">
      <SetupPanel />
      {/* Which engine reads the narration. Under the key, because a machine that
          already has a voice needs nothing from the panel above to speak. */}
      <VoiceSettings />
      <ThemeToggle />
    </div>
  );
}