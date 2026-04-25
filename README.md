# Runbook

Runbook is an AI onboarding copilot that turns scattered company knowledge into step-by-step onboarding workflows.

## What it does
- Answers new hire questions using company documents
- Generates onboarding checklists
- Tracks task progress
- Shows manager visibility into onboarding
- Turns docs into short onboarding lessons
- Demonstrates a browser assistant that guides users across work tools

## Supabase Integration Guide (For Teammates)

1. **Install packages**
Run this command to install the required dependencies (Already completed on branch):
```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. **Add Env Variables**
Make sure `.env.local` possesses the correct Supabase connection strings:
```txt
NEXT_PUBLIC_SUPABASE_URL=https://dkpwkuhjzmqmrdigpyqj.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_8lxkeU-BTov6OAYW6CsapA_sYB2083n
```

3. **Supabase Client Helpers**
The architecture heavily relies on pre-built client wrappers mapped under `src/utils/supabase/`. 
- `src/utils/supabase/server.ts` handles SSR queries (e.g. inside `page.tsx` React Server Components).
- `src/utils/supabase/client.ts` handles traditional CSR browser connections.
- `src/utils/supabase/middleware.ts` forces secure session refreshes.

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

## 🚀 The To-Do List (What needs to be done next)

**1. Data Source Setup (Database Admin)**
- Navigate to the Supabase Studio SQL editor and execute the file at `supabase/migrations/00000000000000_init_vector_db.sql`. This spins up the PGVector `runbook_documents` table so our API can store embeddings.
- Track down the API Keys for Google Drive, Slack, and Notion and inject them into your `.env.local` alongside your `GEMINI_API_KEY`.

**2. The Sync Trigger (Frontend Team)**
- The backend synchronization engine is fully written inside `src/lib/vectorizer.ts`. 
- The frontend team needs to build a "Sync Knowledge" button in the Dashboard that securely invokes `syncUserKnowledge()` to trigger the mass enterprise data pull and vector embedding cycle!

**3. The UI Elements (Frontend Team)**
- **Chat Panel**: Build a React UI to hit `POST /api/chat`. The backend will natively use Gemini embeddings to search the Supabase Postgres vector database and return markdown chat answers!
- **Tasks & Checklists**: Build the visual checkmark boxes for onboarding tasks.
- **Floating Browser Widget**: Build the Chrome-extension-style widget that floats on demo screens and intercepts workflows.

**Note on "Demo Documents"**: Since we pivoted to live enterprise integrations, we purposefully **do not need fake hardcoded demo documents** locally in the codebase! HOWEVER, **you and your teammates MUST create "live" demonstration documents** inside the actual Notion and Google Drive workspaces, and post some real messages into your connected Slack channel so that when the API sync runs, it actually pulls real text down for your presentation!
