"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { canRun3D } from "@/lib/device";

const subscribe = () => () => {};

export function EntryChoices({ catName }: { catName: string }) {
  // null while rendering on the server, then the real answer in the browser.
  const supports3D = useSyncExternalStore(subscribe, canRun3D, () => null);
  const card = "group flex flex-col rounded-2xl border border-line bg-card p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  return (
    <div className="mt-10 grid w-full gap-4 sm:grid-cols-2">
      {/* Quick view comes first on phones (and for screen readers); on wider screens the 3D room is shown first. */}
      <Link href="/quick" className={`${card}`}>
        <span className="text-2xl" aria-hidden>⚡</span>
        <span className="mt-3 font-display text-xl font-semibold">Quick view</span>
        <span className="mt-1 text-sm text-ink-soft">The resume on one fast, simple page.</span>
      </Link>
      {supports3D === false ? (
        <div className={`${card} cursor-not-allowed sm:-order-1 opacity-60 hover:translate-y-0 hover:shadow-sm`} aria-disabled>
          <span className="text-2xl" aria-hidden>🏠</span>
          <span className="mt-3 font-display text-xl font-semibold">Explore my world</span>
          <span className="mt-1 text-sm text-ink-soft">This device can&apos;t show the 3D room. Quick view has everything.</span>
        </div>
      ) : (
        <Link href="/explore" className={`${card} sm:-order-1`}>
          <span className="text-2xl" aria-hidden>🏠</span>
          <span className="mt-3 font-display text-xl font-semibold">Explore my world</span>
          <span className="mt-1 text-sm text-ink-soft">A cosy 3D room with {catName} the cat as your guide.</span>
        </Link>
      )}
    </div>
  );
}
