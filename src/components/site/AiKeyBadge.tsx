"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconCircleCheck, IconCpu, IconSparkles } from "@tabler/icons-react";
import { useCopy } from "@/i18n/provider";
import type { PublicAiStatus } from "@/lib/ai/config";

const COPY = {
  en: {
    checkingAgent: "Checking agent…",
    checkingKey: "Checking key…",
    missingAgentShort: "No CLI agent",
    missingAgent: "No CLI agent installed: open settings",
    missingKeyShort: "No AI key",
    missingKey: "No AI key yet: open settings",
    agentLocal: "agent runs on your machine",
    keyFromEnv: "from an environment variable",
    keyFromFile: "from .env",
    calloutTitle: "Turn on the AI assistant",
    calloutAgentBody:
      "Install the CLI agent on your machine, or paste an API key from another provider. The key only ever lives in .env — it is sent nowhere else.",
    calloutKeyBody:
      "Paste your API key on the settings page, which runs on your machine. The key only ever lives in .env — it is sent nowhere else.",
    calloutButton: "Open settings",
  },
  vi: {
    checkingAgent: "đang kiểm tra agent…",
    checkingKey: "đang kiểm tra key…",
    missingAgentShort: "Chưa có agent CLI",
    missingAgent: "Chưa cài agent CLI: mở trang cài đặt",
    missingKeyShort: "Thiếu AI key",
    missingKey: "Chưa có AI key: mở trang cài đặt",
    agentLocal: "agent chạy trên máy bạn",
    keyFromEnv: "từ biến môi trường",
    keyFromFile: "từ .env",
    calloutTitle: "Bật trợ lý AI",
    calloutAgentBody:
      "Cài agent CLI trên máy bạn, hoặc dán API key của nhà cung cấp khác. Key chỉ nằm trong .env, không gửi tới đâu khác.",
    calloutKeyBody:
      "Dán API key của bạn vào trang cài đặt chạy trên máy bạn. Key chỉ nằm trong .env, không gửi tới đâu khác.",
    calloutButton: "Mở trang cài đặt",
  },
};

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
  const t = useCopy(COPY);
  const { status, loading } = useAiStatus();

  if (loading) {
    return (
      <span className="chip animate-pulse-dot">
        <IconCpu className="h-3.5 w-3.5" />
        {status?.providerKind === "cli" ? t.checkingAgent : t.checkingKey}
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
        className="chip whitespace-nowrap border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 transition-colors hover:border-amber-500 hover:bg-amber-500/20"
      >
        <IconAlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        {isCli
          ? compact
            ? t.missingAgentShort
            : t.missingAgent
          : compact
            ? t.missingKeyShort
            : t.missingKey}
      </Link>
    );
  }

  const title = isCli
    ? `${status.providerLabel} ${status.cli?.version ?? ""} · ${t.agentLocal}`.trim()
    : `${status.model} · ${status.keySource === "env" ? t.keyFromEnv : t.keyFromFile}`;

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
      className="chip whitespace-nowrap border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 transition-colors hover:border-emerald-500 hover:bg-emerald-500/20"
      title={title}
    >
      <IconCircleCheck className="h-3.5 w-3.5 text-emerald-500" />
      {text}
    </Link>
  );
}

/** First-run banner shown on the landing page while no key is configured. */
export function SetupCallout() {
  const t = useCopy(COPY);
  const { status, loading } = useAiStatus();
  if (loading || status?.configured) return null;

  return (
    <div className="panel flex flex-col gap-4 border-gold-500/40 bg-gold-500/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <IconSparkles className="mt-0.5 h-5 w-5 shrink-0 text-gold-300" />
        <div>
          <p className="font-semibold text-mist-50">{t.calloutTitle}</p>
          <p className="mt-1 text-sm text-mist-300">
            {status?.providerKind === "cli"
              ? t.calloutAgentBody
              : t.calloutKeyBody}
          </p>
        </div>
      </div>
      <Link href="/setup" className="btn-gold shrink-0">
        {t.calloutButton}
      </Link>
    </div>
  );
}
