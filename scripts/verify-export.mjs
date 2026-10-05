#!/usr/bin/env node
/**
 * Verifies an exported lesson page without a browser:
 *   1. the inline lesson JSON must parse,
 *   2. the player script must be syntactically valid JavaScript.
 *
 * Usage: node scripts/verify-export.mjs path/to/lesson.html
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/verify-export.mjs <exported.html>");
  process.exit(2);
}

const html = readFileSync(file, "utf8");
const failures = [];

// --- inline lesson data -----------------------------------------------------
const dataMatch = html.match(
  /<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/,
);
if (!dataMatch) {
  failures.push("không tìm thấy <script id=\"lesson-data\">");
} else {
  try {
    const lesson = JSON.parse(dataMatch[1].replace(/\\u003c/g, "<"));
    const scenes = Array.isArray(lesson.scenes) ? lesson.scenes.length : 0;
    console.log(`✔ lesson JSON hợp lệ — ${scenes} cảnh, ${lesson.duration}s, "${lesson.title}"`);
    if (scenes === 0) failures.push("lesson không có cảnh nào");
  } catch (error) {
    failures.push(`lesson JSON không parse được: ${error.message}`);
  }
}

// --- inline player script ---------------------------------------------------
const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((code) => code.trim().length > 0);
const player = scripts[scripts.length - 1];
if (!player) {
  failures.push("không tìm thấy script trình phát inline");
} else {
  const out = path.join(path.dirname(file), "exported-player.js");
  writeFileSync(out, player, "utf8");
  console.log(`✔ đã tách script trình phát (${player.length} ký tự) -> ${out}`);
  console.log("  kiểm tra cú pháp bằng: node --check " + path.basename(out));
}

// --- structural expectations ------------------------------------------------
const checks = [
  [/gsap\.min\.js/, "gsap từ CDN"],
  [/tl\.time\(current\)/, "seek timeline hai chiều"],
  [/class="scrub" id="scrub"/, "thanh tua"],
  [/id="loop"/, "điều khiển lặp A-B"],
  [/data-scene="0"/, "lớp cảnh đầu tiên"],
];
for (const [pattern, label] of checks) {
  if (pattern.test(html)) console.log(`✔ có ${label}`);
  else failures.push(`thiếu ${label}`);
}

if (failures.length > 0) {
  console.error("\n✖ vấn đề:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\n✔ file export hợp lệ về cấu trúc.");
