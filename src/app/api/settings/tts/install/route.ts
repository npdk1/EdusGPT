import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { rejectRemote } from "@/lib/server/guard";
import { localVoiceStatus } from "@/lib/server/tts-local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** pip on a cold machine, then a 60 MB voice download. Generous on purpose. */
export const maxDuration = 900;

/**
 * One click, and this machine can speak for itself.
 *
 * Two steps, both of which a teacher should never have to do by hand: `pip
 * install piper-tts`, then download the Vietnamese voice into `data/voices/`.
 * The output is streamed line by line as server-sent events because both steps
 * take a while — pip resolving on a cold machine is tens of seconds, and a 60 MB
 * download is not instant — and a spinner with no words on it reads as a hang.
 *
 * Voice: `vais1000-medium`, one of Piper's Vietnamese voices, chosen because it
 * is the one the project publishes and trains at a size that speaks faster than
 * real time on an ordinary CPU.
 */
const VOICE = "vi_VN-vais1000-medium";
const VOICE_DIR = join(process.cwd(), "data", "voices");

function pythonCandidates(): { command: string; args: string[] }[] {
  return [
    ...(process.env.EDUSGPT_PYTHON ? [{ command: process.env.EDUSGPT_PYTHON, args: [] }] : []),
    { command: "python", args: [] },
    { command: "py", args: ["-3"] },
    { command: "python3", args: [] },
  ];
}

async function findPython(): Promise<{ command: string; args: string[] } | null> {
  for (const candidate of pythonCandidates()) {
    const ok = await new Promise<boolean>((resolve) => {
      let child;
      try {
        child = spawn(candidate.command, [...candidate.args, "-c", "import sys"], {
          windowsHide: true,
        });
      } catch {
        resolve(false);
        return;
      }
      const timer = setTimeout(() => {
        child.kill();
        resolve(false);
      }, 15_000);
      child.on("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
    });
    if (ok) return candidate;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const remote = rejectRemote(request);
  if (remote) return remote;

  const python = await findPython();
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
            "Máy này chưa có Python 3.10+. Cài Python, mở lại /setup rồi bấm lại.",
        });
        controller.close();
        return;
      }

      try {
        await mkdir(VOICE_DIR, { recursive: true });
      } catch {
        /* the download step reports its own failure */
      }

      const pip = await step(
        "Cài piper-tts (một lần, mất vài chục giây)…",
        python.command,
        [
          ...python.args,
          "-m",
          "pip",
          "install",
          "--disable-pip-version-check",
          "piper-tts",
        ],
      );
      if (pip.code !== 0) {
        send({
          type: "error",
          message: `Cài piper-tts không thành công. ${pip.tail.split("\n").slice(-2).join(" ")}`,
        });
        controller.close();
        return;
      }

      const voices = await step(
        `Tải giọng ${VOICE} (~60 MB)…`,
        python.command,
        [
          ...python.args,
          "-m",
          "piper.download_voices",
          "--download-dir",
          VOICE_DIR,
          VOICE,
        ],
      );
      if (voices.code !== 0) {
        send({
          type: "error",
          message: `Tải giọng không thành công. ${voices.tail.split("\n").slice(-2).join(" ")}`,
        });
        controller.close();
        return;
      }

      const local = await localVoiceStatus(true);
      send({
        type: "done",
        message: local.ready
          ? `Xong. Giọng trên máy đã sẵn sàng${local.cuda ? " (chạy trên GPU)" : ""}.`
          : `Đã cài xong nhưng vẫn chưa dùng được: ${local.reason}`,
        ready: local.ready,
        cuda: local.cuda,
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
