/**
 * The voice catalogue, as plain data.
 *
 * It used to live inside the server-only speech module, but the classroom and
 * the studio both need to know which voice suits a lesson — a Vietnamese voice
 * reading an English script is the kind of thing a teacher notices
 * immediately — and a client component cannot import a server module. So the
 * list lives here, and the speech module imports it.
 *
 * Ids are Microsoft Edge neural voice names, optionally with a `#suffix`
 * carrying the prosody ("...#cham" reads slow).
 */

import { detectLessonLanguage, type LessonLanguage } from "./lesson-languages";

export interface VoiceEntry {
  id: string;
  label: string;
  prosody?: { rate?: "slow"; pitch?: "high" | "low" };
}

export const VI_VOICES: readonly VoiceEntry[] = [
  { id: "vi-VN-HoaiMyNeural", label: "Hoài My (nữ)" },
  { id: "vi-VN-HoaiMyNeural#cham", label: "Hoài My chậm (nữ)", prosody: { rate: "slow" } },
  { id: "vi-VN-HoaiMyNeural#cao", label: "Hoài My cao (nữ)", prosody: { pitch: "high" } },
  { id: "vi-VN-NamMinhNeural", label: "Nam Minh (nam)" },
  { id: "vi-VN-NamMinhNeural#tram", label: "Nam Minh trầm (nam)", prosody: { pitch: "low" } },
  { id: "vi-VN-NamMinhNeural#cham", label: "Nam Minh chậm (nam)", prosody: { rate: "slow" } },
];

export const EN_VOICES: readonly VoiceEntry[] = [
  { id: "en-US-AriaNeural", label: "Aria (female)" },
  { id: "en-US-AriaNeural#slow", label: "Aria slow (female)", prosody: { rate: "slow" } },
  { id: "en-US-GuyNeural", label: "Guy (male)" },
  { id: "en-US-GuyNeural#slow", label: "Guy slow (male)", prosody: { rate: "slow" } },
  { id: "en-GB-SoniaNeural", label: "Sonia, UK (female)" },
  { id: "en-US-ChristopherNeural", label: "Christopher (male)" },
];

/** Every voice the picker offers, Vietnamese first. */
export const VOICES: readonly VoiceEntry[] = [...VI_VOICES, ...EN_VOICES];

export type LessonVoiceId = string;

export const DEFAULT_VOICE: LessonVoiceId = "vi-VN-HoaiMyNeural";

export function isVoiceId(value: unknown): value is LessonVoiceId {
  return typeof value === "string" && VOICES.some((v) => v.id === value);
}

export function isVietnameseVoice(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("vi-");
}

/** The Edge name plus the prosody the service needs. */
export function resolveVoice(voice: LessonVoiceId): {
  name: string;
  prosody?: VoiceEntry["prosody"];
} {
  const entry = VOICES.find((v) => v.id === voice);
  return {
    name: voice.split("#")[0] ?? voice,
    ...(entry?.prosody ? { prosody: entry.prosody } : {}),
  };
}

/**
 * A sensible voice for a language, without pretending to cover the whole
 * catalogue: English and Vietnamese have real voices, and every other language
 * falls back to the English pair, which reads them far better than the
 * Vietnamese one would.
 */
export function voiceForLanguage(language: string): LessonVoiceId {
  switch (language) {
    case "vi":
      return "vi-VN-HoaiMyNeural";
    case "en":
    default:
      return "en-US-AriaNeural";
  }
}

/**
 * The voice to actually read a piece of text with.
 *
 * The teacher's choice wins when it fits the text; when it does not — a
 * Vietnamese voice saved from an earlier lesson meeting an English script — the
 * text decides, so nobody has to remember to switch voices by hand.
 */
export function pickVoice(preferred: unknown, text: string): LessonVoiceId {
  const language = detectLessonLanguage(text);
  if (isVoiceId(preferred) && isVietnameseVoice(preferred) === (language === "vi")) {
    return preferred;
  }
  return voiceForLanguage(language);
}

/** For the settings screen: the voices a language can use. */
export function voicesForLanguage(
  language: string,
): readonly VoiceEntry[] {
  return language === "vi" ? VI_VOICES : EN_VOICES;
}

export type { LessonLanguage };