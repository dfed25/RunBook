const STORAGE_KEY = "runbook_demo1_northstar_v1";

const steps = [
  { id: "salesforce", label: "Connect Salesforce" },
  { id: "github_detail", label: "Review GitHub integration" },
  { id: "workflow_template", label: "Load a workflow template" },
  { id: "workflow_blank", label: "Start a blank workflow" },
  { id: "api_key", label: "Generate an API key" },
  { id: "deploy_pause", label: "Pause the canary rollout" },
];

const baseState = {
  completed: {},
};

const TOUR_STEPS = [
  {
    id: "salesforce",
    selector: "[data-tour-target='salesforce-connect']",
    feature: "salesforce-card",
    view: "integrations",
    title: "Connect Salesforce",
    description: "Link CRM so lifecycle workflows can sync leads and opportunities.",
    done: () => isStepComplete("salesforce"),
  },
  {
    id: "github",
    selector: "[data-tour-target='manage-github']",
    feature: "integrations-nav",
    view: "integrations",
    title: "Review GitHub",
    description: "Open GitHub details to confirm scopes, webhooks, and health.",
    done: () => isStepComplete("github_detail"),
  },
  {
    id: "template",
    selector: "[data-tour-target='use-template-release']",
    feature: "workflows-nav",
    view: "workflows",
    title: "Load a template",
    description: "Use release automation to pre-fill trigger, condition, and action.",
    done: () => isStepComplete("workflow_template"),
  },
  {
    id: "blank",
    selector: "[data-tour-target='start-blank-workflow']",
    feature: "workflows-nav",
    view: "workflows",
    title: "Blank canvas",
    description: "Start from scratch when you outgrow templates.",
    done: () => isStepComplete("workflow_blank"),
  },
  {
    id: "apikey",
    selector: "[data-tour-target='generate-api-key']",
    feature: "api-keys-nav",
    view: "api-keys",
    title: "API keys",
    description: "Create a staging key before wiring automation to your app.",
    done: () => isStepComplete("api_key"),
  },
  {
    id: "deploy",
    selector: "[data-tour-target='pause-rollout']",
    feature: "deployments-nav",
    view: "deployments",
    title: "Deployments",
    description: "Practice pausing a rollout — safe control before production.",
    done: () => isStepComplete("deploy_pause"),
  },
];

let state = loadState();
let tourActive = false;
let tourStepIndex = 0;
let highlightedEl = null;
let rolloutPercent = 75;

const nav = document.getElementById("rb-nav-list");
const navButtons = Array.from(document.querySelectorAll(".rb-nav"));
const views = Array.from(document.querySelectorAll(".rb-view"));
const integrationDetail = document.getElementById("integrationDetail");
const deployFill = document.getElementById("deployFill");
const deployStatus = document.getElementById("deployStatus");
const deployHistory = document.getElementById("deployHistory");
const apiKeyForm = document.getElementById("apiKeyForm");
const apiKeyList = document.getElementById("apiKeyList");
const salesforceStatus = document.getElementById("salesforceStatus");
const wfTrigger = document.getElementById("wfTrigger");
const wfCondition = document.getElementById("wfCondition");
const wfAction = document.getElementById("wfAction");
const wfTriggerOverview = document.getElementById("wfTriggerOverview");
const wfConditionOverview = document.getElementById("wfConditionOverview");
const wfActionOverview = document.getElementById("wfActionOverview");

const INITIAL_API_KEY_LIST = `                <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2"><div><p class="font-medium text-slate-100">web-staging</p><p class="text-xs text-slate-400">sk_live_****************wY2</p></div><p class="text-xs text-slate-400">Last used 2h ago</p></li>
                <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2"><div><p class="font-medium text-slate-100">web-production</p><p class="text-xs text-slate-400">sk_live_****************mP9</p></div><p class="text-xs text-slate-400">Last used 9m ago</p></li>`;

const INITIAL_DEPLOY_HISTORY = `                  <li class="rounded-lg bg-slate-950/70 px-3 py-2">v1.42.0 · Completed · 2h ago</li>
                  <li class="rounded-lg bg-slate-950/70 px-3 py-2">v1.41.3 · Completed · Yesterday</li>
                  <li class="rounded-lg bg-slate-950/70 px-3 py-2">v1.41.2 · Rolled back · 2 days ago</li>`;

