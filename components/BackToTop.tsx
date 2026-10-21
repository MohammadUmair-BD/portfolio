"use client";

import { useEffect, useState } from "react";

/** Starts slow, then speeds up: barely moves for the first ~40% of the time, then rushes to the top. */
const easeInQuart = (t: number) => t * t * t * t;

/**
 * Back-to-top button for Quick view. Appears once the visitor has scrolled past
 * the intro header on desktop, or past the About section on phones.
 */
export function BackToTop({ topId, desktopAfterId, phoneAfterId }: { topId: string; desktopAfterId: string; phoneAfterId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 767px)");
    let observer: IntersectionObserver | null = null;

    const watch = () => {
      observer?.disconnect();
      const marker = document.getElementById(phone.matches ? phoneAfterId : desktopAfterId);
      if (!marker) return;
      // Visible once the marker has scrolled completely above the top of the screen.
      observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.bottom < 0));
      observer.observe(marker);
    };
    watch();
    phone.addEventListener("change", watch);
    return () => {
      observer?.disconnect();
      phone.removeEventListener("change", watch);
    };
  }, [desktopAfterId, phoneAfterId]);

  function toTop() {
    const done = () => {
      // Move keyboard / screen-reader focus to the top too, without jumping again.
      document.getElementById(topId)?.focus({ preventScroll: true });
    };
    const start = window.scrollY;
    if (start <= 0) return done();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, 0);
      return done();
    }

    const duration = Math.min(1200, Math.max(700, 600 + start * 0.08));
    const began = performance.now();
    let frame = 0;
    // If the visitor scrolls or touches the page themselves, stop and let them.
    const cancel = () => {
      cancelAnimationFrame(frame);
      stopListening();
    };
    const stopListening = () => ["wheel", "touchstart", "keydown"].forEach((e) => window.removeEventListener(e, cancel));
    ["wheel", "touchstart", "keydown"].forEach((e) => window.addEventListener(e, cancel, { passive: true, once: true }));

    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      window.scrollTo(0, Math.round(start * (1 - easeInQuart(t))));
      if (t < 1) frame = requestAnimationFrame(step);
      else {
        stopListening();
        done();
      }
    };
    frame = requestAnimationFrame(step);
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`no-print fixed bottom-4 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 sm:bottom-6 sm:right-6 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5m0 0-6 6m6-6 6 6" />
      </svg>
    </button>
  );
}
