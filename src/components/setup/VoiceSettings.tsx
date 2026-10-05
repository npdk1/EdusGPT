"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconCloud,
  IconCpu,
  IconDownload,
  IconLoader2,
  IconTerminal2,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { useCopy } from "@/i18n/provider";

/**
 * Which voice reads the narration: this machine, or a free API.
 *
 * Two engines, because they fail in opposite ways. The local one needs a voice
 * installed and then never fails and never phones home; the cloud one needs
 * nothing installed and then depends on someone else's server staying up. Local
 * is the default because a lesson that is already written should still speak when
 * the network does not, and because the timing data it produces is exact.
 *
 * The panel reports what the machine can actually do rather than offering a
 * radio button that fails later: a teacher who picks "máy này" on a machine with
 * nothing installed is told in the same breath, with the button to fix it.
 */

const COPY = {
  en: {
    heading: "Narration voice",
    lead:
      "The lesson is read aloud by this machine or by a free online voice. Both work offline once a voice is installed; the local one never leaves the computer.",
    localTitle: "This machine (Piper)",
    localNote:
      "Runs on your own GPU or CPU. Nothing is uploaded, nothing is throttled, and the word timings are exact, so the subtitles follow the voice closely.",
    cloudTitle: "Free online voice (Edge)",
    cloudNote:
      "Microsoft's public Edge read-aloud voice. No key, no account — but it needs the network, and it can rate-limit a long lesson.",
    localReady: "Ready",
    localNotReady: "Not ready",
    logTitle: "Install log",
    providersTitle: "Voices on this machine",
    providersNote: "Two engines, both free and both running inside this project's own Python environment. Install one, then pick any of its voices in the studio.",
    providerCount: "{count} voices",
    providerInstall: "Install",
    providerInstalling: "Installing…",
    providerInstalled: "Installed",
    switched: "Switched",
  },
  vi: {
    heading: "Giọng đọc",
    lead:
      "Bài giảng được đọc bởi chính máy này hoặc bởi một giọng miễn phí trên mạng. Cả hai cách đều đọc được khi đã cài giọng; cách máy này không gửi gì ra ngoài.",
    localTitle: "Máy này (Piper)",
    localNote:
      "Chạy trên GPU hoặc CPU của bạn. Không gửi văn bản đi đâu, không bị giới hạn, và có mốc thời gian từng từ chính xác nên phụ đề bám sát giọng đọc.",
    cloudTitle: "Giọng miễn phí trên mạng (Edge)",
    cloudNote:
      "Giọng đọc Edge của Microsoft. Không cần key, không cần tài khoản — nhưng cần mạng, và bài dài có thể bị giới hạn.",
    localReady: "Sẵn sàng",
    localNotReady: "Chưa sẵn sàng",
    logTitle: "Nhật ký cài đặt",
    providersTitle: "Giọng có trên máy này",
    providersNote: "Hai bộ đọc, đều miễn phí và đều chạy trong môi trường Python riêng của project. Cài bộ nào thì dùng được các giọng của bộ đó trong Studio.",
    providerCount: "{count} giọng",
    providerInstall: "Cài",
    providerInstalling: "Đang cài…",
    providerInstalled: "Đã cài",
    switched: "Đã đổi",
  },
} satisfies Record<string, Record<string, string>>;

type Engine = "local" | "cloud";

interface LocalModel {
  id: string;
  label: string;
  language: string;
}

interface LocalStatus {
  ready: boolean;
  python: string | null;
  piper: boolean;
  ffmpeg: boolean;
  cuda: boolean;
  models: LocalModel[];
  reason: string;
}

interface ProviderStatus {
  provider: "piper" | "vieneu";
  installed: boolean;
  reason: string;
  voices: number;
  pip: string;
  label: string;
}

interface SettingsPayload {
  engine: Engine;
  default: Engine;
  local: LocalStatus;
  providers?: ProviderStatus[];
}

