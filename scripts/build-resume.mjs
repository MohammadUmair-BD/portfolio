// Builds public/<resumeFile>.pdf from data/profile.json using a locally installed Edge or Chrome.
// Usage: npm run resume:pdf
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const p = JSON.parse(readFileSync(join(root, "data/profile.json"), "utf8"));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (ym) => (ym ? `${MONTHS[Number(ym.split("-")[1]) - 1]} ${ym.split("-")[0]}` : "Present");
const range = (a, b) => `${month(a)} – ${month(b)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const bold = (s) => esc(s).replace(/(Laravel \+ Filament|React\/Inertia\.js|WordPress\/Elementor)/g, "<b>$1</b>");

const contact = [
  esc(p.location),
  p.site.showPhone && (process.env.PROFILE_PHONE || p.phone) ? esc(process.env.PROFILE_PHONE || p.phone) : null,
  `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
  p.links.linkedin ? `<a href="${esc(p.links.linkedin)}">LinkedIn</a>` : null,
  p.links.github ? `<a href="${esc(p.links.github)}">GitHub</a>` : null,
].filter(Boolean).join(" &nbsp;|&nbsp; ");

const labels = { backend: "Backend", database: "Database", frontend: "Frontend", tools: "Tools &amp; Workflow", other: "Other", familiar: "Familiar With" };
const skills = Object.entries(labels).map(([cat, label]) => {
  const items = p.skills.filter((s) => s.category === cat);
  if (!items.length) return "";
  const names = items.map((s) => esc(s.name) + (s.note && cat !== "familiar" ? ` (${esc(s.note)})` : s.level && cat !== "familiar" ? ` (${esc(s.level)})` : "")).join(", ");
  const note = cat === "familiar" ? ` (${esc(p.familiarNote.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase()))})` : "";
  return `<p><b>${label}:</b> ${names}${note}</p>`;
}).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.name)} Resume</title><style>
@page { size: A4; margin: 14mm 15mm; }
body { font-family: "Times New Roman", Times, serif; font-size: 10.5pt; color: #111; line-height: 1.3; }
h1 { text-align: center; font-size: 20pt; margin: 0; letter-spacing: .5px; }
.headline { text-align: center; font-weight: bold; margin: 2px 0; }
.contact { text-align: center; font-size: 9.5pt; margin-bottom: 6px; }
a { color: #111; }
h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1.3px solid #111; margin: 10px 0 4px; padding-bottom: 1px; }
.row { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; }
.row span:last-child { font-style: italic; font-weight: normal; }
.sub { font-style: italic; margin-bottom: 2px; }
ul { margin: 2px 0 0; padding-left: 20px; }
li { margin-bottom: 2px; }
p { margin: 2px 0; }
</style></head><body>
<h1>${esc(p.name.toUpperCase())}</h1>
<p class="headline">${esc(p.headline)}</p>
<p class="contact">${contact}</p>
<h2>Summary</h2><p>${esc(p.summary)}</p>
<h2>Experience</h2>
${[...p.experience].sort((a, b) => (b.start > a.start ? 1 : -1)).map((e) => `
<div class="row"><span>${esc(e.role)} — ${esc(e.company)}</span><span>${range(e.start, e.end)}</span></div>
<div class="sub">${esc(e.location)}</div>
<ul>${e.highlights.map((h) => `<li>${bold(h)}</li>`).join("")}</ul>`).join("")}
<h2>Skills</h2>${skills}
<h2>Education</h2>
${p.education.map((e) => `<p><b>${esc(e.degree)}</b> — ${esc(e.institution)} (${range(e.start, e.end)})</p>${e.focus ? `<p class="sub">Focus: ${esc(e.focus)}</p>` : ""}`).join("")}
<h2>Certifications</h2>
<ul>${p.certifications.map((c) => `<li><b>${esc(c.name)}</b> — ${esc(c.issuer)}${c.year ? ` (${esc(c.year)})` : ""}${c.note ? `: ${esc(c.note.replace(/^./, (x) => x.toLowerCase()))}` : ""}</li>`).join("")}</ul>
<h2>Selected Projects</h2>
<ul>${p.projects.filter((x) => x.kind === "personal").map((x) => `<li><b>${esc(x.title)}</b> — ${esc(x.description)}</li>`).join("")}</ul>
<h2>Languages</h2>
<p>${p.languages.map((l) => `${esc(l.name)} (${esc(l.level)})`).join(" &nbsp;|&nbsp; ")}</p>
</body></html>`;

const browsers = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) {
  console.error("No Edge or Chrome found. Set BROWSER_PATH to a Chromium-based browser.");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "resume-"));
const htmlPath = join(dir, "resume.html");
const out = join(root, "public", p.site.resumeFile.replace(/^\//, ""));
writeFileSync(htmlPath, html);
try {
  execFileSync(browser, ["--headless", "--disable-gpu", "--no-pdf-header-footer", `--user-data-dir=${join(dir, "profile")}`, `--print-to-pdf=${out}`, pathToFileURL(htmlPath).href], { stdio: "ignore" });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`Resume written to ${out}`);
