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
.card{--slide-fit:1;position:absolute;inset:0;display:flex;flex-direction:column;justify-content:safe center;padding:3.4cqw 5.5cqw 9cqw;overflow:hidden;background-image:linear-gradient(180deg,color-mix(in srgb,var(--ink) 88%,var(--mist5)) 0%,var(--ink) 38%,var(--ink3) 100%)}
.wash{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(120% 90% at 88% -10%,color-mix(in srgb,var(--brand3) 16%,transparent) 0%,transparent 62%),radial-gradient(90% 80% at 8% 108%,color-mix(in srgb,var(--brand) 10%,transparent) 0%,transparent 60%)}
.wm{position:absolute;right:6%;bottom:4%;z-index:3;font-family:ui-monospace,monospace;font-size:1.6cqw;font-weight:700;color:color-mix(in srgb,var(--mist5) 70%,transparent)}
/* The column the fit pass measures: capped at the paper, so nothing spills into
   the caption strip, with the picture as the one thing allowed to give way. */
.fit{position:relative;z-index:2;display:flex;flex-direction:column;gap:1.1cqw;flex-shrink:0;max-height:100%;min-height:0}
.head-in{width:100%;max-width:86%}
.kicker{display:inline-flex;align-items:center;gap:.6cqw;font-size:calc(1.05cqw * var(--slide-fit));font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--brand)}
.title{margin:2.5% 0 0;font-size:calc(5.2cqw * var(--slide-fit));line-height:1.04;letter-spacing:-.03em;font-weight:700;color:var(--mist);text-wrap:balance}
.sub{margin:2% 0 0;font-size:calc(1.7cqw * var(--slide-fit));color:var(--mist3)}
.rule{border:0;border-top:1px solid var(--line);width:22%;margin:3% 0 0}

/* Hairlines, not filled cards: one alignment for the eye and none of the visual
   weight, which is what keeps a long list looking designed. */
