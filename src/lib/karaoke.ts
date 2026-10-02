/**
 * Word-by-word subtitle highlighting ("karaoke").
 *
 * The voice service reports when each word starts and stops, so the highlight is
 * driven by the real audio clock rather than by counting characters. That
 * matters here because Vietnamese is a tonal language: guessing a per-character
 * duration drifts visibly within a sentence, and the drift compounds over a
 * 30-second narration until the highlight is a word or two behind the voice.
 */

/** One word's speaking window, in seconds from the start of the audio. */
/** One word the voice actually spoke, and when it was spoken. */
export interface WordMark {
  /** Seconds from the start of the audio. */
  start: number;
  end: number;
  /**
   * The word as the service read it, not as the slide spells it. This matters:
   * the slide shows "9 × 1" and the service reads it as "9", "x", "1", so the
   * text is the only thing that can line the two lists up.
   */
  text: string;
}

/** One rendered piece of the subtitle, with the timing that lights it up. */
export interface KaraokeToken {
  text: string;
  /** Seconds from the start of the audio; null when nothing should be lit. */
  start: number | null;
  end: number | null;
}

/**
 * Decodes the `x-tts-words` header: gzipped, base64, JSON of
 * `[startMs, endMs, word]` triples.
 *
 * Returns an empty list on any failure. A narration with no timings still plays
 * and still shows its full sentence, so there is nothing here worth throwing
 * over.
 *
 * Decompression is async because browsers have no synchronous inflate; the
 * `DecompressionStream` path is what every current browser has, and the
 * no-stream fallback keeps older ones working without the highlight.
 */
export async function decodeWordMarks(header: string | null): Promise<WordMark[]> {
  if (!header) return [];
  try {
    const binary = atob(header);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    // gzip magic number; without it the payload is not ours.
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return [];

    const json =
      typeof DecompressionStream === "undefined"
        ? new TextDecoder().decode(bytes)
        : await new Response(
            new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
          ).text();
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];

    const marks: WordMark[] = [];
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length < 3) continue;
      const [start, end, text] = entry as [unknown, unknown, unknown];
      if (typeof start !== "number" || typeof end !== "number" || typeof text !== "string") {
        continue;
      }
      marks.push({ start: start / 1000, end: Math.max(end / 1000, start / 1000), text });
    }
    return marks;
  } catch {
    return [];
  }
}

