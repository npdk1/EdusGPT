"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  Sparkles,
  Shuffle,
  Volume2,
  LoaderCircle,
  Play,
  RotateCw,
  Flame,
  CheckCircle2,
  Layers,
  ArrowRight,
} from "lucide-react";
import katex from "katex";
import type { Lesson, LessonScene } from "@/lib/lesson/types";
import { SAMPLE_LESSON } from "@/lib/lesson/sample-lesson";
import { useCopy } from "@/i18n/provider";
import { InlineText } from "@/components/player/InlineText";
import { FlashcardModal } from "@/components/player/FlashcardModal";

interface FlashcardItem {
  id: string;
  category: "concept" | "formula" | "quiz" | "example" | "summary";
  keyword: string;
  definition?: string;
  bullets: string[];
  formula?: string;
  explanation?: string;
}

function buildLessonFlashcards(scenes: LessonScene[], t: typeof COPY.en): FlashcardItem[] {
  const cards: FlashcardItem[] = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    if (s.kind === "cover") continue;

    if (s.kind === "formula" || s.formula) {
      cards.push({
        id: `card-${s.id}`,
        category: "formula",
        keyword: s.title,
        definition: s.subtitle || t.defaultFormula,
        bullets: s.bullets || [],
        formula: s.formula,
        explanation: s.steps ? s.steps.join("\n") : undefined,
      });
      continue;
    }

    if (s.kind === "quiz" && s.quiz) {
      const q = s.quiz.question || s.title;
      const correct = s.quiz.options?.find((opt) => opt.isCorrect);
      cards.push({
        id: `card-${s.id}`,
        category: "quiz",
        keyword: q,
        definition: correct ? `${t.correctAnswerPrefix}: ${correct.text}` : s.subtitle,
        bullets: correct?.explanation ? [correct.explanation] : s.bullets || [],
        explanation: s.subtitle,
      });
      continue;
    }

    if (s.kind === "example") {
      cards.push({
        id: `card-${s.id}`,
        category: "example",
        keyword: s.title,
        definition: s.subtitle || t.defaultExample,
        bullets: s.steps && s.steps.length > 0 ? s.steps : s.bullets || [],
      });
      continue;
    }

    if (s.kind === "summary") {
      cards.push({
        id: `card-${s.id}`,
        category: "summary",
        keyword: s.title,
        definition: s.subtitle || t.defaultSummary,
        bullets: s.bullets || [],
      });
      continue;
    }

    // Default: concept
    cards.push({
      id: `card-${s.id}`,
      category: "concept",
      keyword: s.title,
      definition: s.subtitle || t.defaultConcept,
      bullets: s.bullets || [],
    });
  }

  return cards;
}

const COPY = {
  en: {
    backToLesson: "Back to lesson",
    backToLibrary: "Library",
    goToQuiz: "Quiz practice",
    practiceBtn: "Practice flashcards",
    shuffle: "Shuffle cards",
    unshuffle: "Original order",
    listCount: "List contains {n} flashcards",
    definitionLabel: "Definition / Core concept:",
    exampleLabel: "Key points / Examples:",
    explanationLabel: "Detailed explanation:",
    loading: "Loading flashcards…",
    emptyTitle: "No flashcards found",
    emptyDesc: "This lesson has no flashcard cards to preview.",
    catConcept: "Concept",
    catFormula: "Formula",
    catQuiz: "Check Question",
    catExample: "Example",
    catSummary: "Summary",
    lessonFallback: "Lesson",
    cardsUnit: "cards",
    correctAnswerPrefix: "Correct answer",
    defaultFormula: "Formula & Mathematical / Physical law",
    defaultExample: "Worked problem / Real-world scenario",
    defaultSummary: "Lesson summary",
    defaultConcept: "Core concept to remember",
    listenAudio: "Listen to pronunciation",
    pageHeading: "Flashcards: {title}",
  },
  vi: {
    backToLesson: "Quay lại bài giảng",
    backToLibrary: "Thư viện bài học",
    goToQuiz: "Luyện trắc nghiệm",
    practiceBtn: "Luyện tập thẻ ghi nhớ",
    shuffle: "Xem ngẫu nhiên",
    unshuffle: "Thứ tự gốc",
    listCount: "Danh sách có {n} thẻ ghi nhớ",
    definitionLabel: "Định nghĩa / Bản chất:",
    exampleLabel: "Điểm quan trọng / Ví dụ:",
    explanationLabel: "Lời giải chi tiết:",
    loading: "Đang tải dữ liệu thẻ ghi nhớ…",
    emptyTitle: "Chưa có thẻ ghi nhớ",
    emptyDesc: "Bài học này chưa có đủ nội dung để tạo thẻ ghi nhớ.",
    catConcept: "Khái niệm",
    catFormula: "Công thức",
    catQuiz: "Tự kiểm tra",
    catExample: "Ví dụ",
    catSummary: "Tổng kết",
    lessonFallback: "Bài học",
    cardsUnit: "thẻ",
    correctAnswerPrefix: "Đáp án đúng",
    defaultFormula: "Công thức & Định luật toán học / vật lý",
    defaultExample: "Bài toán / Tình huống thực tế",
    defaultSummary: "Tổng kết toàn bài",
    defaultConcept: "Khái niệm cốt lõi cần ghi nhớ",
    listenAudio: "Nghe phát âm",
    pageHeading: "Thẻ ghi nhớ: {title}",
  },
};

