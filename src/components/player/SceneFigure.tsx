"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
// `Image` is aliased on import because this file also uses the DOM's `Image`
// constructor to warm a cached picture. Importing the icon under its own name
// shadows that constructor, and `new Image()` then fails to type-check.
import { Image as ImageIcon, ImageOff, EyeOff, Maximize2, X } from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { DataPoint, SlideGraph, SlideImage as SlideImageType, SlideTable, Lesson } from "@/lib/lesson/types";
import { pollinationsImageUrl } from "@/lib/lesson/pollinations";

/**
 * Pictures a teacher has rejected, keyed by `lessonId::sceneId::query`.
 *
 * Kept out of the lesson file on purpose: a picture the search happened to get
 * wrong is not part of the teaching material, and rewriting the saved lesson
 * would fight the "I already stored this course" promise. localStorage means the
 * decision survives a reload without touching the course.
 */
const HIDDEN_KEY = "eduai.hidden-images.v1";

function hiddenKey(lessonId: string, sceneId: string, query: string): string {
  return `${lessonId}::${sceneId}::${query}`;
}

function readHidden(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeHidden(keys: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...keys]));
  } catch {
    // A full or blocked storage must not break the slide.
  }
}

/**
 * A slide's picture, generated or searched.
 *
 * A scene with `imagePrompt` renders the AI picture for that prompt directly
 * (pollinations.ai, deterministic per lesson + scene, so scrubbing never
 * re-rolls it). Only when the scene has no prompt does the view fall back to
 * searching the open archive with `imageQuery` — which is how every lesson
 * saved before prompts existed keeps its pictures.
 *
 * Fetches on demand for whichever slide is mounted. The stage only mounts the
 * scenes it renders, so this stays to one lookup per slide rather than a dozen
 * searches the moment a lesson opens.
 */
