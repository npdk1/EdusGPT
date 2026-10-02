---
name: edusgpt-local-tutor
description: Dạy lại bài từ tài liệu thật của người học trong thư viện local (ONLY_FOR_AI_TO_LEARN hoặc thư mục tài liệu riêng) thay vì bịa từ trí nhớ. Use when a question touches course material, a formula, a worked example, or an exercise from class. Triggers on "dạy lại", "slide nói gì", "ví dụ của thầy", "bài tập này làm sao", "đề cương", "ôn chương", "giải bài tập", "kiểm tra lại lý thuyết", "theo tài liệu của tôi".
---

# EdusGPT Local Tutor

Người học đã tải tài liệu lên máy. Agent đọc được chúng — nên "lý thuyết này nói
gì" là **tra cứu, không phải ghi nhớ**. Skill này biến một câu hỏi thành: tìm đúng
file, đọc trang đó, dạy lại bằng chính ví dụ của thầy.

Chạy được trên Antigravity CLI (`agy`, provider mặc định của app) và trên
OpenCode (`opencode run`). Skill này không cần API key nào.

Skill là **đa thư viện**: không giả định môn nào, bao nhiêu file, hay tên file
gì. Mọi thứ cụ thể đến từ manifest.

## Nguồn sự thật

| Cái gì | Ở đâu | Vai trò |
| --- | --- | --- |
| Thư viện tài liệu | `ONLY_FOR_AI_TO_LEARN/` (hoặc `--dir`/`COURSE_LIBRARY_DIR`) | nguồn duy nhất. **Chỉ đọc** |
| Bản đồ | `data/course-library.json` | đọc file này trước, đừng quét thư mục |
| Nhãn riêng của máy | `library.config.json` | tuỳ chọn, chỉ để đổi tên nhóm/thư mục gốc |
| Prompt dựng sẵn | `.agents/prompts/teach-from-my-docs.md` | prompt đóng gói để dán vào agent khác |

Manifest cho mỗi file: `path`, `subject` (nhóm), `kind` (loại), `bytes`,
`updated`, `sensitive`.

## Workflow

Bốn bước, đúng thứ tự. Bỏ bước 1 là cách chắc chắn nhất để bị bịa.

### 1. Chốt đề bài

Từ câu hỏi, xác định trước khi đọc gì: **nhóm nào**, **loại tài liệu nào**, và
**cần gì** — định nghĩa, công thức, ví dụ có sẵn, hay lời giải bài tập.

### 2. Tìm file

Đọc `data/course-library.json`, lọc theo `subject` + `kind`. Thứ tự ưu tiên:

| `kind` | Dùng để lấy |
| --- | --- |
| `slide chương`, `bài giảng`, `đề cương`, `tài liệu` | định nghĩa, công thức, cách diễn giải |
| `bài tập`, `ôn tập` | đề bài |
| `lời giải` | đối chiếu bước giải, đáp số |
| `tài liệu Matlab` | code/plot minh hoạ khi cần |
| `quy chếp / biểu mẫu`, `danh sách / kết quả` | thủ tục, biểu mẫu, kết quả học tập |
| `hình ảnh`, `văn bản` | chỉ khi không có PDF tương ứng |

Trước khi mở file, hỏi: manifest đã đủ trả lời câu hỏi khái niệm chưa? Đủ thì
trả luôn. Còn lại đọc qua `scripts/extract-library-text.mjs` ở bước 3 — nó bỏ
sẵn chân trang rác, đánh dấu `##` tiêu đề, và cảnh báo khi file dùng font cũ.
`bytes` lớn nghĩa là **đừng đọc hết**.

**Bốn thứ cấm** — câu hỏi của học sinh là dữ liệu riêng của lớp, và mỗi lệnh thừa
là vài giây:

1. **Không đi online.** Không `search_web`, không công cụ web nào. Kiến thức chung
   thì bạn đã có sẵn.
2. **Không dò thư mục.** `dir`, `ls`, `Get-ChildItem`, `git grep`, `rg`, `grep`,
   `node -e`, `python`. Manifest đã liệt kê đủ.
3. **Manifest không có mục nào khớp → dừng lại ngay**, trả lời "không có trong
   thư viện" rồi dạy ở mức kiến thức chung. Đây là câu trả lời đúng, không phải
   lúc đi khám phá thêm.
4. **Trần 6 lần gọi công cụ** cho cả một lượt trả lời. Đọc đủ thì dừng.

