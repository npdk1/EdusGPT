/**
 * Picking the right slice of course material for each model call.
 *
 * Course PDFs front-load tables of contents: the first pages of the VTP2
 * exercise book are pure "Mục lục", so a head-only slice feeds the model two
 * numbered exercises in 12k chars and the outline rule "one example scene per
 * numbered exercise" starves. `skimReference` keeps the head (structure) whole
 * and spreads the rest of the budget as evenly-spaced windows, so exercises
 * from the middle of the book survive into the prompt. `…` marks the jumps.
 *
 * Stage 2 has the opposite problem: every scene gets the same 12k skim and
 * must fish out its own exercise. `sliceForScene` hands one scene its own
 * excerpt — the numbered exercise named in its goal, or the passage whose
 * words best match the goal — so the steps it writes come from the book, not
 * from memory. Pure functions, no dependencies, unit-tested against the real
 * VTP2 extract.
 */

/** Cut a window around `center`, snapped to line breaks so words survive. */
function windowAround(text: string, center: number, budget: number): string {
  let from = Math.max(0, center - Math.floor(budget / 2));
  let to = Math.min(text.length, from + budget);
  // Snapping the start forward can shrink a short tail to nothing; re-anchor.
  if (to - from < budget / 2 && from > 0) {
    from = Math.max(0, to - budget);
  }
  const nlBefore = text.lastIndexOf("\n", from);
  const nlAfter = text.indexOf("\n", to);
  if (nlBefore >= 0 && from - nlBefore < 200) from = nlBefore + 1;
  const end = nlAfter >= 0 && nlAfter - to < 200 ? nlAfter : to;
  return text.slice(from, end).trim();
}

export function skimReference(text: string, budget = 12000): string {
  if (text.length <= budget) return text;
  const head = 4000;
  const windows = 4;
  const windowSize = Math.floor((budget - head) / windows);
  const headEnd = text.lastIndexOf("\n", head);
  const parts = [text.slice(0, headEnd > 3000 ? headEnd : head)];
  const rest = text.slice(head);
  for (let i = 0; i < windows; i++) {
    const start = Math.floor((rest.length * i) / windows);
    parts.push(windowAround(rest, start + windowSize / 2, windowSize));
  }
  return parts.join("\n\n[…]\n\n");
}

const EXERCISE_MARKERS =
  /(bài\s*\d+|bài\s+tập|ví\s*dụ|tính\s|tìm\s+[a-zà-ỹ]|chứng minh|khảo sát|giải\s+(bài|phương|hệ))/i;

/** True when the scene claims to solve something — the steps rule applies. */
export function sceneSolvesExercise(title: string, goal: string): boolean {
  return EXERCISE_MARKERS.test(`${goal} ${title}`);
}

// Vietnamese content words are short ("cực trị", "đạo hàm"), so the length
// floor is 3, not 5 — and the generic classroom words that would then match
// every line ("học sinh hiểu điều kiện") are stopped out instead.
const GOAL_STOPWORDS = new Set(
  "học,sinh,hiểu,biết,điều,kiện,cách,trong,ngoài,những,các,của,và,là,một,với,trên,dưới,từ,đến,cho,có,không,được,này,đó,khi,nếu,thì,mà,phần,chương,mục,trang,bài,tập,ví,dụ,vd".split(
    ",",
  ),
);

/** Distinct topical words of the scene, for matching against the reference. */
function goalWords(title: string, goal: string): string[] {
  return Array.from(
    new Set(
      `${goal} ${title}`
        .toLowerCase()
        .split(/[^a-zà-ỹ0-9]+/i)
        .filter((w) => w.length >= 3 && !GOAL_STOPWORDS.has(w)),
    ),
  );
}

/** How many of the scene's words a passage shares — picks between repeats. */
function overlapScore(passage: string, words: string[]): number {
  const low = passage.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (low.includes(w)) score += 1;
  }
  return score;
}

/**
 * The excerpt of `reference` one scene should read before writing.
 * Numbered exercise named in the goal wins ("bài 8" -> the "8." passage);
 * otherwise the passage whose words best overlap the goal; "" when nothing
 * matches, in which case the scene falls back to the shared skim.
 */
export function sliceForScene(
  reference: string,
  title: string,
  goal: string,
  budget = 2500,
): string {
  if (!reference) return "";
  const words = goalWords(title, goal);

  // Exercise numbers repeat every chapter ("8." sits in six of them), so
  // every occurrence is scored against the goal and the best context wins.
  const num = /(?:bài(?:\s+tập)?|ví dụ|vd)\s*(\d{1,3})/i.exec(`${goal} ${title}`);
  if (num) {
    const pattern = new RegExp(`(^|\\n)\\s*${num[1]}\\s*[\\.\\)\\:]`, "gm");
    let bestAt = -1;
    let bestScore = -1;
    for (const match of reference.matchAll(pattern)) {
      const at = match.index ?? -1;
      if (at < 0) continue;
      const score =
        words.length === 0
          ? 0
          : overlapScore(reference.slice(Math.max(0, at - 600), at + 600), words);
      if (score > bestScore) {
        bestScore = score;
        bestAt = at;
      }
    }
    if (bestAt >= 0) return windowAround(reference, bestAt, budget);
  }

  if (words.length === 0) return "";
  let best = -1;
  let bestScore = 0;
  for (const match of reference.matchAll(/[^\n]{20,400}/g)) {
    const line = match[0] ?? "";
    // Table-of-contents lines pack every heading word plus dotted leaders
    // ("## 2.5 Cực trị của hàm hai biến . . . 40") and would outscore the
    // real passage every time; page markers carry no content either.
    if (/(\.\s*){4,}|^>\s*Trang/.test(line)) continue;
    const score = overlapScore(line, words);
    if (score > bestScore && match.index !== undefined) {
      bestScore = score;
      best = match.index;
    }
  }
  if (bestScore < 2 || best < 0) return "";
  return windowAround(reference, best, budget);
}

/**
 * Scenes that get their own excerpt: exercise solvers (verbatim problem
 * statement) and graph readers (the passage describing the curve). Concept
 * scenes keep the shared skim — handing them a "your passage is here"
 * excerpt they do not need invites force-fitting an irrelevant window.
 */
export function sceneNeedsExcerpt(title: string, goal: string): boolean {
  if (sceneSolvesExercise(title, goal)) return true;
  return /(đồ thị|tiệm cận|\bvẽ\b)/i.test(`${goal} ${title}`);
}