const DEFAULT_INTEGRATION_DETAIL =
  "Select an integration and click Manage to view auth scope, webhooks, and health.";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...baseState, completed: {} };
    const parsed = JSON.parse(raw);
    return { ...baseState, ...parsed, completed: parsed.completed || {} };
  } catch {
    return { ...baseState, completed: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setStatus(message) {
  try {
    window.dispatchEvent(new CustomEvent("runbook-assistant-status", { detail: message }));
  } catch {
    /* ignore */
  }
}

function toast(message) {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText =
    "position:fixed;top:14px;right:14px;z-index:2147483646;background:#111827;color:#e5e7eb;border:1px solid #374151;padding:10px 12px;border-radius:10px;font:12px/1.3 system-ui;";
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 1800);
}

function activate(view) {
  navButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  views.forEach((v) => v.classList.toggle("active", v.dataset.view === view));
}

function isStepComplete(stepId) {
  return Boolean(state.completed[stepId]);
}

function completeStep(stepId) {
  if (state.completed[stepId]) {
    maybeAdvanceTour();
    return;
  }
  state.completed[stepId] = true;
  saveState();
  renderOnboarding();
  syncWidgetState();
  maybeAdvanceTour();
}

function getUnlockedIndex() {
  for (let i = 0; i < steps.length; i += 1) {
    if (!isStepComplete(steps[i].id)) return i;
  }
  return steps.length;
}

function renderOnboarding() {
  const container = document.getElementById("onboardingSteps");
  if (!container) return;
  const unlocked = getUnlockedIndex();
  container.innerHTML = "";
  steps.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.label;
    if (isStepComplete(step.id)) li.classList.add("step-complete");
    else if (index === unlocked) li.classList.add("step-active");
    else if (index > unlocked) li.classList.add("step-locked");
    container.appendChild(li);
  });
  const done = steps.filter((s) => isStepComplete(s.id)).length;
  const progressText = document.getElementById("onboardingProgressText");
  if (progressText) progressText.textContent = `${done} / ${steps.length} complete`;
}

function syncWidgetState() {
  const app = {
    githubConnected: isStepComplete("github_detail"),
    apiKeyCreated: isStepComplete("api_key"),
    workflowCreated: isStepComplete("workflow_template") || isStepComplete("workflow_blank"),
    deployed: isStepComplete("deploy_pause"),
  };
  window.__runbookAppState = app;
  window.dispatchEvent(new CustomEvent("runbook-app-state", { detail: app }));
}

function setBuilderState(trigger, condition, action) {
  if (wfTrigger) wfTrigger.textContent = trigger;
  if (wfCondition) wfCondition.textContent = condition;
  if (wfAction) wfAction.textContent = action;
  if (wfTriggerOverview) wfTriggerOverview.textContent = trigger;
  if (wfConditionOverview) wfConditionOverview.textContent = condition;
  if (wfActionOverview) wfActionOverview.textContent = action;
}

function setIntegrationDetail(title, lines) {
  if (!integrationDetail) return;
  const html = [
    `<p class="font-semibold text-slate-100">${title}</p>`,
    ...lines.map((line) => `<p class="mt-1 text-slate-300">${line}</p>`),
  ].join("");
  integrationDetail.innerHTML = html;
}

function addDeployHistory(text) {
  if (!(deployHistory instanceof HTMLUListElement)) return;
  const li = document.createElement("li");
  li.className = "rounded-lg bg-slate-950/70 px-3 py-2";
  li.textContent = text;
  deployHistory.prepend(li);
}

function updateRollout(percent, status) {
  rolloutPercent = percent;
  if (deployFill instanceof HTMLElement) deployFill.style.width = `${rolloutPercent}%`;
  if (deployStatus instanceof HTMLElement) deployStatus.textContent = status;
}

function clearHighlight() {
  if (highlightedEl) {
    highlightedEl.classList.remove("tour-highlight");
    highlightedEl = null;
  }
}

function showTourCoach(step) {
  const box = document.getElementById("tourCoach");
  const title = document.getElementById("tourCoachTitle");
  const text = document.getElementById("tourCoachText");
  if (!box || !title || !text) return;
  title.textContent = `Step ${tourStepIndex + 1}/${TOUR_STEPS.length}: ${step.title}`;
  text.textContent = step.description;
  box.classList.remove("hidden");
}

function hideTourCoach() {
  const box = document.getElementById("tourCoach");
  if (box) box.classList.add("hidden");
}

function firstIncompleteTourIndex() {
  const idx = TOUR_STEPS.findIndex((s) => !s.done());
  return idx >= 0 ? idx : TOUR_STEPS.length - 1;
}

