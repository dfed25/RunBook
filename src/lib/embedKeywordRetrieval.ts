import type { SourceDoc } from "./types";

export type KeywordRetrieved = {
  doc: SourceDoc;
  score: number;
};

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Simple overlap scoring — reliable without a vector DB. */
export function retrieveKeywordSources(query: string, docs: SourceDoc[], topK = 3): KeywordRetrieved[] {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return docs.slice(0, topK).map((doc) => ({ doc, score: 1 }));
  }

  const scored = docs.map((doc) => {
    const hay = `${doc.title}\n${doc.content}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += hay.split(t).length - 1 + 2;
    }
    if (doc.title.toLowerCase().split(/\s+/).some((w) => terms.includes(w))) score += 4;
    return { doc, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