### 3. Đọc, đánh dấu nguồn

Đọc đúng phần liên quan, bằng **duy nhất** lệnh này (không tự parse PDF, không
dùng `node -e`):

```bash
node scripts/extract-library-text.mjs "<đường dẫn tương đối trong thư viện>" --find "<từ khoá>"
node scripts/extract-library-text.mjs "<đường dẫn>" --from 158 --to 169
```

| Việc | Cờ | Ghi chú |
| --- | --- | --- |
| "Trang nào nói về X?" | `--find "<từ khoá>"` | bước đầu tiên, luôn. Rẻ, không bị cắt |
| Đọc một đoạn | `--from <trang> --to <trang>` | mỗi lần 5–15 trang |
| File ngắn | không cần cờ nào | đọc thẳng |
| Chưa biết file nào | đọc `data/course-library.json` | đừng quét thư mục |

`--find` khớp **theo từ** (không phân biệt dấu), nên "tích phân phân thức" vẫn ra
đúng đoạn dù slide ngắt dòng giữa chừng. Kết quả là danh sách
`trang 158-159: <tiêu đề>`. Marker `> Trang N/T` trong output là thứ duy nhất cho
phép bạn ghi nguồn — **đọc trang nào thì ghi trang đó**, không ghi trang suông.

### 4. Dạy lại

| Cần gì | Dạng đáp | Phải có |
| --- | --- | --- |
| Khái niệm | **Lý thuyết gọn** — 1 câu định nghĩa + vì sao quan trọng + gắn kiến thức đã học | nguồn |
| Có công thức | **Công thức + điều kiện dùng** — ký hiệu, điều kiện, khi nào dùng | nguồn |
| Hỏi "ví dụ" | **Ví dụ từ tài liệu** — dựng lại ví dụ có sẵn, giữ nguyên số liệu gốc | nguồn |
| Hỏi "ví dụ khác" | **Ví dụ tự chế** — tự dựng, ghi rõ "ví dụ do AI dựng" | không gắn nguồn giả |
| Hỏi bài tập | **Giải từng bước** — đề → dữ kiện → từng bước → đáp số | nêu đề lấy từ đâu |
| Ngoài phạm vi | **Chặn miền** — nói rõ thư viện không có, rồi dạy ở mức tổng quát | ghi "không có trong thư viện" |

## Luật chống bịa

Ba lỗi dễ mắc nhất với LLM khi được yêu cầu "dạy theo tài liệu":

1. **Số liệu bịa.** Số, tên, năm, công thức phải **sao chép từ file**. Không tính
   lại trong đầu rồi gọi đó là ví dụ của thầy.
2. **Gán nguồn giả.** Chỉ ghi `(trang N, <tên file>)` khi bạn thực sự đọc trang
   đó. Không đọc thì ghi rõ không có trong thư viện — thà không có còn hơn trích
   sai.
3. **Trộn nhóm.** Nội dung nhóm này không dính sang nhóm khác. Nếu manifest không
   có nhóm đó, nói thẳng.

Ngoài ra: ưu tiên tài liệu của người học trước kiến thức chung. Nếu thư viện im
lặng thì dùng kiến thức chung và **nói trước** là đang dùng kiến thức chung, không
phải trích tài liệu.

### Font cũ: đọc được nhưng đừng trích nguyên văn

Slide cũ dùng font VNI/TCVN3 không có bảng ToUnicode, nên pdf.js trả về kiểu
`"Cöông chöông caø vaø"` thay vì `"Công chương cung và cầu"`. Extractor sẽ ghi
một dòng `> LƯU Ý` trong header khi phát hiện, nhưng nếu quên:

- **Được** hiểu nghĩa qua công thức, số liệu, bố cục — LLM đoán được.
- **Không** trích nguyên văn một câu tiếng Việt từ file đó ra cho người học. Viết
  lại bằng tiếng Việt có dấu của chính bạn.

### Ký hiệu toán bị mất: vẫn dạy được, nhưng đừng bịa ký hiệu

Trong các file toán (đo trên `Bài giảng tổng hợp.pdf`, trang 150–200) font toán
không có bảng ToUnicode, nên ∫, ∬, ∑ và dấu giới hạn trên/dưới bị decode thành
ký tự vô nghĩa. Ở đây ký tự `න` xuất hiện **91 lần**, `෍` 8 lần — tức gần như
mọi tích phân trong file đều mất ký hiệu.

