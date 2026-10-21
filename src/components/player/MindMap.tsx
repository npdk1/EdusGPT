"use client";

import type { MindmapBranch } from "@/lib/lesson/mindmap";
import { useCopy } from "@/i18n/provider";

/**
 * The cumulative recap map: the branches the lesson has covered so far.
 *
 * A recap scene carries its own slice of the lesson's branches, so this
 * component renders exactly what it is handed. The "what is new here"
 * highlight comes from `freshFrom`, which the player derives by comparing
 * this scene's map with the nearest earlier one — the lesson data itself
 * stays free of presentation state. Plain HTML rows rather than SVG so long
 * labels wrap like text instead of being clipped.
 */
const COPY = {
  en: { mapKicker: "Summary map" },
  vi: { mapKicker: "Sơ đồ tóm tắt" },
};

export function MindMap({ branches, freshFrom }: { branches: MindmapBranch[]; freshFrom?: number }) {
  const t = useCopy(COPY);
  if (branches.length === 0) return null;
  return (
    <figure className="scene-mindmap">
      <figcaption className="scene-mindmap-kicker">{t.mapKicker}</figcaption>
      <div className="scene-mindmap-tree">
        {branches.map((branch, index) => {
          const fresh = freshFrom !== undefined && index >= freshFrom;
          return (
            <div
              key={`${index}-${branch.label}`}
              className="scene-mindmap-branch"
              data-fresh={fresh || undefined}
            >
              <span aria-hidden="true" className="scene-mindmap-dot" />
              <div className="scene-mindmap-body">
                <p className="scene-mindmap-label">{branch.label}</p>
                {branch.items.length > 0 ? (
                  <ul className="scene-mindmap-items">
                    {branch.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
