/**
 * Pure word-matching and semantic scoring behind the teacher's pointer (see
 * `components/player/ScenePointer.tsx`).
 *
 * Vietnamese lessons spell numbers, decimals, and units out in the narration
 * ("hai mươi ki-lô-gam", "một phẩy năm đơn vị") while the slide shows digits
 * and symbols ("20 kg", "1,5 đơn vị").
 *
 * This algorithm normalises:
 * 1. Unit phrases ("ki-lô-gam" -> "kg", "mét trên giây" -> "ms").
 * 2. Decimal numbers ("một phẩy năm" -> "15", "hai phẩy ba" -> "23").
 * 3. Spoken numbers ("mười lăm", "một trăm hai mươi").
 * 4. Compound terms and domain bigrams ("sao mộc", "trái đất", "sao hỏa", "mặt trời",
 *    "bán kính", "đồng tâm", "xa nhất", "chu kỳ", "bước một").
 * 5. Discriminative candidate scoring (IDF): tokens unique to a single candidate
 *    carry much higher weight than topic-wide common words.
 * 6. AI cue synchronization & temporal continuity priors.
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
 * Splits a full narration text into grammatical sentences using terminal punctuation
 * (. ! ? … or newlines). This reflects the teacher's logical idea boundaries,
 * unlike caption fragmentation which splits at arbitrary commas for screen width.
 */
export function splitGrammaticalSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?…])\s+/);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * Function words that carry no pointing information. A sentence shares "và",
 * "của", "những" with every bullet on the slide, so counting them would point
 * at whichever part is longest rather than whichever is being read.
 */
export const STOPWORDS = new Set(
  "la va cua cac nhung mot cai da dang se voi cho tu trong tren duoi nay kia do day ma thi co khong duoc ve nhu hay hoac neu khi de cung rat hon nhat chi con lai vi nen nhung gi nao sao the vay ca moi ay oi nhe nha thua theo giua ngoai sau truoc tai boi den toi qua cung luon van tung phai chung ta ban minh toi em anh no ho cai giu doc vao".split(
    " ",
  ),
);

/**
 * Spoken unit phrases, longest first, folded to the symbol the slide shows.
 */
const VI_UNIT_PHRASES: Array<{ tokens: string[]; symbol: string }> = [
  { tokens: ["met", "tren", "giay", "binh", "phuong"], symbol: "ms" },
  { tokens: ["met", "tren", "giay"], symbol: "ms" },
  { tokens: ["ki", "lo", "met"], symbol: "km" },
  { tokens: ["kilo", "met"], symbol: "km" },
  { tokens: ["ki", "lo", "gam"], symbol: "kg" },
  { tokens: ["kilo", "gam"], symbol: "kg" },
  { tokens: ["kilogam"], symbol: "kg" },
  { tokens: ["niu", "ton"], symbol: "n" },
  { tokens: ["niuton"], symbol: "n" },
  { tokens: ["newton"], symbol: "n" },
  { tokens: ["phan", "tram"], symbol: "pt" },
  { tokens: ["met"], symbol: "m" },
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
  khong: 0,
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

/**
 * Folds spoken decimals like "một phẩy năm", "1 phẩy 5", "2 chấm 3" into compact
 * digit tokens "15", "23" so they match written "1,5", "2.3" (which foldWord reduces to "15", "23").
 */
function foldDecimals(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const after = tokens[i + 2];
    if ((next === "phay" || next === "cham") && after !== undefined) {
      const d1 = /^\d+$/.test(t)
        ? t
        : VI_ONES[t] !== undefined
          ? String(VI_ONES[t])
          : null;
      const d2 = /^\d+$/.test(after)
        ? after
        : VI_ONES[after] !== undefined
          ? String(VI_ONES[after])
          : null;
      if (d1 !== null && d2 !== null) {
        out.push(`${d1}${d2}`);
        i += 3;
        continue;
      }
    }
    out.push(t);
    i += 1;
  }
  return out;
}

/** Tokens that only ever appear inside a spoken number (never start one). */
const VI_FILLER = new Set(["linh", "le", "lam"]);

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
  "km",
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
  if (/^\d+$/.test(token)) return false;
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
const VI_ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };

/** Ordinal and step normalizations */
const VI_ORDINALS: Record<string, string> = {
  dau: "1",
  nhat: "1",
  hai: "2",
  ba: "3",
  tu: "4",
  nam: "5",
  sau: "6",
  bay: "7",
  tam: "8",
  chin: "9",
};

