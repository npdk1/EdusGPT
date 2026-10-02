import { SCENE_KIND_LABEL, type Lesson } from "./types";

/**
 * Builds a standalone, self-contained HTML "player" for one lesson — one file,
 * timeline and all, with no server involved, and scrubbable in both directions
 * out of the box.
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
.stage{position:relative;aspect-ratio:16/9;background:var(--ink2);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.stage .grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(46,70,80,.35) 1px,transparent 1px),linear-gradient(to bottom,rgba(46,70,80,.35) 1px,transparent 1px);background-size:52px 52px}
.scene{position:absolute;inset:0;opacity:0;visibility:hidden}
.card{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;gap:14px;padding:40px 46px;overflow:hidden}
.glow{position:absolute;inset:0;pointer-events:none;background:linear-gradient(140deg,rgba(36,189,172,.22),transparent 62%)}
.glow.gold{background:linear-gradient(140deg,rgba(246,185,59,.22),transparent 62%)}
.glow.ember{background:linear-gradient(140deg,rgba(255,138,91,.2),transparent 62%)}
.idx{position:absolute;right:18px;top:6px;font-family:ui-monospace,monospace;font-size:96px;font-weight:700;line-height:1;color:rgba(34,53,62,.75)}
.kind{display:inline-block;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--mist3);background:rgba(4,9,11,.7)}
.title{margin:12px 0 0;font-size:clamp(22px,3.4vw,38px);line-height:1.15;letter-spacing:-.02em}
.sub{margin:8px 0 0;color:var(--mist3);font-size:15px}
ul.bullets{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;max-width:820px}
ul.bullets li{display:flex;gap:10px;font-size:15px;line-height:1.55;color:#cfe0e1}
ul.bullets li:before{content:"";width:6px;height:6px;margin-top:9px;border-radius:999px;background:var(--brand);flex:0 0 auto}
.formula{margin:0;width:fit-content;border:1px solid rgba(246,185,59,.4);background:rgba(246,185,59,.1);color:var(--gold3);border-radius:12px;padding:12px 16px;font-family:ui-monospace,monospace;font-size:clamp(16px,2.2vw,24px);font-weight:600}
.narration{margin:0;max-width:820px;border-left:2px solid rgba(15,161,146,.7);background:rgba(12,21,26,.75);border-radius:12px;padding:10px 14px;font-size:13px;font-style:italic;color:var(--mist3)}
.bar{position:absolute;left:0;bottom:0;height:3px;width:100%;transform:scaleX(0);transform-origin:left center;background:linear-gradient(90deg,var(--brand),var(--gold3))}
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
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sceneMarkup(lesson: Lesson): string {
  return lesson.scenes
    .map((scene, index) => {
      const glowClass = scene.accent === "brand" ? "glow" : `glow ${scene.accent}`;
      const bullets = scene.bullets
        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
        .join("");
      return [
        `<article class="scene" data-scene="${index}">`,
        `<div class="card">`,
        `<div class="${glowClass}"></div>`,
        `<div class="idx">${String(index + 1).padStart(2, "0")}</div>`,
        `<header><span class="kind">${SCENE_KIND_LABEL[scene.kind]}</span>`,
        `<h2 class="title">${escapeHtml(scene.title)}</h2>`,
        scene.subtitle ? `<p class="sub">${escapeHtml(scene.subtitle)}</p>` : "",
        `</header>`,
        `<ul class="bullets">${bullets}</ul>`,
        scene.formula ? `<p class="formula">${escapeHtml(scene.formula)}</p>` : "",
        scene.narration
          ? `<p class="narration">&ldquo;${escapeHtml(scene.narration)}&rdquo;</p>`
          : "",
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
    var bullets = el.querySelectorAll('ul.bullets li');
    var formula = el.querySelector('.formula');
    var narration = el.querySelector('.narration');
    var bar = el.querySelector('.bar');
    var at = scene.start;
    tl.set(el, { autoAlpha: 1, zIndex: 2 }, at)
      .set(el, { autoAlpha: 0, zIndex: 1 }, at + scene.duration - 0.001)
      .fromTo(card, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, at)
      .fromTo(title, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55 }, at + 0.08)
      .fromTo(sub, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, at + 0.18)
      .fromTo(bullets, { x: -18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.09 }, at + 0.3);
    if (formula) tl.fromTo(formula, { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }, at + 0.45);
    if (narration) tl.fromTo(narration, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, at + Math.min(scene.duration * 0.55, 1.6));
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
  }

  function seek(value) {
    current = Math.max(0, Math.min(value, total));
    paint();
  }

  function stop() {
    playing = false;
    playBtn.textContent = 'Phat';
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  function start() {
    if (current >= total - 0.05) current = 0;
    playing = true;
    playBtn.textContent = 'Dung';
    last = performance.now();
    raf = requestAnimationFrame(tick);
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

  document.getElementById('play').addEventListener('click', function () { playing ? stop() : start(); });
  document.getElementById('back').addEventListener('click', function () { seek(current - 5); });
  document.getElementById('fwd').addEventListener('click', function () { seek(current + 5); });
  document.getElementById('prevFrame').addEventListener('click', function () { stop(); seek(Math.round((current - 1 / fps) * fps) / fps); });
  document.getElementById('nextFrame').addEventListener('click', function () { stop(); seek(Math.round((current + 1 / fps) * fps) / fps); });
  document.getElementById('speed').addEventListener('change', function (event) {
    rate = parseFloat(event.target.value);
  });
  range.addEventListener('input', function () { seek(parseFloat(range.value)); });

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
    if (key === ' ') { event.preventDefault(); playing ? stop() : start(); }
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
}

export function buildStandaloneHtml({ lesson }: StandaloneHtmlOptions): string {
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
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${escapeHtml(lesson.title)}</h1>
    <span class="tag">${escapeHtml(lesson.subject)}${lesson.grade ? ` &middot; ${escapeHtml(lesson.grade)}` : ""}</span>
    <span class="tag mono">${lesson.duration.toFixed(1)}s &middot; ${lesson.scenes.length} cảnh</span>
  </div>
  <div class="stage" id="stage"><div class="grid"></div>${sceneMarkup(lesson)}</div>
  <div class="controls">
    <div class="row">
      <button class="primary" id="play">Phát</button>
      <button id="back">&minus;5s</button>
      <button id="prevFrame">&minus;1 khung</button>
      <button id="nextFrame">+1 khung</button>
      <button id="fwd">+5s</button>
      <label class="mono" style="font-size:12px;color:#9fb9bd">tốc độ <select id="speed">${speeds}</select></label>
      <div class="ab" id="loop">A&rarr;B</div>
      <button id="setA">A 00:00.0</button>
      <button id="setB">B 00:00.0</button>
      <span class="mono" id="clock" style="margin-left:auto">00:00.0 / 00:00.0</span>
    </div>
    <input type="range" id="scrub" min="0" max="1" step="0.01" value="0" aria-label="Timeline bài giảng" />
    <div class="marks">${chapterMarkup(lesson)}</div>
    <p class="hint">Space phát/dừng · &larr;/&rarr; tua 5s · Shift+&larr;/&rarr; tua 1s · ,/. từng khung hình · J/L tua 10s · Home/End · [ ] đặt A/B</p>
  </div>
</div>
<script id="lesson-data" type="application/json">${payload}</script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script>${PLAYER_JS}</script>
</body>
</html>
`;
}


