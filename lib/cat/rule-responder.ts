import { SKILL_ALIASES } from "@/config/skill-aliases";
import { RELATED_SKILLS } from "@/config/skill-related";
import { formatRange, monthsOfExperience, skillsByCategory, voice, type Profile } from "@/lib/profile-shared";
import { contentTokens, editDistance, hasPhrase, normalize, wordMatches } from "./text";
import type { CatLink, CatReply, CatResponder, CustomAnswer } from "./types";

type Weighted = [string, number][];
type IntentDef = { name: string; phrases?: Weighted; keywords?: Weighted };

const CONFIDENCE = 2;

/** Order matters for ties: earlier wins. */
const INTENTS: IntentDef[] = [
  { name: "about_cat", phrases: [["who are you", 6], ["your name", 6], ["what are you", 5], ["are you a bot", 6], ["are you real", 5], ["are you ai", 5], ["are you human", 5]], keywords: [["cat", 2], ["kitty", 2], ["bot", 2], ["chatbot", 3]] },
  { name: "salary", phrases: [["salary expectations", 6], ["how much", 3], ["expected salary", 6]], keywords: [["salary", 5], ["compensation", 5], ["ctc", 4], ["rate", 2], ["rates", 2], ["pay", 2], ["hourly", 3], ["budget", 2], ["charge", 2], ["cost", 2], ["price", 2], ["expectations", 2]] },
  { name: "current_role", phrases: [["current job", 6], ["current role", 6], ["current company", 6], ["work now", 5], ["working now", 5], ["right now", 3], ["latest job", 5], ["most recent", 4], ["last job", 5], ["recent role", 5]], keywords: [["currently", 3], ["present", 2]] },
  { name: "years_experience", phrases: [["how many years", 6], ["years of experience", 6], ["how long", 3], ["how experienced", 4]], keywords: [["years", 2], ["senior", 2], ["junior", 2]] },
  { name: "availability", phrases: [["notice period", 6], ["open to work", 5], ["when can", 3], ["looking for", 3], ["start date", 6], ["can he start", 6], ["can start", 4]], keywords: [["available", 4], ["availability", 4], ["notice", 3], ["freelance", 3], ["join", 2], ["joining", 3], ["start", 2], ["immediately", 3]] },
  { name: "location", phrases: [["where is he", 3], ["where is she", 3], ["where are they", 3], ["where does he live", 5], ["where is he from", 5], ["time zone", 4], ["work from home", 5], ["on site", 4]], keywords: [["located", 4], ["location", 4], ["based", 3], ["live", 2], ["lives", 2], ["city", 3], ["country", 3], ["remote", 4], ["relocate", 4], ["relocation", 4], ["onsite", 3], ["hybrid", 3], ["timezone", 4], ["where", 1], ["wfh", 4], ["remotely", 4], ["move", 2], ["moving", 2], ["abroad", 4], ["gulf", 4], ["dubai", 3], ["uae", 3], ["saudi", 3], ["qatar", 3], ["ksa", 3], ["karachi", 2], ["islamabad", 2]] },
  { name: "languages", phrases: [["spoken languages", 6], ["languages does", 4], ["languages he speaks", 6]], keywords: [["speak", 3], ["speaks", 3], ["english", 3], ["urdu", 3], ["spoken", 3]] },
  { name: "resume", phrases: [["download resume", 6], ["download cv", 6]], keywords: [["cv", 4], ["resume", 4], ["pdf", 2], ["download", 2]] },
  { name: "contact", phrases: [["get in touch", 5], ["reach out", 4], ["talk to", 3], ["phone number", 5]], keywords: [["contact", 4], ["email", 4], ["mail", 3], ["reach", 2], ["hire", 4], ["hiring", 3], ["linkedin", 3], ["phone", 3], ["whatsapp", 3], ["call", 2], ["number", 1], ["interview", 3]] },
  { name: "certifications", keywords: [["certificates", 4], ["certificate", 4], ["certifications", 4], ["certification", 4], ["certified", 4], ["courses", 3], ["course", 3], ["coursera", 4]] },
  { name: "education", keywords: [["degree", 4], ["university", 4], ["education", 4], ["college", 4], ["studied", 3], ["study", 2], ["graduate", 3], ["graduated", 3], ["graduation", 3], ["bachelor", 4], ["bachelors", 4], ["school", 3], ["qualification", 3], ["qualifications", 3]] },
  { name: "experience", phrases: [["work history", 6], ["work experience", 6], ["worked at", 4], ["where has", 3], ["where did", 3], ["past jobs", 5]], keywords: [["experience", 3], ["worked", 3], ["jobs", 3], ["job", 2], ["employment", 3], ["career", 3], ["history", 2], ["companies", 3], ["employers", 3], ["work", 1]] },
  { name: "projects", phrases: [["what has he built", 6], ["what did he build", 6], ["side projects", 6]], keywords: [["projects", 4], ["project", 3], ["built", 3], ["build", 2], ["portfolio", 3], ["clients", 2], ["apps", 2], ["websites", 2], ["examples", 2]] },
  { name: "skills_overview", phrases: [["tech stack", 6], ["programming languages", 6], ["what can he do", 4]], keywords: [["skills", 4], ["skill", 3], ["stack", 3], ["technologies", 4], ["tech", 2], ["tools", 2], ["frameworks", 3], ["expertise", 3], ["strengths", 3]] },
  { name: "about", phrases: [["who is", 4], ["tell me about him", 5], ["tell me about her", 5], ["tell me about them", 5], ["tell me about umair", 5], ["about umair", 4], ["about him", 4]], keywords: [["summary", 4], ["bio", 4], ["background", 4], ["introduce", 3], ["overview", 3], ["profile", 2]] },
  { name: "greeting", phrases: [["good morning", 4], ["good evening", 4], ["good afternoon", 4], ["assalamu alaikum", 4], ["whats up", 3]], keywords: [["hi", 3], ["hello", 3], ["hey", 3], ["hiya", 3], ["salam", 3], ["yo", 2]] },
  { name: "thanks", keywords: [["thanks", 4], ["thank", 4], ["thx", 4], ["ty", 3], ["appreciate", 3], ["helpful", 2], ["great", 1], ["awesome", 1], ["cool", 1]] },
  { name: "bye", phrases: [["see you", 4], ["see ya", 4]], keywords: [["bye", 4], ["goodbye", 4], ["cya", 4]] },
];

