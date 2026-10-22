<p align="center">
  <img src="public/logo.png" width="120" alt="Logo EdusGPT" />
</p>

<h1 align="center">EdusGPT</h1>

<p align="center">
  <strong>Biến mọi chủ đề hoặc tài liệu thành bài giảng tương tác có thuyết minh sinh động —</strong><br />
  kèm slide động 60 FPS, giọng đọc tiếng Việt, phụ đề karaoke sáng theo từng chữ, công thức toán học KaTeX sắc nét, trắc nghiệm tương tác ngắt nhịp, thẻ ghi nhớ 3D, mã hóa bảo mật Latin-Trung Quốc và xuất file HTML độc lập học offline.
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Tiếng Việt</strong> · <a href="README.html">Bản hướng dẫn HTML trực quan</a>
</p>

<p align="center">
  <a href="https://github.com/npdk1/EdusGPT"><img src="https://img.shields.io/badge/source-GitHub-0b63e5?logo=github" alt="Mã nguồn trên GitHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="Giấy phép MIT" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux" />
  <img src="https://img.shields.io/badge/Next.js-16.3.6-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/GSAP-3.15-88CE02?logo=greensock" alt="GSAP" />
</p>

---

## 🎬 Video Giới thiệu Sản phẩm (`intro.mp4`)

Mời bạn theo dõi video giới thiệu chính thức 30 giây khám phá toàn cảnh hệ sinh thái EdusGPT:

<div align="center">
  <a href="public_html/video/intro.mp4" target="_blank" title="Nhấp để xem Video Full HD 60 FPS có âm thanh">
    <img src="public_html/assets/intro-preview.gif" alt="EdusGPT Product Tour Preview" width="100%" style="max-width: 880px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #334155;" />
  </a>
  <p align="center">
    🎬 <b><a href="public_html/video/intro.mp4">▶️ Nhấp vào đây để xem / tải Video Full HD 60 FPS có âm thanh (intro.mp4)</a></b> &nbsp;•&nbsp; 
    🌐 <b><a href="README.html">Mở bản Interactive HTML Guide</a></b>
  </p>
</div>

### ⏱️ Bảng Phân đoạn & Khung hình Đồng bộ Chi tiết (Frame-by-Frame)

Video giới thiệu được quay và dựng chuẩn **60 FPS** độ phân giải Full HD (1920×1080). Mỗi mốc thời gian đại diện cho một trụ cột công nghệ then chốt của EdusGPT:

| Mốc thời gian | Khung hình | Phân đoạn video | Tính năng kỹ thuật & Cấu trúc hệ thống |
|:---:|:---:|:---|:---|
| **`00:00 - 00:02.4`** | `frame_01` | `// 01 - hook` | **Mascot EdusGPT Teacher**: Chú robot giáo viên phong cách dithered pixel art cổ điển kết hợp typography editorial sang trọng chào đón người học. |
| **`00:02.4 - 00:05.0`** | `frame_04` | `// 02 - capabilities` | **AI Studio (`/studio`)**: Tự động sinh Smart Slides đa giác quan từ tệp tài liệu PDF, Word DOCX, bảng tính Excel hoặc ghi chú ngắn qua quy trình streaming hai giai đoạn. |
| **`00:05.0 - 00:09.0`** | `frame_07` | `// 03 - interactive deck` | **Trình phát bài giảng (`/lesson`)**: Biến bài học thành live deck tương tác, đồng bộ giọng đọc thuyết minh và phụ đề karaoke sáng từng chữ với độ chính xác mili-giây. |
| **`00:09.0 - 00:12.0`** | `frame_10` | `// 04a - 3D flashcards` | **Thẻ nhớ chủ động 3D (`/flashcard`)**: Không gian lật thẻ 3D trực quan, phóng to công thức toán học và điều hướng phím tắt thông minh theo chu trình lặp lại ngắt quãng (Spaced Repetition). |
| **`00:12.0 - 00:15.0`** | `frame_12` | `// 04b - real-time quiz` | **Trắc nghiệm tương tác ngắt nhịp (`/quiz`)**: Bộ câu hỏi trắc nghiệm kiểm tra tức thì, tự động dừng bài giảng, chấm điểm trực tiếp và giải thích chi tiết trước khi học tiếp. |
| **`00:15.0 - 00:21.2`** | `frame_18` | `// 05 - orchestrated` | **Hệ sinh thái Bento**: Bảng điều khiển toàn diện gồm Smart Player 60 FPS, Trợ giảng AI on-air, KaTeX Math Engine thời gian thực và công cụ xuất file HTML độc lập. |
| **`00:21.2 - 00:25.0`** | `frame_23` | `// 06 - flow` | **"You teach. We deliver."**: Không cần database đám mây, không thu thập dữ liệu cá nhân, lưu trữ cục bộ bảo vệ bằng kho mã hóa kép Latin - Trung Quốc. |
| **`00:25.0 - 00:30.0`** | `frame_28` | `// 07 - outro & CTA` | **Lời kết & Kêu gọi hành động**: "Interactive learning decks that you deserve." Nền tảng mở, hoàn toàn miễn phí và chạy offline 100%. |

