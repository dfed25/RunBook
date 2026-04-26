"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { EmbeddedRunbookAssistant } from "@/components/EmbeddedRunbookAssistant";
import {
  loadDemoBundle,
  loadImportedDocs,
  loadImportedRepo,
  loadProjectId,
  loadTestAgents,
  saveDemoBundle,
  saveImportedDocs,
  saveImportedRepo,
  saveProjectId,
  type DemoBundle,
  type ImportedDocument,
  type ImportedRepoInfo,
  type TestAgentProfile
} from "@/lib/studioDemoStorage";

type HoverInfo = { title: string; description: string; top: number; left: number };
const HINTS_TOGGLE_KEY = "runbook_demo_hints_enabled";
const ASSISTANT_TOGGLE_KEY = "runbook_demo_assistant_enabled";

function getInitialAgentFromUrl(): TestAgentProfile | null {
  if (typeof window === "undefined") return null;
  const agentId = new URLSearchParams(window.location.search).get("agent");
  if (!agentId) return null;
  return loadTestAgents().find((a) => a.projectId === agentId) || null;
}

const NAV_ITEMS = [
  { href: "/embed-demo/overview", activePaths: ["/embed-demo", "/embed-demo/overview"], label: "Overview", feature: "overview-dashboard" },
  { href: "/embed-demo/workflows", label: "Workflows", feature: "workflow-builder" },
  { href: "/embed-demo/integrations", label: "Integrations", feature: "integrations-panel" },
  { href: "/embed-demo/api-keys", label: "API Keys", feature: "api-key-setup" },
  { href: "/embed-demo/deployments", label: "Deployments", feature: "deployment-status" },
  { href: "/embed-demo/settings", label: "Settings", feature: "settings-panel" }
];

const FEATURE_QUERY_HINTS: Record<string, string[]> = {
  "overview-dashboard": ["overview", "dashboard", "home"],
  "workflow-builder": ["workflow", "trigger", "action", "automation"],
  "create-workflow": ["create workflow", "new workflow", "template", "builder"],
  "integrations-panel": ["integration", "slack", "github", "webhook", "connect"],
  "api-key-setup": ["api key", "token", "credential", "secret"],
  "deployment-status": ["deploy", "release", "staging", "production", "rollback"],
  "settings-panel": ["settings", "permissions", "configuration", "workspace"],
  "onboarding-checklist": ["onboarding", "setup", "first steps", "quickstart"],
  "agent-profile-switch": ["profile", "project", "repository", "knowledge"]
};

const DEMO_FEATURE_EXPLANATIONS: Record<string, string> = {
  "overview-dashboard":
    "See onboarding-critical health signals: active automations, failure rate, and what needs setup first.",
  "workflow-builder":
    "Design automations by wiring trigger -> conditions -> actions, then test before deployment.",
  "create-workflow":
    "Start your first onboarding automation from a template and customize it for your product flow.",
  "integrations-panel":
    "Connect data sources (like GitHub) and destinations (like Slack) so workflows can react and notify automatically.",
  "api-key-setup":
    "Generate environment-scoped API keys used by your app to authenticate workflow events safely.",
  "deployment-status":
    "Track rollout progress, staging health, and whether it is safe to promote to production.",
  "settings-panel":
    "Control assistant behavior, permissions, and workspace defaults that shape onboarding for end users.",
  "onboarding-checklist":
    "Follow the recommended sequence: connect integrations, create API key, build workflow, then deploy.",
  "agent-profile-switch":
    "Switch imported repositories to instantly test how guidance changes for different app codebases."
};

function getStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === "1") return true;
  if (raw === "0") return false;
  return fallback;
}

function persistBoolean(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value ? "1" : "0");
}

function compactSentence(text: string, max = 170): string {
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function firstSentence(text: string): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const match = clean.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : clean).trim();
}

