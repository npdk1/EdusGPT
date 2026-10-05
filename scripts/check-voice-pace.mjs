// Per-scene pace fit: every slide must sound like the same speed at 1x.
//
// Guards the uneven-reading bug — one VieNeu voice read a 50-word slide in
// 11.2s and the next in 15.7s, so x1 sounded like x1 on one slide and ~x1.4
// on another. paceFitRate scales each clip to its slide (clamped), and this
// asserts the fit, the clamp, and the cases it must leave alone.
//
// Run with: node --experimental-strip-types --no-warnings scripts/check-voice-pace.mjs
import { paceFitRate } from "../src/lib/karaoke.ts";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// A clip that already fills its slide plays at exactly the chosen speed.
check("exact fit is untouched", near(paceFitRate(11.5, 13, 1), 1), `got ${paceFitRate(11.5, 13, 1)}`);

// 15.7s of voice in a 13s slide: 15.7/11.5 = 1.365, under the 1.4 ceiling, so
// it scales proportionally rather than capping. The ceiling has to cover
// teaching pace's 1/0.75 = 1.33 stretch, or a deck authored before the stretch
// cannot speak at its own new pace.
check(
  "long clip scales proportionally",
  near(paceFitRate(15.7, 13, 1), 15.7 / 11.5),
  `got ${paceFitRate(15.7, 13, 1)}`,
);
// Past the ceiling: a clip 2x its slide cannot be squeezed any further.
check("overrun speeds up capped", near(paceFitRate(30, 13, 1), 1.4), `got ${paceFitRate(30, 13, 1)}`);
check(
  "mild overrun scales proportionally",
  near(paceFitRate(12.5, 13, 1), 12.5 / 11.5),
  `got ${paceFitRate(12.5, 13, 1)}`,
);

// A short clip slows down to fill, floored at 0.8x; the skip-silence backstop
// takes what the floor leaves behind.
check("short clip slows down floored", near(paceFitRate(5, 13, 1), 0.8), `got ${paceFitRate(5, 13, 1)}`);

// The user's speed choice multiplies, never replaced.
check("base rate multiplies", near(paceFitRate(30, 13, 1.5), 1.5 * 1.4), `got ${paceFitRate(30, 13, 1.5)}`);
check("slow base keeps fit", near(paceFitRate(5, 13, 0.5), 0.5 * 0.8), `got ${paceFitRate(5, 13, 0.5)}`);

// Degenerate inputs play at the chosen speed rather than NaN or 0.
check("no timings means no fit", paceFitRate(0, 13, 1) === 1);
check("tiny slide means no fit", paceFitRate(10, 2, 1) === 1);
check("zero slide means no fit", paceFitRate(10, 0, 1) === 1);

// Uniform output: both reported slides end up speaking at the same pace.
const wps = (words, audio, slide) => words / (audio / paceFitRate(audio, slide, 1));
const a = wps(50, 11.2, 13);
const b = wps(51, 15.7, 13);
check("output pace is uniform", Math.abs(a - b) / Math.max(a, b) < 0.05, `${a.toFixed(2)} vs ${b.toFixed(2)} wps`);

// Must match NARRATION_WORDS_PER_SECOND in src/app/api/gemini/lesson/route.ts.
// Every engine is stretched to teaching pace before it leaves the TTS service
// (TEACHING_TEMPO in src/lib/server/tts.ts); measured after that stretch the
// same 55-word narration reads 14.7-15.7s, i.e. 3.5-3.7 wps.
const ESTIMATOR_WPS = 3.2;
const MEASURED_SLOW_WPS = 3.5;
check(
  "estimator covers measured slow end",
  ESTIMATOR_WPS / 1.3 <= MEASURED_SLOW_WPS,
  `${ESTIMATOR_WPS}/1.3 = ${(ESTIMATOR_WPS / 1.3).toFixed(2)} wps floor vs ${MEASURED_SLOW_WPS} measured`,
);

console.log(failures === 0 ? "\nAll pace checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
