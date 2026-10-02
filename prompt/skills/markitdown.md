---
name: markitdown
license: MIT
metadata:
  version: 1.0.0
  source: microsoft/markitdown
  description: Chuyển PDF/DOCX/XLSX sang markdown giữ tiêu đề, danh sách, bảng và mốc trang để đưa vào prompt bài giảng
---

# MarkItDown — tài liệu thành markdown cho prompt

Skill này quy định cách mọi tài liệu tải lên (`/api/extract`) được chuyển thành
markdown trước khi đưa vào prompt sinh bài giảng. Mục tiêu: giữ cấu trúc
(tiêu đề, danh sách, bảng, mốc trang) để model trích đúng chỗ, thay vì một khối
chữ trơn. Tuân theo triết lý của
[microsoft/markitdown](https://github.com/microsoft/markitdown): tài liệu nào
cũng thành markdown thân thiện với LLM.

## Quy ước đầu ra (bắt buộc)

1. **Mỗi tệp một khối**, mở đầu bằng `# <tên tệp>`.
2. **PDF**: tách theo trang, mỗi trang bắt đầu bằng mốc `> Trang N/Tổng`.
   - Dòng IN HOA ngắn hoặc dạng `1.2 Tên mục` thành `## Tên mục`.
   - Không đoán lại thứ tự cột. Sơ đồ/hình mất khi trích chữ thì ghi
     `[hình/sơ đồ trang N, xem bản gốc]`, không bịa nội dung hình.
   - PDF scan (lớp chữ dưới 20 ký tự) trả về rỗng kèm ghi chú OCR, không đoán.
3. **DOCX**: chuyển bằng `mammoth.convertToMarkdown` để giữ heading, list,
   table. Không dùng `extractRawText` vì nó làm mất hết cấu trúc.
4. **XLSX**: mỗi sheet một `## <tên sheet>`, bảng markdown thật:
   `| A | B |` rồi dòng `|---|---|`, tối đa 12 dòng/sheet, 6 cột.
   Ô trống giữ chỗ bằng khoảng trắng, không dồn cột.
5. **Chữ tiếng Việt**: chạy `repairVietnamese` sau khi dọn khoảng trắng.
   Văn bản TCVN3/VNI cũ (ví dụ `KINH TEÁ`) không sửa bằng đoán mò. Prompt phải
   dặn model dùng kiến thức môn học thay vì trích nguyên văn chỗ vỡ font.
6. **Giới hạn**: tối đa 120 000 ký tự cho vào model. Route `/api/gemini/lesson`
   không cắt đầu mà **skim**: giữ 4000 ký tự đầu, rải 4 cửa sổ đều trên phần
   còn lại trong 12 000 ký tự (`src/lib/lesson/reference-skim.ts`). Mỗi cảnh
   example/graph còn được trích **riêng đoạn của nó** (`sliceForScene`: bài
   số N -> đoạn "N." có ngữ cảnh khớp goal nhất, vì số thứ tự lặp mỗi chương;
   từ khóa mục lục dạng `## ... . . . 40` bị bỏ qua khi chấm điểm).

## Công thức và bài tập (từ tài liệu HCMUS)

- Công thức trong PDF thường bị tuyến tính hóa (`R2 = x = x1; x2 |...`).
  Prompt phải dặn model **trình bày lại công thức đúng ký hiệu toán** vào
  trường `formula` (LaTeX), định nghĩa từng ký hiệu ở `bullets`, không copy
  nguyên chuỗi tuyến tính lên slide.
- Tài liệu bài tập (dạng `8. f(x;y)=...`, `Bài tập`, `Ví dụ`, `Tính`) được nhận
  diện theo số thứ tự. Cảnh `example` giữ **đề bài nguyên văn** ở `subtitle`,
  viết lời giải từng bước vào `steps` (bước đầu ghi giả thiết, bước giữa biến
  đổi + thay số, bước cuối là đáp số; mỗi bước có số cụ thể, dưới 140 ký tự),
  đọc xuôi từng bước ở `narration`, con trỏ trỏ `step-N` theo câu đọc.
  Không gộp nhiều bài vào một cảnh.

## Kiểm tra nhanh

- `npm run verify` phải qua (icon, palette, subtitle, length).
- Nạp thử: slide Kinh tế Đại cương chương 1 (font vỡ) và Vi Tích Phân 2
  (lý thuyết 308 trang + bài tập 95 trang), xem bài giảng sinh ra có đúng
  công thức, có cảnh giải bài tập, và pointer đi theo từng câu đọc.
