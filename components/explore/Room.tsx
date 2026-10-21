"use client";

import { forwardRef, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type * as THREE from "three";
import { CATEGORY_LABELS, formatRange, type Profile, type SkillCategory } from "@/lib/profile-shared";
import { DESK, DESK_TOP, LAYOUT, type ObjectId } from "@/lib/scene-layout";
import { Interactive } from "./Interactive";

const C = {
  wall: "#f0e2cf",
  wallSide: "#e8d6c0",
  floor: "#c99a6b",
  floorLine: "#b88a5c",
  trim: "#fff6ea",
  wood: "#8a5a3b",
  woodLight: "#a8774f",
  rug: "#c77a58",
  rugInner: "#e7b48a",
  metal: "#3b3633",
  screen: "#1d2b3a",
  paper: "#fffdf8",
};

const BOOK_COLORS: Record<SkillCategory, string[]> = {
  backend: ["#c8643b", "#b4532f", "#d9774b"],
  frontend: ["#6f8f72", "#5f7f63", "#86a589"],
  database: ["#4f7cac", "#41698f", "#6890bd"],
  tools: ["#d9a441", "#c48f30", "#e5b65c"],
  other: ["#8d6cab", "#7a5a97", "#a283bd"],
  familiar: ["#b9aea3", "#a89c90", "#cbc1b6"],
};

type Box = { args: [number, number, number]; position: [number, number, number]; color: string; label?: string; cast?: boolean };
const Block = ({ args, position, color, label, cast = true }: Box) => (
  <mesh position={position} castShadow={cast} receiveShadow userData={label ? { label } : undefined}>
    <boxGeometry args={args} />
    <meshStandardMaterial color={color} roughness={0.8} />
  </mesh>
);

type RoomProps = {
  profile: Profile;
  onSelect: (id: ObjectId) => void;
  onHover: (label: string | null) => void;
};

export function Room({ profile, onSelect, onHover, penRef, doorRef, doorStartsOpen, onDoor }: RoomProps & {
  penRef: React.Ref<THREE.Group>;
  doorRef: React.Ref<THREE.Group>;
  /** True when the visitor already came in this session: the door is simply open. */
  doorStartsOpen: boolean;
  onDoor: () => void;
}) {
  const i = { onSelect, onHover };
  return (
    <group>
      <Shell />
      <FrontWallAndDoor doorRef={doorRef} startsOpen={doorStartsOpen} onDoor={onDoor} />
      <IntroBoard />
      <CeilingLight />
      <Desk />
      <Interactive id="monitor" label="Projects · the monitor" position={LAYOUT.monitor} {...i}>
        <Monitor />
      </Interactive>
      <Interactive id="resume" label="Resume · download it" position={LAYOUT.resume} rotation={[0, 0.2, 0]} {...i}>
        <Block args={[0.42, 0.012, 0.56]} position={[0, 0.006, 0]} color={C.paper} />
        {[0.18, 0.12, 0.06, 0, -0.06, -0.12].map((z, n) => (
          <Block key={z} args={[n === 0 ? 0.22 : 0.32, 0.002, 0.018]} position={[n === 0 ? -0.05 : 0, 0.013, z]} color={n === 0 ? "#c8643b" : "#c9bfb3"} cast={false} />
        ))}
      </Interactive>
      <Pen ref={penRef} />
      <Bookshelf profile={profile} {...i} />
      <Certificates profile={profile} {...i} />
      <WindowView {...i} />
      <Interactive id="phone" label="Contact · the phone" position={LAYOUT.sideTable} {...i}>
        <SideTableWithPhone />
      </Interactive>
      <Decor />
    </group>
  );
}

function Shell() {
  const { halfWidth, backZ, frontZ, height } = LAYOUT.room;
  const depth = frontZ - backZ;
  const [wx, wy] = [LAYOUT.window[0], LAYOUT.window[1]];
  const [ww, wh] = [1.8, 1.4];
  return (
    <group>
      {/* Floor with plank lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (backZ + frontZ) / 2]} receiveShadow>
        <planeGeometry args={[halfWidth * 2, depth]} />
        <meshStandardMaterial color={C.floor} roughness={0.9} />
      </mesh>
      {Array.from({ length: 10 }, (_, n) => (
        <mesh key={n} rotation={[-Math.PI / 2, 0, 0]} position={[-halfWidth + 0.55 + n * 1.1, 0.002, (backZ + frontZ) / 2]}>
          <planeGeometry args={[0.015, depth]} />
          <meshStandardMaterial color={C.floorLine} />
        </mesh>
      ))}

      {/* Left wall */}
      <Block args={[0.1, height, depth]} position={[-halfWidth - 0.05, height / 2, (backZ + frontZ) / 2]} color={C.wallSide} cast={false} />
      <Block args={[0.04, 0.12, depth]} position={[-halfWidth + 0.02, 0.06, (backZ + frontZ) / 2]} color={C.trim} cast={false} />

      {/* Right wall */}
      <Block args={[0.1, height, depth]} position={[halfWidth + 0.05, height / 2, (backZ + frontZ) / 2]} color={C.wallSide} cast={false} />
      <Block args={[0.04, 0.12, depth]} position={[halfWidth - 0.02, 0.06, (backZ + frontZ) / 2]} color={C.trim} cast={false} />

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, (backZ + frontZ) / 2]}>
        <planeGeometry args={[halfWidth * 2, depth]} />
        <meshStandardMaterial color="#fbf4ea" emissive="#6d5c4a" emissiveIntensity={0.55} roughness={1} />
      </mesh>

      {/* Back wall, built around the window opening */}
      <Block args={[wx - ww / 2 + halfWidth, height, 0.1]} position={[(-halfWidth + wx - ww / 2) / 2, height / 2, backZ - 0.05]} color={C.wall} cast={false} />
      <Block args={[halfWidth - wx - ww / 2, height, 0.1]} position={[(wx + ww / 2 + halfWidth) / 2, height / 2, backZ - 0.05]} color={C.wall} cast={false} />
      <Block args={[ww, wy - wh / 2, 0.1]} position={[wx, (wy - wh / 2) / 2, backZ - 0.05]} color={C.wall} cast={false} />
      <Block args={[ww, height - wy - wh / 2, 0.1]} position={[wx, (height + wy + wh / 2) / 2, backZ - 0.05]} color={C.wall} cast={false} />
      <Block args={[halfWidth * 2, 0.12, 0.04]} position={[0, 0.06, backZ + 0.02]} color={C.trim} cast={false} />

      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={LAYOUT.rug} receiveShadow>
        <circleGeometry args={[1.9, 48]} />
        <meshStandardMaterial color={C.rug} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[LAYOUT.rug[0], 0.008, LAYOUT.rug[2]]}>
        <ringGeometry args={[1.35, 1.5, 48]} />
        <meshStandardMaterial color={C.rugInner} roughness={1} />
      </mesh>
    </group>
  );
}