export function SlideImageView({
  lessonId,
  scene,
}: {
  lessonId: string;
  scene: Lesson["scenes"][number];
}) {
  const [image, setImage] = useState<SlideImageType | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Anonymous pollinations.ai throttles parallel renders with 402, so a
  // generated picture gets exactly one delayed retry before giving up. The
  // `r` parameter only busts the failed response out of the browser cache;
  // the seed stays untouched, so a retry never re-rolls the picture.
  const [retry, setRetry] = useState(0);

  const query = scene.imageQuery?.trim() ?? "";
  const prompt = scene.imagePrompt?.trim() ?? "";
  // A generated picture needs no search: its URL is pure arithmetic on the
  // lesson, the scene and the prompt. It still goes through the same
  // hide/show state as an archive picture, so a dismissed slide stays
  // dismissed whichever source drew it.
  const generatedUrl =
    prompt.length >= 3
      ? pollinationsImageUrl(lessonId, scene.id, prompt)
      : null;
  const key = hiddenKey(lessonId, scene.id, generatedUrl ? `ai:${prompt}` : query);

  const dismiss = useCallback(() => {
    const next = readHidden();
    next.add(key);
    writeHidden(next);
    setHidden(true);
  }, [key]);

  // A new slide (or a newly un-hidden one) gets a fresh retry budget. Kept
  // apart from the loader effect on purpose: resetting the counter inside it
  // would ping-pong with the retry itself, because the counter is what tells
  // the image element below to reload.
  useEffect(() => {
    setRetry(0);
  }, [key]);

  useEffect(() => {
    setImage(null);
    setFailed(false);
    setHidden(false);
    if (typeof window === "undefined") return;

    if (readHidden().has(key)) {
      setHidden(true);
      return;
    }

    // Generated pictures skip the archive entirely: no search request, no
    // "Đang tìm ảnh…" wait, just the render URL.
    if (generatedUrl) {
      setImage({
        url: generatedUrl,
        title: scene.title,
        credit: "Ảnh AI · pollinations.ai",
        sourcePage: "https://pollinations.ai/",
      });
      return;
    }

    if (query.length < 3) return;

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    void (async () => {
      try {
        const response = await fetch(`/api/images?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const payload = (await response.json()) as { images?: SlideImageType[] };
        const first = payload.images?.[0];
        if (first) setImage(first);
        // An empty result is normal for abstract topics, so it gets a quiet
        // placeholder rather than a red "not found" the teacher must worry about.
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [generatedUrl, key, query, scene.title]);

  if (hidden || (!generatedUrl && query.length < 3)) return null;

  return (
    // No `shrink-0`: a slide with a title, a subtitle and four bullets leaves
    // very little height, and a figure that refuses to shrink simply pushed
    // itself off the bottom of the card. The image gives way instead, which is
    // the right thing to lose — the bullets are the teaching content.
    <figure className="scene-image min-h-0 self-center">
      {image ? (
        <>
          {/* Remote, externally-sourced image: next/image cannot optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={generatedUrl ? `${key}:r${retry}` : key}
            src={
              generatedUrl && retry > 0 ? `${generatedUrl}&r=${retry}` : image.url
            }
            alt={image.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full rounded-xl border border-ink-700 bg-ink-900 object-cover"
            onError={() => {
              if (generatedUrl && retry < 1) {
                window.setTimeout(() => {
                  setRetry((current) => (current < 1 ? current + 1 : current));
                }, 2500);
              } else {
                setFailed(true);
              }
            }}
          />
          <figcaption className="mt-1 flex items-center gap-1.5 text-[10px] text-mist-400">
            <span className="truncate">{image.credit}</span>
            <a
              href={image.sourcePage}
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 underline underline-offset-2 hover:text-brand-300"
            >
              nguồn
            </a>
            {/* No image archive is reliable enough to trust blind: a search for
                "for loop python" returns a snake and a roller coaster. */}
            <button
              type="button"
              onClick={dismiss}
              title={generatedUrl ? "Ẩn ảnh này" : `Ẩn ảnh này (tìm với "${query}")`}
              className="ml-auto shrink-0 rounded p-0.5 text-mist-400 transition-colors hover:text-ember-500"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </figcaption>
        </>
      ) : failed ? (
        <span className="chip border-ink-600 text-mist-400">
          <ImageOff className="h-3.5 w-3.5" /> Không tìm được ảnh
        </span>
      ) : (
        <span className="chip border-ink-600 text-mist-400">
          <ImageIcon className="h-3.5 w-3.5" /> Đang tìm ảnh…
        </span>
      )}
    </figure>
  );
}

interface SceneFormulaProps {
  formula: string;
}

/**
 * Prefetches a slide's picture before it is shown.
 *
 * Rendered nowhere; it just warms the browser cache so a presenter is not
 * looking at "Đang tìm ảnh…" on the slide they are talking about. Only the
 * current and next slides are warmed — a dozen parallel searches on open would
 * be slow and rude to the image services.
 */
export function SlideImagePreload({
  lessonId,
  scene,
}: {
  lessonId?: string;
  scene: Lesson["scenes"][number];
}) {
  const query = scene.imageQuery?.trim() ?? "";
  const prompt = scene.imagePrompt?.trim() ?? "";

  useEffect(() => {
    // A generated picture is just a URL: warming it is one cache fill, no
    // search request, so the slide never shows a loading chip for it.
    if (prompt.length >= 3) {
      new Image().src = pollinationsImageUrl(lessonId ?? "", scene.id, prompt);
      return;
    }
    if (query.length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    void (async () => {
      try {
        const response = await fetch(`/api/images?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { images?: SlideImageType[] };
        const first = payload.images?.[0];
        if (first) new Image().src = first.url;
      } catch {
        // Warming is best effort; the real view retries on its own.
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lessonId, prompt, query, scene.id]);

  return null;
}


/**
 * Typesets math with KaTeX, falling back to plain text.
 *
 * A model will occasionally emit a malformed expression, and a slide that
 * throws during render loses the whole lesson. Falling back to the raw string
 * degrades to what it looked like before, instead of breaking the player.
 */
export function SceneFormula({ formula }: SceneFormulaProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      katex.render(formula, host, {
        displayMode: true,
        throwOnError: true,
        strict: false,
        trust: false,
        output: "htmlAndMathml",
      });
    } catch {
      host.textContent = formula;
    }
  }, [formula]);

  return (
    <span
      ref={hostRef}
      className="scene-formula block min-w-0 overflow-x-auto [&_.katex]:!text-inherit"
    />
  );
}

interface SceneDataChartProps {
  data: DataPoint[];
  title?: string;
}

/**
 * A spec table, styled like the ones teachers print: coloured header, banded
 * rows, a tinted caption.
 *
 * Banding is the whole point — a 10×2 multiplication table with no alternating
 * row shade is genuinely hard to follow across, and that is the exact table
 * shape this was built for.
 */
export function SceneTable({ table }: { table: SlideTable }) {
  return (
    <figure className="scene-table">
      {table.caption ? (
        <figcaption className="scene-caption mb-[2cqw] block">{table.caption}</figcaption>
      ) : null}
      <div className="overflow-hidden">
        {/* No `text-sm` here: the utility would win the cascade over
          `.scene-table`'s cqw sizing and render the table at a fixed 14px,
          which on a 16:9 card is a third larger than the rest of the slide and
          is what pushed a seven-row table past the bottom edge. */}
      <table className="w-full border-collapse">
          <thead>
            <tr>
              {table.columns.map((cell, index) => (
                <th
                  key={`${cell}-${index}`}
                  scope="col"
                  className="scene-th border-b text-left"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="scene-tr">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`scene-td border-b align-top ${
                      cellIndex === 0 ? "font-semibold" : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

const numberFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/**
 * A plain bar chart, drawn with divs.
 *
 * No charting library: these are three-to-six labelled numbers, and a library
 * would cost more bundle than the whole slide. Bars are scaled against the
 * largest magnitude, so a mixed-sign series would misbehave — negative values
 * are dropped at validation instead, which is honest for this use.
 */
export function SceneDataChart({ data, title }: SceneDataChartProps) {  const values = data.map((point) => Math.abs(point.value));
  const peak = Math.max(...values, 0);

  return (
    <figure className="scene-data">
      {title ? <figcaption className="scene-caption mb-[2cqw] block">{title}</figcaption> : null}
      <div className="space-y-[1.2cqw]">
        {data.map((point) => {
          const ratio = peak > 0 ? Math.abs(point.value) / peak : 0;
          return (
            <div key={point.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2.5">
              <span className="scene-chart-label truncate" title={point.note ?? point.label}>
                {point.label}
              </span>
              {/* The track is sunk, not grey: on a dark slide a light-grey bar
                  disappears and the bar appears to float. */}
              <span className="h-[0.9cqw] min-h-[3px] overflow-hidden bg-sunk">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${Math.max(2, ratio * 100)}%` }}
                />
              </span>
              <span className="scene-chart-value font-mono tabular-nums">
                {numberFormat.format(point.value)}
                {point.unit ? <span className="scene-chart-unit ml-0.5">{point.unit}</span> : null}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

/**
 * A sampled function graph, drawn as SVG.
 *
 * No expression parser on purpose: the model samples points, the renderer
 * only scales them. `null` ys break the polyline so an asymptote reads as a
 * gap, never as a vertical slash. Hovering shows the nearest sampled (x, y)
 * — that readout is the interaction: the student traces the curve with the
 * mouse while the narration walks x upward.
 */
export function FunctionGraph({ graph }: { graph: SlideGraph }) {
  const [hover, setHover] = useState<number | null>(null);

  const finiteYs = graph.ys.filter((y): y is number => y !== null);
  const lo = Math.min(...graph.xs);
  const hi = Math.max(...graph.xs);
  const yLo = Math.min(...finiteYs);
  const yHi = Math.max(...finiteYs);
  // A flat series (constant function) has no range to scale against, so it
  // gets one rather than dividing by zero.
  const spanX = hi - lo || 1;
  const spanY = yHi - yLo || 1;
  const minX = lo - spanX * 0.04;
  const maxX = hi + spanX * 0.04;
  const minY = yLo - spanY * 0.12;
  const maxY = yHi + spanY * 0.12;

  const W = 640;
  const H = 340;
  const PAD = { left: 52, right: 16, top: 14, bottom: 34 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const px = (x: number) => PAD.left + ((x - minX) / (maxX - minX)) * plotW;
  const py = (y: number) => PAD.top + (1 - (y - minY) / (maxY - minY)) * plotH;

  // Ticks: five each way, snapped to whole numbers when the range allows.
  const ticks = (min: number, max: number): number[] => {
    const raw = (max - min) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => raw / s <= 1.4) ?? mag * 10;
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) {
      out.push(Math.round(v * 1e9) / 1e9);
    }
    return out;
  };

  // One polyline per defined run: a null y ends the run, which is what keeps
  // the curve from drawing through an asymptote.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  graph.xs.forEach((x, i) => {
    const y = graph.ys[i];
    if (y === null || y === undefined) return;
    const prev = i > 0 ? graph.ys[i - 1] : undefined;
    const last = runs[runs.length - 1];
    if (last && prev !== null && prev !== undefined) {
      last.push({ x, y });
    } else {
      runs.push([{ x, y }]);
    }
  });

  const accent = "var(--slide-accent)";
  const soft = "var(--slide-ink-soft)";
  const rule = "var(--slide-rule)";
  const asymptote = "var(--slide-accent-soft)";

  const hoverPoint =
    hover !== null && graph.ys[hover] !== null
      ? { x: graph.xs[hover], y: graph.ys[hover] as number }
      : null;

  return (
    <figure className="scene-graph">
      {graph.title ? <figcaption className="scene-caption mb-[2cqw] block">{graph.title}</figcaption> : null}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={graph.title ?? "Đồ thị hàm số"}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const mx = ((event.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bestDist = Number.POSITIVE_INFINITY;
          graph.xs.forEach((x, i) => {
            const dist = Math.abs(px(x) - mx);
            if (dist < bestDist) {
              bestDist = dist;
              best = i;
            }
          });
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks(minY, maxY).map((t) => (
          <g key={`h-${t}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={py(t)} y2={py(t)} style={{ stroke: rule }} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={PAD.left - 8} y={py(t) + 4} textAnchor="end" fontSize={12} style={{ fill: soft }} className="font-mono tabular-nums">
              {numberFormat.format(t)}
            </text>
          </g>
        ))}
        {ticks(minX, maxX).map((t) => (
          <g key={`v-${t}`}>
            <line x1={px(t)} x2={px(t)} y1={PAD.top} y2={H - PAD.bottom} style={{ stroke: rule }} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={px(t)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={12} style={{ fill: soft }} className="font-mono tabular-nums">
              {numberFormat.format(t)}
            </text>
          </g>
        ))}
        {(graph.hlines ?? []).map((line, i) => (
          <g key={`hl-${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={py(line.y)} y2={py(line.y)} style={{ stroke: asymptote }} strokeWidth={1.5} strokeDasharray="7 5" />
            {line.label ? (
              <text x={W - PAD.right - 4} y={py(line.y) - 6} textAnchor="end" fontSize={12} style={{ fill: asymptote }}>
                {line.label}
              </text>
            ) : null}
          </g>
        ))}
        {(graph.vlines ?? []).map((line, i) => (
          <g key={`vl-${i}`}>
            <line x1={px(line.x)} x2={px(line.x)} y1={PAD.top} y2={H - PAD.bottom} style={{ stroke: asymptote }} strokeWidth={1.5} strokeDasharray="7 5" />
            {line.label ? (
              <text x={px(line.x) + 6} y={PAD.top + 14} fontSize={12} style={{ fill: asymptote }}>
                {line.label}
              </text>
            ) : null}
          </g>
        ))}
        {runs.map((run, i) => (
          <polyline
            key={`run-${i}`}
            points={run.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
            fill="none"
            style={{ stroke: accent }}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hoverPoint ? (
          <g>
            <circle cx={px(hoverPoint.x)} cy={py(hoverPoint.y)} r={6} style={{ fill: accent }} />
            <text x={Math.min(px(hoverPoint.x) + 10, W - 130)} y={Math.max(py(hoverPoint.y) - 12, 16)} fontSize={13} style={{ fill: soft }} className="font-mono tabular-nums">
              ({numberFormat.format(hoverPoint.x)}; {numberFormat.format(hoverPoint.y)})
            </text>
          </g>
        ) : null}
      </svg>
      <div className="scene-graph-hint" aria-hidden="true">
        {hoverPoint
          ? `x = ${numberFormat.format(hoverPoint.x)} → y = ${numberFormat.format(hoverPoint.y)}`
          : `Di chuột dọc đường cong để đọc giá trị${graph.xlabel ? ` · trục x: ${graph.xlabel}` : ""}${graph.ylabel ? ` · trục y: ${graph.ylabel}` : ""}`}
      </div>
    </figure>
  );
}

/**
 * Click-to-zoom for slide figures.
 *
 * cqw-sized figures are legible on the card but small in a chat-sized embed,
 * and a rational-function graph repays a closer look. The button re-mounts
 * the same children in a modal, so the zoomed graph is the live one (hover
 * works there too), not a screenshot.
 */
export function FigureZoom({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <>
      <div className="scene-zoom">
        <div className="scene-zoom-body">{children}</div>
        <button type="button" className="scene-zoom-open" onClick={() => setOpen(true)} aria-label={label} title={label}>
          <Maximize2 className="h-[1.6cqw] min-h-3.5 w-[1.6cqw] min-w-3.5" />
          <span>Phóng to</span>
        </button>
      </div>
      {open ? (
        <div className="scene-zoom-overlay" onClick={() => setOpen(false)}>
          <div
            className="scene-zoom-modal"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="scene-zoom-close" onClick={() => setOpen(false)} aria-label="Đóng">
              <X className="h-4 w-4" />
            </button>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