function renderTour() {
  if (!tourActive) {
    clearHighlight();
    hideTourCoach();
    return;
  }
  const step = TOUR_STEPS[tourStepIndex];
  if (!step) return;
  activate(step.view);
  setStatus(`Guiding: ${step.title}`);
  const target = document.querySelector(step.selector);
  clearHighlight();
  if (target instanceof HTMLElement) {
    highlightedEl = target;
    highlightedEl.classList.add("tour-highlight");
    highlightedEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  showTourCoach(step);
  window.dispatchEvent(
    new CustomEvent("runbook-active-feature", {
      detail: {
        feature: step.feature,
        title: step.title,
        description: step.description,
      },
    }),
  );
}

function maybeAdvanceTour() {
  if (!tourActive) return;
  const step = TOUR_STEPS[tourStepIndex];
  if (!step || !step.done()) return;
  toast(`Completed: ${step.title}`);
  if (tourStepIndex < TOUR_STEPS.length - 1) {
    tourStepIndex += 1;
    renderTour();
  } else {
    tourActive = false;
    renderTour();
    setStatus("Guided onboarding complete.");
    toast("Guided onboarding complete.");
  }
}

function startTour() {
  tourActive = true;
  tourStepIndex = firstIncompleteTourIndex();
  renderTour();
}

function highlightNextAction() {
  const idx = firstIncompleteTourIndex();
  const step = TOUR_STEPS[idx];
  if (!step) return;
  tourActive = false;
  hideTourCoach();
  activate(step.view);
  clearHighlight();
  const target = document.querySelector(step.selector);
  if (target instanceof HTMLElement) {
    highlightedEl = target;
    highlightedEl.classList.add("tour-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  setStatus(`Next: ${step.title}`);
  toast(`Next action: ${step.title}`);
}

function resetSalesforceCard() {
  const btn = document.getElementById("salesforceConnectBtn");
  if (btn) {
    btn.textContent = "Connect";
    btn.dataset.action = "connect-salesforce";
    btn.setAttribute("data-runbook-action", "connect-salesforce");
  }
  if (salesforceStatus instanceof HTMLElement) {
    salesforceStatus.textContent = "Not connected";
    salesforceStatus.classList.remove("text-emerald-300");
    salesforceStatus.classList.add("text-amber-300");
  }
}

function resetDemoState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  state = loadState();
  tourActive = false;
  tourStepIndex = 0;
  clearHighlight();
  hideTourCoach();

  activate("overview");
  rolloutPercent = 75;
  if (deployFill instanceof HTMLElement) {
    deployFill.style.width = "75%";
    deployFill.classList.add("w-3/4");
  }
  if (deployStatus instanceof HTMLElement) {
    deployStatus.textContent = "75% complete · Production canary in progress";
  }
  if (deployHistory instanceof HTMLUListElement) deployHistory.innerHTML = INITIAL_DEPLOY_HISTORY;
  if (apiKeyList instanceof HTMLElement) apiKeyList.innerHTML = INITIAL_API_KEY_LIST;
  if (integrationDetail instanceof HTMLElement) {
    integrationDetail.innerHTML = DEFAULT_INTEGRATION_DETAIL;
  }

  resetSalesforceCard();
  setBuilderState("GitHub push event", "branch == main", "Deploy to staging");

  const keyNameInput = document.getElementById("keyName");
  const keyEnvInput = document.getElementById("keyEnv");
  if (keyNameInput instanceof HTMLInputElement) keyNameInput.value = "";
  if (keyEnvInput instanceof HTMLSelectElement) keyEnvInput.value = "Staging";

  renderOnboarding();
  syncWidgetState();
  setStatus("Demo reset");
  toast("Demo reset — onboarding cleared.");
}

nav?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (!target.dataset.view) return;
  activate(target.dataset.view);
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  if (target.dataset.view) return;

  const action = target.dataset.action || "";

  if (action === "go-workflows") {
    activate("workflows");
    return;
  }

  if (action === "go-api-keys") {
    activate("api-keys");
    return;
  }

  if (action === "start-blank-workflow") {
    activate("workflows");
    setBuilderState("Manual trigger", "always true", "Notify Slack + create Jira ticket");
    toast("Blank workflow created.");
    completeStep("workflow_blank");
    return;
  }

  if (action === "use-template") {
    const template = target.dataset.template || "Template";
    activate("workflows");
    if (template === "Release automation") {
      setBuilderState("GitHub release tag", "tests_passed == true", "Deploy to production canary");
    } else if (template === "Support escalation") {
      setBuilderState("Zendesk priority update", "priority == urgent", "Page on-call + create incident timeline");
    } else {
      setBuilderState("New user signup", "plan == trial", "Create lifecycle tasks in CRM");
    }
    toast(`${template} loaded.`);
    completeStep("workflow_template");
    return;
  }

  if (action === "manage-github") {
    activate("integrations");
    setIntegrationDetail("GitHub Integration", [
      "Auth scope: repo, read:org, workflow",
      "Webhooks: push, pull_request, release",
      "Health: Receiving events successfully (last event 42s ago)",
    ]);
    completeStep("github_detail");
    return;
  }

  if (action === "manage-slack") {
    activate("integrations");
    setIntegrationDetail("Slack Integration", [
      "Connected workspace: RunBook Ops",
      "Channels: #deployments, #onboarding-assistant",
      "Health: Bot token valid, notifications delivered",
    ]);
    return;
  }

  if (action === "connect-salesforce") {
    if (salesforceStatus instanceof HTMLElement) {
      salesforceStatus.textContent = "Connected";
      salesforceStatus.classList.remove("text-amber-300");
      salesforceStatus.classList.add("text-emerald-300");
    }
    target.textContent = "Manage";
    target.dataset.action = "manage-salesforce";
    target.setAttribute("data-runbook-action", "manage-salesforce");
    setIntegrationDetail("Salesforce Integration", [
      "Auth completed via OAuth2",
      "Objects synced: Accounts, Contacts, Opportunities",
      "Health: Initial sync in progress",
    ]);
    toast("Salesforce connected.");
    completeStep("salesforce");
    return;
  }

  if (action === "manage-salesforce") {
    activate("integrations");
    setIntegrationDetail("Salesforce Integration", [
      "Sync mode: incremental every 15 minutes",
      "Last sync: 3 minutes ago",
      "Health: No sync errors",
    ]);
    return;
  }

  if (action === "pause-rollout") {
    updateRollout(rolloutPercent, "Rollout paused · Waiting for manual resume");
    addDeployHistory(`v1.43.0 · Paused at ${rolloutPercent}% · just now`);
    toast("Rollout paused.");
    completeStep("deploy_pause");
    return;
  }

  if (action === "rollback-now") {
    updateRollout(35, "Rollback in progress · Restoring stable release");
    addDeployHistory("v1.43.0 · Rollback started · just now");
    toast("Rollback started.");
  }
});

