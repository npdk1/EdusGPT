#!/usr/bin/env node
// Walks a document library and writes data/course-library.json — the map an
// agent reads before it opens a single document. The manifest is injected into
// every prompt (src/lib/ai/antigravity.ts readLibraryContext), so it stays
// small: path, subject, kind, size, date. No file contents.
//
//   node scripts/index-course-library.mjs            # default: ONLY_FOR_AI_TO_LEARN
//   node scripts/index-course-library.mjs --dir D:\Slide
//   node scripts/index-course-library.mjs --check    # CI: fail if the manifest is stale
//
// Subject and kind are inferred structurally, not hardcoded to one school: a
// *subject* is a directory, a *kind* is a filename convention. Machine-specific
// knowledge (rename a folder, label a subject, add a kind) goes in
// library.config.json — this file stays generic so the script works on any
// machine where somebody just drops documents into a folder.

import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const OUT_FILE = path.join(ROOT, "data", "course-library.json");

// --- library location ---------------------------------------------------------

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const LIBRARY_DIR = path.resolve(
  argValue("--dir") ?? process.env.COURSE_LIBRARY_DIR ?? path.join(ROOT, "ONLY_FOR_AI_TO_LEARN"),
);

// --- subject / kind inference -------------------------------------------------

/**
 * Folder names that sort a subject by kind rather than being the subject itself.
 * Vietnamese + English, because a dumped library mixes both.
 */
const BUCKET_DIRS =
  /^(lý thuyết|ly thuyet|ôn tập|on tap|ôn thi|on thi|bài tập|bai tap|slide|slides|tài liệu|tai lieu|lecture|lectures|notes|ghi chú|bài giảng|bai giang|đề cương|de cuong|sylabus|tập|tap|tham khảo|tham khao|references|bài tập về nhà|homework|lab|thí nghiệm|thi nghiem|thực hành|thuc hanh|ví dụ|vi du|example|examples|code|mẫu|mau)$/i;

const KIND_RULES = [
  // Order matters: the first match wins, so specific beats general.
  [/\b(ôn tập|on tap|review|revision|tổng kết|tong ket)\b/i, "ôn tập"],
  [/\b(bài tập|bai tap|baitap|exercise|problem set|worksheet)\b/i, "bài tập"],
  [/\b(đáp án|ap an|dap an|solution|answer key|giai phap)\b/i, "lời giải"],
  [/\b(matlab|code mẫu|code mau|notebook)\b/i, "tài liệu Matlab"],
  [/\b(chương|chuong|chapter|lecture|unit|phần|phan|part)\b/i, "slide chương"],
  [
    /\b(quy định|quy dinh|quy chếp|nội quy|hướng dẫn|quy trình|regulation|policy|mẫu|mau|form)\b/i,
    "quy chếp / biểu mẫu",
  ],
  [/\b(ioc|iocs|danh sách|danh sach|đánh sách|kết quả|ket qua)\b/i, "danh sách / kết quả"],
  [/\b(đề cương|de cuong|sylabus|chương trình|chuong trinh)\b/i, "đề cương"],
  [/\b(lý thuyết|ly thuyet|tổng hợp|tong hop|summary|tóm tắt)\b/i, "bài giảng"],
  [/\b(thí nghiệm|thi nghiem|lab)\b/i, "tài liệu thí nghiệm"],
];

function guessKind(relPath, fileName) {
  for (const [re, label] of KIND_RULES) if (re.test(relPath)) return label;
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "tài liệu";
  if (ext === ".md" || ext === ".txt") return "ghi chú";
  if (ext === "") return "tệp không đuôi";
  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) return "hình ảnh";
  if ([".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt"].includes(ext)) {
    return "văn bản";
  }
  return "tài liệu";
}

/**
 * Subject = nearest ancestor directory that is not a kind-bucket, with any
 * trailing "(...)" qualifier stripped. So
 *   "Hoc Ki 4/Kinh Te Dai Cuong (Cu)/Ly thuyet/Bai giang tong hop.pdf"
 * lands under "Kinh Te Dai Cuong", and a flat folder of PDFs lands under the
 * config's rootLabel. Walking bottom-up keeps related files together even when
 * the library is nested by term.
 */
