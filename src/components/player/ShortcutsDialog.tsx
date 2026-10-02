"use client";

import { X } from "lucide-react";

const GROUPS: Array<{ title: string; rows: Array<[string, string]> }> = [
  {
    title: "Tua & phát",
    rows: [
      ["Space / K", "Phát hoặc tạm dừng"],
      ["← / →", "Tua lui / tua tới 5 giây"],
      ["J / L", "Tua lui / tua tới 10 giây"],
      ["Shift + ← / →", "Tua chậm 1 giây"],
      [", / .", "Lùi / tiến đúng 1 khung hình"],
      ["0 – 9", "Nhảy tới 0% – 90% thời lượng"],
      ["Home / End", "Về đầu / tới cuối"],
    ],
  },
  {
    title: "Lặp một đoạn để học kỹ",
    rows: [
      ["[", "Đặt mốc A tại vị trí hiện tại"],
      ["]", "Đặt mốc B tại vị trí hiện tại"],
      ["\\", "Bật/tắt lặp A→B"],
      ["1 lần nhấn", "Chuột kéo trên timeline để tua tự do"],
    ],
  },
  {
    title: "Khác",
    rows: [
      ["− / +", "Giảm / tăng tốc độ phát"],
      ["M", "Tắt hoặc bật tiếng"],
      ["F", "Toàn màn hình vùng trình chiếu"],
      ["?", "Mở bảng phím tắt này"],
      ["Esc", "Đóng bảng / thoát toàn màn hình"],
    ],
  },
];

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phím tắt trình phát"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-mist-50">Phím tắt trình phát</h2>
            <p className="mt-1 text-sm text-mist-400">
              Mọi thao tác tua đều hoạt động trên timeline của bài giảng.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label="Đóng bảng phím tắt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-300">
                {group.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {group.rows.map(([keys, description]) => (
                  <li
                    key={keys}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2"
                  >
                    <span className="kbd">{keys}</span>
                    <span className="text-right text-xs text-mist-300">{description}</span>
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
