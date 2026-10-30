"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import {
  getStudentProfile,
  type StudentProfile,
  STUDENT_PROFILE_CHANGED_EVENT,
} from "@/lib/student/profile";
import { useLang, useCopy, fill } from "@/i18n/provider";

interface StudentProgressModalProps {
  open: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
};

const COPY = {
  en: {
    modalTitle: "Learning Profile & Achievements",
    modalSubtitle: "Earn XP and maintain your daily learning rhythm",
    levelBadge: "Level {level}",
    close: "Close",
    xpLabel: "Experience Points: {xp} XP",
    xpRemaining: "{remaining} XP needed to reach Level {nextLevel}",
    streakTitle: "Learning Streak: {streak} consecutive days",
    streakSubtitle: "Every single day",
    badgesTitle: "Earned Badges ({unlocked}/{total})",
    motivationalNote: "Every completed lesson expands your knowledge and sharpens your critical thinking.",
  },
  vi: {
    modalTitle: "Hồ sơ Học tập & Thành tích",
    modalSubtitle: "Tích lũy kinh nghiệm và duy trì nhịp độ học tập hàng ngày",
    levelBadge: "Cấp {level}",
    close: "Đóng",
    xpLabel: "Điểm kinh nghiệm: {xp} XP",
    xpRemaining: "Còn {remaining} XP nữa để thăng hạng Cấp {nextLevel}",
    streakTitle: "Chuỗi học tập: {streak} ngày liên tiếp",
    streakSubtitle: "Đều đặn mỗi ngày",
    badgesTitle: "Huy hiệu đạt được ({unlocked}/{total})",
    motivationalNote: "Mỗi bài giảng hoàn thành giúp bạn mở rộng tri thức và rèn luyện tư duy logic.",
  },
} satisfies Record<string, Record<string, string>>;

const BADGE_TRANSLATIONS: Record<
  string,
  { en: { title: string; description: string }; vi: { title: string; description: string } }
> = {
  first_lesson: {
    en: {
      title: "First Step",
      description: "Watch and complete your first lesson",
    },
    vi: {
      title: "Bước khởi đầu",
      description: "Xem và hoàn thành bài giảng đầu tiên",
    },
  },
  streak_3: {
    en: {
      title: "Flame of Persistence",
      description: "Maintain a 3-day consecutive study streak",
    },
    vi: {
      title: "Ngọn lửa kiên trì",
      description: "Duy trì chuỗi học tập 3 ngày liên tiếp",
    },
  },
  quiz_master: {
    en: {
      title: "Quiz Master",
      description: "Achieve top scores on interactive quizzes",
    },
    vi: {
      title: "Chiến thần trắc nghiệm",
      description: "Luyện tập trắc nghiệm đạt kết quả tốt",
    },
  },
  flashcard_hero: {
    en: {
      title: "Memory Hero",
      description: "Review flashcards to master lesson concepts",
    },
    vi: {
      title: "Bậc thầy ghi nhớ",
      description: "Luyện tập flashcard để củng cố kiến thức",
    },
  },
  polymath: {
    en: {
      title: "Polymath",
      description: "Complete lessons in 3 distinct subject areas",
    },
    vi: {
      title: "Nhà thông thái",
      description: "Học từ 3 chủ đề môn học khác nhau",
    },
  },
};

function renderBadgeIcon(id: string, unlocked: boolean) {
  const className = `h-5 w-5 ${unlocked ? "text-amber-600 dark:text-amber-400" : "text-mist-500"}`;
  switch (id) {
    case "first_lesson":
      return <BookOpen className={className} />;
    case "streak_3":
      return <Flame className={className} />;
    case "quiz_master":
      return <Target className={className} />;
    case "flashcard_hero":
      return <Zap className={className} />;
    case "polymath":
      return <Compass className={className} />;
    default:
      return <Award className={className} />;
  }
}

export function StudentProgressModal({ open, onClose }: StudentProgressModalProps) {
  const lang = useLang();
  const t = useCopy(COPY);
  const [profile, setProfile] = useState<StudentProfile>(getStudentProfile());

  useEffect(() => {
    if (!open) return;
    setProfile(getStudentProfile());

    const handleUpdate = () => setProfile(getStudentProfile());
    window.addEventListener(STUDENT_PROFILE_CHANGED_EVENT, handleUpdate);
    return () => window.removeEventListener(STUDENT_PROFILE_CHANGED_EVENT, handleUpdate);
  }, [open]);

  if (!open) return null;

  const currentLevelProgress = profile.xp % 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel relative w-full max-w-lg overflow-hidden border border-ink-700 bg-ink-950 p-6 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="btn-icon absolute right-4 top-4 text-mist-400 hover:text-mist-100"
          aria-label={t.close}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Avatar & Level */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-mist-50 sm:text-lg">
                {t.modalTitle}
              </h2>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {fill(t.levelBadge, { level: profile.level })}
              </span>
            </div>
            <p className="text-xs text-mist-400">
              {t.modalSubtitle}
            </p>
          </div>
        </div>

        {/* Level & XP progress bar */}
        <div className="mt-5 rounded-xl border border-ink-800 bg-ink-900/60 p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-mist-200">
              <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              {fill(t.xpLabel, { xp: profile.xp })}
            </span>
            <span className="font-mono text-mist-400">{currentLevelProgress} / 100 XP</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-brand-400 transition-all duration-500"
              style={{ width: `${currentLevelProgress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-mist-400">
            {fill(t.xpRemaining, {
              remaining: 100 - currentLevelProgress,
              nextLevel: profile.level + 1,
            })}
          </p>
        </div>

        {/* 7-Day Streak Section */}
        <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-bold text-mist-100">
                {fill(t.streakTitle, { streak: profile.streak })}
              </span>
            </div>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400/90">
              {t.streakSubtitle}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
            {(DAYS_OF_WEEK[lang as "vi" | "en"] ?? DAYS_OF_WEEK.en).map((day, idx) => {
              const active = profile.activeDaysThisWeek[idx];
              return (
                <div
                  key={day}
                  className={`flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
                    active
                      ? "border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold shadow-sm"
                      : "border border-ink-800/80 bg-ink-900 text-mist-500"
                  }`}
                >
                  <span className="text-[11px]">{day}</span>
                  <div className="mt-1 flex h-4 w-4 items-center justify-center">
                    {active ? (
                      <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-400/30" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-ink-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badges / Achievements */}
        <div className="mt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-mist-300">
            <Trophy className="h-3.5 w-3.5 text-gold-400" />
            {fill(t.badgesTitle, {
              unlocked: profile.badges.filter((b) => b.unlockedAt).length,
              total: profile.badges.length,
            })}
          </h3>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {profile.badges.map((badge) => {
              const unlocked = Boolean(badge.unlockedAt);
              const trans = BADGE_TRANSLATIONS[badge.id]?.[lang as "vi" | "en"] ?? {
                title: badge.title,
                description: badge.description,
              };

              return (
                <div
                  key={badge.id}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-colors ${
                    unlocked
                      ? "border-amber-500/30 bg-amber-500/5 text-mist-100"
                      : "border-ink-800/80 bg-ink-900/30 text-mist-500 opacity-60"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {renderBadgeIcon(badge.id, unlocked)}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold truncate ${
                        unlocked ? "text-amber-800 dark:text-amber-200" : "text-mist-400"
                      }`}
                    >
                      {trans.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-mist-400 leading-tight">
                      {trans.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motivational footer note */}
        <div className="mt-5 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-center text-xs text-brand-200">
          {t.motivationalNote}
        </div>
      </div>
    </div>
  );
}
