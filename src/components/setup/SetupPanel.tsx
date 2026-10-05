"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLoader2,
  IconCloud,
  IconSearch,
  IconTerminal2,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import type { PublicAiStatus, ProviderId } from "@/lib/ai/config";
import { formatRelativeTime } from "@/lib/format";
import { useCopy, useLang } from "@/i18n/provider";

interface LiveModel {
  id: string;
  displayName: string;
}

type Message = { tone: "ok" | "error" | "info"; text: string };

type ProviderEntry = PublicAiStatus["providers"][number];

/**
 * Where the form starts before `/api/health` answers.
 *
 * Must name a real provider: `activeProviderInfo` is looked up by id and a
 * provider that does not exist yields no model choices, no note and no card —
 * a blank form instead of a usable one. Mirrors the server default.
 */
const DEFAULT_PROVIDER_ID: ProviderId = "nvidia";

/**
 * Live model lists, kept per provider.
 *
 * One shared array was the bug behind a very confusing dropdown: pulling one
 * vendor’s list and then switching to another left the select offering ids that the
 * new vendor does not serve.
 */
type LiveModels = Partial<Record<ProviderId, LiveModel[]>>;

const PROVIDER_MARKS: Record<ProviderId, { src: string; alt: string }> = {
  groq: { src: "/providers/groq.svg", alt: "Mark Groq" },
  nvidia: { src: "/providers/nvidia.svg", alt: "Mark NVIDIA API" },
  antigravity: { src: "/providers/antigravity.svg", alt: "Logo Antigravity CLI" },
};

/**
 * English first, Vietnamese second: both dictionaries hold the same keys, so a
 * missing Vietnamese string is a type error rather than a stray English label.
 *
 * Keys carry the area they belong to (`provider`, `key`, `model`, `status`,
 * `header`, `next`) because this file is the size of a small page. Values that
 * wrap a variable keep the variable in JSX and split the sentence around it —
 * provider labels, model ids, versions and env var names are never translated.
 */
