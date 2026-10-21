"use client";

import { Canvas } from "@react-three/fiber";
import gsap from "gsap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Vector3 } from "three";
import type * as THREE from "three";
import { voice, type Profile } from "@/lib/profile-shared";
import {
  CAT_SPOTS, DESK_TOP, FOCUS, LAYOUT, OBJECT_SECTION, OUTSIDE, OVERVIEW, SECTION_LABELS, SECTION_OBJECT, STAND,
  type CameraView, type ObjectId, type SectionId,
} from "@/lib/scene-layout";
import { buildTour } from "@/lib/tour";
import { loadVisitor, saveVisitor } from "@/lib/visitor";
import { Behaviors } from "./Behaviors";
import { CameraRig, clampLook, type CameraMode, type Look } from "./CameraRig";
import { Cat } from "./Cat";
import { CatBrain } from "./cat-brain";
import { Chat } from "./Chat";
import { Overlay } from "./Overlay";
import { playKnock, startPurr, stopPurr } from "./purr";
import { Room } from "./Room";

type Action = { label: string; onClick: () => void; primary?: boolean };
type Bubble = { text: string; actions?: Action[] };

const IDLE_SLEEP_MS = 60_000;
const SECTIONS = Object.keys(SECTION_LABELS) as SectionId[];
const DOOR_OPEN = 1.65; // radians the door swings into the room
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag, not a click
const STEP = { yaw: 0.35, pitch: 0.17 }; // one press of an arrow (about 20° and 10°)
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Came in through the door earlier in this browser session? Then skip the door. */
const ENTERED_KEY = "portfolio-entered";
const HINT_KEY = "portfolio-look-hint-seen";
const readFlag = (store: () => Storage, key: string) => {
  try {
    return store().getItem(key) === "1";
  } catch {
    return false;
  }
};
const writeFlag = (store: () => Storage, key: string) => {
  try {
    store().setItem(key, "1");
  } catch {
    // Storage blocked: the site still works, it just won't remember.
  }
};

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
  const v = voice(profile);
  const first = v.first;
  const catName = profile.site.catName;
  const tour = useMemo(() => buildTour(profile), [profile]);
  const brain = useMemo(() => new CatBrain(CAT_SPOTS.home), []);

  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => false);
  const tabVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true);

  // This component only ever renders in the browser (loaded after mount), so reading storage here is safe.
  const [startedInside] = useState(() => readFlag(() => sessionStorage, ENTERED_KEY));
  const [entered, setEntered] = useState(startedInside);
  const [knocking, setKnocking] = useState(false);
  const [section, setSection] = useState<SectionId | null>(null);
  const [view, setView] = useState<CameraView | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [hintSeen, setHintSeen] = useState(() => readFlag(() => localStorage, HINT_KEY));

  const bubbleEl = useRef<HTMLDivElement>(null);
  const boardEl = useRef<HTMLDivElement>(null);
  const tagEls = useRef<Partial<Record<ObjectId, HTMLButtonElement | null>>>({});
  const penRef = useRef<THREE.Group>(null);
  const doorRef = useRef<THREE.Group>(null);
  const look = useRef<Look>({ yaw: 0, pitch: 0.02 });
  const drag = useRef({ active: false, x: 0, y: 0, moved: 0 });
  const seq = useRef(0); // bumps on every new command so stale async steps bail out
  const introStarted = useRef(false);
  const live = useRef({ section, tourIndex, chatOpen, bubble, entered, zoomed: false, introDone: false, lastActivity: 0, penDown: false });
  useEffect(() => {
    Object.assign(live.current, { section, tourIndex, chatOpen, bubble, entered, zoomed: view !== null });
  }, [section, tourIndex, chatOpen, bubble, entered, view]);

  useEffect(() => {
    brain.reducedMotion = reducedMotion;
  }, [brain, reducedMotion]);

  const mode: CameraMode = !entered ? { kind: "outside" } : view ? { kind: "focus", view } : { kind: "look" };
  const looking = entered && !view && !section;

  // ------------------------------------------------------------- the door

  const knock = useCallback(() => {
    if (knocking || live.current.entered) return;
    setKnocking(true);
    writeFlag(() => sessionStorage, ENTERED_KEY);
    if (soundOn) playKnock();
    const door = doorRef.current;
    if (!door || reducedMotion) {
      if (door) door.rotation.y = DOOR_OPEN;
      setEntered(true);
      return;
    }
    gsap
      .timeline()
      .to(door.rotation, { y: 0.03, duration: 0.07, yoyo: true, repeat: 5, ease: "power1.inOut" }) // knock, knock, knock
      .to(door.rotation, { y: DOOR_OPEN, duration: 1.3, ease: "power2.inOut" }, "+=0.35")
      .add(() => setEntered(true), "-=0.9"); // start walking in while the door is still swinging
  }, [knocking, reducedMotion, soundOn]);

  // ------------------------------------------------------- looking around

  const turn = useCallback((dYaw: number, dPitch: number) => {
    look.current.yaw += dYaw;
    look.current.pitch += dPitch;
    clampLook(look.current);
    setHintSeen(true);
    writeFlag(() => localStorage, HINT_KEY);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!looking || !(e.target instanceof HTMLCanvasElement)) return;
    drag.current = { active: true, x: e.clientX, y: e.clientY, moved: 0 };
    e.target.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    if (d.moved < DRAG_THRESHOLD) return;
    document.body.style.cursor = "grabbing";
    // "Grab the room": dragging right pulls the view left, like Street View.
    turn(dx * 0.0045, dy * 0.0035);
  };
  const onPointerUp = () => {
    if (drag.current.active && drag.current.moved >= DRAG_THRESHOLD) document.body.style.cursor = "";
    drag.current.active = false;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!live.current.entered || live.current.section || (e.target as HTMLElement)?.closest?.("input, textarea")) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [STEP.yaw, 0], ArrowRight: [-STEP.yaw, 0], ArrowUp: [0, STEP.pitch], ArrowDown: [0, -STEP.pitch],
      };
      if (map[e.key] && !live.current.chatOpen) {
        e.preventDefault();
        turn(...map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  // ------------------------------------------------------------- actions

  const viewPosition = (cv: CameraView | null) => (cv ?? OVERVIEW).position;

  /**
   * A close-up of Miso wherever he is. On wide screens he sits left of centre
   * so the chat panel on the right doesn't cover him; on phones he sits above
   * the chat, which fills the bottom of the screen.
   */
  const catView = useCallback((): CameraView => {
    const cat = brain.position;
    const toVisitor = new Vector3(STAND[0] - cat.x, 0, STAND[2] - cat.z).normalize();
    const right = new Vector3(toVisitor.z, 0, -toVisitor.x); // screen-right when facing the cat
    const wide = window.innerWidth >= 700;
    const shift = right.multiplyScalar(wide ? 0.38 : 0);
    const target = cat.clone().add(new Vector3(0, wide ? 0.28 : 0.05, 0)).add(shift);
    const position = cat.clone().addScaledVector(toVisitor, wide ? 1.35 : 1.7).add(new Vector3(0, wide ? 0.45 : 0.6, 0)).add(shift);
    return { position: position.toArray() as [number, number, number], target: target.toArray() as [number, number, number] };
  }, [brain]);

  const openChat = useCallback(() => {
    if (!live.current.entered) return;
    setBubble(null);
    setSection(null);
    if (live.current.tourIndex === null) {
      const v = catView();
      setView(v);
      brain.faceTowards(v.position);
      if (!brain.busy && brain.state === "sleep") void brain.play("wake", 1.2, "sit");
    }
    setChatOpen(true);
  }, [brain, catView]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    if (live.current.tourIndex === null) setView(null);
  }, []);

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
      if (!live.current.entered) return;
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
            ? `No problem! Drag to look around, click anything, or ask me about ${first}.`
            : `That's the whole tour! Click anything to look closer, or ask me about ${first}. 🐾`,
          actions: [{ label: `Ask ${catName}`, onClick: openChat, primary: true }],
        });
      }
    },
    [catName, first, sendCat, openChat],
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
  // Runs once the visitor is inside: right away if they skipped the door,
  // otherwise after the walk through the doorway.

  useEffect(() => {
    if (!entered || introStarted.current) return;
    introStarted.current = true;
    const memory = loadVisitor();
    const my = ++seq.current;
    const alive = () => my === seq.current;

    saveVisitor({ visited: true });
    (async () => {
      await wait(startedInside || reducedMotion ? 300 : 1700);
      if (!alive()) return;
      if (!memory.visited) {
        brain.set("sleep");
        await wait(reducedMotion ? 0 : 600);
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
        if (brain.state === "sleep") await brain.play("wake", 1.2, "talk");
        if (!alive()) return;
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
    // Only when the visitor first gets inside: the intro must not replay when callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

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
      brain.purring = over && !brain.busy;
      document.body.style.cursor = over ? "pointer" : "";
      setHoverLabel(over ? `${catName} · click to chat` : null);
      if (brain.purring && soundOn) startPurr();
      else stopPurr();
    },
    [brain, catName, soundOn],
  );

  useEffect(() => () => stopPurr(), []);

  const canPlay = useCallback(() => {
    const s = live.current;
    return s.introDone && s.section === null && s.tourIndex === null && !s.chatOpen && !drag.current.active;
  }, []);
  const showBoard = useCallback(() => live.current.entered && !live.current.section, []);
  // Section headings only while standing and looking around, not in close-ups.
  const showTags = useCallback(() => live.current.entered && !live.current.section && !live.current.zoomed, []);

  // ESC backs out of a close-up when no dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !live.current.section && !live.current.chatOpen) setView(live.current.tourIndex === null ? null : tour[live.current.tourIndex].camera);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour]);

  // When Miso starts talking while the visitor is just standing and looking around,
  // turn their head towards him so his speech bubble is never shown without him.
  useEffect(() => {
    if (!bubble || view || section) return;
    const cat = brain.position;
    const dx = cat.x - STAND[0];
    const dz = cat.z - STAND[2];
    const wantYaw = Math.atan2(-dx, -dz);
    // Aim a little above him on narrow screens, where the bubble sits over his head.
    const wantPitch = Math.atan2(cat.y + (window.innerWidth < 700 ? 0.55 : 0.25) - STAND[1], Math.hypot(dx, dz));
    const l = look.current;
    if (Math.abs(l.yaw - wantYaw) > 0.2 || Math.abs(l.pitch - wantPitch) > 0.25) {
      l.yaw = wantYaw;
      l.pitch = wantPitch;
      clampLook(l);
    }
  }, [bubble, view, section, brain]);

  const touring = tourIndex !== null;
  const zoomed = view !== null || section !== null;

  return (
    <div
      className="fixed inset-0 touch-none overflow-hidden bg-[#2b2522]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop={tabVisible ? "always" : "never"}
        camera={{ fov: 58, near: 0.05, far: 60, position: startedInside ? OVERVIEW.position : OUTSIDE.position }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={() => requestAnimationFrame(() => onReady())}
        onPointerMissed={() => setHoverLabel(null)}
        aria-hidden
      >
        <hemisphereLight args={["#fff2e2", "#9a7356", 1.0]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.4}
          color="#fff0dc"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-bias={-0.0005}
        />
        <CameraRig mode={mode} look={look} reducedMotion={reducedMotion} />
        <Room
          profile={profile}
          onSelect={selectObject}
          onHover={setHoverLabel}
          penRef={penRef}
          doorRef={doorRef}
          doorStartsOpen={startedInside}
          onDoor={knock}
        />
        <Cat brain={brain} onHover={onCatHover} onClick={openChat} />
        <Behaviors brain={brain} bubbleEl={bubbleEl} canPlay={canPlay} boardEl={boardEl} showBoard={showBoard} tagEls={tagEls} showTags={showTags} />
      </Canvas>

      {/* Intro board text: real HTML, stretched over the 3D board by <Behaviors>. */}
      <div ref={boardEl} className="pointer-events-none fixed left-0 top-0 z-[5] flex flex-col items-center justify-center text-center text-[#f3ecd9]" style={{ visibility: "hidden" }}>
        <p className="text-[0.85em] uppercase tracking-[0.2em] text-[#e8c27a]">Welcome · I&apos;m</p>
        <p className="font-display text-[2.1em] font-semibold leading-tight">{profile.name}</p>
        <p className="mt-[0.2em] text-[1em]">{profile.headline}</p>
        <p className="mt-[0.1em] text-[0.85em] opacity-80">
          {profile.location}
          {profile.availability ? " · Available for new roles" : ""}
        </p>
        <button
          onClick={() => openSection("about")}
          className="pointer-events-auto mt-[0.6em] rounded-full border border-[#e8c27a]/70 px-[0.9em] py-[0.25em] text-[0.8em] text-[#e8c27a] hover:bg-[#e8c27a]/15"
        >
          More about me →
        </button>
      </div>

      {/* Section headings floating above each object, positioned by <Behaviors>. */}
      {(Object.keys(OBJECT_SECTION) as ObjectId[]).map((obj) => (
        <button
          key={obj}
          ref={(el) => {
            tagEls.current[obj] = el;
          }}
          onClick={() => openSection(OBJECT_SECTION[obj])}
          tabIndex={-1}
          // Fixed colours (not theme tokens): the room looks the same in light and dark mode, so the labels must too.
          className="fixed left-0 top-0 z-[6] whitespace-nowrap rounded-full bg-[#2a2320]/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#f3ecd9] shadow-md backdrop-blur-sm transition-colors hover:bg-[#c8643b] hover:text-white"
          style={{ visibility: "hidden" }}
        >
          {SECTION_LABELS[OBJECT_SECTION[obj]]}
        </button>
      ))}

      {/* Speech bubble, positioned over the cat by <Behaviors>. */}
      <div ref={bubbleEl} className="group pointer-events-none fixed left-0 top-0 z-10" style={{ visibility: "hidden" }}>
        {bubble && !chatOpen && !section && (
          <div role="status" className="pointer-events-auto relative w-[min(320px,85vw)] rounded-2xl group-data-[side=top]:mb-3 bg-paper p-4 text-sm leading-relaxed shadow-xl">
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
            {/* The bubble tail points at the cat from whichever side the bubble is on. */}
            <span
              className="absolute h-3 w-3 rotate-45 bg-paper group-data-[side=top]:-bottom-1.5 group-data-[side=top]:left-1/2 group-data-[side=top]:-translate-x-1/2 group-data-[side=right]:-left-1.5 group-data-[side=right]:top-1/2 group-data-[side=right]:-translate-y-1/2 group-data-[side=left]:-right-1.5 group-data-[side=left]:top-1/2 group-data-[side=left]:-translate-y-1/2"
              aria-hidden
            />
          </div>
        )}
      </div>

      {/* Top bar: always lets people out. Above section overlays (z-30) so Back and Exit stay usable. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[35] flex flex-wrap items-center gap-2 p-3 sm:p-4 [&>*]:pointer-events-auto">
        <h1 className="mr-auto truncate rounded-full bg-paper/85 px-3 py-1.5 text-sm font-semibold backdrop-blur">
          {profile.name}
          <span className="hidden font-normal text-ink-soft sm:inline"> · {profile.headline}</span>
        </h1>
        {entered && (
          <button
            onClick={backToRoom}
            className={`rounded-full px-3 py-1.5 text-sm font-medium shadow ${zoomed ? "bg-paper" : "bg-paper/70 text-ink-soft"}`}
          >
            ← Back<span className="hidden sm:inline"> to room</span>
          </button>
        )}
        <button
          onClick={() => setSoundOn((s) => !s)}
          aria-pressed={soundOn}
          className="rounded-full bg-paper/85 px-3 py-1.5 text-sm backdrop-blur"
          title="Sound is only used for knocking and purring"
        >
          <span aria-hidden>{soundOn ? "🔊" : "🔈"}</span>
          <span className="sr-only sm:not-sr-only sm:ml-1">{soundOn ? "Sound on" : "Sound off"}</span>
        </button>
        <Link href="/quick" className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-paper shadow">
          Exit<span className="hidden sm:inline"> to quick view</span>
        </Link>
      </div>

      {/* Outside the door */}
      {!entered && (
        <div className="fixed inset-x-0 bottom-8 z-20 flex justify-center px-4">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-paper/90 px-6 py-4 text-center shadow-xl backdrop-blur">
            <p className="text-sm text-ink-soft">This is {first}&apos;s room. {catName} the cat is inside.</p>
            <button
              onClick={knock}
              disabled={knocking}
              autoFocus
              className="rounded-full bg-accent px-6 py-2.5 font-medium text-accent-ink shadow transition hover:brightness-110 disabled:opacity-70"
            >
              {knocking ? "Opening…" : "🚪 Knock to come in"}
            </button>
          </div>
        </div>
      )}

      {hoverLabel && !section && entered && (
        <p className="pointer-events-none fixed left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-ink/85 px-3 py-1 text-sm text-paper">{hoverLabel}</p>
      )}

      {/* Look-around pad: a mouse with arrows. Dragging the room does the same thing. */}
      {looking && !chatOpen && (
        <div className="fixed bottom-20 right-3 z-20 flex flex-row-reverse items-center gap-3 sm:bottom-6 sm:right-6">
          <div className="grid grid-cols-3 grid-rows-3 place-items-center rounded-2xl bg-paper/85 p-1 shadow-lg backdrop-blur" role="group" aria-label="Look around">
            <span />
            <PadButton label="Look up" onClick={() => turn(0, STEP.pitch)}>▲</PadButton>
            <span />
            <PadButton label="Look left" onClick={() => turn(STEP.yaw, 0)}>◀</PadButton>
            <svg aria-hidden width="22" height="30" viewBox="0 0 22 30" className="text-ink-soft">
              <rect x="1.5" y="1.5" width="19" height="27" rx="9.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M11 2v9" stroke="currentColor" strokeWidth="2" />
            </svg>
            <PadButton label="Look right" onClick={() => turn(-STEP.yaw, 0)}>▶</PadButton>
            <span />
            <PadButton label="Look down" onClick={() => turn(0, -STEP.pitch)}>▼</PadButton>
            <span />
          </div>
          {!hintSeen && (
            <p className="hidden max-w-44 rounded-xl bg-ink/85 px-3 py-2 text-xs leading-snug text-paper sm:block">
              Drag the room or use the arrows to look around. Click anything to open it.
            </p>
          )}
        </div>
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
      {entered && (
        <nav aria-label="Room sections" className="fixed inset-x-0 bottom-0 z-10 p-3 sm:p-4">
          <ul className="mx-auto flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-paper/85 p-1.5 shadow-lg backdrop-blur">
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
              <button onClick={() => (chatOpen ? closeChat() : openChat())} className="whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink">
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
      )}

      {section && <Overlay section={section} profile={profile} onClose={closeSection} />}
      {chatOpen && <Chat catName={catName} firstName={first} voice={v} onClose={closeChat} onReply={() => void brain.play("talk", 1.4, "sit")} />}
    </div>
  );
}

function PadButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-xs text-ink-soft hover:bg-paper-2 hover:text-ink"
    >
      {children}
    </button>
  );
}
