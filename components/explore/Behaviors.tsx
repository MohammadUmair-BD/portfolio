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

/** The board text is laid out at this fixed size, then warped onto the board. */
const BOARD_PX = { w: 500, h: Math.round((500 * BH) / BW) };

/**
 * CSS matrix3d that maps a w×h box onto a screen quad (top-left, top-right,
 * bottom-left, bottom-right), i.e. the perspective homography between them.
 */
function rectToQuad(w: number, h: number, quad: readonly (readonly [number, number])[]): string {
  const src = [[0, 0], [w, 0], [0, h], [w, h]];
  const A: number[][] = [];
  const b: number[] = [];
  src.forEach(([x, y], i) => {
    const [X, Y] = quad[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  });
  // Solve the 8×8 system with Gaussian elimination (partial pivoting).
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const [a, bb, c, d, e, f, g, hh] = b.map((v, i) => v / A[i][i]);
  return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
}

const deskPlane =new THREE.Plane(new THREE.Vector3(0, 1, 0), -DESK_TOP);

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
      // The bubble belongs to Miso: if he is off screen, it hides rather than sliding along the edge.
      const catOnScreen = !behind && hx >= 0 && hx <= size.width && hy >= 0 && hy <= size.height;
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
      el.style.visibility = catOnScreen ? "visible" : "hidden";
    }

    // 2. Intro board text: real HTML (readable, selectable, indexable), warped onto
    //    the board's four projected corners so it stays glued to it from any angle.
    const board = boardEl.current;
    if (board) {
      const pts = BOARD_CORNERS.map((c) => s.head.copy(c).project(camera).clone());
      const visible = showBoard() && pts.every((p) => p.z < 1);
      board.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        const screen = pts.map((p) => [(p.x * 0.5 + 0.5) * size.width, (-p.y * 0.5 + 0.5) * size.height] as const);
        board.style.width = `${BOARD_PX.w}px`;
        board.style.height = `${BOARD_PX.h}px`;
        board.style.fontSize = `${BOARD_PX.h / 11}px`;
        board.style.transformOrigin = "0 0";
        board.style.transform = rectToQuad(BOARD_PX.w, BOARD_PX.h, screen);
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
