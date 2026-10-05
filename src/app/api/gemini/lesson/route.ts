import { NextResponse, type NextRequest } from "next/server";
import { resolveProvider } from "@/lib/ai/config";
import { credentialGate } from "@/lib/ai/readiness";
import { AiError, generateJson } from "@/lib/ai/llm";
import { isQuotaExhausted } from "@/lib/ai/shared";
import { recordModelTrust } from "@/lib/ai/model-trust";
import { noteCompactModel, readCompactModel } from "@/lib/server/token-limit";
import { SCENE_ACCENTS, SCENE_KINDS, SLIDE_BLOCK_KINDS, SLIDE_LAYOUTS, POINTER_TARGETS, iconSetFor, newLessonId, type SlideTheme } from "@/lib/lesson/types";
import { DEFAULT_SLIDE_PATTERN, DEFAULT_SLIDE_THEME, isSlidePattern } from "@/lib/lesson/themes";
import { DEFAULT_SLIDE_MOTION, isSlideMotion } from "@/lib/lesson/motion";
import {
  resolveLessonLength,
  resolvePresentationStyle,
} from "@/lib/lesson/presentation-styles";
import { resolveLessonLanguage } from "@/lib/lesson/lesson-languages";
import { coerceLesson } from "@/lib/lesson/validate";
import {
  sceneNeedsExcerpt,
  sceneSolvesExercise,
  skimReference,
  sliceForScene,
} from "@/lib/lesson/reference-skim";
import { clientKey, rateLimit, rejectRemote } from "@/lib/server/guard";
import { deleteDraft, saveDraft } from "@/lib/server/course-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ------------------------------------------------------------------ *
 *  Two-stage generation, streamed over SSE.
 *
 *  A single blocking request took 30-180s while the UI just spun, which
 *  reads as "broken". OpenMAIC avoids this with `/api/stages` plus a
 *  generation preview; this mirrors that shape:
 *
 *    stage 1 "outline" — fast and cheap: only scene titles/kinds
 *    stage 2 "detail"  — per scene: bullets, narration, quiz, 3D config
 *
 *  Stage 1 lands in ~5s, so the teacher sees the outline almost immediately
 *  and then watches each scene fill in.
 * ------------------------------------------------------------------ */

export interface OutlineStep {
  id: string;
  title: string;
  kind: string;
  duration: number;
  state: "pending" | "active" | "done";
}

export interface StreamEvent {
  type: "stage" | "scene" | "done" | "error";
  stage?: string;
  message: string;
  progress?: number;
  scene?: unknown;
  /** Sent once, when stage 1 completes. */
  outline?: { title: string; scenes: OutlineStep[] } | null;
  lesson?: unknown;
  error?: string;
  /** True when the provider ran out of quota — waiting is the only fix. */
  quota?: boolean;
  /**
   * Which backend produced this step and how long the call took. `model` is the
   * model that actually answered (a backup, when the request rotated), not the
   * one that was asked for — that is what the run log shows per row.
   */
  provider?: string;
  model?: string;
  elapsedMs?: number;
  /**
   * The deck's stable id, sent on the very first event so the studio can
   * route to the classroom session immediately — the scenes stream there.
   */
  lessonId?: string;
  /**
   * Zero-based position of `scene` in the deck. Batches finish out of order
   * (each scene event is sent the moment its own call lands), so the client
   * orders the progressive script by this instead of arrival order.
   */
  sceneIndex?: number;
}

const quizSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    question: { type: "string" },
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          isCorrect: { type: "boolean" },
          explanation: { type: "string" },
        },
        required: ["id", "text", "isCorrect"],
      },
    },
  },
};

const simulation3dSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["physics-pendulum", "neural-network", "molecule", "solar-orbit"],
    },
  },
};

/** Stage 1 asks only for the shape of the lesson. */
const OUTLINE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    subject: { type: "string" },
    grade: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...SCENE_KINDS] },
          accent: { type: "string", enum: [...SCENE_ACCENTS] },
          title: { type: "string" },
          subtitle: { type: "string" },
          /**
           * What this single scene must make the student understand.
           *
           * Not shown on the slide — it is the teaching intent, and it is what
           * makes the next stage write a scene that advances the lesson instead
           * of restating the previous one. Without it the model has no way to
           * tell "the next slice of the same idea" from "the same idea again".
           */
          goal: { type: "string" },
          /** Index of the scene this one depends on, 0-based; -1 for the opener. */
          buildsOn: { type: "number" },
          duration: { type: "number" },
        },
        required: ["kind", "title", "goal", "duration"],
        propertyOrdering: [
          "kind",
          "accent",
          "title",
          "subtitle",
          "goal",
          "buildsOn",
          "duration",
        ],
      },
    },
  },
  required: ["title", "scenes"],
  propertyOrdering: ["title", "subject", "grade", "scenes"],
};

const dataSchema: Record<string, unknown> = {
  type: "array",
  items: {
    type: "object",
    properties: {
      label: { type: "string" },
      value: { type: "number" },
      unit: { type: "string" },
      note: { type: "string" },
    },
    required: ["label", "value"],
    propertyOrdering: ["label", "value", "unit", "note"],
  },
};

// `rows` is a flat array of "|"-joined strings, NOT an array of arrays.
// Gemini's responseSchema only accepts the OpenAPI subset, which has no nested
// arrays: an `array of array of string` is silently dropped, so the table field
// came back empty for every lesson. One string per row sidesteps the limit
// entirely and is what the parser splits back apart.
const tableSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    caption: { type: "string" },
    columns: { type: "array", items: { type: "string" } },
    rows: { type: "array", items: { type: "string" } },
  },
  required: ["columns", "rows"],
};

/** Stage 2 asks for one scene's body. Small schema keeps the answer fast. */
const graphSchema: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    xlabel: { type: "string" },
    ylabel: { type: "string" },
    xs: { type: "array", items: { type: "number" } },
    ys: { type: "array", items: { type: ["number", "null"] } },
    vlines: {
      type: "array",
      items: {
        type: "object",
        properties: { x: { type: "number" }, label: { type: "string" } },
        required: ["x"],
      },
    },
    hlines: {
      type: "array",
      items: {
        type: "object",
        properties: { y: { type: "number" }, label: { type: "string" } },
        required: ["y"],
      },
    },
  },
  required: ["xs", "ys"],
};

const pointerSchema: Record<string, unknown> = {
  type: "array",
  items: {
    type: "object",
    properties: {
      target: { type: "string", enum: [...POINTER_TARGETS] },
      label: { type: "string" },
    },
    required: ["target"],
  },
};

const SCENE_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
    graph: graphSchema,
    formula: { type: "string" },
    data: dataSchema,
    table: tableSchema,
    imageQuery: { type: "string" },
    imagePrompt: { type: "string" },
    icon: { type: "string" },
    layout: { type: "string", enum: [...SLIDE_LAYOUTS] },
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...SLIDE_BLOCK_KINDS] },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
          text: { type: "string" },
          label: { type: "string" },
          imagePrompt: { type: "string" },
          imageQuery: { type: "string" },
        },
        required: ["kind", "x", "y", "w", "h"],
      },
    },
    visualNote: { type: "string" },
    narration: { type: "string" },
    pointer: pointerSchema,
    duration: { type: "number" },
    quiz: quizSchema,
    simulation3d: simulation3dSchema,
  },
  required: ["title", "bullets", "narration"],
};

/**
 * The same schema with the picture fields taken out.
 *
 * Not a prompt instruction but a schema change, because that is the only version
 * of "don't fetch images" that actually holds. Telling the model to leave
 * `imagePrompt` empty still leaves the field in the response, and a model asked
 * for an illustration of a lesson about rainfall will helpfully supply one; the
 * slide then renders a generated picture on a lesson whose owner switched
 * illustrations off. Removing the properties makes an off switch a guarantee.
 */
function sceneSchema(withImages: boolean): Record<string, unknown> {
  if (withImages) {
    // Pictures on: the model writes an AI illustration prompt; the archive
    // keyword is left out so a slide never tries both sources at once.
    const { imageQuery: _archived, ...rest } = SCENE_SCHEMA.properties as Record<string, unknown>;
    return { ...SCENE_SCHEMA, properties: rest };
  }
  const { imageQuery: _omitted, imagePrompt: _omittedPrompt, ...rest } = SCENE_SCHEMA.properties as Record<string, unknown>;
  return { ...SCENE_SCHEMA, properties: rest };
}

/**
 * Slide quality, not just slide count.
 *
 * The model defaults to thin bullets with no figures, which is exactly what
 * makes a generated deck look generic. These instructions are deliberately
 * specific about the three things a teacher actually needs on screen: a
 * statement, a number, and a formula.
 */
