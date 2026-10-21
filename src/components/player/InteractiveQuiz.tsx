"use client";

import { useState } from "react";
import { CircleCheck, CircleX, CircleHelp } from "lucide-react";
import type { QuizOption, QuizQuestion } from "@/lib/lesson/types";
import { quizPraiseTier, quizQuestionsOf, quizReadSeconds } from "@/lib/lesson/quiz";
import { InlineText } from "./InlineText";
import { useCopy } from "@/i18n/provider";

interface InteractiveQuizProps {
  /** The slide this quiz belongs to, so the stage can open its own gate. */
  sceneId: string;
  question: string;
  options: QuizOption[];
  /**
   * The question bank, when the slide carries several questions. Absent (or a
   * single entry) means the classic one-question slide, which renders exactly
   * as it always has.
   */
  questions?: QuizQuestion[];
  /**
   * True while the stage's post-answer wait is actually running. The countdown
   * line is a promise about a timer, so it is printed only while one exists —
   * an answered quiz revisited later used to promise a jump that had long left.
   */
  autoNextPending?: boolean;
  onAnswer?: (result: {
    sceneId: string;
    isCorrect: boolean;
    explanation?: string;
    readSeconds: number;
  }) => void;
}

const COPY = {
  en: {
    quizKicker: "Quiz",
    quizCorrect: "Correct.",
    quizWrong: "Not quite.",
    quizCheck: "Check answer",
    quizAutoNext: "Moving to the next slide in {n}s",
    quizNext: "Next question",
    quizCount: "Question {i}/{n}",
    quizScore: "{n} of {total} correct",
    quizPraiseAll: "Excellent — you can move on with confidence.",
    quizPraiseMid: "Good grasp — skim the parts you missed and you're set.",
    quizPraiseLow: "Worth a second look at the lesson before moving on.",
  },
  vi: {
    quizKicker: "Trắc nghiệm",
    quizCorrect: "Chính xác.",
    quizWrong: "Chưa đúng.",
    quizCheck: "Kiểm tra đáp án",
    quizAutoNext: "Tự chuyển cảnh sau {n} giây",
    quizNext: "Câu tiếp",
    quizCount: "Câu {i}/{n}",
    quizScore: "Đúng {n}/{total} câu",
    quizPraiseAll: "Xuất sắc — tự tin đi tiếp nhé.",
    quizPraiseMid: "Nắm khá tốt — xem lại vài chỗ vừa sai là ổn.",
    quizPraiseLow: "Nên xem lại bài một lượt trước khi đi tiếp.",
  },
};

/**
 * The quiz, as a slide rather than as a web widget.
 *
 * This was a dark rounded panel with web-sized type: a 14px option list inside a
 * `p-5` ink-900 box, sitting on a light paper slide. On a 16:9 card that came
 * out 412px tall, so it overran the slide and ran into the page number — and the
 * black rectangle on cream paper read as a sticker dropped onto the slide
 * instead of part of it. Everything below is sized in `cqw` like the rest of the
 * slide and coloured from the slide palette, so it scales with the card and
 * inherits whichever paper the lesson was written on.
 *
 * The options are a two-column grid rather than a stack: four full-width rows of
 * chrome is what made this block tall, and a 16:9 card has the width to spare.
 *
 * Answering is final. The slide used to offer "try again", which in a room meant
 * the question could be argued with for as long as the teacher tolerated it; now
 * one choice reveals the right answer with its explanation, and the stage holds
 * the deck for a few seconds so the explanation can be read before it moves on.
 *
 * A slide may carry a whole bank (a checkpoint quiz tests one stretch of the
 * lesson, the closing quiz tests all of it), so the bank walks its questions one
 * at a time with a progress strip and a final score. The gate only opens on the
 * LAST question: `onAnswer` fires once the whole bank is done, so the stage
 * holds the deck until the student has actually finished thinking — a mid-bank
 * pause would let the room "answer" one question and sail past the rest.
 */
