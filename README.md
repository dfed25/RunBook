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
