// content.js — Runbook widget with professional UI
console.log("Runbook: Content script initialized on", window.location.href);

const RUNBOOK_API = "http://localhost:3000";

const DEMO_MAP = {
  "/demo/github": {
    taskId: "github-access",
    taskTitle: "Request GitHub access",
    steps: [
      {
        text: "Fill in your GitHub username in the form field above.",
        selector: "input[value='alexchen-dev']",
      },
      {
        text: "Review the manager approval notes below the form.",
        selector: ".next-error-h2",
      },
      {
        text: "Wait for approval — you'll receive a GitHub invite by email within 24 hours.",
        selector: null,
      },
    ],
  },
};

let widgetVisible = false;
let currentTask = null;
let currentStepIndex = 0;
let highlightedEl = null;

// Inject professional CSS
function injectCSS() {
  const style = document.createElement("style");
  style.textContent = `
    #runbook-root * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      margin: 0;
      padding: 0;
    }
    
    /* Hide original Runbook widget if it exists */
    button[aria-label="Open Runbook assistant"],
    .runbook-widget-button {
      display: none !important;
    }
    
    #rb-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
    }
    
    #rb-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(99, 102, 241, 0.5);
    }
    
    #rb-fab:active {
      transform: scale(0.95);
    }
    
    #rb-fab svg {
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }
    
    #rb-panel {
      position: fixed;
      bottom: 90px;
      right: 24px;
      z-index: 2147483645;
      width: 360px;
      background: white;
      border-radius: 14px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 580px;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    #rb-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    #rb-task-view {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 20px;
      overflow-y: auto;
    }
    
    #rb-no-task {
      text-align: center;
      color: #6b7280;
    }
    
    #rb-no-task p {
      font-size: 14px;
      margin-bottom: 16px;
      line-height: 1.4;
    }
    
    #rb-task-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 16px;
    }
    
    #rb-progress {
      margin-bottom: 16px;
      font-size: 12px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }
    
    #rb-step-text {
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
      background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
      padding: 14px 16px;
      border-radius: 10px;
      margin-bottom: 16px;
      border-left: 3px solid #6366f1;
    }
    
    #rb-step-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
    }
    
    .rb-btn {
      border: none;
      cursor: pointer;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      letter-spacing: -0.2px;
    }
    
    .rb-btn:active {
      transform: scale(0.98);
    }
    
    .rb-btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white;
      flex: 1;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
    }
    
    .rb-btn-primary:hover {
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
      transform: translateY(-1px);
    }
    
    .rb-btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .rb-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    
    .rb-btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
      border-color: #9ca3af;
    }
    
    .rb-btn-secondary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    
    #rb-scan-btn {
      width: 100%;
      background: linear-gradient(135deg, #f0f4ff 0%, #ede9fe 100%);
      color: #6366f1;
      border: 1px solid #c7d2fe;
      margin-top: 4px;
    }
    
    #rb-scan-btn:hover {
      background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%);
      border-color: #a5b4fc;
    }
    
    #rb-complete-btn {
      width: 100%;
      background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border: 1px solid #86efac;
      margin-top: 4px;
    }
    
    #rb-complete-btn:hover {
      background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%);
      border-color: #22c55e;
    }
    
    .rb-hidden {
      display: none !important;
    }
    
    .rb-highlight {
      outline: 3px solid #6366f1 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.15) !important;
      animation: rb-pulse 1.5s ease-in-out infinite !important;
      z-index: 999998 !important;
      border-radius: 4px !important;
    }
    
    @keyframes rb-pulse {
      0%, 100% {
        box-shadow: 0 0 0 8px rgba(99, 102, 241, 0.15);
      }
      50% {
        box-shadow: 0 0 0 12px rgba(99, 102, 241, 0.08);
      }
    }
  `;
  document.documentElement.appendChild(style);
  console.log("Runbook CSS injected");
}

