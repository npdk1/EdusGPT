<p align="center">
  <img src="public/logo.png" width="120" alt="EdusGPT logo" />
</p>

<h1 align="center">EdusGPT</h1>

<p align="center">
  <strong>Turn any topic or study document into an interactive, narrated learning deck —</strong><br />
  with synchronized 60 FPS slides, voiceover, word-by-word karaoke subtitles, KaTeX mathematical formulas, real-time quizzes, 3D flashcards, Chinese-Latin encrypted local storage, and single-file HTML export.
</p>

<p align="center">
  <strong>English</strong> · <a href="README_VN.md">Tiếng Việt</a> · <a href="README.html">Interactive HTML Guide</a>
</p>

<p align="center">
  <a href="https://github.com/npdk1/EdusGPT"><img src="https://img.shields.io/badge/source-GitHub-0b63e5?logo=github" alt="Source on GitHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Windows, macOS, Linux" />
  <img src="https://img.shields.io/badge/Next.js-16.3.6-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/GSAP-3.15-88CE02?logo=greensock" alt="GSAP" />
</p>

---

## 🎬 Product Showcase Video (`intro.mp4`)

Watch the official 30-second product tour showcasing the complete EdusGPT ecosystem:

<div align="center">
  <video src="public_html/video/intro.mp4" controls loop playsinline width="100%" style="max-width: 880px; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 1px solid #1e293b;">
    <p>Your browser does not support HTML5 video. View the clip directly at <a href="public_html/video/intro.mp4">public_html/video/intro.mp4</a>.</p>
  </video>
</div>

### ⏱️ Frame-by-Frame Synchronization Breakdown

The intro video was captured and rendered at **60 FPS** in full HD (1920×1080). Every milestone aligns with EdusGPT's core architecture:

| Timestamp | Frame Ref | Visual Segment | Technical Capability & System Architecture |
|:---:|:---:|:---|:---|
| **`00:00 - 00:02.4`** | `frame_01` | `// 01 - hook` | **The EdusGPT Mascot Teacher**: Pixel-dithered robot tutor welcoming the learner with a modern editorial aesthetic. |
| **`00:02.4 - 00:05.0`** | `frame_04` | `// 02 - capabilities` | **AI Studio (`/studio`)**: Generates structured, multi-sensory slides from attached PDFs, DOCX, textbooks, or custom prompts via two-stage streaming. |
| **`00:05.0 - 00:09.0`** | `frame_07` | `// 03 - interactive deck` | **Interactive Lesson Player (`/lesson`)**: Turns lessons into responsive live decks with word-level karaoke subtitles and millisecond-accurate seek bar. |
| **`00:09.0 - 00:12.0`** | `frame_10` | `// 04a - 3D flashcards` | **Active Recall Flashcards (`/flashcard`)**: 3D spatial cards with flip animation, formula zoom, and spaced repetition keyboard shortcuts. |
| **`00:12.0 - 00:15.0`** | `frame_12` | `// 04b - real-time quiz` | **In-Slide Practice Checkpoints (`/quiz`)**: Multi-question quiz banks with instant feedback, scoring, and step-by-step explanations that gate slide progression. |
| **`00:15.0 - 00:21.2`** | `frame_18` | `// 05 - orchestrated` | **The Bento Architecture**: Full orchestration dashboard featuring the 60 FPS timeline player, On-Air AI tutor, KaTeX AST math pipeline, and Single HTML exporter. |
| **`00:21.2 - 00:25.0`** | `frame_23` | `// 06 - flow` | **"You teach. We deliver."**: Zero cloud database, zero telemetry, local-first storage with military-grade Chinese-Latin cryptographic vault. |
| **`00:25.0 - 00:30.0`** | `frame_28` | `// 07 - outro & CTA` | **EdusGPT Ecosystem**: "Interactive learning decks that you deserve." 100% free, open-source, and offline-capable. |

---

## 🌟 Key Capabilities

