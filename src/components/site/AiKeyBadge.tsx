"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert, CircleCheck, Cpu, Sparkles } from "lucide-react";
import type { PublicAiStatus } from "@/lib/ai/config";

/**
 * The always-visible entry point to /setup. It polls nothing: it fetches once
 * on mount and exposes a helper hook so other pages can reuse the status.
 */
export function useAiStatus() {
  const [status, setStatus] = useState<PublicAiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ai: PublicAiStatus }) => {
        if (!cancelled) setStatus(payload.ai);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { status, loading, setStatus };
}

export function AiKeyBadge({ compact = false }: { compact?: boolean }) {
  const { status, loading } = useAiStatus();

  if (loading) {
    return (
      <span className="chip animate-pulse-dot">
        <Cpu className="h-3.5 w-3.5" />
        {status?.providerKind === "cli" ? "đang kiểm tra agent…" : "đang kiểm tra key…"}
      </span>
    );
  }

  // A CLI provider is configured by having its binary on PATH. Telling that user
  // "Thiếu AI key" sends them to paste a key that would do nothing.
  const isCli = status?.providerKind === "cli";

  if (!status?.configured) {
    return (
      <Link
        href="/setup"
        className="chip border-gold-500/60 bg-gold-500/10 text-gold-200 transition-colors hover:border-gold-400 hover:text-gold-100"
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        {isCli
          ? compact
            ? "Chưa có agent CLI"
            : "Chưa cài agent CLI: mở trang cài đặt"
          : compact
            ? "Thiếu AI key"
            : "Chưa có AI key: mở trang cài đặt"}
      </Link>
    );
  }

  const title = isCli
    ? `${status.providerLabel} ${status.cli?.version ?? ""} · agent chạy trên máy bạn`.trim()
    : `${status.model} · ${status.keySource === "env" ? "từ biến môi trường" : "từ .env"}`;

  // `keyHint` is null for a CLI provider — there is no secret — so appending it
  // would leave a dangling "·" on the chip.
  const text = isCli
    ? `${status.providerLabel}${compact ? "" : ` · ${status.model}`}`
    : compact
      ? status.model
      : `${status.model} · ${status.keyHint}`;

  return (
    <Link
      href="/setup"
      className="chip border-brand-600/60 bg-brand-500/10 text-brand-200 transition-colors hover:border-brand-400 hover:text-brand-100"
      title={title}
    >
      <CircleCheck className="h-3.5 w-3.5" />
      {text}
    </Link>
  );
}

/** First-run banner shown on the landing page while no key is configured. */
export function SetupCallout() {
  const { status, loading } = useAiStatus();
  if (loading || status?.configured) return null;

  return (
    <div className="panel flex flex-col gap-4 border-gold-500/40 bg-gold-500/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
        <div>
          <p className="font-semibold text-mist-50">Bật trợ lý AI</p>
          <p className="mt-1 text-sm text-mist-300">
            {status?.providerKind === "cli"
              ? "Cài agent CLI trên máy bạn, hoặc dán API key của nhà cung cấp khác. Key chỉ nằm trong .env, không gửi tới đâu khác."
              : "Dán API key của bạn vào trang cài đặt chạy trên máy bạn. Key chỉ nằm trong .env, không gửi tới đâu khác."}
          </p>
        </div>
      </div>
      <Link href="/setup" className="btn-gold shrink-0">
        Mở trang cài đặt
      </Link>
    </div>
  );
}
