"use client";

import { useState } from "react";
import { CircleCheck, CircleX, CircleHelp } from "lucide-react";
import type { QuizOption } from "@/lib/lesson/types";
import { useCopy } from "@/i18n/provider";

interface InteractiveQuizProps {
  question: string;
  options: QuizOption[];
  onAnswer?: (isCorrect: boolean) => void;
}

const COPY = {
  en: {
    quizKicker: "Quiz",
    quizCorrect: "Correct.",
    quizWrong: "Not quite.",
    quizRetry: "Try again",
    quizCheck: "Check answer",
  },
  vi: {
    quizKicker: "Trắc nghiệm",
    quizCorrect: "Chính xác.",
    quizWrong: "Chưa đúng.",
    quizRetry: "Làm lại",
    quizCheck: "Kiểm tra đáp án",
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
 */
export function InteractiveQuiz({ question, options, onAnswer }: InteractiveQuizProps) {
  const t = useCopy(COPY);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const currentOption = options.find((opt) => opt.id === selected);

  const handleSelect = (id: string) => {
    if (submitted) return;
    setSelected(id);
  };

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    onAnswer?.(currentOption?.isCorrect ?? false);
  };

  const handleReset = () => {
    setSelected(null);
    setSubmitted(false);
  };

  return (
    <figure className="scene-quiz">
      <figcaption className="scene-quiz-kicker">
        <CircleHelp className="h-[1.1em] w-[1.1em] shrink-0" />
        <span>{t.quizKicker}</span>
      </figcaption>

      <p className="scene-quiz-question text-balance">{question}</p>

      <div className="scene-quiz-options">
        {options.map((opt, idx) => {
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
              <span className="min-w-0 flex-1">{opt.text}</span>
              {submitted && opt.isCorrect ? (
                <CircleCheck className="h-[1.15em] w-[1.15em] shrink-0" />
              ) : null}
              {submitted && isChosen && !opt.isCorrect ? (
                <CircleX className="h-[1.15em] w-[1.15em] shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {submitted && currentOption ? (
        <p
          className="scene-quiz-feedback"
          data-state={currentOption.isCorrect ? "correct" : "wrong"}
        >
          <b>{currentOption.isCorrect ? t.quizCorrect : t.quizWrong}</b>{" "}
          {currentOption.explanation}
        </p>
      ) : null}

      <div className="scene-quiz-actions">
        {submitted ? (
          <button type="button" onClick={handleReset} className="scene-quiz-button">
            {t.quizRetry}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selected}
            className="scene-quiz-button"
            data-primary=""
          >
            {t.quizCheck}
          </button>
        )}
      </div>
    </figure>
  );
}