const INTENT_WORDS = new Set([
  ...INTENTS.flatMap((i) => (i.keywords ?? []).flatMap(([w]) => [w, `${w}s`])),
  "where", "there", "their", "great", "learn", "later", "teach", "reached", "reacts",
]);

/** Words that, next to a technology, mean "does he have this skill?". */
const SKILL_TRIGGERS = ["know", "knows", "familiar", "experience", "experienced", "worked", "work", "use", "uses", "used", "proficient", "skilled", "good", "any", "can", "expert", "fluent"];
const UNKNOWN_TERM_PATTERN =
  /(?:know|knows|familiar with|experience (?:with|in)|worked with|work with|uses?|used|proficient (?:in|with)|skilled (?:in|with)|good (?:at|with)|expert in|fluent in)\s+(.+?)(?:\s+(?:experience|skills?|before))?$/;

const GENERIC_TITLE_WORDS = new Set(["system", "platform", "smart", "contract", "group", "care", "salon", "hair", "assistant", "doctors", "web"]);

export class RuleBasedResponder implements CatResponder {
  private readonly first: string;
  /** he/him/his from the profile, or the first name if no pronouns are set. */
  private readonly v: ReturnType<typeof voice>;
  private readonly aliases: Map<string, string>;

  constructor(private readonly p: Profile) {
    this.first = p.name.split(" ").at(-1) ?? p.name;
    this.v = voice(p);
    this.aliases = new Map(Object.entries(SKILL_ALIASES));
    for (const s of p.skills) this.aliases.set(s.name.toLowerCase(), s.name);
    for (const proj of p.projects) for (const t of proj.tech) this.aliases.set(t.toLowerCase(), t);
  }

  get suggestions(): string[] {
    const { his, he, him } = this.v;
    return [`What are ${his} skills?`, `Does ${he} know Laravel?`, `Where has ${he} worked?`, "Show me projects", `How do I contact ${him}?`];
  }

