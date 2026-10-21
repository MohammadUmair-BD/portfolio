# Muhammad Umair — Portfolio

A personal portfolio with two ways in:

- **Explore my world** (`/explore`): a low-poly 3D developer room. Each object opens a section, and Miso the cat gives a guided tour and answers questions.
- **Quick view** (`/quick`): a fast, static, one-page resume that works without WebGL or JavaScript.

Built with Next.js 16, React 19, Three.js (React Three Fiber), GSAP and Tailwind CSS 4. It runs free on Vercel, with an optional free Neon Postgres database. No paid APIs are used.

## Run it locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # then fill in what you need (all optional)
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Chat matcher and API tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run resume:pdf` | Regenerates `public/Muhammad_Umair_Resume.pdf` from the profile data (needs Edge or Chrome installed; set `BROWSER_PATH` if it isn't found) |

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the defaults (it detects Next.js).
3. Optional: in **Storage**, add a **Neon** Postgres database (free tier). Vercel sets `DATABASE_URL` for you. The tables are created automatically on first use.
4. In **Settings → Environment Variables**, add `ADMIN_PASSWORD` (12+ characters) and `SITE_URL` (your Vercel URL). Add `PROFILE_PHONE` only if you turn the phone on.
5. Redeploy. Every later `git push` deploys automatically.

## Updating your resume data (re-import)

All site content, the chat answers and the PDF come from **`data/profile.json`**. Nothing is hard-coded elsewhere.

1. Edit `data/profile.json`, for example a new job, project or skill. Dates use `YYYY-MM`, and `"end": null` means a current job.
2. Run `npm run resume:pdf` so the downloadable PDF matches.
3. Run `npm test`, then commit and push.

Useful switches inside `profile.json`:

- `site.showPhone`: shows your phone number (set `PROFILE_PHONE` too). Off by default.
- `site.catName`: the cat's name.
- `availability`, `workPreferences`: leave `null` and the cat says it doesn't know. Fill them in, for example `"availability": "Available from November 2026."` or `"workPreferences": { "remote": "Open to remote roles." }`, and the cat will answer.
- `links.linkedin`, `links.github`: shown on the site and in the chat when filled in.

There is deliberately no resume-upload page. On serverless hosting, uploaded files don't persist, and editing one JSON file is simpler and reviewable in git.

## Admin page (`/admin`)

Log in with `ADMIN_PASSWORD`. It needs `DATABASE_URL`. On this page you can:

- See questions the cat couldn't answer. Only the question text and time are stored.
- Add **custom answers**: comma-separated trigger phrases plus an answer. They're checked before the built-in intents.
- Read contact-form messages.

## How the chat works

`POST /api/cat/ask` → `lib/cat/rule-responder.ts`. It runs entirely without AI:

1. The question is normalized (lowercased, punctuation removed) and filler words are ignored.
2. Every intent is scored using weighted keywords and phrases. One-letter typos, and swapped letters like "laravle", are tolerated on words of 5+ letters.
3. The best intent wins if it passes the confidence threshold. Otherwise the professional fallback is used, and the question is logged.
4. Replies are built from `profile.json`.

To teach it new technology names, edit `config/skill-aliases.ts`. Skills that aren't listed but have a close relative (JavaScript → React, jQuery…) are in `config/skill-related.ts`.

The matcher sits behind the `CatResponder` interface (`lib/cat/types.ts`). To add an AI responder later, implement that interface and swap it in `lib/cat/index.ts`. The frontend doesn't change.

The endpoint is rate limited to 30 questions per minute per IP. The limit is held in memory, so it's best effort on serverless, and questions are capped at 300 characters.

## Editing the tour dialogue

The tour is defined as data in **`lib/tour.ts`**. Each step has a `target` object, a `line`, and a `camera` view. Keep the lines built from `p` (the profile) so they stay true when your data changes. Object positions, the cat's standing spots, and camera close-ups live in `lib/scene-layout.ts`. Move an object there and everything that depends on it follows. Jump arcs are computed at runtime.

## Swapping the cat for a GLB model

The cat is split into a **brain** and a **body**:

- `components/explore/cat-brain.ts` holds the state (`sleep`, `wake`, `idle`, `walk`, `jump`, `sit`, `talk`, `wave`, `swat`), position, heading and movement.
- `components/explore/Cat.tsx` is the primitive-shape body, which reads the brain every frame.

To use a rigged `.glb`:

1. Put the file in `public/models/cat.glb`.
2. Create `CatGLB.tsx`. Load the model with `GLTFLoader` from `three/examples/jsm/loaders/GLTFLoader.js`, and drive its `AnimationMixer` from `brain.state` (map each state to a clip), copying `brain.position` and `brain.heading` onto the model each frame.
3. Render `<CatGLB brain={brain} … />` instead of `<Cat … />` in `components/explore/World.tsx`.

## Privacy and accessibility notes

- Visitor memory (visited, tour done, last section) lives only in `localStorage`. There's no tracking or cookies.
- `prefers-reduced-motion` turns camera swoops into cuts and makes the cat fade between spots.
- Every room object is also a real button in the bottom dock, which helps keyboard, screen-reader and touch users. Dialogs trap focus and close with Esc.
- Rendering pauses when the tab is hidden, and the pixel ratio is capped at 2.
