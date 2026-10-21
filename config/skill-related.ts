/**
 * Skills that aren't listed by name but where the profile has a closely related
 * listed skill. The cat says so plainly instead of claiming the skill itself.
 * Every value here must be a skill that exists in data/profile.json.
 */
export const RELATED_SKILLS: Record<string, string[]> = {
  JavaScript: ["React", "jQuery", "Ajax", "DOM manipulation", "TypeScript", "Node.js"],
  PostgreSQL: ["MySQL"],
  "Tailwind CSS": ["CSS3"],
  Bootstrap: ["CSS3"],
  Livewire: ["Laravel"],
};
