// content.js — Runbook widget content script
console.log("Runbook content script initialized on", window.location.href);

let RUNBOOK_API = "http://localhost:3000";
const PAGE_TEXT_LIMIT = 12000;
const MAX_CANDIDATES = 120;

const DEMO_TASKS = {
  "/demo/github": {
    taskId: "github-access",
    taskTitle: "Request GitHub access",
    taskDescription: "Submit a GitHub access request.",
    steps: [
      { text: "Click Request Access to submit your onboarding request.", selector: "#request-access-btn" },
      { text: "Review the GitHub username and manager approval notes before proceeding.", selector: "input[value='alexchen-dev']" },
    ],
  },
  "/demo/expenses": {
    taskId: "expense-policy",
    taskTitle: "Submit your first expense report",
    taskDescription: "Complete an expense submission flow.",
    steps: [
      { text: "Open the expense form.", selector: "#submit-expense-btn" },
      { text: "Attach receipt before submitting.", selector: "input[type='file']" },
    ],
  },
};

let widgetVisible = false;
let chatVisible = false;
let currentTask = null;
let currentStepIndex = 0;
let highlightedEl = null;
let activeOverlayEl = null;
let overlayRepositionHandler = null;
let rootEl = null;
let apiConfigLoaded = false;

function sanitizeApiBaseUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function loadApiBaseUrl() {
  if (apiConfigLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      apiConfigLoaded = true;
      resolve();
      return;
    }
    chrome.storage.local.get(["runbookApiBaseUrl"], (result) => {
      const configured = sanitizeApiBaseUrl(result?.runbookApiBaseUrl);
      if (configured) RUNBOOK_API = configured;
      apiConfigLoaded = true;
      resolve();
    });
  });
}

function getDemoTaskForLocation() {
  const path = (window.location.pathname || "").toLowerCase();
  if (path.includes("/demo/github")) return DEMO_TASKS["/demo/github"];
  if (path.includes("/demo/expenses")) return DEMO_TASKS["/demo/expenses"];
  return null;
}

function byId(id) {
  if (!rootEl) return null;
  return rootEl.querySelector(`#${id}`);
}

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isLikelyVisible(el) {
  if (!(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  return true;
}

function candidateTextForElement(el) {
  const text = normalize(
    el.innerText ||
      el.textContent ||
      el.value ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      "",
  );
  return text.slice(0, 180);
}

function collectClickableCandidates() {
  const seen = new Set();
  const out = [];
  const nodes = document.querySelectorAll(
    "button, a, [role='button'], input[type='submit'], input[type='button'], summary, [aria-label]",
  );
  for (const el of nodes) {
    if (!isLikelyVisible(el)) continue;
    const text = candidateTextForElement(el);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

function getPageText() {
  const parts = [];
  const title = normalize(document.title || "");
  const h1 = normalize(document.querySelector("h1")?.textContent || "");
  const metaDescription = normalize(
    document.querySelector("meta[name='description']")?.getAttribute("content") || "",
  );
  if (title) parts.push(`page title: ${title}`);
  if (h1) parts.push(`main heading: ${h1}`);
  if (metaDescription) parts.push(`description: ${metaDescription}`);

  const mainText = normalize(document.body?.innerText || "");
  if (mainText) parts.push(mainText);

  const clickableHints = collectClickableCandidates();
  if (clickableHints.length) {
    parts.push(`clickable elements: ${clickableHints.join(" | ")}`);
  }

  return parts.join("\n").slice(0, PAGE_TEXT_LIMIT);
}

function addMessage(role, text) {
  const container = byId("rb-messages");
  if (!container) return;
  const msg = document.createElement("div");
  msg.className = `rb-msg ${role === "user" ? "rb-msg-user" : "rb-msg-assistant"}`;
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function setInstruction(text) {
  const stepText = byId("rb-step-text");
  if (stepText) stepText.textContent = text;
}

function apiRequest(path, body) {
  const url = `${RUNBOOK_API}${path}`;
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) {
      reject(new Error("Chrome runtime unavailable"));
      return;
    }
    chrome.runtime.sendMessage(
      { type: "API_REQUEST", url, method: "POST", body },
      (response) => {
        const runtimeErr = chrome.runtime.lastError;
        if (runtimeErr) {
          reject(new Error(runtimeErr.message));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "API request failed"));
          return;
        }
        resolve(response.data);
      },
    );
  });
}

