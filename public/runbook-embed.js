/**
 * Runbook embed — one script tag. Demo: data-project-id="northstar-demo" (no API key).
 * Production: data-project + data-key (Bearer) for keyed projects.
 */
(function () {
  function findEmbedScript() {
    var cur = document.currentScript;
    if (cur && cur.src && cur.src.indexOf("runbook-embed.js") !== -1) return cur;
    var nodes = document.querySelectorAll('script[src*="runbook-embed.js"]');
    return nodes.length ? nodes[nodes.length - 1] : null;
  }
  var script = findEmbedScript();
  if (!script) {
    console.warn("[Runbook] Could not find runbook-embed.js script tag.");
    return;
  }

  var projectId =
    script.getAttribute("data-project-id") || script.getAttribute("data-project") || "";
  var apiKey = script.getAttribute("data-key") || "";
  var originAttr = (script.getAttribute("data-runbook-origin") || "").trim().replace(/\/$/, "");
  var base = originAttr || script.src.replace(/\/runbook-embed\.js.*$/, "");
  if (!projectId) {
    console.warn("[Runbook] Missing data-project-id (or data-project).");
    return;
  }

  var DEMO_ID = "northstar-demo";
  var BUNDLE_KEY = "runbook_demo_bundle_v1";

  function loadDemoBundle() {
    try {
      var raw = localStorage.getItem(BUNDLE_KEY);
      if (!raw) return null;
      var j = JSON.parse(raw);
      if (!j || typeof j !== "object") return null;
      return j;
    } catch {
      return null;
    }
  }

  var defaultSuggested = [
    "How do I get GitHub access?",
    "How do I set up my local environment?",
    "What should I do first?",
    "Explain this page"
  ];

  function hexToRgba(hex, alpha) {
    var h = String(hex).replace("#", "");
    if (h.length !== 6) return "rgba(99,102,241," + alpha + ")";
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "rgba(99,102,241," + alpha + ")";
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function manualSourcesFromBundle(b) {
    if (!b || !Array.isArray(b.manualSources)) return [];
    var out = [];
    for (var i = 0; i < Math.min(12, b.manualSources.length); i++) {
      var m = b.manualSources[i];
      if (!m || typeof m !== "object") continue;
      var t = String(m.title || "").trim().slice(0, 200);
      var c = String(m.content || "").trim().slice(0, 12000);
      if (!t || !c) continue;
      out.push({ title: t, content: c });
    }
    return out;
  }

  function mount() {
    if (!document.body) return;

    var root = document.createElement("div");
    root.setAttribute("data-runbook-embed", "1");
    root.style.cssText =
      "position:fixed;z-index:2147483000;right:20px;bottom:20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;";
    document.body.appendChild(root);

    var bundle = loadDemoBundle();
    var suggested =
      bundle &&
      Array.isArray(bundle.suggestedQuestions) &&
      bundle.suggestedQuestions.length &&
      bundle.suggestedQuestions.every(function (x) {
        return typeof x === "string";
      })
        ? bundle.suggestedQuestions
        : defaultSuggested;
    var assistantName =
      bundle && typeof bundle.assistantName === "string" && bundle.assistantName.trim()
        ? bundle.assistantName.trim()
        : "Runbook";
    var welcomeMsg =
      bundle && typeof bundle.welcome === "string" && bundle.welcome.trim()
        ? bundle.welcome.trim()
        : "Hi — I'm Runbook. Ask me anything about Northstar, or tap a suggestion. I'm powered by your team's docs (demo).";
    var primaryColor =
      bundle && typeof bundle.primaryColor === "string" && /^#[0-9a-fA-F]{6}$/.test(bundle.primaryColor.trim())
        ? bundle.primaryColor.trim()
        : "#6366f1";

    var shadow = root.attachShadow({ mode: "open" });
    var css =
      ":host{all:initial;} *{box-sizing:border-box;}" +
      ".rb-launch{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;font-weight:700;font-size:20px;box-shadow:0 10px 40px rgba(79,70,229,.5);display:flex;align-items:center;justify-content:center;}" +
      ".rb-launch:hover{filter:brightness(1.08);}" +
      ".rb-panel{position:absolute;right:0;bottom:72px;width:min(400px,calc(100vw - 40px));max-height:min(560px,78vh);background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.35);border-radius:16px;display:none;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.55);}" +
      ".rb-panel.open{display:flex;}" +
      ".rb-head{padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.25);font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;gap:8px;}" +
      ".rb-brand{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#a5b4fc;}" +
      ".rb-close{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:18px;line-height:1;padding:4px;}" +
      ".rb-chips{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(148,163,184,.2);}" +
      ".rb-chip{font-size:11px;padding:6px 10px;border-radius:999px;border:1px solid rgba(129,140,248,.45);background:rgba(79,70,229,.15);color:#c7d2fe;cursor:pointer;}" +
      ".rb-chip:hover{background:rgba(79,70,229,.3);}" +
      ".rb-body{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;}" +
      ".rb-msg{max-width:100%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.5;white-space:pre-wrap;}" +
      ".rb-user{align-self:flex-end;background:linear-gradient(135deg,#a78bfa,#6366f1);color:#0f172a;}" +
      ".rb-bot{align-self:flex-start;background:#1e293b;border:1px solid rgba(148,163,184,.22);}" +
      ".rb-steps{margin:8px 0 0;padding-left:18px;font-size:12px;color:#cbd5e1;}" +
      ".rb-steps li{margin:4px 0;}" +
      ".rb-src{font-size:11px;color:#94a3b8;margin-top:6px;padding-top:6px;border-top:1px solid rgba(51,65,85,.6);}" +
      ".rb-foot{padding:10px 12px;border-top:1px solid rgba(148,163,184,.25);display:flex;gap:8px;}" +
      ".rb-inp{flex:1;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:#020617;color:#f8fafc;padding:9px 11px;font-size:13px;}" +
      ".rb-send{border-radius:10px;border:none;padding:9px 14px;font-weight:600;cursor:pointer;background:#6366f1;color:#fff;font-size:13px;}" +
      ".rb-send:disabled{opacity:.45;cursor:default;}";
    var style = document.createElement("style");
    style.textContent = css;
    shadow.appendChild(style);

    var panel = document.createElement("div");
    panel.className = "rb-panel";
    var head = document.createElement("div");
    head.className = "rb-head";
    head.innerHTML =
      '<span><span class="rb-brand">Runbook</span><br/><span style="font-size:13px;color:#f1f5f9;" class="rb-title"></span></span><button type="button" class="rb-close" aria-label="Close">×</button>';
    var titleEl = head.querySelector(".rb-title");
    if (titleEl) titleEl.textContent = assistantName;
    var chipsWrap = document.createElement("div");
    chipsWrap.className = "rb-chips";
    var body = document.createElement("div");
    body.className = "rb-body";
    var foot = document.createElement("div");
    foot.className = "rb-foot";
    foot.innerHTML =
      '<input class="rb-inp" placeholder="Ask anything about this product…" /><button type="button" class="rb-send">Send</button>';
    panel.appendChild(head);
    panel.appendChild(chipsWrap);
    panel.appendChild(body);
    panel.appendChild(foot);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rb-launch";
    btn.setAttribute("aria-label", "Open Runbook");
    btn.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>';
    btn.style.background =
      "linear-gradient(135deg," + primaryColor + ",#4f46e5)";
    btn.style.boxShadow = "0 10px 40px " + hexToRgba(primaryColor, 0.45);

    shadow.appendChild(panel);
    shadow.appendChild(btn);

    var inp = foot.querySelector(".rb-inp");
    var sendBtn = foot.querySelector(".rb-send");
    var closeBtn = head.querySelector(".rb-close");

    function pageContext() {
      var t = document.title || "";
      var u = location.href || "";
      var meta = "";
      var m = document.querySelector('meta[name="description"]');
      if (m) meta = m.getAttribute("content") || "";
      return [u, t, meta].filter(Boolean).join("\n");
    }

    function addBot(html) {
      var d = document.createElement("div");
      d.className = "rb-msg rb-bot";
      d.innerHTML = html;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    }
    function addUser(text) {
      var d = document.createElement("div");
      d.className = "rb-msg rb-user";
      d.textContent = text;
      body.appendChild(d);
      body.scrollTop = body.scrollHeight;
    }

    var open = false;
    function setOpen(v) {
      open = v;
      if (v) panel.classList.add("open");
      else panel.classList.remove("open");
    }
    btn.addEventListener("click", function () {
      setOpen(!open);
    });
    closeBtn.addEventListener("click", function () {
      setOpen(false);
    });

    suggested.forEach(function (label) {
      var c = document.createElement("button");
      c.type = "button";
      c.className = "rb-chip";
      c.textContent = label;
      c.addEventListener("click", function () {
        inp.value = label;
        void doSend();
      });
      chipsWrap.appendChild(c);
    });

    async function doSend() {
      var q = (inp.value || "").trim();
      if (!q) return;
      inp.value = "";
      addUser(q);
      sendBtn.disabled = true;
      try {
        var headers = { "Content-Type": "application/json" };
        if (apiKey) headers.Authorization = "Bearer " + apiKey;
        var body = {
          projectId: projectId,
          message: q,
          pageContext: pageContext()
        };
        if (projectId === DEMO_ID) {
          var custom = manualSourcesFromBundle(bundle);
          if (custom.length) body.customSources = custom;
        }
        var res = await fetch(base + "/api/embed/chat", {
          method: "POST",
          headers: headers,
          body: JSON.stringify(body)
        });
        var data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          addBot("<strong>Something went wrong</strong><br/>" + (data.error || "HTTP " + res.status));
          return;
        }
        var html = "";
        if (data.answer) html += escapeHtml(data.answer).replace(/\n/g, "<br/>");
        if (data.steps && data.steps.length) {
          html += '<ol class="rb-steps">';
          data.steps.forEach(function (s) {
            html += "<li>" + escapeHtml(s) + "</li>";
          });
          html += "</ol>";
        }
        if (data.sources && data.sources.length) {
          html += '<div class="rb-src"><strong>Sources</strong><br/>';
          data.sources.forEach(function (s) {
            html += "· " + escapeHtml(s.title);
            if (s.excerpt) html += " — " + escapeHtml(s.excerpt.slice(0, 140)) + (s.excerpt.length > 140 ? "…" : "");
            html += "<br/>";
          });
          html += "</div>";
        }
        addBot(html || "(empty)");
      } catch {
        addBot("Network error — is <code>" + escapeHtml(base) + "</code> reachable from this page?");
      } finally {
        sendBtn.disabled = false;
      }
    }

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    sendBtn.addEventListener("click", function () {
      void doSend();
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void doSend();
      }
    });

    if (projectId === DEMO_ID) {
      addBot(
        "<strong>" +
          escapeHtml(assistantName) +
          "</strong><br/>" +
          escapeHtml(welcomeMsg).replace(/\n/g, "<br/>")
      );
    } else {
      addBot("<strong>Runbook</strong><br/>Ask a question. Answers use your indexed knowledge.");
    }
  }

  if (document.body) mount();
  else if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
