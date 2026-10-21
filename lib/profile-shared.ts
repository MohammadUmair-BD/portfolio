// Types and helpers that are safe to use in browser code. Never import data/profile.json here.

export type SkillCategory = "backend" | "frontend" | "database" | "tools" | "other" | "familiar";

export type Skill = { name: string; category: SkillCategory; level: string | null; note?: string };
export type Experience = {
  company: string;
  role: string;
  start: string; // YYYY-MM
  end: string | null; // YYYY-MM, null = current
  location: string;
  highlights: string[];
  tech: string[];
};
export type Project = {
  title: string;
  kind: "client" | "personal";
  description: string;
  tech: string[];
  url: string;
  repo: string;
  image: string;
};
export type Education = { institution: string; degree: string; start: string; end: string; focus?: string };
export type Certification = { name: string; issuer: string; year: string; note?: string };

export type Voiced = { me: string; cat: string };

export type Profile = {
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string | null;
  summary: string;
  links: { linkedin: string; github: string; website: string };
  /** "me" is shown on the site in first person; "cat" is what Miso says (third person). */
  availability: Voiced | null;
  workPreferences: { remote?: Voiced; relocation?: Voiced } | null;
  site: {
    catName: string;
    /** How the cat refers to the person. Leave out to always use the first name. */
    pronouns?: { subject: string; object: string; possessive: string };
    showPhone: boolean;
    resumeFile: string;
  };
  skills: Skill[];
  familiarNote: string;
  experience: Experience[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  languages: { name: string; level: string }[];
};

/**
 * Words the cat uses for the person: he/him/his from site.pronouns, or the
 * first name everywhere if no pronouns are set (never guessed).
 */
export function voice(p: Profile) {
  const first = p.name.split(" ").at(-1) ?? p.name;
  const pr = p.site.pronouns;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    first,
    he: pr?.subject ?? first,
    him: pr?.object ?? first,
    his: pr?.possessive ?? `${first}'s`,
    He: cap(pr?.subject ?? first),
    His: cap(pr?.possessive ?? `${first}'s`),
  };
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  backend: "Backend",
  frontend: "Frontend",
  database: "Database",
  tools: "Tools & workflow",
  other: "Other",
  familiar: "Familiar with",
};

export function skillsByCategory(p: Profile) {
  const groups = new Map<SkillCategory, Skill[]>();
  for (const s of p.skills) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  return [...groups.entries()].map(([category, skills]) => ({ category, label: CATEGORY_LABELS[category], skills }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonth(ym: string | null): string {
  if (!ym) return "Present";
  const [y, m] = ym.split("-").map(Number);
  return m ? `${MONTHS[m - 1]} ${y}` : String(y);
}

export const formatRange = (start: string, end: string | null) => `${formatMonth(start)} – ${formatMonth(end)}`;

/** Total months worked, merging overlapping jobs so they aren't double counted. */
export function monthsOfExperience(p: Profile, now = new Date()): number {
  const toIndex = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const nowIndex = now.getFullYear() * 12 + now.getMonth();
  const ranges = p.experience
    .map((e) => [toIndex(e.start), e.end ? toIndex(e.end) + 1 : nowIndex + 1] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [start, end] of ranges) {
    const from = Math.max(start, cursor);
    if (end > from) total += end - from;
    cursor = Math.max(cursor, end);
  }
  return total;
}
