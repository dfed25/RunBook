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
  var includeBodyText =
    script.hasAttribute("data-include-body-text") ||
    !!document.querySelector('script[src*="runbook-embed.js"][data-include-body-text]') ||
    true;
  var originAttr = (script.getAttribute("data-runbook-origin") || "").trim().replace(/\/$/, "");
  var base = originAttr || script.src.replace(/\/runbook-embed\.js.*$/, "");
  if (!projectId) {
    console.warn("[Runbook] Missing data-project-id (or data-project).");
    return;
  }

  var DEMO_ID = "northstar-demo";
  function isLocationIntent(text) {
    return /(where|find|locate|click|open|go to|how do i|create account|sign up|signup|register|get started|log in|login)/i.test(
      String(text || "")
    );
  }

  function stripTrailingSentencePunctuation(input) {
    var end = input.length;
    while (end > 0) {
      var ch = input[end - 1];
      if (ch === "." || ch === "!" || ch === "?") {
        end -= 1;
        continue;
      }
      break;
    }
    return input.slice(0, end);
  }

  var BUNDLE_KEY = "runbook_demo_bundle_v1";
  var IMPORTED_DOCS_KEY = "runbook_imported_docs";
  var IMPORTED_PROJECT_ID_KEY = "runbook_project_id";

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

  function loadImportedDocs() {
    try {
      var raw = localStorage.getItem(IMPORTED_DOCS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var out = [];
      for (var i = 0; i < Math.min(24, arr.length); i++) {
        var d = arr[i];
        if (!d || typeof d !== "object") continue;
        var title = String(d.title || d.path || "Imported document").trim().slice(0, 260);
        var path = String(d.path || "").trim().slice(0, 260);
        var content = String(d.content || "").trim().slice(0, 20000);
        if (!title || !content) continue;
        out.push({ title: title, path: path, content: content });
      }
      return out;
    } catch {
      return [];
    }
  }

  function loadImportedProjectId() {
    try {
      return (localStorage.getItem(IMPORTED_PROJECT_ID_KEY) || "").trim();
    } catch {
      return "";
    }
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
      ".rb-hover{padding:6px 12px;border-bottom:1px solid rgba(148,163,184,.2);font-size:11px;color:#cbd5e1;display:none;}" +
      ".rb-hover strong{color:#86efac;}" +
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
    var hoverCtx = document.createElement("div");
    hoverCtx.className = "rb-hover";
    var body = document.createElement("div");
    body.className = "rb-body";
    var foot = document.createElement("div");
    foot.className = "rb-foot";
    foot.innerHTML =
      '<input class="rb-inp" placeholder="Ask anything about this product…" /><button type="button" class="rb-send">Send</button>';
    panel.appendChild(head);
    panel.appendChild(chipsWrap);
    panel.appendChild(hoverCtx);
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
    var hasStartedChat = false;
    var hoveredFeature = null;
    function updateHoveredFeature(next) {
      hoveredFeature = next;
      if (next && (next.title || next.feature)) {
        hoverCtx.style.display = "block";
        hoverCtx.innerHTML = "Looking at: <strong>" + escapeHtml(next.title || next.feature) + "</strong>";
      } else {
        hoverCtx.style.display = "none";
        hoverCtx.innerHTML = "";
      }
    }

    function trackHoverEvents() {
      function handleOver(evt) {
        var target = evt.target instanceof Element ? evt.target : null;
        if (!target) return;
        var el = target.closest("[data-runbook-feature],[data-runbook-title],[data-runbook-description]");
        if (!el) return;
        updateHoveredFeature({
          feature: (el.getAttribute("data-runbook-feature") || "").trim(),
          title: (el.getAttribute("data-runbook-title") || "").trim(),
          description: (el.getAttribute("data-runbook-description") || "").trim()
        });
      }
      function handleOut(evt) {
        var from = evt.target instanceof Element ? evt.target : null;
        var to = evt.relatedTarget instanceof Element ? evt.relatedTarget : null;
        if (!from) return;
        var fromFeature = from.closest("[data-runbook-feature],[data-runbook-title],[data-runbook-description]");
        if (!fromFeature) return;
        if (to && fromFeature.contains(to)) return;
        updateHoveredFeature(null);
      }
      document.addEventListener("pointerover", handleOver, true);
      document.addEventListener("pointerout", handleOut, true);
    }

    var highlightTimeout = null;
    var highlightedEl = null;
    var overlayEl = null;

    function ensurePageHighlightStyles() {
      if (document.getElementById("rb-page-highlight-style")) return;
      var styleTag = document.createElement("style");
      styleTag.id = "rb-page-highlight-style";
      styleTag.textContent =
        "@keyframes rbPagePulse{0%{box-shadow:0 0 0 3px rgba(99,102,241,.95);}50%{box-shadow:0 0 0 8px rgba(99,102,241,.25);}100%{box-shadow:0 0 0 3px rgba(99,102,241,.95);}}" +
        ".rb-highlight-target{animation:rbPagePulse 1.2s ease-in-out infinite !important;box-shadow:0 0 0 3px rgba(99,102,241,.95) !important;border-radius:8px !important;}" +
        ".rb-highlight-overlay{position:absolute;z-index:2147483647;max-width:320px;background:#1e1b4b;color:#eef2ff;border:1px solid rgba(129,140,248,.5);border-radius:10px;padding:10px 12px;font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 10px 30px rgba(30,27,75,.45);}";
      document.head.appendChild(styleTag);
    }

    function clearPageHighlight() {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
        highlightTimeout = null;
      }
      if (highlightedEl) {
        highlightedEl.classList.remove("rb-highlight-target");
        highlightedEl = null;
      }
      if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
        overlayEl = null;
      }
    }

    function tokenize(text) {
      return String(text || "")
        .toLowerCase()
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(function (t) {
          return t.length >= 2;
        });
    }

    function compact(text) {
      return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function extractIntentPhrase(question) {
      var q = String(question || "");
      var lower = q.toLowerCase();
      var prefixes = ["where is ", "find ", "locate ", "click ", "open ", "go to "];
      for (var i = 0; i < prefixes.length; i++) {
        var prefix = prefixes[i];
        var idx = lower.indexOf(prefix);
        if (idx >= 0) {
          var rawTarget = q.slice(idx + prefix.length).trim();
          var cleaned = stripTrailingSentencePunctuation(rawTarget).trim();
          if (cleaned.length > 0) return cleaned;
        }
      }
      return "";
    }

    function scoreCandidate(el, tokens, intentCompact) {
      var label = [
        el.innerText || "",
        el.getAttribute("aria-label") || "",
        el.getAttribute("title") || "",
        el.id || "",
        el.getAttribute("name") || "",
        el.getAttribute("placeholder") || "",
        el.className || "",
        el.getAttribute("data-runbook-feature") || "",
        el.getAttribute("data-runbook-title") || "",
        el.getAttribute("data-runbook-description") || ""
      ]
        .join(" ")
        .toLowerCase();
      if (!label.trim()) return 0;
      var score = 0;
      var compactLabel = compact(label);
      tokens.forEach(function (t) {
        var compactToken = compact(t);
        if (label.indexOf(t) !== -1) score += t.length > 5 ? 3 : 2;
        if (compactToken && compactLabel.indexOf(compactToken) !== -1) score += t.length > 5 ? 3 : 2;
      });
      if (intentCompact && compactLabel.indexOf(intentCompact) !== -1) score += 8;
      if (/(create|sign\s*up|signup|register|get\s*started|start|continue|next)/i.test(label)) score += 3;
      if (el.hasAttribute("data-runbook-feature")) score += 6;
      if (el.hasAttribute("data-runbook-title")) score += 2;
      if (el.tagName === "BUTTON" || el.tagName === "A") score += 2;
      var rect = el.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 10) score = 0;
      return score;
    }

    function findBestElement(textHint, question) {
      var tokens = tokenize(textHint).slice(0, 20);
      if (!tokens.length) return null;
      var intentCompact = compact(extractIntentPhrase(question));
      var selector =
        "button,a,[role='button'],summary,label,h1,h2,h3,input,textarea,select,[data-testid],[aria-label],nav a,[data-runbook-feature]";
      var nodes = document.querySelectorAll(selector);
      var best = null;
      var bestScore = 0;
      var secondBest = 0;
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el || !el.getBoundingClientRect) continue;
        var rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight * 2) continue;
        var s = scoreCandidate(el, tokens, intentCompact);
        if (s > bestScore) {
          secondBest = bestScore;
          bestScore = s;
          best = el;
        } else if (s > secondBest) {
          secondBest = s;
        }
      }
      if (bestScore < 3 || !best) return null;
      return { element: best, highConfidence: bestScore >= 8 && bestScore - secondBest >= 2 };
    }

    function showPageOverlay(target, text) {
      if (!target) return;
      var rect = target.getBoundingClientRect();
      var overlay = document.createElement("div");
      overlay.className = "rb-highlight-overlay";
      overlay.textContent = text || "Start here.";
      var top = window.scrollY + rect.bottom + 8;
      var left = window.scrollX + Math.max(12, rect.left);
      overlay.style.top = String(top) + "px";
      overlay.style.left = String(left) + "px";
      document.body.appendChild(overlay);
      overlayEl = overlay;
    }

    function maybeHighlight(question, data) {
      if (!isLocationIntent(question || "")) return;
      ensurePageHighlightStyles();
      clearPageHighlight();
      var hint = [question || "", data.answer || "", (data.steps || []).join(" ")].join(" ");
      var scored = findBestElement(hint, question);
      if (!scored) {
        addBot(
          "<em>I couldn't confidently find that element on this page.</em><br/>Try the exact button/link text (e.g. <code>Create account</code>) or ask me to <strong>explain this page</strong>."
        );
        return;
      }
      if (!scored.highConfidence) {
        addBot(
          "I found multiple possible matches. Tell me the exact button or link label (for example, <code>Create workflow</code> or <code>Connect Slack</code>) and I will highlight it."
        );
        return;
      }
      var target = scored.element;
      highlightedEl = target;
      target.classList.add("rb-highlight-target");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      var tip = data.steps && data.steps.length ? data.steps[0] : "This is likely where to start for your question.";
      showPageOverlay(target, tip);
      highlightTimeout = setTimeout(clearPageHighlight, 8000);
    }

    function pageContext() {
      var meta = "";
      var m = document.querySelector('meta[name="description"]');
      if (m) meta = m.getAttribute("content") || "";
      var headings = "";
      try {
        var hs = Array.prototype.slice.call(document.querySelectorAll("h1,h2,h3")).map(function (el) {
          return (el && el.textContent ? String(el.textContent) : "").trim();
        }).filter(Boolean).slice(0, 12);
        headings = hs.join(" | ");
      } catch {
        headings = "";
      }
      var bodyText = "";
      if (includeBodyText) {
        try {
          var clone = document.body ? document.body.cloneNode(true) : null;
          if (clone && clone.querySelectorAll) {
            var fields = clone.querySelectorAll("input,textarea,select");
            for (var i = 0; i < fields.length; i++) {
              var f = fields[i];
              var tag = (f.tagName || "").toLowerCase();
              if (tag === "select") {
                f.textContent = "";
              } else {
                f.setAttribute("value", "");
                f.textContent = "";
              }
            }
          }
          bodyText = (clone && clone.innerText ? clone.innerText : "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 12000);
        } catch {
          bodyText = "";
        }
      }
      return [meta, headings, bodyText].filter(Boolean).join("\n");
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
      if (!hasStartedChat) {
        hasStartedChat = true;
        chipsWrap.style.display = "none";
      }
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

    suggested.slice(0, 3).forEach(function (label) {
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
    var pageActions = document.createElement("button");
    pageActions.type = "button";
    pageActions.className = "rb-chip";
    pageActions.textContent = "What can I do here?";
    pageActions.addEventListener("click", function () {
      inp.value = "What can I do here?";
      void doSend();
    });
    chipsWrap.insertBefore(pageActions, chipsWrap.firstChild);

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
          pageContext: pageContext(),
          pageTitle: document.title || "",
          pageUrl: location.href || "",
          hoveredFeature: hoveredFeature
        };
        if (projectId === DEMO_ID) {
          var custom = manualSourcesFromBundle(bundle);
          if (custom.length) body.customSources = custom;
        }
        var importedProjectId = loadImportedProjectId();
        var importedDocs = importedProjectId === projectId ? loadImportedDocs() : [];
        if (importedDocs.length) body.documents = importedDocs;
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
        var sourceCount = Array.isArray(data.sources) ? data.sources.length : 0;
        var missingIndexSignal =
          data.mode === "unindexed" ||
          /AI is not configured|no indexed chunks yet/i.test(String(data.answer || "")) ||
          sourceCount === 0;
        if (missingIndexSignal) {
          html +=
            '<div style="margin-top:8px;border:1px solid rgba(245,158,11,.45);background:rgba(245,158,11,.12);color:#fde68a;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.4;">' +
            "<strong>Codebase not indexed yet.</strong> Connect your GitHub repo in Studio and run <em>Index repository</em> for code-aware onboarding steps." +
            "</div>";
        }
        if (data.steps && data.steps.length) {
          html += '<ol class="rb-steps">';
          data.steps.slice(0, 4).forEach(function (s) {
            html += "<li>" + escapeHtml(s) + "</li>";
          });
          html += "</ol>";
        }
        if (data.sources && data.sources.length) {
          html += '<div class="rb-src"><strong>Sources</strong><br/>';
          data.sources.slice(0, 3).forEach(function (s) {
            html += "· " + escapeHtml(s.title);
            var u = safeUrl(s.url);
            if (u) html += ' <a href="' + escapeHtml(u) + '" target="_blank" rel="noopener noreferrer" style="color:#c7d2fe">(open)</a>';
            if (s.excerpt) html += " — " + escapeHtml(s.excerpt.slice(0, 140)) + (s.excerpt.length > 140 ? "…" : "");
            html += "<br/>";
          });
          html += "</div>";
        }
        addBot(html || "(empty)");
        maybeHighlight(q, data || {});
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

    function safeUrl(raw) {
      if (!raw) return "";
      try {
        var u = new URL(String(raw), location.href);
        if (u.protocol !== "http:" && u.protocol !== "https:") return "";
        return u.toString();
      } catch {
        return "";
      }
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
    trackHoverEvents();
  }

  if (document.body) mount();
  else if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();