/** Drops diacritics and case, so "Nguyễn" and "nguyen" compare equal. */
function fold(word: string): string {
  return word
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Punctuation the service reports as a word but that lights up on its own. */
const PUNCTUATION = /^[,.;:!?”"'()[\]…—–-]+$/;

/**
 * Lines the subtitle's words up with the service's word boundaries.
 *
 * The two never agree one-to-one, so this walks both lists in step. The known
 * divergences:
 *
 *   - the service splits on characters the slide does not: "9 × 1" comes back
 *     as "9", "x", "1", while the slide shows one token;
 *   - it sometimes reads one Vietnamese word as two hits ("ra" / "chỉ");
 *   - it reports trailing punctuation with a timing of its own.
 *
 * So each token absorbs consecutive boundaries until the text read so far
 * accounts for it, and a boundary nobody claims is skipped. If fewer than half
 * the words end up with a window, the boundaries plainly do not describe this
 * text — a stale header, a different voice — and the plain sentence is returned
 * instead. A wrong highlight is worse than no highlight.
 */
export function alignNarration(text: string, marks: WordMark[]): KaraokeToken[] {
  const pieces = text.split(/(\s+)/).filter((piece) => piece.length > 0);
  const plain = (): KaraokeToken[] =>
    pieces.map((piece) => ({ text: piece, start: null, end: null }));
  if (marks.length === 0) return plain();

  const tokens: KaraokeToken[] = [];
  let cursor = 0;
  let lit = 0;
  /** How many of the service's boundaries ended up inside a word's window. */
  let consumed = 0;
  /** Every word-like piece of the text, whether or not a boundary was found. */
  let expected = 0;

  for (const piece of pieces) {
    if (/^\s+$/.test(piece) || PUNCTUATION.test(piece)) {
      tokens.push({ text: piece, start: null, end: null });
      continue;
    }

    const target = fold(piece);
    // A token with no letters or digits left — "=", "→", "?" — has nothing to
    // speak, so it must not claim a boundary. Testing the folded text rather
    // than matching a punctuation list is what keeps that list from needing to
    // grow: any new symbol reduces to an empty string and is skipped by the
    // same rule.
    if (target.length === 0) {
      tokens.push({ text: piece, start: null, end: null });
      continue;
    }
    expected += 1;

    const first = cursor;
    let read = "";
    let last = first;

    // Take the next boundary. Keep taking while what has been read is still a
    // prefix of this token — that is how "9", "x", "1" end up lighting the
    // single slide token "9 × 1".
    while (cursor < marks.length) {
      const mark = marks[cursor];
      if (PUNCTUATION.test(mark.text)) {
        cursor += 1;
        continue;
      }
      read += fold(mark.text);
      last = cursor;
      cursor += 1;
      if (read.length >= target.length) break;
    }

    if (last < first || read.length === 0) {
      tokens.push({ text: piece, start: null, end: null });
      continue;
    }
    tokens.push({ text: piece, start: marks[first].start, end: marks[last].end });
    lit += 1;
    consumed += last - first + 1;
  }

  // Coverage is measured in both directions, because a header can be wrong in
  // two ways and only one of them is caught by counting marks.
  //
  // Punctuation is counted out of the mark side: the service reports it as
  // boundaries of its own, so a sentence with one comma per five words arrives
  // with far more marks than it has words, and comparing the two directly
  // rejected perfectly good timings and threw the highlight away.
  //
  // The text side catches the opposite failure — a mark list that is simply
  // shorter than the text it claims to describe, such as a stale header from
  // another lesson. Counting marks alone passes that, because the alignment
  // claims every mark it was given and then runs out; the reader is left
  // watching the highlight stop part-way through and sit still while the voice
  // carries on, which is worse than no highlight at all.
  const speakable = marks.reduce(
    (total, mark) => total + (PUNCTUATION.test(mark.text) ? 0 : 1),
    0,
  );
  const words = tokens.filter((token) => token.start !== null).length;
  if (lit === 0 || speakable === 0) return plain();
  const coveredMarks = consumed * 10 >= speakable * 9;
  const coveredText = words * 10 >= expected * 9;
  return coveredMarks && coveredText ? tokens : plain();
}

/** One caption line: a sentence, the words in it, and when the voice starts it. */
export interface AlignedSentence {
  /** The sentence as shown on screen. */
  text: string;
  /**
   * This sentence's own tokens, carrying their share of the timings.
   *
   * Timings are relative to the start of the whole scene's audio, exactly as
   * `alignNarration` returns them, so they can be looked up against the
   * playback position without rebasing.
   */
  tokens: KaraokeToken[];
  /** Seconds from the start of the audio; null when the voice never measured it. */
  start: number | null;
}

/**
 * Lines a whole narration up with the voice's boundaries, then cuts the result
 * into the sentences the caption shows one at a time.
 *
 * The alignment has to happen over the *whole* narration and only then be cut
 * up. Aligning a single sentence on its own is what broke the caption in two
 * separate ways at once: the boundaries describe the entire recording, so
 * starting a sentence at the first mark of the scene put every sentence's
 * timings at the top of the audio, and the coverage check — which asks whether
 * the alignment claimed the boundaries it was given — then compared one
 * sentence's handful of words against the scene's full mark list, failed, and
 * discarded the timings entirely. The result was a caption that never lit a
 * word and never moved past its first sentence.
 *
 * Cutting is done by walking the token list alongside the sentences rather than
 * by re-aligning each one, so the caption and the highlight cannot disagree
 * about where a sentence begins: they are the same numbers.
 */
export function alignSentences(text: string, marks: WordMark[]): AlignedSentence[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = splitSentences(clean);
  if (sentences.length === 0) return [];

  const tokens = alignNarration(clean, marks);
  const out: AlignedSentence[] = [];
  let index = 0;

  for (const sentence of sentences) {
    // The token list is `clean` split on whitespace, so the running total of the
    // token texts is an exact character offset into `clean`: a sentence ends
    // exactly where its own length says it does.
    const slice: KaraokeToken[] = [];
    let filled = 0;
    while (index < tokens.length && filled < sentence.length) {
      const token = tokens[index];
      // The space that separated this sentence from the last one is counted
      // here but not kept: the sentence carries its own trimmed text, and
      // handing its caption a leading space would indent every line but the
      // first.
      if (slice.length > 0 || token.text.trim().length > 0) slice.push(token);
      filled += token.text.length;
      index += 1;
    }
    out.push({
      text: sentence,
      tokens: slice,
      start: slice.find((token) => token.start !== null)?.start ?? null,
    });
  }

  return out;
}

/**
 * Splits a narration into sentences, keeping the terminator with its sentence.
 *
 * A slide's narration is written as a paragraph — four or five sentences on one
 * block of text. That is the wrong shape for a caption: a reader is given the
 * entire paragraph at once and has to find the one clause being spoken, which is
 * the one job a running subtitle exists to remove. So the caption shows one
 * sentence at a time and moves on when that sentence has been read.
 *
 * The split points are the terminators a Vietnamese writer actually uses, and a
 * sentence that comes out too long to read comfortably is cut again at its commas
 * — a 40-word clause with no full stop in it is not one caption, it is a
 * paragraph wearing a sentence's clothes.
 *
 * Returns whole sentences, never fragments, and always at least one: a narration
 * with no terminator in it is one caption.
 */
export function splitSentences(text: string, maxWords = 14): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];

  // Terminators plus a closing quote, so "…màu đỏ." does not leave a stray
  // bracket leading the next caption.
  const hard = /[^.!?…]+[.!?…]+["'’”)]*|[^.!?…]+$/g;
  const sentences = (clean.match(hard) ?? [clean])
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const out: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(" ");
    if (words.length <= maxWords) {
      out.push(sentence);
      continue;
    }
    // Too long: break at commas, but only where the break leaves a piece that is
    // still worth reading on its own. Greedy, so the caption is filled rather
    // than cut at every comma into fragments of two words.
    const clauses = sentence.split(/(?<=[,;:])\s+/);
    let current = "";
    for (const clause of clauses) {
      const candidate = current ? `${current} ${clause}` : clause;
      if (current && candidate.split(" ").length > maxWords) {
        out.push(current);
        current = clause;
      } else {
        current = candidate;
      }
    }
    if (current) out.push(current);
  }

  return out.length > 0 ? out : [clean];
}