- 🎙️ **Synchronized Voiceover & Subtitles**: Neural Edge TTS, offline Piper, and custom VieNeu models with real-time, word-by-word highlighted karaoke subtitles at a measured teaching tempo.
- 📐 **Full KaTeX Math Rendering Pipeline**: Formulas in `$ ... $` and `$$ ... $$` render beautifully across slides, multi-question quizzes, answer choices, and tutor chats. Supports nested roots, complex fractions, and long systems up to 1,000 characters without truncation.
- 🧩 **Multi-Question Quiz Bank Gates**: In-slide practice gates with active feedback, score tracking, and detailed explanations that pause the presentation until answered. Long courses (45–60 min) include comprehensive 25+ question banks per lesson.
- 🎴 **Active Recall 3D Flashcards**: Spatial cards with audio narration, formula zoom, and spaced-repetition keybindings (`Space` to flip, `←` / `→` to navigate).
- 🔐 **Chinese-Latin Dual Cipher Vault**: Proprietary high-security encryption (`EDUS_ZH_LATIN_CIPHER_V1`) for all stored courses and audio caches in `data/`, pairing AES-256-GCM with interleaved CJK ideographic glyph transposition. Only EdusGPT can read and write course files.
- ⚙️ **Library Management & Storage Optimizer**: Integrated settings modal on each course card in `/library`:
  - **Storage Optimizer (Trim)**: Strips heavy audio clips and narration slides to reclaim up to 90% disk space while strictly preserving high-value Quiz banks and Flashcards.
  - **Safe Trash & Permanent Deletion**: Choose between moving courses to `data/temp_delete/` for easy recovery or permanent destruction.
- 🌐 **Self-Contained Single HTML Export**: Export entire courses to a standalone offline `.html` file with embedded base64 audio and the GSAP playback engine — opens anywhere without a backend server or network connection.
- 🔍 **Instant Course Switcher**: Integrated toolbar dropdown to search, filter by subject/grade, and seamlessly switch between any created courses in real time.

---

## 🚀 Quick Start

### Windows:
Double-click `run.bat`.

### macOS or Linux:
```bash
chmod +x run.sh
./run.sh
```

Both scripts verify Node 22+, install missing dependencies, configure `.env` automatically from `.env.example`, free port 3000 if occupied, launch the browser, and start the development server. On Windows, `run.bat` provides an interactive ANSI-colored terminal with 7-stage visual progress bars and portable runtime bootstrap. Press `Ctrl+C` to stop.

### Manual Run:
```bash
npm install
npm run dev          # Accessible at http://localhost:3000
```

### Runtime Health Check:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1
```

---

## 🔑 AI Providers & API Keys

Open `/setup` in your browser. EdusGPT supports two primary modes:

1. **Cloud APIs (OpenAI-Compatible)**:
   - **Groq** (`console.groq.com`): Ultra-fast inference with Llama 3.3 70B.
   - **NVIDIA NIM** (`build.nvidia.com`): High-throughput DeepSeek-R1 and Llama 3 models.
   - **Token Harbor**: Multi-model gateway.
   - Paste keys into the setup page, click **Test Key**, and save. Keys are securely stored in `.env` (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `TOKENHARBOR_API_KEY`) and masked in the GUI.
2. **Local AI Agent (No Cloud API Required)**:
   - **Antigravity CLI (`agy`)**: Directly connects to your local document repository, indexes textbook chapters, and writes curriculum outlines without incurring cloud fees. See `docs/ANTIGRAVITY.md`.

---

## 🎨 Studio: Generating Lessons

Open `/studio` and customize your course:
- **Input**: Enter topic, select subject (Math, Physics, Chemistry, Biology, Informatics, History, Literature, English) and target grade (Grades 1–12, University).
- **Attachments**: Attach PDFs, Word DOCX, spreadsheets, or raw notes (up to 40 MB each).
- **Presets & Length**:
  - `Short` (3–5 slides, 1–2 min): Rapid concept introductions.
  - `Medium` (10–16 slides, 6–10 min): Standard classroom topic lectures.
  - `Long` (60–95 slides, 45–60 min): Comprehensive high-school or university chapters with extensive 25+ question quiz banks.
- **Visual Styles**: Minimalist, Visual Storytelling, Classroom Blackboard, Cinematic Dark.
- **Audio & Voiceover**: Neural Vietnamese voices (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural` with variable pace) or offline Piper.

