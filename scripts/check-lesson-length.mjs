// The length presets promise a duration in the label and a slide count in the
// picker. Those are only honest if the words-per-scene range they ask the model
// for actually speaks in that many seconds — the route extends a scene when the
// narration would overrun it, so a range that is too wide silently inflates the
// lesson past the number on the card. This asserts they agree, at both ends.
import { LESSON_LENGTHS } from "../src/lib/lesson/presentation-styles.ts";

// Must match NARRATION_* in src/app/api/gemini/lesson/route.ts.
const WORDS_PER_SECOND = 3;
const PADDING = 1.5;
const RATE = 1; // scenes are not padded by the cap at these lengths

let failed = 0;
for (const preset of LESSON_LENGTHS) {
  const [minScenes, maxScenes] = preset.scenes;
  const [minWords, maxWords] = preset.wordsPerScene;
  const [minMinutes, maxMinutes] = preset.minutes;

  // The route divides the total by whatever count the model actually returns, so
  // a 60-scene deck gets 60s slides and a 95-scene deck gets 38s. Both ends of
  // the scene range have to land inside the promised duration.
  const totalSeconds = maxMinutes * 60;
  let ok = true;
  for (const scenes of [minScenes, maxScenes]) {
    const perScene = totalSeconds / scenes;
    // The route only ever lengthens a scene, and only up to 1.8x, so a scene runs
    // its own target or the time its narration needs.
    const spoken = (words) => words / WORDS_PER_SECOND + PADDING;
    // The route divides the preset's total duration by however many scenes the
    // model actually returned, so the deck lands on the top of the promised range
    // whichever end of the scene count it lands on. That is the invariant: the
    // number on the card is what the teacher waits for, not a range the deck may
    // or may not reach.
    const seconds = Math.min(perScene * 1.8, Math.max(perScene, spoken(maxWords)));
    const deckMinutes = (perScene * scenes * RATE) / 60;
    const deckMaxMinutes = (seconds * scenes * RATE) / 60;
    const within =
      deckMinutes >= minMinutes * 0.9 &&
      deckMaxMinutes <= maxMinutes * 1.1;
    if (!within) ok = false;
    if (scenes === minScenes || scenes === maxScenes) {
      console.log(
        `      ${scenes} slides: target ${perScene.toFixed(1)}s each, ` +
          `slowest narration needs ${spoken(maxWords).toFixed(1)}s ` +
          `(fastest ${spoken(minWords).toFixed(1)}s) -> ` +
          `deck ${deckMinutes.toFixed(1)}-${deckMaxMinutes.toFixed(1)} min`,
      );
    }
  }

  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${preset.id.padEnd(7)} ` +
      `${minScenes}-${maxScenes} slides @ ${minWords}-${maxWords} words, ` +
      `promised ${minMinutes}-${maxMinutes} min`,
  );
}

if (failed > 0) {
  console.error(`\n${failed} length preset(s) contradict their own duration.`);
  process.exit(1);
}
console.log("\nAll length presets hold.");
