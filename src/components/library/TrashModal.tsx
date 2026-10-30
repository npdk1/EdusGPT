"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Archive,
  Download,
  AlertTriangle,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  Layers,
  Calendar,
} from "lucide-react";
import { useCopy } from "@/i18n/provider";

export interface TrashItemSummary {
  fileName: string;
  title: string;
  subject: string;
  grade?: string;
  sceneCount: number;
  duration: number;
  fileSizeBytes: number;
  deletedAt: string;
}

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestored: () => void;
}

const TRASH_COPY = {
  en: {
    title: "Trash & Backup Recovery",
    subtitle: "Safely retrieve, backup, or permanently purge temporarily deleted lessons.",
    emptyTitle: "Trash is Empty",
    emptyDesc: "No lessons currently in trash (data/temp_delete/). Deleted lessons will appear here for backup & restore.",
    refresh: "Refresh",
    emptyAllBtn: "Empty Trash",
    confirmEmptyAll: "Are you sure you want to permanently delete ALL lessons in the trash? This cannot be undone.",
    restoreBtn: "Restore",
    backupBtn: "Download Backup",
    deleteBtn: "Delete Permanently",
    confirmDelete: "Are you sure you want to permanently delete \"{title}\"?",
    scenes: "scenes",
    restoring: "Restoring...",
    purging: "Deleting...",
    close: "Close",
    deletedAt: "Deleted:",
  },
  vi: {
    title: "Thùng rác & Khôi phục sao lưu",
    subtitle: "Dễ dàng khôi phục lại bài giảng đã xóa tạm thời hoặc tải bản backup lưu về máy.",
    emptyTitle: "Thùng rác đang trống",
    emptyDesc: "Chưa có bài giảng nào trong thùng rác (data/temp_delete/). Các bài xóa tạm thời sẽ nằm ở đây để bạn khôi phục lại khi cần.",
    refresh: "Làm mới",
    emptyAllBtn: "Dọn sạch thùng rác",
    confirmEmptyAll: "Bạn có chắc chắn muốn dọn sạch toàn bộ bài giảng trong thùng rác không? Thao tác này sẽ xóa vĩnh viễn.",
    restoreBtn: "Khôi phục bài",
    backupBtn: "Tải bản backup",
    deleteBtn: "Xóa vĩnh viễn",
    confirmDelete: "Bạn có chắc muốn xóa vĩnh viễn bài \"{title}\" khỏi ổ cứng?",
    scenes: "cảnh",
    restoring: "Đang khôi phục...",
    purging: "Đang xóa...",
    close: "Đóng",
    deletedAt: "Đã xóa:",
  },
};

