"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Boxes,
  CheckCircle2,
  CirclePlay,
  Cpu,
  Flame,
  Gauge,
  GraduationCap,
  HelpCircle,
  KeyRound,
  Layers,
  MousePointerClick,
  Repeat,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Trophy,
  WandSparkles,
  X,
} from "lucide-react";
import { SceneLoader3D } from "@/components/three/SceneLoader3D";
import { Marquee } from "@/components/motion/Interactive";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedNumber, SplitHeading } from "@/components/motion/SplitHeading";
import { SetupCallout } from "@/components/site/AiKeyBadge";
import { useCopy, useLang } from "@/i18n/provider";
import { useTutorial } from "@/components/tutorial/TutorialContext";

const COPY = {
  en: {
    homeChipLocal: "Smart Interactive Learning",
    homeTitle: "Interactive AI lessons you can scrub second by second",
    homeLead:
      "Transform any study topic into an interactive multimedia lesson: scrub forward and back with precision, loop difficult concepts, listen to expressive voice narration with karaoke subtitles, and get answers from your 1-on-1 AI tutor anytime.",
    homeCtaPlayer: "Open Lesson Player",
    homeCtaKey: "AI Setup",
    homeCtaStudio: "Create New Lesson",
    homeStatFpsSuffix: "%",
    homeStatFpsLabel: "interactive multimedia lessons",
    homeStatSamplesLabel: "1-on-1 AI tutor ready 24/7",
    homeStatBytesSuffix: " free",
    homeStatBytesLabel: "100% free on your device",
    homeDragChip: "drag to scrub",
    homeDemoArrows: "◀◀ back · ▶▶ forward",
    homeDemoChapter1: "chapter 1",
    homeDemoChapter2: "chapter 2",
    homeDemoChapter3: "chapter 3",
    homeDemoKeysHint: "loop a hard passage with A→B",
    homeDemoNote:
      "The timeline lives right in the browser, so you can scrub back and forth freely before presenting, and review a moment without rendering anything in advance.",
    homeRobotLabel: "Your AI tutor, on every slide",
    homeFeaturesChip: "interactive learning",
    homeFeaturesTitle: "Designed for active learning, deep understanding, and long retention",
    homeFeatureSeekTitle: "Video Lessons & Precision Scrubbing",
    homeFeatureSeekBody:
      "Turn any study topic into an interactive video lesson. Scrub second-by-second and loop difficult moments (A→B) until you truly master the concept.",
    homeFeatureLayersTitle: "24/7 1-on-1 AI Tutor",
    homeFeatureLayersBody:
      "Confused by a formula or concept? Chat with your AI tutor directly alongside the lesson. Get clear explanations, visual examples, and step-by-step guidance at your own pace.",
    homeFeatureKeyTitle: "Smart In-Lesson Quizzes",
    homeFeatureKeyBody:
      "Reinforce your knowledge immediately after each topic with interactive quizzes, instant scoring, and detailed explanations for every answer.",
    homeStackChip: "study habits & motivation",
    homeStackTitle: "Build daily study habits and level up your knowledge",
    homeStackPaletteTitle: "Study Streak & Level Progression",
    homeStackPaletteBody:
      "Earn XP with every completed lesson, keep your daily study streak glowing, and build lasting study habits to reach your personal learning goals.",
    homeStackWayfindingTitle: "3D Interactive Flashcards",
    homeStackWayfindingBody:
      "Flip through 3D flashcards covering core formulas, keywords, and definitions. Quick-fire reviews make exam preparation effortless and fast.",
    homeStackLocalTitle: "Create Custom Lessons (AI Studio)",
    homeStackLocalBody:
      "Enter any topic, syllabus, or paste your study notes — AI Studio generates a full multimedia lesson complete with slides and quizzes in seconds.",
    homeTopicNewton: "Newton's second law",
    homeTopicOverfitting: "Overfitting in Machine Learning",
    homeTopicDerivative: "Derivative by definition",
    homeTopicForLoop: "For loop & Algorithms",
    homeTopicPresentPerfect: "Present perfect tense",
    homeTopicEquilibrium: "Chemical equilibrium",
    homeTopicQuadratic: "Quadratic function & Graphs",
    homeTopicPhotosynthesis: "Photosynthesis in plants",
    homeCtaTitle: "Ready to level up your learning?",
    homeCtaStep1Lead: "Explore",
    homeCtaStep1Tail: "dozens of interactive lessons ready in the Lesson Library.",
    homeCtaStep2Lead: "Or open",
    homeCtaStep2Tail: "to generate a custom interactive lesson on any subject you want to master.",
    homeCtaPlayerLink: "AI Studio (/studio)",
    homeCtaStep2End: "",
    homeCtaButton: "Explore Lesson Library",
    welcomeTitle: "Welcome to EdusGPT",
    welcomeLead: "The next-generation interactive AI lesson studio. Video slides, 24/7 AI tutor, and interactive quizzes ready on your device.",
    welcomeDontShow: "Do not show Overview next time (Go straight to Library on startup)",
    welcomeGoLibrary: "Open Lesson Library",
    welcomeExplore: "Explore Overview",
  },
  vi: {
    homeChipLocal: "Học tập tương tác thông minh",
    homeTitle: "Bài giảng AI tương tác & Học tập chủ động",
    homeLead:
      "Biến mọi chủ đề học tập thành bài giảng video sinh động: tua tới lui mượt mà từng giây, lặp đoạn khó hiểu, kèm giọng đọc truyền cảm, phụ đề karaoke chạy theo từng chữ và trợ giảng AI đồng hành giải đáp 24/7.",
    homeCtaPlayer: "Mở trình phát bài giảng",
    homeCtaKey: "Cài đặt AI",
    homeCtaStudio: "Tạo bài giảng mới",
    homeStatFpsSuffix: "%",
    homeStatFpsLabel: "bài học trực quan & tương tác",
    homeStatSamplesLabel: "trợ giảng AI sẵn sàng 24/7",
    homeStatBytesSuffix: "đ",
    homeStatBytesLabel: "hoàn toàn miễn phí trên máy bạn",
    homeDragChip: "kéo để tua",
    homeDemoArrows: "◀◀ tua lui · ▶▶ tua tới",
    homeDemoChapter1: "chương 1",
    homeDemoChapter2: "chương 2",
    homeDemoChapter3: "chương 3",
    homeDemoKeysHint: "lặp đoạn khó bằng A→B",
    homeDemoNote:
      "Timeline sống ngay trong trình duyệt nên bạn tua tới lui thoải mái trước khi trình chiếu, xem lại ngay mà không cần render trước.",
    homeRobotLabel: "Trợ giảng AI, có mặt mọi slide",
    homeFeaturesChip: "trải nghiệm học tập",
    homeFeaturesTitle: "Học tập chủ động, hiểu sâu bản chất và ghi nhớ lâu hơn",
    homeFeatureSeekTitle: "Bài giảng Video & Tua mượt từng giây",
    homeFeatureSeekBody:
      "Biến mọi chủ đề hay tài liệu thành bài giảng video sinh động. Tua mượt từng giây, lặp đoạn khó hiểu (A→B) để nắm trọn kiến thức mà không sợ bỏ sót.",
    homeFeatureLayersTitle: "Trợ giảng AI 1-1 đồng hành 24/7",
    homeFeatureLayersBody:
      "Chưa hiểu một công thức hay khái niệm trên slide? Nhắn hỏi ngay bên cạnh bài giảng, gia sư AI sẽ giải thích cặn kẽ, đưa ví dụ sinh động và hướng dẫn từng bước.",
    homeFeatureKeyTitle: "Trắc nghiệm Quiz củng cố tức thì",
    homeFeatureKeyBody:
      "Kiểm tra mức độ hiểu bài ngay sau mỗi phần học với các câu trắc nghiệm thông minh, có chấm điểm tự động và lời giải thích chi tiết cho từng phương án.",
    homeStackChip: "động lực & tự học",
    homeStackTitle: "Duy trì thói quen học và bứt phá thành tích",
    homeStackPaletteTitle: "Chuỗi học tập (Streak) & Thăng cấp",
    homeStackPaletteBody:
      "Tích lũy điểm kinh nghiệm (XP) sau mỗi bài học, thắp sáng ngọn lửa Streak mỗi ngày để xây dựng thói quen tự giác và bứt phá mục tiêu cá nhân.",
    homeStackWayfindingTitle: "Thẻ ghi nhớ Flashcard 3D lật mở",
    homeStackWayfindingBody:
      "Lật mở các thẻ công thức, thuật ngữ và định nghĩa trọng tâm theo hiệu ứng 3D trực quan. Ôn tập phản xạ nhanh, nhớ sâu hơn trước mỗi kỳ thi.",
    homeStackLocalTitle: "Tự tạo bài học theo ý muốn (AI Studio)",
    homeStackLocalBody:
      "Nhập bất kỳ chủ đề, đề cương môn học hay dán tài liệu ôn thi — AI Studio sẽ tự động tạo bài giảng đa phương tiện hoàn chỉnh kèm trắc nghiệm chỉ sau vài giây.",
    homeTopicNewton: "Định luật II Newton",
    homeTopicOverfitting: "Hiện tượng Overfitting (ML)",
    homeTopicDerivative: "Đạo hàm theo định nghĩa",
    homeTopicForLoop: "Vòng lặp for & Thuật toán",
    homeTopicPresentPerfect: "Thì hiện tại hoàn thành",
    homeTopicEquilibrium: "Cân bằng phản ứng hoá học",
    homeTopicQuadratic: "Hàm số bậc hai & Đồ thị",
    homeTopicPhotosynthesis: "Quang hợp ở thực vật",
    homeCtaTitle: "Sẵn sàng bứt phá việc học của bạn?",
    homeCtaStep1Lead: "Khám phá",
    homeCtaStep1Tail: "hàng chục bài giảng sinh động có sẵn trong Thư viện bài giảng.",
    homeCtaStep2Lead: "Hoặc vào",
    homeCtaStep2Tail: "để tự tạo bài giảng riêng cho bất kỳ chủ đề nào bạn muốn chinh phục.",
    homeCtaPlayerLink: "Soạn bài AI (/studio)",
    homeCtaStep2End: "",
    homeCtaButton: "Vào Thư viện học ngay",
    welcomeTitle: "Chào mừng bạn đến với EdusGPT",
    welcomeLead: "Nền tảng bài giảng AI tương tác thông minh với Trợ giảng AI 24/7 và hệ thống trình phát timeline mượt mà.",
    welcomeDontShow: "Không xuất hiện lần sau (Mặc định vào thẳng Thư viện bài giảng)",
    welcomeGoLibrary: "Vào Thư viện bài giảng",
    welcomeExplore: "Xem trang Tổng quan",
  },
};