/** Content words of a text: folded, decimals, units, and numbers normalised, minus stopwords. */
export function contentTokens(text: string): string[] {
  const folded = text
    .split(/\s+/)
    .map(foldWord)
    .filter((token) => token.length > 0)
    .map((token) => VI_ROMAN[token] ?? token);
  const withDecimals = foldDecimals(folded);
  return applyNumbers(applyUnits(withDecimals)).filter((token) => !STOPWORDS.has(token));
}

/**
 * Extracts 2-word domain bigrams from text (e.g. "sao_moc", "trai_dat", "ban_kinh", "xa_nhat").
 */
export function extractBigrams(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map(foldWord)
    .filter((w) => w.length > 0);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    const w1 = words[i];
    const w2 = words[i + 1];
    // Keep bigram if at least one word is not a stopword
    if (!STOPWORDS.has(w1) || !STOPWORDS.has(w2)) {
      bigrams.push(`${w1}_${w2}`);
    }
  }
  return bigrams;
}

export interface ScoreOptions {
  /** Target suggested by the AI-generated pointer cue for this sentence. */
  cueTarget?: string | null;
  /** Previously held target in this scene, used for smooth temporal continuity. */
  previousTarget?: string | null;
}

/**
 * The key of the slide part the sentence is actually about.
 *
 * Employs a multi-signal discriminative scoring model:
 * 1. Inverse Document Frequency (IDF): Tokens that appear in only 1 candidate
 *    are unique discriminators and carry ~3.5x higher weight than words that
 *    appear across many bullets.
 * 2. Domain Bigrams: Matching full compound phrases ("sao mộc", "trái đất", "bán kính")
 *    grants a decisive bonus (+3.0).
 * 3. AI Cue Alignment: If the lesson's generated cue points to a candidate, it acts
 *    as a semantic prior (+2.5).
 * 4. Temporal Continuity: Light bias (+0.6) towards holding the current point or progressing
 *    forward rather than jumping backwards erratically.
 */
export function scoreCandidates(
  candidates: PointerCandidate[],
  sentenceText: string,
  options?: ScoreOptions,
): string | null {
  if (candidates.length === 0) return null;

  const spokenTokens = contentTokens(sentenceText);
  if (spokenTokens.length === 0 && !options?.cueTarget) return null;

  const spokenTokenSet = new Set(spokenTokens);
  const spokenBigramSet = new Set(extractBigrams(sentenceText));

  // Compute Document Frequency (DF) across candidates
  const candidateTokenSets = candidates.map((c) => new Set(contentTokens(c.text)));
  const docFreq = new Map<string, number>();
  for (const tokenSet of candidateTokenSets) {
    for (const t of tokenSet) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }

  let best: PointerCandidate | null = null;
  let bestScore = 0;

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const candidate = candidates[idx];
    const cTokens = contentTokens(candidate.text);
    const cBigrams = extractBigrams(candidate.text);

    let score = 0;

    // 1) Weighted Unigram Matches (IDF weighting)
    const seen = new Set<string>();
    for (const t of cTokens) {
      if (!seen.has(t) && spokenTokenSet.has(t)) {
        seen.add(t);
        const df = docFreq.get(t) ?? 1;
        // High weight for distinct words, low weight for ubiquitous words
        const idfWeight = df === 1 ? 3.5 : df === 2 ? 1.6 : 0.6;
        score += idfWeight;
      }
    }

    // 2) Bigram Matches (compound noun phrases)
    const seenBigrams = new Set<string>();
    for (const bg of cBigrams) {
      if (!seenBigrams.has(bg) && spokenBigramSet.has(bg)) {
        seenBigrams.add(bg);
        score += 3.0;
      }
    }

    // 3) AI Cue Reinforcement: if author/AI intended this target
    if (options?.cueTarget && candidate.key === options.cueTarget) {
      score += 2.5;
    }

    // 4) Temporal Continuity Prior: slight preference for holding current or progressing
    if (options?.previousTarget && candidate.key === options.previousTarget) {
      score += 0.6;
    }

    // 5) Rank priority: specific slide elements outrank generic title
    if (candidate.rank > 0 && score > 1.0) {
      score += candidate.rank * 0.3;
    }

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  // Threshold: must have meaningful match evidence (score >= 1.8)
  if (!best || bestScore < 1.8) {
    // If AI cue target is valid and present in candidates, fallback to cue
    if (options?.cueTarget) {
      const cueMatch = candidates.find((c) => c.key === options.cueTarget);
      if (cueMatch) return cueMatch.key;
    }
    return null;
  }

  return best.key;
}
