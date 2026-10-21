import type { Profile } from "@/lib/profile-shared";
import { FOCUS, type CameraView, type ObjectId } from "@/lib/scene-layout";

export type TourStep = { target: ObjectId; line: string; camera: CameraView };

const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * The guided tour, in order. Edit the lines freely, but keep every fact
 * pulled from the profile so nothing is made up.
 */
export function buildTour(p: Profile): TourStep[] {
  const first = p.name.split(" ").at(-1) ?? p.name;
  const laravelClients = p.projects.filter((x) => x.kind === "client" && x.tech.includes("Laravel")).map((x) => x.title);
  const latest = p.experience[0];
  const coreSkills = p.skills.filter((s) => s.category !== "familiar").slice(0, 3).map((s) => s.name);
  const degree = p.education[0];

  return [
    {
      target: "monitor",
      line: `${first} built ${list(laravelClients.slice(0, 3))} with Laravel. Click the screen to see all ${p.projects.length} projects.`,
      camera: FOCUS.monitor,
    },
    {
      target: "bookshelf",
      line: `Every book on this shelf is one of ${first}'s skills, ${p.skills.length} in all, starting with ${list(coreSkills)}.`,
      camera: FOCUS.bookshelf,
    },
    {
      target: "certificates",
      line: `These frames are ${first}'s journey: ${p.experience.length} roles, most recently ${latest.role} at ${latest.company}${degree ? `, plus a ${degree.degree}` : ""}.`,
      camera: FOCUS.certificates,
    },
    {
      target: "window",
      line: `My favourite spot. Look out here to learn who ${first} is. We're in ${p.location}.`,
      camera: FOCUS.window,
    },
    {
      target: "resume",
      line: `Prefer paper? ${first}'s resume is right here, ready to download.`,
      camera: FOCUS.resume,
    },
    {
      target: "phone",
      line: `Like what you see? Ring ${first} up. Email works best: ${p.email}.`,
      camera: FOCUS.phone,
    },
  ];
}
