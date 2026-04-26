import type { SourceDoc } from "./types";

/** Same-origin: Studio writes, embed-demo + vanilla embed read (optional). */
export const RUNBOOK_DEMO_BUNDLE_KEY = "runbook_demo_bundle_v1";

export type DemoManualSource = { id: string; title: string; content: string };

export type DemoBundle = {
  assistantName: string;
  welcome: string;
  primaryColor: string;
  suggestedQuestions: string[];
  manualSources: DemoManualSource[];
};

export const DEFAULT_DEMO_BUNDLE: DemoBundle = {
  assistantName: "Runbook",
  welcome:
    "Hi — I'm your embedded onboarding guide. Ask me anything about Northstar, or tap a suggestion.",
  primaryColor: "#6366f1",
  suggestedQuestions: [
    "How do I get GitHub access?",
    "How do I set up my local environment?",
    "What should I do first?",
    "Explain this page"
  ],
  manualSources: []
};

export function loadDemoBundle(): DemoBundle {
  if (typeof window === "undefined") return DEFAULT_DEMO_BUNDLE;
  try {
    const raw = localStorage.getItem(RUNBOOK_DEMO_BUNDLE_KEY);
    if (!raw) return DEFAULT_DEMO_BUNDLE;
    const j = JSON.parse(raw) as Partial<DemoBundle>;
    return {
      assistantName: typeof j.assistantName === "string" ? j.assistantName : DEFAULT_DEMO_BUNDLE.assistantName,
      welcome: typeof j.welcome === "string" ? j.welcome : DEFAULT_DEMO_BUNDLE.welcome,
      primaryColor: typeof j.primaryColor === "string" ? j.primaryColor : DEFAULT_DEMO_BUNDLE.primaryColor,
      suggestedQuestions: Array.isArray(j.suggestedQuestions)
        ? j.suggestedQuestions.filter((x): x is string => typeof x === "string")
        : DEFAULT_DEMO_BUNDLE.suggestedQuestions,
      manualSources: Array.isArray(j.manualSources)
        ? j.manualSources.filter(
            (m): m is DemoManualSource =>
              m &&
              typeof m === "object" &&
              typeof (m as DemoManualSource).id === "string" &&
              typeof (m as DemoManualSource).title === "string" &&
              typeof (m as DemoManualSource).content === "string"
          )
        : []
    };
  } catch {
    return DEFAULT_DEMO_BUNDLE;
  }
}

export function saveDemoBundle(bundle: DemoBundle): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNBOOK_DEMO_BUNDLE_KEY, JSON.stringify(bundle));
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* quota */
  }
}

export function manualSourcesToDocs(sources: DemoManualSource[]): SourceDoc[] {
  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    content: s.content,
    sourceType: "text" as const
  }));
}
