"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { canRun3D } from "@/lib/device";
import type { Profile } from "@/lib/profile-shared";

type WorldProps = { profile: Profile; onReady: () => void };
const STAGES = ["Loading the 3D engine", "Building the room", "Waking the cat"];

export function ExploreShell({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [World, setWorld] = useState<ComponentType<WorldProps> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canRun3D()) {
      router.replace("/quick?reason=webgl");
      return;
    }
    import("./World")
      .then((m) => {
        setWorld(() => m.default);
        setStage(1);
      })
      .catch(() => setFailed(true));
  }, [router]);

  const onReady = () => {
    setStage(2);
    setTimeout(() => setReady(true), 250);
  };

  return (
    <>
      {World && <World profile={profile} onReady={onReady} />}
      {!ready && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-paper px-6 text-center" role="status" aria-live="polite">
          {failed ? (
            <>
              <p>The 3D room couldn&apos;t load.</p>
              <a href="/quick" className="rounded-full bg-accent px-4 py-2 font-medium text-accent-ink">Open quick view</a>
            </>
          ) : (
            <>
              <p className="font-display text-xl">{STAGES[stage]}…</p>
              <div className="h-2 w-64 overflow-hidden rounded-full bg-paper-2" aria-hidden>
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }} />
              </div>
              <p className="text-sm text-ink-soft">
                {stage + 1} of {STAGES.length} · <a href="/quick" className="underline">skip to quick view</a>
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
