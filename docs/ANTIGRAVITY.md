# Antigravity CLI — provider chạy ngầm cho EdusGPT

Gemini miễn phí chỉ 20 lượt/ngày. Antigravity CLI là **agent chạy trên máy bạn**:
app gọi `agy` ở chế độ headless, không tốn quota lượt nào, và nhờ vậy nó đọc được
thư viện slide trong `ONLY_FOR_AI_TO_LEARN/` thay vì đoán theo trí nhớ.

Ba thứ bạn nhận được khi bật provider này:

1. Provider AI thứ ba trong app (`gemini`, `openrouter`, `antigravity`).
2. Skill `edusgpt-local-tutor` — dạy lại bài từ tài liệu thật kèm số trang nguồn.
3. `data/course-library.json` — bản đồ thư viện, agent đọc trước khi mở file.
4. `scripts/extract-library-text.mjs` — đọc slide thành markdown có marker trang.

Không giả định môn nào hay bao nhiêu file: thư viện lấy từ
`ONLY_FOR_AI_TO_LEARN/`, trỏ được sang thư mục khác, nên máy nào copy app này sang
cũng dùng được.

## 0. Nếu muốn dùng thư viện tài liệu khác

Bỏ qua mục này nếu `ONLY_FOR_AI_TO_LEARN/` đã có sẵn thư viện của bạn. Nếu bạn
muốn trỏ sang một thư mục tài liệu ở đâu đó (mạng, ổ D:, thư mục cũ):

```bash
# Một lần, sinh manifest + nhãn + prompt đóng gói cho thư viện đó
node scripts/setup-document-library.mjs --dir "D:\Slide Học Kỳ 5"
```

Lệnh này chạy lại được, không phá gì: nó sinh lại manifest, chỉ tạo
`library.config.json` khi chưa có, và không ghi đè
`.agents/prompts/teach-from-my-docs.md` nếu bạn đã tự sửa nó. Kết quả là một
prompt sẵn dùng cho bất kỳ thư viện nào — dán vào `agy`, vào OpenCode, hay vào
trợ giảng trong app.

---

## 1. Cài

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-antigravity.ps1
```

Script thử `npm install -g antigravity-cli`, rồi kiểm tra `agy --version`. Nếu
tên package npm khác hoặc bạn muốn cài tay: tải binary từ trang chủ Antigravity,
giải nén, đưa `agy` (hoặc `agy.exe`) vào `PATH`. Nếu đặt tên/đường dẫn khác, khai
báo trong `.env`:

```bash
AGY_BINARY=/đường/dẫn/tới/agy
```

## 2. Đăng nhập — đúng một lần

Antigravity không dùng API key. Nó đăng nhập bằng tài khoản, interactive:

```bash
agy          # làm theo hướng dẫn, đóng terminal sau khi xong
```

Chỉ cần làm một lần; các lần sau app gọi headless vẫn dùng được session đó. Nếu
`agy -p "ping"` báo chưa đăng nhập thì đăng nhập lại.

## 2b. Cấp quyền cho agent đọc tài liệu

```bash
node scripts/antigravity-permissions.mjs
```

Chế độ headless (`agy -p`) không có terminal để hỏi "cho phép chạy lệnh này?".
Bất kỳ tool call nào permission engine muốn hỏi đều bị **chặn âm thầm**: agent
dừng giữa chừng, trả về `response: ""`, và app báo "không trả về nội dung".

Script này ghi vào `~/.gemini/antigravity-cli/settings.json` đúng các rule cần
thiết — và **chỉ thêm, không xoá** rule sẵn có của bạn:

```
command(regex:node\s+scripts/extract-library-text\.mjs.*)   # đọc slide, tìm trang
command(regex:node\s+scripts/extract-library-text\.mjs)
command(regex:npm\s+run\s+index:library)                   # làm mới manifest
read_file(ONLY_FOR_AI_TO_LEARN) · read_file(data) · read_file(.agents)
```

Rule phải là `command(prefix)` (tiền tố literal) hoặc `command(regex:...)`, và
**mỗi token phân tách bằng khoảng trắng được neo thành `^(?:token)$`**. Nên
`.*` đứng riêng thành một token chỉ khớp đúng *một* token kế tiếp — phải gộp
cả biểu thức vào một token duy nhất (`\s+`, `.*`) mới phủ được cả dòng lệnh.

### Windows: allow-rule không có tác dụng với headless

Đo thật trên máy này (agy 1.2.14): kể cả rule rộng nhất `command(node)` vẫn bị
`denied_actions: [{action:"command"}]` khi chạy `agy -p`. Lý do: Windows vẫn dùng
permission engine cũ (bản thống nhất mới chỉ có trên macOS/Linux), và print mode
của bản cũ không có đường nối từ allow-rule tới approval.

Nên app **tự thêm `--dangerously-skip-permissions` trên Windows**. Ở macOS/Linux
các rule ở trên là đủ và app không thêm flag. Đổi ý thì đặt trong `.env`:

```bash
ANTIGRAVITY_STRICT_PERMISSIONS=1   # không bao giờ tự duyệt tool
ANTIGRAVITY_SKIP_PERMISSIONS=1     # ép duyệt ở mọi OS (không cần trên macOS/Linux)
```

Khi `ANTIGRAVITY_STRICT_PERMISSIONS=1` mà agent bị chặn, app báo rõ tên tool bị
chặn thay vì âm thầm trả rỗng.

Kiểm tra (không ghi gì):

```bash
node scripts/antigravity-permissions.mjs --check
```

## 3. Chọn provider trong app

1. Mở <http://localhost:3000/setup>.
2. Card **Antigravity CLI** — badge báo `sẵn sàng` nghĩa là `agy --version` đã trả lời.
3. Chọn model: `auto` (agent tự chọn — nên dùng), hoặc khoá một model cụ thể nếu
   muốn kết quả ổn định (`gemini-3.8-flash-high`, `claude-sonnet-4-6`, …). Xem
   `agy models` để biết CLI hiện có gì.
4. Bấm lưu. App ghi `AI_PROVIDER=antigravity` và `ANTIGRAVITY_MODEL` vào `.env`.

Không có ô nhập key, không có base URL — provider CLI không gửi request ra ngoài.

## 4. Luồng một câu hỏi

Skill sống ở `.agents/skills/edusgpt-local-tutor/SKILL.md` và được `agy` tự load
từ workspace root. Thứ tự:

```
người học: "cầu hình cung ứng dài hạn là gì"
        ↓
