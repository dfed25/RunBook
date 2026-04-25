# Runbook

Runbook is an AI onboarding copilot that turns scattered company knowledge into step-by-step onboarding workflows.

## What it does
- Answers new hire questions using company documents
- Generates onboarding checklists
- Tracks task progress
- Shows manager visibility into onboarding
- Turns docs into short onboarding lessons
- Supports a manager control plane to add/remove hires and attach per-hire knowledge links (Notion, Google, Slack, URL)

## Supabase Integration Guide (For Teammates)

1. **Install packages**
Run this command to install the required dependencies (Already completed on branch):
```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. **Add Env Variables**
Make sure `.env.local` possesses the correct Supabase connection strings (get values from the team or Supabase dashboard):
```txt
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

3. **Supabase Client Helpers**
The architecture heavily relies on pre-built client wrappers mapped under `src/utils/supabase/`. 
- `src/utils/supabase/server.ts` handles SSR queries (e.g. inside `page.tsx` React Server Components).
- `src/utils/supabase/client.ts` handles traditional CSR browser connections.
- `src/utils/supabase/middleware.ts` forces secure session refreshes.

## Demo QA flow (Playwright)

With the dev server running (`npm run dev` in another terminal), install browsers once (`npx playwright install chromium`), then run `npm run qa:flow`. The script writes `QA_BUG_LOG.md` and `screenshots/` in the project root (both are gitignored). Set `BASE_URL` if the app is not on `http://localhost:3000`. The process exits with a non-zero code when bugs are logged or the run crashes.

## Manager onboarding control plane flow

1. Open `/manager/tasks`.
2. Add a hire (name/role/email).
3. Select the hire and attach knowledge links (Notion pages/databases, Google Docs/folders/files, Slack channels, URLs).
4. Click **Sync selected hire** to ingest source content into the vector store (URLs are fetched and parsed immediately; provider-backed enrichment runs when API credentials are configured).
5. Create/duplicate onboarding tasks and assign by hire.
6. Open `/dashboard`, select the same hire, then test:
   - task checklist is scoped to that hire
   - chat answers are generated from hire-scoped context with richer citation cards (including source URLs when present)
   - lesson generation can use hire-scoped retrieval when a query is provided

## API endpoints (manager flow)

- `GET/POST /api/manager/hires`
- `PATCH/DELETE /api/manager/hires/:hireId`
- `GET/POST /api/manager/hires/:hireId/sources`
- `DELETE /api/manager/hires/:hireId/sources/:sourceId`
- `POST /api/sync/knowledge` (optional body: `{ "hireId": "..." }`)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

**Example Usage in `page.tsx`:**
```tsx
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <ul>
      {todos?.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
```

## Setup reminders

- Apply `supabase/migrations/00000000000000_init_vector_db.sql` in Supabase Studio.
- Set provider credentials in `.env.local` to enable live ingestion depth.
