import "server-only";
import { profile } from "@/lib/profile";
import { siteUrl } from "@/lib/site";

/** schema.org data that lets Google show a proper "person" result. Built only from the profile. */
export function personJsonLd() {
  const site = siteUrl();
  const latest = profile.experience[0];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: `${site}/`,
        name: `${profile.name} Portfolio`,
        inLanguage: "en",
        about: { "@id": `${site}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${site}/#person`,
        name: profile.name,
        alternateName: "Mohammad Umair",
        jobTitle: profile.headline,
        description: profile.summary,
        url: `${site}/`,
        image: `${site}/opengraph-image`,
        email: `mailto:${profile.email}`,
        ...(profile.phone ? { telephone: profile.phone } : {}),
        address: { "@type": "PostalAddress", addressLocality: "Peshawar", addressCountry: "PK" },
        sameAs: [profile.links.linkedin, profile.links.github].filter(Boolean), // other profiles of the same person
        knowsAbout: profile.skills.filter((s) => s.category !== "familiar").map((s) => s.name),
        knowsLanguage: profile.languages.map((l) => l.name),
        alumniOf: profile.education.map((e) => ({ "@type": "CollegeOrUniversity", name: e.institution })),
        ...(latest ? { hasOccupation: { "@type": "Occupation", name: latest.role, skills: latest.tech.join(", ") } } : {}),
      },
    ],
  };
}
