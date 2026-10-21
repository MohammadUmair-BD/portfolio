"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const fromQuery = () => new URLSearchParams(window.location.search).get("reason") === "webgl";

export function FallbackNotice() {
  const show = useSyncExternalStore(subscribe, fromQuery, () => false);
  if (!show) return null;
  return (
    <p role="status" className="no-print mt-4 rounded-lg border border-line bg-paper-2 px-4 py-2 text-sm">
      Your browser can&apos;t show the 3D room, so here&apos;s the quick view instead.
    </p>
  );
}