export function TrashModal({ isOpen, onClose, onRestored }: TrashModalProps) {
  const t = useCopy(TRASH_COPY);

  const [trashList, setTrashList] = useState<TrashItemSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses/trash", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; trash?: TrashItemSummary[]; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể tải danh sách thùng rác");
      }
      setTrashList(data.trash || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải thùng rác");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchTrash();
    }
  }, [isOpen, fetchTrash]);

  if (!isOpen) return null;

  const handleRestore = async (item: TrashItemSummary) => {
    setActionTarget(item.fileName);
    setError(null);
    try {
      const res = await fetch("/api/courses/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", fileName: item.fileName }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể khôi phục bài học.");
      }
      await fetchTrash();
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khôi phục");
    } finally {
      setActionTarget(null);
    }
  };

  const handleDownloadBackup = (item: TrashItemSummary) => {
    const link = document.createElement("a");
    link.href = `/api/courses/trash?download=${encodeURIComponent(item.fileName)}`;
    link.download = `${item.title.replace(/[/\\?%*:|"<>]/g, "_")}_backup.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDeletePermanent = async (item: TrashItemSummary) => {
    const confirmed = window.confirm(t.confirmDelete.replace("{title}", item.title));
    if (!confirmed) return;

    setActionTarget(item.fileName);
    setError(null);
    try {
      const res = await fetch(`/api/courses/trash?fileName=${encodeURIComponent(item.fileName)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể xóa vĩnh viễn.");
      }
      await fetchTrash();
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa vĩnh viễn");
    } finally {
      setActionTarget(null);
    }
  };

  const handleEmptyAll = async () => {
    const confirmed = window.confirm(t.confirmEmptyAll);
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses/trash?all=true", { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Không thể làm sạch thùng rác.");
      }
      await fetchTrash();
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi làm sạch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-ink-800 bg-ink-900 shadow-2xl p-6 sm:p-7 text-mist-100 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-ink-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-400 border border-gold-500/20 shadow-xs">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-mist-50">
                {t.title}
              </h2>
              <p className="text-xs text-mist-400">
                {t.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-mist-400 hover:bg-ink-800 hover:text-mist-100 transition-colors"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-ember-500/40 bg-ember-500/10 p-3 text-xs sm:text-sm text-mist-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-ember-400" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Toolbar: Refresh & Dọn sạch thùng rác */}
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-mist-400 font-medium">
            {trashList.length > 0 ? (
              <span>Có <strong>{trashList.length}</strong> bài giảng trong thùng rác</span>
            ) : null}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTrash}
              disabled={loading}
              className="btn-ghost border border-ink-700/80 px-3 py-1.5 text-xs text-mist-300 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{t.refresh}</span>
            </button>

            {trashList.length > 0 ? (
              <button
                type="button"
                onClick={handleEmptyAll}
                disabled={loading}
                className="btn-ghost border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-300 inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.emptyAllBtn}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Danh sách bài giảng trong thùng rác */}
        <div className="space-y-3">
          {loading && trashList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-mist-400">
              <LoaderCircle className="h-6 w-6 animate-spin text-brand-400 mb-2" />
              <p className="text-xs">Đang kiểm tra thùng rác...</p>
            </div>
          ) : trashList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-800 bg-ink-950/30 p-8 text-center flex flex-col items-center">
              <Archive className="h-10 w-10 text-mist-400/40 mb-3" />
              <h3 className="text-sm font-bold text-mist-200">{t.emptyTitle}</h3>
              <p className="text-xs text-mist-400 max-w-sm mt-1 leading-relaxed">
                {t.emptyDesc}
              </p>
            </div>
          ) : (
            trashList.map((item) => (
              <div
                key={item.fileName}
                className="rounded-2xl border border-ink-800 bg-ink-950/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink-700 transition-all"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-md border border-gold-500/30 bg-gold-500/10 px-2 py-0.5 text-[11px] font-bold text-gold-300">
                      {item.subject}
                    </span>
                    <span className="text-[11px] text-mist-400 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t.deletedAt} {new Date(item.deletedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-mist-50 truncate" title={item.title}>
                    {item.title}
                  </h3>

                  <p className="text-xs text-mist-400 mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-mist-400" />
                      {item.sceneCount} {t.scenes}
                    </span>
                    <span>•</span>
                    <span>
                      {typeof item.fileSizeBytes === "number" && !isNaN(item.fileSizeBytes) && item.fileSizeBytes > 0
                        ? `${Math.max(1, Math.round(item.fileSizeBytes / 1024))} KB`
                        : `${Math.round(item.duration || 0)}s`}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                  {/* Nút khôi phục */}
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    disabled={actionTarget === item.fileName}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-300 transition-all disabled:opacity-50"
                    title="Khôi phục bài giảng về Thư viện chính"
                  >
                    {actionTarget === item.fileName ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span>{t.restoreBtn}</span>
                  </button>

                  {/* Nút tải bản backup */}
                  <button
                    type="button"
                    onClick={() => handleDownloadBackup(item)}
                    className="btn-ghost border border-ink-700 hover:border-brand-500/40 hover:bg-brand-500/10 px-3 py-2 text-xs font-semibold text-mist-300 hover:text-brand-300 inline-flex items-center gap-1.5"
                    title="Tải bản sao lưu .json"
                  >
                    <Download className="h-3.5 w-3.5 text-brand-400" />
                    <span>{t.backupBtn}</span>
                  </button>

                  {/* Nút xóa vĩnh viễn */}
                  <button
                    type="button"
                    onClick={() => handleDeletePermanent(item)}
                    disabled={actionTarget === item.fileName}
                    className="btn-ghost border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/10 px-2.5 py-2 text-xs text-red-400 hover:text-red-300 inline-flex items-center"
                    title="Xóa vĩnh viễn"
                    aria-label="Xóa vĩnh viễn"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-ink-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost px-5 py-2 text-xs font-semibold"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
