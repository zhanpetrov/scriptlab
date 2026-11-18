/**
 * 220 Lab · Film Script Lab — Commercial Landing Page Runtime (scripts/landing.js)
 * Powers:
 * - Light / Dark Apple theme toggle
 * - Interactive 3-Column Live Workbench Showcase (real YouTube videos + 4-mode provenance)
 * - Zhan Petrov Stripe Checkout (`POST /api/checkout` or Payment Links)
 * - Real Cloudflare Worker Waitlist Application & Live Approval Status Verification
 */
(function () {
  "use strict";

  const CFG = window.SCRIPTLAB_CONFIG || {};
  const API_BASE = String(CFG.WORKER_URL || "").replace(/\/$/, "");
  const STARTER = window.SCRIPTLAB_STARTER_DATA || { sources: [], lines: [], defaultCharacterMap: {} };
  const SESSION_KEY = "scriptlab-session-v1";

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function fmtTc(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // ---------- 1. Theme Switcher ----------
  const savedTheme = localStorage.getItem("scriptlab-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", savedTheme);
  }
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const isDark =
        cur === "dark" ||
        (!cur && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const next = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("scriptlab-theme", next);
      window.SLAnalytics?.track("theme_switched", { theme: next, page: "landing" });
    });
  }

  // Update nav button if user already holds a valid session token
  try {
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (sess && sess.token && sess.email) {
      const statusBtn = document.getElementById("nav-status-btn");
      if (statusBtn) {
        statusBtn.textContent = `Approved · ${sess.email.split("@")[0]}`;
        statusBtn.href = "app.html";
      }
    }
  } catch (e) {}

  // ---------- 1B. Built From a Real Film — Trailer Player ----------
  const filmVideo = document.getElementById("film-trailer-video");
  const filmOverlay = document.getElementById("film-trailer-overlay");
  const filmSoundBtn = document.getElementById("film-trailer-sound-btn");
  const filmSilentBtn = document.getElementById("film-trailer-silent-btn");

  if (filmVideo && filmSoundBtn) {
    const startWithSound = () => {
      filmVideo.muted = false;
      filmVideo.loop = false;
      filmVideo.controls = true;
      if (filmOverlay) filmOverlay.classList.add("is-hidden");
      const p = filmVideo.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      window.SLAnalytics?.track("howisee_trailer_played", { mode: "sound" });
    };

    filmSoundBtn.addEventListener("click", startWithSound);

    if (filmSilentBtn) {
      filmSilentBtn.addEventListener("click", () => {
        filmVideo.muted = true;
        filmVideo.loop = true;
        filmVideo.controls = false;
        const p = filmVideo.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
        filmSilentBtn.textContent = "Playing silently (muted)";
        window.SLAnalytics?.track("howisee_trailer_played", { mode: "silent" });
      });
    }

    filmVideo.addEventListener("ended", () => {
      if (!filmVideo.loop && filmOverlay) {
        filmOverlay.classList.remove("is-hidden");
      }
    });
  }

  // ---------- 2. Interactive Live Workbench Showcase ----------
  const sources = STARTER.sources || [];
  const allLines = STARTER.lines || [];
  const charMap = Object.assign({}, STARTER.defaultCharacterMap || {});
  const HOWISEE_INTERVIEWS_URL =
    "https://howisee.homes/?utm_source=scriptlab&utm_medium=site&utm_campaign=howisee#interviews";

  let activeSourceId = sources[0]?.id || "";
  let demoQuery = "";
  let activeLine = allLines.find((l) => l.workshopId === activeSourceId && l.speaker.includes("Shelter")) || allLines[0] || null;
  let ytPlayer = null;
  let ytReady = false;
  let excerptGuardTimer = null;

  function getSourceById(id) {
    return sources.find((s) => s.id === id) || sources[0] || null;
  }

  function isExcerptLine(line) {
    return Boolean(line && Number.isFinite(Number(line.excerptEnd)));
  }

  function buildInitialDemoElements() {
    const lShelter =
      allLines.find((l) => l.youtubeId === "QgwRsArIVKI" && l.speaker.includes("Shelter")) || allLines[0];
    const lMilo =
      allLines.find((l) => l.youtubeId === "QgwRsArIVKI" && l.speaker.includes("Milo") && l.wordCount >= 12) ||
      allLines[1];
    const els = [
      {
        id: "d-act-1",
        type: "action",
        text: "San Francisco’s Tenderloin after dark. Black-and-white handheld camera at eye level along Taylor Street and the Muni tracks. Wind rattles a handmade sidewalk shelter.",
      },
    ];
    if (lShelter) {
      els.push({
        id: "d-el-1",
        type: "dialogue",
        mode: "ORIGINAL",
        srcId: lShelter.id,
        speaker: lShelter.speaker,
        character: charMap[lShelter.speaker] || "MAN UNDER SHELTER",
        text: lShelter.text,
        originalText: lShelter.text,
        youtubeId: lShelter.youtubeId,
        seconds: lShelter.seconds,
        excerptStart: lShelter.excerptStart,
        excerptEnd: lShelter.excerptEnd,
      });
    }
    if (lMilo) {
      els.push({
        id: "d-el-2",
        type: "dialogue",
        mode: "ADAPTED",
        srcId: lMilo.id,
        speaker: lMilo.speaker,
        character: charMap[lMilo.speaker] || "TRAVELER",
        text: "42. I walked from Visalia, California. It took me 30 days—and I just barely made it here tonight. I have a home. I just left.",
        originalText: lMilo.text,
        youtubeId: lMilo.youtubeId,
        seconds: lMilo.seconds,
        excerptStart: lMilo.excerptStart,
        excerptEnd: lMilo.excerptEnd,
      });
    }
    return els;
  }

  let demoElements = buildInitialDemoElements();

  function renderDemoTabs() {
    const tabsEl = document.getElementById("demo-source-tabs");
    if (!tabsEl) return;
    tabsEl.innerHTML = sources
      .map(
        (s) => `
        <button type="button" class="showcase-tab ${s.id === activeSourceId ? "active" : ""}" data-demo-src="${esc(s.id)}">
          ${esc(s.shortLabel)} <span style="opacity:0.7;">(${s.lineCount})</span>
        </button>
      `
      )
      .join("");
  }

  function renderDemoArchive() {
    const listEl = document.getElementById("demo-archive-list");
    const countEl = document.getElementById("demo-line-count");
    if (!listEl) return;

    const q = demoQuery.trim().toLowerCase();
    const filtered = allLines.filter((l) => {
      if (activeSourceId && l.workshopId !== activeSourceId) return false;
      if (l.wordCount <= 3 && !isExcerptLine(l)) return false;
      if (q && !`${l.speaker} ${l.text} ${l.id} ${l.excerptLabel || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (countEl) countEl.textContent = `${filtered.length} lines`;

    let lastExcerptId = "";
    listEl.innerHTML = filtered
      .slice(0, 35)
      .map((l) => {
        const isAct = activeLine && activeLine.id === l.id;
        let groupHeader = "";
        if (l.excerptId && l.excerptId !== lastExcerptId) {
          lastExcerptId = l.excerptId;
          groupHeader = `
            <div class="sc-excerpt-divider">
              <span>${esc(l.excerptLabel || "Short Excerpt")}</span>
              <a href="${HOWISEE_INTERVIEWS_URL}">Full uncut interviews →</a>
            </div>
          `;
        }
        return `
          ${groupHeader}
          <div class="sc-card ${isAct ? "active" : ""}" data-demo-card="${esc(l.id)}">
            <div class="sc-card-meta">
              <span class="sc-card-spk">${esc(l.speaker)}</span>
              <span class="sc-card-tc">${esc(fmtTc(l.seconds))}</span>
            </div>
            <div class="sc-card-txt">${esc(l.text)}</div>
            <div class="sc-card-actions">
              <span class="sc-src-tag">${esc(l.id)}</span>
              <div style="display:flex;gap:5px;">
                <button type="button" class="sc-mini-btn" data-demo-play="${esc(l.id)}">▶ Play</button>
                <button type="button" class="sc-mini-btn insert" data-demo-insert="${esc(l.id)}">+ Add</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderDemoPaper() {
    const paperEl = document.getElementById("demo-paper");
    if (!paperEl) return;

    const srcObj = getSourceById(activeSourceId);
    const slugLoc =
      srcObj?.youtubeId === "UF8uR6Z6KLc"
        ? "INT. STANFORD STADIUM PODIUM - DAY"
        : srcObj?.youtubeId === "RxiiSR6sZyQ"
          ? "INT. 220 LAB BERKELEY STUDIO - NIGHT"
          : "EXT. TENDERLOIN STREET - NIGHT";

    const itemsHtml = demoElements
      .map((el, idx) => {
        if (el.type === "action") {
          return `<div class="sc-action">${esc(el.text)}</div>`;
        }
        const canAdapt = el.mode === "ORIGINAL";
        const canRestore = el.mode === "ADAPTED";
        const srcTag = el.srcId ? `${el.srcId} · ${fmtTc(el.seconds)}` : "Authored · no video source";
        return `
          <div class="sc-dlg ${esc(el.mode)}" data-demo-el-idx="${idx}">
            <div class="sc-dlg-bar">
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="sc-badge">${esc(el.mode.replace("_", " "))}</span>
                <span style="font-family:var(--mono);color:#5d584e;">${esc(srcTag)}</span>
              </div>
              <div style="display:flex;gap:4px;">
                ${el.srcId ? `<button type="button" class="sc-mini-btn" style="background:#efe8d7;color:#181715;border-color:#cbbfa8;" data-demo-play="${esc(el.srcId)}">▶</button>` : ""}
                ${canAdapt ? `<button type="button" class="sc-mini-btn" style="background:#efe8d7;color:#181715;border-color:#cbbfa8;" data-demo-adapt="${idx}">Adapt…</button>` : ""}
                ${canRestore ? `<button type="button" class="sc-mini-btn" style="background:#efe8d7;color:#181715;border-color:#cbbfa8;" data-demo-restore="${idx}">↺ Original</button>` : ""}
              </div>
            </div>
            <div class="sc-char">${esc(el.character)}</div>
            <div class="sc-words">${esc(el.text)}</div>
            ${
              el.mode === "ADAPTED" && el.originalText
                ? `<div style="margin-top:6px;padding-top:5px;border-top:1px dashed rgba(154,82,8,0.35);font-size:11.5px;color:#5d584e;">
                     <strong>Verbatim (${esc(el.srcId)}):</strong> “${esc(el.originalText)}”
                   </div>`
                : ""
            }
          </div>
        `;
      })
      .join("");

    paperEl.innerHTML = `
      <div class="sc-slug"><span>1   ${esc(slugLoc)}   1</span></div>
      ${itemsHtml}
    `;
  }

  function renderDemoInspector(excerptEnded) {
    const box = document.getElementById("demo-inspector");
    if (!box || !activeLine) return;
    const excerptOnly = isExcerptLine(activeLine);
    const cue = charMap[activeLine.speaker] || activeLine.speaker.toUpperCase();
    const linkHtml = excerptOnly
      ? `<a href="${HOWISEE_INTERVIEWS_URL}" style="color:#f5f5f7;font-weight:600;text-decoration:underline;">Full uncut interviews → howisee.homes</a>`
      : `<a href="https://youtu.be/${encodeURIComponent(activeLine.youtubeId)}?t=${activeLine.seconds}s" target="_blank" rel="noopener" style="color:#66b3ff;font-weight:600;">Open on YouTube ↗</a>`;

    box.innerHTML = `
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#ff9f93;margin-bottom:3px;">
        ${excerptOnly ? esc(activeLine.excerptLabel || "HOW I SEE · Short Excerpt") : "Source-Linked Moment"}
      </div>
      <div style="font-weight:700;font-size:13.5px;color:#f5f5f7;margin-bottom:2px;">
        ${esc(activeLine.speaker)} → <span style="color:#d4d8e2;">${esc(cue)}</span> · <span style="font-family:var(--mono);color:#9ba1b0;">${esc(fmtTc(activeLine.seconds))}</span>
      </div>
      <div style="font-family:var(--courier);font-size:12.5px;color:#f0ece2;background:#13161c;border-left:3px solid #2ea063;padding:7px 9px;border-radius:4px;margin:6px 0 8px;">
        “${esc(activeLine.text)}”
      </div>
      ${
        excerptEnded
          ? `<div style="font-size:11.5px;color:#ffd08a;margin-bottom:6px;">Short excerpt preview ended. Watch all 41:43 (11 chapters) on howisee.homes.</div>`
          : ""
      }
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:11.5px;">
        <span class="sc-src-tag">${esc(activeLine.id)}</span>
        ${linkHtml}
      </div>
    `;
  }

  function startExcerptGuard(line) {
    if (excerptGuardTimer) {
      clearInterval(excerptGuardTimer);
      excerptGuardTimer = null;
    }
    if (!isExcerptLine(line)) return;
    excerptGuardTimer = setInterval(() => {
      if (!ytReady || !ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
      try {
        const t = ytPlayer.getCurrentTime();
        if (t >= Number(line.excerptEnd)) {
          ytPlayer.pauseVideo();
          clearInterval(excerptGuardTimer);
          excerptGuardTimer = null;
          const st = document.getElementById("demo-player-status");
          if (st) st.textContent = "Excerpt ended";
          renderDemoInspector(true);
        }
      } catch (e) {}
    }, 450);
  }

  function playDemoLine(line, autoplay) {
    if (!line) return;
    activeLine = line;
    renderDemoInspector(false);
    renderDemoArchive();
    if (ytReady && ytPlayer) {
      try {
        const payload = { videoId: line.youtubeId, startSeconds: line.seconds };
        if (isExcerptLine(line)) payload.endSeconds = Number(line.excerptEnd);
        if (autoplay) {
          ytPlayer.loadVideoById(payload);
          startExcerptGuard(line);
        } else {
          ytPlayer.cueVideoById(payload);
        }
      } catch (e) {}
    }
  }

  function bootDemoPlayer() {
    const timer = setInterval(() => {
      if (window.YT && typeof window.YT.Player === "function") {
        clearInterval(timer);
        const host = document.getElementById("landing-yt-player");
        if (!host) return;
        const pVars = {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: activeLine ? activeLine.seconds : 0,
        };
        if (isExcerptLine(activeLine)) {
          pVars.end = Number(activeLine.excerptEnd);
        }
        ytPlayer = new window.YT.Player("landing-yt-player", {
          videoId: activeLine ? activeLine.youtubeId : "QgwRsArIVKI",
          playerVars: pVars,
          events: {
            onReady: () => {
              ytReady = true;
            },
            onStateChange: (ev) => {
              const st = document.getElementById("demo-player-status");
              if (!st) return;
              if (ev.data === window.YT.PlayerState.PLAYING) {
                st.textContent = isExcerptLine(activeLine) ? "Playing excerpt" : "Playing";
                startExcerptGuard(activeLine);
              } else if (ev.data === window.YT.PlayerState.PAUSED) {
                st.textContent = "Paused";
              } else if (ev.data === window.YT.PlayerState.ENDED && isExcerptLine(activeLine)) {
                st.textContent = "Excerpt ended";
                renderDemoInspector(true);
              } else {
                st.textContent = "Ready";
              }
            },
          },
        });
      }
    }, 200);
  }

  renderDemoTabs();
  renderDemoArchive();
  renderDemoPaper();
  renderDemoInspector(false);
  bootDemoPlayer();

  // Demo interactions
  document.getElementById("live-preview")?.addEventListener("click", (e) => {
    const srcBtn = e.target.closest("[data-demo-src]");
    if (srcBtn) {
      activeSourceId = srcBtn.dataset.demoSrc;
      const firstInSrc = allLines.find((l) => l.workshopId === activeSourceId && l.wordCount > 3);
      renderDemoTabs();
      renderDemoArchive();
      renderDemoPaper();
      if (firstInSrc) playDemoLine(firstInSrc, false);
      window.SLAnalytics?.track("preview_source_switched", { sourceId: activeSourceId });
      return;
    }

    const playBtn = e.target.closest("[data-demo-play]");
    if (playBtn) {
      const l = allLines.find((x) => x.id === playBtn.dataset.demoPlay);
      if (l) {
        playDemoLine(l, true);
        window.SLAnalytics?.track("preview_line_played", { srcId: l.id, youtubeId: l.youtubeId });
      }
      return;
    }

    const insBtn = e.target.closest("[data-demo-insert]");
    if (insBtn) {
      const l = allLines.find((x) => x.id === insBtn.dataset.demoInsert);
      if (l) {
        demoElements.push({
          id: "d-" + Date.now(),
          type: "dialogue",
          mode: "ORIGINAL",
          srcId: l.id,
          speaker: l.speaker,
          character: charMap[l.speaker] || l.speaker.toUpperCase(),
          text: l.text,
          originalText: l.text,
          youtubeId: l.youtubeId,
          seconds: l.seconds,
        });
        renderDemoPaper();
        playDemoLine(l, false);
        window.SLAnalytics?.track("preview_line_inserted", { srcId: l.id });
      }
      return;
    }

    const adaptBtn = e.target.closest("[data-demo-adapt]");
    if (adaptBtn) {
      const idx = Number(adaptBtn.dataset.demoAdapt);
      const el = demoElements[idx];
      if (el && el.mode === "ORIGINAL") {
        el.mode = "ADAPTED";
        el.text = el.originalText.replace(/^(Well,\s*|So,\s*|And\s*)/i, "");
        if (el.text === el.originalText) {
          el.text = el.originalText + " [tightened beat]";
        }
        renderDemoPaper();
        window.SLAnalytics?.track("preview_mode_inspected", { mode: "ADAPTED" });
      }
      return;
    }

    const restBtn = e.target.closest("[data-demo-restore]");
    if (restBtn) {
      const idx = Number(restBtn.dataset.demoRestore);
      const el = demoElements[idx];
      if (el && el.mode === "ADAPTED") {
        el.mode = "ORIGINAL";
        el.text = el.originalText;
        renderDemoPaper();
      }
      return;
    }

    if (e.target.closest("#demo-add-ai")) {
      demoElements.push({
        id: "d-ai-" + Date.now(),
        type: "dialogue",
        mode: "AI_SUGGESTION",
        srcId: null,
        character: "DRAMATIC BRIDGE",
        text: "Wait a second—play back the tape from October before anybody leaves this table.",
      });
      renderDemoPaper();
      window.SLAnalytics?.track("preview_mode_inspected", { mode: "AI_SUGGESTION" });
      return;
    }

    if (e.target.closest("#demo-add-written")) {
      demoElements.push({
        id: "d-wr-" + Date.now(),
        type: "dialogue",
        mode: "WRITTEN",
        srcId: null,
        character: "INTERVIEWER",
        text: "You signed the manifest yourself. Look at the date on page four.",
      });
      renderDemoPaper();
      window.SLAnalytics?.track("preview_mode_inspected", { mode: "WRITTEN" });
      return;
    }

    if (e.target.closest("#demo-reset-script")) {
      demoElements = buildInitialDemoElements();
      renderDemoPaper();
    }
  });

  document.getElementById("demo-search")?.addEventListener("input", (e) => {
    demoQuery = e.target.value;
    renderDemoArchive();
  });

  // Custom YouTube URL form inside landing showcase -> carries URL into Studio / Waitlist
  document.getElementById("demo-custom-url-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const urlVal = (document.getElementById("demo-custom-url")?.value || "").trim();
    window.SLAnalytics?.track("preview_custom_youtube_submitted", { hasUrl: Boolean(urlVal) });
    if (urlVal) {
      sessionStorage.setItem("scriptlab-pending-youtube", urlVal);
      const wlYt = document.getElementById("wl-yt");
      if (wlYt && !wlYt.value) wlYt.value = urlVal;
    }
    // If already approved, jump straight into Studio and auto-ingest!
    try {
      const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (sess && sess.token) {
        window.location.href = `app.html${urlVal ? `?ingest=${encodeURIComponent(urlVal)}` : ""}`;
        return;
      }
    } catch {}
    window.location.href = `app.html${urlVal ? `?ingest=${encodeURIComponent(urlVal)}` : ""}`;
  });

  // ---------- 3. Commercial Checkout (Zhan Petrov Stripe) ----------
  document.querySelectorAll("[data-select-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sel = document.getElementById("wl-plan");
      if (sel) sel.value = btn.dataset.selectPlan;
    });
  });

  document.querySelectorAll("[data-checkout-tier]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tier = btn.dataset.checkoutTier;
      const planCfg = CFG.plans?.[tier] || {};
      const feedback = document.getElementById("checkout-feedback");

      window.SLAnalytics?.track("checkout_clicked", {
        tier,
        price: planCfg.price || "",
        mode: CFG.STRIPE_MODE || "worker",
      });

      // Option A: Direct Stripe Payment Link if configured
      if (planCfg.paymentLink && planCfg.paymentLink.startsWith("https://buy.stripe.com/")) {
        window.location.href = planCfg.paymentLink;
        return;
      }

      // Option B: Live Cloudflare Worker Stripe Checkout Session
      const origLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Connecting to Stripe…";
      if (feedback) feedback.hidden = true;

      try {
        const res = await fetch(`${API_BASE}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier,
            email: document.getElementById("wl-email")?.value || "",
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }

        // Graceful Priority Founding Pass reservation if Stripe key is awaiting live activation
        const wlPlan = document.getElementById("wl-plan");
        if (wlPlan) wlPlan.value = tier;
        if (feedback) {
          feedback.hidden = false;
          feedback.className = "status-banner pending";
          feedback.innerHTML = `
            <strong>Priority ${esc(planCfg.name || tier)} Reservation:</strong>
            Live card checkout is being finalized on 220 Lab’s Stripe merchant account.
            <a href="#waitlist" style="font-weight:700;margin-left:4px;">Submit your email below ↓</a>
            to lock your Founding rate and get priority Studio approval today.
          `;
        }
        document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => document.getElementById("wl-name")?.focus(), 450);
      } catch (err) {
        document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
      } finally {
        btn.disabled = false;
        btn.textContent = origLabel;
      }
    });
  });

  // ---------- 4. Waitlist Application Submission ----------
  const wlForm = document.getElementById("waitlist-form");
  const wlResult = document.getElementById("wl-result");

  // Pre-fill saved applicant email if present
  const lastEmail = localStorage.getItem("scriptlab-applicant-email") || "";
  if (lastEmail) {
    const chkInp = document.getElementById("chk-email");
    if (chkInp && !chkInp.value) chkInp.value = lastEmail;
  }

  wlForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("wl-submit-btn");
    const name = document.getElementById("wl-name")?.value.trim() || "";
    const email = document.getElementById("wl-email")?.value.trim() || "";
    const role = document.getElementById("wl-role")?.value || "";
    const planInterest = document.getElementById("wl-plan")?.value || "beta";
    const youtubeUrl = document.getElementById("wl-yt")?.value.trim() || "";
    const notes = document.getElementById("wl-notes")?.value.trim() || "";

    if (!email) return;
    btn.disabled = true;
    btn.textContent = "Submitting to 220 Lab…";
    wlResult.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/api/waitlist/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          plan_interest: planInterest,
          youtube_url: youtubeUrl,
          notes,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        wlResult.hidden = false;
        wlResult.className = "status-banner error";
        wlResult.textContent = data.error || "Could not submit application. Please check your email.";
        return;
      }

      localStorage.setItem("scriptlab-applicant-email", email.toLowerCase());
      const chkEmail = document.getElementById("chk-email");
      if (chkEmail) chkEmail.value = email.toLowerCase();

      window.SLAnalytics?.identify(email, { name, role, plan_interest: planInterest });
      window.SLAnalytics?.track("waitlist_submitted", {
        role,
        plan_interest: planInterest,
        status: data.status,
      });

      if (data.status === "approved" && data.token) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            token: data.token,
            email: data.email,
            name: data.name,
            tier: data.tier,
            expiresAt: data.expires_at,
          })
        );
        wlResult.hidden = false;
        wlResult.className = "status-banner approved";
        wlResult.innerHTML = `
          <strong>Approved!</strong> Welcome back, ${esc(data.name || data.email)}. Your 220 Lab Studio pass is active.<br />
          <a href="app.html" class="btn-pill primary sm" style="margin-top:10px;">Open Film Script Lab Studio →</a>
        `;
      } else {
        wlResult.hidden = false;
        wlResult.className = "status-banner pending";
        wlResult.innerHTML = `
          <strong>Application Received · Queue #${esc(data.queue_number || 1)}</strong><br />
          <code>${esc(data.email)}</code> is now pending 220 Lab approval. Check your approval status anytime in the verification form.
        `;
      }
    } catch (err) {
      wlResult.hidden = false;
      wlResult.className = "status-banner error";
      wlResult.textContent = "Network error reaching 220 Lab waitlist server. Please try again.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit Application for Approval";
    }
  });

  // ---------- 5. Approval Status & Invite Code Checker ----------
  const chkForm = document.getElementById("status-check-form");
  const chkResult = document.getElementById("chk-result");

  chkForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("chk-submit-btn");
    const email = document.getElementById("chk-email")?.value.trim() || "";
    const code = document.getElementById("chk-code")?.value.trim().toUpperCase() || "";

    if (!email && !code) {
      chkResult.hidden = false;
      chkResult.className = "status-banner error";
      chkResult.textContent = "Enter your email address or an SL-XXXX-XXXX invite code.";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Verifying with 220 Lab…";
    chkResult.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, invite_code: code }),
      });
      const data = await res.json();

      window.SLAnalytics?.track("waitlist_status_checked", {
        hasCode: Boolean(code),
        authorized: Boolean(data.authorized),
        status: data.status || (data.authorized ? "approved" : "denied"),
      });

      if (res.ok && data.authorized && data.token) {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            token: data.token,
            email: data.session?.email || email,
            name: data.session?.name || "",
            tier: data.session?.tier || "beta",
            expiresAt: data.expires_at,
          })
        );
        chkResult.hidden = false;
        chkResult.className = "status-banner approved";
        chkResult.innerHTML = `
          <strong>Access Approved (${esc((data.session?.tier || "beta").toUpperCase())})</strong><br />
          Redirecting you to <strong>220 Lab · Film Script Lab</strong>…<br />
          <a href="app.html" class="btn-pill primary sm" style="margin-top:10px;">Launch Studio Now →</a>
        `;
        setTimeout(() => {
          window.location.href = "app.html";
        }, 700);
        return;
      }

      chkResult.hidden = false;
      chkResult.className = data.status === "pending" ? "status-banner pending" : "status-banner error";
      chkResult.textContent = data.error || "Not yet approved. Submit the waitlist application form first.";
    } catch (err) {
      chkResult.hidden = false;
      chkResult.className = "status-banner error";
      chkResult.textContent = "Could not reach verification server. Please try again.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Verify Access & Launch Studio";
    }
  });

  // Wire contact email from config.js
  if (CFG.CONTACT_EMAIL) {
    document.querySelectorAll("[data-contact-email]").forEach((el) => {
      el.href = `mailto:${CFG.CONTACT_EMAIL}`;
    });
  }
})();
