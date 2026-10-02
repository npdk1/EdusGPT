import { NextResponse, type NextRequest } from "next/server";
import { resolveProvider } from "@/lib/ai/config";
import { credentialGate } from "@/lib/ai/readiness";
import { generateJson } from "@/lib/ai/llm";
import { clientKey, rateLimit, rejectRemote } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_SYSTEM_PROMPT = `Bạn là Trợ Giảng AI thông thái, tận tâm trong lớp học ảo.
Bạn đang cùng học sinh theo dõi bài giảng.
Nhiệm vụ của bạn:
1. Giải thích cặn kẽ thắc mắc của học sinh dựa trên bối cảnh cảnh học hiện tại.
2. Trả lời súc tích, sinh động, dễ hiểu, dùng ngôn ngữ tiếng Việt thân thiện, khích lệ.
3. Nếu học sinh hỏi về công thức hay ví dụ, hãy đưa ra so sánh thực tế dễ hình dung.
4. Công thức toán viết bằng LaTeX: $...$ cho công thức trong dòng, $$...$$ cho công thức đứng một mình. In đậm ý chính bằng **...**. Không dùng markdown bảng hay code block.
5. Chỉ dựa vào nội dung cảnh học hiện tại và tài liệu bạn đọc được. Phần nào tài liệu không nói tới thì nói thẳng là chưa có trong tài liệu, đừng suy đoán rồi nói như chắc chắn.
6. Dùng từ tiếng Việt đã có sẵn ("hình chữ nhật", "diện tích", "phân hoạch", "giới hạn"), đừng dựng từ bằng cách dịch chữ từng chữ.`;

interface AssistantResponse {
  answer: string;
  suggestedQuestions?: string[];
}

// Declared, not just described in prose: the Antigravity CLI path enforces this
// with --json-schema, so a model that drifts returns a shape error instead of a
// silently missing `answer`.
const ASSISTANT_SCHEMA = {
  type: "object",
  properties: {
    answer: {
      type: "string",
      description:
        "Nội dung trả lời cho học sinh. Tiếng Việt, LaTeX $...$ cho công thức trong dòng và $$...$$ khi đứng riêng, in đậm ý chính, không dùng bảng hay code block.",
    },
    suggestedQuestions: {
      type: "array",
      description: "2-3 câu hỏi tiếp theo bám đúng nội dung vừa dạy.",
      items: { type: "string" },
    },
  },
  required: ["answer", "suggestedQuestions"],
  additionalProperties: false,
} as const;

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  // Chat turns are the easiest way to drain a quota, so they are capped hard.
  const limit = rateLimit(clientKey(request, "assistant"), 40, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Quá nhiều câu hỏi. Thử lại sau ' + limit.retryAfterSeconds + 's.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const creds = await resolveProvider();
  const gate = await credentialGate(creds);
  if (gate) {
    return NextResponse.json({ error: gate }, { status: 428 });
  }

  let body: {
    question?: string;
    currentScene?: {
      title: string;
      kind: string;
      bullets: string[];
      formula?: string;
      narration?: string;
    };
    lessonTitle?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Vui lòng nhập câu hỏi" }, { status: 400 });
  }

  const contextPrompt = `
Bài giảng: "${body.lessonTitle ?? "Bài học hiện tại"}"
Cảnh học hiện tại: "${body.currentScene?.title ?? "Không rõ"}" (${body.currentScene?.kind ?? ""})
Nội dung cảnh:
${body.currentScene?.bullets?.map((b) => `- ${b}`).join("\n") ?? ""}
${body.currentScene?.formula ? `Công thức: ${body.currentScene.formula}` : ""}
${body.currentScene?.narration ? `Lời giảng: ${body.currentScene.narration}` : ""}

Câu hỏi của học sinh: "${question}"

Hãy trả về định dạng JSON:
{
  "answer": "Nội dung trả lời trực tiếp, đầy đủ, dễ hiểu",
  "suggestedQuestions": ["Gợi ý câu hỏi tiếp theo 1", "Gợi ý câu hỏi tiếp theo 2"]
}
`;

  try {
    const result = await generateJson<AssistantResponse>(creds, {
      system: AGENT_SYSTEM_PROMPT,
      prompt: contextPrompt,
      schema: ASSISTANT_SCHEMA as unknown as Record<string, unknown>,
      temperature: 0.7,
      maxOutputTokens: 2048,
    });

    const answer = typeof result.data?.answer === "string" ? result.data.answer.trim() : "";
    if (!answer) {
      throw new Error(
        "Trợ giảng AI không trả về nội dung. Thử lại, hoặc chọn provider khác ở /setup.",
      );
    }

    return NextResponse.json({
      ok: true,
      answer,
      suggestedQuestions: result.data.suggestedQuestions ?? [],
      model: result.model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi khi gọi Trợ giảng AI";
    // A spent quota is the single most common reason this fails on a free
    // key; 429 + quota phrasing lets the UI show a specific hint instead of a
    // generic red error box.
    const quota = /quota|hết hạn mức|rate limit/i.test(message);
    return NextResponse.json({ error: message, quota }, { status: quota ? 429 : 500 });
  }
}
