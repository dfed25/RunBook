const STORAGE_KEY = "runbook_demo2_state_v1";

const steps = [
  { id: "add_collection", label: "Add first product collection" },
  { id: "configure_sku", label: "Configure SKU inventory thresholds" },
  { id: "connect_payment", label: "Connect payment processor" },
  { id: "set_tax", label: "Set tax region defaults" },
  { id: "create_zone", label: "Create shipping zone and carrier rule" },
  { id: "set_expedite", label: "Configure expedited shipping surcharge" },
  { id: "enable_returns", label: "Enable returns eligibility policy" },
  { id: "returns_sla", label: "Define returns SLA thresholds" },
  { id: "create_discount", label: "Create first discount campaign" },
  { id: "configure_abandon", label: "Configure cart abandonment automation" },
  { id: "setup_escalation", label: "Add support escalation path" },
  { id: "invite_ops", label: "Invite operations manager role" },
  { id: "simulate_launch", label: "Run launch readiness simulation" },
  { id: "final_gate", label: "Pass all launch gating checks" },
];

const baseState = {
  completed: {},
  collectionsAdded: 0,
  paymentConnected: false,
  taxConfigured: false,
  zoneConfigured: false,
  expediteConfigured: false,
  returnsEnabled: false,
  returnsSlaConfigured: false,
  campaignCreated: false,
  abandonConfigured: false,
  escalationConfigured: false,
  opsInvited: false,
  launchSimulated: false,
  flowProgress: {
    catalog: 0,
    payments: 0,
    shipping: 0,
    returns: 0,
    marketing: 0,
    team: 0,
    launch: 0,
  },
};

let state = loadState();
let tourActive = false;
let tourStepIndex = 0;
let highlightedEl = null;

/* One coach step per onboarding milestone (14); keep RUNBOOK_DEMO_STEPS (Watch) in lockstep with this list. */
const TOUR_STEPS = [
  {
    id: "catalog-add",
    selector: "#addCollectionBtn",
    feature: "catalog-flow",
    view: "catalog",
    title: "Add a collection",
    description: "Create your first merchandising collection to unlock catalog milestones.",
    done: () => isStepComplete("add_collection"),
  },
  {
    id: "catalog-sku",
    selector: "#configureSkuBtn",
    feature: "catalog-flow",
    view: "catalog",
    title: "SKU thresholds",
    description: "Configure low-stock triggers, lead times, and supplier SLA for replenishment.",
    done: () => isStepComplete("configure_sku"),
  },
  {
    id: "payments-connect",
    selector: "#connectPaymentsBtn",
    feature: "payments-flow",
    view: "payments",
    title: "Connect payments",
    description: "Connect Stripe so checkout, chargeback shield, and payouts can be verified.",
    done: () => isStepComplete("connect_payment"),
  },
  {
    id: "payments-tax",
    selector: "#setTaxDefaultsBtn",
    feature: "payments-flow",
    view: "payments",
    title: "Tax regions",
    description: "Apply US and EU tax defaults after the processor is connected.",
    done: () => isStepComplete("set_tax"),
  },
  {
    id: "shipping-zone",
    selector: "#createZoneBtn",
    feature: "shipping-flow",
    view: "shipping",
    title: "Shipping zone",
    description: "Create the first zone and baseline carrier rule for fulfillment promises.",
    done: () => isStepComplete("create_zone"),
  },
  {
    id: "shipping-expedite",
    selector: "#setExpediteBtn",
    feature: "shipping-flow",
    view: "shipping",
    title: "Expedited shipping",
    description: "Set expedited surcharge and delivery promise windows.",
    done: () => isStepComplete("set_expedite"),
  },
  {
    id: "returns-enable",
    selector: "#enableReturnsBtn",
    feature: "returns-flow",
    view: "returns",
    title: "Enable returns",
    description: "Turn on return eligibility and reason codes for support.",
    done: () => isStepComplete("enable_returns"),
  },
  {
    id: "returns-guided",
    selector: "#returnsGuideNextBtn",
    feature: "returns-flow",
    view: "returns",
    title: "Returns SLAs",
    description:
      "Click Next Guided Step until SLAs are set (reason codes, then inspection/refund thresholds).",
    done: () => isStepComplete("returns_sla"),
  },
  {
    id: "marketing-discount",
    selector: "#createDiscountBtn",
    feature: "marketing-flow",
    view: "marketing",
    title: "Discount campaign",
    description: "Create a launch discount so acquisition flows can be tested end-to-end.",
    done: () => isStepComplete("create_discount"),
  },
  {
    id: "marketing-abandon",
    selector: "#configureAbandonBtn",
    feature: "marketing-flow",
    view: "marketing",
    title: "Cart abandonment",
    description: "Configure recovery automation (email and SMS timing).",
    done: () => isStepComplete("configure_abandon"),
  },
  {
    id: "team-escalation",
    selector: "#setupEscalationBtn",
    feature: "team-flow",
    view: "team",
    title: "Support escalation",
    description: "Define the escalation path from support to ops and fulfillment (required for launch gates).",
    done: () => isStepComplete("setup_escalation"),
  },
  {
    id: "team-invite",
    selector: "#inviteOpsBtn",
    feature: "team-flow",
    view: "team",
    title: "Invite operations",
    description: "Invite the operations manager with launch approval permissions.",
    done: () => isStepComplete("invite_ops"),
  },
  {
    id: "launch-sim",
    selector: "#runLaunchSimBtn",
    feature: "launch-flow",
    view: "launch",
    title: "Launch simulation",
    description: "Run the readiness simulation to refresh gating checks and score.",
    done: () => isStepComplete("simulate_launch"),
  },
  {
    id: "home-wrap",
    selector: "[data-runbook-feature='onboarding-rail']",
    feature: "home-snapshot",
    view: "home",
    title: "Confirm launch readiness",
    description:
      "Return to Home and verify all gating checks passed and onboarding shows complete (final gate clears when every prerequisite is met).",
    done: () => isStepComplete("final_gate"),
  },
];

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

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function setStatus(message) {
  window.dispatchEvent(new CustomEvent("runbook-assistant-status", { detail: message }));
}

