/**
 * Student profile, learning streak, experience points (XP), and achievements.
 *
 * Designed to provide modern LMS gamification and engagement loops
 * to keep students motivated and consistently returning to study.
 * and consistently returning to study.
 */

export interface StudentBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface LessonProgress {
  percent: number;
  lastScene: number;
  lastTime: number;
  updatedAt: string;
}

export interface StudentProfile {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string; // YYYY-MM-DD
  activeDaysThisWeek: boolean[]; // Mon -> Sun
  completedLessons: string[];
  lessonProgress: Record<string, LessonProgress>;
  badges: StudentBadge[];
}

const STORAGE_KEY = "edusgpt.student-profile.v1";
export const STUDENT_PROFILE_CHANGED_EVENT = "edusgpt:student-profile-changed";

const DEFAULT_BADGES: StudentBadge[] = [
  {
    id: "first_lesson",
    title: "Bước khởi đầu",
    description: "Xem và hoàn thành bài giảng đầu tiên",
    icon: "🚀",
    unlockedAt: null,
  },
  {
    id: "streak_3",
    title: "Ngọn lửa kiên trì",
    description: "Duy trì chuỗi học tập 3 ngày liên tiếp",
    icon: "🔥",
    unlockedAt: null,
  },
  {
    id: "quiz_master",
    title: "Chiến thần trắc nghiệm",
    description: "Luyện tập trắc nghiệm đạt kết quả tốt",
    icon: "🎯",
    unlockedAt: null,
  },
  {
    id: "flashcard_hero",
    title: "Bậc thầy ghi nhớ",
    description: "Ôn tập qua thẻ nhớ Flashcard",
    icon: "⚡",
    unlockedAt: null,
  },
  {
    id: "polymath",
    title: "Nhà khám phá đa năng",
    description: "Học trên 3 bài giảng thuộc các môn khác nhau",
    icon: "🌟",
    unlockedAt: null,
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calculateLevel(xp: number): number {
  return Math.floor(xp / 100) + 1;
}

export function getStudentProfile(): StudentProfile {
  if (!isBrowser()) {
    return {
      xp: 0,
      level: 1,
      streak: 1,
      lastActiveDate: todayIso(),
      activeDaysThisWeek: [false, false, false, false, false, false, false],
      completedLessons: [],
      lessonProgress: {},
      badges: DEFAULT_BADGES,
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: StudentProfile = {
        xp: 120,
        level: 2,
        streak: 1,
        lastActiveDate: todayIso(),
        activeDaysThisWeek: [false, false, false, false, false, false, false],
        completedLessons: [],
        lessonProgress: {},
        badges: DEFAULT_BADGES,
      };
      // Mark today active in this week (0: Mon -> 6: Sun)
      const dayIndex = (new Date().getDay() + 6) % 7;
      initial.activeDaysThisWeek[dayIndex] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<StudentProfile>;
    return {
      xp: parsed.xp ?? 0,
      level: calculateLevel(parsed.xp ?? 0),
      streak: Math.max(1, parsed.streak ?? 1),
      lastActiveDate: parsed.lastActiveDate ?? todayIso(),
      activeDaysThisWeek: Array.isArray(parsed.activeDaysThisWeek) && parsed.activeDaysThisWeek.length === 7
        ? parsed.activeDaysThisWeek
        : [false, false, false, false, false, false, false],
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      lessonProgress: parsed.lessonProgress ?? {},
      badges: Array.isArray(parsed.badges) && parsed.badges.length > 0 ? parsed.badges : DEFAULT_BADGES,
    };
  } catch {
    return {
      xp: 0,
      level: 1,
      streak: 1,
      lastActiveDate: todayIso(),
      activeDaysThisWeek: [false, false, false, false, false, false, false],
      completedLessons: [],
      lessonProgress: {},
      badges: DEFAULT_BADGES,
    };
  }
}

export function saveStudentProfile(profile: StudentProfile): void {
  if (!isBrowser()) return;
  profile.level = calculateLevel(profile.xp);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent(STUDENT_PROFILE_CHANGED_EVENT, { detail: profile }));
}

/** Record student learning progress for a specific course/lesson */
export function recordLessonProgress(
  lessonId: string,
  percent: number,
  sceneIndex: number = 0,
  time: number = 0
): void {
  if (!isBrowser() || !lessonId) return;
  const profile = getStudentProfile();
  const current = profile.lessonProgress[lessonId] || { percent: 0, lastScene: 0, lastTime: 0, updatedAt: "" };
  
  const updatedPercent = Math.max(current.percent, Math.round(percent));
  profile.lessonProgress[lessonId] = {
    percent: updatedPercent,
    lastScene: sceneIndex,
    lastTime: time,
    updatedAt: new Date().toISOString(),
  };

  // If reached >= 90%, mark completed
  if (updatedPercent >= 90 && !profile.completedLessons.includes(lessonId)) {
    profile.completedLessons.push(lessonId);
    profile.xp += 100; // Completion bonus XP
    // Unlock first lesson badge if not unlocked
    const badge = profile.badges.find((b) => b.id === "first_lesson");
    if (badge && !badge.unlockedAt) {
      badge.unlockedAt = new Date().toISOString();
    }
  }

  saveStudentProfile(profile);
}

/** Record study activity: watching lesson, answering quiz, or reviewing flashcards */
export function recordStudyActivity(
  type: "watch" | "quiz" | "flashcard",
  earnedXp: number = 20
): { xpAdded: number; newStreak: number } {
  if (!isBrowser()) return { xpAdded: 0, newStreak: 1 };
  const profile = getStudentProfile();
  const today = todayIso();
  const dayIndex = (new Date().getDay() + 6) % 7;

  profile.activeDaysThisWeek[dayIndex] = true;
  profile.xp += earnedXp;

  // Streak calculation
  if (profile.lastActiveDate !== today) {
    const lastDate = new Date(profile.lastActiveDate);
    const currDate = new Date(today);
    const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 1) {
      profile.streak += 1;
    } else if (diffDays > 1) {
      profile.streak = 1;
    }
    profile.lastActiveDate = today;
  }

  // Check badges
  if (profile.streak >= 3) {
    const streakBadge = profile.badges.find((b) => b.id === "streak_3");
    if (streakBadge && !streakBadge.unlockedAt) {
      streakBadge.unlockedAt = new Date().toISOString();
    }
  }

  if (type === "quiz") {
    const qBadge = profile.badges.find((b) => b.id === "quiz_master");
    if (qBadge && !qBadge.unlockedAt) {
      qBadge.unlockedAt = new Date().toISOString();
    }
  } else if (type === "flashcard") {
    const fcBadge = profile.badges.find((b) => b.id === "flashcard_hero");
    if (fcBadge && !fcBadge.unlockedAt) {
      fcBadge.unlockedAt = new Date().toISOString();
    }
  }

  saveStudentProfile(profile);
  return { xpAdded: earnedXp, newStreak: profile.streak };
}