function clearHighlight() {
  if (highlightedEl) {
    highlightedEl.classList.remove("rb-highlight");
    highlightedEl = null;
  }
  if (activeOverlayEl) {
    activeOverlayEl.remove();
    activeOverlayEl = null;
  }
  if (overlayRepositionHandler) {
    window.removeEventListener("scroll", overlayRepositionHandler);
    window.removeEventListener("resize", overlayRepositionHandler);
    overlayRepositionHandler = null;
  }
}

function renderHighlightOverlay(el, text, stepLabel) {
  if (activeOverlayEl) {
    activeOverlayEl.remove();
    activeOverlayEl = null;
  }

  const overlay = document.createElement("div");
  overlay.id = "rb-step-overlay";
  const labelEl = document.createElement("div");
  labelEl.className = "rb-step-overlay-label";
  labelEl.textContent = stepLabel || "Runbook step";
  const textEl = document.createElement("div");
  textEl.className = "rb-step-overlay-text";
  textEl.textContent = text || "Follow the highlighted action.";
  overlay.appendChild(labelEl);
  overlay.appendChild(textEl);
  document.body.appendChild(overlay);
  activeOverlayEl = overlay;

  const rect = el.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const top = Math.max(10, Math.min(window.innerHeight - overlayRect.height - 10, rect.bottom + window.scrollY + 10));
  const left = Math.max(10, Math.min(window.innerWidth - overlayRect.width - 10, rect.left + window.scrollX));
  overlay.style.top = `${top}px`;
  overlay.style.left = `${left}px`;

  // Keep overlay in sync as the user scrolls.
  const reposition = () => {
    if (!activeOverlayEl || !highlightedEl) return;
    const r = highlightedEl.getBoundingClientRect();
    const or = activeOverlayEl.getBoundingClientRect();
    const t = Math.max(10, Math.min(window.innerHeight - or.height - 10, r.bottom + window.scrollY + 10));
    const l = Math.max(10, Math.min(window.innerWidth - or.width - 10, r.left + window.scrollX));
    activeOverlayEl.style.top = `${t}px`;
    activeOverlayEl.style.left = `${l}px`;
  };
  overlayRepositionHandler = reposition;
  window.addEventListener("scroll", reposition, { passive: true });
  window.addEventListener("resize", reposition);
}