const COPY = {
  en: {
    // provider cards
    providerReady: "Ready",
    providerNotInstalled: "Not installed",
    providerNoKey: "No key",
    noteGroq:
      "The free tier needs no card and counts tokens per model per day, so a spent quota resets at 00:00 UTC. The real ceiling sits lower than that number: one lesson costs roughly 8,000 tokens per minute, so long lessons have to queue.",
    noteNvidia:
      "A free endpoint for trying things out, capped by requests per minute and sometimes asking for an API key on new endpoints.",
    noteAntigravity:
      "Runs the agent on your own machine and reads the slides in your library, so it spends no request quota — only your Google account limits apply.",
    cloudGroup: "Cloud Provider",
    cliGroup: "CLI Provider",
    cliUnsupported:
      "Not supported yet. For now only the cloud provider above can be used.",
    getKey: "Get a key:",
    cliInstalled: "Installed",
    cliCommandMissing: "The `agy` command was not found",
    cliReadyHint:
      "The agent runs on your machine, no API key needed. Press “Save & test” to make it your main provider.",
    cliInstallHint:
      "Install it with PowerShell: powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1 — then run the `agy` command once to log in.",
    // page header
    headerChip: "Setup runs on your machine",
    headerTitle: "AI provider",
    headerCliLead: "The",
    headerCliTail:
      "provider runs the agent right on your machine. No key, no quota — pick it and the app asks the agent to read the slides in your library.",
    headerKeyLead: "Paste a key, then press",
    headerKeyAction: "Save & test",
    headerKeyBeforeEnv:
      "The key is called once to check it, then written to",
    headerKeyAfterEnv: "on your machine.",
    // status row
    statusAgentReady: "CLI agent ready",
    statusHasKey: "key saved",
    statusCliMissing: "CLI not installed",
    statusOk: "ok",
    statusFailed: "failed",
    statusNeverChecked: "never checked",
    statusRefresh: "Refresh",
    sourceLoggedIn: "logged in locally",
    sourceNotLoggedIn: "not logged in",
    sourceShellEnv: "shell environment variable",
    sourceEnvFile: ".env file",
    sourceNone: "none",
    healthFailed: "Could not reach /api/health.",
    // key box
    selectHeading: "Choose a provider and paste a key",
    keyHide: "Hide key",
    keyShow: "Show key",
    keyReading: "Reading the saved key…",
    keyStored: "Saved key",
    keyMissing: "No key yet. Paste one, then press Save & test.",
    keyRequired: "Paste an API key into the box below first.",
    keySaveTest: "Save & test",
    keyTestOnly: "Test only",
    keyDelete: "Delete key",
    keyDeletedLead: "Deleted the key ",
    keyDeletedTail: " from .env.",
    keyDeleteFailed: "Could not delete the key.",
    checkFailed: "The check failed.",
    savedAsPrimary: "It is now your main provider.",
    savedToEnv: "Written to .env, ready to use right away.",
    dryRunNote: " (check only, nothing written to the file)",
    unknownError: "Unknown error.",
    // model box
    modelDefault: "Default model",
    modelSearch: "Type to search models…",
    modelTrustedTitle:
      "This model has already produced a complete lesson on your machine.",
    modelTrustedBadge: "Has produced a lesson",
    modelUnit: "models from",
    modelTrustedNote:
      " A ✓ mark means the model has already generated a lesson on this machine",
    modelUntestedNote:
      " No model from this provider has been tried for a lesson yet.",
    modelsLoad: "Load model list",
    modelsAskLead: "Ask",
    modelsAskTail: "for its available model list",
    modelsNeedKeyLead: "Save a key for",
    modelsNeedKeyTail: " first",
    modelsReturned: "returned",
    modelUnitUsable: "usable models",
    modelsFailed: "Could not load the model list.",
    serverUnreachable: "Could not reach the server.",
    advancedBaseUrl: "Advanced: base URL",
    baseUrlHint:
      "Change this only if you go through a compatible proxy or gateway. Unknown hosts are rejected on the server.",
  },
  vi: {
    providerReady: "sẵn sàng",
    providerNotInstalled: "chưa cài",
    providerNoKey: "chưa có key",
    noteGroq:
      "Gói free không cần thẻ, tính theo token mỗi ngày cho từng model, nên hết hạn mức sẽ tự reset vào 0 giờ theo giờ UTC. Trần thấp hơn con số trên: một bài chỉ khoảng 8.000 token/phút, nên bài dài sẽ phải chờ xen kẽ.",
    noteNvidia:
      "Endpoint miễn phí để thử nghiệm, giới hạn theo số request mỗi phút và có thể yêu cầu khoá API cho endpoint mới.",
    noteAntigravity:
      "Chạy agent ngay trên máy bạn và đọc được slide trong thư viện, nên không tốn quota lượt nào — chỉ giới hạn theo tài khoản Google của bạn.",
    cloudGroup: "Cloud Provider",
    cliGroup: "CLI Provider",
    cliUnsupported:
      "Chưa hỗ trợ. Hiện chỉ chạy qua Cloud Provider ở trên.",
    getKey: "Lấy key:",
    cliInstalled: "Đã cài",
    cliCommandMissing: "Chưa thấy lệnh `agy`",
    cliReadyHint:
      "Agent chạy trên máy bạn, không cần API key. Bấm “Kiểm tra & lưu” để dùng nó làm nhà cung cấp chính.",
    cliInstallHint:
      "Cài bằng PowerShell: powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1 — rồi chạy lệnh `agy` một lần để đăng nhập.",
    headerChip: "cài đặt chạy trên máy bạn",
    headerTitle: "Nhà cung cấp AI",
    headerCliLead: "Nhà cung cấp",
    headerCliTail:
      "chạy agent ngay trên máy bạn. Không có key, không tốn quota — chọn nó thì app gọi agent đọc slide trong thư viện của bạn.",
    headerKeyLead: "Dán key rồi bấm",
    headerKeyAction: "Kiểm tra & lưu",
    headerKeyBeforeEnv: "Key được gọi thử một lần rồi ghi vào",
    headerKeyAfterEnv: "trên máy bạn.",
    statusAgentReady: "agent CLI sẵn sàng",
    statusHasKey: "đã có key",
    statusCliMissing: "CLI chưa cài",
    statusOk: "đạt",
    statusFailed: "lỗi",
    statusNeverChecked: "chưa kiểm tra",
    statusRefresh: "Làm mới",
    sourceLoggedIn: "đăng nhập local",
    sourceNotLoggedIn: "chưa đăng nhập",
    sourceShellEnv: "biến môi trường của shell",
    sourceEnvFile: "file .env",
    sourceNone: "chưa có",
    healthFailed: "Không gọi được /api/health.",
    selectHeading: "Chọn nhà cung cấp & dán key",
    keyHide: "Ẩn key",
    keyShow: "Hiện key",
    keyReading: "Đang đọc key đã lưu…",
    keyStored: "Đã lưu key",
    keyMissing: "Chưa có key. Dán vào rồi bấm Kiểm tra & lưu.",
    keyRequired: "Dán API key vào ô bên dưới trước.",
    keySaveTest: "Kiểm tra & lưu",
    keyTestOnly: "Chỉ kiểm tra",
    keyDelete: "Xoá key",
    keyDeletedLead: "Đã xoá key ",
    keyDeletedTail: " khỏi .env.",
    keyDeleteFailed: "Không xoá được key.",
    checkFailed: "Kiểm tra thất bại.",
    savedAsPrimary: "Đã chọn làm nhà cung cấp chính.",
    savedToEnv: "Đã ghi vào .env, dùng được ngay.",
    dryRunNote: " (chế độ chỉ kiểm tra, chưa ghi file)",
    unknownError: "Lỗi không xác định.",
    modelDefault: "Model mặc định",
    modelSearch: "Gõ để tìm model…",
    modelTrustedTitle:
      "Model này đã tự sinh được một bài hoàn chỉnh trên máy bạn.",
    modelTrustedBadge: "Đã tạo được bài",
    modelUnit: "model của",
    modelTrustedNote:
      " Dấu ✓ là model đã tự sinh được bài trên máy này",
    modelUntestedNote:
      " Chưa model nào của hãng này được thử sinh bài.",
    modelsLoad: "Nạp danh sách model",
    modelsAskLead: "Hỏi",
    modelsAskTail: "danh sách model khả dụng",
    modelsNeedKeyLead: "Cần lưu key",
    modelsNeedKeyTail: " trước",
    modelsReturned: "trả về",
    modelUnitUsable: "model dùng được",
    modelsFailed: "Không lấy được model.",
    serverUnreachable: "Không gọi được máy chủ.",
    advancedBaseUrl: "Nâng cao: base URL",
    baseUrlHint:
      "Chỉ đổi khi bạn đi qua proxy/gateway tương thích. Host lạ sẽ bị từ chối ở server.",
  },
};

