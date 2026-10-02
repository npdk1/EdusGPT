import { relayoutLesson, type Lesson } from "./types";

/**
 * Bundled demo lessons so the player is useful the moment the app boots — no
 * API key and no media file required. Times are authored as durations and laid
 * out into a seekable timeline by `relayoutLesson`.
 */
const NEWTON_DRAFT: Omit<Lesson, "duration" | "chapters"> = {
  id: "sample-newton-2",
  title: "Định luật II Newton",
  subject: "Vật lí",
  grade: "Lớp 10",
  language: "vi",
  fps: 30,
  source: "sample",
  createdAt: "2026-01-01T00:00:00.000Z",
  scenes: [
    {
      id: "sc-1",
      kind: "cover",
      accent: "brand",
      title: "Định luật II Newton",
      subtitle: "Vật lí 10 · Chương 2: Động lực học chất điểm",
      bullets: [
        "Vì sao cùng một lực đẩy lại cho xe nhẹ gia tốc lớn hơn xe nặng?",
        "Mục tiêu: hiểu quan hệ F, m, a và vận dụng vào bài toán thật",
      ],
      narration:
        "Hôm nay chúng ta trả lời một câu hỏi học sinh nào cũng từng thắc mắc: cùng một lực đẩy, vì sao xe nhẹ lại lao đi nhanh hơn?",
      pointer: [{ target: "title", label: "Câu hỏi mở đầu" }],
      start: 0,
      duration: 6,
    },
    {
      id: "sc-2",
      kind: "concept",
      accent: "brand",
      title: "Lực gây ra gia tốc",
      subtitle: "Trực giác trước, công thức sau",
      bullets: [
        "Lực tạo ra sự thay đổi vận tốc, không tạo ra vận tốc",
        "Khối lượng là thước đo quán tính: càng nặng, càng “ì”",
        "Gia tốc luôn cùng hướng với hợp lực tác dụng",
      ],
      narration:
        "Lực không giữ cho vật chuyển động. Lực làm vận tốc thay đổi, và khối lượng chính là mức độ ì của vật.",
      pointer: [
        { target: "bullet-0", label: "Lực tạo ra thay đổi vận tốc" },
        { target: "bullet-1", label: "Khối lượng là mức quán tính" },
      ],
      start: 0,
      duration: 8,
    },
    {
      id: "sc-3",
      kind: "formula",
      accent: "gold",
      title: "Phát biểu định luật",
      subtitle: "Dạng vector mới là dạng đúng về bản chất",
      bullets: [
        "Hợp lực F tác dụng vào vật tỉ lệ thuận với gia tốc a",
        "Tỉ số F/a là hằng số đặc trưng cho vật: khối lượng m",
      ],
      formula: "F⃗ = m · a⃗",
      narration:
        "Biểu thức cốt lõi: hợp lực bằng khối lượng nhân gia tốc. Vector lực và vector gia tốc cùng phương, cùng chiều.",
      start: 0,
      duration: 7,
    },
    {
      id: "sc-4",
      kind: "simulation3d",
      accent: "brand",
      title: "Mô phỏng 3D: Con lắc chuyển động",
      subtitle: "Quan sát trực quan dao động và lực quán tính",
      bullets: [
        "Vật thể chịu tác dụng của lực phục hồi và trọng lực",
        "Có thể cầm chuột xoay để nhìn từ nhiều góc độ 3D khác nhau",
        "Thử điều chỉnh thanh trượt tốc độ bên dưới mô hình",
      ],
      simulation3d: {
        type: "physics-pendulum",
        parameters: { speed: 1.5 },
      },
      narration:
        "Bây giờ mời bạn quan sát mô hình ba chiều của con lắc. Bạn có thể dùng chuột kéo để xoay góc nhìn, và tăng giảm tốc độ dao động của vật.",
      start: 0,
      duration: 10,
    },
  {
    id: "sc-5",
    kind: "example",
    accent: "ember",
    title: "Ví dụ: xe đẩy hàng",
    subtitle: "m = 20 kg, F = 60 N, bỏ qua ma sát",
    bullets: [
      "Gia tốc: a = F / m = 60 / 20 = 3 m/s²",
      "Vận tốc sau 4 s: v = a · t = 12 m/s",
      "Quãng đường: s = ½ · a · t² = 24 m",
    ],
    formula: "a = F/m = 3 m/s²   →   v = 12 m/s",
    // Demonstrates the table renderer: a teacher would write these three
    // steps on the board as a column, not as prose.
    table: {
      caption: "Bảng tra nhanh F – m – a",
      columns: ["Lực F (N)", "Khối lượng m (kg)", "Gia tốc a (m/s²)"],
      rows: [
        ["20", "10", "2"],
        ["40", "20", "2"],
        ["60", "20", "3"],
        ["90", "30", "3"],
        ["120", "40", "3"],
      ],
    },
    narration:
      "Áp dụng vào ví dụ: xe hai mươi ki-lô-gam, lực sáu mươi niu-tơn, gia tốc ba mét trên giây bình phương. Sau bốn giây xe đạt mười hai mét trên giây.",
    start: 0,
    duration: 9,
  },
  {
    id: "sc-6",
    kind: "quiz",
    accent: "gold",
    title: "Kiểm tra nhanh tương tác",
    subtitle: "Bấm chọn trực tiếp đáp án bên dưới",
    bullets: [
      "Câu hỏi trắc nghiệm kiểm tra độ hiểu bài ngay trên slide",
      "Chọn đáp án để xem AI chấm điểm và giải thích chi tiết",
    ],
    quiz: {
      question: "Nếu lực tác dụng F không đổi, khối lượng vật m tăng gấp đôi thì gia tốc a sẽ:",
      options: [
        { id: "opt-1", text: "Tăng gấp đôi (a = 2 a0)", isCorrect: false, explanation: "Sai rồi. Vì a = F/m, m ở mẫu số nên khi m tăng thì a phải giảm." },
        { id: "opt-2", text: "Giảm đi một nửa (a = a0 / 2)", isCorrect: true, explanation: "Đúng. Theo định luật 2 Newton, gia tốc tỉ lệ nghịch với khối lượng khi lực không đổi." },
        { id: "opt-3", text: "Không thay đổi (a = a0)", isCorrect: false, explanation: "Không đúng. Khối lượng là thước đo mức quán tính (độ ì), vật càng nặng thì gia tốc càng nhỏ." },
        { id: "opt-4", text: "Tăng gấp 4 lần", isCorrect: false, explanation: "Sai hoàn toàn. Quan hệ ở đây là tỉ lệ nghịch bậc nhất chứ không có bình phương." }
      ]
    },
    narration:
      "Câu hỏi tương tác hiện trên màn hình. Bạn chọn một đáp án mình cho là đúng.",
    start: 0,
    duration: 10,
  },
  {
    id: "sc-7",
    kind: "summary",
    accent: "brand",
    title: "Ghi nhớ",
    subtitle: "Ba điều cần mang theo",
    bullets: [
      "F = m·a là quan hệ vector, không phải phép nhân vô hướng đơn thuần",
      "Khối lượng = quán tính (kg); lực (N); gia tốc (m/s²)",
      "Luôn vẽ hình phân tích lực trước khi thay số",
    ],
    narration:
      "Ba điều cần nhớ: F bằng m nhân a theo vector, khối lượng là quán tính, và luôn vẽ hình trước khi thay số.",
    start: 0,
    duration: 7,
  },
  ],
};

