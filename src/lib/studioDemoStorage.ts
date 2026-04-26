import type { SourceDoc } from "./types";

/** Same-origin: Studio writes, embed-demo + vanilla embed read (optional). */
export const RUNBOOK_DEMO_BUNDLE_KEY = "runbook_demo_bundle_v1";
export const RUNBOOK_ASSISTANT_CONFIG_KEY = "runbook_assistant_config";
export const RUNBOOK_PROJECT_ID_KEY = "runbook_project_id";
export const RUNBOOK_IMPORTED_DOCS_KEY = "runbook_imported_docs";
export const RUNBOOK_IMPORTED_REPO_KEY = "runbook_imported_repo";
export const RUNBOOK_TEST_AGENTS_KEY = "runbook_test_agents";

export type DemoManualSource = { id: string; title: string; content: string };
export type ImportedRepoInfo = { owner: string; name: string; url: string };
export type ImportedDocument = { title: string; path: string; content: string };
export type TestAgentProfile = {
  projectId: string;
  repo: ImportedRepoInfo;
  documents: ImportedDocument[];
  assistantConfig: DemoBundle;
  updatedAt: string;
};

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
    localStorage.setItem(RUNBOOK_ASSISTANT_CONFIG_KEY, JSON.stringify(bundle));
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* quota */
  }
}

export function loadProjectId(): string {
  if (typeof window === "undefined") return "northstar-demo";
  const v = localStorage.getItem(RUNBOOK_PROJECT_ID_KEY)?.trim();
  return v || "northstar-demo";
}

export function saveProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNBOOK_PROJECT_ID_KEY, projectId.trim() || "northstar-demo");
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* ignore */
  }
}

export function loadImportedDocs(): ImportedDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RUNBOOK_IMPORTED_DOCS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (d): d is ImportedDocument =>
          Boolean(d) &&
          typeof d === "object" &&
          typeof (d as ImportedDocument).title === "string" &&
          typeof (d as ImportedDocument).path === "string" &&
          typeof (d as ImportedDocument).content === "string"
      )
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function saveImportedDocs(docs: ImportedDocument[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNBOOK_IMPORTED_DOCS_KEY, JSON.stringify(docs.slice(0, 24)));
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* ignore */
  }
}

export function loadImportedRepo(): ImportedRepoInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RUNBOOK_IMPORTED_REPO_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ImportedRepoInfo>;
    if (!v || typeof v.owner !== "string" || typeof v.name !== "string" || typeof v.url !== "string") return null;
    return { owner: v.owner, name: v.name, url: v.url };
  } catch {
    return null;
  }
}

export function saveImportedRepo(repo: ImportedRepoInfo | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!repo) localStorage.removeItem(RUNBOOK_IMPORTED_REPO_KEY);
    else localStorage.setItem(RUNBOOK_IMPORTED_REPO_KEY, JSON.stringify(repo));
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* ignore */
  }
}

export function loadTestAgents(): TestAgentProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RUNBOOK_TEST_AGENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (a): a is TestAgentProfile =>
          Boolean(a) &&
          typeof a === "object" &&
          typeof (a as TestAgentProfile).projectId === "string" &&
          Boolean((a as TestAgentProfile).repo) &&
          Array.isArray((a as TestAgentProfile).documents) &&
          Boolean((a as TestAgentProfile).assistantConfig)
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function saveTestAgents(agents: TestAgentProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNBOOK_TEST_AGENTS_KEY, JSON.stringify(agents.slice(0, 20)));
    window.dispatchEvent(new Event("runbook-demo-update"));
  } catch {
    /* ignore */
  }
}

export function upsertTestAgentProfile(agent: TestAgentProfile): void {
  if (typeof window === "undefined") return;
  const current = loadTestAgents();
  const next = [agent, ...current.filter((a) => a.projectId !== agent.projectId)].slice(0, 20);
  saveTestAgents(next);
}

export function manualSourcesToDocs(sources: DemoManualSource[]): SourceDoc[] {
  return sources.map((s) => ({
    id: s.id,
    title: s.title,
    content: s.content,
    sourceType: "text" as const
  }));
}
