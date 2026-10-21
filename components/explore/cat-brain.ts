import gsap from "gsap";
import * as THREE from "three";
import { LAYOUT, type Vec3 } from "@/lib/scene-layout";

export type CatState = "sleep" | "wake" | "idle" | "walk" | "jump" | "sit" | "talk" | "wave" | "swat";

type Segment = { kind: "walk" | "jump"; to: THREE.Vector3 };

const WALK_SPEED = 1.3; // units per second
const now = () => performance.now() / 1000;

/**
 * Plain object shared by the React UI (which tells the cat what to do) and the
 * Cat component (which reads it every frame to pose the model). Swapping the
 * primitive cat for a GLB only means writing a new component that reads this.
 */
export class CatBrain {
  position: THREE.Vector3;
  heading = 0;
  targetHeading: number | null = null;
  state: CatState = "sleep";
  stateSince = now();
  /** 0 → 1 through the airborne part of a jump; used for the pose. */
  jumpT = 0;
  /** Distance walked, drives the leg cycle. */
  stride = 0;
  opacity = 1;
  purring = false;
  /** World point the head turns towards (camera, pointer, object). */
  lookAt: THREE.Vector3 | null = null;
  reducedMotion = false;

  private timeline: gsap.core.Timeline | null = null;
  private interrupt: ((done: boolean) => void) | null = null;

  constructor(start: Vec3) {
    this.position = new THREE.Vector3(...start);
  }

  get busy() {
    return this.timeline?.isActive() ?? false;
  }

  set(state: CatState) {
    if (this.state !== state) this.stateSince = now();
    this.state = state;
  }

  /** Plays a timed state (wake, wave, swat) then settles into `then`. */
  play(state: CatState, seconds: number, then: CatState = "sit"): Promise<boolean> {
    this.stop();
    this.set(state);
    return this.run(gsap.timeline().to({}, { duration: this.reducedMotion ? 0.05 : seconds }), then);
  }

  faceTowards(p: THREE.Vector3 | Vec3) {
    const [x, , z] = Array.isArray(p) ? p : p.toArray();
    this.targetHeading = Math.atan2(x - this.position.x, z - this.position.z);
  }

  stop() {
    this.timeline?.kill();
    this.timeline = null;
    this.interrupt?.(false);
    this.interrupt = null;
  }

  /**
   * Walks and jumps to `target`. Resolves true on arrival, or false if a newer
   * command interrupted it. Arcs are computed here from the live position.
   */
  moveTo(target: Vec3, then: CatState = "sit", opts: { hop?: boolean } = {}): Promise<boolean> {
    this.stop();
    this.purring = false; // walking away ends a purr even if the pointer never "left"
    const to = new THREE.Vector3(...target);
    if (this.position.distanceTo(to) < 0.02) {
      this.set(then);
      return Promise.resolve(true);
    }

    const tl = gsap.timeline();
    if (this.reducedMotion) {
      tl.to(this, { opacity: 0, duration: 0.25 })
        .add(() => {
          this.position.copy(to);
          this.set("idle");
        })
        .to(this, { opacity: 1, duration: 0.25 });
      return this.run(tl, then);
    }

    let start = this.position.clone();
    for (const seg of this.plan(start, to, opts.hop)) {
      if (seg.kind === "walk") this.addWalk(tl, start, seg.to);
      else this.addJump(tl, start, seg.to);
      start = seg.to;
    }
    return this.run(tl, then);
  }

  private run(tl: gsap.core.Timeline, then: CatState): Promise<boolean> {
    this.timeline = tl;
    return new Promise((resolve) => {
      this.interrupt = resolve;
      tl.eventCallback("onComplete", () => {
        this.interrupt = null;
        this.timeline = null;
        this.jumpT = 0;
        this.set(then);
        resolve(true);
      });
    });
  }

  private plan(from: THREE.Vector3, to: THREE.Vector3, hop?: boolean): Segment[] {
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    const sameLevel = Math.abs(to.y - from.y) < 0.05;
    if (hop || (!sameLevel && flat < 2.4)) return [{ kind: "jump", to }];
    if (sameLevel && (from.y < 0.05 || flat < 3.5)) return [{ kind: "walk", to }];

    // Far away on different levels: hop down, cross the floor, hop up.
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize();
    const segments: Segment[] = [];
    if (from.y > 0.05) segments.push({ kind: "jump", to: this.onFloor(from.clone().addScaledVector(dir, 0.8)) });
    if (to.y > 0.05) {
      segments.push({ kind: "walk", to: this.onFloor(to.clone().addScaledVector(dir, -0.8)) });
      segments.push({ kind: "jump", to });
    } else {
      segments.push({ kind: "walk", to });
    }
    return segments;
  }

  private onFloor(p: THREE.Vector3) {
    const { halfWidth, backZ, frontZ } = LAYOUT.room;
    p.x = THREE.MathUtils.clamp(p.x, -halfWidth + 0.4, halfWidth - 0.4);
    p.z = THREE.MathUtils.clamp(p.z, backZ + 0.4, frontZ - 0.4);
    p.y = 0;
    return p;
  }

  private addWalk(tl: gsap.core.Timeline, start: THREE.Vector3, to: THREE.Vector3) {
    const from = new THREE.Vector3();
    const prev = new THREE.Vector3();
    const progress = { t: 0 };
    tl.add(() => {
      from.copy(this.position);
      prev.copy(from);
      this.faceTowards(to);
      this.set("walk");
    });
    tl.to(progress, {
      t: 1,
      duration: Math.max(0.3, start.distanceTo(to) / WALK_SPEED),
      ease: "power1.inOut",
      onStart: () => {
        progress.t = 0;
      },
      onUpdate: () => {
        this.position.lerpVectors(from, to, progress.t);
        this.stride += this.position.distanceTo(prev);
        prev.copy(this.position);
      },
    });
  }

  private addJump(tl: gsap.core.Timeline, start: THREE.Vector3, to: THREE.Vector3) {
    const from = new THREE.Vector3();
    const progress = { t: 0 };
    let peak = 0.4;
    tl.add(() => {
      from.copy(this.position);
      peak = 0.35 + Math.abs(to.y - from.y) * 0.55 + from.distanceTo(to) * 0.05;
      this.faceTowards(to);
      this.jumpT = 0;
      this.set("jump");
    });
    tl.to({}, { duration: 0.18 }); // crouch
    tl.to(progress, {
      t: 1,
      duration: 0.45 + Math.min(0.4, Math.hypot(to.x - start.x, to.z - start.z) * 0.08),
      ease: "none",
      onStart: () => {
        progress.t = 0;
      },
      onUpdate: () => {
        const t = progress.t;
        this.jumpT = t;
        this.position.set(
          THREE.MathUtils.lerp(from.x, to.x, t),
          THREE.MathUtils.lerp(from.y, to.y, t) + 4 * peak * t * (1 - t),
          THREE.MathUtils.lerp(from.z, to.z, t),
        );
      },
    });
    tl.add(() => (this.jumpT = 1));
    tl.to({}, { duration: 0.12 }); // land
  }
}
