"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FeatureCard } from "@/components/demo/FeatureCard";

type AppState = {
  githubConnected: boolean;
  apiKeyCreated: boolean;
  workflowCreated: boolean;
  deployed: boolean;
};

type FeatureDetail = { feature: string; title: string; description: string };
type TourStep = FeatureDetail & { id: string; selector: string; success: string };

const NUDGE_DISMISSED_KEY = "runbook_alive_nudge_dismissed";
const APP_STATE_KEY = "runbook_embed_demo_state";

const TOUR_STEPS: TourStep[] = [
  {
    id: "connect-github",
    feature: "integrations",
    selector: "[data-tour-target='github-integration-card']",
    title: "Connect integrations",
    description: "Click Connect so workflows can read repo events.",
    success: "Nice - GitHub connected."
  },
  {
    id: "create-api-key",
    feature: "api-keys",
    selector: "[data-tour-target='api-key-card']",
    title: "Create API key",
    description: "Generate a key so the assistant can connect securely.",
    success: "Nice - API key created."
  },
  {
    id: "build-workflow",
    feature: "workflow-builder",
    selector: "[data-tour-target='workflow-builder-card']",
    title: "Build workflow",
    description: "Create a workflow that triggers from GitHub and deploys to staging.",
    success: "Nice - Workflow created."
  },
  {
    id: "deploy-staging",
    feature: "deployments",
    selector: "[data-tour-target='deployment-card']",
    title: "Deploy to staging",
    description: "Deploy your onboarding flow to staging.",
    success: "Nice - Deployed to staging."
  }
];

function emitActiveFeature(detail: FeatureDetail | null): void {
  window.dispatchEvent(new CustomEvent("runbook-active-feature", { detail }));
}

function emitRunbookSuggestion(text: string): void {
  window.dispatchEvent(new CustomEvent("runbook-assistant-suggestion", { detail: text }));
}

