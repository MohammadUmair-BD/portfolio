import type { Metadata } from "next";
import Link from "next/link";
import { About, Contact, Projects, ResumeButton, SectionHeading, Skills, Timeline } from "@/components/sections/Sections";
import { BackToTop } from "@/components/BackToTop";
import { FallbackNotice } from "@/components/FallbackNotice";
import { RatingStars } from "@/components/RatingStars";
import { profile } from "@/lib/profile";
import { jsonForScript } from "@/lib/security";
import { personJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Resume",
  description: `${profile.name}'s resume: ${profile.headline} in ${profile.location}. Laravel, Filament, React/Inertia.js and WordPress projects for UAE clients, skills, experience and contact details.`,
  alternates: { canonical: "/quick" },
  openGraph: { url: "/quick" },
};

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

export default function QuickView() {
  const jsonLd = personJsonLd();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />

      <FallbackNotice />

      <nav aria-label="Sections" className="no-print sticky top-0 z-10 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-line bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href="/" className="mr-2 shrink-0 font-display font-semibold">{profile.name.split(" ").at(-1)}</Link>
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full px-3 py-1 text-sm text-ink-soft hover:bg-paper-2 hover:text-ink">
            {s.label}
          </a>
        ))}
        <Link href="/explore" className="ml-auto shrink-0 rounded-full border border-line px-3 py-1 text-sm hover:bg-paper-2">
          3D room →
        </Link>
      </nav>

      <header id="intro" className="pb-10 pt-12">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">{profile.location}</p>
        <h1 id="top" tabIndex={-1} className="mt-2 font-display outline-none text-4xl font-semibold tracking-tight sm:text-5xl">{profile.name}</h1>
        <p className="mt-2 text-xl text-ink-soft">{profile.headline}</p>
        <div className="no-print mt-6 flex flex-wrap gap-3">
          <ResumeButton profile={profile} />
          <a href="#contact" className="rounded-full border border-line px-5 py-2.5 font-medium hover:bg-paper-2">Contact me</a>
        </div>
      </header>

      <main className="space-y-16">
        <section id="about-section" aria-labelledby="about" className="scroll-mt-20 space-y-4"><SectionHeading id="about">About</SectionHeading><About profile={profile} /></section>
        <section aria-labelledby="experience" className="scroll-mt-20 space-y-4"><SectionHeading id="experience">Experience & education</SectionHeading><Timeline profile={profile} /></section>
        <section aria-labelledby="projects" className="scroll-mt-20 space-y-4"><SectionHeading id="projects">Projects</SectionHeading><Projects profile={profile} /></section>
        <section aria-labelledby="skills" className="scroll-mt-20 space-y-4"><SectionHeading id="skills">Skills</SectionHeading><Skills profile={profile} /></section>
        <section aria-labelledby="contact" className="scroll-mt-20 space-y-4"><SectionHeading id="contact">Contact</SectionHeading><Contact profile={profile} /></section>
        <section aria-labelledby="rate" className="no-print scroll-mt-20 space-y-3 rounded-2xl border border-line bg-card p-6">
          <h2 id="rate" className="font-display text-xl font-semibold">Rate this portfolio</h2>
          <p className="text-sm text-ink-soft">How did you find it? Ratings are anonymous: no name, email or location.</p>
          <RatingStars />
        </section>
      </main>

      <BackToTop topId="top" desktopAfterId="intro" phoneAfterId="about-section" />
    </div>
  );
}