const SLIDE_QUALITY_RULES = `YÊU CẦU CHẤT LƯỢNG SLIDE (bắt buộc):
1. Mỗi slide phải là một trang tài liệu trắng: tiêu đề + tối đa 4 gạch đầu dòng. Không viết dài dòng.
2. PHONG CÁCH CHỮ (quan trọng nhất — đây là slide lời giảng, không phải slide PowerPoint):
   Mỗi slide được dựng thành MỘT CÂU CHỮ LỚN trên nền trống, đọc như caption
   của lời giảng. Người xem đang nghe giọng đọc và nhìn slide, không đọc tài liệu.
   - "title" là CÂU KHẲNG ĐỊNH đắt giá nhất trong cả bài, viết ngắn và có nhịp.
     Đúng: "Lực hút làm vật tốc độ đổi". Sai: "Định luật II Newton" (chỉ là nhãn).
   - "title" dưới 60 ký tự, tối đa 8-10 từ, KHÔNG kết thúc bằng dấu chấm.
   - "bullets" là CĂN CỨ, mỗi câu có con số hoặc định nghĩa cụ thể để tin được.
     Tối đa 4 gạch, mỗi gạch dưới 90 ký tự. Viết như caption phụ, không như mục lục.
   - "subtitle" là CÂU CÓ THỊ GIÁC dưới tiêu đề (dưới 90 ký tự), bổ sung cái mà
     tiêu đề chưa nói. KHÔNG lặp lại tiêu đề.
   - TUYỆT ĐỐI cấm: tiêu đề toàn in hoa, dấu chấm than, emoji, ký tự trang trí,
     câu hỏi tu từ ("Bạn có biết...?"), và cụm từ sáo rỗng ("rất quan trọng",
     "có nhiều ứng dụng", "đơn giản").
   - Con số là hình ảnh mạnh nhất. Khi bài có số hay, đưa SỐ ĐÓ vào tiêu đề hoặc
     gạch đầu dòng thay vì chỉ nhắc chữ "nhiều" hay "lớn".
2. BẢNG chỉ dùng ĐÚNG MỘT LẦN trong cả bài, ở cảnh "example" dành riêng cho nó.
   Dùng "table" khi bài có BẢNG THỐNG KÊ
   thật: bảng nhân/chia, bảng hệ số, danh sách tỉnh thành, bảng so sánh, bảng ký hiệu.
   TUYỆT ĐỐI không lặp lại cùng một bảng ở nhiều cảnh — chỉ cần một nơi có nó là đủ.
   Cấu trúc: {"caption":"Bảng nhân 9","columns":["Phép tính","Kết quả"],
   "rows":["9 × 1|9","9 × 2|18","9 × 3|27"]}.
   "rows" là DANH SÁCH CHUỖI, mỗi dòng một chuỗi, các ô cách nhau bằng dấu "|" và
   phải có ĐÚNG số ô bằng số "columns". Tối đa 6 cột, 12 dòng. Ô là ký tự thuần,
   viết "9 × 1" chứ không dùng LaTeX hay object.
3. "data" dùng khi so sánh SỐ RIÊNG BIỆT (biểu đồ cột): 3-6 điểm số thật,
   mỗi điểm có "label" (tên ngắn), "value" (con số, KHÔNG để chuỗi), "unit" và "note".
   TUYỆT ĐỐI không bịa số. Nếu không chắc con số, bỏ trường "data" thay vì đoán.
   KHÔNG dùng "data" cho bảng lặp kiểu bảng nhân — dùng "table".
4. "formula": dùng LaTeX khi có công thức (vd "F = m \\cdot a", "\\frac{a}{b}", "x^2 + y^2 = z^2").
   Bỏ $ và \\( \\) bao ngoài. Công thức phải đúng, không sai ký hiệu.
5. "imagePrompt": mô tả để AI VẼ ảnh minh hoạ cho slide, viết bằng TIẾNG ANH,
   một câu đầy đủ (đối tượng + bối cảnh + phong cách), thêm "no text" để ảnh
   không dính chữ sai. Vd: "cartoon apple falling from a tree onto grass, no text".
   CHỈ điền khi hình vẽ được: vật lý, hoá học, sinh học, địa lí, kinh tế, lịch sử.
   TUYỆT ĐỐI BỎ TRƯỜNG này với: lập trình (for/while/function/class), toán giải tích,
   thuật toán, kế toán — ép vẽ hình cho các môn đó chỉ ra ảnh trang trí vô nghĩa.
   Không dùng tên riêng, biểu tượng, logo hay người nổi tiếng.
6. "visualNote": mô tả ngắn hình thức minh hoạ đúng cho slide (vd "Sơ đồ dòng chảy: nguyên liệu → sản phẩm → thị trường").
   Đây là chỉ dẫn cho người dựng slide, không phải văn bản hiển thị.
7. "bullets": cụ thể có số hoặc định nghĩa; cấm câu sáo rỗng như "rất quan trọng", "có nhiều ứng dụng".
7b. TIÊU ĐỀ VÀ GẠCH ĐẦU DÒNG PHẢI ĐỌC NHƯ NGƯỜI VIẾT, KHÔNG NHƯ MÁY.
   Slide bị "slop" thường hỏng ở đúng chỗ này, vì đây là chỗ người xem nhìn lâu
   nhất trên màn hình. Áp dụng prompt/skills/humanizer.md. Cấm cụ thể:
   - Tiêu đề dạng "Vì sao X quan trọng?", "Bí mật của X", "X thay đổi mọi thứ".
     Đó là tiêu đề quảng cáo, không phải tiêu đề dạy.
   - Mở đầu bằng "Trong thế giới hiện đại...", "Ngày nay...".
   - Câu kết bằng "Đó chính là điều quan trọng nhất!", "Hãy nhớ điều này!".
   - Cụm ba phần tử ở mọi gạch đầu dòng ("nhanh, bền và rẻ").
   - Dấu "—" giữa câu, dấu chấm than, emoji, CHỮ IN HOA.
   - Gạch đầu dòng chỉ lại tiêu đề bằng cách diễn đạt khác. Nếu tiêu đề nói
     "Định luật II Newton" thì gạch đầu dòng phải nói về vật gì, chứ không phải
     lại "Định luật II Newton rất quan trọng".
   Câu nào bỏ đi mà slide không mất ý nghĩa thì bỏ. Slide đầy chữ là slide không
   ai đọc hết.
8. "narration": 3-4 câu đọc tự nhiên như lời thầy giảng, KHÔNG đọc công thức bằng
   ký hiệu LaTeX, KHÔNG markdown. Viết dài theo "duration" của cảnh.
9. "table" và "data" không dùng cho cùng một nội dung: bảng lặp (bảng nhân, bảng
   hệ số) thì "table"; so sánh số rời rạc giữa các mục thì "data".
10. BẮT BUỘC CÓ HÌNH VÀ SỐ (đây là slide thuyết trình, không phải giáo trình):
   Một bài chỉ toàn chữ là bài dở. Cả bài phải có:
   - ÍT NHẤT 2 cảnh có "imagePrompt" (môn vẽ được hình) HOẶC "visualNote" sơ đồ rõ ràng.
   - ÍT NHẤT 2 cảnh có "data" (số thật) HOẶC "table".
   Rải đều ra, không dồn hết vào cảnh cuối. Cảnh mở đầu thì để chữ, cảnh ví dụ và
   so sánh thì để số, cảnh giải thích hiện tượng thì để hình.
   Nếu bài vốn không có số liệu cụ thể, hãy đưa vào các con số ĐỊNH LƯỢNG có thật
   trong môn học (hằng số vật lý, tỉ lệ, số liệu thống kê quen thuộc) — trừ khi
   không chắc thì bỏ trường, TUYỆT ĐỐI không bịa.`;

/**
 * Slide design rules — the layout half of "write a good slide".
 *
 * The quality rules above say what a slide must *contain*; these say how it has
 * to sit on the paper, and they are the part a text-only model cannot infer.
 * They are the rules a designer applies by hand — how much text fits a line,
 * how far apart two blocks sit, which arrangement suits which kind of slide —
 * written out as numbers because "make it look good" is not an instruction a
 * model can follow and "keep each bullet under twenty words" is.
 *
 * Every slide is laid out at 16:9, and 1% of the slide's width is the unit the
 * renderer measures type in, so the sizes below are percentages of the slide
 * width: a title is about 5%, a bullet about 1.4%.
 */
const SLIDE_DESIGN_RULES = `QUY TẮC BỐ CỤC SLIDE (bắt buộc — đây là phần quyết định slide có đẹp không):
0. NGUYÊN TẮC: slide là TRO GIÚP HÌNH ẢNH, KHÔNG phải bản ghi bài giảng. Người xem
   đang NGHE giọng đọc và nhìn slide, không đọc tài liệu. Mọi câu chỉ có nghĩa khi
   đọc lên thì BỎ khỏi slide — lời giảng đã nói rồi.
   - Mỗi gạch đầu dòng dưới 14 TỪ. Gạch nào cắt bằng dấu "…" để dài hơn thì nó
     đã dài quá.
   - Mỗi slide CHỈ nói một điều. Hai ý trên một slide là hai slide.
 0b. GIỌNG VĂN ẤM ÁP, THÂN THIỆN — slide phải như một người kể chuyện đứng cạnh bên:
     - Viết như đang nói với học sinh, không như đang ghi đề mục. Dùng từ nối ("vì sao?",
       "thử nghĩ xem", "chuyện nhỏ thế này…") thay cho danh từ khô khan.
     - Ví dụ cụ thể và gần gũi, đừng để khái niệm trừu tượng đứng một mình. Một ví dụ đời
       thường đáng giá hơn ba định nghĩa.
     - Khi nói đến con số hay định luật, luôn kèm một câu "nghĩa là …" để người xem biết nó
       liên quan gì tới mình.
     - Tránh giọng lạnh; tránh tiếng Anh khi tiếng Việt nói được (trừ thuật ngữ chuyên ngành
       không có từ Việt).
1. LỀ TRANG: mọi khối nằm trong 86% chiều rộng, cách mép trên 3%, cách mép dưới
   chừa dải phụ đề. Không có khối nào chạm mép.
2. CHỮ KHÔNG ĐƯỢC TRÀN DÒNG: một dòng chữ vừa khít cột, nghĩa là
   "số ký tự trên một dòng = (chiều rộng cột - 20) / cỡ chữ". Với cỡ chữ gạch
   đầu dòng, mỗi dòng chỉ chứa được khoảng 60-70 ký tự — vượt ngưỡng đó dòng sẽ
   xuống hàng và chiếm chỗ của gạch bên dưới.
3. CÂN GIỮA THEO TRỤC GIỮA: khối tiêu đề và khối nội dung phải cùng nằm trên một
   trục giữa, lệch nhau dưới 2% chiều cao là coi như bằng nhau.
4. HAI CỘT PHẢI CÂN NHAU: khi dùng hai cột, hai cột phải rộng BẰNG NHAU tuyệt đối,
   khe hở giữa hai cột bằng khe hở hai bên. Cột tự co giãn theo nội dung là
   cột bị lệch, và lệch một chút cũng thấy.
5. THỐNG KÊ VÀ SO SÁNH thì dùng "cards": mỗi gạch thành một thẻ có nền nhạt, bo
   góc, các thẻ bằng nhau. KHÔNG dùng cards cho câu văn dài — thẻ dành cho ý ngắn.
6. THANG CỠ CHỮ (giữ đúng, mỗi bậc cách nhau 2-4%):
   tiêu đề 5.2% · phụ đề 1.7% · gạch đầu dòng 1.4% · chú thích nhỏ 1.05%.
   Cỡ chữ là tỉ lệ của bề rộng slide, KHÔNG phải số pixel cố định.
7. THANG KHOẢNG CÁCH: tiêu đề → phụ đề 0.8%; phụ đề → gạch 1.2%; hai gạch liền nhau
   1%; chữ ↔ hình 1.4%; khe giữa hai cột 5%. Khoảng cách bằng nhau giữa các
   khối cùng cấp — lệch một chút cũng thấy.
8. CHỌN "layout" ĐÚNG NGHĨA CỦA CẢNH, đừng để mặc định:
   - "cover": cảnh mở đầu / kết bài. Một câu khẳng định, căn giữa, tối đa 1 gạch.
   - "spotlight": MỘT ý quan trọng nhất của cảnh, slide gần như trống, tiêu đề cỡ
     rất lớn, tối đa 1 gạch đỡ. Dùng cho "ý cốt lõi", "điều dễ sai", "kết luận".
   - "quote": một câu nói hay định luật/định nghĩa đáng nhớ, căn giữa, câu đó là
     tiêu đề, phụ đề là nguồn hoặc tác giả. Ít nhất 1 trong 8-10 cảnh nên có một
     slide kiểu này cho khí.
   - "flow": các ý là THỨ TỰ (bước 1-2-3, giai đoạn, quy trình) — cảnh có
     "steps", hoặc 3-4 gạch nối tiếp nhau. Các bước thành các thẻ nối nhau.
   - "compare": hai ý đối lập hoặc so sánh (đúng/sai, trước/sau, A với B) — 4 gạch
     trở lên, chia hai bên, có đường phân cách giữa hai bên.
   - "statement": một khẳng định + tối đa 2 gạch, một cột, chữ lệch trái.
   - "two-col": 3-4 gạch ngắn, hai cột bằng nhau.
   - "cards": 5 gạch trở lên, hoặc các ý là "thứ tự" (bước 1, bước 2, bước 3).
   - "image-left" / "image-right": cảnh CÓ "imagePrompt" và 2-4 gạch; ảnh bên
     cạnh chữ, chọn bên theo hướng nhìn của nội dung (ví dụ quy trình đọc từ
     trái sang phải thì đặt ảnh bên trái).
   - "full-figure": cảnh có bảng, biểu đồ, công thức hoặc đồ thị — hình chiếm
     phần lớn diện tích, chữ thu gọn lại.
   Bài đẹp là bài CÓ LẬT layout, không phải bài 12 slide cùng một khuôn.
    - Trong một bài, hãy phân bố: 1 "cover", vài "spotlight"/"quote" cho ý cốt lõi,
      1-2 "flow" cho quy trình, phần còn lại "statement"/"two-col"/"cards"/
      "image-right" tuỳ nội dung. Đừng để 3 slide liền nhau cùng một layout.
9. "blocks" — TỰ DO ĐẶT KHỐI, dùng khi layout không vừa:
    Đây là lưới 1000 x 562.5 (rộng 1000, cao 562.5). Mỗi khối có "kind", "x", "y"
    (góc trên-trái), "w", "h" (kích thước) — tất cả tính trên lưới đó, KHÔNG phải
    pixel. Khối có thể là: "title", "subtitle", "text", "card", "formula", "image",
     "shape" (một khung nền bo góc, KHÔNG có chữ) hoặc "rule" (một đường kẻ ngang,
     KHÔNG có chữ).
     - Dùng "shape" khi muốn có một tấm thẻ nền để tiêu đề hoặc một đoạn ngắn nằm
       lên; dùng "rule" khi muốn một đường kẻ ngăn hai phần với nhau. Chúng là
       hình học thuần, không mang chữ — nhờ vậy một ô chữ có thể nằm lên chúng.
    - CHỈ dùng "blocks" cho tối đa 1/3 số cảnh, và chỉ khi bố cục thật sự khác
      (ví dụ: ảnh lớn ở nửa trên, ba thẻ xếp dọc bên dưới; hoặc hai khối lệch
      nhau về hai phía). Cảnh nào không chắc thì BỎ "blocks", để "layout" lo.
    - "image" phải có "imagePrompt" (tiếng Anh, không chữ) hoặc "imageQuery".
    - Chữ trong khối dưới 20 từ; số ký tự trên một dòng ≈ (w - 20) / (cỡ chữ ×
      10) để không tràn dòng.
    - Lề an toàn: mọi khối nằm trong x từ 50 đến 950, y từ 30 đến 500 (dải dưới
      500-562 là chỗ phụ đề đè lên, đừng đặt chữ vào đó).
    - Hai khối không được chồng lấn; khe hở giữa hai khối tối thiểu 20.
    - Muốn nói chuyện với người xem bằng cách sắp xếp, hãy sắp xếp: một khối
      "text" ngắn giữa slide trống đọc mạnh hơn một câu dài kèm tiêu đề.
10. BẢNG TRA CHIỀU CAO CHỮ (dùng để không chữ nào bị tràn khung):
    Khi bạn đặt khối chữ bằng "blocks", chiều cao phải tra bảng này theo CỠ CHỮ LỚN NHẤT
    trong khối, KHÔNG tự ước lượng. Giá trị là chiều cao (px) cho 1 / 2 / 3 / 4 / 5 dòng:
    14px: 43/64/85/106/127 | 16px: 46/70/94/118/142 | 18px: 49/76/103/130/157
    20px: 52/82/112/142/172 | 24px: 58/94/130/166/202 | 28px: 64/106/148/190/232
    32px: 70/118/166/214/262 | 36px: 76/130/184/238/292.
    Cách tính số dòng: characters_per_line = (chiều rộng khối - 20) / cỡ chữ; số dòng của
    một đoạn = ceil(số ký tự / characters_per_line); tổng số dòng của khối = tổng các
    đoạn + 0.8 (làm tròn lên).
11. CHECKLIST P0 — BẮT BUỘC TRƯỚC KHI TRẢ LỜI (tự kiểm, không được sai mục nào):
    [chiều cao] mọi khối chữ đã lấy chiều cao từ bảng tra cứu ở mục 10;
    [chiều rộng] mọi khối chữ thỏa char_count <= (chiều rộng - 20) / cỡ chữ;
    [căn giữa] khối nào căn giữa thì tâm lệch nhau dưới 2px;
    [lề] mọi khối nằm trong lề 50px mỗi cạnh (x 50-950, y 30-500);
    [không tràn] không khối nào chồng lấn khối khác, và không khối nào chạm mép.`;

