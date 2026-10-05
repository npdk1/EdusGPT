"use client";

import { useState } from "react";
import { CircleCheck, CircleX, CircleHelp } from "lucide-react";
import type { QuizOption } from "@/lib/lesson/types";
import { quizReadSeconds } from "@/lib/lesson/quiz";
import { useCopy } from "@/i18n/provider";

interface InteractiveQuizProps {
  /** The slide this quiz belongs to, so the stage can open its own gate. */
  sceneId: string;
  question: string;
  options: QuizOption[];
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
  },
  vi: {
    quizKicker: "Trắc nghiệm",
    quizCorrect: "Chính xác.",
    quizWrong: "Chưa đúng.",
    quizCheck: "Kiểm tra đáp án",
    quizAutoNext: "Tự chuyển cảnh sau {n} giây",
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
 */
export function InteractiveQuiz({ sceneId, question, options, onAnswer }: InteractiveQuizProps) {
  const t = useCopy(COPY);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Set once answered: how long the stage will hold for reading. */
  const [readSeconds, setReadSeconds] = useState<number | null>(null);

  const currentOption = options.find((opt) => opt.id === selected);
  const correctOption = options.find((opt) => opt.isCorrect);

  const handleSelect = (id: string) => {
    if (submitted) return;
    setSelected(id);
  };

  const handleSubmit = () => {
    if (!selected || readSeconds !== null) return;
    setSubmitted(true);
    // The explanation shown is the right answer's, whichever option was picked:
    // a wrong choice is answered by being told why, not by repeating itself.
    const explanation = correctOption?.explanation;
    const seconds = quizReadSeconds(explanation);
    setReadSeconds(seconds);
    // The wait travels with the answer so the stage times the same number the
    // slide just promised on screen.
    onAnswer?.({
      sceneId,
      isCorrect: currentOption?.isCorrect ?? false,
      explanation,
      readSeconds: seconds,
    });
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

      {submitted && correctOption ? (
        <p
          className="scene-quiz-feedback"
          data-state={currentOption?.isCorrect ? "correct" : "wrong"}
        >
          <b>{currentOption?.isCorrect ? t.quizCorrect : t.quizWrong}</b>{" "}
          {correctOption.explanation}
        </p>
      ) : null}

      <div className="scene-quiz-actions">
        {readSeconds !== null && onAnswer ? (
          <span className="scene-quiz-auto">
            {t.quizAutoNext.replace("{n}", String(readSeconds))}
          </span>
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
