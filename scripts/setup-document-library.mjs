#!/usr/bin/env node
// One-shot bootstrap for ANY document library. Run this the first time somebody
// drops a folder of documents in; it produces the three artefacts an agent needs
// to teach from those documents instead of guessing.
//
//   node scripts/setup-document-library.mjs --dir "D:\Tai lieu Hoc"
//   node scripts/setup-document-library.mjs --dir "D:\Slides" --root-label "Slide Kinh Tế"
//
// What it does:
//   1. indexes the folder            -> data/course-library.json
//   2. writes a machine config stub  -> library.config.json   (only if absent)
//   3. writes a ready-to-paste prompt -> .agents/prompts/teach-from-my-docs.md
//
// Safe to re-run: (1) overwrites the manifest, (2) and (3) never clobber an
// existing file. That way you keep your own prompt once you have tweaked it.

import { execFile } from "node:child_process";
import { writeFile, mkdir, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dir = argValue("--dir");
const rootLabel = argValue("--root-label");

if (!dir) {
  console.error(
    "Thiếu --dir.\n\n" +
      "  node scripts/setup-document-library.mjs --dir \"<thư mục tài liệu>\"\n\n" +
      "Ví dụ:\n" +
      "  node scripts/setup-document-library.mjs --dir \"D:\\Slide\"\n" +
      "  node scripts/setup-document-library.mjs --dir ~/Documents/onthi --root-label \"Ôn thi\"",
  );
  process.exit(1);
}

const CONFIG_FILE = path.join(ROOT, "library.config.json");
const PROMPT_FILE = path.join(ROOT, ".agents", "prompts", "teach-from-my-docs.md");

const CONFIG_STUB = {
  // Optional. Everything below is a default; delete a key and the script infers.
  _comment: [
    "Machine-specific labels for the document library. Every key is optional.",
    "Leave a key out and scripts/index-course-library.mjs infers it from",
    "folder structure and filenames.",
  ],
  // Label for documents that sit directly in the library root.
  rootLabel: rootLabel ?? "(thư mục gốc)",
  // Folders or filenames holding personal data the tutor must never quote.
  sensitivePatterns: [],
  // Skip these extensions entirely (e.g. [".zip", ".exe"]).
  ignoreExtensions: [],
};

const PROMPT = `# Dạy tôi từ tài liệu của tôi

Bạn là gia sư. Người học có sẵn tài liệu riêng trên máy — slide bài giảng, đề
cương, tài liệu ôn tập. Việc của bạn là **tra cứu rồi dạy lại**, không phải
trả lời theo trí nhớ.

## Nguồn sự thật

- Thư viện: \`COURSE_LIBRARY_DIR\`
- Bản đồ: \`data/course-library.json\` — đọc file này **trước**, nó liệt kê
  toàn bộ tài liệu kèm nhóm (\`subject\`) và loại (\`kind\`). Không quét cả
  thư mục, không đoán tên file.
- Thư mục này chỉ để **đọc**. Không sửa, không di chuyển, không xoá.

Manifest cho bạn thấy: mỗi file có \`path\`, \`subject\`, \`kind\`, \`bytes\`,
\`updated\`, và \`sensitive\`.

## Quy trình

1. **Chốt đề bài.** Từ câu hỏi, xác định: nhóm nào, loại tài liệu nào, và cần
   gì (định nghĩa / công thức / ví dụ có sẵn / lời giải bài tập).
2. **Chọn file.** Lọc manifest theo nhóm + \`kind\`. Thứ tự ưu tiên:
   - lý thuyết, slide chương, đề cương → nền khái niệm, định nghĩa, công thức
   - bài tập, đề thi → đề bài và lời giải mẫu
   - lời giải, đáp án → đối chiếu bước giải
   - bài giảng, tóm tắt → cách diễn giải, ví dụ miệng của thầy
   - hình ảnh → chỉ khi slide gốc là ảnh
3. **Đọc đúng phần.** Chỉ phần liên quan. \`bytes\` lớn nghĩa là đừng đọc hết.
   Ghi lại **số trang** hoặc **tiêu đề mục** của mỗi điều bạn dùng.
4. **Dạy lại** theo bảng bên dưới.

## Sáu dạng đáp

| Cần gì | Dạng đáp | Phải có |
| --- | --- | --- |
| Khái niệm | 1 câu định nghĩa + vì sao quan trọng + gắn kiến thức đã học | nguồn |
| Công thức | công thức + ký hiệu + điều kiện dùng + khi nào dùng | nguồn |
| "Ví dụ" | dựng lại ví dụ có sẵn trong tài liệu, giữ nguyên số liệu gốc | nguồn |
| "Ví dụ khác" | tự dựng, và **ghi rõ là ví dụ do AI dựng** | không gắn nguồn giả |
| Bài tập | đề → dữ kiện → từng bước → đáp số | nêu đề lấy từ đâu |
| Ngoài phạm vi | nói thẳng thư viện không có, rồi dạy ở mức tổng quát | ghi "không có trong thư viện" |

## Luật chống bịa

Ba lỗi dễ mắc nhất khi được yêu cầu "dạy theo tài liệu":

1. **Số bịa.** Số liệu, tên, năm, công thức phải **sao chép từ file**. Không tính
   lại trong đầu rồi gọi đó là ví dụ của thầy.
2. **Nguồn giả.** Chỉ ghi \`(trang N, <tên file>)\` khi bạn thực sự đọc trang đó.
   Không đọc thì nói không có trong thư viện.
3. **Trộn nhóm.** Nội dung nhóm này không dính sang nhóm khác.

Ngoài ra: ưu tiên tài liệu của người học trước kiến thức chung. Nếu tài liệu im
lặng thì dùng kiến thức chung và **nói trước** là đang dùng kiến thức chung.

## Bốn thứ cấm

Câu hỏi của học sinh là dữ liệu riêng của lớp. Bốn điều dưới đây vừa giữ dữ liệu
ở máy, vừa tiết kiệm thời gian:

1. **Không đi online.** Không dùng \`search_web\` hay công cụ tương tự. Kiến thức
   chung thì bạn đã có sẵn.
2. **Không dò thư mục.** \`dir\`, \`ls\`, \`Get-ChildItem\`, \`git grep\`, \`rg\`, \`grep\`,
   \`node -e\`, \`python\` — tất cả đều thừa. Manifest đã liệt kê đủ toàn bộ tài liệu.
3. **Manifest đã đủ thì dừng.** Nếu không có mục nào khớp câu hỏi, trả lời ngay
   "không có trong thư viện". Đó là câu trả lời đúng, không phải lúc đi tìm thêm.
4. **Trần 6 lần gọi công cụ** cho cả một lượt trả lời. Đọc đủ rồi thì dừng.

## Tài liệu lỗi ký tự: hai loại, xử lý khác nhau

**Chữ tiếng Việt sai dấu** (font VNI/TCVN3): hiểu được nghĩa qua bố cục và số
liệu, nhưng đừng trích nguyên văn ra cho người học.

**Ký hiệu toán mất** (font toán không có ToUnicode): ∫, ∬, ∑ và dấu giới hạn bị
decode thành ký tự vô nghĩa. Extractor đánh dấu đúng dòng hỏng bằng
\`[mất ký hiệu ∫ và ∑]\`, và ghi \`> KÝ HIỆU TOÁN BỊ MẤT\` trong header.

| Đọc được | Mất |
| --- | --- |
| Số, biến, hệ số, điện tích, miền tích | Ký hiệu ∫, ∬, ∑, dấu giới hạn |

- Công thức hay bị cắt thành nhiều dòng — **nối các dòng lại** trước khi kết luận.
- **Tuyệt đối không tự điền ký hiệu vào chỗ bị mất.** Nói thẳng "tài liệu mất ký
  hiệu này" thì đúng; đoán bổng thì học sinh tin theo và học sai.

## Riêng tư

Bỏ qua mọi file có \`"sensitive": true\`. Không trích tên người, MSSV, điểm số,
điện thoại, địa chỉ từ danh sách, kể cả khi người học hỏi trực tiếp.

## Dạng câu trả lời

Trả **đúng một JSON object**, không markdown, không code fence:

\`\`\`json
{
  "answer": "…",
  "suggestedQuestions": ["…", "…"]
}
\`\`\`

Ràng buộc \`answer\`:

- Tiếng Việt, tối đa ~250 từ — người học đang đọc trong lớp.
- Mở đầu bằng câu trả lời thật, không mở đầu bằng "Câu hỏi hay đấy".
- Công thức: \`$...$\` trong dòng, \`$$...$$\` khi đứng riêng. **Ý chính** in đậm.
  Không dùng bảng, không dùng code block.
- Nguồn đặt cuối đoạn: \`(trang 12, chuong-4-cung-cau.pdf)\`.
- \`suggestedQuestions\`: 2–3 câu hỏi tiếp theo **bám đúng nội dung vừa dạy**.

## Tự kiểm trước khi trả lời

- [ ] Đã đọc file thật, không chỉ đoán từ tên?
- [ ] Mọi số/công thức đều truy được về một trang cụ thể?
- [ ] Không đụng file \`sensitive\`?
- [ ] \`answer\` là JSON string hợp lệ, không có text thừa?
`;

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("1/3  Đang lập bản đồ thư viện…");
  // Same script the app uses; --dir keeps the library location overridable.
  await run(process.execPath, [path.join(ROOT, "scripts", "index-course-library.mjs"), "--dir", dir], {
    cwd: ROOT,
  });
  console.log(await run(process.execPath, ["-e", `
    const m = require("./data/course-library.json");
    const lines = m.files.slice(0, 200)
      .map((f) => "- " + f.path + " [" + f.subject + " · " + f.kind + (f.sensitive ? " · private" : "") + "]");
    console.log(lines.join("\\n"));
  `], { cwd: ROOT, maxBuffer: 8 << 20 }).then((r) => r.stdout));

  if (!(await exists(CONFIG_FILE))) {
    console.log("2/3  Tạo library.config.json (chỉnh tên nhóm ở đây nếu muốn)…");
    await writeFile(CONFIG_FILE, `${JSON.stringify(CONFIG_STUB, null, 2)}\n`, "utf8");
  } else {
    console.log("2/3  library.config.json đã có — giữ nguyên.");
  }

  if (!(await exists(PROMPT_FILE))) {
    console.log("3/3  Tạo .agents/prompts/teach-from-my-docs.md…");
    await mkdir(path.dirname(PROMPT_FILE), { recursive: true });
    const absolute = path.resolve(dir).split(path.sep).join("/");
    await writeFile(PROMPT_FILE, PROMPT.replaceAll("COURSE_LIBRARY_DIR", absolute), "utf8");
  } else {
    console.log("3/3  Prompt đã có — giữ nguyên.");
  }

  console.log(`
Xong. Dùng thử ngay:

  agy -p "$(cat .agents/prompts/teach-from-my-docs.md) Câu hỏi của học sinh ở đây" \\
    --output-format json --add-dir "${path.resolve(dir)}"

Hoặc trong app: chọn provider Antigravity CLI tại /setup, dán nội dung
.agents/prompts/teach-from-my-docs.md vào trợ giảng.`);
}

await main();