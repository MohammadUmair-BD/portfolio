"use client";

import { useEffect, useRef, useState } from "react";

type Status = { kind: "idle" | "sending" | "sent" } | { kind: "error"; message: string; fields?: Record<string, string> };

export function ContactForm({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const startedAt = useRef(0); // when the form appeared; the server rejects instant (bot) submissions
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), startedAt: startedAt.current }),
      });
      const data = await res.json();
      if (res.ok) {
        form.reset();
        setStatus({ kind: "sent" });
      } else {
        setStatus({ kind: "error", message: data.error ?? "Please check the highlighted fields.", fields: data.errors });
      }
    } catch {
      setStatus({ kind: "error", message: "Couldn't send. Please check your connection." });
    }
  }

  if (status.kind === "sent") {
    return (
      <p role="status" className="rounded-xl border border-line bg-card p-6">
        Thanks! Your message was sent. I&apos;ll reply by email. 🐾
      </p>
    );
  }

  const fields = status.kind === "error" ? status.fields ?? {} : {};
  const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-paper-2 p-4" noValidate>
      <label className="block text-sm font-medium">
        Name
        <input name="name" required maxLength={100} autoComplete="name" className={input} aria-invalid={!!fields.name} />
        {fields.name && <span className="text-xs text-red-600">{fields.name}</span>}
      </label>
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" required maxLength={200} autoComplete="email" className={input} aria-invalid={!!fields.email} />
        {fields.email && <span className="text-xs text-red-600">{fields.email}</span>}
      </label>
      <label className="block text-sm font-medium">
        Message
        <textarea name="message" required minLength={10} maxLength={3000} rows={4} className={input} aria-invalid={!!fields.message} />
        {fields.message && <span className="text-xs text-red-600">{fields.message}</span>}
      </label>
      {/* Honeypot: hidden from people, filled by bots. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {status.kind === "error" && !status.fields && (
        <p role="alert" className="text-sm text-red-600">
          {status.message} <a className="underline" href={`mailto:${email}`}>{email}</a>
        </p>
      )}
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="rounded-full bg-ink px-5 py-2 font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
