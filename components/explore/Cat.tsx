"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { CatBrain } from "./cat-brain";

const FUR = "#e39a5a";
const FUR_DARK = "#c97c3f";
const CREAM = "#f6dcbc";
const PINK = "#e79aa0";
const EYE = "#2a2320";

type Pose = {
  bodyY: number; bodyPitch: number; headPitch: number; headYaw: number;
  frontLeg: number; backLeg: number; legTuck: number; tailLift: number; tailCurl: number; eyeOpen: number;
};

const POSES: Record<string, Pose> = {
  stand: { bodyY: 0, bodyPitch: 0, headPitch: 0, headYaw: 0, frontLeg: 0, backLeg: 0, legTuck: 1, tailLift: 0.9, tailCurl: 0, eyeOpen: 1 },
  sit: { bodyY: -0.03, bodyPitch: -0.55, headPitch: 0.45, headYaw: 0, frontLeg: 0.55, backLeg: -1.25, legTuck: 1, tailLift: -0.2, tailCurl: 1.1, eyeOpen: 1 },
  sleep: { bodyY: -0.15, bodyPitch: 0, headPitch: 0.55, headYaw: 0.7, frontLeg: -1.45, backLeg: 1.45, legTuck: 0.45, tailLift: -0.6, tailCurl: 2.0, eyeOpen: 0.08 },
  stretch: { bodyY: -0.05, bodyPitch: 0.4, headPitch: -0.5, headYaw: 0, frontLeg: -1.15, backLeg: -0.4, legTuck: 1, tailLift: 1.3, tailCurl: 0, eyeOpen: 0.4 },
  crouch: { bodyY: -0.06, bodyPitch: 0.12, headPitch: -0.1, headYaw: 0, frontLeg: 0.2, backLeg: -0.35, legTuck: 0.85, tailLift: 0.4, tailCurl: 0, eyeOpen: 1 },
  air: { bodyY: 0.02, bodyPitch: -0.15, headPitch: 0.1, headYaw: 0, frontLeg: -0.9, backLeg: 0.9, legTuck: 1, tailLift: 0.3, tailCurl: 0, eyeOpen: 1 },
};

function damp(current: number, target: number, rate: number, dt: number) {
  return THREE.MathUtils.damp(current, target, rate, dt);
}

const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

type Props = { brain: CatBrain; onClick: () => void; onHover: (over: boolean) => void };

