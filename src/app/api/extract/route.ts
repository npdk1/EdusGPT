import { NextResponse, type NextRequest } from "next/server";
import { extractDocument, MAX_UPLOAD_BYTES } from "@/lib/server/extract";
import { clientKey, rateLimit, rejectRemote } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Parsing is CPU- and memory-hungry: 20 files in one call can take the box down. */
const MAX_TOTAL_BYTES = 120 * 1024 * 1024;

/**
 * Accepts one or more real course files and returns plain text for the model.
 * Runs on Node (not Edge) because PDF/DOCX/XLSX parsing needs Node APIs.
 */
export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  // Uploads are cheap to request and expensive to serve, so this one is
  // deliberately tighter than the AI routes.
  const limit = rateLimit(clientKey(request, "extract"), 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Quá nhiều lần tải tài liệu. Thử lại sau ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body phải là multipart/form-data." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Chưa có tệp nào (field 'files')." }, { status: 400 });
  }
  if (files.length > 20) {
    return NextResponse.json({ error: "Mỗi lần tối đa 20 tệp." }, { status: 413 });
  }
  // Checked before reading any bytes into memory: the body is already buffered
  // by the runtime, but this stops us holding 800 MB of decoded files.
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      {
        error:
          `Tổng dung lượng ${(totalBytes / 1024 / 1024).toFixed(0)} MB vượt giới hạn ` +
          `${MAX_TOTAL_BYTES / 1024 / 1024} MB cho một lần tải lên.`,
      },
      { status: 413 },
    );
  }

  const docs = [];
  for (const file of files) {
    docs.push(await extractDocument(file));
  }

  const usable = docs.filter((d) => d.chars > 0);
  // Already markdown per prompt/skills/markitdown.md (headings, tables, page
  // markers), so the merge only adds the file head and the page count.
  const merged = usable
    .map((d) =>
      [`# ${d.name}`, d.pages ? `> ${d.pages} trang` : "", d.text].filter(Boolean).join("\n\n"),
    )
    .join("\n\n---\n\n");

  return NextResponse.json({
    ok: usable.length > 0,
    maxBytes: MAX_UPLOAD_BYTES,
    docs,
    totalChars: merged.length,
    /** A single blob for the "paste into studio" path. */
    text: merged,
  });
}
