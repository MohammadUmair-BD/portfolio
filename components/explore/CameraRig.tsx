"use client";

import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { OVERVIEW, type CameraView } from "@/lib/scene-layout";

/** The views were framed for a 16:10 screen with a 45° lens. */
const DESIGN_HALF_WIDTH = Math.tan(THREE.MathUtils.degToRad(22.5)) * 1.6;
export const fovFor = (aspect: number) => (aspect < 0.85 ? 65 : 45);

/** Pulls the camera back on narrow or portrait screens so the same width of room stays in view. */
function fitted(view: CameraView, aspect: number, isOverview: boolean): { pos: THREE.Vector3; target: THREE.Vector3 } {
  const target = new THREE.Vector3(...view.target);
  const pos = new THREE.Vector3(...view.position);
  const halfWidth = Math.tan(THREE.MathUtils.degToRad(fovFor(aspect) / 2)) * aspect;
  const ratio = DESIGN_HALF_WIDTH / halfWidth;
  const k = Math.max(1, isOverview ? ratio : 0.65 * ratio);
  pos.sub(target).multiplyScalar(k).add(target);
  return { pos, target };
}

export function CameraRig({ view, reducedMotion }: { view: CameraView | null; reducedMotion: boolean }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new THREE.Vector3(...OVERVIEW.target), []);
  const base = useMemo(() => new THREE.Vector3(...OVERVIEW.position), []);
  const aspect = size.width / Math.max(1, size.height);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fovFor(aspect);
    cam.updateProjectionMatrix();
  }, [camera, aspect]);

  useEffect(() => {
    const { pos, target } = fitted(view ?? OVERVIEW, aspect, !view);
    gsap.killTweensOf([base, look]);
    if (reducedMotion) {
      base.copy(pos);
      look.copy(target);
      return;
    }
    const opts = { duration: 1.3, ease: "power3.inOut" };
    gsap.to(base, { x: pos.x, y: pos.y, z: pos.z, ...opts });
    gsap.to(look, { x: target.x, y: target.y, z: target.z, ...opts });
  }, [view, aspect, reducedMotion, base, look]);

  useFrame((state) => {
    // A little parallax in the overview so the room feels alive.
    const sway = !view && !reducedMotion ? 0.25 : 0;
    camera.position.set(base.x + state.pointer.x * sway, base.y + state.pointer.y * sway * 0.5, base.z);
    camera.lookAt(look);
  });

  return null;
}
