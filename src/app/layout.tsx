import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ScrollProgressBar } from "@/components/motion/Reveal";
import { ThemeProvider } from "@/components/site/ThemeProvider";
import { I18nProvider } from "@/i18n/provider";
import { LANG_BOOTSTRAP_SCRIPT } from "@/i18n/config";
import { SkipLink } from "@/components/site/SkipLink";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "EdusGPT: a lesson player you can scrub second by second",
    template: "%s · EdusGPT",
  },
  description:
    "Lessons become a timeline you can scrub forward and back, with a spoken voice-over and captions that follow along. Trình phát bài giảng tua từng giây, có giọng đọc và phụ đề chạy theo.",
  applicationName: "EdusGPT",
  keywords: [
    "edusgpt",
    "bài giảng",
    "trình phát bài giảng",
    "lesson player",
    "AI lesson generator",
    "Gemini",
    "OpenRouter",
    "timeline scrubbing",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The stored theme and language, applied before the first paint:
            without these the page paints light and English, then flips, which
            reads as a glitch. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-ink-950 font-sans text-mist-100 antialiased">
        <ThemeProvider>
          <I18nProvider>
            <SkipLink />
            <ScrollProgressBar />
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
