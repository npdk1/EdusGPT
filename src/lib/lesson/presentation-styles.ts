/**
 * Presentation styles.
 *
 * The palette picker answers "what colour is the paper". This answers the
 * question a teacher actually asks first — "what KIND of deck is this?" — and
 * that answer decides the palette, whether slides carry pictures, how much text
 * fits on one, and how the narration is written. Those are not independent
 * choices: a dense textbook-style deck with a big-type minimalist layout is a
 * contradiction, and picking them one at a time in separate menus is how you end
 * up with a deck that fights itself.
 *
 * So they are bundled here, and the studio picks one. Each entry is a starting
 * point rather than a cage: the theme and the image switch stay adjustable
 * afterwards, and the prompt rules are guidance the model can reason with.
 *
 * An id outside this list falls back to `MINIMALIST` rather than failing, the
 * same way an unknown theme id resolves — a saved lesson must outlive the
 * catalogue that produced it.
 */

/**
 * How long a lesson should be.
 *
 * A duration is a request the model has to be able to hit, and "make it long"
 * is not one. These are the numbers that make it hittable: a scene count, a word
 * count per scene, and a spoken total, all three stated together because they
 * constrain each other. A model told only "45-60 minutes" pads — it repeats
 * itself, adds a summary, and re-explains. A model told "85 slides, 95 words
 * each, 8000 words total" has to decide what to *cover*.
 *
 * The word budget is derived from how fast Vietnamese is actually read. Speech
 * synthesis lands near 150 words a minute, so a minute of lecture is roughly
 * 150 words of narration and nothing else. Every budget here is that number
 * multiplied out, rounded to something a person would say.
 */

/** One selectable length. */
export interface LessonLengthPreset {
  id: LessonLengthId;
  /** Short name for the control. */
  label: string;
  /** English label — data files carry no language switch of their own. */
  labelEn: string;
  /** What the user is choosing, in the units they think in. */
  caption: string;
  /** English caption, same reason. */
  captionEn: string;
  /** Slides to write, inclusive. */
  scenes: [number, number];
  /** Narration words per slide, inclusive. */
  wordsPerScene: [number, number];
  /** The spoken total, as a range a teacher would recognise. */
  minutes: [number, number];
  /** What the model should do differently at this length. */
  rules: string;
}

export type LessonLengthId = "short" | "medium" | "long";

export const DEFAULT_LESSON_LENGTH: LessonLengthId = "medium";

export const LESSON_LENGTHS: readonly LessonLengthPreset[] = [
  {
    id: "short",
    label: "Thấp",
    labelEn: "Short",
    caption: "1–2 phút",
    captionEn: "1–2 min",
    scenes: [3, 5],
    wordsPerScene: [45, 65],
    minutes: [1, 2],
    rules: `
ĐỘ DÀI: NGẮN (${"`3–5`"} slide, ${"`45–65`"} từ mỗi slide).
Đây là một phần giới thiệu ngắn, không phải một bài giảng đầy đủ.
- Chỉ lấy MỘT ý chính. Bỏ mọi nhánh phụ, mọi ví dụ thứ hai.
- Một slide "cover", một slide giải thích, một slide tóm tắt. Hết.
- KHÔNG thêm slide "tóm tắt toàn bộ môn học" — người xem chỉ xem 2 phút.`,
  },
  {
    id: "medium",
    label: "Trung bình",
    labelEn: "Medium",
    caption: "6–10 phút",
    captionEn: "6–10 min",
    scenes: [10, 16],
    wordsPerScene: [70, 110],
    minutes: [6, 10],
    rules: `
ĐỘ DÀI: VỪA (${"`10–16`"} slide, ${"`70–110`"} từ mỗi slide, tổng ${"`6–10 phút`"}).
Một bài giảng trọn vẹn vừa để giảng trong một tiết.
- Đi hết một mạch ý: mở đầu → khái niệm → ví dụ → áp dụng → tóm tắt.
- Mỗi slide giải thích MỘT ý. Slide có hai ý là slide không ai đọc nổi.`,
  },
  {
    id: "long",
    label: "Cao",
    labelEn: "Long",
    caption: "45–60 phút",
    captionEn: "45–60 min",
    scenes: [60, 95],
    wordsPerScene: [80, 110],
    minutes: [45, 60],
    rules: `
ĐỘ DÀI: DÀI (${"`60–95`"} slide, ${"`80–110`"} từ mỗi slide, tổng ${"`45–60 phút`"}).
Đây là cả một buổi giảng. Bạn PHẢI chia nhỏ vấn đề, không được kể lại.

Bắt buộc với độ dài này:
- Chia chủ đề thành 4–6 PHẦN rõ ràng. Mỗi phần là một mục riêng trong danh sách chương,
  có mốc thời gian riêng, và phần sau chỉ được dựa vào phần trước.
- Mỗi phần có: một slide định vị ("Phần 3: Cân bằng hóa học"), rồi các slide nội dung,
  rồi một slide củng cố với 2–3 câu hỏi tự kiểm.
- Suy ra nhiều tầng: định nghĩa → cơ chế → ví dụ giải quyết từng bước → ví dụ sai và vì sao sai
  → bài tập tự luyện. Bỏ tầng nào thì bài học sụp.
- Mỗi slide phải thêm điều GÌ ĐÓ mới. Nếu slide thứ 30 không có ý nào chưa nói ở
  slide 29, thì đó là 30 slide thành 15. Cắt nó đi.
- Cho phép 3–5 slide quiz xen kẽ, không dồn hết vào cuối.
- KHÔNG cắt ngắn khi đến slide 40 vì "nội dung chính đã xong". Nếu đã xong, hãy đào sâu
  thêm: lịch sử, ngoại lệ, cách sai thường gặp, liên hệ môn khác.`,
  },
];

