import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import { SCENE_KIND_LABEL, type Lesson } from "./types";
import { type AlignedSentence } from "@/lib/karaoke";
import { inlineHtml } from "./inline";
import { pollinationsImageUrl } from "./pollinations";
import {
  isDarkTheme,
  resolveSlideTheme,
  type SlidePalette,
} from "./themes";

/**
 * Builds a standalone, self-contained HTML "player" for one lesson — one file,
 * timeline and all, with no server involved, and scrubbable in both directions
 * out of the box.
 *
 * The slide and the subtitle are the web player's, not a lookalike: same type
 * ladder in `cqw` against the same 16:9 box, same hairline bullets, same
 * two-row caption with the sentence being spoken over the one coming next, and
 * the same three word states. A download that only resembled the page it came
 * from was a second renderer to keep in step with the first, and it drifted.
 *
 * GSAP is loaded from a CDN, so the file needs internet on first open; the
 * lesson data itself is embedded inline.
 */
const CSS = `
:root{color-scheme:dark;--ink:#04090b;--ink2:#0c151a;--ink3:#18272f;--line:#22353e;--mist:#e3eff0;--mist3:#9fb9bd;--mist5:#567277;--brand:#24bdac;--brand3:#57d6c6;--brand7:#0d665e;--gold:#f6b93b;--gold3:#fbd275;--ember:#ff8a5b}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--mist);font-family:ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif}
body{background-image:radial-gradient(50rem 32rem at 12% -8%,rgba(36,189,172,.16),transparent 62%),radial-gradient(40rem 28rem at 92% 2%,rgba(246,185,59,.12),transparent 60%);min-height:100vh}
.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 64px}
.head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:16px}
.head h1{margin:0;font-size:20px;letter-spacing:-.01em}
.tag{font-size:11px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--mist3)}
.mono{font-family:ui-monospace,Consolas,monospace}

/* The slide box. \`container-type\` is what lets everything inside measure its
   type in \`cqw\` against this box, so the sizes below are the same numbers the
   web player's stylesheet uses rather than a fresh guess at "about right". */
.stage{position:relative;aspect-ratio:16/9;container-type:inline-size;background:var(--ink2);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 28px 60px -34px rgba(0,0,0,.75)}
.scene{position:absolute;inset:0;opacity:0;visibility:hidden}
.card{--slide-fit:1;position:absolute;inset:0;display:flex;flex-direction:column;justify-content:safe center;gap:1.1cqw;padding:3.4cqw 5.5cqw 9cqw;overflow:hidden;background-image:linear-gradient(180deg,color-mix(in srgb,var(--ink) 88%,var(--mist5)) 0%,var(--ink) 38%,var(--ink3) 100%)}
.wash{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 90% at 88% -10%,color-mix(in srgb,var(--brand3) 16%,transparent) 0%,transparent 62%)}
.wm{position:absolute;right:6%;bottom:4%;font-family:ui-monospace,monospace;font-size:1.6cqw;font-weight:700;color:color-mix(in srgb,var(--mist5) 70%,transparent)}
.head-in{position:relative;z-index:1;width:100%;max-width:86%}
.kicker{display:inline-flex;align-items:center;gap:.6cqw;font-size:calc(1.05cqw * var(--slide-fit));font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--brand)}
.title{margin:2.5% 0 0;font-size:calc(5.2cqw * var(--slide-fit));line-height:1.04;letter-spacing:-.03em;font-weight:700;color:var(--mist);text-wrap:balance}
.sub{margin:2% 0 0;font-size:calc(1.7cqw * var(--slide-fit));color:var(--mist3)}
.rule{border:0;border-top:1px solid var(--line);width:22%;margin:3% 0 0}

/* Hairlines, not filled cards: one alignment for the eye and none of the visual
   weight, which is what keeps a long list looking designed. */
.body{position:relative;z-index:1;display:grid;width:100%;max-width:86%;gap:0 6%;grid-template-columns:1fr;margin:0;padding:0;list-style:none}
@container (min-width:620px){.body{grid-template-columns:1fr 1fr}}
.body li{display:flex;align-items:baseline;gap:1.5cqw;font-size:calc(1.4cqw * var(--slide-fit));line-height:1.62;padding:.75cqw 0;border-top:1px solid var(--line);color:var(--mist3)}
.body .bi{font-family:ui-monospace,monospace;font-size:.8em;font-weight:600;color:var(--brand);flex:0 0 auto}
.body li>span:last-child{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.inline-code{font-family:ui-monospace,monospace;font-size:.92em;padding:0 .3em;border-radius:.3em;background:color-mix(in srgb,var(--mist) 8%,transparent)}
.formula{margin:0;width:fit-content;border:1px solid rgba(246,185,59,.4);background:rgba(246,185,59,.1);color:var(--gold3);border-radius:12px;padding:12px 16px;font-family:ui-monospace,monospace;font-size:calc(2cqw * var(--slide-fit));font-weight:600}
.fig{position:relative;z-index:1;margin:1.2cqw 0 0;display:flex;flex-direction:column;align-items:center}
.fig img{max-width:78%;max-height:32cqw;border-radius:1.2cqw;border:1px solid var(--line);cursor:zoom-in;background:var(--ink3)}
.fig figcaption{margin-top:.5cqw;font-size:calc(1cqw * var(--slide-fit));color:var(--mist5)}
.fig.gone{display:none}

/* The caption: two rows held open at all times, the sentence being spoken over
   the one coming next. Reserving both rows is the point — a caption whose height
   changes when the hand-over happens moves every line on screen, and the reader
   feels it as a stutter at the exact moment they are following the voice. */
.cap{position:absolute;left:4%;right:4%;bottom:1.08cqw;height:5.22cqw;overflow:hidden;text-align:center;pointer-events:none}
.sent{position:absolute;left:0;right:0;margin:0;font-size:1.75cqw;line-height:1.32;font-weight:500;letter-spacing:.005em;color:var(--mist);opacity:0;transition:opacity .16s linear}
.sent[data-row="live"]{top:0;opacity:1}
.sent[data-row="next"]{top:2.91cqw;opacity:1;color:var(--mist5)}
.sent .w{padding:0 1px;transition:color 90ms linear}
.sent .w[data-state="idle"]{color:var(--mist5)}
.sent .w[data-state="said"]{color:var(--mist3)}
.sent .w[data-state="now"]{color:var(--brand)}
.cap-plain{position:absolute;left:0;right:0;top:0;margin:0;font-size:1.75cqw;line-height:1.32;font-weight:500;color:var(--mist3)}
.bar{position:absolute;left:0;bottom:0;height:3px;width:100%;transform:scaleX(0);transform-origin:left center;background:linear-gradient(90deg,var(--brand),var(--gold3))}

/* Click a picture to read it: a downloaded file has no player to go back to, so
   the zoom is the only way to see the detail the slide was pointing at. */
.zoom{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(4,9,11,.86);backdrop-filter:blur(2px)}
.zoom.on{display:flex}
.zoom img{max-width:96vw;max-height:88vh;border-radius:14px;border:1px solid var(--line)}
.zoom-x{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:999px;padding:0;font-size:20px;line-height:1}

.controls{margin-top:16px;border:1px solid var(--line);background:rgba(8,15,19,.75);border-radius:16px;padding:14px}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
button{font:inherit;color:var(--mist);background:rgba(17,29,35,.9);border:1px solid var(--line);border-radius:10px;padding:8px 12px;cursor:pointer}
button:hover{border-color:var(--brand7);color:#fff}
button.primary{background:var(--brand);border-color:var(--brand);color:#04090b;font-weight:700;min-width:46px}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:10px;border-radius:999px;background:var(--ink3);border:1px solid var(--line)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-5px;border-radius:999px;background:var(--brand3);border:2px solid var(--ink)}
input[type=range]::-moz-range-track{height:10px;border-radius:999px;background:var(--ink3)}
input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:999px;background:var(--brand3);border:2px solid var(--ink)}
.marks{display:flex;flex-direction:column;gap:6px;margin-top:12px}
.mark{text-align:left;font-size:12px;color:var(--mist3);background:transparent;border:0;border-left:1px solid var(--brand7);border-radius:0;padding:4px 10px}
.mark:hover{color:var(--brand3);border-left-color:var(--brand3)}
.ab{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:12px;padding:4px}
.ab.on{background:var(--gold);color:#04090b;border-color:var(--gold);font-weight:700}
.hint{color:var(--mist5);font-size:11px;margin-top:10px;font-family:ui-monospace,monospace}
@media (prefers-reduced-motion:reduce){.sent,.sent .w{transition:none}}
`;

