#!/usr/bin/env node
/**
 * Palette guard.
 *
 * This project deliberately avoids purple-family colours (purple / violet /
 * indigo / fuchsia and the Tailwind-500 hexes behind them). Run `npm run
 * check:palette` to fail fast when one sneaks back into the source.
 *
 * Scanning `src/` only — this file obviously contains the banned words.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".md"]);

/** Case-insensitive word/phrase scan. */
const BANNED_WORDS = [
  "purple",
  "violet",
  "indigo",
  "fuchsia",
  "magenta",
  "orchid",
  "lavender",
  "byzantium",
];

/** Tailwind purple/violet/indigo/fuchsia ramp hexes (400-700). */
const BANNED_HEX = [
  "8b5cf6",
  "7c3aed",
  "6d28d9",
  "5b21b6",
  "a855f7",
  "9333ea",
  "7e22ce",
  "6366f1",
  "4f46e5",
  "4338ca",
  "818cf8",
  "a78bfa",
  "c084fc",
  "d946ef",
  "c026d3",
  "a21caf",
  "e879f9",
  "f0abfc",
];

function walk(directory, out = []) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry);
    if (entry === "node_modules" || entry === ".next") continue;
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, out);
    } else if (EXTENSIONS.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const relative = path.relative(process.cwd(), file);
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const lower = line.toLowerCase();
      for (const word of BANNED_WORDS) {
        if (lower.includes(word)) {
          hits.push({ file: relative, line: index + 1, what: word, text: line.trim() });
        }
      }
      for (const hex of BANNED_HEX) {
        if (lower.includes(`#${hex}`) || lower.includes(`0x${hex}`)) {
          hits.push({ file: relative, line: index + 1, what: `#${hex}`, text: line.trim() });
        }
      }
    });
  }
}

if (hits.length > 0) {
  console.error(
    `\n✖ Phát hiện ${hits.length} chỗ dùng màu thuộc họ tím. Bảng màu của dự án chỉ có blue / gold / ink.\n`,
  );
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}  [${hit.what}]  ${hit.text.slice(0, 110)}`);
  }
  console.error("\nSửa thành token có sẵn: brand-*, gold-*, ember-*, ink-*, mist-*.\n");
  process.exit(1);
}

console.log("✔ palette OK - khong co mau ho tim trong src/ (blue / gold / ink / ember).");
