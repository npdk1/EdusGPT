/**
 * Mindmap snapshots — the "tóm tắt dần dần" deck.
 *
 * The model writes the branches once (stage 3 of the lesson route); every
 * mindmap scene in the deck shows the same branches, trimmed to the part that
 * has been taught by the time the scene plays, so the map grows as the lesson
 * advances. The last map is the full tree.
 *
 * Pure math on purpose: the route builds snapshots without another model call,
 * and check-quiz-gate.mjs pins the counting rules.
 */
import type { Lesson } from "./types.ts";

export interface MindmapBranch {
  label: string;
  items: string[];
}

export interface MindmapSnapshot {
  branches: MindmapBranch[];
  /** Index of the first branch that is new in this snapshot — absent on the first map. */
  freshFrom?: number;
}

/**
 * Snapshot `index` (0-based) of `total` maps over `branches`. Branches are
 * sliced so each map shows strictly more than the last (min 1), and the newest
 * slice is marked fresh; the first map marks nothing — everything on it is new
 * anyway, and a whole fresh tree would just look like a colour bug.
 */
export function mindmapSnapshot(
  branches: MindmapBranch[],
  index: number,
  total: number,
): MindmapSnapshot {
  const totalMaps = Math.max(1, total);
  const count = Math.max(1, Math.ceil(((index + 1) * branches.length) / totalMaps));
  const shown = branches.slice(0, count);
  if (index <= 0) return { branches: shown };
  // Everything before `prev` was on an earlier map; when this map adds nothing,
  // nothing is fresh (the old count-1 fallback coloured an already-seen branch).
  const prev = Math.ceil((index * branches.length) / totalMaps);
  return count > prev ? { branches: shown, freshFrom: prev } : { branches: shown };
}

/**
 * How many branches a mindmap scene already had behind it: the count from the
 * nearest earlier mindmap scene, or `undefined` when this is the first recap.
 *
 * The player derives the fresh highlight from this instead of storing it in the
 * lesson — scene data carries plain branches, and "what is new here" is a
 * comparison with the recap that came before.
 */
export function mindmapFreshFrom(
  lesson: Pick<Lesson, "scenes">,
  sceneId: string,
): number | undefined {
  const index = lesson.scenes.findIndex((scene) => scene.id === sceneId);
  const scene = index >= 0 ? lesson.scenes[index] : undefined;
  if (!scene?.mindmap) return undefined;
  for (let before = index - 1; before >= 0; before -= 1) {
    const branches = lesson.scenes[before]?.mindmap?.branches;
    if (branches) return branches.length;
  }
  return undefined;
}
