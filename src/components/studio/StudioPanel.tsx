"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  TriangleAlert,
  CircleCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  Save,
  Trash2,
  Volume2,
  WandSparkles,
} from "lucide-react";
import type { PublicAiStatus } from "@/lib/ai/config";
import {
  SCENE_KIND_LABEL,
  type Lesson,
  type SlideTheme,
} from "@/lib/lesson/types";
import {
  DEFAULT_SLIDE_THEME,
  SLIDE_PATTERNS,
  DEFAULT_SLIDE_PATTERN,
  SLIDE_PRESETS,
  resolveSlideTheme,
  type SlideThemePreset,
} from "@/lib/lesson/themes";
import {
  DEFAULT_LESSON_LENGTH,
  DEFAULT_PRESENTATION_STYLE,
  LESSON_LENGTHS,
  PRESENTATION_STYLES,
  resolveLessonLength,
  type LessonLengthId,
  type PresentationStyle,
} from "@/lib/lesson/presentation-styles";
import {
  deleteStoredLesson,
  loadStoredLessons,
  saveStoredLesson,
  setActiveLessonId,
} from "@/lib/lesson/storage";
import { useGenerationStream, GenerationTimeline, RunLog } from "./GenerationTimeline";
import { LanguagePicker } from "./LanguagePicker";
import { AUTO_LANGUAGE } from "@/lib/lesson/lesson-languages";
import { PremierePlayer } from "./Premiere";
import { formatClock, slugify } from "@/lib/format";
import { useCopy, useLang } from "@/i18n/provider";