---

## 🌟 Tính năng nổi bật

- 🎙️ **Thuyết minh & Phụ đề Karaoke đồng bộ thời gian thực**: Tích hợp Microsoft Edge Neural TTS, Piper offline và VieNeu; phụ đề sáng rõ từng chữ theo nhịp đọc sư phạm chuẩn mực, không bao giờ bị lệch tiếng hay trôi chữ.
- 📐 **Động cơ Toán học KaTeX nâng cấp toàn diện**: Hỗ trợ đầy đủ biểu thức nội dòng `$ ... $` và công thức khối `$$ ... $$` trên slide, câu hỏi trắc nghiệm, các phương án A-B-C-D và khung trò chuyện trợ giảng. Hỗ trợ hệ phương trình lồng căn, phân thức nhiều tầng và công thức dài đến 1.000 ký tự mà không bị cắt xén.
- 🧩 **Ngân hàng câu hỏi trắc nghiệm đa tầng (Quiz Banks)**: Mỗi slide kiểm tra có thể chứa từ 4 đến 6 câu hỏi liên tiếp, giải thích tường tận từng đáp án. Các bài giảng chuyên sâu 45–60 phút sở hữu ngân hàng hơn 25 câu hỏi trắc nghiệm bám sát đề thi THPT Quốc gia.
- 🎴 **Thẻ ghi nhớ không gian 3D (Active Recall Flashcards)**: Lật thẻ 3D mượt mà kèm phát âm thanh, phóng to công thức và hỗ trợ phím tắt (`Phím cách` để lật, `←` / `→` để chuyển thẻ).
- 🔐 **Kho mã hóa siêu bảo mật Latin - Trung Quốc (Chinese-Latin Cipher V1)**: Toàn bộ khóa học lưu trong `data/courses/` và bộ nhớ đệm âm thanh `data/tts-cache/` được bảo vệ bằng thuật toán AES-256-GCM kết hợp hoán vị xen kẽ chữ Hán CJK và chữ cái Latin (`EDUS_ZH_LATIN_CIPHER_V1`). Chỉ duy nhất EdusGPT mới có thể giải mã và chỉnh sửa.
- ⚙️ **Bảng điều khiển Cài đặt & Tối ưu dung lượng trong Thư viện (`/library`)**:
  - **Tối ưu dung lượng (Trim)**: Tự động gọt bỏ các slide bài giảng và tệp âm thanh nặng, tiết kiệm đến 90% dung lượng ổ đĩa trong khi vẫn giữ nguyên vẹn 100% ngân hàng câu hỏi Quiz và Flashcards để ôn thi.
  - **Quản lý xóa an toàn**: Lựa chọn giữa di chuyển bài học vào Thùng rác (`data/temp_delete/`) để có thể khôi phục bất cứ lúc nào hoặc Xóa vĩnh viễn khỏi máy.