type CopyKey = keyof typeof COPY.en;

/**
 * What each vendor's free tier actually is, in one sentence.
 *
 * Deliberately free of hard numbers: every vendor counts quota in a different
 * unit (requests per day, tokens per model per day, project credits) and the
 * published limits move, so a stale figure in the UI is worse than a pointer to
 * the vendor's own docs, which is what each sentence ends with.
 *
 * The sentences themselves live in `COPY` (`noteGroq`, `noteNvidia`,
 * `noteAntigravity`) so they can be read in both languages side by side; this
 * table is only the provider → key lookup.
 */
const PROVIDER_NOTE_KEYS: Record<ProviderId, CopyKey> = {
  groq: "noteGroq",
  nvidia: "noteNvidia",
  antigravity: "noteAntigravity",
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
  const t = useCopy(COPY);
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
              {t.providerReady}
            </span>
          ) : (
            <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-mist-500">
              {t.providerNotInstalled}
            </span>
          )
        ) : item.keyHint ? (
          <span className="rounded-full border border-brand-700/60 bg-brand-500/10 px-2 py-0.5 font-mono text-[10px] text-brand-200">
            {item.keyHint}
          </span>
        ) : (
          <span className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-mist-500">
            {t.providerNoKey}
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
  const t = useCopy(COPY);
  // The "checked 3 minutes ago" chip is time prose, not copy, so it takes the
  // language straight from the switcher.
  const lang = useLang();
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
      const resolved = target ?? ((provider || DEFAULT_PROVIDER_ID) as ProviderId);
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
              text: `${payload.providerLabel ?? resolved} ${t.modelsReturned} ${payload.models.length} ${t.modelUnitUsable}.`,
            });
          }
        } else {
          setMessage({ tone: "error", text: payload.error ?? t.modelsFailed });
        }
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : t.serverUnreachable,
        });
      } finally {
        setBusy(null);
      }
    },
    [provider, t],
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

  const activeProvider = (provider || DEFAULT_PROVIDER_ID) as ProviderId;
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
  const activeNote = t[PROVIDER_NOTE_KEYS[activeProvider]];

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
      setMessage({ tone: "error", text: t.healthFailed });
    } finally {
      setBusy(null);
    }
  }, [applyStatus, t]);

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
        setMessage({ tone: "error", text: t.keyRequired });
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
            text: payload.error ?? payload.validation?.message ?? t.checkFailed,
          });
          return;
        }

        if (payload.validation.model) setModel(payload.validation.model);
        setMessage({
          tone: "ok",
          text: payload.saved
            ? wantsCli
              ? `${payload.validation.message} ${t.savedAsPrimary}`
              : `${payload.validation.message} ${t.savedToEnv}`
            : `${payload.validation.message}${t.dryRunNote}`,
        });
        // Nothing was written for a CLI provider, so there is no key to refill.
        if (payload.saved && !wantsCli) {
          void loadStoredKey((provider || DEFAULT_PROVIDER_ID) as ProviderId);
        }
      } catch (error) {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : t.unknownError,
        });
      } finally {
        setBusy(null);
      }
    },
    [activeIsCli, applyStatus, baseUrl, baseUrlDirty, keyDraft, loadStoredKey, model, provider, t],
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
          ? { tone: "info", text: `${t.keyDeletedLead}${activeProviderLabel}${t.keyDeletedTail}` }
          : { tone: "error", text: payload.error ?? t.keyDeleteFailed },
      );
    } finally {
      setBusy(null);
    }
  }, [activeProvider, activeProviderLabel, applyStatus, provider, t]);


  // Keep the selected model in the dropdown even if the live list has not
  // loaded, and offer the *selected provider's* models — not the active
  // backend's — so switching provider in the UI is coherent. Ids with a
  // trust tick sort first so a refresh keeps the proven models on top;
  // everything else keeps its existing order (stable sort).
  const options = useMemo(() => {
    const trusted = new Set(activeProviderInfo?.trustedModels ?? []);
    return Array.from(
      new Set(
        [
          model,
          ...(liveModels[activeProvider] ?? []).map((item) => item.id),
          ...(activeProviderInfo?.modelChoices ?? []),
        ].filter((item): item is string => Boolean(item)),
      ),
    ).sort((a, b) => Number(trusted.has(b)) - Number(trusted.has(a)));
  }, [activeProvider, activeProviderInfo, liveModels, model]);

  const liveCount = liveModels[activeProvider]?.length ?? 0;

  /**
   * Ids that have written a complete lesson on this machine, per provider.
   *
   * Kept next to the options because the mark only means something in the same
   * list the user is choosing from: a green tick on an id in the dropdown says
   * "this exact model finished a real lesson here", and nothing else — it is
   * not a vendor rating, and an unmarked id is untested rather than broken.
   */
  const trustedModels = useMemo(
    () => new Set(activeProviderInfo?.trustedModels ?? []),
    [activeProviderInfo],
  );

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
      ? `${t.sourceLoggedIn}${status.cli.version ? ` · ${status.cli.version}` : ""}`
      : t.sourceNotLoggedIn
    : status?.keySource === "env"
      ? t.sourceShellEnv
      : status?.keySource === "file"
        ? t.sourceEnvFile
        : t.sourceNone;

  return (
    <div className="space-y-5">
      <header>
        <span className="chip">
          <IconKey className="h-3.5 w-3.5 text-gold-300" /> {t.headerChip}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
          {t.headerTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300 sm:text-base">
          {statusIsCli ? (
            <>
              {t.headerCliLead} <strong className="text-mist-100">Antigravity CLI</strong>{" "}
              {t.headerCliTail}
            </>
          ) : (
            <>
              {t.headerKeyLead} <strong className="text-mist-100">{t.headerKeyAction}</strong>.{" "}
              {t.headerKeyBeforeEnv} <code className="font-mono text-gold-200">.env</code>{" "}
              {t.headerKeyAfterEnv}
            </>
          )}
        </p>
      </header>

      {/* relative z-10: the model dropdown overflows this section, and every
          .panel has backdrop-blur (a stacking context), so without this the
          next section would paint over the open list and eat its clicks. */}
      <section className="panel relative z-10 space-y-4 p-5">
        {/* status — one compact row at the top of this card, instead of a
            six-cell grid or a section of its own. */}
        <div className="flex flex-wrap items-center gap-2">
          {status?.configured ? (
            <IconCircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
          ) : (
            <IconAlertTriangle className="h-4 w-4 shrink-0 text-gold-300" />
          )}
          <span className="text-sm font-semibold text-mist-100">
            {status?.providerLabel ?? "—"}
          </span>
          <span className="chip">
            {status?.configured
              ? statusIsCli
                ? t.statusAgentReady
                : t.statusHasKey
              : statusIsCli
                ? t.statusCliMissing
                : t.providerNoKey}
          </span>
          {!statusIsCli && status?.keyHint ? (
            <span className="chip font-mono">{status.keyHint}</span>
          ) : null}
          <span className="chip">{sourceLabel}</span>
          {status?.model ? <span className="chip font-mono">{status.model}</span> : null}
          <span className="chip">
            {status?.lastValidatedAt
              ? `${formatRelativeTime(status.lastValidatedAt, lang)} · ${
                  status.lastValidationOk ? t.statusOk : t.statusFailed
                }`
              : t.statusNeverChecked}
          </span>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            className="btn-ghost ml-auto"
            disabled={busy !== null}
          >
            {busy === "status" ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
            {t.statusRefresh}
          </button>
        </div>

        {status?.lastValidationMessage ? (
          <p className="text-xs leading-relaxed text-mist-400">
            {status.lastValidationMessage}
          </p>
        ) : null}

        <h2 className="text-sm font-semibold text-mist-100">
          {t.selectHeading}
        </h2>

        {/* Cloud providers — key-based, one card each. */}
        <div>
          <span className="label flex items-center gap-1.5">
            <IconCloud className="h-3.5 w-3.5 text-brand-300" /> {t.cloudGroup}
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
            <IconTerminal2 className="h-3.5 w-3.5 text-mist-400" /> {t.cliGroup}
          </span>
          {cliProviders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-700 bg-ink-950/40 px-3.5 py-3">
              <p className="text-xs leading-relaxed text-mist-400">
                {t.cliUnsupported}
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
                {t.getKey}{" "}
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
                <IconCircleCheck className="h-4 w-4 shrink-0 text-brand-300" />
              ) : (
                <IconAlertTriangle className="h-4 w-4 shrink-0 text-gold-300" />
              )}
              {cliReady
                ? `${t.cliInstalled}${activeProviderInfo?.cli?.version ? ` · ${activeProviderInfo.cli.version}` : ""}`
                : t.cliCommandMissing}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mist-500">
              {cliReady ? t.cliReadyHint : t.cliInstallHint}
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
                placeholder={activeProvider === "nvidia" ? "nvapi-…" : "gsk_…"}
                autoComplete="off"
                spellCheck={false}
                className="field"
              />
              <button
                type="button"
                onClick={() => setReveal((value) => !value)}
                className="btn-icon h-auto w-11 shrink-0"
                aria-label={reveal ? t.keyHide : t.keyShow}
              >
                {reveal ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-mist-500">
              {!keyReady
                ? t.keyReading
                : storedHintForActive
                  ? `${t.keyStored} ${storedHintForActive}.`
                  : t.keyMissing}
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className="label" htmlFor="provider-model">
              {t.modelDefault}
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
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
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
                  placeholder={t.modelSearch}
                  autoComplete="off"
                  spellCheck={false}
                  className="field pl-9 pr-9"
                />
                <IconChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
              </div>
              {modelOpen && modelMatches.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-ink-700 bg-ink-900 py-1 shadow-xl">
                  {modelMatches.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        onClick={() => pickModel(option)}
                        title={
                          trustedModels.has(option)
                            ? t.modelTrustedTitle
                            : undefined
                        }
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs ${
                          option === model
                            ? "bg-brand-500/12 text-mist-50"
                            : "text-mist-300 hover:bg-ink-850"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{option}</span>
                        {trustedModels.has(option) ? (
                          <span
                            aria-label={t.modelTrustedBadge}
                            title={t.modelTrustedBadge}
                            className="shrink-0 text-brand-300"
                          >
                            &#10003;
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {liveCount > 0 || trustedModels.size > 0 ? (
              <p className="mt-1.5 text-[11px] text-mist-500">
                {liveCount > 0 ? `${liveCount} ${t.modelUnit} ${activeProviderLabel}.` : null}
                {trustedModels.size > 0
                  ? `${t.modelTrustedNote} (${trustedModels.size}).`
                  : t.modelUntestedNote}
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
                  ? `${t.modelsAskLead} ${activeProviderLabel} ${t.modelsAskTail}`
                  : `${t.modelsNeedKeyLead} ${activeProviderLabel}${t.modelsNeedKeyTail}`
              }
            >
              {busy === "models" ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconRefresh className="h-4 w-4" />
              )}
              {t.modelsLoad}
            </button>
          </div>
        </div>

        {/* A CLI provider has no HTTP endpoint, so there is no base URL to
            point somewhere else. */}
        {!activeIsCli ? (
          <details className="rounded-xl border border-ink-700/70 bg-ink-950/50 px-3.5 py-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-mist-400">
              {t.advancedBaseUrl}
            </summary>
            <div className="mt-3">
              <label className="label" htmlFor="provider-base">
                {activeProvider === "nvidia" ? "NVIDIA_BASE_URL" : "GROQ_BASE_URL"}
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
                {t.baseUrlHint}
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
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconShieldCheck className="h-4 w-4" />
            )}
            {t.keySaveTest}
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            className="btn-ghost"
            disabled={busy !== null}
          >
            {busy === "check" ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
            {t.keyTestOnly}
          </button>
          {storedHintForActive && !activeIsCli ? (
            <button
              type="button"
              onClick={() => void deleteKey()}
              className="btn-ghost ml-auto border-ember-500/50 text-ember-400 hover:border-ember-400 hover:bg-ember-500/10"
              disabled={busy !== null}
            >
              {busy === "delete" ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconTrash className="h-4 w-4" />
              )}
              {t.keyDelete} {activeProviderLabel}
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
              <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
            ) : message.tone === "error" ? (
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
            ) : (
              <IconKey className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
            )}
            <span className="min-w-0 break-words">{message.text}</span>
          </p>
        ) : null}
      </section>


    </div>
  );
}

