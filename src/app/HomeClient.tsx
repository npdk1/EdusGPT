"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  KeyRound,
  MousePointerClick,
  CirclePlay,
  Repeat,
  ScanEye,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { HeroCanvas } from "@/components/three/HeroCanvas";
import { Magnetic, Marquee } from "@/components/motion/Interactive";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedNumber, SplitHeading } from "@/components/motion/SplitHeading";
import { SetupCallout } from "@/components/site/AiKeyBadge";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    homeChipLocal: "Runs on your machine",
    homeTitle: "AI lessons you can scrub second by second",
    homeLead:
      "A lesson becomes a timeline you can scrub forward and back, loop over a passage until it sticks, with narration and subtitles that follow every word. Everything runs on your machine, with no account and no database.",
    homeCtaPlayer: "Open the player and try scrubbing",
    homeCtaKey: "Add an API key",
    homeCtaStudio: "Generate a new lesson",
    homeStatFpsSuffix: " fps",
    homeStatFpsLabel: "of smooth scrubbing",
    homeStatSamplesLabel: "sample lessons ready",
    homeStatBytesSuffix: " bytes",
    homeStatBytesLabel: "data leaving your machine",
    homeDragChip: "drag to scrub",
    homeDemoArrows: "◀◀ back · ▶▶ forward",
    homeDemoChapter1: "chapter 1",
    homeDemoChapter2: "chapter 2",
    homeDemoChapter3: "chapter 3",
    homeDemoKeysHint: "loop a hard passage with A→B",
    homeDemoNote:
      "The timeline lives right in the browser, so you can scrub back and forth freely before presenting, and review a moment without rendering anything in advance.",
    homeFeaturesChip: "what is different",
    homeFeaturesTitle: "The three things you asked for, carried all the way through",
    homeFeatureSeekTitle: "Scrubbing both ways, no drift",
    homeFeatureSeekBody:
      "Every scene has its own timings, so seeking forward or back lands on the same frame — including when you scrub backwards halfway through.",
    homeFeatureLayersTitle: "Three layers of motion",
    homeFeatureLayersBody:
      "The 3D backdrop, the interface motion and the lesson content are three separate layers. Each one is isolated and can be switched off on a slow machine.",
    homeFeatureKeyTitle: "Add the API key from the browser",
    homeFeatureKeyBody:
      "Open /setup on localhost, paste the key, press check and you are done. The key stays in .env on your machine and goes nowhere else.",
    homeStackChip: "architecture",
    homeStackTitle: "Read the code and the whole flow is there",
    homeStackPaletteTitle: "No off-palette hues",
    homeStackPaletteBody:
      "The whole palette is teal, gold and ink. A check:palette script blocks the build the moment a colour from outside it turns up in the source, whether as a class or a hex code.",
    homeStackWayfindingTitle: "You always know where you are",
    homeStackWayfindingBody:
      "Hover the timeline and the timestamp appears under the cursor. Chapters you have read fade back, the one you are studying light up.",
    homeStackLocalTitle: "Everything runs on your machine",
    homeStackLocalBody:
      "A server route keeps the API key out of the browser, while the lesson, the timeline and the timestamps all run on your machine.",
    homeTopicNewton: "Newton's second law",
    homeTopicOverfitting: "Overfitting",
    homeTopicDerivative: "Derivative by definition",
    homeTopicForLoop: "For loop",
    homeTopicPresentPerfect: "Present perfect",
    homeTopicEquilibrium: "Chemical equilibrium",
    homeTopicQuadratic: "Quadratic function",
    homeTopicPhotosynthesis: "Photosynthesis in plants",
    homeCtaTitle: "Start in two steps",
    homeCtaStep1Lead: "Open",
    homeCtaStep1Tail: "and paste your API key. The page checks the key before it saves it.",
    homeCtaStep2Lead: "Open",
    homeCtaStep2Tail: "to generate a lesson, then open it in the",
    homeCtaPlayerLink: "player",
    homeCtaStep2End: "and try scrubbing.",
    homeCtaButton: "Try scrubbing a lesson",
  },
  vi: {
    homeChipLocal: "Chạy trên máy bạn",
    homeTitle: "Bài giảng AI tua được từng giây",
    homeLead:
      "Bài giảng thành timeline có thể tua tới, tua lui, lặp một đoạn để học kỹ, kèm giọng đọc và phụ đề chạy theo từng chữ. Mọi thứ chạy trên máy bạn, không cần tài khoản hay database.",
    homeCtaPlayer: "Mở trình phát & thử tua",
    homeCtaKey: "Cài API key",
    homeCtaStudio: "Sinh bài giảng mới",
    homeStatFpsSuffix: " khung",
    homeStatFpsLabel: "mỗi giây tua mượt",
    homeStatSamplesLabel: "bài mẫu sẵn sàng",
    homeStatBytesSuffix: " byte",
    homeStatBytesLabel: "dữ liệu rời khỏi máy",
    homeDragChip: "kéo để tua",
    homeDemoArrows: "◀◀ tua lui · ▶▶ tua tới",
    homeDemoChapter1: "chương 1",
    homeDemoChapter2: "chương 2",
    homeDemoChapter3: "chương 3",
    homeDemoKeysHint: "lặp đoạn khó bằng A→B",
    homeDemoNote:
      "Timeline sống ngay trong trình duyệt nên bạn tua tới lui thoải mái trước khi trình chiếu, xem lại ngay mà không cần render trước.",
    homeFeaturesChip: "khác biệt",
    homeFeaturesTitle: "Ba thứ bạn yêu cầu, làm tới nơi tới chốn",
    homeFeatureSeekTitle: "Tua hai chiều, không trôi hình",
    homeFeatureSeekBody:
      "Mỗi cảnh có mốc thời gian riêng nên tua tới hay tua lui đều ra đúng khung, kể cả khi tua ngược lại giữa chừng.",
    homeFeatureLayersTitle: "Ba lớp chuyển động",
    homeFeatureLayersBody:
      "Nền 3D, chuyển động giao diện và nội dung bài giảng là ba lớp riêng. Mỗi lớp tách bạch, tắt được khi máy yếu.",
    homeFeatureKeyTitle: "Cài API key ngay trên web",
    homeFeatureKeyBody:
      "Mở /setup trên localhost, dán key, bấm kiểm tra là xong. Key nằm trong .env trên máy bạn, không đi đâu khác.",
    homeStackChip: "kiến trúc",
    homeStackTitle: "Đọc code là thấy hết luồng chạy",
    homeStackPaletteTitle: "Không gradient tím",
    homeStackPaletteBody:
      "Toàn bộ hệ màu là teal, gold và ink. Có script check:palette chặn ngay nếu source lỡ xuất hiện màu tím hay xanh tím, dù là class hay mã hex.",
    homeStackWayfindingTitle: "Biết mình đang ở đâu",
    homeStackWayfindingBody:
      "Rê chuột lên timeline là biết mốc thời gian ngay tại chỗ. Chương đã đọc thì mờ đi, chương đang học thì sáng lên.",
    homeStackLocalTitle: "Mọi thứ chạy ngay trên máy bạn",
    homeStackLocalBody:
      "Server route giữ cho API key không lộ ra trình duyệt, còn bài giảng, timeline và phần mốc thời gian thì chạy ngay trên máy bạn.",
    homeTopicNewton: "Định luật II Newton",
    homeTopicOverfitting: "Overfitting",
    homeTopicDerivative: "Đạo hàm theo định nghĩa",
    homeTopicForLoop: "Vòng lặp for",
    homeTopicPresentPerfect: "Thì hiện tại hoàn thành",
    homeTopicEquilibrium: "Cân bằng phản ứng hoá học",
    homeTopicQuadratic: "Hàm số bậc hai",
    homeTopicPhotosynthesis: "Quang hợp ở thực vật",
    homeCtaTitle: "Bắt đầu trong hai bước",
    homeCtaStep1Lead: "Mở",
    homeCtaStep1Tail: "và dán API key của bạn. Trang tự kiểm tra key trước khi lưu.",
    homeCtaStep2Lead: "Vào",
    homeCtaStep2Tail: "sinh bài giảng, rồi mở trong",
    homeCtaPlayerLink: "trình phát",
    homeCtaStep2End: "để tua thử.",
    homeCtaButton: "Thử tua một bài giảng",
  },
};

