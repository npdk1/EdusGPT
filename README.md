# EdusGPT

EdusGPT soạn bài giảng thành từng cảnh có slide, giọng đọc và phụ đề chạy theo từng chữ. Bạn mở bài trong trình phát, tua tới lui từng giây, rồi xuất ra một file HTML độc lập nếu cần. Mọi thứ chạy trên máy bạn qua `localhost:3000`.

## Chạy

Windows: nhấp đúp vào `run.bat`.

macOS hoặc Linux: `./run.sh`

Hai script trên tự kiểm tra Node từ bản 22, chạy `npm install` khi thiếu `node_modules`, tạo `.env` từ `.env.example` khi chưa có, giải phóng cổng 3000 khi bị chiếm, mở trình duyệt rồi khởi động server. Bấm `Ctrl+C` trong cửa sổ console để dừng.

Chạy tay:

```bash
npm install
npm run dev          # http://localhost:3000
```

Kiểm tra runtime khi server đang mở:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

## Cài API key

Mở `/setup`. Trang này chia hai nhóm:

- Cloud: gọi API của hãng qua mạng, cần key. Groq và NVIDIA — hai hãng nói cùng một thứ tiếng (OpenAI chat-completions) nên dùng chung một adapter `src/lib/ai/openai-compatible.ts`; thêm hãng mới chỉ là thêm một mục trong `PROVIDERS`.
- CLI: điều khiển chương trình cài sẵn trên máy, không cần key. Antigravity CLI (`agy`) đã chạy được — đọc tài liệu bạn bỏ vào thư mục tài liệu để dạy, xem `docs/ANTIGRAVITY.md`. Claude Code CLI, Gemini CLI, Codex CLI và Ollama mới ở mức danh sách dự kiến, nằm trong `PLANNED_CLI_PROVIDERS` ở `src/lib/ai/config.ts`.

Key lấy ở `console.groq.com/keys` (Groq) và `build.nvidia.com` (NVIDIA). Cả hai đều còn gói free không cần thẻ, nên app vẫn dùng được khi hết quota hãng kia. Dán key vào ô của đúng hãng, bấm kiểm tra rồi lưu. Server ghi key vào `.env` (`GROQ_API_KEY`, `NVIDIA_API_KEY`) và từ đó giao diện chỉ hiện dạng đã che.

Lưu ý khi chọn hãng free: hạn mức mỗi hãng một kiểu và đều nhỏ. Groq tính theo model (200k token/ngày và 8k token/phút), NVIDIA theo request mỗi phút và đôi lúc 503 cả hãng. Bài dài preset "Cao" (~96 lượt) vượt hạn mức của Groq; hãng cloud free hợp với bài ngắn và trả lời trợ giảng. Cần dạy từ slide thật thì dùng nhóm CLI.

Danh sách model nạp riêng theo từng hãng, nên model của hãng này không lẫn sang hãng kia. Các API cài key chỉ trả lời request từ localhost. Muốn mở qua mạng nội bộ thì tự đặt `ALLOW_REMOTE_KEY_ADMIN=true`.

## Sinh bài giảng

Mở `/studio` và nhập chủ đề, môn, lớp, số cảnh, thời lượng, ghi chú. Có thể đính kèm tài liệu (`pdf`, `docx`, `xlsx`, `txt`, `md`, `csv`, `json`, tối đa 40 MB mỗi tệp) hoặc dán trực tiếp vào ô. Server rút chữ ra khỏi tệp, giữ mốc số trang, rồi đưa phần liên quan nhất vào prompt.

Bài sinh ra theo hai bước, tiến độ hiện trực tiếp:

1. Lên dàn ý: tiêu đề, loại và thời lượng từng cảnh, hiện ngay sau vài giây.
2. Viết chi tiết: mỗi cảnh gọi riêng, xong cảnh nào hiện cảnh đó. Cảnh nào lỗi thì giữ khung dàn ý và điền nội dung tối giản, cả bài không sập theo.

Mỗi cảnh có thể mang gạch đầu dòng, công thức, bảng số liệu, đồ thị hàm số, các bước giải đánh số B1, B2, câu hỏi trắc nghiệm, ảnh minh họa, hoặc mô phỏng không gian. Lời giảng viết đủ câu để đọc thành tiếng, không chứa ký hiệu công thức.

Các tùy chọn khi sinh bài:

- Kiểu chữ: minimal, visual story, classroom, cinematic.
- Độ dài: ngắn, vừa, dài.
- Giọng đọc: 6 giọng tiếng Việt (Hoài My, Nam Minh và các biến thể chậm, cao, trầm).
- Ảnh minh họa: AI vẽ ảnh cho từng cảnh qua `pollinations.ai`, không cần key riêng.
- Con trỏ giảng: chấm sáng bám theo câu đang đọc, bật mặc định, đổi được màu.

Bài xong lưu vào thư viện trên máy, bấm mở là sang trình phát.

## Trình phát

Mở `/lesson`. Ô chọn đầu trang liệt kê bài đang phát cùng các bài mẫu và bài đã lưu ở trình duyệt. Chip bên cạnh hiện môn và lớp của bài đang mở.