Lessons stream in real time: first the structural outline, followed by asynchronous parallel scene drafting.

---

## 🎮 Interactive Player Keyboard Controls

Open `/lesson` to view any generated course:

| Key Binding | Action |
|:---:|:---|
| `Space` / `K` | Play / Pause presentation |
| `←` / `→` | Seek backward / forward 5 seconds |
| `J` / `L` | Seek backward / forward 10 seconds |
| `Shift + ←/→` | Fine seek exactly 1 second |
| `,` / `.` | Single-frame step backward / forward (`1/fps`) |
| `0` – `9` | Jump directly to 0% – 90% of total runtime |
| `Home` / `End` | Jump to beginning / end of lesson |
| `[` / `]` / `\` | Set Loop Point A, Set Loop Point B, Toggle Loop |
| `−` / `+` | Decrease / increase speech playback speed (0.8× – 2.0×) |
| `F` | Toggle fullscreen mode |
| `?` | Show interactive keyboard shortcuts sheet |

---

## 📁 Project Structure

```
├── data/
│   ├── courses/          # Encrypted course files (*.json with Chinese-Latin cipher)
│   ├── temp_delete/      # Soft-deleted courses (trash recovery bin)
│   └── tts-cache/        # Encrypted neural speech cache (*.mp3, *.words.json)
├── public/               # Static assets, branding logo, vendor badges
├── public_html/          # High-performance static landing page
│   ├── index.html        # Interactive landing page with synced intro video
│   └── video/intro.mp4   # 60 FPS Full HD product presentation video
├── scripts/
│   ├── audit-all-curriculum.mjs  # 100% automated KaTeX and curriculum validator
│   ├── check-*.mjs               # 7-stage quality checks (palette, icons, quiz, pace...)
│   └── curriculum/               # Comprehensive curriculum generator modules
├── src/
│   ├── app/              # Next.js 16 App Router (/studio, /lesson, /library, /quiz...)
│   ├── components/       # Player, Studio, Library, Quiz, and Flashcard UI
│   │   ├── library/      # CourseCards and CourseSettingsModal (Trim & Delete)
│   │   └── player/       # GsapSlideStage, KaraokeSubtitle, SceneFigure, KaTeX
│   └── lib/
│       ├── ai/           # LLM adapters (OpenAI-compatible, Groq, NVIDIA, Antigravity)
│       ├── lesson/       # Course schema, inline LaTeX parser, validation, AST
│       └── server/       # Course store, tts-cache, and crypto-vault.ts
├── run.bat / run.sh      # One-click startup scripts
└── uninstall.bat         # Interactive cache cleaner and uninstaller
```

---

## 🧪 Quality Verification Suite

EdusGPT enforces strict continuous verification before any release:

```bash
# Run complete verification suite (7 checks + strict typecheck)
npm run verify

# Individual checks
npm run check:palette     # Banned color check (strictly deep obsidian / blue / gold)
npm run check:icons       # Validates all 89 slide icons against Lucide registry
npm run check:subtitle    # Verifies word-level karaoke timing and sentence handover
npm run check:length      # Validates slide counts vs narration for all 3 presets
npm run check:pace        # Tests voice pacing clamps and audio tempo uniformity
npm run check:quiz        # Tests quiz gates, question bank sizing, and scoring
npm run typecheck         # Full TypeScript strict validation (tsc --noEmit)
npm run build             # Production Next.js Turbopack build
```

---

## 📄 License

Distributed under the **MIT License**. Created with ❤️ by [npdk1](https://github.com/npdk1/EdusGPT).