/** The three cards of the "what is different" row; wording lives in COPY above. */
const FEATURES = [
  {
    icon: Repeat,
    titleKey: "homeFeatureSeekTitle",
    bodyKey: "homeFeatureSeekBody",
    tone: "brand",
  },
  {
    icon: Boxes,
    titleKey: "homeFeatureLayersTitle",
    bodyKey: "homeFeatureLayersBody",
    tone: "gold",
  },
  {
    icon: KeyRound,
    titleKey: "homeFeatureKeyTitle",
    bodyKey: "homeFeatureKeyBody",
    tone: "ember",
  },
] as const;

/** The architecture row. */
const STACK = [
  {
    icon: Gauge,
    titleKey: "homeStackPaletteTitle",
    bodyKey: "homeStackPaletteBody",
    tint: "from-brand-500/15",
  },
  {
    icon: ScanEye,
    titleKey: "homeStackWayfindingTitle",
    bodyKey: "homeStackWayfindingBody",
    tint: "from-gold-500/15",
  },
  {
    icon: Cpu,
    titleKey: "homeStackLocalTitle",
    bodyKey: "homeStackLocalBody",
    tint: "from-ember-500/15",
  },
] as const;

/** The scrolling topic strip, as dictionary keys. */
const TOPIC_KEYS = [
  "homeTopicNewton",
  "homeTopicOverfitting",
  "homeTopicDerivative",
  "homeTopicForLoop",
  "homeTopicPresentPerfect",
  "homeTopicEquilibrium",
  "homeTopicQuadratic",
  "homeTopicPhotosynthesis",
] as const;