const COPY = {
  en: {
    createLesson: "Create lesson",
    studioLessonLanguage: "Lesson language",
    introLead:
      "Write what you want to teach and drop in any documents. The lesson is built scene by scene with narration, then opens in the",
    introPlayer: "player",
    setupCli: "Install agent CLI",
    setupKey: "Install AI key",
    warnCliLead: "Building a lesson needs the agent CLI running on your machine. Click",
    warnCliTail:
      "in the top corner — sign in once after installing, no API key needed. You can still watch the sample lesson in the player.",
    warnKeyLead: "Creating a lesson needs an AI API key. Click",
    warnKeyTail:
      "in the top corner — it takes about a minute. You can still watch the sample lesson in the player.",
    topicLabel: "What do you want to teach?",
    topicPlaceholder:
      "e.g. Explain the law of conservation of energy to grade 10 students, with one everyday example",
    contextLabel: "Context:",
    contextDrop: "drop documents here, or",
    contextPick: "choose files",
    contextReading: "Reading…",
    contextChars: "characters",
    creating: "Writing…",
    createHint: "Press Enter to generate. The outline appears first, then each scene.",
    draftBefore: "The draft is being saved in the",
    draftLibrary: "Library",
    draftAfter: "— where you can still see it being created.",
    noticeLocal: "Could not save to the server. The lesson still opens in this session.",
    noticeSaved: "Saved to the on-device library (data/courses).",
    noticeSaveFailed: "Could not save to the server. The lesson is still in this browser.",
    noticeServerDown: "Could not reach the server. The lesson is still in this browser.",
    clipboardBlocked: "The browser blocked the clipboard. Download the JSON file instead.",
    extractFailed: "Could not read the documents",
    extractTruncated: "only the first part was read because the file is too long",
    extractOldFont: "PDF uses an old font, so Vietnamese diacritics may be wrong",
    extractExamplePrefix: "e.g.:",
    extractRecheck: "Check this passage.",
    extractServerDown: "Could not reach the server to read the documents.",
    exportFailed: "Could not export the JSON.",
    sceneUnit: "scenes",
    saving: "Saving…",
    saved: "Saved",
    saveToLibrary: "Save to library",
    openInPlayer: "Open in the player",
    copied: "Copied",
    downloadJson: "Download JSON",
    discardResult: "Discard this result",
    libraryTitle: "On-device library",
    libraryStorage: "stored in localStorage",
    libraryEmpty: "No AI lessons yet. Two sample lessons are ready in the player.",
    open: "Open",
    deleteItem: "Delete",
    voiceLabel: "Narration voice",
    voiceLoading: "Loading voices…",
    voiceLoadFailed: "Could not load the list of voices.",
    voicePreviewFailed:
      "Could not preview this voice. You can still use it when the lesson plays.",
    voicePreview: "Preview voice",
    voiceLocalTempo:
      "Reading from this machine: the names below are tempos, not different people — one installed voice, sped or slowed to suit the slide.",
    voiceLocalMissing:
      "No voice is installed on this machine yet, so this falls back to the online voice.",
    voiceShowMore: "Show {count} more voices",
    voiceShowLess: "Show fewer voices",
    voiceLocalSetup: "Install the machine voice",
    imageLegend: "Illustrations",
    imageOn: "AI draws an illustration for each slide",
    imageOff: "Text only, no images",
    imageOnHint:
      "The model writes an English description and the system asks an AI to draw it, crediting every picture. Turn it on for subjects that need pictures — biology, geography, history.",
    imageOffHint:
      "The lesson uses text, formulas, tables and charts only. Best for problem-solving lessons, where an illustration often adds nothing.",
    pointerLegend: "Presenter pointer",
    pointerOn: "Show the pointer dot along with the narration",
    pointerOff: "No pointer",
    pointerOnHint:
      "The dot follows each sentence as it is read, keeping the viewer's eye where the teaching is.",
    pointerOffHint:
      "The slide still reads the narration and highlights the words; only the dot is hidden.",
    pointerColor: "Pointer colour",
    colorAmber: "Amber",
    colorRed: "Red",
    colorGreen: "Green",
    colorBlue: "Blue",
    colorOrange: "Orange",
    colorPink: "Pink",
    lengthLabel: "Lesson length",
    slideUnit: "slides",
    wordsPerSlide: "words/slide",
    lengthLongNote:
      "A long deck builds a whole teaching session, so it takes longer to generate and costs a lot of agent turns — a 95-slide lesson can exhaust the CLI quota.",
    styleLegend: "Presentation style",
    styleWithImages: "with images",
    styleTextOnly: "text only",
    paperDark: "dark background",
    paperLight: "light background",
    themeLegend: "Slide background",
    groupLight: "Light",
    groupDark: "Dark",
    groupTint: "Tinted",
    sampleKicker: "Scene",
    sampleTitle: "Title",
    sampleSub: "Supporting line",
    sampleGridKicker: "Sample scene",
    sampleGridTitle: "Slide title",
    sampleBody: "Body text · 01",
    presetUnit: "presets",
    themeExpanding: "expanding",
    themeTap: "tap to view",
    patternLabel: "Background pattern",
    patternNone: "Plain",
    patternDots: "Dots",
    patternGrid: "Grid",
    patternBands: "Bands",
    patternRings: "Rings",
    patternWaves: "Waves",
  },
  vi: {
    createLesson: "Tạo bài giảng",
    studioLessonLanguage: "Ngôn ngữ bài giảng",
    introLead:
      "Viết ý bạn muốn dạy, thả tài liệu vào nếu có. Bài giảng được dựng thành từng cảnh kèm lời giảng, rồi mở ngay trong",
    introPlayer: "trình phát",
    setupCli: "Cài agent CLI",
    setupKey: "Cài key AI",
    warnCliLead: "Cần agent CLI chạy trên máy bạn để dựng bài. Bấm",
    warnCliTail:
      "ở góc trên — cài xong đăng nhập một lần, không cần API key. Bạn vẫn xem được bài mẫu ở trang trình phát.",
    warnKeyLead: "Cần một API key AI để tạo bài. Bấm",
    warnKeyTail:
      "ở góc trên, mất khoảng một phút. Bạn vẫn xem được bài mẫu ở trang trình phát.",
    topicLabel: "Bạn muốn dạy bài gì?",
    topicPlaceholder:
      "Ví dụ: Giải thích định luật bảo toàn năng lượng cho học sinh lớp 10, có một ví dụ đời thường",
    contextLabel: "Ngữ cảnh:",
    contextDrop: "thả tài liệu vào đây, hoặc",
    contextPick: "chọn tệp",
    contextReading: "Đang đọc…",
    contextChars: "ký tự",
    creating: "Đang viết…",
    createHint: "Enter để tạo nhanh. Dàn ý hiện trước, rồi viết từng cảnh.",
    draftBefore: "Bài đang được lưu nháp trong",
    draftLibrary: "Thư viện",
    draftAfter: "— qua đó vẫn thấy trạng thái đang tạo.",
    noticeLocal: "Chưa lưu được lên máy chủ. Bài vẫn mở được trong phiên này.",
    noticeSaved: "Đã lưu vào thư viện trên máy (data/courses).",
    noticeSaveFailed: "Không lưu được lên máy chủ. Bài vẫn nằm trong trình duyệt.",
    noticeServerDown: "Không gọi được máy chủ. Bài vẫn nằm trong trình duyệt.",
    clipboardBlocked: "Trình duyệt chặn clipboard. Tải file JSON thay thế.",
    extractFailed: "Tải tài liệu thất bại",
    extractTruncated: "đã lấy phần đầu do tệp quá dài",
    extractOldFont: "PDF dùng font cũ nên dấu tiếng Việt có thể sai",
    extractExamplePrefix: "ví dụ:",
    extractRecheck: "Kiểm tra lại đoạn này.",
    extractServerDown: "Không gọi được máy chủ để đọc tài liệu.",
    exportFailed: "Không xuất được JSON.",
    sceneUnit: "cảnh",
    saving: "Đang lưu…",
    saved: "Đã lưu",
    saveToLibrary: "Lưu vào thư viện",
    openInPlayer: "Mở trong trình phát",
    copied: "Đã copy",
    downloadJson: "Tải JSON",
    discardResult: "Bỏ kết quả này",
    libraryTitle: "Thư viện trên máy",
    libraryStorage: "lưu trong localStorage",
    libraryEmpty: "Chưa có bài giảng nào do AI tạo. Hai bài mẫu đã có sẵn trong trang trình phát.",
    open: "Mở",
    deleteItem: "Xoá",
    voiceLabel: "Giọng đọc",
    voiceLoading: "Đang tải giọng đọc…",
    voiceLoadFailed: "Không tải được danh sách giọng đọc.",
    voicePreviewFailed: "Không nghe thử được giọng này. Bạn vẫn có thể dùng nó khi phát bài.",
    voicePreview: "Nghe thử giọng",
    voiceLocalTempo:
      "Đang đọc bằng giọng trên máy: các tên bên dưới là tốc độ, không phải người khác nhau — một giọng đã cài, nhanh hoặc chậm theo từng slide.",
    voiceLocalMissing:
      "Máy này chưa cài giọng nào, nên đang dùng giọng trên mạng thay thế.",
    voiceShowMore: "Xem thêm {count} giọng",
    voiceShowLess: "Thu gọn danh sách",
    voiceLocalSetup: "Cài giọng cho máy",
    imageLegend: "Ảnh minh hoạ",
    imageOn: "AI vẽ ảnh minh hoạ cho mỗi slide",
    imageOff: "Chỉ chữ, không dùng ảnh",
    imageOnHint:
      "Model tự viết mô tả tiếng Anh, hệ thống nhờ AI vẽ và ghi nguồn dưới mỗi tấm. Bật cho bài cần hình như sinh học, địa lí, lịch sử.",
    imageOffHint:
      "Bài giảng chỉ dùng chữ, công thức, bảng và biểu đồ. Hợp với bài toán–tính toán, nơi ảnh minh hoạ thường không liên quan.",
    pointerLegend: "Con trỏ giảng",
    pointerOn: "Hiện chấm con trỏ theo lời giảng",
    pointerOff: "Tắt con trỏ",
    pointerOnHint: "Chấm tròn đi theo từng câu đọc, giữ mắt người xem đúng chỗ đang giảng.",
    pointerOffHint: "Slide vẫn đọc lời giảng và tô chữ, chỉ không hiện chấm tròn.",
    pointerColor: "Con trỏ màu",
    colorAmber: "Vàng",
    colorRed: "Đỏ",
    colorGreen: "Xanh lá",
    colorBlue: "Xanh dương",
    colorOrange: "Cam",
    colorPink: "Hồng",
    lengthLabel: "Độ dài bài giảng",
    slideUnit: "slide",
    wordsPerSlide: "từ/slide",
    lengthLongNote:
      "Bản dài dựng cả một buổi giảng nên thời gian chờ sẽ lâu hơn bài ngắn, và tốn rất nhiều lượt agent — một bài 95 slide có thể hết hạn mức của CLI.",
    styleLegend: "Kiểu thuyết trình",
    styleWithImages: "có ảnh thật",
    styleTextOnly: "chỉ chữ",
    paperDark: "nền tối",
    paperLight: "nền sáng",
    themeLegend: "Nền slide",
    groupLight: "Nền sáng",
    groupDark: "Nền tối",
    groupTint: "Nền màu",
    sampleKicker: "Cảnh",
    sampleTitle: "Tiêu đề",
    sampleSub: "Dòng phụ đệm",
    sampleGridKicker: "Cảnh mẫu",
    sampleGridTitle: "Tiêu đề slide",
    sampleBody: "Chữ chân dung · 01",
    presetUnit: "mẫu",
    themeExpanding: "đang mở",
    themeTap: "chạm để xem",
    patternLabel: "Họa tiết nền",
    patternNone: "Trơn",
    patternDots: "Chấm",
    patternGrid: "Lưới",
    patternBands: "Dải chéo",
    patternRings: "Vòng",
    patternWaves: "Sóng",
  },
};