function guessSubject(relPath, config) {
  const segments = relPath.split("/").slice(0, -1);
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i].replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!segment) continue;
    if (!BUCKET_DIRS.test(segment)) return segment;
  }
  return config.rootLabel ?? "(thư mục gốc)";
}

/** Folders whose contents are private by name — flagged so the tutor skips them. */
const SENSITIVE_DIR =
  /(chứa dữ cá nhân|chua du ca nhan|warning|private|confidential|bảo mật|bao mat|nội bộ)/i;

/** Optional per-machine overrides. Absent is fine: inference still works. */
async function readConfig() {
  const file = path.join(ROOT, "library.config.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    console.error(`Không đọc được library.config.json (bỏ qua): ${err.message}`);
    return {};
  }
}

// --- walk ---------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".codegraph", "__MACOSX"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "vi"))) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith("~$")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(full);
    files.push({
      // Always forward slashes: the manifest is read by a Node script, injected
      // into an agent prompt, and diffed by humans. One spelling for all three.
      path: path.relative(LIBRARY_DIR, full).split(path.sep).join("/"),
      bytes: info.size,
      updated: info.mtime.toISOString().slice(0, 10),
      sensitive: SENSITIVE_DIR.test(path.relative(LIBRARY_DIR, full)),
    });
  }
  return files;
}

// --- main ---------------------------------------------------------------------

async function main() {
  const check = process.argv.includes("--check");
  if (!existsSync(LIBRARY_DIR)) {
    console.error(`Không thấy thư viện: ${LIBRARY_DIR}`);
    console.error("Trỏ sang thư mục khác:  node scripts/index-course-library.mjs --dir <đường dẫn>");
    process.exit(1);
  }
  const config = await readConfig();

  const raw = await walk(LIBRARY_DIR);
  // Case-insensitive dedupe: Windows will not have told anyone these are
  // duplicates, and the agent would open both.
  const files = [];
  const seen = new Set();
  for (const file of raw) {
    const key = file.path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = path.posix.basename(file.path);
    files.push({
      ...file,
      name,
      subject: guessSubject(file.path, config),
      kind: guessKind(file.path, name),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, "vi"));

  const subjects = [];
  for (const file of files) {
    let entry = subjects.find((s) => s.subject === file.subject);
    if (!entry) subjects.push((entry = { subject: file.subject, files: [] }));
    entry.files.push(file.path);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    generator: "scripts/index-course-library.mjs",
    libraryDir: path.relative(ROOT, LIBRARY_DIR).split(path.sep).join("/"),
    fileCount: files.length,
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
    sensitiveCount: files.filter((f) => f.sensitive).length,
    subjects,
    files,
  };
  const json = `${JSON.stringify(manifest, null, 2)}\n`;

  if (check) {
    const current = existsSync(OUT_FILE) ? await readFile(OUT_FILE, "utf8") : "";
    // generatedAt is a timestamp, so comparing whole files would make --check
    // fail on every run — the check has to ignore it and compare content.
    const strip = (text) => {
      try {
        const parsed = JSON.parse(text);
        delete parsed.generatedAt;
        return JSON.stringify(parsed);
      } catch {
        return text;
      }
    };
    if (strip(current) !== strip(json)) {
      console.error(
        "data/course-library.json lệch với thư viện. Chạy: node scripts/index-course-library.mjs",
      );
      process.exit(1);
    }
    console.log(`data/course-library.json còn mới (${files.length} file).`);
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, json, "utf8");
  console.log(
    `Đã ghi ${path.relative(ROOT, OUT_FILE)} — ${files.length} file, ` +
      `${subjects.length} nhóm, ${(manifest.totalBytes / 1048576).toFixed(1)} MB.`,
  );
  for (const s of subjects) console.log(`  ${s.subject}: ${s.files.length}`);
  if (manifest.sensitiveCount) {
    console.log(`  ⚠ ${manifest.sensitiveCount} file trong thư mục đánh dấu private (sensitive).`);
  }
}

await main();