function Desk() {
  const [x, , z] = DESK.center;
  const { width: w, depth: d, height: h } = DESK;
  return (
    <group>
      <Block args={[w, 0.08, d]} position={[x, h, z]} color={C.woodLight} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <Block key={`${sx}${sz}`} args={[0.08, h, 0.08]} position={[x + sx * (w / 2 - 0.1), h / 2, z + sz * (d / 2 - 0.1)]} color={C.wood} />
      ))}
      <Block args={[0.9, 0.3, d - 0.2]} position={[x + w / 2 - 0.55, h - 0.2, z]} color={C.wood} />
      {/* Keyboard (the cat's favourite bed) */}
      <Block args={[0.85, 0.035, 0.28]} position={[LAYOUT.keyboard[0], DESK_TOP + 0.017, LAYOUT.keyboard[2]]} color="#4a4440" />
      <Block args={[0.8, 0.01, 0.24]} position={[LAYOUT.keyboard[0], DESK_TOP + 0.04, LAYOUT.keyboard[2]]} color="#d8d0c6" cast={false} />
      {/* Chair */}
      <group position={LAYOUT.chair} rotation={[0, 0.5, 0]}>
        <Block args={[0.6, 0.08, 0.55]} position={[0, 0.55, 0]} color="#5d6b5f" />
        <Block args={[0.6, 0.6, 0.07]} position={[0, 0.9, 0.27]} color="#5d6b5f" />
        <Block args={[0.06, 0.5, 0.06]} position={[0, 0.28, 0]} color={C.metal} />
        <Block args={[0.5, 0.04, 0.5]} position={[0, 0.03, 0]} color={C.metal} />
      </group>
    </group>
  );
}