type CopyKey = keyof typeof COPY.en;

const PRESETS = [
  "Định luật bảo toàn năng lượng",
  "Đạo hàm theo định nghĩa",
  "Vòng lặp for trong Python",
  "Thì hiện tại hoàn thành",
  "Cân bằng phương trình hoá học",
  "Overfitting trong học máy",
];

/** Topic → Gemini → editable timeline. The generated lesson opens in /lesson. */
function PreviewFormula({ formula }: { formula: string }) {
  // Same render options as the player's SceneFormula; a rejected formula falls
  // back to raw text so the preview never disagrees with the player.
  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        displayMode: true,
        throwOnError: true,
        strict: false,
        trust: false,
        output: "htmlAndMathml",
      });
    } catch {
      return null;
    }
  }, [formula]);
  if (html === null) {
    return (
      <p className="mt-2 w-fit rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 font-mono text-sm text-gold-200">
        {formula}
      </p>
    );
  }
  return (
    <div
      className="mt-2 w-fit max-w-full overflow-x-auto rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-1.5 text-gold-200 [&_.katex]:!text-inherit"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}


/**
 * The picker's live miniature for one pattern: the same gradients the slide
 * paints, drawn with the current paper's own accent and sized in px for a
 * 36px-tall swatch. Higher alphas than the slide itself — at this size the
 * real 10% washes read as plain paper.
 */
function patternSwatch(
  id: string,
  palette: { bg: string; accent: string; accentSoft: string; rule: string },
): CSSProperties {
  const base = { backgroundColor: palette.bg };
  switch (id) {
    case "dots":
      return {
        ...base,
        backgroundImage: `radial-gradient(color-mix(in srgb, ${palette.accentSoft} 65%, transparent) 1.2px, transparent 1.3px)`,
        backgroundSize: "7px 7px",
      };
    case "grid":
      return {
        ...base,
        backgroundImage:
          `linear-gradient(color-mix(in srgb, ${palette.rule} 80%, transparent) 1px, transparent 1px),` +
          `linear-gradient(90deg, color-mix(in srgb, ${palette.rule} 80%, transparent) 1px, transparent 1px)`,
        backgroundSize: "100% 8px, 8px 100%",
      };
    case "bands":
      return {
        ...base,
        backgroundImage: `linear-gradient(135deg, transparent 52%, color-mix(in srgb, ${palette.accent} 45%, transparent) 52%, color-mix(in srgb, ${palette.accent} 45%, transparent) 72%, color-mix(in srgb, ${palette.accentSoft} 60%, transparent) 72%)`,
      };
    case "rings":
      return {
        ...base,
        backgroundImage: `repeating-radial-gradient(circle at 82% 22%, transparent 0, transparent 7px, color-mix(in srgb, ${palette.accentSoft} 55%, transparent) 7px, color-mix(in srgb, ${palette.accentSoft} 55%, transparent) 8px)`,
      };
    case "waves":
      return {
        ...base,
        backgroundImage:
          `radial-gradient(70% 90% at 12% 100%, color-mix(in srgb, ${palette.accent} 40%, transparent) 0%, transparent 70%),` +
          `radial-gradient(60% 80% at 90% 0%, color-mix(in srgb, ${palette.accentSoft} 45%, transparent) 0%, transparent 70%)`,
      };
    default:
      return base;
  }
}

