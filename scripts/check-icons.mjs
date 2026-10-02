/**
 * Checks the slide icon allow-list against the installed `lucide-react`.
 *
 * Three things can drift, and each one fails silently at runtime:
 *  - a name in `SLIDE_ICON_SETS` that lucide no longer exports (the icon never
 *    renders, because `slideIcon` returns null);
 *  - an allow-listed name missing from the `SLIDE_ICONS` map (same, and it looks
 *    like a model problem when it is not);
 *  - a name the model may emit that is a real Lucide export but was never
 *    allow-listed (silently dropped at validation, so half the deck has no icon).
 *
 * Run by `npm run verify`. Reads both source files as text rather than
 * importing them, so it needs no build step.
 */
import * as lucide from "lucide-react";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Imported for real rather than parsed out of the source text: the allow-list and
// the component map are two hand-written lists that have to agree, and reading
// one of them with a regex is how that agreement stops being checked.
//
// `pathToFileURL` rather than a bare absolute path — on Windows a `C:\...` path
// is not a URL and the ESM loader rejects it.
const source = (relative) => import(pathToFileURL(join(root, relative)).href);
const { SLIDE_ICON_NAMES } = await source("src/lib/lesson/types.ts");
const { SLIDE_ICONS } = await source("src/lib/lesson/slide-icons.ts");

const problems = [];
const seen = new Set();

for (const name of SLIDE_ICON_NAMES) {
  if (!(name in lucide)) {
    problems.push(`types.ts: "${name}" is not exported by lucide-react`);
  }
  if (!(name in SLIDE_ICONS)) {
    problems.push(`slide-icons.ts: "${name}" is allowed but not in the SLIDE_ICONS map`);
  }
}

for (const name of Object.keys(SLIDE_ICONS)) {
  if (!SLIDE_ICON_NAMES.includes(name)) {
    problems.push(`slide-icons.ts: "${name}" is mapped but not on the allow-list in types.ts`);
  }
}

if (problems.length > 0) {
  console.error(`check-icons: ${problems.length} problem(s)`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`check-icons: ${SLIDE_ICON_NAMES.length} slide icons, all real and all mapped.`);
