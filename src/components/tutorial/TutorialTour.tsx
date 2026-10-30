"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTutorial } from "./TutorialContext";
import { useLang } from "@/i18n/provider";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Bot,
  Compass,
  CheckCircle2,
} from "lucide-react";

interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TutorialTour() {
  const {
    isTourActive,
    currentStepIndex,
    currentStep,
    totalSteps,
    nextStep,
    prevStep,
    endTour,
    goToStep,
  } = useTutorial();
  const lang = useLang();
  const pathname = usePathname();

  const [targetRect, setTargetRect] = useState<ElementRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const [elementFound, setElementFound] = useState(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track window resize
  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard navigation: Escape to exit, ArrowRight to next, ArrowLeft to prev
  useEffect(() => {
    if (!isTourActive) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        endTour();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, endTour, nextStep, prevStep]);

  // Find target element with retries (DOM may take a moment to mount on route change)
  const locateTarget = useCallback(() => {
    if (!isTourActive || !currentStep.targetSelector) {
      setTargetRect(null);
      setElementFound(false);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      // If element is hidden or has 0 dimensions, retry
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setElementFound(true);

        // Scroll into view if outside viewport with safe margin
        const isOffscreen =
          rect.top < 80 ||
          rect.bottom > window.innerHeight - 80 ||
          rect.left < 20 ||
          rect.right > window.innerWidth - 20;

        if (isOffscreen) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
    }

    // Element not found yet, set null and keep retrying
    setTargetRect(null);
    setElementFound(false);
  }, [isTourActive, currentStep.targetSelector]);

  // Retry locating when step, route, or active status changes
  useEffect(() => {
    if (!isTourActive) {
      setTargetRect(null);
      setElementFound(false);
      return;
    }

    locateTarget();

    // Set polling retries to handle animations, route changes, or dynamic components
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      locateTarget();
      if (attempts >= 8) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isTourActive, currentStepIndex, pathname, locateTarget]);

  if (!isTourActive) return null;

  const isVi = lang === "vi";
  const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Compute Card placement (smart positioning)
  let cardTop = "50%";
  let cardLeft = "50%";
  let cardTransform = "translate(-50%, -50%)";
  let pointerTop = 0;
  let pointerLeft = 0;
  let pointerDirection: "up" | "down" | "left" | "right" | "center" = "center";

  if (targetRect && elementFound) {
    const pad = 10;
    const spotlightTop = targetRect.top - pad;
    const spotlightBottom = targetRect.top + targetRect.height + pad;
    const spotlightCenterY = targetRect.top + targetRect.height / 2;
    const spotlightCenterX = targetRect.left + targetRect.width / 2;

    const spaceAbove = spotlightTop;
    const spaceBelow = windowSize.height - spotlightBottom;

    const cardEstimatedHeight = 290;
    const cardEstimatedWidth = Math.min(440, windowSize.width - 32);

    // Clamp horizontal position so tooltip stays within screen
    let clampedLeft = Math.max(
      20,
      Math.min(
        spotlightCenterX - cardEstimatedWidth / 2,
        windowSize.width - cardEstimatedWidth - 20
      )
    );

    if (spaceBelow >= cardEstimatedHeight + 30) {
      // Place card below target
      cardTop = `${Math.min(spotlightBottom + 26, windowSize.height - cardEstimatedHeight - 20)}px`;
      cardLeft = `${clampedLeft}px`;
      cardTransform = "none";
      pointerDirection = "up";
      pointerTop = spotlightBottom + 4;
      pointerLeft = Math.max(24, Math.min(spotlightCenterX, windowSize.width - 40));
    } else if (spaceAbove >= cardEstimatedHeight + 30) {
      // Place card above target
      cardTop = `${Math.max(20, spotlightTop - cardEstimatedHeight - 26)}px`;
      cardLeft = `${clampedLeft}px`;
      cardTransform = "none";
      pointerDirection = "down";
      pointerTop = spotlightTop - 34;
      pointerLeft = Math.max(24, Math.min(spotlightCenterX, windowSize.width - 40));
    } else {
      // Fallback: Center on screen
      cardTop = "50%";
      cardLeft = "50%";
      cardTransform = "translate(-50%, -50%)";
      pointerDirection = "center";
    }
  }

  return (
    <div className="fixed inset-0 z-[9998] overflow-hidden pointer-events-auto">
      {/* Target Spotlight Highlight Ring with 9999px Dimming Backdrop */}
      {targetRect && elementFound ? (
        <div
          style={{
            top: Math.max(0, targetRect.top - 8),
            left: Math.max(0, targetRect.left - 8),
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
          className="fixed z-[9998] rounded-2xl pointer-events-none transition-all duration-300 ease-out border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.75),0_0_35px_rgba(251,191,36,0.5)] ring-4 ring-amber-400/35"
        >
          {/* Pulsing Corner Brackets */}
          <div className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 border-t-2 border-l-2 border-amber-300 rounded-tl" />
          <div className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 border-t-2 border-r-2 border-amber-300 rounded-tr" />
          <div className="absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 border-b-2 border-l-2 border-amber-300 rounded-bl" />
          <div className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 border-b-2 border-r-2 border-amber-300 rounded-br" />
        </div>
      ) : (
        /* Dark backdrop fallback when no specific element is targeted */
        <div
          onClick={endTour}
          className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
        />
      )}

      {/* Animated Pointer / Arrow */}
      {elementFound && pointerDirection !== "center" ? (
        <div
          style={{
            top: `${pointerTop}px`,
            left: `${pointerLeft}px`,
            transform: "translateX(-50%)",
          }}
          className="fixed z-[9999] pointer-events-none flex flex-col items-center animate-bounce duration-700"
        >
          {pointerDirection === "up" ? (
            <>
              <div className="flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-950 shadow-lg">
                <span className="text-base leading-none">👆</span>
                <span>{isVi ? "Xem ở đây" : "Look here"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 rounded-full border border-amber-400 bg-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold text-ink-950 shadow-lg mb-1">
                <span className="text-base leading-none">👇</span>
                <span>{isVi ? "Xem ở đây" : "Look here"}</span>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Interactive Tooltip Card */}
      <div
        style={{
          top: cardTop,
          left: cardLeft,
          transform: cardTransform,
          maxWidth: "460px",
        }}
        className="fixed z-[9999] w-[calc(100vw-32px)] sm:w-full rounded-2xl border-2 border-amber-500/40 bg-ink-950 p-5 shadow-2xl shadow-black/80 text-mist-50 transition-all duration-300 ease-out animate-in fade-in zoom-in-95"
      >
        {/* Card Header: Mascot, Step Badge, Progress Bar, Close */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 text-ink-950 shadow-md shadow-amber-500/25">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {currentStep.badge ? currentStep.badge[lang as "vi" | "en"] : (isVi ? "Hướng dẫn" : "Tutorial")}
                </span>
                <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-semibold text-mist-300">
                  {currentStepIndex + 1} / {totalSteps}
                </span>
              </div>
              <p className="text-[11px] text-mist-400">
                {isVi ? "EduBot đồng hành cùng bạn" : "EduBot guide"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={endTour}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-ink-800 hover:text-mist-100"
            title={isVi ? "Đóng hướng dẫn (Esc)" : "Close tutorial (Esc)"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= currentStepIndex
                  ? "bg-gradient-to-r from-amber-400 to-orange-400 shadow-xs shadow-amber-400/50"
                  : "bg-ink-800 hover:bg-ink-700"
              }`}
              title={`${isVi ? "Bước" : "Step"} ${i + 1}`}
            />
          ))}
        </div>

        {/* Card Body */}
        <div className="mt-4 space-y-2.5">
          <h3 className="text-base font-bold text-mist-50 sm:text-lg tracking-tight">
            {currentStep.title[lang as "vi" | "en"]}
          </h3>
          <p className="text-xs leading-relaxed text-mist-300 sm:text-sm">
            {currentStep.description[lang as "vi" | "en"]}
          </p>

          {currentStep.highlightHint ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{currentStep.highlightHint[lang as "vi" | "en"]}</span>
            </div>
          ) : null}
        </div>

        {/* Card Footer: Navigation Buttons */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink-800/80 pt-3.5">
          <button
            type="button"
            onClick={endTour}
            className="text-xs font-semibold text-mist-400 transition-colors hover:text-mist-200"
          >
            {isVi ? "Bỏ qua" : "Skip tour"}
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <button
                type="button"
                onClick={prevStep}
                className="inline-flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-xs font-semibold text-mist-200 transition-all hover:bg-ink-800 hover:text-mist-50 active:scale-95"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{isVi ? "Quay lại" : "Back"}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400 px-4 py-2 text-xs font-bold text-ink-950 shadow-md shadow-orange-500/25 transition-all hover:brightness-110 active:scale-95"
            >
              <span>
                {currentStepIndex === totalSteps - 1
                  ? isVi
                    ? "Bắt đầu trải nghiệm 🎉"
                    : "Get Started 🎉"
                  : isVi
                  ? "Tiếp theo"
                  : "Next"}
              </span>
              {currentStepIndex === totalSteps - 1 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