app /api/classroom/assistant  →  agy -p "<prompt + AGENT BRIEF + manifest>" \
                                 --output-format json \
                                 --add-dir ONLY_FOR_AI_TO_LEARN \
                                 --json-schema <file tạm> \
                                 --dangerously-skip-permissions   # Windows \
                                 --print-timeout 285s
        ↓
agent đọc skill → dò data/course-library.json → chọn file
        ↓
node scripts/extract-library-text.mjs "<file>" --find "cung ứng dài hạn"
        ↓
node scripts/extract-library-text.mjs "<file>" --from 88 --to 96
        ↓
JSON {answer, suggestedQuestions} + "(trang 88-96, chuong-4-cung-dai-han.pdf)"
```

Manifest là **tùy chọn**. Không có nó thì agent vẫn chạy, chỉ mất bản đồ để lọc
file — prompt dài hơn và dễ chọn nhầm. Có nó thì prompt ngắn và chính xác hơn.

### Vì sao phải có `scripts/extract-library-text.mjs`

Không phải tiện ích cho vui. Ba lý do, cả ba đều gặp thật:

1. **Token.** Đọc trực tiếp PDF 308 trang bằng tool của agent là ~276k input
   token và 136 giây — hết thời gian, không trả được câu trả lời. Chạy extractor
   rồi đọc 8 trang: vài giây.
2. **Quyền.** Agent tự parse PDF sẽ bịa ra một lệnh (`node -e ...`) rồi ở lại đó.
   Cho agent đúng **một** đường đọc tài liệu là cách chắc chắn hơn là mở rộng quyền.
3. **Trích dẫn.** Marker `> Trang N/T` là thứ duy nhất biến "ý tôi là slide 5"
   thành "(trang 88, chuong-4-cung-dai-han.pdf)".

Ba cờ hay dùng: `--find "<từ khoá>"` (trang nào nói về X), `--from/--to` (đọc đoạn
đó), `--toc` (mục lục, chỉ hợp với file ngắn — file hàng trăm trang sẽ bị cắt).
Tự dùng tay:

```bash
node scripts/extract-library-text.mjs "Năm 2/Học Kì 4/....pdf" --find "cung ứng dài hạn"
```

### Font cũ trong slide

PDF dùng font VNI/TCVN3 không có bảng ToUnicode nên text ra kiểu
`"Cöông chöông caø"` thay vì `"Công chương cầu"`. App **không** sửa — bảng byte →
chữ là *per font*, không có bảng thay thế 1:1 (`src/lib/server/vietnamese.ts` giải
thích tại sao). Extractor thêm một dòng `> LƯU Ý` vào header khi phát hiện, và
agent được dạy để hiểu nghĩa qua công thức/số liệu chứ không trích nguyên văn.

### Vì sao error không lộ nội dung thư viện

Node dựng message của `execFile` bằng cách dán **toàn bộ argv** vào — mà argv ở đây
là cả prompt, bản đồ thư viện và danh sách file đánh dấu `private`. Chuỗi đó đi
thẳng lên trình duyệt. `safeAgyError()` thay nó bằng stderr của CLI (ngắn) hoặc
mã exit, nên lỗi không bao giờ mang nội dung thư viện ra ngoài.

Cập nhật khi thêm/bớt tài liệu:

```bash
node scripts/index-course-library.mjs                 # ghi lại manifest
node scripts/index-course-library.mjs --dir "D:\Slide"  # thư viện khác
node scripts/index-course-library.mjs --check         # CI: fail nếu manifest lệch
```

## 5. Dùng tay không qua app

```bash
# prompt đã đóng gói cho thư viện hiện tại
agy -p "$(cat .agents/prompts/teach-from-my-docs.md)
Hãy giải thích định nghĩa cấu hình cung ứng dài hạn, kèm nguồn trang." \
  --output-format json --add-dir ./ONLY_FOR_AI_TO_LEARN

