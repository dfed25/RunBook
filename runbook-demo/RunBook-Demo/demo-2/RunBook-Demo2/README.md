# RunBook-Demo2: MercuryOps Commerce Control Center

`RunBook-Demo2` is a standalone e-commerce operations website designed to prove the RunBook widget can adapt to a **different website type and content model** than the original demo.

## Why This Demo Exists

This site intentionally differs from the previous demo in both structure and function:

- Domain is e-commerce operations (not developer tooling flows)
- UI is an operations control center with multi-module workflows
- Onboarding has a long multi-step progression across business systems
- Widget targeting works against new features and metadata

## Tech

- Static `HTML/CSS/JS`
- Local persistence via `localStorage`
- Embedded RunBook snippet for onsite guidance

## Run Locally

From repo root:

```bash
python -m http.server 8082
```

Open:

- `http://127.0.0.1:8082`

Ensure local widget source is running:

- `http://127.0.0.1:3000/runbook-embed.js`

## Onboarding Journey (14 Steps)

1. Add first product collection
2. Configure SKU inventory thresholds
3. Connect payment processor
4. Set tax region defaults
5. Create shipping zone and carrier rule
6. Configure expedited shipping surcharge
7. Enable returns eligibility policy
8. Define returns SLA thresholds
9. Create first discount campaign
10. Configure cart abandonment automation
11. Add support escalation path
12. Invite operations manager role
13. Run launch readiness simulation
14. Pass all launch gating checks

## Suggested Widget Prompts

- "Show me the first step to onboard this operations workspace."
- "Where do I configure inventory thresholds?"
- "Find payment processor setup and explain what to do."
- "What are the launch blockers right now?"
- "Guide me through the shipping and returns configuration steps."

## Judge Demo Script (3-5 Minutes)

1. Start on **Home Ops Snapshot** and ask the widget for a guided onboarding plan.
2. Move through **Catalog**, **Payments**, **Shipping**, and **Returns** by following widget prompts.
3. Show dynamic changes (table updates, status transitions, progress updates).
4. Configure **Marketing** and **Team Permissions**.
5. Run **Launch Readiness** simulation and show gate state flipping to pass.
6. Refresh page and show progress persistence from `localStorage`.

## Files

- `index.html` - full app shell and all module views
- `styles.css` - distinct MercuryOps visual system
- `app.js` - state, onboarding engine, and interaction logic
