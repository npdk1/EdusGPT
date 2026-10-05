"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconMenu2, IconPlayerPlay, IconSparkles, IconX, IconHome, IconLibrary, IconSettings } from "@tabler/icons-react";
import { AiKeyBadge } from "./AiKeyBadge";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    tagline: "lesson player",
    navOverview: "Overview",
    navLesson: "Lesson player",
    navStudio: "AI Studio",
    navLibrary: "Library",
    navSetup: "Settings",
    ctaGenerate: "Generate a lesson",
    openMenu: "Open menu",
  },
  vi: {
    tagline: "trình phát bài giảng",
    navOverview: "Tổng quan",
    navLesson: "Trình phát",
    navStudio: "Studio AI",
    navLibrary: "Thư viện",
    navSetup: "Cài đặt",
    ctaGenerate: "Sinh bài giảng",
    openMenu: "Mở menu",
  },
};

type CopyKey = keyof typeof COPY.en;

const NAV: { href: string; label: CopyKey; Icon: typeof IconHome }[] = [
  { href: "/", label: "navOverview", Icon: IconHome },
  { href: "/lesson", label: "navLesson", Icon: IconPlayerPlay },
  { href: "/studio", label: "navStudio", Icon: IconSparkles },
  { href: "/library", label: "navLibrary", Icon: IconLibrary },
  { href: "/setup", label: "navSetup", Icon: IconSettings },
];

export function SiteHeader() {
  const t = useCopy(COPY);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-md">
      {/* No max width and no wrapping: this bar holds six items that each read
          as one line, and a wrapped "Generate a lesson" is what made it look
          broken. Narrow windows hide items instead (nav, badge, CTA). */}
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo EdusGPT"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-cover"
          />
          <span className="whitespace-nowrap leading-tight">
            <span className="block text-sm font-bold tracking-tight text-mist-50">
              EdusGPT
            </span>
            <span className="block text-[11px] font-medium tracking-wide text-mist-400">
              {t.tagline}
            </span>
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-ink-800 text-brand-200"
                    : "text-mist-300 hover:bg-ink-850 hover:text-mist-100"
                }`}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                {t[item.label]}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden shrink-0 lg:block">
            <LocaleSwitcher />
          </div>
          <div className="hidden shrink-0 sm:block">
            <AiKeyBadge />
          </div>
          <Link href="/studio" className="btn-primary hidden whitespace-nowrap lg:inline-flex">
            <IconSparkles className="h-4 w-4" /> {t.ctaGenerate}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={t.openMenu}
            aria-expanded={open}
            className="btn-icon md:hidden"
          >
            {open ? <IconX className="h-4 w-4" /> : <IconMenu2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-ink-800 bg-ink-950/95 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-mist-200 hover:bg-ink-850"
              >
                {t[item.label]}
                <item.Icon className="h-4 w-4 text-brand-300" />
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 sm:hidden">
            <LocaleSwitcher compact />
            <AiKeyBadge compact />
          </div>
        </div>
      ) : null}
    </header>
  );
}
