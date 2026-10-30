"use client";

import { useState } from "react";
import {
  ListVideo,
  FileText,
  Mic,
  Maximize2,
  Minimize2,
  Play,
} from "lucide-react";
import type { Timebase } from "@/hooks/useTimebase";
import { sceneKindLabel, type Lesson } from "@/lib/lesson/types";
import { formatClock } from "@/lib/format";
import { useCopy, useLang } from "@/i18n/provider";
import { InlineText } from "./InlineText";

const COPY = {
  en: {
    chapterOutline: "Lesson chapters",
    chapterNarration: "Scene narration",
    tabOutline: "Chapters",
    tabTranscript: "Transcript",
    expandOutline: "Expand (view details)",
    collapseOutline: "Collapse (open AI tutor)",
    scenesUnit: "scenes",
  },
  vi: {
    chapterOutline: "Mục lục bài giảng",
    chapterNarration: "Lời giảng cảnh",
    tabOutline: "Mục lục",
    tabTranscript: "Lời giảng",
    expandOutline: "Phóng to (xem kỹ)",
    collapseOutline: "Thu nhỏ (mở Trợ giảng AI)",
    scenesUnit: "cảnh",
  },
};

interface ChapterListProps {
  lesson: Lesson;
  timebase: Timebase;
  activeScene: number;
  activeChapter: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

/** Clickable YouTube-style outline: chapter → scene with expand/collapse and transcript. */
export function ChapterList({
  lesson,
  timebase,
  activeScene,
  activeChapter,
  expanded = false,
  onToggleExpand,
}: ChapterListProps) {
  const t = useCopy(COPY);
  const lang = useLang();
  const [activeTab, setActiveTab] = useState<"outline" | "transcript">("outline");
  const activeNarration = lesson.scenes[activeScene]?.narration;

  return (
    <div
      className={`panel flex flex-col overflow-hidden transition-all duration-300 ${
        expanded
          ? "w-full ring-1 ring-brand-500/30 flex-1 min-h-0"
          : "w-full max-h-[14rem] sm:max-h-[16rem] lg:max-h-[18rem] shrink-0"
      }`}
    >
      {/* Header: Title, duration, tabs, and expand/collapse toggle */}
      <div className="shrink-0 flex flex-col gap-2 border-b border-ink-700/70 bg-ink-950/60 p-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ListVideo className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3 className="text-sm font-bold text-mist-100">{t.chapterOutline}</h3>
            <span className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mist-400">
              {lesson.scenes.length} {t.scenesUnit} · {formatClock(lesson.duration, false)}
            </span>
          </div>

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="btn-icon h-7 w-7 rounded-md text-mist-300 hover:text-mist-50"
              title={expanded ? t.collapseOutline : t.expandOutline}
              aria-label={expanded ? t.collapseOutline : t.expandOutline}
            >
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Tab switch: Chapters vs Full Transcript */}
        <div className="flex rounded-lg border border-ink-700/70 bg-ink-900/80 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("outline")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition-colors ${
              activeTab === "outline"
                ? "bg-ink-800 text-mist-50 shadow-sm"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <ListVideo className="h-3.5 w-3.5" />
            <span>{t.tabOutline}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transcript")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition-colors ${
              activeTab === "transcript"
                ? "bg-ink-800 text-mist-50 shadow-sm"
                : "text-mist-400 hover:text-mist-200"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>{t.tabTranscript}</span>
          </button>
        </div>
      </div>

      {/* Content list - scrollable inside with independent scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2">
        {activeTab === "outline" ? (
          lesson.chapters.map((chapter, chapterIndex) => {
            const scenes = lesson.scenes.filter((scene) =>
              chapter.sceneIds.includes(scene.id),
            );
            const isChapterActive = chapterIndex === activeChapter;

            return (
              <div key={chapter.id} className="mb-3">
                {/* Chapter title header */}
                <button
                  type="button"
                  onClick={() => timebase.seek(chapter.start)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-bold uppercase tracking-wide transition-colors ${
                    isChapterActive
                      ? "text-amber-600 dark:text-amber-400 bg-brand-500/10 border-l-2 border-amber-500"
                      : "text-mist-400 hover:bg-ink-850 hover:text-mist-200"
                  }`}
                >
                  <span className="truncate">{chapter.title}</span>
                  <span className="font-mono text-[10px] text-mist-500">
                    {formatClock(chapter.start, false)}
                  </span>
                </button>

                {/* Scene items in YouTube chapter style */}
                <ul className="mt-1 space-y-1">
                  {scenes.map((scene) => {
                    const index = lesson.scenes.findIndex((item) => item.id === scene.id);
                    const isCurrent = index === activeScene;

                    return (
                      <li key={scene.id}>
                        <button
                          type="button"
                          onClick={() => timebase.seek(scene.start)}
                          className={`group flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-all ${
                            isCurrent
                              ? "border-l-4 border-amber-500 bg-brand-500/15 dark:bg-brand-950/40 text-mist-50 shadow-sm font-semibold"
                              : "border-l-4 border-transparent text-mist-300 hover:bg-ink-850 hover:text-mist-100"
                          }`}
                        >
                          {/* Timestamp pill / Play icon */}
                          <div
                            className={`flex shrink-0 items-center justify-center rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                              isCurrent
                                ? "bg-gradient-to-br from-brand-500 to-amber-500 text-white shadow-sm"
                                : "bg-ink-800 text-mist-300 group-hover:bg-brand-500/20 group-hover:text-amber-600 dark:group-hover:text-amber-400"
                            }`}
                          >
                            {isCurrent ? (
                              <Play className="h-3 w-3 fill-current" />
                            ) : (
                              formatClock(scene.start, false)
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`truncate text-xs font-semibold ${
                                  isCurrent ? "text-mist-50" : "text-mist-200"
                                }`}
                              >
                                {scene.title}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] text-mist-500">
                                {scene.duration.toFixed(0)}s
                              </span>
                            </div>

                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-mist-400">
                              <span className="rounded bg-ink-800/80 px-1 py-0.2">
                                {sceneKindLabel(scene.kind, lang)}
                              </span>
                              {scene.narration ? (
                                <>
                                  <span>·</span>
                                  <span className="truncate italic text-mist-500">
                                    <InlineText text={scene.narration} />
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        ) : (
          /* Full transcript tab with clickable scene jumps */
          <div className="space-y-3 p-1">
            {lesson.scenes.map((scene, idx) => {
              const isCurrent = idx === activeScene;
              return (
                <div
                  key={scene.id}
                  onClick={() => timebase.seek(scene.start)}
                  className={`cursor-pointer rounded-lg p-2.5 transition-colors ${
                    isCurrent
                      ? "border-l-4 border-amber-400 bg-brand-950/40"
                      : "border-l-4 border-transparent hover:bg-ink-850"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                        isCurrent
                          ? "bg-gradient-to-br from-brand-500 to-amber-500 text-white shadow-sm"
                          : "bg-ink-800 text-mist-400"
                      }`}
                    >
                      {formatClock(scene.start, false)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent ? "text-mist-50" : "text-mist-200"
                      }`}
                    >
                      <InlineText text={scene.title} />
                    </span>
                  </div>
                  {scene.narration && (
                    <p className="mt-1.5 text-xs italic leading-relaxed text-mist-300">
                      <InlineText text={scene.narration} />
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active scene narration quote at bottom of outline */}
      {activeNarration && activeTab === "outline" ? (
        <div className="shrink-0 border-t border-ink-700/70 bg-ink-950/70 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mist-400">
            <Mic className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            {t.chapterNarration} #{activeScene + 1}
          </p>
          <p
            className="mt-1 line-clamp-3 text-xs italic leading-relaxed text-mist-200"
            title={activeNarration}
          >
            <InlineText text={activeNarration} />
          </p>
        </div>
      ) : null}
    </div>
  );
}