/** The chapter tabs inside the hero mock-up. */
const DEMO_CHAPTER_KEYS = [
  "homeDemoChapter1",
  "homeDemoChapter2",
  "homeDemoChapter3",
] as const;

/**
 * The landing page, as a client island.
 *
 * `page.tsx` stays a server component and renders this; the split exists so the
 * copy can come from `useCopy` instead of being baked into the server tree.
 */
export default function HomeClient() {
  const t = useCopy(COPY);

  const features = FEATURES.map((card) => ({
    ...card,
    title: t[card.titleKey],
    body: t[card.bodyKey],
  }));
  const stack = STACK.map((card) => ({
    ...card,
    title: t[card.titleKey],
    body: t[card.bodyKey],
  }));
  const topics = TOPIC_KEYS.map((key) => t[key]);
  const demoChapters = DEMO_CHAPTER_KEYS.map((key) => t[key]);
  const stats = [
    { value: 25, suffix: t.homeStatFpsSuffix, label: t.homeStatFpsLabel },
    { value: 36, suffix: "s", label: t.homeStatSamplesLabel },
    { value: 0, suffix: t.homeStatBytesSuffix, label: t.homeStatBytesLabel },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pt-14 sm:-mx-6 sm:px-6 lg:pt-20">
        <HeroCanvas className="pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative grid gap-10 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div>
            <span className="chip">
              <Sparkles className="h-3.5 w-3.5 text-gold-300" />
              {t.homeChipLocal}
            </span>
            {/* GSAP SplitText rewrites the heading's own nodes, so a language
                switch has to remount it — otherwise the words stay in the
                language they were split in. */}
            <SplitHeading
              key={t.homeTitle}
              as="h1"
              immediate
              className="mt-5 text-balance text-4xl font-bold tracking-tight text-mist-50 sm:text-5xl lg:text-6xl"
            >
              <span className="text-gradient-warm">{t.homeTitle}</span>
            </SplitHeading>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-mist-300 sm:text-lg">
              {t.homeLead}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Magnetic>
                <Link href="/lesson" className="btn-primary px-5 py-3">
                  <CirclePlay className="h-4 w-4" /> {t.homeCtaPlayer}
                </Link>
              </Magnetic>
              <Link href="/setup" className="btn-ghost px-5 py-3">
                <KeyRound className="h-4 w-4" /> {t.homeCtaKey}
              </Link>
              <Link
                href="/studio"
                className="inline-flex items-center gap-2 px-2 py-3 text-sm font-semibold text-brand-200 transition-colors hover:text-brand-100"
              >
                <WandSparkles className="h-4 w-4" /> {t.homeCtaStudio}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {stats.map((item) => (
                <div key={item.label}>
                  <dt className="text-xl font-bold text-brand-200 sm:text-2xl">
                    <AnimatedNumber value={item.value} suffix={item.suffix} />
                  </dt>
                  <dd className="mt-1 text-xs text-mist-400">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="panel relative p-5 lg:p-6" y={40}>
            <div className="flex items-center justify-between gap-3">
              <span className="chip">
                <MousePointerClick className="h-3.5 w-3.5" /> {t.homeDragChip}
              </span>
              <span className="font-mono text-[11px] text-mist-500">
                {t.homeDemoArrows}
              </span>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-ink-700/70 bg-ink-950/70 p-4">
              <p className="font-mono text-[11px] uppercase tracking-widest text-mist-500">
                timeline
              </p>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-ink-800">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-brand-300" />
              </div>
              <div className="flex justify-between font-mono text-[11px] text-mist-500">
                <span>00:22.4</span>
                <span>/ 00:36.0</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {demoChapters.map((label, index) => (
                  <span
                    key={label}
                    className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium ${
                      index === 1
                        ? "border-brand-600 bg-brand-500/15 text-brand-100"
                        : "border-ink-700 text-mist-400"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="kbd">Space</span>
                <span className="kbd">←</span>
                <span className="kbd">→</span>
                <span className="kbd">,</span>
                <span className="kbd">.</span>
                <span className="kbd">[ ]</span>
                <span className="ml-auto text-[11px] text-mist-500">
                  {t.homeDemoKeysHint}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-mist-400">
              {t.homeDemoNote}
            </p>
          </Reveal>
        </div>
      </section>

      <div className="pb-4">
        <SetupCallout />
      </div>

      <section className="panel mt-4 overflow-hidden py-5">
        <Marquee duration={38}>
          {topics.map((topic) => (
            <span key={topic} className="whitespace-nowrap text-sm font-medium text-mist-400">
              <span className="mr-10 text-brand-400">◆</span>
              {topic}
            </span>
          ))}
        </Marquee>
      </section>

      {/* features */}
      <section id="features" className="py-20">
        <Reveal>
          <span className="chip">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-300" />{" "}
            {t.homeFeaturesChip}
          </span>
          <SplitHeading
            key={t.homeFeaturesTitle}
            as="h2"
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl"
          >
            {t.homeFeaturesTitle}
          </SplitHeading>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.08} className="panel p-6">
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border ${
                  feature.tone === "brand"
                    ? "border-brand-700 bg-brand-500/10 text-brand-300"
                    : feature.tone === "gold"
                      ? "border-gold-600 bg-gold-500/10 text-gold-300"
                      : "border-ember-500/60 bg-ember-500/10 text-ember-400"
                }`}
              >
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-mist-50">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-mist-300">
                {feature.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* stack */}
      <section id="stack" className="pb-20">
        <Reveal>
          <span className="chip">
            <Boxes className="h-3.5 w-3.5 text-gold-300" /> {t.homeStackChip}
          </span>
          <SplitHeading
            key={t.homeStackTitle}
            as="h2"
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl"
          >
            {t.homeStackTitle}
          </SplitHeading>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {stack.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 0.08}
              className="panel-tight relative overflow-hidden p-6"
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.tint} to-transparent`}
              />
              <item.icon className="relative h-5 w-5 text-mist-100" />
              <h3 className="relative mt-3.5 font-semibold text-mist-50">
                {item.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-mist-300">
                {item.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* cta */}
      <section className="pb-24">
        <Reveal className="panel relative overflow-hidden p-8 sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 animate-breathe bg-[radial-gradient(30rem_22rem_at_18%_20%,rgba(36,189,172,0.22),transparent_62%),radial-gradient(24rem_20rem_at_86%_78%,rgba(246,185,59,0.18),transparent_60%)]"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-mist-50 sm:text-3xl">
                {t.homeCtaTitle}
              </h2>
              <ol className="mt-4 space-y-2 text-sm text-mist-300">
                <li>
                  <span className="font-mono text-brand-200">1.</span>{" "}
                  {t.homeCtaStep1Lead}{" "}
                  <Link href="/setup" className="text-gold-200 underline">
                    /setup
                  </Link>{" "}
                  {t.homeCtaStep1Tail}
                </li>
                <li>
                  <span className="font-mono text-brand-200">2.</span>{" "}
                  {t.homeCtaStep2Lead}{" "}
                  <Link href="/studio" className="text-gold-200 underline">
                    /studio
                  </Link>{" "}
                  {t.homeCtaStep2Tail}{" "}
                  <Link href="/lesson" className="text-gold-200 underline">
                    {t.homeCtaPlayerLink}
                  </Link>{" "}
                  {t.homeCtaStep2End}
                </li>
              </ol>
            </div>
            <Magnetic className="shrink-0">
              <Link href="/lesson" className="btn-gold px-6 py-3.5 text-base">
                {t.homeCtaButton} <ArrowRight className="h-4 w-4" />
              </Link>
            </Magnetic>
          </div>
        </Reveal>
      </section>
    </div>
  );
}