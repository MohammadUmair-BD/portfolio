/**
 * Where things are in the 3D room (units are roughly metres, the cat faces +z).
 * The room components place objects from these numbers, and the cat's spots
 * and camera views are derived from them, so moving an object here moves
 * everything that depends on it. Jump arcs are computed at runtime.
 */
export type Vec3 = [number, number, number];
export type SectionId = "projects" | "skills" | "experience" | "about" | "contact" | "resume";
export type ObjectId = "monitor" | "bookshelf" | "certificates" | "window" | "phone" | "resume";

export const DESK = { center: [0.3, 0, -3.4] as Vec3, width: 3.2, depth: 1.3, height: 1.0 };
export const DESK_TOP = DESK.height + 0.04;
export const DESK_BOUNDS = {
  minX: DESK.center[0] - DESK.width / 2 + 0.15,
  maxX: DESK.center[0] + DESK.width / 2 - 0.15,
  minZ: DESK.center[2] - DESK.depth / 2 + 0.15,
  maxZ: DESK.center[2] + DESK.depth / 2 - 0.1,
};

export const LAYOUT = {
  monitor: [0.5, DESK_TOP, -3.75] as Vec3,
  keyboard: [0.5, DESK_TOP, -3.0] as Vec3,
  resume: [-0.75, DESK_TOP, -3.05] as Vec3,
  pen: [1.55, DESK_TOP + 0.015, -2.9] as Vec3,
  mug: [1.4, DESK_TOP, -3.55] as Vec3,
  lamp: [-0.95, DESK_TOP, -3.75] as Vec3,
  bookshelf: [-5.2, 0, -1.4] as Vec3, // against the left wall, books face +x
  certificates: [-2.8, 2.25, -4.47] as Vec3, // centre of the frame grid on the back wall
  window: [3.2, 2.1, -4.5] as Vec3,
  windowSill: [3.2, 1.36, -4.3] as Vec3,
  sideTable: [4.3, 0, -1.2] as Vec3,
  sideTableTop: 0.76,
  chair: [0.4, 0, -2.0] as Vec3,
  plant: [-4.6, 0, -4.0] as Vec3,
  rug: [0, 0.005, -0.8] as Vec3,
  room: { halfWidth: 5.5, backZ: -4.5, frontZ: 4, height: 4 },
};

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Where the cat stands when visiting each object. */
export const CAT_SPOTS: Record<ObjectId | "home" | "pen", Vec3> = {
  home: add(LAYOUT.keyboard, [0, 0.02, 0]),
  monitor: [LAYOUT.monitor[0] + 0.85, DESK_TOP, LAYOUT.monitor[2] + 0.35],
  resume: [LAYOUT.resume[0] + 0.45, DESK_TOP, LAYOUT.resume[2] + 0.05],
  pen: [LAYOUT.pen[0] - 0.3, DESK_TOP, LAYOUT.pen[2] - 0.05],
  bookshelf: [LAYOUT.bookshelf[0] + 0.9, 0, LAYOUT.bookshelf[2] + 0.1],
  certificates: [LAYOUT.certificates[0], 0, LAYOUT.room.backZ + 0.7],
  window: [LAYOUT.windowSill[0] - 0.3, LAYOUT.windowSill[1], LAYOUT.windowSill[2] + 0.05],
  phone: [LAYOUT.sideTable[0] - 0.22, LAYOUT.sideTableTop, LAYOUT.sideTable[2] + 0.22],
};

export type CameraView = { position: Vec3; target: Vec3 };

export const OVERVIEW: CameraView = { position: [5.6, 4.3, 6.6], target: [-0.4, 1.2, -2] };

/** Close-up views used when a section opens and by the tour. */
export const FOCUS: Record<ObjectId, CameraView> = {
  monitor: { position: [0.5, 1.75, -1.4], target: [0.5, 1.55, -3.75] },
  bookshelf: { position: [-2.0, 1.7, -0.9], target: [-5.2, 1.3, -1.4] },
  certificates: { position: [-2.8, 2.2, -0.4], target: [-2.8, 2.1, -4.5] },
  window: { position: [2.4, 2.0, -0.6], target: [3.2, 1.9, -4.5] },
  phone: { position: [2.3, 1.9, 1.1], target: [4.2, 0.8, -1.2] },
  resume: { position: [-0.4, 2.3, -1.5], target: [-0.6, 1.0, -3.1] },
};

export const OBJECT_SECTION: Record<ObjectId, SectionId> = {
  monitor: "projects",
  bookshelf: "skills",
  certificates: "experience",
  window: "about",
  phone: "contact",
  resume: "resume",
};

export const SECTION_OBJECT = Object.fromEntries(
  Object.entries(OBJECT_SECTION).map(([o, s]) => [s, o]),
) as Record<SectionId, ObjectId>;

export const SECTION_LABELS: Record<SectionId, string> = {
  projects: "Projects",
  skills: "Skills",
  experience: "Experience",
  about: "About me",
  contact: "Contact",
  resume: "Resume",
};