export function StudioPanel() {
  const t = useCopy(COPY);
  const lang = useLang();
  const [status, setStatus] = useState<PublicAiStatus | null>(null);
  const [topic, setTopic] = useState(PRESETS[0]);
  // How long the lesson should run. Kept beside the style rather than folded into
  // it, because the two are independent: a long minimalist lecture and a short
  // visual story are both reasonable, and a preset that hard-coded both would
  // force one to be given up to get the other.
  const [lessonLength, setLessonLength] = useState<LessonLengthId>(DEFAULT_LESSON_LENGTH);
  // Derived from the length preset rather than fixed. These used to be hardcoded
  // to 14 scenes over 8 minutes, which is the "medium" answer wearing a constant's
  // clothes: the server clamped them into whatever preset was chosen, so picking
  // "long" sent 14 and 8 anyway. Deriving them here keeps the request honest and
  // means the progress estimate a teacher watches matches what arrives.
  const lengthPreset = resolveLessonLength(lessonLength);
  const sceneCount = lengthPreset.scenes[1];
  const minutes = lengthPreset.minutes[1];
  const [referenceText, setReferenceText] = useState("");
  // The paper the slides are drawn on. This is a presentation decision, so it is
  // made before generation and carried on the lesson — a teacher who wants a
  // dark deck should not have to restyle twenty-four slides afterwards.
  const [theme, setTheme] = useState<SlideTheme>(DEFAULT_SLIDE_THEME);
  /** Pattern id; the slide resolves it through the registry, like the theme. */
  const [pattern, setPattern] = useState<string>(DEFAULT_SLIDE_PATTERN);
  /** Whether the theme grid is showing; the dropdown is the collapsed state. */
  const [themeOpen, setThemeOpen] = useState(false);
  // The voice is chosen here rather than in the player, because picking a voice
  // by name is a guess and picking one by ear is not. See VoiceChooser.
  const [voice, setVoice] = useState("");
  // Illustrations. Seeded from the chosen style rather than from `true`, because
  // "minimalist" and "visual story" disagree about pictures and the style is the
  // setting that says which of the two this is. Changing the style resets this;
  // the two controls are a starting point, and the switch stays adjustable after.
  const [useImages, setUseImages] = useState(
    PRESENTATION_STYLES.find((item) => item.id === DEFAULT_PRESENTATION_STYLE)?.images ?? true,
  );
  // The language the lesson is written in. "auto" is the default and hands the
  // decision to the brief: ask in English, get an English lesson.
  const [language, setLanguage] = useState(AUTO_LANGUAGE);
  // The teacher's pointer: on unless switched off. Carried on the lesson so
  // the player honours it without asking again.
  const [showPointer, setShowPointer] = useState(true);
  // Pointer colour. Amber is what the pointer has always been, so it stays
  // the default; the swatches below only offer colours that stay legible on
  // both paper and midnight slides.
  const [pointerColor, setPointerColor] = useState("#f59e0b");
  // Which kind of deck this is. First because it decides the two settings
  // below it: a deck that is minimal, heavily illustrated and textbook-dense at
  // once is not a deck, it is three people arguing.
  const [styleId, setStyleId] = useState(DEFAULT_PRESENTATION_STYLE);

  /**
   * Picks a style and drags the dependent settings along with it.
   *
   * Deliberately overwrites the theme and the image switch rather than layering
   * on top of them. A teacher who switches from "Visual Story" to "Minimalist"
   * means it — leaving a gallery of stock photos on a deck they just described as
   * type-only would be the kind of surprise that makes people stop trusting the
   * settings at all.
   */
  const chooseStyle = useCallback((style: PresentationStyle) => {
    setStyleId(style.id);
    setTheme(style.theme);
    setUseImages(style.images);
  }, []);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [stored, setStored] = useState<Lesson[]>([]);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [severeDocs, setSevereDocs] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const stream = useGenerationStream();
  const busy = stream.running;
  const router = useRouter();
  // The classroom session owns the run's screen from the first event on: as
  // soon as the server hands over the deck id, route there (SPA navigation —
  // the singleton stream keeps flowing across it) exactly once per run.
  const navigatedRef = useRef<string | null>(null);
  const runLessonId = stream.progress.lessonId ?? null;
  const runDone = stream.progress.done;
  useEffect(() => {
    // Only while the deck is still being written: after `done` the teacher
    // may be back on the form, and pushing them away again would trap them
    // in a navigation loop.
    if (!runLessonId || runDone || navigatedRef.current === runLessonId) return;
    navigatedRef.current = runLessonId;
    try {
      localStorage.setItem("edusgpt.classroom-voice.v1", voice);
    } catch {
      /* the classroom falls back to the default voice */
    }
    router.push(`/classroom?id=${encodeURIComponent(runLessonId)}`);
  }, [runLessonId, runDone, router, voice]);
  // The final lesson arrives on the stream's `done` event; mirror it into the
  // panel so the preview/save/open buttons light up.
  const finishedLesson = stream.progress.lesson;
  useEffect(() => {
    if (!finishedLesson) return;
    setLesson(finishedLesson);

    // Persist straight away. Without this the lesson only ever existed in this
    // tab: opening it sent the player to /api/courses, found nothing, and fell
    // back to the sample — so a Python lesson came back as Newton's law.
    void (async () => {
      try {
        const response = await fetch("/api/courses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lesson: finishedLesson, log: stream.progress.log }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { id?: string };
        setStored(loadStoredLessons());
        setSavedId(payload.id ?? finishedLesson.id);
      } catch {
        // Kept in the browser all the same; the player can still open it.
        setNotice(t.noticeLocal);
      }
    })();
  }, [finishedLesson, t]);
  const streamError = stream.progress.error;

  useEffect(() => {
    void fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ai: PublicAiStatus }) => setStatus(payload.ai))
      .catch(() => setStatus(null));
    setStored(loadStoredLessons());
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    setSavedId(null);

    // Streamed: the outline shows up in seconds, then each scene lands in turn.
    // Subject and level are deliberately left out — the model reads them off the
    // prompt ("cho học sinh lớp 10"), which beats a default that silently
    // labelled every lesson "Vật lí".
    await stream.start({
      topic,
      subject: "",
      grade: "",
      sceneCount,
      minutes,
      notes: topic,
      referenceMaterial: referenceText,
      language,
      theme,
      pattern,
      voice,
      useImages,
      showPointer,
      pointerColor,
      style: styleId,
      lessonLength,
    });
  }, [language, lessonLength, minutes, pattern, pointerColor, referenceText, sceneCount, showPointer, stream, styleId, theme, topic, useImages, voice]);

  /** Saves to the server library (survives a browser wipe) and mirrors to local. */
  const save = useCallback(async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lesson }),
      });
      if (response.ok) {
        const payload = (await response.json()) as { id?: string };
        if (payload.id) {
          setLesson((current) => (current ? { ...current, id: payload.id as string } : current));
        }
        setNotice(t.noticeSaved);
      } else {
        setNotice(t.noticeSaveFailed);
      }
    } catch {
      setNotice(t.noticeServerDown);
    } finally {
      const merged = loadStoredLessons();
      setStored(merged);
      setSavedId(lesson.id);
      setActiveLessonId(lesson.id);
      setSaving(false);
    }
  }, [lesson, t]);

  const openInPlayer = useCallback((target: Lesson) => {
    setActiveLessonId(target.id);
    window.location.href = `/lesson?c=${encodeURIComponent(target.id)}`;
  }, []);

  const remove = useCallback((id: string) => {
    setStored(deleteStoredLesson(id));
  }, []);

  const copyJson = useCallback(async () => {
    if (!lesson) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(lesson, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t.clipboardBlocked);
    }
  }, [lesson, t]);

  /**
   * Real files go through /api/extract, which understands PDF, DOCX and XLSX
   * and reports honestly when a PDF is a scan or uses a legacy font. Reading
   * the bytes here in the browser produced nothing but mojibake for those.
   */
  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setExtracting(true);
    setExtractError(null);
    const notes: string[] = [];
    const severeNotes: string[] = [];

    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const response = await fetch("/api/extract", { method: "POST", body: form });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        text?: string;
        docs?: {
          name: string;
          chars: number;
          pages?: number;
          note?: string;
          truncated?: boolean;
          vietnamese: { fixed: number; suspect: boolean; severe: boolean; examples: string[] };
        }[];
      };

      if (!response.ok) {
        setExtractError(`${t.extractFailed} (${response.status}).`);
        return;
      }

      for (const doc of payload.docs ?? []) {
        if (doc.note) notes.push(`${doc.name}: ${doc.note}`);
        if (doc.truncated) notes.push(`${doc.name}: ${t.extractTruncated}.`);
        if (doc.vietnamese.suspect) {
          notes.push(
            `${doc.name}: ${t.extractOldFont}` +
              (doc.vietnamese.examples.length
                ? ` (${t.extractExamplePrefix} ${doc.vietnamese.examples.join(", ")})`
                : "") +
              `. ${t.extractRecheck}`,
          );
          if (doc.vietnamese.severe) severeNotes.push(doc.name);
        }
      }

      if (payload.text) setReferenceText(payload.text);
      setExtractError(notes.length ? notes.join(" ") : null);
      setSevereDocs(severeNotes);
    } catch {
      setExtractError(t.extractServerDown);
    } finally {
      setExtracting(false);
    }
  }, [t]);

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    void uploadFiles(picked);
  };

  const downloadJson = useCallback(async () => {
    if (!lesson) return;
    const response = await fetch("/api/export/json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lesson }),
    });
    if (!response.ok) {
      setError(t.exportFailed);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(lesson.title) || "bai-giang"}.lesson.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [lesson]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
            {t.createLesson}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mist-300 sm:text-base">
            {t.introLead}{" "}
            <Link href="/lesson" className="text-brand-200 underline">
              {t.introPlayer}
            </Link>
            .
          </p>
        </div>
        <div className="shrink-0">
          {status?.configured ? (
            <span className="chip border-brand-600/60 bg-brand-500/10 text-brand-200">
              <CircleCheck className="h-3.5 w-3.5" />{" "}
              {status.providerKind === "cli"
                ? // No key exists for a CLI provider, so a masked hint would render
                  // as a dangling "· " at the end of the chip.
                  `${status.providerLabel} · ${status.model}`
                : `${status.model} · ${status.keyHint}`}
            </span>
          ) : (
            <Link href="/setup" className="btn-gold">
              <KeyRound className="h-4 w-4" />{" "}
              {status?.providerKind === "cli" ? t.setupCli : t.setupKey}
            </Link>
          )}
        </div>
      </header>

      {!status?.configured ? (
        <p className="flex items-start gap-2 rounded-xl border border-gold-500/40 bg-gold-500/[0.08] px-3.5 py-3 text-sm text-mist-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
          {status?.providerKind === "cli" ? (
            <>
              {t.warnCliLead}{" "}
              <strong className="mx-1">{t.setupCli}</strong> {t.warnCliTail}
            </>
          ) : (
            <>
              {t.warnKeyLead}{" "}
              <strong className="mx-1">{t.setupKey}</strong> {t.warnKeyTail}
            </>
          )}
        </p>
      ) : null}

      {/*
        The form is one question — "what are you teaching?" — plus a context box
        and one big button. Subject, level, scene count and length are folded
        away: a newcomer facing seven controls before typing a word never gets
        to their first lesson.
      */}
      <section className="panel space-y-4 p-5">
        <div>
          <label className="label" htmlFor="topic">
            {t.topicLabel}
          </label>
          <textarea
            id="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void generate();
              }
            }}
            rows={3}
            className="field resize-y font-sans text-base"
            placeholder={t.topicPlaceholder}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTopic(preset)}
                className={`chip transition-colors ${
                  topic === preset
                    ? "border-brand-500 bg-brand-500/15 text-brand-100"
                    : "hover:border-brand-700 hover:text-mist-100"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <StylePicker value={styleId} onChange={chooseStyle} />

        <LengthPicker value={lessonLength} onChange={setLessonLength} />

        <ThemePicker value={theme} onChange={setTheme} open={themeOpen} setOpen={setThemeOpen} />

        <div>
          <p className="label">{t.patternLabel}</p>
          <div className="flex flex-wrap gap-1.5">
            {SLIDE_PATTERNS.map((id) => {
              const labels: Record<string, string> = {
                none: t.patternNone,
                dots: t.patternDots,
                grid: t.patternGrid,
                bands: t.patternBands,
                rings: t.patternRings,
                waves: t.patternWaves,
              };
              const active = pattern === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPattern(id)}
                  aria-pressed={active}
                  className={`min-w-[4.5rem] flex-1 rounded-xl border p-1.5 transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-500/15 text-brand-100"
                      : "border-ink-700 hover:border-brand-700 hover:text-mist-100"
                  }`}
                >
                  {/* Live miniature: the same gradients the slide paints, drawn
                      with this paper's own accent so the preview never lies. */}
                  <span
                    aria-hidden="true"
                    className="block h-9 w-full rounded-lg border border-ink-700/60"
                    style={patternSwatch(id, resolveSlideTheme(theme).palette)}
                  />
                  <span className="mt-1 block text-center text-[11px] font-medium">
                    {labels[id] ?? id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <ImageModeToggle value={useImages} onChange={setUseImages} />

        <div>
          <p className="mb-1 text-xs font-medium text-mist-300">
            {t.studioLessonLanguage}
          </p>
          <LanguagePicker value={language} onChange={setLanguage} />
        </div>

        <PointerModeToggle
          visible={showPointer}
          onToggle={setShowPointer}
          color={pointerColor}
          onColor={setPointerColor}
        />

        <VoiceChooser value={voice} onChange={setVoice} topic={topic} />

        {/* Context: the part a teacher actually reaches for. */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadFiles(Array.from(event.dataTransfer.files));
          }}
          className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
            dragging ? "border-brand-400 bg-brand-500/10" : "border-ink-700/80 bg-ink-950/40"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-mist-300">
              <span className="font-medium text-mist-100">{t.contextLabel}</span>{" "}
              {t.contextDrop}{" "}
              <label
                htmlFor="material"
                className="cursor-pointer text-brand-200 underline underline-offset-2"
              >
                {t.contextPick}
              </label>
            </p>
            <span className="text-xs text-mist-400">
              {extracting ? (
                <span className="inline-flex items-center gap-1.5 text-brand-300">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {t.contextReading}
                </span>
              ) : referenceText ? (
                <span className="font-mono text-brand-300">
                  {referenceText.length.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")}{" "}
                  {t.contextChars}
                </span>
              ) : (
                "PDF · Word · Excel · TXT"
              )}
            </span>
          </div>
          <input
            type="file"
            id="material"
            accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.markdown,.csv,.json"
            multiple
            onChange={handleFilePick}
            disabled={extracting}
            className="sr-only"
          />
          {extractError && (
            <p
              className={`mt-2.5 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                severeDocs.length
                  ? "border-ember-500/50 bg-ember-500/10 text-mist-100"
                  : "border-gold-500/40 bg-gold-500/[0.08] text-mist-100"
              }`}
            >
              {extractError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void generate()}
            className="btn-primary px-5 py-2.5 text-base"
            disabled={busy || !status?.configured}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <WandSparkles className="h-4 w-4" />
            )}
            {busy ? t.creating : t.createLesson}
          </button>
          <span className="text-xs text-mist-500">{t.createHint}</span>
        </div>

        {busy || stream.progress.steps.length > 0 || streamError ? (
          <GenerationTimeline progress={stream.progress} />
        ) : null}
        {busy ? (
          <p className="mt-3 text-xs text-mist-400">
            {t.draftBefore}{" "}
            <Link href="/library" className="text-brand-200 underline underline-offset-2">
              {t.draftLibrary}
            </Link>{" "}
            {t.draftAfter}
          </p>
        ) : null}
        {!lesson && stream.progress.liveScenes.length > 0 ? (
          <PremierePlayer
            scenes={stream.progress.liveScenes}
            voice={voice}
            running={busy}
            done={stream.progress.done}
            progress={stream.progress.percent}
            lessonId={stream.progress.lessonId ?? ""}
          />
        ) : null}
        {!lesson && stream.progress.log.length > 0 ? (
          <RunLog log={stream.progress.log} />
        ) : null}

        {error || streamError ? (
          <p className="flex items-start gap-2 rounded-xl border border-ember-500/50 bg-ember-500/10 px-3.5 py-2.5 text-sm text-mist-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-ember-400" />
            <span className="min-w-0 break-words">{error ?? streamError}</span>
          </p>
        ) : null}
      </section>

      {lesson ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-mist-50">{lesson.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mist-500">
                <span className="chip">{lesson.subject}</span>
                {lesson.grade ? <span className="chip">{lesson.grade}</span> : null}
                <span className="chip">
                  {formatClock(lesson.duration, false)} · {lesson.scenes.length}{" "}
                  {t.sceneUnit}
                </span>
                {lesson.model ? <span className="chip">{lesson.model}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : savedId === lesson.id ? (
                  <CircleCheck className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving
                  ? t.saving
                  : savedId === lesson.id
                    ? t.saved
                    : t.saveToLibrary}
              </button>
              <button
                type="button"
                onClick={() => openInPlayer(lesson)}
                className="btn-gold"
              >
                <Play className="h-4 w-4" /> {t.openInPlayer}
              </button>
            </div>
          </div>

          <ol className="mt-4 space-y-2">
            {lesson.scenes.map((scene) => (
              <li
                key={scene.id}
                className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip border-brand-700/60 bg-brand-500/10 text-brand-200">
                    {SCENE_KIND_LABEL[scene.kind]}
                  </span>
                  <span className="font-mono text-[11px] text-mist-500">
                    {formatClock(scene.start, false)} →{" "}
                    {formatClock(scene.start + scene.duration, false)}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-mist-500">
                    {scene.duration.toFixed(0)}s
                  </span>
                </div>
                <p className="mt-2 font-semibold text-mist-100">{scene.title}</p>
                {scene.subtitle ? (
                  <p className="mt-0.5 text-sm text-mist-400">{scene.subtitle}</p>
                ) : null}
                <ul className="mt-2 space-y-1">
                  {scene.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2 text-sm text-mist-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                {scene.formula ? <PreviewFormula formula={scene.formula} /> : null}
                {scene.narration ? (
                  <p className="mt-2 border-l-2 border-brand-600/70 pl-3 text-xs italic text-mist-400">
                    {scene.narration}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyJson()} className="btn-ghost">
              <Copy className="h-4 w-4" /> {copied ? t.copied : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={() => void downloadJson()}
              className="btn-ghost"
            >
              <Download className="h-4 w-4" /> {t.downloadJson}
            </button>
            <button
              type="button"
              onClick={() => setLesson(null)}
              className="btn-ghost ml-auto text-mist-400"
            >
              {t.discardResult}
            </button>
          </div>

          <RunLog log={stream.progress.log} />
        </section>
      ) : null}

      <section className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-mist-100">
            {t.libraryTitle} ({stored.length})
          </h2>
          <span className="text-xs text-mist-500">{t.libraryStorage}</span>
        </div>

        {stored.length === 0 ? (
          <p className="mt-3 text-sm text-mist-400">{t.libraryEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stored.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-700/70 bg-ink-950/50 px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-mist-100">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-mist-500">
                    {item.subject} · {formatClock(item.duration, false)} ·{" "}
                    {item.scenes.length} {t.sceneUnit}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => openInPlayer(item)}
                  className="btn-ghost px-3 py-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" /> {t.open}
                </button>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="btn-icon h-8 w-8"
                  aria-label={`${t.deleteItem} ${item.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The narration voice, chosen by ear.
 *
 * The alternative is a `<select>` of names in the player, which asks a teacher to
 * pick "Hoài My" or "Nam Minh" on the strength of a Vietnamese-language label and
 * then find out. So the choice is made here, before generation, and every option
 * can be played.
 *
 * The sample is the actual lesson topic rather than a stock line, because the
 * thing a teacher is judging is whether *this* sentence sounds right in this
 * voice — and a generic demo sentence hides exactly the accents and pacing that
 * make one voice suit a lesson and another not.
 */
/** How many voices stay on screen before the list opens. */
const TOP_VOICES = 10;

function VoiceChooser({
  value,
  onChange,
  topic,
}: {
  value: string;
  onChange: (id: string) => void;
  topic: string;
}) {
  const t = useCopy(COPY);
  const [voices, setVoices] = useState<{ id: string; label: string; provider?: string; note?: string }[]>([]);
  /**
   * Thirty-odd local voices plus the hosted ones is a wall of chips. The first
   * handful stays on screen and the rest opens under a single line, because a
   * picker nobody can see the end of is a picker nobody reads.
   */
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Which engine the server will actually use, and whether it is ready.
   *
   * In local mode the list of names stops meaning what it says — there is one
   * installed voice, and a name is a request for a tempo — so the chooser has to
   * say so rather than let the teacher wonder why "Hoài My" sounds like the one
   * voice installed.
   */
  const [engine, setEngine] = useState<{ engine: string; localReady: boolean } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tts")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.voices)) return;
        setVoices(data.voices);
        setEngine({
          engine: typeof data.engine === "string" ? data.engine : "cloud",
          localReady: Boolean(data.local?.ready),
        });
        // The server's own default wins over "" so the choice shown is the one
        // that will actually be used.
        if (!value && typeof data.default === "string") onChange(data.default);
      })
      .catch(() => setError(t.voiceLoadFailed));
    return () => {
      cancelled = true;
    };
    // `onChange` is setState from the parent and is stable for this component's
    // life; re-running on it would reset the selection on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One sample at a time. Stopping the previous clip is what makes pressing a
  // second voice a change of mind rather than an overlap.
  const preview = async (id: string) => {
    audioRef.current?.pause();
    setError(null);
    if (playing === id) {
      setPlaying(null);
      return;
    }
    setPlaying(id);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: topic.trim().slice(0, 240) || "Xin chào, đây là giọng đọc của bài giảng.",
          voice: id,
        }),
      });
      if (!response.ok) throw new Error("tts");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      setPlaying(null);
      setError(t.voicePreviewFailed);
    }
  };

  // Grouped by engine, in the order a teacher thinks in: VieNeu-TTS first,
  // then the Edge cloud voices, then Piper. The old order put every local
  // voice first, which stranded the single Piper voice at the head of the
  // list and let a cloud voice leak into the top 10 — the chips no longer
  // matched the engine they belong to. Stable within each group, so the API
  // order (Nano before Turbo, Vietnamese before English) is kept.
  const providerRank = (voice: { provider?: string }): number =>
    voice.provider === "vieneu" ? 0 : !voice.provider ? 1 : 2;
  const ordered = [...voices].sort(
    (a, b) => providerRank(a) - providerRank(b),
  );
  const visible = expanded
    ? ordered
    : [...ordered.slice(0, TOP_VOICES), ...ordered.slice(TOP_VOICES).filter((v) => v.id === value)];
  const hidden = Math.max(0, ordered.length - TOP_VOICES);

  return (
    <fieldset className="mt-3">
      <legend className="label">{t.voiceLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {visible.map((option) => {
          const selected = value === option.id;
          const isPlaying = playing === option.id;
          return (
            <div
              key={option.id}
              className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
                selected ? "border-brand-500 bg-brand-500/10" : "border-ink-700"
              }`}
            >
              <button
                type="button"
                onClick={() => onChange(option.id)}
                aria-pressed={selected}
                className={`px-1 text-xs font-semibold ${
                  selected ? "text-mist-50" : "text-mist-300 hover:text-mist-100"
                }`}
              >
                {option.label}
              </button>
              <button
                type="button"
                onClick={() => void preview(option.id)}
                title={`${t.voicePreview} ${option.label}`}
                aria-label={`${t.voicePreview} ${option.label}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-mist-400 transition-colors hover:bg-ink-700 hover:text-mist-100"
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        })}
        {voices.length === 0 && !error ? (
          <span className="text-xs text-mist-500">{t.voiceLoading}</span>
        ) : null}
      </div>
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-2 flex items-center gap-1 text-xs text-brand-300 transition-colors hover:text-brand-200"
        >
          {expanded ? t.voiceShowLess : t.voiceShowMore.replace("{count}", String(hidden))}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      ) : null}
      {engine?.engine === "local" ? (
        <p className="mt-2 text-[11px] leading-relaxed text-mist-500">
          {engine.localReady ? t.voiceLocalTempo : t.voiceLocalMissing}{" "}
          <Link href="/setup" className="text-brand-300 underline underline-offset-2">
            {t.voiceLocalSetup}
          </Link>
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-ember-300">{error}</p> : null}
    </fieldset>
  );
}


