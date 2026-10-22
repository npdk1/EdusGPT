"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  BookOpen,
  Award,
  Shuffle,
} from "lucide-react";
import katex from "katex";
import { cleanLatex } from "@/lib/lesson/inline";
import type { Lesson, LessonScene } from "@/lib/lesson/types";
import { useCopy } from "@/i18n/provider";

interface Flashcard {
  id: string;
  category: "concept" | "formula" | "quiz" | "example" | "summary";
  frontTitle: string;
  frontPrompt: string;
  backSubtitle?: string;
  backBullets: string[];
  backFormula?: string;
  backExplanation?: string;
}

const COPY = {
  en: {
    flashcardTitle: "Quick Flashcard Revision",
    flashcardSubtitle: "Reinforce key concepts, formulas, and test yourself",
    cardIndex: "Card {current} of {total}",
    flipHint: "Click or press Space to flip",
    flipAction: "Flip card",
    prevCard: "Previous",
    nextCard: "Next",
    markReview: "Need review",
    markMastered: "Mastered",
    shuffle: "Shuffle",
    unshuffle: "Original order",
    completeTitle: "Revision session completed!",
    completeScore: "You mastered {mastered} of {total} cards.",
    reviewWeak: "Review cards needing work ({count})",
    restartAll: "Restart all cards",
    close: "Close flashcard mode",
    catConcept: "Core Concept",
    catFormula: "Formula & Law",
    catQuiz: "Check Yourself",
    catExample: "Worked Example",
    catSummary: "Key Takeaway",
    promptFormula: "What is the core law or mathematical formula to remember?",
    promptQuiz: "Select the correct answer and reason why:",
    promptExample: "Approach and step-by-step problem solving method:",
    promptSummary: "Summary of the core key takeaways from the lesson:",
    promptConcept: "Concept definition and essential characteristics:",
    correctAnswerPrefix: "Correct answer",
    markReviewTitle: "Key 1: Need to review this card",
    markMasteredTitle: "Key 2: Mastered this card",
    badgeSmartRevision: "EdusGPT Smart Revision",
  },
  vi: {
    flashcardTitle: "Thẻ ghi nhớ · Ôn tập nhanh",
    flashcardSubtitle: "Khắc sâu khái niệm cốt lõi, công thức và tự kiểm tra",
    cardIndex: "Thẻ {current} trên {total}",
    flipHint: "Nhấn chuột hoặc phím Space để lật thẻ",
    flipAction: "Lật thẻ",
    prevCard: "Thẻ trước",
    nextCard: "Thẻ sau",
    markReview: "Cần xem lại",
    markMastered: "Đã thuộc",
    shuffle: "Xáo trộn",
    unshuffle: "Thứ tự gốc",
    completeTitle: "Hoàn thành buổi ôn tập!",
    completeScore: "Bạn đã thuộc {mastered} trên {total} thẻ ghi nhớ.",
    reviewWeak: "Ôn lại các thẻ chưa nhớ ({count})",
    restartAll: "Ôn lại toàn bộ",
    close: "Đóng thẻ ghi nhớ",
    catConcept: "Khái niệm cốt lõi",
    catFormula: "Công thức & Định luật",
    catQuiz: "Tự kiểm tra",
    catExample: "Ví dụ giải toán",
    catSummary: "Tổng kết bài học",
    promptFormula: "Định luật hoặc công thức toán học cần ghi nhớ là gì?",
    promptQuiz: "Chọn câu trả lời đúng và giải thích vì sao:",
    promptExample: "Cách tiếp cận và các bước giải quyết từng bước:",
    promptSummary: "Tổng kết lại toàn bộ các điểm cốt lõi của bài học:",
    promptConcept: "Bản chất khái niệm và các đặc điểm quan trọng:",
    correctAnswerPrefix: "Đáp án chính xác",
    markReviewTitle: "Phím 1: Cần xem lại thẻ này",
    markMasteredTitle: "Phím 2: Đã thuộc thẻ này",
    badgeSmartRevision: "EdusGPT Ôn tập thông minh",
  },
};

