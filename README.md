<p align="center">
  <img src="public/logo.png" width="120" alt="EdusGPT logo" />
</p>

<h1 align="center">EdusGPT</h1>

<p align="center">
  Turn any topic or document into an interactive, narrated learning deck —<br />
  with synchronized slides, voice-over, word-by-word karaoke subtitles, KaTeX math formulas, interactive quizzes, and standalone HTML player export.
</p>

<p align="center">
  <strong>English</strong> · <a href="README_VN.md">Tiếng Việt</a> · <a href="README.html">HTML Guide</a>
</p>

<p align="center">
  <a href="https://github.com/npdk1/EdusGPT"><img src="https://img.shields.io/badge/source-GitHub-0b63e5?logo=github" alt="Source on GitHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux" />
  <img src="https://img.shields.io/badge/Next.js-16.3.6-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
</p>

Tired of reading endless walls of chatbot text? EdusGPT is designed for students, self-learners, and educators to transform dry prompts and study documents into rich, multi-sensory presentations. Scrub back and forth by the second, practice with interactive quizzes, and export a self-contained standalone HTML player for offline review. Everything runs locally on your machine at `localhost:3000` — zero cloud database, zero telemetry.

## Key Capabilities

- 🎙️ **Synchronized Voiceover & Subtitles**: Neural Edge TTS, offline Piper, and VieNeu models with real-time, word-by-word highlighted karaoke subtitles at a measured teaching tempo.
- 📐 **Full KaTeX Math Rendering**: Formulas in `$ ... $` and `$$ ... $$` render beautifully across slides, quiz questions, answer choices, and tutor chats.
- 🧩 **Interactive Quiz Checkpoints**: In-slide practice gates with active feedback, score tracking, and detailed explanations that pause the presentation until answered.
- 🎴 **Active Recall 3D Flashcards**: Spatial cards with audio narration, formula zoom, and spaced-repetition keybindings.
- 🌐 **Self-Contained HTML Export**: Export entire courses to a single offline `.html` file with embedded base64 audio and the GSAP playback engine — opens anywhere without a backend server.
- 🔍 **Instant Course Library Search**: Integrated toolbar dropdown to search, filter by subject/grade, and seamlessly switch between any created courses in `data/courses/`.

## Quick start

Windows: double-click `run.bat`.

macOS or Linux: `./run.sh`

Both scripts check for Node 22+, run `npm install` when `node_modules` is
missing, create `.env` from `.env.example` when absent, free port 3000 when it
is taken, open the browser and start the server. On Windows, `run.bat` provides
an interactive ANSI-colored interface with 7-stage visual progress bars and
automatic portable `.runtime/` bootstrap. Press `Ctrl+C` in the console window to stop.

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

- **Cloud** — calls a vendor API over the network, needs a key. Groq, NVIDIA,
  and Token Harbor speak the standard OpenAI chat-completions protocol, sharing
  the adapter in `src/lib/ai/openai-compatible.ts`. Adding a vendor is a single entry
  in `PROVIDERS`.
- **CLI** — drives an AI agent installed on your machine, no cloud API key needed.
  The Antigravity CLI (`agy`) is fully supported — it indexes and studies your local
  reference document folder directly, see `docs/ANTIGRAVITY.md`.

Get free keys at `console.groq.com/keys` (Groq) or `build.nvidia.com` (NVIDIA).
Both offer generous free tiers without a credit card required, allowing seamless
failover if one provider experiences rate limits. Paste the key into the corresponding
vendor box, click test, then save. The server stores keys securely in `.env`
(`GROQ_API_KEY`, `NVIDIA_API_KEY`, `TOKENHARBOR_API_KEY`) and the UI masks them.

Free-tier reality check: every vendor meters differently. Groq enforces per-model
token and request limits, while NVIDIA enforces requests-per-minute limits. Free cloud
tiers are ideal for short lessons, test quizzes, and tutor chats. For deep, textbook-scale
lessons with heavy document grounding, the local Antigravity CLI is recommended.

Model lists load dynamically per vendor. Key-admin APIs strictly reject non-localhost
requests by default; to allow administration over a local network, set `ALLOW_REMOTE_KEY_ADMIN=true`.

## Generating lessons

Open `/studio` and enter topic, subject, grade, scene count, length and notes.
You can attach source files (`pdf`, `docx`, `xlsx`, `txt`, `md`, `csv`,
`json`, up to 40 MB each) or paste text directly. The server extracts the text,
preserves structural markers, and feeds relevant excerpts into the prompt pipeline.

Lessons stream live in two stages:

1. **Outline** — each scene's title, type and duration, visible within seconds.
2. **Details** — scenes generate concurrently or sequentially, rendering into the
   live preview as they finish. If a single scene encounters an error, its outline
   frame falls back gracefully with minimal content — the entire course never crashes.

Scene types include bullet points, KaTeX mathematical formulas, data tables,
function plots, numbered step-by-step solutions (B1, B2…), interactive quizzes,
AI illustrations, and 3D simulations. Narration scripts are formatted in natural,
phonetically speakable sentences.

Options when generating:

- Style: minimal, visual story, classroom, cinematic.
- Length: short (3–5 slides, 1–2 min), medium (10–16 slides, 6–10 min), long (60–95 slides, 45–60 min).
- Voice: Vietnamese neural voices (HoaiMy, Nam Minh with tempo variants), offline Piper, or custom VieNeu.
- Illustrations: per-scene AI images via `pollinations.ai` (no key required).
- Presenter pointer: a glowing focal point tracking the spoken sentence, enabled by default.

Finished lessons save automatically to `data/courses/` and can be opened immediately in the player.

