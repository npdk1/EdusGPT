"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, Menu, CirclePlay, Sparkles, X } from "lucide-react";
import { AiKeyBadge } from "./AiKeyBadge";

const NAV = [
  { href: "/", label: "Tổng quan" },
  { href: "/lesson", label: "Trình phát" },
  { href: "/studio", label: "Studio AI" },
  { href: "/library", label: "Thư viện" },
  { href: "/setup", label: "Cài đặt" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Logo EdusGPT"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl object-cover"
          />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-mist-50">
              EdusGPT
            </span>
            <span className="block text-[11px] font-medium tracking-wide text-mist-400">
              trình phát bài giảng
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-ink-800 text-brand-200"
                    : "text-mist-300 hover:bg-ink-850 hover:text-mist-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <AiKeyBadge />
          </div>
          <Link href="/studio" className="btn-primary hidden lg:inline-flex">
            <Sparkles className="h-4 w-4" /> Sinh bài giảng
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label="Mở menu"
            aria-expanded={open}
            className="btn-icon md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
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
                {item.label}
                {item.href === "/setup" ? (
                  <KeyRound className="h-4 w-4 text-gold-300" />
                ) : (
                  <CirclePlay className="h-4 w-4 text-brand-300" />
                )}
              </Link>
            ))}
          </div>
          <div className="mt-3 sm:hidden">
            <AiKeyBadge compact />
          </div>
        </div>
      ) : null}
    </header>
  );
}