function buildFlashcards(scenes: LessonScene[], t: typeof COPY.en): Flashcard[] {
  const cards: Flashcard[] = [];

  for (let i = 0; i < scenes.length; i += 1) {
    const s = scenes[i];
    if (s.kind === "cover") continue;

    if (s.kind === "formula" || s.formula) {
      cards.push({
        id: `card-${s.id}`,
        category: "formula",
        frontTitle: s.title,
        frontPrompt: t.promptFormula,
        backSubtitle: s.subtitle,
        backBullets: s.bullets || [],
        backFormula: s.formula,
        backExplanation: s.steps ? s.steps.join("\n") : undefined,
      });
      continue;
    }

    if (s.kind === "quiz" && s.quiz) {
      const q = s.quiz.question || s.title;
      const correct = s.quiz.options?.find((opt) => opt.isCorrect);
      cards.push({
        id: `card-${s.id}`,
        category: "quiz",
        frontTitle: q,
        frontPrompt: t.promptQuiz,
        backSubtitle: correct ? `${t.correctAnswerPrefix}: ${correct.text}` : undefined,
        backBullets: correct?.explanation ? [correct.explanation] : s.bullets || [],
        backExplanation: s.subtitle,
      });
      continue;
    }

    if (s.kind === "example") {
      cards.push({
        id: `card-${s.id}`,
        category: "example",
        frontTitle: s.title,
        frontPrompt: s.subtitle || t.promptExample,
        backSubtitle: s.subtitle,
        backBullets: s.steps && s.steps.length > 0 ? s.steps : s.bullets || [],
      });
      continue;
    }

    if (s.kind === "summary") {
      cards.push({
        id: `card-${s.id}`,
        category: "summary",
        frontTitle: s.title,
        frontPrompt: t.promptSummary,
        backSubtitle: s.subtitle,
        backBullets: s.bullets || [],
      });
      continue;
    }

    // Default: concept
    cards.push({
      id: `card-${s.id}`,
      category: "concept",
      frontTitle: s.title,
      frontPrompt: s.subtitle || t.promptConcept,
      backSubtitle: s.subtitle,
      backBullets: s.bullets || [],
    });
  }

  return cards;
}

interface FlashcardModalProps {
  open: boolean;
  lesson: Lesson;
  onClose: () => void;
}

