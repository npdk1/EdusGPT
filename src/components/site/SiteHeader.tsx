"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconMenu2,
  IconPlayerPlay,
  IconSparkles,
  IconHome,
  IconLibrary,
  IconSettings,
  IconSun,
  IconMoon,
} from "@tabler/icons-react";
import { AiKeyBadge } from "./AiKeyBadge";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useTheme } from "./ThemeProvider";
import { Flame, HelpCircle } from "lucide-react";
import { useCopy, useLang } from "@/i18n/provider";
import { getActiveLessonId } from "@/lib/lesson/storage";
import { getStudentProfile, type StudentProfile, STUDENT_PROFILE_CHANGED_EVENT } from "@/lib/student/profile";
import { StudentProgressModal } from "@/components/student/StudentProgressModal";
import { useTutorial } from "@/components/tutorial/TutorialContext";

const COPY = {
  en: {
    tagline: "lesson player",
    navOverview: "Overview",
    navLesson: "Lesson player",
    navStudio: "Create Lesson",
    navLibrary: "Library",
    navSetup: "Settings",
    ctaGenerate: "Create lesson",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  vi: {
    tagline: "trình phát bài giảng",
    navOverview: "Tổng quan",
    navLesson: "Trình phát",
    navStudio: "Tạo Bài Giảng",
    navLibrary: "Thư viện",
    navSetup: "Cài đặt",
    ctaGenerate: "Tạo bài giảng",
    openMenu: "Mở menu",
    closeMenu: "Đóng menu",
  },
};

type CopyKey = keyof typeof COPY.en;

const NAV: { href: string; label: CopyKey; Icon: typeof IconHome }[] = [
  { href: "/?overview=true", label: "navOverview", Icon: IconHome },
  { href: "/lesson", label: "navLesson", Icon: IconPlayerPlay },
  { href: "/studio", label: "navStudio", Icon: IconSparkles },
  { href: "/library", label: "navLibrary", Icon: IconLibrary },
  { href: "/setup", label: "navSetup", Icon: IconSettings },
];

export function SiteHeader() {
  const t = useCopy(COPY);
  const lang = useLang();
  const { startTour } = useTutorial();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeLessonHref, setActiveLessonHref] = useState("/lesson");
  const [mounted, setMounted] = useState(false);
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(getStudentProfile());
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
    setStudentProfile(getStudentProfile());
    const handleProfileChange = () => setStudentProfile(getStudentProfile());
    window.addEventListener(STUDENT_PROFILE_CHANGED_EVENT, handleProfileChange);
    return () => window.removeEventListener(STUDENT_PROFILE_CHANGED_EVENT, handleProfileChange);
  }, []);

  // Keep track of active lesson to preserve currently watched lesson when clicking "Trình phát"
  useEffect(() => {
    const activeId = getActiveLessonId();
    if (activeId) {
      setActiveLessonHref(`/lesson?c=${encodeURIComponent(activeId)}`);
    } else {
      setActiveLessonHref("/lesson");
    }
  }, [pathname]);

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    if (drawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-ink-800/80 bg-ink-950/95 backdrop-blur-xl shadow-xs transition-all">
        <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-5">
          {/* Left: Hamburger Menu Button + EdusGPT Brand Logo (YouTube style) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={t.openMenu}
              aria-expanded={drawerOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-mist-200 transition-colors hover:bg-ink-800 hover:text-mist-50 active:scale-95"
            >
              <IconMenu2 className="h-5 w-5" />
            </button>

            <Link
              href="/library"
              data-tour="logo"
              className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]"
            >
              <img
                src="/logo.png"
                alt="Logo EdusGPT"
                width={34}
                height={34}
                className="h-8.5 w-8.5 rounded-xl object-cover shadow-sm ring-1 ring-ink-700/60"
              />
              <span className="flex items-center gap-1.5 leading-tight">
                <span className="text-base font-extrabold tracking-tight text-mist-50 sm:text-lg">
                  EdusGPT
                </span>
                <span className="rounded bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  AI
                </span>
              </span>
            </Link>
          </div>

          {/* Right: Streak & Level, Quick CTA, AiKeyBadge, Locale */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {/* Student Gamification: Streak & Level */}
            <button
              type="button"
              data-tour="streak"
              onClick={() => setProgressModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-sm transition-all hover:bg-amber-500/20 hover:scale-105 active:scale-95"
              title={lang === "vi" ? "Chuỗi ngày học tập & Thành tích cá nhân" : "Learning Streak & Achievements"}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20" />
              <span suppressHydrationWarning>{mounted ? studentProfile.streak : 1}</span>
              <span className="hidden lg:inline text-[10px] text-amber-400/80 font-semibold" suppressHydrationWarning>
                · {lang === "vi" ? `Cấp ${mounted ? studentProfile.level : 1}` : `Lvl ${mounted ? studentProfile.level : 1}`}
              </span>
            </button>

            <div className="hidden sm:block">
              <AiKeyBadge compact />
            </div>
            <div className="hidden md:block">
              <LocaleSwitcher />
            </div>

            {/* Quick Dark/Light Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-800 bg-ink-850/80 text-mist-200 transition-colors hover:border-brand-500 hover:text-brand-500 active:scale-95"
              aria-label={theme === "dark" ? "Chuyển sang giao diện Sáng" : "Chuyển sang giao diện Tối"}
              title={theme === "dark" ? "Giao diện Sáng (Light mode)" : "Giao diện Tối (Dark mode)"}
            >
              {theme === "dark" ? (
                <IconSun className="h-4 w-4 text-amber-400" />
              ) : (
                <IconMoon className="h-4 w-4 text-sky-600" />
              )}
            </button>

            <Link
              href="/studio"
              data-tour="header-cta"
              className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-ember-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all hover:brightness-110 active:scale-95 sm:inline-flex"
            >
              <IconSparkles className="h-3.5 w-3.5" />
              <span>{t.ctaGenerate}</span>
            </Link>
          </div>
        </div>
      </header>

      <StudentProgressModal
        open={progressModalOpen}
        onClose={() => setProgressModalOpen(false)}
      />

      {/* YouTube-style Navigation Drawer (Slide-over from Left) */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-ink-800/90 bg-ink-950 p-3 shadow-2xl transition-transform">
            {/* Drawer Header */}
            <div className="flex h-12 items-center gap-3 border-b border-ink-800/60 px-2 pb-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t.closeMenu}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-mist-300 transition-colors hover:bg-ink-800 hover:text-mist-50"
              >
                <IconMenu2 className="h-5 w-5" />
              </button>
              <Link
                href="/library"
                className="flex items-center gap-2"
                onClick={() => setDrawerOpen(false)}
              >
                <img
                  src="/logo.png"
                  alt="EdusGPT Logo"
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-lg object-cover"
                />
                <span className="text-base font-bold tracking-tight text-mist-50">
                  EdusGPT
                </span>
              </Link>
            </div>

            {/* Navigation List - YouTube Style */}
            <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-1 py-1">
              {NAV.map((item) => {
                const isLesson = item.href === "/lesson";
                const targetHref = isLesson ? activeLessonHref : item.href;
                const active =
                  item.href.startsWith("/?") || item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={targetHref}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-4 rounded-xl px-3.5 py-3 text-sm font-medium transition-all ${
                      active
                        ? "bg-brand-500/15 font-semibold text-brand-200 shadow-xs"
                        : "text-mist-200 hover:bg-ink-850 hover:text-mist-50"
                    }`}
                  >
                    <item.Icon
                      className={`h-5 w-5 shrink-0 ${
                        active ? "text-brand-300" : "text-mist-400"
                      }`}
                    />
                    <span className="flex-1">{t[item.label]}</span>
                    {active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            {/* Tutorial Walkthrough in Drawer */}
            <div className="px-1 pt-2 pb-2">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  startTour();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 transition-all hover:bg-amber-500/20 active:scale-95"
              >
                <HelpCircle className="h-4 w-4 text-amber-400" />
                <span className="flex-1 text-left">
                  {lang === "vi" ? "Hướng dẫn sử dụng (Tutorial)" : "Tutorial Walkthrough"}
                </span>
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold">1 min</span>
              </button>
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-ink-800/80 px-2 pt-3 pb-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist-400">{lang === "vi" ? "Giao diện" : "Theme"}</span>
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-800 bg-ink-850 px-2.5 py-1 text-xs font-medium text-mist-200 hover:border-brand-500"
                >
                  {theme === "dark" ? (
                    <>
                      <IconSun className="h-3.5 w-3.5 text-amber-400" />
                      <span>{lang === "vi" ? "Sáng" : "Light"}</span>
                    </>
                  ) : (
                    <>
                      <IconMoon className="h-3.5 w-3.5 text-sky-600" />
                      <span>{lang === "vi" ? "Tối" : "Dark"}</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist-400">{lang === "vi" ? "Ngôn ngữ" : "Language"}</span>
                <LocaleSwitcher compact />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-mist-400">{lang === "vi" ? "Khóa API" : "API Key"}</span>
                <AiKeyBadge compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