/** The three cards of the "interactive learning" row; wording lives in COPY above. */
const FEATURES = [
  {
    icon: CirclePlay,
    titleKey: "homeFeatureSeekTitle",
    bodyKey: "homeFeatureSeekBody",
    tone: "brand",
  },
  {
    icon: Bot,
    titleKey: "homeFeatureLayersTitle",
    bodyKey: "homeFeatureLayersBody",
    tone: "gold",
  },
  {
    icon: CheckCircle2,
    titleKey: "homeFeatureKeyTitle",
    bodyKey: "homeFeatureKeyBody",
    tone: "ember",
  },
] as const;

/** The study habits & motivation row. */
const STACK = [
  {
    icon: Flame,
    titleKey: "homeStackPaletteTitle",
    bodyKey: "homeStackPaletteBody",
    tint: "from-amber-500/15",
  },
  {
    icon: Layers,
    titleKey: "homeStackWayfindingTitle",
    bodyKey: "homeStackWayfindingBody",
    tint: "from-brand-500/15",
  },
  {
    icon: GraduationCap,
    titleKey: "homeStackLocalTitle",
    bodyKey: "homeStackLocalBody",
    tint: "from-emerald-500/15",
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
  const lang = useLang();
  const { startTour } = useTutorial();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceShow = searchParams.get("show") === "1" || searchParams.get("overview") === "true";
  const [showPopup, setShowPopup] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  useEffect(() => {
    if (searchParams.get("popup") === "1") {
      setShowPopup(true);
      return;
    }
    if (forceShow) return;
    const hidePref = localStorage.getItem("edusgpt_hide_overview");
    if (hidePref === "true") {
      router.replace("/library");
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/courses?limit=1", { cache: "no-store" });
        const data = await res.json();
        const hasCourses =
          (data.courses && data.courses.length > 0) || (data.total && data.total > 0);
        const hasVisited = localStorage.getItem("edusgpt_has_visited");
        if (hasCourses && hasVisited) {
          router.replace("/library");
        } else {
          localStorage.setItem("edusgpt_has_visited", "true");
          setShowPopup(true);
        }
      } catch {
        setShowPopup(true);
      }
    })();
  }, [forceShow, router]);

  const handleGoLibrary = () => {
    if (dontShowAgain) {
      localStorage.setItem("edusgpt_hide_overview", "true");
    }
    router.push("/library");
  };

  const handleClosePopup = () => {
    if (dontShowAgain) {
      localStorage.setItem("edusgpt_hide_overview", "true");
    }
    setShowPopup(false);
  };

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
    { value: 100, suffix: t.homeStatFpsSuffix, label: t.homeStatFpsLabel },
    { value: 24, suffix: "/7", label: t.homeStatSamplesLabel },
    { value: 0, suffix: t.homeStatBytesSuffix, label: t.homeStatBytesLabel },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* hero */}
      <section className="relative -mx-4 overflow-hidden px-4 pt-14 sm:-mx-6 sm:px-6 lg:pt-20">
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
              <Link href="/lesson" className="btn-primary px-5 py-3">
                <CirclePlay className="h-4 w-4" /> {t.homeCtaPlayer}
              </Link>
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
              <button
                type="button"
                data-tour="tutorial-btn"
                onClick={() => startTour()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-600 dark:text-amber-300 shadow-sm transition-all hover:bg-amber-500/20 hover:border-amber-400 active:scale-95"
                title={lang === "vi" ? "Xem hướng dẫn sử dụng tương tác (1 phút)" : "Watch Interactive Tutorial (1 min)"}
              >
                <HelpCircle className="h-4 w-4 text-amber-400" />
                <span>{lang === "vi" ? "Hướng dẫn 1p" : "Tutorial"}</span>
              </button>
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

          <Reveal className="min-w-0 space-y-4" y={40}>
            {/* The same tutor robot that waits while a lesson is written —
                normal flow, its own card, so no text ever covers it. */}
            <SceneLoader3D label={t.homeRobotLabel} progress={100} height={240} />
          <div className="panel relative p-5 lg:p-6">
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
          </div>
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
            <Flame className="h-3.5 w-3.5 text-amber-400" /> {t.homeStackChip}
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
              <ol className="mt-4 space-y-2.5 text-sm text-mist-300">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 font-mono text-xs font-bold text-brand-300">1</span>
                  <span>
                    {t.homeCtaStep1Lead}{" "}
                    <Link href="/library" className="font-semibold text-brand-300 hover:underline">
                      {lang === "vi" ? "Thư viện bài giảng" : "Lesson Library"}
                    </Link>{" "}
                    {t.homeCtaStep1Tail}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-500/20 font-mono text-xs font-bold text-gold-300">2</span>
                  <span>
                    {t.homeCtaStep2Lead}{" "}
                    <Link href="/studio" className="font-semibold text-gold-300 hover:underline">
                      {t.homeCtaPlayerLink}
                    </Link>{" "}
                    {t.homeCtaStep2Tail}
                  </span>
                </li>
              </ol>
            </div>
            <div className="shrink-0">
              <Link href="/library" className="btn-gold px-6 py-3.5 text-base shadow-lg shadow-gold-500/10">
                {t.homeCtaButton} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Welcome / Overview Popup Modal */}
      {showPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="panel relative w-full max-w-md p-6 shadow-2xl border border-ink-700 bg-ink-950 text-mist-50 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={handleClosePopup}
              className="btn-icon absolute right-4 top-4"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <img
                src="/logo.png"
                alt="EdusGPT Logo"
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-2xl object-cover shadow-lg border border-ink-700/60"
              />
              <div>
                <h3 className="text-lg font-bold tracking-tight text-mist-50">
                  {t.welcomeTitle}
                </h3>
                <p className="text-xs text-mist-400">EdusGPT · AI Lesson Studio</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-mist-200 mb-5">
              {t.welcomeLead}
            </p>

            <label className="flex items-start gap-3 rounded-xl border border-ink-800 bg-ink-900/60 p-3 text-xs text-mist-300 cursor-pointer hover:bg-ink-900 transition-colors mb-6">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-ink-600 text-brand-500 focus:ring-brand-500/30"
              />
              <span className="leading-snug">{t.welcomeDontShow}</span>
            </label>

            <button
              type="button"
              onClick={() => {
                handleClosePopup();
                startTour();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-500 dark:text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all mb-3"
            >
              <HelpCircle className="h-4 w-4 text-amber-400" />
              <span>{lang === "vi" ? "Xem hướng dẫn cơ bản (1 phút)" : "Watch Quick Tutorial (1 min)"}</span>
            </button>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleClosePopup}
                className="btn-ghost flex-1 py-2.5 text-xs font-semibold justify-center"
              >
                {t.welcomeExplore}
              </button>
              <button
                type="button"
                onClick={handleGoLibrary}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-ember-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <BookOpen className="h-4 w-4" />
                {t.welcomeGoLibrary}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}