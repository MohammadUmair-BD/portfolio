"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { DESK_BOUNDS, DESK_TOP, LAYOUT, TAG_POSITIONS, type ObjectId } from "@/lib/scene-layout";
import type { CatBrain } from "./cat-brain";

type Props = {
  brain: CatBrain;
  /** DOM element of the speech bubble; positioned over the cat's head every frame. */
  bubbleEl: React.RefObject<HTMLDivElement | null>;
  /** Whether the cat may play right now (no tour step, no open section, etc.). */
  canPlay: () => boolean;
  /** DOM element holding the intro board text; stretched over the 3D board every frame. */
  boardEl: React.RefObject<HTMLDivElement | null>;
  showBoard: () => boolean;
  /** Section heading buttons, one per room object. */
  tagEls: React.RefObject<Partial<Record<ObjectId, HTMLButtonElement | null>>>;
  showTags: () => boolean;
};

const TAGS = (Object.entries(TAG_POSITIONS) as [ObjectId, [number, number, number]][]).map(([id, p]) => [id, new THREE.Vector3(...p)] as const);

const { center: BC, width: BW, height: BH } = LAYOUT.board;
const BOARD_CORNERS = [
  new THREE.Vector3(BC[0] - BW / 2, BC[1] + BH / 2, BC[2] + 0.04),
  new THREE.Vector3(BC[0] + BW / 2, BC[1] + BH / 2, BC[2] + 0.04),
  new THREE.Vector3(BC[0] - BW / 2, BC[1] - BH / 2, BC[2] + 0.04),
  new THREE.Vector3(BC[0] + BW / 2, BC[1] - BH / 2, BC[2] + 0.04),
];

const deskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DESK_TOP);

export function Behaviors({ brain, bubbleEl, canPlay, boardEl, showBoard, tagEls, showTags }: Props) {
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
      // Wide screens: beside the cat, so the intro board above stays readable.
      // Narrow screens: above the cat, where there is room.
      const wide = size.width >= 700;
      s.head.copy(brain.position).add(new THREE.Vector3(0, wide ? 0.42 : 0.7, 0)).project(camera);
      const behind = s.head.z > 1;
      const hx = (s.head.x * 0.5 + 0.5) * size.width;
      const hy = (-s.head.y * 0.5 + 0.5) * size.height;
      if (wide) {
        const side = hx + 380 > size.width ? "left" : "right";
        const x = side === "right" ? hx + 30 : hx - 30;
        const y = THREE.MathUtils.clamp(hy, 110, size.height - 130);
        el.dataset.side = side;
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(${side === "right" ? "0" : "-100%"}, -50%)`;
      } else {
        const x = THREE.MathUtils.clamp(hx, 150, size.width - 150);
        const y = THREE.MathUtils.clamp(hy, 110, size.height - 40);
        el.dataset.side = "top";
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      }
      el.style.visibility = behind ? "hidden" : "visible";
    }

    // 2. Intro board text: real HTML laid over the 3D board (readable, selectable, indexable).
    const board = boardEl.current;
    if (board) {
      const pts = BOARD_CORNERS.map((c) => s.head.copy(c).project(camera).clone());
      const visible = showBoard() && pts.every((p) => p.z < 1);
      board.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        const xs = pts.map((p) => (p.x * 0.5 + 0.5) * size.width);
        const ys = pts.map((p) => (-p.y * 0.5 + 0.5) * size.height);
        const left = Math.min(...xs), top = Math.min(...ys);
        const w = Math.max(...xs) - left, h = Math.max(...ys) - top;
        board.style.transform = `translate3d(${left}px, ${top}px, 0)`;
        board.style.width = `${w}px`;
        board.style.height = `${h}px`;
        board.style.fontSize = `${Math.max(6, h / 11)}px`;
      }
    }

    // 3. Section headings above each object.
    const tagsOn = showTags();
    for (const [id, pos] of TAGS) {
      const tag = tagEls.current[id];
      if (!tag) continue;
      s.hit.copy(pos).project(camera);
      const onScreen = tagsOn && s.hit.z < 1 && Math.abs(s.hit.x) < 1.1 && Math.abs(s.hit.y) < 1.1;
      tag.style.visibility = onScreen ? "visible" : "hidden";
      if (onScreen) {
        tag.style.transform = `translate3d(${(s.hit.x * 0.5 + 0.5) * size.width}px, ${(-s.hit.y * 0.5 + 0.5) * size.height}px, 0) translate(-50%, -100%)`;
      }
    }

    // 4. Laser-dot chase: a fast pointer near the cat on the desk.
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
