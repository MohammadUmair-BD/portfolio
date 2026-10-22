import type { Metadata } from "next";
import { ExploreShell } from "@/components/explore/ExploreShell";
import { profile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "3D Room",
  alternates: { canonical: "/explore" },
  description: `Step into ${profile.name}'s 3D developer room. ${profile.site.catName} the cat will show you projects, skills, experience and how to get in touch.`,
};

export default function ExplorePage() {
  return (
    <>
      <ExploreShell profile={profile} />
      <noscript>
        <p style={{ padding: 24 }}>
          The 3D room needs JavaScript. <a href="/quick">Open the quick view of {profile.name}&apos;s resume</a>.
        </p>
      </noscript>
    </>
  );
}
