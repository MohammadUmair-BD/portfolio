"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { About, Contact, Projects, ResumeButton, Skills, Timeline } from "@/components/sections/Sections";
import type { Profile } from "@/lib/profile-shared";
import { SECTION_LABELS, type SectionId } from "@/lib/scene-layout";

const FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';

export function Overlay({ section, profile, onClose }: { section: SectionId; profile: Profile; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => previous?.focus?.();
  }, [section]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const [first, last] = [items[0], items.at(-1)];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  const isScreen = section === "projects";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-[#1b1714]/35" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="overlay-title"
        className={`relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isScreen ? "border-[6px] border-[#3b3633] bg-paper" : "bg-paper"}`}
      >
        <header className={`flex items-center gap-3 px-5 py-3 ${isScreen ? "bg-[#3b3633] text-[#f3ebe1]" : "border-b border-line"}`}>
          {isScreen && (
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-3 w-3 rounded-full bg-[#e36b5a]" /><span className="h-3 w-3 rounded-full bg-[#e6b24f]" /><span className="h-3 w-3 rounded-full bg-[#8fc29a]" />
            </span>
          )}
          <h2 id="overlay-title" className={`font-display text-xl font-semibold ${isScreen ? "font-mono text-base" : ""}`}>
            {isScreen ? "~/projects" : SECTION_LABELS[section]}
          </h2>
          <button
            data-autofocus
            onClick={onClose}
            className="ml-auto rounded-full px-3 py-1 text-sm font-medium hover:bg-paper-2 hover:text-ink"
          >
            Close <span className="sr-only">{SECTION_LABELS[section]}</span><kbd className="ml-1 hidden text-xs opacity-60 sm:inline">Esc</kbd>
          </button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          {section === "projects" && <Projects profile={profile} />}
          {section === "skills" && <Skills profile={profile} />}
          {section === "experience" && <Timeline profile={profile} />}
          {section === "about" && (
            <div className="space-y-4">
              <h3 className="font-display text-2xl font-semibold">{profile.name}</h3>
              <p className="text-ink-soft">{profile.headline}</p>
              <About profile={profile} />
            </div>
          )}
          {section === "contact" && <Contact profile={profile} />}
          {section === "resume" && (
            <div className="space-y-4">
              <p className="text-lg">{profile.name} · {profile.headline}</p>
              <p className="text-ink-soft">Everything from the room, on one printable page.</p>
              <div className="flex flex-wrap gap-3">
                <ResumeButton profile={profile} />
                <Link href="/quick" className="rounded-full border border-line px-5 py-2.5 font-medium hover:bg-paper-2">Open quick view</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
