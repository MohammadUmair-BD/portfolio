let cached: boolean | null = null;

/** WebGL available and the device isn't very low-powered. Browser only. */
export function canRun3D(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) < 2;
    cached = Boolean(gl) && !weak;
  } catch {
    cached = false;
  }
  return cached;
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
