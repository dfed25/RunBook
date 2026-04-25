// background.js — Service worker for Runbook extension
// Minimal implementation for Chrome v3

console.log("Runbook background service worker loaded");

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "API_REQUEST") {
    fetch(request.url, {
      method: request.method || "POST",
      headers: { "Content-Type": "application/json" },
      body: request.body ? JSON.stringify(request.body) : undefined,
    })
      .then((res) => res.json())
      .then((data) => {
        sendResponse({ ok: true, data });
      })
      .catch((err) => {
        console.error("API request failed:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Runbook extension installed");
});
