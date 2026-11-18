/**
 * 220 Lab · Film Script Lab — Universal YouTube-to-Screenplay Workbench (scripts/studio.js)
 *
 * Generalized from 220 Studio's PRECIPICE Script Lab to work with ANY YouTube video:
 * - Server-enforced 220 Lab Approval / Invite / Stripe Session Gate
 * - Live Any-YouTube-URL edge caption ingestion + .SRT / .VTT / Whisper JSON / Text importer
 * - Permanent SHA-1 `SRC-` provenance IDs (`SRC-` + sha1(`${youtubeId}|${seconds}|${speaker}|${norm}`)[:10])
 * - 4 unmistakable dialogue modes: ORIGINAL, ADAPTED, AI SUGGESTION, WRITTEN
 * - Live Speaker -> Screenplay Character mapping across all scenes
 * - Synced YouTube IFrame Monitor + Director's Table per scene
 * - Portable `.scriptlab.json` (backward-compatible with `precipice.scriptlab`), `.fountain`, 12pt PDF & E&O CSV
 */
(function () {
  "use strict";

  const CFG = window.SCRIPTLAB_CONFIG || {};
  const API_BASE = String(CFG.WORKER_URL || "").replace(/\/$/, "");
  const STARTER = window.SCRIPTLAB_STARTER_DATA || {
    themes: [],
    defaultCharacterMap: {},
    sources: [],
    lines: [],
  };

  const SESSION_KEY = "scriptlab-session-v1";
  const STORAGE_KEY = "220lab-film-script-lab-v2";
  const THEME_STORAGE_KEY = "scriptlab-studio-theme";

  const INT_EXT_OPTIONS = ["INT.", "EXT.", "INT./EXT."];
  const TIME_OPTIONS = ["NIGHT", "DAY", "DAWN", "DUSK", "CONTINUOUS"];
  const PURPOSES = ["Introduction", "Conflict", "Revelation", "Transition", "Climax"];
  const STATUSES = ["Draft", "Workshop", "Ready to Shoot", "Shot"];
  const MODE_LABELS = {
    ORIGINAL: "ORIGINAL",
    ADAPTED: "ADAPTED",
    AI_SUGGESTION: "AI SUGGESTION",
    WRITTEN: "WRITTEN",
  };

  const THEME_PATTERNS = [
    ["power", /\b(power|powerful|control|authority|boss|rule|ruler|system|empire|command|president)\b/i],
    ["family", /\b(family|families|father|dad|mother|mom|parent|parents|child|children|kid|kids|son|daughter|brother|sister|husband|wife|marriage|home)\b/i],
    ["politics", /\b(politics|political|government|president|state|law|rights|election|vote|democracy|protest|policy|country|nation|war|border)\b/i],
    ["conflict", /\b(fight|fighting|fought|argument|battle|against|enemy|attack|threat|crisis|clash|confront|betray|lie|lied|lying)\b/i],
    ["faith", /\b(faith|god|soul|spirit|sacred|pray|prayer|heaven|hell|believe|belief|miracle|destiny|fate|karma|grace)\b/i],
    ["mortality", /\b(death|dead|die|died|dying|kill|killed|cancer|funeral|grave|mortal|mortality|grief|loss|lost|time|final)\b/i],
    ["money", /\b(money|cash|dollar|dollars|billion|million|afford|cost|budget|wealth|rich|poor|pay|paid|price|business|company|market|sell)\b/i],
    ["fear", /\b(fear|afraid|scared|terrified|panic|anxious|worry|danger|risk|trap|trapped|survive|survival|escape|alone)\b/i],
    ["love", /\b(love|loved|loving|heart|romance|desire|care|compassion|kindness|trust|friend|friendship|passion|tender|forgive)\b/i],
    ["identity", /\b(identity|who am i|myself|self|name|voice|stranger|outsider|authentic|real|person|human|generation|youth)\b/i],
    ["art", /\b(art|artist|film|filmmaking|movie|cinema|camera|director|actor|scene|story|stories|write|writing|music|design|create|craft)\b/i],
    ["truth", /\b(truth|honest|honesty|fact|proof|evidence|secret|reveal|admit|question|answer|memory|remember|know|knew)\b/i],
  ];

  const ALL_THEMES = THEME_PATTERNS.map(([n]) => n);

  const gateEl = document.getElementById("studio-gate");
  const root = document.getElementById("scriptlab");
  const ytModal = document.getElementById("sl-youtube-modal");

  let activeSession = null; // { token, email, name, tier }
  let studioBooted = false;

  // Apply studio light/dark theme
  const initStudioTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  document.documentElement.setAttribute("data-studio-theme", initStudioTheme);

  // ---------- Helpers ----------
  function esc(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function stripEditorBrackets(str) {
    return String(str ?? "")
      .replace(/\s*\[[^\]]*\]/g, "")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function countSpokenWords(lineOrText) {
    if (lineOrText && typeof lineOrText === "object" && typeof lineOrText.wordCount === "number") {
      return lineOrText.wordCount;
    }
    const txt = typeof lineOrText === "string" ? lineOrText : (lineOrText && lineOrText.text) || "";
    const clean = stripEditorBrackets(txt);
    if (!clean) return 0;
    return clean.split(/\s+/).filter((tok) => /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]/.test(tok)).length;
  }

  function detectThemes(text) {
    return THEME_PATTERNS.filter(([, rx]) => rx.test(text)).map(([n]) => n);
  }

  async function computeSrcId(videoId, seconds, speaker, text) {
    const norm = String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, " ");
    const msg = new TextEncoder().encode(`${videoId}|${seconds}|${speaker}|${norm}`);
    const hashBuf = await crypto.subtle.digest("SHA-1", msg);
    const hex = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `SRC-${hex.slice(0, 10)}`;
  }

  function extractYouTubeId(input) {
    const s = String(input || "").trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (host === "youtu.be") {
        const id = u.pathname.split("/").filter(Boolean)[0] || "";
        if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
      }
      if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
        const v = u.searchParams.get("v");
        if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0])) {
          if (/^[A-Za-z0-9_-]{11}$/.test(parts[1])) return parts[1];
        }
      }
    } catch {}
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : "";
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function fmtTc(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function ytLink(youtubeId, seconds) {
    return `https://youtu.be/${encodeURIComponent(youtubeId)}?t=${Math.max(0, Math.floor(Number(seconds) || 0))}s`;
  }

  function slugify(str) {
    return (
      String(str || "220lab-screenplay")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "220lab-screenplay"
    );
  }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  // ==========================================================================
  // PART 1: APPROVAL GATE & SESSION VERIFICATION
  // ==========================================================================
  function wireGateUi() {
    document.querySelectorAll("[data-gate-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.gateTab;
        document.querySelectorAll("[data-gate-tab]").forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll("[data-gate-pane]").forEach((p) => {
          p.hidden = p.dataset.gatePane !== tab;
        });
      });
    });

    const savedEmail = localStorage.getItem("scriptlab-applicant-email") || "";
    if (savedEmail) {
      const ge = document.getElementById("gate-email");
      if (ge && !ge.value) ge.value = savedEmail;
    }

    // Sign In Form
    document.getElementById("gate-signin-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("gate-signin-btn");
      const msg = document.getElementById("gate-signin-msg");
      const email = document.getElementById("gate-email")?.value.trim() || "";
      const code = document.getElementById("gate-code")?.value.trim().toUpperCase() || "";

      if (!email && !code) {
        msg.hidden = false;
        msg.className = "status-banner error";
        msg.textContent = "Enter your approved email address or an SL- invite code.";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Verifying with 220 Lab…";
      msg.hidden = true;

      try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, invite_code: code }),
        });
        const data = await res.json();

        if (res.ok && data.authorized && data.token) {
          const sess = {
            token: data.token,
            email: data.session?.email || email,
            name: data.session?.name || "",
            tier: data.session?.tier || "beta",
            expiresAt: data.expires_at,
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
          window.SLAnalytics?.identify(sess.email, { tier: sess.tier });
          window.SLAnalytics?.track("studio_unlocked", {
            method: code ? "invite_code" : "approved_email",
            tier: sess.tier,
          });
          unlockStudio(sess);
          return;
        }

        msg.hidden = false;
        msg.className = data.status === "pending" ? "status-banner pending" : "status-banner error";
        msg.textContent = data.error || "Not yet approved. Switch to Join Waitlist to request access.";
      } catch (err) {
        msg.hidden = false;
        msg.className = "status-banner error";
        msg.textContent = "Network error verifying approval. Please try again.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Verify Approval & Enter Studio →";
      }
    });

    // Waitlist Apply Form inside Gate
    document.getElementById("gate-apply-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("gate-apply-btn");
      const msg = document.getElementById("gate-apply-msg");
      const name = document.getElementById("gate-apply-name")?.value.trim() || "";
      const email = document.getElementById("gate-apply-email")?.value.trim() || "";
      const role = document.getElementById("gate-apply-role")?.value || "";
      const yt = document.getElementById("gate-apply-yt")?.value.trim() || "";

      btn.disabled = true;
      btn.textContent = "Submitting…";
      msg.hidden = true;

      try {
        const res = await fetch(`${API_BASE}/api/waitlist/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, role, youtube_url: yt, plan_interest: "beta" }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          localStorage.setItem("scriptlab-applicant-email", email.toLowerCase());
          window.SLAnalytics?.track("waitlist_submitted", { role, location: "studio_gate" });

          if (data.status === "approved" && data.token) {
            const sess = {
              token: data.token,
              email: data.email,
              name: data.name,
              tier: data.tier || "beta",
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
            unlockStudio(sess);
            return;
          }

          msg.hidden = false;
          msg.className = "status-banner pending";
          msg.innerHTML = `<strong>Queue #${esc(data.queue_number || 1)}:</strong> Application received for <code>${esc(data.email)}</code>. Once approved by 220 Lab, sign in on the first tab.`;
        } else {
          msg.hidden = false;
          msg.className = "status-banner error";
          msg.textContent = data.error || "Unable to submit waitlist request.";
        }
      } catch {
        msg.hidden = false;
        msg.className = "status-banner error";
        msg.textContent = "Network error submitting waitlist request.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Request Studio Approval";
      }
    });

    // Founding Pass Checkout inside Gate
    document.getElementById("gate-buy-lifetime")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const msg = document.getElementById("gate-pass-msg");
      const link = CFG.plans?.lifetime?.paymentLink || "";

      window.SLAnalytics?.track("checkout_clicked", { tier: "lifetime", location: "studio_gate" });

      if (link && link.startsWith("https://buy.stripe.com/")) {
        window.location.href = link;
        return;
      }

      btn.disabled = true;
      btn.textContent = "Connecting to Stripe…";
      msg.hidden = true;

      try {
        const res = await fetch(`${API_BASE}/api/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier: "lifetime",
            email: document.getElementById("gate-email")?.value.trim() || "",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
        msg.hidden = false;
        msg.className = "status-banner pending";
        msg.textContent =
          data.error ||
          "Stripe live checkout is completing merchant binding. Join the Waitlist tab for priority Founding access.";
      } catch {
        msg.hidden = false;
        msg.className = "status-banner error";
        msg.textContent = "Could not reach checkout endpoint.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Checkout with Stripe — $249";
      }
    });
  }

  async function verifyInitialAccess() {
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get("session_id") || "";
    const urlEmail = params.get("email") || "";
    const urlCode = params.get("code") || params.get("invite") || "";
    const urlIngest = params.get("ingest") || "";

    if (urlIngest) {
      sessionStorage.setItem("scriptlab-pending-youtube", urlIngest);
    }

    // 1. Magic approval link or Stripe checkout return
    if (urlSessionId || urlCode || urlEmail) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stripe_session_id: urlSessionId || undefined,
            email: urlEmail || undefined,
            invite_code: urlCode || undefined,
          }),
        });
        const data = await res.json();
        if (res.ok && data.authorized && data.token) {
          const sess = {
            token: data.token,
            email: data.session?.email || urlEmail,
            name: data.session?.name || "",
            tier: data.session?.tier || "beta",
            expiresAt: data.expires_at,
          };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
          window.history.replaceState({}, "", window.location.pathname);
          window.SLAnalytics?.track("studio_unlocked", {
            method: urlSessionId ? "stripe" : "magic_link",
            tier: sess.tier,
          });
          unlockStudio(sess);
          return;
        }
      } catch {}
    }

    // 2. Stored session token
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
      if (saved && saved.token) {
        const res = await fetch(`${API_BASE}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: saved.token }),
        });
        const data = await res.json();
        if (res.ok && data.authorized) {
          unlockStudio(saved);
          return;
        }
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {}

    // Show gate
    gateEl.hidden = false;
    root.hidden = true;
  }

  function unlockStudio(sess) {
    activeSession = sess;
    gateEl.hidden = true;
    root.hidden = false;
    if (!studioBooted) {
      studioBooted = true;
      bootWorkbench();
    }
    const pendingYt = sessionStorage.getItem("scriptlab-pending-youtube") || "";
    if (pendingYt) {
      sessionStorage.removeItem("scriptlab-pending-youtube");
      openYouTubeModal(pendingYt);
    }
  }

  // ==========================================================================
  // PART 2: UNIVERSAL FILM SCRIPT LAB WORKBENCH
  // ==========================================================================
  let state = null;
  let filterQuery = "";
  let filterSource = "ALL";
  let filterSpeaker = "ALL";
  let filterTheme = "ALL";
  let filterUnusedOnly = false;
  let filterVerifiedOnly = false;
  let filterHideShort = true;
  let archiveRenderLimit = 90;
  let selectedArchiveLineId = null;
  let activeMonitorLine = null;
  let mobileTab = "script";
  let charDrawerOpen = false;
  let sourcesDrawerOpen = false;

  let ytPlayer = null;
  let ytReady = false;
  let pendingPlay = null;

  function getActiveSources() {
    const map = new Map();
    if (state.includeStarterSources !== false) {
      (STARTER.sources || []).forEach((s) => map.set(s.id, s));
    }
    (state.customSources || []).forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }

  function getActiveLines() {
    const list = [];
    const seen = new Set();
    if (state.includeStarterSources !== false) {
      (STARTER.lines || []).forEach((l) => {
        if (!seen.has(l.id)) {
          seen.add(l.id);
          list.push(l);
        }
      });
    }
    (state.customLines || []).forEach((l) => {
      if (!seen.has(l.id)) {
        seen.add(l.id);
        list.push(l);
      }
    });
    return list;
  }

  function resolveArchiveLine(srcId) {
    if (!srcId) return null;
    const all = getActiveLines();
    return all.find((l) => l.id === srcId) || null;
  }

  function sourceShort(sid) {
    const s = getActiveSources().find((x) => x.id === sid);
    return s ? s.shortLabel || s.title : sid || "YouTube";
  }

  function makeOriginalElementFromLine(line) {
    return {
      id: uid("el"),
      type: "dialogue",
      mode: "ORIGINAL",
      srcId: line.id,
      speaker: line.speaker,
      speakerVerified: Boolean(line.speakerVerified),
      character: "",
      parenthetical: "",
      text: line.text,
      originalText: line.text,
      workshopId: line.workshopId,
      youtubeId: line.youtubeId,
      seconds: line.seconds,
      showOriginal: false,
    };
  }

  function createBlankScene(overrides) {
    return Object.assign(
      {
        id: uid("sc"),
        intExt: "INT.",
        location: "SCREENING ROOM",
        timeOfDay: "NIGHT",
        purpose: "Conflict",
        status: "Draft",
        notes: "",
        elements: [],
      },
      overrides || {}
    );
  }

  function buildStarterState() {
    const charMap = Object.assign({}, STARTER.defaultCharacterMap || {});
    const starterLines = STARTER.lines || [];
    const lShelter = starterLines.find((l) => l.youtubeId === "QgwRsArIVKI" && l.speaker.includes("Shelter")) || starterLines[0];
    const lMilo = starterLines.find((l) => l.youtubeId === "QgwRsArIVKI" && l.speaker.includes("Milo")) || starterLines[1];

    const sc1Els = [
      {
        id: uid("el"),
        type: "action",
        text: "San Francisco’s Tenderloin after dark. Black-and-white handheld camera at eye level along Taylor Street and the Muni tracks. Wind rattles a handmade sidewalk shelter.",
      },
    ];
    if (lShelter) sc1Els.push(makeOriginalElementFromLine(lShelter));
    if (lMilo) sc1Els.push(makeOriginalElementFromLine(lMilo));

    const sc1 = createBlankScene({
      intExt: "EXT.",
      location: "TENDERLOIN STREET",
      timeOfDay: "NIGHT",
      purpose: "Introduction",
      status: "Workshop",
      notes: "Built from short excerpts of HOW I SEE (howisee.homes). Click '+ Add YouTube Video' in the left Archive to ingest any public or unlisted YouTube video.",
      elements: sc1Els,
    });

    return {
      format: "220lab.scriptlab",
      version: 2,
      title: "UNTITLED 220 LAB SCREENPLAY",
      author: activeSession?.name || "220 Lab Filmmaker",
      includeStarterSources: true,
      customSources: [],
      customLines: [],
      characterMap: charMap,
      activeSceneId: sc1.id,
      scenes: [sc1],
    };
  }

  function sanitizeLoadedState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.scenes)) return null;
    const includeStarterSources =
      raw.includeStarterSources !== undefined ? Boolean(raw.includeStarterSources) : true;
    const customSources = Array.isArray(raw.customSources) ? raw.customSources : [];
    const customLines = Array.isArray(raw.customLines) ? raw.customLines : [];

    // Build lookup across starter + custom lines for provenance enforcement
    const tempMap = new Map();
    if (includeStarterSources) {
      (STARTER.lines || []).forEach((l) => tempMap.set(l.id, l));
    }
    customLines.forEach((l) => tempMap.set(l.id, l));

    const charMap = Object.assign(
      {},
      includeStarterSources ? STARTER.defaultCharacterMap || {} : {},
      raw.characterMap || {}
    );

    const scenes = raw.scenes.map((sc) => {
      // Support legacy precipice-studio locationPreset + customLocation
      const loc = sc.location
        ? String(sc.location).toUpperCase()
        : sc.locationPreset === "Custom"
          ? String(sc.customLocation || "LOCATION").toUpperCase()
          : String(sc.locationPreset || "LOCATION").toUpperCase();

      const cleanEls = (Array.isArray(sc.elements) ? sc.elements : []).map((el) => {
        if (el.type === "action") {
          return { id: el.id || uid("el"), type: "action", text: String(el.text ?? "") };
        }
        let mode = ["ORIGINAL", "ADAPTED", "AI_SUGGESTION", "WRITTEN"].includes(el.mode)
          ? el.mode
          : "WRITTEN";
        const srcLine = el.srcId ? tempMap.get(el.srcId) || null : null;

        if ((mode === "ORIGINAL" || mode === "ADAPTED") && !srcLine && !el.originalText) {
          mode = "WRITTEN";
        }
        const origText = srcLine ? srcLine.text : String(el.originalText ?? "");
        const speaker = srcLine ? srcLine.speaker : el.speaker || "";
        const speakerVerified = srcLine ? Boolean(srcLine.speakerVerified) : Boolean(el.speakerVerified);
        const workshopId = srcLine ? srcLine.workshopId : el.workshopId || "";
        const youtubeId = srcLine ? srcLine.youtubeId : el.youtubeId || "";
        const seconds = srcLine ? srcLine.seconds : Number(el.seconds || 0);
        const finalText = mode === "ORIGINAL" ? origText : String(el.text ?? origText);

        return {
          id: el.id || uid("el"),
          type: "dialogue",
          mode,
          srcId: mode === "ORIGINAL" || mode === "ADAPTED" ? el.srcId || null : null,
          speaker: mode === "AI_SUGGESTION" ? "" : speaker,
          speakerVerified: mode === "ORIGINAL" || mode === "ADAPTED" ? speakerVerified : false,
          character: String(el.character || ""),
          parenthetical: String(el.parenthetical || ""),
          text: finalText,
          originalText: mode === "ORIGINAL" || mode === "ADAPTED" ? origText : "",
          workshopId: mode === "ORIGINAL" || mode === "ADAPTED" ? workshopId : "",
          youtubeId: mode === "ORIGINAL" || mode === "ADAPTED" ? youtubeId : "",
          seconds: mode === "ORIGINAL" || mode === "ADAPTED" ? seconds : 0,
          showOriginal: Boolean(el.showOriginal),
        };
      });

      return createBlankScene({
        id: sc.id || uid("sc"),
        intExt: INT_EXT_OPTIONS.includes(sc.intExt) ? sc.intExt : "INT.",
        location: loc || "LOCATION",
        timeOfDay: TIME_OPTIONS.includes(sc.timeOfDay) ? sc.timeOfDay : "NIGHT",
        purpose: PURPOSES.includes(sc.purpose) ? sc.purpose : "Conflict",
        status: STATUSES.includes(sc.status) ? sc.status : "Draft",
        notes: String(sc.notes || ""),
        elements: cleanEls,
      });
    });

    if (!scenes.length) scenes.push(createBlankScene());
    const activeSceneId = scenes.some((s) => s.id === raw.activeSceneId) ? raw.activeSceneId : scenes[0].id;

    return {
      format: "220lab.scriptlab",
      version: 2,
      title: String(raw.title || "UNTITLED 220 LAB SCREENPLAY"),
      author: String(raw.author || activeSession?.name || "220 Lab Filmmaker"),
      includeStarterSources,
      customSources,
      customLines,
      characterMap: charMap,
      activeSceneId,
      scenes,
    };
  }

  function saveState() {
    try {
      const payload = Object.assign({}, state, { savedAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const badge = document.getElementById("sl-autosave-status");
      if (badge) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        badge.textContent = `Autosaved · ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }
    } catch {
      const badge = document.getElementById("sl-autosave-status");
      if (badge) badge.textContent = "Storage full — use Save File";
    }
  }

  function resolveCharacterName(el) {
    if (el.speaker && state.characterMap[el.speaker]) {
      return state.characterMap[el.speaker].toUpperCase();
    }
    if (el.character && el.character.trim()) {
      return el.character.trim().toUpperCase();
    }
    if (el.speaker) {
      return el.speaker.toUpperCase();
    }
    return "CHARACTER";
  }

  function formatSlugline(sc) {
    const loc = (sc.location || "LOCATION").trim().toUpperCase();
    return `${sc.intExt} ${loc} - ${sc.timeOfDay}`;
  }

  function getActiveScene() {
    return state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0];
  }

  function computeUsageMap() {
    const map = new Map();
    state.scenes.forEach((sc, idx) => {
      const shortLoc = (sc.location || "SCENE").trim().toUpperCase();
      sc.elements.forEach((el) => {
        if (el.type === "dialogue" && el.srcId) {
          if (!map.has(el.srcId)) map.set(el.srcId, []);
          const arr = map.get(el.srcId);
          if (!arr.some((x) => x.sceneId === sc.id)) {
            arr.push({ sceneNum: idx + 1, sceneId: sc.id, shortLoc, mode: el.mode });
          }
        }
      });
    });
    return map;
  }

  // ---------- Shell & Rendering ----------
  function mountShell() {
    const userLabel = activeSession?.email ? activeSession.email.split("@")[0] : "Approved";
    const tierLabel = (activeSession?.tier || "beta").toUpperCase();

    root.innerHTML = `
      <header class="sl-topbar">
        <div class="sl-brand-cluster">
          <a href="index.html" class="sl-home-link" title="Back to scriptlab.cloud overview">
            <span class="sl-tally-dot" aria-hidden="true"></span>
            <span>220 Lab</span>
          </a>
          <span class="sl-kicker-tag">Film Script Lab</span>
          <input type="text" id="sl-script-title" class="sl-title-input" value="${esc(state.title)}" aria-label="Screenplay title" />
          <span class="sl-autosave" id="sl-autosave-status">Autosaved</span>
        </div>

        <div class="sl-actions-cluster">
          <button type="button" class="sl-btn apple-blue" id="sl-btn-add-yt" title="Ingest any public or unlisted YouTube video">
            + Add YouTube Video
          </button>
          <button type="button" class="sl-btn" id="sl-btn-sources" title="Manage YouTube video sources in this project">
            Videos (<span id="sl-sources-count">0</span>)
          </button>
          <button type="button" class="sl-btn" id="sl-btn-charmap" title="Map real speaker names to screenplay characters">
            Character Map
          </button>
          <button type="button" class="sl-btn primary" id="sl-btn-new-scene-top" title="Create a new scene (⌘⇧S)">
            + Scene <kbd>⌘⇧S</kbd>
          </button>
          <button type="button" class="sl-btn" id="sl-btn-open-file" title="Open a .scriptlab.json bundle">
            Open
          </button>
          <input type="file" id="sl-file-input" accept=".json,.scriptlab.json" hidden />
          <button type="button" class="sl-btn" id="sl-btn-save-file" title="Download portable .scriptlab.json bundle">
            Save
          </button>
          <button type="button" class="sl-btn" id="sl-btn-fountain" title="Export Fountain screenplay (⌘E)">
            Fountain <kbd>⌘E</kbd>
          </button>
          <button type="button" class="sl-btn" id="sl-btn-print" title="Print or save US Letter 12pt Courier Prime PDF">
            PDF
          </button>
          <button type="button" class="sl-btn" id="sl-btn-csv" title="Export E&O Source Provenance CSV">
            E&amp;O CSV
          </button>
          <button type="button" class="sl-btn subtle" id="sl-btn-blank" title="Start a clean blank screenplay project">
            New Blank
          </button>
          <button type="button" class="sl-btn subtle" id="sl-btn-theme" title="Toggle Apple Studio Light / 220 Dark Bay">
            ◐
          </button>
          <span class="sl-user-pill" title="Signed in as ${esc(activeSession?.email || "")}">
            ${esc(userLabel)} · ${esc(tierLabel)}
          </span>
          <button type="button" class="sl-btn subtle" id="sl-btn-signout" title="Sign out of Studio">
            Sign Out
          </button>
        </div>
      </header>

      <!-- Video Sources Manager Drawer -->
      <div class="sl-drawer" id="sl-sources-drawer" hidden>
        <div class="sl-drawer-head">
          <div>
            <h3>Project YouTube Video Sources</h3>
            <p>Click any source to filter the Archive, or add unlimited public/unlisted YouTube links and <code>.srt</code>/<code>.vtt</code> transcripts.</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="sl-btn apple-blue" id="sl-drawer-add-yt">+ Add YouTube Video</button>
            <button type="button" class="sl-btn subtle" id="sl-close-sources">Done</button>
          </div>
        </div>
        <div class="sl-sources-grid" id="sl-sources-grid"></div>
      </div>

      <!-- Character Mapping Drawer -->
      <div class="sl-drawer" id="sl-charmap-drawer" hidden>
        <div class="sl-drawer-head">
          <div>
            <h3>Speaker → Screenplay Character Mapping</h3>
            <p>Renaming any speaker (e.g. <code>Steve Jobs → JOBS</code>) immediately updates every scene and print mirror across your script.</p>
          </div>
          <button type="button" class="sl-btn subtle" id="sl-close-charmap">Done</button>
        </div>
        <div class="sl-charmap-grid" id="sl-charmap-grid"></div>
      </div>

      <div class="sl-shortcuts-bar" aria-label="Studio keyboard shortcuts">
        <span><kbd>⌘K</kbd> Search Archive</span>
        <span><kbd>⌘↵</kbd> Insert Selected Line</span>
        <span><kbd>⌘⇧S</kbd> New Scene</span>
        <span><kbd>⌘E</kbd> Export Fountain</span>
        <span><kbd>Space</kbd> Play / Pause YouTube</span>
        <span style="margin-left:auto;">Drag any <code>SRC-</code> card onto a Courier Prime page</span>
      </div>

      <div class="sl-mobile-tabs" role="tablist">
        <button type="button" role="tab" class="sl-mobile-tab" data-sl-tab="archive">Archive</button>
        <button type="button" role="tab" class="sl-mobile-tab on" data-sl-tab="script">Script</button>
        <button type="button" role="tab" class="sl-mobile-tab" data-sl-tab="film">Monitor</button>
      </div>

      <div class="sl-workbench" id="sl-workbench" data-mobile-tab="${mobileTab}">
        <!-- LEFT: YOUTUBE DIALOGUE ARCHIVE -->
        <aside class="sl-col sl-col-archive" aria-label="YouTube Dialogue Archive">
          <div class="sl-col-head">
            <h2>YouTube Dialogue Archive</h2>
            <span class="sl-col-count" id="sl-archive-count">0 lines</span>
          </div>

          <div class="sl-archive-controls">
            <div class="sl-search-box">
              <input type="search" id="sl-search" placeholder="Search spoken words, speaker, SRC-id…" autocomplete="off" />
              <button type="button" class="sl-search-clear" id="sl-search-clear" title="Clear search" hidden>×</button>
              <kbd class="sl-search-kbd">⌘K</kbd>
            </div>

            <div class="sl-filter-grid">
              <select id="sl-filter-source" class="sl-select" aria-label="Filter by YouTube video"></select>
              <select id="sl-filter-speaker" class="sl-select" aria-label="Filter by speaker"></select>
            </div>

            <div>
              <select id="sl-filter-theme" class="sl-select" aria-label="Filter by dramatic theme"></select>
            </div>

            <div class="sl-filter-toggles">
              <label class="sl-unused-toggle" title="Hide filler lines of 3 spoken words or fewer">
                <input type="checkbox" id="sl-hide-short" ${filterHideShort ? "checked" : ""} />
                <span>Hide short</span>
              </label>
              <label class="sl-unused-toggle" title="Show only verified speaker lines">
                <input type="checkbox" id="sl-verified-only" ${filterVerifiedOnly ? "checked" : ""} />
                <span>Verified only</span>
              </label>
              <label class="sl-unused-toggle" title="Show only lines not yet placed in screenplay">
                <input type="checkbox" id="sl-unused-only" ${filterUnusedOnly ? "checked" : ""} />
                <span>Unused only</span>
              </label>
            </div>
          </div>

          <div class="sl-speaker-profile" id="sl-speaker-profile" hidden></div>
          <div class="sl-archive-list" id="sl-archive-list" role="listbox" aria-label="Verbatim lines"></div>
        </aside>

        <!-- CENTER: COURIER PRIME SCREENPLAY -->
        <section class="sl-col sl-col-script" aria-label="Screenplay Editor">
          <div class="sl-script-toolbar">
            <div class="sl-mode-legend">
              <span class="sl-legend-chip orig">ORIGINAL · Verbatim</span>
              <span class="sl-legend-chip adapt">ADAPTED · Linked</span>
              <span class="sl-legend-chip ai">AI SUGGESTION</span>
              <span class="sl-legend-chip written">WRITTEN</span>
            </div>
            <span class="sl-col-count" id="sl-script-summary"></span>
          </div>

          <div class="sl-script-scroll" id="sl-script-scroll"></div>
        </section>

        <!-- RIGHT: YOUTUBE MONITOR & DIRECTOR'S TABLE -->
        <aside class="sl-col sl-col-film" aria-label="YouTube Source Monitor & Director's Table">
          <div class="sl-col-head">
            <h2>YouTube Monitor &amp; Director’s Table</h2>
            <span class="sl-col-count" id="sl-player-state-badge">Ready</span>
          </div>

          <div class="sl-film-scroll">
            <div>
              <div class="sl-player-frame">
                <div id="sl-yt-player"></div>
              </div>
              <div class="sl-film-transport">
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  <button type="button" class="sl-mini-btn" id="sl-film-playpause">▶ Play / Pause</button>
                  <button type="button" class="sl-mini-btn" id="sl-film-replay">↺ Replay</button>
                  <button type="button" class="sl-mini-btn" id="sl-film-back5">-5s</button>
                  <button type="button" class="sl-mini-btn" id="sl-film-fwd5">+5s</button>
                </div>
                <button type="button" class="sl-mini-btn add" id="sl-film-add-active">+ Add Line</button>
              </div>
            </div>

            <div class="sl-source-inspector" id="sl-source-inspector"></div>
            <div class="sl-directors-table" id="sl-directors-table"></div>
          </div>
        </aside>
      </div>
    `;
  }

  function renderFilterDropdowns() {
    const sources = getActiveSources();
    const lines = getActiveLines();

    const cntBadge = document.getElementById("sl-sources-count");
    if (cntBadge) cntBadge.textContent = String(sources.length);

    const srcSel = document.getElementById("sl-filter-source");
    if (srcSel) {
      if (filterSource !== "ALL" && !sources.some((s) => s.id === filterSource)) {
        filterSource = "ALL";
      }
      srcSel.innerHTML =
        `<option value="ALL">All Videos (${sources.length})</option>` +
        sources
          .map((s) => {
            const c = lines.filter((l) => l.workshopId === s.id).length;
            return `<option value="${esc(s.id)}" ${filterSource === s.id ? "selected" : ""}>${esc(s.shortLabel || s.title)} (${c})</option>`;
          })
          .join("");
    }

    const spkCounts = new Map();
    lines.forEach((l) => spkCounts.set(l.speaker, (spkCounts.get(l.speaker) || 0) + 1));
    const speakersSorted = Array.from(spkCounts.entries()).sort((a, b) => b[1] - a[1]);

    const spkSel = document.getElementById("sl-filter-speaker");
    if (spkSel) {
      if (filterSpeaker !== "ALL" && !spkCounts.has(filterSpeaker)) {
        filterSpeaker = "ALL";
      }
      spkSel.innerHTML =
        `<option value="ALL">All Speakers (${speakersSorted.length})</option>` +
        speakersSorted
          .map(
            ([spk, c]) =>
              `<option value="${esc(spk)}" ${filterSpeaker === spk ? "selected" : ""}>${esc(spk)} (${c})</option>`
          )
          .join("");
    }

    const themeCounts = new Map();
    ALL_THEMES.forEach((t) => themeCounts.set(t, 0));
    lines.forEach((l) => (l.themes || []).forEach((t) => themeCounts.set(t, (themeCounts.get(t) || 0) + 1)));

    const thSel = document.getElementById("sl-filter-theme");
    if (thSel) {
      thSel.innerHTML =
        `<option value="ALL">All Dramatic Themes (${ALL_THEMES.length})</option>` +
        ALL_THEMES.map(
          (t) =>
            `<option value="${esc(t)}" ${filterTheme === t ? "selected" : ""}>#${esc(t)} (${themeCounts.get(t) || 0})</option>`
        ).join("");
    }
  }

  function renderSourcesDrawer() {
    const drawer = document.getElementById("sl-sources-drawer");
    const grid = document.getElementById("sl-sources-grid");
    if (!drawer || !grid) return;
    drawer.hidden = !sourcesDrawerOpen;
    if (!sourcesDrawerOpen) return;

    const sources = getActiveSources();
    const lines = getActiveLines();

    if (!sources.length) {
      grid.innerHTML = `<div style="font-size:13px;color:var(--sl-muted);">No YouTube videos in this project yet. Click <strong>+ Add YouTube Video</strong> to start.</div>`;
      return;
    }

    grid.innerHTML = sources
      .map((s) => {
        const cnt = lines.filter((l) => l.workshopId === s.id).length;
        const isCustom = (state.customSources || []).some((cs) => cs.id === s.id);
        const thumb = s.thumbnailUrl || `https://i.ytimg.com/vi/${encodeURIComponent(s.youtubeId)}/hqdefault.jpg`;
        return `
          <div class="sl-source-tile">
            <img src="${esc(thumb)}" alt="" loading="lazy" />
            <div class="sl-source-tile-info">
              <div class="sl-source-tile-title" title="${esc(s.title)}">${esc(s.title)}</div>
              <div class="sl-source-tile-sub">${esc(s.author || "YouTube")} · ${cnt} lines · <code>${esc(s.youtubeId)}</code></div>
            </div>
            <div style="display:flex;gap:5px;">
              <button type="button" class="sl-mini-btn" data-Focus-Source="${esc(s.id)}">Filter</button>
              ${
                isCustom
                  ? `<button type="button" class="sl-mini-btn" data-Remove-Source="${esc(s.id)}" title="Remove custom video">×</button>`
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderCharMapDrawer() {
    const drawer = document.getElementById("sl-charmap-drawer");
    const grid = document.getElementById("sl-charmap-grid");
    if (!drawer || !grid) return;
    drawer.hidden = !charDrawerOpen;
    if (!charDrawerOpen) return;

    const speakers = [];
    getActiveLines().forEach((l) => {
      if (l.speaker && !speakers.includes(l.speaker)) speakers.push(l.speaker);
    });
    Object.keys(state.characterMap || {}).forEach((k) => {
      if (!speakers.includes(k)) speakers.push(k);
    });

    grid.innerHTML = speakers
      .map((spk) => {
        const mapped = state.characterMap[spk] || spk.toUpperCase();
        return `
          <div class="sl-charmap-item">
            <span class="sl-charmap-actor" title="${esc(spk)}">${esc(spk)}</span>
            <span class="sl-charmap-arrow">→</span>
            <input type="text" class="sl-charmap-input" data-charmap-speaker="${esc(spk)}" value="${esc(mapped)}" />
          </div>
        `;
      })
      .join("");
  }

  function renderSpeakerProfile() {
    const box = document.getElementById("sl-speaker-profile");
    if (!box) return;
    if (filterSpeaker === "ALL") {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }

    const lines = getActiveLines().filter((l) => l.speaker === filterSpeaker);
    let inScript = 0;
    state.scenes.forEach((sc) =>
      sc.elements.forEach((el) => {
        if (el.type === "dialogue" && el.speaker === filterSpeaker && (el.mode === "ORIGINAL" || el.mode === "ADAPTED")) {
          inScript++;
        }
      })
    );

    const charName = state.characterMap[filterSpeaker] || filterSpeaker.toUpperCase();
    box.hidden = false;
    box.innerHTML = `
      <div class="sl-sp-top">
        <span class="sl-sp-name">${esc(filterSpeaker)}</span>
        <label class="sl-sp-role">
          <span>Character →</span>
          <input type="text" data-charmap-speaker="${esc(filterSpeaker)}" value="${esc(charName)}" />
        </label>
      </div>
      <div class="sl-sp-stats">
        <span><strong>${lines.length}</strong> archive lines</span>
        <span><strong>${inScript}</strong> in screenplay</span>
      </div>
    `;
  }

  function highlightQuery(text, query) {
    const safe = esc(text);
    const cleanQ = (query || "").trim();
    if (!cleanQ || cleanQ.length < 2) return safe;
    const terms = cleanQ
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!terms.length) return safe;
    return safe.replace(new RegExp(`(${terms.join("|")})`, "gi"), "<mark>$1</mark>");
  }

  function renderOriginalHtmlWithBrackets(text, query) {
    return String(text ?? "")
      .split(/(\[[^\]]*\])/g)
      .map((part) => {
        if (!part) return "";
        if (part.startsWith("[") && part.endsWith("]")) {
          return `<span class="sl-editor-insertion" title="Editorial insertion — omitted in Fountain & PDF exports">${highlightQuery(part, query)}</span>`;
        }
        return highlightQuery(part, query);
      })
      .join("");
  }

  function getFilteredArchiveLines(usageMap) {
    const all = getActiveLines();
    const q = filterQuery.trim().toLowerCase();
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];

    return all.filter((l) => {
      if (filterSource !== "ALL" && l.workshopId !== filterSource) return false;
      if (filterSpeaker !== "ALL" && l.speaker !== filterSpeaker) return false;
      if (filterTheme !== "ALL" && !(l.themes || []).includes(filterTheme)) return false;
      if (filterUnusedOnly && usageMap.has(l.id)) return false;
      if (filterVerifiedOnly && !l.speakerVerified) return false;
      if (filterHideShort && countSpokenWords(l) <= 3) return false;
      if (terms.length) {
        const hay = `${l.id} ${l.speaker} ${state.characterMap[l.speaker] || ""} ${l.text} ${(l.themes || []).join(" ")} ${sourceShort(l.workshopId)}`.toLowerCase();
        for (const term of terms) {
          if (!hay.includes(term)) return false;
        }
      }
      return true;
    });
  }

  function renderArchive() {
    const usageMap = computeUsageMap();
    renderFilterDropdowns();
    renderSpeakerProfile();

    const all = getActiveLines();
    const matches = getFilteredArchiveLines(usageMap);
    const countEl = document.getElementById("sl-archive-count");
    if (countEl) {
      countEl.textContent = matches.length === all.length ? `${all.length} lines` : `${matches.length} of ${all.length}`;
    }

    const clearBtn = document.getElementById("sl-search-clear");
    if (clearBtn) clearBtn.hidden = !filterQuery;

    if (matches.length && !matches.some((m) => m.id === selectedArchiveLineId)) {
      selectedArchiveLineId = matches[0].id;
    }

    const listEl = document.getElementById("sl-archive-list");
    if (!listEl) return;

    if (!matches.length) {
      listEl.innerHTML = `
        <div style="padding:28px 14px;text-align:center;color:var(--sl-muted);font-size:13px;line-height:1.5;">
          No verbatim lines match your current filters.<br />
          <button type="button" class="sl-btn apple-blue" style="margin-top:12px;" data-open-yt-modal="1">+ Add Any YouTube Video</button>
        </div>
      `;
      return;
    }

    const slice = matches.slice(0, archiveRenderLimit);
    const cardsHtml = slice
      .map((l) => {
        const isSel = l.id === selectedArchiveLineId;
        const usages = usageMap.get(l.id);
        const mappedChar = state.characterMap[l.speaker] || "";
        const inferredHtml = !l.speakerVerified
          ? `<span class="sl-inferred-badge" title="Speaker inferred from channel or caption track">speaker inferred</span>`
          : "";
        const usageHtml =
          usages && usages.length
            ? `<button type="button" class="sl-usage-badge used" data-jump-scene="${esc(usages[0].sceneId)}">
                 Used · ${usages.map((u) => `Sc ${u.sceneNum}`).join(", ")}
               </button>`
            : `<span class="sl-usage-badge">Unused</span>`;

        const themesHtml = (l.themes || []).length
          ? `<div class="sl-lc-tags">
               ${l.themes.map((th) => `<button type="button" class="sl-theme-tag" data-pick-theme="${esc(th)}">#${esc(th)}</button>`).join("")}
             </div>`
          : "";

        return `
          <article class="sl-line-card ${isSel ? "selected" : ""}" role="option" aria-selected="${isSel}"
            draggable="true" data-archive-card="${esc(l.id)}">
            <div class="sl-lc-top">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="sl-lc-speaker">${esc(l.speaker)}</span>
                ${mappedChar ? `<span class="sl-lc-char">→ ${esc(mappedChar)}</span>` : ""}
                ${inferredHtml}
              </div>
              <span class="sl-lc-time">${esc(fmtTc(l.seconds))}</span>
            </div>
            <div class="sl-lc-sub">
              <span>${esc(sourceShort(l.workshopId))}</span>
              <span class="sl-src-pill">${esc(l.id)}</span>
            </div>
            <p class="sl-lc-text">${renderOriginalHtmlWithBrackets(l.text, filterQuery)}</p>
            ${themesHtml}
            <div class="sl-lc-foot">
              ${usageHtml}
              <div class="sl-lc-btns">
                <button type="button" class="sl-mini-btn" data-play-src="${esc(l.id)}">▶ Play</button>
                <button type="button" class="sl-mini-btn add" data-add-src="${esc(l.id)}">+ Add to script</button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    const moreHtml =
      matches.length > slice.length
        ? `<button type="button" class="sl-btn" id="sl-archive-more" style="justify-content:center;margin-top:4px;">
             Show more lines (${matches.length - slice.length} remaining)
           </button>`
        : "";

    listEl.innerHTML = cardsHtml + moreHtml;
  }

  function renderDialogueElementHtml(sc, el, elIdx, totalEls) {
    const charName = resolveCharacterName(el);
    const modeLabel = MODE_LABELS[el.mode] || el.mode;
    const isOrig = el.mode === "ORIGINAL";
    const isAdapt = el.mode === "ADAPTED";
    const isAi = el.mode === "AI_SUGGESTION";
    const hasSource = (isOrig || isAdapt) && el.srcId;
    const wsName = hasSource ? sourceShort(el.workshopId) : "";
    const tcStr = hasSource ? fmtTc(el.seconds) : "";

    const sourceBadgeText = hasSource
      ? `${el.srcId} · ${wsName} · ${tcStr}`
      : isAi
        ? "Synthetic dramatic bridge — never actor words"
        : "Authored screenplay dialogue — no video source";

    const inferredBadgeHtml =
      hasSource && !el.speakerVerified ? `<span class="sl-inferred-badge">speaker inferred</span>` : "";

    const parenClean = (el.parenthetical || "").trim().replace(/^\(|\)$/g, "");

    return `
      <div class="sl-el-dialogue mode-${esc(el.mode)}" data-el-id="${esc(el.id)}" data-scene-id="${esc(sc.id)}"
        ${hasSource ? `data-clickable-source="${esc(el.srcId)}" title="Click to jump YouTube monitor to ${esc(tcStr)}"` : ""}>
        <div class="sl-el-meta-bar">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="sl-mode-pill">${esc(modeLabel)}</span>
            <span class="sl-el-source-tag">${esc(sourceBadgeText)}</span>
            ${inferredBadgeHtml}
          </div>
          <div class="sl-el-tools">
            ${hasSource ? `<button type="button" class="sl-paper-icon-btn" data-el-play="${esc(el.id)}" data-scene-id="${esc(sc.id)}" title="Play YouTube source">▶</button>` : ""}
            ${isOrig ? `<button type="button" class="sl-paper-icon-btn" data-el-adapt="${esc(el.id)}" data-scene-id="${esc(sc.id)}" title="Adapt while keeping verbatim quote attached">Adapt…</button>` : ""}
            ${!isOrig && !hasSource ? `<button type="button" class="sl-paper-icon-btn" data-el-toggle-ai="${esc(el.id)}" data-scene-id="${esc(sc.id)}">${isAi ? "Mark Written" : "Mark AI"}</button>` : ""}
            ${elIdx > 0 ? `<button type="button" class="sl-paper-icon-btn" data-el-move="up" data-move-el="${esc(el.id)}" data-scene-id="${esc(sc.id)}">↑</button>` : ""}
            ${elIdx < totalEls - 1 ? `<button type="button" class="sl-paper-icon-btn" data-el-move="down" data-move-el="${esc(el.id)}" data-scene-id="${esc(sc.id)}">↓</button>` : ""}
            <button type="button" class="sl-paper-icon-btn danger" data-el-delete="${esc(el.id)}" data-scene-id="${esc(sc.id)}">×</button>
          </div>
        </div>

        <div class="sl-dialogue-column">
          <div class="sl-char-row">
            <input type="text" class="sl-char-cue-input" value="${esc(charName)}"
              data-char-input="${esc(el.id)}" data-scene-id="${esc(sc.id)}"
              ${el.speaker ? `data-speaker-ref="${esc(el.speaker)}"` : ""} />
            <div class="sl-print-only" style="text-align:center;font-weight:700;text-transform:uppercase;" data-print-char="${esc(el.id)}">${esc(charName)}</div>
          </div>
          ${el.speaker ? `<div class="sl-actor-sub" style="text-align:center;margin-bottom:4px;">Source Speaker: ${esc(el.speaker)}</div>` : ""}

          <div class="sl-paren-wrap">
            <input type="text" class="sl-paren-input" value="${parenClean ? `(${esc(parenClean)})` : ""}"
              placeholder="(parenthetical)" data-paren-input="${esc(el.id)}" data-scene-id="${esc(sc.id)}" />
            <div class="sl-print-only" style="text-align:center;" data-print-paren="${esc(el.id)}">${parenClean ? `(${esc(parenClean)})` : ""}</div>
          </div>

          ${
            isOrig
              ? `<div class="sl-dialogue-readonly sl-screen-only">${renderOriginalHtmlWithBrackets(el.text, "")}</div>
                 <div class="sl-print-only" style="white-space:pre-wrap;" data-print-dlg="${esc(el.id)}">${esc(stripEditorBrackets(el.text))}</div>`
              : `<textarea class="sl-dialogue-textarea" data-dlg-textarea="${esc(el.id)}" data-scene-id="${esc(sc.id)}">${esc(el.text)}</textarea>
                 <div class="sl-print-only" style="white-space:pre-wrap;" data-print-dlg="${esc(el.id)}">${esc(el.text)}</div>`
          }

          ${
            isAdapt
              ? `<div class="sl-adapted-original-box">
                   <div class="sl-adapted-original-actions">
                     <button type="button" class="sl-link-btn" data-toggle-orig="${esc(el.id)}" data-scene-id="${esc(sc.id)}">
                       ${el.showOriginal ? "▴ Hide verbatim source" : "▾ verbatim (" + esc(el.srcId) + ")"}
                     </button>
                     <button type="button" class="sl-link-btn" data-restore-orig="${esc(el.id)}" data-scene-id="${esc(sc.id)}">
                       ↺ Restore original
                     </button>
                   </div>
                   ${el.showOriginal ? `<div class="sl-adapted-verbatim">“${renderOriginalHtmlWithBrackets(el.originalText, "")}”</div>` : ""}
                 </div>`
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderScreenplay() {
    const scrollEl = document.getElementById("sl-script-scroll");
    if (!scrollEl) return;

    let totalDialogue = 0;
    state.scenes.forEach((s) =>
      s.elements.forEach((e) => {
        if (e.type === "dialogue") totalDialogue++;
      })
    );
    const sumEl = document.getElementById("sl-script-summary");
    if (sumEl) {
      sumEl.textContent = `${state.scenes.length} scene${state.scenes.length === 1 ? "" : "s"} · ${totalDialogue} line${totalDialogue === 1 ? "" : "s"}`;
    }

    const printHeaderHtml = `
      <div class="sl-print-only sl-print-titlepage">
        <div style="font-weight:700;font-size:14pt;text-transform:uppercase;">${esc(state.title)}</div>
        <div style="margin-top:4pt;">Written with 220 Lab · Film Script Lab (scriptlab.cloud)</div>
      </div>
    `;

    const scenesHtml = state.scenes
      .map((sc, sIdx) => {
        const isAct = sc.id === state.activeSceneId;
        const slugText = `${sIdx + 1}   ${formatSlugline(sc)}   ${sIdx + 1}`;

        const elementsHtml = sc.elements.length
          ? sc.elements
              .map((el, elIdx) => {
                if (el.type === "action") {
                  return `
                    <div class="sl-el-action" data-el-id="${esc(el.id)}" data-scene-id="${esc(sc.id)}">
                      <div class="sl-el-meta-bar" style="margin-bottom:4px;">
                        <span class="sl-el-source-tag">ACTION</span>
                        <div class="sl-el-tools">
                          ${elIdx > 0 ? `<button type="button" class="sl-paper-icon-btn" data-el-move="up" data-move-el="${esc(el.id)}" data-scene-id="${esc(sc.id)}">↑</button>` : ""}
                          ${elIdx < sc.elements.length - 1 ? `<button type="button" class="sl-paper-icon-btn" data-el-move="down" data-move-el="${esc(el.id)}" data-scene-id="${esc(sc.id)}">↓</button>` : ""}
                          <button type="button" class="sl-paper-icon-btn danger" data-el-delete="${esc(el.id)}" data-scene-id="${esc(sc.id)}">×</button>
                        </div>
                      </div>
                      <textarea class="sl-action-textarea" placeholder="Write scene action, visual framing, or camera blocking…"
                        data-action-textarea="${esc(el.id)}" data-scene-id="${esc(sc.id)}">${esc(el.text)}</textarea>
                      <div class="sl-print-only" style="white-space:pre-wrap;" data-print-action="${esc(el.id)}">${esc(el.text)}</div>
                    </div>
                  `;
                }
                return renderDialogueElementHtml(sc, el, elIdx, sc.elements.length);
              })
              .join("")
          : `<div class="sl-empty-scene">Drag any <code>SRC-</code> card from the Archive here, click <strong>+ Add to script</strong>, or add Action / Dialogue below.</div>`;

        return `
          <article class="sl-scene-page ${isAct ? "active-scene" : ""}" data-scene-page="${esc(sc.id)}" id="sl-scene-${esc(sc.id)}">
            <header class="sl-scene-header">
              <div class="sl-print-slugline" data-print-slug="${esc(sc.id)}">${esc(slugText)}</div>
              <div class="sl-slug-builder">
                <span class="sl-scene-num">${sIdx + 1}</span>
                <select class="sl-slug-select" data-slug-field="intExt" data-scene-id="${esc(sc.id)}">
                  ${INT_EXT_OPTIONS.map((o) => `<option value="${esc(o)}" ${sc.intExt === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
                </select>
                <input type="text" class="sl-slug-location" value="${esc(sc.location)}" placeholder="LOCATION"
                  data-slug-location="${esc(sc.id)}" aria-label="Scene location" />
                <span>—</span>
                <select class="sl-slug-select" data-slug-field="timeOfDay" data-scene-id="${esc(sc.id)}">
                  ${TIME_OPTIONS.map((o) => `<option value="${esc(o)}" ${sc.timeOfDay === o ? "selected" : ""}>${esc(o)}</option>`).join("")}
                </select>
              </div>

              <div class="sl-scene-ops">
                ${sIdx > 0 ? `<button type="button" class="sl-paper-icon-btn" data-scene-move="up" data-scene-id="${esc(sc.id)}">↑ Scene</button>` : ""}
                ${sIdx < state.scenes.length - 1 ? `<button type="button" class="sl-paper-icon-btn" data-scene-move="down" data-scene-id="${esc(sc.id)}">↓ Scene</button>` : ""}
                <button type="button" class="sl-paper-icon-btn danger" data-scene-delete="${esc(sc.id)}">Delete</button>
              </div>
            </header>

            <div class="sl-elements-list">${elementsHtml}</div>

            <footer class="sl-scene-add-bar">
              <div class="sl-scene-add-btns">
                <button type="button" class="sl-paper-icon-btn" data-add-el="action" data-scene-id="${esc(sc.id)}">+ Action</button>
                <button type="button" class="sl-paper-icon-btn" data-add-el="written" data-scene-id="${esc(sc.id)}">+ Written Dialogue</button>
                <button type="button" class="sl-paper-icon-btn" data-add-el="ai" data-scene-id="${esc(sc.id)}">+ AI Suggestion</button>
              </div>
              <span class="sl-drop-hint">Drop YouTube line card to insert ORIGINAL</span>
            </footer>
          </article>
        `;
      })
      .join("");

    scrollEl.innerHTML =
      printHeaderHtml +
      scenesHtml +
      `<button type="button" class="sl-btn primary" id="sl-btn-new-scene-bottom" style="padding:9px 18px;">+ New Scene (⌘⇧S)</button>`;
  }

  function renderSourceInspector() {
    const box = document.getElementById("sl-source-inspector");
    if (!box) return;
    const line = activeMonitorLine;
    if (!line) {
      box.innerHTML = `<div style="color:var(--sl-muted);">Click any <code>ORIGINAL</code> or <code>ADAPTED</code> line (or press ▶ in the Archive) to cue its YouTube source moment.</div>`;
      return;
    }

    const mapped = state.characterMap[line.speaker] || "";
    const url = ytLink(line.youtubeId, line.seconds);
    const inferredHtml = !line.speakerVerified ? `<span class="sl-inferred-badge">speaker inferred</span>` : "";

    box.innerHTML = `
      <div class="sl-si-kicker">Source Provenance · Verbatim YouTube</div>
      <div class="sl-si-speaker" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span>${esc(line.speaker)}</span>
        ${mapped ? `<span class="sl-lc-char">→ ${esc(mapped)}</span>` : ""}
        ${inferredHtml}
      </div>
      <div class="sl-si-meta">${esc(sourceShort(line.workshopId))} · <strong>${esc(fmtTc(line.seconds))}</strong></div>
      <blockquote class="sl-si-quote">“${renderOriginalHtmlWithBrackets(line.text, "")}”</blockquote>
      <div class="sl-si-links">
        <span class="sl-src-pill">${esc(line.id)}</span>
        <a href="${esc(url)}" target="_blank" rel="noopener">Open on YouTube (${esc(fmtTc(line.seconds))}) ↗</a>
      </div>
    `;
  }

  function renderDirectorsTable() {
    const box = document.getElementById("sl-directors-table");
    if (!box) return;
    const sc = getActiveScene();
    if (!sc) return;

    const sIdx = state.scenes.findIndex((s) => s.id === sc.id);
    const counts = { ORIGINAL: 0, ADAPTED: 0, AI_SUGGESTION: 0, WRITTEN: 0 };
    const charsMap = new Map();

    sc.elements.forEach((el) => {
      if (el.type === "dialogue") {
        counts[el.mode] = (counts[el.mode] || 0) + 1;
        const cName = resolveCharacterName(el);
        const entry = charsMap.get(cName) || { count: 0, speaker: el.speaker || "" };
        entry.count++;
        if (el.speaker && !entry.speaker) entry.speaker = el.speaker;
        charsMap.set(cName, entry);
      }
    });

    const charsHtml = charsMap.size
      ? Array.from(charsMap.entries())
          .map(
            ([cName, info]) =>
              `<span class="sl-dt-char-pill">${esc(cName)}${info.speaker ? ` (${esc(info.speaker)})` : ""} · ${info.count}</span>`
          )
          .join("")
      : `<span style="font-size:12px;color:var(--sl-muted);">No characters in this scene yet.</span>`;

    box.innerHTML = `
      <div class="sl-dt-head">
        <h3>Director’s Table</h3>
        <span class="sl-dt-scene-label">Sc ${sIdx + 1} · ${esc(formatSlugline(sc))}</span>
      </div>
      <div class="sl-dt-row">
        <div class="sl-dt-field">
          <label for="sl-dt-purpose">Scene Purpose</label>
          <select id="sl-dt-purpose" class="sl-select" data-dt-field="purpose" data-scene-id="${esc(sc.id)}">
            ${PURPOSES.map((p) => `<option value="${esc(p)}" ${sc.purpose === p ? "selected" : ""}>${esc(p)}</option>`).join("")}
          </select>
        </div>
        <div class="sl-dt-field">
          <label for="sl-dt-status">Production Status</label>
          <select id="sl-dt-status" class="sl-select" data-dt-field="status" data-scene-id="${esc(sc.id)}">
            ${STATUSES.map((st) => `<option value="${esc(st)}" ${sc.status === st ? "selected" : ""}>${esc(st)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="sl-dt-field">
        <label for="sl-dt-notes">Director’s Notes (Blocking, Camera, Subtext)</label>
        <textarea id="sl-dt-notes" class="sl-dt-notes" placeholder="Camera coverage, subtext, legal clearance notes…" data-dt-notes="${esc(sc.id)}">${esc(sc.notes)}</textarea>
      </div>
      <div class="sl-dt-field">
        <label>Dialogue Provenance Tally (Scene ${sIdx + 1})</label>
        <div class="sl-dt-counts">
          <div class="sl-dt-count-box"><span>ORIGINAL</span><strong style="color:#2ea063;">${counts.ORIGINAL}</strong></div>
          <div class="sl-dt-count-box"><span>ADAPTED</span><strong style="color:#d97706;">${counts.ADAPTED}</strong></div>
          <div class="sl-dt-count-box"><span>AI SUGGESTION</span><strong style="color:#8b5cf6;">${counts.AI_SUGGESTION}</strong></div>
          <div class="sl-dt-count-box"><span>WRITTEN</span><strong>${counts.WRITTEN}</strong></div>
        </div>
      </div>
      <div class="sl-dt-field">
        <label>Characters in Scene (${charsMap.size})</label>
        <div class="sl-dt-chars">${charsHtml}</div>
      </div>
    `;
  }

  function renderAll() {
    renderSourcesDrawer();
    renderCharMapDrawer();
    renderScreenplay();
    renderArchive();
    renderSourceInspector();
    renderDirectorsTable();
  }

  // ---------- YouTube Player ----------
  function initYouTubeWhenReady() {
    const check = setInterval(() => {
      if (window.YT && typeof window.YT.Player === "function") {
        clearInterval(check);
        const host = document.getElementById("sl-yt-player");
        if (!host || ytPlayer) return;
        const firstSrc = getActiveSources()[0];
        const initVid = activeMonitorLine ? activeMonitorLine.youtubeId : firstSrc?.youtubeId || "QgwRsArIVKI";
        const initSec = activeMonitorLine ? activeMonitorLine.seconds : 0;
        const initEnd = activeMonitorLine?.excerptEnd || (initVid === "QgwRsArIVKI" ? 65 : undefined);
        const pVars = { rel: 0, modestbranding: 1, playsinline: 1, start: initSec };
        if (initEnd) pVars.end = initEnd;

        ytPlayer = new window.YT.Player("sl-yt-player", {
          videoId: initVid,
          playerVars: pVars,
          events: {
            onReady: () => {
              ytReady = true;
              if (pendingPlay) {
                const req = pendingPlay;
                pendingPlay = null;
                playLineObject(req.line, req.autoplay);
              }
            },
            onStateChange: (ev) => {
              const badge = document.getElementById("sl-player-state-badge");
              if (!badge) return;
              badge.textContent =
                ev.data === window.YT.PlayerState.PLAYING
                  ? "Playing"
                  : ev.data === window.YT.PlayerState.PAUSED
                    ? "Paused"
                    : "Ready";
            },
          },
        });
      }
    }, 180);
  }

  function playLineObject(line, autoplay) {
    if (!line) return;
    activeMonitorLine = line;
    renderSourceInspector();
    if (!ytReady || !ytPlayer) {
      pendingPlay = { line, autoplay };
      return;
    }
    try {
      const payload = { videoId: line.youtubeId, startSeconds: Math.max(0, Number(line.seconds) || 0) };
      if (line.excerptEnd) payload.endSeconds = Number(line.excerptEnd);
      if (autoplay) {
        ytPlayer.loadVideoById(payload);
      } else {
        ytPlayer.cueVideoById(payload);
      }
    } catch {}
  }

  function togglePlayPause() {
    if (!ytReady || !ytPlayer || typeof ytPlayer.getPlayerState !== "function") return;
    if (ytPlayer.getPlayerState() === window.YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
  }

  function scrubRelative(deltaSec) {
    if (!ytReady || !ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
    try {
      const next = Math.max(0, (ytPlayer.getCurrentTime() || 0) + deltaSec);
      ytPlayer.seekTo(next, true);
    } catch {}
  }

  // ---------- Any-YouTube-Video Ingestion Modal ----------
  function openYouTubeModal(prefillUrl = "") {
    if (!ytModal) return;
    ytModal.hidden = false;
    const statusBox = document.getElementById("yt-modal-status");
    if (statusBox) statusBox.hidden = true;
    const inp = document.getElementById("yt-url-input");
    if (inp) {
      if (prefillUrl) inp.value = prefillUrl;
      setTimeout(() => inp.focus(), 60);
    }
  }

  function closeYouTubeModal() {
    if (ytModal) ytModal.hidden = true;
  }

  function mergeIngestedVideoIntoProject(videoObj, newLines) {
    state.customSources = (state.customSources || []).filter((s) => s.id !== videoObj.id);
    state.customSources.unshift(videoObj);

    state.customLines = (state.customLines || []).filter((l) => l.workshopId !== videoObj.id);
    state.customLines.push(...newLines);

    filterSource = videoObj.id;
    filterSpeaker = "ALL";
    filterTheme = "ALL";
    archiveRenderLimit = 100;

    if (newLines[0]) {
      selectedArchiveLineId = newLines[0].id;
      playLineObject(newLines[0], false);
    }
    saveState();
    renderAll();
  }

  async function parseManualTranscriptToLines(videoId, sourceId, fallbackSpeaker, rawText) {
    const trimmed = String(rawText || "").trim();
    if (!trimmed) return [];

    const rawEntries = [];

    // 1. JSON (Whisper JSON or array of segments)
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        const segs = Array.isArray(parsed) ? parsed : parsed.segments || parsed.lines || [];
        for (const s of segs) {
          const sec = Number(s.seconds ?? s.start ?? 0);
          const txt = String(s.text || "").trim();
          const spk = String(s.speaker || fallbackSpeaker || "SPEAKER").trim();
          if (txt) rawEntries.push({ seconds: sec, speaker: spk, verified: Boolean(s.speaker), text: txt });
        }
      } catch {}
    }

    // 2. SRT or WebVTT
    if (!rawEntries.length && trimmed.includes("-->")) {
      const blocks = trimmed.replace(/\r/g, "").split(/\n\n+/);
      const timeRe = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->/;
      for (const b of blocks) {
        const ls = b.split("\n");
        const tIdx = ls.findIndex((x) => timeRe.test(x));
        if (tIdx === -1) continue;
        const m = ls[tIdx].match(timeRe);
        const sec = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
        let txt = ls
          .slice(tIdx + 1)
          .join(" ")
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!txt) continue;
        let spk = fallbackSpeaker || "SPEAKER";
        let ver = false;
        const spkM = txt.match(/^([A-Z][A-Za-z0-9 .'-]{1,28}):\s+(.+)$/);
        if (spkM) {
          spk = spkM[1].trim();
          txt = spkM[2].trim();
          ver = true;
        }
        rawEntries.push({ seconds: sec, speaker: spk, verified: ver, text: txt });
      }
    }

    // 3. Plain timestamped lines (`01:24 SPEAKER: Text` or `01:24 Text` or plain paragraphs)
    if (!rawEntries.length) {
      const lines = trimmed.replace(/\r/g, "").split("\n").map((x) => x.trim()).filter(Boolean);
      let runningSec = 0;
      for (const ln of lines) {
        let rest = ln;
        const tcM = rest.match(/^(?:\[)?(?:(\d+):)?(\d{1,2}):(\d{2})(?:\])?\s+(.+)$/);
        if (tcM) {
          runningSec = Number(tcM[1] || 0) * 3600 + Number(tcM[2] || 0) * 60 + Number(tcM[3] || 0);
          rest = tcM[4].trim();
        } else {
          runningSec += 4;
        }
        let spk = fallbackSpeaker || "SPEAKER";
        let ver = false;
        const spkM = rest.match(/^([A-Za-z][A-Za-z0-9 .'-]{1,28}):\s+(.+)$/);
        if (spkM) {
          spk = spkM[1].trim();
          rest = spkM[2].trim();
          ver = true;
        }
        if (rest) rawEntries.push({ seconds: runningSec, speaker: spk, verified: ver, text: rest });
      }
    }

    const out = [];
    const seen = new Set();
    for (const item of rawEntries) {
      const s = Math.max(0, Math.floor(Number(item.seconds) || 0));
      const id = await computeSrcId(videoId, s, item.speaker, item.text);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        workshopId: sourceId,
        youtubeId: videoId,
        seconds: s,
        speaker: item.speaker,
        speakerVerified: item.verified,
        text: item.text,
        wordCount: countSpokenWords(item.text),
        themes: detectThemes(item.text),
      });
    }
    return out;
  }

  function bindYouTubeModalEvents() {
    document.getElementById("yt-modal-close")?.addEventListener("click", closeYouTubeModal);
    ytModal?.addEventListener("click", (e) => {
      if (e.target === ytModal) closeYouTubeModal();
    });

    document.querySelectorAll("[data-yt-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.ytTab;
        document.querySelectorAll("[data-yt-tab]").forEach((b) => b.classList.toggle("active", b === btn));
        document.getElementById("yt-auto-form").hidden = mode !== "auto";
        document.getElementById("yt-manual-form").hidden = mode !== "manual";
      });
    });

    // File reader into manual textarea
    document.getElementById("yt-man-file")?.addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const ta = document.getElementById("yt-man-text");
        if (ta) ta.value = String(reader.result || "");
      };
      reader.readAsText(f);
    });

    // Auto-extract submit
    document.getElementById("yt-auto-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("yt-auto-submit");
      const statusBox = document.getElementById("yt-modal-status");
      const urlVal = document.getElementById("yt-url-input")?.value.trim() || "";
      const spkVal = document.getElementById("yt-speaker-input")?.value.trim() || "";
      const langVal = document.getElementById("yt-lang-select")?.value || "en";

      const videoId = extractYouTubeId(urlVal);
      if (!videoId) {
        statusBox.hidden = false;
        statusBox.className = "status-banner error";
        statusBox.textContent = "Please enter a valid YouTube URL or 11-character Video ID.";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Extracting captions & computing SRC- hashes…";
      statusBox.hidden = true;

      try {
        // 1. Try local Whisper / yt-dlp companion bridge first if running on 127.0.0.1:8788
        let data = null;
        try {
          const ctrl = new AbortController();
          const tId = setTimeout(() => ctrl.abort(), 900);
          const locRes = await fetch("http://127.0.0.1:8788/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: urlVal, lang: langVal, speaker: spkVal }),
            signal: ctrl.signal,
          });
          clearTimeout(tId);
          if (locRes.ok) data = await locRes.json();
        } catch {}

        // 2. Live Cloudflare Worker Edge API
        if (!data || !data.captionsAvailable) {
          const res = await fetch(`${API_BASE}/api/youtube/ingest`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${activeSession?.token || ""}`,
            },
            body: JSON.stringify({ url: urlVal, lang: langVal, speaker: spkVal }),
          });
          data = await res.json();
        }

        if (data?.ok && data.captionsAvailable && Array.isArray(data.lines) && data.lines.length > 0) {
          mergeIngestedVideoIntoProject(data.video, data.lines);
          window.SLAnalytics?.track("youtube_video_ingested", {
            videoId,
            method: "edge_api",
            lineCount: data.lines.length,
          });
          closeYouTubeModal();
          return;
        }

        // Video exists, no captions yet -> prefill Manual SRT/VTT/Paste tab seamlessly!
        const manUrl = document.getElementById("yt-man-url");
        const manTitle = document.getElementById("yt-man-title");
        const manSpk = document.getElementById("yt-man-speaker");
        if (manUrl) manUrl.value = `https://youtu.be/${videoId}`;
        if (manTitle && data?.video?.shortLabel) manTitle.value = data.video.shortLabel;
        if (manSpk && (spkVal || data?.video?.author)) manSpk.value = spkVal || data.video.author;

        document.querySelector('[data-yt-tab="manual"]')?.click();
        statusBox.hidden = false;
        statusBox.className = "status-banner pending";
        statusBox.innerHTML = `
          <strong>Loaded "${esc(data?.video?.title || videoId)}"</strong> — YouTube didn’t return public caption tracks for this video (or restricted datacenter caption fetch).
          Drop an <code>.srt</code> / <code>.vtt</code> / Whisper <code>.json</code> file above, paste timestamped text, or run <code>python3 scripts/ingest_youtube.py --serve</code> locally!
        `;
      } catch (err) {
        statusBox.hidden = false;
        statusBox.className = "status-banner error";
        statusBox.textContent = "Could not reach YouTube ingestion service. Use the Upload .SRT / .VTT tab.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Extract Verbatim Lines & Timestamps";
      }
    });

    // Manual SRT/VTT/JSON/Text submit
    document.getElementById("yt-manual-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusBox = document.getElementById("yt-modal-status");
      const urlVal = document.getElementById("yt-man-url")?.value.trim() || "";
      const titleVal = document.getElementById("yt-man-title")?.value.trim() || "";
      const spkVal = document.getElementById("yt-man-speaker")?.value.trim() || "SPEAKER";
      const rawText = document.getElementById("yt-man-text")?.value || "";

      const videoId = extractYouTubeId(urlVal);
      if (!videoId) {
        statusBox.hidden = false;
        statusBox.className = "status-banner error";
        statusBox.textContent = "Enter a valid YouTube URL or 11-character Video ID.";
        return;
      }

      const sourceId = `yt_${videoId}`;
      const lines = await parseManualTranscriptToLines(videoId, sourceId, spkVal, rawText);
      if (!lines.length) {
        statusBox.hidden = false;
        statusBox.className = "status-banner error";
        statusBox.textContent = "Paste transcript lines or select a valid .srt, .vtt, or .json file.";
        return;
      }

      const label = titleVal || `YouTube (${videoId})`;
      const videoObj = {
        id: sourceId,
        youtubeId: videoId,
        title: label,
        shortLabel: label.length > 34 ? `${label.slice(0, 32)}…` : label,
        author: spkVal,
        durationSeconds: (lines[lines.length - 1]?.seconds || 0) + 10,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        languageCode: "en",
        isAutoCaptions: false,
        lineCount: lines.length,
      };

      mergeIngestedVideoIntoProject(videoObj, lines);
      window.SLAnalytics?.track("youtube_video_ingested", {
        videoId,
        method: "transcript_file",
        lineCount: lines.length,
      });
      closeYouTubeModal();
    });
  }

  // ---------- Scene Mutations & Exports ----------
  function setMobileTab(tab) {
    mobileTab = tab;
    const wb = document.getElementById("sl-workbench");
    if (wb) wb.dataset.mobileTab = tab;
    root.querySelectorAll("[data-sl-tab]").forEach((b) => b.classList.toggle("on", b.dataset.slTab === tab));
  }

  function selectScene(sceneId) {
    if (!state.scenes.some((s) => s.id === sceneId) || state.activeSceneId === sceneId) return;
    state.activeSceneId = sceneId;
    saveState();
    root.querySelectorAll(".sl-scene-page").forEach((p) => {
      p.classList.toggle("active-scene", p.dataset.scenePage === sceneId);
    });
    renderDirectorsTable();
  }

  function addArchiveLineToScene(srcId, targetSceneId) {
    const line = resolveArchiveLine(srcId);
    if (!line) return;
    const sc = targetSceneId
      ? state.scenes.find((s) => s.id === targetSceneId) || getActiveScene()
      : getActiveScene();
    if (!sc) return;

    state.activeSceneId = sc.id;
    selectedArchiveLineId = line.id;
    activeMonitorLine = line;

    const newEl = makeOriginalElementFromLine(line);
    sc.elements.push(newEl);
    saveState();
    renderScreenplay();
    renderArchive();
    renderSourceInspector();
    renderDirectorsTable();
    window.SLAnalytics?.track("line_inserted_to_script", { srcId: line.id, youtubeId: line.youtubeId });

    requestAnimationFrame(() => {
      root.querySelector(`[data-el-id="${newEl.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function createNewScene() {
    const sc = createBlankScene({ location: "NEW LOCATION", purpose: "Transition", status: "Draft" });
    state.scenes.push(sc);
    state.activeSceneId = sc.id;
    saveState();
    renderScreenplay();
    renderDirectorsTable();
    if (window.innerWidth <= 1040) setMobileTab("script");
    requestAnimationFrame(() => {
      document.getElementById(`sl-scene-${sc.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function updateActorCharacterMap(speaker, rawNewName) {
    const cleaned = String(rawNewName || "").trim().toUpperCase();
    if (!cleaned) return;
    state.characterMap[speaker] = cleaned;
    saveState();
    root.querySelectorAll(`[data-charmap-speaker="${CSS.escape(speaker)}"]`).forEach((inp) => {
      if (inp !== document.activeElement) inp.value = cleaned;
    });
    root.querySelectorAll(`.sl-char-cue-input[data-speaker-ref="${CSS.escape(speaker)}"]`).forEach((inp) => {
      if (inp !== document.activeElement) inp.value = cleaned;
      const elId = inp.dataset.charInput;
      const mirror = root.querySelector(`[data-print-char="${CSS.escape(elId)}"]`);
      if (mirror) mirror.textContent = cleaned;
    });
    renderArchive();
    renderSourceInspector();
    renderDirectorsTable();
  }

  function downloadBlob(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 250);
  }

  function exportFountain() {
    const today = new Date().toISOString().slice(0, 10);
    const out = [
      `Title: ${state.title}`,
      `Credit: Written with 220 Lab · Film Script Lab`,
      `Author: ${state.author || activeSession?.name || "220 Lab Filmmaker"}`,
      `Draft date: ${today}`,
      "",
    ];

    state.scenes.forEach((sc, idx) => {
      const heading = formatSlugline(sc);
      const fountainHeading = /^(INT\.|EXT\.|INT\.\/EXT\.)/.test(heading) ? heading : `.${heading}`;
      out.push(`${fountainHeading} #${idx + 1}#`, "");

      sc.elements.forEach((el) => {
        if (el.type === "action") {
          if ((el.text || "").trim()) out.push(el.text.trim(), "");
          return;
        }
        const charCue = resolveCharacterName(el);
        const paren = (el.parenthetical || "").trim().replace(/^\(|\)$/g, "");
        const modeLabel = MODE_LABELS[el.mode] || el.mode;
        const noteTag =
          (el.mode === "ORIGINAL" || el.mode === "ADAPTED") && el.srcId
            ? `[[${modeLabel} ${el.srcId} · ${sourceShort(el.workshopId)} ${fmtTc(el.seconds)}]]`
            : el.mode === "AI_SUGGESTION"
              ? `[[AI SUGGESTION no-src · synthetic]]`
              : `[[WRITTEN no-src · authored]]`;

        const exportText = el.mode === "ORIGINAL" ? stripEditorBrackets(el.text || "") : (el.text || "").trim();
        out.push(charCue);
        if (paren) out.push(`(${paren})`);
        out.push(`${exportText} ${noteTag}`, "");
      });
    });

    downloadBlob(`${slugify(state.title)}.fountain`, "text/plain;charset=utf-8", out.join("\n"));
    window.SLAnalytics?.track("script_exported", { format: "fountain", scenes: state.scenes.length });
  }

  function csvCell(val) {
    const s = String(val ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportSourceCsv() {
    const header = [
      "scene",
      "character",
      "source_speaker",
      "speakerVerified",
      "mode",
      "SRC_id",
      "video_source",
      "timestamp",
      "youtube_link",
      "verbatim_original_words",
      "screenplay_words",
    ];
    const rows = [header.map(csvCell).join(",")];
    state.scenes.forEach((sc, idx) => {
      const scLabel = `${idx + 1} - ${formatSlugline(sc)}`;
      sc.elements.forEach((el) => {
        if (el.type !== "dialogue") return;
        const hasSrc = (el.mode === "ORIGINAL" || el.mode === "ADAPTED") && el.srcId;
        rows.push(
          [
            scLabel,
            resolveCharacterName(el),
            el.speaker || "",
            hasSrc ? String(Boolean(el.speakerVerified)) : "",
            MODE_LABELS[el.mode] || el.mode,
            hasSrc ? el.srcId : "",
            hasSrc ? sourceShort(el.workshopId) : "",
            hasSrc ? fmtTc(el.seconds) : "",
            hasSrc && el.youtubeId ? ytLink(el.youtubeId, el.seconds) : "",
            hasSrc ? el.originalText : "",
            el.text || "",
          ]
            .map(csvCell)
            .join(",")
        );
      });
    });
    downloadBlob(`${slugify(state.title)}-eo-provenance.csv`, "text/csv;charset=utf-8", "\uFEFF" + rows.join("\r\n"));
    window.SLAnalytics?.track("script_exported", { format: "csv" });
  }

  // ---------- Event Delegation ----------
  function bindWorkbenchEvents() {
    root.addEventListener("click", (e) => {
      const tabBtn = e.target.closest("[data-sl-tab]");
      if (tabBtn) return setMobileTab(tabBtn.dataset.slTab);

      if (
        e.target.closest("#sl-btn-add-yt") ||
        e.target.closest("#sl-drawer-add-yt") ||
        e.target.closest("[data-open-yt-modal]")
      ) {
        return openYouTubeModal();
      }

      if (e.target.closest("#sl-btn-sources")) {
        sourcesDrawerOpen = !sourcesDrawerOpen;
        if (sourcesDrawerOpen) charDrawerOpen = false;
        renderSourcesDrawer();
        renderCharMapDrawer();
        return;
      }
      if (e.target.closest("#sl-close-sources")) {
        sourcesDrawerOpen = false;
        renderSourcesDrawer();
        return;
      }

      const focusSrcBtn = e.target.closest("[data-Focus-Source]");
      if (focusSrcBtn) {
        filterSource = focusSrcBtn.getAttribute("data-Focus-Source");
        sourcesDrawerOpen = false;
        renderSourcesDrawer();
        renderArchive();
        return;
      }

      const remSrcBtn = e.target.closest("[data-Remove-Source]");
      if (remSrcBtn) {
        const sid = remSrcBtn.getAttribute("data-Remove-Source");
        state.customSources = (state.customSources || []).filter((s) => s.id !== sid);
        state.customLines = (state.customLines || []).filter((l) => l.workshopId !== sid);
        if (filterSource === sid) filterSource = "ALL";
        saveState();
        renderAll();
        return;
      }

      if (e.target.closest("#sl-btn-charmap")) {
        charDrawerOpen = !charDrawerOpen;
        if (charDrawerOpen) sourcesDrawerOpen = false;
        renderCharMapDrawer();
        renderSourcesDrawer();
        return;
      }
      if (e.target.closest("#sl-close-charmap")) {
        charDrawerOpen = false;
        renderCharMapDrawer();
        return;
      }

      if (e.target.closest("#sl-btn-new-scene-top") || e.target.closest("#sl-btn-new-scene-bottom")) {
        return createNewScene();
      }

      if (e.target.closest("#sl-btn-save-file")) {
        downloadBlob(
          `${slugify(state.title)}.scriptlab.json`,
          "application/json;charset=utf-8",
          JSON.stringify(Object.assign({}, state, { savedAt: new Date().toISOString() }), null, 2)
        );
        window.SLAnalytics?.track("script_exported", { format: "json" });
        return;
      }

      if (e.target.closest("#sl-btn-open-file")) {
        const fi = document.getElementById("sl-file-input");
        if (fi) {
          fi.value = "";
          fi.click();
        }
        return;
      }

      if (e.target.closest("#sl-btn-fountain")) return exportFountain();
      if (e.target.closest("#sl-btn-print")) {
        window.SLAnalytics?.track("script_exported", { format: "pdf" });
        return window.print();
      }
      if (e.target.closest("#sl-btn-csv")) return exportSourceCsv();

      if (e.target.closest("#sl-btn-blank")) {
        const blank = createBlankScene({ location: "INTERVIEW ROOM" });
        state = {
          format: "220lab.scriptlab",
          version: 2,
          title: "UNTITLED SCREENPLAY",
          author: activeSession?.name || "220 Lab Filmmaker",
          includeStarterSources: false,
          customSources: state.customSources || [],
          customLines: state.customLines || [],
          characterMap: Object.assign({}, state.characterMap),
          activeSceneId: blank.id,
          scenes: [blank],
        };
        const tInp = document.getElementById("sl-script-title");
        if (tInp) tInp.value = state.title;
        filterSource = "ALL";
        filterSpeaker = "ALL";
        saveState();
        renderAll();
        return;
      }

      if (e.target.closest("#sl-btn-theme")) {
        const cur = document.documentElement.getAttribute("data-studio-theme") || "dark";
        const next = cur === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-studio-theme", next);
        localStorage.setItem(THEME_STORAGE_KEY, next);
        return;
      }

      if (e.target.closest("#sl-btn-signout")) {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = "index.html";
        return;
      }

      if (e.target.closest("#sl-search-clear")) {
        filterQuery = "";
        const sInp = document.getElementById("sl-search");
        if (sInp) {
          sInp.value = "";
          sInp.focus();
        }
        renderArchive();
        return;
      }

      if (e.target.closest("#sl-archive-more")) {
        archiveRenderLimit += 120;
        renderArchive();
        return;
      }

      if (e.target.closest("#sl-film-playpause")) return togglePlayPause();
      if (e.target.closest("#sl-film-replay")) {
        if (activeMonitorLine) playLineObject(activeMonitorLine, true);
        return;
      }
      if (e.target.closest("#sl-film-back5")) return scrubRelative(-5);
      if (e.target.closest("#sl-film-fwd5")) return scrubRelative(5);
      if (e.target.closest("#sl-film-add-active")) {
        if (activeMonitorLine) addArchiveLineToScene(activeMonitorLine.id);
        return;
      }

      const themeChip = e.target.closest("[data-pick-theme]");
      if (themeChip) {
        e.stopPropagation();
        filterTheme = themeChip.dataset.pickTheme;
        renderArchive();
        return;
      }

      const jumpBtn = e.target.closest("[data-jump-scene]");
      if (jumpBtn) {
        e.stopPropagation();
        const scId = jumpBtn.dataset.jumpScene;
        selectScene(scId);
        if (window.innerWidth <= 1040) setMobileTab("script");
        document.getElementById(`sl-scene-${scId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const playSrcBtn = e.target.closest("[data-play-src]");
      if (playSrcBtn) {
        e.stopPropagation();
        const line = resolveArchiveLine(playSrcBtn.dataset.playSrc);
        if (line) {
          selectedArchiveLineId = line.id;
          renderArchive();
          playLineObject(line, true);
          if (window.innerWidth <= 1040) setMobileTab("film");
        }
        return;
      }

      const addSrcBtn = e.target.closest("[data-add-src]");
      if (addSrcBtn) {
        e.stopPropagation();
        addArchiveLineToScene(addSrcBtn.dataset.addSrc);
        return;
      }

      const archCard = e.target.closest("[data-archive-card]");
      if (archCard) {
        const id = archCard.dataset.archiveCard;
        selectedArchiveLineId = id;
        const line = resolveArchiveLine(id);
        if (line) playLineObject(line, false);
        root.querySelectorAll(".sl-line-card").forEach((c) => {
          const on = c.dataset.archiveCard === id;
          c.classList.toggle("selected", on);
          c.setAttribute("aria-selected", String(on));
        });
        return;
      }

      const scMoveBtn = e.target.closest("[data-scene-move]");
      if (scMoveBtn) {
        const idx = state.scenes.findIndex((s) => s.id === scMoveBtn.dataset.sceneId);
        const target = idx + (scMoveBtn.dataset.sceneMove === "up" ? -1 : 1);
        if (idx >= 0 && target >= 0 && target < state.scenes.length) {
          const [moved] = state.scenes.splice(idx, 1);
          state.scenes.splice(target, 0, moved);
          state.activeSceneId = moved.id;
          saveState();
          renderScreenplay();
          renderArchive();
          renderDirectorsTable();
        }
        return;
      }

      const scDelBtn = e.target.closest("[data-scene-delete]");
      if (scDelBtn) {
        if (state.scenes.length <= 1) {
          state.scenes[0].elements = [];
        } else {
          state.scenes = state.scenes.filter((s) => s.id !== scDelBtn.dataset.sceneId);
          if (!state.scenes.some((s) => s.id === state.activeSceneId)) state.activeSceneId = state.scenes[0].id;
        }
        saveState();
        renderAll();
        return;
      }

      const addElBtn = e.target.closest("[data-add-el]");
      if (addElBtn) {
        const sc = state.scenes.find((s) => s.id === addElBtn.dataset.sceneId);
        if (!sc) return;
        state.activeSceneId = sc.id;
        const kind = addElBtn.dataset.addEl;
        const newEl =
          kind === "action"
            ? { id: uid("el"), type: "action", text: "" }
            : kind === "ai"
              ? {
                  id: uid("el"),
                  type: "dialogue",
                  mode: "AI_SUGGESTION",
                  srcId: null,
                  speaker: "",
                  speakerVerified: false,
                  character: "CHARACTER",
                  parenthetical: "",
                  text: "Before we cut away from this room—ask what nobody on camera wanted to answer.",
                  originalText: "",
                  workshopId: "",
                  youtubeId: "",
                  seconds: 0,
                  showOriginal: false,
                }
              : {
                  id: uid("el"),
                  type: "dialogue",
                  mode: "WRITTEN",
                  srcId: null,
                  speaker: "",
                  speakerVerified: false,
                  character: "CHARACTER",
                  parenthetical: "",
                  text: "",
                  originalText: "",
                  workshopId: "",
                  youtubeId: "",
                  seconds: 0,
                  showOriginal: false,
                };
        sc.elements.push(newEl);
        saveState();
        renderScreenplay();
        renderDirectorsTable();
        requestAnimationFrame(() => {
          const sel = kind === "action" ? `[data-action-textarea="${newEl.id}"]` : `[data-dlg-textarea="${newEl.id}"]`;
          const f = root.querySelector(sel);
          if (f) {
            f.focus();
            f.setSelectionRange(f.value.length, f.value.length);
          }
        });
        return;
      }

      const elPlayBtn = e.target.closest("[data-el-play]");
      if (elPlayBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === elPlayBtn.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === elPlayBtn.dataset.elPlay);
        if (el && el.srcId) {
          const line = resolveArchiveLine(el.srcId) || {
            id: el.srcId,
            speaker: el.speaker,
            speakerVerified: el.speakerVerified,
            workshopId: el.workshopId,
            youtubeId: el.youtubeId,
            seconds: el.seconds,
            text: el.originalText,
          };
          playLineObject(line, true);
          if (window.innerWidth <= 1040) setMobileTab("film");
        }
        return;
      }

      const elAdaptBtn = e.target.closest("[data-el-adapt]");
      if (elAdaptBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === elAdaptBtn.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === elAdaptBtn.dataset.elAdapt);
        if (el && el.mode === "ORIGINAL") {
          el.mode = "ADAPTED";
          el.originalText = el.originalText || el.text;
          saveState();
          renderScreenplay();
          renderDirectorsTable();
          window.SLAnalytics?.track("line_adapted", { srcId: el.srcId });
          requestAnimationFrame(() => {
            const ta = root.querySelector(`[data-dlg-textarea="${el.id}"]`);
            if (ta) {
              ta.focus();
              ta.setSelectionRange(ta.value.length, ta.value.length);
            }
          });
        }
        return;
      }

      const toggleOrigBtn = e.target.closest("[data-toggle-orig]");
      if (toggleOrigBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === toggleOrigBtn.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === toggleOrigBtn.dataset.toggleOrig);
        if (el) {
          el.showOriginal = !el.showOriginal;
          saveState();
          renderScreenplay();
        }
        return;
      }

      const restoreOrigBtn = e.target.closest("[data-restore-orig]");
      if (restoreOrigBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === restoreOrigBtn.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === restoreOrigBtn.dataset.restoreOrig);
        if (el && el.mode === "ADAPTED" && el.originalText) {
          el.text = el.originalText;
          el.mode = "ORIGINAL";
          el.showOriginal = false;
          saveState();
          renderScreenplay();
          renderDirectorsTable();
        }
        return;
      }

      const toggleAiBtn = e.target.closest("[data-el-toggle-ai]");
      if (toggleAiBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === toggleAiBtn.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === toggleAiBtn.dataset.elToggleAi);
        if (el && (el.mode === "WRITTEN" || el.mode === "AI_SUGGESTION")) {
          el.mode = el.mode === "AI_SUGGESTION" ? "WRITTEN" : "AI_SUGGESTION";
          saveState();
          renderScreenplay();
          renderDirectorsTable();
        }
        return;
      }

      const elMoveBtn = e.target.closest("[data-el-move]");
      if (elMoveBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === elMoveBtn.dataset.sceneId);
        if (!sc) return;
        const idx = sc.elements.findIndex((x) => x.id === elMoveBtn.dataset.moveEl);
        const target = idx + (elMoveBtn.dataset.elMove === "up" ? -1 : 1);
        if (idx >= 0 && target >= 0 && target < sc.elements.length) {
          const [m] = sc.elements.splice(idx, 1);
          sc.elements.splice(target, 0, m);
          saveState();
          renderScreenplay();
        }
        return;
      }

      const elDelBtn = e.target.closest("[data-el-delete]");
      if (elDelBtn) {
        e.stopPropagation();
        const sc = state.scenes.find((s) => s.id === elDelBtn.dataset.sceneId);
        if (!sc) return;
        sc.elements = sc.elements.filter((x) => x.id !== elDelBtn.dataset.elDelete);
        saveState();
        renderScreenplay();
        renderArchive();
        renderDirectorsTable();
        return;
      }

      const srcElCard = e.target.closest("[data-clickable-source]");
      if (srcElCard && !isTypingTarget(e.target) && !e.target.closest("button")) {
        selectScene(srcElCard.dataset.sceneId);
        const line = resolveArchiveLine(srcElCard.dataset.clickableSource);
        if (line) playLineObject(line, true);
        return;
      }

      const scPage = e.target.closest("[data-scene-page]");
      if (scPage) selectScene(scPage.dataset.scenePage);
    });

    root.addEventListener("change", (e) => {
      if (e.target.id === "sl-file-input") {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const hydrated = sanitizeLoadedState(JSON.parse(String(reader.result || "")));
            if (!hydrated) return alert("Invalid .scriptlab.json file.");
            state = hydrated;
            const tInp = document.getElementById("sl-script-title");
            if (tInp) tInp.value = state.title;
            saveState();
            renderAll();
          } catch {
            alert("Could not parse .scriptlab.json file.");
          }
        };
        reader.readAsText(f);
        return;
      }

      if (e.target.id === "sl-filter-source") {
        filterSource = e.target.value;
        archiveRenderLimit = 90;
        renderArchive();
        return;
      }
      if (e.target.id === "sl-filter-speaker") {
        filterSpeaker = e.target.value;
        archiveRenderLimit = 90;
        renderArchive();
        return;
      }
      if (e.target.id === "sl-filter-theme") {
        filterTheme = e.target.value;
        archiveRenderLimit = 90;
        renderArchive();
        return;
      }
      if (e.target.id === "sl-hide-short") {
        filterHideShort = e.target.checked;
        renderArchive();
        return;
      }
      if (e.target.id === "sl-verified-only") {
        filterVerifiedOnly = e.target.checked;
        renderArchive();
        return;
      }
      if (e.target.id === "sl-unused-only") {
        filterUnusedOnly = e.target.checked;
        renderArchive();
        return;
      }

      if (e.target.dataset.slugField) {
        const sc = state.scenes.find((s) => s.id === e.target.dataset.sceneId);
        if (sc) {
          sc[e.target.dataset.slugField] = e.target.value;
          saveState();
          renderScreenplay();
          renderDirectorsTable();
        }
        return;
      }

      if (e.target.dataset.dtField) {
        const sc = state.scenes.find((s) => s.id === e.target.dataset.sceneId);
        if (sc) {
          sc[e.target.dataset.dtField] = e.target.value;
          saveState();
        }
        return;
      }

      if (e.target.dataset.charmapSpeaker) {
        updateActorCharacterMap(e.target.dataset.charmapSpeaker, e.target.value);
        return;
      }

      if (e.target.dataset.charInput) {
        const sc = state.scenes.find((s) => s.id === e.target.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === e.target.dataset.charInput);
        if (!el) return;
        const val = e.target.value.trim().toUpperCase();
        if (el.speaker && val) {
          updateActorCharacterMap(el.speaker, val);
        } else if (val) {
          el.character = val;
          e.target.value = val;
          saveState();
          renderDirectorsTable();
        }
      }
    });

    root.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "sl-search") {
        filterQuery = t.value;
        archiveRenderLimit = 90;
        renderArchive();
        return;
      }
      if (t.id === "sl-script-title") {
        state.title = t.value;
        saveState();
        return;
      }
      if (t.dataset.slugLocation) {
        const sc = state.scenes.find((s) => s.id === t.dataset.slugLocation);
        if (sc) {
          sc.location = t.value.toUpperCase();
          const sIdx = state.scenes.indexOf(sc);
          const slugMirror = root.querySelector(`[data-print-slug="${CSS.escape(sc.id)}"]`);
          if (slugMirror) slugMirror.textContent = `${sIdx + 1}   ${formatSlugline(sc)}   ${sIdx + 1}`;
          saveState();
          renderDirectorsTable();
        }
        return;
      }
      if (t.dataset.actionTextarea) {
        const sc = state.scenes.find((s) => s.id === t.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === t.dataset.actionTextarea);
        if (el) {
          el.text = t.value;
          const m = root.querySelector(`[data-print-action="${CSS.escape(el.id)}"]`);
          if (m) m.textContent = t.value;
          saveState();
        }
        return;
      }
      if (t.dataset.dlgTextarea) {
        const sc = state.scenes.find((s) => s.id === t.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === t.dataset.dlgTextarea);
        if (el && el.mode !== "ORIGINAL") {
          el.text = t.value;
          const m = root.querySelector(`[data-print-dlg="${CSS.escape(el.id)}"]`);
          if (m) m.textContent = t.value;
          saveState();
        }
        return;
      }
      if (t.dataset.parenInput) {
        const sc = state.scenes.find((s) => s.id === t.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === t.dataset.parenInput);
        if (el) {
          const raw = t.value.trim().replace(/^\(|\)$/g, "");
          el.parenthetical = raw;
          const m = root.querySelector(`[data-print-paren="${CSS.escape(el.id)}"]`);
          if (m) m.textContent = raw ? `(${raw})` : "";
          saveState();
        }
        return;
      }
      if (t.dataset.charInput && !t.dataset.speakerRef) {
        const sc = state.scenes.find((s) => s.id === t.dataset.sceneId);
        const el = sc?.elements.find((x) => x.id === t.dataset.charInput);
        if (el) {
          el.character = t.value.toUpperCase();
          const m = root.querySelector(`[data-print-char="${CSS.escape(el.id)}"]`);
          if (m) m.textContent = el.character;
          saveState();
        }
        return;
      }
      if (t.dataset.dtNotes) {
        const sc = state.scenes.find((s) => s.id === t.dataset.dtNotes);
        if (sc) {
          sc.notes = t.value;
          saveState();
        }
      }
    });

    // Drag & Drop Archive -> Scene
    root.addEventListener("dragstart", (e) => {
      const card = e.target.closest("[data-archive-card]");
      if (!card || !e.dataTransfer) return;
      const srcId = card.dataset.archiveCard;
      selectedArchiveLineId = srcId;
      e.dataTransfer.effectAllowed = "copy";
      e.dataTransfer.setData("text/plain", srcId);
      e.dataTransfer.setData("application/x-scriptlab-src", srcId);
    });
    root.addEventListener("dragover", (e) => {
      const page = e.target.closest("[data-scene-page]");
      if (!page) return;
      e.preventDefault();
      page.classList.add("drag-over");
    });
    root.addEventListener("dragleave", (e) => {
      const page = e.target.closest("[data-scene-page]");
      if (page && !page.contains(e.relatedTarget)) page.classList.remove("drag-over");
    });
    root.addEventListener("drop", (e) => {
      const page = e.target.closest("[data-scene-page]");
      if (!page) return;
      e.preventDefault();
      page.classList.remove("drag-over");
      const srcId = e.dataTransfer?.getData("application/x-scriptlab-src") || e.dataTransfer?.getData("text/plain");
      if (srcId && resolveArchiveLine(srcId)) addArchiveLineToScene(srcId, page.dataset.scenePage);
    });

    // Keyboard shortcuts
    window.addEventListener(
      "keydown",
      (e) => {
        if (root.hidden || !ytModal.hidden) {
          if (e.key === "Escape" && !ytModal.hidden) closeYouTubeModal();
          return;
        }
        const mod = e.metaKey || e.ctrlKey;
        const k = (e.key || "").toLowerCase();

        if (mod && k === "k") {
          e.preventDefault();
          if (window.innerWidth <= 1040) setMobileTab("archive");
          const sInp = document.getElementById("sl-search");
          if (sInp) {
            sInp.focus();
            sInp.select();
          }
          return;
        }
        if (mod && e.key === "Enter") {
          e.preventDefault();
          if (selectedArchiveLineId) addArchiveLineToScene(selectedArchiveLineId);
          return;
        }
        if (mod && e.shiftKey && k === "s") {
          e.preventDefault();
          createNewScene();
          return;
        }
        if (mod && !e.shiftKey && k === "e") {
          e.preventDefault();
          exportFountain();
          return;
        }
        if ((e.code === "Space" || e.key === " ") && !mod && !e.altKey) {
          if (!isTypingTarget(document.activeElement) && document.activeElement?.tagName !== "BUTTON") {
            e.preventDefault();
            togglePlayPause();
          }
        }
      },
      true
    );
  }

  function bootWorkbench() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) state = sanitizeLoadedState(JSON.parse(saved));
    } catch {}
    if (!state) state = buildStarterState();

    const lines = getActiveLines();
    selectedArchiveLineId = lines[0]?.id || null;
    activeMonitorLine = lines[0] || null;

    mountShell();
    renderAll();
    bindWorkbenchEvents();
    bindYouTubeModalEvents();
    initYouTubeWhenReady();
  }

  // Boot Gate + Verification
  wireGateUi();
  verifyInitialAccess();
})();
