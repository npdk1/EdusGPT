"use client";

import { X } from "lucide-react";
import { useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    shortcutsTransport: "Seek & play",
    shortcutsPlayPause: "Play or pause",
    shortcutsSeek5: "Back / forward 5 seconds",
    shortcutsSeek10: "Back / forward 10 seconds",
    shortcutsNudge: "Nudge 1 second",
    shortcutsStepFrame: "Back / forward 1 frame",
    shortcutsJump: "Jump to 0% – 90% of the lesson",
    shortcutsEnds: "Go to start / end",
    shortcutsLoop: "Loop a section to study it",
    shortcutsMarkA: "Set marker A at the current position",
    shortcutsMarkB: "Set marker B at the current position",
    shortcutsLoopToggle: "Turn the A→B loop on/off",
    shortcutsDragKeys: "1 press",
    shortcutsDrag: "Drag on the timeline to scrub freely",
    shortcutsOther: "Other",
    shortcutsSpeed: "Slow down / speed up",
    shortcutsMute: "Mute or unmute",
    shortcutsFullscreen: "Fullscreen the slide",
    shortcutsHelp: "Open this shortcut list",
    shortcutsEsc: "Close the dialog / exit fullscreen",
    shortcutsTitle: "Player keyboard shortcuts",
    shortcutsSubtitle: "Every seek works on the lesson timeline.",
    shortcutsClose: "Close the shortcuts dialog",
  },
  vi: {
    shortcutsTransport: "Tua & phát",
    shortcutsPlayPause: "Phát hoặc tạm dừng",
    shortcutsSeek5: "Tua lui / tua tới 5 giây",
    shortcutsSeek10: "Tua lui / tua tới 10 giây",
    shortcutsNudge: "Tua chậm 1 giây",
    shortcutsStepFrame: "Lùi / tiến đúng 1 khung hình",
    shortcutsJump: "Nhảy tới 0% – 90% thời lượng",
    shortcutsEnds: "Về đầu / tới cuối",
    shortcutsLoop: "Lặp một đoạn để học kỹ",
    shortcutsMarkA: "Đặt mốc A tại vị trí hiện tại",
    shortcutsMarkB: "Đặt mốc B tại vị trí hiện tại",
    shortcutsLoopToggle: "Bật/tắt lặp A→B",
    shortcutsDragKeys: "1 lần nhấn",
    shortcutsDrag: "Chuột kéo trên timeline để tua tự do",
    shortcutsOther: "Khác",
    shortcutsSpeed: "Giảm / tăng tốc độ phát",
    shortcutsMute: "Tắt hoặc bật tiếng",
    shortcutsFullscreen: "Toàn màn hình vùng trình chiếu",
    shortcutsHelp: "Mở bảng phím tắt này",
    shortcutsEsc: "Đóng bảng / thoát toàn màn hình",
    shortcutsTitle: "Phím tắt trình phát",
    shortcutsSubtitle: "Mọi thao tác tua đều hoạt động trên timeline của bài giảng.",
    shortcutsClose: "Đóng bảng phím tắt",
  },
};

type Copy = typeof COPY.en;

/**
 * The cheatsheet rows, held as key names rather than sentences: the key column
 * stays as written on the key cap, and the label beside it comes out of the
 * file's own dictionary in whichever language is on screen.
 */
const GROUPS: Array<{
  title: keyof Copy;
  rows: Array<[string | { copy: keyof Copy }, keyof Copy]>;
}> = [
  {
    title: "shortcutsTransport",
    rows: [
      ["Space / K", "shortcutsPlayPause"],
      ["← / →", "shortcutsSeek5"],
      ["J / L", "shortcutsSeek10"],
      ["Shift + ← / →", "shortcutsNudge"],
      [", / .", "shortcutsStepFrame"],
      ["0 – 9", "shortcutsJump"],
      ["Home / End", "shortcutsEnds"],
    ],
  },
  {
    title: "shortcutsLoop",
    rows: [
      ["[", "shortcutsMarkA"],
      ["]", "shortcutsMarkB"],
      ["\\", "shortcutsLoopToggle"],
      [{ copy: "shortcutsDragKeys" }, "shortcutsDrag"],
    ],
  },
  {
    title: "shortcutsOther",
    rows: [
      ["− / +", "shortcutsSpeed"],
      ["M", "shortcutsMute"],
      ["F", "shortcutsFullscreen"],
      ["?", "shortcutsHelp"],
      ["Esc", "shortcutsEsc"],
    ],
  },
];

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const t = useCopy(COPY);
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.shortcutsTitle}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-mist-50">{t.shortcutsTitle}</h2>
            <p className="mt-1 text-sm text-mist-400">{t.shortcutsSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label={t.shortcutsClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">
                {t[group.title]}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.rows.map(([keys, description]) => (
                  <li
                    key={typeof keys === "string" ? keys : keys.copy}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2"
                  >
                    <span className="kbd">
                      {typeof keys === "string" ? keys : t[keys.copy]}
                    </span>
                    <span className="text-right text-xs text-mist-300">
                      {t[description]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
