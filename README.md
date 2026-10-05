<p align="center">
  <img src="public/logo.png" width="120" alt="EdusGPT logo" />
</p>

<h1 align="center">EdusGPT</h1>

<p align="center">
  Turn a topic into a narrated lesson — scene by scene, with slides,<br />
  Vietnamese voice-over and karaoke subtitles that light up word by word.
</p>

<p align="center">
  <strong>English</strong> · <a href="README_VN.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="https://github.com/npdk1/EdusGPT"><img src="https://img.shields.io/badge/source-GitHub-0b63e5?logo=github" alt="Source on GitHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux" />
</p>

Open a lesson in the player, scrub back and forth by the second, then export it
as a single standalone HTML file when you need to. Everything runs on your own
machine at `localhost:3000` — no Docker, no database.

## Quick start

Windows: double-click `run.bat`.

macOS or Linux: `./run.sh`

Both scripts check for Node 22+, run `npm install` when `node_modules` is
missing, create `.env` from `.env.example` when absent, free port 3000 when it
is taken, open the browser and start the server. Press `Ctrl+C` in the console
window to stop.

Manual run:

```bash
npm install
npm run dev          # http://localhost:3000
```

Check the runtime while the server is up:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

## API keys

Open `/setup`. The page has two groups:

- **Cloud** — calls a vendor API over the network, needs a key. Groq and NVIDIA
  speak the same language (OpenAI chat-completions), so they share one adapter
  in `src/lib/ai/openai-compatible.ts`; adding a vendor is one entry in
  `PROVIDERS`.
- **CLI** — drives a program already installed on your machine, no key needed.
  The Antigravity CLI (`agy`) works — it reads the document folder you point it
  at, see `docs/ANTIGRAVITY.md`. Claude Code CLI, Gemini CLI, Codex CLI and
  Ollama are on the planned list in `PLANNED_CLI_PROVIDERS`
  (`src/lib/ai/config.ts`).

Get keys at `console.groq.com/keys` (Groq) and `build.nvidia.com` (NVIDIA).
Both still have free tiers with no card required, so the app keeps working on
the other vendor when one runs out of quota. Paste the key into the right
vendor's box, test, then save. The server writes the key into `.env`
(`GROQ_API_KEY`, `NVIDIA_API_KEY`) and the UI only ever shows a masked hint
after that.

Free-tier reality check: every vendor meters differently and the allowances are
small. Groq counts per model (200k tokens/day and 8k tokens/minute), NVIDIA
counts requests per minute and occasionally 503s across the board. The "High"
preset (~96 calls) exceeds Groq's limits; free cloud tiers fit short lessons
and tutor answers. To teach from real slides, use the CLI group.

Model lists load per vendor, so one vendor's models never leak into another's.
Key-admin APIs only answer requests from localhost. To open them on the LAN,
set `ALLOW_REMOTE_KEY_ADMIN=true` yourself.

## Generating lessons

Open `/studio` and enter topic, subject, grade, scene count, length and notes.
You can attach source files (`pdf`, `docx`, `xlsx`, `txt`, `md`, `csv`,
`json`, up to 40 MB each) or paste text directly. The server extracts the text,
keeps page markers, and feeds the most relevant parts into the prompt.

A lesson is written in two stages, streamed live:

1. **Outline** — each scene's title, type and duration, visible within seconds.
2. **Details** — one call per scene, each appearing as it finishes. A failed
   scene keeps its outline frame with minimal content; the whole lesson never
   falls over because of one scene.

A scene can carry bullets, formulas, data tables, function plots, numbered
solution steps (B1, B2…), quizzes, illustrations or 3D simulations. Narration is
written in full speakable sentences, never formula notation.

Options when generating:

- Style: minimal, visual story, classroom, cinematic.
- Length: short, medium, long.
- Voice: Vietnamese voices (HoaiMy, Nam Minh and slow/high/deep variants).
- Illustrations: per-scene AI images via `pollinations.ai`, no extra key.
- Presenter pointer: a glow dot following the sentence being read, on by
  default, recolorable.

Finished lessons save to the on-machine library; opening one jumps straight to
the player.

## Player

Open `/lesson`. The picker at the top lists the playing lesson plus samples and
saved lessons; the chip beside it shows the current lesson's subject and grade.

