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
  // Keep client caps aligned with server normalizeSteps/MAX_SOURCES in embedStructured.
  var CLIENT_MAX_STEPS = 4;
  var CLIENT_MAX_SOURCES = 3;
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

  var RB_WATCH_IDX_KEY = "runbook_embed_watch_idx";

  function rbEscapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rbGetDemoSteps() {
    try {
      var steps = window.RUNBOOK_DEMO_STEPS;
      if (Array.isArray(steps) && steps.length > 0) return steps;
    } catch (err) {}
    return [];
  }

  function rbQuery(sel) {
    if (!sel || typeof sel !== "string") return null;
    try {
      return document.querySelector(sel);
    } catch (e) {
      return null;
    }
  }

  function rbApplyDemoEffect(effect) {
    if (!effect || typeof effect !== "object") return;
    var type = String(effect.type || "").toLowerCase();
    var el = effect.selector ? rbQuery(effect.selector) : null;
    if (type === "toast") {
      rbPageToast(String(effect.message || "Done"));
      return;
    }
    if (!el && type !== "toast") return;
    if (type === "settext") el.textContent = String(effect.text != null ? effect.text : "");
    else if (type === "addclass") el.classList.add(String(effect.className || ""));
    else if (type === "removeclass") el.classList.remove(String(effect.className || ""));
    else if (type === "setattribute") el.setAttribute(String(effect.name || ""), String(effect.value != null ? effect.value : ""));
    else if (type === "show") {
      el.style.removeProperty("display");
      el.classList.remove("rb-watch-hidden");
    } else if (type === "hide") {
      el.style.display = "none";
    } else if (type === "fillinput" && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
      el.value = String(effect.value != null ? effect.value : "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function rbPageToast(message) {
    var el = document.createElement("div");
    el.setAttribute("data-runbook-watch-toast", "1");
    el.textContent = message;
    el.style.cssText =
      "position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:2147483650;max-width:90vw;padding:10px 14px;border-radius:12px;background:#0f172a;color:#e2e8f0;border:1px solid rgba(129,140,248,.5);font:13px/1.4 system-ui;box-shadow:0 12px 40px rgba(0,0,0,.45);";
    document.body.appendChild(el);
    window.setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  function rbWaitMs(ms, isCancelled) {
    return new Promise(function (resolve) {
      var start = Date.now();
      function tick() {
        if (isCancelled()) return resolve();
        if (Date.now() - start >= ms) return resolve();
        window.setTimeout(tick, Math.min(48, ms));
      }
      tick();
    });
  }

  /** Poll until selector matches a connected element (view transitions often need this). */
  function rbWaitForSelector(sel, maxMs, isCancelled) {
    return new Promise(function (resolve) {
      if (!sel || typeof sel !== "string") return resolve(null);
      var deadline = Date.now() + (maxMs != null ? Number(maxMs) : 2400);
      function tick() {
        if (isCancelled()) return resolve(null);
        var el = null;
        try {
          el = document.querySelector(sel);
        } catch (e) {
          el = null;
        }
        if (el && el instanceof HTMLElement) return resolve(el);
        if (Date.now() >= deadline) return resolve(null);
        window.setTimeout(tick, 48);
      }
      tick();
    });
  }

  function rbAnimateCursor(from, to, ms, onFrame, isCancelled) {
    return new Promise(function (resolve) {
      var t0 = performance.now();
      function frame(now) {
        if (isCancelled()) return resolve();
        var t = Math.min(1, (now - t0) / ms);
        var s = t * t * (3 - 2 * t);
        onFrame(from.x + (to.x - from.x) * s, from.y + (to.y - from.y) * s);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function rbCreateWatchUi() {
    var dim = document.createElement("div");
    dim.setAttribute("data-runbook-watch-dim", "1");
    // Keep the page readable: no full-screen blackout (that read as a "pillar" / slab on demos).
    dim.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;background:transparent;pointer-events:none;";
    var ring = document.createElement("div");
    ring.setAttribute("data-runbook-watch-ring", "1");
    ring.style.cssText =
      "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid rgba(251,191,36,.95);border-radius:12px;box-shadow:0 0 0 4px rgba(251,191,36,.2);display:none;";
    var cursor = document.createElement("div");
    cursor.setAttribute("data-runbook-watch-cursor", "1");
    cursor.style.cssText =
      "position:fixed;z-index:2147483648;pointer-events:none;left:0;top:0;display:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4));";
    cursor.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 00-.85.36z" fill="white" stroke="#0f172a" stroke-width="1.2"/></svg>';
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.setAttribute("data-runbook-watch-cancel", "1");
    cancel.style.cssText =
      "position:fixed;top:72px;right:16px;z-index:2147483649;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#1e293b;color:#f8fafc;font:12px system-ui;cursor:pointer;";
    var pulse = document.createElement("span");
    pulse.setAttribute("data-runbook-watch-pulse", "1");
    pulse.style.cssText =
      "position:absolute;left:-4px;top:-4px;width:36px;height:36px;border-radius:50%;border:2px solid rgba(99,102,241,.9);display:none;animation:rbWatchPing .55s ease-out 1;";
    cursor.appendChild(pulse);
    document.body.appendChild(dim);
    document.body.appendChild(ring);
    document.body.appendChild(cursor);
    document.body.appendChild(cancel);
    if (!document.getElementById("rb-watch-keyframes")) {
      var st = document.createElement("style");
      st.id = "rb-watch-keyframes";
      st.textContent = "@keyframes rbWatchPing{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.4);opacity:0}}";
      document.head.appendChild(st);
    }
    return { dim: dim, ring: ring, cursor: cursor, cancel: cancel, pulse: pulse };
  }

  function rbDestroyWatchUi(ui) {
    ["dim", "ring", "cursor", "cancel"].forEach(function (k) {
      if (ui[k] && ui[k].parentNode) ui[k].parentNode.removeChild(ui[k]);
    });
  }

  function rbRunWatchMe(opts) {
    opts = opts || {};
    var full = Boolean(opts.full);
    var addBot = opts.addBot;
    var steps = rbGetDemoSteps();
    if (!steps.length) {
      if (addBot) addBot("<strong>Watch Me</strong><br/>This page has no Watch Me script yet. Ask your team to add <code>window.RUNBOOK_DEMO_STEPS</code>.");
      return Promise.resolve();
    }
    var cancelled = false;
    var ui = rbCreateWatchUi();
    function isCancelled() {
      return cancelled;
    }
    ui.cancel.addEventListener("click", function () {
      cancelled = true;
    });
    try {
      window.dispatchEvent(new CustomEvent("runbook-watch-me-start"));
    } catch (eStart) {}
    ui.cancel.style.pointerEvents = "auto";

    var startIdx = 0;
    if (!full) {
      try {
        startIdx = parseInt(sessionStorage.getItem(RB_WATCH_IDX_KEY) || "0", 10) || 0;
        if (startIdx >= steps.length) startIdx = 0;
      } catch (e) {
        startIdx = 0;
      }
    } else {
      try {
        sessionStorage.removeItem(RB_WATCH_IDX_KEY);
      } catch (e2) {}
    }

    var cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    ui.cursor.style.display = "block";
    ui.cursor.style.left = cursorPos.x + "px";
    ui.cursor.style.top = cursorPos.y + "px";
    ui.cancel.style.display = "block";

    return (async function () {
      try {
        var list = full ? steps : steps.slice(startIdx, startIdx + 1);
        if (!full && !list.length) list = [steps[0]];
        for (var i = 0; i < (full ? steps.length : list.length); i++) {
          if (cancelled) break;
          var step = full ? steps[i] : list[0];
          var si = full ? i : startIdx;

          var sel = step.target ? String(step.target) : "";
          var selAlt = step.targetAlt ? String(step.targetAlt) : "";
          var el = sel ? await rbWaitForSelector(sel, 3200, isCancelled) : null;
          if ((!el || !(el instanceof HTMLElement)) && selAlt) {
            el = await rbWaitForSelector(selAlt, 1200, isCancelled);
          }
          if (!el || !(el instanceof HTMLElement)) {
            rbPageToast("Skipped: " + String(step.label || step.id || "target not found"));
            await rbWaitMs(450, isCancelled);
            continue;
          }
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          await rbWaitMs(full ? 520 : 420, isCancelled);
          el = sel ? await rbWaitForSelector(sel, 2200, isCancelled) : null;
          if ((!el || !(el instanceof HTMLElement)) && selAlt) {
            el = await rbWaitForSelector(selAlt, 1200, isCancelled);
          }
          if (!el || !(el instanceof HTMLElement)) {
            rbPageToast("Skipped after scroll: " + String(step.label || step.id || "target lost"));
            await rbWaitMs(450, isCancelled);
            continue;
          }
          var r = el.getBoundingClientRect();
          var pad = 6;
          var rw = r.width + pad * 2;
          var rh = r.height + pad * 2;
          var rx = r.left - pad;
          var ry = r.top - pad;
          var vh = window.innerHeight || 0;
          var vw = window.innerWidth || 0;
          if (vh > 0 && rh > vh * 0.62 && rw < vw * 0.45) {
            var ch = Math.min(rh, 56);
            ry = r.top + r.height / 2 - ch / 2;
            rh = ch;
          }
          if (vw > 0 && rw > vw * 0.92) {
            rw = Math.min(rw, vw * 0.88);
            rx = Math.max(8, (vw - rw) / 2);
          }
          ui.ring.style.display = "block";
          ui.ring.style.top = ry + "px";
          ui.ring.style.left = rx + "px";
          ui.ring.style.width = rw + "px";
          ui.ring.style.height = rh + "px";
          var target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          await rbAnimateCursor(cursorPos, target, 560, function (x, y) {
            cursorPos = { x: x, y: y };
            ui.cursor.style.left = x + "px";
            ui.cursor.style.top = y + "px";
          }, isCancelled);
          if (cancelled) break;
          await rbWaitMs(420, isCancelled);
          ui.pulse.style.display = "block";
          await rbWaitMs(200, isCancelled);
          ui.pulse.style.display = "none";
          var doClick = step.click !== false;
          if (doClick && typeof el.click === "function") {
            try {
              el.click();
            } catch (e3) {}
          }
          var fxList = [];
          if (step.effect) fxList.push(step.effect);
          if (Array.isArray(step.effects)) fxList = fxList.concat(step.effects);
          for (var fi = 0; fi < fxList.length; fi++) {
            rbApplyDemoEffect(fxList[fi]);
          }
          if (step.successText) rbPageToast(String(step.successText));
          var pauseMs = step.waitAfter != null ? Number(step.waitAfter) : full ? 920 : 720;
          await rbWaitMs(pauseMs, isCancelled);
          ui.ring.style.display = "none";
          if (!full) {
            try {
              sessionStorage.setItem(RB_WATCH_IDX_KEY, String((si + 1) % steps.length));
            } catch (e4) {}
            break;
          }
        }
        if (!cancelled) {
          rbPageToast("Done — now you try.");
          if (typeof addBot === "function") {
            addBot("<strong>Watch Me</strong><br/>Done — now you try.");
          }
          try {
            window.dispatchEvent(new CustomEvent("runbook-assistant-status", { detail: "Done — now you try." }));
          } catch (e5) {}
        }
      } finally {
        rbDestroyWatchUi(ui);
      }
    })();
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
    body.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var btn = t.closest
        ? t.closest("[data-rb-local-guide],[data-rb-local-watch],[data-rb-local-watch-full]")
        : null;
      if (!btn) return;
      if (btn.getAttribute("data-rb-local-guide") === "1") {
        ev.preventDefault();
        try {
          window.dispatchEvent(new CustomEvent("runbook-start-tour"));
        } catch (e) {}
      }
      if (btn.getAttribute("data-rb-local-watch") === "1") {
        ev.preventDefault();
        void rbRunWatchMe({ full: false, addBot: addBot });
      }
      if (btn.getAttribute("data-rb-local-watch-full") === "1") {
        ev.preventDefault();
        void rbRunWatchMe({ full: true, addBot: addBot });
      }
    });
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
        el.getAttribute("class") || "",
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
      if (v) {
        panel.classList.add("open");
        if (body.children.length <= 1) {
          hasStartedChat = false;
          chipsWrap.style.display = "";
        }
      } else {
        panel.classList.remove("open");
      }
    }
    btn.addEventListener("click", function () {
      setOpen(!open);
    });
    closeBtn.addEventListener("click", function () {
      setOpen(false);
      hasStartedChat = false;
      chipsWrap.style.display = "";
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

    (function addWatchChips() {
      var ds = rbGetDemoSteps();
      if (!ds.length) return;
      var guideChip = document.createElement("button");
      guideChip.type = "button";
      guideChip.className = "rb-chip";
      guideChip.style.borderColor = "rgba(52,211,153,.45)";
      guideChip.style.background = "rgba(16,185,129,.12)";
      guideChip.style.color = "#a7f3d0";
      guideChip.textContent = "Walkthrough";
      guideChip.setAttribute("title", "Step-by-step coach on the page (you perform each action)");
      guideChip.addEventListener("click", function () {
        try {
          window.dispatchEvent(new CustomEvent("runbook-start-tour"));
        } catch (eG) {}
      });
      chipsWrap.appendChild(guideChip);
      var wm = document.createElement("button");
      wm.type = "button";
      wm.className = "rb-chip";
      wm.style.borderColor = "rgba(251,191,36,.5)";
      wm.style.background = "rgba(245,158,11,.12)";
      wm.style.color = "#fde68a";
      wm.textContent = "Watch me";
      wm.addEventListener("click", function () {
        void rbRunWatchMe({ full: false, addBot: addBot });
      });
      chipsWrap.appendChild(wm);
      var wf = document.createElement("button");
      wf.type = "button";
      wf.className = "rb-chip";
      wf.style.borderColor = "rgba(251,191,36,.5)";
      wf.style.background = "rgba(245,158,11,.12)";
      wf.style.color = "#fde68a";
      wf.textContent = "Watch full setup";
      wf.addEventListener("click", function () {
        void rbRunWatchMe({ full: true, addBot: addBot });
      });
      chipsWrap.appendChild(wf);
    })();

    async function doSend() {
      var q = (inp.value || "").trim();
      if (!q) return;
      if (/what\s*can\s*i\s*do\s*here\??/i.test(q)) {
        var stLocal = rbGetDemoSteps();
        if (stLocal.length > 0) {
          inp.value = "";
          addUser(q);
          var feats = [];
          try {
            document.querySelectorAll("[data-runbook-title]").forEach(function (n) {
              var tt = (n.getAttribute("data-runbook-title") || "").trim();
              if (tt && feats.indexOf(tt) === -1) feats.push(tt);
            });
          } catch (e0) {}
          var html = "<p><strong>Here is what you can do on this page:</strong></p><ul class=\"rb-steps\">";
          stLocal.slice(0, 3).forEach(function (s) {
            html += "<li>" + rbEscapeHtml(String(s.label || s.id || "Step")) + "</li>";
          });
          html += "</ul>";
          if (feats.length)
            html +=
              '<p style="font-size:11px;color:#94a3b8;margin-top:8px;">Annotated areas: ' +
              rbEscapeHtml(feats.slice(0, 5).join(", ")) +
              "</p>";
          html +=
            '<p style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;">' +
            '<button type="button" class="rb-send" data-rb-local-guide="1">Walkthrough</button>' +
            '<button type="button" class="rb-send" data-rb-local-watch="1">Watch me</button>' +
            '<button type="button" class="rb-send" style="opacity:.9" data-rb-local-watch-full="1">Watch full setup</button>' +
            "</p>";
          addBot(html);
          sendBtn.disabled = false;
          return;
        }
      }
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
          data.steps.slice(0, CLIENT_MAX_STEPS).forEach(function (s) {
            html += "<li>" + escapeHtml(s) + "</li>";
          });
          html += "</ol>";
        }
        if (data.sources && data.sources.length) {
          html += '<div class="rb-src"><strong>Sources</strong><br/>';
          data.sources.slice(0, CLIENT_MAX_SOURCES).forEach(function (s) {
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