# các flag hữu ích khác
agy -p "..." --output-format json --model claude-sonnet-4-6 --effort medium
agy -p "..." --print-timeout 285s                # trần chờ, CÓ ĐƠN VỊ: 285s, không phải 285000
agy -p "..." --log-file agy.log                  # xem agent thực sự gọi tool nào
```

Hai chỗ dễ sai:

- `--print-timeout` nhận **duration có đơn vị** (`285s`), không phải mili giây.
- **`--model` và `--effort` không được dùng cùng nhau** khi model đã encode effort
  trong tên: `agy --model gemini-3.8-flash-high --effort medium` bị từ chối ngay
  (`conflicts with --effort=medium`) và cả lượt hỏi hỏng. Model có đuôi
  `-low`/`-medium`/`-high` thì đã tự mang effort. App chỉ gửi `--effort` khi model
  không mang theo, nên nếu gặp lỗi này khi gọi tay thì bỏ `--effort` đi.

Xem model nào CLI thực sự có (danh sách trong app là tĩnh, để UI không phụ thuộc
một lệnh mỗi lần mở trang):

```bash
agy models
```

### Đọc offline toàn bộ thư viện

```bash
npm run agy:extract -- --all
```

Ghi bản markdown **đầy đủ** của mọi tài liệu vào `data/library-text/`, kèm
`index.json` map hash → tên file gốc (tên cache là hash để an toàn với mọi ký tự
trong tên). Dùng để bạn tự đọc hoặc `grep` mà không cần bật app.

**Không phải đường đi của agent.** Agent luôn gọi
`extract-library-text.mjs --find/--from/--to`: trích xuất một file PDF mất
~0.9s, nên bản cache không làm nhanh hơn, chỉ tốn ~500KB đĩa. Nó có một điểm hấp
dẫn: `--all` **không cắt** nội dung (đường đọc của agent thì có, để không tràn
output của CLI).

Xem agent làm gì, khi câu trả lời bị "không trả về nội dung":

```bash
ANTIGRAVITY_DEBUG_LOG=data/agy-debug.log npm run dev
```

hoặc không cần restart:

```bash
agy -p "..." --output-format stream-json --log-file agy.log
```

Trong `stream-json`, từng tool call có `tool_info.parameters.CommandLine` — đó là
cách biết chính xác lệnh nào bị chặn quyền.

## 6. Multi-agent với Orca (tùy chọn)

Cần khi bạn muốn **nhiều agent** làm các phần việc khác nhau cùng lúc: một agent
bóc công thức, một agent bóc ví dụ, một agent soát lỗi bịa số. Recipe này
**không cần biết thư viện của bạn là gì** — mỗi worker tự đọc manifest.

```powershell
# 0. Đăng ký repo này với Orca (chưa phải git repo thì `git init` trước)
orca open

# 1. Ba worker, mỗi người MỘT file output, cùng đọc manifest + skill
orca run create --prompt @'
Đọc data/course-library.json và .agents/skills/edusgpt-local-tutor/SKILL.md.
Tóm tắt thư viện thành data/brief-01-map.md: mỗi subject có bao nhiêu file, kind
nào chiếm đa số, file nào là slide lý thuyết chính.
CHỈ ghi data/brief-01-map.md. Không sửa file khác.
'@

