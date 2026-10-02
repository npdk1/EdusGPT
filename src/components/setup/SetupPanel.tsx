"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TriangleAlert,
  CircleCheck,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  CirclePlay,
  Cloud,
  Search,
  SquareTerminal,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { PublicAiStatus, ProviderId } from "@/lib/ai/config";
import { formatRelativeTime } from "@/lib/format";

interface LiveModel {
  id: string;
  displayName: string;
}

type Message = { tone: "ok" | "error" | "info"; text: string };

type ProviderEntry = PublicAiStatus["providers"][number];

/**
 * Live model lists, kept per provider.
 *
 * One shared array was the bug behind a very confusing dropdown: pulling the
 * Gemini list and then switching to OpenRouter left the OpenRouter select
 * offering `gemini-*` ids that vendor does not serve.
 */
type LiveModels = Partial<Record<ProviderId, LiveModel[]>>;

const PROVIDER_MARKS: Record<ProviderId, { src: string; alt: string }> = {
  gemini: { src: "/providers/gemini.svg", alt: "Logo Gemini" },
  openrouter: { src: "/providers/openrouter.svg", alt: "Logo OpenRouter" },
  groq: { src: "/providers/groq.svg", alt: "Mark Groq" },
  nvidia: { src: "/providers/nvidia.svg", alt: "Mark NVIDIA API" },
  antigravity: { src: "/providers/antigravity.svg", alt: "Logo Antigravity CLI" },
};

/**
 * What each vendor's free tier actually is, in one sentence.
 *
 * Deliberately free of hard numbers: every vendor counts quota in a different
 * unit (requests per day, tokens per model per day, project credits) and the
 * published limits move, so a stale figure in the UI is worse than a pointer to
 * the vendor's own docs, which is what each sentence ends with.
 */
const PROVIDER_NOTES: Record<ProviderId, string> = {
  gemini:
    "Gói free tính theo project trong AI Studio, hạn mức công bố theo model và thay đổi theo thời gian — xem trang rate limits của Google.",
  openrouter:
    "Nhóm model đuôi :free dùng không tốn tiền, giới hạn theo số request mỗi phút và mỗi ngày; danh sách model free có thể bị đổi.",
  groq:
    "Gói free không cần thẻ, tính theo token mỗi ngày cho từng model, nên hết hạn mức sẽ tự reset vào 0 giờ theo giờ UTC.",
  nvidia:
    "Endpoint miễn phí để thử nghiệm, giới hạn theo số request mỗi phút và có thể yêu cầu khoá API cho endpoint mới.",
  antigravity:
    "Chạy agent ngay trên máy bạn và đọc được slide trong thư viện, nên không tốn quota lượt nào — chỉ giới hạn theo tài khoản Google của bạn.",
};

/** Provider logos: official brand marks (Simple Icons CDN) + the CLI mark. */
function ProviderMark({ id }: { id: ProviderId }) {
  const { src, alt } = PROVIDER_MARKS[id];
  return (
    <img
      src={src}
      alt={alt}
      width={16}
      height={16}
      className="h-4 w-4 shrink-0"
    />
  );
}