export function Cat({ brain, onClick, onHover }: Props) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group[]>([]);
  const legs = useRef<THREE.Group[]>([]); // FL, FR, BL, BR
  const eyes = useRef<THREE.Mesh[]>([]);
  const zzz = useRef<THREE.Group>(null!);
  const hearts = useRef<THREE.Group>(null!);
  const pose = useRef<Pose>({ ...POSES.sleep });
  const blink = useRef({ next: 2, closing: 0 });
  const materials = useRef<THREE.Material[]>([]);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  useEffect(() => {
    const list: THREE.Material[] = [];
    root.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) {
        m.transparent = true;
        list.push(m);
      }
    });
    materials.current = list;
  }, []);

  useFrame((state, frameDelta) => {
    const dt = Math.min(frameDelta, 0.05);
    const t = state.clock.elapsedTime;
    const since = performance.now() / 1000 - brain.stateSince;
    const p = pose.current;

    // Pick the target pose for the current state.
    let target = POSES.stand;
    switch (brain.state) {
      case "sleep": target = POSES.sleep; break;
      case "wake": target = since < 0.5 ? POSES.sleep : since < 1.6 ? POSES.stretch : POSES.stand; break;
      case "sit": case "talk": case "wave": case "swat": target = brain.state === "swat" ? POSES.stand : POSES.sit; break;
      case "jump": target = brain.jumpT <= 0 ? POSES.crouch : brain.jumpT >= 1 ? POSES.crouch : POSES.air; break;
    }
    const rate = brain.state === "jump" ? 18 : 6;
    for (const k of Object.keys(p) as (keyof Pose)[]) p[k] = damp(p[k], target[k], rate, dt);

    // Position and heading.
    root.current.position.copy(brain.position);
    if (brain.targetHeading !== null) brain.heading = angleLerp(brain.heading, brain.targetHeading, 1 - Math.exp(-8 * dt));
    root.current.rotation.y = brain.heading;

    // Breathing and purring.
    const breathe = Math.sin(t * (brain.state === "sleep" ? 1.6 : 2.6)) * (brain.state === "sleep" ? 0.012 : 0.006);
    body.current.position.y = p.bodyY + breathe;
    body.current.rotation.x = p.bodyPitch;
    body.current.scale.set(1 + breathe * 2, 1 + breathe * 2, 1);

    // Head: follow lookAt target if there is one (limited turn), plus talk bob.
    let yaw = p.headYaw;
    let pitch = p.headPitch;
    const lookAt = brain.lookAt ?? (["sit", "talk", "wave", "idle"].includes(brain.state) ? state.camera.position : null);
    if (lookAt && brain.state !== "sleep") {
      tmp.v.copy(lookAt);
      root.current.worldToLocal(tmp.v);
      yaw += THREE.MathUtils.clamp(Math.atan2(tmp.v.x, tmp.v.z), -0.9, 0.9);
      pitch += THREE.MathUtils.clamp(-Math.atan2(tmp.v.y - 0.4, Math.hypot(tmp.v.x, tmp.v.z)) * 0.6, -0.5, 0.4);
    }
    if (brain.state === "talk") pitch += Math.sin(t * 9) * 0.06;
    head.current.rotation.y = damp(head.current.rotation.y, yaw, 8, dt);
    head.current.rotation.x = damp(head.current.rotation.x, pitch, 8, dt);

    // Legs.
    const [fl, fr, bl, br] = legs.current;
    let swing = 0;
    if (brain.state === "walk") swing = Math.sin(brain.stride * 11) * 0.55;
    fl.rotation.x = p.frontLeg + swing;
    br.rotation.x = p.backLeg + swing;
    fr.rotation.x = p.frontLeg - swing;
    bl.rotation.x = p.backLeg - swing;
    if (brain.state === "wave") fr.rotation.x = -2.5 + Math.sin(t * 10) * 0.35;
    if (brain.state === "swat") fr.rotation.x = -1.2 + Math.sin(since * 14) * 0.9;
    fr.rotation.z = brain.state === "wave" ? -0.35 : 0;
    for (const leg of legs.current) leg.scale.y = p.legTuck;

    // Tail: three segments, each bending a bit more.
    const sway = Math.sin(t * (brain.state === "sleep" ? 0.8 : 2.2)) * (brain.state === "sleep" ? 0.08 : 0.35);
    tail.current.forEach((seg, i) => {
      seg.rotation.x = i === 0 ? -p.tailLift : 0.25 + p.tailCurl * 0.15;
      seg.rotation.y = sway * (i + 1) * 0.6 + p.tailCurl * 0.45;
    });

    // Eyes and blinking.
    const b = blink.current;
    if (t > b.next) {
      b.closing = 0.15;
      b.next = t + 2.5 + Math.random() * 4;
    }
    b.closing = Math.max(0, b.closing - dt);
    // Purring: happy, half-closed eyes instead of any shaking.
    const open = b.closing > 0 && brain.state !== "sleep" ? 0.1 : brain.purring ? Math.min(p.eyeOpen, 0.35) : p.eyeOpen;
    for (const e of eyes.current) e.scale.y = damp(e.scale.y, open, 25, dt);

    // Little extras.
    zzz.current.visible = brain.state === "sleep";
    if (zzz.current.visible) {
      zzz.current.children.forEach((z, i) => {
        const k = (t * 0.5 + i / 3) % 1;
        z.position.set(0.1 + k * 0.15, 0.4 + k * 0.35, 0.15);
        z.scale.setScalar(0.4 + k * 0.6);
        ((z as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * brain.opacity;
      });
    }
    hearts.current.visible = brain.purring;
    if (brain.purring) {
      const k = (t * 0.6) % 1; // hearts drift up and fade, then start again
      hearts.current.position.y = 0.55 + k * 0.25;
      hearts.current.children.forEach((h) => (((h as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * brain.opacity));
    }

    for (const m of materials.current) m.opacity = brain.opacity;
    root.current.visible = brain.opacity > 0.01;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(true);
  };

  return (
    <group
      ref={root}
      onPointerOver={over}
      onPointerOut={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6) return; // the end of a drag, not a click
        onClick();
      }}
    >
      {/* Invisible, larger hit box so the cat is easy to click and tap. */}
      <mesh position={[0, 0.25, 0]} visible={false}>
        <boxGeometry args={[0.45, 0.55, 0.7]} />
      </mesh>

      <group ref={body}>
        <mesh position={[0, 0.22, 0]} scale={[0.16, 0.14, 0.27]} castShadow>
          <sphereGeometry args={[1, 20, 16]} />
          <meshStandardMaterial color={FUR} roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.17, 0.05]} scale={[0.12, 0.09, 0.2]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color={CREAM} roughness={0.9} />
        </mesh>

        {/* Head */}
        <group ref={head} position={[0, 0.33, 0.24]}>
          <mesh castShadow>
            <sphereGeometry args={[0.13, 20, 16]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.035, 0.09]} scale={[0.07, 0.05, 0.05]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial color={CREAM} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.01, 0.135]}>
            <sphereGeometry args={[0.014, 8, 6]} />
            <meshStandardMaterial color={PINK} />
          </mesh>
          {[-1, 1].map((s, i) => (
            <group key={s}>
              <mesh position={[s * 0.075, 0.1, -0.01]} rotation={[0, 0, s * -0.35]} castShadow>
                <coneGeometry args={[0.05, 0.1, 4]} />
                <meshStandardMaterial color={FUR_DARK} roughness={0.85} />
              </mesh>
              <mesh position={[s * 0.074, 0.095, 0.005]} rotation={[0, 0, s * -0.35]} scale={0.55}>
                <coneGeometry args={[0.05, 0.1, 4]} />
                <meshStandardMaterial color={PINK} />
              </mesh>
              <mesh ref={(m) => { if (m) eyes.current[i] = m; }} position={[s * 0.048, 0.025, 0.112]}>
                <sphereGeometry args={[0.02, 10, 8]} />
                <meshStandardMaterial color={EYE} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>

        {/* Legs: pivot at the hip, mesh hangs down. FL, FR, BL, BR. */}
        {[
          [-0.08, 0.17, 0.15],
          [0.08, 0.17, 0.15],
          [-0.08, 0.17, -0.15],
          [0.08, 0.17, -0.15],
        ].map((pos, i) => (
          <group key={i} ref={(g) => { if (g) legs.current[i] = g; }} position={pos as [number, number, number]}>
            <mesh position={[0, -0.08, 0]} castShadow>
              <cylinderGeometry args={[0.032, 0.028, 0.16, 8]} />
              <meshStandardMaterial color={FUR} roughness={0.85} />
            </mesh>
            <mesh position={[0, -0.16, 0.01]} scale={[1, 0.7, 1.2]}>
              <sphereGeometry args={[0.035, 10, 8]} />
              <meshStandardMaterial color={CREAM} roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* Tail: nested segments so each one bends from the end of the last. */}
        <group ref={(g) => { if (g) tail.current[0] = g; }} position={[0, 0.27, -0.25]}>
          <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.028, 0.03, 0.17, 8]} />
            <meshStandardMaterial color={FUR_DARK} roughness={0.85} />
          </mesh>
          <group ref={(g) => { if (g) tail.current[1] = g; }} position={[0, 0, -0.16]}>
            <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.028, 0.17, 8]} />
              <meshStandardMaterial color={FUR} roughness={0.85} />
            </mesh>
            <group ref={(g) => { if (g) tail.current[2] = g; }} position={[0, 0, -0.16]}>
              <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.018, 0.025, 0.15, 8]} />
                <meshStandardMaterial color={FUR_DARK} roughness={0.85} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* Sleeping "z"s and purring hearts. */}
      <group ref={zzz}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <torusGeometry args={[0.025, 0.008, 6, 4]} />
            <meshBasicMaterial color="#8fa9c9" transparent />
          </mesh>
        ))}
      </group>
      <group ref={hearts} position={[0, 0.62, 0.15]} visible={false}>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, Math.abs(x) * 0.5, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.035, 0.035, 0.01]} />
            <meshBasicMaterial color="#e36b7a" transparent />
          </mesh>
        ))}
      </group>
    </group>
  );
}
