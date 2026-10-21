import { CatDoodle } from "@/components/CatDoodle";
import { EntryChoices } from "@/components/EntryChoices";
import { profile } from "@/lib/profile";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <CatDoodle className="h-28 w-32" />
      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-accent">Hi, I&apos;m</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-6xl">{profile.name}</h1>
      <p className="mt-3 text-lg text-ink-soft sm:text-xl">{profile.headline} · {profile.location}</p>
      <EntryChoices catName={profile.site.catName} />
    </main>
  );
}