/**
 * Recolours the generic player chrome with the lesson's own paper.
 *
 * The web player reads every colour through the slide's palette, so a deck on
 * "Giấy kem" is light and a deck on "Mực tàu" is dark. The standalone file used
 * to ignore that and always ship the dark look, which is why a download never
 * resembled the web page. Redefining the same variables keeps the layout
 * untouched while the whole page — paper, wash, controls, buttons, caption —
 * follows the chosen preset.
 */
function themeCss(palette: SlidePalette, dark: boolean): string {
  const p = palette;
  return (
    `:root{color-scheme:${dark ? "dark" : "light"};` +
    `--ink:${p.bg};--ink2:${p.bg};--ink3:${p.bgSunk};--line:${p.rule};` +
    `--mist:${p.ink};--mist3:${p.inkSoft};--mist5:${p.inkFaint};` +
    `--brand:${p.accent};--brand3:${p.accentSoft};--brand7:${p.accent}}` +
    `body{background-image:none}` +
    `.stage{background:${p.bg}}` +
    `.controls{background:color-mix(in srgb, ${p.bgSunk} 72%, transparent)}` +
    `button{background:color-mix(in srgb, ${p.bgSunk} 90%, transparent)}` +
    `button.primary{color:${dark ? "#04090b" : "#ffffff"}}` +
    `.wash{background:radial-gradient(120% 90% at 88% -10%,` +
    `color-mix(in srgb, ${p.accentSoft} 16%, transparent) 0%,transparent 62%)}` +
    `.fig img{background:${p.bgSunk}}` +
    `.zoom{background:color-mix(in srgb, ${p.ink} 82%, transparent)}` +
    `.formula{border-color:color-mix(in srgb, #f6b93b 40%, transparent);` +
    `background:color-mix(in srgb, #f6b93b 10%, transparent)}`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * KaTeX stylesheet inlined into the standalone file, read once from the
 * installed package. The web player gets it through its CSS bundle; the export
 * has no bundle, so it carries the text. Font files are referenced by relative
 * URL and will not resolve next to a downloaded file — the layout still holds
 * on fallback fonts, only the glyph shapes differ.
 */
let cachedKatexCss: string | null = null;
function katexCss(): string {
  if (cachedKatexCss !== null) return cachedKatexCss;
  try {
    cachedKatexCss = fs.readFileSync(
      path.join(process.cwd(), "node_modules", "katex", "dist", "katex.min.css"),
      "utf8",
    );
  } catch {
    cachedKatexCss = "";
  }
  return cachedKatexCss;
}

/**
 * Renders one scene's formula with the same KaTeX options the web player uses
 * (`SceneFigure`). A formula KaTeX rejects falls back to escaped raw text —
 * identical to the web behaviour, so the two never disagree about a scene.
 */
function formulaMarkup(formula: string): string {
  let inner: string;
  try {
    inner = katex.renderToString(formula, {
      displayMode: true,
      throwOnError: true,
      strict: false,
      trust: false,
      output: "htmlAndMathml",
    });
  } catch {
    inner = escapeHtml(formula);
  }
  return `<p class="formula">${inner}</p>`;
}

/**
 * Renders one scene's narration as the web player's caption: every sentence in
 * the file, each word carrying its speaking window, and the script below showing
 * the sentence being spoken over the one coming next.
 *
 * Every sentence is written out rather than only the current one because this
 * file has no state to rebuild DOM from — the whole point is that it scrubs
 * backwards. The rows are placed by the script; a scene with no timings at all
 * (a voice that failed, an alignment the coverage check rejected) falls back to
 * the plain paragraph, because a caption that can never light up is worse than
 * the text it was hiding.
 */
function narrationMarkup(narration: string, sentences: AlignedSentence[]): string {
  if (sentences.length === 0) {
    return `<div class="cap"><p class="cap-plain">${escapeHtml(narration)}</p></div>`;
  }
  let lastStart = 0;
  const inner = sentences
    .map((sentence, index) => {
      const start = sentence.start ?? lastStart;
      lastStart = start;
      const words = sentence.tokens
        .map((token) => {
          const text = escapeHtml(token.text);
          if (token.start === null || token.end === null) {
            return `<span class="w" data-state="idle">${text}</span>`;
          }
          return `<span class="w" data-state="idle" data-s="${token.start.toFixed(3)}">${text}</span>`;
        })
        .join("");
      return `<p class="sent" data-row="off" data-sent="${index}" data-start="${start.toFixed(3)}">${words}</p>`;
    })
    .join("");
  return `<div class="cap">${inner}</div>`;
}

/**
 * The slide's own picture, asked of the same URL the web player asks for.
 *
 * The seed is derived from the lesson and the scene id, so the downloaded file
 * and the web page show the same picture for the same slide. It is a remote URL
 * on purpose: an archive search would need a server this file does not have, and
 * a data-URI copy of every picture would multiply the size of the download for
 * something the fallback chain already covers.
 */
function figureMarkup(lesson: Lesson, scene: Lesson["scenes"][number]): string {
  const prompt = (scene.imagePrompt ?? "").trim();
  if (prompt.length < 3) return "";
  const src = pollinationsImageUrl(lesson.id, scene.id, prompt);
  return (
    `<figure class="fig">` +
    // Remote picture: there is no image pipeline in a downloaded file.
    // eslint-disable-next-line @next/next/no-img-element
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(scene.title)}" loading="lazy" referrerpolicy="no-referrer" />` +
    `<figcaption>Ảnh AI &middot; pollinations.ai &mdash; bấm để phóng to</figcaption>` +
    `</figure>`
  );
}

function sceneMarkup(
  lesson: Lesson,
  audios: (string | null)[],
  karaoke: AlignedSentence[][],
): string {
  return lesson.scenes
    .map((scene, index) => {
      const bullets = scene.bullets
        .map(
          (bullet, bulletIndex) =>
            `<li><span class="bi">${String(bulletIndex + 1).padStart(2, "0")}</span>` +
            `<span>${inlineHtml(bullet, escapeHtml)}</span></li>`,
        )
        .join("");
      const steps = (scene.steps ?? [])
        .map(
          (step, stepIndex) =>
            `<li><span class="bi">B${stepIndex + 1}</span>` +
            `<span>${inlineHtml(step, escapeHtml)}</span></li>`,
        )
        .join("");
      const audio = audios[index];
      return [
        `<article class="scene" data-scene="${index}">`,
        audio
          ? `<audio data-voice preload="auto" src="${audio}"></audio>`
          : "",
        `<div class="card">`,
        `<div class="wash"></div>`,
        `<header class="head-in">`,
        `<span class="kicker">${escapeHtml(SCENE_KIND_LABEL[scene.kind])}</span>`,
        `<h2 class="title">${inlineHtml(scene.title, escapeHtml)}</h2>`,
        scene.subtitle ? `<p class="sub">${inlineHtml(scene.subtitle, escapeHtml)}</p>` : "",
        `<hr class="rule" />`,
        `</header>`,
        bullets ? `<ul class="body">${bullets}</ul>` : "",
        steps ? `<ol class="body">${steps}</ol>` : "",
        scene.formula ? formulaMarkup(scene.formula) : "",
        figureMarkup(lesson, scene),
        scene.narration
          ? narrationMarkup(scene.narration, karaoke[index] ?? [])
          : "",
        `<span class="wm">${String(index + 1).padStart(2, "0")}</span>`,
        `<div class="bar"></div>`,
        `</div></article>`,
      ]
        .filter(Boolean)
        .join("");
    })
    .join("\n");
}

function chapterMarkup(lesson: Lesson): string {
  return lesson.chapters
    .map(
      (chapter, index) =>
        `<button class="mark" data-seek="${chapter.start}" data-chapter="${index}">${escapeHtml(
          chapter.title,
        )} &middot; ${chapter.start.toFixed(1)}s</button>`,
    )
    .join("");
}

const PLAYER_JS = `
(function () {
  var data = JSON.parse(document.getElementById('lesson-data').textContent);
  var stage = document.getElementById('stage');
  var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });

  data.scenes.forEach(function (scene, index) {
    var el = stage.querySelector('[data-scene="' + index + '"]');
    var card = el.querySelector('.card');
    var title = el.querySelector('.title');
    var sub = el.querySelector('.sub');
    var rows = el.querySelectorAll('.body li');
    var formula = el.querySelector('.formula');
    var figure = el.querySelector('.fig');
    var cap = el.querySelector('.cap');
    var bar = el.querySelector('.bar');
    var at = scene.start;
    tl.set(el, { autoAlpha: 1, zIndex: 2 }, at)
      .set(el, { autoAlpha: 0, zIndex: 1 }, at + scene.duration - 0.001)
      .fromTo(card, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, at);
    if (title) tl.fromTo(title, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55 }, at + 0.08);
    if (sub) tl.fromTo(sub, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, at + 0.18);
    if (rows.length) tl.fromTo(rows, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.09 }, at + 0.3);
    if (formula) tl.fromTo(formula, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, at + 0.45);
    if (figure) tl.fromTo(figure, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, at + 0.5);
    if (cap) tl.fromTo(cap, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, at + Math.min(scene.duration * 0.55, 1.6));
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: scene.duration, ease: 'none' }, at);
  });
  tl.duration(Math.max(data.duration || 0, tl.duration()));
  var total = tl.duration();

  var current = 0, playing = false, rate = 1, raf = null, last = 0;
  var loopOn = false, loopA = 0, loopB = 0;
  var range = document.getElementById('scrub');
  var clock = document.getElementById('clock');
  var playBtn = document.getElementById('play');
  var fps = data.fps || 30;
  range.max = String(total);

  // --- teacher voice: one narration clip per scene, embedded as data URIs.
  // There is no server here, so every clip rides inside the file. The timeline
  // stays the master clock: on each paint while playing, a scene change swaps
  // the clip and seeks it to the playhead offset. A clip shorter than its
  // scene leaves silence; a longer one is cut at the scene boundary.
  var voiceEls = [];
  for (var vi = 0; vi < data.scenes.length; vi++) {
    var vel = stage.querySelector('[data-scene="' + vi + '"] audio[data-voice]');
    voiceEls.push(vel && vel.getAttribute('src') ? vel.getAttribute('src') : null);
  }
  var voice = document.getElementById('voice');
  var voiceOn = true;
  var voiceScene = -1;

  // --- the caption, read the way the web player reads it.
  //
  // Every sentence of every scene is already in the file, each word carrying its
  // speaking window in data-s (seconds into the scene's own clip, aligned
  // server-side). The playhead decides two things per frame, and only two:
  // which sentence is live, and which word inside it is being spoken. Words
  // before the current one are "said", the current one takes the accent, the
  // rest stay faint — three states, because a line that only lights the current
  // word is hard to read: the eye needs the words already spoken to follow the
  // sentence, and the ones not yet reached to know what is coming.
  //
  // The sentence rule is the last one whose first word has begun. A caption that
  // advanced on a timer would drift from the voice, and drift is the one thing
  // that makes a karaoke caption feel broken.
  var caps = [];
  for (var ci = 0; ci < data.scenes.length; ci++) {
    var capEl = stage.querySelector('[data-scene="' + ci + '"] .cap');
    var sentEls = capEl ? capEl.querySelectorAll('.sent') : [];
    var sents = [];
    for (var si = 0; si < sentEls.length; si++) {
      var wordEls = sentEls[si].querySelectorAll('.w');
      var words = [];
      for (var wi = 0; wi < wordEls.length; wi++) {
        var ws = parseFloat(wordEls[wi].getAttribute('data-s'));
        words.push({ el: wordEls[wi], start: isFinite(ws) ? ws : null, state: 'idle' });
      }
      var ss = parseFloat(sentEls[si].getAttribute('data-start'));
      sents.push({ el: sentEls[si], words: words, start: isFinite(ss) ? ss : null, row: 'off', lit: -2 });
    }
    caps.push(sents);
  }

  function restamp(sent, active) {
    for (var i = 0; i < sent.words.length; i++) {
      var state = active > -1 && i < active ? 'said' : (active === i ? 'now' : 'idle');
      if (sent.words[i].state !== state) {
        sent.words[i].el.setAttribute('data-state', state);
        sent.words[i].state = state;
      }
    }
    sent.lit = active;
  }

  function paintCaption(idx, off) {
    for (var i = 0; i < caps.length; i++) {
      var list = caps[i];
      var spoken = -1;
      if (i === idx) {
        for (var j = 0; j < list.length; j++) {
          var start = list[j].start;
          if (start === null) continue;
          if (start <= off) spoken = j;
        }
        if (spoken < 0) spoken = 0;
      }
      for (var k = 0; k < list.length; k++) {
        var sent = list[k];
        var row = i !== idx ? 'off' : (k === spoken ? 'live' : (k === spoken + 1 ? 'next' : 'off'));
        if (row !== sent.row) {
          sent.el.setAttribute('data-row', row);
          sent.row = row;
        }
        if (k !== spoken) {
          // Off screen, so the words do not matter — but they must not keep a
          // highlight from the last time this sentence was the live one.
          if (sent.lit !== -1) restamp(sent, -1);
          continue;
        }
        // The word being spoken: the last one that has already started. A step
        // forward rewrites two words, the one left and the one entered; a seek
        // can jump the length of the sentence, so the whole range is re-stamped.
        var want = -1;
        for (var w = 0; w < sent.words.length; w++) {
          if (sent.words[w].start !== null && sent.words[w].start <= off) want = w;
        }
        if (want === sent.lit) continue;
        if (Math.abs(want - sent.lit) > 1) {
          restamp(sent, want);
        } else {
          var leaving = sent.lit >= 0 ? sent.words[sent.lit] : null;
          if (leaving) {
            var left = sent.lit < want ? 'said' : 'idle';
            if (leaving.state !== left) {
              leaving.el.setAttribute('data-state', left);
              leaving.state = left;
            }
          }
          var entering = want >= 0 ? sent.words[want] : null;
          if (entering && entering.state !== 'now') {
            entering.el.setAttribute('data-state', 'now');
            entering.state = 'now';
          }
          sent.lit = want;
        }
      }
    }
  }

  function sceneIndexAt(t) {
    var idx = 0;
    for (var i = 0; i < data.scenes.length; i++) {
      if (t >= data.scenes[i].start) idx = i;
    }
    return idx;
  }

  function syncVoice() {
    if (!voiceOn) { try { voice.pause(); } catch (e) {} return; }
    var idx = sceneIndexAt(current);
    var src = voiceEls[idx];
    if (!src) { try { voice.pause(); } catch (e) {} voiceScene = -2; return; }
    if (voiceScene !== idx) {
      voiceScene = idx;
      try { voice.src = src; } catch (e) {}
    }
    if (playing) {
      var off = Math.max(0, current - data.scenes[idx].start);
      try {
        if (voice.duration && off < voice.duration && Math.abs((voice.currentTime || 0) - off) > 0.4) {
          voice.currentTime = off;
        }
      } catch (e) {}
      var played = voice.play();
      if (played && played.catch) played.catch(function () {});
    } else {
      try { voice.pause(); } catch (e) {}
    }
  }

  function fmt(value) {
    var s = Math.max(0, value || 0);
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    var tenths = Math.floor((s - Math.floor(s)) * 10);
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec + '.' + tenths;
  }

  function paint() {
    tl.pause();
    tl.time(current);
    range.value = String(current);
    clock.textContent = fmt(current) + ' / ' + fmt(total);
    var idx = sceneIndexAt(current);
    paintCaption(idx, Math.max(0, current - data.scenes[idx].start));
    if (playing && idx !== voiceScene) syncVoice();
  }

  function seek(value) {
    current = Math.max(0, Math.min(value, total));
    paint();
    syncVoice();
  }

  function stop() {
    playing = false;
    playBtn.textContent = 'Phat';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    try { voice.pause(); } catch (e) {}
  }

  function start() {
    if (current >= total - 0.05) current = 0;
    playing = true;
    playBtn.textContent = 'Dung';
    last = performance.now();
    raf = requestAnimationFrame(tick);
    syncVoice();
  }

  function tick(now) {
    if (!playing) return;
    var delta = Math.min((now - last) / 1000, 0.25);
    last = now;
    current += delta * rate;
    if (loopOn && loopB > loopA && current >= loopB) {
      current = loopA;
    }
    if (current >= total) { current = total; paint(); stop(); return; }
    paint();
    raf = requestAnimationFrame(tick);
  }

  // --- pictures: click to open, and a missing one takes its figure with it.
  //
  // A generated picture can fail to load on a machine with no network, and the
  // alternative was an empty bordered box the slide carried for the rest of the
  // lesson. Hiding the figure leaves the slide as it would have been without one.
  Array.prototype.forEach.call(stage.querySelectorAll('.fig img'), function (img) {
    img.addEventListener('error', function () {
      var fig = img.closest ? img.closest('.fig') : null;
      if (fig) fig.classList.add('gone');
    });
  });

  var zoom = document.createElement('div');
  zoom.className = 'zoom';
  zoom.setAttribute('role', 'dialog');
  zoom.setAttribute('aria-label', 'Phóng to ảnh');
  var zoomImg = document.createElement('img');
  zoomImg.alt = '';
  var zoomClose = document.createElement('button');
  zoomClose.type = 'button';
  zoomClose.className = 'zoom-x';
  zoomClose.setAttribute('aria-label', 'Đóng');
  zoomClose.textContent = '×';
  zoom.appendChild(zoomImg);
  zoom.appendChild(zoomClose);
  document.body.appendChild(zoom);

  function closeZoom() {
    zoom.classList.remove('on');
  }
  zoom.addEventListener('click', closeZoom);
  zoomClose.addEventListener('click', function (event) {
    event.stopPropagation();
    closeZoom();
  });
  stage.addEventListener('click', function (event) {
    var node = event.target;
    if (!node || node.tagName !== 'IMG' || !node.closest) return;
    var fig = node.closest('.fig');
    if (!fig || fig.classList.contains('gone')) return;
    zoomImg.src = node.src;
    zoom.classList.add('on');
  });

  document.getElementById('play').addEventListener('click', function () { playing ? stop() : start(); });
  document.getElementById('back').addEventListener('click', function () { seek(current - 5); });
  document.getElementById('fwd').addEventListener('click', function () { seek(current + 5); });
  document.getElementById('prevFrame').addEventListener('click', function () { stop(); seek(Math.round((current - 1 / fps) * fps) / fps); });
  document.getElementById('nextFrame').addEventListener('click', function () { stop(); seek(Math.round((current + 1 / fps) * fps) / fps); });
  document.getElementById('speed').addEventListener('change', function (event) {
    rate = parseFloat(event.target.value);
  });
  range.addEventListener('input', function () { seek(parseFloat(range.value)); });
  document.getElementById('voiceBtn').addEventListener('click', function () {
    voiceOn = !voiceOn;
    document.getElementById('voiceBtn').textContent = voiceOn ? 'Tiếng: bật' : 'Tiếng: tắt';
    syncVoice();
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-seek]'), function (button) {
    button.addEventListener('click', function () { seek(parseFloat(button.getAttribute('data-seek'))); });
  });

  function syncLoop() {
    var button = document.getElementById('loop');
    button.className = loopOn ? 'ab on' : 'ab';
    document.getElementById('setA').textContent = 'A ' + fmt(loopA);
    document.getElementById('setB').textContent = 'B ' + fmt(loopB);
  }
  document.getElementById('setA').addEventListener('click', function () {
    loopA = current;
    if (loopB <= loopA) loopB = Math.min(total, loopA + 5);
    syncLoop();
  });
  document.getElementById('setB').addEventListener('click', function () {
    loopB = current;
    if (loopA >= loopB) loopA = Math.max(0, loopB - 5);
    syncLoop();
  });
  document.getElementById('loop').addEventListener('click', function () {
    loopOn = !loopOn;
    syncLoop();
  });

  document.addEventListener('keydown', function (event) {
    var tag = event.target && event.target.tagName ? event.target.tagName : '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var key = event.key;
    if (key === 'Escape') closeZoom();
    else if (key === ' ') { event.preventDefault(); playing ? stop() : start(); }
    else if (key === 'ArrowLeft') { event.preventDefault(); seek(current - (event.shiftKey ? 1 : 5)); }
    else if (key === 'ArrowRight') { event.preventDefault(); seek(current + (event.shiftKey ? 1 : 5)); }
    else if (key === 'j' || key === 'J') seek(current - 10);
    else if (key === 'l' || key === 'L') seek(current + 10);
    else if (key === ',') { stop(); seek(Math.round((current - 1 / fps) * fps) / fps); }
    else if (key === '.') { stop(); seek(Math.round((current + 1 / fps) * fps) / fps); }
    else if (key === 'Home') seek(0);
    else if (key === 'End') seek(total);
  });

  syncLoop();
  paint();

})();
`;

export interface StandaloneHtmlOptions {
  lesson: Lesson;
  /**
   * One `data:audio/mpeg;base64` URI per scene, `null` where a scene has no
   * narration. The file stays server-free: every clip rides inside it.
   */
  audios: (string | null)[];
  /**
   * One aligned sentence list per scene, from the same `alignSentences` the
   * web caption uses. Scenes with no timings pass an empty list and render
   * their narration as plain text.
   */
  karaoke: AlignedSentence[][];
}

export function buildStandaloneHtml({ lesson, audios, karaoke }: StandaloneHtmlOptions): string {
  const preset = resolveSlideTheme(lesson.theme);
  const theme = themeCss(preset.palette, isDarkTheme(lesson.theme));
  // `<` is escaped so the JSON blob can never close its own <script> tag.
  const payload = JSON.stringify(lesson).replace(/</g, "\\u003c");
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]
    .map(
      (speed) =>
        `<option value="${speed}"${speed === 1 ? " selected" : ""}>${speed}&times;</option>`,
    )
    .join("");

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(lesson.title)} · EdusGPT</title>
<style>${CSS}${theme}${katexCss()}</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${escapeHtml(lesson.title)}</h1>
    <span class="tag">${escapeHtml(lesson.subject)}${lesson.grade ? ` &middot; ${escapeHtml(lesson.grade)}` : ""}</span>
    <span class="tag mono">${lesson.duration.toFixed(1)}s &middot; ${lesson.scenes.length} cảnh</span>
    <span class="tag">${escapeHtml(preset.label)}</span>
  </div>
  <div class="stage" id="stage">${sceneMarkup(lesson, audios, karaoke)}</div>
  <div class="controls">
    <audio id="voice" preload="auto" style="display:none"></audio>
    <div class="row">
      <button class="primary" id="play">Phát</button>
      <button id="back">&minus;5s</button>
      <button id="prevFrame">&minus;1 khung</button>
      <button id="nextFrame">+1 khung</button>
      <button id="fwd">+5s</button>
      <button id="voiceBtn">Tiếng: bật</button>
      <label class="mono" style="font-size:12px;color:#9fb9bd">tốc độ <select id="speed">${speeds}</select></label>
      <div class="ab" id="loop">A&rarr;B</div>
      <button id="setA">A 00:00.0</button>
      <button id="setB">B 00:00.0</button>
      <span class="mono" id="clock" style="margin-left:auto">00:00.0 / 00:00.0</span>
    </div>
    <input type="range" id="scrub" min="0" max="1" step="0.01" value="0" aria-label="Timeline bài giảng" />
    <div class="marks">${chapterMarkup(lesson)}</div>
    <p class="hint">Space phát/dừng · &larr;/&rarr; tua 5s · Shift+&larr;/&rarr; tua 1s · ,/. từng khung hình · J/L tua 10s · Home/End · A/B đặt vùng lặp · Esc đóng ảnh phóng to</p>
  </div>
</div>
<script id="lesson-data" type="application/json">${payload}</script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script>${PLAYER_JS}</script>
</body>
</html>
`;
}