orca run create --prompt @'
Đọc data/course-library.json. Chọn nhóm có nhiều slide nhất, mở 3 file slide chính,
bóc mọi công thức kèm số trang và ký hiệu vào data/brief-02-formulas.md.
CHỈ ghi data/brief-02-formulas.md. Không sửa file khác.
'@

orca run create --prompt @'
Đọc src/app/api/classroom/assistant/route.ts và docs/ANTIGRAVITY.md.
Soát xem provider antigravity còn chỗ nào đòi API key không, và các prompt có còn
giả định cứng về tên môn/tên file không. Ghi findings.md. KHÔNG sửa code.
'@
```

Pattern quan trọng: **mỗi worker một file output riêng, không ai sửa file của
worker khác**. Rồi nối kết quả lại: worker soát chỉ ra chỗ nào còn giả định cứng
→ một người sửa tuần tự. Các file wiring (`config.ts`, `llm.ts`) tuyệt đối không
cho nhiều agent sửa cùng lúc — đó là cách nhanh nhất để hỏng.

Sau đó, quy trình chuẩn của `orca-cli`:

```
orca worktree list                 # xem worker nào xong
orca run reply <run-id> ...        # gửi câu hỏi/đính chính
orca worktree release <run-id>     # thu dọn
```

Xem `skills/orca-cli` và `skills/orchestration` trong máy để lệnh cụ thể theo
phiên bản Orca bạn đang dùng.

---

## Khắc phục lỗi

| Triệu chứng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| Card báo `chưa cài` | `agy` không có trong PATH của Node process | mở terminal mới; hoặc đặt `AGY_BINARY` trong `.env` |
| `agy --version` chạy tay được, app báo không | app cache trạng thái 60s (`AVAILABILITY_CACHE_MS`) | restart `npm run dev`, hoặc đợi hết 60s |
| `Chưa đăng nhập` / 401 từ agy | chưa login interactive | chạy `agy` trong terminal, đăng nhập, đóng lại |
| **"không trả về nội dung"** dù CLI chạy tay được | `denied_actions:[{action:"command"}]`, `response:""` | trên Windows app đã tự thêm `--dangerously-skip-permissions`; nếu bạn đặt `ANTIGRAVITY_STRICT_PERMISSIONS=1` thì bỏ nó đi hoặc chạy `node scripts/antigravity-permissions.mjs` (chỉ có tác dụng ở macOS/Linux) |
| "hết thời gian sau Ns" | agent đọc quá nhiều tài liệu trong một lượt | hỏi hẹp hơn (một khái niệm); adapter đã tự đặt `--print-timeout` nhỏ hơn trần Node |
| Hết giờ khi hỏi về file 300 trang | agent đọc cả file một lượt | đã xử lý: AGENT BRIEF bắt dùng `--find` rồi `--from/--to`; nếu vẫn chậm, thử model khác trong dropdown |
| Câu trả lời bị chặn sau khi đọc hết slide | output bị CLI cắt (`<truncated N lines>`) | extractor đã tự cắt ở `--max-chars` và ghi hướng đọc tiếp; nếu agent vẫn bịa lệnh khác, `--toc` trên file >100 trang là thủ phạm — dạy dùng `--find` |
| JSON không parse được | agent kèm text thừa quanh JSON | adapter ưu tiên `structured_output` của envelope, tự 2 lần thử + `repairJson` |
| `conflicts with --effort=medium` | model đã encode effort trong tên mà vẫn truyền `--effort` | app đã tự bỏ `--effort` cho model kiểu `…-high`; gọi tay thì bỏ cờ đi |
| `invalid model selection` | model trong `.env` không có trong danh sách (CLI đã nâng cấp/đổi tên) | app cảnh báo ở `/setup` và tự dùng `auto`; chạy `agy models` rồi sửa `ANTIGRAVITY_MODEL` |
| Muốn dùng cả Gemini lẫn CLI | app hiện chọn một provider | đổi `AI_PROVIDER` trong `.env`, Gemini key vẫn còn nguyên |
| Chọn provider trong /setup xong, restart lại mất | `AI_PROVIDER` không được ghi vào `.env` | adapter đã ghi cả provider lẫn model; nếu `.env` bị sửa tay thì sửa `AI_PROVIDER=` |

### Câu trả lời chậm — đo trước khi tối ưu

Một câu hỏi mất 25–40s. Đo bằng `stream-json` cho thấy thời gian **không nằm ở
trích xuất** (mỗi lệnh ~0.4–0.9s) mà ở số lượt gọi model. Ba mức đo cùng một
câu hỏi:

| | lượt tool | tổng |
| --- | --- | --- |
| prompt không giới hạn số lần đọc | 5 (có `git grep` vô ích) | 25.3s |
| giới hạn ≤3 lệnh đọc, effort `medium` | 3 | 25s |
| giới hạn ≤3 lệnh đọc, effort `low` | 2 | 22.8s |

Kết luận: giảm được vài giây, không giảm được nhiều. Muốn nhanh hơn hẳn thì phải
bỏ kiểu "agent tự dò" và cho app tự truy hồi rồi nạp thẳng trang cần vào prompt
— đánh đổi phần lớn giá trị của việc dạy từ slide.

Về dòng "Câu trả lời bị chặn sau khi đọc hết slide" — đây là lỗi tinh vi nhất và
đáng hiểu nhất: extractor in ra 195 dòng thì CLI cắt, agent thấy dấu `[ĐÃ CẮT]`
và phản ứng hợp lý theo cách nó hiểu — tự gọi `node -e` đọc tiếp. Lệnh đó không có
trong allow-rule nên bị chặn, và lượt hỏi hỏng. Extractor giờ giới hạn mặc định
20k ký tự và luôn ghi kèm cách đọc tiếp, để agent không phải tự suy.

### Câu hỏi ngoài thư viện — chỗ tốn thời gian nhất

Câu hỏi mà manifest đã có câu trả lời từ chối ("thư viện tôi không có môn này") là
ca tệ nhất, vì agent cứ đi tìm thay vì dừng lại. Đo cùng một câu hỏi đó:

| | `run_command` | `search_web` | input token | tổng |
| --- | --- | --- | --- | --- |
| trước khi có "bốn thứ cấm" | 30 | 2 | 232k | 131s |
| sau | 8 | 0 | 65k | 56s |

Cấm đi online còn là chuyện riêng tư: câu hỏi của học sinh là dữ liệu của lớp, không
nên rời khỏi máy. Nên AGENT BRIEF trong `src/lib/ai/antigravity.ts`, skill
`.agents/skills/edusgpt-local-tutor/SKILL.md` và prompt đóng gói đều mang cùng bốn
điều cấm: không online, không dò thư mục, manifest đủ thì dừng, trần 6 lượt gọi
công cụ. Đo lại bằng:

```bash
agy -p "$(cat .agents/prompts/teach-from-my-docs.md)
Hãy giải thích định nghĩa hàm cấp phối, kèm nguồn trang." \
  --output-format stream-json --dangerously-skip-permissions \
  --add-dir ./ONLY_FOR_AI_TO_LEARN --model gemini-3.8-flash-high
