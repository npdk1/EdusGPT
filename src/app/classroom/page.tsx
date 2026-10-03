import type { Metadata } from "next";
import ClassroomClient from "./ClassroomClient";

export const metadata: Metadata = {
  title: "Lớp học đang diễn ra",
  description:
    "Vào thẳng buổi học: slide hiện dần từng cảnh kèm giọng đọc trong lúc AI viết tiếp.",
};

interface ClassroomPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClassroomPage({ searchParams }: ClassroomPageProps) {
  const raw = (await searchParams).id;
  const sessionId = typeof raw === "string" && raw ? raw : null;
  return <ClassroomClient sessionId={sessionId} />;
}