| Key | Does |
| --- | ---- |
| `Space`, `K` | Play or pause |
| `←`, `→` | Back / forward 5 seconds |
| `J`, `L` | Back / forward 10 seconds |
| `Shift + ←/→` | Fine seek 1 second |
| `,`, `.` | Exactly one frame back / forward |
| `0`–`9` | Jump to 0%–90% of the runtime |
| `Home`, `End` | Start / end |
| `[`, `]`, `\` | Set point A, set point B, toggle loop |
| `−`, `+` | Slower / faster |
| `F`, `?` | Fullscreen, shortcut sheet |

A slide is not a video but a timeline rebuilt at every timestamp, so seeking
back to second 3 lands on the right scene and the right frame. One shared clock
keeps the timeline, the chapter list and the voice in sync.

**Export HTML** packs a lesson into one file: open it in a browser and it plays
on the spot (network needed once, to fetch the animation library). **JSON**
downloads the flat script for other render tools.

The AI tutor sits next to the chapter list, answers about the scene being
studied and renders formulas. Click a formula or a plot to zoom in.

## Library

Open `/library`. Saved lessons live in `data/courses/` on your machine. Each
card has its own open and delete buttons. The delete-all button sits next to
refresh and asks for confirmation, because there is no undo.

## Voices

The server synthesises narration, no key needed. Audio is cached per sentence
in `data/tts-cache/`, so replaying a sentence reuses the file instead of
synthesising again. Delete that folder to reclaim space; voices rebuild on the
next play.

## Cleanup

`uninstall.bat` returns the project to a fresh-download state: it asks for
confirmation, then removes `node_modules/`, `.next/`, the whole `.runtime/`
(portable Node, private Python, TTS engines), downloaded voice models, cached
audio and every generated lesson. It keeps your source, `.env`, saved keys,
logo and `ai-settings.json`. Afterwards open `run.bat` to reinstall in one
click.

## Quality checks

| Command | Does |
| --- | ---- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:palette` | Keeps the banned purple family out of `src/` |
| `npm run check:icons` | Slide icon names must exist and be mapped |
| `npm run check:subtitle` | Subtitles highlight the right word, advance on time |
| `npm run check:length` | Length presets feasible at the real reading pace |
| `npm run check:pace` | Per-scene playback rate stays uniform at 1× |
| `npm run check:quiz` | Quiz gate logic holds |
| `npm run verify` | All checks above plus typecheck |
| `npm run build`, `npm start` | Production build and run |
| `powershell -File scripts/smoke-test.ps1` | Runtime test, needs the server running |
| `node scripts/verify-export.mjs exported.html` | Validates an exported HTML file |
| `node scripts/generate-sample.mjs "Topic"` | Generates a lesson from the CLI |

## Project structure

```
scripts/           palette, icon, subtitle, length, pace, quiz checks,
                   smoke test, sample generation
src/app/           pages: home, lesson, studio, library, setup
src/app/api/       health, settings, models, lesson generation, tutor,
                   text extraction, images, voices, library, HTML/JSON export
src/components/
  player/          player, slides, timeline, chapters, voices, quiz,
                   simulations, subtitles, pointer, shortcut dialog
  studio/          generation form
  library/         saved-lesson cards
  setup/           key form
  site/            header, footer, key badge
src/hooks/         the shared playback clock
src/lib/
  ai/              provider definitions, dispatcher, per-vendor adapters
  lesson/          lesson and scene model, presentation styles, color
                   themes, icons, samples, validation, HTML export,
                   document excerpting
  server/          document text extraction, image search, voice
                   synthesis, lesson storage
public/            logo, tab icon, AI vendor logos
public_html/       standalone landing page (served by Vercel)
run.bat, run.sh    one-click launchers
uninstall.bat      clean slate for a reinstall
```

## Limits

- No database. Generated lessons are files in `data/courses/`, narration in
  `data/tts-cache/`. To move machines, download the JSON and import it back.
- Generation needs a key with remaining quota. An exhausted vendor reports
  clearly instead of returning an empty lesson.
- Exported HTML needs network on first open to fetch the animation library;
  content still renders fully.
- One frame step equals `1/fps`, 1/30 s by default, set per lesson via `fps`.

## License

MIT — see the repo. Source lives at
[github.com/npdk1/EdusGPT](https://github.com/npdk1/EdusGPT).
