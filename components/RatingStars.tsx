"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Summary = { available: boolean; average: number | null; count: number; mine: number | null };
type Status = { kind: "idle" | "saving" | "thanks" } | { kind: "error"; message: string };

const VOTER_KEY = "portfolio-voter";
const STARS = [1, 2, 3, 4, 5];

/** A random id this browser keeps so a visitor can change their own rating. It identifies nobody. */
function voterId(): string {
  try {
    const existing = localStorage.getItem(VOTER_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID(); // storage blocked: still works, just can't remember next visit
  }
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className={filled ? "text-[#f2b544]" : "text-current opacity-40"}>
      <path
        d="M12 2.8l2.83 5.74 6.33.92-4.58 4.46 1.08 6.3L12 17.25l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Rate this portfolio". The stars show the visitor's own rating (or a hover
 * preview); the text beside them shows everyone's average once at least three
 * people have rated. Hidden entirely if ratings aren't switched on.
 */
export function RatingStars({ variant = "strip" }: { variant?: "strip" | "board" }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const voter = useRef("");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    voter.current = voterId();
    let cancelled = false;
    fetch(`/api/rating?voter=${voter.current}`)
      .then((r) => r.json())
      .then((s: Summary) => !cancelled && setSummary(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async (stars: number) => {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voter: voter.current, stars }),
      });
      const data = await res.json();
      if (!res.ok) return setStatus({ kind: "error", message: data.error ?? "Couldn't save your rating." });
      setSummary(data);
      setStatus({ kind: "thanks" });
    } catch {
      setStatus({ kind: "error", message: "Couldn't save your rating. Check your connection." });
    }
  }, []);

  if (!summary?.available) return null;

  const mine = summary.mine ?? 0;
  const shown = hover || mine;
  const board = variant === "board";
  const score =
    summary.average !== null ? (
      <span>
        <span className="font-semibold">{summary.average.toFixed(1)}</span>
        <span className="opacity-70"> ({summary.count})</span>
      </span>
    ) : (
      <span className="opacity-80">{summary.count === 0 ? "Be the first to rate" : "Be one of the first to rate"}</span>
    );

  // Arrow keys move between stars (one tab stop for the whole group).
  const onKeyDown = (e: React.KeyboardEvent, n: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? n + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? n - 1 : 0;
    if (next >= 1 && next <= 5) {
      e.preventDefault();
      buttons.current[next - 1]?.focus();
    }
  };
  const focusable = mine || 1;

  const stars = (
    <div role="radiogroup" aria-label="Rate this portfolio from 1 to 5 stars" className="flex items-center" onMouseLeave={() => setHover(0)}>
      {STARS.map((n) => (
        <button
          key={n}
          ref={(el) => {
            buttons.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={mine === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          tabIndex={n === focusable ? 0 : -1}
          disabled={status.kind === "saving"}
          onClick={() => submit(n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onKeyDown={(e) => onKeyDown(e, n)}
          className={`rounded-md transition-transform hover:scale-110 disabled:opacity-60 ${board ? "p-0.5" : "p-1"}`}
        >
          <Star filled={n <= shown} size={board ? 18 : 28} />
        </button>
      ))}
    </div>
  );

  const message =
    status.kind === "thanks" ? (
      <span role="status">Thanks! You rated {mine}★{board ? "" : ". You can change it anytime."}</span>
    ) : status.kind === "error" ? (
      <span role="alert" className="text-[#e36b5a]">{status.message}</span>
    ) : mine && !board ? (
      <span className="opacity-80">You rated {mine}★. Click a star to change it.</span>
    ) : null;

  if (board) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-2xl bg-[#2a2320]/85 px-3 py-1.5 text-xs text-[#f3ecd9] shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {stars}
          {score}
        </div>
        {message && <div className="text-[11px]">{message}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3 text-ink">
        {stars}
        <span className="text-sm text-ink-soft">{score}</span>
      </div>
      {message && <p className="text-sm text-ink-soft">{message}</p>}
    </div>
  );
}
