<p align="center">
  <img src="public/logo.png" width="120" alt="Logo EdusGPT" />
</p>

<h1 align="center">EdusGPT</h1>

<p align="center">
  Biến mọi chủ đề hoặc tài liệu thành bài giảng tương tác có thuyết minh —<br />
  kèm slide động, giọng đọc tiếng Việt, phụ đề karaoke sáng theo từng chữ, công thức toán KaTeX, trắc nghiệm tương tác và xuất file HTML độc lập.
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Tiếng Việt</strong> · <a href="README.html">Bản hướng dẫn HTML</a>
</p>

<p align="center">
  <a href="https://github.com/npdk1/EdusGPT"><img src="https://img.shields.io/badge/source-GitHub-0b63e5?logo=github" alt="Mã nguồn trên GitHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="Giấy phép MIT" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux" />
  <img src="https://img.shields.io/badge/Next.js-16.3.6-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
</p>

Bạn đã chán ngấy việc đọc những đoạn văn bản dài dằng dặc từ chatbot AI? EdusGPT được thiết kế cho học sinh, sinh viên, người tự học và giảng viên để biến các tài liệu khô khan thành bài giảng đa giác quan sinh động. Mở bài trong trình phát, tua tới lui mượt mà từng giây, ôn tập qua trắc nghiệm và thẻ nhớ 3D, rồi xuất thành một file HTML độc lập để học offline mọi lúc mọi nơi. Toàn bộ hệ thống chạy trực tiếp trên máy của bạn tại `localhost:3000` — không cần Docker, không cần cơ sở dữ liệu đám mây.

## Tính năng nổi bật

- 🎙️ **Thuyết minh & Phụ đề Karaoke đồng bộ**: Tích hợp Microsoft Edge Neural TTS, Piper offline và VieNeu; phụ đề sáng rõ từng chữ theo thời gian thực với nhịp đọc sư phạm chuẩn mực.
- 📐 **Hiển thị công thức Toán học KaTeX**: Hỗ trợ đầy đủ cú pháp `$ ... $` (nội dòng) và `$$ ... $$` (khối) trên slide, câu hỏi trắc nghiệm, các lựa chọn đáp án và hội thoại trợ giảng.
- 🧩 **Trắc nghiệm tương tác ngắt nhịp (Quiz Gates)**: Tự động dừng bài giảng để người học thực hành, chấm điểm trực tiếp và giải thích chi tiết trước khi tiếp tục.
- 🎴 **Thẻ nhớ chủ động 3D (Active Recall Flashcards)**: Không gian học tập trực quan kèm giọng đọc, phóng to công thức và điều hướng phím tắt.
- 🌐 **Xuất file HTML độc lập (Standalone Player)**: Đóng gói toàn bộ bài học, âm thanh base64 và engine phát GSAP vào 1 file `.html` duy nhất — mở xem ngay trên trình duyệt mà không cần cài đặt server hay database.
- 🔍 **Tìm kiếm & Chuyển bài trực tiếp trong Thư viện**: Thanh công cụ Player tích hợp menu tìm kiếm bài học từ `data/courses/` theo tiêu đề, môn, lớp với huy hiệu trực quan (`Thư viện`, `Mẫu`, `Đang phát`).

## Chạy nhanh

Windows: nhấp đúp vào `run.bat`.

macOS hoặc Linux: `./run.sh`

Cả hai script tự động kiểm tra Node từ bản 22, tự chạy `npm install` khi thiếu
`node_modules`, tạo `.env` từ `.env.example` khi chưa có, giải phóng cổng 3000
khi bị chiếm, mở trình duyệt rồi khởi động server. Trên Windows, `run.bat` sở hữu
giao diện màu ANSI hiện đại với thanh tiến trình trực quan 7 giai đoạn và tự động
thiết lập môi trường `.runtime/` portable. Bấm `Ctrl+C` trong console để dừng.

Chạy thủ công:

```bash
npm install
npm run dev          # http://localhost:3000
```

Kiểm tra trạng thái runtime khi server đang mở:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

## Cài đặt API key

Mở `/setup`. Trang cấu hình chia làm hai nhóm:

- **Cloud** — gọi API qua mạng, cần key. Groq, NVIDIA và Token Harbor đều sử dụng
  giao thức chuẩn OpenAI chat-completions, chia sẻ chung adapter trong
  `src/lib/ai/openai-compatible.ts`. Thêm hãng mới chỉ cần khai báo một mục trong `PROVIDERS`.
