"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * YouTube / Vercel style top loading progress bar for Next.js App Router.
 *
 * Provides immediate visual feedback as soon as a user clicks any navigation
 * link across the app, ensuring users never feel the app is unresponsive.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // When pathname or searchParams change, the route transition has finished!
  useEffect(() => {
    if (loading) {
      setProgress(100);
      const doneTimer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(doneTimer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links to kick off the progress immediately
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      // Find closest anchor tag
      const anchor = (event.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");

      // Skip external links, hashes, downloads, or target="_blank"
      if (!href || href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://") || target === "_blank") {
        return;
      }

      // If navigating to the same URL, skip
      const currentUrl = window.location.pathname + window.location.search;
      if (href === currentUrl) return;

      // Start loading bar animation
      setLoading(true);
      setProgress(15);

      if (timerRef.current) clearInterval(timerRef.current);

      let currentProgress = 15;
      timerRef.current = setInterval(() => {
        if (currentProgress < 75) {
          currentProgress += Math.random() * 15 + 10;
        } else if (currentProgress < 90) {
          currentProgress += Math.random() * 3 + 1;
        }
        setProgress(Math.min(currentProgress, 92));
      }, 180);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 inset-x-0 z-[9999] h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-red-600 via-brand-400 to-gold-400 shadow-[0_0_12px_rgba(239,68,68,0.7)] transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
          transitionDuration: progress === 100 ? "200ms" : "300ms",
        }}
      >
        {/* Glowing tip element */}
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-r from-transparent to-white/70 shadow-[0_0_10px_#fff]" />
      </div>
    </div>
  );
}