const OUTLINE_SYSTEM = `Bạn là giáo viên KINH NGHIỆM lâu năm, tự thiết kế bài giảng cho học sinh phổ thông Việt Nam.
Trả về DUY NHẤT một JSON đúng schema, không kèm giải thích, không markdown.

# Profile
- Phong cách: rõ ràng, kiên nhẫn, luôn đi từ cái quen thuộc sang cái lạ.
- Đối tượng: học sinh phổ thông, có thể chưa biết gì về chủ đề này.
- Bạn biết học sinh thường vướng ở đâu, nên đừng bỏ qua chỗ dễ vướng.

# Mục tiêu
Bài giảng phải DÀNH HƠN hẳn một bản tóm tắt thông thường — dài hơn khoảng 3-5 lần.
Lý do: bài này thay cho giáo viên đứng giảng, người học xem một mình nên không có ai
giơ tay hỏi. Mỗi bước nhảy trong kiến thức đều phải có một cảnh đón trước, nếu
không người học sẽ rơi ngay ở chỗ đó.

# Nguyên tắc dạy (bắt buộc tuân thủ)
1. XÂY NHỎ TỪNG PHẦN. Một khái niệm lớn phải được chia thành các mảnh nhỏ đủ
   để giảng riêng: "định nghĩa" → "vì sao cần" → "công thức từ đâu ra" → "áp dụng"
   → "bài tập". Đừng dồn cả định nghĩa lẫn ứng dụng vào một cảnh.
2. MỖI CẢNH CHỈ MỘT Ý. Một cảnh trả lời đúng một câu hỏi của học sinh. Nếu phải
   dùng từ "và" để nối hai ý, đó là hai cảnh.
3. NỐI TIẾP, KHÔNG LẶP. Dùng "buildsOn" để chỉ cảnh đang dựa vào. TUYỆT ĐỐI
   không viết lại định nghĩa đã nói ở cảnh trước.
4. CÓ LÝ DO. Trước khi đưa công thức hay quy tắc, phải có ít nhất một cảnh nói
   vì sao người ta cần nó. Công thức không rơi từ trên trời xuống.
5. VÍ DỤ SÁT CHỦ ĐỀ. Ví dụ phải dùng ngữ cảnh Việt Nam (tiền, km, kg, lớp, ...)
   chứ không phải ví dụ chung chung.
6. CÓ ĐỐI CHIẾU NGƯỢC. Sau ví dụ cần ít nhất 1 cảnh "khi nào KHÔNG dùng được"
   hoặc "cạm bẫy thường gặp" — đây là chỗ học sinh hay sai nhất ngoài đời.
7. CÓ BÀI TẬP TỰ KIỂM TRA trước khi kết luận.

# Cấu trúc dàn ý (bắt buộc theo thứ tự)
- Cảnh 1 (kind="cover"): câu hỏi tò mò + học xong sẽ làm được gì.
- Phần "nền": định nghĩa và bối cảnh, chia 2-3 cảnh nhỏ nếu bài rộng.
- Phần "vì sao": ít nhất 1 cảnh giải thích vấn đề thực tế dẫn tới khái niệm.
- Phần "cách làm": công thức/quy tắc, tách từng thành phần nếu công thức dài.
- Phần "áp dụng": 2-3 cảnh ví dụ, mỗi ví dụ một cảnh.
- Nếu bài có hàm số cần nhìn (phân thức, parabol, lượng giác, mũ/logarit):
  thêm 1 cảnh mà "goal" ghi rõ "vẽ và đọc đồ thị ...", để bước sau điền
  trường "graph" (điểm mẫu + tiệm cận) thay vì kể bằng chữ.
- Phần "cạm bẫy": 1-2 cảnh sai thường gặp.
- Phần "luyện": đúng 1 cảnh "quiz".
- Cảnh cuối (kind="summary"): tóm tắt + gợi ý bài tiếp theo.
- Nếu chủ đề có hình học/vật lý/sinh học thì thêm 1 cảnh "simulation3d".
- Cân bằng loại cảnh, đừng dồn toàn bộ "concept".

# Quy tắc trường dữ liệu
- "title": là MỆNH ĐỀ khẳng định, không phải nhãn chủ đề.
  Đúng: "Lực hút làm vật tốc độ đổi". Sai: "Định luật II".
- "goal": viết bằng thứ học sinh dùng, bắt đầu bằng "Học sinh hiểu được...".
  Đây là chỉ dẫn cho bước sau, KHÔNG hiển thị lên slide.
- "subtitle": dưới 90 ký tự, bổ sung ngữ cảnh cụ thể cho tiêu đề.
- "title" dưới 60 ký tự.
- "duration": 6-25 giây mỗi cảnh, TỔNG đúng bằng thời lượng yêu cầu.
- Cảnh "example" bắt buộc có nếu bài có BẢNG THỐNG KÊ (bảng nhân/chia, bảng hệ số,
  bảng so sánh, danh sách) — dành riêng một cảnh cho bảng đó.
- Khi có khối TÀI LIỆU THAM KHẢO: dàn ý đi theo đúng thứ tự mục trong tài liệu
  (dùng mốc "> Trang N/T" để chia), và dành cảnh "example" riêng cho từng bài
  tập có số thứ tự trong tài liệu.

${SLIDE_QUALITY_RULES}`;

/**
 * Extra slide rules layered on when the teacher asks for illustrations.
 *
 * The base rules ask for "at least 2 scenes" and explicitly tell the model to
 * skip `imagePrompt` for programming and pure mathematics. That restraint is
 * right by default — most generated lessons came out with a picture that was a
 * photo of a python instead of a diagram of a loop — but it means a teacher who
 * *does* want pictures gets a deck that is mostly text with the odd irrelevant
 * photo. The bar rises for generated pictures instead: the exclusions
 * are replaced with "describe a diagram of the thing itself", and the prompt has
 * to be concrete enough that a picture generator can draw it.
 */
const IMAGE_MODE_RULES = `
# CHẾ ĐỘ CÓ ẢNH MINH HOẠ (bắt buộc)
Slide này được dựng thành bài giảng, nên hình ảnh là phần quan trọng nhất bên cạnh chữ.
Ảnh do AI vẽ trực tiếp từ mô tả của cảnh (pollinations.ai, không cần key), KHÔNG
phải ảnh tìm trên mạng — nên mô tả càng cụ thể, ảnh càng đúng ý.
- "imagePrompt" là BẮT BUỘC với mọi cảnh trừ: cảnh "cover" (mở đầu), cảnh "quiz",
  và cảnh "summary" (tóm tắt). Tức là HẦU NHƯ MỌI cảnh đều phải có.
- Viết bằng TIẾNG ANH, một câu mô tả đầy đủ: đối tượng + hành động/bối cảnh +
  phong cách vẽ. Thêm "no text, no words, no letters" để ảnh không dính chữ sai.
  Đúng: "watercolor cross-section diagram of a human heart pumping blood, no text",
        "cartoon delivery truck pushing a heavy crate uphill, flat style, no text",
        "solar system planets orbiting the sun, educational poster style, no text".
  Sai: "sinh học lớp 10", "bài 5", "human heart" (quá chung, ảnh ra tuỳ hứng).
- Với môn KHÔNG có hình thật (lập trình, toán giải tích, thuật toán), mô tả SƠ ĐỒ
  của khái niệm: "flowchart diagram of a for loop with arrows, minimal flat
  style, no text". Sơ đồ AI vẽ còn đúng ý hơn ảnh chụp không liên quan.
- Cấm tuyệt đối: tên riêng, logo, người nổi tiếng, và mọi từ có dấu tiếng Việt.
- Nếu một cảnh thật sự không minh hoạ được, bù lại bằng "visualNote" mô tả rõ sơ
  đồ cần vẽ, đừng bịa một mô tả cho có. Ảnh sai còn tệ hơn không có ảnh.`;

/** With illustrations off, the model is told to spend the effort elsewhere. */
const NO_IMAGE_MODE_RULES = `
# CHẾ ĐỘ KHÔNG ẢNH
Cảnh này dựng thành SLIDE CHỮ, không dùng ảnh. Tập trung vào "formula", "data",
"table" và câu chữ để slide đủ thông tin. Tuyệt đối không điền "imagePrompt".`;

/**
 * The icon instruction, or its absence.
 *
 * The list is handed over rather than described, because a model asked to "pick a
 * relevant icon" without a menu reaches for whatever it last saw, and the
 * validator then throws the name away. Given the exact names it either picks one
 * of them or leaves the field empty, and both outcomes are fine.
 */
function iconRules(names: readonly string[]): string {
  if (names.length === 0) return "";
  return `
# ICON SLIDE (bắt buộc khi có)
Trên mỗi slide có một biểu tượng nhỏ đứng trước nhãn loại cảnh. Điền "icon" bằng
ĐÚNG MỘT tên trong danh sách sau, viết đúng chữ hoa như đã cho, không thêm gì khác:
${names.join(", ")}
- Chọn icon nói đúng nội dung cảnh, không chọn icon "đẹp". Cảnh về tim máu thì
  "HeartPulse"; cảnh về biểu đồ cột thì "BarChart3".
- Cùng một icon được dùng lại ở nhiều cảnh là bình thường. Đừng cố làm mỗi cảnh
  một icon khác nhau.
- Không chắc icon nào khớp thì BỎ TRƯỜNG nàY. Thiếu icon còn hơn icon sai.`;
}

