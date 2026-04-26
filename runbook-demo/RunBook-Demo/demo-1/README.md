# RunBook Demo Site

This repository is a realistic SaaS-style web app used to demo the live Runbook widget on a live website.

It is intentionally structured so the widget can infer onboarding guidance from **code + UI context**, not just static docs.

## What this demo app simulates

The app represents an automation product called **Northstar Workflow Builder** with six core product surfaces:

- **Overview**: health metrics, integration coverage, readiness, activity feed
- **Workflows**: trigger-condition-action builder canvas
- **Integrations**: connector cards and connection status
- **API Keys**: key generation and environment scoping
- **Deployments**: rollout progress and rollback controls
- **Settings**: assistant branding and workspace defaults

Every important control includes:

- `data-runbook-feature`
- `data-runbook-title`
- `data-runbook-description`

so Runbook can map user questions to concrete UI locations.

## Core files and how they work

### `index.html`

- Declares all product surfaces and nav controls.
- Uses semantic sections (`view-overview`, `view-workflows`, etc.).
- Embeds the live Runbook script:

```html
<script
  src="https://runbook-main.vercel.app/runbook-embed.js"
  data-project-id="northstar-demo"
  data-runbook-origin="https://runbook-main.vercel.app"
  data-include-body-text
></script>
```

For production demos, replace `data-project-id` with your Studio project id.

### `app.js`

- Handles view switching and active nav state.
- Renders integration cards dynamically from a JS data model.
- Simulates stateful onboarding actions:
  - create API key
  - create workflow shortcut
  - command palette
- Updates activity feed so the page changes in ways the widget can explain.

### `styles.css`

- Defines SaaS dashboard layout and panel/card system.
- Uses responsive grid so the demo still works on smaller screens.
- Keeps controls visually distinct so highlight targeting is reliable.

## Onboarding journey this demo supports

The intended user onboarding sequence:

1. Open **Integrations** and connect at least one source + one destination.
2. Generate a **staging API key** in API Keys.
3. Build and save first automation in **Workflows**.
4. Verify rollout health in **Deployments** and review **Settings** defaults.

## Suggested questions for live demo

Use these prompts to demonstrate code-aware guidance:

- “What should I do first on this page?”
- “Where do I connect Slack?”
- “How do I create a workflow?”
- “What does deployment readiness depend on?”
- “Where do I generate API keys for staging?”

## Why this repo helps Runbook inference

This repo includes:

- meaningful file and symbol names
- explicit UI metadata attributes
- realistic product workflows and dependencies
- concrete action controls that can be highlighted

That combination gives Runbook enough signal to infer onboarding guidance from the repository itself and page context.

## Running locally

No build step required.

Option 1 (Python):

```bash
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Option 2 (VS Code Live Server): serve the repo root.

## Demo checklist

- [ ] Widget appears on page load
- [ ] Ask “what can I do here?” and verify contextual answer
- [ ] Ask location question and verify element highlight
- [ ] Toggle through all nav views and repeat
- [ ] Validate onboarding sequence guidance remains consistent
