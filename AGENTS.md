# AGENTS.md — EdusGPT

Local-first Next.js app that turns a topic (plus optional reference documents) into a narrated
lesson: slides, Vietnamese TTS voice-over, karaoke subtitles, a seekable player, and a
single-file HTML export. No database, no cloud account required to run. Serves at
`http://127.0.0.1:3000`. User docs: `README.md` (EN) / `README_VN.md` (VI);
Antigravity CLI deep-dive: `docs/ANTIGRAVITY.md` (VI).

Note: this copy is **not a git repository**. Do not `git init` unless the user asks.

## Commands

```bash
npm run dev          # next dev -H 127.0.0.1 -p 3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run verify       # ALL check:* scripts + typecheck — run before claiming work done
npm run check:palette   # bans purple-family colours/hexes anywhere in src/
npm run check:icons     # SLIDE_ICON_SETS ↔ SLIDE_ICONS map ↔ real lucide exports must agree
npm run check:subtitle  # karaoke alignment regression (src/lib/karaoke.ts)
npm run check:length    # LESSON_LENGTHS presets: minutes vs scenes vs words/scene math
npm run check:pace      # paceFitRate() clamp behaviour
npm run check:quiz      # quizHold()/quizReadSeconds() gate logic
npm run check:library   # data/course-library.json manifest freshness
npm run index:library   # re-index COURSE_LIBRARY_DIR → data/course-library.json
npm run setup:library   # one-shot bootstrap of a document library
npm run agy:doctor      # Antigravity CLI install + permission rules status
```