/** The system prompt for one scene, with the picture mode folded in. */
const SCENE_SYSTEM = `Bạn là giáo viên đang giảng cho LỚP THẬT, đang viết nội dung cho MỘT slide
trong bài giảng mà bạn tự thiết kế. Trả về DUY NHẤT JSON đúng schema.

# Cách viết một slide
Hãy bắt đầu bằng câu hỏi: "Học sinh đang thắc mắc gì ở đây?" — rồi trả lời đúng câu
hỏi đó. Đây là cách giảng thật, và nó giữ slide khỏi thành danh sách sáo rỗng.
Slide phải đứng được một mình: đọc slide này mà không có slide trước thì vẫn hiểu.

- "title": câu khẳng định có nghĩa, không phải chủ đề chung chung
  (vd "Lực hút làm vật tốc đổi" thay vì "Trọng lực").
- "subtitle": dưới 90 ký tự, bổ sung ngữ cảnh cụ thể.
- "bullets": 2-4 gạch đầu dòng ngắn, cụ thể, KHÔNG sáo rỗng. Mỗi gạch đầu dòng
  phải mang thêm thông tin so với tiêu đề, không lặp lại tiêu đề.
- "narration": 3-4 câu văn nói tự nhiên để đọc bằng giọng Việt — đây là lời thầy
  nói thật, nên viết như đang giảng: dẫn dắt, giải thích, ví dụ, hỏi lại học sinh.
  Không markdown, không LaTeX, không đọc ký hiệu. TUYỆT ĐỐI không lặp lại cụm từ.
  Nếu "duration" của cảnh dài hơn 12 giây, viết dài hơn — đừng viết ngắn cho xong.
- Nếu loại cảnh là "quiz": BẮT BUỘC trả "quiz" gồm câu hỏi + đúng 4 phương án,
  mỗi phương án có isCorrect và explanation. Câu hỏi phải kiểm tra đúng phần vừa
  dạy, không hỏi lại thứ đã nói ở đầu bài.
- Nếu loại cảnh là "simulation3d": BẮT BUỘC trả "simulation3d" với "type" hợp lệ.

# Cách dùng hình thức trình bày
Chọn đúng MỘT hình thức đúng nhất cho ý này, đừng nhồi tất cả:
- Có số liệu so sánh nhiều mục → "data" (biểu đồ cột).
- Có bảng thống kê thật → "table".
- Có công thức cần học thuộc → "formula".
- Cần minh hoạ bằng hình vẽ → "imagePrompt" (xem quy tắc bên dưới).
- Không có gì để hình ưu → cứ để trống, đừng bịa.

# Giọng điệu khi viết narration
- Xưng "chúng ta" khi cùng khám phá, "bạn" khi hướng dẫn trực tiếp.
- Giải thích VÌ SAO, không chỉ CÁI GÌ.
- Nhắc lại mối nối với slide trước khi đi tiếp ("Vừa rồi ta thấy..., giờ ta...").
- Nói cụ thể ứng dụng đó là gì, đừng nói "rất quan trọng" hay "có nhiều ứng dụng".
- VIẾT NHƯ NGƯỜI, KHÔNG VIẾT NHƯ MÁY. Trường "narration" được đọc TO lên bằng giọng
  nói tổng hợp, nên mọi dấu hiệu văn máy đều bị nghe rõ hơn nhiều so với khi đọc
  mắt. Áp dụng prompt/skills/humanizer.md cho đoạn này. Cụ thể, cấm:
  1. "Không chỉ là X mà còn là Y", "không phải X mà là Y" — cấu trúc so sánh này
     khi đọc to nghe như đang quảng cáo.
  2. Câu chốt một dòng để nhấn: "Đó chính là lý do…", "Và đó là điều quan trọng nhất."
  3. Dấu "—" xen vào giữa câu. Giọng đọc dừng ở đó, nghe như vấp.
  4. Cụm ba phần tử ("A, B và C") ở mọi câu.
  5. "chúng ta" lặp lại ở từng câu — chỉ cần một lần là đủ.
  6. Văn hô hào: "rất quan trọng", "thật đáng kinh ngạc", "một điều tuyệt vời".
  7. Dấu chấm than, emoji, CHỮ IN HOA toàn bộ.
  8. Dịch chữ từng chữ. Toán học tiếng Việt đã có từ riêng: "hình chữ nhật",
     "diện tích", "phân hoạch", "giới hạn", "hội tụ". Đừng dựng "phần răng cưa",
     "mẩu rời rạc", "cực mịn" nếu không phải thuật ngữ giáo trình dùng.
  9. Chuyện ngoài bài. Không kể nguồn gốc tên ký hiệu, lịch sử môn học hay chuyện
     lý thuyết khác nếu TÀI LIỆU THAM KHẢO không nói. Bài học chỉ nói đúng những
     gì tài liệu đã chứng minh.
- Được phép viết ngắn, khúc, hoặc hỏi lại học sinh. Lời thật không đều đặn.

${SLIDE_QUALITY_RULES}`;

/**
 * How to read the attached course material, learned from real HCMUS uploads.
 *
 * The reference arrives as markdown (prompt/skills/markitdown.md): `#` file
 * heads, `> Trang N/T` page markers, `##` sections, real `|` tables. Three
 * shapes kept breaking lessons until they were named here:
 */
const REFERENCE_RULES = `
# ĐỌC TÀI LIỆU THAM KHẢO (khi có khối TÀI LIỆU THAM KHẢO)
Tài liệu đã được chuyển sang markdown: "# tên tệp" mở đầu mỗi tệp,
"> Trang N/Tổng" đánh dấu trang, "##" là mục, bảng là bảng markdown thật.
- Dùng mốc trang để rải dàn ý theo đúng thứ tự tài liệu, không dồn cả chương
  vào một cảnh.
- CÔNG THỨC BỊ TUYẾN TÍNH HÓA: PDF toán thường ghi công thức thành một dòng
  chữ (vd "R2 = x = x1; x2 |..."). KHÔNG copy nguyên chuỗi đó lên slide.
  Trình bày lại vào "formula" bằng LaTeX đúng ký hiệu, định nghĩa từng ký hiệu
  ở "bullets", đọc xuôi bằng lời ở "narration".
- BÀI TẬP: tài liệu ôn tập ghi bài theo số thứ tự ("8. f(x;y)=...", "Bài tập",
  "Ví dụ", "Tính"). Cảnh "example" giữ ĐỀ BÀI NGUYÊN VĂN ở "subtitle", viết
  lời giải từng bước vào "steps", đọc xuôi từng bước ở "narration". Một cảnh
  đúng một bài, không gộp.
- CHỮ VỠ FONT: slide cũ (TCVN3/VNI) cho ra chữ vỡ ("KINH TEÁ", "HOÏC"). Chỗ nào
  chữ vỡ thì dùng kiến thức môn học để viết lại cho đúng tiếng Việt, TUYỆT ĐỐI
  không trích nguyên văn chuỗi vỡ lên slide hay lời đọc.`;

/**
 * Step-by-step solutions, the shape students compare against ChatGPT/Claude.
 *
 * The old contract spoke the working ("giải từng bước trong narration") and
 * showed only the result, so a solution lived in audio the student cannot
 * re-read. `steps` puts the working on the board: numbered lines under the
 * bullets, one per step, while the narration speaks each step in words and
 * the pointer holds on the step being read.
 */
const SOLUTION_RULES = `
# BÀI GIẢI TỪNG BƯỚC (cảnh "example" nào giải bài tập cũng phải có "steps")
- "steps" là lời giải viết lên bảng, mỗi phần tử MỘT bước, đúng thứ tự: bước
  đầu ghi giả thiết/cái đã cho, bước giữa biến đổi và thay số, bước cuối là
  đáp số. Tối đa 6 bước, mỗi bước dưới 140 ký tự, tiếng Việt, không markdown.
- Mỗi bước phải có số hoặc kết quả trung gian cụ thể. Cấm bước sáo rỗng
  ("thay số vào", "tính ra kết quả" mà không có số).
- "bullets" giữ ý tưởng và điều kiện áp dụng (dùng công thức nào, vì sao được
  dùng), KHÔNG chép lại lời giải. "narration" đọc xuôi từng bước bằng lời;
  câu nào đọc bước nào thì "pointer" của câu đó trỏ "step-N" của bước đó.
- "narration" cảnh example được phép 5–7 câu để đọc hết từng bước (quy tắc
  3–4 câu chung không áp dụng ở đây); mỗi câu đọc đúng một bước.`;

/**
 * Sampled function graphs, for the scenes where y varies with x.
 *
 * The model cannot be trusted with a parseable expression string, but it can
 * sample values — so the contract is points, not formulas. Rational functions
 * are the reason `null` exists: y = 1/(x-1) sampled across x = 1 must break
 * the curve there, and the vertical asymptote is named explicitly so the
 * student sees WHY the curve breaks.
 */
const GRAPH_RULES = `
# ĐỒ THỊ HÀM SỐ (trường "graph" — dùng khi cảnh nói về sự biến thiên, tiệm cận)
- Khi cảnh giảng đồ thị hàm số (hàm phân thức, parabol, tiệm cận), điền
  "graph" thay vì "data": "xs" là 49–99 điểm mẫu phủ miền đang xét, "ys" là
  giá trị y tương ứng, "vlines"/"hlines" ghi tiệm cận đứng/ngang kèm nhãn
  ("tiệm cận đứng x = 1").
- Điểm hàm không xác định thì "ys" ghi null để đồ thị ĐỨT NÉT ở đó, tuyệt đối
  không nối liền qua tiệm cận. Trục nào cũng phải có ít nhất 8 điểm.
- "title" ghi tên hàm ("Đồ thị y = 1/(x − 1)"), "xlabel"/"ylabel" ghi tên trục.
- "bullets" đọc đặc điểm đồ thị (tiệm cận, giao điểm, chiều biến thiên),
  "narration" dẫn mắt học sinh đi dọc đường cong theo thứ tự x tăng dần.`;

/**
 * The pointer script: one anchor per narration sentence, in order.
 *
 * The player moves the pointer the way the karaoke caption moves sentences —
 * by index into the narration — so the model must emit one cue per sentence
 * and nothing else. The closed target list is what keeps a cue renderable:
 * anything off-list is dropped at validation. At playback the sentence's own
 * words pick the part first (so reading the formula points at the formula
 * even when a cue is missing) and the cue is the fallback — which is why a
 * short cue list no longer strands the pointer on the title.
 */
const POINTER_RULES = `
# CON TRỎ GIẢNG (bắt buộc — trường "pointer")
Mỗi câu trong "narration" cần một điểm con trỏ, theo đúng thứ tự câu.
- "pointer" là mảng, mỗi phần tử {"target": ..., "label": ...}, số phần tử
  BẰNG số câu trong "narration". Câu 1 giảng phần nào thì cue 1 trỏ phần đó.
- "target" chỉ lấy trong danh sách: ${POINTER_TARGETS.join(", ")}.
  "bullet-N" là gạch đầu dòng thứ N (0 là gạch đầu), "step-N" là bước giải
  thứ N của "steps" (cảnh example), "graph" là đồ thị hàm số,
  "chart" là biểu đồ "data",
  "table" là bảng, "formula" là công thức, "image" là ảnh minh hoạ, "quiz" là
  khối câu hỏi.
- Chỉ trỏ thứ đang giảng. Câu mở đầu trỏ "title", câu đọc số liệu trỏ "chart"
  hoặc "table", câu đọc đồ thị trỏ "graph", câu đọc công thức trỏ "formula", câu đọc bước giải trỏ
  "step-N" của bước đó, câu hỏi học sinh trỏ "quiz".
- "label" là ghi chú ngắn vì sao dừng ở đó (không hiển thị), giúp kiểm tra.
- Cảnh không có hình (cover, summary) thì trỏ title, subtitle, bullets.`;

