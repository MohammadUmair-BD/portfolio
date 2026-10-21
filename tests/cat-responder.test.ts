import { describe, expect, it } from "vitest";
import { RuleBasedResponder } from "@/lib/cat/rule-responder";
import { profile } from "@/lib/profile";

const cat = new RuleBasedResponder(profile);
const ask = (q: string) => cat.respond(q);

describe("required cases", () => {
  it("greets", () => {
    const r = ask("hi");
    expect(r.intent).toBe("greeting");
    expect(r.suggestions).toHaveLength(3);
  });

  it("confirms a known skill with real references", () => {
    const r = ask("Does he know Laravel?");
    expect(r.intent).toBe("skill_check");
    expect(r.text).toMatch(/^Yes\. Umair has worked with Laravel/);
    expect(r.text).toContain("Sociuu");
  });

  it("does not claim an unknown skill", () => {
    const r = ask("does she know Kubernetes?");
    expect(r.intent).toBe("skill_check");
    expect(r.text).toContain("I don't see Kubernetes");
    expect(r.text).toContain(profile.email);
  });

  it("handles an unknown skill it has never heard of", () => {
    expect(ask("does he know fortran").text).toContain("I don't see fortran");
  });

  it("tolerates a typo", () => {
    const r = ask("laravle experience?");
    expect(r.intent).toBe("skill_check");
    expect(r.text).toContain("Laravel");
  });

  it("never gives a salary number", () => {
    const r = ask("what are his salary expectations?");
    expect(r.intent).toBe("salary");
    expect(r.text.replace(profile.email, "")).not.toMatch(/\d/);
    expect(r.text).toContain(profile.email);
  });

  it("falls back on gibberish and marks it unanswered", () => {
    const r = ask("asdkjh qwpoei zzxv");
    expect(r.intent).toBe("fallback");
    expect(r.answered).toBe(false);
    expect(r.text).toContain("Sorry, I don't have information on that");
  });
});

describe("every intent", () => {
  const cases: [string, string][] = [
    ["who is he", "about"],
    ["tell me about her", "about"],
    ["what are his skills", "skills_overview"],
    ["tech stack", "skills_overview"],
    ["any React experience?", "skill_check"],
    ["work history", "experience"],
    ["where has he worked", "experience"],
    ["what's his current job", "current_role"],
    ["how many years of experience", "years_experience"],
    ["show me projects", "projects"],
    ["what has he built", "projects"],
    ["tell me about the voice assistant", "project_detail"],
    ["what was Ukaam?", "project_detail"],
    ["what did he do at Sociuu", "experience_detail"],
    ["degree", "education"],
    ["which university", "education"],
    ["certificates", "certifications"],
    ["how do I contact him", "contact"],
    ["how can I reach him", "contact"],
    ["email", "contact"],
    ["I want to hire", "contact"],
    ["cv", "resume"],
    ["download resume", "resume"],
    ["where is he based", "location"],
    ["what languages does he speak", "languages"],
    ["who are you", "about_cat"],
    ["what's your name", "about_cat"],
    ["thanks", "thanks"],
    ["bye", "bye"],
  ];
  it.each(cases)("%s → %s", (q, intent) => {
    expect(ask(q).intent).toBe(intent);
  });
});

describe("answers come from data", () => {
  it("rounds years of experience", () => {
    expect(ask("how many years of experience").text).toMatch(/^About \d+ years?/);
  });

  it("explains 'familiar with' skills honestly", () => {
    expect(ask("does he know Vue?").text).toContain('under "familiar with"');
  });

  it("finds skills that only appear in project tech", () => {
    expect(ask("any python experience").text).toContain("Voice Assistant");
  });

  it("points to related skills instead of claiming JavaScript", () => {
    const r = ask("does he know javascript");
    expect(r.text).toContain("isn't listed by name");
    expect(r.text).toContain("React");
  });

  it("reports no current role once the last job has ended", () => {
    expect(ask("where does he work now").text).toContain("most recent role was Backend Developer at Sociuu");
  });

  it("falls back for remote and availability questions when the profile doesn't say", () => {
    const c = new RuleBasedResponder({ ...profile, availability: null, workPreferences: null });
    expect(c.respond("is he open to remote work?").intent).toBe("fallback");
    expect(c.respond("is she available?").intent).toBe("fallback");
  });

  it("falls back on relocation if only remote is known", () => {
    const c = new RuleBasedResponder({ ...profile, workPreferences: { remote: { me: "Remote is fine.", cat: "Remote is fine." } } });
    expect(c.respond("would he relocate?").intent).toBe("fallback");
  });

  it("answers availability, including start times", () => {
    for (const q of ["is he available?", "when can he start?", "notice period?", "can he join immediately"]) {
      const r = ask(q);
      expect(r.intent, q).toBe("availability");
      expect(r.text).toContain("start immediately on remote roles");
    }
  });

  it("answers remote and on-site questions without the relocation part", () => {
    for (const q of ["is he open to remote work?", "can he work remotely?", "would he work on site?", "hybrid ok?"]) {
      const r = ask(q);
      expect(r.intent, q).toBe("location");
      expect(r.text).toContain("open to remote, hybrid or on-site");
      expect(r.text).not.toContain("Gulf");
    }
  });

  it("answers relocation questions", () => {
    for (const q of ["would he relocate?", "can he move to Dubai", "is he open to working in the gulf", "would he relocate to karachi"]) {
      const r = ask(q);
      expect(r.intent, q).toBe("location");
      expect(r.text).toContain("Karachi or Islamabad");
      expect(r.text).toContain("Gulf");
    }
  });

  it("shows the phone number because it is enabled", () => {
    expect(ask("phone number").text).toContain(profile.phone!);
  });
});

describe("pronouns", () => {
  it("uses he/him/his from the profile", () => {
    expect(cat.suggestions).toContain("What are his skills?");
    expect(cat.suggestions).toContain("How do I contact him?");
    expect(ask("salary expectations").text).toContain("reach him at");
  });

  it("uses the first name when no pronouns are set", () => {
    const c = new RuleBasedResponder({ ...profile, site: { ...profile.site, pronouns: undefined } });
    expect(c.suggestions).toContain("What are Umair's skills?");
    expect(c.respond("salary").text).toContain("reach Umair at");
  });
});

describe("project links", () => {
  it("offers the live site for a client project", () => {
    const r = ask("tell me about banibanna");
    expect(r.intent).toBe("project_detail");
    expect(r.text).toContain("matrimonial");
    expect(r.links).toContainEqual({ label: "Live site", href: "https://banibanna.com/" });
  });

  it("has one Banibanna entry (it is the matrimonial platform)", () => {
    expect(profile.projects.filter((p) => /banibanna|matrimonial/i.test(p.title))).toHaveLength(1);
  });
});

describe("custom answers", () => {
  it("are checked before built-in intents", () => {
    const r = cat.respond("what is his notice period?", [{ id: 1, keywords: "notice period, joining", answer: "Two weeks." }]);
    expect(r.intent).toBe("custom");
    expect(r.text).toBe("Two weeks.");
  });
});
