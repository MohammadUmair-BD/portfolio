"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Summary = { available: boolean; average: number | null; count: number; mine: number | null; lockedUntil: number | null };
type Messages = Record<"1" | "2" | "3" | "4" | "5", string>;
type Status = { kind: "idle" | "saving" | "thanks" } | { kind: "error"; message: string };

const VOTER_KEY = "portfolio-voter";
const STARS = [1, 2, 3, 4, 5] as const;

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

/** "0:42", "4:30", "2h 10m", "3d 4h", "11mo" */
function formatWait(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const h = Math.floor(s / 3600);
  if (h < 48) return `${h}h ${Math.floor((s % 3600) / 60)}m`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d}d ${h % 24}h` : `${Math.round(d / 30)}mo`;
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

type Props = {
  variant?: "strip" | "board";
  /** What visitors see after confirming, per number of stars (from profile.json). */
  messages: Messages;
  /** In the 3D room, "Contact" opens the contact panel instead of navigating. */
  onContact?: () => void;
};

/**
 * "Rate this portfolio". Picking a star only selects it; nothing is saved until
 * the visitor confirms. After each confirmed rating the server starts a growing
 * cooldown before it can be changed again, shown here as a countdown.
 */
export function RatingStars({ variant = "strip", messages, onContact }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hover, setHover] = useState(0);
  const [pending, setPending] = useState(0); // selected but not yet confirmed
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [now, setNow] = useState(0);
  const voter = useRef("");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const board = variant === "board";

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

  // Tick once a second while a cooldown is running, so the countdown stays live.
  const lockedUntil = summary?.lockedUntil ?? null;
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) setSummary((s) => (s ? { ...s, lockedUntil: null } : s));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const confirm = useCallback(async () => {
    if (!pending) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voter: voter.current, stars: pending }),
      });
      const data = await res.json();
      setPending(0);
      if (res.ok) {
        setSummary(data);
        setStatus({ kind: "thanks" });
      } else {
        if (data.lockedUntil) setSummary((s) => (s ? { ...s, lockedUntil: data.lockedUntil } : s));
        setStatus({ kind: "error", message: data.error ?? "Couldn't save your rating." });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't save your rating. Check your connection." });
    }
  }, [pending]);

  if (!summary?.available) return null;

  const mine = summary.mine ?? 0;
  const locked = Boolean(lockedUntil && lockedUntil > now);
  const shown = pending || hover || mine;
  const busy = status.kind === "saving";

  const choose = (n: number) => {
    if (locked || busy) return;
    setStatus({ kind: "idle" });
    setPending(n === mine ? 0 : n); // picking your current rating again is a no-op
  };

  // Arrow keys move between stars (one tab stop for the whole group).
  const onKeyDown = (e: React.KeyboardEvent, n: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? n + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? n - 1 : 0;
    if (next >= 1 && next <= 5) {
      e.preventDefault();
      buttons.current[next - 1]?.focus();
    }
  };
  const focusable = pending || mine || 1;

  const score =
    summary.average !== null ? (
      <span>
        <span className="font-semibold">{summary.average.toFixed(1)}</span>
        <span className="opacity-70"> ({summary.count})</span>
      </span>
    ) : (
      <span className="opacity-80">{summary.count === 0 ? "Be the first to rate" : "Be one of the first to rate"}</span>
    );

  const stars = (
    <div
      role="radiogroup"
      aria-label="Rate this portfolio from 1 to 5 stars"
      aria-disabled={locked || undefined}
      className="flex items-center"
      onMouseLeave={() => setHover(0)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          ref={(el) => {
            buttons.current[n - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={(pending || mine) === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          tabIndex={n === focusable ? 0 : -1}
          disabled={locked || busy}
          onClick={() => choose(n)}
          onMouseEnter={() => !locked && setHover(n)}
          onFocus={() => !locked && setHover(n)}
          onBlur={() => setHover(0)}
          onKeyDown={(e) => onKeyDown(e, n)}
          className={`rounded-md transition-transform enabled:hover:scale-110 disabled:cursor-not-allowed ${board ? "p-0.5" : "p-1"}`}
        >
          <Star filled={n <= shown} size={board ? 18 : 28} />
        </button>
      ))}
    </div>
  );

  const linkClass = board
    ? "rounded-full border border-[#f3ecd9]/40 px-2 py-0.5 hover:bg-[#f3ecd9]/10"
    : "rounded-full border border-line px-3 py-1 text-sm font-medium hover:bg-paper-2";
  const contactLink = onContact ? (
    <button type="button" onClick={onContact} className={linkClass}>Contact</button>
  ) : (
    <a href="#contact" className={linkClass}>Contact</a>
  );
  const actions =
    mine === 5 ? (
      <>
        {contactLink}
        {!board && <a href="/explore" className={linkClass}>3D room</a>}
      </>
    ) : mine && mine <= 2 ? (
      contactLink
    ) : null;

  let message: React.ReactNode = null;
  if (pending) {
    // The message changes as soon as a star is picked; nothing is saved until Confirm.
    message = (
      <span className="flex flex-col gap-1.5">
        <span aria-live="polite">{messages[String(pending) as keyof Messages]}</span>
        <span className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={confirm} disabled={busy} className={`${linkClass} font-semibold`}>
            {busy ? "Saving…" : `Confirm ${pending}★`}
          </button>
          <button type="button" onClick={() => setPending(0)} disabled={busy} className="underline-offset-2 hover:underline">
            Cancel
          </button>
        </span>
      </span>
    );
  } else if (status.kind === "error") {
    message = <span role="alert" className="text-[#e36b5a]">{status.message}</span>;
  } else if (mine && (status.kind === "thanks" || !board)) {
    message = (
      <span className="flex flex-col gap-1.5">
        <span role={status.kind === "thanks" ? "status" : undefined}>{messages[String(mine) as keyof Messages]}</span>
        {actions && <span className="flex flex-wrap gap-2">{actions}</span>}
      </span>
    );
  }
  const countdown = locked && lockedUntil ? (
    <span className="opacity-70">You can change your rating in {formatWait(lockedUntil - now)}</span>
  ) : null;

  if (board) {
    return (
      <div className="flex max-w-[300px] flex-col items-center gap-1 rounded-2xl bg-[#2a2320]/85 px-3 py-1.5 text-center text-xs text-[#f3ecd9] shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {stars}
          {score}
        </div>
        {message && <div className="text-[11px] leading-snug">{message}</div>}
        {countdown && <div className="text-[10px]">{countdown}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3 text-ink">
        {stars}
        <span className="text-sm text-ink-soft">{score}</span>
      </div>
      {message && <div className="text-sm text-ink-soft">{message}</div>}
      {countdown && <p className="text-xs text-ink-soft">{countdown}</p>}
    </div>
  );
}