/**
 * Scene kinds that are allowed to go without a picture even in image mode.
 *
 * These are the three shapes where a stock photo is decoration rather than
 * teaching: the opener sets a tone, the quiz is an interaction, the summary is
 * a recap. Forcing a picture onto them puts an image between the student and
 * the thing they are meant to be reading or answering.
 */
const IMAGE_OPTIONAL = new Set(["cover", "quiz", "summary"]);

/**
 * The picture a scene gets when the model forgot to ask for one.
 *
 * The image-mode rules ask every teaching scene for an `imagePrompt`, and the
 * model that wrote three lessons in a row ignored that on every single scene:
 * the deck came out as text on paper with the switch on and nothing to show for
 * it. A missing prompt is not what the teacher asked for, so it is filled here
 * from the one thing every scene is guaranteed to have — its own title.
 *
 * It is deliberately blunt. Anything cleverer would be inventing a scene the
 * model did not describe; the honest fallback asks for a clear illustration of
 * exactly what this slide is about, with no lettering, which is what a picture
 * generator can actually draw and what the slide needs to stop looking like a
 * form.
 */
function pictureFromTitle(title: string): string {
  const subject = title.replace(/\s+/g, " ").trim().slice(0, 120);
  return `clear educational illustration of ${subject}, flat vector style, soft light, no text, no words, no letters`;
}

/** The system prompt for one scene, with the picture mode folded in. */
function sceneSystem(withImages: boolean): string {
  return SCENE_SYSTEM + REFERENCE_RULES + SOLUTION_RULES + GRAPH_RULES + POINTER_RULES + (withImages ? IMAGE_MODE_RULES : NO_IMAGE_MODE_RULES);
}

interface OutlineScene {
  kind?: string;
  accent?: string;
  title?: string;
  subtitle?: string;
  /** What this scene must make the student understand; drives stage 2. */
  goal?: string;
  /** Index of the scene this one depends on, 0-based; -1 for the opener. */
  buildsOn?: number;
  duration?: number;
}
interface Outline {
  title?: string;
  subject?: string;
  grade?: string;
  scenes?: OutlineScene[];
}

/**
 * Appends the closing scenes when the outline left them out.
 *
 * The prompt asks for one quiz and one summary, and the model usually complies.
 * When it does not, the deck has no practice before the recap and no recap at
 * all — a lesson that stops mid-thought. Appending them here rather than trusting
 * the prompt makes the shape a guarantee instead of a request.
 *
 * The quiz is a self-check rather than a real test: four plausible-looking
 * options about the lesson, the right one first. A generated question set needs
 * another model pass to be worth anything, and this keeps the lesson honest about
 * what it offers — the student can check they were following, not that they
 * passed.
 */