- **CLI** — điều khiển agent AI cục bộ trên máy, hoàn toàn không cần API key đám mây.
  Antigravity CLI (`agy`) được hỗ trợ đầy đủ — tự động đọc và học từ thư mục tài liệu
  tham khảo của bạn, xem chi tiết tại `docs/ANTIGRAVITY.md`.

Nhận key miễn phí tại `console.groq.com/keys` (Groq) hoặc `build.nvidia.com` (NVIDIA).
Cả hai hãng đều cung cấp gói miễn phí không cần thẻ tín dụng, giúp chuyển đổi dự phòng
mượt mà khi một bên chạm giới hạn quota. Dán key vào ô tương ứng, bấm kiểm tra rồi lưu.
Server lưu key an toàn vào file `.env` (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `TOKENHARBOR_API_KEY`)
và giao diện luôn che mờ key.

Lưu ý về gói miễn phí: Mỗi hãng có quy định giới hạn riêng. Groq giới hạn token và request
theo từng model, trong khi NVIDIA giới hạn số request trên mỗi phút. Gói cloud miễn phí
rất thích hợp cho các bài giảng ngắn, câu hỏi trắc nghiệm và trợ giảng. Để tạo bài giảng
chuyên sâu từ tài liệu học tập lớn, khuyến nghị sử dụng nhóm CLI Antigravity.

Danh sách model được nạp độc lập theo từng hãng. Các API quản trị key chỉ chấp nhận
request từ `localhost`. Nếu muốn mở quyền quản trị trong mạng nội bộ, hãy đặt
`ALLOW_REMOTE_KEY_ADMIN=true`.

## Sinh bài giảng

Mở `/studio` và nhập chủ đề, môn học, khối lớp, số cảnh, thời lượng và ghi chú.
Bạn có thể đính kèm tài liệu tham khảo (`pdf`, `docx`, `xlsx`, `txt`, `md`, `csv`,
`json`, tối đa 40 MB mỗi tệp) hoặc dán trực tiếp văn bản. Server trích xuất nội dung,
giữ nguyên cấu trúc phân đoạn và đưa các phần trọng tâm vào pipeline tạo bài.

Tiến trình tạo bài diễn ra qua hai bước và hiển thị trực tiếp (streaming):

1. **Lên dàn ý** — tạo tiêu đề, thể loại và thời lượng từng cảnh, xuất hiện chỉ sau vài giây.
2. **Soạn chi tiết** — từng cảnh được sinh độc lập và hiển thị ngay trên màn hình xem trước.
   Nếu một cảnh gặp sự cố mạng, cảnh đó sẽ giữ khung dàn ý tối giản — toàn bộ bài giảng không bao giờ bị gián đoạn.

Các thể loại cảnh bao gồm: gạch đầu dòng, công thức toán học KaTeX, bảng số liệu,
đồ thị hàm số, các bước giải mẫu có đánh số (B1, B2…), câu hỏi trắc nghiệm, ảnh minh họa AI
và mô phỏng 3D. Lời thuyết minh được tối ưu thành các câu đàm thoại tự nhiên, chuẩn ngữ âm sư phạm.

Tùy chọn khi tạo bài:

- Kiểu trình bày: tối giản (minimal), câu chuyện hình ảnh (visual story), lớp học (classroom), điện ảnh (cinematic).
- Độ dài bài: ngắn (3–5 cảnh, 1–2 phút), vừa (10–16 cảnh, 6–10 phút), dài (60–95 cảnh, 45–60 phút).
- Giọng đọc: Giọng tiếng Việt chuẩn (Hoài My, Nam Minh với các nhịp điệu tùy chỉnh), Piper offline, hoặc VieNeu.
- Minh họa: AI tự vẽ ảnh cho từng cảnh qua `pollinations.ai` (hoàn toàn miễn phí, không cần key).
- Con trỏ giảng viên: Chấm sáng nổi bật bám sát theo từng câu đang đọc, tự động bật theo mặc định.

Bài giảng hoàn thành được lưu tự động vào `data/courses/` và có thể mở ngay trên trình phát.

## Trình phát & Học tập tương tác

Mở `/lesson`. Thanh công cụ phía trên tích hợp ô tìm kiếm bài giảng trực tiếp từ thư viện
máy tính (`data/courses/`), đi kèm huy hiệu phân loại trực quan (`Thư viện`, `Mẫu`, `Đang phát`).

