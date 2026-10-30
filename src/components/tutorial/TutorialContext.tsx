"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { TUTORIAL_STEPS, type TutorialStep } from "./tutorialSteps";

interface TutorialContextValue {
  isTourActive: boolean;
  currentStepIndex: number;
  currentStep: TutorialStep;
  totalSteps: number;
  startTour: (fromIndex?: number) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

const STORAGE_KEY = "edusgpt.tutorial-completed.v1";

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  // Check first-time visit
  useEffect(() => {
    try {
      const hasCompleted = localStorage.getItem(STORAGE_KEY);
      // We don't auto-force immediately to avoid disrupting, but expose startTour
      if (!hasCompleted) {
        // can be started manually or by welcome prompt
      }
    } catch {
      // ignore
    }
  }, []);

  const totalSteps = TUTORIAL_STEPS.length;
  const currentStep = useMemo(
    () => TUTORIAL_STEPS[currentStepIndex] || TUTORIAL_STEPS[0],
    [currentStepIndex]
  );

  const navigateToStepRoute = useCallback(
    (step: TutorialStep) => {
      if (step.route && pathname !== step.route) {
        router.push(step.route);
      }
    },
    [pathname, router]
  );

  const startTour = useCallback(
    (fromIndex = 0) => {
      const targetIndex = Math.max(0, Math.min(fromIndex, totalSteps - 1));
      setCurrentStepIndex(targetIndex);
      setIsTourActive(true);
      const step = TUTORIAL_STEPS[targetIndex];
      if (step) {
        navigateToStepRoute(step);
      }
    },
    [navigateToStepRoute, totalSteps]
  );

  const endTour = useCallback(() => {
    setIsTourActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextS = TUTORIAL_STEPS[nextIdx];
      if (nextS) {
        navigateToStepRoute(nextS);
      }
    } else {
      endTour();
    }
  }, [currentStepIndex, endTour, navigateToStepRoute, totalSteps]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      const prevS = TUTORIAL_STEPS[prevIdx];
      if (prevS) {
        navigateToStepRoute(prevS);
      }
    }
  }, [currentStepIndex, navigateToStepRoute]);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentStepIndex(index);
        const s = TUTORIAL_STEPS[index];
        if (s) {
          navigateToStepRoute(s);
        }
      }
    },
    [navigateToStepRoute, totalSteps]
  );

  const value = useMemo(
    () => ({
      isTourActive,
      currentStepIndex,
      currentStep,
      totalSteps,
      startTour,
      endTour,
      nextStep,
      prevStep,
      goToStep,
    }),
    [
      isTourActive,
      currentStepIndex,
      currentStep,
      totalSteps,
      startTour,
      endTour,
      nextStep,
      prevStep,
      goToStep,
    ]
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return ctx;
}