function Monitor() {
  return (
    <group>
      <Block args={[0.32, 0.02, 0.22]} position={[0, 0.01, 0.05]} color={C.metal} />
      <Block args={[0.06, 0.3, 0.05]} position={[0, 0.16, 0]} color={C.metal} />
      <Block args={[1.36, 0.84, 0.06]} position={[0, 0.62, 0.02]} color={C.metal} />
      <mesh position={[0, 0.62, 0.052]}>
        <planeGeometry args={[1.26, 0.74]} />
        <meshStandardMaterial color={C.screen} emissive="#2b4a66" emissiveIntensity={0.6} userData={{ keepEmissive: true }} />
      </mesh>
      {/* "Code" on the screen: just coloured bars, the real content is HTML. */}
      {[
        [0.42, "#e6a26b", -0.3], [0.6, "#8fc29a", -0.21], [0.36, "#7fb0e0", -0.12], [0.7, "#e6a26b", -0.03],
        [0.5, "#c9b8f0", 0.06], [0.28, "#8fc29a", 0.15], [0.56, "#7fb0e0", 0.24],
      ].map(([w, c, y], n) => (
        <mesh key={n} position={[-0.52 + (w as number) / 2 + (n % 3) * 0.05, 0.62 - (y as number), 0.054]}>
          <planeGeometry args={[w as number, 0.035]} />
          <meshBasicMaterial color={c as string} />
        </mesh>
      ))}
    </group>
  );
}

export const Pen = forwardRef<THREE.Group>(function Pen(_, ref) {
  return (
    <group ref={ref} position={LAYOUT.pen} rotation={[0, 0.6, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.22, 8]} />
        <meshStandardMaterial color="#2f5d9e" />
      </mesh>
      <mesh position={[0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.012, 0.03, 8]} />
        <meshStandardMaterial color="#e8dccb" />
      </mesh>
    </group>
  );
});

const SHELF_HEIGHTS = [0.12, 0.7, 1.28, 1.86];

function Bookshelf({ profile, ...i }: { profile: Profile } & Pick<RoomProps, "onSelect" | "onHover">) {
  const [x, , z] = LAYOUT.bookshelf;
  const width = 2.2;
  const shelves = SHELF_HEIGHTS;
  const books = useMemo(() => {
    const shelves = SHELF_HEIGHTS;
    const order: SkillCategory[] = ["backend", "database", "frontend", "tools", "other", "familiar"];
    const sorted = order.flatMap((c) => profile.skills.filter((s) => s.category === c));
    const perShelf = Math.ceil(sorted.length / shelves.length);
    return sorted.map((s, n) => {
      const shelf = Math.floor(n / perShelf);
      const slot = n % perShelf;
      const h = 0.3 + ((n * 37) % 7) * 0.02;
      const palette = BOOK_COLORS[s.category];
      return {
        key: s.name,
        label: `${s.name} · ${CATEGORY_LABELS[s.category]}`,
        color: palette[n % palette.length],
        h,
        y: shelves[shelf] + 0.03 + h / 2,
        z: z - width / 2 + 0.18 + slot * ((width - 0.3) / perShelf),
        tilt: slot === perShelf - 1 ? 0.12 : 0,
      };
    });
  }, [profile.skills, z]);

  return (
    <Interactive id="bookshelf" label="Skills · the bookshelf" {...i}>
      <Block args={[0.5, 2.5, 0.06]} position={[x, 1.25, z - width / 2]} color={C.wood} />
      <Block args={[0.5, 2.5, 0.06]} position={[x, 1.25, z + width / 2]} color={C.wood} />
      <Block args={[0.04, 2.5, width]} position={[x - 0.23, 1.25, z]} color={C.wood} />
      {[...shelves, 2.47].map((y) => (
        <Block key={y} args={[0.5, 0.05, width]} position={[x, y, z]} color={C.woodLight} />
      ))}
      {books.map((b) => (
        <mesh key={b.key} position={[x + 0.02, b.y, b.z]} rotation={[b.tilt, 0, 0]} castShadow userData={{ label: b.label }}>
          <boxGeometry args={[0.36, b.h, 0.075]} />
          <meshStandardMaterial color={b.color} roughness={0.75} />
        </mesh>
      ))}
    </Interactive>
  );
}

