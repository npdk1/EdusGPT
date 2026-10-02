#!/usr/bin/env node
// Prints the text of one library document as markdown with page markers, so a
// headless agent can read a slide deck in one cheap command instead of parsing
// the PDF itself.
//
//   node scripts/extract-library-text.mjs "<path>" --find "tích phân phân thức"
//   node scripts/extract-library-text.mjs "<path>" --toc
//   node scripts/extract-library-text.mjs "<path>" --from 12 --to 20
//   node scripts/extract-library-text.mjs "<path>" --max-chars 40000
//   node scripts/extract-library-text.mjs --all            # xuất hết ra data/library-text/
//
// --find là bước đầu tiên của agent: "trang nào nói về X", trả về vài dòng rẻ.
// Sau đó mới đọc đúng đoạn đó bằng --from/--to. Đọc cả 300 trang một lượt sẽ bị
// Antigravity cắt output, và agent hay phản ứng sai bằng cách tự parse PDF
// (lệnh đó không nằm trong allow-rule nên bị chặn, cả lượt hỏi hỏng).
//
// Why a command instead of a read tool: Antigravity's headless mode auto-denies
// file/command tools unless an allow-rule matches. A single narrow rule —
// `command(regex:node scripts/extract-library-text\.mjs .*)` — is enough for the
// whole tutor to work, which is a far smaller grant than blanket
// --dangerously-skip-permissions.
//
// Output shape matches src/lib/server/extract.ts so both paths read the same:
//   # <name>
//   > Trang 3/24
//   ## Tiêu đề slide
//   nội dung...

import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST = path.join(ROOT, "data", "course-library.json");
const CACHE_DIR = path.join(ROOT, "data", "library-text");
// Antigravity cắt output tool (~200 dòng) và model sẽ tự bịa lệnh để đọc tiếp
// khi thấy dấu "ĐÃ CẮT". Nên mặc định phải nhỏ vừa đủ cho một đoạn bài.
const DEFAULT_MAX_CHARS = 20_000;

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Rejects anything that escapes the library folder. */
function libraryDir() {
  const fromEnv = process.env.COURSE_LIBRARY_DIR?.trim();
  return path.resolve(fromEnv || path.join(ROOT, "ONLY_FOR_AI_TO_LEARN"));
}

async function loadManifest() {
  if (!existsSync(MANIFEST)) return null;
  try {
    return JSON.parse(await readFile(MANIFEST, "utf8"));
  } catch {
    return null;
  }
}