```

Muốn thấy lệnh nào nó chạy, đọc `tool_info.parameters.CommandLine` trong từng event
`step_update`. Muốn xem lý do CLI cho phép hay chặn một tool, đọc log ở
`~/.gemini/antigravity-cli/log/`.

## Hạn mức dùng — bài "Cao" ăn gần hết một ngày

Mỗi lượt agent là một lần gọi có hạn mức. Trợ giảng (`/api/classroom/assistant`) tốn **một** lượt. Sinh bài giảng thì tốn **một lượt mỗi slide**, cộng thêm lượt dàn ý:

| preset | số slide | số lượt agent (ước tính) | thời gian thực đo |
| --- | --- | --- | --- |
| Thấp | 5 | ~6 | 3 phút |
| Trung bình | 16 | ~17 | ~12 phút |
| Cao | 95 | ~96 | **38 phút** |

Lần chạy đầu tiên với preset Cao đã **dùng hết hạn mức ngày** của tài khoản, và mọi lượt sau đó trả `RESOURCE_EXHAUSTED (429)` kèm giờ reset. App xử lý việc này:

- `generateAntigravityJson` **không retry** khi phát hiện quota — chờ thêm một giây cũng không có quota.
- Route sinh bài trả lỗi tiếng Việt kèm giờ reset, và `StreamEvent.quota = true` để UI hiện đúng nguyên nhân.
- Nếu hơn 20% số cảnh rơi vào placeholder "đang được bổ sung" thì **không lưu bài** — một bài 95 slide mà 92 slide là placeholder vẫn từng báo thành công và lọt vào kho.

Muốn bài 45–60 phút thì hãy dựng vào đầu ngày, hoặc tách làm hai bài trung bình.

## Tắt provider CLI

```bash
AI_PROVIDER=gemini   # .env, rồi restart dev server
```

Không cần gỡ `agy`, không có gì để xoá trong DB — CLI không lưu secret nào.