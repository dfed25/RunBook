# Runbook

**Runbook** is an embeddable AI onboarding assistant. Companies connect or import docs, configure the assistant in **Studio**, and embed it into any app or site. The assistant answers questions using **seeded demo knowledge** plus any **manual sources** you add in Studio (stored in the browser until real integrations ship).

**Tagline:** Turn your docs into an embedded onboarding copilot.

## What it does

1. **Knowledge** — Curated demo docs (engineering setup, first week, security, product, expenses). In Studio you can also paste a **public GitHub repo URL** and import a broad repo snapshot (README + docs + common source files such as `src/**/*.{ts,tsx,js,py,go,...}` within demo limits).
2. **Studio (`/studio`)** — Edit assistant name, welcome message, primary color, suggested questions, and manual sources. Changes persist to `localStorage` key `runbook_demo_bundle_v1` and update the **live preview** (same `EmbeddedRunbookAssistant` as embed-demo).
3. **Embed** — Two options:
   - **React (recommended for Next apps):** import `EmbeddedRunbookAssistant` from `@/components/EmbeddedRunbookAssistant`.
   - **Script tag (any HTML page):** load `public/runbook-embed.js` with `data-project-id="northstar-demo"`. On the **same origin**, the script reads `runbook_demo_bundle_v1` for welcome, title, color, suggestions, and `customSources` on each chat request.

4. **Chat API** — `POST /api/embed/chat` returns **answer**, **sources** (with excerpts), and **steps**. If `documents` are provided in the request (Studio/embed demo flow), retrieval uses those imported docs. Otherwise it falls back to seeded demo docs. LLM uses **Gemini** (with **OpenAI** fallback) when keys are available.

## Demo flow (keep this working)

1. Open **`/`** — marketing landing.
2. Open **`/studio`** — paste `https://github.com/owner/repo` and click **Connect GitHub repo**.
3. Confirm imported docs are listed + embed code updates with project id (`owner-repo`).
4. Open **`/embed-demo`** — banner shows which repo currently powers answers.
5. Ask a docs-related question in the assistant and verify steps + sources reference imported docs.
6. Optional: in Studio save multiple repo imports as **test agent profiles**, then switch between them in `/embed-demo` to simulate different customer apps/AI agents.

## Routes

| Route | Purpose |
|--------|---------|
| `/` | Landing |
| `/studio` | Studio — config, sources, embed code, live assistant preview |
| `/embed-demo` | Sample customer page + embedded assistant |
| `/runbook-embed.js` | Static embed script (`public/runbook-embed.js`) |
| `POST /api/embed/chat` | Body: `projectId`, `message`, optional `pageContext`, optional `customSources` (demo) |
| `POST /api/github/import` | Body: `repoUrl`; imports readable docs from a public GitHub repository |

Bearer-authenticated `projectId` (non-demo) uses indexed project retrieval when Supabase is wired; see route implementation.

## Tech stack

- **Next.js** (App Router) + React + Tailwind
- **Gemini** + optional **OpenAI** fallback (`src/lib/ai.ts`) for text generation
- **Keyword retrieval** for the public demo (`src/lib/embedKeywordRetrieval.ts`) — no extra vector DB for `northstar-demo`
- **Supabase** (optional) for vector-backed keyed projects

## Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, `/studio`, and `/embed-demo`.

```bash
npm run build
```

## Environment variables

See `.env.example`. The app **must not crash** if keys are missing.

| Variable | Role |
|----------|------|
| `GEMINI_API_KEY` | Primary LLM for `/api/embed/chat` (northstar + keyed paths use `generateFromGemini`) |
| `OPENAI_API_KEY` | Optional: used if Gemini fails or is absent (see `generateFromGemini` in `src/lib/ai.ts`) |
| Supabase / GitHub / OAuth | Optional for production-style indexing and keyed embeds |

**Northstar demo:** no keys required — keyword retrieval + scripted fallbacks for GitHub access, local setup, first steps, “explain this page”, security rules, etc.

## Persistence note

Studio and embed-demo share browser `localStorage` in the same origin:

- `runbook_assistant_config`
- `runbook_project_id`
- `runbook_imported_docs`
- `runbook_imported_repo`

The vanilla **`/runbook-embed.js`** widget can also read these same-origin keys.

Project scoping note: imported docs are only attached to chat when the current widget/assistant `projectId` matches `runbook_project_id`, so different repos produce different embed snippets and different AI context.

## TODOs / extensions

- Server-side persistence for Studio config and manual sources.
- Wire real GitHub / Notion ingestion into retrieval for production projects.
- Billing / multi-tenant auth — out of scope for this demo.

## Legacy code

Routes such as `/dashboard`, `/manager`, `/demo/*` may still exist but are **not** part of the main product shell.
