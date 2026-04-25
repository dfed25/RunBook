import { demoDocs } from "./demoDocs";
import { SourceDoc } from "./types";

export function retrieveDocs(question: string): SourceDoc[] {
  const q = question.toLowerCase();

  const scored = demoDocs.map((doc) => {
    const text = `${doc.title} ${doc.content}`.toLowerCase();
    const score = q
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);

    return { doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((item) => item.doc);
}