.body{display:grid;width:100%;max-width:86%;gap:0 6%;grid-template-columns:1fr;margin:0;padding:0;list-style:none}
@container (min-width:620px){.body{grid-template-columns:1fr 1fr}}
.body li{display:flex;align-items:baseline;gap:1.5cqw;font-size:calc(1.4cqw * var(--slide-fit));line-height:1.62;padding:.75cqw 0;border-top:1px solid var(--line);color:var(--mist3)}
.body .bi{font-family:ui-monospace,monospace;font-size:.8em;font-weight:600;color:var(--brand);flex:0 0 auto}
.body li>span:last-child{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.inline-code{font-family:ui-monospace,monospace;font-size:.92em;padding:0 .3em;border-radius:.3em;background:color-mix(in srgb,var(--mist) 8%,transparent)}
.formula{margin:0;width:fit-content;border:1px solid rgba(246,185,59,.4);background:rgba(246,185,59,.1);color:var(--gold3);border-radius:12px;padding:12px 16px;font-family:ui-monospace,monospace;font-size:calc(2cqw * var(--slide-fit));font-weight:600}
/* The picture, under the words and under the caption: a photograph that covered
   the line being read was worse than no photograph at all. */
.fig{position:relative;z-index:1;margin:0;display:flex;flex-direction:column;align-items:center;flex:0 1 auto;min-height:0}
.fig img{max-width:78%;max-height:calc(30cqw * var(--slide-fit));width:auto;height:auto;margin-inline:auto;border-radius:1.2cqw;border:1px solid var(--line);cursor:zoom-in;background:var(--ink3);object-fit:contain}
.fig figcaption{margin-top:.5cqw;font-size:calc(1cqw * var(--slide-fit));color:var(--mist5)}
.fig.gone{display:none}
/* A crowded slide keeps a small picture before it keeps none; a slide with no
   room at all keeps its words and loses the picture. Both set by the fit pass. */
.card[data-small-figure] .fig img{max-height:calc(14cqw * var(--slide-fit))}
.card[data-no-figure] .fig{display:none}

/* The caption: two rows held open at all times, the sentence being spoken over
   the one coming next. Reserving both rows is the point — a caption whose height
   changes when the hand-over happens moves every line on screen, and the reader
   feels it as a stutter at the exact moment they are following the voice. */
.cap{position:absolute;left:4%;right:4%;bottom:1.08cqw;z-index:3;height:5.22cqw;overflow:hidden;text-align:center;pointer-events:none}
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
.zoom-x{position:absolute;top:16px;right:16px;width:38px;height:38px;border-radius:999px;border:1px solid var(--line);background:var(--ink2);color:var(--mist);font:inherit;font-size:20px;line-height:1;cursor:pointer}
.zoom-x:hover{border-color:var(--brand);color:var(--brand3)}

/* The player bar, laid out the way a player lays one out: the timeline spans
   the full width directly above the buttons, the clock sits in the same row as
   the transport, and volume, speed and the shortcut list are on the right. A row
   of evenly spaced buttons in a black strip is a toolbar, and a toolbar spends
   the width that a player spends on the one control people reach for. */
.player{margin-top:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink3) 72%,transparent);border-radius:18px;padding:14px 16px 12px}
.scrubwrap{position:relative;padding-top:26px}
.hovertime{position:absolute;top:0;left:0;transform:translateX(-50%);border:1px solid var(--line);background:var(--ink2);border-radius:6px;padding:1px 6px;font-family:ui-monospace,monospace;font-size:11px;color:var(--mist);opacity:0;pointer-events:none;transition:opacity .1s}
.hovertime[data-visible="true"]{opacity:1}
.scrub{position:relative;height:44px;touch-action:none;user-select:none;cursor:pointer;outline:none}
.scrub[data-dragging="true"]{cursor:grabbing}
.scrub:focus-visible .rail{box-shadow:0 0 0 2px color-mix(in srgb,var(--brand3) 55%,transparent)}
.chapterband{position:absolute;left:0;right:0;top:0;height:16px}
.chapter{position:absolute;top:0;height:16px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-left:1px solid color-mix(in srgb,var(--brand) 70%,transparent);padding-left:6px;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mist5)}
.chapter[data-state="passed"]{color:var(--mist3)}
.chapter[data-state="current"]{color:var(--brand3)}
.rail{position:absolute;left:0;right:0;bottom:12px;height:10px;border-radius:999px;background:var(--ink3);border:1px solid var(--line);overflow:hidden}
.fill{position:absolute;top:0;bottom:0;left:0;width:0;background:linear-gradient(90deg,var(--brand),var(--brand3))}
.loopregion{position:absolute;bottom:10px;height:14px;border-radius:3px;border-left:2px solid;border-right:2px solid;pointer-events:none}
.loopregion[data-on="true"]{border-color:var(--gold3);background:color-mix(in srgb,var(--gold) 30%,transparent)}
.loopregion[data-on="false"]{border-color:var(--mist5);background:color-mix(in srgb,var(--mist5) 15%,transparent)}
.tick{position:absolute;bottom:12px;width:1px;height:10px;background:var(--ink2)}
.handle{position:absolute;bottom:6px;width:20px;height:20px;margin-left:-10px;border-radius:999px;background:var(--brand3);border:2px solid var(--ink);box-shadow:0 6px 14px rgba(0,0,0,.45);transition:transform .12s}
.scrub:hover .handle,.scrub[data-dragging="true"] .handle{transform:scale(1.12)}
.scrubfoot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-family:ui-monospace,monospace;font-size:11px;color:var(--mist5)}
.transport{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}
.tbtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:36px;height:36px;border-radius:10px;padding:0;font:inherit;color:var(--mist3);background:transparent;border:1px solid transparent;cursor:pointer}
.tbtn:hover{color:var(--mist);background:color-mix(in srgb,var(--ink3) 92%,transparent);border-color:var(--line)}
.tbtn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tbtn svg[data-fill="1"]{fill:currentColor;stroke:none}
.tplay{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;border:0;background:var(--brand);color:var(--ink);cursor:pointer}
.tplay:hover{background:var(--brand3)}
.tplay svg{width:21px;height:21px;fill:currentColor;stroke:none}
.tsep{width:1px;height:28px;background:var(--line)}
.clock{border:1px solid var(--line);background:var(--ink2);border-radius:8px;padding:6px 10px;font-family:ui-monospace,monospace;font-size:12px;color:var(--brand3);white-space:nowrap}
.loopbox{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink3) 70%,transparent);border-radius:12px;padding:4px}
.loopbox .tbtn{width:auto;height:28px;padding:0 8px;font-size:12px;font-weight:600}
.loopbox .tbtn[aria-pressed="true"]{background:var(--gold);color:var(--ink)}
.ab{height:28px;border:0;border-radius:8px;padding:0 8px;font-family:ui-monospace,monospace;font-size:12px;color:var(--mist3);background:transparent;cursor:pointer}
.ab:hover{color:var(--mist);background:color-mix(in srgb,var(--ink3) 92%,transparent)}
.clearbtn{height:28px;border:0;border-radius:8px;padding:0 8px;font:inherit;font-size:12px;color:var(--mist5);background:transparent;cursor:pointer}
.clearbtn:hover{color:var(--ember)}
.rate{border:1px solid var(--line);background:var(--ink2);border-radius:8px;padding:6px 8px;font-family:ui-monospace,monospace;font-size:12px;color:var(--mist);cursor:pointer}
.volrow{display:flex;align-items:center;gap:6px;margin-left:auto}
input[type=range]{-webkit-appearance:none;appearance:none;width:84px;height:22px;background:transparent;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:var(--ink3);border:1px solid var(--line)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:999px;background:var(--brand3);border:2px solid var(--ink)}
input[type=range]::-moz-range-track{height:6px;border-radius:999px;background:var(--ink3)}
input[type=range]::-moz-range-thumb{width:12px;height:12px;border-radius:999px;background:var(--brand3);border:2px solid var(--ink)}
.chapterlist{display:flex;flex-direction:column;gap:4px;margin-top:12px;max-height:170px;overflow-y:auto}
.mark{display:flex;align-items:baseline;justify-content:space-between;gap:10px;width:100%;text-align:left;font:inherit;font-size:12px;color:var(--mist3);background:transparent;border:0;border-left:2px solid var(--line);border-radius:0;padding:5px 10px;cursor:pointer}
.mark:hover{color:var(--brand3);border-left-color:var(--brand3);background:transparent}
.mark[data-current="true"]{color:var(--mist);border-left-color:var(--brand)}
.mark .at{font-family:ui-monospace,monospace;font-size:11px;color:var(--mist5)}
.hint{color:var(--mist5);font-size:11px;margin-top:10px;font-family:ui-monospace,monospace}
/* Fullscreen takes the whole page, slide and transport together: the browser
   owns the screen, and a presenter who cannot reach the play button has no
   controls at all. */
