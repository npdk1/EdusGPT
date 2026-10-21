"use client";

import { useState, type ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";

interface CollapsibleCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = true,
  className = "",
  headerClassName = "",
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-xl border border-ink-700 bg-ink-950/50 transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-ink-900/40 rounded-xl ${headerClassName}`}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <span className="text-brand-300 shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-mist-100">{title}</span>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-mist-400 leading-relaxed truncate">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg border border-ink-700 bg-ink-900/60 text-mist-400 transition-transform duration-200 ${
              open ? "rotate-0 text-mist-200" : "-rotate-90 text-mist-500"
            }`}
          >
            <IconChevronDown className="h-4 w-4" />
          </span>
        </div>
      </button>

      {open ? (
        <div className="border-t border-ink-800/80 px-4 pb-4 pt-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