export function InteractiveQuiz({ sceneId, question, options, questions, autoNextPending, onAnswer }: InteractiveQuizProps) {
  const t = useCopy(COPY);
  const bank = quizQuestionsOf({ question, options, questions });
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Per-question outcomes so far; doubles as the progress strip and the score. */
  const [results, setResults] = useState<boolean[]>([]);
  /** Set once the bank is answered: how long the stage will hold for reading. */
  const [readSeconds, setReadSeconds] = useState<number | null>(null);

  const isBank = bank.length > 1;
  const isLast = qIndex >= bank.length - 1;
  const current = bank[Math.min(qIndex, bank.length - 1)];
  const currentOption = current.options.find((opt) => opt.id === selected);
  const correctOption = current.options.find((opt) => opt.isCorrect);
  const score = results.filter(Boolean).length;
  const tier = quizPraiseTier(score, bank.length);

  const handleSelect = (id: string) => {
    if (submitted) return;
    setSelected(id);
  };

  const handleSubmit = () => {
    if (!selected || submitted) return;
    const isCorrect = currentOption?.isCorrect ?? false;
    setSubmitted(true);
    setResults((prev) => [...prev, isCorrect]);
    if (!isLast) return;
    // The explanation shown is the right answer's, whichever option was picked:
    // a wrong choice is answered by being told why, not by repeating itself.
    const explanation = correctOption?.explanation;
    const seconds = quizReadSeconds(explanation);
    setReadSeconds(seconds);
    // The wait travels with the answer so the stage times the same number the
    // slide just promised on screen. Only the last question opens the gate.
    onAnswer?.({
      sceneId,
      isCorrect,
      explanation,
      readSeconds: seconds,
    });
  };

  const handleNext = () => {
    setQIndex((index) => index + 1);
    setSelected(null);
    setSubmitted(false);
  };

  return (
    <figure className="scene-quiz">
      <figcaption className="scene-quiz-kicker">
        <CircleHelp className="h-[1.1em] w-[1.1em] shrink-0" />
        <span>{t.quizKicker}</span>
        {isBank ? (
          <span className="scene-quiz-count">
            {t.quizCount.replace("{i}", String(qIndex + 1)).replace("{n}", String(bank.length))}
          </span>
        ) : null}
      </figcaption>

      {isBank ? (
        <div className="scene-quiz-steps" aria-hidden="true">
          {bank.map((_, index) => {
            const state =
              index < results.length
                ? results[index]
                  ? "done-correct"
                  : "done-wrong"
                : index === qIndex
                  ? "current"
                  : "pending";
            return <span key={index} className="scene-quiz-step" data-state={state} />;
          })}
        </div>
      ) : null}

      <p className="scene-quiz-question text-balance">
        <InlineText text={current.question} />
      </p>

      <div className="scene-quiz-options">
        {current.options.map((opt, idx) => {
          const isChosen = selected === opt.id;
          let state = "";
          if (submitted) {
            if (opt.isCorrect) state = "correct";
            else if (isChosen) state = "wrong";
            else state = "dim";
          } else if (isChosen) {
            state = "picked";
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              disabled={submitted}
              data-state={state}
              className="scene-quiz-option"
            >
              <span className="scene-quiz-letter">{String.fromCharCode(65 + idx)}</span>
              <InlineText className="min-w-0 flex-1" text={opt.text} />
              {submitted && opt.isCorrect ? (
                <CircleCheck aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0" />
              ) : null}
              {submitted && isChosen && !opt.isCorrect ? (
                <CircleX aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {submitted && correctOption ? (
        <p
          role="status"
          className="scene-quiz-feedback"
          data-state={currentOption?.isCorrect ? "correct" : "wrong"}
        >
          <b>{currentOption?.isCorrect ? t.quizCorrect : t.quizWrong}</b>{" "}
          {correctOption.explanation ? (
            <InlineText text={correctOption.explanation} />
          ) : null}
        </p>
      ) : null}

      {submitted && isLast && isBank ? (
        <div className="scene-quiz-score" role="status">
          <span>{t.quizScore.replace("{n}", String(score)).replace("{total}", String(bank.length))}</span>
          <span className="scene-quiz-praise">
            {tier === "excellent"
              ? t.quizPraiseAll
              : tier === "good"
                ? t.quizPraiseMid
                : t.quizPraiseLow}
          </span>
        </div>
      ) : null}

      <div className="scene-quiz-actions">
        {submitted && isBank && !isLast ? (
          <button type="button" onClick={handleNext} className="scene-quiz-button" data-primary="">
            {t.quizNext}
          </button>
        ) : readSeconds !== null && autoNextPending && isLast ? (
          <span className="scene-quiz-auto">
            {t.quizAutoNext.replace("{n}", String(readSeconds))}
          </span>
        ) : !submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selected}
            className="scene-quiz-button"
            data-primary=""
          >
            {t.quizCheck}
          </button>
        ) : null}
      </div>
    </figure>
  );
}