## Player & Interactive Learning

Open `/lesson`. The top toolbar features a searchable course switcher that queries
all saved lessons from your local library in real time, accompanied by metadata badges
(`Thư viện`, `Mẫu`, `Đang phát`).

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

A slide is not a pre-rendered video but a live deterministic timeline driven by GSAP:
scrubbing to second 3.5 computes the exact DOM state, subtitle highlight, and animation frame.

### Export Formats

- 🌐 **Export HTML** (`/api/export/html`): Bundles the lesson, GSAP runtime, KaTeX renderer, and base64-encoded audio into a single standalone `.html` file. Double-click to open in any web browser without needing a web server or database.
- 📝 **SRT Subtitles** (`/api/export/srt`): Exports synchronized subtitle cues aligned to the narration, supporting both continuous sentence mode and exact timeline mode.
- 📦 **JSON Deck** (`/api/export/json`): Exports the raw, structured course schema for external renderers or backup.

The interactive AI tutor sits alongside the chapter drawer to answer questions specific
to the active scene with full formula support. Click any formula or graph on the slide to zoom in.

## Library

Open `/library`. Courses are stored as human-readable JSON files in `data/courses/`
on your local disk. Each card provides instant playback, JSON inspection, and deletion.
Writes are performed atomically (`.tmp` $\to$ `.json`) to prevent data corruption.

## Voices & Offline TTS

Narration is synthesized on the server with zero external audio subscriptions required.
Audio is cached per-sentence in `data/tts-cache/`, so replaying a scene is instantaneous.
You can delete this folder at any time to reclaim disk space; clips regenerate on the fly.
Local offline synthesis via Piper (`scripts/local-voice/piper_speak.py`) is supported
for private, zero-internet environments.

## Cleanup

`uninstall.bat` provides a safe, interactive terminal menu with universal ANSI colors:

1. **Clean Build & Cache**: Clears `.next/`, `data/tts-cache/`, and temporary build artifacts while keeping your courses and node modules.
2. **Uninstall Runtime**: Removes the portable `.runtime/` environment (portable Node, Python venv, offline models).
3. **Full Factory Reset**: Confirms before wiping `node_modules/`, `.next/`, `.runtime/`, audio cache, and generated courses.
   Your core source files, `.env` API keys, and logo are strictly preserved.

After running cleanup, double-click `run.bat` to reinstall and launch cleanly.

## Quality checks

| Command | Does |
| --- | ---- |
| `npm run typecheck` | `tsc --noEmit` strict validation |
| `npm run check:palette` | Enforces deep obsidian palette (bans purple family in `src/`) |
| `npm run check:icons` | Ensures all slide icons exist and map correctly to Lucide |
| `npm run check:subtitle` | Verifies word-level karaoke timing and sentence handover |
| `npm run check:length` | Validates slide count vs narration pace for all 3 presets |
| `npm run check:pace` | Verifies per-scene playback tempo clamps and uniformity |
| `npm run check:quiz` | Tests quiz hold-and-pause gate mechanics and explanation reading times |
| `npm run verify` | Runs all 7 checks above + typecheck in sequence |
| `npm run build`, `npm start` | Builds and tests production Turbopack bundle |
| `powershell -File scripts/smoke-test.ps1` | End-to-end runtime health check against live server |
| `node scripts/verify-export.mjs exported.html` | Inspects and validates an exported standalone HTML file |
| `node scripts/generate-sample.mjs "Topic"` | Generates a sample course directly from the command line |

## Project structure

```
scripts/           Quality checks (palette, icons, subtitle, length, pace, quiz),
                   library indexing, Antigravity permissions, smoke test
src/app/           App Router pages: / (home), /studio, /lesson, /library, /setup,
                   /quiz, /flashcard, /classroom
src/app/api/       Routes: lesson generation, health, models, courses CRUD,
                   standalone HTML/SRT/JSON export, document extract, images, TTS
src/components/
  player/          LessonPlayer, GsapSlideStage, SlideSurface, SceneFigure,
                   ScenePointer, KaraokeSubtitle, TeacherVoice, TransportBar,
                   ScrubBar, ChapterList, ShortcutsDialog, InlineText
  studio/          Generation form & timeline stream
  library/         Saved-lesson course cards
  setup/           API key administration
  site/            Header, footer, system status indicators
src/hooks/         useTimebase shared playback clock
src/lib/
  ai/              Provider abstractions, OpenAI-compatible adapter, Antigravity CLI
  lesson/          Course data schema, validation, themes, motion, standalone HTML builder
  server/          Document extraction, course store, TTS synthesis, rate limiting
public/            Logo, favicon, AI vendor badges
public_html/       Modern, high-performance static showcase page (Vercel deployment)
run.bat, run.sh    One-click launchers (with ANSI colors and progress loading)
uninstall.bat      Interactive uninstaller & cache cleaner
```

## Limits

- **Local-first**: No database required. Courses live as files in `data/courses/`, narration audio in `data/tts-cache/`. To transfer courses to another machine, download the JSON or copy the folder.
- **API Quota**: Generation requires an API key with active quota. If a provider reaches rate limits, the UI reports the error with actionable guidance.
- **Standalone HTML Export**: Audio and slides are completely bundled; on first launch in a browser, internet access is used to load the CDN animation helper, after which it runs entirely offline.
- **Deterministic Frame Accuracy**: Timeline seeking steps in fractions of `1/fps` (default 30 fps), configurable per course.

## License

MIT — see repository. Source code is hosted at
[github.com/npdk1/EdusGPT](https://github.com/npdk1/EdusGPT).
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