export function VoiceSettings() {
  const t = useCopy(COPY);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [local, setLocal] = useState<LocalStatus | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [busy, setBusy] = useState<"save" | "install" | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/tts", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as SettingsPayload;
      setEngine(payload.engine);
      setLocal(payload.local);
      setProviders(payload.providers ?? []);
    } catch {
      /* the panel keeps the last answer */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const choose = useCallback(async (next: Engine) => {
    setEngine(next);
    setBusy("save");
    try {
      const response = await fetch("/api/settings/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engine: next }),
      });
      const payload = (await response.json()) as SettingsPayload;
      if (payload.local) setLocal(payload.local);
      if (payload.engine) setEngine(payload.engine);
    } catch {
      /* keep the choice on screen; the next read will tell the truth */
    } finally {
      setBusy(null);
    }
  }, []);

  /**
   * The install, read as it happens.
   *
   * Piping a 60 MB download and a wheel build into one fetch would leave the
   * button dead for minutes with nothing to look at, which is indistinguishable
   * from a hang. The route sends a line per stage, so the log fills in as the work
   * does and a teacher can tell a slow download from a failed one.
   */
  const install = useCallback(async (provider: "piper" | "vieneu" = "piper") => {
    setBusy("install");
    setLog([]);
    try {
      const response = await fetch(`/api/settings/tts/install?package=${provider}`, {
        method: "POST",
      });
      if (!response.ok || !response.body) {
        setLog([`HTTP ${response.status}`]);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut = buffer.indexOf("\n\n");
        while (cut >= 0) {
          const frame = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const line = frame
            .split("\n")
            .find((entry) => entry.startsWith("data:"));
          if (line) {
            try {
              const event = JSON.parse(line.slice(5).trim()) as {
                type: string;
                message?: string;
              };
              if (event.type === "done") void refresh();
              // Every frame carries a line of the same log, error included: a
              // failed install reads best as the tail of the pip output rather
              // than a sentence in place of it.
              if (event.message) setLog((lines) => [...lines, event.message as string]);
            } catch {
              /* a partial frame; the next read completes it */
            }
          }
          cut = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      setLog([error instanceof Error ? error.message : String(error)]);
    } finally {
      setBusy(null);
      void refresh();
    }
  }, [refresh]);

  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-mist-100">{t.heading}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-mist-400">{t.lead}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <EngineCard
          active={engine === "local"}
          icon={<IconCpu className="h-4 w-4" />}
          title={t.localTitle}
          note={t.localNote}
          badge={local ? (local.ready ? t.localReady : t.localNotReady) : null}
          badgeTone={local?.ready ? "good" : "warn"}
          disabled={busy !== null}
          onSelect={() => void choose("local")}
        />
        <EngineCard
          active={engine === "cloud"}
          icon={<IconCloud className="h-4 w-4" />}
          title={t.cloudTitle}
          note={t.cloudNote}
          badge={null}
          badgeTone="warn"
          disabled={busy !== null}
          onSelect={() => void choose("cloud")}
        />
      </div>

      {/* What the machine can actually do, and the one button that changes it. */}
      <div className="rounded-xl border border-ink-700 bg-ink-950/50 px-3.5 py-3">
        {local && !local.ready && local.reason ? (
          <p className="text-[11px] leading-relaxed text-mist-500">{local.reason}</p>
        ) : null}

        {log.length > 0 ? (
          <div className="mt-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-mist-500">
              <IconTerminal2 className="mr-1 inline h-3 w-3" />
              {t.logTitle}
            </p>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-ink-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-mist-300">
              {log.join("\n")}
            </pre>
          </div>
        ) : null}
      </div>
      {/*
        * The two local engines. Piper is the one this project started with and
        * the smallest; VieNeu-TTS brings the choice of speakers that a single
        * voice cannot. Each row installs on its own, because the sizes are wildly
        * different and nobody should download hundreds of megabytes to try a
        * voice they do not like.
        */}
      <div className="rounded-xl border border-ink-700 bg-ink-950/50 px-3.5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-mist-100">{t.providersTitle}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-mist-400">{t.providersNote}</p>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {providers.map((provider) => (
            <div
              key={provider.provider}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-800 px-2.5 py-2"
            >
              {provider.installed ? (
                <IconCircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
              ) : (
                <IconAlertTriangle className="h-4 w-4 shrink-0 text-mist-500" />
              )}
              <span className="text-xs font-semibold text-mist-100">{provider.label}</span>
              <span className="chip">
                {t.providerCount.replace("{count}", String(provider.voices))}
              </span>
              {provider.installed ? (
                <span className="chip ml-auto border-brand-700/60 text-brand-200">
                  {t.providerInstalled}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void install(provider.provider)}
                  className="btn-ghost ml-auto text-xs"
                  disabled={busy !== null}
                >
                  {busy === "install" ? (
                    <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <IconDownload className="h-3.5 w-3.5" />
                  )}
                  {busy === "install" ? t.providerInstalling : t.providerInstall}
                </button>
              )}
              {provider.reason ? (
                <p className="w-full text-[11px] leading-relaxed text-mist-500">
                  {provider.reason}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EngineCard({
  active,
  icon,
  title,
  note,
  badge,
  badgeTone,
  disabled,
  onSelect,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  note: string;
  badge: string | null;
  badgeTone: "good" | "warn";
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-xl border px-3.5 py-3 text-left transition-colors disabled:opacity-60 ${
        active
          ? "border-brand-500/70 bg-brand-500/10"
          : "border-ink-700 bg-ink-950/40 hover:border-brand-400/60"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={active ? "text-brand-300" : "text-mist-400"}>{icon}</span>
        <span className="text-sm font-semibold text-mist-100">{title}</span>
        {badge ? (
          <span
            className={`chip ml-auto ${badgeTone === "good" ? "text-brand-200" : "text-gold-300"}`}
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block text-[11px] leading-relaxed text-mist-400">{note}</span>
    </button>
  );
}
