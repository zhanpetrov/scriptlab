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

  // ---------- 2. Interactive Live Workbench Showcase (HOW I SEE Interviews + Biometrics + SF Map) ----------
  const allLines = STARTER.lines || [];
  const locations = STARTER.locations || [];
  const biometrics = STARTER.biometrics || { speakers: {} };
  const charMap = Object.assign({}, STARTER.defaultCharacterMap || {});
  const HOWISEE_INTERVIEWS_URL =
    "https://howisee.homes/?utm_source=scriptlab&utm_medium=site&utm_campaign=howisee#interviews";

  let activeExcerptId = "ALL"; // "ALL" or "ex1".."ex4"
  let activeSpeakerFilter = ""; // "" or exact speaker name
  let demoQuery = "";
  let activeLine = allLines.find((l) => l.speaker.includes("Shelter")) || allLines[0] || null;
  let ytPlayer = null;
  let ytReady = false;
  let excerptGuardTimer = null;

  function isExcerptLine(line) {
    return Boolean(line && Number.isFinite(Number(line.excerptEnd)));
  }

  function buildInitialDemoElements() {
    const lShelter =
      allLines.find((l) => l.speaker.includes("Shelter")) || allLines[0];
    const lMilo =
      allLines.find((l) => l.speaker.includes("Milo") && l.wordCount >= 12) ||
      allLines[1];
    const els = [
      {
        id: "d-act-1",
        type: "action",
        text: "San Francisco’s Tenderloin after dark. Black-and-white handheld camera at eye level along Taylor Street, Eddy Street, and the Muni tracks. Wind rattles a handmade sidewalk shelter.",
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
    const allBtn = `
      <button type="button" class="showcase-tab ${activeExcerptId === "ALL" && !activeSpeakerFilter ? "active" : ""}" data-demo-excerpt="ALL">
        All Street Interviews <span style="opacity:0.7;">(${allLines.length})</span>
      </button>
    `;
    const locBtns = locations
      .map(
        (loc) => `
        <button type="button" class="showcase-tab ${activeExcerptId === loc.id ? "active" : ""}" data-demo-excerpt="${esc(loc.id)}">
          ${esc(loc.tabLabel)} <span style="opacity:0.7;">(${loc.lineCount})</span>
        </button>
      `
      )
      .join("");
    tabsEl.innerHTML = allBtn + locBtns;
  }

  function renderSocialMap() {
    const mapEl = document.getElementById("demo-sf-map");
    if (!mapEl) return;

    const activeLoc =
      locations.find((l) => l.id === activeExcerptId) ||
      locations.find((l) => activeLine && l.id === activeLine.excerptId) ||
      null;

    const pinsSvg = locations
      .map((loc, idx) => {
        const isSel = activeExcerptId === loc.id || (activeExcerptId === "ALL" && activeLine && activeLine.excerptId === loc.id);
        return `
          <g class="sc-map-pin ${isSel ? "is-active" : ""}" data-demo-map-pin="${esc(loc.id)}" role="button" tabindex="0" aria-label="${esc(loc.locationLabel)} — ${esc(loc.speaker)}">
            ${isSel ? `<circle cx="${loc.x}" cy="${loc.y}" r="18" class="sc-pin-pulse"></circle>` : ""}
            <circle cx="${loc.x}" cy="${loc.y}" r="9" class="sc-pin-dot"></circle>
            <text x="${loc.x}" y="${loc.y + 3.5}" text-anchor="middle" class="sc-pin-num">${idx + 1}</text>
            <g transform="translate(${loc.x + 14}, ${loc.y - 10})">
              <rect x="0" y="0" width="${Math.max(108, loc.tabLabel.length * 6.4 + 14)}" height="20" rx="4" class="sc-pin-tag-bg"></rect>
              <text x="7" y="13.5" class="sc-pin-tag-txt">${esc(loc.tabLabel)}</text>
            </g>
          </g>
        `;
      })
      .join("");

    mapEl.innerHTML = `
      <svg viewBox="0 0 560 270" class="sc-sf-svg" aria-label="San Francisco Tenderloin and Mission Creek interview map">
        <defs>
          <pattern id="sf-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="560" height="270" fill="#090b0f" />
        <rect width="560" height="270" fill="url(#sf-grid)" />

        <!-- Tenderloin neighborhood highlight -->
        <rect x="96" y="42" width="224" height="122" rx="10" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.14)" stroke-dasharray="4 4" />
        <text x="108" y="60" class="sc-map-zone">TENDERLOIN · SAN FRANCISCO</text>

        <!-- Major streets (stylized accurate orientation) -->
        <line x1="70" y1="88" x2="355" y2="88" stroke="rgba(255,255,255,0.16)" stroke-width="1.5" />
        <text x="76" y="83" class="sc-map-street">ELLIS ST</text>

        <line x1="70" y1="126" x2="355" y2="126" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
        <text x="76" y="121" class="sc-map-street">EDDY ST</text>

        <line x1="70" y1="154" x2="355" y2="154" stroke="rgba(255,255,255,0.14)" stroke-width="1.2" />
        <text x="76" y="149" class="sc-map-street">TURK ST</text>

        <line x1="162" y1="36" x2="162" y2="215" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
        <text x="167" y="48" class="sc-map-street">HYDE ST</text>

        <line x1="242" y1="36" x2="242" y2="215" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
        <text x="247" y="48" class="sc-map-street">TAYLOR ST</text>

        <!-- Market St diagonal & Muni Light-Rail Corridor -->
        <line x1="60" y1="238" x2="420" y2="108" stroke="rgba(255,255,255,0.3)" stroke-width="3" />
        <line x1="60" y1="238" x2="420" y2="108" stroke="#c93b2b" stroke-width="1" stroke-dasharray="5 5" opacity="0.7" />
        <text x="316" y="156" transform="rotate(-20 316 156)" class="sc-map-street-strong">MARKET ST · MUNI CORRIDOR</text>

        <!-- Mission Creek water channel -->
        <path d="M 380 258 Q 435 234 548 214" fill="none" stroke="rgba(102,179,255,0.35)" stroke-width="8" stroke-linecap="round" />
        <text x="410" y="256" class="sc-map-water">MISSION CREEK / 4TH &amp; KING</text>

        <!-- Tenderloin Museum Landmark (398 Eddy St) -->
        <g transform="translate(308, 126)">
          <rect x="-3.5" y="-3.5" width="7" height="7" fill="#ffffff" opacity="0.85" />
          <text x="8" y="3" text-anchor="start" class="sc-map-landmark">Tenderloin Museum (398 Eddy)</text>
        </g>

        <!-- Interview Subject Pins -->
        ${pinsSvg}
      </svg>
      <div class="sc-map-caption">
        ${
          activeLoc
            ? `<strong>${esc(activeLoc.locationLabel)}</strong> · ${esc(activeLoc.neighborhood)} <span class="sc-map-coords">${esc(activeLoc.coordsLabel)}</span>`
            : `<strong>4 San Francisco Street Locations</strong> · Click any pin to inspect voice, face &amp; verbatim transcript`
        }
      </div>
    `;
  }

  function renderBiometricsPanel() {
    const panel = document.getElementById("demo-biometrics-panel");
    if (!panel) return;

    const speakersMap = biometrics.speakers || {};
    const speakerNames = Object.keys(speakersMap);
    const focusName =
      activeSpeakerFilter ||
      (activeExcerptId !== "ALL"
        ? locations.find((l) => l.id === activeExcerptId)?.speaker
        : activeLine?.speaker) ||
      speakerNames[0];
    const spk = speakersMap[focusName] || speakersMap[speakerNames[0]];

    const chipsHtml = speakerNames
      .map((name) => {
        const item = speakersMap[name];
        const isSel = name === focusName;
        return `
          <button type="button" class="sc-bio-chip ${isSel ? "is-active" : ""}" data-demo-speaker="${esc(name)}">
            <span class="sc-bio-dot ${item.onCamera ? "oncam" : "offcam"}"></span>
            <span>${esc(name)}</span>
          </button>
        `;
      })
      .join("");

    const cue = charMap[spk.name] || spk.character || spk.name.toUpperCase();
    const faceBadge = spk.face
      ? `<span class="sc-bio-badge face">✓ FaceNet 512-D · ${esc(spk.face.clusterId)} (On-Camera)</span>`
      : `<span class="sc-bio-badge offcam">Behind Camera · Audio Only</span>`;
    const voiceBadge = spk.voice
      ? `<span class="sc-bio-badge voice">✓ WeSpeaker 256-D · ${esc(spk.voice.clusterId)} (${spk.voice.verifiedTurns} verified turns)</span>`
      : "";

    panel.innerHTML = `
      <div class="sc-bio-chips" role="group" aria-label="Filter by recognized speaker">
        ${chipsHtml}
      </div>

      <div class="sc-bio-profile">
        <div class="sc-bio-top">
          <div>
            <div class="sc-bio-name">${esc(spk.name)}</div>
            <div class="sc-bio-loc">📍 ${esc(spk.locationLabel)}</div>
          </div>
          <div class="sc-bio-cue">
            <span>Screenplay Cue</span>
            <code>${esc(cue)}</code>
          </div>
        </div>

        <div class="sc-bio-badges">
          ${faceBadge}
          ${voiceBadge}
        </div>

        <p class="sc-bio-note">${esc(spk.fieldNote)}</p>

        <div class="sc-bio-foot">
          <span style="opacity:0.78;">Precipice Script Lab biometric architecture</span>
          <a href="${HOWISEE_INTERVIEWS_URL}">Full 41:43 uncut interviews → howisee.homes</a>
        </div>
      </div>
    `;
  }

  function renderDemoArchive() {
    const listEl = document.getElementById("demo-archive-list");
    const countEl = document.getElementById("demo-line-count");
    if (!listEl) return;

    const q = demoQuery.trim().toLowerCase();
    const filtered = allLines.filter((l) => {
      if (activeExcerptId !== "ALL" && l.excerptId !== activeExcerptId) return false;
      if (activeSpeakerFilter && l.speaker !== activeSpeakerFilter) return false;
      if (
        q &&
        !`${l.speaker} ${l.text} ${l.id} ${l.excerptLabel || ""} ${l.locationLabel || ""} ${l.faceId || ""} ${l.voiceId || ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = `${filtered.length} verified lines`;

    let lastExcerptId = "";
    listEl.innerHTML = filtered
      .map((l) => {
        const isAct = activeLine && activeLine.id === l.id;
        let groupHeader = "";
        if (l.excerptId && l.excerptId !== lastExcerptId) {
          lastExcerptId = l.excerptId;
          groupHeader = `
            <div class="sc-excerpt-divider">
              <span>📍 ${esc(l.excerptLabel || "Short Excerpt")}</span>
              <a href="${HOWISEE_INTERVIEWS_URL}">Full uncut →</a>
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
            <div class="sc-card-biometrics">
              ${l.faceId ? `<span class="sc-mini-tag face">${esc(l.faceId)}</span>` : `<span class="sc-mini-tag offcam">OFF-CAM</span>`}
              ${l.voiceId ? `<span class="sc-mini-tag voice">${esc(l.voiceId)}</span>` : ""}
              <span class="sc-mini-tag loc">${esc(l.locationLabel || "Tenderloin, SF")}</span>
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

    const locObj = locations.find((l) => l.id === activeExcerptId);
    const slugLoc = locObj ? locObj.slugline : "EXT. TENDERLOIN STREET - NIGHT";

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
    const cue = charMap[activeLine.speaker] || activeLine.speaker.toUpperCase();
    const bioTags = `${activeLine.faceId ? `${activeLine.faceId} · ` : "OFF-CAM · "}${activeLine.voiceId || "VOICE"} · ${activeLine.locationLabel || "Tenderloin, SF"}`;

    box.innerHTML = `
      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#ff9f93;margin-bottom:3px;">
        ${esc(activeLine.excerptLabel || "HOW I SEE · Short Excerpt")}
      </div>
      <div style="font-weight:700;font-size:13.5px;color:#f5f5f7;margin-bottom:2px;">
        ${esc(activeLine.speaker)} → <span style="color:#d4d8e2;">${esc(cue)}</span> · <span style="font-family:var(--mono);color:#9ba1b0;">${esc(fmtTc(activeLine.seconds))}</span>
      </div>
      <div style="font-family:var(--mono);font-size:10.5px;color:#6ee7b7;margin-bottom:4px;">
        ✓ ${esc(bioTags)}
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
        <a href="${HOWISEE_INTERVIEWS_URL}" style="color:#f5f5f7;font-weight:600;text-decoration:underline;">Full uncut interviews → howisee.homes</a>
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
    renderSocialMap();
    renderBiometricsPanel();
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

  function selectExcerptLocation(excerptId) {
    activeExcerptId = excerptId;
    activeSpeakerFilter = "";
    const firstInLoc =
      excerptId === "ALL"
        ? allLines.find((l) => l.speaker.includes("Shelter")) || allLines[0]
        : allLines.find((l) => l.excerptId === excerptId && l.onCamera) ||
          allLines.find((l) => l.excerptId === excerptId);
    renderDemoTabs();
    renderSocialMap();
    renderBiometricsPanel();
    renderDemoArchive();
    renderDemoPaper();
    if (firstInLoc) playDemoLine(firstInLoc, false);
    window.SLAnalytics?.track("preview_location_selected", { excerptId });
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
                st.textContent = "Playing excerpt";
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
  renderSocialMap();
  renderBiometricsPanel();
  renderDemoArchive();
  renderDemoPaper();
  renderDemoInspector(false);
  bootDemoPlayer();

  // Demo interactions
  document.getElementById("live-preview")?.addEventListener("click", (e) => {
    const exBtn = e.target.closest("[data-demo-excerpt]");
    if (exBtn) {
      selectExcerptLocation(exBtn.dataset.demoExcerpt);
      return;
    }

    const pinBtn = e.target.closest("[data-demo-map-pin]");
    if (pinBtn) {
      selectExcerptLocation(pinBtn.dataset.demoMapPin);
      return;
    }

    const spkBtn = e.target.closest("[data-demo-speaker]");
    if (spkBtn) {
      const name = spkBtn.dataset.demoSpeaker;
      const spkObj = biometrics.speakers?.[name];
      activeSpeakerFilter = activeSpeakerFilter === name ? "" : name;
      if (activeSpeakerFilter && spkObj && spkObj.excerptId && spkObj.excerptId !== "all") {
        activeExcerptId = spkObj.excerptId;
      } else if (!activeSpeakerFilter) {
        activeExcerptId = "ALL";
      }
      const firstLine = allLines.find((l) => l.speaker === name) || allLines[0];
      renderDemoTabs();
      renderSocialMap();
      renderBiometricsPanel();
      renderDemoArchive();
      renderDemoPaper();
      if (firstLine) playDemoLine(firstLine, false);
      window.SLAnalytics?.track("preview_speaker_selected", { speaker: name });
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