const LENGTH_BY_ID = new Map(LESSON_LENGTHS.map((preset) => [preset.id, preset]));

export function resolveLessonLength(id: string | null | undefined): LessonLengthPreset {
  return (
    (id ? LENGTH_BY_ID.get(id as LessonLengthId) : undefined) ??
    LENGTH_BY_ID.get(DEFAULT_LESSON_LENGTH)!
  );
}

/**
 * The most slides any preset will ask the model to write.
 *
 * Validation used to cap a lesson at 24 scenes — a number chosen back when 24
 * was the top of the range. The `long` preset now promises 60–95, so that cap
 * silently truncated a finished lesson: 95 slides were written, roughly 38
 * minutes of model time, and then 71 of them were dropped on the floor before
 * the teacher ever saw them. A hard ceiling is still worth having — an
 * unvalidated array is a runaway, not a lesson — but it has to be derived from
 * what we actually ask for, so it lives next to the presets instead of being a
 * magic number in the validator.
 */
export const MAX_LESSON_SCENES = LESSON_LENGTHS.reduce(
  (max, preset) => Math.max(max, preset.scenes[1]),
  0,
);

export interface PresentationStyle {
  id: string;
  /** Shown in the picker. */
  label: string;
  /** One line on when to reach for it. */
  hint: string;
  /** English hint, same reason as above. */
  hintEn: string;
  /** Palette this style draws with, unless the teacher overrides it. */
  theme: string;
  /** Whether the deck should carry real pictures. */
  images: boolean;
  /**
   * Whether slides lead with a Lucide icon.
   *
   * Off for the text-only styles and on for the rest. A slide with an icon reads
   * as a topic from across a room, which is the whole point of a deck; a
   * minimalist deck that is meant to be calm is better off without one.
   */
  icons: boolean;
  /** Sent to the model as extra rules for stage 2. */
  rules: string;
}

