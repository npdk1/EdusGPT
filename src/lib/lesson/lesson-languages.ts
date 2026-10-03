/**
 * The languages a lesson can be written in.
 *
 * A lesson is written in the language of its brief: a teacher who asks in
 * English should get an English lesson, not a Vietnamese one with English
 * headings. The list here is the single catalogue both sides use — the studio's
 * picker renders it, and the generation route asks it what to write in when the
 * teacher did not choose.
 *
 * Plain data with no imports, so the server route, the studio panel and the
 * voice picker can all share it.
 */

export interface LessonLanguage {
  /** BCP-47 tag, the value the generator is told to write in. */
  id: string;
  /** The language's own name — a picker reads best in its own script. */
  native: string;
  /** English name, for the other half of the interface. */
  en: string;
  /** Vietnamese name, for the Vietnamese half of the interface. */
  vi: string;
}

export const LESSON_LANGUAGES: LessonLanguage[] = [
  { id: "en", native: "English", en: "English", vi: "Tiếng Anh" },
  { id: "vi", native: "Tiếng Việt", en: "Vietnamese", vi: "Tiếng Việt" },
  { id: "zh-CN", native: "中文（简体）", en: "Chinese (Simplified)", vi: "Tiếng Trung giản thể" },
  { id: "ja", native: "日本語", en: "Japanese", vi: "Tiếng Nhật" },
  { id: "ko", native: "한국어", en: "Korean", vi: "Tiếng Hàn Quốc" },
  { id: "es", native: "Español", en: "Spanish", vi: "Tiếng Tây Ban Nha" },
  { id: "fr", native: "Français", en: "French", vi: "Tiếng Pháp" },
  { id: "de", native: "Deutsch", en: "German", vi: "Tiếng Đức" },
  { id: "it", native: "Italiano", en: "Italian", vi: "Tiếng Ý" },
  { id: "pt", native: "Português", en: "Portuguese", vi: "Tiếng Bồ Đào Nha" },
  { id: "ru", native: "Русский", en: "Russian", vi: "Tiếng Nga" },
  { id: "ar", native: "العربية", en: "Arabic", vi: "Tiếng Ả Rập" },
  { id: "hi", native: "हिन्दी", en: "Hindi", vi: "Tiếng Hindi" },
  { id: "th", native: "ไทย", en: "Thai", vi: "Tiếng Thái" },
  { id: "id", native: "Bahasa Indonesia", en: "Indonesian", vi: "Tiếng Indonesia" },
  { id: "tr", native: "Türkçe", en: "Turkish", vi: "Tiếng Thổ Nhĩ Kỳ" },
  { id: "nl", native: "Nederlands", en: "Dutch", vi: "Tiếng Hà Lan" },
  { id: "pl", native: "Polski", en: "Polish", vi: "Tiếng Ba Lan" },
  { id: "uk", native: "Українська", en: "Ukrainian", vi: "Tiếng Ukraine" },
];

/** The picker's "work it out from the brief" entry. */
export const AUTO_LANGUAGE = "auto";

/** Vietnamese is the default only because that is what this app was born in. */
export const DEFAULT_LESSON_LANGUAGE = "en";

export function isLessonLanguage(value: unknown): value is string {
  return typeof value === "string" && LESSON_LANGUAGES.some((l) => l.id === value);
}

export function findLessonLanguage(id: string): LessonLanguage | undefined {
  return LESSON_LANGUAGES.find((l) => l.id === id);
}

/** The language's name in the interface's own language. */
export function languageLabel(id: string, screenLang: "en" | "vi" = "en"): string {
  const entry = findLessonLanguage(id);
  if (!entry) return id;
  return screenLang === "vi" ? entry.vi : entry.en;
}

/**
 * What the generator should be told, given what the teacher picked or typed.
 * "auto" means the brief decides, so it resolves to the detected language.
 */
export function resolveLessonLanguage(choice: string | null | undefined, text: string): string {
  const picked = (choice ?? "").trim();
  if (picked && picked !== AUTO_LANGUAGE) return picked;
  return detectLessonLanguage(text);
}

/**
 * Vietnamese letters, listed so the count is exact.
 *
 * Vietnamese is the one language here that cannot be told from Latin script by
 * shape alone: an accented vowel is the signal. Everything else is decided by
 * the script (Cyrillic, Han, Kana, Hangul, Arabic, Devanagari, Thai) or falls
 * back to Latin, which for this catalogue means English.
 */
const VIETNAMESE_MARKS = [
  "đ",
  "ơ",
  "ư",
  "ạ",
  "ả",
  "ấ",
  "ầ",
  "ẩ",
  "ẫ",
  "ậ",
  "ắ",
  "ằ",
  "ẳ",
  "ẵ",
  "ặ",
  "ẹ",
  "ẻ",
  "ẽ",
  "ế",
  "ề",
  "ể",
  "ễ",
  "ệ",
  "ỉ",
  "ị",
  "ọ",
  "ỏ",
  "ố",
  "ồ",
  "ổ",
  "ỗ",
  "ộ",
  "ớ",
  "ờ",
  "ở",
  "ỡ",
  "ợ",
  "ụ",
  "ủ",
  "ứ",
  "ừ",
  "ử",
  "ữ",
  "ự",
  "ỳ",
  "ỵ",
  "ỷ",
  "ỹ",
];

/** Scripts that only appear in one language of the list. */
const SCRIPT_TESTS: { id: string; test: (text: string) => boolean }[] = [
  { id: "ru", test: (t) => /[Ѐ-ӿ]/.test(t) },
  { id: "uk", test: (t) => /[іїєґІЇЄҐ]/.test(t) },
  { id: "ja", test: (t) => /[぀-ヿ]/.test(t) },
  { id: "ko", test: (t) => /[가-힯ᄀ-ᇿ]/.test(t) },
  { id: "zh-CN", test: (t) => /[一-鿿]/.test(t) },
  { id: "ar", test: (t) => /[؀-ۿ]/.test(t) },
  { id: "hi", test: (t) => /[ऀ-ॿ]/.test(t) },
  { id: "th", test: (t) => /[฀-๿]/.test(t) },
];

/**
 * Reads the brief and says which language to teach in.
 *
 * Vietnamese wins as soon as the text carries a Vietnamese letter: one "đ" or
 * a stack of tone marks means the teacher is writing Vietnamese, whatever else
 * is in the document. Latin text without those marks is English. The answer is
 * a tag from `LESSON_LANGUAGES`, except that Cyrillic and Ukrainian resolve to
 * the language the teacher most likely meant.
 */
export function detectLessonLanguage(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return DEFAULT_LESSON_LANGUAGE;

  const letters = trimmed.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters) return DEFAULT_LESSON_LANGUAGE;

  let viHits = 0;
  for (const char of letters) {
    if (VIETNAMESE_MARKS.includes(char.toLowerCase())) viHits += 1;
  }
  const viRatio = viHits / letters.length;
  // Vietnamese marks are everywhere in Vietnamese prose and essentially never
  // appear in English, so a low bar is safe here.
  if (viRatio > 0.01) return "vi";

  // Korean first: Hangul and Han overlap in range, and Korean text wins.
  if (SCRIPT_TESTS.find((s) => s.id === "ko")!.test(trimmed)) return "ko";
  if (SCRIPT_TESTS.find((s) => s.id === "ja")!.test(trimmed)) return "ja";
  if (SCRIPT_TESTS.find((s) => s.id === "uk")!.test(trimmed)) return "uk";
  for (const script of SCRIPT_TESTS) {
    if (script.test(trimmed)) return script.id;
  }
  return "en";
}