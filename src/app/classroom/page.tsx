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
  const params = await searchParams;
  const rawId = params.id;
  const rawVoice = params.voice;
  const sessionId = typeof rawId === "string" && rawId ? rawId : null;
  const initialVoice = typeof rawVoice === "string" && rawVoice ? rawVoice : null;
  return <ClassroomClient sessionId={sessionId} initialVoice={initialVoice} />;
}
