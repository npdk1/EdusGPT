// The quiz gate: a quiz slide must not end until it has been answered.
//
// Guards the two decisions behind the wait — where the playhead stops, and how
// long the answered slide then holds for reading. The stage only wires these to
// the clock, so this is where a wrong number shows up as "the deck skipped the
// question" or "the room sat through a blank slide".
//
// Run with: node --experimental-strip-types --no-warnings scripts/check-quiz-gate.mjs
import { quizHold, quizPraiseTier, quizQuestionTarget, quizQuestionsOf, quizReadSeconds, splitBankQuestions, spreadCorrectAnswers } from "../src/lib/lesson/quiz.ts";
import { mindmapFreshFrom, mindmapSnapshot } from "../src/lib/lesson/mindmap.ts";
import { coerceLesson } from "../src/lib/lesson/validate.ts";

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const quizScene = (id, start, duration) => ({
  id,
  start,
  duration,
  kind: "quiz",
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
  scenes: [{ id: "q", kind: "quiz", start: 0, duration: 2.5, quiz: { question: "?", options: [] } }],
};
check("sub-floor slide is not gated", quizHold(tiny, 1, none) === null);

// Only a quiz-kind scene has a quiz UI to answer, so a stray body on a concept
// scene must not arm the gate — that would stop the deck at a slide with no way
// to open it again.
const stray = {
  scenes: [
    {
      id: "x",
      kind: "concept",
      start: 0,
      duration: 8,
      quiz: { question: "?", options: [{ id: "a", text: "4", isCorrect: true }] },
    },
  ],
};
check("a stray quiz body on a concept scene never holds", quizHold(stray, 1, none) === null);

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
// The slide prints this number ("in Ns"); a fraction rendered as 8.333…s.
check("reading time is whole seconds", Number.isInteger(quizReadSeconds("word ".repeat(20))));

// --- quiz banks (quiz chặng + quiz tổng kết) --------------------------------
// The final quiz asks 10, 15 or 20 questions with the deck's length.
check("bank target: short deck asks 10", quizQuestionTarget(3) === 10 && quizQuestionTarget(5) === 10);
check("bank target: medium deck asks 15", quizQuestionTarget(6) === 15 && quizQuestionTarget(15) === 15);
check("bank target: long deck asks 20", quizQuestionTarget(16) === 20 && quizQuestionTarget(95) === 20);

// Old single-question quizzes read as a bank of one, so every mount keeps
// one shape. A filled bank is returned as-is.
const singleQuiz = { question: "2 + 2 = ?", options: [{ id: "a", text: "4", isCorrect: true }] };
check("single-question quiz reads as bank of one", quizQuestionsOf(singleQuiz).length === 1);
check("single-question quiz keeps its question", quizQuestionsOf(singleQuiz)[0].question === "2 + 2 = ?");
const bankTwo = [
  { question: "Câu 1?", options: singleQuiz.options },
  { question: "Câu 2?", options: singleQuiz.options },
];
check("filled bank is returned as-is", quizQuestionsOf({ ...singleQuiz, questions: bankTwo }) === bankTwo);
check("empty questions array falls back to the single question", quizQuestionsOf({ ...singleQuiz, questions: [] }).length === 1);

// --- mindmap snapshots (tóm tắt dần dần) --------------------------------------
// Snapshot j of total M grows branch by branch; branches added since the
// previous snapshot are marked fresh (freshFrom), never on the first map.
const branches = [
  { label: "A", items: ["a1", "a2"] },
  { label: "B", items: ["b1", "b2"] },
  { label: "C", items: ["c1", "c2"] },
  { label: "D", items: ["d1", "d2"] },
];
const snap0 = mindmapSnapshot(branches, 0, 4);
check("first mindmap shows only the first branch", snap0.branches.length === 1);
check("first mindmap has no fresh highlight", snap0.freshFrom === undefined);
const snap1 = mindmapSnapshot(branches, 1, 4);
check("second mindmap grows to two branches", snap1.branches.length === 2);
check("second mindmap marks the new branch fresh", snap1.freshFrom === 1);
const snapLast = mindmapSnapshot(branches, 3, 4);
check("final mindmap shows every branch", snapLast.branches.length === 4);
check("final mindmap still marks its new branch", snapLast.freshFrom === 3);
const snapOne = mindmapSnapshot(branches, 0, 1);
check("single-map deck shows everything at once", snapOne.branches.length === 4 && snapOne.freshFrom === undefined);
const snapFew = mindmapSnapshot([{ label: "A", items: ["a"] }], 1, 3);
check("fewer branches than maps still show one", snapFew.branches.length === 1);

// The bank and the mindmap ride the same gate as everything else: coerceLesson
// is the only door into the player, so it has to carry the new fields — and
// cap them, because a model that overshoots is the normal case.
const bankFixture = {
  title: "T",
  topic: "T",
  scenes: [
    {
      id: "s1",
      title: "Kiểm tra",
      kind: "quiz",
      duration: 12,
      quiz: {
        question: "2 + 2?",
        options: [{ id: "a", text: "4", isCorrect: true }],
        questions: [
          {
            question: "2 + 2?",
            options: [
              { id: "a", text: "4", isCorrect: true, explanation: "vì 2 + 2 = 4" },
              { id: "b", text: "5", isCorrect: false },
            ],
          },
          { question: "   ", options: [{ text: "x", isCorrect: false }] },
          { question: "Câu thiếu lựa chọn?", options: [] },
          null,
          ...Array.from({ length: 35 }, (_, i) => ({
            question: `Câu ${i + 1}?`,
            options: [
              { text: "a", isCorrect: i % 2 === 0 },
              { text: "b", isCorrect: i % 2 !== 0 },
            ],
          })),
        ],
      },
      mindmap: {
        branches: [
          { label: "Nhánh A", items: ["a1", "a2", "a3", "a4", "a5"] },
          { label: "   ", items: ["x"] },
          null,
          ...Array.from({ length: 7 }, (_, i) => ({ label: `N${i}`, items: ["i"] })),
        ],
      },
    },
  ],
};
const bankLesson = coerceLesson(bankFixture);
const bankScene = bankLesson?.scenes?.[0];
check("coerced lesson survives", !!bankLesson);
check("quiz keeps its question bank", bankScene?.quiz?.questions?.length === 30);
check(
  "empty questions are dropped before the cap",
  bankScene?.quiz?.questions?.every((q) => q.question.trim().length > 0),
);
check(
  "bank options are coerced like single-quiz options",
  bankScene?.quiz?.questions?.[0]?.options?.[0]?.id === "a" &&
    bankScene?.quiz?.questions?.[0]?.options?.[0]?.text === "4",
);
check("mindmap branches are capped", bankScene?.mindmap?.branches?.length === 6);
check("mindmap items per branch are capped", bankScene?.mindmap?.branches?.[0]?.items?.length === 4);
check(
  "blank mindmap branches are dropped",
  bankScene?.mindmap?.branches?.every((b) => b.label.trim().length > 0),
);
const singleLesson = coerceLesson({
  title: "T",
  scenes: [
    {
      id: "s1",
      title: "Q",
      kind: "quiz",
      duration: 10,
      quiz: {
        question: "2 + 2?",
        options: [
          { text: "4", isCorrect: true },
          { text: "5", isCorrect: false },
        ],
      },
    },
  ],
});
check("a single-question quiz keeps its old shape", singleLesson?.scenes?.[0]?.quiz?.questions === undefined);
const noMap = coerceLesson({
  title: "T",
  scenes: [{ id: "s1", title: "S", kind: "diagram", duration: 10, mindmap: { branches: [] } }],
});
check("an empty mindmap is dropped", noMap?.scenes?.[0]?.mindmap === undefined);

// The flat bank response arrives ordered: the checkpoints first, then the
// closing bank — the response schema subset has no nested arrays, so
// position is the contract. A model that overshoots or undershoots still
// yields a usable deck instead of an error.
const bankQuestions = Array.from({ length: 11 }, (_, i) => ({ question: `Câu ${i + 1}?`, options: [] }));
const splitTwo = splitBankQuestions(bankQuestions, [3, 3], 5);
check("flat bank splits into two checkpoints", splitTwo.checkpoints.length === 2);
check("first checkpoint takes the first three", splitTwo.checkpoints[0].length === 3);
check(
  "second checkpoint takes the next three",
  splitTwo.checkpoints[1].length === 3 && splitTwo.checkpoints[1][0] === bankQuestions[3],
);
check(
  "closing bank takes the rest up to target",
  splitTwo.final.length === 5 && splitTwo.final[0] === bankQuestions[6],
);
const splitShort = splitBankQuestions(bankQuestions.slice(0, 4), [3, 3], 10);
check(
  "a short bank still fills what it can",
  splitShort.checkpoints[0].length === 3 && splitShort.checkpoints[1].length === 1 && splitShort.final.length === 0,
);
const splitNone = splitBankQuestions([], [3], 10);
check(
  "an empty bank yields empty buckets",
  splitNone.checkpoints.length === 1 && splitNone.checkpoints[0].length === 0 && splitNone.final.length === 0,
);
const splitCap = splitBankQuestions(bankQuestions.slice(0, 8), [3], 5);
check("the closing bank never exceeds its target", splitCap.final.length === 5);

// --- where the fresh highlight starts on a recap -----------------------------
// The player marks what a recap added by comparing it with the previous recap
// in the deck, so the helper answers in branch counts: everything from the
// returned index on is new, `undefined` means nothing is.
const mapLesson = {
  scenes: [
    {
      id: "map-1",
      mindmap: {
        branches: [
          { label: "A", items: ["a1"] },
          { label: "B", items: ["b1"] },
          { label: "C", items: ["c1"] },
        ],
      },
    },
    { id: "plain" },
    {
      id: "map-2",
      mindmap: {
        branches: [1, 2, 3, 4, 5, 6].map((n) => ({ label: `N${n}`, items: [] })),
      },
    },
  ],
};
check("first recap has nothing fresh", mindmapFreshFrom(mapLesson, "map-1") === undefined);
check("a later recap treats the earlier branches as known", mindmapFreshFrom(mapLesson, "map-2") === 3);
check("a scene without a map marks nothing fresh", mindmapFreshFrom(mapLesson, "plain") === undefined);
check("an unknown scene marks nothing fresh", mindmapFreshFrom(mapLesson, "missing") === undefined);
check(
  "a lone recap marks nothing fresh",
  mindmapFreshFrom({ scenes: [{ id: "only", mindmap: { branches: [{ label: "A", items: [] }] } }] }, "only") ===
    undefined,
);

check(
  "questions that cannot be answered are dropped",
  bankScene?.quiz?.questions?.every((q) => q.options.length >= 2),
);
check(
  "mindmap branch junk is dropped, not crashed",
  bankScene?.mindmap?.branches?.every((b) => Boolean(b) && typeof b.label === "string"),
);

// The snapshot must not colour a branch that was already on the previous map:
// when a step shows nothing new, nothing is fresh.
const tieBranches = [
  { label: "A", items: ["a"] },
  { label: "B", items: ["b"] },
  { label: "C", items: ["c"] },
];
const tie = mindmapSnapshot(tieBranches, 2, 5);
check("a recap with no new branch marks nothing fresh", tie.freshFrom === undefined && tie.branches.length === 2);
const grow = mindmapSnapshot(tieBranches, 1, 5);
check("a recap with a new branch marks it fresh", grow.freshFrom === 1);

// --- praise tiers (85% / 60%, not "perfect or nothing") ----------------------
// A 9/10 run was once congratulated as if it were middling because the top
// tier demanded a perfect score; the thresholds live in one function now.
check("a perfect bank earns the top praise", quizPraiseTier(10, 10) === "excellent");
check("90% still earns the top praise", quizPraiseTier(9, 10) === "excellent");
check("80% earns the middle praise", quizPraiseTier(8, 10) === "good");
check("exactly 60% earns the middle praise", quizPraiseTier(6, 10) === "good");
check("below 60% earns the review note", quizPraiseTier(5, 10) === "review");
check("a 2/3 checkpoint earns the middle praise", quizPraiseTier(2, 3) === "good");

// --- correct answers must not all sit in position A --------------------------
// The real momentum run put all 18 first: a bank anyone beats by pressing A.
const flatBank = [0, 1, 2, 3].map((i) => ({
  question: `q${i}`,
  options: [
    { text: `right-${i}`, isCorrect: true },
    { text: `wrong-a-${i}`, isCorrect: false },
    { text: `wrong-b-${i}`, isCorrect: false },
    { text: `wrong-c-${i}`, isCorrect: false },
  ],
}));
const spreadBank = spreadCorrectAnswers(flatBank);
check(
  "spread moves the correct answer to index % length",
  spreadBank.every(
    (q, i) => q.options[i % 4].isCorrect === true && q.options.filter((o) => o.isCorrect).length === 1,
  ),
);
check(
  "spread keeps every option text",
  spreadBank.every((q, i) => q.options.length === 4 && q.options.some((o) => o.text === `right-${i}`)),
);
check("spread is idempotent", JSON.stringify(spreadCorrectAnswers(spreadBank)) === JSON.stringify(spreadBank));

// --- CJK characters must not leak into a Vietnamese lesson --------------------
// A real run wrote "số原子" for "số nguyên tử"; the gate strips glued runs.
const leaked = coerceLesson({
  title: "Toán học",
  language: "vi",
  scenes: [
    { id: "s1", kind: "concept", title: "Áp dụng quy tắc cân bằng số原子", duration: 20 },
  ],
});
check(
  "glued CJK is stripped from a Vietnamese lesson",
  leaked?.scenes[0]?.title === "Áp dụng quy tắc cân bằng số",
);
const spacedCjk = coerceLesson({
  title: "Toán học",
  language: "vi",
  scenes: [{ id: "s1", kind: "concept", title: "Chữ 中 đọc là gì", duration: 20 }],
});
check("a free-standing CJK token survives", spacedCjk?.scenes[0]?.title === "Chữ 中 đọc là gì");
const cjkLesson = coerceLesson({
  title: "中文课堂",
  language: "zh-CN",
  scenes: [{ id: "s1", kind: "concept", title: "原子的概念", duration: 20 }],
});
check("a zh-CN lesson keeps its characters", cjkLesson?.scenes[0]?.title === "原子的概念");

// --- an unanswerable quiz must not lock the gate -----------------------------
// A single question with fewer than two options can never enable Check, so
// the gate would rewind the deck at that slide forever. coerceLesson — the
// only door into the player — has to drop it instead.
const optionless = coerceLesson({
  title: "T",
  scenes: [
    {
      id: "s1",
      title: "Q",
      kind: "quiz",
      duration: 10,
      quiz: { question: "2 + 2?", options: [] },
    },
    {
      id: "s2",
      title: "Q2",
      kind: "quiz",
      duration: 10,
      quiz: {
        question: "Dự phòng?",
        options: [],
        questions: [
          {
            question: "2 + 2?",
            options: [
              { text: "4", isCorrect: true },
              { text: "5", isCorrect: false },
            ],
          },
        ],
      },
    },
  ],
});
check("a quiz nobody can answer is dropped", optionless?.scenes?.[0]?.quiz === undefined);
check("a bank-only quiz survives", optionless?.scenes?.[1]?.quiz?.questions?.length === 1);

console.log(failures === 0 ? "\nAll quiz gate checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