function Certificates({ profile, ...i }: { profile: Profile } & Pick<RoomProps, "onSelect" | "onHover">) {
  const items = [
    ...profile.experience.map((e) => `${e.role} · ${e.company} (${formatRange(e.start, e.end)})`),
    ...profile.education.map((e) => `${e.degree} · ${e.institution}`),
    ...profile.certifications.map((c) => `${c.name} certificate · ${c.issuer}`),
  ];
  const cols = 3;
  const [cx, cy, cz] = LAYOUT.certificates;
  const rows = Math.ceil(items.length / cols);
  return (
    <Interactive id="certificates" label="Experience · the wall of frames" {...i}>
      {items.map((label, n) => {
        const col = n % cols;
        const row = Math.floor(n / cols);
        const x = cx + (col - (cols - 1) / 2) * 0.78;
        const y = cy + ((rows - 1) / 2 - row) * 0.62;
        return (
          <group key={label} position={[x, y, cz]}>
            <mesh castShadow userData={{ label }}>
              <boxGeometry args={[0.62, 0.48, 0.04]} />
              <meshStandardMaterial color={n < profile.experience.length ? C.wood : "#2f2a27"} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.022]} userData={{ label }}>
              <planeGeometry args={[0.52, 0.38]} />
              <meshStandardMaterial color={C.paper} />
            </mesh>
            <mesh position={[0, 0.09, 0.024]} userData={{ label }}>
              <planeGeometry args={[0.3, 0.035]} />
              <meshBasicMaterial color="#c8643b" />
            </mesh>
            {[0.02, -0.04, -0.1].map((ly) => (
              <mesh key={ly} position={[0, ly, 0.024]} userData={{ label }}>
                <planeGeometry args={[0.38, 0.015]} />
                <meshBasicMaterial color="#cfc5b8" />
              </mesh>
            ))}
          </group>
        );
      })}
    </Interactive>
  );
}

function skyFor(hour: number) {
  if (hour >= 6 && hour < 17) return { sky: "#a9d4ec", sun: "#fff1b8", hills: "#8fb27f", far: "#b8cfa8", night: false };
  if (hour >= 17 && hour < 20) return { sky: "#f2a978", sun: "#ffd18a", hills: "#7a8f6a", far: "#c99a86", night: false };
  return { sky: "#1f2b4a", sun: "#f3efd8", hills: "#2f3d3a", far: "#3a4a5a", night: true };
}

