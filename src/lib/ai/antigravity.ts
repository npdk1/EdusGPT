import { execFile } from "node:child_process";
import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ProviderCredentials } from "./config";
import {
  findDegenerateText,
  isQuotaExhausted,
  repairJson,
} from "./gemini";
import type { ChatModelInfo } from "./openai-compatible";

const execFileAsync = promisify(execFile);

/** Binary name (override with AGY_BINARY if it is on PATH under another name). */
export const AGY_BINARY = process.env.AGY_BINARY?.trim() || "agy";

/**
 * Document library the local tutor teaches from. Same resolution order as
 * scripts/index-course-library.mjs, so the manifest always describes the folder
 * the agent is actually allowed to read.
 */
export const COURSE_LIBRARY_DIR = path.resolve(
  process.env.COURSE_LIBRARY_DIR?.trim() ||
    path.join(process.cwd(), "ONLY_FOR_AI_TO_LEARN"),
);
const COURSE_LIBRARY_MANIFEST = path.join(
  process.cwd(),
  "data",
  "course-library.json",
);

const VERSION_TIMEOUT_MS = 12_000;
const DEFAULT_GENERATION_TIMEOUT_MS = 300_000;
/**
 * Margin between the CLI's own print deadline and the kill Node applies. If
 * execFile fires first the whole process tree dies and the turn's work is lost;
 * letting `agy` hit its own deadline first means it still writes the envelope
 * (usually with `response: ""`) so the route can say "hết thời gian" instead of
 * "không trả về nội dung nào".
 */
const SHUTDOWN_MARGIN_MS = 15_000;

/** Model ids that already pin a reasoning level: `…-flash-high`, `…-pro-low`. */
const EFFORT_IN_MODEL_ID = /-(low|medium|high)$/;

const ENV_TRUE = /^(1|true|yes|on)$/i;

/**
 * Should a headless run auto-approve its own tools?
 *
 * `agy -p` has no terminal, so any tool the permission engine would ask about
 * is auto-denied and the turn dies with an empty `response`. The only way to
 * make a tool usable in headless mode is an allow-rule in `settings.json`
 * (`command(node scripts/extract-library-text.mjs)`) — and on Windows that does
 * not work: 1.2.14 still runs the old permission engine there (the unified one
 * is macOS/Linux only), which soft-denies every command tool in print mode no
 * matter what `permissions.allow` says. Verified on this machine: even the
 * broadest rule, `command(node)`, came back as
 * `denied_actions: [{action:"command"}]`.
 *
 * So on Windows the flag is passed by default; elsewhere the allow-rules written
 * by `scripts/antigravity-permissions.mjs` are enough. `ANTIGRAVITY_STRICT_PERMISSIONS=1`
 * turns the flag off everywhere on purpose — the app then relies purely on
 * allow-rules and reports a blocked tool as an error instead of retrying with
 * more freedom.
 */
export function skipsToolPermissions(): boolean {
  if (ENV_TRUE.test(process.env.ANTIGRAVITY_STRICT_PERMISSIONS ?? "")) return false;
  if (ENV_TRUE.test(process.env.ANTIGRAVITY_SKIP_PERMISSIONS ?? "")) return true;
  return process.platform === "win32";
}

let cachedAvailability: { available: boolean; version: string | null } | null =
  null;
let cachedAt = 0;
const AVAILABILITY_CACHE_MS = 60_000;

function runAgy(args: string[], timeoutMs: number) {
  return execFileAsync(AGY_BINARY, args, {
    cwd: process.cwd(),
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env },
  });
}

/**
 * Node builds an execFile error message by pasting the whole argv into it — and
 * argv here is the entire prompt, library map and system text, including the
 * list of files marked private. That string goes straight to the browser, so
 * anything thrown from runAgy is replaced with the CLI's own stderr (or a
 * generic message) before it leaves the server.
 */
