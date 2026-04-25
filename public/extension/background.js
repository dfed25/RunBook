// background.js — Service worker for Runbook extension
// Minimal implementation for Chrome v3

console.log("Runbook background service worker loaded");

const DEFAULT_API_ORIGIN = "http://localhost:3000";
const REQUEST_TIMEOUT_MS = 20000;

function sanitizeOrigin(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins() {
  return new Promise((resolve) => {
    if (!chrome.storage?.local) {
      resolve([DEFAULT_API_ORIGIN]);
      return;
    }
    chrome.storage.local.get(["runbookApiBaseUrl"], (result) => {
      const configured = sanitizeOrigin(result?.runbookApiBaseUrl);
      const origins = configured
        ? Array.from(new Set([DEFAULT_API_ORIGIN, configured]))
        : [DEFAULT_API_ORIGIN];
      resolve(origins);
    });
  });
}

function getWidgetSecret() {
  return new Promise((resolve) => {
    if (!chrome.storage?.local) {
      resolve("");
      return;
    }
    chrome.storage.local.get(["runbookWidgetSecret"], (result) => {
      resolve(typeof result?.runbookWidgetSecret === "string" ? result.runbookWidgetSecret.trim() : "");
    });
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "API_REQUEST") {
    let target;
    try {
      target = new URL(request.url);
    } catch {
      sendResponse({ ok: false, error: "Invalid URL" });
      return true;
    }

    Promise.all([getAllowedOrigins(), getWidgetSecret()])
      .then(([allowedOrigins, widgetSecret]) => {
        if (!allowedOrigins.includes(target.origin)) {
          throw new Error(`Origin not allowed: ${target.origin}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        return fetch(target.toString(), {
          method: request.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...(widgetSecret ? { "x-runbook-widget-secret": widgetSecret } : {}),
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: controller.signal,
        })
          .then(async (res) => {
            const raw = await res.text();
            let data = {};
            try {
              data = raw ? JSON.parse(raw) : {};
            } catch {
              data = { raw };
            }
            if (!res.ok) {
              throw new Error(
                `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 200)}`,
              );
            }
            return data;
          })
          .finally(() => clearTimeout(timeoutId));
      })
      .then((data) => {
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error("API request failed:", err);
        sendResponse({ ok: false, error: err?.message || "Request failed" });
      });
    return true;
  }
});

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Runbook extension installed");
});