/**
 * Illustrations on or off for the generated deck.
 *
 * A switch rather than a checkbox because it is a mode, not a field to fill in,
 * and the label has to carry the consequence: the model writes an illustration
 * prompt for nearly every teaching scene, and the player renders it through the
 * AI picture service (pollinations.ai, no key), so this costs a handful of
 * generated pictures per deck and adds an "AI" credit line under each one.
 *
 * The server enforces it, not this component — see `useImages` in the generation
 * route. The switch only says which way to aim.
 */
function ImageModeToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useCopy(COPY);
  return (
    <fieldset className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        {t.imageLegend}
      </legend>
      <label className="mt-1 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        {/* The track. `peer-checked` drives it from the real input, so the switch
            is keyboard- and screen-reader-operable without a div pretending to
            be a control. */}
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border border-ink-600 bg-ink-800 p-0.5 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-500/30 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400"
        >
          <span className="h-4 w-4 rounded-full bg-mist-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-brand-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-mist-100">
            {value ? t.imageOn : t.imageOff}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-mist-400">
            {value ? t.imageOnHint : t.imageOffHint}
          </span>
        </span>
      </label>
    </fieldset>
  );
}

/**
 * Pointer dot on or off, plus its colour.
 *
 * On is the default: the dot walks the slide in step with the narration and
 * tells the eye where to look. Off is for teachers who present the deck
 * themselves — the narration text stays, only the dot goes. The colour
 * swatches appear only while the pointer is on, because picking a colour for
 * something switched off is a question nobody asked.
 */
