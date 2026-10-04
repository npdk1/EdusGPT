import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { rejectRemote } from "@/lib/server/guard";
import { localVoiceStatus, resolvePython } from "@/lib/server/tts-local";
import { forgetLocalVoices, localVoiceCatalog } from "@/lib/server/local-voices";
import type { LocalProvider } from "@/lib/lesson/voices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** pip on a cold machine, then a voice download. Generous on purpose. */
export const maxDuration = 900;

/**
 * One click, and this machine can speak for itself.
 *
 * Three engines, one per provider id: Piper (the original, one Vietnamese
 * voice), VieNeu-TTS (25 speakers at 48 kHz) and v-tts (five speakers, small
 * enough for any laptop). All of them are Python, and all of them go into the
 * project's own venv — `resolvePython` prefers `EDUSGPT_PYTHON`, which `run.bat`
 * points at `.runtime\venv`, so nothing is installed into the machine's Python
 * and nothing the teacher already had can be broken.
 *
 * The output is streamed line by line as server-sent events because both steps
 * take a while — pip resolving v-tts pulls a full PyTorch, and a 60 MB voice is
 * not instant — and a spinner with no words on it reads as a hang.
 *
 * Query: `?package=piper` (default), `vieneu`, `vtts`.
 */
const VOICE = "vi_VN-vais1000-medium";
const VOICE_DIR = join(process.cwd(), "data", "voices");

/** What `pip install` needs for each engine, and what it costs. */
const PACKAGES: Record<
  LocalProvider,
  { pip: string; blurb: string; needsVoice: boolean }
> = {
  piper: { pip: "piper-tts", blurb: "Cài piper-tts (một lần, mất vài chục giây)…", needsVoice: true },
  vieneu: {
    pip: "vieneu",
    blurb: "Cài VieNeu-TTS (không cần PyTorch, chạy bằng ONNX)…",
    needsVoice: false,
  },
  vtts: {
    pip: "git+https://github.com/tronghieuit/v-tts.git",
    blurb: "Cài v-tts (kéo cả PyTorch, lần đầu hơi lâu)…",
    needsVoice: false,
  },
};

function requestedProvider(request: NextRequest): LocalProvider {
  const value = new URL(request.url).searchParams.get("package");
  return value === "vieneu" || value === "vtts" ? value : "piper";
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  const provider = requestedProvider(request);
  const spec = PACKAGES[provider];
  // `resolvePython` is the same lookup the speech path uses, so what gets
  // installed is the Python that will later be asked to speak.
  const python = await resolvePython();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      // A step, run to completion, with its output folded into single lines.
      const step = async (
        label: string,
        command: string,
        args: string[],
      ): Promise<{ code: number; tail: string }> => {
        send({ type: "stage", message: label });
        return new Promise((resolve) => {
          let child;
          try {
            child = spawn(command, args, { windowsHide: true });
          } catch (error) {
            resolve({ code: -1, tail: String(error) });
            return;
          }
          const tail: string[] = [];
          const push = (chunk: unknown) => {
            for (const line of String(chunk).split(/\r?\n/)) {
              const text = line.trim();
              if (!text) continue;
              // pip is chatty; only the lines that say something are worth
              // showing, and the last few are kept for the failure message.
              tail.push(text);
              if (tail.length > 12) tail.shift();
              send({ type: "log", message: text });
            }
          };
          child.stdout?.on("data", push);
          child.stderr?.on("data", push);
          child.on("error", (error) => resolve({ code: -1, tail: [...tail, String(error)].join("\n") }));
          child.on("close", (code) => resolve({ code: code ?? -1, tail: tail.join("\n") }));
        });
      };

      if (!python) {
        send({
          type: "error",
          message:
            "Máy này chưa có Python 3.10+. Chạy lại run.bat để tạo venv, rồi bấm lại.",
        });
        controller.close();
        return;
      }

      try {
        if (spec.needsVoice) await mkdir(VOICE_DIR, { recursive: true });
      } catch {
        /* the download step reports its own failure */
      }

      const pip = await step(spec.blurb, python.command, [
        ...python.args,
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        spec.pip,
      ]);
      if (pip.code !== 0) {
        send({
          type: "error",
          message: `Cài ${spec.pip} không thành công. ${pip.tail.split("\n").slice(-2).join(" ")}`,
        });
        controller.close();
        return;
      }

      if (spec.needsVoice) {
        const voices = await step(
          `Tải giọng ${VOICE} (~60 MB)…`,
          python.command,
          [...python.args, "-m", "piper.download_voices", "--download-dir", VOICE_DIR, VOICE],
        );
        if (voices.code !== 0) {
          send({
            type: "error",
            message: `Tải giọng không thành công. ${voices.tail.split("\n").slice(-2).join(" ")}`,
          });
          controller.close();
          return;
        }
      }

      // The catalogue is cached; a fresh install has to show up at once or the
      // panel would say "chưa cài" until someone reloaded the page.
      forgetLocalVoices();
      const [local, catalog] = await Promise.all([
        localVoiceStatus(true),
        localVoiceCatalog(true),
      ]);
      const installed = catalog.providers.find((item) => item.provider === provider);
      const ready = provider === "piper" ? local.ready : Boolean(installed?.installed);
      send({
        type: "done",
        message: ready
          ? provider === "piper"
            ? `Xong. Giọng trên máy đã sẵn sàng${local.cuda ? " (chạy trên GPU)" : ""}.`
            : `Xong. ${installed?.label ?? provider} đã có ${installed?.voices ?? 0} giọng — lần đọc đầu tiên sẽ tải mô hình về nên hơi lâu.`
          : `Đã cài xong nhưng vẫn chưa dùng được: ${installed?.reason || local.reason}`,
        ready,
        cuda: local.cuda,
        provider,
        voices: installed?.voices ?? 0,
      });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}