/** Markdown headings so an agent can jump between slides instead of wading. */
function markdownHeadings(page) {
  return page
    .split("\n")
    .map((line) => {
      const text = line.trim();
      if (text.length < 3 || text.length > 120) return line;
      if (/^\d+(\.\d+)*[.)]?\s+\S/.test(text)) return `## ${text}`;
      const letters = text.replace(/[^A-Za-zÀ-ỹ]/g, "");
      if (letters.length >= 8 && letters === letters.toUpperCase()) {
        return `## ${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * Slide decks are full of footer noise — a date plus a slide counter
 * ("5/10/2014 22"). Two of them on a page bury the actual content, so drop the
 * ones that are literally nothing but date + number.
 */
const FOOTER_NOISE = /^\s*\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}\s+\d{1,4}\s*$/;

function stripFooters(text) {
  const kept = text
    .split("\n")
    .filter((line) => !FOOTER_NOISE.test(line));
  return kept.join("\n");
}

function tidy(raw) {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Vietnamese uppercase letters that pdf.js would emit for a *correctly* mapped
// font. Anything else in the À-Þ range (Û, Ñ, Ö, Ø, Ä …) is a look-alike: the
// slide used a legacy VNI/TCVN3 font with no ToUnicode table. See
// src/lib/server/vietnamese.ts — the byte→letter mapping is per font, so it is
// deliberately not "fixed" here; the tutor just gets told not to quote verbatim.
const VALID_UPPER = "ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĐĂĨŨƠƯ";
const SUSPECT_UPPER = /[À-Þ]/g;

function hasLegacyFontDamage(text) {
  const sample = text.slice(0, 20_000);
  const bad = (sample.match(SUSPECT_UPPER) ?? []).filter(
    (ch) => !VALID_UPPER.includes(ch),
  ).length;
  return bad >= 8;
}

// Ký tự toán vỡ. Font toán tự vẽ (Symbol / Mathematical Pi) không có bảng
// ToUnicode nên pdf.js trả về ký tự vô nghĩa: ∫ và ∬ thành "න"/"ඵ", ∑ thành
// "෍", dấu ngoặc giới hạn trên/dưới thành "׬"/"׭", và một ký tự nữa thành "ሼ".
// Đo trên Bài giảng tổng hợp.pdf trang 150-200: "න" x91, "׬" x35, "෍" x8 —
// tức gần như mọi tích phân trong file đều mất ký hiệu.
//
// CỐ TÌNH KHÔNG SỬA thành ký hiệu đúng. Một phép sửa đoán sai còn tệ hơn im
// lặng: dòng đó trông sạch, model tin là toán đúng rồi dạy lại cho học sinh —
// đúng kiểu bịa đã xảy ra thật (một câu trả lời từng dựng ra ∫(9−y²)dA trên
// [0;4]×[0;2] rồi gắn số trang có thật). Thay vào đó đánh dấu đúng dòng hỏng để
// agent biết phải nói ra là không đọc được, chứ không đoán.
const BROKEN_MATH_CHARS = /[න෍ඵצ׭ሼ]/;
const BROKEN_MATH_MARK = "[mất ký hiệu ∫ và ∑]";

function hasBrokenMath(text) {
  return BROKEN_MATH_CHARS.test(text);
}

/** Gắn nhãn vào đúng dòng nào hỏng, để cảnh báo nằm cạnh chỗ cần đọc. */
function markBrokenMath(text) {
  if (!hasBrokenMath(text)) return text;
  return text
    .split("\n")
    .map((line) =>
      BROKEN_MATH_CHARS.test(line) && !line.includes(BROKEN_MATH_MARK)
        ? `${line}  ${BROKEN_MATH_MARK}`
        : line,
    )
    .join("\n");
}
/** Strips Vietnamese diacritics so "tích phân" also finds "tich phan". */
function foldDiacritics(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * @param options.toc   bảng "trang → tiêu đề" (rẻ, để chọn trang cần đọc)
 * @param options.from  1-based; @param options.to 1-based, inclusive
 * @param options.find  từ khoá; in ra các trang có chứa nó kèm dòng khớp
 */
async function fromPdf(bytes, options = {}) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  // unpdf rejects a Node Buffer outright ("provide binary data as Uint8Array").
  // A Buffer IS a Uint8Array, so the copy has to be explicit — sharing the
  // buffer view still hands pdf.js a Buffer.
  const view = Uint8Array.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  );
  // pdf.js font warnings ("TT: undefined function") land on stdout and would
  // bury the markdown we want the agent to read; verbosity 0 silences them.
  const doc = await getDocumentProxy(view, { verbosity: 0 });
  // unpdf >= 1.x returns { totalPages, text } — `text` is a per-page array when
  // mergePages is off, which is what keeps the page citations honest.
  const { totalPages: total, text: pages } = await extractText(doc, {
    mergePages: false,
  });

  const pageText = (index) =>
    tidy(stripFooters(typeof pages[index] === "string" ? pages[index] : ""));

  if (options.find) {
    // The question an agent actually has is "which page talks about X", and a
    // 300-page deck has too many pages for --toc to survive the CLI's tool-output
    // truncation. Search answers that directly and costs one pass.
    //
    // Matching is per word, not per phrase: slide text wraps mid-sentence, so
    // "tích phân phân thức" is very rarely on one line and a phrase search would
    // come back empty for the most obvious query.
    const terms = [...new Set(
      foldDiacritics(options.find).toLowerCase().split(/\s+/).filter(Boolean),
    )];
    const haystacks = [];
    for (let i = 0; i < total; i += 1) haystacks.push(foldDiacritics(pageText(i)).toLowerCase());

    // Require every term, then relax by dropping the term that matches the most
    // pages — a query like "tích phân phân thức" should still find the section if
    // the wording differs slightly.
    let active = terms;
    let matches = [];
    while (true) {
      matches = [];
      for (let i = 0; i < total; i += 1) {
        if (!haystacks[i]) continue;
        if (active.every((term) => haystacks[i].includes(term))) matches.push(i);
      }
      if (matches.length > 0 || active.length <= 1) break;
      const counts = active.map((term) => ({
        term,
        n: haystacks.filter((h) => h.includes(term)).length,
      }));
      counts.sort((a, b) => b.n - a.n);
      active = active.filter((term) => term !== counts[0].term);
    }

    // Collapse runs of consecutive pages: a 40-page section is one range, not 40
    // lines, which is the difference between useful output and a truncated one.
    const ranges = [];
    for (const page of matches) {
      const last = ranges[ranges.length - 1];
      if (last && page === last[1] + 1) last[1] = page;
      else ranges.push([page, page]);
    }
    const rows = ranges.slice(0, 12).map(([a, b]) => {
      const sample = pageText(a).split("\n").find((line) => line.trim().length > 8) ?? "";
      const label = a === b ? `trang ${a + 1}` : `trang ${a + 1}-${b + 1}`;
      return `- ${label}: ${sample.trim().slice(0, 100)}`;
    });
    const hidden = ranges.length - rows.length;
    if (hidden > 0) {
      rows.push(`- …và ${hidden} đoạn nữa khớp từ khoá (thử từ khoá cụ thể hơn).`);
    }
    return {
      text: rows.length
        ? rows.join("\n")
        : `Không tìm thấy "${options.find}". Thử từ khoá khác hoặc xem --toc.`,
      pages: total,
      search: options.find,
    };
  }

  if (options.toc) {
    const rows = [];
    for (let i = 0; i < total; i += 1) {
      const body = pageText(i);
      if (!body) continue;
      const heads = markdownHeadings(body)
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => line.slice(3).trim());
      const firstLine = body.split("\n").find((line) => line.trim().length > 2);
      const label = heads.slice(0, 3).join(" · ") || (firstLine ?? "").slice(0, 90);
      rows.push(`- trang ${i + 1}: ${label || "(trang trắng)"}`);
    }
    return { text: rows.join("\n"), pages: total, toc: true };
  }

  const from = Math.max(1, options.from ?? 1);
  const to = Math.min(total, options.to ?? total);
  const parts = [];
  for (let i = from - 1; i < to; i += 1) {
    const body = pageText(i);
    if (!body) continue;
    // The page marker is the citation anchor the tutor quotes back.
    parts.push(`> Trang ${i + 1}/${total}\n\n${markdownHeadings(body)}`);
  }
  return {
    text: parts.join("\n\n---\n\n"),
    pages: total,
    range: [from, to],
  };
}

async function fromDocx(bytes) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return { text: tidy(result.value), pages: undefined };
}

async function fromXlsx(bytes) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "buffer" });
  const rows = [];
  for (const name of wb.SheetNames.slice(0, 5)) {
    const sheet = wb.Sheets[name];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    rows.push(`## ${name}`);
    for (const row of grid.slice(0, 12)) rows.push(row.join(" | "));
  }
  return { text: rows.join("\n"), pages: undefined };
}

async function extractFile(fullPath, name, maxChars, options = {}) {
  const bytes = await readFile(fullPath);
  const ext = path.extname(name).toLowerCase();
  let out;
  if (ext === ".pdf") out = await fromPdf(bytes, options);
  else if (ext === ".docx") out = await fromDocx(bytes);
  else if (ext === ".xlsx" || ext === ".xls") out = await fromXlsx(bytes);
  else out = { text: bytes.toString("utf8"), pages: undefined };

  // Đánh dấu trước khi rẽ nhánh, để cả --find, --toc và đọc trang đều mang nhãn.
  if (typeof out.text === "string" && hasBrokenMath(out.text)) {
    out.text = markBrokenMath(out.text);
    out.mathDamage = true;
  }

  if (out.toc || out.search) {
    const meta = out.search
      ? [
          `# Kết quả tìm "${out.search}" — ${name}`,
          `> nguồn: ${path.relative(ROOT, fullPath).split(path.sep).join("/")}`,
          `> tổng số trang: ${out.pages ?? "?"}`,
          `> Cách đọc: gọi lại với --from <trang> --to <trang> cho các trang ở trên.`,
        ]
      : [
          `# Mục lục — ${name}`,
          `> nguồn: ${path.relative(ROOT, fullPath).split(path.sep).join("/")}`,
          `> tổng số trang: ${out.pages ?? "?"}`,
          `> Cách đọc: chọn đúng trang rồi gọi lại với --from <trang> --to <trang>.`,
        ];
    // A 300-page TOC is itself too big for the CLI's tool-output limit, which
    // makes the agent invent a different command to read the rest. Cap it and
    // point at --find, which is the tool that actually scales.
    const cap = 80;
    const lines = out.text.split("\n");
    const shown = lines.slice(0, cap);
    const hidden = lines.length - shown.length;
    const tail =
      hidden > 0
        ? `\n\n[${hidden} dòng nữa bị bỏ qua — dùng --find "<từ khoá>" để lọc nhanh hơn]`
        : "";
    return {
      text: `${meta.join("\n")}\n\n${shown.join("\n")}${tail}\n`,
      pages: out.pages,
      truncated: hidden > 0,
    };
  }

  const meta = [
    `# ${name}`,
    `> nguồn: ${path.relative(ROOT, fullPath).split(path.sep).join("/")}`,
  ];
  if (out.pages) meta.push(`> tổng số trang: ${out.pages}`);
  if (out.range && (out.range[0] > 1 || out.range[1] < out.pages)) {
    meta.push(`> đang hiển thị trang ${out.range[0]}-${out.range[1]} / ${out.pages}`);
  }
  if (hasLegacyFontDamage(out.text)) {
    meta.push(
      "> LƯU Ý: file dùng font cũ (VNI/TCVN3) nên chữ tiếng Việt bị decode sai kiểu " +
        "\"Chöông\" = \"Chương\". Hãy hiểu nghĩa qua công thức, số liệu và cấu trúc; " +
        "đừng trích nguyên văn chữ từ file này.",
    );
  }
  if (out.mathDamage) {
    meta.push(
      `> KÝ HIỆU TOÁN BỊ MẤT: font toán trong file này không có bảng ToUnicode nên ∫, ∬, ∑ ` +
        `và dấu giới hạn trên/dưới bị decode thành ký tự vô nghĩa. Dòng nào có ${BROKEN_MATH_MARK} ` +
        `là dòng đó. Trên dòng ấy vẫn đọc được số, biến, điện tích và miền tích — chỉ mất ký ` +
        `hiệu tích phân. Công thức hay bị cắt thành nhiều dòng, nên nối các dòng lại trước khi ` +
        `kết luận. Tuyệt đối không tự điền ký hiệu vào chỗ bị mất.`,
    );
  }
  const header = `${meta.join("\n")}\n\n`;

  const truncated = out.text.length > maxChars;
  let body = out.text;
  if (truncated) {
    // Nói rõ cách đọc tiếp, nếu không model sẽ tự bịa một lệnh khác để parse PDF
    // (lệnh đó không có trong allow-rule nên bị Antigravity chặn, cả lượt hỏi hỏng).
    const hint = out.pages
      ? `\n\n[ĐÃ CẮT — dùng --from/--to để đọc tiếp, --find "<từ khoá>" để tìm trang, --toc để xem mục lục]`
      : `\n\n[ĐÃ CẮT — dùng --max-chars lớn hơn hoặc đọc file .docx bằng công cụ khác]`;
    body = `${out.text.slice(0, maxChars)}${hint}`;
  }
  return {
    text: `${header}${body}`,
    pages: out.pages,
    truncated,
  };
}

/** Cache filename: a short hash keeps it filesystem-safe for any name. */
async function cacheName(relPath) {
  const { createHash } = await import("node:crypto");
  return `${createHash("sha1").update(relPath).digest("hex").slice(0, 12)}.md`;
}

async function main() {
  const maxChars = Number(argValue("--max-chars", DEFAULT_MAX_CHARS));
  const all = process.argv.includes("--all");
  const toc = process.argv.includes("--toc");
  const from = argValue("--from", null);
  const to = argValue("--to", null);
  const find = argValue("--find", null);
  const options = {
    toc,
    find: find ?? undefined,
    from: from ? Number(from) : undefined,
    to: to ? Number(to) : undefined,
  };
  if ((from && !Number.isFinite(options.from)) || (to && !Number.isFinite(options.to))) {
    console.error("--from/--to phải là số trang (1-based).");
    process.exit(1);
  }
  const lib = libraryDir();

  if (all) {
    if (!existsSync(lib)) {
      console.error(`Không thấy thư viện: ${lib}`);
      process.exit(1);
    }
    // No truncation here. --all writes a reading copy of the whole library for
    // humans (and for grep), so cutting a 308-page deck at 20k characters would
    // make the file look complete while silently dropping most of it. The agent
    // path always goes through --find/--from/--to, which never hits this cap.
    await mkdir(CACHE_DIR, { recursive: true });
    const manifest = await loadManifest();
    const relPaths = manifest?.files?.map((f) => f.path) ?? null;
    if (relPaths) {
      let ok = 0;
      let failed = 0;
      const index = [];
      for (const rel of relPaths) {
        const full = path.join(lib, rel);
        if (!existsSync(full)) continue;
        const ext = path.extname(rel).toLowerCase();
        if (![".pdf", ".docx", ".xlsx", ".xls"].includes(ext)) continue;
        try {
          const out = await extractFile(full, path.basename(rel), Number.POSITIVE_INFINITY);
          const cache = await cacheName(rel);
          await writeFile(path.join(CACHE_DIR, cache), out.text, "utf8");
          index.push({
            cache,
            source: rel,
            chars: out.text.length,
            pages: out.pages ?? null,
          });
          ok += 1;
          console.log(`ok   ${rel} (${out.text.length} ký tự${out.pages ? `, ${out.pages} trang` : ""})`);
        } catch (err) {
          failed += 1;
          console.error(`FAIL ${rel}: ${err.message}`);
        }
      }
      console.log(`\nXuất ${ok} file vào data/library-text/ (${failed} lỗi).`);
      // The cache filenames are hashes, so without this index nobody can tell
      // which file is which — and the whole point of --all is a copy a human
      // can open or grep.
      await writeFile(
        path.join(CACHE_DIR, "index.json"),
        `${JSON.stringify(
          {
            note:
              "Bản trích xuất đầy đủ của thư viện. Dùng để đọc/grep offline; " +
              "agent đọc tài liệu qua `node scripts/extract-library-text.mjs` với --find/--from/--to.",
            generatedAt: new Date().toISOString(),
            files: index,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      console.log("Ghi data/library-text/index.json (hash → tên file gốc).");
      return;
    }
    // No manifest: walk the folder directly.
    const files = (await readdir(lib, { withFileTypes: true })).filter(
      (entry) =>
        entry.isFile() &&
        [".pdf", ".docx", ".xlsx", ".xls"].includes(
          path.extname(entry.name).toLowerCase(),
        ),
    );
    for (const entry of files) {
      const out = await extractFile(
        path.join(lib, entry.name),
        entry.name,
        Number.POSITIVE_INFINITY,
      );
      await writeFile(path.join(CACHE_DIR, await cacheName(entry.name)), out.text, "utf8");
      console.log(`ok   ${entry.name}`);
    }
    return;
  }

  const rel = process.argv[2];
  if (!rel) {
    console.error(
      'Cách dùng: node scripts/extract-library-text.mjs "<đường dẫn trong thư viện>" --find "<từ khoá>"\n' +
        '           node scripts/extract-library-text.mjs "<đường dẫn>" --toc\n' +
        '           node scripts/extract-library-text.mjs "<đường dẫn>" --from 12 --to 20\n' +
        '           node scripts/extract-library-text.mjs "<đường dẫn>" --max-chars 40000\n' +
        "           node scripts/extract-library-text.mjs --all",
    );
    process.exit(1);
  }

  const full = path.resolve(lib, rel);
  const relative = path.relative(lib, full);
  // Traversal guard: an agent passing "../../.env" must not read it.
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    console.error(`Đường dẫn nằm ngoài thư viện: ${rel}`);
    process.exit(1);
  }
  if (!existsSync(full)) {
    console.error(`Không thấy file trong thư viện: ${rel}`);
    console.error("Đọc data/course-library.json để lấy đúng đường dẫn.");
    process.exit(1);
  }

  const info = await stat(full);
  const out = await extractFile(full, path.basename(relative), maxChars, options);
  if (!out.text.trim()) {
    console.error(`File không có lớp text (có thể là PDF scan): ${relative}`);
  }
  console.log(`> file: ${relative}`);
  console.log(`> bytes: ${info.size}`);
  if (out.truncated) console.log("> lưu ý: nội dung bị cắt theo --max-chars");
  console.log("");
  console.log(out.text);
}

await main();