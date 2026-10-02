/**
 * Finds a real, licensed image for a slide by searching the web.
 *
 * Deliberately not an image generator. A generated diagram of Newton's third
 * law will have the arrows pointing the wrong way, and a teacher cannot catch
 * that on a slide they are presenting from. A real photo or diagram from the
 * open web is either right or visibly sourced.
 *
 * Two free sources, no API key, both with machine-readable licences:
 *   Openverse — aggregates Flickr/Wikimedia/etc. with attribution
 *   Wikimedia Commons — the fallback, and the better source for diagrams
 */

export interface SlideImage {
  /** Direct image URL, resized by the source where possible. */
  url: string;
  title: string;
  /** Attribution line: creator, licence, and where it came from. */
  credit: string;
  /** Page a human can open to check the image. */
  sourcePage: string;
  license: string;
  width: number;
  height: number;
}

const USER_AGENT = "EdusGPT/0.1 (classroom slide images; local install)";
const TIMEOUT_MS = 6_000;
/** Anything smaller than this is an icon, not an illustration. */
const MIN_SIDE = 200;

function tooSmall(width: number, height: number): boolean {
  return !width || !height || Math.min(width, height) < MIN_SIDE;
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    // A slow or unreachable source must not fail the slide.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One search hit, kept together with the text it should be judged on.
 *
 * `text` is not decoration: it is everything the archive said about the file —
 * title, description, categories, tags — because that is the only evidence
 * available for whether the picture is on topic. A Commons file named "Dumbbell
 * weighted jumps A1.png" says nothing useful in its name and everything in its
 * categories, and matching on the name alone is what let "Muscle Shoals Sound
 * Studio" through for a query about muscle exercise.
 */
interface Candidate {
  image: SlideImage;
  text: string;
}



async function fromOpenverse(query: string): Promise<Candidate[]> {
  const url =
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}` +
    `&page_size=8&mature=false&category=photograph,diagram,illustration`;
  const payload = (await fetchJson(url)) as { results?: Record<string, unknown>[] } | null;

  return (payload?.results ?? [])
    .map((item): Candidate | null => {
      const width = Number(item.width) || 0;
      const height = Number(item.height) || 0;
      const src = typeof item.url === "string" ? item.url : "";
      if (!src || tooSmall(width, height)) return null;

      const title = String(item.title ?? "Hình minh hoạ");
      const tags = (item.tags as unknown[]).filter((tag): tag is string => typeof tag === "string");
      const creator = String(item.creator ?? "").trim();
      const license = [item.license, item.license_version].filter(Boolean).join(" ");

      return {
        text: `${title} ${tags.join(" ")} ${creator} ${item.source ?? ""}`,
        image: {
          url: src,
          title: title.slice(0, 120),
          credit: [creator || "Không rõ tác giả", license, String(item.source ?? "")]
            .filter(Boolean)
            .join(" · "),
          sourcePage: String(item.foreign_landing_url ?? src),
          license: license || "unknown",
          width,
          height,
        },
      };
    })
    .filter((item): item is Candidate => item !== null);
}

async function fromCommons(query: string): Promise<Candidate[]> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search` +
    `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=12` +
    `&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1200`;
  const payload = (await fetchJson(url)) as
    | { query?: { pages?: Record<string, Record<string, unknown>> } }
    | null;
  const pages = Object.values(payload?.query?.pages ?? {});

  return pages
    .map((page): Candidate | null => {
      const info = (page.imageinfo as Record<string, unknown>[] | undefined)?.[0];
      if (!info) return null;
      // Commons is full of scanned PDFs and book pages; a slide wants a picture.
      const mime = String(info.mime ?? "");
      if (!mime.startsWith("image/") || mime === "image/svg+xml") return null;
      // TIFF is almost always a book scan on Commons, not a slide illustration,
      // and a 200MB scan of a caption survives every other check: the Library of
      // Congress uploads put the whole description in the categories, so
      // "The Howell Graves building, Muscle Shoals" matched a query about muscle
      // exercise on the strength of words scraped off the back of the print.
      if (mime === "image/tiff") return null;
      const width = Number(info.width) || 0;
      const height = Number(info.height) || 0;
      if (tooSmall(width, height)) return null;

      const meta = (info.extmetadata as Record<string, Record<string, unknown>>) ?? {};
      const clean = (value: unknown) =>
        String(value ?? "").replace(/<[^>]*>/g, "").trim();

      const title = String(page.title ?? "Hình minh hoạ").replace(/^File:/, "");
      // A Library of Congress control number in the filename means a scanned
      // page, whatever its categories claim.
      if (/\bLCCN\s*\d+/i.test(title)) return null;
      const author = clean(meta.Artist?.value) || "Không rõ tác giả";
      const license = clean(meta.LicenseShortName?.value) || "Wikimedia Commons";

      return {
        // The description and the category list are where a Commons file keeps
        // the words that describe it; the filename is usually a date and a
        // sequence letter.
        text: [
          title,
          clean(meta.ImageDescription?.value),
          clean(meta.Categories?.value),
          clean(meta.ObjectName?.value),
          String(page.snippet ?? "").replace(/<[^>]*>/g, " "),
        ].join(" "),
        image: {
          // The width-limited variant is what makes a 40MB scan usable on a slide.
          url: String(info.thumburl ?? info.url ?? ""),
          title: title.slice(0, 120),
          credit: `${author} · ${license} · Wikimedia Commons`,
          sourcePage: String(info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${page.title}`),
          license,
          width,
          height,
        },
      };
    })
    .filter((item): item is Candidate => item !== null && item.image.url.length > 0);
}

/**
 * Words too short, too generic, or too abstract to count as evidence.
 *
 * The abstract half matters as much as the rest. A model writes "gym workout
 * benefits" because that is a good slide title, but "benefits" describes the
 * teaching, not the picture — no photograph is of a benefit. Counting it as a
 * word the image must contain drops the match from two words to one, and one
 * word out of three is exactly how "Soldiers work-out in their new gym" ends up
 * under a slide about the benefits of training. Dropping them first means the
 * remaining words are all about a thing that can be photographed.
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "under",
  "diagram", "image", "picture", "photo", "illustration", "chart", "graph", "of", "a", "an",
  "showing", "shows", "view", "example", "sample", "file",
  "plan", "plans", "benefit", "benefits", "overview", "introduction", "intro", "meaning",
  "type", "types", "process", "method", "methods", "steps", "guide", "tutorial", "basics",
  "fundamentals", "theory", "concept", "concepts", "definition", "definitions", "features",
  "importance", "role", "impact", "effects", "reason", "reasons", "problems", "solutions",
  "technique", "techniques", "principles", "lesson", "topic", "part", "note", "notes",
]);

/**
 * Splits a phrase into whole words, for matching against a result's own text.
 *
 * Words rather than substrings, on purpose. The check used to be
 * `haystack.includes(word)`, which is why a slide about a gym came back with a
 * photograph of a high-school gymnasium: "gym" is a prefix of "gymnasium", so the
 * substring test passed. Whole-word matching removes that family of false
 * friends at the source.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Words of the query that actually carry meaning. */
function significantWords(query: string): string[] {
  return words(query).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * How well a candidate answers the query: 0..1, where 0 means "do not show".
 *
 * Two rules, because neither alone is right.
 *
 * The ANCHOR is the longest meaningful word in the query, and it must appear.
 * In practice the longest word is the specific one — "workout" in "gym workout",
 * "anatomy" in "human heart anatomy" — and it is what keeps a generic result
 * out: a gymnasium photograph has no "workout", and Muscle Shoals has no
 * "exercise".
 *
 * The COUNT rule then only asks for a majority. Requiring *every* word instead
 * would discard good matches, because archives name files tersely: Commons has
 * "Heart frontally PDA.jpg" for a lesson on the heart's anatomy, and demanding
 * "human" and "anatomy" in the title throws away a perfectly good diagram. It
 * is the anchor rule that makes settling for a majority safe.
 */
function relevance(query: string, haystack: string): number {
  const wanted = significantWords(query);
  if (wanted.length === 0) return 0;
  const have = new Set(words(haystack));
  const matched = wanted.filter((word) => have.has(word));

  const anchor = wanted.reduce((longest, word) => (word.length > longest.length ? word : longest), "");
  if (!have.has(anchor)) return 0;
  if (matched.length < Math.ceil(wanted.length / 2)) return 0;

  return matched.length / wanted.length;
}



/**
 * Shortens a search term until the archives actually return something.
 *
 * Measured, not assumed: Openverse returns 3 results for "newton second law" and
 * **zero** for "newton second law diagram". Its matcher is strict enough that
 * the extra descriptive words a model helpfully adds — exactly the words that
 * make a query specific — are what empties the result set.
 *
 * Shortening is for *finding* candidates only. Every candidate is still judged
 * against the original query, so widening the search can never make the answer
 * less relevant. That distinction is the whole fix for the gym case: "gym
 * workout" falls back to the two-word variant "gym", and a candidate matching
 * the shortened query would let a school gymnasium through. Judged against the
 * full query, the gymnasium fails — it never had the word "workout".
 */
function searchVariants(query: string): string[] {
  const parts = query.split(/\s+/).filter(Boolean);
  const variants: string[] = [];
  // Stops at two words. Degrading a five-word query all the way to one word is
  // what produced a roller-coaster photo on a Python slide: "for loop" matches
  // amusement rides, and no amount of loosening recovers the intent. A query
  // that *starts* as a single word ("photosynthesis") is kept as-is.
  const floor = parts.length === 1 ? 1 : 2;
  for (let take = Math.min(6, parts.length); take >= floor; take -= 1) {
    const candidate = parts.slice(0, take).join(" ");
    if (!variants.includes(candidate)) variants.push(candidate);
  }
  return variants;
}

/**
 * Returns candidates, best first. An empty list is a normal outcome and the
 * slide simply renders without a picture — never a placeholder box, and never
 * a picture that does not belong to the slide.
 */
export async function searchSlideImage(query: string): Promise<SlideImage[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  const best = new Map<string, { image: SlideImage; score: number }>();

  for (const variant of searchVariants(term)) {
    const [openverse, commons] = await Promise.all([
      fromOpenverse(variant).catch(() => []),
      fromCommons(variant).catch(() => []),
    ]);

    for (const candidate of [...openverse, ...commons]) {
      const score = relevance(term, candidate.text);
      if (score <= 0) continue;

      // Openverse aggregates Commons, so the same file arrives twice.
      const key =
        candidate.image.url.replace(/^https?:\/\//, "").split("/").pop() ?? candidate.image.url;

      // Ranked with the title as the tie-breaker. Both "Seawifs global
      // biosphere" and "Photosynthesis-ar" clear the bar for "photosynthesis" —
      // the first only because its categories mention the word — but a file
      // actually NAMED after the topic is the one a teacher means, so the
      // title decides between candidates that are otherwise equally relevant.
      const rank = score + relevance(term, candidate.image.title) * 0.5;

      const previous = best.get(key);
      if (!previous || rank > previous.score) best.set(key, { image: candidate.image, score: rank });
    }

    if (best.size > 0) break;
  }

  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 6).map((e) => e.image);
}