| Phím | Việc |
| --- | --- |
| `Space`, `K` | Phát hoặc tạm dừng |
| `←`, `→` | Tua lui hoặc tới 5 giây |
| `J`, `L` | Tua lui hoặc tới 10 giây |
| `Shift + ←/→` | Tua chậm 1 giây |
| `,`, `.` | Lùi hoặc tiến đúng 1 khung hình |
| `0` tới `9` | Nhảy tới 0% đến 90% thời lượng |
| `Home`, `End` | Về đầu hoặc tới cuối |
| `[`, `]`, `\` | Đặt mốc A, đặt mốc B, bật hoặc tắt lặp đoạn |
| `−`, `+` | Giảm hoặc tăng tốc độ phát |
| `F`, `?` | Toàn màn hình, bảng phím tắt |

Slide không phải video mà là một timeline dựng lại ở từng mốc thời gian, nên kéo lui về giây thứ 3 vẫn ra đúng cảnh và đúng khung. Một đồng hồ chung giữ thanh timeline, mục lục và giọng đọc khớp nhau.

Nút Xuất HTML gói bài thành một file duy nhất: mở bằng trình duyệt là xem được ngay, cần mạng lần đầu để tải thư viện hiệu ứng. Nút JSON tải kịch bản dạng phẳng để đưa sang công cụ render khác.

Trợ giảng AI nằm cạnh mục lục, trả lời theo cảnh đang học và hiển thị được công thức. Bấm vào công thức hoặc đồ thị để phóng to.

## Thư viện

Mở `/library`. Bài đã lưu nằm trong `data/courses/` trên máy bạn. Mỗi thẻ có nút mở và nút xóa riêng. Nút xóa hết nằm cạnh nút làm mới, bấm thì hỏi xác nhận vì không khôi phục được.

## Giọng đọc

Giọng đọc do server tổng hợp, không cần key. File âm thanh lưu trong `data/tts-cache/` theo từng câu, lần sau phát lại cùng câu thì dùng file cũ nên không tốn thời gian tạo lại. Xóa thư mục này khi cần chỗ trống, giọng sẽ tự tạo lại ở lần phát tiếp theo.

## Dọn dẹp

`clean_all.bat` trả project về trạng thái mới tải: hỏi xác nhận rồi xóa `node_modules/`, `.next/`, giọng đọc đã lưu và toàn bộ bài trong `data/courses/`. Giữ lại `.env`, key đã lưu, logo và tài liệu của bạn. Xong thì mở `run.bat` để cài lại từ đầu.

## Kiểm tra chất lượng

| Lệnh | Việc |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:palette` | Chặn màu họ tím lọt vào `src/` |
| `npm run check:icons` | Tên icon trong slide phải có thật và được map |
| `npm run check:subtitle` | Phụ đề tô đúng từ, sang câu đúng lúc |
| `npm run check:length` | Ba preset độ dài có khả thi với tốc độ đọc thật |
| `npm run verify` | Chạy cả bốn kiểm tra trên cộng typecheck |
| `npm run build`, `npm start` | Build và chạy bản production |
| `powershell -File scripts/smoke-test.ps1` | Test runtime, cần server đang chạy |
| `node scripts/verify-export.mjs exported.html` | Kiểm tra file HTML xuất ra |
| `node scripts/generate-sample.mjs "Chủ đề"` | Sinh bài từ dòng lệnh |

## Cấu trúc thư mục

```
scripts/           kiểm tra palette, icon, phụ đề, độ dài, smoke test, sinh mẫu
src/app/           các trang: chủ, lesson, studio, library, setup
src/app/api/       health, settings, models, sinh bài, trợ giảng, rút chữ,
                   ảnh, giọng đọc, thư viện, xuất HTML và JSON
src/components/
  player/          trình phát, slide, timeline, mục lục, giọng đọc, quiz,
                   mô phỏng, phụ đề, con trỏ, hộp thoại phím tắt
  studio/          form sinh bài
  library/         thẻ bài đã lưu
  setup/           form cài key
  site/            header, footer, huy hiệu key
src/hooks/         đồng hồ phát chung cho cả bài
src/lib/
  ai/              định nghĩa provider, dispatcher, adapter từng hãng
  lesson/          model bài và cảnh, kiểu trình bày, chủ đề màu, icon,
                   bài mẫu, validate, xuất HTML, rút trích đoạn tài liệu
  server/          rút chữ tài liệu, tìm ảnh, tổng hợp giọng, lưu bài
public/            logo, icon tab, logo các hãng AI
run.bat, run.sh    khởi động một chạm
clean_all.bat      dọn sạch để cài lại
```

## Giới hạn

- Không có database. Bài đã sinh lưu thành file trong `data/courses/`, giọng đọc lưu trong `data/tts-cache/`. Muốn chép sang máy khác thì dùng nút tải JSON rồi nhập lại.
- Sinh bài cần key còn quota. Hãng hết quota thì server báo rõ thay vì trả bài rỗng.
- File HTML xuất ra cần mạng ở lần mở đầu tiên để tải thư viện hiệu ứng, nội dung vẫn hiện đầy đủ.
- Bước tua một khung hình bằng `1/fps`, mặc định là 1/30 giây, chỉnh qua trường `fps` của từng bài.