.wrap:fullscreen{background:var(--ink);padding:16px;overflow:auto}
/* The exit has to stay reachable: in fullscreen the slide is tall enough to
   push the transport below the fold, and a presenter scrolling for the shrink
   button has no controls at all. Pinned to the bottom instead. */
.wrap:fullscreen .player{position:sticky;bottom:0;z-index:5}

/* The shortcut sheet, opened with \`?\`. Every key here is bound below, so the
   list cannot drift away from what the file actually does. */
.dlg{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;padding:16px;background:color-mix(in srgb,var(--ink) 82%,transparent);backdrop-filter:blur(4px)}
.dlg.on{display:flex}
.dlg-panel{width:100%;max-width:780px;max-height:85vh;overflow-y:auto;border:1px solid var(--line);background:var(--ink2);border-radius:16px;padding:20px}
.dlg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dlg-head h2{margin:0;font-size:17px}
.dlg-head p{margin:4px 0 0;font-size:13px;color:var(--mist5)}
.dlg-grid{display:grid;gap:20px;margin-top:18px}
@media (min-width:640px){.dlg-grid{grid-template-columns:1fr 1fr}}
.dlg-grid h3{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--brand3)}
.dlg-grid ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.dlg-grid li{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);background:color-mix(in srgb,var(--ink3) 60%,transparent);border-radius:9px;padding:7px 10px}
.kbd{font-family:ui-monospace,monospace;font-size:11px;white-space:nowrap}
.dlg-grid li .what{font-size:12px;color:var(--mist3);text-align:right}
@media (prefers-reduced-motion:reduce){.sent,.sent .w,.handle{transition:none}}
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
    `.player{background:color-mix(in srgb, ${p.bgSunk} 72%, transparent)}` +
    // The play button sits on the accent, so its ink has to come from the paper
    // rather than from the accent's own theme: a light deck would otherwise put
    // near-white text on a mid-tone accent.
    `.tplay{color:${dark ? p.bg : "#ffffff"}}` +
    `.wash{background:radial-gradient(120% 90% at 88% -10%,` +
    `color-mix(in srgb, ${p.accentSoft} 16%, transparent) 0%,transparent 62%)}` +
    `.fig img{background:${p.bgSunk}}` +
    `.zoom{background:color-mix(in srgb, ${p.ink} 82%, transparent)}` +
    `.formula{border-color:color-mix(in srgb, #f6b93b 40%, transparent);` +
    `background:color-mix(in srgb, #f6b93b 10%, transparent)}`
  );
}

/**
 * The transport icons, drawn inline.
 *
 * A downloaded file has no bundler and no icon package, and the alternative —
 * text buttons — is the toolbar this bar exists to stop being. These are the
 * same shapes the web player's bar uses, so a teacher moves between the two
 * without re-learning the row.
 */
const ICON = {
  toStart: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>',
  back10:
    '<polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/>',
  stepBack: '<path d="m15 18-6-6 6-6"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  stepForward: '<path d="m9 18 6-6-6-6"/>',
  forward10:
    '<polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/>',
  toEnd: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>',
  repeat:
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  volumeHigh:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  volumeLow:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  volumeMute:
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
  keyboard:
    '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01"/><path d="M8 12h.01"/><path d="M10 8h.01"/><path d="M12 12h.01"/><path d="M14 8h.01"/><path d="M16 12h.01"/><path d="M18 8h.01"/><path d="M7 16h10"/>',
  fullscreen:
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  shrink:
    '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
} as const;

type IconName = keyof typeof ICON;

function icon(name: IconName, filled = false): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"${filled ? ' data-fill="1"' : ""}>${ICON[name]}</svg>`;
}