function safeAgyError(error: unknown): string {
  const err = error as { stderr?: string; killed?: boolean; message?: string };
  if (err?.killed) {
    return "Antigravity CLI bị dừng vì vượt thời gian cho phép.";
  }
  const stderr = String(err?.stderr ?? "").trim();
  // CLI errors are short; anything long is argv echoed back.
  if (stderr && stderr.length <= 600) return stderr;
  const message = String(err?.message ?? "");
  const firstLine = message.split("\n")[0] ?? "";
  // `Command failed: agy …` — keep only the exit status, drop the command.
  const exit = firstLine.match(/\(exit code (\d+)\)/)?.[1];
  return exit
    ? `Antigravity CLI thất bại (exit code ${exit}).`
    : "Antigravity CLI không chạy được. Xem log của dev server để biết chi tiết.";
}

/**
 * `ANTIGRAVITY_DEBUG_LOG=<file>` appends the raw CLI envelope to a file.
 *
 * The headless envelope is the only place you can see what the agent actually
 * did (which tool it called, whether a tool output got truncated, whether a
 * permission was denied) — the app only sees the final string and an error, and
 * a blank `response` is otherwise indistinguishable from "the model gave up".
 */
async function debugLog(payload: string, label: string): Promise<void> {
  const target = process.env.ANTIGRAVITY_DEBUG_LOG?.trim();
  if (!target) return;
  const entry = `\n===== ${new Date().toISOString()} · ${label} =====\n${payload}\n`;
  await fs.appendFile(target, entry, "utf8").catch(() => undefined);
}

/** True when the `agy` binary responds — auth itself is a one-time local login. */
export async function isAntigravityAvailable(): Promise<boolean> {
  return (await describeAntigravity()).available;
}

export async function describeAntigravity(): Promise<{
  available: boolean;
  version: string | null;
}> {
  const now = Date.now();
  if (cachedAvailability && now - cachedAt < AVAILABILITY_CACHE_MS) {
    return cachedAvailability;
  }
  try {
    const { stdout } = await runAgy(["--version"], VERSION_TIMEOUT_MS);
    cachedAvailability = {
      available: true,
      version: stdout.trim().split("\n")[0]?.slice(0, 80) ?? null,
    };
  } catch {
    cachedAvailability = { available: false, version: null };
  }
  cachedAt = now;
  return cachedAvailability;
}

/**
 * Curated model list, matching what `agy models` actually reports on 1.2.12.
 * `auto` is the default: the agent picks per turn, which is what you want for a
 * tutor that sometimes quotes a slide verbatim and sometimes reasons.
 *
 * Deliberately not calling `agy models` per request: the adapter runs inside a
 * request handler and the list is stable between CLI upgrades. Run
 * `agy models` yourself if a new model shows up that isn't here.
 */
export function listAntigravityModels(creds: ProviderCredentials): ChatModelInfo[] {
  void creds;
  return ANTIGRAVITY_MODELS;
}

/**
 * A model the CLI does not know makes the whole turn fail with "invalid model
 * selection", and /setup has no live model list to validate against. Falling
 * back to `auto` keeps a stale `.env` or a hand-typed id from bricking every
 * question, and the run still works — the agent picks a model per turn.
 */
export function normaliseAntigravityModel(model: string | undefined): string {
  const id = (model ?? "").trim();
  if (!id || id === "auto") return "auto";
  return ANTIGRAVITY_MODELS.some((entry) => entry.id === id) ? id : "auto";
}

const ANTIGRAVITY_MODELS: ChatModelInfo[] = [
    {
      id: "auto",
      displayName: "Antigravity auto (agent tự chọn model)",
      methods: ["generate"],
    },
    {
      id: "gemini-3.8-flash-high",
      displayName: "Antigravity · Gemini 3.8 Flash (High)",
      methods: ["generate"],
    },
    {
      id: "gemini-3.8-flash-medium",
      displayName: "Antigravity · Gemini 3.8 Flash (Medium)",
      methods: ["generate"],
    },
    {
      id: "gemini-3.1-pro-high",
      displayName: "Antigravity · Gemini 3.1 Pro (High)",
      methods: ["generate"],
    },
    {
      id: "claude-sonnet-4-6",
      displayName: "Antigravity · Claude Sonnet 4.6",
      methods: ["generate"],
    },
    {
      id: "claude-opus-4-6-thinking",
      displayName: "Antigravity · Claude Opus 4.6 (Thinking)",
      methods: ["generate"],
    },
    {
      id: "gpt-oss-120b-medium",
      displayName: "Antigravity · GPT-OSS 120B (Medium)",
      methods: ["generate"],
    },
];

