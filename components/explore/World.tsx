"use client";

import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type * as THREE from "three";
import type { Profile } from "@/lib/profile-shared";
import {
  CAT_SPOTS, DESK_TOP, FOCUS, LAYOUT, OBJECT_SECTION, OVERVIEW, SECTION_LABELS, SECTION_OBJECT,
  type CameraView, type ObjectId, type SectionId,
} from "@/lib/scene-layout";
import { buildTour } from "@/lib/tour";
import { loadVisitor, saveVisitor } from "@/lib/visitor";
import { Behaviors } from "./Behaviors";
import { CameraRig } from "./CameraRig";
import { Cat } from "./Cat";
import { CatBrain } from "./cat-brain";
import { Chat } from "./Chat";
import { Overlay } from "./Overlay";
import { startPurr, stopPurr } from "./purr";
import { Room } from "./Room";

type Action = { label: string; onClick: () => void; primary?: boolean };
type Bubble = { text: string; actions?: Action[] };

const IDLE_SLEEP_MS = 60_000;
const SECTIONS = Object.keys(SECTION_LABELS) as SectionId[];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia(motionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const subscribeVisibility = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

export default function World({ profile, onReady }: { profile: Profile; onReady: () => void }) {
  const router = useRouter();
  const first = profile.name.split(" ").at(-1) ?? profile.name;
  const catName = profile.site.catName;
  const tour = useMemo(() => buildTour(profile), [profile]);
  const brain = useMemo(() => new CatBrain(CAT_SPOTS.home), []);

  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => false);
  const tabVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true);

  const [section, setSection] = useState<SectionId | null>(null);
  const [view, setView] = useState<CameraView | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  const bubbleEl = useRef<HTMLDivElement>(null);
  const penRef = useRef<THREE.Group>(null);
  const seq = useRef(0); // bumps on every new command so stale async steps bail out
  const live = useRef({ section, tourIndex, chatOpen, bubble, introDone: false, lastActivity: 0, penDown: false });
  useEffect(() => {
    Object.assign(live.current, { section, tourIndex, chatOpen, bubble });
  }, [section, tourIndex, chatOpen, bubble]);

  useEffect(() => {
    brain.reducedMotion = reducedMotion;
  }, [brain, reducedMotion]);

  const viewPosition = (v: CameraView | null) => (v ?? OVERVIEW).position;

  // ------------------------------------------------------------- actions

  const sendCat = useCallback(
    async (spot: keyof typeof CAT_SPOTS, faceFrom: CameraView | null, then: "sit" | "talk" = "sit") => {
      const my = ++seq.current;
      const arrived = await brain.moveTo(CAT_SPOTS[spot], then);
      if (arrived && my === seq.current) brain.faceTowards(viewPosition(faceFrom));
      return arrived && my === seq.current;
    },
    [brain],
  );

  const openSection = useCallback(
    (id: SectionId) => {
      const obj = SECTION_OBJECT[id];
      setSection(id);
      setView(FOCUS[obj]);
      setBubble(null);
      setChatOpen(false);
      saveVisitor({ lastSection: id });
      if (live.current.tourIndex === null) void sendCat(obj, FOCUS[obj]);
    },
    [sendCat],
  );

  const closeSection = useCallback(() => {
    setSection(null);
    const t = live.current.tourIndex;
    setView(t === null ? null : tour[t].camera);
  }, [tour]);

  const backToRoom = useCallback(() => {
    setSection(null);
    setChatOpen(false);
    setView(null);
  }, []);

  const endTour = useCallback(
    async (skipped: boolean) => {
      live.current.tourIndex = null;
      setTourIndex(null);
      setSection(null);
      setView(null);
      saveVisitor({ tourDone: true });
      setBubble(null);
      if (await sendCat("home", null, "talk")) {
        setBubble({
          text: skipped
            ? `No problem! Click anything in the room, or ask me about ${first}.`
            : `That's the whole tour! Click anything to look closer, or ask me about ${first}. 🐾`,
          actions: [{ label: `Ask ${catName}`, onClick: () => setChatOpen(true), primary: true }],
        });
      }
    },
    [catName, first, sendCat],
  );

  /** One tour step: camera first, then the cat walks or jumps over and talks. */
  const goToStep = useCallback(
    async (index: number) => {
      const step = tour[index];
      live.current.tourIndex = index;
      setTourIndex(index);
      setChatOpen(false);
      setSection(null);
      setBubble(null);
      setView(step.camera);
      // sendCat returns false if Next/Back/Skip was pressed before the cat arrived.
      if (!(await sendCat(step.target, step.camera, "talk"))) return;
      const sec = OBJECT_SECTION[step.target];
      setBubble({ text: step.line, actions: [{ label: `Open ${SECTION_LABELS[sec]}`, onClick: () => openSection(sec), primary: true }] });
    },
    [tour, sendCat, openSection],
  );

  const startTour = useCallback(() => void goToStep(0), [goToStep]);

  const selectObject = useCallback((id: ObjectId) => openSection(OBJECT_SECTION[id]), [openSection]);

  const dismissBubble = useCallback(() => {
    setBubble(null);
    brain.set("sit");
  }, [brain]);

  // --------------------------------------------------------------- intro

  useEffect(() => {
    const memory = loadVisitor();
    const my = ++seq.current;
    let cancelled = false;
    const alive = () => !cancelled && my === seq.current;

    saveVisitor({ visited: true });
    (async () => {
      if (!memory.visited) {
        brain.set("sleep");
        await wait(reducedMotion ? 300 : 1600);
        if (!alive()) return;
        await brain.play("wake", 1.9, "idle");
        if (!alive()) return;
        brain.faceTowards(OVERVIEW.position);
        await wait(reducedMotion ? 0 : 450);
        if (!alive()) return;
        await brain.play("wave", 1.5, "talk");
        if (!alive()) return;
        setBubble({
          text: `Oh! A visitor. I'm ${catName}, ${first}'s assistant. Want the tour?`,
          actions: [
            { label: "Show me around", onClick: startTour, primary: true },
            { label: "I'll explore myself", onClick: dismissBubble },
            { label: "Quick view", onClick: () => router.push("/quick") },
          ],
        });
      } else {
        brain.set("talk");
        brain.faceTowards(OVERVIEW.position);
        const last = memory.lastSection;
        setBubble({
          text: "Welcome back! Want to pick up where you left off?",
          actions: [
            ...(last ? [{ label: `Back to ${SECTION_LABELS[last]}`, onClick: () => openSection(last), primary: true }] : []),
            { label: memory.tourDone ? "Take the tour again" : "Take the tour", onClick: startTour, primary: !last },
            { label: "I'll explore myself", onClick: dismissBubble },
          ],
        });
      }
    })().finally(() => {
      live.current.introDone = true;
    });
    return () => {
      cancelled = true;
    };
    // Only on first mount: the intro should not replay when callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------- idle sleep and the pen prank

  useEffect(() => {
    live.current.lastActivity = Date.now();
    const touch = () => {
      live.current.lastActivity = Date.now();
      if (brain.state === "sleep" && live.current.introDone && !brain.busy) void brain.play("wake", 1.6, "sit");
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const timer = window.setInterval(() => {
      const s = live.current;
      const calm = s.introDone && s.section === null && s.tourIndex === null && !s.chatOpen && !brain.busy;
      if (!calm || document.visibilityState !== "visible") return;
      const idleFor = Date.now() - s.lastActivity;

      if (idleFor > IDLE_SLEEP_MS && brain.state !== "sleep") {
        setBubble(null);
        brain.set("sleep");
        return;
      }

      // Every so often, while the visitor is watching, knock the pen off the desk.
      const onDesk = brain.position.y > DESK_TOP - 0.05;
      if (!s.penDown && !s.bubble && onDesk && brain.state !== "sleep" && idleFor > 4000 && Math.random() < 1 / 45) {
        s.penDown = true;
        void (async () => {
          const my = ++seq.current;
          if (!(await brain.moveTo(CAT_SPOTS.pen, "idle")) || my !== seq.current) return (s.penDown = false);
          brain.faceTowards(LAYOUT.pen);
          await wait(300);
          void brain.play("swat", 0.8, "sit");
          await wait(350);
          const pen = penRef.current;
          if (!pen) return;
          const tl = gsap.timeline();
          tl.to(pen.position, { z: "+=0.4", x: "+=0.05", duration: 0.25, ease: "power1.out" })
            .to(pen.position, { y: 0.02, duration: 0.5, ease: "bounce.out" })
            .to(pen.rotation, { x: 1.4, z: 2.4, duration: 0.5 }, "<");
          await wait(1200);
          brain.faceTowards(OVERVIEW.position);
          await wait(25_000);
          pen.position.set(...LAYOUT.pen);
          pen.rotation.set(0, 0.6, 0);
          s.penDown = false;
        })();
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(timer);
    };
  }, [brain]);

  // ------------------------------------------------------------ purring

  const onCatHover = useCallback(
    (over: boolean) => {
      brain.purring = over;
      document.body.style.cursor = over ? "pointer" : "";
      setHoverLabel(over ? `${catName} · click to chat` : null);
      if (over && soundOn) startPurr();
      else stopPurr();
    },
    [brain, catName, soundOn],
  );

  useEffect(() => () => stopPurr(), []);

  const canPlay = useCallback(() => {
    const s = live.current;
    return s.introDone && s.section === null && s.tourIndex === null && !s.chatOpen;
  }, []);

  // ESC backs out of a close-up when no dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !live.current.section && !live.current.chatOpen) setView(live.current.tourIndex === null ? null : tour[live.current.tourIndex].camera);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour]);

  const touring = tourIndex !== null;
  const zoomed = view !== null || section !== null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_top,#4a3b33,#1b1714)]">
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={tabVisible ? "always" : "never"}
        camera={{ fov: 45, near: 0.1, far: 60, position: OVERVIEW.position }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={() => requestAnimationFrame(() => onReady())}
        onPointerMissed={() => setHoverLabel(null)}
        aria-hidden
      >
        <hemisphereLight args={["#fff2e2", "#9a7356", 1.1]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.7}
          color="#fff0dc"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-bias={-0.0005}
        />
        <CameraRig view={view} reducedMotion={reducedMotion} />
        <Room profile={profile} onSelect={selectObject} onHover={setHoverLabel} penRef={penRef} />
        <Cat brain={brain} onHover={onCatHover} onClick={() => { setBubble(null); setChatOpen(true); }} />
        <Behaviors brain={brain} bubbleEl={bubbleEl} canPlay={canPlay} />
      </Canvas>

      {/* Speech bubble, positioned over the cat by <Behaviors>. */}
      <div ref={bubbleEl} className="pointer-events-none fixed left-0 top-0 z-10" style={{ visibility: "hidden" }}>
        {bubble && !chatOpen && !section && (
          <div role="status" className="pointer-events-auto mb-3 w-[min(320px,85vw)] rounded-2xl bg-paper p-4 text-sm leading-relaxed shadow-xl">
            <p>{bubble.text}</p>
            {bubble.actions && (
              <div className="mt-3 flex flex-wrap gap-2">
                {bubble.actions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${a.primary ? "bg-accent text-accent-ink" : "border border-line hover:bg-paper-2"}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-paper" aria-hidden />
          </div>
        )}
      </div>

      {/* Top bar: always lets people out. */}
      {/* Above section overlays (z-30) so Back and Exit stay usable. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[35] flex flex-wrap items-center gap-2 p-3 sm:p-4 [&>*]:pointer-events-auto">
        <h1 className="mr-auto truncate rounded-full bg-paper/85 px-3 py-1.5 text-sm font-semibold backdrop-blur">
          {profile.name}
          <span className="hidden font-normal text-ink-soft sm:inline"> · {profile.headline}</span>
        </h1>
        <button
          onClick={backToRoom}
          className={`rounded-full px-3 py-1.5 text-sm font-medium shadow ${zoomed ? "bg-paper" : "bg-paper/70 text-ink-soft"}`}
        >
          ← Back<span className="hidden sm:inline"> to room</span>
        </button>
        <button
          onClick={() => setSoundOn((s) => !s)}
          aria-pressed={soundOn}
          className="rounded-full bg-paper/85 px-3 py-1.5 text-sm backdrop-blur"
          title="Sound is only used for the purr"
        >
          <span aria-hidden>{soundOn ? "🔊" : "🔈"}</span>
          <span className="sr-only sm:not-sr-only sm:ml-1">{soundOn ? "Sound on" : "Sound off"}</span>
        </button>
        <Link href="/quick" className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-paper shadow">
          Exit<span className="hidden sm:inline"> to quick view</span>
        </Link>
      </div>

      {hoverLabel && !section && (
        <p className="pointer-events-none fixed left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1 text-sm text-paper">{hoverLabel}</p>
      )}

      {/* Tour controls */}
      {touring && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-3 sm:bottom-24">
          <div className="flex items-center gap-2 rounded-full bg-paper p-1.5 shadow-xl" role="group" aria-label="Tour controls">
            <button onClick={() => goToStep(Math.max(0, tourIndex - 1))} disabled={tourIndex === 0} className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-paper-2 disabled:opacity-40">
              ← Back
            </button>
            <span className="px-1 text-xs text-ink-soft" aria-live="polite">
              {tourIndex + 1} / {tour.length}
            </span>
            <button
              onClick={() => (tourIndex >= tour.length - 1 ? endTour(false) : goToStep(tourIndex + 1))}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink"
            >
              {tourIndex >= tour.length - 1 ? "Finish" : "Next →"}
            </button>
            <button onClick={() => endTour(true)} className="rounded-full px-3 py-1.5 text-sm hover:bg-paper-2">
              Skip tour
            </button>
          </div>
        </div>
      )}

      {/* Dock: every section as a real button (keyboard, screen readers, touch). */}
      <nav aria-label="Room sections" className="fixed inset-x-0 bottom-0 z-10 p-3 sm:p-4">
        <ul className="mx-auto flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-full bg-paper/85 p-1.5 shadow-lg backdrop-blur">
          {SECTIONS.map((id) => (
            <li key={id}>
              <button
                onClick={() => openSection(id)}
                aria-current={section === id ? "true" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${section === id ? "bg-ink text-paper" : "hover:bg-paper-2"}`}
              >
                {SECTION_LABELS[id]}
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => { setBubble(null); setChatOpen((o) => !o); }} className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
              Ask {catName}
            </button>
          </li>
          {!touring && (
            <li>
              <button onClick={startTour} className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm hover:bg-paper-2">
                Tour
              </button>
            </li>
          )}
        </ul>
      </nav>

      {section && <Overlay section={section} profile={profile} onClose={closeSection} />}
      {chatOpen && <Chat catName={catName} firstName={first} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