| Phím tắt | Chức năng |
| -------- | --------- |
| `Space`, `K` | Phát hoặc tạm dừng |
| `←`, `→` | Tua lui hoặc tới 5 giây |
| `J`, `L` | Tua lui hoặc tới 10 giây |
| `Shift + ←/→` | Tua chậm 1 giây |
| `,`, `.` | Lùi hoặc tiến đúng 1 khung hình |
| `0` đến `9` | Nhảy nhanh tới 0% – 90% thời lượng |
| `Home`, `End` | Về đầu hoặc tới cuối bài |
| `[`, `]`, `\` | Đặt mốc A, đặt mốc B, bật/tắt lặp đoạn |
| `−`, `+` | Giảm hoặc tăng tốc độ phát |
| `F`, `?` | Bật toàn màn hình, xem bảng phím tắt |

Slide không phải là video quay sẵn mà là một timeline thời gian thực do GSAP điều khiển:
tua tới giây thứ 3.5 sẽ tái hiện chính xác trạng thái DOM, vị trí highlight phụ đề và khung hình chuyển động.

### Các định dạng xuất bài giảng

- 🌐 **Xuất file HTML độc lập** (`/api/export/html`): Gói gọn toàn bộ slide, mã nguồn GSAP, bộ dựng toán KaTeX và dữ liệu âm thanh base64 vào 1 file `.html` duy nhất. Nhấp đúp mở bằng mọi trình duyệt là xem và tương tác được ngay, không cần web server hay cơ sở dữ liệu.
- 📝 **Xuất phụ đề SRT** (`/api/export/srt`): Tải file phụ đề chuẩn SRT với độ chính xác theo từng chữ, hỗ trợ cả chế độ câu liên tục và chế độ theo dòng thời gian.
- 📦 **Xuất kịch bản JSON** (`/api/export/json`): Tải file cấu trúc dữ liệu bài học để lưu trữ hoặc tích hợp vào các hệ thống khác.

Trợ giảng AI nằm cạnh ngăn mục lục, sẵn sàng giải đáp thắc mắc liên quan trực tiếp đến cảnh đang học với định dạng công thức toán đầy đủ. Bạn cũng có thể nhấp vào bất kỳ công thức hoặc đồ thị nào trên slide để phóng to.

## Thư viện bài giảng

Mở `/library`. Toàn bộ bài đã lưu được lưu dưới dạng file JSON dễ đọc trong thư mục
`data/courses/` trên ổ cứng. Mỗi thẻ bài cung cấp nút phát ngay, xem mã JSON và nút xóa.
Cơ chế ghi file nguyên tử (`.tmp` $\to$ `.json`) đảm bảo không bị hỏng file khi mất điện đột ngột.

## Giọng đọc & TTS Offline

Giọng đọc được tổng hợp tự động trên server, không cần thuê dịch vụ ngoài.
Âm thanh được lưu đệm (cache) theo từng câu tại `data/tts-cache/`, giúp các lần phát lại
diễn ra tức thì mà không tốn tài nguyên tính toán. Bạn có thể xóa thư mục này bất cứ lúc nào
để giải phóng dung lượng ổ cứng. Ứng dụng cũng hỗ trợ công cụ tổng hợp giọng đọc offline
qua Piper (`scripts/local-voice/piper_speak.py`) cho các môi trường biệt lập không có Internet.

## Dọn dẹp & Reset hệ thống

`uninstall.bat` cung cấp menu chọn lọc thông minh với màu sắc ANSI trực quan:

1. **Dọn Cache & Build**: Xóa `.next/`, `data/tts-cache/` và file rác mà vẫn giữ lại bài giảng và thư viện packages.
2. **Gỡ bỏ Runtime**: Xóa thư mục `.runtime/` (Node portable, Python venv, model giọng đọc).
3. **Reset sạch sẽ**: Xác nhận trước khi dọn `node_modules/`, `.next/`, `.runtime/`, cache âm thanh và bài giảng đã tạo.
   Toàn bộ mã nguồn dự án, file `.env` chứa API key và logo luôn được bảo vệ an toàn tuyệt đối.

Sau khi dọn dẹp, bạn chỉ cần mở lại `run.bat` để tự động thiết lập lại từ đầu.

## Kiểm tra chất lượng

| Lệnh kiểm tra | Ý nghĩa |
| ------------- | ------- |
| `npm run typecheck` | `tsc --noEmit` kiểm tra TypeScript nghiêm ngặt |
| `npm run check:palette` | Đảm bảo bảng màu obsidian (chặn triệt để màu họ tím trong `src/`) |
| `npm run check:icons` | Đảm bảo mọi tên icon trên slide đều có thật trong Lucide |
| `npm run check:subtitle` | Kiểm tra độ khớp thời gian từng từ của phụ đề karaoke |
| `npm run check:length` | Kiểm tra tính khả thi của 3 preset thời lượng với nhịp đọc thật |
| `npm run check:pace` | Đảm bảo tốc độ phát giọng đọc ổn định ở mức 1× chuẩn sư phạm |
| `npm run check:quiz` | Kiểm tra cơ chế dừng bài khi gặp câu hỏi trắc nghiệm và thời gian đọc giải thích |
| `npm run verify` | Chạy toàn bộ 7 bài kiểm tra trên kết hợp typecheck |
| `npm run build`, `npm start` | Biên dịch và chạy thử bản production với Turbopack |
| `powershell -File scripts/smoke-test.ps1` | Kiểm thử runtime toàn diện khi server đang chạy |
| `node scripts/verify-export.mjs exported.html` | Thẩm định tính hợp lệ của file HTML xuất ra |
| `node scripts/generate-sample.mjs "Chủ đề"` | Tạo bài giảng mẫu trực tiếp từ dòng lệnh |

## Cấu trúc thư mục

```
scripts/           Bộ kiểm tra chất lượng (palette, icons, subtitle, length, pace, quiz),
                   lập chỉ mục tài liệu, phân quyền Antigravity, smoke test