export function FlashcardModal({ open, lesson, onClose }: FlashcardModalProps) {
  const t = useCopy(COPY);
  const initialCards = useMemo(() => buildFlashcards(lesson.scenes, t), [lesson.scenes, t]);
  const [deck, setDeck] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setDeck(initialCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
    setReviewIds(new Set());
    setIsCompleted(false);
  }, [initialCards, open]);

  const currentCard = deck[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsCompleted(true);
    }
  }, [currentIndex, deck.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleMarkMastered = useCallback(() => {
    if (!currentCard) return;
    setMasteredIds((prev) => new Set([...prev, currentCard.id]));
    setReviewIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  }, [currentCard, handleNext]);

  const handleMarkReview = useCallback(() => {
    if (!currentCard) return;
    setReviewIds((prev) => new Set([...prev, currentCard.id]));
    setMasteredIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    handleNext();
  }, [currentCard, handleNext]);

  const handleRestart = useCallback(() => {
    setDeck(initialCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setMasteredIds(new Set());
    setReviewIds(new Set());
    setIsCompleted(false);
  }, [initialCards]);

  const handleReviewWeakOnly = useCallback(() => {
    const weakCards = initialCards.filter((c) => reviewIds.has(c.id));
    if (weakCards.length > 0) {
      setDeck(weakCards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setIsCompleted(false);
    }
  }, [initialCards, reviewIds]);

  const handleShuffle = useCallback(() => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [deck]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "1") {
        e.preventDefault();
        handleMarkReview();
      } else if (e.key === "2") {
        e.preventDefault();
        handleMarkMastered();
      } else if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleNext, handlePrev, handleMarkMastered, handleMarkReview, onClose]);

  if (!open) return null;

  const categoryLabel = {
    concept: t.catConcept,
    formula: t.catFormula,
    quiz: t.catQuiz,
    example: t.catExample,
    summary: t.catSummary,
  }[currentCard?.category || "concept"];

  const renderedFormulaHtml = currentCard?.backFormula
    ? (() => {
        try {
          return katex.renderToString(cleanLatex(currentCard.backFormula), {
            displayMode: true,
            throwOnError: false,
          });
        } catch {
          return currentCard.backFormula;
        }
      })()
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.flashcardTitle}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-mist-50">{t.flashcardTitle}</h2>
              <p className="text-[11px] text-mist-400">{lesson.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isCompleted ? (
              <button
                type="button"
                onClick={handleShuffle}
                className="flex items-center gap-1 rounded-lg border border-ink-700 px-2 py-1 text-xs text-mist-300 transition-colors hover:bg-ink-800 hover:text-mist-100"
                title={t.shuffle}
              >
                <Shuffle className="h-3.5 w-3.5" />
                <span>{t.shuffle}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-ink-800 hover:text-mist-100"
              aria-label={t.close}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress strip */}
        {!isCompleted && deck.length > 0 ? (
          <div className="h-1 w-full bg-ink-800">
            <div
              className="h-full bg-brand-400 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
            />
          </div>
        ) : null}

        {/* Main Content Area */}
        <div className="p-6">
          {isCompleted ? (
            /* Summary Completed Screen */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-300">
                <Award className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-mist-50">{t.completeTitle}</h3>
              <p className="mt-1 text-sm text-mist-300">
                {t.completeScore
                  .replace("{mastered}", String(masteredIds.size))
                  .replace("{total}", String(deck.length))}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {reviewIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={handleReviewWeakOnly}
                    className="btn btn-primary text-xs"
                  >
                    {t.reviewWeak.replace("{count}", String(reviewIds.size))}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleRestart}
                  className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2.5 text-xs font-semibold text-mist-100 transition-colors hover:bg-ink-700"
                >
                  {t.restartAll}
                </button>
              </div>
            </div>
          ) : currentCard ? (
            /* The Flashcard Box */
            <div className="flex flex-col">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="rounded-md border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 font-medium text-brand-300">
                  {categoryLabel}
                </span>
                <span className="font-mono text-[11px] text-mist-400">
                  {t.cardIndex
                    .replace("{current}", String(currentIndex + 1))
                    .replace("{total}", String(deck.length))}
                </span>
              </div>

              {/* 3D Flip Card Container */}
              <div
                tabIndex={0}
                role="button"
                aria-pressed={isFlipped}
                onClick={() => setIsFlipped((prev) => !prev)}
                className="group relative flex min-h-[19rem] cursor-pointer flex-col justify-between rounded-xl border border-ink-700 bg-ink-950/70 p-6 shadow-inner transition-all hover:border-brand-500/50 hover:bg-ink-950 focus:border-brand-400 focus:outline-none"
              >
                {!isFlipped ? (
                  /* Mặt trước (Front) */
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-wider text-mist-400">
                        {currentCard.frontPrompt}
                      </p>
                      <h4 className="text-xl font-bold leading-snug text-mist-50">
                        {currentCard.frontTitle}
                      </h4>
                    </div>
                    <div className="mt-6 flex items-center gap-1.5 text-xs text-mist-500 transition-colors group-hover:text-brand-300">
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{t.flipHint}</span>
                    </div>
                  </div>
                ) : (
                  /* Mặt sau (Back) */
                  <div className="flex flex-1 flex-col justify-between">
                    <div className="space-y-3">
                      {currentCard.backSubtitle ? (
                        <p className="text-xs font-semibold text-brand-300">
                          {currentCard.backSubtitle}
                        </p>
                      ) : null}

                      {renderedFormulaHtml ? (
                        <div
                          className="my-3 overflow-x-auto rounded-lg bg-ink-900/60 p-3 text-mist-50"
                          dangerouslySetInnerHTML={{ __html: renderedFormulaHtml }}
                        />
                      ) : null}

                      {currentCard.backBullets.length > 0 ? (
                        <ul className="space-y-1.5 text-sm leading-relaxed text-mist-200">
                          {currentCard.backBullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-ink-800/80 pt-3 text-[11px] text-mist-500">
                      <span>{t.flipAction} (Space)</span>
                      <span className="text-brand-400">{t.badgeSmartRevision}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800/80 px-3 py-1.5 text-xs text-mist-200 transition-colors hover:bg-ink-700 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{t.prevCard}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800/80 px-3 py-1.5 text-xs text-mist-200 transition-colors hover:bg-ink-700"
                  >
                    <span>{t.nextCard}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMarkReview}
                    className="flex items-center gap-1.5 rounded-lg border border-ember-500/40 bg-ember-500/10 px-3 py-1.5 text-xs font-semibold text-ember-300 transition-colors hover:bg-ember-500/20"
                    title={t.markReviewTitle}
                  >
                    <XCircle className="h-4 w-4 text-ember-400" />
                    <span>{t.markReview}</span>
                    <kbd className="kbd ml-1 text-[10px]">1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkMastered}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200 transition-colors hover:bg-brand-500/20"
                    title={t.markMasteredTitle}
                  >
                    <CheckCircle2 className="h-4 w-4 text-brand-300" />
                    <span>{t.markMastered}</span>
                    <kbd className="kbd ml-1 text-[10px]">2</kbd>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