function ensureClosingScenes(
  scenes: Array<Record<string, unknown>>,
  duration: number,
): void {
  const has = (kind: string) => scenes.some((scene) => scene.kind === kind);

  if (!has("quiz")) {
    scenes.push({
      kind: "quiz",
      accent: "gold",
      title: "Kiểm tra lại xem bạn đã hiểu chưa",
      subtitle: "Chọn đáp án đúng về nội dung vừa học.",
      bullets: [
        "Đọc lại tóm tắt ở slide trước nếu chưa nhớ.",
        "Chọn một đáp án, bạn sẽ được giải thích ngay.",
      ],
      narration:
        "Mình cùng kiểm tra lại xem bạn đã nắm được chưa. " +
        "Đọc câu hỏi và chọn đáp án mình nghĩ là đúng. Chọn sai cũng không sao, mình sẽ giải thích lại ngay tại đây, " +
        "và đó là cách nhanh nhất để biết mình cần xem lại phần nào.",
      duration,
      quiz: {
        question: "Bạn đã nắm được nội dung chính của bài học này chưa?",
        options: [
          {
            text: "Rồi, mình hiểu và tự giải thích lại được cho bạn nghe",
            isCorrect: true,
            explanation: "Đó là đúng. Tự kể lại bằng lời mình mới thật sự nắm.",
          },
          {
            text: "Mình hiểu phần đầu, phần sau hơi mơ hồ",
            isCorrect: false,
            explanation:
              "Không sao. Xem lại phần cuối, đó là phần hay quên nhất.",
          },
          {
            text: "Chưa, mình thấy hơi nhiều thông tin",
            isCorrect: false,
            explanation:
              "Bài dài là chủ ý. Xem lại dàn ý theo thứ tự, từng phần một sẽ dễ hơn.",
          },
          {
            text: "Chưa, mình muốn xem ví dụ thực tế thêm",
            isCorrect: false,
            explanation:
              "Phần ví dụ gần cuối bài. Đọc nó sẽ giúp bạn thấy bài học dùng được thế nào.",
          },
        ],
      },
    });
  }

  if (!has("summary")) {
    scenes.push({
      kind: "summary",
      accent: "brand",
      title: "Tóm tắt và bước tiếp theo",
      subtitle: "Điều cần nhớ và điều nên học tiếp.",
      bullets: [
        "Ghi lại 3 ý chính bạn nhớ được nhất từ bài hôm nay.",
        "Làm lại phần bài tập vừa rồi không cần nhìn tài liệu.",
        "Học tiếp phần kế tiếp để mở rộng bài này.",
      ],
      narration:
        "Vậy là chúng ta đã đi hết bài hôm nay. " +
        "Điều quan trọng nhất bạn cần mang về là ba ý vừa nêu trên slide này. " +
        "Mình khuyên bạn thử làm lại phần bài tập mà không nhìn tài liệu, " +
        "vì đó là cách nhanh nhất để biết phần nào còn hổng. " +
        "Ở bài tiếp theo chúng ta sẽ đi sâu vào phần còn lại, xem lại phần này trước khi sang bài mới.",
      duration,
    });
  }

  // The recap is the last thing a student sees, and the model does not reliably
  // put it there: a run of fourteen scenes put "Tổng kết" in the middle and
  // then taught two more things after it. Moving it costs nothing and puts the
  // deck back in the order a lesson actually runs in.
  const summaryAt = scenes.findIndex((scene) => scene.kind === "summary");
  if (summaryAt >= 0 && summaryAt !== scenes.length - 1) {
    const [summary] = scenes.splice(summaryAt, 1);
    scenes.push(summary);
  }
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  // Every call spends real quota, so cap the rate independently of the guard.
  const limit = rateLimit(clientKey(request, "lesson"), 12, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Quá nhiều lần tạo bài. Thử lại sau ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const creds = await resolveProvider();
  const gate = await credentialGate(creds);
  if (gate) {
    return NextResponse.json({ error: gate }, { status: 428 });
  }

  let body: {
    topic?: string;
    subject?: string;
    grade?: string;
    language?: string;
    sceneCount?: number;
    minutes?: number;
    /**
     * How long the lesson should run, as one of the `LESSON_LENGTHS` ids.
     *
     * A separate field from `minutes` on purpose: `minutes` was a free number the
     * model could not be held to, while this one carries a scene count, a word
     * budget per scene and the rules that go with them. See `LESSON_LENGTHS` for
     * why all three are stated together.
     */
    lessonLength?: string;
    notes?: string;
    referenceMaterial?: string;
    /** The paper to draw the slides on. Defaults to the light one. */
    theme?: string;
    /** The background pattern id. Unknown ids fall back to plain. */
    pattern?: string;
    /** The entrance motion id. Unknown ids play still. */
    motion?: string;    /**
     * The voice the teacher chose by ear in the studio.
     *
     * Carried on the lesson so the player opens speaking in the voice that was
     * picked, instead of making the teacher find the setting again on every
     * deck.
     */
    voice?: string;
    /**
     * Whether the deck should carry real pictures.
     *
     * On (the default) nearly every teaching scene gets an `imagePrompt` and the
     * player renders it through the AI picture service. Off removes the field
     * from the response schema altogether, which is stronger than asking the
     * model to leave it blank. A lesson generated with pictures off must not
     * silently fetch any later, including from a stale retry.
     */
    useImages?: boolean;
    /**
     * Whether the teacher's pointer follows the narration. On unless the
     * studio switch is explicitly off; carried on the lesson so the player
     * honours it without asking again.
     */
    showPointer?: boolean;
    /** Pointer colour as `#rrggbb`; the validator drops anything else. */
    pointerColor?: string;
    /**
     * Which kind of deck this is. Bundles palette, picture policy, text
     * density and narration voice, because those four cannot be picked
     * independently without producing a deck that fights itself.
     */
    style?: string;
    /**
     * Model override for this one generation, on the active provider.
     *
     * The teacher picks a model in /setup and it stays the default; this is the
     * narrow escape hatch for comparing two models side by side, which is also
     * what the model audit uses to try every id in a list without making the
     * teacher switch provider by hand each time. Left out, nothing changes.
     */
    model?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body phải là JSON." }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "Thiếu chủ đề bài giảng." }, { status: 400 });
  }

  /*
   * The style answers "what kind of deck is this", and it settles three things
   * at once: which paper the slides are drawn on, whether they carry pictures,
   * and how much text fits on one. The theme picker and the image switch then
   * override the first two afterwards, because a teacher who has just read the
   * style's description should still be able to say "this one, but on dark
   * paper". The style's own prompt rules are not overridable, and deliberately
   * so: they are the density and voice instructions, which are the whole reason
   * for choosing a style at all.
   */
  const style = resolvePresentationStyle(body.style);

  /*
   * The paper is a presentation decision the teacher makes here, not something
   * the model picks. Two reasons: it is not an inference task, it is a taste the
   * user already has; and the answer is a colour the user will stare at for an
   * hour, so letting a language model guess it is the wrong place to spend risk.
   *
   * An id outside the registry is not rejected: the player resolves whatever
   * arrives, so a deck generated against a palette this build has since retired
   * still opens.
   */
  const requestedTheme = typeof body.theme === "string" ? body.theme.trim().slice(0, 40) : "";
  const theme: SlideTheme = requestedTheme || style.theme;

  // The style decides the picture policy; the switch overrides it. Defaulting
  // to the style rather than to `true` is what makes "minimalist" mean anything.
  const useImages = body.useImages ?? style.images;

  // The length preset owns the scene count, because a scene count and a duration
  // are the same decision written twice. The cap is raised well past the longest
  // preset: the old `Math.min(24, ...)` was a response to the model compressing a
  // long outline back down to headings, and it made "45-60 minutes" unreachable
  // by construction rather than because the model could not hold it.
  const length = resolveLessonLength(body.lessonLength);
  // Empty string must not become an override: `generateChatJson` treats a blank
  // model as "use the provider default", but the CLI adapter would try to run
  // `agy --model ""`.
  const modelOverride = body.model?.trim() || undefined;
  const sceneCount = Math.min(
    length.scenes[1],
    Math.max(length.scenes[0], Math.round(body.sceneCount ?? length.scenes[1])),
  );
  // Clamped into the preset's own range, not into a global 0.5–60. A client that
  // sends a fixed 8 (which is what the studio does — it has no minutes control of
  // its own) would otherwise silently shrink a 60–95 scene lesson to eight
  // minutes of eight-second slides, while still reporting a 60 minute target.
  // The duration has to follow the preset, because the preset is what promises a
  // lesson of a given size.
  const minutes = Math.min(
    length.minutes[1],
    Math.max(length.minutes[0], body.minutes ?? length.minutes[1]),
  );
  const subject = body.subject?.trim() || "Chung";

  // Icons are offered from the set that matches the subject, so the model picks
  // from names that mean something here rather than from all 1500 Lucide icons.
  // An unmatched subject falls back to the whole list, which is still a closed
  // list — just a less specific one.
  const iconNames = style.icons ? iconSetFor(subject) : [];
  const grade = body.grade?.trim() || "";
  // The lesson is written in the language of the brief. A teacher who asks in
  // English gets an English deck without touching a setting; the studio can
  // still pin the language when a mixed-language brief needs a specific one.
  const language = resolveLessonLanguage(
    body.language,
    [
      body.topic ?? "",
      body.notes ?? "",
      body.referenceMaterial ?? "",
      body.subject ?? "",
    ].join("\n"),
  );
  // Everything the model is told about the output language, in one block, so
  // the outline and the scenes cannot drift apart on it.
  const isVietnamese = language === "vi";
  const languageRule = [
    "",
    `NGÔN NGỮ ĐẦU RA: viết TOÀN BỘ bài giảng bằng "${language}" — tiêu đề, phụ đề,`,
    'ý chính, lời giảng và câu hỏi. Giữ nguyên các thuật ngữ khoa học và ký hiệu',
    "toán, viết tên riêng và công thức đúng như gốc.",
    'Riêng "imagePrompt" LUÔN viết bằng tiếng Anh (không dấu), vì đó là prompt',
    "cho AI vẽ tranh.",
    isVietnamese
      ? "Văn phong thầy giảng tự nhiên, xưng 'các bạn' khi cần."
      : "Write in clear, plain teaching English — short sentences, no markdown.",
  ].join("\n");
  const reference = body.referenceMaterial?.trim();
  const totalSeconds = Math.round(minutes * 60);

  // The narration word budget, said to the model as a number it can act on.
  //
  // `length.rules` already states these ranges, but only to the outline stage —
  // and the outline stage never writes a single word of narration. The scene
  // stage is what actually produces the text the voice reads, and until this
  // block existed it was told only "viết dài hơn nếu slide dài hơn 12 giây",
  // which is a rule about seconds and gives the model nothing to hit in words.
  //
  // That is why the presets could pass `check:length` while the decks still came
  // out at the wrong length: the script checks that the declared ranges add up,
  // not that anything told the model about them. A number the model can count
  // against is the only thing that makes "Thấp / Trung bình / Cao" a choice
  // rather than a label.
  const [minWords, maxWords] = length.wordsPerScene;
  const wordBudget = [
    "",
    `NGÂN SÁCH LỜI THUYẾT TRÌNH (ràng buộc cứng cho bài này): ${minWords}-${maxWords} từ mỗi slide.`,
    `Cả bài có ${sceneCount} slide, tổng khoảng ${minutes} phút.`,
    '- Đếm số từ của "narration" trước khi trả lời. Dưới mức tối thiểu là slide câm,',
    "  cao hơn mức tối đa là thầy đọc không hết giờ của slide.",
    "- Đạt mức tối thiểu bằng nội dung thật: thêm một ví dụ cụ thể, một câu hỏi gợi",
    "  nhớ, hoặc một bước giải thích thêm. KHÔNG kéo dài bằng câu đệm vô nghĩa",
    '  ("như đã nói ở trên", "bạn cần nhớ kỹ điều này") — đó là lời thầy dạy rở.',
  ].join("\n");

  const context = [
    `Chủ đề: ${topic}`,
    `Môn: ${subject}`,
    grade ? `Trình độ/khối: ${grade}` : "",
    `Ngôn ngữ: ${language}`,
    languageRule,
    "",
    SLIDE_DESIGN_RULES,
    body.notes?.trim() ? `Yêu cầu thêm: ${body.notes.trim()}` : "",
    reference
      ? `\n--- TÀI LIỆU THAM KHẢO (markdown, giữ tiêu đề/bảng/mốc trang) ---\n${skimReference(reference)}\n--- HẾT TÀI LIỆU ---`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  /*
   * The same lesson with the instruction furniture taken off.
   *
   * Used only when the provider refuses the full prompt for being larger than
   * its per-minute budget allows: the design rules, the style guide and the skim
   * of the reference are the bulk of the tokens, and a scene written without
   * them is still a scene — a slightly plainer one, which beats the placeholder
   * narration the fallback would have shipped.
   */
  const shortContext = [
    `Chủ đề: ${topic}`,
    `Môn: ${subject}`,
    grade ? `Trình độ/khối: ${grade}` : "",
    `Ngôn ngữ: ${language}`,
    body.notes?.trim() ? `Yêu cầu thêm: ${body.notes.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const encoder = new TextEncoder();
  const perScene = (count: number) =>
    Math.max(6, Math.round(totalSeconds / Math.max(1, count)));

  // Wall clock for one scene call. The first attempt has to fit inside its
  // batch; the retry only waits on itself, so it gets more room.
  const SCENE_TIMEOUT_MS = 120_000;
  const SCENE_RETRY_TIMEOUT_MS = 240_000;

  // A slide's duration has to be long enough to speak its own narration.
  //
  // The duration field the model returns is a guess made before anyone has
  // measured the text, and it is wrong often enough to matter: a 120-word
  // narration on a 20-second slide gets cut off mid-sentence, and a listener
  // hears the teacher stop short on every slide. Word count is knowable exactly
  // here, so it is used as the floor.
  //
  // Every engine is slowed to teaching pace before it leaves the TTS service
  // (TEACHING_TEMPO in src/lib/server/tts.ts), which is what makes this number
  // an engine question at all: measured after the stretch, one 55-word
  // narration reads 15.7s on Edge, 15.1s on Piper, 14.7s on VieNeu — 3.5-3.7
  // words a second across the board.
  //
  // The estimate sits below that median on purpose. Passage-to-passage variance
  // is wider than engine-to-engine variance (the TTS cache holds 2.3-6.4 words/s
  // at engine pace), and the two errors are not symmetric: too high and the
  // sentence is cut mid-clause, too low and the slide sits quiet — and the quiet
  // case is recoverable, because the player skips leftover silence at the end of
  // a slide. At 3.2 the slowest measured passage still fits inside the player's
  // 1.3x correction (3.2/1.3 = 2.46 words/s). One constant on purpose: a
  // per-engine table would be precision theater.
  //
  // The floor stays 6s and the cap stays proposed*1.8, so a runaway paragraph
  // cannot strand the deck around it.
  const NARRATION_WORDS_PER_SECOND = 3.2;
  const NARRATION_PADDING_SECONDS = 1.5;
  const durationFor = (narration: unknown, proposed: number): number => {
    const text = typeof narration === "string" ? narration.trim() : "";
    if (!text) return Math.max(6, proposed);
    const words = text.split(/\s+/).filter(Boolean).length;
    const spoken = words / NARRATION_WORDS_PER_SECOND + NARRATION_PADDING_SECONDS;
    return Math.min(
      Math.max(6, proposed) * 1.8,
      Math.max(6, Math.ceil(spoken)),
    );
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Draft identity, hoisted so the catch block can mark the draft failed
      // even when the outline itself never came back. Assigned once stage 1
      // lands; the `plannedTotal > 0` guard keeps an outline-stage failure
      // from writing a draft for a deck that has no shape yet.
      let lessonId = "";
      let draftTitle = "";
      let draftSubject = "";
      let plannedTotal = 0;
      let draftDone = 0;

      try {
        // ---------- stage 1: outline ----------
        // The id is minted before anything is written so the in-progress run
        // already has a stable identity: the library draft card, every scene
        // event and the final lesson all share it.
        lessonId = newLessonId();
        send({
          type: "stage",
          stage: "outline",
          message: "Đang lên dàn ý bài học…",
          progress: 5,
          provider: creds.provider,
          model: modelOverride ?? creds.model,
          // Handed over on the very first event so the studio can route to
          // the classroom session immediately — the deck streams there.
          lessonId,
        });

        const outlineStart = Date.now();
        const outlineResult = await generateJson<Outline>(creds, {
          model: modelOverride,
          system: OUTLINE_SYSTEM,
          prompt: `${context}\nSố cảnh: ${sceneCount}. Tổng thời lượng: ${totalSeconds}s.${length.rules}\nĐây là bài DÀNH, đã tách nhỏ từng phần để học sinh tự học được.\n\nBẮT BUỘC liệt kê ĐÚNG ${sceneCount} mục trong "scenes", đánh số từ 1 đến ${sceneCount}. Hãy đếm lại trước khi trả lời — thiếu mục nào cũng tính là sai, và câu trả lời sẽ bị làm lại.\n\nCách lấy đủ ${sceneCount} mục khi chủ đề nghe như chỉ có vài ý:\n- Tách MỖI ý lớn thành nhiều mục nhỏ hơn (định nghĩa một mục, ý nghĩa một mục, ví dụ một mục).\n- Mỗi ví dụ trong bài là một mục riêng, đừng gộp ba ví dụ vào một mục.\n- Thêm các mục "vì sao cần", "cạm bẫy thường gặp", "khi nào không dùng được", "bài tập tự làm", "tóm tắt".\n- ĐỪNG tách nhỏ đến mức vô nghĩa: một dãy phép tính cùng loại (cả bảng nhân) thì gộp\n  thành MỘT mục, vì tách từng dòng ra sẽ thành 9 slide giống hệt nhau.\n- KHÔNG được lặp lại cùng một ý để lấp số. Mỗi mục phải dạy một điều khác đi.\n\nChỉ trả về tiêu đề và mục tiêu từng cảnh, chưa viết nội dung chi tiết.`,
          schema: OUTLINE_SCHEMA,
          temperature: 0.6,
          // Scaled, not fixed. An outline entry is a kind, a title and a goal —
          // roughly forty tokens with the punctuation — so the 4096 that used to
          // sit here was comfortable for a dozen scenes and nowhere near enough
          // for the ninety-five the long preset asks for. A truncated outline is
          // not a short outline: it is unparseable JSON, and stage 2 never runs.
          maxOutputTokens: Math.min(32_000, 2048 + sceneCount * 64),
          // Also scaled, for the same reason. A ninety-five scene outline is
          // several thousand tokens of generation, and a fixed ninety seconds
          // would abort it partway through — after which the retry starts the
          // same long generation and times out again. The base covers a short
          // outline, the per-scene term covers the long one.
          //
          // The base is much larger than the cloud providers need because the
          // CLI provider spends it on tools: an agent that has to open a 308-page
          // slide deck, find the pages it wants and read them back takes ~80s
          // before it writes a word, and `--print-timeout` cuts the turn dead
          // with an empty `response` when it overruns. Measured: the outline for
          // "định nghĩa tích phân Riemann" was killed at 82s with 225k input
          // tokens spent and nothing to show for it.
          // Raised from a 300s ceiling: a Vietnamese outline of 16 scenes runs
          // about 3k output tokens, and when that gets truncated the retry asks
          // for twice the room — measured at ~60s per 3k tokens on the 550B
          // NVIDIA model. A 300s cap stopped the retry mid-answer.
          totalTimeoutMs: Math.min(480_000, 180_000 + sceneCount * 12_000),
          // Only a missing goal is treated as a failure worth retrying. A missing
          // goal means stage 2 has nothing but a title to work from, and every
          // scene it writes comes out thin — there is no way to salvage that
          // downstream.
          //
          // A short outline is deliberately NOT rejected. The model answered
          // "five good scenes" to "give me fourteen" three times in a row, and
          // retrying it for that burns the whole attempt budget and returns
          // nothing at all. A ten-scene lesson is worth far more than an error
          // message, so the count stays a soft goal: the prompt pushes for it,
          // and the shape is finished off by `ensureClosingScenes`.
          validate: (data) => {
            const scenes = (data as Outline).scenes ?? [];
            if (scenes.length > 0 && scenes.every((scene) => !scene.goal?.trim())) {
              return "dàn ý thiếu \"goal\" cho mọi cảnh.";
            }
            return null;
          },
        });
        const outline = outlineResult.data;

        const planned = (outline.scenes ?? []).slice(0, sceneCount);
        if (planned.length === 0) {
          throw new AiError("Mô hình không trả về cảnh nào. Thử lại.");
        }

        send({
          type: "stage",
          stage: "outline-done",
          message: `Dàn ý: ${planned.length} cảnh: "${outline.title ?? topic}"`,
          progress: 25,
          provider: creds.provider,
          model: outlineResult.model,
          elapsedMs: Date.now() - outlineStart,
          lessonId,
          // Hand the outline over now so the browser can show it within seconds.
          outline: {
            title: outline.title ?? topic,
            scenes: planned.map((scene: OutlineScene, index: number) => ({
              id: `ai-${index + 1}`,
              title: scene.title ?? `Cảnh ${index + 1}`,
              kind: scene.kind ?? "concept",
              duration: scene.duration ?? perScene(planned.length),
              state: index === 0 ? "active" : "pending",
            })),
          },
        });

        // The library learns about this run now, not at `done`: a teacher who
        // opens /library mid-run sees a "Đang tạo…" card with live progress
        // instead of nothing. Updated after every finished scene below, deleted
        // when the final lesson lands (or marked with the error on failure).
        draftTitle = String(outline.title ?? topic).slice(0, 200);
        draftSubject = String(outline.subject ?? subject ?? "").slice(0, 120);
        plannedTotal = planned.length;
        const writeDraft = (message: string, error?: string) =>
          saveDraft({
            id: lessonId,
            title: draftTitle,
            subject: draftSubject,
            total: planned.length,
            done: draftDone,
            message: message.slice(0, 300),
            updatedAt: new Date().toISOString(),
            error,
          }).catch(() => {
            // A draft is a courtesy, not the lesson: never fail the run over it.
          });
        await writeDraft(`Dàn ý xong: ${planned.length} cảnh. Bắt đầu viết chi tiết…`);

        // ---------- stage 2: one call per scene, streamed as it lands ----------
        const scenes: Array<Record<string, unknown>> = [];
        // Starts as the model that was asked for; overwritten by the first scene
        // that comes back, so a lesson finished by a backup model is labelled
        // with the backup rather than with a model that never wrote it.
        let generatedModel = creds.model;
        // Scenes that came back as the "đang được bổ sung" placeholder. Kept as a
        // count so the run can refuse to ship a deck that is mostly holes.
        let fallbackScenes = 0;
        // The first real reason a scene fell back. The error below used to say
        // only "the provider may have run out", which is a guess; the call that
        // actually failed says exactly what went wrong (a 429, a schema the model
        // refused, a timeout), and that sentence is what makes the difference
        // between retrying and switching provider.
        const fallbackReasons: string[] = [];
        /**
         * Scenes written in the smaller coat, after a provider refused the full
         * prompt for its size. Counted so the run log can say why a lesson looks
         * plainer than the one the teacher asked for.
         */
        let compactScenes = 0;
        /**
         * Once a provider has refused one full prompt for its size, the rest of
         * the lesson is written in the smaller coat straight away. The ceiling
         * does not change between scenes, so paying for a refusal per scene is
         * a minute per slide the teacher can have back for nothing.
         */
        let compactByDefault = false;
        // A previous run on this provider already found out; start in the smaller coat.
        compactByDefault = await readCompactModel(creds.provider, creds.model);
        // Per-scene call facts for the run log: which model answered, how long
        // the call took (retry included), and whether it needed a second try.
        // Filled inside `writeScene`, read by the batch loop when it reports
        // each finished scene — the one thing that answers "where is the model
        // call at" without streaming tokens the providers never send.
        const sceneStats = new Map<
          number,
          {
            model: string;
            elapsedMs: number;
            retried: boolean;
            fallback: boolean;
            /** Why the call failed, when it did. Empty on success. */
            reason: string;
          }
        >();
        const perSceneSeconds = perScene(planned.length);
        // The system prompt is identical for every scene call (and its
        // retry), so build it once. Concatenating the same string N times
        // burns CPU but never tokens — still, no reason to burn it.
        const sceneSystemPrompt =
          sceneSystem(useImages) + style.rules + iconRules(iconNames);

        /**
         * Writes one scene. Split out from the loop because the loop is batched,
         * and a batch cannot `await` inside itself.
         */
        const writeScene = async (
          index: number,
          forceCompact = false,
        ): Promise<Record<string, unknown>> => {
          const compact = forceCompact || compactByDefault;
          const plannedScene = planned[index];
          const kind = plannedScene.kind ?? "concept";
          const sceneTitle = plannedScene.title ?? `Cảnh ${index + 1}`;
          // Wall clock for this scene, retry included. The batch loop reads it
          // back from `sceneStats` when it reports the finished scene.
          const callStart = Date.now();
          let retried = false;
          // The scene's own excerpt: the numbered exercise (or passage) this
          // scene teaches, lifted out of the shared skim so the working comes
          // from the book instead of memory. Empty when nothing matches, in
          // which case the scene falls back to the full skim in `context`.
          const excerpt =
            reference?.trim() &&
            plannedScene.goal &&
            sceneNeedsExcerpt(sceneTitle, plannedScene.goal)
              ? sliceForScene(reference, sceneTitle, plannedScene.goal)
              : "";

          const sceneRequest = {
            model: modelOverride,
            // The plain instruction set, kept for the retry below: the style
            // guide and the icon rules are worth a thousand tokens, and on a
            // provider with an 8000-token-per-minute budget they are the
            // difference between a written scene and a refused request.
            system: compact ? sceneSystem(useImages) : sceneSystemPrompt,
            prompt: `${compact ? shortContext : context}\n\nBài: "${outline.title ?? topic}"\nCảnh ${
              index + 1
            }/${planned.length}: loại "${kind}", tiêu đề "${sceneTitle}"${
              plannedScene.subtitle ? `, phụ đề "${plannedScene.subtitle}"` : ""
            }.${plannedScene.goal ? `\nMỤC TIÊU CẢNH NÀY: ${plannedScene.goal}` : ""}${
              excerpt
                ? kind === "example"
                  ? `\nĐOẠN TÀI LIỆU RIÊNG CHO CẢNH NÀY (đề bài nằm đây — đọc kỹ rồi mới viết "steps", giữ đề nguyên văn ở "subtitle"):\n${excerpt}\n---`
                  : `\nĐOẠN TÀI LIỆU RIÊNG CHO CẢNH NÀY (đoạn mô tả hàm số/đường cong — đọc kỹ rồi mới điền "graph", tiệm cận ghi vào vlines/hlines):\n${excerpt}\n---`
                : ""
            }${
              typeof plannedScene.buildsOn === "number" && plannedScene.buildsOn >= 0 && plannedScene.buildsOn < index
                ? `\nCảnh này nối tiếp từ cảnh ${plannedScene.buildsOn + 1} ("${planned[plannedScene.buildsOn]?.title ?? ""}"). Mở đầu bằng cách nhắc lại điều vừa học, đừng lặp lại nguyên văn.`
                : ""
            }\nThời lượng dự kiến ${perSceneSeconds}s. Hãy viết nội dung cảnh này.${wordBudget}${
              useImages && IMAGE_OPTIONAL.has(kind)
                ? `\nLƯU Ý: loại cảnh "${kind}" được phép bỏ "imagePrompt".`
                : ""
            }`,
            schema: sceneSchema(useImages),
            // Worked examples need determinism and room: a creative
            // temperature turns arithmetic into confabulation, and 49–99
            // graph points plus six steps do not fit a 2048-token budget
            // without truncating the narration the voice still has to read.
            temperature: kind === "example" ? 0.5 : 0.85,
            maxOutputTokens: kind === "example" ? 3072 : 2048,
            validate: (data: unknown) => {
              const scene = data as Record<string, unknown>;
              if (Array.isArray(scene.bullets) && scene.bullets.length === 0) {
                return "cảnh không có gạch đầu dòng.";
              }
              // A slide with no narration is a silent slide: the voice reads
              // nothing, the running subtitle has nothing to highlight, and the
              // scene just sits there. It happens when a formula or a table
              // dominates the model and it forgets the prose, so ask again.
              // 60 characters is roughly a sentence and a half — below that the
              // slide is a caption, not a lesson. The bar is kept low on
              // purpose: a failed retry costs a whole model call, so a marginal
              // scene is cheaper than a missing one.
              // Word count, not character count. The length presets promise a
              // spoken duration, and that promise is about words: a scene at the
              // floor of its preset has to be *readable*, and a slide whose prose
              // is a caption breaks the duration the card promised.
              //
              // Only the floor is enforced. The ceiling is left to the prompt:
              // overshooting the floor is a silent-slide bug, overshooting the
              // ceiling only lengthens a scene the route already tolerates, and
              // a retry costs a whole model call to fix the smaller problem.
              if (typeof scene.narration === "string") {
                const words = scene.narration.trim().split(/\s+/).filter(Boolean).length;
                // 60% of the floor: a model told "at least N words" writes about
                // two thirds of N, so holding the exact floor rejects scenes
                // that are only slightly short and burns a retry on each one.
                if (words < Math.max(20, Math.round(minWords * 0.6))) {
                  return `narration quá ngắn (${words} từ, cần tối thiểu ${minWords} từ cho bài ${length.label}). Thêm ví dụ cụ thể hoặc bước giải thích thay vì câu đệm.`;
                }
              } else {
                return "narration bị bỏ trống, cần lời thuyết trình để đọc bằng giọng nói.";
              }
              if (kind === "quiz") {
                const quiz = scene.quiz as { options?: unknown[] } | undefined;
                if (!Array.isArray(quiz?.options) || quiz.options.length < 2) {
                  return "cảnh trắc nghiệm thiếu phương án.";
                }
              }
              if (kind === "simulation3d" && !scene.simulation3d) {
                return "cảnh mô phỏng 3D thiếu cấu hình.";
              }
              // A worked example with no board working is the old failure
              // mode (steps spoken but never shown). Gated on the scene
              // claiming to solve something, so a purely illustrative
              // "example" without markers is not sent back for a retry it
              // does not need — each retry is a paid model call.
              if (
                kind === "example" &&
                sceneSolvesExercise(sceneTitle, plannedScene.goal ?? "") &&
                (!Array.isArray(scene.steps) ||
                  scene.steps.filter(
                    (step) => typeof step === "string" && step.trim(),
                  ).length === 0)
              ) {
                return "cảnh ví dụ giải bài tập thiếu \"steps\". Viết lời giải từng bước có số.";
              }
              // The pointer is only useful with anchors the stage can find. A
              // full set of off-list targets validates here but renders as a
              // parked pointer, so ask again while the retry is cheap.
              if (Array.isArray(scene.pointer) && scene.pointer.length > 0) {
                const known = (POINTER_TARGETS as readonly string[]);
                const usable = scene.pointer.filter(
                  (cue) =>
                    cue &&
                    typeof cue === "object" &&
                    known.includes((cue as { target?: unknown }).target as string),
                );
                if (usable.length === 0) {
                  return "pointer không trỏ tới chỗ nào trên slide.";
                }
              }
              return null;
            },
          };

          const writeOnce = (timeoutMs: number) =>
            generateJson<Record<string, unknown>>(creds, {
              ...sceneRequest,
              // Same reason as the outline stage: an agent that reads the slides
              // first needs more than a minute of wall clock before it starts
              // writing. Measured scene runs on the CLI provider: 17s, 30s, 41s —
              // and those were six-at-a-time batches competing for the machine.
              totalTimeoutMs: timeoutMs,
            });

          // A thrown call gets a second, longer attempt before the fallback.
          //
          // On the long preset, six agents run in parallel for sixteen batches,
          // and the occasional one ran past its budget — measured 5 of 95 scenes,
          // which shipped as "đang được bổ sung" holes in a 60-minute lesson. The
          // first call is the one that has to fit inside the batch's wall clock;
          // the retry has nothing to wait for but its own scene, so it can afford
          // to be generous. Validation failures already retry inside
          // `generateJson`, so this only covers the call that never came back.
          const detail = await writeOnce(SCENE_TIMEOUT_MS)
            .catch(() => {
              retried = true;
              send({
                type: "stage",
                stage: "scene-retry",
                message: `Cảnh "${sceneTitle}" bị cắt giữa chừng, thử lại lần nữa.`,
                progress: Math.round(25 + (index / planned.length) * 70),
                provider: creds.provider,
                elapsedMs: Date.now() - callStart,
              });
              return writeOnce(SCENE_RETRY_TIMEOUT_MS);
            })
            /*
             * A prompt the provider says is too large for its minute is worth one
             * more try in a smaller coat: same scene, same outline slot, without
             * the design rules, the style guide and the reference skim. Providers
             * that never refuse keep both paths identical, because this branch is
             * only reached by an error that says the request did not fit.
             */
            .catch(async (error: unknown) => {
              const message = error instanceof Error ? error.message : String(error);
              const tooBig =
                /too large|tokens per minute|\bTPM\b|reduce your message size/i.test(message);
              if (compact || !tooBig) throw error;
              compactScenes += 1;
              compactByDefault = true;
              await noteCompactModel(creds.provider, creds.model);
              send({
                type: "stage",
                stage: "scene-compact",
                message: `Cảnh "${sceneTitle}" vượt hạn mức của nhà cung cấp — viết lại gọn hơn.`,
                progress: Math.round(25 + (index / planned.length) * 70),
                provider: creds.provider,
                elapsedMs: Date.now() - callStart,
              });
              return writeScene(index, true).then((scene) => ({ data: scene }));
            })
            .then((result) => {
              // Remember which model actually produced this scene: when a call
              // rotates to a backup, `creds.model` still names the one that was
              // asked for, and a lesson then claims a model that never wrote it.
              if (
                result &&
                typeof (result as { model?: unknown }).model === "string" &&
                (result as { model?: unknown }).model
              ) {
                generatedModel = (result as { model: string }).model;
              }
              sceneStats.set(index, {
                model: generatedModel,
                elapsedMs: Date.now() - callStart,
                retried,
                fallback: false,
                reason: "",
              });
              return result;
            })
            .catch((error: unknown) => {
              const reason = error instanceof Error ? error.message : String(error);
              fallbackReasons.push(reason);
            // One bad scene must not sink the lesson: keep the outline's shape
            // and ship a minimal body so playback still works.
            fallbackScenes += 1;
            sceneStats.set(index, {
              model: "",
              elapsedMs: Date.now() - callStart,
              retried,
              fallback: true,
              reason,
            });
            send({
              type: "stage",
              stage: "scene-fallback",
              message:
                `Cảnh "${sceneTitle}" ghi lỗi (${reason.slice(0, 200)}), tạm dùng nội dung tối giản.`,
              progress: Math.round(25 + (index / planned.length) * 70),
              provider: creds.provider,
              elapsedMs: Date.now() - callStart,
            });
            return {
              data: {
                title: sceneTitle,
                subtitle: plannedScene.subtitle,
                bullets: [
                  `Cảnh "${sceneTitle}" đang được bổ sung.`,
                  plannedScene.goal ?? "",
                ].filter(Boolean),
                // A blank narration is a silent slide: no voice, no running
                // subtitle, and a hole in the middle of the lesson. The
                // placeholder at least keeps the deck continuous and tells the
                // teacher plainly which slide needs rewriting.
                narration: `Phần "${sceneTitle}" đang được bổ sung. ` +
                  "Bạn bỏ qua cảnh này, xem cảnh tiếp theo.",
                duration: durationFor(
                  `Phần "${sceneTitle}" đang được bổ sung. ` +
                    "Bạn bỏ qua cảnh này, xem cảnh tiếp theo.",
                  perSceneSeconds,
                ),
              } as Record<string, unknown>,
            };
          });

          const scene = {
            ...detail.data,
            kind,
            accent: plannedScene.accent ?? "brand",
            duration: durationFor(
              detail.data.narration,
              Number(detail.data.duration) || perSceneSeconds,
            ),
          };
          const typed = scene as {
            imagePrompt?: unknown;
            imageQuery?: unknown;
          };
          const wanted = typed.imagePrompt ?? typed.imageQuery;
          return {
            ...scene,
            // Illustrations were asked for, the model gave none, and the switch
            // the teacher set is the promise this deck has to keep. One picture
            // per teaching scene, described from the scene's own title.
            ...(useImages &&
            !IMAGE_OPTIONAL.has(kind) &&
            !(typeof wanted === "string" && wanted.trim().length >= 3)
              ? { imagePrompt: pictureFromTitle(sceneTitle) }
              : {}),
          };
        };

        // Each scene is reported the moment its own call lands: the classroom
        // shows the finished slide and reads its voice-over straight away,
        // instead of waiting for the whole deck. The position still travels
        // with the event so the client never depends on arrival order.
        const reportScene = (index: number, result: Record<string, unknown>) => {
          scenes[index] = result;
          draftDone += 1;
          const stats = sceneStats.get(index);
          send({
            type: "scene",
            stage: "scene",
            message: `Xong cảnh ${index + 1}: ${
              String(result.title ?? planned[index].title ?? "")
            }`,
            progress: Math.round(25 + (draftDone / planned.length) * 70),
            scene: result,
            sceneIndex: index,
            provider: creds.provider,
            model: stats?.fallback ? undefined : stats?.model,
            elapsedMs: stats?.elapsedMs,
          });
          void writeDraft(`Đã xong ${draftDone}/${planned.length} cảnh.`);
        };
        // Scenes are written strictly one after another: the classroom plays
        // each finished slide with its voice-over before the next one is even
        // requested, so the deck grows exactly the way it is watched. Slower
        // wall-clock than parallel batches — a deliberate trade, chosen so a
        // long lesson never looks stalled while six calls fight upstream.
        for (let index = 0; index < planned.length; index += 1) {
          send({
            type: "stage",
            stage: "scene",
            message: `Đang viết cảnh ${index + 1}/${planned.length}`,
            progress: Math.round(25 + (index / planned.length) * 70),
          });
          const result = await writeScene(index);
          reportScene(index, result);
        }

        // ---------- enforce the shape, whatever the outline said ----------
        // The prompt asks for an opener, a quiz and a summary, and usually gets
        // them. When it does not, the deck reads as an unfinished draft: no
        // practice before the recap, and no recap at all. Both are cheap to
        // append and impossible to skip afterwards, so they are appended here
        // rather than trusted to the model.
        ensureClosingScenes(scenes, perScene(planned.length));

        // A table is a page of screen. The model reuses the same one across
        // scenes whenever the topic has a table at all, which turns a lesson
        // into the same table four times. Only the first one is worth keeping.
        let tableKept = false;
        for (const scene of scenes) {
          if (!(scene as { table?: unknown }).table) continue;
          if (tableKept) delete (scene as { table?: unknown }).table;
          else tableKept = true;
        }

        // Images off means off, at the last possible moment.
        //
        // The schema already keeps `imageQuery` and `imagePrompt` out of the
        // response, but a scene
        // that fell back to the minimal body, or a retry that reused an earlier
        // answer, can still carry one. Stripping here rather than trusting every
        // earlier step means the switch is decided once, in one place, and the
        // lesson on disk matches the toggle the teacher actually set.
        if (!useImages) {
          for (const scene of scenes) {
            delete (scene as { imageQuery?: unknown }).imageQuery;
            delete (scene as { imagePrompt?: unknown }).imagePrompt;
          }
        }

        // A few holes are survivable; a deck made of holes is not a lesson.
        //
        // The per-scene placeholder exists so one bad call cannot sink a
        // sixty-minute deck — measured, 5 of 95 scenes hit their timeout and the
        // rest were fine. But when the provider itself gives up mid-run (a spent
        // quota, for instance) the same placeholder turns ninety-two scenes into
        // "đang được bổ sung", and that deck still reported success and landed in
        // the library as a finished 95-scene lesson. Counting the fallbacks and
        // stopping here means a dead provider is reported as the failure it is,
        // instead of shipping a deck the teacher has to audit slide by slide.
        const fallbackLimit = Math.max(3, Math.round(planned.length * 0.2));
        if (fallbackScenes > fallbackLimit) {
          throw new AiError(
            `Chỉ viết được ${planned.length - fallbackScenes}/${planned.length} cảnh, ` +
              `phần còn lại không viết nổi. ` +
              (fallbackReasons[0] ? `Lý do: ${fallbackReasons[0].slice(0, 300)}. ` : "") +
              `Bài chưa được lưu — thử lại sau.`,
          );
        }

        // ---------- assemble ----------
        const lesson = coerceLesson({
          id: lessonId,
          title: outline.title ?? topic,
          subject: outline.subject ?? subject,
          grade: outline.grade ?? body.grade,
          language,
          fps: 30,
          theme,
          pattern: isSlidePattern(body.pattern) ? body.pattern : DEFAULT_SLIDE_PATTERN,
          motion: isSlideMotion(body.motion) ? body.motion : DEFAULT_SLIDE_MOTION,
          voice: typeof body.voice === "string" ? body.voice.slice(0, 60) : undefined,
          showPointer: body.showPointer === false ? false : true,
          pointerColor:
            typeof body.pointerColor === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(body.pointerColor.trim())
              ? body.pointerColor.trim()
              : undefined,
          scenes: scenes.map((scene, index) => ({ ...scene, id: `ai-${index + 1}` })),
          chapters: [],
          source: "gemini",
          model: generatedModel,
          createdAt: new Date().toISOString(),
        });

        if (!lesson) {
          throw new AiError("Không dựng được bài giảng từ dàn ý.");
        }

        // The one piece of evidence that settles "can this model be trusted":
        // a finished lesson, credited to the model that actually wrote it. The
        // setup screen marks exactly these ids, so the mark cannot go stale or
        // survive an F5 — it is read back from disk.
        await recordModelTrust({
          provider: creds.provider,
          model: generatedModel,
          lessonId: lesson.id,
          scenes: lesson.scenes.length,
          words: lesson.scenes.reduce(
            (total, scene) =>
              total +
              (typeof scene.narration === "string"
                ? scene.narration.trim().split(/\s+/).filter(Boolean).length
                : 0),
            0,
          ),
        });

        send({
          type: "done",
          message: `${lesson.scenes.length} cảnh, ${lesson.duration}s.`,
          progress: 100,
          lesson,
          provider: creds.provider,
          model: generatedModel,
          elapsedMs: Date.now() - outlineStart,
        });
        // The finished lesson replaces the draft card under the same id; the
        // client save is idempotent, so deleting here cannot strand the deck.
        await deleteDraft(lessonId).catch(() => null);
      } catch (error) {
        const detail =
          error instanceof AiError || error instanceof Error
            ? error.message
            : "Lỗi không xác định";
        // The CLI reports a spent quota in English, buried under a JSON error
        // blob. Lead with what happened and when it clears, then keep the raw
        // line for anything the user recognises.
        const quota = isQuotaExhausted(detail);
        const message = quota
          ? `Hết hạn mức dùng của Antigravity CLI. ${detail}`
          : detail;
        // Leave the failure on the draft card instead of silently withdrawing
        // it: the library shows what went wrong, and the card can be deleted.
        // Skipped when the outline never landed — a shapeless run has no card.
        if (plannedTotal > 0) {
          await saveDraft({
            id: lessonId,
            title: draftTitle || String(topic).slice(0, 200),
            subject: draftSubject,
            total: plannedTotal,
            done: draftDone,
            message: "Không sinh được bài giảng.",
            updatedAt: new Date().toISOString(),
            error: message.slice(0, 500),
          }).catch(() => null);
        }
        send({
          type: "error",
          message: "Không sinh được bài giảng.",
          error: message,
          quota,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      // Stops reverse proxies from buffering the stream into one blob.
      "x-accel-buffering": "no",
    },
  });
}