function tokenize(text: string): string[] {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function extractPrimarySentence(content: string, hints: string[]): string {
  const sentences = String(content || "")
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 16);
  const scored = sentences
    .map((s) => {
      const lower = s.toLowerCase();
      let score = 0;
      for (const hint of hints) {
        if (lower.includes(hint.toLowerCase())) score += 3;
      }
      if (/api|endpoint|route|handler|controller|button|form|submit|create|connect|deploy|settings/i.test(lower)) score += 2;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s || "";
}

function extractCodeSignals(doc: ImportedDocument): string[] {
  const content = String(doc.content || "");
  const signals: string[] = [];
  const routeMatch = content.match(/\/api\/[a-z0-9/_-]+/i);
  if (routeMatch) signals.push(`API ${routeMatch[0]}`);
  const fnMatch = content.match(/(?:function|const|export function)\s+([A-Za-z0-9_]+)/);
  if (fnMatch?.[1]) signals.push(`logic in ${fnMatch[1]}()`);
  if (doc.path) signals.push(`code: ${doc.path}`);
  return signals.slice(0, 2);
}

function scoreDocForFeature(doc: ImportedDocument, hints: string[]): number {
  const path = String(doc.path || "").toLowerCase();
  const title = String(doc.title || "").toLowerCase();
  const content = String(doc.content || "").toLowerCase();
  const bag = `${path}\n${title}\n${content}`;
  let score = 0;
  for (const hint of hints) {
    const tokens = tokenize(hint);
    for (const token of tokens) {
      if (bag.includes(token)) score += token.length > 6 ? 3 : 2;
    }
    if (bag.includes(hint.toLowerCase())) score += 4;
  }
  if (/src\/app|src\/components|src\/lib|api\/embed|route\.ts|page\.tsx/.test(path)) score += 2;
  return score;
}

function buildFeatureExplanationMap(docs: ImportedDocument[]): Record<string, string> {
  if (!docs.length) return {};
  const out: Record<string, string> = {};

  for (const [feature, hints] of Object.entries(FEATURE_QUERY_HINTS)) {
    const ranked = docs
      .map((doc) => ({ doc, score: scoreDocForFeature(doc, hints) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    const sourceDoc = ranked[0]?.doc;
    if (!sourceDoc) continue;
    const bestSentence = extractPrimarySentence(sourceDoc.content || "", hints);
    if (!bestSentence) continue;
    const signals = extractCodeSignals(sourceDoc);
    const signalText = signals.length > 0 ? ` (${signals.join(" · ")})` : "";
    out[feature] = firstSentence(`${compactSentence(bestSentence)}${signalText}`);
  }
  return out;
}

export default function EmbedDemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialAgent = useMemo(() => getInitialAgentFromUrl(), []);
  const [bundle, setBundle] = useState<DemoBundle>(() => (initialAgent ? initialAgent.assistantConfig : loadDemoBundle()));
  const [projectId, setProjectId] = useState(() => (initialAgent ? initialAgent.projectId : loadProjectId()));
  const [repoInfo, setRepoInfo] = useState<ImportedRepoInfo | null>(() => (initialAgent ? initialAgent.repo : loadImportedRepo()));
  const [importedDocs, setImportedDocs] = useState<ImportedDocument[]>(() => (initialAgent ? initialAgent.documents : loadImportedDocs()));
  const [savedAgents, setSavedAgents] = useState<TestAgentProfile[]>(() => loadTestAgents());
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(() => getStoredBoolean(HINTS_TOGGLE_KEY, true));
  const [assistantEnabled, setAssistantEnabled] = useState<boolean>(() => getStoredBoolean(ASSISTANT_TOGGLE_KEY, true));
  const hoverWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      setBundle(loadDemoBundle());
      setProjectId(loadProjectId());
      setRepoInfo(loadImportedRepo());
      setImportedDocs(loadImportedDocs());
      setSavedAgents(loadTestAgents());
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("runbook-demo-update", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("runbook-demo-update", refresh);
    };
  }, []);

  const switchAgent = (agent: TestAgentProfile) => {
    saveProjectId(agent.projectId);
    saveImportedRepo(agent.repo);
    saveImportedDocs(agent.documents);
    saveDemoBundle(agent.assistantConfig);
    setProjectId(agent.projectId);
    setRepoInfo(agent.repo);
    setImportedDocs(agent.documents);
    setBundle(agent.assistantConfig);
  };

  const environmentLabel = useMemo(() => {
    if (!repoInfo) return "Northstar demo docs";
    return `${repoInfo.owner}/${repoInfo.name} (${importedDocs.length} imported docs)`;
  }, [repoInfo, importedDocs.length]);

  const featureExplanationMap = useMemo(() => buildFeatureExplanationMap(importedDocs), [importedDocs]);

  const resolveFeatureDescription = useCallback((target: HTMLElement, fallbackDescription: string): string => {
    const feature = target.getAttribute("data-runbook-feature") || "";
    if (!feature) return fallbackDescription;
    return featureExplanationMap[feature] || DEMO_FEATURE_EXPLANATIONS[feature] || fallbackDescription;
  }, [featureExplanationMap]);

  const showFeatureTooltip = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!hintsEnabled) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-runbook-feature]");
    if (!target) return;
    const title = target.getAttribute("data-runbook-title") || "";
    const description = resolveFeatureDescription(target, target.getAttribute("data-runbook-description") || "");
    if (!title || !description) return;
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 352;
    const estimatedHeight = 110;
    let left = window.scrollX + rect.right + 10;
    if (left + tooltipWidth > window.scrollX + window.innerWidth - 12) left = window.scrollX + window.innerWidth - tooltipWidth - 12;
    if (left < window.scrollX + 12) left = window.scrollX + 12;

    let top = window.scrollY + rect.top + rect.height / 2 - estimatedHeight / 2;
    const maxBottom = window.scrollY + window.innerHeight - 12;
    if (top + estimatedHeight > maxBottom) top = maxBottom - estimatedHeight;
    if (top < window.scrollY + 8) top = window.scrollY + 8;
    setHoverInfo({ title, description, top, left });
  }, [hintsEnabled, resolveFeatureDescription]);

  useEffect(() => {
    const root = hoverWrapRef.current;
    if (!root) return;
    let raf = 0;
    const onPointerMove = (evt: PointerEvent) => {
      if (!hintsEnabled) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const target = evt.target as HTMLElement | null;
        if (!target) return;
        if (!root.contains(target)) return;
        const featureEl = target.closest<HTMLElement>("[data-runbook-feature]");
        if (!featureEl) {
          setHoverInfo(null);
          return;
        }
        showFeatureTooltip({ target: featureEl } as unknown as MouseEvent<HTMLElement>);
      });
    };
    const onPointerLeave = () => setHoverInfo(null);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [hintsEnabled, featureExplanationMap, showFeatureTooltip]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white shadow-lg shadow-indigo-900/40">
              NW
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-300">Northstar</p>
              <h1 className="text-base font-semibold text-white sm:text-lg">Workflow Builder</h1>
            </div>
          </div>
          <div className="hidden rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-100 lg:block">
            Active knowledge: <span suppressHydrationWarning className="font-semibold">{environmentLabel}</span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => {
                const next = !hintsEnabled;
                setHintsEnabled(next);
                persistBoolean(HINTS_TOGGLE_KEY, next);
                if (!next) setHoverInfo(null);
              }}
              className="rounded-lg border border-white/20 px-2.5 py-1 text-[11px] text-slate-200 hover:border-white/40"
            >
              <span suppressHydrationWarning>{hintsEnabled ? "Hints on" : "Hints off"}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        ref={(el) => {
          hoverWrapRef.current = el;
        }}
        className="mx-auto grid max-w-7xl gap-5 px-5 py-5 md:grid-cols-[240px_1fr]"
      >
        <aside className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Navigation</p>
          <ul className="space-y-1 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 ${
                    ((item.activePaths && item.activePaths.includes(pathname)) || pathname === item.href)
                      ? "bg-indigo-500/20 text-indigo-100"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                  data-runbook-feature={item.feature}
                  data-runbook-title={item.label}
                  data-runbook-description={`Open the ${item.label} section to continue setup.`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100"
            data-runbook-feature="onboarding-checklist"
            data-runbook-title="Onboarding Checklist"
            data-runbook-description="Track setup milestones so first-time users can launch workflows quickly."
          >
            <p className="font-semibold">Onboarding checklist</p>
            <ul className="mt-2 space-y-1 text-emerald-200/90">
              <li>1. Connect integrations</li>
              <li>2. Create API key</li>
              <li>3. Build first workflow</li>
              <li>4. Deploy to staging</li>
            </ul>
          </div>

          {savedAgents.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved agents</p>
              <div className="flex flex-wrap gap-2">
                {savedAgents.slice(0, 6).map((agent) => (
                  <button
                    key={agent.projectId}
                    type="button"
                    onClick={() => switchAgent(agent)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      agent.projectId === projectId
                        ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                        : "border-slate-600 bg-slate-800 text-slate-300"
                    }`}
                    data-runbook-feature="agent-profile-switch"
                    data-runbook-title={agent.repo.name}
                    data-runbook-description="Switch to another imported repository profile for testing."
                  >
                    {agent.repo.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <main className="space-y-5">{children}</main>
      </div>

      {hoverInfo ? (
        <div
          className="pointer-events-none fixed z-[2147483001] w-[22rem] rounded-xl border border-indigo-400/40 bg-slate-900/95 p-3 text-xs text-indigo-100 shadow-2xl shadow-black/50"
          style={{ top: hoverInfo.top, left: hoverInfo.left }}
        >
          <p className="font-semibold text-white">{hoverInfo.title}</p>
          <p className="mt-1 leading-relaxed text-indigo-100/90">{hoverInfo.description}</p>
        </div>
      ) : null}

      <div className="fixed bottom-5 left-5 z-[2147483000] flex gap-2">
        <button
          type="button"
          onClick={() => {
            const next = !hintsEnabled;
            setHintsEnabled(next);
            persistBoolean(HINTS_TOGGLE_KEY, next);
            if (!next) setHoverInfo(null);
          }}
          className="rounded-full border border-white/25 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg hover:border-white/50"
        >
          <span suppressHydrationWarning>{hintsEnabled ? "Hints: on" : "Hints: off"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !assistantEnabled;
            setAssistantEnabled(next);
            persistBoolean(ASSISTANT_TOGGLE_KEY, next);
          }}
          className="rounded-full border border-white/25 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg hover:border-white/50"
        >
          <span suppressHydrationWarning>{assistantEnabled ? "Widget: on" : "Widget: off"}</span>
        </button>
      </div>

      {assistantEnabled ? (
        <EmbeddedRunbookAssistant
          key={`${projectId}-${importedDocs.length}`}
          projectId={projectId}
          assistantName={bundle.assistantName}
          welcomeMessage={bundle.welcome}
          primaryColor={bundle.primaryColor}
          suggestedQuestions={bundle.suggestedQuestions}
          manualSources={bundle.manualSources}
          importedDocuments={importedDocs}
          position="page"
        />
      ) : null}
    </div>
  );
}