document.getElementById("resetDemoBtn")?.addEventListener("click", () => {
  resetDemoState();
});

document.getElementById("tourSkipBtn")?.addEventListener("click", () => {
  tourActive = false;
  clearHighlight();
  hideTourCoach();
  setStatus("Tour paused.");
});

window.addEventListener("runbook-start-tour", () => startTour());
window.addEventListener("runbook-watch-me-start", () => {
  tourActive = false;
  hideTourCoach();
  clearHighlight();
});
window.addEventListener("runbook-what-next", () => highlightNextAction());
window.addEventListener("runbook-ui-action", (evt) => {
  const detail = evt?.detail || {};
  if (detail.type === "start_tour") startTour();
  if (detail.type === "highlight") highlightNextAction();
});

if (apiKeyForm instanceof HTMLFormElement) {
  apiKeyForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const keyNameInput = document.getElementById("keyName");
    const keyEnvInput = document.getElementById("keyEnv");
    if (!(keyNameInput instanceof HTMLInputElement)) return;
    if (!(keyEnvInput instanceof HTMLSelectElement)) return;

    const keyName = keyNameInput.value.trim() || "untitled";
    const keyEnv = keyEnvInput.value.trim();
    const masked = `rb_${Math.random().toString(36).slice(2, 8)}****`;
    const item = document.createElement("li");
    item.className = "flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-2";
    item.innerHTML = `<span>${keyName} (${keyEnv})</span><span class="text-slate-400">${masked}</span>`;
    if (apiKeyList instanceof HTMLUListElement) apiKeyList.prepend(item);

    keyNameInput.value = "";
    keyEnvInput.value = "Staging";
    toast("API key generated.");
    completeStep("api_key");
  });
}

function init() {
  renderOnboarding();
  syncWidgetState();
  setStatus("Ready — use Watch full setup or Guided steps in Runbook.");
}

init();