  respond(question: string, customAnswers: CustomAnswer[] = []): CatReply {
    const q = normalize(question).slice(0, 300);
    if (!q) return this.fallback();

    const custom = this.matchCustom(q, customAnswers);
    if (custom) return custom;

    const tokens = contentTokens(q);
    const scores = new Map<string, number>();
    for (const intent of INTENTS) scores.set(intent.name, this.score(q, tokens, intent));

    const terms = this.techTerms(q, tokens);
    const triggered = SKILL_TRIGGERS.some((t) => tokens.includes(t) || hasPhrase(q, t));
    let unknownTerm: string | null = null;
    if (terms.length) {
      scores.set("skill_check", 4 + (triggered ? 2 : 0));
    } else {
      unknownTerm = this.unknownTerm(q);
      if (unknownTerm) scores.set("skill_check", 2.5);
    }

    const project = this.mentionedProject(q, tokens);
    if (project) scores.set("project_detail", 5);
    const company = this.mentionedCompany(tokens);
    if (company) scores.set("experience_detail", 5);

    let best = "";
    let bestScore = 0;
    for (const [name, score] of scores) if (score > bestScore) [best, bestScore] = [name, score];
    if (bestScore < CONFIDENCE) return this.fallback();

    switch (best) {
      case "skill_check": return terms.length ? this.skillCheck(terms) : this.skillMissing([unknownTerm!]);
      case "project_detail": return this.projectDetail(project!);
      case "experience_detail": return this.experienceDetail(company!);
      case "location": return this.location(q, tokens);
      default: return (this.replies[best] ?? (() => this.fallback()))();
    }
  }

  // ---------------------------------------------------------------- matching

  private score(q: string, tokens: string[], intent: IntentDef): number {
    let score = 0;
    for (const [phrase, w] of intent.phrases ?? []) if (hasPhrase(q, phrase)) score += w;
    for (const [word, w] of intent.keywords ?? []) {
      if (tokens.some((t) => t === word || t === `${word}s`)) score += w;
      else if (tokens.some((t) => wordMatches(t, word))) score += w * 0.8;
    }
    return score;
  }

  private matchCustom(q: string, custom: CustomAnswer[]): CatReply | null {
    let best: CustomAnswer | null = null;
    let bestHits = 0;
    for (const c of custom) {
      const hits = c.keywords.split(",").map((k) => normalize(k)).filter((k) => k && hasPhrase(q, k)).length;
      if (hits > bestHits) [best, bestHits] = [c, hits];
    }
    return best ? this.reply("custom", best.answer, [this.emailLink()]) : null;
  }

