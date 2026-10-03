"use client";

import { ListOrdered, Mic } from "lucide-react";
import type { Timebase } from "@/hooks/useTimebase";
import { SCENE_KIND_LABEL, type Lesson } from "@/lib/lesson/types";
import { formatClock } from "@/lib/format";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    chapterOutline: "Lesson outline",
    chapterNarration: "Scene narration",
  },
  vi: {
    chapterOutline: "Mục lục bài giảng",
    chapterNarration: "Lời giảng cảnh",
  },
};

interface ChapterListProps {
  lesson: Lesson;
  timebase: Timebase;
  activeScene: number;
  activeChapter: number;
}

/** Clickable outline: chapter → scene, each row seeks the shared playhead. */
export function ChapterList({
  lesson,
  timebase,
  activeScene,
  activeChapter,
}: ChapterListProps) {
  const t = useCopy(COPY);
  const activeNarration = lesson.scenes[activeScene]?.narration;

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-3">
        <ListOrdered className="h-4 w-4 text-brand-300" />
        <h3 className="text-sm font-semibold text-mist-100">{t.chapterOutline}</h3>
        <span className="ml-auto font-mono text-[11px] text-mist-500">
          {formatClock(lesson.duration, false)}
        </span>
      </div>

      <div className="max-h-[22rem] overflow-y-auto px-2 py-2 lg:max-h-[30rem]">
        {lesson.chapters.map((chapter, chapterIndex) => {
          const scenes = lesson.scenes.filter((scene) =>
            chapter.sceneIds.includes(scene.id),
          );
          const isActive = chapterIndex === activeChapter;
          return (
            <div key={chapter.id} className="mb-1.5">
              <button
                type="button"
                onClick={() => timebase.seek(chapter.start)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                  isActive
                    ? "bg-ink-800 text-brand-200"
                    : "text-mist-400 hover:bg-ink-850 hover:text-mist-200"
                }`}
              >
                <span className="truncate">{chapter.title}</span>
                <span className="font-mono text-[10px] text-mist-500">
                  {formatClock(chapter.start, false)}
                </span>
              </button>

              <ul className="mt-1 space-y-0.5">
                {scenes.map((scene) => {
                  const index = lesson.scenes.findIndex((item) => item.id === scene.id);
                  const isCurrent = index === activeScene;
                  return (
                    <li key={scene.id}>
                      <button
                        type="button"
                        onClick={() => timebase.seek(scene.start)}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isCurrent
                            ? "bg-brand-500/12 text-mist-50 ring-1 ring-inset ring-brand-600/50"
                            : "text-mist-300 hover:bg-ink-850"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {isCurrent ? (
                            <span className="block h-2 w-2 animate-pulse-dot rounded-full bg-ember-400" />
                          ) : (
                            <span className="block h-2 w-2 rounded-full bg-ink-600" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm">{scene.title}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-mist-500">
                            <span className="font-mono">
                              {formatClock(scene.start, false)}
                            </span>
                            <span>·</span>
                            <span>{SCENE_KIND_LABEL[scene.kind]}</span>
                            <span>·</span>
                            <span>{scene.duration.toFixed(0)}s</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {activeNarration ? (
        <div className="border-t border-ink-700/70 bg-ink-950/60 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-mist-500">
            {/* A microphone, not a quotation mark. This line is the scene's
                narration — text that gets spoken — and `Quote` drew two curly
                strokes that read as a citation, a claim this slide never makes.
                `Mic` says what the thing actually is. */}
            <Mic className="h-3.5 w-3.5 text-brand-300" /> {t.chapterNarration}{" "}
            {activeScene + 1}
          </p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-mist-300">
            {activeNarration}
          </p>
        </div>
      ) : null}
    </div>
  );
}
