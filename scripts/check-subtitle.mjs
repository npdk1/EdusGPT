// Temporary repro: confirms the two subtitle bugs at the library level.
/**
 * Subtitle regression check.
 *
 * Guards the two failures that made the caption look broken: a word highlight
 * that never lit anything, and a caption that never moved past its first
 * sentence. Both had the same cause — the voice's word boundaries were matched
 * one sentence at a time instead of against the whole narration — so both are
 * covered here, along with the cases that fix must not break: punctuation-heavy
 * text, a narration with no timings yet, and a stale header from another lesson.
 *
 * Run with: node --experimental-strip-types scripts/check-subtitle.mjs
 */
import {
  alignSentences,
  alignNarration,
  splitSentences,
  approximateWords,
  buildTrack,
  activeWordIndex,
} from "../src/lib/karaoke.ts";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const narration =
  "Các bạn ơi, chương trình đại học có rất nhiều môn học và kiến thức mới. " +
  "Bây giờ chúng ta sẽ tìm hiểu về mục tiêu học tập. " +
  "Một kế hoạch học tập rõ ràng giúp bạn tiến bộ nhanh hơn.";

const sentences = splitSentences(narration);

// Whole-narration marks, as the voice service would report them.
const marks = approximateWords(narration, 12);
console.log(`narration: ${sentences.length} sentences, ${marks.length} marks\n`);

// --- the word highlight --------------------------------------------------
// Every sentence must own timed words, and the timings must be spread across
// the audio rather than all sitting at its start.
const aligned = alignSentences(narration, marks);
for (const [i, line] of aligned.entries()) {
  const words = line.tokens.filter((t) => t.text.trim().length > 0);
  const lit = words.filter((t) => t.start !== null);
  check(
    `highlight: sentence ${i} lights words`,
    lit.length === words.length && words.length > 0,
    `${lit.length}/${words.length} lit`,
  );
}
const starts = aligned.map((s) => s.start);
check(
  "highlight: sentence starts are distinct and ascending",
  new Set(starts).size === starts.length &&
    starts.every((s, i) => i === 0 || (s !== null && starts[i - 1] !== null && s > starts[i - 1])),
  JSON.stringify(starts.map((s) => s?.toFixed(2))),
);

// The track built from a sentence's own tokens must light the right word.
const line2 = aligned[1];
const track2 = buildTrack(line2.tokens);
const firstWord = line2.tokens.find((t) => t.start !== null);
const mid = (firstWord.start + firstWord.end) / 2;
check(
  "highlight: activeWordIndex tracks the spoken word",
  activeWordIndex(track2, mid) !== -1 && track2.starts[0] !== undefined,
  `index ${activeWordIndex(track2, mid)} at ${mid.toFixed(2)}s`,
);

// --- the caption must move to the next sentence --------------------------
const sentenceAt = (time) => {
  if (aligned.length <= 1) return 0;
  let chosen = -1;
  for (let i = 0; i < aligned.length; i += 1) {
    const start = aligned[i].start;
    if (start === null) continue;
    if (start <= time) chosen = i;
    else break;
  }
  return chosen === -1 ? 0 : chosen;
};
const visited = new Set();
for (let t = 0; t <= 12; t += 0.05) visited.add(sentenceAt(t));
check(
  "caption: advances through every sentence",
  visited.size === aligned.length,
  `visited ${[...visited].join(",")} of 0..${aligned.length - 1}`,
);
check(
  "caption: hands over in order",
  aligned.every((l, i) => sentenceAt(l.start) === i),
);

// A caption line must read as the sentence, with no leading space carried over
// from the join between two of them.
check(
  "caption: lines carry no leading or trailing whitespace",
  aligned.every((l) => l.text === l.text.trim()),
  JSON.stringify(aligned.map((l) => l.text.slice(0, 12))),
);
check(
  "caption: reconstructed text is the narration, spaces aside",
  aligned.map((l) => l.tokens.map((t) => t.text).join("").trim()).join(" ") ===
    narration.replace(/\s+/g, " ").trim(),
);

// --- the old per-sentence path, for contrast ------------------------------
const oldLit = sentences.map((s) => {
  const t = alignNarration(s, marks);
  return t.filter((x) => x.start !== null).length;
});
check(
  "regression: old per-sentence alignment is what broke it",
  oldLit.every((n) => n === 0),
  `old path lit ${JSON.stringify(oldLit)} tokens`,
);

// --- no timings yet: caption must still render words ----------------------
const bare = alignSentences(narration, []);
check(
  "no timings: sentences and words still render",
  bare.length === aligned.length &&
    bare.every((l) => l.tokens.length > 0) &&
    bare.every((l) => l.start === null),
);
check("no timings: sentenceAt does not run off the end", sentenceAt(99) < bare.length);

// --- punctuation-heavy text must not be thrown away -----------------------
const punctuated =
  "Học kỹ, ôn luyện, kiểm tra, rồi tự đánh giá. Làm lại, nếu chưa hiểu. Hỏi bạn, ngay lập tức.";
const puncMarks = approximateWords(punctuated, 8);
const puncAligned = alignSentences(punctuated, puncMarks);
check(
  "punctuation-heavy: timings survive the coverage check",
  puncAligned.every((l) => l.start !== null),
  `marks ${puncMarks.length}, starts ${JSON.stringify(puncAligned.map((l) => l.start?.toFixed(2)))}`,
);

// --- a foreign mark list must be rejected, not mis-highlighted -------------
const foreign = approximateWords("Một câu hoàn toàn khác về chủ đề này.", 3);
const rejected = alignNarration(narration, foreign);
check(
  "stale header: mismatched marks fall back to plain",
  rejected.every((t) => t.start === null),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