  /** Canonical names of every technology mentioned, known to the profile or not. */
  private techTerms(q: string, tokens: string[]): string[] {
    const found = new Set<string>();
    const keys = [...this.aliases.keys()].sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (key.includes(" ") || key.includes("/") ? hasPhrase(q, key) : tokens.includes(key)) found.add(this.aliases.get(key)!);
    }
    if (!found.size) {
      // Typos like "laravle": only for longer words, only against single-word aliases,
      // and never for words an intent already uses ("reach" must not become "React").
      for (const t of tokens) {
        if (t.length < 5 || INTENT_WORDS.has(t)) continue;
        const hit = keys.find((k) => !k.includes(" ") && k.length >= 5 && editDistance(t, k) <= 1);
        if (hit) found.add(this.aliases.get(hit)!);
      }
    }
    return [...found].slice(0, 3);
  }

  private unknownTerm(q: string): string | null {
    const m = q.match(UNKNOWN_TERM_PATTERN);
    if (!m) return null;
    const words = contentTokens(m[1]).filter((w) => !["experience", "skills", "anything", "stuff", "things", "that", "this", "it", "well"].includes(w));
    if (!words.length || words.length > 3) return null;
    return words.join(" ");
  }

  private mentionedProject(q: string, tokens: string[]) {
    return this.p.projects.find((proj) => {
      const title = normalize(proj.title);
      if (hasPhrase(q, title)) return true;
      const distinctive = title.split(" ").filter((w) => w.length >= 4 && !GENERIC_TITLE_WORDS.has(w));
      return distinctive.some((w) => tokens.some((t) => wordMatches(t, w)));
    });
  }

  private mentionedCompany(tokens: string[]) {
    return this.p.experience.find((e) => {
      const words = normalize(e.company).split(" ").filter((w) => w.length >= 3 && !["limited", "ltd", "digital", "asset", "integrity"].includes(w));
      return words.some((w) => tokens.some((t) => wordMatches(t, w)));
    });
  }

  // ----------------------------------------------------------------- replies

  private reply(intent: string, text: string, links: CatLink[] = [], suggestions: string[] = []): CatReply {
    return { intent, text, links, suggestions, answered: true };
  }

  private emailLink(): CatLink {
    return { label: this.p.email, href: `mailto:${this.p.email}` };
  }

  private contactLinks(): CatLink[] {
    const links = [this.emailLink()];
    if (this.p.links.linkedin) links.push({ label: "LinkedIn", href: this.p.links.linkedin });
    links.push({ label: "Contact form", href: "/quick#contact" });
    return links;
  }

  fallback(): CatReply {
    return {
      intent: "fallback",
      text: `Sorry, I don't have information on that. I can answer questions about ${this.first}'s skills, experience, projects, education, and contact details. For anything else, please reach out at ${this.p.email}.`,
      links: [this.emailLink()],
      suggestions: this.suggestions,
      answered: false,
    };
  }

  private readonly replies: Record<string, () => CatReply> = {
    greeting: () =>
      this.reply("greeting", `Hi there! 🐾 I'm ${this.p.site.catName}, ${this.first}'s assistant. Ask me anything about ${this.v.his} work.`, [], this.suggestions.slice(0, 3)),

    about: () => this.reply("about", `${this.p.name}, ${this.p.headline}. ${this.p.summary}`, [{ label: "Quick view", href: "/quick" }]),

    about_cat: () =>
      this.reply("about_cat", `I'm ${this.p.site.catName}, ${this.first}'s cat and tour guide. *purr* I'm a simple rule-based helper, not an AI, and every answer comes from ${this.v.his} resume.`, [], this.suggestions.slice(0, 3)),

    skills_overview: () => {
      const lines = skillsByCategory(this.p).map((g) => `${g.label}: ${g.skills.map((s) => s.name).join(", ")}`);
      return this.reply("skills_overview", `Here's ${this.first}'s stack. ${lines.join(". ")}.`, [{ label: "See all skills", href: "/quick#skills" }]);
    },

    experience: () => {
      const jobs = this.p.experience.map((e) => `${e.role} at ${e.company} (${formatRange(e.start, e.end)})`);
      return this.reply("experience", `${this.first}'s work history, newest first: ${jobs.join("; ")}.`, [{ label: "Full timeline", href: "/quick#experience" }]);
    },

    current_role: () => {
      const current = this.p.experience.find((e) => !e.end);
      if (current) return this.reply("current_role", `${this.first} is currently ${current.role} at ${current.company} (since ${formatRange(current.start, null).split(" – ")[0]}).`);
      const last = this.p.experience[0];
      return this.reply("current_role", `${this.first}'s most recent role was ${last.role} at ${last.company} (${formatRange(last.start, last.end)}).`, this.contactLinks());
    },

    years_experience: () => {
      const years = Math.max(1, Math.round(monthsOfExperience(this.p) / 12));
      const since = [...this.p.experience].sort((a, b) => (a.start > b.start ? 1 : -1))[0];
      return this.reply("years_experience", `About ${years} year${years === 1 ? "" : "s"} of professional experience, starting at ${since.company} in ${formatRange(since.start, null).split(" – ")[0]}.`, [{ label: "Full timeline", href: "/quick#experience" }]);
    },

    projects: () => {
      const names = this.p.projects.map((p) => p.title);
      return this.reply("projects", `${this.first} has worked on ${names.length} projects, including ${names.slice(0, 4).join(", ")}. Ask me about any of them by name!`, [{ label: "All projects", href: "/quick#projects" }]);
    },

    education: () => {
      const ed = this.p.education.map((e) => `${e.degree} from ${e.institution} (${formatRange(e.start, e.end)})`);
      return this.reply("education", `${this.first} has a ${ed.join("; ")}.`);
    },

    certifications: () => {
      const certs = this.p.certifications.map((c) => `${c.name} (${c.issuer}${c.year ? `, ${c.year}` : ""})`);
      return this.reply("certifications", `${this.first}'s certifications: ${certs.join(", ")}.`, [{ label: "Timeline", href: "/quick#experience" }]);
    },

    languages: () => this.reply("languages", `${this.first} speaks ${this.p.languages.map((l) => `${l.name} (${l.level})`).join(" and ")}.`),

    contact: () => {
      const phone = this.p.phone ? ` or call ${this.p.phone}` : "";
      return this.reply("contact", `The best way to reach ${this.first} is by email at ${this.p.email}${phone}. You can also use the contact form. 🐾`, this.contactLinks());
    },

    resume: () => this.reply("resume", `Here's ${this.first}'s resume as a PDF.`, [{ label: "Download resume", href: this.p.site.resumeFile }]),

    availability: () =>
      this.p.availability ? this.reply("availability", this.p.availability.cat, this.contactLinks()) : this.fallback(),

    salary: () =>
      this.reply("salary", `That's best discussed with ${this.first} directly, since it depends on the role. You can reach ${this.v.him} at ${this.p.email}.`, this.contactLinks()),

    thanks: () => this.reply("thanks", `You're welcome! *purr* If you'd like to talk to ${this.v.him}, email ${this.p.email}.`, this.contactLinks()),

    bye: () => this.reply("bye", `Bye for now! 🐾 ${this.first} is at ${this.p.email} if you want to get in touch.`, this.contactLinks()),
  };

  private location(q: string, tokens: string[]): CatReply {
    const has = (words: string[]) => tokens.some((t) => words.includes(t));
    const asksRemote = has(["remote", "remotely", "onsite", "hybrid", "wfh", "office"]) || hasPhrase(q, "on site") || hasPhrase(q, "work from home");
    const asksRelocation =
      has(["relocate", "relocation", "move", "moving", "abroad", "gulf", "dubai", "uae", "saudi", "qatar", "ksa", "karachi", "islamabad"]) ||
      tokens.some((t) => wordMatches(t, "relocate"));
    const based = `${this.first} is based in ${this.p.location}.`;
    if (!asksRemote && !asksRelocation) return this.reply("location", based);

    // Only answer what the profile actually says; otherwise admit it.
    const prefs = this.p.workPreferences;
    const parts = [asksRemote && prefs?.remote?.cat, asksRelocation && prefs?.relocation?.cat];
    if (parts.some((part, i) => [asksRemote, asksRelocation][i] && !part)) return this.fallback();
    return this.reply("location", [based, ...parts.filter(Boolean)].join(" "), this.contactLinks());
  }

  private skillCheck(terms: string[]): CatReply {
    const found: string[] = [];
    const missing: string[] = [];
    const related: string[] = [];
    for (const term of terms) {
      const evidence = this.evidenceFor(term);
      if (evidence) found.push(evidence);
      else if (RELATED_SKILLS[term]?.some((r) => this.p.skills.some((s) => s.name === r))) {
        const listed = RELATED_SKILLS[term].filter((r) => this.p.skills.some((s) => s.name === r));
        related.push(`${term} isn't listed by name, but ${this.first}'s profile includes ${listed.join(", ")}.`);
      } else missing.push(term);
    }
    if (!found.length && !related.length) return this.skillMissing(missing);

    const parts = [...found, ...related];
    if (missing.length) parts.push(`I don't see ${missing.join(" or ")} in the profile, so I can't confirm that.`);
    return this.reply("skill_check", parts.join(" "), missing.length ? [this.emailLink()] : [{ label: "See skills", href: "/quick#skills" }]);
  }

  private evidenceFor(term: string): string | null {
    const lower = term.toLowerCase();
    const skill = this.p.skills.find((s) => s.name.toLowerCase() === lower);
    const projects = this.p.projects.filter((p) => p.tech.some((t) => t.toLowerCase() === lower)).map((p) => p.title);
    const jobs = this.p.experience
      .filter((e) => e.tech.some((t) => t.toLowerCase() === lower) || e.highlights.some((h) => new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(h)))
      .map((e) => e.company);

    if (!skill && !projects.length && !jobs.length) return null;

    if (skill?.category === "familiar") {
      return `${this.first} lists ${skill.name} under "familiar with" (${this.p.familiarNote.replace(/\.$/, "").toLowerCase()}).`;
    }
    const refs: string[] = [];
    if (projects.length) refs.push(`in ${listOf(projects.slice(0, 2))}`);
    if (jobs.length) refs.push(`at ${listOf(jobs.slice(0, 2))}`);
    const level = skill?.level ? ` (${skill.level} level)` : "";
    return `Yes. ${this.first} has worked with ${term}${level}${refs.length ? `, for example ${refs.join(" and ")}` : ""}.`;
  }

  private skillMissing(terms: string[]): CatReply {
    const what = terms.join(" or ");
    return {
      ...this.reply("skill_check", `I don't see ${what} in ${this.first}'s profile, so I can't confirm that experience. You can ask ${this.v.him} directly at ${this.p.email}.`, [this.emailLink()], this.suggestions.slice(0, 3)),
    };
  }

  private projectDetail(p: Profile["projects"][number]): CatReply {
    const links: CatLink[] = [];
    if (p.url) links.push({ label: "Live site", href: p.url });
    if (p.repo) links.push({ label: "Code", href: p.repo });
    const tech = p.tech.length ? ` Built with ${listOf(p.tech)}.` : "";
    return this.reply("project_detail", `${p.title}: ${p.description}${tech}`, links);
  }

  private experienceDetail(e: Profile["experience"][number]): CatReply {
    return this.reply("experience_detail", `${this.first} ${e.end ? "was" : "is"} ${e.role} at ${e.company} (${formatRange(e.start, e.end)}, ${e.location}). ${e.highlights[0]}`, [{ label: "Full timeline", href: "/quick#experience" }]);
  }
}

function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