function highlightElement(el, instructionText, stepLabel) {
  clearHighlight();
  highlightedEl = el;
  el.classList.add("rb-highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  renderHighlightOverlay(el, instructionText, stepLabel);
}

function looksClickable(el) {
  const tag = (el.tagName || "").toLowerCase();
  if (["a", "button", "summary", "label"].includes(tag)) return true;
  if (tag === "input") {
    const type = (el.getAttribute("type") || "").toLowerCase();
    return ["button", "submit", "radio", "checkbox"].includes(type);
  }
  if (el.getAttribute("role") === "button") return true;
  return false;
}

function findElementByText(target) {
  const wanted = normalize(target);
  if (!wanted) return null;
  const clickable = Array.from(
    document.querySelectorAll(
      "button, a, [role='button'], input[type='submit'], input[type='button'], label, summary, [aria-label]",
    ),
  );
  let best = null;
  let bestScore = 0;
  for (const el of clickable) {
    if (!isLikelyVisible(el)) continue;
    const text = candidateTextForElement(el);
    if (!text) continue;
    let score = 0;
    if (text === wanted) score = 100;
    else if (text.includes(wanted)) score = 85;
    else if (wanted.includes(text)) score = 70;
    else {
      const wantedTokens = wanted.split(" ").filter(Boolean);
      const overlap = wantedTokens.filter((token) => text.includes(token)).length;
      score = Math.round((overlap / Math.max(wantedTokens.length, 1)) * 60);
    }
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  if (best && bestScore >= 45) return best;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = normalize(node.textContent || "");
    if (text && (text === wanted || text.includes(wanted))) {
      let p = node.parentElement;
      while (p && p !== document.body) {
        if (looksClickable(p)) return p;
        p = p.parentElement;
      }
    }
    node = walker.nextNode();
  }
  return null;
}

function updateTaskPanel() {
  if (!currentTask) return;
  const noTask = byId("rb-no-task");
  const content = byId("rb-task-content");
  const title = byId("rb-task-title");
  const stepNumber = byId("rb-step-number");
  const stepText = byId("rb-step-text");
  const progressFill = byId("rb-progress-fill");
  const progressLabel = byId("rb-progress-label");
  const nextBtn = byId("rb-next-btn");
  const completeBtn = byId("rb-complete-btn");
  if (!content || !title || !stepNumber || !stepText || !progressFill || !progressLabel || !nextBtn || !completeBtn) return;

  noTask?.classList.add("rb-hidden");
  content.classList.remove("rb-hidden");

  const total = currentTask.steps?.length || 1;
  const current = Math.min(currentStepIndex + 1, total);
  const pct = Math.round((current / total) * 100);

  title.textContent = currentTask.taskTitle || "Current onboarding task";
  stepNumber.textContent = `Step ${current} of ${total}`;
  stepText.textContent = currentTask.steps[currentStepIndex]?.text || "";
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `${current}/${total}`;

  const isLast = currentStepIndex >= total - 1;
  nextBtn.classList.toggle("rb-hidden", isLast);
  completeBtn.classList.toggle("rb-hidden", !isLast);
}

function togglePanel(forceOpen) {
  const panel = byId("rb-panel");
  const fab = byId("rb-fab");
  if (!panel || !fab) return;
  widgetVisible = typeof forceOpen === "boolean" ? forceOpen : !widgetVisible;
  panel.classList.toggle("rb-hidden", !widgetVisible);
  fab.classList.toggle("rb-open", widgetVisible);
  if (!widgetVisible) clearHighlight();
}

function toggleChat(forceOpen) {
  const taskView = byId("rb-task-view");
  const chatView = byId("rb-chat-view");
  const chatBtn = byId("rb-chat-toggle");
  if (!taskView || !chatView || !chatBtn) return;
  chatVisible = typeof forceOpen === "boolean" ? forceOpen : !chatVisible;
  taskView.classList.toggle("rb-hidden", chatVisible);
  chatView.classList.toggle("rb-hidden", !chatVisible);
  chatBtn.classList.toggle("rb-active", chatVisible);
}

async function scanPage() {
  const btn = byId("rb-scan-btn");
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "Scanning...";
  btn.disabled = true;
  try {
    const demoTask = getDemoTaskForLocation();
    if (demoTask) {
      currentTask = demoTask;
      currentStepIndex = 0;
      updateTaskPanel();
      addMessage("assistant", `Detected task: ${currentTask.taskTitle}`);
      togglePanel(true);
      return;
    }

    const data = await apiRequest("/api/widget", {
      url: window.location.href,
      pageText: getPageText(),
      interactiveElements: collectClickableCandidates(),
    });
    if (data?.task?.steps?.length) {
      currentTask = data.task;
      currentStepIndex = 0;
      updateTaskPanel();
      addMessage("assistant", `Detected task: ${currentTask.taskTitle}`);
      togglePanel(true);
    } else {
      addMessage("assistant", "No relevant onboarding task found on this page.");
    }
  } catch (err) {
    console.error("Runbook scan failed", err);
    addMessage("assistant", "Scan failed. Check RUNBOOK_API and try again.");
  } finally {
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function findOnPage() {
  if (!currentTask) return;
  const step = currentTask.steps[currentStepIndex];

  if (window.location.pathname === "/demo/github") {
    const demoEl = document.querySelector("#request-access-btn");
    if (demoEl) {
      highlightElement(demoEl);
      setInstruction("Click Request Access.");
      return;
    }
  }

  if (DEMO_TASKS[window.location.pathname] && step?.selector) {
    const demoEl = document.querySelector(step.selector);
    if (demoEl) {
      highlightElement(demoEl);
      setInstruction(step.text);
      return;
    }
  }

  // Deterministic fallback for real GitHub profile pages.
  if (
    currentTask.taskId === "github-profile-setup" &&
    (() => {
      const hostname = window.location.hostname.toLowerCase();
      return hostname === "github.com" || hostname.endsWith(".github.com");
    })()
  ) {
    const profileStepTargets = [
      [
        "a[href*='?tab=repositories']",
        "a[data-tab-item='repositories']",
        "a[href$='/repositories']",
      ],
      [
        "a[href*='?tab=stars']",
        "a[data-tab-item='stars']",
        "a[href$='/stars']",
      ],
      [
        "a[href='/settings/profile']",
        "a[href='/settings']",
        "button[aria-label*='Edit profile']",
      ],
    ];
    const selectors = profileStepTargets[currentStepIndex] || [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const stepText = step?.text || "Follow the highlighted GitHub profile step.";
        highlightElement(
          el,
          stepText,
          `Step ${currentStepIndex + 1} of ${currentTask.steps?.length || 1}`,
        );
        setInstruction(stepText);
        return;
      }
    }
  }

  try {
    const data = await apiRequest("/api/widget", {
      url: window.location.href,
      pageText: getPageText(),
      taskTitle: currentTask.taskTitle || "",
      taskDescription: step?.text || currentTask.taskDescription || "",
      interactiveElements: collectClickableCandidates(),
    });

    if (!data?.found || !data?.elementText) {
      setInstruction(data?.instruction || "I could not find a matching element.");
      return;
    }

    const el = findElementByText(data.elementText);
    if (!el) {
      setInstruction(data.instruction || `Look for "${data.elementText}" and click it.`);
      return;
    }

    const instruction = data.instruction || `Click "${data.elementText}".`;
    highlightElement(
      el,
      instruction,
      `Step ${currentStepIndex + 1} of ${currentTask.steps?.length || 1}`,
    );
    setInstruction(instruction);
  } catch (err) {
    console.error("Runbook find failed", err);
    setInstruction("Find on page failed. Try again.");
  }
}

function nextStep() {
  clearHighlight();
  if (!currentTask) return;
  if (currentStepIndex < currentTask.steps.length - 1) {
    currentStepIndex += 1;
    updateTaskPanel();
  }
}

async function completeTask() {
  if (!currentTask?.taskId) return;
  try {
    await apiRequest("/api/tasks/update", {
      taskId: currentTask.taskId,
      status: "complete",
    });
    const taskContent = byId("rb-task-content");
    const taskView = byId("rb-task-view");
    if (taskContent && taskView) {
      taskContent.classList.add("rb-hidden");
      let success = byId("rb-success");
      if (!success) {
        success = document.createElement("div");
        success.id = "rb-success";
        success.innerHTML = `
          <div style="text-align:center; padding:20px 0;">
            <div style="font-size:36px;">✅</div>
            <div style="font-weight:600; color:#16a34a;">Task complete!</div>
          </div>
        `;
        taskView.appendChild(success);
      }
      success.classList.remove("rb-hidden");
    }
    setTimeout(clearHighlight, 2000);
  } catch (err) {
    console.error("Task completion failed", err);
  }
}

async function sendChat() {
  const input = byId("rb-input");
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);

  const context = `Current URL: ${window.location.href}
Current task: ${currentTask?.taskTitle || "none"}
Current step: ${currentTask?.steps?.[currentStepIndex]?.text || "none"}

User question: ${text}`;

  const asksForLocation =
    /\b(where|locate|find|show me|point to|which|help me find)\b/i.test(text) &&
    /\b(button|link|tab|menu|setting|settings|profile|element|field|option|toggle|repo|repository|list)\b/i.test(
      text,
    );
  const asksForHowTo =
    /\b(how do i|how to|walk me through|guide me|what do i click|how can i)\b/i.test(
      text,
    );
  const shouldTryHighlight = asksForLocation || asksForHowTo;
  const likelyDocCoverageMiss =
    /\b(missing information|unable to locate information|not available in (the )?company|company documents|who to ask)\b/i;

  try {
    // For page-layout questions, try locating first. If we can highlight,
    // prefer the actionable guidance and suppress generic "missing docs" chat text.
    let locateResult = null;
    if (shouldTryHighlight) {
      try {
        locateResult = await apiRequest("/api/widget", {
          url: window.location.href,
          pageText: getPageText(),
          taskTitle: "Locate the page element for this chat request",
          taskDescription: `User request: ${text}`,
          interactiveElements: collectClickableCandidates(),
        });
      } catch (locateErr) {
        console.error("Chat pre-locate failed", locateErr);
      }
    }

    const data = await apiRequest("/api/chat", { question: context });
    const answer = data?.answer || "No answer available right now.";

    let highlightedFromChat = false;
    if (shouldTryHighlight && locateResult?.found && locateResult?.elementText) {
      const foundEl = findElementByText(locateResult.elementText);
      if (foundEl) {
        const instruction =
          locateResult.instruction ||
          `Try this element on the page: ${locateResult.elementText}`;
        highlightElement(foundEl, instruction, "Guided step");
        setInstruction(instruction);
        addMessage(
          "assistant",
          `I highlighted it on the page: "${locateResult.elementText}".`,
        );
        highlightedFromChat = true;
      }
    }

    // Only show the RAG answer if it adds value for this question.
    // If we successfully highlighted and the answer is just a doc-coverage miss,
    // skip it to avoid contradictory UX.
    const shouldSuppressAnswer =
      highlightedFromChat && likelyDocCoverageMiss.test(answer || "");
    if (!shouldSuppressAnswer) {
      addMessage("assistant", answer);
    }

    // If locate failed, still provide any locate instruction as a follow-up hint.
    if (shouldTryHighlight && !highlightedFromChat) {
      try {
        const locateData = locateResult
          ? locateResult
          : await apiRequest("/api/widget", {
              url: window.location.href,
              pageText: getPageText(),
              taskTitle: "Locate the page element for this chat request",
              taskDescription: `User request: ${text}
Assistant guidance: ${answer}`,
              interactiveElements: collectClickableCandidates(),
            });

        if (locateData?.found && locateData?.elementText) {
          const foundEl = findElementByText(locateData.elementText);
          if (foundEl) {
            const instruction =
              locateData.instruction ||
              `Try this element on the page: ${locateData.elementText}`;
            highlightElement(foundEl, instruction, "Guided step");
            setInstruction(instruction);
            // Add this only if not already shown.
            if (!highlightedFromChat) {
              addMessage(
                "assistant",
                `I highlighted it on the page: "${locateData.elementText}".`,
              );
            }
          } else if (locateData?.instruction) {
            addMessage("assistant", locateData.instruction);
          }
        } else if (locateData?.instruction) {
          addMessage("assistant", locateData.instruction);
        }
      } catch (locateErr) {
        console.error("Chat follow-up locate failed", locateErr);
      }
    }
  } catch (err) {
    console.error("Chat failed", err);
    addMessage("assistant", "Chat is temporarily unavailable.");
  }
}

function detectDemo() {
  const demoTask = getDemoTaskForLocation();
  if (!demoTask) return;
  byId("rb-success")?.classList.add("rb-hidden");
  currentTask = demoTask;
  currentStepIndex = 0;
  updateTaskPanel();
  togglePanel(true);
}

function injectCSS() {
  if (document.getElementById("rb-inline-style")) return;
  const style = document.createElement("style");
  style.id = "rb-inline-style";
  style.textContent = `
    #runbook-extension-root * { box-sizing: border-box; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
    #rb-fab { position: fixed; right: 20px; bottom: 20px; z-index: 999999; width: 56px; height: 56px; border: 0; border-radius: 9999px; cursor: pointer; background: linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; box-shadow: 0 8px 20px rgba(79,70,229,.35); }
    #rb-fab.rb-open { background: linear-gradient(135deg,#4f46e5,#3730a3); }
    #rb-panel { position: fixed; right: 20px; bottom: 80px; z-index: 999999; width: 320px; max-width: 320px; background:#fff; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,.08); box-shadow: 0 10px 34px rgba(0,0,0,.18); color:#111827; }
    #rb-header { background: linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; }
    #rb-logo { font-weight: 700; }
    #rb-header-actions { display:flex; gap:6px; }
    #rb-header-actions button { border:0; border-radius:8px; width:28px; height:28px; cursor:pointer; background: rgba(255,255,255,.2); color:#fff; }
    #rb-header-actions #rb-chat-toggle.rb-active { background: rgba(255,255,255,.35); }
    #rb-task-view, #rb-chat-view { padding: 12px; max-height: 470px; overflow:auto; }
    #rb-no-task p { margin: 0 0 10px 0; font-size: 13px; color:#6b7280; }
    #rb-task-title { font-weight:700; margin-bottom: 8px; font-size: 15px; }
    #rb-progress-row { display:flex; align-items:center; gap:8px; margin-bottom: 10px; }
    #rb-progress-bar { flex:1; background:#e5e7eb; border-radius:999px; height: 6px; overflow: hidden; }
    #rb-progress-fill { width:0; height:6px; background:#4f46e5; }
    #rb-progress-label { font-size: 11px; color:#9ca3af; }
    #rb-step-card { border:1px solid #e5e7eb; background:#f9fafb; border-radius:10px; padding:10px; margin-bottom: 10px; }
    #rb-step-number { font-size: 11px; color:#9ca3af; text-transform: uppercase; font-weight:700; margin-bottom: 6px; }
    #rb-step-text { font-size: 13px; color:#374151; line-height: 1.45; }
    #rb-step-actions { display:flex; gap:8px; margin-bottom: 8px; }
    #rb-highlight-btn, #rb-next-btn, #rb-complete-btn, #rb-scan-btn { border:0; border-radius:8px; cursor:pointer; padding: 8px 10px; font-size: 12px; font-weight: 600; }
    #rb-scan-btn, #rb-highlight-btn { background:#eef2ff; color:#4f46e5; }
    #rb-next-btn { background:#4f46e5; color:#fff; flex:1; }
    #rb-complete-btn { background:#dcfce7; color:#166534; width:100%; }
    #rb-messages { min-height: 180px; max-height: 300px; overflow:auto; display:flex; flex-direction:column; gap:8px; }
    .rb-msg { font-size: 13px; border-radius: 10px; padding: 8px 10px; max-width: 90%; line-height: 1.4; word-break: break-word; }
    .rb-msg-user { align-self:flex-end; background:#4f46e5; color:#fff; }
    .rb-msg-assistant { align-self:flex-start; background:#f3f4f6; color:#111827; }
    #rb-input-row { display:flex; gap:8px; margin-top: 10px; }
    #rb-input { flex:1; border:1px solid #d1d5db; border-radius:8px; padding: 8px 10px; font-size: 13px; }
    #rb-send { width:36px; border:0; border-radius:8px; background:#4f46e5; color:#fff; cursor:pointer; }
    .rb-hidden { display:none !important; }
    .rb-highlight { box-shadow: 0 0 0 3px #6366f1 !important; animation: rb-pulse 1.5s ease-in-out infinite !important; border-radius: 4px !important; }
    #rb-step-overlay { position: absolute; z-index: 1000000; width: 260px; background: #111827; color: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 8px 24px rgba(0,0,0,.35); border: 1px solid rgba(255,255,255,.08); }
    .rb-step-overlay-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #a5b4fc; margin-bottom: 4px; }
    .rb-step-overlay-text { font-size: 12px; line-height: 1.4; color: #e5e7eb; }
    @keyframes rb-pulse { 0%,100% { box-shadow: 0 0 0 3px rgba(99,102,241,.9); } 50% { box-shadow: 0 0 0 7px rgba(99,102,241,.25); } }
  `;
  document.documentElement.appendChild(style);
}

function injectWidget() {
  if (!document.body || document.getElementById("runbook-extension-root")) return;
  const root = document.createElement("div");
  root.id = "runbook-extension-root";
  root.innerHTML = `
    <button id="rb-fab" aria-label="Open Runbook assistant" title="Runbook">RB</button>
    <section id="rb-panel" class="rb-hidden">
      <div id="rb-header">
        <div id="rb-logo">Runbook</div>
        <div id="rb-header-actions">
          <button id="rb-chat-toggle" aria-label="Toggle chat">💬</button>
          <button id="rb-close" aria-label="Close panel">✕</button>
        </div>
      </div>
      <div id="rb-task-view">
        <div id="rb-no-task">
          <p>No onboarding task detected yet.</p>
          <button id="rb-scan-btn">Scan this page</button>
        </div>
        <div id="rb-task-content" class="rb-hidden">
          <div id="rb-task-title"></div>
          <div id="rb-progress-row">
            <div id="rb-progress-bar"><div id="rb-progress-fill"></div></div>
            <div id="rb-progress-label"></div>
          </div>
          <div id="rb-step-card">
            <div id="rb-step-number"></div>
            <div id="rb-step-text"></div>
          </div>
          <div id="rb-step-actions">
            <button id="rb-highlight-btn">Find it on this page</button>
            <button id="rb-next-btn">Next</button>
          </div>
          <button id="rb-complete-btn" class="rb-hidden">Mark complete</button>
        </div>
      </div>
      <div id="rb-chat-view" class="rb-hidden">
        <div id="rb-messages"></div>
        <div id="rb-input-row">
          <input id="rb-input" placeholder="Ask Runbook..." />
          <button id="rb-send">➤</button>
        </div>
      </div>
    </section>
  `;
  document.body.appendChild(root);
  rootEl = root;
}

function bindEvents() {
  byId("rb-fab")?.addEventListener("click", () => togglePanel());
  byId("rb-close")?.addEventListener("click", () => togglePanel(false));
  byId("rb-chat-toggle")?.addEventListener("click", () => toggleChat());
  byId("rb-scan-btn")?.addEventListener("click", () => void scanPage());
  byId("rb-highlight-btn")?.addEventListener("click", () => void findOnPage());
  byId("rb-next-btn")?.addEventListener("click", nextStep);
  byId("rb-complete-btn")?.addEventListener("click", () => void completeTask());
  byId("rb-send")?.addEventListener("click", () => void sendChat());
  byId("rb-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void sendChat();
    }
  });
}

function init() {
  try {
    if (window.top !== window.self) return;
    if (document.getElementById("runbook-extension-root")) return;
    if (!document.body) return;
    loadApiBaseUrl().then(() => {
      injectCSS();
      injectWidget();
      if (!rootEl) return;
      bindEvents();
      detectDemo();
      addMessage("assistant", "Runbook is ready. Use Scan this page to start.");
    });
  } catch (err) {
    console.error("Runbook init failed", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
setTimeout(init, 300);
setTimeout(init, 1200);
setTimeout(init, 2400);
