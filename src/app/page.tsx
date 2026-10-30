import { Suspense } from "react";
import HomeClient from "./HomeClient";

/**
 * The landing route stays a server component; every visible string lives in the
 * client island beside it, where `useCopy` can pick the language.
 *
 * Wrapped in Suspense so `useSearchParams` in client component behaves cleanly.
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}
