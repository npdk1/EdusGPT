"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import type { Lesson, LessonScene } from "@/lib/lesson/types";
import { useCopy } from "@/i18n/provider";
import { InlineText } from "./InlineText";

interface FlatQuizItem {
  id: string;
  sceneTitle: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

function extractAllQuizzes(scenes: LessonScene[]): FlatQuizItem[] {
  const items: FlatQuizItem[] = [];
  for (let sIdx = 0; sIdx < scenes.length; sIdx += 1) {
    const s = scenes[sIdx];
    if (s.kind === "quiz" && s.quiz) {
      if (Array.isArray(s.quiz.questions) && s.quiz.questions.length > 0) {
        s.quiz.questions.forEach((q, qIdx) => {
          items.push({
            id: `quiz-${s.id}-${qIdx}`,
            sceneTitle: s.title,
            question: q.question,
            options: q.options || [],
          });
        });
      } else if (s.quiz.question) {
        items.push({
          id: `quiz-${s.id}`,
          sceneTitle: s.title,
          question: s.quiz.question,
          options: s.quiz.options || [],
        });
      }
    }
  }
  return items;
}

const COPY = {
  en: {
    modalTitle: "Interactive Quiz Practice",
    questionCounter: "Question {current} of {total}",
    checkAnswer: "Check answer",
    nextQuestion: "Next question",
    completeTitle: "Quiz Completed!",
    scoreSummary: "You scored {score} / {total} correct ({percent}%)",
    praiseExcellent: "Outstanding mastery! You nailed almost everything.",
    praiseGood: "Good job! A solid understanding of the concepts.",
    praiseReview: "Keep practicing! Review the explanations to reinforce weak spots.",
    retryWrongOnly: "Retry incorrect questions ({count})",
    restartAll: "Restart all questions",
    correctFeedback: "Correct! Well done.",
    wrongFeedback: "Not quite right. Here is why:",
    close: "Close quiz mode",
    noQuizzes: "This lesson does not contain quiz questions yet.",
    selectKeysHint: "Keys 1-4 or A-D to select",
    continueEnterHint: "Press Enter to continue",
  },
  vi: {
    modalTitle: "Luyện trắc nghiệm tương tác",
    questionCounter: "Câu hỏi {current} trên {total}",
    checkAnswer: "Kiểm tra đáp án",
    nextQuestion: "Câu tiếp theo",
    completeTitle: "Hoàn thành bài kiểm tra!",
    scoreSummary: "Bạn đạt {score} / {total} câu đúng ({percent}%)",
    praiseExcellent: "Xuất sắc! Bạn đã nắm rất vững toàn bộ bài học.",
    praiseGood: "Làm tốt lắm! Bạn đã hiểu đúng các nội dung quan trọng.",
    praiseReview: "Cố gắng lên! Hãy đọc kỹ giải thích để củng cố điểm chưa nhớ.",
    retryWrongOnly: "Làm lại các câu sai ({count})",
    restartAll: "Làm lại toàn bộ",
    correctFeedback: "Chính xác! Rất tốt.",
    wrongFeedback: "Chưa chính xác. Giải thích chi tiết:",
    close: "Đóng chế độ trắc nghiệm",
    noQuizzes: "Bài giảng này chưa có câu hỏi trắc nghiệm.",
    selectKeysHint: "Phím 1-4 hoặc A-D để chọn",
    continueEnterHint: "Nhấn Enter để tiếp tục",
  },
};

interface QuizModalProps {
  open: boolean;
  lesson: Lesson;
  onClose: () => void;
}

export function QuizModal({ open, lesson, onClose }: QuizModalProps) {
  const t = useCopy(COPY);
  const allQuestions = useMemo(() => extractAllQuizzes(lesson.scenes), [lesson.scenes]);
  const [questions, setQuestions] = useState<FlatQuizItem[]>(allQuestions);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [wrongQuestionIds, setWrongQuestionIds] = useState<Set<string>>(new Set());
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    setQuestions(allQuestions);
    setQIndex(0);
    setSelectedOptId(null);
    setSubmitted(false);
    setResults([]);
    setWrongQuestionIds(new Set());
    setIsDone(false);
  }, [allQuestions, open]);

  const current = questions[qIndex];
  const chosenOpt = current?.options.find((opt) => opt.id === selectedOptId);
  const correctOpt = current?.options.find((opt) => opt.isCorrect);

  const handleSubmit = useCallback(() => {
    if (!selectedOptId || submitted || !current) return;
    const isCorrect = chosenOpt?.isCorrect ?? false;
    setSubmitted(true);
    setResults((prev) => [...prev, isCorrect]);
    if (!isCorrect) {
      setWrongQuestionIds((prev) => new Set([...prev, current.id]));
    }
  }, [chosenOpt, current, selectedOptId, submitted]);

  const handleNext = useCallback(() => {
    if (qIndex < questions.length - 1) {
      setQIndex((prev) => prev + 1);
      setSelectedOptId(null);
      setSubmitted(false);
    } else {
      setIsDone(true);
    }
  }, [qIndex, questions.length]);

  const handleRestartAll = useCallback(() => {
    setQuestions(allQuestions);
    setQIndex(0);
    setSelectedOptId(null);
    setSubmitted(false);
    setResults([]);
    setWrongQuestionIds(new Set());
    setIsDone(false);
  }, [allQuestions]);

  const handleRetryWrong = useCallback(() => {
    const wrongList = allQuestions.filter((q) => wrongQuestionIds.has(q.id));
    if (wrongList.length > 0) {
      setQuestions(wrongList);
      setQIndex(0);
      setSelectedOptId(null);
      setSubmitted(false);
      setResults([]);
      setWrongQuestionIds(new Set());
      setIsDone(false);
    }
  }, [allQuestions, wrongQuestionIds]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || isDone || !current) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!submitted) {
        if (e.key === "1" || e.key === "a" || e.key === "A") {
          if (current.options[0]) setSelectedOptId(current.options[0].id);
        } else if (e.key === "2" || e.key === "b" || e.key === "B") {
          if (current.options[1]) setSelectedOptId(current.options[1].id);
        } else if (e.key === "3" || e.key === "c" || e.key === "C") {
          if (current.options[2]) setSelectedOptId(current.options[2].id);
        } else if (e.key === "4" || e.key === "d" || e.key === "D") {
          if (current.options[3]) setSelectedOptId(current.options[3].id);
        } else if (e.code === "Enter" && selectedOptId) {
          e.preventDefault();
          handleSubmit();
        }
      } else {
        if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          handleNext();
        }
      }

      if (e.code === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isDone, current, submitted, selectedOptId, handleSubmit, handleNext, onClose]);

  if (!open) return null;

  const totalScore = results.filter(Boolean).length;
  const percentScore =
    questions.length > 0 ? Math.round((totalScore / questions.length) * 100) : 0;
  const praise =
    percentScore >= 85
      ? t.praiseExcellent
      : percentScore >= 60
        ? t.praiseGood
        : t.praiseReview;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.modalTitle}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-500/15 text-gold-300">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-mist-50">{t.modalTitle}</h2>
              <p className="text-[11px] text-mist-400">{lesson.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-ink-800 hover:text-mist-100"
            aria-label={t.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        {!isDone && questions.length > 0 ? (
          <div className="h-1 w-full bg-ink-800">
            <div
              className="h-full bg-gold-400 transition-all duration-300"
              style={{ width: `${((qIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        ) : null}

        {/* Body content */}
        <div className="p-6">
          {questions.length === 0 ? (
            <div className="py-8 text-center text-sm text-mist-400">
              {t.noQuizzes}
            </div>
          ) : isDone ? (
            /* Summary Completed Screen */
            <div className="flex flex-col items-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-300">
                <Award className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-mist-50">{t.completeTitle}</h3>
              <p className="mt-1 font-mono text-base font-semibold text-brand-300">
                {t.scoreSummary
                  .replace("{score}", String(totalScore))
                  .replace("{total}", String(questions.length))
                  .replace("{percent}", String(percentScore))}
              </p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-mist-300">{praise}</p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {wrongQuestionIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={handleRetryWrong}
                    className="btn btn-primary text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t.retryWrongOnly.replace("{count}", String(wrongQuestionIds.size))}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleRestartAll}
                  className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-2.5 text-xs font-semibold text-mist-100 transition-colors hover:bg-ink-700"
                >
                  {t.restartAll}
                </button>
              </div>
            </div>
          ) : current ? (
            /* Question Box */
            <div className="flex flex-col">
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="font-mono text-xs text-brand-300">
                  {t.questionCounter
                    .replace("{current}", String(qIndex + 1))
                    .replace("{total}", String(questions.length))}
                </span>
                <span className="truncate max-w-[14rem] text-[11px] text-mist-500">
                  {current.sceneTitle}
                </span>
              </div>

              <h4 className="text-base font-bold leading-relaxed text-mist-50 sm:text-lg">
                <InlineText text={current.question} />
              </h4>

              {/* Options */}
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {current.options.map((opt, idx) => {
                  const isSelected = selectedOptId === opt.id;
                  let borderBg = "border-ink-700 bg-ink-950/60 text-mist-200 hover:border-ink-600 hover:bg-ink-900";
                  if (isSelected && !submitted) {
                    borderBg = "border-brand-400 bg-brand-500/15 text-mist-50 shadow-sm";
                  } else if (submitted) {
                    if (opt.isCorrect) {
                      borderBg = "border-brand-500/70 bg-brand-500/20 text-brand-100 ring-1 ring-brand-500";
                    } else if (isSelected) {
                      borderBg = "border-ember-500/60 bg-ember-500/15 text-ember-200";
                    } else {
                      borderBg = "border-ink-800 bg-ink-950/30 text-mist-500 opacity-60";
                    }
                  }

                  const letter = String.fromCharCode(65 + idx);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={submitted}
                      onClick={() => setSelectedOptId(opt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${borderBg}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-900 font-mono text-xs font-bold text-mist-300">
                        {letter}
                      </span>
                      <span className="min-w-0 flex-1 text-xs leading-relaxed">
                        <InlineText text={opt.text} />
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Feedback Banner */}
              {submitted ? (
                <div
                  className={`mt-4 rounded-xl border p-3.5 text-xs leading-relaxed ${
                    chosenOpt?.isCorrect
                      ? "border-brand-500/40 bg-brand-500/10 text-mist-100"
                      : "border-ember-500/40 bg-ember-500/10 text-mist-100"
                  }`}
                >
                  <p className="flex items-center gap-1.5 font-bold">
                    {chosenOpt?.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-brand-300" />
                        <span className="text-brand-300">{t.correctFeedback}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-ember-400" />
                        <span className="text-ember-300">{t.wrongFeedback}</span>
                      </>
                    )}
                  </p>
                  {correctOpt?.explanation ? (
                    <p className="mt-1.5 text-mist-200">
                      <InlineText text={correctOpt.explanation} />
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Bottom control bar */}
              <div className="mt-6 flex items-center justify-between border-t border-ink-800/80 pt-4">
                <span className="text-[11px] text-mist-500">
                  {!submitted ? t.selectKeysHint : t.continueEnterHint}
                </span>
                {!submitted ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedOptId}
                    className="btn btn-primary text-xs py-2 px-4 disabled:opacity-40"
                  >
                    {t.checkAnswer}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="btn btn-primary text-xs py-2 px-4"
                  >
                    <span>{t.nextQuestion}</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
