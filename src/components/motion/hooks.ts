"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` on the client, `useEffect` during SSR — avoids React's
 * "useLayoutEffect does nothing on the server" warning while still letting us
 * set the pre-animation state before the first paint (no flash of content).
 */
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