/** One slide's narration, as the running subtitle needs to see it. */
export interface NarrationProgress {
  /** Index into the lesson's scenes. */
  sceneIndex: number;
  /** Seconds into this slide's narration. */
  time: number;
}

/**
 * The channel the voice publishes on and every slide's subtitle reads from.
 *
 * Two parts, and the second one is not optional. A deck holds every slide at
 * once, and a presenter jumps around: a single "currently narrating" field would
 * hand slide 3's subtitle the timings belonging to slide 5, and the highlight
 * would light the wrong words. So the timings are kept per scene and only the
 * position is global.
 *
 * A ref rather than state, and that is the load-bearing decision of the whole
 * subtitle: the voice writes here on every animation frame, and pushing that
 * through React would re-render every slide in the deck sixty times a second.
 * Slides read it inside their own rAF loop and touch DOM attributes directly, so
 * playback stays entirely off React.
 */
export interface NarrationChannel {
  live: NarrationProgress | null;
  /** sceneIndex -> word timings. Filled as each slide's audio is fetched. */
  words: Map<number, WordMark[]>;
}

/** Convenience for building the channel in a component. */
export function createNarrationChannel(): NarrationChannel {
  return { live: null, words: new Map() };
}

/**
 * Even timings for a sentence the voice never measured.
 *
 * Used only when the server had no boundary metadata and the browser fallback is
 * reading. The voice is then genuinely word-accurate but reports its position
 * through this approximation instead, which is why the weights are per-word
 * rather than per-character: a Vietnamese syllable is roughly uniform, while
 * character counts make long words look like they take twice as long.
 */
export function approximateWords(text: string, totalSeconds: number): WordMark[] {
  const words = text.split(/(\s+)/).filter((token) => token.trim().length > 0);
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0) return [];

  const marks: WordMark[] = [];
  let elapsed = 0;
  for (let i = 0; i < words.length; i += 1) {
    const span = (weights[i] / total) * totalSeconds;
    marks.push({ start: elapsed, end: elapsed + span, text: words[i] });
    elapsed += span;
  }
  return marks;
}

/**
 * A subtitle's word timings, flattened for lookup.
 *
 * The tokens list interleaves words with whitespace and punctuation, so its
 * `start` values are not monotonic and a binary search over it is simply wrong.
 * This pulls the timed words out into two parallel arrays, where monotonicity
 * holds and the search is valid.
 */
export interface KaraokeTrack {
  /** Start time of each timed word, ascending. */
  starts: Float64Array;
  /** Index into the token list for each entry of `starts`. */
  tokenIndexes: Int32Array;
  count: number;
}

export function buildTrack(tokens: KaraokeToken[]): KaraokeTrack {
  const starts = new Float64Array(tokens.length);
  const tokenIndexes = new Int32Array(tokens.length);
  let count = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const start = tokens[i].start;
    if (start === null) continue;
    starts[count] = start;
    tokenIndexes[count] = i;
    count += 1;
  }
  return { starts: starts.subarray(0, count), tokenIndexes: tokenIndexes.subarray(0, count), count };
}

/**
 * Token index of the word being spoken at `time`, or -1 before the first word.
 *
 * Binary search: called on every animation frame, and a long narration is
 * several hundred words.
 */
export function activeWordIndex(track: KaraokeTrack, time: number): number {
  const { starts, tokenIndexes, count } = track;
  let low = 0;
  let high = count - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found === -1 ? -1 : tokenIndexes[found];
}

