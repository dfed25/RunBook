export const MAX_ANSWER_WORDS = 10;
export const MAX_BULLET_WORDS = 12;
export const MAX_BULLETS = 3;
export const MAX_STEPS = 4;
export const MAX_SOURCES = 3;
export const MAX_SUGGESTIONS = 3;

export const DEFAULT_SUGGESTIONS = [
  "Guide me step-by-step",
  "Explain this page",
  "What can I do next?"
];

export const DEFAULT_FALLBACK_BULLETS = [
  "Explore key actions",
  "Follow guided steps",
  "Open trusted sources"
];

export function clipWords(text: string, maxWords: number): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

export function normalizeBullets(input: string[]): string[] {
  return input
    .map((b) => clipWords(String(b), MAX_BULLET_WORDS))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

export function normalizeSteps(input: string[]): string[] {
  return input.map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_STEPS);
}

export function normalizeSuggestions(input: string[]): string[] {
  return input.map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_SUGGESTIONS);
}

export function bulletsFromText(text: string): string[] {
  const lines = text
    .split(/\n+|(?<=[.!?])\s+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return normalizeBullets(lines.slice(0, MAX_BULLETS));
}
