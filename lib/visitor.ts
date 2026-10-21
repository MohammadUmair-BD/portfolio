import type { SectionId } from "@/lib/scene-layout";

/** Stored only in this browser. Nothing personal, nothing sent to the server. */
export type VisitorMemory = { visited: boolean; tourDone: boolean; lastSection: SectionId | null };

const KEY = "portfolio-visitor-v1";
const EMPTY: VisitorMemory = { visited: false, tourDone: false, lastSection: null };

export function loadVisitor(): VisitorMemory {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

export function saveVisitor(patch: Partial<VisitorMemory>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadVisitor(), ...patch }));
  } catch {
    // Private mode or storage blocked: the site works the same, it just won't remember.
  }
}