/** One selectable provider row, in either group. */
function ProviderCard({
  item,
  active,
  onSelect,
}: {
  item: ProviderEntry;
  active: boolean;
  onSelect: (id: ProviderId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-pressed={active}
      className={`rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
        active
          ? "border-brand-500 bg-brand-500/12"
          : "border-ink-700 bg-ink-950/60 hover:border-brand-700"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-2 text-sm font-semibold ${active ? "text-brand-100" : "text-mist-200"}`}>
          <ProviderMark id={item.id} />
          {item.label}
        </span>
        {/* CLI rows carry install state instead of a masked key: there is no
            secret to show, and "chưa có key" would be a lie about them. */}
        {item.kind === "cli" ? (
          item.cli?.available ? (
            <span className="rounded-full border border-brand-700/60 bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] text-brand-200">
              sẵn sàng
            </span>
          ) : (
            <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-mist-500">
              chưa cài
            </span>
          )
        ) : item.keyHint ? (
          <span className="rounded-full border border-brand-700/60 bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] text-brand-200">
            {item.keyHint}
          </span>
        ) : (
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-mist-500">
            chưa có key
          </span>
        )}
      </span>
      {/* The model this vendor would use, so the choice is visible without
          opening the tab. Truncated because ids can be long. */}
      <span className="mt-1 block truncate font-mono text-[11px] text-mist-500">
        {item.model || item.defaultModel}
      </span>
    </button>
  );
}

/**
 * The provider + key screen. Everything happens on localhost: the key is
 * validated against the vendor, then written to `.env` by the server
 * route. The browser only ever gets back a masked hint.
 */
export function SetupPanel() {
  const [status, setStatus] = useState<PublicAiStatus | null>(null);
  const [provider, setProvider] = useState<ProviderId | "">("");
  /**
   * Drafts the entered key. Prefilled from the server (localhost only) when a
   * key is already stored, so what you see is what will be used; empty when
   * nothing is stored. The box itself is `type="password"` unless revealed.
   */
  const [keyDraft, setKeyDraft] = useState("");
  /** True once a stored-key lookup has answered for the current provider. */
  const [keyReady, setKeyReady] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  // The advanced base-URL box is only submitted once the user actually edits it,
  // so a stale URL from another provider can never be sent by accident.
  const [baseUrlDirty, setBaseUrlDirty] = useState(false);
  const [liveModels, setLiveModels] = useState<LiveModels>({});
  const [modelOpen, setModelOpen] = useState(false);
  /**
   * Non-null while the model box is being typed in; null means it shows the
   * saved value. Kept separate from `model` so filtering never destroys an
   * unsaved-but-valid choice.
   */
  const [modelQuery, setModelQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "status" | "check" | "save" | "delete" | "models">(
    null,
  );
  const [message, setMessage] = useState<Message | null>(null);
  /** Guards the one-time seed of the form from the first status response. */
  const [seeded, setSeeded] = useState(false);

  const applyStatus = useCallback((next: PublicAiStatus) => {
    setStatus(next);
  }, []);

  /**
   * Loads the stored key for one provider into the password box.
   *
   * Answered by a localhost-only route: an empty box means "no key stored",
   * never "loading". Anything typed afterwards is a replacement, sent only by
   * Kiểm tra & lưu.
   */
  const loadStoredKey = useCallback(async (target: ProviderId) => {
    setKeyReady(false);
    try {
      const response = await fetch(
        `/api/settings/gemini/key?provider=${encodeURIComponent(target)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { key?: string | null };
      setKeyDraft(typeof payload.key === "string" ? payload.key : "");
    } catch {
      setKeyDraft("");
    } finally {
      setKeyReady(true);
    }
  }, []);

  /**
   * Pulls the selected provider's live model list.
   *
   * The provider goes in the query string because the route must answer for the
   * vendor being looked at, not the one currently active. `quiet` skips the
   * success message — used by the automatic load on page open, where a green
   * banner on every visit would be noise. Errors still show.
   */
  const loadModels = useCallback(
    async (target?: ProviderId, quiet?: boolean) => {
      const resolved = target ?? ((provider || "gemini") as ProviderId);
      setBusy("models");
      if (!quiet) setMessage(null);
      try {
        const response = await fetch(
          `/api/ai/models?provider=${encodeURIComponent(resolved)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as {
          ok?: boolean;
          models?: LiveModel[];
          error?: string;
          providerLabel?: string;
        };
        if (payload.ok && payload.models) {
          setLiveModels((current) => ({ ...current, [resolved]: payload.models! }));
          if (!quiet) {
            setMessage({
              tone: "ok",
              text: `${payload.providerLabel ?? resolved} trả về ${payload.models.length} model dùng được.`,
            });
          }
        } else {
          setMessage({ tone: "error", text: payload.error ?? "Không lấy được model." });
        }
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Không gọi được máy chủ.",
        });
      } finally {
        setBusy(null);
      }
    },
    [provider],
  );

  /**
   * Seeds the form once, from the active provider.
   *
   * Not re-run on later status updates: after a save the response already
   * carries the model that was validated, and re-seeding would stamp over a
   * still-unsaved edit.
   */
  useEffect(() => {
    if (!status || seeded) return;
    const active = status.providers.find((item) => item.id === status.provider);
    setProvider(status.provider);
    setModel(active?.model || status.model || "");
    setBaseUrl(active?.baseUrl || status.baseUrl || "");
    setSeeded(true);
    // Show the stored key (masked by the password box) instead of an
    // always-empty field; nothing stored means the box stays empty. The model
    // list loads itself too, so the page opens ready to pick.
    if (active?.kind === "cli") {
      // Nothing to unlock — but the curated model list is served from the local
      // adapter, so it can be fetched the moment the card is opened.
      setKeyReady(true);
      void loadModels(status.provider, true);
    } else if (active?.keyHint) {
      void loadStoredKey(status.provider);
      void loadModels(status.provider, true);
    } else setKeyReady(true);
  }, [status, seeded, loadStoredKey, loadModels]);

  /** Switching provider swaps the key field, the model list and the base URL. */
  const selectProvider = useCallback(
    (next: ProviderId) => {
      setProvider(next);
      const info = status?.providers?.find((item) => item.id === next);
      setModel(info?.model || info?.defaultModel || "");
      // Without this, the previous vendor's base URL was sent along with the new
      // key and the request landed on the wrong host entirely.
      setBaseUrl(info?.baseUrl || "");
      setBaseUrlDirty(false);
      if (info?.kind === "cli") {
        setKeyDraft("");
        setKeyReady(true);
        if (!liveModels[next]?.length) void loadModels(next, true);
      } else if (info?.keyHint) {
        void loadStoredKey(next);
        // Same automatic load as on page open; skipped when this vendor's
        // list is already cached, so flipping back and forth stays quiet.
        if (!liveModels[next]?.length) void loadModels(next, true);
      } else {
        setKeyDraft("");
        setKeyReady(true);
      }
      setMessage(null);
    },
    [status, loadStoredKey, liveModels, loadModels],
  );

  const activeProvider = (provider || "gemini") as ProviderId;
  const activeProviderInfo = status?.providers?.find((item) => item.id === activeProvider);
  const activeProviderLabel = activeProviderInfo?.label ?? activeProvider;
  const activeSignupUrl = activeProviderInfo?.signupUrl ?? "";
  const storedHintForActive = activeProviderInfo?.keyHint ?? null;
  /**
   * One line per provider, shown only for the provider actually selected.
   *
   * A single sentence about "free quotas" in general was both wrong (each vendor
   * counts differently, and the numbers change) and useless next to a card for
   * a different vendor. Each entry says what that vendor's free tier actually
   * is, so the sentence under the cards always describes the vendor you just
   * clicked.
   */
  const activeNote = PROVIDER_NOTES[activeProvider] ?? null;

  /**
   * Whether the selected provider holds a secret at all. A CLI provider is
   * configured by having its binary on PATH, so every key-only control below
   * (password box, delete button, base URL) is hidden rather than disabled —
   * an empty box asking for a key that does not exist reads as a bug.
   */
  const activeIsCli = activeProviderInfo?.kind === "cli";
  const cliReady = activeProviderInfo?.cli?.available === true;

  const cloudProviders = (status?.providers ?? []).filter((item) => item.kind === "cloud");
  const cliProviders = (status?.providers ?? []).filter((item) => item.kind === "cli");
  const plannedCli = status?.plannedCliProviders ?? [];

  /**
   * Whether this provider's model list can be fetched.
   *
   * Keyed on the *selected* provider, not the active one. Gating on the active
   * provider left the button enabled on a vendor with no key, so pressing it
   * produced a bare error instead of the intended "save a key first".
   */
  const canFetchModels = activeIsCli
    ? cliReady
    : Boolean(activeProviderInfo?.keyHint);


  const refreshStatus = useCallback(async () => {
    setBusy("status");
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const payload = (await response.json()) as { ai: PublicAiStatus };
      applyStatus(payload.ai);
    } catch {
      setMessage({ tone: "error", text: "Không gọi được /api/health." });
    } finally {
      setBusy(null);
    }
  }, [applyStatus]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const submit = useCallback(
    async (dryRun: boolean) => {
      const apiKey = keyDraft.trim();
      // No secret is sent for a CLI provider: the server checks the binary and
      // stores provider + model only.
      const wantsCli = activeIsCli;
      if (!apiKey && !wantsCli) {
        setMessage({ tone: "error", text: "Dán API key vào ô bên dưới trước." });
        return;
      }
      setBusy(dryRun ? "check" : "save");
      setMessage(null);
      try {
        const response = await fetch("/api/settings/gemini", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            apiKey: apiKey || undefined,
            model,
            baseUrl: baseUrlDirty && !wantsCli ? baseUrl : undefined,
            provider: provider || undefined,
            dryRun,
          }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          saved?: boolean;
          error?: string;
          validation?: { ok: boolean; message: string; model?: string; models?: number };
          ai?: PublicAiStatus;
        };

        if (payload.ai) applyStatus(payload.ai);

        if (!response.ok || !payload.validation?.ok) {
          setMessage({
            tone: "error",
            text: payload.error ?? payload.validation?.message ?? "Kiểm tra thất bại.",
          });
          return;
        }

        if (payload.validation.model) setModel(payload.validation.model);
        setMessage({
          tone: "ok",
          text: payload.saved
            ? wantsCli
              ? `${payload.validation.message} Đã chọn làm nhà cung cấp chính.`
              : `${payload.validation.message} Đã ghi vào .env, dùng được ngay.`
            : `${payload.validation.message} (chế độ chỉ kiểm tra, chưa ghi file)`,
        });
        // Nothing was written for a CLI provider, so there is no key to refill.
        if (payload.saved && !wantsCli) {
          void loadStoredKey((provider || "gemini") as ProviderId);
        }
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Lỗi không xác định.",
        });
      } finally {
        setBusy(null);
      }
    },
    [activeIsCli, applyStatus, baseUrl, baseUrlDirty, keyDraft, loadStoredKey, model, provider],
  );

  const deleteKey = useCallback(async () => {
    setBusy("delete");
    setMessage(null);
    try {
      const response = await fetch("/api/settings/gemini", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: provider || undefined }),
      });
      const payload = (await response.json()) as { ai?: PublicAiStatus; error?: string };
      if (payload.ai) applyStatus(payload.ai);
      // The key is gone, so the box goes empty with it.
      setKeyDraft("");
      setKeyReady(true);
      // The cached list belonged to a key that no longer exists.
      setLiveModels((current) => ({ ...current, [activeProvider]: [] }));
      setMessage(
        response.ok
          ? { tone: "info", text: `Đã xoá key ${activeProviderLabel} khỏi .env.` }
          : { tone: "error", text: payload.error ?? "Không xoá được key." },
      );
    } finally {
      setBusy(null);
    }
  }, [activeProvider, activeProviderLabel, applyStatus, provider]);


  // Keep the selected model in the dropdown even if the live list has not
  // loaded, and offer the *selected provider's* models — not the active
  // backend's — so switching provider in the UI is coherent.
  const options = useMemo(
    () =>
      Array.from(
        new Set(
          [
            model,
            ...(liveModels[activeProvider] ?? []).map((item) => item.id),
            ...(activeProviderInfo?.modelChoices ?? []),
          ].filter((item): item is string => Boolean(item)),
        ),
      ),
    [activeProvider, activeProviderInfo, liveModels, model],
  );

  const liveCount = liveModels[activeProvider]?.length ?? 0;

  /**
   * Searchable model box. Typing filters the known ids; Enter takes the first
   * match, clicking outside keeps whatever was typed (custom ids stay valid),
   * Escape closes without changing anything.
   */
  const modelMatches = useMemo(() => {
    const query = (modelQuery ?? "").trim().toLowerCase();
    const list = query
      ? options.filter((option) => option.toLowerCase().includes(query))
      : options;
    return list.slice(0, 100);
  }, [options, modelQuery]);

  const pickModel = useCallback((id: string) => {
    setModel(id);
    setModelQuery(null);
    setModelOpen(false);
  }, []);

  const commitModelBox = useCallback(() => {
    setModelQuery((query) => {
      if (query !== null && query.trim()) setModel(query.trim());
      return null;
    });
    setModelOpen(false);
  }, []);

  // The active provider's kind is already on the status payload; re-deriving it
  // by searching the provider list was both noisier and wrong-prone.
  const statusIsCli = status?.providerKind === "cli";
  const sourceLabel = statusIsCli
    ? status?.cli?.available
      ? `đăng nhập local${status.cli.version ? ` · ${status.cli.version}` : ""}`
      : "chưa đăng nhập"
    : status?.keySource === "env"
      ? "biến môi trường của shell"
      : status?.keySource === "file"
        ? "file .env"
        : "chưa có";

  return (
    <div className="space-y-5">
      <header>
        <span className="chip">
          <KeyRound className="h-3.5 w-3.5 text-gold-300" /> cài đặt chạy trên máy bạn
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
          Nhà cung cấp AI
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300 sm:text-base">
          {statusIsCli ? (
            <>
              Nhà cung cấp <strong className="text-mist-100">Antigravity CLI</strong>{" "}
              chạy agent ngay trên máy bạn. Không có key, không tốn quota — chọn
              nó thì app gọi agent đọc slide trong thư viện của bạn.
            </>
          ) : (
            <>
              Dán key rồi bấm{" "}
              <strong className="text-mist-100">Kiểm tra &amp; lưu</strong>. Key
              được gọi thử một lần rồi ghi vào{" "}
              <code className="font-mono text-gold-200">.env</code> trên máy
              bạn.
            </>
          )}
        </p>
      </header>

      {/* status — one compact row instead of a six-cell grid */}
      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          {status?.configured ? (
            <CircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
          ) : (
            <TriangleAlert className="h-4 w-4 shrink-0 text-gold-300" />
          )}
          <span className="text-sm font-semibold text-mist-100">
            {status?.providerLabel ?? "—"}
          </span>
          <span className="chip">
            {status?.configured
              ? statusIsCli
                ? "agent CLI sẵn sàng"
                : "đã có key"
              : statusIsCli
                ? "CLI chưa cài"
                : "chưa có key"}
          </span>
          {!statusIsCli && status?.keyHint ? (
            <span className="chip font-mono">{status.keyHint}</span>
          ) : null}
          <span className="chip">{sourceLabel}</span>
          {status?.model ? <span className="chip font-mono">{status.model}</span> : null}
          <span className="chip">
            {status?.lastValidatedAt
              ? `${formatRelativeTime(status.lastValidatedAt)} · ${
                  status.lastValidationOk ? "đạt" : "lỗi"
                }`
              : "chưa kiểm tra"}
          </span>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="btn-ghost ml-auto"
            disabled={busy !== null}
          >
            {busy === "status" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Làm mới
          </button>
        </div>

        {status?.lastValidationMessage ? (
          <p className="mt-2.5 text-xs leading-relaxed text-mist-400">
            {status.lastValidationMessage}
          </p>
        ) : null}
      </section>


      {/* relative z-10: the model dropdown overflows this section, and every
          .panel has backdrop-blur (a stacking context), so without this the
          next section would paint over the open list and eat its clicks. */}
      <section className="panel relative z-10 space-y-4 p-5">
        <h2 className="text-sm font-semibold text-mist-100">
          Chọn nhà cung cấp &amp; dán key
        </h2>

        {/* Cloud providers — key-based, one card each. */}
        <div>
          <span className="label flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5 text-brand-300" /> Cloud Provider
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {cloudProviders.map((item) => (
              <ProviderCard
                key={item.id}
                item={item}
                active={item.id === activeProvider}
                onSelect={selectProvider}
              />
            ))}
          </div>
        </div>

        {/* CLI providers — none are routable yet. Shown rather than hidden so
            the absence reads as "not yet" instead of "you missed a setting". */}
        <div>
          <span className="label flex items-center gap-1.5">
            <SquareTerminal className="h-3.5 w-3.5 text-mist-400" /> CLI Provider
          </span>
          {cliProviders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/40 px-3.5 py-3">
              <p className="text-xs leading-relaxed text-mist-400">
                Chưa hỗ trợ. Hiện chỉ chạy qua Cloud Provider ở trên.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {plannedCli.map((item) => (
                  <span key={item.id} className="chip opacity-70" title={item.note}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {cliProviders.map((item) => (
                <ProviderCard
                  key={item.id}
                  item={item}
                  active={item.id === activeProvider}
                  onSelect={selectProvider}
                />
              ))}
            </div>
          )}
        </div>

        {activeNote ? (
          <p className="text-[11px] leading-relaxed text-mist-500">
            {activeNote} {activeSignupUrl ? (
              <>
                Lấy key:{" "}
                <a
                  href={activeSignupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-200 underline"
                >
                  {activeSignupUrl}
                </a>
                .
              </>
            ) : null}
          </p>
        ) : null}


        {/* CLI providers have no key, so the box is replaced by their install
            state and the one-time login hint. */}
        {activeIsCli ? (
          <div className="rounded-xl border border-ink-700 bg-ink-950/50 px-3.5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-mist-100">
              {cliReady ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
              ) : (
                <TriangleAlert className="h-4 w-4 shrink-0 text-gold-300" />
              )}
              {cliReady
                ? `Đã cài${activeProviderInfo?.cli?.version ? ` · ${activeProviderInfo.cli.version}` : ""}`
                : "Chưa thấy lệnh `agy`"}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">
              {cliReady
                ? "Agent chạy trên máy bạn, không cần API key. Bấm “Kiểm tra & lưu” để dùng nó làm nhà cung cấp chính."
                : "Cài bằng PowerShell: powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1 — rồi chạy lệnh `agy` một lần để đăng nhập."}
            </p>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="provider-key">
              {activeProviderLabel} API key
            </label>
            <div className="flex gap-2">
              <input
                id="provider-key"
                type={reveal ? "text" : "password"}
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit(true);
                }}
                placeholder={activeProvider === "openrouter" ? "sk-or-v1-…" : "AIzaSy…"}
                autoComplete="off"
                spellCheck={false}
                className="field"
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                className="btn-icon h-auto w-11 shrink-0"
                aria-label={reveal ? "Ẩn key" : "Hiện key"}
              >
                {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-mist-500">
              {!keyReady
                ? "Đang đọc key đã lưu…"
                : storedHintForActive
                  ? `Đã lưu key ${storedHintForActive}.`
                  : "Chưa có key. Dán vào rồi bấm Kiểm tra & lưu."}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="label" htmlFor="provider-model">
              Model mặc định
            </label>
            <div
              className="relative"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  commitModelBox();
                }
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
                <input
                  id="provider-model"
                  value={modelQuery ?? model}
                  onChange={(event) => {
                    setModelQuery(event.target.value);
                    setModelOpen(true);
                  }}
                  onFocus={(event) => {
                    setModelQuery(model);
                    setModelOpen(true);
                    // Typing replaces the current id instead of appending to it.
                    event.target.select();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && modelMatches.length > 0) {
                      pickModel(modelMatches[0]);
                    } else if (event.key === "Escape") {
                      commitModelBox();
                    }
                  }}
                  placeholder="Gõ để tìm model…"
                  autoComplete="off"
                  spellCheck={false}
                  className="field pl-9 pr-9"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
              </div>
              {modelOpen && modelMatches.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl">
                  {modelMatches.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => pickModel(option)}
                        className={`block w-full truncate px-3 py-2 text-left font-mono text-xs ${
                          option === model
                            ? "bg-brand-500/12 text-mist-50"
                            : "text-mist-300 hover:bg-ink-850"
                        }`}
                      >
                        {option}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {liveCount > 0 ? (
              <p className="mt-1.5 text-[11px] text-mist-500">
                {liveCount} model của {activeProviderLabel}.
              </p>
            ) : null}
          </div>
          <div className="flex items-start">
            <button
              type="button"
              onClick={() => void loadModels()}
              className="btn-ghost w-full"
              disabled={busy !== null || !canFetchModels}
              title={
                canFetchModels
                  ? `Hỏi ${activeProviderLabel} danh sách model khả dụng`
                  : `Cần lưu key ${activeProviderLabel} trước`
              }
            >
              {busy === "models" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Nạp danh sách model
            </button>
          </div>
        </div>

        {/* A CLI provider has no HTTP endpoint, so there is no base URL to
            point somewhere else. */}
        {!activeIsCli ? (
          <details className="rounded-xl border border-ink-700/70 bg-ink-950/50 px-3.5 py-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-mist-400">
              Nâng cao: base URL
            </summary>
            <div className="mt-3">
              <label className="label" htmlFor="provider-base">
                {activeProvider === "openrouter"
                  ? "OPENROUTER_BASE_URL"
                  : "GEMINI_BASE_URL"}
              </label>
              <input
                id="provider-base"
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setBaseUrlDirty(true);
                }}
                spellCheck={false}
                className="field"
              />
              <p className="mt-1.5 text-[11px] text-mist-500">
                Chỉ đổi khi bạn đi qua proxy/gateway tương thích. Host lạ sẽ bị từ chối
                ở server.
              </p>
            </div>
          </details>
        ) : null}


        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void submit(false)}
            className="btn-primary"
            disabled={busy !== null}
          >
            {busy === "save" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Kiểm tra &amp; lưu
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            className="btn-ghost"
            disabled={busy !== null}
          >
            {busy === "check" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Chỉ kiểm tra
          </button>
          {storedHintForActive && !activeIsCli ? (
            <button
              type="button"
              onClick={() => void deleteKey()}
              className="btn-ghost ml-auto border-ember-500/50 text-ember-400 hover:border-ember-400 hover:bg-ember-500/10"
              disabled={busy !== null}
            >
              {busy === "delete" ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Xoá key {activeProviderLabel}
            </button>
          ) : null}
        </div>

        {message ? (
          <p
            className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm ${
              message.tone === "ok"
                ? "border-brand-600/50 bg-brand-500/10 text-mist-100"
                : message.tone === "error"
                  ? "border-ember-500/50 bg-ember-500/10 text-mist-100"
                  : "border-ink-600 bg-ink-900/70 text-mist-200"
            }`}
          >
            {message.tone === "ok" ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            ) : message.tone === "error" ? (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
            ) : (
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            )}
            <span className="min-w-0 break-words">{message.text}</span>
          </p>
        ) : null}
      </section>


      <section className="panel p-5">
        <h2 className="text-sm font-semibold text-mist-100">Sau khi lưu key</h2>
        <ol className="mt-3 space-y-2 text-sm text-mist-300">
          <li>
            <span className="font-mono text-brand-200">1.</span> Sang{" "}
            <Link href="/studio" className="text-gold-200 underline">
              /studio
            </Link>{" "}
            nhập chủ đề, chọn độ dài rồi bấm sinh bài giảng.
          </li>
          <li>
            <span className="font-mono text-brand-200">2.</span> Bài mới lưu vào
            thư viện trên máy, bấm “Mở trong trình phát”.
          </li>
          <li>
            <span className="font-mono text-brand-200">3.</span> Trong{" "}
            <Link href="/lesson" className="text-gold-200 underline">
              /lesson
            </Link>{" "}
            hãy thử: kéo timeline để tua, <span className="kbd">,</span>{" "}
            <span className="kbd">.</span> để bước từng khung hình,{" "}
            <span className="kbd">[</span> <span className="kbd">]</span> rồi{" "}
            <span className="kbd">\</span> để lặp đúng một đoạn khó.
          </li>
        </ol>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-ink-700/70 bg-ink-950/50 p-3 text-[11px] leading-relaxed text-mist-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
          API cài key chỉ nhận request từ{" "}
          <code className="font-mono">localhost / 127.0.0.1</code>. Mở web qua IP
          LAN thì không lưu được key, trừ khi đặt{" "}
          <code className="font-mono">ALLOW_REMOTE_KEY_ADMIN=true</code>.
        </p>

        <p className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mist-400">
          <Link href="/studio" className="btn-ghost">
            <CirclePlay className="h-4 w-4" /> Đi tới Studio AI
          </Link>
          <span>
            Muốn xem thử? Mở{" "}
            <Link href="/lesson" className="text-brand-200 underline">
              /lesson
            </Link>
            . Bài mẫu không cần key.
          </span>
        </p>
      </section>
    </div>
  );
}

