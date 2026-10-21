"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DESK_BOUNDS, DESK_TOP } from "@/lib/scene-layout";
import type { CatBrain } from "./cat-brain";

type Props = {
  brain: CatBrain;
  /** DOM element of the speech bubble; positioned over the cat's head every frame. */
  bubbleEl: React.RefObject<HTMLDivElement | null>;
  /** Whether the cat may play right now (no tour step, no open section, etc.). */
  canPlay: () => boolean;
};

const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DESK_TOP);

export function Behaviors({ brain, bubbleEl, canPlay }: Props) {
  const { camera, size, raycaster } = useThree();
  const dot = useRef<THREE.Mesh>(null!);
  const s = useMemo(
    () => ({ head: new THREE.Vector3(), hit: new THREE.Vector3(), lastPointer: new THREE.Vector2(), speed: 0, laserUntil: 0, cooldown: 0 }),
    [],
  );

  useFrame((state, dt) => {
    // 1. Speech bubble follows the cat's head on screen (works after resizes too).
    const el = bubbleEl.current;
    if (el) {
      s.head.copy(brain.position).add(new THREE.Vector3(0, 0.7, 0)).project(camera);
      const behind = s.head.z > 1;
      const x = THREE.MathUtils.clamp((s.head.x * 0.5 + 0.5) * size.width, 150, size.width - 150);
      const y = THREE.MathUtils.clamp((-s.head.y * 0.5 + 0.5) * size.height, 110, size.height - 40);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      el.style.visibility = behind ? "hidden" : "visible";
    }

    // 2. Laser-dot chase: a fast pointer near the cat on the desk.
    const t = state.clock.elapsedTime;
    const moved = s.lastPointer.distanceTo(state.pointer);
    s.lastPointer.copy(state.pointer);
    s.speed = THREE.MathUtils.lerp(s.speed, moved / Math.max(dt, 1e-3), 0.3);

    raycaster.setFromCamera(state.pointer, camera);
    const onDesk =
      raycaster.ray.intersectPlane(deskPlane, s.hit) !== null &&
      s.hit.x > DESK_BOUNDS.minX && s.hit.x < DESK_BOUNDS.maxX && s.hit.z > DESK_BOUNDS.minZ && s.hit.z < DESK_BOUNDS.maxZ;
    const catOnDesk = brain.position.y > DESK_TOP - 0.05;
    const near = s.hit.distanceTo(brain.position) < 1.6;

    if (onDesk && catOnDesk && near && s.speed > 2.2 && canPlay()) s.laserUntil = t + 0.8;
    const laser = t < s.laserUntil && onDesk;
    dot.current.visible = laser;
    if (laser) {
      dot.current.position.set(s.hit.x, DESK_TOP + 0.005, s.hit.z);
      if (t > s.cooldown && !brain.busy && brain.state !== "sleep") {
        s.cooldown = t + 1.1;
        brain.moveTo([s.hit.x, DESK_TOP, s.hit.z], "sit", { hop: true });
      }
    }
  });

  return (
    <mesh ref={dot} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <circleGeometry args={[0.03, 16]} />
      <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
    </mesh>
  );
}
