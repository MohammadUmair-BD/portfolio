import Link from "next/link";
import { CatDoodle } from "@/components/CatDoodle";
import { profile } from "@/lib/profile";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <CatDoodle mood="confused" className="h-40 w-48" />
      <h1 className="mt-6 font-display text-3xl font-semibold">Hmm, nothing here.</h1>
      <p className="mt-2 text-ink-soft">
        {profile.site.catName} looked everywhere, even under the keyboard, but this page doesn&apos;t exist.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink">Go home</Link>
        <Link href="/quick" className="rounded-full border border-line px-5 py-2.5 font-medium hover:bg-paper-2">Quick view</Link>
      </div>
    </main>
  );
}