const NEWTON_CHAPTERS = [
  { id: "ch-1", title: "Đặt vấn đề & khái niệm", start: 0, end: 14, sceneIds: ["sc-1", "sc-2"] },
  { id: "ch-2", title: "Công thức & phân tích lực", start: 14, end: 29, sceneIds: ["sc-3", "sc-4"] },
  {
    id: "ch-3",
    title: "Ví dụ, luyện tập & tổng kết",
    start: 29,
    end: 52,
    sceneIds: ["sc-5", "sc-6", "sc-7"],
  },
];

export const SAMPLE_LESSON: Lesson = relayoutLesson({
  ...NEWTON_DRAFT,
  duration: 0,
  chapters: NEWTON_CHAPTERS,
});

/** A second sample so the lesson picker is not a list of one. */
const OVERFIT_DRAFT: Omit<Lesson, "duration" | "chapters"> = {
  id: "sample-overfitting",
  title: "Overfitting trong học máy",
  subject: "Khoa học dữ liệu",
  grade: "Nhập môn AI",
  language: "vi",
  fps: 30,
  source: "sample",
  createdAt: "2026-01-01T00:00:00.000Z",
  scenes: [
    {
      id: "of-1",
      kind: "cover",
      accent: "brand",
      title: "Overfitting",
      subtitle: "Khi mô hình học thuộc lòng thay vì học hiểu",
      bullets: [
        "Mô hình đúng trên tập huấn luyện nhưng sai trên dữ liệu mới",
        "Mục tiêu: nhận diện dấu hiệu và biết cách chữa",
      ],
      narration: "Mô hình nhớ bài quá kỹ. Ta sẽ học cách nhận ra và chữa căn bệnh này.",
      start: 0,
      duration: 6,
    },
    {
      id: "of-2",
      kind: "concept",
      accent: "brand",
      title: "Ba đường cong cần nhớ",
      bullets: [
        "Underfit: mô hình quá đơn giản, sai ở cả hai tập",
        "Vừa đủ: khoảng cách train/validation nhỏ",
        "Overfit: train loss tiếp tục giảm, validation loss quay đầu tăng",
      ],
      narration: "Khoảng cách giữa hai đường đang nới rộng. Đó là lúc mô hình bắt đầu học nhiễu.",
      start: 0,
      duration: 8,
    },
    {
      id: "of-3",
      kind: "diagram",
      accent: "gold",
      title: "Chẩn đoán & cách chữa",
      bullets: [
        "Thêm dữ liệu hoặc tăng cường dữ liệu (augmentation)",
        "Giảm độ phức tạp / regularization (L2, dropout)",
        "Early stopping theo validation loss",
        "Cross-validation để con số đáng tin hơn",
      ],
      narration: "Bốn liều thuốc: thêm dữ liệu, giảm độ phức tạp, dừng sớm và kiểm định chéo.",
      start: 0,
      duration: 9,
    },
    {
      id: "of-4",
      kind: "quiz",
      accent: "gold",
      title: "Kiểm tra nhanh",
      bullets: [
        "Train loss = 0.01 nhưng validation loss = 1.2 và đang tăng. Chẩn đoán?",
        "Tua lại cảnh 2 để đối chiếu trước khi trả lời.",
      ],
      narration: "Đọc số liệu và tự chẩn đoán trước khi tua lại để đối chiếu.",
      start: 0,
      duration: 6,
    },
    {
      id: "of-5",
      kind: "summary",
      accent: "brand",
      title: "Ghi nhớ",
      bullets: [
        "Luôn theo dõi đường validation, không chỉ train loss",
        "Dừng đúng lúc rẻ hơn sửa một mô hình đã quá khớp",
      ],
      narration: "Theo dõi validation, và dừng đúng lúc.",
      start: 0,
      duration: 6,
    },
  ],
};

export const SAMPLE_LESSON_OVERFIT: Lesson = relayoutLesson({
  ...OVERFIT_DRAFT,
  duration: 0,
  chapters: [],
});

export const SAMPLE_LESSONS: Lesson[] = [SAMPLE_LESSON, SAMPLE_LESSON_OVERFIT];

export function findSampleLesson(id: string | null | undefined): Lesson {
  return SAMPLE_LESSONS.find((lesson) => lesson.id === id) ?? SAMPLE_LESSON;
}
