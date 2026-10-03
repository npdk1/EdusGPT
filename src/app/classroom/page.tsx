import type { Metadata } from "next";
import ClassroomClient from "./ClassroomClient";

export const metadata: Metadata = {
  title: "Classroom in session",
  description:
    "Straight into the lesson: slides appear scene by scene with their voice-over while the AI keeps writing.",
};

interface ClassroomPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClassroomPage({ searchParams }: ClassroomPageProps) {
  const raw = (await searchParams).id;
  const sessionId = typeof raw === "string" && raw ? raw : null;
  return <ClassroomClient sessionId={sessionId} />;
}
