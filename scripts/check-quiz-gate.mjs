// The quiz gate: a quiz slide must not end until it has been answered.
//
// Guards the two decisions behind the wait — where the playhead stops, and how
// long the answered slide then holds for reading. The stage only wires these to
// the clock, so this is where a wrong number shows up as "the deck skipped the
// question" or "the room sat through a blank slide".
//
// Run with: node --experimental-strip-types --no-warnings scripts/check-quiz-gate.mjs
import { quizHold, quizReadSeconds } from "../src/lib/lesson/quiz.ts";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const quizScene = (id, start, duration) => ({
  id,
  start,
  duration,
  quiz: {
    question: "2 + 2 bằng mấy?",
    options: [{ id: `${id}-a`, text: "4", isCorrect: true, explanation: "" }],
  },
});

// lesson, then quiz -> concept -> quiz -> summary
const lesson = {
  scenes: [
    { id: "cover", start: 0, duration: 10 },
    quizScene("q1", 10, 14),
    { id: "concept", start: 24, duration: 20 },
    quizScene("q2", 44, 8),
    { id: "summary", start: 52, duration: 10 },
  ],
};
const none = new Set();

// --- where the playhead stops ------------------------------------------------
const q1 = quizHold(lesson, 12, none);
check("quiz slide holds", q1 === 22, `got ${q1}`);
check("hold is inside the slide", q1 > lesson.scenes[1].start && q1 < lesson.scenes[1].start + lesson.scenes[1].duration, `hold ${q1}, slide 10-24`);
check("hold lands before the fade-out", lesson.scenes[1].start + lesson.scenes[1].duration - q1 === 2, `2s of slide left lit`);

// The hold is set the whole time the quiz is on screen, not only at its end, so
// the deck cannot be nudged past the gate by a rate or a dropped frame.
check(
  "hold is stable across the quiz slide",
  quizHold(lesson, 10, none) === q1 && quizHold(lesson, 21.9, none) === q1,
);

// A quiz already answered in this session does not re-arm when it is revisited,
// and answering one leaves the others gated.
const q1Done = new Set(["q1"]);
check("answered quiz does not hold", quizHold(lesson, 12, q1Done) === null);
check("answered quiz, revisited from the start", quizHold(lesson, 10.5, q1Done) === null);
check("answering one quiz does not open another", quizHold(lesson, 46, q1Done) === 50, `got ${quizHold(lesson, 46, q1Done)}`);

// Everything that is not an unanswered quiz runs free.
check("non-quiz slide runs", quizHold(lesson, 30, none) === null);
check("summary runs", quizHold(lesson, 55, none) === null);

// A slide too short to hold in gets no gate rather than a hold in the past.
const tiny = {
  scenes: [{ id: "q", start: 0, duration: 2.5, quiz: { question: "?", options: [] } }],
};
check("sub-floor slide is not gated", quizHold(tiny, 1, none) === null);

// A deck with no quiz at all never holds.
check("deck without quiz runs", quizHold({ scenes: [{ id: "a", start: 0, duration: 9 }] }, 1, none) === null);

// --- how long the answered slide holds for reading ---------------------------
check("no explanation still waits the minimum", quizReadSeconds(undefined) === 5);
check("blank explanation waits the minimum", quizReadSeconds("   ") === 5);
check("short explanation waits the minimum", quizReadSeconds("Vì 2 cộng 2 bằng 4.") === 5);

// Longer explanations earn more time, and the wait stays inside 5–10s.
const mid = quizReadSeconds("một ".repeat(20).trim());
check("medium explanation sits inside the range", mid > 5 && mid < 10, `${mid.toFixed(1)}s`);
check("long explanation waits the maximum", quizReadSeconds("word ".repeat(200)) === 10);
check(
  "reading time grows with the explanation",
  quizReadSeconds("word ".repeat(20)) > quizReadSeconds("word ".repeat(6)),
);
check("never below the minimum", quizReadSeconds("word") === 5);
check("never above the maximum", quizReadSeconds("word ".repeat(1000)) === 10);

console.log(failures === 0 ? "\nAll quiz gate checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
