import { formatRange, skillsByCategory, type Profile } from "@/lib/profile-shared";
import { ContactForm } from "./ContactForm";

type P = { profile: Profile };

export function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
      {children}
    </h2>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink-soft">{children}</span>
);

export function About({ profile }: P) {
  return (
    <div className="space-y-4">
      <p className="text-lg leading-relaxed">{profile.summary}</p>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-soft">Based in</dt>
        <dd>{profile.location}</dd>
        <dt className="text-ink-soft">Languages</dt>
        <dd>{profile.languages.map((l) => `${l.name} (${l.level})`).join(" · ")}</dd>
        {profile.availability && (
          <>
            <dt className="text-ink-soft">Availability</dt>
            <dd>{profile.availability.me}</dd>
          </>
        )}
        {profile.workPreferences?.remote && (
          <>
            <dt className="text-ink-soft">Work style</dt>
            <dd>{profile.workPreferences.remote.me}</dd>
          </>
        )}
        {profile.workPreferences?.relocation && (
          <>
            <dt className="text-ink-soft">Relocation</dt>
            <dd>{profile.workPreferences.relocation.me}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function Projects({ profile }: P) {
  const groups = [
    { title: "Client work", items: profile.projects.filter((p) => p.kind === "client") },
    { title: "Personal projects", items: profile.projects.filter((p) => p.kind === "personal") },
  ];
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">{g.title}</h3>
          <ul className="grid gap-4 sm:grid-cols-2">
            {g.items.map((p) => (
              <li key={p.title} className="flex flex-col rounded-xl border border-line bg-card p-4">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" loading="lazy" className="mb-3 aspect-video w-full rounded-lg object-cover" />
                )}
                <h4 className="font-semibold">
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-accent hover:underline">
                      {p.title} <span aria-hidden className="text-ink-soft">↗</span>
                      <span className="sr-only"> (opens the live site)</span>
                    </a>
                  ) : (
                    p.title
                  )}
                </h4>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-soft">{p.description}</p>
                {p.tech.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{p.tech.map((t) => <Chip key={t}>{t}</Chip>)}</div>
                )}
                {(p.url || p.repo) && (
                  <div className="mt-3 flex gap-4 text-sm font-medium">
                    {p.url && <a className="text-accent underline-offset-4 hover:underline" href={p.url} target="_blank" rel="noreferrer">Live site ↗</a>}
                    {p.repo && <a className="text-accent underline-offset-4 hover:underline" href={p.repo} target="_blank" rel="noreferrer">Code ↗</a>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Skills({ profile }: P) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {skillsByCategory(profile).map((g) => (
        <div key={g.category} className="rounded-xl border border-line bg-card p-4">
          <h3 className="mb-2 font-semibold">{g.label}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {g.skills.map((s) => (
              <li key={s.name}>
                <Chip>
                  {s.name}
                  {s.level && s.category !== "familiar" ? ` · ${s.level}` : ""}
                </Chip>
              </li>
            ))}
          </ul>
          {g.category === "familiar" && <p className="mt-2 text-xs text-ink-soft">{profile.familiarNote}</p>}
        </div>
      ))}
    </div>
  );
}

export function Timeline({ profile }: P) {
  return (
    <div className="space-y-8">
      <ol className="relative space-y-6 border-l-2 border-line pl-6">
        {profile.experience.map((e) => (
          <li key={e.company + e.start} className="relative">
            <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-paper bg-accent" aria-hidden />
            <p className="text-sm text-ink-soft">{formatRange(e.start, e.end)} · {e.location}</p>
            <h3 className="font-semibold">{e.role} — {e.company}</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
              {e.highlights.map((h) => <li key={h}>{h}</li>)}
            </ul>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="mb-2 font-semibold">Education</h3>
          {profile.education.map((ed) => (
            <div key={ed.institution} className="text-sm">
              <p className="font-medium">{ed.degree}</p>
              <p className="text-ink-soft">{ed.institution} · {formatRange(ed.start, ed.end)}</p>
              {ed.focus && <p className="mt-1 text-ink-soft">Focus: {ed.focus}</p>}
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="mb-2 font-semibold">Certifications</h3>
          <ul className="space-y-2 text-sm">
            {profile.certifications.map((c) => (
              <li key={c.name}>
                <p className="font-medium">{c.name} — {c.issuer}{c.year && ` (${c.year})`}</p>
                {c.note && <p className="text-ink-soft">{c.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ContactLinks({ profile }: P) {
  const links = [
    { label: "Email", value: profile.email, href: `mailto:${profile.email}` },
    profile.phone && { label: "Phone", value: profile.phone, href: `tel:${profile.phone.replace(/[^\d+]/g, "")}` },
    profile.links.linkedin && { label: "LinkedIn", value: "Mohammad Umair", href: profile.links.linkedin },
    profile.links.github && { label: "GitHub", value: "GitHub profile", href: profile.links.github },
  ].filter(Boolean) as { label: string; value: string; href: string }[];
  return (
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l.label} className="flex flex-wrap gap-x-3">
          <span className="w-20 text-sm text-ink-soft">{l.label}</span>
          <a className="font-medium text-accent underline-offset-4 hover:underline" href={l.href} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
            {l.value}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Contact({ profile }: P) {
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <p className="text-ink-soft">The fastest way to reach me is email. You can also leave a message here.</p>
        <ContactLinks profile={profile} />
      </div>
      <ContactForm email={profile.email} />
    </div>
  );
}

export function ResumeButton({ profile, className = "" }: P & { className?: string }) {
  return (
    <a
      href={profile.site.resumeFile}
      download
      className={`inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink shadow-sm transition hover:brightness-110 ${className}`}
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M5 21h14" /></svg>
      Download resume (PDF)
    </a>
  );
}
