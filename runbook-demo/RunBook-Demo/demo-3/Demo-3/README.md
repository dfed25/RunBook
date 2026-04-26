# RunBook-Demo2: Ultra Blog Article Demo

This project is now a standalone demo blog article that balances:

- human-friendly reading and interaction
- AI-friendly structure and parsing
- advanced features with built-in explanations

## Included Features

- Like action with persistent count
- Save/Unsave action with local persistence
- Highlight notes (simulates reader annotations)
- Explain mode for advanced components
- AI-friendly structured blocks via `data-ai-*` attributes
- Compact machine outline rendered as JSON for quick AI ingestion

## Ultra Components In The Article

1. **Quick Summary** - short bullets for fast skimming and extraction
2. **Decision Matrix** - compares approaches for people + AI
3. **Key Facts** - stable key/value pairs for low-ambiguity parsing
4. **Machine Outline** - JSON snapshot of document metadata + engagement

## Run Locally

From repo root:

```bash
python -m http.server 8082
```

Or with npm:

```bash
npm start
```

Stop the npm server:

```bash
npm run stop
```

Open:

- `http://127.0.0.1:8082`

## Demo Script (2-4 Minutes)

1. Open article and show semantic sections + `data-ai-*` attributes.
2. Click **Like** and **Save** to show interactive state updates.
3. Toggle **Explain Advanced Features** to reveal user-focused help text.
4. Add a couple of **Highlight Notes** and show dashboard updates.
5. Refresh page and show persistence from `localStorage`.

## Files

- `index.html` - article layout, ultra components, and dashboard panels
- `styles.css` - visual design and explain-mode behavior
- `app.js` - state management and interactive logic
