"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { ObjectId } from "@/lib/scene-layout";

type Props = {
  id: ObjectId;
  label: string;
  onSelect: (id: ObjectId) => void;
  onHover: (label: string | null) => void;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"group">, "id">;

const GLOW = new THREE.Color("#ffb37a");

/**
 * Wraps a room object: lifts and glows on hover, shows a label, opens its
 * section on click. Child meshes can set userData.label for a more specific
 * label (a book's skill, a frame's role).
 */
export function Interactive({ id, label, onSelect, onHover, children, ...group }: Props) {
  const ref = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((_, dt) => {
    inner.current.position.y = THREE.MathUtils.damp(inner.current.position.y, hovered ? 0.04 : 0, 12, dt);
    const glow = hovered ? 0.35 : 0;
    ref.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.emissive && !m.userData.keepEmissive) {
        m.emissive.copy(GLOW);
        m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, glow, 10, dt);
      }
    });
  });

  const labelFor = (e: ThreeEvent<PointerEvent>) => (e.object.userData.label as string | undefined) ?? label;

  return (
    <group
      ref={ref}
      {...group}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(labelFor(e));
        document.body.style.cursor = "pointer";
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover(labelFor(e));
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
    >
      <group ref={inner}>{children}</group>
    </group>
  );
}
