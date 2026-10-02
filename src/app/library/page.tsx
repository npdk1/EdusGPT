import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { LibraryPanel } from "@/components/library/LibraryPanel";

export const metadata: Metadata = {
  title: "Thư viện bài giảng",
  description: "Các bài đã lưu trên máy. Mở, xoá, quản lý bài giảng đã soạn.",
};

export default function LibraryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <span className="chip">
          <FolderOpen className="h-3.5 w-3.5 text-brand-300" /> lưu trên máy bạn
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-mist-50 sm:text-4xl">
          Thư viện bài giảng
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist-300">
          Bài lưu ở <code className="font-mono text-gold-200">data/courses/</code>{" "}
          trên máy bạn, không nằm trong trình duyệt. Đổi máy, đổi trình duyệt
          hay xoá cache vẫn còn nguyên.
        </p>
      </header>

      <LibraryPanel />
    </div>
  );
}
