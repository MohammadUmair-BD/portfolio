"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { LOOK_LIMITS, OUTSIDE, OVERVIEW, STAND, type CameraView } from "@/lib/scene-layout";

/** Where the visitor is looking while standing inside. Mutated by drag and the arrow pad. */
export type Look = { yaw: number; pitch: number };

export type CameraMode = { kind: "outside" } | { kind: "look" } | { kind: "focus"; view: CameraView };

/** The close-ups were framed for a 16:10 screen with a 45° lens. */
const DESIGN_HALF_WIDTH = Math.tan(THREE.MathUtils.degToRad(22.5)) * 1.6;
export const fovFor = (aspect: number) => (aspect < 0.85 ? 75 : 58);

export function clampLook(look: Look) {
  look.yaw = THREE.MathUtils.clamp(look.yaw, -LOOK_LIMITS.yaw, LOOK_LIMITS.yaw);
  look.pitch = THREE.MathUtils.clamp(look.pitch, -LOOK_LIMITS.pitchDown, LOOK_LIMITS.pitchUp);
}

/** Pulls close-ups back on portrait screens so the object still fits. */
function fittedFocus(view: CameraView, aspect: number) {
  const target = new THREE.Vector3(...view.target);
  const pos = new THREE.Vector3(...view.position);
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(45 / 2)) * aspect;
  const k = Math.max(1, 0.65 * (DESIGN_HALF_WIDTH / halfWidth));
  pos.sub(target).multiplyScalar(k).add(target);
  return { pos, target };
}

/**
 * Glides the camera towards the current mode every frame. Moving from outside
 * to the standing spot passes straight through the open door.
 */
export function CameraRig({ mode, look: lookRef, reducedMotion }: { mode: CameraMode; look: React.RefObject<Look>; reducedMotion: boolean }) {
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  // Start wherever the first mode says, so a visitor who already came in this session is simply inside.
  const startInside = mode.kind !== "outside";
  const pos = useMemo(() => new THREE.Vector3(...(startInside ? OVERVIEW.position : OUTSIDE.position)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new THREE.Vector3(...(startInside ? OVERVIEW.target : OUTSIDE.target)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const want = useMemo(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3() }), []);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fovFor(aspect);
    cam.updateProjectionMatrix();
  }, [camera, aspect]);

  useFrame((_, dt) => {
    if (mode.kind === "outside") {
      want.pos.set(...OUTSIDE.position);
      want.target.set(...OUTSIDE.target);
    } else if (mode.kind === "look") {
      const look = lookRef.current;
      want.pos.set(...STAND);
      const dir = new THREE.Vector3(-Math.sin(look.yaw) * Math.cos(look.pitch), Math.sin(look.pitch), -Math.cos(look.yaw) * Math.cos(look.pitch));
      want.target.copy(want.pos).addScaledVector(dir, 5);
    } else {
      const f = fittedFocus(mode.view, aspect);
      want.pos.copy(f.pos);
      want.target.copy(f.target);
    }

    if (reducedMotion) {
      pos.copy(want.pos);
      target.copy(want.target);
    } else {
      // Slower when walking through the door, snappier when just turning the head.
      const moving = pos.distanceTo(want.pos) > 0.05;
      const rate = moving ? 2.2 : 7;
      pos.x = THREE.MathUtils.damp(pos.x, want.pos.x, rate, dt);
      pos.y = THREE.MathUtils.damp(pos.y, want.pos.y, rate, dt);
      pos.z = THREE.MathUtils.damp(pos.z, want.pos.z, rate, dt);
      target.x = THREE.MathUtils.damp(target.x, want.target.x, rate, dt);
      target.y = THREE.MathUtils.damp(target.y, want.target.y, rate, dt);
      target.z = THREE.MathUtils.damp(target.z, want.target.z, rate, dt);
    }
    camera.position.copy(pos);
    camera.lookAt(target);
  });

  return null;
}
