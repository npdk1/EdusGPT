export interface TutorialStep {
  id: string;
  route: string;
  targetSelector?: string;
  pointerPlacement?: "top" | "bottom" | "left" | "right" | "center";
  title: {
    vi: string;
    en: string;
  };
  description: {
    vi: string;
    en: string;
  };
  highlightHint?: {
    vi: string;
    en: string;
  };
  badge?: {
    vi: string;
    en: string;
  };
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    route: "/library",
    targetSelector: '[data-tour="logo"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Chào mừng",
      en: "Welcome",
    },
    title: {
      vi: "Chào mừng bạn đến với EdusGPT! 👋",
      en: "Welcome to EdusGPT! 👋",
    },
    description: {
      vi: "Nền tảng bài giảng AI tương tác thông minh, tua được từng giây và chạy hoàn toàn trên máy bạn. Hãy cùng dạo một vòng hướng dẫn nhanh trong 1 phút nhé!",
      en: "An interactive AI lesson platform you can scrub second by second, running completely on your device. Let's take a quick 1-minute walkthrough!",
    },
    highlightHint: {
      vi: "Nhấp logo để về Thư viện bất kỳ lúc nào",
      en: "Click logo to return to Library anytime",
    },
  },
  {
    id: "streak",
    route: "/library",
    targetSelector: '[data-tour="streak"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Chuỗi học tập & XP",
      en: "Gamification",
    },
    title: {
      vi: "Chuỗi ngày học (Streak) & Thăng cấp 🏆",
      en: "Learning Streak & Level Up 🏆",
    },
    description: {
      vi: "Mỗi ngày bạn học bài và trả lời trắc nghiệm, hệ thống sẽ duy trì Chuỗi ngày (Streak 🔥) và cộng điểm kinh nghiệm (XP) để thăng cấp. Bấm vào đây để xem chi tiết thành tích!",
      en: "Every day you study and complete quizzes, you build your Streak 🔥 and earn XP to level up. Click here to view your achievements!",
    },
    highlightHint: {
      vi: "Theo dõi chuỗi ngày và level cá nhân",
      en: "Track your streak and player level",
    },
  },
  {
    id: "library",
    route: "/library",
    targetSelector: '[data-tour="library-filter"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Thư viện bài học",
      en: "Course Library",
    },
    title: {
      vi: "Quản lý bài giảng & Bộ lọc môn học 📚",
      en: "Manage Lessons & Filter by Subject 📚",
    },
    description: {
      vi: "Tất cả bài giảng bạn tạo hoặc có sẵn được lưu tại đây. Bạn có thể lọc nhanh theo môn học (Toán, Lý, Hóa, Sinh, Sử, Anh...), tìm kiếm và tiếp tục học ngay các bài đang dang dở.",
      en: "All lessons created or available are stored here. Filter quickly by subject (Math, Physics, Chemistry, Biology, History...), search, and resume where you left off.",
    },
    highlightHint: {
      vi: "Lọc nhanh bài giảng theo môn học",
      en: "Quick filter lessons by subject",
    },
  },
  {
    id: "lesson-player",
    route: "/lesson",
    targetSelector: '[data-tour="player-scrubbar"]',
    pointerPlacement: "top",
    badge: {
      vi: "Coi bài giảng",
      en: "Watch Lesson",
    },
    title: {
      vi: "Trình phát bài giảng tua từng giây ⏱️",
      en: "YouTube-Style Precision Scrubbing ⏱️",
    },
    description: {
      vi: "Xem bài giảng với giao diện chuẩn YouTube: tua chính xác từng giây trên timeline đỏ, giọng đọc AI đồng bộ từng chữ, xem danh sách chương, lặp đoạn khó A→B và giải câu đố trắc nghiệm giữa bài.",
      en: "Watch lessons YouTube-style: scrub second by second on the red timeline, listen to AI narration synced with captions, view chapter list, loop A→B, and take checkpoint quizzes.",
    },
    highlightHint: {
      vi: "Rê chuột trên thanh timeline đỏ để tua bài",
      en: "Hover and drag on the red scrubbar to seek",
    },
  },
  {
    id: "studio-core",
    route: "/studio",
    targetSelector: '[data-tour="studio-topic"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Tạo bài giảng",
      en: "Create Lesson",
    },
    title: {
      vi: "Soạn bài giảng AI siêu tốc ✨",
      en: "Instant AI Lesson Creator ✨",
    },
    description: {
      vi: "Chỉ cần viết chủ đề bạn muốn dạy, chọn phong cách (Chữ to, Ảnh minh họa, Slide lớp học, Phim ảnh), chọn độ dài (1-2p, 6-10p, 45-60p) và thả tài liệu PDF/Word vào nếu có.",
      en: "Simply type the topic you want to teach, select a presentation style (Minimalist, Visual Story, Classroom, Cinematic), choose duration, and drop your PDF/Word docs if available.",
    },
    highlightHint: {
      vi: "Nhập chủ đề kiến thức bạn muốn dạy",
      en: "Type the lesson topic you want to teach",
    },
  },
  {
    id: "studio-advanced",
    route: "/studio",
    targetSelector: '[data-tour="advanced-settings"]',
    pointerPlacement: "top",
    badge: {
      vi: "Cài đặt nâng cao",
      en: "Advanced Settings",
    },
    title: {
      vi: "Tùy chọn nâng cao & Thuật toán Quiz ⚙️",
      en: "Advanced Settings & Quiz Algorithm ⚙️",
    },
    description: {
      vi: "Mở rộng tùy chọn nâng cao để cấu hình: Thuật toán Quiz (đặt số câu tối thiểu/tối đa, chia chặng), 42 bảng màu nền slide, họa tiết trang trí, hiệu ứng trồi lên/mờ dần và con trỏ laser dẫn đọc.",
      en: "Expand advanced settings to configure: Quiz algorithm (set min/max questions, checkpoint sizes), 42 slide themes, patterns, entrance animations, and presentation pointer.",
    },
    highlightHint: {
      vi: "Nhấp để mở rộng và tùy biến sâu câu hỏi Quiz",
      en: "Click to expand and customize Quiz questions",
    },
  },
  {
    id: "setup",
    route: "/setup",
    targetSelector: '[data-tour="setup-key"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Cài đặt AI",
      en: "Setup & API Keys",
    },
    title: {
      vi: "Cài đặt API Key & Nguồn AI 🔑",
      en: "API Key & AI Providers 🔑",
    },
    description: {
      vi: "Sử dụng nguồn AI Stealth miễn phí tích hợp sẵn (tự động luân chuyển 5 chìa khóa không lo giới hạn) hoặc tự cấu hình các nguồn AI khác (Groq, OpenAI, Gemini...). Tất cả dữ liệu đều được bảo mật an toàn trên máy bạn.",
      en: "Use the built-in free Stealth AI provider (with auto-rotating 5 API keys so you never hit limits) or configure your own providers (Groq, OpenAI, Gemini...). All data is safely stored on your device.",
    },
    highlightHint: {
      vi: "Quản lý khóa AI và mô hình đang dùng",
      en: "Manage AI keys and active models",
    },
  },
  {
    id: "finish",
    route: "/library",
    targetSelector: '[data-tour="header-cta"]',
    pointerPlacement: "bottom",
    badge: {
      vi: "Hoàn tất",
      en: "Ready to Learn",
    },
    title: {
      vi: "Bạn đã sẵn sàng trải nghiệm! 🎉",
      en: "You Are All Set! 🎉",
    },
    description: {
      vi: "Bây giờ bạn đã nắm trọn cách sử dụng EdusGPT. Hãy bắt đầu tạo bài giảng đầu tiên hoặc luyện tập với các bài giảng có sẵn trong Thư viện nhé!",
      en: "You now know all the key features of EdusGPT. Start by generating your first lesson or practice with the sample lessons in the Library!",
    },
    highlightHint: {
      vi: "Nhấn nút này để bắt đầu tạo bài giảng",
      en: "Click here anytime to create a new lesson",
    },
  },
];