function appStateForWidget() {
  return {
    githubConnected: isStepComplete("add_collection"),
    apiKeyCreated: isStepComplete("connect_payment"),
    workflowCreated: isStepComplete("create_zone"),
    deployed: isStepComplete("simulate_launch"),
  };
}

function goToView(view) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === view);
  });
}

function completeStep(stepId) {
  state.completed[stepId] = true;
  saveState();
  renderOnboarding();
  renderLaunchGates();
  renderLaunchScore();
  syncWidgetState();
  maybeAdvanceTour();
}

function isStepComplete(stepId) {
  return Boolean(state.completed[stepId]);
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

function launchScore() {
  const done = steps.filter((s) => isStepComplete(s.id)).length;
  return Math.round((done / steps.length) * 100);
}

function renderLaunchScore() {
  const score = launchScore();
  const launchScoreText = document.getElementById("launchScoreText");
  const launchScoreBadge = document.getElementById("launchScoreBadge");
  const launchProgress = document.getElementById("launchProgress");
  if (launchScoreText) launchScoreText.textContent = `${score}%`;
  if (launchScoreBadge) launchScoreBadge.textContent = `${score}%`;
  if (launchProgress) launchProgress.style.width = `${score}%`;
}

function renderLaunchGates() {
  const gateList = document.getElementById("launchGateList");
  if (!gateList) return;
  const gates = [
    ["Catalog baseline configured", isStepComplete("configure_sku")],
    ["Payments and tax ready", isStepComplete("connect_payment") && isStepComplete("set_tax")],
    ["Shipping rules complete", isStepComplete("create_zone") && isStepComplete("set_expedite")],
    ["Returns + support path active", isStepComplete("enable_returns") && isStepComplete("setup_escalation")],
    ["Team and marketing ready", isStepComplete("invite_ops") && isStepComplete("create_discount") && isStepComplete("configure_abandon")],
  ];
  const finalPassed = gates.every((g) => g[1]);
  if (finalPassed && !isStepComplete("final_gate")) completeStep("final_gate");
  gateList.innerHTML = gates
    .map(([label, ok]) => `<li>${ok ? "PASS" : "PENDING"} - ${label}</li>`)
    .join("");
}

function renderPersistentPanels() {
  const paymentStatus = document.getElementById("paymentStatus");
  const chargebackStatus = document.getElementById("chargebackStatus");
  const payoutStatus = document.getElementById("payoutStatus");
  if (paymentStatus) paymentStatus.textContent = state.paymentConnected ? "Connected (Stripe)" : "Disconnected";
  if (chargebackStatus) chargebackStatus.textContent = state.paymentConnected ? "Active" : "Inactive";
  if (payoutStatus) payoutStatus.textContent = state.paymentConnected ? "Daily @ 02:00 UTC" : "Not configured";

  const zone = document.getElementById("shippingZoneState");
  if (zone) zone.textContent = state.zoneConfigured ? "Zone: North America | Carrier: FastShip Ground | SLA: 2-4 days" : "No custom shipping zones yet.";

  const expedite = document.getElementById("expediteValue");
  if (expedite) expedite.textContent = state.expediteConfigured ? "$12 surcharge + 1-day SLA" : "Not configured";

  const returns = document.getElementById("returnsPolicyStatus");
  if (returns) returns.textContent = state.returnsEnabled ? "Enabled (30-day window)" : "Disabled";

  const inspection = document.getElementById("inspectionSla");
  const refund = document.getElementById("refundSla");
  const escalation = document.getElementById("escalationSla");
  if (inspection) inspection.textContent = state.returnsSlaConfigured ? "24 hours" : "Not set";
  if (refund) refund.textContent = state.returnsSlaConfigured ? "48 hours" : "Not set";
  if (escalation) escalation.textContent = state.returnsSlaConfigured ? "Escalate after 72 hours" : "Not set";

  const abandon = document.getElementById("abandonStatus");
  if (abandon) abandon.textContent = state.abandonConfigured ? "Active (45m email + 4h SMS)" : "Not configured";

  const escalationPathStatus = document.getElementById("escalationPathStatus");
  if (escalationPathStatus) escalationPathStatus.textContent = state.escalationConfigured ? "L1 Support -> Ops Lead -> Fulfillment Eng" : "Not configured";
}

function renderGuidedFlows() {
  const flowMap = {
    catalog: {
      statusId: "catalogGuideStatus",
      buttonId: "catalogGuideNextBtn",
      lines: [
        "Step 1/3: Add a launch collection.",
        "Step 2/3: Configure SKU inventory thresholds.",
        "Step 3/3: Validate supplier SLA and publish readiness.",
        "Catalog guided flow complete.",
      ],
    },
    payments: {
      statusId: "paymentsGuideStatus",
      buttonId: "paymentsGuideNextBtn",
      lines: [
        "Step 1/3: Connect payment processor.",
        "Step 2/3: Enable chargeback shield and payout schedule.",
        "Step 3/3: Apply US/EU tax defaults.",
        "Payments guided flow complete.",
      ],
    },
    shipping: {
      statusId: "shippingGuideStatus",
      buttonId: "shippingGuideNextBtn",
      lines: [
        "Step 1/3: Create first shipping zone.",
        "Step 2/3: Assign carrier SLA policy.",
        "Step 3/3: Configure expedited surcharge.",
        "Shipping guided flow complete.",
      ],
    },
    returns: {
      statusId: "returnsGuideStatus",
      buttonId: "returnsGuideNextBtn",
      lines: [
        "Step 1/3: Enable returns eligibility.",
        "Step 2/3: Configure return reason codes.",
        "Step 3/3: Set inspection/refund SLAs.",
        "Returns guided flow complete.",
      ],
    },
    marketing: {
      statusId: "marketingGuideStatus",
      buttonId: "marketingGuideNextBtn",
      lines: [
        "Step 1/3: Create launch discount campaign.",
        "Step 2/3: Configure cart abandonment sequence.",
        "Step 3/3: Activate launch messaging.",
        "Marketing guided flow complete.",
      ],
    },
    team: {
      statusId: "teamGuideStatus",
      buttonId: "teamGuideNextBtn",
      lines: [
        "Step 1/3: Invite operations manager.",
        "Step 2/3: Define support escalation path.",
        "Step 3/3: Confirm permission boundaries.",
        "Team guided flow complete.",
      ],
    },
    launch: {
      statusId: "launchGuideStatus",
      buttonId: "launchGuideNextBtn",
      lines: [
        "Step 1/3: Run launch simulation.",
        "Step 2/3: Resolve pending gating checks.",
        "Step 3/3: Confirm launch approval packet.",
        "Launch guided flow complete.",
      ],
    },
  };

  Object.entries(flowMap).forEach(([key, config]) => {
    const progress = state.flowProgress[key] || 0;
    const statusEl = document.getElementById(config.statusId);
    const buttonEl = document.getElementById(config.buttonId);
    if (statusEl) statusEl.innerHTML = `<strong>${config.lines[Math.min(progress, 3)]}</strong>`;
    if (buttonEl) buttonEl.disabled = progress >= 3;
  });
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
  goToView(step.view);
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
  if (!step) return;
  if (!step.done()) return;
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
  goToView(step.view);
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

function syncWidgetState() {
  const app = appStateForWidget();
  window.__runbookAppState = app;
  window.dispatchEvent(new CustomEvent("runbook-app-state", { detail: app }));
}

function advanceFlow(flowKey) {
  state.flowProgress[flowKey] = Math.min(3, (state.flowProgress[flowKey] || 0) + 1);
  renderGuidedFlows();
  saveState();
}

function addCatalogRow() {
  const body = document.getElementById("catalogTableBody");
  if (!body) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>Launch Bundle ${state.collectionsAdded}</td><td>${36 + state.collectionsAdded * 4}</td><td>${31 + state.collectionsAdded}%</td><td>Draft</td>`;
  body.appendChild(tr);
}

function updateTaxTable() {
  const body = document.getElementById("taxTableBody");
  if (!body) return;
  body.innerHTML = `
    <tr><td>United States</td><td>8.25%</td><td>Configured</td></tr>
    <tr><td>European Union</td><td>19%</td><td>Configured</td></tr>
  `;
}

function updateCampaignList() {
  const list = document.getElementById("campaignList");
  if (!list) return;
  list.innerHTML = "";
  const items = [
    state.campaignCreated ? "Launch-Week Discount: 15% for first order" : "No active discount campaigns yet.",
    state.abandonConfigured ? "Cart Recovery: email at 45m, SMS at 4h" : "Cart recovery flow not configured.",
  ];
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function maybeCompleteFinalSteps() {
  if (state.launchSimulated) completeStep("simulate_launch");
  renderLaunchGates();
}

const INITIAL_CATALOG_ROW =
  "<tr><td>Spring Essentials</td><td>48</td><td>34%</td><td>Published</td></tr>";
const INITIAL_TAX_ROWS = `
    <tr><td>United States</td><td>--</td><td>Pending</td></tr>
    <tr><td>European Union</td><td>--</td><td>Pending</td></tr>
  `;
const INITIAL_TEAM_ROW = "<tr><td>Ava Chen</td><td>Admin</td><td>All</td></tr>";

function resetDemoState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  state = loadState();
  goToView("home");

  const catalogBody = document.getElementById("catalogTableBody");
  if (catalogBody) catalogBody.innerHTML = INITIAL_CATALOG_ROW;

  const teamBody = document.getElementById("teamTableBody");
  if (teamBody) teamBody.innerHTML = INITIAL_TEAM_ROW;

  const taxBody = document.getElementById("taxTableBody");
  if (taxBody) taxBody.innerHTML = INITIAL_TAX_ROWS;

  const timeline = document.getElementById("timelineList");
  if (timeline) {
    timeline.innerHTML =
      "<li>09:00 Inventory sync window opens</li>" +
      "<li>10:30 Checkout fraud rule rollout</li>" +
      "<li>13:00 Carrier SLA calibration</li>" +
      "<li>16:00 Launch readiness simulation</li>";
  }

  const ordersW = document.getElementById("ordersWaiting");
  const returnsP = document.getElementById("returnsPending");
  if (ordersW) ordersW.textContent = "18";
  if (returnsP) returnsP.textContent = "6";

  const low = document.getElementById("lowStockValue");
  const lead = document.getElementById("leadDaysValue");
  const sup = document.getElementById("supplierSlaValue");
  if (low) low.textContent = "Not configured";
  if (lead) lead.textContent = "Not configured";
  if (sup) sup.textContent = "Not configured";

  renderOnboarding();
  renderPersistentPanels();
  updateCampaignList();
  renderLaunchGates();
  renderLaunchScore();
  renderGuidedFlows();
  syncWidgetState();
  setStatus("Demo reset");
  saveState();
  toast("Demo reset — onboarding cleared.");
}

function bindActions() {
  document.getElementById("resetDemoBtn")?.addEventListener("click", () => {
    resetDemoState();
  });
  document.getElementById("addCollectionBtn")?.addEventListener("click", () => {
    state.collectionsAdded += 1;
    addCatalogRow();
    completeStep("add_collection");
    if ((state.flowProgress.catalog || 0) < 1) advanceFlow("catalog");
    toast("Collection added.");
  });

  document.getElementById("configureSkuBtn")?.addEventListener("click", () => {
    document.getElementById("lowStockValue").textContent = "12 units";
    document.getElementById("leadDaysValue").textContent = "9 days";
    document.getElementById("supplierSlaValue").textContent = "95% on-time";
    completeStep("configure_sku");
    if ((state.flowProgress.catalog || 0) < 2) advanceFlow("catalog");
    toast("SKU thresholds configured.");
  });

  document.getElementById("connectPaymentsBtn")?.addEventListener("click", () => {
    state.paymentConnected = true;
    renderPersistentPanels();
    completeStep("connect_payment");
    if ((state.flowProgress.payments || 0) < 1) advanceFlow("payments");
    toast("Payment processor connected.");
  });

  document.getElementById("setTaxDefaultsBtn")?.addEventListener("click", () => {
    state.taxConfigured = true;
    updateTaxTable();
    completeStep("set_tax");
    if ((state.flowProgress.payments || 0) < 3) state.flowProgress.payments = 3;
    renderGuidedFlows();
    toast("Tax defaults saved.");
  });

  document.getElementById("createZoneBtn")?.addEventListener("click", () => {
    state.zoneConfigured = true;
    renderPersistentPanels();
    completeStep("create_zone");
    if ((state.flowProgress.shipping || 0) < 1) advanceFlow("shipping");
    toast("Shipping zone created.");
  });

  document.getElementById("setExpediteBtn")?.addEventListener("click", () => {
    state.expediteConfigured = true;
    renderPersistentPanels();
    completeStep("set_expedite");
    if ((state.flowProgress.shipping || 0) < 3) state.flowProgress.shipping = 3;
    renderGuidedFlows();
    toast("Expedited surcharge configured.");
  });

  document.getElementById("enableReturnsBtn")?.addEventListener("click", () => {
    state.returnsEnabled = true;
    renderPersistentPanels();
    completeStep("enable_returns");
    if ((state.flowProgress.returns || 0) < 1) advanceFlow("returns");
    toast("Returns policy enabled.");
  });

  document.getElementById("createDiscountBtn")?.addEventListener("click", () => {
    state.campaignCreated = true;
    updateCampaignList();
    completeStep("create_discount");
    if ((state.flowProgress.marketing || 0) < 1) advanceFlow("marketing");
    toast("Discount campaign created.");
  });

  document.getElementById("configureAbandonBtn")?.addEventListener("click", () => {
    state.abandonConfigured = true;
    updateCampaignList();
    completeStep("configure_abandon");
    if ((state.flowProgress.marketing || 0) < 2) advanceFlow("marketing");
    toast("Abandonment automation active.");
  });

  document.getElementById("setupEscalationBtn")?.addEventListener("click", () => {
    state.escalationConfigured = true;
    renderPersistentPanels();
    completeStep("setup_escalation");
    if ((state.flowProgress.team || 0) < 2) advanceFlow("team");
    toast("Escalation path set.");
  });

  document.getElementById("inviteOpsBtn")?.addEventListener("click", () => {
    if (!state.opsInvited) {
      const teamBody = document.getElementById("teamTableBody");
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>Jordan Patel</td><td>Operations Manager</td><td>Launch approvals, shipping overrides, returns escalation</td>";
      teamBody?.appendChild(tr);
    }
    state.opsInvited = true;
    completeStep("invite_ops");
    if ((state.flowProgress.team || 0) < 1) advanceFlow("team");
    toast("Operations manager invited.");
  });

  document.getElementById("runLaunchSimBtn")?.addEventListener("click", () => {
    state.launchSimulated = true;
    completeStep("simulate_launch");
    if ((state.flowProgress.launch || 0) < 1) advanceFlow("launch");
    maybeCompleteFinalSteps();
    toast("Launch simulation complete.");
  });

  document.getElementById("tourSkipBtn")?.addEventListener("click", () => {
    tourActive = false;
    renderTour();
    setStatus("Tour paused.");
  });

  document.getElementById("catalogGuideNextBtn")?.addEventListener("click", () => {
    goToView("catalog");
    if ((state.flowProgress.catalog || 0) === 0) toast("Action required: click Add Collection.");
    else if ((state.flowProgress.catalog || 0) === 1) toast("Action required: click Configure Thresholds.");
    else if ((state.flowProgress.catalog || 0) === 2) {
      advanceFlow("catalog");
      toast("Catalog readiness confirmed.");
    }
  });

  document.getElementById("paymentsGuideNextBtn")?.addEventListener("click", () => {
    goToView("payments");
    if ((state.flowProgress.payments || 0) === 0) toast("Action required: connect processor.");
    else if ((state.flowProgress.payments || 0) === 1) {
      state.paymentConnected = true;
      renderPersistentPanels();
      advanceFlow("payments");
      toast("Fraud shield and payout schedule verified.");
    } else if ((state.flowProgress.payments || 0) === 2) toast("Action required: set tax defaults.");
  });

  document.getElementById("shippingGuideNextBtn")?.addEventListener("click", () => {
    goToView("shipping");
    if ((state.flowProgress.shipping || 0) === 0) toast("Action required: create zone rule.");
    else if ((state.flowProgress.shipping || 0) === 1) {
      advanceFlow("shipping");
      toast("Carrier SLA policy applied.");
    } else if ((state.flowProgress.shipping || 0) === 2) toast("Action required: set expedited surcharge.");
  });

  document.getElementById("returnsGuideNextBtn")?.addEventListener("click", () => {
    goToView("returns");
    if ((state.flowProgress.returns || 0) === 0) toast("Action required: enable returns eligibility.");
    else if ((state.flowProgress.returns || 0) === 1) {
      advanceFlow("returns");
      toast("Return reason codes configured.");
    } else if ((state.flowProgress.returns || 0) === 2) {
      state.returnsSlaConfigured = true;
      completeStep("returns_sla");
      advanceFlow("returns");
      renderPersistentPanels();
      toast("Returns SLA finalized.");
    }
  });

  document.getElementById("marketingGuideNextBtn")?.addEventListener("click", () => {
    goToView("marketing");
    if ((state.flowProgress.marketing || 0) === 0) toast("Action required: create discount campaign.");
    else if ((state.flowProgress.marketing || 0) === 1) toast("Action required: configure abandonment flow.");
    else if ((state.flowProgress.marketing || 0) === 2) {
      advanceFlow("marketing");
      toast("Launch messaging activated.");
    }
  });

  document.getElementById("teamGuideNextBtn")?.addEventListener("click", () => {
    goToView("team");
    if ((state.flowProgress.team || 0) === 0) toast("Action required: invite operations manager.");
    else if ((state.flowProgress.team || 0) === 1) toast("Action required: configure escalation path.");
    else if ((state.flowProgress.team || 0) === 2) {
      advanceFlow("team");
      toast("Permission boundaries verified.");
    }
  });

  document.getElementById("launchGuideNextBtn")?.addEventListener("click", () => {
    goToView("launch");
    if ((state.flowProgress.launch || 0) === 0) toast("Action required: run launch simulation.");
    else if ((state.flowProgress.launch || 0) === 1) {
      maybeCompleteFinalSteps();
      advanceFlow("launch");
      toast("Launch blockers reviewed.");
    } else if ((state.flowProgress.launch || 0) === 2) {
      advanceFlow("launch");
      toast("Launch approval packet confirmed.");
    }
  });

  document.getElementById("cmdPaletteBtn")?.addEventListener("click", () => {
    toast("Quick actions: Add collection | Connect payments | Run launch simulation");
  });

  document.getElementById("simulateDayBtn")?.addEventListener("click", () => {
    const orders = document.getElementById("ordersWaiting");
    const returns = document.getElementById("returnsPending");
    const timeline = document.getElementById("timelineList");
    if (orders) orders.textContent = String(12 + Math.floor(Math.random() * 15));
    if (returns) returns.textContent = String(3 + Math.floor(Math.random() * 7));
    if (timeline) {
      const li = document.createElement("li");
      li.textContent = "Auto-generated: flash-sale demand spike forecast updated";
      timeline.prepend(li);
    }
    if (state.returnsEnabled && !state.returnsSlaConfigured) {
      state.returnsSlaConfigured = true;
      completeStep("returns_sla");
      renderPersistentPanels();
      toast("Returns SLA thresholds auto-populated from historical data.");
    } else {
      toast("Daily simulation refreshed.");
    }
  });

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => goToView(btn.dataset.view || "home"));
  });

  document.querySelector('[data-action="timeline-refresh"]')?.addEventListener("click", () => {
    toast("Timeline synchronized with operations events.");
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
}

function init() {
  bindActions();
  renderOnboarding();
  renderPersistentPanels();
  updateCampaignList();
  if (state.taxConfigured) updateTaxTable();
  for (let i = 1; i <= state.collectionsAdded; i += 1) addCatalogRow();
  maybeCompleteFinalSteps();
  renderLaunchScore();
  renderGuidedFlows();
  syncWidgetState();
  setStatus("Ready to guide");
  saveState();
}

init();
