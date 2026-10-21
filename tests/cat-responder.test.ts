import { describe, expect, it } from "vitest";
import { RuleBasedResponder } from "@/lib/cat/rule-responder";
import { profile } from "@/lib/profile";
import type { Profile } from "@/lib/profile-shared";

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
    expect(ask("is he open to remote work?").intent).toBe("fallback");
    expect(ask("is she available?").intent).toBe("fallback");
  });

  it("answers availability and remote when the profile provides them", () => {
    const withPrefs: Profile = { ...profile, availability: "Available immediately.", workPreferences: { remote: "Open to remote roles." } };
    const c = new RuleBasedResponder(withPrefs);
    expect(c.respond("is he available").text).toBe("Available immediately.");
    expect(c.respond("remote?").text).toContain("Open to remote roles.");
  });

  it("never shows the phone number unless enabled", () => {
    expect(ask("phone number").text).not.toContain("316");
  });
});

describe("custom answers", () => {
  it("are checked before built-in intents", () => {
    const r = cat.respond("what is his notice period?", [{ id: 1, keywords: "notice period, joining", answer: "Two weeks." }]);
    expect(r.intent).toBe("custom");
    expect(r.text).toBe("Two weeks.");
  });
});