Manual tools: `scripts/smoke-test.ps1` (needs server running; PowerShell, ASCII-only inside),
`node scripts/verify-export.mjs <exported.html>` (no browser needed),
`node scripts/generate-sample.mjs <topic> [outfile]` (SSE client, needs server + key).
First-time setup of a machine: `run.bat` (Windows; installs portable Node/Python/ffmpeg into
`.runtime\`) or `run.sh` (macOS/Linux). `uninstall.bat` removes runtime dirs, keeps source +
`.env` + `data/ai-settings.json`.

## Stack

Next.js 16.3.6 App Router · React 19.3 · TypeScript strict (`noEmit`, paths `@/*` → `src/*`) ·
Tailwind CSS v4 via `@tailwindcss/postcss` (tokens in `src/app/globals.css` `@theme`) ·
GSAP 3.15 (ScrollTrigger/Observer/SplitText) · raw three.js (no R3F) · KaTeX ·
lucide-react (`src/lib/lesson/slide-icons.ts`, hand-written map for tree-shaking) + @tabler/icons-react ·
msedge-tts (cloud TTS) · unpdf/mammoth/xlsx (document extraction) · Node >= 22.19.

`next.config.ts` pins `turbopack.root` (stray parent lockfile otherwise hijacks the workspace) and
lists `serverExternalPackages: ["msedge-tts","ws","unpdf","mammoth","xlsx"]` — these must not be
bundled (msedge-tts class-field initialiser breaks when bundled). `vercel.json` deploys only
`public_html/` (a standalone static landing page, no framework).

## Directory map

| Path | What lives there |
|---|---|
| `src/app/` | Pages: `/` (HomeClient), `/studio` (generate), `/lesson?c=<id>` player, `/library`, `/setup`, `/classroom?id=<session>` live-generation room. `layout.tsx` injects theme + language pre-paint scripts. |
| `src/app/api/` | `gemini/lesson` (two-stage SSE generation — name is historical, it is provider-generic), `health`, `ai/models`, `courses` (localhost-only CRUD + drafts), `export/json`, `export/html`, `extract`, `images`, `classroom/assistant`, `tts`, `settings/tts`, `settings/tts/install`, `settings/gemini` (+`/key`). All routes `runtime="nodejs"`, `dynamic="force-dynamic"`. |
| `src/lib/ai/` | Provider layer: `config.ts` (credential store, `.env` writer, baseUrl allowlist, localhost guards), `llm.ts` (front door — routes import only from here), `openai-compatible.ts` (Groq/NVIDIA chat adapter with throttle/capacity gates + token-budget learning), `antigravity.ts` (local `agy` CLI), `shared.ts` (AiError, JSON repair), `model-trust.ts`, `readiness.ts`. |
| `src/lib/lesson/` | Lesson domain: `types.ts` (data model), `validate.ts` (`coerceLesson` — the only gate for incoming lessons), `presentation-styles.ts` (length + style presets), `themes.ts` (42 palettes), `motion.ts`, `export-html.ts` (standalone player builder), `text-fit.ts`, `reference-skim.ts`, `quiz.ts`, `run-log.ts`, `voices.ts`, `pollinations.ts`, `inline.ts`, `storage.ts` (localStorage fallback), `sample-lesson.ts`, `lesson-languages.ts`, `slide-icons.ts`. |
| `src/lib/server/` | `course-store.ts` (data/courses/, atomic writes), `extract.ts` (PDF/DOCX/XLSX/text → markdown), `guard.ts` (rejectRemote/rateLimit), `images.ts` (Openverse + Wikimedia search, licensing), `tts.ts`/`tts-local.ts`/`local-voices.ts`/`tts-cache.ts`/`tts-settings.ts`, `vietnamese.ts` (legacy VNI/TCVN3 font repair), `token-limit.ts`. |
| `src/lib/` (root) | `karaoke.ts` (word-mark alignment), `pointer-match.ts` (pointer target scoring), `theme.ts`, `gsap.ts`, `format.ts`, `three-palette.ts`. |
| `src/components/` | `player/` (LessonPlayer, GsapSlideStage, SlideSurface, SceneFigure, ScenePointer, KaraokeSubtitle, TeacherVoice, TransportBar, ScrubBar, FullscreenControls, ChapterList, ShortcutsDialog, InteractiveQuiz, InteractiveSimulation, InlineText, ClassroomAgentChat), `studio/` (StudioPanel, GenerationTimeline `useGenerationStream`, Premiere, LanguagePicker), `setup/`, `library/`, `site/`, `motion/`, `three/`. |
| `src/i18n/`, `src/hooks/`, `src/types/` | No-framework i18n (per-file COPY dicts), `useTimebase` single playhead, ambient File System Access typings. |
| `scripts/` | Quality checks, library tooling (`extract-library-text.mjs`, `index-course-library.mjs`, `setup-document-library.mjs`, `antigravity-permissions.mjs`, `install-antigravity.ps1`), Python TTS bridges (`scripts/local-voice/piper_speak.py`, `vieneu_speak.py`). |
| `data/` | Runtime data: `ai-settings.json`, `tts-settings.json`, `courses/` (**tracked** — lessons ship with the tool), `voices/`, `tts-cache/`, `token-limits.json`, `model-trust.json`, `course-library.json` (last four generated on demand; some gitignored). |
| `public_html/` | Static Vercel-deployed landing page (not part of the Next app). |

## Architectural invariants — breaking these causes real bugs

1. **Secrets stay server-side.** `.env` is the only credential store (`data/ai-settings.json`
   holds masks/choices only). `publicAiStatus()` is the only thing allowed to reach the browser.
   Base URLs are validated against `ALLOWED_BASE_HOSTS` *before* a key is ever written, because the
   key rides on every request to that URL. Key-admin and `courses` APIs are localhost-only
   (`isLocalRequest` Host check, `ALLOW_REMOTE_KEY_ADMIN` opt-out); the real control is binding to
   loopback — `npm run dev` does this. Never "fix" a client by loosening these.
2. **Routes talk to `src/lib/ai/llm.ts`, never to a vendor module.** Adding a provider = one
   `PROVIDERS` entry in `ai/config.ts` (+ follow the adapter pattern in `openai-compatible.ts`).
   A model only earns a "trusted" mark by *finishing a whole lesson* (`model-trust.ts`, per
   provider+model). Antigravity is a CLI provider: no key, `agy` binary, Windows headless defaults
   to `--dangerously-skip-permissions` because allow-rules don't work there.
3. **Everything is a deterministic timeline.** Every scene has explicit `start`/`duration`; the
   player builds one GSAP timeline and *seeks* it (`timeline.time()`), never plays through blindly.
   `relayoutLesson()` recomputes starts/chapters — don't hand-edit `scene.start`.
   `coerceLesson()` (src/lib/lesson/validate.ts) is the only gate for lessons arriving over
   HTTP/localStorage: it drops unknown fields, clamps limits, and returns `null` for a lesson with
   no scenes. Enforce new constraints there, not in callers.
4. **"Images off" must stay a guarantee, not a request.** The scene schema removes `imagePrompt`/
   `imageQuery` properties altogether when off, and the route strips them again at the end
   (fallback bodies/retries can still carry them). Do not "simplify" this back to a prompt rule.
5. **Playback never re-renders React.** The timebase (`src/hooks/useTimebase.ts`) and the narration
   channel (`src/lib/karaoke.ts` `NarrationChannel`, a **ref**) push into DOM nodes / `gsap.set`.
   Keep per-frame work out of React state; components read the channel in their own rAF loop.
6. **TTS tempo is load-bearing.** All engines are slowed to teaching pace in the service
   (`TEACHING_TEMPO = 0.75` via ffmpeg `atempo`), which is why scene durations use 3.2 words/s
   (`NARRATION_WORDS_PER_SECOND` in the lesson route). The TTS disk-cache key embeds tempo version
   `v4` — **bump it on ANY tempo change** (engine rate, length scale, atempo), or cached audio lies.
   Word marks are exact from Edge, estimated for Piper/VieNeu; karaoke alignment refuses to guess
   (≥90% two-way coverage or it falls back to un-highlighted sentences).
7. **Standalone HTML export is self-contained** except the pinned GSAP CDN script (needs internet
   on first open). Audio embeds as base64 data URIs (total >30 MB → 413). The exported player
   mirrors web behaviour by hand (motion table, fit pass, shortcuts) — when you change
   `motion.ts`/`text-fit.ts` rules, check `export-html.ts` too.
8. **i18n is per-file and typed.** Every component has a local `COPY = {en, vi}` consumed via
   `useCopy`; `vi` must match `en` key-for-key (type error otherwise). Default language is **en**;
   generated lesson content itself follows the brief's language (prompts are written in
   Vietnamese). When adding UI strings, add both languages.
9. **Prompt quality rules live in `src/app/api/gemini/lesson/route.ts`** (`SLIDE_QUALITY_RULES`,
   `SLIDE_DESIGN_RULES`, `SOLUTION_RULES`, `POINTER_RULES`, …) and are Vietnamese on purpose.
   They encode hard-won constraints: assertion titles <60 chars, ≤4 bullets <90 chars, tables
   exactly once, graphs as 49–99 sampled points with `null` at asymptotes, one pointer cue per
   narration sentence from the closed `POINTER_TARGETS` list, no AI-slop phrasing. Treat them as
   product behaviour, not prose.
10. **Data files are written atomically** (`tmp` + `rename`) and `id`s are path-traversal checked
    (`isValidCourseId`). Cache/courtesy writes (drafts, TTS cache, run logs) swallow failures;
    lesson writes must not. Keep that asymmetry.

## Conventions

- **Named exports only** (no default exports in components); one component per file, PascalCase
  files. Props typed inline or local `XProps`.
- Double quotes, 2-space indent, semicolons, trailing commas, `type`-only imports.
- Comments are expected and *why*-focused: full sentences describing rationale and past bugs
  ("the old 24-cap orphaned chapters in long lessons"). Match that style; do not strip them.
  `ponytail:` comments mark deliberate simplifications with their ceiling + upgrade path — respect
  or update them, don't silently remove.
- Tailwind v4 tokens from `globals.css`: ramps `ink-*` / `mist-*` / `brand-*` / `gold-*` /
  `ember-*`; reusable classes `.panel`, `.chip`, `.btn-*`, `.kbd`; dark mode = single
  `data-theme="dark"` attribute (`@custom-variant dark`), set pre-paint by `theme.ts` bootstrap.
- Slides are styled by `.scene-*` classes sized in container-query units (`cqw`) multiplied by a
  `--slide-fit` variable; state variants use `data-*` attributes. There are **two** slide renderers
  (React `SlideSurface` and the string builder in `export-html.ts`) — changes to slide markup often
  need both.
- Numbers that must be testable live in one constant: `MAX_LESSON_SCENES` is derived from
  `LESSON_LENGTHS` (never hard-code a scene cap), text sizes come from `text-fit.ts` tables, quiz
  timings from `quiz.ts`.
- Windows-first tooling: `.cmd`/PowerShell scripts ASCII-only; portable toolchain under `.runtime\`;
  `run.bat` must keep working without admin rights.

## Working rule — a green check suite is not a finished feature

Standing user rule: **finish → review → re-check → walk the real UI → fix → repeat until it is
actually right.** `npm run verify` is the floor, not the proof. After it goes green, drive the real
screen (chrome-devtools MCP, or `scripts/smoke-test.ps1`) at narrow and desktop widths, and click
through every new state you added. The quiz hold that rendered as "8.333333333333332s" had passed
every unit check — a pure function returning a numerically fine value can still print an ugly one.
Report done only after the screen agrees.

## Environment variables (see `.env.example`, Vietnamese comments)

`AI_PROVIDER` (`groq|nvidia|tokenharbor|antigravity`), `GROQ_*` / `NVIDIA_*` / `TOKENHARBOR_*`
(key, model, base URL — Token Harbor is an OpenAI-compatible gateway; ids ending `:free` never
charge the balance),
`ANTIGRAVITY_MODEL`, `AGY_BINARY`, `COURSE_LIBRARY_DIR`, `ANTIGRAVITY_STRICT_PERMISSIONS`,
`ANTIGRAVITY_SKIP_PERMISSIONS`, `ANTIGRAVITY_DEBUG_LOG`, `AI_DEBUG_LOG`, `LOCAL_ONLY_HOSTS`,
`AI_ALLOWED_BASE_HOSTS`, `ALLOW_REMOTE_KEY_ADMIN`, `EDUSGPT_PYTHON`.
`.env` is tracked with blank keys and written by `/setup` — never commit one with a key, and never
paste a key anywhere else.

## Known gotchas

- `src/app/api/gemini/lesson/route.ts` is named `gemini` for history; it is provider-agnostic.
- Gemini's responseSchema subset has no nested arrays: table `rows` travel as `"|"`-joined strings
  (validator accepts both shapes).
- `src/lib/server/extract.ts` starts with a UTF-8 BOM — some tooling misdetects it as binary.
- `msedge-tts` workarounds in `tts.ts` (pre-created `metadata.json`, ENOENT-swallowing
  `uncaughtException`, single shared socket) are load-bearing; removing them makes ~1/3 narrations
  fail mid-stream.
- Antigravity errors: never let `execFile`'s argv echo reach the browser (the prompt contains
  library contents); `safeAgyError` exists for exactly that.
- `localStorage` fallback storage caps at 30 lessons (`storage.ts`); the server library
  (`data/courses/`) is uncapped and authoritative.
- `data/course-library.json`, `data/model-trust.json`, `data/token-limits.json` don't exist until
  first use — that's normal, not a missing file.
- Two promotional `.mp4`s and `README.html` at the repo root are marketing assets; leave them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
