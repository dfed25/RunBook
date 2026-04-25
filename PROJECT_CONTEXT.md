# Runbook Project Context

## What we are building

Runbook is an AI onboarding copilot that helps new employees become productive faster.

Instead of just answering questions, Runbook:
- answers onboarding questions using company docs
- generates onboarding checklists
- guides users through tasks step-by-step
- tracks progress
- shows managers onboarding status

## Core features (MVP)

1. Chat with company docs (RAG-style)
2. Onboarding checklist
3. Task completion tracking
4. Manager dashboard

## Stretch features

- AI-generated onboarding lessons (slides + narration)
- Browser assistant (like Grammarly)

## Tech stack

- Next.js (frontend + backend)
- React + Tailwind
- API routes for backend
- LLM API (OpenAI or similar)
- Simple document retrieval (no complex vector DB needed)

## Key philosophy

Existing tools help users FIND information.
Runbook helps users COMPLETE work.

## Demo story

User: Alex (new engineer)

Flow:
1. Alex opens dashboard
2. sees onboarding checklist
3. asks: "How do I get GitHub access?"
4. Runbook answers with steps + source
5. Alex completes task
6. manager dashboard updates
7. optional: browser assistant helps on external page
