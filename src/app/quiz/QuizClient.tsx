"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Award,
  Send,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import "katex/dist/katex.min.css";
import type { Lesson, LessonScene } from "@/lib/lesson/types";
import { SAMPLE_LESSON } from "@/lib/lesson/sample-lesson";
import { useCopy } from "@/i18n/provider";
import { InlineText } from "@/components/player/InlineText";

interface FlatQuizQuestion {
  id: string;
  index: number;
  sceneTitle: string;
  question: string;
  options: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

function extractLessonQuizzes(scenes: LessonScene[]): FlatQuizQuestion[] {
  const list: FlatQuizQuestion[] = [];
  let count = 1;

  for (let sIdx = 0; sIdx < scenes.length; sIdx += 1) {
    const s = scenes[sIdx];
    if (s.kind === "quiz" && s.quiz) {
      if (Array.isArray(s.quiz.questions) && s.quiz.questions.length > 0) {
        for (const q of s.quiz.questions) {
          list.push({
            id: `q-${count}`,
            index: count,
            sceneTitle: s.title,
            question: q.question,
            options: q.options || [],
          });
          count += 1;
        }
      } else if (s.quiz.question) {
        list.push({
          id: `q-${count}`,
          index: count,
          sceneTitle: s.title,
          question: s.quiz.question,
          options: s.quiz.options || [],
        });
        count += 1;
      }
    }
  }

  return list;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const COPY = {
  en: {
    backToLesson: "Back to lesson",
    backToLibrary: "Library",
    submitQuiz: "Submit quiz",
    submitting: "Submitting…",
    confirmSubmitTitle: "Submit quiz?",
    confirmSubmitBlank: "You have not answered any questions (Blank submission). All questions will be scored 0. Submit anyway?",
    confirmSubmitHalfway: "You have answered {answered} of {total} questions ({unanswered} unanswered). Unanswered questions will be scored as incorrect. Submit anyway?",
    confirmSubmitComplete: "You have answered all {total} questions! Ready to grade your quiz?",
    btnContinueTesting: "Continue quiz",
    btnConfirmSubmit: "Confirm submission",
    confirmSubmitUnanswered: "You still have {unanswered} unanswered questions. Submit anyway?",
    submitSuccess: "Quiz submitted! Check your score and review the explanations below.",
    questionList: "Question list",
    chooseOneOption: "Select one correct answer",
    questionLabel: "Question {n}",
    answeredCount: "Answered: {answered} / {total}",
    scoreTitle: "Final score: {score} / {total} correct ({percent}%)",
    praiseTop: "Outstanding! You demonstrated deep mastery of the material.",
    praiseMid: "Well done! You grasped the essential concepts.",
    praiseLow: "Review recommended. Read the explanations to strengthen weak points.",
    retryQuiz: "Retake quiz",
    explanationTitle: "Detailed explanation",
    correctVerdict: "Correct answer!",
    wrongVerdict: "Incorrect answer.",
    noQuizzesTitle: "No quiz questions found",
    noQuizzesDesc: "This lesson has no embedded quiz questions. You can study the slides or create a new lesson.",
    loadingLesson: "Loading quiz questions…",
    questionsCount: "{n} questions",
    flashcardBtn: "Flashcards",
    goToFlashcardTitle: "Open flashcard revision mode",
    reviewFlashcards: "Review flashcards",
    answeredState: "Answered",
    unansweredState: "Unanswered",
    answeredCountLabel: "Answered questions:",
    unansweredCountLabel: "Unanswered questions:",
    unansweredUnit: "{n} questions",
    lessonFallback: "Quiz practice",
  },
  vi: {
    backToLesson: "Quay lại bài giảng",
    backToLibrary: "Thư viện bài học",
    submitQuiz: "Nộp bài",
    submitting: "Đang nộp…",
    confirmSubmitTitle: "Xác nhận nộp bài?",
    confirmSubmitBlank: "Bạn chưa chọn đáp án cho câu nào (Nộp bài trắng). Toàn bộ câu hỏi sẽ được tính là sai. Bạn có chắc chắn muốn nộp không?",
    confirmSubmitHalfway: "Bạn đã làm {answered}/{total} câu (còn {unanswered} câu chưa làm). Các câu chưa làm sẽ được tính là sai. Bạn có chắc chắn muốn nộp không?",
    confirmSubmitComplete: "Bạn đã hoàn thành toàn bộ {total}/{total} câu hỏi! Sẵn sàng nộp bài và xem kết quả?",
    btnContinueTesting: "Tiếp tục làm bài",
    btnConfirmSubmit: "Xác nhận nộp bài",
    confirmSubmitUnanswered: "Bạn vẫn còn {unanswered} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài không?",
    submitSuccess: "Đã nộp bài! Xem điểm số và đối chiếu lời giải chi tiết bên dưới.",
    questionList: "Danh sách câu hỏi",
    chooseOneOption: "Chọn một đáp án đúng",
    questionLabel: "Câu {n}",
    answeredCount: "Đã làm: {answered} / {total}",
    scoreTitle: "Kết quả: {score} / {total} câu đúng ({percent}%)",
    praiseTop: "Xuất sắc! Bạn đã nắm rất vững toàn bộ kiến thức bài học.",
    praiseMid: "Làm tốt lắm! Bạn đã nắm được các trọng tâm cốt lõi.",
    praiseLow: "Cần ôn tập thêm. Hãy đọc kỹ phần giải thích chi tiết để củng cố kiến thức.",
    retryQuiz: "Làm lại bài thi",
    explanationTitle: "Lời giải chi tiết",
    correctVerdict: "Chính xác!",
    wrongVerdict: "Chưa chính xác.",
    noQuizzesTitle: "Không tìm thấy câu hỏi trắc nghiệm",
    noQuizzesDesc: "Bài học này chưa có câu hỏi trắc nghiệm nào. Bạn có thể mở bài giảng hoặc tạo bài học mới.",
    loadingLesson: "Đang tải dữ liệu câu hỏi trắc nghiệm…",
    questionsCount: "{n} câu hỏi",
    flashcardBtn: "Thẻ ghi nhớ",
    goToFlashcardTitle: "Mở thẻ ghi nhớ ôn tập",
    reviewFlashcards: "Ôn tập thẻ ghi nhớ",
    answeredState: "Đã chọn",
    unansweredState: "Chưa chọn",
    answeredCountLabel: "Số câu đã làm:",
    unansweredCountLabel: "Số câu còn trống:",
    unansweredUnit: "{n} câu",
    lessonFallback: "Bài trắc nghiệm",
  },
};

interface QuizClientProps {
  courseId: string | null;
}

export function QuizClient({ courseId }: QuizClientProps) {
  const t = useCopy(COPY);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Load lesson
  useEffect(() => {
    let cancelled = false;
    const fetchCourse = async () => {
      setLoading(true);
      try {
        if (!courseId) {
          // If no courseId specified, try to fetch the latest course from /api/courses
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

  // Timer
  useEffect(() => {
    if (submitted || loading || !lesson) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((sec) => sec + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [submitted, loading, lesson]);

  const questions = useMemo(() => {
    if (!lesson?.scenes) return [];
    return extractLessonQuizzes(lesson.scenes);
  }, [lesson]);

  const answeredCount = Object.keys(selectedAnswers).length;

  const handleSelectOption = (qIdx: number, optId: string) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [qIdx]: optId,
    }));
  };

  const scrollToQuestion = (qNumber: number) => {
    const el = document.getElementById(`cau-hoi-${qNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSubmit = () => {
    if (submitted) return;
    setConfirmOpen(true);
  };

  const confirmSubmitAction = () => {
    setConfirmOpen(false);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRetake = () => {
    setSelectedAnswers({});
    setSubmitted(false);
    setElapsedSeconds(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Score calculation
  const score = useMemo(() => {
    if (!submitted) return 0;
    let correct = 0;
    questions.forEach((q, idx) => {
      const chosenId = selectedAnswers[idx];
      const correctOpt = q.options.find((opt) => opt.isCorrect);
      if (chosenId && correctOpt && chosenId === correctOpt.id) {
        correct += 1;
      }
    });
    return correct;
  }, [submitted, questions, selectedAnswers]);

  const percent = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const praise =
    percent >= 85 ? t.praiseTop : percent >= 60 ? t.praiseMid : t.praiseLow;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-sm text-mist-300">{t.loadingLesson}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="panel p-8">
          <HelpCircle className="mx-auto h-12 w-12 text-mist-500" />
          <h2 className="mt-4 text-lg font-bold text-mist-100">{t.noQuizzesTitle}</h2>
          <p className="mt-2 text-sm text-mist-400">{t.noQuizzesDesc}</p>
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
    <div className="min-h-screen bg-ink-950 pb-16 text-mist-100">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
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
                {lesson?.title || t.lessonFallback}
              </h1>
              <p className="text-[11px] text-mist-400 truncate">
                {lesson?.subject} {lesson?.grade ? `· ${lesson.grade}` : ""} · {t.questionsCount.replace("{n}", String(questions.length))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-1.5 font-mono text-xs text-mist-200">
              <Clock className="h-3.5 w-3.5 text-brand-300" />
              <span>{formatTimer(elapsedSeconds)}</span>
            </div>

            {lesson?.id ? (
              <Link
                href={`/flashcard?c=${encodeURIComponent(lesson.id)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:border-brand-400 hover:bg-brand-500/20"
                title={t.goToFlashcardTitle}
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-300" />
                <span className="hidden sm:inline">{t.flashcardBtn}</span>
              </Link>
            ) : null}

            {!submitted ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="btn btn-primary text-xs py-1.5 px-4 font-semibold shadow-md"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                <span>{t.submitQuiz}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetake}
                className="btn btn-primary text-xs py-1.5 px-4 font-semibold shadow-md"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span>{t.retryQuiz}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: All Questions (kể hết câu hỏi ra luôn) */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-5">
            {/* Post-submission Result Banner */}
            {submitted ? (
              <div className="panel flex flex-col sm:flex-row items-center gap-4 border-brand-500/50 bg-brand-500/10 p-5 rounded-2xl">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500/20 text-brand-300">
                  <Award className="h-7 w-7" />
                </div>
                <div className="text-center sm:text-left flex-1 min-w-0">
                  <h3 className="text-base font-bold text-mist-50 sm:text-lg">
                    {t.scoreTitle
                      .replace("{score}", String(score))
                      .replace("{total}", String(questions.length))
                      .replace("{percent}", String(percent))}
                  </h3>
                  <p className="mt-1 text-xs text-mist-200">{praise}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn btn-primary text-xs shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  {t.retryQuiz}
                </button>
              </div>
            ) : null}

            {/* List of all questions */}
            {questions.map((q, qIdx) => {
              const selectedOptId = selectedAnswers[qIdx];
              const isAnswered = Boolean(selectedOptId);
              const correctOpt = q.options.find((opt) => opt.isCorrect);
              const isUserCorrect = submitted && selectedOptId === correctOpt?.id;

              return (
                <article
                  key={q.id}
                  id={`cau-hoi-${q.index}`}
                  className="panel p-5 sm:p-6 rounded-2xl transition-all"
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-800 font-mono text-xs font-bold text-brand-300">
                        {String(q.index).padStart(2, "0")}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-mist-400">
                        {t.questionLabel.replace("{n}", String(q.index))}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-mist-500">
                      {t.chooseOneOption}
                    </span>
                  </div>

                  {/* Question Text */}
                  <div className="mt-4">
                    <h2 className="text-base font-bold leading-relaxed text-mist-50 sm:text-lg">
                      <InlineText text={q.question} />
                    </h2>
                  </div>

                  {/* Options List */}
                  <div className="mt-5 space-y-2.5">
                    {q.options.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isSelected = selectedOptId === opt.id;

                      let stateClass = "border-ink-700 bg-ink-950/60 text-mist-200 hover:border-ink-600 hover:bg-ink-900";
                      let letterClass = "border-ink-700 bg-ink-900 text-mist-400";

                      if (!submitted) {
                        if (isSelected) {
                          stateClass = "border-brand-500 bg-brand-500/15 text-mist-50 ring-1 ring-brand-500";
                          letterClass = "border-brand-400 bg-brand-500 text-white font-bold";
                        }
                      } else {
                        // After submission: highlight correct and wrong
                        if (opt.isCorrect) {
                          stateClass = "border-emerald-500/80 bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500";
                          letterClass = "border-emerald-400 bg-emerald-500 text-white font-bold";
                        } else if (isSelected) {
                          stateClass = "border-rose-500/80 bg-rose-500/20 text-rose-100 ring-1 ring-rose-500";
                          letterClass = "border-rose-400 bg-rose-500 text-white font-bold";
                        } else {
                          stateClass = "border-ink-800 bg-ink-950/30 text-mist-500 opacity-60";
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={submitted}
                          onClick={() => handleSelectOption(qIdx, opt.id)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${stateClass}`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border font-mono text-xs transition-colors ${letterClass}`}
                          >
                            {letter}
                          </span>
                          <span className="min-w-0 flex-1 text-xs sm:text-sm leading-relaxed">
                            <InlineText text={opt.text} />
                          </span>
                          {submitted ? (
                            opt.isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                            ) : isSelected ? (
                              <XCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                            ) : null
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* Detailed Explanation under each question after submit */}
                  {submitted ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 text-xs leading-relaxed ${
                        isUserCorrect
                          ? "border-emerald-500/40 bg-emerald-500/10 text-mist-100"
                          : "border-rose-500/40 bg-rose-500/10 text-mist-100"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        {isUserCorrect ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span className="text-emerald-300">{t.correctVerdict}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-rose-400" />
                            <span className="text-rose-300">{t.wrongVerdict}</span>
                          </>
                        )}
                      </div>
                      {correctOpt?.explanation ? (
                        <div className="mt-2 text-mist-200">
                          <p className="font-semibold text-mist-100 mb-0.5">{t.explanationTitle}:</p>
                          <InlineText text={correctOpt.explanation} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {/* Right Sidebar: Sticky Question Palette (Danh sách câu hỏi) */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="sticky top-20 panel p-5 space-y-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-bold text-mist-50">{t.questionList}</h3>
                <p className="mt-0.5 text-xs text-mist-400">
                  {t.answeredCount
                    .replace("{answered}", String(answeredCount))
                    .replace("{total}", String(questions.length))}
                </p>
              </div>

              {/* 5-Column Question Grid */}
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const correctOpt = q.options.find((opt) => opt.isCorrect);
                  const isCorrect = submitted && selectedAnswers[idx] === correctOpt?.id;

                  let boxClass = "border-ink-700 bg-ink-950/40 text-mist-400 hover:border-brand-500/50 hover:bg-ink-900";

                  if (!submitted) {
                    if (isAnswered) {
                      // Câu nào làm xong thì tô lên!
                      boxClass = "border-brand-500 bg-brand-500/25 text-brand-200 font-bold shadow-sm";
                    }
                  } else {
                    // Sau khi làm xong: đúng thì xanh lá, sai thì tô đỏ
                    if (isCorrect) {
                      boxClass = "border-emerald-500/80 bg-emerald-500/25 text-emerald-300 font-bold";
                    } else {
                      boxClass = "border-rose-500/80 bg-rose-500/25 text-rose-300 font-bold";
                    }
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollToQuestion(q.index)}
                      className={`flex h-9 w-full items-center justify-center rounded-lg border font-mono text-xs transition-colors ${boxClass}`}
                      title={`${t.questionLabel.replace("{n}", String(q.index))}: ${isAnswered ? t.answeredState : t.unansweredState}`}
                    >
                      {String(q.index).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>

              {/* Action buttons in sidebar */}
              <div className="border-t border-ink-800/80 pt-4 space-y-2">
                {!submitted ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="btn btn-primary w-full text-xs font-semibold py-2.5 justify-center"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {t.submitQuiz}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="btn btn-primary w-full text-xs font-semibold py-2.5 justify-center"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t.retryQuiz}
                    </button>
                    {lesson?.id ? (
                      <>
                        <Link
                          href={`/flashcard?c=${encodeURIComponent(lesson.id)}`}
                          className="btn-ghost w-full text-xs py-2 justify-center rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-200 block text-center hover:bg-brand-500/20"
                        >
                          {t.reviewFlashcards}
                        </Link>
                        <Link
                          href={`/lesson?c=${encodeURIComponent(lesson.id)}`}
                          className="btn-ghost w-full text-xs py-2 justify-center rounded-xl border border-ink-700 block text-center"
                        >
                          {t.backToLesson}
                        </Link>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Hộp thoại Cảnh báo trước khi nộp bài */}
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  answeredCount === 0 || questions.length - answeredCount > 0
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-brand-500/15 text-brand-300"
                }`}
              >
                {answeredCount === 0 || questions.length - answeredCount > 0 ? (
                  <AlertCircle className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-mist-50">
                  {t.confirmSubmitTitle}
                </h3>
                <p className="text-xs text-mist-400">
                  {lesson?.title}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-mist-300">
                <span>{t.answeredCountLabel}</span>
                <span className="font-mono font-bold text-brand-300">
                  {answeredCount} / {questions.length}
                </span>
              </div>
              <div className="flex justify-between text-mist-300">
                <span>{t.unansweredCountLabel}</span>
                <span
                  className={`font-mono font-bold ${
                    questions.length - answeredCount > 0 ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {t.unansweredUnit.replace("{n}", String(questions.length - answeredCount))}
                </span>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-mist-300">
              {answeredCount === 0
                ? t.confirmSubmitBlank
                : questions.length - answeredCount > 0
                  ? t.confirmSubmitHalfway
                      .replace("{answered}", String(answeredCount))
                      .replace("{total}", String(questions.length))
                      .replace("{unanswered}", String(questions.length - answeredCount))
                  : t.confirmSubmitComplete.replace("{total}", String(questions.length))}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="btn-ghost text-xs px-3.5 py-2 rounded-xl"
              >
                {t.btnContinueTesting}
              </button>
              <button
                type="button"
                onClick={confirmSubmitAction}
                className="btn btn-primary text-xs px-4 py-2 font-semibold shadow-md"
              >
                {t.btnConfirmSubmit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
