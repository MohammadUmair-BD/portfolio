"use client";

import { useCallback, useEffect, useState } from "react";

type Unanswered = { id: number; question: string; created_at: string };
type Answer = { id: number; keywords: string; answer: string };
type Message = { id: number; name: string; email: string; message: string; created_at: string };

const KEY = "portfolio-admin";
const read = () => { try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const write = (v: string) => { try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch {} };
const when = (iso: string) => new Date(iso).toLocaleString();

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [unanswered, setUnanswered] = useState<Unanswered[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [form, setForm] = useState({ keywords: "", answer: "" });

  const api = useCallback(async (path: string, init: RequestInit = {}, pw = password) => {
    const res = await fetch(`/api/admin/${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${pw}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }, [password]);

  const load = useCallback(async (pw = password) => {
    try {
      const [u, a, m] = await Promise.all([api("unanswered", {}, pw), api("answers", {}, pw), api("messages", {}, pw)]);
      setUnanswered(u); setAnswers(a); setMessages(m);
      setPassword(pw); setAuthed(true); setError(""); write(pw);
    } catch (e) {
      setAuthed(false); setError((e as Error).message); write("");
    }
  }, [api, password]);

  useEffect(() => {
    // Restore a session from this tab. load() only sets state after its fetches resolve.
    const saved = read();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) void load(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addAnswer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("answers", { method: "POST", body: JSON.stringify(form) });
      setForm({ keywords: "", answer: "" });
      await load();
    } catch (err) { setError((err as Error).message); }
  }

  async function remove(kind: "answers" | "unanswered", id: number) {
    try { await api(`${kind}?id=${id}`, { method: "DELETE" }); await load(); } catch (err) { setError((err as Error).message); }
  }

  const input = "w-full rounded-lg border border-line bg-card px-3 py-2";

  if (!authed) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-24">
        <h1 className="font-display text-2xl font-semibold">Admin</h1>
        <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <label className="block text-sm font-medium">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${input}`} autoComplete="current-password" required />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className="rounded-full bg-ink px-5 py-2 font-medium text-paper">Sign in</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-12 px-4 py-12">
      <header className="flex items-center gap-4">
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <button className="ml-auto text-sm underline" onClick={() => { write(""); setAuthed(false); setPassword(""); }}>Sign out</button>
      </header>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Questions the cat couldn&apos;t answer ({unanswered.length})</h2>
        <p className="text-sm text-ink-soft">Use these to add custom answers below. Only the question text and time are stored.</p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {unanswered.length === 0 && <li className="p-4 text-sm text-ink-soft">Nothing yet.</li>}
          {unanswered.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="flex-1">“{q.question}”</span>
              <span className="text-xs text-ink-soft">{when(q.created_at)}</span>
              <button className="text-accent underline" onClick={() => setForm({ keywords: q.question.toLowerCase(), answer: "" })}>Answer this</button>
              <button className="text-ink-soft underline" onClick={() => remove("unanswered", q.id)}>Dismiss</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Custom answers ({answers.length})</h2>
        <p className="text-sm text-ink-soft">
          Checked before everything else. The answer is used when <em>any</em> of the comma-separated trigger phrases appears in a question,
          so prefer specific phrases like “notice period” over single common words.
        </p>
        <form onSubmit={addAnswer} className="grid gap-3 rounded-xl border border-line bg-paper-2 p-4">
          <label className="text-sm font-medium">Trigger phrases (comma-separated)
            <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} maxLength={300} required className={`mt-1 ${input}`} placeholder="notice period, when can he join" />
          </label>
          <label className="text-sm font-medium">Answer
            <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} maxLength={1000} required rows={3} className={`mt-1 ${input}`} />
          </label>
          <button className="justify-self-start rounded-full bg-accent px-5 py-2 font-medium text-accent-ink">Add answer</button>
        </form>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {answers.map((a) => (
            <li key={a.id} className="flex gap-3 p-3 text-sm">
              <div className="flex-1"><p className="font-medium">{a.keywords}</p><p className="text-ink-soft">{a.answer}</p></div>
              <button className="self-start text-ink-soft underline" onClick={() => remove("answers", a.id)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contact messages ({messages.length})</h2>
        <ul className="space-y-3">
          {messages.length === 0 && <li className="text-sm text-ink-soft">No messages yet.</li>}
          {messages.map((m) => (
            <li key={m.id} className="rounded-xl border border-line bg-card p-4 text-sm">
              <p className="font-medium">{m.name} · <a className="text-accent underline" href={`mailto:${m.email}`}>{m.email}</a> <span className="text-xs font-normal text-ink-soft">· {when(m.created_at)}</span></p>
              <p className="mt-2 whitespace-pre-wrap">{m.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2 text-sm text-ink-soft">
        <h2 className="text-xl font-semibold text-ink">Updating your resume data</h2>
        <p>Your profile lives in <code>data/profile.json</code>. Edit it (or rerun <code>npm run resume:pdf</code> after editing), commit and push. Vercel redeploys on its own.</p>
      </section>
    </main>
  );
}