export const PRESENTATION_STYLES: readonly PresentationStyle[] = [
  {
    id: "minimalist",
    label: "Minimalist Presentation",
    hint: "Chữ to, nền trắng, mỗi slide một ý. Dạng slide lời giảng, một câu một ý.",
    hintEn: "Big type, white paper, one idea per slide. Spoken-word slides, one sentence each.",
    theme: "paper",
    images: false,
    icons: false,
    rules: `
# PHONG CÁCH: MINIMALIST PRESENTATION
Đây là slide thuyết trình tối giản, xem như một câu chữ lớn trên nền trống.
- MỖI slide chỉ có MỘT ý, viết bằng MỘT câu. Tối đa 2 gạch đầu dòng, mỗi gạch
  dưới 60 ký tự. Cấm đoạn văn dài trên slide.
- Tiêu đề là câu khẳng định ngắn gọn, dưới 45 ký tự. Đừng viết tiêu đề dài.
- Để trống rất nhiều khoảng trắng; đừng nhồi mọi thứ vào một slide.
- Ưu tiên "formula" và "data" hơn là liệt kê. Một con số nói thay cả đoạn văn.
- TUYỆT ĐỐI không dùng "table" (bảng nhồi chữ, trái tinh thần tối giản) và
  không dùng "imageQuery" (hình ảnh làm loãng, chỉ chữ là chủ đạo).
- "narration" vẫn viết đầy đủ 3-4 câu như lời giảng thật, vì người xem nghe
  chứ không đọc slide.`,
  },
  {
    id: "visual-story",
    label: "Visual Story",
    hint: "Ảnh thật chiếm chỗ, chữ ít. Hợp sinh học, địa lí, lịch sử.",
    hintEn: "Real photos lead, few words. Fits biology, geography, history.",
    theme: "chalk",
    images: true,
    icons: true,
    rules: `
# PHONG CÁCH: VISUAL STORY
Slide là một bức ảnh kể chuyện, chữ chỉ để đặt ngữ cảnh.
- Mỗi slide PHẢI có "imageQuery" — đây là yêu cầu cốt lõi của phong cách này.
  Ảnh phải là đối tượng thật đang được nói tới, chụp/sơ đồ thật từ web.
- Chữ tối thiểu: tối đa 2 gạch đầu dòng, mỗi gạch dưới 50 ký tự. Ảnh phải
  thừa chỗ để đọc, đừng chen chữ lên ảnh.
- "title" dưới 45 ký tự, là một nhãn cụ thể ("Trái tim người", "Mùa Đông").
- "data" chỉ dùng khi con số thật sự nổi bật, tối đa 3 điểm.
- "narration" kể chuyện: dẫn dắt tình huống, rồi mới kết luận.`,
  },
  {
    id: "classroom",
    label: "Classroom Slides",
    hint: "Nhiều gạch đầu dòng, bảng và biểu đồ. Hợp toán, hoá, lịch sử.",
    hintEn: "Many bullets, tables and charts. Fits math, chemistry, history.",
    theme: "chalk",
    images: false,
    icons: true,
    rules: `
# PHONG CÁCH: CLASSROOM SLIDES
Slide như trong sách giáo khoa: đủ thông tin để học sinh chép và ghi nhớ.
- 3-4 gạch đầu dòng, mỗi gạch có định nghĩa hoặc ví dụ cụ thể.
- Bảng ("table") và biểu đồ ("data") được KHUYẾN NGHỊ mạnh ở phong cách này —
  đây là kiểu duy nhất trong ba kiểu mà bảng số thật sự hợp lý.
- "formula" dùng mỗi khi có công thức, kèm giải thích từng thành phần.
- Không dùng "imageQuery": bảng và biểu đồ đã là hình ảnh của slide.
- "narration" giảng thẳng, gọi tên định nghĩa, ví dụ số cụ thể.`,
  },
  {
    id: "cinematic",
    label: "Cinematic Documentary",
    hint: "Nền tối, câu chữ giàu cảm xúc. Hợp lịch sử, văn hoá, tự nhiên.",
    hintEn: "Dark stage, emotional lines. Fits history, culture, nature.",
    theme: "midnight",
    images: true,
    icons: true,
    rules: `
# PHONG CÁCH: CINEMATIC DOCUMENTARY
Slide tối, chữ lớn, giọng kể dẫn dắt cảm xúc như phim tài liệu.
- Tối đa 2 gạch đầu dòng, mỗi gạch dưới 55 ký tự. Để nhiều khoảng tối.
- Mỗi slide nên có "imageQuery" nếu chủ đề có hình ảnh thật (địa phương, sự
  kiện, hiện tượng thiên nhiên). Dùng ảnh có không gian, không dùng ảnh trắng.
- "title" là một câu có nhịp, gợi hình ảnh, dưới 50 ký tự.
- "narration" viết như lời dẫn chuyện: mở đầu bằng bối cảnh, nêu điều bất ngờ,
  rồi mới giải thích.`,
  },
];

export const DEFAULT_PRESENTATION_STYLE = "minimalist";

export function resolvePresentationStyle(id: string | null | undefined): PresentationStyle {
  return (
    PRESENTATION_STYLES.find((style) => style.id === id) ??
    PRESENTATION_STYLES[0]
  );
}
