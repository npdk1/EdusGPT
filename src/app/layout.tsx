import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ScrollProgressBar } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: {
    default: "EdusGPT: trình phát bài giảng tua lại từng giây",
    template: "%s · EdusGPT",
  },
  description:
    "Bài giảng thành timeline có thể tua tới, tua lui và lặp đoạn, kèm giọng đọc và phụ đề chạy theo chữ.",
  applicationName: "EdusGPT",
  keywords: [
    "edusgpt",
    "bài giảng",
    "trình phát bài giảng",
    "Gemini",
    "OpenRouter",
    "timeline scrubbing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-ink-950 font-sans text-mist-100 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand-400 focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-950"
        >
          Bỏ qua tới nội dung
        </a>
        <ScrollProgressBar />
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
