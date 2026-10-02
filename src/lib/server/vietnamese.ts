/**
 * Vietnamese text recovery for PDFs that use a legacy font encoding.
 *
 * Many Vietnamese lecture PDFs were produced in Word 97 / old LaTeX with
 * VNI-Times or TCVN3 fonts. Those fonts have no Unicode mapping, so the PDF
 * text layer comes out as Latin-1 look-alikes ("CHÖÂNG" instead of "CHƯƠNG").
 * Feeding that straight to the model produces confidently wrong lessons.
 *
 * The byte -> letter mapping is *per font*, and the same byte legitimately maps
 * to different Vietnamese letters in different fonts, so this cannot be a
 * plain substitution table. What we can do reliably is fix the cases that are
 * unambiguous, then tell the caller how much doubt is left so the UI can warn
 * a human instead of silently shipping mojibake.
 */

/**
 * Letters and symbols that are not part of Vietnamese at all, so seeing one
 * means the text is broken — no heuristics needed.
 *
 * Note the deliberate asymmetry: uppercase Õ cannot occur in Vietnamese
 * (it uses Ô and Ơ), but lowercase õ is an ordinary letter ("rõ", "theo dõi").
 * Treating õ as broken once flagged perfectly good lecture notes as suspect.
 *
 * Á À Â Ù Ú Ý É È Ê Ó Í Ì are also legitimate letters; they are excluded because
 * a legacy font uses them with the *wrong tone*, which a character set cannot
 * detect.
 */
const IMPOSSIBLE = /[ÄÖÑÕÆÏÞäöñæïþ×÷]/g;

/** Unambiguous repairs: same broken byte, same right letter in every font we
 * have seen in the wild. Anything ambiguous is deliberately left alone. */
const SAFE_FIX: Record<string, string> = {
  // TCVN3 / VNI-Times byte values that survive as Latin-1 look-alikes
  Ä: "Ệ",
  Ñ: "Đ",
  Õ: "Ớ",
  Æ: "Ộ",
  Ö: "Ư",
  // Quoted: × and ÷ are math symbols, not valid identifiers.
  "×": "ư",
  "÷": "đ",
};

/** The most frequent Vietnamese words. A correct lecture scores high; a
 * tone-mangled one collapses, because "và" became "vaø", "của" became "cuûa". */
const VN_WORDS = new Set([
  "và", "của", "các", "những", "được", "trong", "người", "một", "cho", "là",
  "với", "này", "đó", "khi", "đã", "cũng", "về", "từ", "theo", "tại", "để",
  "không", "có", "được", "phải", "cần", "nên", "nếu", "thì", "mà", "để",
  "kinh", "tế", "học", "chương", "tài", "liệu", "bài", "tập", "nước", "nhà",
  "lý", "thuyết", "pháp", "luật", "xã", "hội", "sản", "xuất", "tiêu", "dùng",
  "thị", "trường", "giá", "tiền", "lãi", "suất", "vốn", "lao", "động", "cầu",
  "cung", "thị", "trường", "doanh", "nghiệp", "quốc", "gia", "phát", "triển",
  "tăng", "giảm", "mức", "giá", "ảnh", "hưởng", "tác", "động", "của", "thay",
  "đổi", "mới", "cũ", "nhiều", "ít", "lớn", "nhỏ", "cao", "thấp", "tăng",
  "mô", "hình", "quan", "trọng", "yếu", "đóng", "góp", "vai", "trò", "vai",
  "trò", "trách", "nhiệm", "chức", "năng", "quản", "lý", "tổng", "hợp", "riêng",
  "cụ", "thể", "biểu", "mẫu", "số", "liệu", "thống", "kê", "bảng", "biểu",
  "chương", "mục", "tiêu", "đề", "bài", "câu", "hỏi", "đáp", "phần", "bài",
  "giảng", "slide", "ghi", "chú", "bạn", "học", "sinh", "viên", "giảng", "viên",
  "câu", "hỏi", "trả", "lời", "tóm", "tắt", "kết", "luận", "bài", "toán",
  "giải", "tích", "phân", "đạo", "hàm", "biến", "đạo", "hàm", "vi", "phân",
  "giới", "hạn", "điểm", "đạo", "hàm", "số", "phức", "tạp", "số", "thực",
]);

