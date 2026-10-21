import "server-only";
import raw from "@/data/profile.json";
import type { Profile } from "./profile-shared";

export * from "./profile-shared";

const full = raw as unknown as Profile;

/**
 * The profile as it may be shown to visitors. Everything that reaches the
 * browser or the chat must come from here, so the phone number stays private
 * unless site.showPhone is turned on.
 */
export const profile: Profile = {
  ...full,
  // The number itself lives in the PROFILE_PHONE env var so it never sits in git.
  phone: full.site.showPhone ? process.env.PROFILE_PHONE || full.phone || null : null,
  experience: [...full.experience].sort((a, b) => (b.start > a.start ? 1 : -1)),
};

export const firstName = profile.name.split(" ").at(-1) ?? profile.name;