interface FlashcardClientProps {
  courseId: string | null;
}

export function FlashcardClient({ courseId }: FlashcardClientProps) {
  const t = useCopy(COPY);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [shuffled, setShuffled] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Load lesson
  useEffect(() => {
    let cancelled = false;
    const fetchCourse = async () => {
      setLoading(true);
      try {
        if (!courseId) {
          const listRes = await fetch("/api/courses?limit=1", { cache: "no-store" });
          if (listRes.ok) {
            const listData = await listRes.json();
            const first = listData.courses?.[0];
            if (first?.id) {
              const res = await fetch(`/api/courses?id=${encodeURIComponent(first.id)}`, { cache: "no-store" });
              if (res.ok) {
                const data = await res.json();
                if (!cancelled && data.lesson) {
                  setLesson(data.lesson);
                  setLoading(false);
                  return;
                }
              }
            }
          }
          if (!cancelled) {
            setLesson(SAMPLE_LESSON);
            setLoading(false);
          }
          return;
        }

        const res = await fetch(`/api/courses?id=${encodeURIComponent(courseId)}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.lesson) {
            setLesson(data.lesson);
            setLoading(false);
            return;
          }
        }
        if (!cancelled) {
          setLesson(SAMPLE_LESSON);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLesson(SAMPLE_LESSON);
          setLoading(false);
        }
      }
    };

    void fetchCourse();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const rawCards = useMemo(() => {
    if (!lesson?.scenes) return [];
    return buildLessonFlashcards(lesson.scenes, t);
  }, [lesson, t]);

  const cards = useMemo(() => {
    if (!shuffled) return rawCards;
    return [...rawCards].sort(() => 0.5 - Math.random());
  }, [rawCards, shuffled]);

  // Audio pronunciation
  const speakText = useCallback(async (cardId: string, text: string) => {
    if (speakingId) return;
    setSpeakingId(cardId);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => setSpeakingId(null);
        await audio.play();
      } else {
        setSpeakingId(null);
      }
    } catch {
      setSpeakingId(null);
    }
  }, [speakingId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-sm text-mist-300">{t.loading}</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="panel p-8">
          <Sparkles className="mx-auto h-12 w-12 text-mist-500" />
          <h2 className="mt-4 text-lg font-bold text-mist-100">{t.emptyTitle}</h2>
          <p className="mt-2 text-sm text-mist-400">{t.emptyDesc}</p>
          <div className="mt-6 flex justify-center gap-3">
            {lesson?.id ? (
              <Link href={`/lesson?c=${encodeURIComponent(lesson.id)}`} className="btn-primary text-xs">
                {t.backToLesson}
              </Link>
            ) : null}
            <Link href="/library" className="btn-ghost text-xs">
              {t.backToLibrary}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 pb-20 text-mist-100">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {lesson?.id ? (
              <Link
                href={`/lesson?c=${encodeURIComponent(lesson.id)}`}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs font-semibold text-mist-300 transition-colors hover:border-brand-500/50 hover:bg-ink-800 hover:text-mist-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.backToLesson}</span>
              </Link>
            ) : (
              <Link
                href="/library"
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-xs font-semibold text-mist-300 transition-colors hover:border-brand-500/50 hover:bg-ink-800 hover:text-mist-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.backToLibrary}</span>
              </Link>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-mist-50 sm:text-base">
                {t.pageHeading.replace("{title}", lesson?.title || t.lessonFallback)}
              </h1>
              <p className="text-[11px] text-mist-400 truncate">
                {lesson?.subject} {lesson?.grade ? `· ${lesson.grade}` : ""} · {cards.length} {t.cardsUnit}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lesson?.id ? (
              <Link
                href={`/quiz?c=${encodeURIComponent(lesson.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-xs font-semibold text-gold-300 transition-colors hover:border-gold-400 hover:bg-gold-500/20"
                title={t.goToQuiz}
              >
                <HelpCircle className="h-3.5 w-3.5 text-gold-400" />
                <span className="hidden sm:inline">{t.goToQuiz}</span>
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => setPracticeOpen(true)}
              className="btn btn-primary text-xs py-1.5 px-3.5 font-semibold shadow-md"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              <span>{t.practiceBtn}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 space-y-6">
        {/* Title & Practice Banner */}
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-mist-50 sm:text-3xl">
            {t.pageHeading.replace("{title}", lesson?.title || t.lessonFallback)}
          </h2>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setPracticeOpen(true)}
              className="btn btn-primary w-full max-w-md py-3 text-sm font-bold shadow-lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {t.practiceBtn}
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-ink-800/80 pb-3 pt-3 text-xs text-mist-400">
            <button
              type="button"
              onClick={() => setShuffled((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/60 px-2.5 py-1 text-mist-300 hover:text-mist-100"
            >
              <Shuffle className="h-3.5 w-3.5 text-brand-300" />
              <span>{shuffled ? t.unshuffle : t.shuffle}</span>
            </button>

            <span className="font-medium text-mist-400">
              {t.listCount.replace("{n}", String(cards.length))}
            </span>
          </div>
        </div>

        {/* 1. Preview List of all Cards (Xem trước toàn bộ thẻ) */}
        <div className="space-y-4">
          {cards.map((card, idx) => {
            const catBadge = {
              concept: t.catConcept,
              formula: t.catFormula,
              quiz: t.catQuiz,
              example: t.catExample,
              summary: t.catSummary,
            }[card.category];

            const renderedFormula = card.formula
              ? (() => {
                  try {
                    return katex.renderToString(card.formula, {
                      displayMode: true,
                      throwOnError: false,
                    });
                  } catch {
                    return card.formula;
                  }
                })()
              : null;

            return (
              <div
                key={card.id}
                className="panel p-5 sm:p-6 rounded-2xl border border-ink-700 bg-ink-900/70 transition-all hover:border-ink-600 hover:bg-ink-900"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left content: Keyword, Definition, Examples */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-ink-800 font-mono text-[11px] font-bold text-mist-400">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-mist-50">
                        {card.keyword}
                      </h3>
                      <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-300">
                        {catBadge}
                      </span>
                      <button
                        type="button"
                        onClick={() => void speakText(card.id, `${card.keyword}. ${card.definition || ""}`)}
                        disabled={speakingId === card.id}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-700 bg-ink-800 text-mist-400 hover:text-brand-300 transition-colors"
                        title={t.listenAudio}
                      >
                        {speakingId === card.id ? (
                          <LoaderCircle className="h-3 w-3 animate-spin text-brand-300" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    {/* Definition */}
                    {card.definition ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-mist-500">
                          {t.definitionLabel}
                        </p>
                        <p className="mt-0.5 text-xs sm:text-sm text-mist-200 leading-relaxed font-medium">
                          <InlineText text={card.definition} />
                        </p>
                      </div>
                    ) : null}

                    {/* Formula if present */}
                    {renderedFormula ? (
                      <div
                        className="my-2 overflow-x-auto rounded-lg bg-ink-950/60 p-3 text-mist-50"
                        dangerouslySetInnerHTML={{ __html: renderedFormula }}
                      />
                    ) : null}

                    {/* Bullets / Examples */}
                    {card.bullets.length > 0 ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-mist-500">
                          {t.exampleLabel}
                        </p>
                        <ul className="mt-1 space-y-1 text-xs sm:text-sm text-mist-300 leading-relaxed">
                          {card.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              <span>
                                <InlineText text={b} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {/* Right side: Visual illustration or icon block */}
                  <div className="shrink-0 sm:self-center">
                    <div className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-2xl border border-ink-700/80 bg-ink-950/50 text-brand-300 shadow-inner">
                      {card.category === "formula" ? (
                        <div className="font-mono text-xl font-bold text-gold-300">f(x)</div>
                      ) : card.category === "quiz" ? (
                        <HelpCircle className="h-9 w-9 text-gold-400" />
                      ) : card.category === "example" ? (
                        <Sparkles className="h-9 w-9 text-brand-400" />
                      ) : (
                        <BookOpen className="h-9 w-9 text-brand-300" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Practice CTA */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={() => setPracticeOpen(true)}
            className="btn btn-primary w-full max-w-md py-3 text-sm font-bold shadow-lg"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t.practiceBtn}
          </button>
        </div>
      </main>

      {/* 2. Interactive Practice Modal (Luyện tập flashcards có lật mặt trước/sau) */}
      {lesson ? (
        <FlashcardModal
          open={practiceOpen}
          lesson={lesson}
          onClose={() => setPracticeOpen(false)}
        />
      ) : null}
    </div>
  );
}
