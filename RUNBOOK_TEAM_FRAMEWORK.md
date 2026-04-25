# Runbook Team Framework (4-Person Build)

This document is the execution contract for building the Runbook MVP demo in parallel.

## Project purpose

Runbook is an AI onboarding copilot for Northstar AI. The demo must prove that Runbook helps new hires complete onboarding tasks while giving managers clear progress visibility.

## Shared demo context

- New hire: Alex Rivera
- Manager: Maya Chen
- Company: Northstar AI
- Story: Alex asks onboarding questions, completes tasks, and Maya sees progress updates.

## Role ownership

### Person 1 - Content + Frontend A

Owns:
- Landing page (`src/app/page.tsx`)
- Manager dashboard (`src/app/manager/page.tsx`)
- Fake docs and demo narrative (`src/lib/demoDocs.ts`, `src/lib/demoScenario.ts`)
- Seeded demo questions for chat prompts

Definition of done:
- Five detailed fake company docs are complete and internally consistent.
- Landing page clearly presents product value and demo entry points.
- Manager dashboard visually communicates onboarding status and blockers.
- Seeded questions map to docs with clean retrieval/citations.

### Person 2 - Frontend B + Lesson Viewer

Owns:
- New hire dashboard (`src/app/dashboard/page.tsx`)
- Chat UI with source cards
- Task checklist with status badges
- Lesson viewer component and empty/loading states

Definition of done:
- Dashboard renders tasks and progress with smooth state transitions.
- Chat responses render source cards from `/api/chat`.
- Checklist updates call `/api/tasks/update`.
- Lesson viewer consumes `/api/lesson` and handles fallback content.

### Person 3 - Backend + AI

Owns:
- `/api/chat`, `/api/tasks/generate`, `/api/lesson`
- Prompt quality and safety fallbacks (`src/lib/prompts.ts`, `src/lib/ai.ts`)
- Retrieval behavior and citation quality (`src/lib/retrieval.ts`)

Definition of done:
- API responses are typed, stable, and never throw unhandled runtime errors.
- Fallback behavior works with and without API keys.
- Retrieval finds relevant docs for seeded demo questions.
- Prompt outputs are parseable and resilient to model variance.

### Person 4 - Widget + QA + Deployment

Owns:
- Floating widget
- Demo pages (`/demo/github`, `/demo/expenses`)
- End-to-end demo rehearsal and final deploy

Definition of done:
- Widget opens from any demo page and can trigger mark-complete flow.
- `/demo/github` and `/demo/expenses` support realistic walkthrough tasks.
- Repeated end-to-end run has no blocking bugs.
- Production deployment verified with API key and fallback behavior.

## API and data contracts

- `POST /api/chat`
  - Request: `{ question: string }`
  - Response: `{ answer: string, sources?: { title: string, excerpt: string }[] }`

- `GET /api/tasks`
  - Request: none
  - Response: `OnboardingTask[]`

- `POST /api/tasks`
  - Request: `{ title: string, description: string, assignee?: "Alex Rivera" | "Priya Sharma" | "Jordan Lee", estimatedTime?: string, sourceTitle?: string }`
  - Response: `OnboardingTask`

- `PATCH /api/tasks/[taskId]`
  - Request (move): `{ action: "move", direction: "up" | "down" }`
  - Request (duplicate): `{ action: "duplicate", assignees: ("Alex Rivera" | "Priya Sharma" | "Jordan Lee")[] }`
  - Response: `{ success: true, tasks?: OnboardingTask[], created?: OnboardingTask[] }`

- `DELETE /api/tasks/[taskId]`
  - Request: none
  - Response: `{ success: true }`

- `POST /api/tasks/update`
  - Request: `{ taskId: string, status: "todo" | "in_progress" | "complete" }`
  - Response: `{ success: true, task: OnboardingTask }`

- `POST /api/lesson`
  - Request: `{ docId: string }`
  - Response: `{ title, summary, slides, narrationScript }`

## Build sequence and handoffs

1) Person 1 finalizes docs, story, and seeded questions.
2) Person 3 validates retrieval and fallback behavior against seeded questions.
3) Person 2 binds UI to stable APIs and state handling.
4) Person 4 integrates widget and runs full demo loop + deployment.

## Demo quality gates

- Every seeded question returns an actionable answer with at least one relevant source.
- Alex can complete a task and see status update in dashboard view.
- Maya can identify blockers within 10 seconds from manager dashboard.
- Demo works when AI API key is missing (fallback mode).