- 🌐 **Xuất file HTML độc lập (Single HTML Player)**: Đóng gói toàn bộ bài giảng, âm thanh base64 và engine GSAP vào 1 file `.html` duy nhất — mở xem ngay trên mọi trình duyệt mà không cần cài đặt Node.js hay server.
- 🔍 **Tìm kiếm & Chuyển bài học tức thì**: Thanh công cụ Player tích hợp menu tìm kiếm bài học từ thư viện cục bộ theo tên, môn học, khối lớp với huy hiệu trực quan (`Thư viện`, `Mẫu`, `Đang phát`).

---

## 🚀 Hướng dẫn Chạy Nhanh

### Windows:
Nhấp đúp vào `run.bat`.

### macOS hoặc Linux:
```bash
chmod +x run.sh
./run.sh
```

Cả hai script tự động kiểm tra Node từ bản 22, tự chạy `npm install` khi thiếu `node_modules`, tạo `.env` từ `.env.example`, giải phóng cổng 3000 khi bị chiếm dụng, mở trình duyệt rồi khởi động server. Trên Windows, `run.bat` sở hữu giao diện màu ANSI hiện đại với thanh tiến trình trực quan 7 giai đoạn. Bấm `Ctrl+C` trong cửa sổ console để dừng.

### Chạy thủ công:
```bash
npm install
npm run dev          # Truy cập tại http://localhost:3000
```

### Kiểm tra sức khỏe runtime:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

---

## 🔑 Cài đặt AI & API Key

Mở trang `/setup` trên trình duyệt. EdusGPT hỗ trợ hai chế độ linh hoạt:

1. **API Đám mây (Chuẩn OpenAI-Compatible)**:
   - **Groq** (`console.groq.com`): Tốc độ sinh siêu nhanh với Llama 3.3 70B.
   - **NVIDIA NIM** (`build.nvidia.com`): Miễn phí hạn mức cao với DeepSeek-R1 và Llama 3.
   - **Token Harbor**: Cổng kết nối đa mô hình.
   - Dán key vào ô tương ứng, bấm **Kiểm tra Key** rồi Lưu. Key được lưu an toàn trong file `.env` (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `TOKENHARBOR_API_KEY`) và giao diện luôn che mờ key.
2. **AI Cục bộ qua Antigravity CLI (Không tốn tiền API)**:
   - **Antigravity CLI (`agy`)**: Đọc trực tiếp thư mục tài liệu sách giáo khoa trên máy bạn, tự động học và sinh bài giảng chuyên sâu mà không tốn chi phí gọi API. Xem chi tiết tại `docs/ANTIGRAVITY.md`.

---

## 🎨 Studio: Soạn Bài Giảng Thông Minh

Mở `/studio` và tùy biến bài học của bạn:
- **Thông tin bài**: Nhập chủ đề, chọn môn học (Toán, Lý, Hóa, Sinh, Tin học, Lịch sử, Ngữ văn, Tiếng Anh) và khối lớp (Lớp 1–12, Đại học).
- **Đính kèm tài liệu**: Đính kèm tệp PDF, Word DOCX, Excel XLSX hoặc dán trực tiếp văn bản ghi chú (tối đa 40 MB mỗi tệp).
- **Cấu hình thời lượng**:
  - `Thấp` (3–5 slides, 1–2 phút): Tóm tắt khái niệm nhanh, khởi động đầu giờ.
  - `Trung bình` (10–16 slides, 6–10 phút): Bài giảng chuẩn tiết học chuyên đề.
  - `Cao` (60–95 slides, 45–60 phút): Giáo trình toàn diện nguyên chương với ngân hàng hơn 25 câu hỏi trắc nghiệm ôn thi.
