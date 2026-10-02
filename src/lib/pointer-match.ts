/**
 * Pure word-matching behind the teacher's pointer (see
 * `components/player/ScenePointer.tsx`). Kept DOM-free so the scoring can be
 * unit-tested against real narrations without a browser.
 *
 * Vietnamese lessons spell numbers and units out in the narration ("hai
 * mươi ki-lô-gam") while the slide shows digits and symbols ("20 kg"), so
 * raw word overlap finds nothing on data sentences and the pointer falls back
 * to the title on generic words ("ví dụ", "xe"). Both sides are therefore
 * normalised before comparing: unit phrases fold to their symbol, and number
 * phrases fold to digits.
 */

export interface PointerCandidate {
  key: string;
  text: string;
  /** Specific parts outrank the title on a tied score. */
  rank: number;
}

/** Folded for comparison: no diacritics, no case, letters and digits only. */
export function foldWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Function words that carry no pointing information. A sentence shares "và",
 * "của", "những" with every bullet on the slide, so counting them would point
 * at whichever part is longest rather than whichever is being read.
 */
export const STOPWORDS = new Set(
  "la va cua cac nhung mot cai da dang se voi cho tu trong tren duoi nay kia do day ma thi co khong duoc ve nhu hay hoac neu khi de cung rat hon nhat chi con lai vi nen nhung gi nao sao the vay ca moi ay oi nhe nha thua theo giua ngoai sau truoc tai boi den toi qua cung luon van tung phai chung ta ban minh toi em anh no ho cai giu doc".split(
    " ",
  ),
);

/**
 * Spoken unit phrases, longest first, folded to the symbol the slide shows.
 * "newton" folds in too: the person and the unit share the physics, and both
 * sides normalise the same way, so no side gains a spurious edge.
 */
const VI_UNIT_PHRASES: Array<{ tokens: string[]; symbol: string }> = [
  { tokens: ["met", "tren", "giay", "binh", "phuong"], symbol: "ms" },
  { tokens: ["met", "tren", "giay"], symbol: "ms" },
  { tokens: ["ki", "lo", "gam"], symbol: "kg" },
  { tokens: ["kilo", "gam"], symbol: "kg" },
  { tokens: ["kilogam"], symbol: "kg" },
  { tokens: ["niu", "ton"], symbol: "n" },
  { tokens: ["niuton"], symbol: "n" },
  { tokens: ["newton"], symbol: "n" },
  { tokens: ["met"], symbol: "m" },
  // "giây" (second) and "giấy" (paper) fold together; lessons time physics
  // far more often than they stationery it, and slides write "s".
  { tokens: ["giay"], symbol: "s" },
];

