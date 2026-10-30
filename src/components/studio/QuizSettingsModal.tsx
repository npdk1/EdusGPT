"use client";

import { useState, useId } from "react";
import {
  type QuizSettings,
  DEFAULT_QUIZ_SETTINGS,
  calculateOptimalQuizPlan,
} from "@/lib/lesson/quiz";
import {
  Brain as IconBrain,
  Check as IconCheck,
  RotateCcw as IconRotateCcw,
  Sparkles as IconSparkles,
  X as IconX,
} from "lucide-react";
import { useCopy, fill } from "@/i18n/provider";

const COPY = {
  en: {
    modalTitle: "Quiz & Checkpoint Settings",
    modalSubtitle: "Question distribution algorithm across lesson checkpoints",
    close: "Close",
    enableQuiz: "Enable quiz question generation",
    enableQuizDesc: "Automatically generate checkpoint quizzes after key concepts",
    algoMode: "Algorithm mode",
    modeAuto: "Auto-Optimized",
    modeAutoDesc: "Calculated dynamically based on slide count and lesson duration",
    modeCustom: "Custom Limits",
    modeCustomDesc: "Manually set min/max questions and checkpoint sizes",
    minQuestions: "Minimum questions",
    maxQuestions: "Maximum questions",
    checkpointSize: "Questions per checkpoint",
    questionUnit: "{num} questions",
    distributionTitle: "Estimated Question Distribution:",
    totalQuestions: "Total ~{n} questions",
    midCheckpointTitle: "Mid-Lesson Checkpoints",
    midCheckpointDetail: "{checkpoints} checkpoints × {size} questions",
    midCheckpointDesc: "Reinforces concepts after each topic",
    finalQuizTitle: "Final Review Quiz",
    finalQuizDetail: "{count} questions",
    finalQuizDesc: "Covers entire lesson material",
    resetDefault: "Reset to default",
    cancel: "Cancel",
    save: "Save Settings",
  },
  vi: {
    modalTitle: "Cài đặt Trắc nghiệm & Kiểm tra",
    modalSubtitle: "Thuật toán phân bố câu hỏi theo từng chặng bài giảng",
    close: "Đóng",
    enableQuiz: "Bật tạo câu hỏi trắc nghiệm",
    enableQuizDesc: "Tự động sinh quiz kiểm tra sau từng mục kiến thức",
    algoMode: "Chế độ thuật toán",
    modeAuto: "Tự động tối ưu",
    modeAutoDesc: "Tự tính toán dựa trên số slide & thời lượng bài học",
    modeCustom: "Tùy chỉnh số lượng",
    modeCustomDesc: "Chủ động đặt số câu tối thiểu, tối đa và mỗi chặng",
    minQuestions: "Số câu tối thiểu",
    maxQuestions: "Số câu tối đa",
    checkpointSize: "Số câu mỗi chặng checkpoint",
    questionUnit: "{num} câu",
    distributionTitle: "Dự tính phân bố câu hỏi:",
    totalQuestions: "Tổng ~{n} câu",
    midCheckpointTitle: "Quiz giữa bài (Chặng)",
    midCheckpointDetail: "{checkpoints} chặng × {size} câu",
    midCheckpointDesc: "Giúp củng cố ngay sau từng phần",
    finalQuizTitle: "Quiz Tổng kết cuối bài",
    finalQuizDetail: "{count} câu hỏi",
    finalQuizDesc: "Bao quát toàn bộ kiến thức",
    resetDefault: "Khôi phục mặc định",
    cancel: "Hủy",
    save: "Lưu cài đặt",
  },
} satisfies Record<string, Record<string, string>>;

interface QuizSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: QuizSettings;
  onSave: (settings: QuizSettings) => void;
  sceneCount?: number;
}