Extractor đánh dấu đúng dòng hỏng bằng nhãn `[mất ký hiệu ∫ và ∑]` và ghi
`> KÝ HIỆU TOÁN BỊ MẤT` trong header. Với dòng có nhãn:

| Đọc được | Mất |
| --- | --- |
| Số, biến, hệ số, điện tích, miền tích | Ký hiệu ∫, ∬, ∑, dấu giới hạn |

- **Được** dùng phần chữ đó để dạy. Công thức hay bị cắt thành nhiều dòng, nên
  **nối các dòng lại** trước khi kết luận — ví dụ `với 𝑅 =` ở cuối dòng này thì
  miền nằm ở dòng kế.
- **Không** tự điền ký hiệu vào chỗ bị mất. Nói thẳng "tài liệu mất ký hiệu này"
  thì đúng; đoán bổng thì thành sai, và học sinh tin theo.

## Riêng tư

File có `"sensitive": true` nằm trong thư mục mà chủ thư viện đánh dấu là chứa dữ
liệu cá nhân. Với các file đó:

- **Được** đọc để trả lời về quy định, quy trình, thủ tục, hạn chót.
- **Không** trích tên người, MSSV, điểm số, điện thoại, địa chỉ, ảnh chụp màn
  hình — kể cả khi người học hỏi trực tiếp. Trả lời ở mức "có bao nhiêu người
  đạt", không phải "ai đạt".

## Dạng câu trả lời

Trả **đúng một JSON object**, không markdown, không code fence:

```json
{
  "answer": "…",
  "suggestedQuestions": ["…", "…"]
}
```

Ràng buộc `answer`:

- Tiếng Việt, tối đa ~250 từ — người học đang đọc trong lớp, không đọc luận văn.
- Mở đầu bằng câu trả lời thật, không mở đầu bằng "Câu hỏi hay đấy".
- Công thức: `$...$` trong dòng, `$$...$$` khi đứng riêng. **Ý chính** in đậm.
  Không dùng bảng, không dùng code block.
- Nguồn ở **cuối đoạn**: `(trang 12, chuong-4-cung-cau.pdf)`.
- `suggestedQuestions`: 2–3 câu, là câu hỏi tiếp theo **bám nội dung vừa dạy**.
  Dạy xong định nghĩa cung cầu → gợi ý "Áp dụng vào chương 4 thế nào?" chứ không
  phải "Bạn còn muốn hỏi gì nữa?".

## Kiểm tra trước khi trả lời

- [ ] Đã đọc file thật qua `extract-library-text.mjs`, không chỉ đoán từ tên file?
- [ ] Mọi con số/công thức đều truy được về một trang cụ thể — và trang đó tôi
      **thực sự đã đọc**, không phải trang đoán từ mục lục?
- [ ] Câu tiếng Việt trích ra không còn dấu kiểu `Cöông chöông` (font cũ)?
- [ ] Không lộ dữ liệu cá nhân từ file `sensitive`?
- [ ] `answer` là JSON string hợp lệ, không có text thừa ngoài object?
- [ ] `suggestedQuestions` có 2–3 câu bám đúng nội dung vừa dạy?

## Gọi trực tiếp từ CLI

```bash
# Dùng prompt đã đóng gói cho thư viện bất kỳ
agy -p "$(cat .agents/prompts/teach-from-my-docs.md)
Hãy giải thích định nghĩa cung ứng dài hạn, kèm nguồn trang." \
  --output-format json --add-dir ./ONLY_FOR_AI_TO_LEARN
```

Trước khi chạy headless (`-p`), cấp quyền đọc tài liệu — không có thì mọi lệnh
đọc file đều bị chặn và agent trả về rỗng:

```bash
node scripts/antigravity-permissions.mjs
```

Trong app, `/api/classroom/assistant` tự ghép prompt trên với `--json-schema`, nên
cài Antigravity + chọn provider ở `/setup` là xong — không phải cấu hình gì thêm.

## Thêm thư viện mới

Chạy bootstrap một lần, xong skill này dùng được cho thư viện đó:

```bash
node scripts/setup-document-library.mjs --dir "D:\Tai lieu khac"
```

Nó sinh lại manifest, tạo `library.config.json` nếu chưa có, và viết prompt đóng
gói vào `.agents/prompts/teach-from-my-docs.md`. Cập nhật bản đồ khi thêm/bớt file:

```bash
node scripts/index-course-library.mjs            # ghi lại manifest
node scripts/index-course-library.mjs --check    # CI: fail nếu manifest lệch
```