function applyUnits(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched: { length: number; symbol: string } | null = null;
    for (const phrase of VI_UNIT_PHRASES) {
      if (phrase.tokens.length > tokens.length - i) continue;
      let ok = true;
      for (let k = 0; k < phrase.tokens.length; k += 1) {
        if (tokens[i + k] !== phrase.tokens[k]) {
          ok = false;
          break;
        }
      }
      if (ok && (!matched || phrase.tokens.length > matched.length)) {
        matched = { length: phrase.tokens.length, symbol: phrase.symbol };
      }
    }
    if (matched) {
      out.push(matched.symbol);
      i += matched.length;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out;
}

const VI_ONES: Record<string, number> = {
  mot: 1,
  hai: 2,
  ba: 3,
  bon: 4,
  nam: 5,
  sau: 6,
  bay: 7,
  tam: 8,
  chin: 9,
};

/** Tokens that only ever appear inside a spoken number (never start one). */
const VI_FILLER = new Set(["linh", "le", "lam"]);

/**
 * "sau" is "after" far more often than "six", and "nam" is "year" far more
 * often than "five" — they only count as numbers inside a clear number
 * neighbourhood (next to mươi/trăm/một đơn vị…), otherwise they keep their
 * old behaviour (stopword / plain word).
 */
const VI_NUMBER_NEIGHBOURS = new Set([
  "muoi",
  "tram",
  "nghin",
  "ngan",
  "lam",
  "linh",
  "le",
  "mot",
  "hai",
  "ba",
  "bon",
  "nam",
  "sau",
  "bay",
  "tam",
  "chin",
  "kg",
  "m",
  "ms",
  "n",
  "s",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
]);

function isRunStart(token: string, next: string | undefined): boolean {
  if (/^\d+$/.test(token)) return false; // digits already match the slide
  if (token === "muoi" || token === "tram" || token === "nghin" || token === "ngan") {
    return true;
  }
  if (VI_ONES[token] !== undefined && token !== "sau" && token !== "nam") return true;
  if ((token === "sau" || token === "nam") && (next === "muoi" || next === "lam")) {
    return true;
  }
  return false;
}

function isRunPart(token: string, prev: string | undefined, next: string | undefined): boolean {
  if (VI_ONES[token] !== undefined) {
    if (token === "sau" || token === "nam") {
      return (
        (prev !== undefined && VI_NUMBER_NEIGHBOURS.has(prev)) ||
        (next !== undefined && VI_NUMBER_NEIGHBOURS.has(next))
      );
    }
    return true;
  }
  return (
    token === "muoi" ||
    token === "tram" ||
    token === "nghin" ||
    token === "ngan" ||
    VI_FILLER.has(token)
  );
}

/** Value of a tens group: [X] mươi [Y], "mươi" alone is ten, "lăm" is five. */
function parseTens(tokens: string[]): number | null {
  const clean = tokens.filter((token) => !VI_FILLER.has(token) || token === "lam");
  if (clean.length === 0) return null;
  const at = clean.indexOf("muoi");
  if (at === -1) {
    if (clean.length === 1 && VI_ONES[clean[0]] !== undefined) return VI_ONES[clean[0]];
    return null;
  }
  const head = clean.slice(0, at);
  const tail = clean.slice(at + 1);
  if (head.length > 1 || tail.length > 1) return null;
  const tens = head.length === 0 ? 1 : (VI_ONES[head[0]] ?? null);
  if (tens === null) return null;
  if (tail.length === 0) return tens * 10;
  const ones = tail[0] === "lam" ? 5 : (VI_ONES[tail[0]] ?? null);
  if (ones === null) return null;
  return tens * 10 + ones;
}

function parseSubThousand(tokens: string[]): number | null {
  const at = tokens.indexOf("tram");
  if (at === -1) return parseTens(tokens);
  const head = tokens.slice(0, at).filter((token) => token !== "linh" && token !== "le");
  const tail = tokens.slice(at + 1).filter((token) => token !== "linh" && token !== "le");
  if (head.length > 1) return null;
  const hundreds = head.length === 0 ? 1 : (VI_ONES[head[0]] ?? null);
  if (hundreds === null) return null;
  if (tail.length === 0) return hundreds * 100;
  const rest = parseTens(tail);
  return rest === null ? null : hundreds * 100 + rest;
}

function parseViRun(tokens: string[]): number | null {
  const atNghin = tokens.findIndex((token) => token === "nghin" || token === "ngan");
  if (atNghin !== -1) {
    const head = tokens.slice(0, atNghin);
    const tail = tokens.slice(atNghin + 1);
    const high = head.length === 0 ? 1 : parseSubThousand(head);
    if (high === null) return null;
    if (tail.length === 0) return high * 1000;
    const low = parseSubThousand(tail);
    return low === null ? null : high * 1000 + low;
  }
  return parseSubThousand(tokens);
}

/**
 * Folded number phrases ("hai mươi", "một trăm hai mươi") become one digit
 * token ("20", "120") so they meet the slide's digits. Runs without a
 * structure word (mươi/trăm/nghìn) map word by word; anything unparseable
 * passes through untouched rather than guessing.
 */
function applyNumbers(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isRunStart(tokens[i], tokens[i + 1])) {
      out.push(tokens[i]);
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < tokens.length &&
      isRunPart(tokens[j], tokens[j - 1], tokens[j + 1])
    ) {
      j += 1;
    }
    const run = tokens.slice(i, j);
    const structured = run.some(
      (token) => token === "muoi" || token === "tram" || token === "nghin" || token === "ngan",
    );
    if (!structured) {
      for (const token of run) {
        out.push(VI_ONES[token] !== undefined ? String(VI_ONES[token]) : token);
      }
    } else {
      const value = parseViRun(run);
      if (value === null) out.push(...run);
      else out.push(String(value));
    }
    i = j;
  }
  return out;
}

/** Roman numerals lessons actually use ("Định luật II" read as "định luật hai"). */
const VI_ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4" };

/** Content words of a text: folded, units and numbers normalised, minus stopwords. */
export function contentTokens(text: string): string[] {
  const folded = text
    .split(/\s+/)
    .map(foldWord)
    .filter((token) => token.length > 0)
    .map((token) => VI_ROMAN[token] ?? token);
  return applyNumbers(applyUnits(folded)).filter((token) => !STOPWORDS.has(token));
}

/**
 * The key of the slide part the sentence is actually about: whichever
 * candidate shares the most content words with it. Needs at least two shared
 * words — one is usually a coincidence (a lone "z", a lone "miền"), and below
 * that the AI cue and the hold-position fallbacks take over in the player.
 */
export function scoreCandidates(
  candidates: PointerCandidate[],
  sentenceText: string,
): string | null {
  const words = contentTokens(sentenceText);
  if (words.length === 0) return null;
  const spoken = new Set(words);

  let best: PointerCandidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const tokens = contentTokens(candidate.text);
    if (tokens.length === 0) continue;
    let shared = 0;
    const seen = new Set<string>();
    for (const token of tokens) {
      if (!seen.has(token) && spoken.has(token)) {
        seen.add(token);
        shared += 1;
      }
    }
    if (
      shared > bestScore ||
      (best && shared === bestScore && shared >= 2 && candidate.rank > best.rank)
    ) {
      best = candidate;
      bestScore = shared;
    }
  }
  if (!best || bestScore < 2) return null;
  return best.key;
}