/** No API key exists for the CLI — readiness means the binary is installed. */
export async function validateAntigravity(model?: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const status = await describeAntigravity();
  if (!status.available) {
    return {
      ok: false,
      message:
        "Chưa thấy lệnh `agy` trên máy. Chạy scripts/install-antigravity.ps1 rồi đăng nhập một lần bằng `agy` (interactive), sau đó thử lại.",
    };
  }
  const requested = (model ?? "").trim();
  const known = requested && requested !== "auto"
    ? ANTIGRAVITY_MODELS.some((entry) => entry.id === requested)
    : true;
  const ready = `Antigravity CLI sẵn sàng (${status.version ?? "agy"} · ${ANTIGRAVITY_MODELS.length} model cấu hình, đăng nhập local đã có). Không cần API key.`;
  if (!known) {
    // Still "ready" — the CLI works — but say plainly that the pinned model is
    // not one we know, because every question would otherwise fail at the first
    // turn with an "invalid model selection" the setup screen never predicted.
    return {
      ok: true,
      message: `${ready} Lưu ý: model đang chọn "${requested}" không có trong danh sách — sẽ tự dùng "auto".`,
    };
  }
  return { ok: true, message: ready };
}

export interface AntigravityGenerateOptions {
  schema: Record<string, unknown>;
  system?: string;
  prompt: string;
  timeoutMs?: number;
  effort?: "low" | "medium" | "high";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Inline the library manifest so the agent knows which slide files exist. */
async function readLibraryContext(): Promise<string> {
  try {
    const raw = await fs.readFile(COURSE_LIBRARY_MANIFEST, "utf8");
    const manifest = asRecord(JSON.parse(raw));
    const files = Array.isArray(manifest?.files) ? manifest.files : [];
    const lines = files
      .map((entry) => {
        const item = asRecord(entry);
        if (!item) return null;
        const marker = item.sensitive === true ? " · private" : "";
        return `- ${String(item.path ?? "")} [${String(item.subject ?? "?")} · ${String(item.kind ?? "?")}${marker}]`;
      })
      .filter(Boolean)
      .slice(0, 200);
    if (lines.length === 0) return "";
    return [
      `Bản đồ thư viện tài liệu local (đường dẫn tương đối từ ${path.basename(COURSE_LIBRARY_DIR)}, tên thư mục trong ngoặc là project root):`,
      ...lines,
    ].join("\n");
  } catch {
    return "";
  }
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isFilledObject(value: unknown): boolean {
  const record = asRecord(value);
  return record !== null && Object.keys(record).length > 0;
}

/** True for the headless envelope, false for a bare JSON payload. */
function looksLikeEnvelope(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;
  return ["structured_output", "response", "conversation_id", "status"].some(
    (key) => key in record,
  );
}

function extractJsonPayload(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Antigravity CLI không trả về nội dung nào.");
  // Headless JSON envelope:
  //   { structured_output: {...}, response: "<json string>", ... }
  // `structured_output` is the schema-enforced field and is the one to trust:
  // `response` is the raw model text and routinely carries agent bookkeeping
  // keys (`toolAction`, `toolSummary`) that a schema with
  // additionalProperties:false forbids — sometimes the agent's final message is
  // those bookkeeping keys *instead of* the answer.
  const parsed = tryParseJson(trimmed);
  if (looksLikeEnvelope(parsed)) {
    const envelope = asRecord(parsed) as Record<string, unknown>;
    const structured = envelope.structured_output;
    if (isFilledObject(structured)) return structured;
    const response = envelope.response;
    // An empty string is *not* a payload: it is how the CLI reports a turn it
    // cut off (`--print-timeout`) or a tool it could not run. Returning it would
    // hand the route an empty scene and a "không sinh được bài giảng" with no
    // reason attached.
    if (typeof response === "string") {
      if (response.trim()) {
        const repaired = repairJson<unknown>(response);
        if (repaired !== null && repaired !== undefined) return repaired;
        throw new Error("Không parse được JSON trong envelope của Antigravity CLI.");
      }
    } else if (response !== undefined && response !== null) {
      return response;
    }
    // Nothing to read: either a blocked tool call or a turn that ran out of
    // wall clock. Both used to surface as an empty `{}` that the route happily
    // stored as scene content — a silently empty lesson instead of an error.
    throw new Error(
      permissionHint(envelope) ??
        emptyResponseHint(envelope) ??
        "Antigravity CLI không trả về nội dung nào.",
    );
  }
  if (parsed !== undefined) return parsed;
  const repaired = repairJson<unknown>(trimmed);
  if (repaired === null || repaired === undefined) {
    throw new Error("Không parse được JSON từ Antigravity CLI.");
  }
  return repaired;
}

/**
 * Runs one structured generation through the local agent (`agy -p`).
 * The edusgpt-local-tutor skill + library manifest are injected so the agent
 * teaches from the user's own slides instead of answering from memory.
 */
export async function generateAntigravityJson<T>(
  creds: ProviderCredentials,
  options: AntigravityGenerateOptions,
): Promise<T> {
  const status = await describeAntigravity();
  if (!status.available) {
    throw new Error(
      "Antigravity CLI chưa được cài (`agy` không khả dụng). Chạy scripts/install-antigravity.ps1 rồi đăng nhập một lần.",
    );
  }
  const libraryContext = await readLibraryContext();
  const extractor = path
    .join("scripts", "extract-library-text.mjs")
    .split(path.sep)
    .join("/");
  const composed = [
    options.system ? `SYSTEM:\n${options.system}` : "",
    "AGENT BRIEF — EdusGPT local tutor:",
    "- Đọc skill edusgpt-local-tutor trong .agents/skills/ và làm đúng workflow của nó.",
    "- Trả lời bằng tiếng Việt, và nội dung dạy học PHẢI bám tài liệu trong thư viện local dưới đây.",
    "",
    "ĐÃ CÓ SẴN TRONG PROMPT NÀY, ĐỪNG ĐI TÌM LẠI:",
    "- BẢN ĐỒ THƯ VIỆN ở cuối prompt này đã liệt kê TOÀN BỘ tài liệu kèm nhóm và loại. Không cần",
    "  mở lại data/course-library.json, không cần dò thư mục. Mở lại là lãng phí vài giây.",
    "- Schema JSON cũng đã kèm sẵn, cùng cấu trúc trả lời. Không cần đọc source code của app.",
    "",
    "CÁCH ĐỌC TÀI LIỆU (bắt buộc theo đúng thứ tự này):",
    "1. Chọn đúng file ngay trong BẢN ĐỒ THƯ VIỆN bên dưới (lọc theo nhóm + loại). Chỉ khi bản đồ",
    "   không rõ mới đọc data/course-library.json để xem đầy đủ — tối đa một lần.",
    `2. Tìm trang nói về ý bạn cần: \`node ${extractor} "<đường dẫn>" --find "<từ khoá>"\` — trả về danh sách "trang: tiêu đề", rẻ và không bị cắt.`,
    `3. Đọc đúng đoạn đó: \`node ${extractor} "<đường dẫn>" --from <trang> --to <trang>\`, mỗi lần 5-15 trang. Marker \`> Trang N/T\` là nơi trích dẫn nguồn.`,
    `   (Chỉ khi file ngắn mới bỏ qua bước 2 và đọc thẳng; --toc là phương án dự phòng, KHÔNG dùng cho file hàng trăm trang vì sẽ bị cắt.)`,
    "   TUYỆT ĐỐI KHÔNG tự mở và phân tích file PDF/DOCX bằng công cụ khác, KHÔNG dùng `node -e`: tốn hàng trăm nghìn token,",
    "   thường hết thời gian, và lệnh đó không nằm trong quyền được cấp nên bị chặn — làm hỏng cả lượt trả lời này.",
    "4. Nếu extractor báo file không tồn tại, đối chiếu lại đường dẫn với BẢN ĐỒ THƯ VIỆN ở trên rồi chạy lại. Đây là cách duy nhất được phép đọc tài liệu.",
    "",
    "GIỚI HẠN SỐ LẦN ĐỌC (quan trọng cho tốc độ):",
    "- Tối đa 3 lệnh đọc tài liệu cho một câu hỏi. Đọc đủ rồi thì trả lời, không lượn thêm.",
    "- Cấm tuyệt đối mọi lệnh ngoài `node scripts/extract-library-text.mjs`: git, git grep, grep, rg,",
    "  Get-ChildItem, dir, ls, npm, npx, python, `node -e`. Schema JSON đã nằm ngay trong prompt này",
    "  và cấu trúc trả lời cũng đã nêu — đọc source code của app chỉ là lãng phí thời gian, không thêm",
    "  thông tin gì. Các lệnh đó chạy được nên đừng thử: mỗi lần thử là vài giây và có thể làm hết giờ",
    "  cả lượt trả lời này.",
    "  Tương tự, KHÔNG dùng `search_web` hay bất kỳ công cụ nào đi online: câu hỏi của học sinh là",
    "  dữ liệu riêng của lớp học, không được gửi ra ngoài. Kiến thức chung thì bạn đã có sẵn.",
    "KHI MANIFEST KHÔNG CÓ MỤC NÀO KHỚP CÂU HỎI:",
    "- Dừng lại ngay, trả lời \"không có trong thư viện\" rồi dạy ở mức kiến thức chung. Đó là câu",
    "  trả lời ĐÚNG, không phải lúc đi khám phá thêm. Trần 6 lần gọi công cụ cho cả lượt này.",
    "- Đọc xong một trang thì tin nó, đừng xác nhận lại cùng trang đó bằng lệnh khác.",
    "- Mọi số liệu/công thức phải sao chép từ file và ghi kèm nguồn (số trang hoặc tên file). Không đoán, không gắn nguồn giả.",
    "- File dùng font cũ có thể bị sai dấu kiểu \"Chöông\" = \"Chương\": hiểu nghĩa qua công thức/số liệu, đừng trích nguyên văn chữ.",
    "- KÝ HIỆU TOÁN BỊ MẤT: dòng nào có nhãn `mất ký hiệu ∫ và ∑` thì ∫, ∬, ∑ và dấu giới hạn",
    "  trên/dưới đã bị mất ký tự. Số, biến, điện tích và miền tích trên dòng đó VẪN đọc được —",
    "  dùng chúng. Công thức thường bị cắt thành nhiều dòng nên phải nối lại trước khi kết luận.",
    "  Tuyệt đối không tự điền ký hiệu vào chỗ bị mất; nói thẳng là tài liệu mất ký hiệu đó.",
    "- File đánh dấu `private`: chỉ dùng để trả lời về quy định/thủ tục, tuyệt đối không lộ tên, MSSV, điểm số, điện thoại, địa chỉ.",
    libraryContext,
    "YÊU CẦU OUTPUT:",
    "- Chỉ trả về DUY NHẤT một JSON object hợp lệ khớp schema đính kèm, không markdown fence, không chữ thừa.",
    `JSON SCHEMA:\n${JSON.stringify(options.schema)}`,
    `TASK:\n${options.prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const timeoutMs = Math.min(
    options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS,
    DEFAULT_GENERATION_TIMEOUT_MS,
  );
  // The schema goes through a file, not argv: it is a few hundred characters of
  // JSON with quotes and Vietnamese text, and every shell layer between Node and
  // the CLI would have a chance to mangle it. agy accepts a path here.
  const schemaFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "edusgpt-agy-")),
    "schema.json",
  );
  await fs.writeFile(schemaFile, JSON.stringify(options.schema), "utf8");

  const args = [
    "-p",
    composed,
    "--output-format",
    "json",
    // Only when the folder is really there: --add-dir on a missing path makes
    // the CLI refuse the whole run.
    ...(existsSync(COURSE_LIBRARY_DIR) ? ["--add-dir", COURSE_LIBRARY_DIR] : []),
    "--json-schema",
    schemaFile,
    ...(skipsToolPermissions() ? ["--dangerously-skip-permissions"] : []),
  ];
  const model = normaliseAntigravityModel(creds.model);
  if (model && model !== "auto") args.push("--model", model);
  // Some model ids encode the effort level in the id itself (gemini-3.8-flash-high).
  // agy rejects the pair outright — "conflicts with --effort=medium" — and the
  // whole turn fails, so the flag is only sent when the model does not pin it.
  if (!EFFORT_IN_MODEL_ID.test(model)) {
    args.push("--effort", options.effort ?? "medium");
  }
  // Duration with a unit — `--print-timeout 180`, not `180000`.
  args.push(
    "--print-timeout",
    `${Math.max(30, Math.round((timeoutMs - SHUTDOWN_MARGIN_MS) / 1000))}s`,
  );

  let lastError: unknown = null;
  try {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      // Second try asks for the shape explicitly. A model that drifted usually
      // drifted on form, and naming the keys is enough to fix it.
      if (attempt === 2) {
        args[1] = `${composed}\n\nLẦN TRƯỚC CÂU TRẢ LỜI SAI ĐỊNH DẠNG. Trả về đúng JSON object với đúng các key trong schema, không thêm key khác, không markdown.`;
      }
      try {
        const { stdout } = await runAgy(args, timeoutMs);
        await debugLog(
          stdout,
          `attempt ${attempt}${skipsToolPermissions() ? " · skip-permissions" : ""}`,
        );
        const parsed = extractJsonPayload(stdout) as T;
        const degenerate = findDegenerateText(parsed);
        if (degenerate) {
          throw new Error(
            `Antigravity CLI trả về nội dung lặp/bất thường: “${degenerate}”. Hãy thử lại.`,
          );
        }
        return parsed;
      } catch (error) {
        const failure = new Error(safeAgyError(error));
        lastError = failure;
        await debugLog(`ERROR: ${String(error)}`, `attempt ${attempt}`);
        // A spent quota does not come back in a second. Retrying only doubles the
        // time the user waits before hearing the same news.
        if (isQuotaExhausted(failure.message)) break;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Antigravity CLI thất bại không rõ nguyên nhân.");
  } finally {
    await fs.rm(path.dirname(schemaFile), { recursive: true, force: true });
  }
}

/**
 * A denied tool action is the one failure the model cannot work around: headless
 * mode has no terminal to answer the prompt, so the turn just ends with an empty
 * response and a `denied_actions` list. Worth naming explicitly — otherwise the
 * user sees a generic "không trả về nội dung" with no idea a permission is missing.
 */
function permissionHint(envelope: Record<string, unknown>): string | null {
  const denied = envelope.denied_actions;
  if (!Array.isArray(denied) || denied.length === 0) return null;
  const names = denied
    .map((item) => String(asRecord(item)?.display_name ?? ""))
    .filter(Boolean);
  const advice = skipsToolPermissions()
    ? "Xoá ANTIGRAVITY_STRICT_PERMISSIONS khỏi .env để cho phép agent tự chạy lệnh đọc tài liệu."
    : "Chạy `node scripts/antigravity-permissions.mjs` để cấp quyền cho lệnh đọc tài liệu.";
  return (
    `Antigravity CLI bị chặn quyền tool (${names.join(", ") || "command"}) nên không trả lời được. ${advice}`
  );
}

/**
 * An empty response with no denial is almost always the print deadline: the
 * agent spent the whole turn reading slides and ran out of wall clock. Naming
 * that is actionable ("thử lại / hỏi hẹp hơn"), which "không trả về nội dung"
 * is not.
 */
function emptyResponseHint(envelope: Record<string, unknown>): string | null {
  // The envelope reports wall clock as `duration_seconds`, not `stats.duration`.
  const seconds = Number(envelope.duration_seconds ?? 0);
  if (seconds > 60) {
    return (
      `Antigravity CLI hết thời gian sau ${Math.round(seconds)}s khi đọc tài liệu. ` +
      "Hãy hỏi hẹp hơn (một khái niệm, một chương) hoặc thử lại — lượt này đã đọc nhiều tài liệu hơn cần thiết."
    );
  }
  return null;
}
