/**
 * The site's public address, used for canonical links, the sitemap and share
 * previews. SITE_URL wins if set (e.g. a custom domain); otherwise Vercel's
 * own production address is used automatically.
 */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

/** Search phrases this site should be found for. Kept to what the resume actually supports. */
export const KEYWORDS = [
  "Muhammad Umair",
  "Mohammad Umair",
  "Laravel developer",
  "PHP developer",
  "Full-stack developer",
  "Laravel developer Peshawar",
  "Laravel developer Pakistan",
  "Filament developer",
  "React Inertia.js developer",
  "Backend developer",
  "Remote Laravel developer",
];