const POINTER_COLORS: { id: string; hex: string; label: CopyKey }[] = [
  { id: "amber", hex: "#f59e0b", label: "colorAmber" },
  { id: "red", hex: "#ef4444", label: "colorRed" },
  { id: "green", hex: "#22c55e", label: "colorGreen" },
  { id: "blue", hex: "#3b82f6", label: "colorBlue" },
  { id: "orange", hex: "#f97316", label: "colorOrange" },
  { id: "pink", hex: "#ec4899", label: "colorPink" },
];

function PointerModeToggle({
  visible,
  onToggle,
  color,
  onColor,
}: {
  visible: boolean;
  onToggle: (value: boolean) => void;
  color: string;
  onColor: (hex: string) => void;
}) {
  const t = useCopy(COPY);
  return (
    <fieldset className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        {t.pointerLegend}
      </legend>
      <label className="mt-1 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => onToggle(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border border-ink-600 bg-ink-800 p-0.5 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-500/30 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400"
        >
          <span className="h-4 w-4 rounded-full bg-mist-300 transition-transform peer-checked:translate-x-5 peer-checked:bg-brand-300" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-mist-100">
            {visible ? t.pointerOn : t.pointerOff}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-mist-400">
            {visible ? t.pointerOnHint : t.pointerOffHint}
          </span>
        </span>
      </label>
      {visible ? (
        <span className="mt-2.5 flex flex-wrap items-center gap-2 pl-14">
          {POINTER_COLORS.map((option) => {
            const active = color.toLowerCase() === option.hex;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onColor(option.hex)}
                title={t[option.label]}
                aria-label={`${t.pointerColor} ${t[option.label]}`}
                aria-pressed={active}
                style={{ backgroundColor: option.hex }}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  active
                    ? "scale-110 border-mist-50"
                    : "border-transparent hover:scale-105"
                }`}
              />
            );
          })}
        </span>
      ) : null}
    </fieldset>
  );
}

/**
 * Which kind of deck to make.
 *
 * The first control in the panel, because it is the one question whose answer
 * changes everything else: the paper, whether slides carry pictures, how much
 * text fits on one, and the voice the narration is written in. The two pickers
 * below it are the escape hatch for when the bundled defaults are not right.
 *
 * Each option shows its own palette, so the choice is made on what the deck will
 * look like rather than on what it is called.
 */
/**
 * How long the lesson should be.
 *
 * The scale is labelled by duration and annotated with the slide count, because
 * those are the two numbers a teacher actually reasons about. A bare "1–2 phút" is
 * ambiguous — a two-minute deck is five slides or fifty — and the scene count is
 * what says whether the depth is right. It is also the number the generation
 * prompt is held to, so showing it shows the contract rather than a wish.
 *
 * The long option warns about its cost, on the card, where it is still useful to
 * someone. Sixty to ninety-five scenes is a real generation; a teacher who
 * reaches for it without being told will assume it is a button and then wait.
 */
function LengthPicker({
  value,
  onChange,
}: {
  value: LessonLengthId;
  onChange: (next: LessonLengthId) => void;
}) {
  const t = useCopy(COPY);
  const lang = useLang();
  return (
    <div>
      <p className="label">{t.lengthLabel}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {LESSON_LENGTHS.map((preset) => {
          const active = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.id)}
              aria-pressed={active}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active
                  ? "border-brand-500 bg-brand-500/15"
                  : "border-ink-700 hover:border-ink-500 hover:bg-ink-800/60"
              }`}
            >
              <span
                className={`block text-sm font-semibold ${active ? "text-brand-100" : "text-mist-100"}`}
              >
                {lang === "vi" ? preset.label : preset.labelEn}
                <span className="ml-1.5 font-normal text-mist-400">{lang === "vi" ? preset.caption : preset.captionEn}</span>
              </span>
              <span className="mt-0.5 block text-xs text-mist-400">
                {preset.scenes[0]}–{preset.scenes[1]} {t.slideUnit} ·{" "}
                {preset.wordsPerScene[0]}–{preset.wordsPerScene[1]} {t.wordsPerSlide}
              </span>
              {preset.id === "long" ? (
                <span className="mt-1 block text-[11px] leading-snug text-amber-300/80">
                  {t.lengthLongNote}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StylePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (style: PresentationStyle) => void;
}) {
  const t = useCopy(COPY);
  const lang = useLang();
  return (
    <fieldset className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
      <legend className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">
        {t.styleLegend}
      </legend>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
        {PRESENTATION_STYLES.map((style) => {
          const selected = style.id === value;
          const preset = resolveSlideTheme(style.theme);
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style)}
              aria-pressed={selected}
              className={`rounded-lg border p-2 text-left transition-colors ${
                selected
                  ? "border-brand-500 bg-brand-500/12"
                  : "border-ink-700 hover:border-ink-600"
              }`}
            >
              <span className="flex items-center gap-2">
                {/* The style's own paper, at swatch size. */}
                <span
                  aria-hidden="true"
                  className="h-7 w-9 shrink-0 rounded"
                  style={{
                    background: preset.palette.bg,
                    border: `1px solid ${preset.palette.rule}`,
                  }}
                >
                  <span
                    className="mx-auto mt-1.5 block h-1 w-3/4"
                    style={{ background: preset.palette.ink }}
                  />
                  <span
                    className="mx-auto mt-1 block h-0.5 w-1/2"
                    style={{ background: preset.palette.accent }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-mist-100">
                    {style.label}
                  </span>
                </span>
              </span>
              <span className="mt-1.5 block text-[11px] leading-snug text-mist-400">
                {lang === "vi" ? style.hint : style.hintEn}
              </span>
              <span className="mt-1 block text-[10px] text-mist-500">
                {style.images ? t.styleWithImages : t.styleTextOnly} ·{" "}
                {style.theme === "midnight" ? t.paperDark : t.paperLight}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The paper picker: a collapsed row showing the current choice, and a grid of
 * every palette behind a toggle.
 *
 * Thirty-six options cannot sit in a `<select>` — a menu renders one flat line of
 * text per option, and a list of names is exactly the thing that does not let
 * anyone judge a colour. So the closed state shows the actual paper and the
 * accent, and the open state is a swatch grid grouped into three buckets, with a
 * live preview of the real slide above it.
 *
 * Each swatch is painted from the same palette the player will use, which is the
 * only reason this is a preview rather than a promise.
 */
function ThemePicker({
  value,
  onChange,
  open,
  setOpen,
}: {
  value: string;
  onChange: (id: string) => void;
  open: boolean;
  setOpen: (next: boolean) => void;
}) {
  const t = useCopy(COPY);
  const current = resolveSlideTheme(value);

  const groups: { id: SlideThemePreset["group"]; label: string }[] = [
    { id: "paper", label: t.groupLight },
    { id: "ink", label: t.groupDark },
    { id: "tint", label: t.groupTint },
  ];

  return (
    <fieldset className="mt-3">
      <legend className="label">{t.themeLegend}</legend>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900/60 px-3 py-2 text-left transition-colors hover:border-ink-600"
      >
        <span
          aria-hidden="true"
          className="h-9 w-14 shrink-0 overflow-hidden rounded-md border px-1.5 py-1"
          style={{ background: current.palette.bg, borderColor: current.palette.rule }}
        >
          {/* The same miniature words as the grid, so the collapsed control
              answers the same question the grid does. */}
          <span
            className="block truncate text-[7px] font-bold uppercase tracking-[0.1em]"
            style={{ color: current.palette.accent }}
          >
            {t.sampleKicker}
          </span>
          <span
            className="block truncate text-[9px] font-semibold leading-tight"
            style={{ color: current.palette.ink }}
          >
            {t.sampleTitle}
          </span>
          <span
            className="block truncate text-[7px] leading-tight"
            style={{ color: current.palette.inkSoft }}
          >
            {t.sampleSub}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-mist-100">
            {current.label}
          </span>
          <span className="block text-[11px] text-mist-500">
            {SLIDE_PRESETS.length} {t.presetUnit} ·{" "}
            {open ? t.themeExpanding : t.themeTap}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-mist-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="mt-2 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-ink-700 bg-ink-950/60 p-3">
          {groups.map((group) => {
            const presets = SLIDE_PRESETS.filter((preset) => preset.group === group.id);
            if (presets.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist-500">
                  {group.label}
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                  {presets.map((preset) => {
                    const selected = value === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onChange(preset.id);
                          setOpen(false);
                        }}
                        aria-pressed={selected}
                        title={preset.label}
                        className={`overflow-hidden rounded-lg border text-left transition-transform hover:scale-[1.03] ${
                          selected ? "ring-2 ring-brand-500" : ""
                        }`}
                        style={{ borderColor: preset.palette.rule, background: preset.palette.bg }}
                      >
                        {/* A miniature of the slide, drawn with real words.
                            Bars of colour told a user what the palette *was* but
                            not what it was *for* — and the two things they need
                            to check before picking a paper are whether the title
                            is readable on it and whether the subtitle stays
                            distinct from the body. Only text answers those, so
                            the swatch sets a title, a subtitle and a body line in
                            the palette's own inks. */}
                        <span className="block space-y-[3px] px-2 py-2">
                          <span
                            className="block truncate text-[9px] font-bold uppercase tracking-[0.12em]"
                            style={{ color: preset.palette.accent }}
                          >
                            {t.sampleGridKicker}
                          </span>
                          <span
                            className="block line-clamp-2 text-[11px] font-semibold leading-tight"
                            style={{ color: preset.palette.ink }}
                          >
                            {t.sampleGridTitle}
                          </span>
                          <span
                            className="block line-clamp-2 text-[9px] leading-tight"
                            style={{ color: preset.palette.inkSoft }}
                          >
                            {t.sampleSub}
                          </span>
                          <span
                            className="block h-px w-full"
                            style={{ background: preset.palette.rule }}
                          />
                          <span
                            className="block line-clamp-1 text-[9px]"
                            style={{ color: preset.palette.inkFaint }}
                          >
                            {t.sampleBody}
                          </span>
                        </span>
                        <span
                          className="block truncate px-2 py-1 text-[10px] font-medium"
                          style={{ background: preset.palette.bgSunk, color: preset.palette.inkSoft }}
                        >
                          {preset.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </fieldset>
  );
}

