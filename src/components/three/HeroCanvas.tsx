"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * `three` touches `window`/WebGL on import, so the scene is loaded only in the
 * browser. A static teal/gold gradient stands in until it is ready.
 */
const KnowledgeCore = dynamic(
  () => import("./KnowledgeCore").then((mod) => mod.KnowledgeCore),
  { ssr: false, loading: () => <HeroBackdrop /> },
);

function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 animate-breathe bg-[radial-gradient(38rem_30rem_at_26%_28%,rgba(36,189,172,0.22),transparent_62%),radial-gradient(30rem_26rem_at_74%_62%,rgba(246,185,59,0.16),transparent_60%)]"
    />
  );
}

export function HeroCanvas({ className }: { className?: string }) {
  const [density, setDensity] = useState(1);

  useEffect(() => {
    const apply = () => {
      const width = window.innerWidth;
      const cores = navigator.hardwareConcurrency ?? 4;
      setDensity(width < 720 || cores <= 4 ? 0.5 : 1);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div className={className ?? "absolute inset-0"}>
      <HeroBackdrop />
      <KnowledgeCore className="absolute inset-0 h-full w-full" density={density} />
    </div>
  );
}