export function QuizSettingsModal({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  sceneCount = 8,
}: QuizSettingsModalProps) {
  const t = useCopy(COPY);
  const [settings, setSettings] = useState<QuizSettings>(initialSettings);
  const minId = useId();
  const maxId = useId();
  const checkId = useId();

  if (!isOpen) return null;

  // Preview based on current settings and sceneCount
  const previewPlan = calculateOptimalQuizPlan(sceneCount, settings);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const handleReset = () => {
    setSettings(DEFAULT_QUIZ_SETTINGS);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-ink-700/80 bg-ink-900 shadow-2xl p-6 text-mist-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-ink-800">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 border border-brand-500/20">
              <IconBrain className="h-5 w-5" />
            </span>
            <div>
              <h2 id="quiz-settings-title" className="text-base font-bold text-mist-50">
                {t.modalTitle}
              </h2>
              <p className="text-xs text-mist-400">
                {t.modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mist-400 hover:text-mist-100 hover:bg-ink-800 transition-colors"
            aria-label={t.close}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Toggle Enable/Disable */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-ink-850 border border-ink-800">
            <div>
              <div className="text-sm font-semibold text-mist-100">{t.enableQuiz}</div>
              <div className="text-xs text-mist-400">{t.enableQuizDesc}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => setSettings((s: QuizSettings) => ({ ...s, enabled: !s.enabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${
                settings.enabled ? "bg-brand-500" : "bg-ink-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {settings.enabled && (
            <>
              {/* Mode Selection */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-mist-400 block mb-2">
                  {t.algoMode}
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSettings((s: QuizSettings) => ({ ...s, mode: "auto" }))}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      settings.mode === "auto"
                        ? "border-brand-500 bg-brand-500/10 text-mist-50 shadow-sm"
                        : "border-ink-800 bg-ink-850/60 text-mist-400 hover:border-ink-700 hover:text-mist-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                      <IconSparkles className="h-3.5 w-3.5 text-brand-400" />
                      <span>{t.modeAuto}</span>
                    </div>
                    <span className="text-[11px] leading-relaxed opacity-80">
                      {t.modeAutoDesc}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings((s: QuizSettings) => ({ ...s, mode: "custom" }))}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      settings.mode === "custom"
                        ? "border-brand-500 bg-brand-500/10 text-mist-50 shadow-sm"
                        : "border-ink-800 bg-ink-850/60 text-mist-400 hover:border-ink-700 hover:text-mist-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium text-xs mb-1">
                      <span>{t.modeCustom}</span>
                    </div>
                    <span className="text-[11px] leading-relaxed opacity-80">
                      {t.modeCustomDesc}
                    </span>
                  </button>
                </div>
              </div>

              {/* Custom Controls */}
              {settings.mode === "custom" && (
                <div className="space-y-4 p-4 rounded-xl bg-ink-850/60 border border-ink-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={minId} className="block text-xs font-medium text-mist-300 mb-1.5">
                        {t.minQuestions}
                      </label>
                      <input
                        id={minId}
                        type="number"
                        min={1}
                        max={30}
                        value={settings.minQuestions ?? 5}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 3);
                          setSettings((s: QuizSettings) => ({
                            ...s,
                            minQuestions: val,
                            maxQuestions: Math.max(val, s.maxQuestions ?? 25),
                          }));
                        }}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-ink-900 border border-ink-700 text-mist-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label htmlFor={maxId} className="block text-xs font-medium text-mist-300 mb-1.5">
                        {t.maxQuestions}
                      </label>
                      <input
                        id={maxId}
                        type="number"
                        min={3}
                        max={50}
                        value={settings.maxQuestions ?? 25}
                        onChange={(e) => {
                          const val = Math.max(settings.minQuestions ?? 1, parseInt(e.target.value) || 10);
                          setSettings((s: QuizSettings) => ({ ...s, maxQuestions: val }));
                        }}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-ink-900 border border-ink-700 text-mist-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor={checkId} className="block text-xs font-medium text-mist-300 mb-1.5">
                      {t.checkpointSize}
                    </label>
                    <div className="flex gap-2">
                      {[2, 3, 4, 5].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSettings((s: QuizSettings) => ({ ...s, checkpointSize: num }))}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            settings.checkpointSize === num
                              ? "bg-brand-500 text-white border-brand-500 shadow-sm"
                              : "bg-ink-900 border-ink-700 text-mist-300 hover:border-ink-600"
                          }`}
                        >
                          {fill(t.questionUnit, { num })}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Algorithm Prediction Preview */}
              <div className="p-4 rounded-xl bg-ink-850/80 border border-brand-500/20 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-mist-300">
                  <span className="font-semibold text-brand-400">{t.distributionTitle}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
                    {fill(t.totalQuestions, { n: previewPlan.totalQuestions })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800">
                    <div className="text-mist-400 text-[11px]">{t.midCheckpointTitle}</div>
                    <div className="font-semibold text-mist-100 mt-0.5">
                      {fill(t.midCheckpointDetail, {
                        checkpoints: previewPlan.checkpointCount,
                        size: previewPlan.questionsPerCheckpoint,
                      })}
                    </div>
                    <div className="text-[10px] text-mist-400 mt-0.5">
                      {t.midCheckpointDesc}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-ink-900/80 border border-ink-800">
                    <div className="text-mist-400 text-[11px]">{t.finalQuizTitle}</div>
                    <div className="font-semibold text-mist-100 mt-0.5">
                      {fill(t.finalQuizDetail, { count: previewPlan.finalTarget })}
                    </div>
                    <div className="text-[10px] text-mist-400 mt-0.5">
                      {t.finalQuizDesc}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-ink-800 mt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-mist-400 hover:text-mist-200 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-ink-800"
          >
            <IconRotateCcw className="h-3.5 w-3.5" />
            <span>{t.resetDefault}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-mist-300 hover:text-mist-100 hover:bg-ink-800 rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors shadow-sm"
            >
              <IconCheck className="h-4 w-4" />
              <span>{t.save}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