export interface VietnameseRepair {
  text: string;
  /** How many impossible characters were replaced. */
  fixed: number;
  /** Fraction of impossible characters that survived, 0..1. */
  doubt: number;
  /** How many impossible characters remain in the text. */
  impossible: number;
  /**
   * True when the damage is widespread enough to act on. A single odd token —
   * "Möbius" in an otherwise perfect 120k-character textbook — is worth a quiet
   * note, not an alarm, and a warning that cries wolf gets ignored.
   */
  severe: boolean;
  /** Fraction of tokens that are real Vietnamese words, 0..1. */
  vocab: number;
  /** True when the text is still broken enough that a human must check it. */
  suspect: boolean;
  /** Sample of the words that look wrong, for the warning message. */
  examples: string[];
}

function wordsOf(text: string): string[] {
  return text
    .toLocaleLowerCase("vi")
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

/**
 * A correct Vietnamese lecture hits these common words constantly. A tone-mangled
 * one collapses: "và" became "vaø", "của" became "cuûa", so nothing matches.
 *
 * Returns 1 (i.e. "no evidence") whenever the text is too short or too tabular
 * to judge. Rosters, timetables and grade sheets are mostly names and numbers,
 * where a low score says nothing about encoding.
 */
function vocabularyScore(text: string): number {
  const tokens = wordsOf(text);
  if (tokens.length < 150) return 1;

  const words = tokens.filter((t) => !/^\d+$/.test(t));
  if (words.length === 0) return 1;

  // Both halves must be capped. Dividing by min(words.length, 400) while counting
  // every match lets the score climb past 1 on long documents, which flagged
  // perfectly clean lecture notes.
  const sample = words.slice(0, 400);
  return sample.filter((w) => VN_WORDS.has(w)).length / sample.length;
}

/** A token is clearly mangled if it contains a letter Vietnamese does not use. */
function isMangledWord(word: string): boolean {
  return /[ÄÖÑÕÆÏÞäöñæïþ×÷]/.test(word);
}

export function repairVietnamese(input: string): VietnameseRepair {
  const clean: VietnameseRepair = {
    text: input, fixed: 0, doubt: 0, impossible: 0, vocab: 1,
    severe: false, suspect: false, examples: [],
  };
  if (!input) return clean;

  const before = (input.match(IMPOSSIBLE) || []).length;
  let fixed = 0;

  // Only the substitutions that are the same in every legacy font we have met.
  // Guessing at the rest would silently corrupt correct text.
  const text = input.replace(/[ÄÖÑÕÆ×÷]/g, (ch) => {
    fixed += 1;
    return SAFE_FIX[ch] ?? ch;
  });

  const left = (text.match(IMPOSSIBLE) || []).length;
  const doubt = before === 0 ? 0 : left / before;
  const vocab = vocabularyScore(text);

  // Only the hard signal decides. Measured over a real course library, every
  // genuinely mangled PDF carried 300+ impossible characters, and the soft
  // vocabulary check produced nothing but false alarms on rosters and
  // timetables, where a low word hit-rate is normal. `vocab` is still reported
  // for diagnostics, but it does not accuse the file on its own.
  const suspect = left > 0;
  // Broken files measured 300-500; a clean textbook measured 1 (a foreign name).
  const severe = left >= 20;

  const examples = suspect
    ? Array.from(new Set(wordsOf(text).filter(isMangledWord))).slice(0, 6)
    : [];

  return { text, fixed, doubt, impossible: left, vocab, severe, suspect, examples };
}