src/app/           Các trang App Router: / (trang chủ), /studio, /lesson, /library, /setup,
                   /quiz, /flashcard, /classroom
src/app/api/       Các endpoint API: sinh bài giảng, kiểm tra sức khỏe, models, CRUD bài giảng,
                   xuất file HTML/SRT/JSON, trích xuất tài liệu, tìm ảnh, giọng đọc
src/components/
  player/          LessonPlayer, GsapSlideStage, SlideSurface, SceneFigure,
                   ScenePointer, KaraokeSubtitle, TeacherVoice, TransportBar,
                   ScrubBar, ChapterList, ShortcutsDialog, InlineText
  studio/          Form nhập liệu & tiến trình tạo bài trực tiếp
  library/         Các thẻ quản lý bài giảng đã lưu
  setup/           Giao diện quản lý API key các hãng
  site/            Thanh điều hướng, chân trang, trạng thái hệ thống
src/hooks/         useTimebase đồng hồ phát dùng chung
src/lib/
  ai/              Lớp trừu tượng provider, adapter OpenAI-compatible, Antigravity CLI
  lesson/          Định dạng dữ liệu bài giảng, validate, chủ đề, hiệu ứng, bộ xuất HTML
  server/          Trích xuất tài liệu, lưu trữ bài giảng, bộ tổng hợp giọng nói, rate limiting
public/            Logo, icon tab, huy hiệu các hãng AI
public_html/       Trang giới thiệu tĩnh hiện đại, hiệu năng cao (deploy Vercel)
run.bat, run.sh    Khởi động một chạm (kèm màu sắc ANSI và thanh tiến trình)
uninstall.bat      Công cụ gỡ cài đặt & dọn dẹp bộ nhớ đệm thông minh
```

## Giới hạn hệ thống

- **Local-first**: Không cần cơ sở dữ liệu. Bài giảng lưu thành file JSON trong `data/courses/`, âm thanh lưu trong `data/tts-cache/`. Muốn sao chép sang máy khác chỉ cần tải file JSON hoặc copy thư mục.
- **Quota API**: Quá trình tạo bài cần API key còn hạn mức. Khi nhà cung cấp hết quota, hệ thống sẽ hiển thị thông báo lỗi rõ ràng kèm hướng dẫn khắc phục.
- **Xuất HTML độc lập**: Dữ liệu và âm thanh được nhúng trực tiếp; ở lần mở đầu tiên trên trình duyệt mới, hệ thống kết nối Internet để nạp thư viện hiệu ứng CDN, sau đó hoạt động hoàn toàn offline.
- **Độ chuẩn xác khung hình**: Khả năng tua theo khung hình dựa trên tỷ lệ `1/fps` (mặc định 30 fps), có thể cấu hình cho từng bài giảng.

## Giấy phép

Phát hành theo giấy phép MIT. Mã nguồn chính thức được lưu trữ tại
[github.com/npdk1/EdusGPT](https://github.com/npdk1/EdusGPT).