- **Phong cách trực quan**: Tối giản, Kể chuyện hình ảnh, Bảng phấn lớp học, Điện ảnh hiện đại.
- **Giọng đọc**: Giọng thuyết minh tiếng Việt chuẩn (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural` tùy chỉnh tốc độ) hoặc giọng Piper offline.

---

## 🎮 Phím Tắt Điều Khiển Trình Phát Bài Giảng

Mở `/lesson` để bắt đầu học tập:

| Phím bấm | Chức năng điều khiển |
|:---:|:---|
| `Space` / `K` | Phát hoặc tạm dừng bài giảng |
| `←` / `→` | Tua lùi / tiến 5 giây |
| `J` / `L` | Tua lùi / tiến 10 giây |
| `Shift + ←/→` | Tua chính xác từng 1 giây |
| `,` / `.` | Tiến / lùi chính xác từng khung hình (`1/fps`) |
| `0` – `9` | Nhảy nhanh tới 0% – 90% thời lượng bài học |
| `Home` / `End` | Về đầu bài / đến cuối bài giảng |
| `[` / `]` / `\` | Đặt điểm lặp A, đặt điểm lặp B, bật/tắt chế độ lặp đoạn |
| `−` / `+` | Giảm / tăng tốc độ giọng đọc thuyết minh (0.8× – 2.0×) |
| `F` | Bật / tắt chế độ toàn màn hình |
| `?` | Mở bảng tra cứu phím tắt tương tác |

---

## 📁 Cấu Trúc Dự Án

```
├── data/
│   ├── courses/          # File bài giảng mã hóa (*.json với chuẩn Latin-Trung Quốc)
│   ├── temp_delete/      # Thư mục thùng rác lưu các bài xóa tạm
│   └── tts-cache/        # Bộ nhớ đệm âm thanh mã hóa (*.mp3, *.words.json)
├── public/               # Tài nguyên tĩnh, logo nhận diện, huy hiệu AI
├── public_html/          # Trang giới thiệu tĩnh hiệu năng cao
│   ├── index.html        # Landing page tích hợp video intro đồng bộ thời gian thực
│   └── video/intro.mp4   # Video Full HD 60 FPS giới thiệu sản phẩm chính thức
├── scripts/
│   ├── audit-all-curriculum.mjs  # Công cụ audit tự động 100% KaTeX & dữ liệu
│   ├── check-*.mjs               # Bộ 7 script kiểm thử chất lượng (palette, icons, quiz...)
│   └── curriculum/               # Các module sinh giáo trình bài bản
├── src/
│   ├── app/              # Next.js 16 App Router (/studio, /lesson, /library, /quiz...)
│   ├── components/       # Giao diện Player, Studio, Library, Quiz và Flashcard
│   │   ├── library/      # CourseCards và CourseSettingsModal (Gọt bài & Xóa)
│   │   └── player/       # GsapSlideStage, KaraokeSubtitle, SceneFigure, KaTeX
│   └── lib/
│       ├── ai/           # Bộ chuyển đổi LLM (OpenAI-compatible, Groq, NVIDIA, Antigravity)
│       ├── lesson/       # Schema bài học, parser LaTeX nội dòng, validation
│       └── server/       # Quản lý file course-store, tts-cache và crypto-vault.ts
├── run.bat / run.sh      # Script khởi chạy một chạm
└── uninstall.bat         # Trình dọn dẹp cache và gỡ cài đặt tương tác
```

---

## 🧪 Hệ Thống Kiểm Thử Chất Lượng Toàn Diện

Mọi thay đổi trong EdusGPT đều phải vượt qua bộ kiểm thử tự động nghiêm ngặt:

```bash
# Chạy toàn bộ kiểm thử xác thực (7 bài test + kiểm tra TypeScript strict)
npm run verify

# Từng bài kiểm tra riêng lẻ
npm run check:palette     # Kiểm tra quy chuẩn bảng màu sắc nét (cấm họ màu tím)
npm run check:icons       # Xác thực toàn bộ 89 icon slide khớp với thư viện Lucide
npm run check:subtitle    # Kiểm tra đồng bộ phụ đề karaoke sáng theo từng chữ
npm run check:length      # Xác thực số lượng slide và độ dài 3 preset (ngắn, vừa, dài)
npm run check:pace        # Kiểm định nhịp đọc âm thanh và tính đồng đều sư phạm
npm run check:quiz        # Kiểm tra cơ chế dừng bài giảng và tính điểm trắc nghiệm
npm run typecheck         # Kiểm tra tính toàn vẹn kiểu dữ liệu TypeScript (tsc --noEmit)
npm run build             # Biên dịch đóng gói sản phẩm Turbopack Next.js
```

---

## 📄 Giấy Phép Sử Dụng

Phát hành theo **Giấy phép MIT**. Tác giả: [npdk1](https://github.com/npdk1/EdusGPT).