export default function EmbedDemoPage() {
  const [appState, setAppState] = useState<AppState>(() => {
    if (typeof window === "undefined") {
      return { githubConnected: false, apiKeyCreated: false, workflowCreated: false, deployed: false };
    }
    try {
      const raw = window.localStorage.getItem(APP_STATE_KEY);
      if (!raw) return { githubConnected: false, apiKeyCreated: false, workflowCreated: false, deployed: false };
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        githubConnected: Boolean(parsed.githubConnected),
        apiKeyCreated: Boolean(parsed.apiKeyCreated),
        workflowCreated: Boolean(parsed.workflowCreated),
        deployed: Boolean(parsed.deployed)
      };
    } catch {
      return { githubConnected: false, apiKeyCreated: false, workflowCreated: false, deployed: false };
    }
  });
  const [showIntegrationsPanel, setShowIntegrationsPanel] = useState(false);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<"queued" | "deploying" | "healthy">("queued");
  const [showNudge, setShowNudge] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);
  const [tourHighlightFeature, setTourHighlightFeature] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<FeatureDetail | null>(null);
  const [tourFeedback, setTourFeedback] = useState<string | null>(null);
  const completedStepIdsRef = useRef<Record<string, boolean>>({});

  const currentTourStep = tourActive ? TOUR_STEPS[tourStepIndex] : null;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;

  const stepComplete = useMemo(() => {
    if (!currentTourStep) return false;
    if (currentTourStep.id === "connect-github") return appState.githubConnected;
    if (currentTourStep.id === "create-api-key") return appState.apiKeyCreated;
    if (currentTourStep.id === "build-workflow") return appState.workflowCreated;
    if (currentTourStep.id === "deploy-staging") return appState.deployed;
    return false;
  }, [appState, currentTourStep]);

  const checklist = [
    { label: "Connect GitHub", done: appState.githubConnected },
    { label: "Create API key", done: appState.apiKeyCreated },
    { label: "Build first workflow", done: appState.workflowCreated },
    { label: "Deploy to staging", done: appState.deployed }
  ];

  const nextBest = useMemo(() => {
    if (!appState.githubConnected) return TOUR_STEPS[0];
    if (!appState.apiKeyCreated) return TOUR_STEPS[1];
    if (!appState.workflowCreated) return TOUR_STEPS[2];
    if (!appState.deployed) return TOUR_STEPS[3];
    return null;
  }, [appState]);

  const updateTourTarget = useCallback(() => {
    if (!tourActive || !currentTourStep) {
      setTourRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(currentTourStep.selector);
    if (!el) {
      if (tourStepIndex < TOUR_STEPS.length - 1) {
        setTourStepIndex((s) => s + 1);
      } else {
        setTourActive(false);
        emitRunbookSuggestion("You are ready to launch.");
      }
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTourRect(el.getBoundingClientRect());
  }, [currentTourStep, tourActive, tourStepIndex]);

  const advanceTourAfterSuccess = useCallback(
    (step: TourStep) => {
      if (completedStepIdsRef.current[step.id]) return;
      completedStepIdsRef.current[step.id] = true;
      setTourFeedback(step.success);
      emitRunbookSuggestion(step.success);
      window.setTimeout(() => {
        setTourFeedback(null);
        const nextIdx = TOUR_STEPS.findIndex((s) => s.id === step.id) + 1;
        if (nextIdx < TOUR_STEPS.length) {
          const next = TOUR_STEPS[nextIdx];
          setTourStepIndex(nextIdx);
          emitRunbookSuggestion(`Next: ${next.title}.`);
        } else {
          setTourActive(false);
          emitRunbookSuggestion("You are ready to launch.");
        }
      }, 700);
    },
    []
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_STATE_KEY, JSON.stringify(appState));
    } catch {
      /* no-op */
    }
    (window as Window & { __runbookAppState?: AppState }).__runbookAppState = appState;
    window.dispatchEvent(new CustomEvent("runbook-app-state", { detail: appState }));
  }, [appState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const dismissed = window.localStorage.getItem(NUDGE_DISMISSED_KEY) === "1";
      if (!dismissed) setShowNudge(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!tourActive) return;
    const onRecalc = () => updateTourTarget();
    onRecalc();
    window.addEventListener("resize", onRecalc);
    window.addEventListener("scroll", onRecalc, true);
    return () => {
      window.removeEventListener("resize", onRecalc);
      window.removeEventListener("scroll", onRecalc, true);
    };
  }, [tourActive, updateTourTarget]);

  useEffect(() => {
    const onPointerMove = (evt: PointerEvent) => {
      const target = evt.target instanceof Element ? evt.target.closest<HTMLElement>("[data-runbook-feature]") : null;
      if (!target) {
        setHoveredFeature(null);
        return;
      }
      const feature = target.getAttribute("data-runbook-feature") || "";
      const title = target.getAttribute("data-runbook-title") || feature;
      const description = target.getAttribute("data-runbook-description") || "";
      setHoveredFeature({ feature, title, description });
    };
    const onPointerOut = () => setHoveredFeature(null);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerout", onPointerOut, true);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerout", onPointerOut, true);
    };
  }, []);

  useEffect(() => {
    const detail = currentTourStep
      ? { feature: currentTourStep.feature, title: currentTourStep.title, description: currentTourStep.description }
      : hoveredFeature;
    emitActiveFeature(detail || null);
    return () => emitActiveFeature(null);
  }, [currentTourStep, hoveredFeature]);

  useEffect(() => {
    const onGuideMe = () => {
      setTourHighlightFeature(null);
      setTourFeedback(null);
      setTourStepIndex(0);
      setTourActive(true);
      setShowNudge(false);
      completedStepIdsRef.current = {};
      emitRunbookSuggestion("Guiding: Connect integrations.");
    };
    const onWhatNext = () => {
      const step = nextBest;
      const nextFeature = step?.feature || "workflow-builder";
      setTourActive(false);
      setTourHighlightFeature(nextFeature);
      if (step) {
        emitRunbookSuggestion(`Next: ${step.title}.`);
      } else {
        emitRunbookSuggestion("You are ready to launch.");
      }
    };
    window.addEventListener("runbook-start-tour", onGuideMe as EventListener);
    window.addEventListener("runbook-what-next", onWhatNext as EventListener);
    return () => {
      window.removeEventListener("runbook-start-tour", onGuideMe as EventListener);
      window.removeEventListener("runbook-what-next", onWhatNext as EventListener);
    };
  }, [nextBest]);

  const dismissNudge = () => {
    window.localStorage.setItem(NUDGE_DISMISSED_KEY, "1");
    setShowNudge(false);
  };

  const connectGithub = () => {
    setAppState((s) => ({ ...s, githubConnected: true }));
    setTourHighlightFeature("github-card");
    if (tourActive && currentTourStep?.id === "connect-github") advanceTourAfterSuccess(currentTourStep);
  };

  const createApiKey = () => {
    const token = `rk_live_${Math.random().toString(36).slice(2, 14)}`;
    setApiKeyValue(token);
    setAppState((s) => ({ ...s, apiKeyCreated: true }));
    setTourHighlightFeature("api-keys");
    if (tourActive && currentTourStep?.id === "create-api-key") advanceTourAfterSuccess(currentTourStep);
  };

  const createWorkflow = () => {
    setAppState((s) => ({ ...s, workflowCreated: true }));
    setShowWorkflowModal(false);
    setTourHighlightFeature("workflow-builder");
    if (tourActive && currentTourStep?.id === "build-workflow") advanceTourAfterSuccess(currentTourStep);
  };

  const deployStaging = () => {
    setDeploymentStatus("deploying");
    window.setTimeout(() => {
      setDeploymentStatus("healthy");
      setAppState((s) => ({ ...s, deployed: true }));
      setTourHighlightFeature("deployments");
      if (tourActive && currentTourStep?.id === "deploy-staging") advanceTourAfterSuccess(currentTourStep);
    }, 900);
  };

  const outlinedFeature = useMemo(
    () => (tourHighlightFeature && !tourActive ? tourHighlightFeature : currentTourStep?.feature || null),
    [currentTourStep?.feature, tourActive, tourHighlightFeature]
  );

  return (
    <div className="relative space-y-5 pb-28">
      {showNudge ? (
        <div className="fixed bottom-24 right-6 z-[2147483000] w-[300px] rounded-xl border border-indigo-400/40 bg-slate-900/95 p-3 text-sm text-slate-100 shadow-2xl">
          <p className="text-sm font-semibold">Want help getting started?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                emitRunbookSuggestion("You can connect tools, create keys, build, then deploy.");
                setShowNudge(false);
              }}
              className="rounded-md border border-indigo-400/50 px-2 py-1 text-xs text-indigo-100"
            >
              Show me what I can do
            </button>
            <button
              type="button"
              onClick={() => {
                setTourStepIndex(0);
                setTourActive(true);
                setShowNudge(false);
              }}
              className="rounded-md bg-indigo-500 px-2 py-1 text-xs font-semibold text-white"
            >
              Start guided tour
            </button>
            <button type="button" onClick={dismissNudge} className="ml-auto text-xs text-slate-400 hover:text-slate-200">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FeatureCard
          feature="create-workflow"
          title="Create Workflow"
          description="Start a new automation by choosing a trigger and action."
          className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/25 to-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-indigo-200">Quick action</p>
          <p className="mt-1 text-xl font-bold text-white">Create Workflow</p>
          <button
            type="button"
            onClick={() => setShowWorkflowModal(true)}
            className="mt-3 inline-block rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
          >
            New workflow
          </button>
        </FeatureCard>

        <FeatureCard
          feature="workflow-health"
          title="Workflow Health"
          description="See active runs, failures, and latency before deploying changes."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">Health</p>
          <p className="mt-1 text-2xl font-bold">98.4%</p>
          <p className="text-xs text-slate-400">7 active runs · 0 critical alerts</p>
        </FeatureCard>

        <FeatureCard
          feature="deployments"
          title="Deployment Status"
          description="Track staging and production rollout states for your latest workflow version."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          data-tour-target="deployment-card"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">Deployments</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {deploymentStatus === "healthy" ? "Staging healthy" : deploymentStatus === "deploying" ? "Deploying..." : "Ready to deploy"}
          </p>
          <button type="button" onClick={deployStaging} className="mt-2 rounded-lg border border-white/20 px-3 py-1 text-xs">
            Deploy to staging
          </button>
        </FeatureCard>

        <FeatureCard
          feature="api-keys"
          title="API Key Setup"
          description="Create scoped keys for sandbox and production environments."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          data-tour-target="api-key-card"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">API Keys</p>
          <p className="mt-1 text-xs text-slate-300">{apiKeyValue ? `Latest: ${apiKeyValue}` : "No key generated yet"}</p>
          <button type="button" onClick={createApiKey} className="mt-3 inline-block rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:border-white/40">
            Generate key
          </button>
        </FeatureCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <FeatureCard
          feature="workflow-builder"
          title="Workflow Builder"
          description="Compose triggers and actions, then test before deployment."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          data-tour-target="workflow-builder-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow Builder</h2>
            <Link href="/embed-demo/workflows" className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-100">
              Open full builder
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Trigger", appState.githubConnected ? "GitHub push event" : "Connect GitHub first"],
              ["Condition", "branch == main"],
              ["Action", "Deploy to staging"]
            ].map(([label, value], idx) => (
              <FeatureCard
                key={label}
                feature={`workflow-step-${idx + 1}`}
                title={String(label)}
                description={`Configure the ${String(label).toLowerCase()} step for this workflow.`}
                className="rounded-xl border border-white/10 bg-slate-950/70 p-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-100">{value}</p>
              </FeatureCard>
            ))}
          </div>
        </FeatureCard>

        <div className="space-y-5">
          <FeatureCard
            feature="integrations"
            title="Integrations"
            description="Connect external tools so workflows can trigger and notify automatically."
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Integrations</h3>
              <button type="button" onClick={() => setShowIntegrationsPanel(true)} className="rounded-md border border-white/20 px-2 py-1 text-xs">
                Manage
              </button>
            </div>
            <ul className="mt-3 space-y-2 text-sm" data-runbook-feature="github-card" data-runbook-title="GitHub integration" data-runbook-description="Connect GitHub so workflows can trigger from commits and pull requests." data-tour-target="github-integration-card">
              <li className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                <span>GitHub</span>
                <button type="button" onClick={connectGithub} className={`rounded-md px-2 py-1 text-xs ${appState.githubConnected ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
                  {appState.githubConnected ? "Connected" : "Connect"}
                </button>
              </li>
              <li className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                <span>Slack</span>
                <span className="text-emerald-300">Connected</span>
              </li>
            </ul>
          </FeatureCard>
        </div>
      </section>

      <FeatureCard
        feature="onboarding-checklist"
        title="Onboarding checklist"
        description="Complete each setup milestone to launch quickly."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <ul className="space-y-2 text-sm">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${item.done ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                {item.done ? "✓" : "•"}
              </span>
              <span className={item.done ? "text-emerald-200" : "text-slate-300"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </FeatureCard>

      {showIntegrationsPanel ? (
        <div className="fixed inset-0 z-[2147482998] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-slate-900 p-4 text-sm text-slate-100">
            <p className="font-semibold">Integration manager</p>
            <p className="mt-1 text-xs text-slate-300">GitHub is {appState.githubConnected ? "connected" : "not connected"}.</p>
            <button type="button" onClick={() => setShowIntegrationsPanel(false)} className="mt-3 rounded-md border border-white/20 px-3 py-1 text-xs">
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showWorkflowModal ? (
        <div className="fixed inset-0 z-[2147482998] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/20 bg-slate-900 p-4 text-sm text-slate-100">
            <p className="font-semibold">Create workflow</p>
            <p className="mt-1 text-xs text-slate-300">Create a GitHub {"->"} Deploy to staging workflow.</p>
            <button type="button" onClick={createWorkflow} className="mt-3 rounded-md bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">
              Create workflow
            </button>
          </div>
        </div>
      ) : null}

      {tourActive && tourRect ? (
        <>
          <div className="pointer-events-none fixed inset-0 z-[2147482996] bg-black/28" />
          <div
            className="pointer-events-none fixed z-[2147482997] rounded-xl border-2 border-indigo-300 ring-2 ring-indigo-300/40 animate-pulse"
            style={{
              top: tourRect.top - 6,
              left: tourRect.left - 6,
              width: tourRect.width + 12,
              height: tourRect.height + 12
            }}
          />
          <div
            className="fixed z-[2147482998] w-[280px] rounded-xl border border-indigo-400/60 bg-slate-900 p-3 text-xs text-slate-100"
            style={{ top: Math.min(viewportHeight - 170, tourRect.bottom + 12), left: Math.max(16, tourRect.left) }}
          >
            <p className="font-semibold">{currentTourStep?.title}</p>
            <p className="mt-1 text-slate-300">{currentTourStep?.description}</p>
            {tourFeedback ? <p className="mt-2 text-emerald-300">{tourFeedback}</p> : null}
            <div className="mt-3 flex justify-between">
              <button
                type="button"
                onClick={() => setTourStepIndex((s) => Math.max(0, s - 1))}
                disabled={tourStepIndex === 0}
                className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!stepComplete}
                className={`rounded-md px-2 py-1 ${stepComplete ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300"}`}
              >
                {stepComplete ? "Action complete" : "Waiting for action..."}
              </button>
              <button type="button" onClick={() => setTourActive(false)} className="rounded-md border border-white/20 px-2 py-1">
                {tourStepIndex === TOUR_STEPS.length - 1 ? "Done" : "Skip"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {outlinedFeature ? (
        <style>{`[data-runbook-feature='${outlinedFeature}']{outline:2px solid rgba(129,140,248,0.95);outline-offset:2px;border-radius:12px;}`}</style>
      ) : null}
    </div>
  );
}