/** A labelled icon button, the way the transport bar is built. */
function toolButton(
  id: string,
  label: string,
  title: string,
  name: IconName,
  extra = "",
): string {
  return (
    `<button type="button" class="tbtn" id="${id}" title="${escapeHtml(title)}"` +
    ` aria-label="${escapeHtml(label)}"${extra}>${icon(name)}</button>`
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
        `<div class="fit">`,
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
        `</div>`,
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

/** The rates the speed control steps through, in the web player's order. */
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function percent(value: number, total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (value / total) * 100))}%`;
}

/**
 * The player: a timeline with the deck's structure drawn on it, and the transport
 * row under it.
 *
 * The chapter bands and the scene ticks are written into the file rather than
 * placed by script, because the deck's own timings are known here — the same
 * reason the caption's sentences are. Everything that moves with the playhead
 * (the fill, the handle, the chapter states, the loop region) is set by the
 * script, so scrubbing never has to rebuild this markup.
 */
function playerMarkup(lesson: Lesson): string {
  const total = lesson.duration || 1;
  const bands = lesson.chapters
    .map((chapter, index) => {
      const left = percent(chapter.start, total);
      const width = Math.min(
        100 - parseFloat(left),
        Math.max(0.8, ((chapter.end - chapter.start) / total) * 100),
      );
      return (
        `<span class="chapter" data-chapter="${index}" data-state="todo"` +
        ` style="left:${left};width:${width}%" title="${escapeHtml(chapter.title)}">` +
        `${escapeHtml(chapter.title)}</span>`
      );
    })
    .join("");
  const ticks = lesson.scenes
    .slice(1)
    .map(
      (scene) => `<span class="tick" style="left:${percent(scene.start, total)}"></span>`,
    )
    .join("");
  const speeds = RATES.map(
    (rate) =>
      `<option value="${rate}"${rate === 1 ? " selected" : ""}>${rate}&times;</option>`,
  ).join("");
  const chapters = lesson.chapters
    .map(
      (chapter, index) =>
        `<button type="button" class="mark" data-chapter="${index}" data-seek="${chapter.start}">` +
        `<span class="nm">${escapeHtml(chapter.title)}</span>` +
        `<span class="at">${chapter.start.toFixed(1)}s</span></button>`,
    )
    .join("");

  return (
    `<div class="player" id="player">` +
    `<div class="scrubwrap">` +
    `<div class="hovertime" id="hovertime" data-visible="false">00:00.0</div>` +
    `<div class="scrub" id="scrub" role="slider" tabindex="0"` +
    ` aria-label="Timeline bài giảng. Kéo để tua, phím mũi tên để tua từng bước"` +
    ` aria-valuemin="0" aria-valuemax="${Math.round(total)}" aria-valuenow="0"` +
    ` aria-valuetext="0 giây" data-dragging="false">` +
    `<div class="chapterband">${bands}</div>` +
    `<div class="rail"><div class="fill" id="fill"></div></div>` +
    `<div class="loopregion" id="loopregion" data-on="false" hidden></div>` +
    ticks +
    `<div class="handle" id="handle" style="left:0%"></div>` +
    `</div></div>` +
    `<div class="scrubfoot">` +
    `<span>${lesson.scenes.length} cảnh &middot; ${lesson.chapters.length} chương</span>` +
    `<span>&larr; / &rarr; tua 5s &middot; Shift + &larr;/&rarr; tua 1s &middot; , / . từng khung hình</span>` +
    `</div>` +
    `<div class="transport">` +
    toolButton("toStart", "Về đầu", "Về đầu (Home)", "toStart") +
    toolButton("back10", "Tua lui 10 giây", "Tua lui 10 giây (J)", "back10") +
    toolButton("stepBack", "Lùi một khung hình", "Lùi 1 khung hình (,)", "stepBack") +
    `<button type="button" class="tplay" id="play" title="Phát (Space)" aria-label="Phát">` +
    icon("play", true) +
    `</button>` +
    toolButton("stepForward", "Tiến một khung hình", "Tiến 1 khung hình (.)", "stepForward") +
    toolButton("forward10", "Tua tới 10 giây", "Tua tới 10 giây (L)", "forward10") +
    toolButton("toEnd", "Tới cuối", "Tới cuối (End)", "toEnd") +
    `<span class="clock" id="clock">00:00.0 / 00:00.0</span>` +
    `<span class="tsep" aria-hidden="true"></span>` +
    `<div class="loopbox">` +
    // The loop toggle carries its label next to the icon, so it is written out
    // rather than going through `toolButton`: it is a switch with a name, not
    // one more icon in a row.
    `<button type="button" class="tbtn" id="loop" aria-pressed="false"` +
    ` title="Bật/tắt lặp trong khoảng A→B (\\)" aria-label="Bật/tắt lặp A→B">` +
    `${icon("repeat")}<span>A&rarr;B</span></button>` +
    `<button type="button" class="ab" id="setA" title="Đặt mốc A tại vị trí hiện tại ([)">A 00:00.0</button>` +
    `<button type="button" class="ab" id="setB" title="Đặt mốc B tại vị trí hiện tại (])">B 00:00.0</button>` +
    `<button type="button" class="clearbtn" id="clearLoop" title="Xoá khoảng lặp">xoá</button>` +
    `</div>` +
    `<select class="rate" id="speed" title="Tốc độ phát (− / + để đổi nhanh)"` +
    ` aria-label="Tốc độ phát">${speeds}</select>` +
    `<div class="volrow">` +
    toolButton("mute", "Tắt hoặc bật tiếng", "Tắt/bật tiếng (M)", "volumeHigh") +
    `<input type="range" id="vol" min="0" max="1" step="0.05" value="1"` +
    ` aria-label="Âm lượng" title="Âm lượng 100%" />` +
    toolButton("help", "Danh sách phím tắt", "Danh sách phím tắt (?)", "keyboard") +
    toolButton("fullscreen", "Toàn màn hình", "Toàn màn hình (F)", "fullscreen") +
    `</div>` +
    `</div>` +
    (chapters ? `<div class="chapterlist" id="chapterlist">${chapters}</div>` : "") +
    `</div>`
  );
}

/**
 * The shortcut sheet.
 *
 * Written out rather than generated from the key handler, because a list of keys
 * that is itself generated is a list that can quietly stop being true. Every row
 * here is bound in the script below.
 */
function shortcutsMarkup(): string {
  const groups: Array<[string, Array<[string, string]>]> = [
    [
      "Tua & phát",
      [
        ["Space / K", "Phát hoặc tạm dừng"],
        ["← / →", "Tua lui / tua tới 5 giây"],
        ["J / L", "Tua lui / tua tới 10 giây"],
        ["Shift + ← / →", "Tua chậm 1 giây"],
        [", / .", "Lùi / tiến đúng 1 khung hình"],
        ["0 – 9", "Nhảy tới 0% – 90% thời lượng"],
        ["Home / End", "Về đầu / tới cuối"],
      ],
    ],
    [
      "Lặp một đoạn để học kỹ",
      [
        ["[", "Đặt mốc A tại vị trí hiện tại"],
        ["]", "Đặt mốc B tại vị trí hiện tại"],
        ["\\", "Bật/tắt lặp A→B"],
        ["1 lần nhấn", "Chuột kéo trên timeline để tua tự do"],
      ],
    ],
    [
      "Khác",
      [
        ["− / +", "Giảm / tăng tốc độ phát"],
        ["M", "Tắt hoặc bật tiếng"],
        ["F", "Toàn màn hình vùng trình chiếu"],
        ["?", "Mở bảng phím tắt này"],
        ["Esc", "Đóng bảng / thoát toàn màn hình / đóng ảnh phóng to"],
      ],
    ],
  ];
  return (
    `<div class="dlg" id="dlg" role="dialog" aria-modal="true" aria-label="Phím tắt trình phát">` +
    `<div class="dlg-panel">` +
    `<div class="dlg-head"><div>` +
    `<h2>Phím tắt trình phát</h2>` +
    `<p>Mọi thao tác tua đều hoạt động trên timeline của bài giảng.</p>` +
    `</div>` +
    toolButton("dlgClose", "Đóng bảng phím tắt", "Đóng (Esc)", "close") +
    `</div>` +
    `<div class="dlg-grid">` +
    groups
      .map(
        ([title, rows]) =>
          `<section><h3>${title}</h3><ul>` +
          rows
            .map(
              ([keys, what]) =>
                `<li><span class="kbd">${escapeHtml(keys)}</span>` +
                `<span class="what">${escapeHtml(what)}</span></li>`,
            )
            .join("") +
          `</ul></section>`,
      )
      .join("") +
    `</div></div></div>`
  );
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
  var muted = false, volume = 1, dragging = false, seekPending = null, seekRaf = null;
  var clock = document.getElementById('clock');
  var playBtn = document.getElementById('play');
  var fps = data.fps || 30;

  // --- the timeline and the transport row.
  var scrub = document.getElementById('scrub');
  var fill = document.getElementById('fill');
  var handle = document.getElementById('handle');
  var hovertime = document.getElementById('hovertime');
  var loopRegion = document.getElementById('loopregion');
  var muteBtn = document.getElementById('mute');
  var rateSelect = document.getElementById('speed');
  var volInput = document.getElementById('vol');
  var chapterEls = scrub.querySelectorAll('.chapter');
  var chapterRows = document.querySelectorAll('.chapterlist .mark');
  var chapters = data.chapters || [];
  var dlg = document.getElementById('dlg');
  // The icons that change with state are written here rather than kept as extra
  // hidden nodes in the markup: the play button and the volume button swap theirs
  // constantly, and a hidden node per state is a node the file never reads.
  var RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" data-fill="1"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" data-fill="1"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>';
  var FULLSCREEN_ICON = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
  var SHRINK_ICON = '<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>';
  var VOLUME_ICONS = {
    high: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    low: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
    mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>'
  };
  scrub.setAttribute('aria-valuemax', String(Math.round(total)));

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

  // --- dead air: a clip shorter than its scene used to leave the deck sitting
  // in silence until the scene's fixed duration ran out. When the clip ends
  // early, jump to the next scene instead — the timeline, not the recording,
  // decides how long a slide stays up. Skipped while looping (the loop owns
  // the playhead there), and tiny remainders are left alone so the boundary
  // never visibly jumps.
  voice.addEventListener('ended', function () {
    if (!playing) return;
    if (loopOn && loopB > loopA) return;
    try { voice.pause(); } catch (e) {}
    var idx = sceneIndexAt(current);
    var scene = data.scenes[idx];
    if (!scene || voiceScene !== idx) return;
    var end = scene.start + scene.duration;
    if (end - current < 0.6) return;
    if (idx >= data.scenes.length - 1) { seek(total); stop(); return; }
    seek(end);
  });

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
    // The timeline runs at rate and the caption follows it, so the clip has
    // to as well — without this the words light up at 2x while the voice reads
    // at 1x and the two part ways within a sentence. Re-applied on every swap:
    // some browsers drop a custom rate when the source changes.
    try {
      voice.playbackRate = rate;
      if ('preservesPitch' in voice) voice.preservesPitch = true;
    } catch (e) {}
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
    var share = total > 0 ? (current / total) * 100 : 0;
    fill.style.width = share.toFixed(3) + '%';
    handle.style.left = share.toFixed(3) + '%';
    clock.textContent = fmt(current) + ' / ' + fmt(total);
    scrub.setAttribute('aria-valuenow', current.toFixed(2));
    scrub.setAttribute('aria-valuetext', fmt(current) + ' trên ' + fmt(total));
    // Which chapters are behind the playhead. The rail alone answers "how far",
    // but a deck read at 2x leaves the reader with no way to tell that whole
    // sections are done — and the bands are the only place the deck's structure
    // is drawn, so it is the only place it can be marked.
    for (var ci = 0; ci < chapters.length; ci++) {
      var chapter = chapters[ci];
      var passed = current >= chapter.end;
      var inside = current >= chapter.start && current < chapter.end;
      var state = passed ? 'passed' : (inside ? 'current' : 'todo');
      var band = chapterEls[ci];
      if (band && band.getAttribute('data-state') !== state) band.setAttribute('data-state', state);
      var row = chapterRows[ci];
      if (row) row.setAttribute('data-current', inside ? 'true' : 'false');
    }
    var idx = sceneIndexAt(current);
    paintCaption(idx, Math.max(0, current - data.scenes[idx].start));
    if (playing && idx !== voiceScene) syncVoice();
  }

  function seek(value) {
    current = Math.max(0, Math.min(value, total));
    paint();
    syncVoice();
  }

  function setPlayIcon(name) {
    playBtn.innerHTML = name;
    playBtn.setAttribute('aria-label', name === PAUSE_ICON ? 'Tạm dừng' : 'Phát');
    playBtn.setAttribute('title', name === PAUSE_ICON ? 'Tạm dừng (Space)' : 'Phát (Space)');
  }

  function stop() {
    playing = false;
    setPlayIcon(PLAY_ICON);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    try { voice.pause(); } catch (e) {}
  }

  function start() {
    if (current >= total - 0.05) current = 0;
    playing = true;
    setPlayIcon(PAUSE_ICON);
    last = performance.now();
    raf = requestAnimationFrame(tick);
    syncVoice();
  }

  function toggle() {
    playing ? stop() : start();
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

  // --- the timeline: click to seek, drag to scrub, hover for the timecode.
  //
  // Drag seeks are coalesced to one per frame. A pointermove can fire faster
  // than the deck can be told about, and every one of those seeks repaints the
  // slide, the caption and the voice — so the drag reads the position and hands
  // over at most one seek per frame.
  function ratioFrom(clientX) {
    var rect = scrub.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
  }

  function queueSeek(time) {
    seekPending = time;
    if (seekRaf !== null) return;
    seekRaf = requestAnimationFrame(function () {
      seekRaf = null;
      if (seekPending !== null) seek(seekPending);
    });
  }

  scrub.addEventListener('pointerdown', function (event) {
    dragging = true;
    scrub.setAttribute('data-dragging', 'true');
    if (scrub.setPointerCapture) {
      try { scrub.setPointerCapture(event.pointerId); } catch (e) {}
    }
    try { scrub.focus({ preventScroll: true }); } catch (e) {}
    seek(ratioFrom(event.clientX) * total);
  });

  scrub.addEventListener('pointermove', function (event) {
    var time = ratioFrom(event.clientX) * total;
    var rect = scrub.getBoundingClientRect();
    var offset = Math.min(
      Math.max(event.clientX - rect.left, 52),
      Math.max(rect.width - 52, 52),
    );
    hovertime.style.transform = 'translateX(' + offset.toFixed(0) + 'px)';
    hovertime.textContent = fmt(time);
    hovertime.setAttribute('data-visible', 'true');
    if (dragging) queueSeek(time);
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    scrub.setAttribute('data-dragging', 'false');
    if (scrub.releasePointerCapture && event.pointerId !== undefined) {
      try { scrub.releasePointerCapture(event.pointerId); } catch (e) {}
    }
  }

  scrub.addEventListener('pointerup', endDrag);
  scrub.addEventListener('pointercancel', endDrag);
  scrub.addEventListener('pointerleave', function () {
    hovertime.setAttribute('data-visible', 'false');
  });

  // --- the A→B loop, drawn on the timeline as well as set from the bar.
  function syncLoop() {
    var loopBtn = document.getElementById('loop');
    loopBtn.setAttribute('aria-pressed', loopOn ? 'true' : 'false');
    document.getElementById('setA').textContent = 'A ' + fmt(loopA);
    document.getElementById('setB').textContent = 'B ' + fmt(loopB);
    if (loopB > loopA) {
      loopRegion.hidden = false;
      loopRegion.setAttribute('data-on', loopOn ? 'true' : 'false');
      loopRegion.style.left = ((loopA / total) * 100).toFixed(3) + '%';
      loopRegion.style.width = (((loopB - loopA) / total) * 100).toFixed(3) + '%';
    } else {
      loopRegion.hidden = true;
    }
  }

  function setPoint(which) {
    if (which === 'a') {
      loopA = current;
      if (loopB <= loopA) loopB = Math.min(total, loopA + 5);
    } else {
      loopB = current;
      if (loopA >= loopB) loopA = Math.max(0, loopB - 5);
    }
    syncLoop();
  }

  // --- loudness: the slider and the mute button write the same value, so the
  // deck and the synthesised voice follow each other.
  function applyVolume() {
    voiceOn = !muted;
    try {
      voice.volume = volume;
      voice.muted = muted;
    } catch (e) {}
    var shape = muted ? 'mute' : (volume < 0.5 ? 'low' : 'high');
    muteBtn.querySelector('svg').innerHTML = VOLUME_ICONS[shape];
    muteBtn.setAttribute('aria-label', muted ? 'Bật tiếng' : 'Tắt hoặc bật tiếng');
    volInput.title = 'Âm lượng ' + Math.round(volume * 100) + '%';
    if (muted) { try { voice.pause(); } catch (e) {} }
  }

  function stepRate(direction) {
    var at = RATES.indexOf(rate);
    if (at < 0) at = 2;
    rate = RATES[Math.min(RATES.length - 1, Math.max(0, at + direction))];
    rateSelect.value = String(rate);
    try {
      voice.playbackRate = rate;
      if ('preservesPitch' in voice) voice.preservesPitch = true;
    } catch (e) {}
  }

  function stepFrames(count) {
    seek(Math.round((current + count / fps) * fps) / fps);
  }

  function toggleFullscreen() {
    var target = document.getElementById('wrap');
    if (document.fullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else if (target && target.requestFullscreen) {
      target.requestFullscreen();
    }
  }

  function syncFullscreen() {
    var on = Boolean(document.fullscreenElement);
    var btn = document.getElementById('fullscreen');
    if (!btn) return;
    // Guarded: if this ever runs before the transport renders, a throw here
    // would leave the expand icon on screen while already fullscreen — a
    // player that zooms in with no visible way back.
    var svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = on ? SHRINK_ICON : FULLSCREEN_ICON;
    btn.setAttribute('aria-label', on ? 'Thoát toàn màn hình' : 'Toàn màn hình');
    btn.setAttribute('title', on ? 'Thoát toàn màn hình (F hoặc Esc)' : 'Toàn màn hình (F)');
  }

  function setHelp(open) {
    dlg.classList[open ? 'add' : 'remove']('on');
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

  // --- the fit pass, the same one the web player runs.
  //
  // A slide with more on it than the paper holds steps the type ladder down
  // rather than letting the last line run into the caption. The picture is part
  // of that column and steps with it: it is sized in cqw times the fit step, so
  // shrinking the words shrinks the photograph too. A slide still too tall at the
  // floor gets a small picture, and only a slide with no room at all loses it —
  // a caption nobody can read is the worse outcome either way.
  //
  // It measures the column uncapped, because the fit column is capped at the
  // paper to keep anything from spilling into the caption strip, and it runs
  // again when a
  // picture arrives: a remote image is nothing at first paint and its real size a
  // second later, which is exactly when a mount-time measurement went wrong.
  var FIT_STEPS = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52];
  function fitSlides() {
    var cards = stage.querySelectorAll('.card');
    for (var ci = 0; ci < cards.length; ci++) {
      var card = cards[ci];
      var fit = card.querySelector('.fit');
      if (!fit) continue;
      card.style.setProperty('--slide-fit', '1');
      card.removeAttribute('data-no-figure');
      card.removeAttribute('data-small-figure');
      var style = window.getComputedStyle(card);
      var available =
        card.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      fit.style.maxHeight = 'none';
      if (available <= 0) { fit.style.maxHeight = ''; continue; }
      for (var si = 0; si < FIT_STEPS.length; si++) {
        card.style.setProperty('--slide-fit', String(FIT_STEPS[si]));
        if (fit.getBoundingClientRect().height <= available) break;
      }
      if (card.querySelector('.fig') && fit.getBoundingClientRect().height > available) {
        card.setAttribute('data-small-figure', 'true');
        if (fit.getBoundingClientRect().height > available) {
          card.removeAttribute('data-small-figure');
          card.setAttribute('data-no-figure', 'true');
        }
      }
      fit.style.maxHeight = '';
    }
  }
  fitSlides();
  window.addEventListener('resize', fitSlides);
  // A load event does not bubble, so this is captured: one listener for every
  // picture in the deck, including the ones that arrive long after the file
  // opened.
  stage.addEventListener('load', fitSlides, true);

  document.getElementById('play').addEventListener('click', toggle);
  document.getElementById('toStart').addEventListener('click', function () { seek(0); });
  document.getElementById('toEnd').addEventListener('click', function () { seek(total); });
  document.getElementById('back10').addEventListener('click', function () { seek(current - 10); });
  document.getElementById('forward10').addEventListener('click', function () { seek(current + 10); });
  document.getElementById('stepBack').addEventListener('click', function () { stop(); stepFrames(-1); });
  document.getElementById('stepForward').addEventListener('click', function () { stop(); stepFrames(1); });
  rateSelect.addEventListener('change', function (event) {
    rate = parseFloat(event.target.value);
    try {
      voice.playbackRate = rate;
      if ('preservesPitch' in voice) voice.preservesPitch = true;
    } catch (e) {}
  });
  volInput.addEventListener('input', function (event) {
    volume = parseFloat(event.target.value);
    applyVolume();
  });
  muteBtn.addEventListener('click', function () { muted = !muted; applyVolume(); });
  document.getElementById('loop').addEventListener('click', function () { loopOn = !loopOn; syncLoop(); });
  document.getElementById('setA').addEventListener('click', function () { setPoint('a'); });
  document.getElementById('setB').addEventListener('click', function () { setPoint('b'); });
  document.getElementById('clearLoop').addEventListener('click', function () {
    loopOn = false;
    loopA = 0;
    loopB = 0;
    syncLoop();
  });
  document.getElementById('help').addEventListener('click', function () { setHelp(true); });
  document.getElementById('dlgClose').addEventListener('click', function () { setHelp(false); });
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  dlg.addEventListener('click', function (event) {
    if (event.target === dlg) setHelp(false);
  });
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();

  Array.prototype.forEach.call(document.querySelectorAll('[data-seek]'), function (button) {
    button.addEventListener('click', function () { seek(parseFloat(button.getAttribute('data-seek'))); });
  });

  document.addEventListener('keydown', function (event) {
    var tag = event.target && event.target.tagName ? event.target.tagName : '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    var key = event.key;
    // Escape only ever closes what is open, in the reverse order the reader put
    // it: the zoomed picture, then the shortcut sheet, then fullscreen. The
    // browser also leaves fullscreen on Escape, but only from its own gesture —
    // the button promises it, so the file honours it too.
    if (key === 'Escape') {
      closeZoom();
      setHelp(false);
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      return;
    }
    if (key === '?' || (key === '/' && event.shiftKey)) {
      event.preventDefault();
      setHelp(!dlg.classList.contains('on'));
      return;
    }
    if (key === ' ' || key === 'k' || key === 'K') { event.preventDefault(); toggle(); }
    else if (key === 'ArrowLeft') { event.preventDefault(); seek(current - (event.shiftKey ? 1 : 5)); }
    else if (key === 'ArrowRight') { event.preventDefault(); seek(current + (event.shiftKey ? 1 : 5)); }
    else if (key === 'j' || key === 'J') seek(current - 10);
    else if (key === 'l' || key === 'L') seek(current + 10);
    else if (key === ',') { stop(); stepFrames(-1); }
    else if (key === '.') { stop(); stepFrames(1); }
    else if (key >= '0' && key <= '9') seek((Number(key) / 10) * total);
    else if (key === 'Home') seek(0);
    else if (key === 'End') seek(total);
    else if (key === '[') setPoint('a');
    else if (key === ']') setPoint('b');
    // Four backslashes: this lives in a template literal, so the file has to be
    // handed the two characters that spell a backslash inside a JS string.
    else if (key === '\\\\') { loopOn = !loopOn; syncLoop(); }
    else if (key === '-' || key === '_') stepRate(-1);
    else if (key === '+' || key === '=') stepRate(1);
    else if (key === 'm' || key === 'M') { muted = !muted; applyVolume(); }
    else if (key === 'f' || key === 'F') toggleFullscreen();
  });

  applyVolume();
  syncLoop();
  syncFullscreen();
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

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(lesson.title)} · EdusGPT</title>
<style>${CSS}${theme}${katexCss()}</style>
</head>
<body>
<div class="wrap" id="wrap">
  <div class="head">
    <h1>${escapeHtml(lesson.title)}</h1>
    <span class="tag">${escapeHtml(lesson.subject)}${lesson.grade ? ` &middot; ${escapeHtml(lesson.grade)}` : ""}</span>
    <span class="tag mono">${lesson.duration.toFixed(1)}s &middot; ${lesson.scenes.length} cảnh</span>
    <span class="tag">${escapeHtml(preset.label)}</span>
  </div>
  <div class="stage" id="stage">${sceneMarkup(lesson, audios, karaoke)}</div>
  <audio id="voice" preload="auto" style="display:none"></audio>
  ${playerMarkup(lesson)}
  <p class="hint">Toàn bộ bài nằm trong file này. GSAP tải từ CDN nên cần mạng ở lần mở đầu; bài học và giọng đọc thì không.</p>
</div>
${shortcutsMarkup()}
<script id="lesson-data" type="application/json">${payload}</script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script>${PLAYER_JS}</script>
</body>
</html>
`;
}
