import type { DemoAppState } from "@/lib/embedDemoNextAction";

/** Atomic watch-me operations (theater clicks). */
export type WatchMeOperationId =
  | "connect-github"
  | "create-api-key"
  | "build-workflow-open"
  | "build-workflow-confirm"
  | "deploy";

export const WATCH_ME_SELECTORS: Record<WatchMeOperationId, string> = {
  "connect-github": "[data-runbook-action='connect-github']",
  "create-api-key": "[data-runbook-action='create-api-key']",
  "build-workflow-open": "[data-runbook-action='open-workflow-modal']",
  "build-workflow-confirm": "[data-runbook-action='confirm-workflow']",
  deploy: "[data-runbook-action='deploy-staging']"
};

export const WATCH_ME_SUCCESS_LABEL: Record<WatchMeOperationId, string> = {
  "connect-github": "GitHub connected",
  "create-api-key": "API key created",
  "build-workflow-open": "",
  "build-workflow-confirm": "Workflow created",
  deploy: "Deployed to staging"
};

export function getNextWatchMeOperation(
  state: DemoAppState,
  workflowModalOpen: boolean
): WatchMeOperationId | null {
  if (!state.githubConnected) return "connect-github";
  if (!state.apiKeyCreated) return "create-api-key";
  if (!state.workflowCreated) {
    if (!workflowModalOpen) return "build-workflow-open";
    return "build-workflow-confirm";
  }
  if (!state.deployed) return "deploy";
  return null;
}

export function countWatchMeMilestonesRemaining(state: DemoAppState): number {
  return [!state.githubConnected, !state.apiKeyCreated, !state.workflowCreated, !state.deployed].filter(Boolean).length;
}

export function waitMs(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isCancelled()) {
        resolve();
        return;
      }
      if (Date.now() - start >= ms) {
        resolve();
        return;
      }
      window.setTimeout(tick, Math.min(48, ms));
    };
    tick();
  });
}

export async function animateCursorTo(
  from: { x: number; y: number },
  to: { x: number; y: number },
  durationMs: number,
  onFrame: (x: number, y: number) => void,
  isCancelled: () => boolean
): Promise<void> {
  const start = performance.now();
  return new Promise((resolve) => {
    function frame(now: number) {
      if (isCancelled()) {
        resolve();
        return;
      }
      const t = Math.min(1, (now - start) / durationMs);
      const s = t * t * (3 - 2 * t);
      onFrame(from.x + (to.x - from.x) * s, from.y + (to.y - from.y) * s);
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}
