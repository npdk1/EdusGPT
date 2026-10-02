#!/usr/bin/env node
/**
 * Generates a sample lesson straight from the CLI — handy for checking the
 * Gemini path without opening the browser.
 *
 * Prerequisite: the server running (`npm run dev` / `npm start`) and a key
 * saved through /setup.
 *
 *   node scripts/generate-sample.mjs [topic] [outfile]
 *
 * Writes pretty JSON to the output path (default: generated-lesson.json) and
 * prints which model answered plus the usage stats.
 */
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const topic = process.argv[2] ?? "Bảo toàn cơ năng trong chuyển động";
const outFile = process.argv[3] ?? "generated-lesson.json";
const model = process.argv[4] ?? "gemini-3.8-flash";

const body = {
  topic,
  subject: "Vật lí",
  grade: "Lớp 10",
  sceneCount: 5,
  minutes: 1.5,
  language: "Tiếng Việt",
  notes: "Nhiều ví dụ thực tế, nhắc lại công thức ở cảnh cuối.",
  model,
};

// SSE client, because the endpoint now streams `data:` frames instead of
// returning one JSON body.
const response = await fetch(`${BASE_URL}/api/gemini/lesson`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(240_000),
});

if (!response.ok) {
  const payload = await response.json().catch(() => null);
  console.error(`✖ ${response.status}`);
  console.error(payload?.error ?? "Không có phản hồi");
  process.exit(1);
}

const started = Date.now();
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let finalLesson = null;
let sawOutline = false;
let sceneCount = 0;

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const frames = buffer.split("\n\n");
  buffer = frames.pop() ?? "";

  for (const frame of frames) {
    const line = frame.split("\n").find((item) => item.startsWith("data:"));
    if (!line) continue;

    let event;
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }

    if (event.type === "stage") {
      if (event.stage === "outline-done" && event.outline) {
        sawOutline = true;
        sceneCount = event.outline.scenes.length;
        console.log(
          `  ▸ dàn ý sau ${((Date.now() - started) / 1000).toFixed(1)}s: ${sceneCount} cảnh`,
        );
      }
      process.stdout.write(`  · ${event.message}\n`);
    } else if (event.type === "scene") {
      process.stdout.write(`  · ${event.message}\n`);
    } else if (event.type === "done") {
      finalLesson = event.lesson;
    } else if (event.type === "error") {
      console.error(`✖ ${event.error ?? event.message}`);
      process.exit(1);
    }
  }
}

if (!finalLesson) {
  console.error("✖ Stream kết thúc mà không có bài giảng.");
  process.exit(1);
}

const lesson = finalLesson;
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

writeFileSync(outFile, `${JSON.stringify({ lesson, model }, null, 2)}\n`, "utf8");
console.log(`✔ ${elapsed}s — ${lesson.scenes.length} cảnh, ${lesson.duration}s, ${lesson.chapters.length} chương`);
console.log(`  dàn ý hiện sau ~5s: ${sawOutline ? "có" : "không"} · ${sceneCount} cảnh dự kiến`);
console.log(`  -> ${outFile}`);
for (const scene of lesson.scenes) {
  console.log(
    `  [${String(scene.start).padStart(5)}s +${String(scene.duration).padStart(4)}s] ${scene.kind.padEnd(8)} ${scene.title}` +
      `${scene.quiz ? ` [quiz ${scene.quiz.options.length} pt]` : ""}` +
      `${scene.simulation3d ? ` [3d ${scene.simulation3d.type}]` : ""}`,
  );
}
