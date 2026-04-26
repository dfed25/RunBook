const STORAGE_KEY = "signalpress_ultra_article_demo_v1";

const onboardingStepsMeta = [
  { id: "like_article", label: "Like the article" },
  { id: "save_article", label: "Save to your reading list" },
  { id: "add_highlight", label: "Add a highlight note" },
];

const TOUR_STEPS = [
  {
    selector: "[data-tour-target='like-article']",
    feature: "engagement",
    title: "Like",
    description: "Try the public like control — it updates counters and the AI outline.",
    done: () => state.likes > 0,
  },
  {
    selector: "[data-tour-target='save-article']",
    feature: "engagement",
    title: "Save",
    description: "Toggle saved state so readers can track this piece later.",
    done: () => state.saved,
  },
  {
    selector: "[data-tour-target='add-highlight']",
    feature: "highlights-footer",
    title: "Highlight",
    description: "Add a canned highlight to demo annotation workflows.",
    done: () => state.highlights.length > 0,
  },
];

const baseState = {
  likes: 0,
  saved: false,
  highlights: [],
};

let state = loadState();
let tourActive = false;
let tourStepIndex = 0;
let highlightedEl = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...baseState, highlights: [] };
    const parsed = JSON.parse(raw);
    return { ...baseState, ...parsed, highlights: parsed.highlights || [] };
  } catch {
    return { ...baseState, highlights: [] };
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
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function isOnboardingComplete(stepId) {
  if (stepId === "like_article") return state.likes > 0;
  if (stepId === "save_article") return state.saved;
  if (stepId === "add_highlight") return state.highlights.length > 0;
  return false;
}

function getUnlockedOnboardingIndex() {
  for (let i = 0; i < onboardingStepsMeta.length; i += 1) {
    if (!isOnboardingComplete(onboardingStepsMeta[i].id)) return i;
  }
  return onboardingStepsMeta.length;
}

function renderOnboarding() {
  const container = document.getElementById("onboardingSteps");
  if (!container) return;
  const unlocked = getUnlockedOnboardingIndex();
  container.innerHTML = "";
  onboardingStepsMeta.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step.label;
    if (isOnboardingComplete(step.id)) li.classList.add("step-complete");
    else if (index === unlocked) li.classList.add("step-active");
    else if (index > unlocked) li.classList.add("step-locked");
    container.appendChild(li);
  });
  const done = onboardingStepsMeta.filter((s) => isOnboardingComplete(s.id)).length;
  const progressText = document.getElementById("onboardingProgressText");
  if (progressText) progressText.textContent = `${done} / ${onboardingStepsMeta.length} complete`;
}

function renderDashboard() {
  const dashboardLikes = document.getElementById("dashboardLikes");
  const dashboardSaved = document.getElementById("dashboardSaved");
  const dashboardHighlights = document.getElementById("dashboardHighlights");

  if (dashboardLikes) dashboardLikes.textContent = String(state.likes);
  if (dashboardSaved) dashboardSaved.textContent = state.saved ? "Yes" : "No";
  if (dashboardHighlights) dashboardHighlights.textContent = String(state.highlights.length);
}

function renderEngagement() {
  const likeCountLabel = document.getElementById("likeCountLabel");
  const saveStateLabel = document.getElementById("saveStateLabel");
  const saveBtn = document.getElementById("saveBtn");
  const likeBtn = document.getElementById("likeBtn");

  if (likeCountLabel) likeCountLabel.textContent = `${state.likes} likes`;
  if (saveStateLabel) saveStateLabel.textContent = state.saved ? "Saved to reading list" : "Not saved";
  if (saveBtn) saveBtn.textContent = state.saved ? "Unsave" : "Save";
  if (likeBtn) likeBtn.textContent = state.likes > 0 ? "Like Again" : "Like";
}

function renderHighlights() {
  const list = document.getElementById("highlightsList");
  if (!list) return;
  list.innerHTML = "";
  if (!state.highlights.length) {
    const li = document.createElement("li");
    li.textContent = "No highlights yet. Click 'Add Highlight Note' to demo annotation.";
    list.appendChild(li);
    return;
  }
  state.highlights.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
}

function renderAiOutline() {
  const aiOutline = document.getElementById("aiOutline");
  if (!aiOutline) return;
  const payload = {
    docType: "blog-article",
    title: "How to Build AI-Readable Content Without Losing Human UX",
    components: ["quick-summary", "decision-matrix", "key-facts", "machine-outline"],
    engagement: {
      likes: state.likes,
      saved: state.saved,
      highlightCount: state.highlights.length,
    },
  };
  aiOutline.textContent = JSON.stringify(payload, null, 2);
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
    setStatus("Guided tour complete.");
    toast("Guided tour complete.");
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
  clearHighlight();
  const target = document.querySelector(step.selector);
  if (target instanceof HTMLElement) {
    highlightedEl = target;
    highlightedEl.classList.add("tour-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  setStatus(`Next: ${step.title}`);
  toast(`Next: ${step.title}`);
}

function addHighlight() {
  const noteTemplates = [
    "Highlight: Use data-ai tags only where they add real clarity.",
    "Highlight: Add one summary block every 2-3 sections.",
    "Highlight: AI readability should improve UX, not replace writing quality.",
    "Highlight: Include feature explainers for non-technical readers.",
  ];
  const note = noteTemplates[state.highlights.length % noteTemplates.length];
  state.highlights.push(note);
  saveState();
  renderHighlights();
  renderDashboard();
  renderAiOutline();
  renderOnboarding();
  maybeAdvanceTour();
}

function bindActions() {
  document.getElementById("likeBtn")?.addEventListener("click", () => {
    state.likes += 1;
    saveState();
    renderEngagement();
    renderDashboard();
    renderAiOutline();
    renderOnboarding();
    toast("You liked this article.");
    maybeAdvanceTour();
  });

  document.getElementById("saveBtn")?.addEventListener("click", () => {
    state.saved = !state.saved;
    saveState();
    renderEngagement();
    renderDashboard();
    renderAiOutline();
    renderOnboarding();
    toast(state.saved ? "Article saved." : "Article removed from saved.");
    maybeAdvanceTour();
  });

  document.getElementById("addHighlightBtn")?.addEventListener("click", () => {
    addHighlight();
    toast("Highlight note added.");
  });

  document.getElementById("resetDemoBtn")?.addEventListener("click", () => {
    state = { ...baseState, highlights: [] };
    tourActive = false;
    tourStepIndex = 0;
    clearHighlight();
    hideTourCoach();
    saveState();
    renderEngagement();
    renderHighlights();
    renderDashboard();
    renderAiOutline();
    renderOnboarding();
    setStatus("Demo reset");
    toast("Demo state reset.");
  });

  document.getElementById("tourSkipBtn")?.addEventListener("click", () => {
    tourActive = false;
    clearHighlight();
    hideTourCoach();
    setStatus("Tour paused.");
  });
}

function init() {
  bindActions();
  renderEngagement();
  renderHighlights();
  renderDashboard();
  renderAiOutline();
  renderOnboarding();
  saveState();
  setStatus("Ready — Watch full setup or Guided steps in Runbook.");
}

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

init();
