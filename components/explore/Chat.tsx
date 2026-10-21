"use client";

import { useEffect, useRef, useState } from "react";
import type { CatLink, CatReply } from "@/lib/cat/types";
import { isSafeHref } from "@/lib/security";

type Message = { from: "cat" | "you"; text: string; links?: CatLink[]; suggestions?: string[] };

const MAX = 300;
/** A short "typing…" pause of 400–700 ms so replies feel natural. */
const typingPause = () => new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

type Voice = { he: string; him: string; his: string };

export function Chat({ catName, firstName, voice, onClose, onReply }: {
  catName: string;
  firstName: string;
  voice: Voice;
  onClose: () => void;
  /** Called when an answer arrives, so the cat can "talk" it. */
  onReply?: () => void;
}) {
  const chips = [
    { label: "Skills", q: `What are ${voice.his} skills?` },
    { label: "Experience", q: `Where has ${voice.he} worked?` },
    { label: "Projects", q: "Show me projects" },
    { label: "Contact", q: `How do I contact ${voice.him}?` },
    { label: "Download resume", q: "Download resume" },
  ];
  const [messages, setMessages] = useState<Message[]>([
    { from: "cat", text: `Hi! I'm ${catName}. Ask me anything about ${firstName}'s skills, experience, projects or how to get in touch. 🐾` },
  ]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => input.current?.focus(), []);
  // Esc closes the chat wherever focus is (sending disables the Ask button, which drops focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  async function ask(question: string) {
    const q = question.trim().slice(0, MAX);
    if (!q || typing) return;
    setDraft("");
    setMessages((m) => [...m, { from: "you", text: q }]);
    setTyping(true);
    let reply: Message;
    try {
      const [res] = await Promise.all([
        fetch("/api/cat/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) }),
        typingPause(),
      ]);
      const data = (await res.json()) as CatReply & { error?: string };
      reply = res.ok ? { from: "cat", text: data.text, links: data.links?.filter((l) => isSafeHref(l.href)), suggestions: data.suggestions } : { from: "cat", text: data.error ?? "Hmm, something went wrong." };
    } catch {
      reply = { from: "cat", text: "I couldn't reach the server. Check your connection and try again." };
    }
    setTyping(false);
    setMessages((m) => [...m, reply]);
    onReply?.();
    input.current?.focus();
  }

  return (
    <section
      aria-label={`Chat with ${catName}`}
      className="fixed inset-x-2 bottom-2 z-20 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[380px]"
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span aria-hidden>🐱</span>
        <h2 className="font-semibold">Ask me about {firstName}</h2>
        <button onClick={onClose} className="ml-auto rounded-full px-2 py-1 text-sm hover:bg-paper-2" aria-label="Close chat">✕</button>
      </header>

      <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={m.from === "you" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.from === "you" ? "rounded-br-sm bg-accent text-accent-ink" : "rounded-bl-sm bg-card"}`}>
              <p>{m.text}</p>
              {m.links && m.links.length > 0 && (
                <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {m.links.map((l) => (
                    <a key={l.href} href={l.href} className="font-medium text-accent underline underline-offset-2" {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
                      {l.label}
                    </a>
                  ))}
                </p>
              )}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.suggestions.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs hover:border-accent">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start" aria-label={`${catName} is typing`}>
            <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-card px-3.5 py-3">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-soft" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {chips.map((c) => (
          <button key={c.label} onClick={() => ask(c.q)} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent">
            {c.label}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <label htmlFor="cat-question" className="sr-only">Your question</label>
        <input
          id="cat-question"
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX}
          placeholder={`e.g. Does ${voice.he} know Laravel?`}
          className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={!draft.trim() || typing} className="rounded-full bg-ink px-4 text-sm font-medium text-paper disabled:opacity-50">
          Ask
        </button>
      </form>
    </section>
  );
}