function WindowView(i: Pick<RoomProps, "onSelect" | "onHover">) {
  const [x, y, z] = LAYOUT.window;
  const look = useMemo(() => skyFor(new Date().getHours()), []);
  return (
    <Interactive id="window" label="About me · the window" {...i}>
      {/* Outside */}
      <mesh position={[x, y, z - 1.2]}>
        <planeGeometry args={[4, 3]} />
        <meshBasicMaterial color={look.sky} />
      </mesh>
      <mesh position={[x + 0.45, y + 0.35, z - 1.1]}>
        <circleGeometry args={[look.night ? 0.12 : 0.18, 24]} />
        <meshBasicMaterial color={look.sun} />
      </mesh>
      <mesh position={[x - 0.6, y - 0.75, z - 1.0]} scale={[1.6, 0.6, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color={look.far} />
      </mesh>
      <mesh position={[x + 0.5, y - 0.85, z - 0.9]} scale={[1.5, 0.55, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color={look.hills} />
      </mesh>
      {/* Frame, cross bars and sill */}
      <Block args={[1.9, 0.08, 0.14]} position={[x, y + 0.72, z + 0.02]} color={C.trim} />
      <Block args={[1.9, 0.08, 0.14]} position={[x, y - 0.72, z + 0.02]} color={C.trim} />
      <Block args={[0.08, 1.5, 0.14]} position={[x - 0.92, y, z + 0.02]} color={C.trim} />
      <Block args={[0.08, 1.5, 0.14]} position={[x + 0.92, y, z + 0.02]} color={C.trim} />
      <Block args={[0.04, 1.4, 0.04]} position={[x, y, z]} color={C.trim} />
      <Block args={[1.8, 0.04, 0.04]} position={[x, y, z]} color={C.trim} />
      <Block args={[2.1, 0.06, 0.42]} position={[x, LAYOUT.windowSill[1] - 0.03, z + 0.18]} color={C.trim} />
      {/* A small plant on the sill */}
      <Block args={[0.16, 0.16, 0.16]} position={[x + 0.6, LAYOUT.windowSill[1] + 0.08, z + 0.2]} color="#c8643b" />
      <mesh position={[x + 0.6, LAYOUT.windowSill[1] + 0.26, z + 0.2]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial color="#6f8f72" roughness={0.9} />
      </mesh>
    </Interactive>
  );
}

function SideTableWithPhone() {
  const top = LAYOUT.sideTableTop;
  return (
    <group>
      <Block args={[0.8, 0.06, 0.8]} position={[0, top - 0.03, 0]} color={C.woodLight} />
      <Block args={[0.08, top - 0.06, 0.08]} position={[0, (top - 0.06) / 2, 0]} color={C.wood} />
      <Block args={[0.5, 0.04, 0.5]} position={[0, 0.02, 0]} color={C.wood} />
      {/* Retro phone */}
      <group position={[0.1, top, -0.1]} rotation={[0, -0.5, 0]}>
        <Block args={[0.34, 0.12, 0.26]} position={[0, 0.06, 0]} color="#c8643b" />
        <mesh position={[0, 0.125, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.07, 20]} />
          <meshStandardMaterial color="#f3e6d3" />
        </mesh>
        <group position={[0, 0.17, -0.07]}>
          <Block args={[0.36, 0.05, 0.07]} position={[0, 0, 0]} color="#b4532f" />
          <Block args={[0.07, 0.07, 0.09]} position={[-0.16, -0.03, 0]} color="#b4532f" />
          <Block args={[0.07, 0.07, 0.09]} position={[0.16, -0.03, 0]} color="#b4532f" />
        </group>
      </group>
    </group>
  );
}

function Decor() {
  const [px, , pz] = LAYOUT.plant;
  return (
    <group>
      {/* Desk lamp */}
      <group position={LAYOUT.lamp}>
        <Block args={[0.2, 0.03, 0.2]} position={[0, 0.015, 0]} color={C.metal} />
        <Block args={[0.03, 0.5, 0.03]} position={[0, 0.27, 0]} color={C.metal} />
        <mesh position={[0.06, 0.52, 0.06]} rotation={[0.6, 0, -0.3]} castShadow>
          <coneGeometry args={[0.12, 0.16, 16, 1, true]} />
          <meshStandardMaterial color="#e6b24f" side={2} />
        </mesh>
        <pointLight position={[0.08, 0.42, 0.12]} intensity={1.6} distance={2.6} color="#ffcf8a" />
      </group>
      {/* Mug */}
      <group position={LAYOUT.mug}>
        <mesh position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.055, 0.14, 16]} />
          <meshStandardMaterial color="#6f8f72" />
        </mesh>
        <mesh position={[0.07, 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.03, 0.01, 6, 12]} />
          <meshStandardMaterial color="#6f8f72" />
        </mesh>
      </group>
      {/* Floor plant */}
      <group position={[px, 0, pz]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.18, 0.5, 16]} />
          <meshStandardMaterial color="#d9cbb8" />
        </mesh>
        {[[0, 0.85, 0, 0.36], [0.2, 1.1, 0.1, 0.26], [-0.18, 1.05, -0.08, 0.28]].map(([x, y, zz, r], n) => (
          <mesh key={n} position={[x, y, zz]} castShadow>
            <sphereGeometry args={[r, 14, 12]} />
            <meshStandardMaterial color={n === 1 ? "#86a589" : "#6f8f72"} roughness={0.9} />
          </mesh>
        ))}
        <Block args={[0.04, 0.5, 0.04]} position={[0, 0.6, 0]} color="#5f7f63" />
      </group>
    </group>
  );
}

/** Paints the little "Welcome" plaque that hangs on the door. */
function useWelcomeTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 200;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#f3e2c7";
    g.beginPath();
    g.roundRect(8, 8, 496, 184, 36);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "#8a5a3b";
    g.stroke();
    g.fillStyle = "#6b3f24";
    g.font = "italic 600 104px Georgia, 'Times New Roman', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("Welcome", 256, 108);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

function FrontWallAndDoor({ doorRef, startsOpen, onDoor }: { doorRef: React.Ref<THREE.Group>; startsOpen: boolean; onDoor: () => void }) {
  const { frontZ, height } = LAYOUT.room;
  const { x, width: dw, height: dh } = LAYOUT.door;
  const welcome = useWelcomeTexture();
  const left = x - dw / 2;
  const right = x + dw / 2;

  // One wall layer with a door-shaped hole, as three blocks around the opening.
  const layer = (z: number, w: number, h: number, color: string, thick: number) => (
    <group>
      <Block args={[left + w / 2, h, thick]} position={[(-w / 2 + left) / 2, h / 2, z]} color={color} cast={false} />
      <Block args={[w / 2 - right, h, thick]} position={[(right + w / 2) / 2, h / 2, z]} color={color} cast={false} />
      <Block args={[dw, h - dh, thick]} position={[x, (h + dh) / 2, z]} color={color} cast={false} />
    </group>
  );

  return (
    <group>
      {/* Inside face of the front wall, and the hallway face outside. */}
      {layer(frontZ - 0.03, LAYOUT.room.halfWidth * 2, height, C.wall, 0.06)}
      {layer(frontZ + 0.09, 18, 8, "#3f5552", 0.06)}
      {/* Door frame */}
      {[left - 0.06, right + 0.06].map((px) => (
        <Block key={px} args={[0.12, dh + 0.1, 0.24]} position={[px, (dh + 0.1) / 2, frontZ + 0.03]} color={C.trim} />
      ))}
      <Block args={[dw + 0.24, 0.12, 0.24]} position={[x, dh + 0.06, frontZ + 0.03]} color={C.trim} />

      {/* The door, hinged on its left edge so it swings into the room. */}
      <group
        ref={doorRef}
        position={[left, 0, frontZ + 0.03]}
        rotation={[0, startsOpen ? 1.65 : 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onDoor();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <Block args={[dw, dh, 0.07]} position={[dw / 2, dh / 2, 0]} color="#a85a33" />
        {[0.55, 1.6].map((py) => (
          <Block key={py} args={[dw - 0.3, 0.75, 0.02]} position={[dw / 2, py, 0.045]} color="#97502c" cast={false} />
        ))}
        {[-0.045, 0.045].map((pz) => (
          <mesh key={pz} position={[dw - 0.12, 1.05, pz * 1.6]} castShadow>
            <sphereGeometry args={[0.045, 16, 12]} />
            <meshStandardMaterial color="#d8b25a" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
        {/* "Welcome" plaque on a little string */}
        <mesh position={[dw / 2, 1.62, 0.07]}>
          <planeGeometry args={[0.62, 0.24]} />
          <meshStandardMaterial map={welcome} roughness={0.8} />
        </mesh>
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[dw / 2 + sx * 0.12, 1.83, 0.066]} rotation={[0, 0, sx * 0.9]}>
            <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
            <meshStandardMaterial color="#5a4030" />
          </mesh>
        ))}
      </group>

      {/* Hallway outside: floor, doormat and a warm wall light. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, frontZ + 3.2]} receiveShadow>
        <planeGeometry args={[18, 6.2]} />
        <meshStandardMaterial color="#6e5240" roughness={0.9} />
      </mesh>
      <Block args={[1.2, 0.02, 0.6]} position={[x, 0.01, frontZ + 0.55]} color="#b5533a" cast={false} />
      <Block args={[0.18, 0.26, 0.1]} position={[right + 0.45, 2.25, frontZ + 0.17]} color="#e8c27a" cast={false} />
      <pointLight position={[right + 0.45, 2.1, frontZ + 0.6]} intensity={2.2} distance={6} color="#ffd59a" />
    </group>
  );
}

function IntroBoard() {
  const { center, width, height } = LAYOUT.board;
  return (
    <group position={center}>
      <Block args={[width + 0.14, height + 0.14, 0.05]} position={[0, 0, 0]} color={C.wood} cast={false} />
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#2f4a3f" roughness={0.95} />
      </mesh>
      <Block args={[width * 0.6, 0.04, 0.08]} position={[0, -height / 2 - 0.08, 0.04]} color={C.woodLight} cast={false} />
    </group>
  );
}

function CeilingLight() {
  const h = LAYOUT.room.height;
  return (
    <group position={[0.2, 0.1, -2.2]}>
      <mesh position={[0, h - 0.3, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.6, 4]} />
        <meshStandardMaterial color="#3b3633" />
      </mesh>
      <mesh position={[0, h - 0.65, 0]}>
        <coneGeometry args={[0.32, 0.28, 24, 1, true]} />
        <meshStandardMaterial color="#e6b24f" side={2} />
      </mesh>
      <pointLight position={[0, h - 0.85, 0]} intensity={2.4} distance={10} color="#ffe2b8" />
    </group>
  );
}