function injectWidget() {
  if (document.getElementById("runbook-root")) return;
  
  const root = document.createElement("div");
  root.id = "runbook-root";
  root.innerHTML = `
    <button id="rb-fab" title="Runbook">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3 12c0-4.97056 4.02944-9 9-9s9 4.02944 9 9-4.02944 9-9 9-9-4.02944-9-9Z" stroke="white" stroke-width="1.5" fill="none"/>
        <path d="M8 12h8M8 8h8M8 16h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div id="rb-panel" class="rb-hidden">
      <div id="rb-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.9">
          <path d="M3 12c0-4.97056 4.02944-9 9-9s9 4.02944 9 9-4.02944 9-9 9-9-4.02944-9-9Z"/>
          <path d="M8 12h8M8 8h8M8 16h5" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
        </svg>
        <span>Runbook</span>
      </div>
      <div id="rb-task-view">
        <div id="rb-no-task">
          <p>No active task detected.</p>
          <p style="font-size: 12px; color: #9ca3af;">Click the button below to scan this page.</p>
          <button class="rb-btn rb-btn-secondary" id="rb-scan-btn" style="margin-top: 12px;">📍 Scan this page</button>
        </div>
        <div id="rb-task-content" class="rb-hidden">
          <div id="rb-progress"></div>
          <div id="rb-task-title"></div>
          <div id="rb-step-text"></div>
          <div id="rb-step-actions">
            <button class="rb-btn rb-btn-secondary" id="rb-highlight-btn" disabled>🔍 Highlight</button>
            <button class="rb-btn rb-btn-primary" id="rb-next-btn">Next →</button>
          </div>
          <button class="rb-btn rb-btn-secondary rb-hidden" id="rb-complete-btn" style="width: 100%; margin-top: 4px;">✓ Mark complete</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  console.log("✓ Runbook widget injected");
}

function bindEvents() {
  document.getElementById("rb-fab").addEventListener("click", toggleWidget);
  document.getElementById("rb-scan-btn").addEventListener("click", scanPage);
  document.getElementById("rb-highlight-btn").addEventListener("click", highlightCurrentStep);
  document.getElementById("rb-next-btn").addEventListener("click", nextStep);
  document.getElementById("rb-complete-btn").addEventListener("click", completeTask);
}

function toggleWidget() {
  widgetVisible = !widgetVisible;
  const panel = document.getElementById("rb-panel");
  const fab = document.getElementById("rb-fab");
  
  if (widgetVisible) {
    panel.classList.remove("rb-hidden");
    fab.style.background = "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)";
  } else {
    panel.classList.add("rb-hidden");
    fab.style.background = "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)";
    clearHighlight();
  }
}

function updateTaskPanel() {
  if (!currentTask) return;
  
  document.getElementById("rb-no-task").classList.add("rb-hidden");
  document.getElementById("rb-task-content").classList.remove("rb-hidden");
  
  const totalSteps = currentTask.steps.length;
  const progress = `Step ${currentStepIndex + 1} of ${totalSteps}`;
  document.getElementById("rb-progress").textContent = progress;
  document.getElementById("rb-task-title").textContent = currentTask.taskTitle;
  document.getElementById("rb-step-text").textContent = currentTask.steps[currentStepIndex].text;
  
  const isLast = currentStepIndex === totalSteps - 1;
  document.getElementById("rb-next-btn").classList.toggle("rb-hidden", isLast);
  document.getElementById("rb-complete-btn").classList.toggle("rb-hidden", !isLast);
  
  const hasSelector = !!currentTask.steps[currentStepIndex].selector;
  document.getElementById("rb-highlight-btn").disabled = !hasSelector;
  
  console.log(`Step ${currentStepIndex + 1}/${totalSteps}`);
}

function nextStep() {
  clearHighlight();
  if (currentStepIndex < currentTask.steps.length - 1) {
    currentStepIndex++;
    updateTaskPanel();
  }
}

function highlightCurrentStep() {
  clearHighlight();
  const selector = currentTask?.steps[currentStepIndex]?.selector;
  
  if (!selector) {
    console.log("No selector for this step");
    return;
  }
  
  const el = document.querySelector(selector);
  if (!el) {
    console.error("❌ Element not found:", selector);
    alert("Could not find element on page:\n\n" + selector);
    return;
  }
  
  highlightedEl = el;
  el.classList.add("rb-highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  console.log("✓ Highlighted:", selector);
}

function clearHighlight() {
  if (highlightedEl) {
    highlightedEl.classList.remove("rb-highlight");
    highlightedEl = null;
  }
}

function completeTask() {
  fetch(`${RUNBOOK_API}/api/tasks/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId: currentTask.taskId, status: "complete" }),
  })
  .then(r => r.json())
  .then(data => {
    console.log("✓ Task marked complete");
    document.getElementById("rb-task-content").innerHTML = 
      `<div style="text-align: center; padding: 32px 16px;">
         <div style="font-size: 48px; margin-bottom: 12px;">✨</div>
         <div style="font-size: 16px; font-weight: 600; color: #16a34a; margin-bottom: 4px;">Task complete!</div>
         <div style="font-size: 13px; color: #6b7280;">Great job! Keep going.</div>
       </div>`;
  })
  .catch(e => console.error("Error:", e));
}

async function scanPage() {
  const btn = document.getElementById("rb-scan-btn");
  const origText = btn.textContent;
  btn.textContent = "⏳ Scanning...";
  btn.disabled = true;
  
  const pageText = document.body.innerText.slice(0, 4000);
  const url = window.location.href;
  
  try {
    const resp = await fetch(`${RUNBOOK_API}/api/widget`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, pageText }),
    });
    const json = await resp.json();
    
    if (json?.task) {
      currentTask = json.task;
      currentStepIndex = 0;
      updateTaskPanel();
      console.log("✓ Task:", currentTask.taskTitle);
    } else {
      btn.textContent = "No task found";
      setTimeout(() => { 
        btn.textContent = origText;
        btn.disabled = false;
      }, 2000);
    }
  } catch (err) {
    console.error("Scan failed:", err);
    btn.textContent = "Error scanning";
    setTimeout(() => { 
      btn.textContent = origText;
      btn.disabled = false;
    }, 2000);
  }
}

function detectDemo() {
  const path = window.location.pathname;
  
  if (DEMO_MAP[path]) {
    console.log("✓ Demo detected:", path);
    currentTask = DEMO_MAP[path];
    currentStepIndex = 0;
    updateTaskPanel();
    
    // Auto-open widget
    widgetVisible = true;
    document.getElementById("rb-panel").classList.remove("rb-hidden");
    document.getElementById("rb-fab").style.background = "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)";
  }
}

function init() {
  console.log("🚀 Runbook loading...");
  
  // Hide existing Runbook widgets on demo pages
  const existingButton = document.querySelector('button[aria-label="Open Runbook assistant"]');
  if (existingButton) {
    existingButton.style.display = "none";
    console.log("✓ Original widget hidden");
  }
  
  injectCSS();
  injectWidget();
  bindEvents();
  detectDemo();
  
  console.log("✓ Runbook ready");
}

// Inject on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Fallback: also inject after a short delay
setTimeout(init, 200);
