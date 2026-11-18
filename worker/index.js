/**
 * 220 Lab · Film Script Lab — Production Edge API (scriptlab.cloud)
 *
 * Responsibilities:
 * 1. Waitlist intake & approval status check (`POST /api/waitlist/apply`, `GET /api/waitlist/status`)
 * 2. Studio access verification & 30-day HMAC session tokens (`POST /api/auth/verify`)
 * 3. Admin approval & invite-code console API (`/api/admin/*`)
 * 4. Real-time Any-YouTube-Video caption/transcript & metadata ingestion (`POST|GET /api/youtube/ingest`)
 *    computing canonical Precipice-compatible permanent `SRC-` SHA-1 provenance IDs.
 * 5. Zhan Petrov Stripe Hosted Checkout & verified Webhook fulfillment (`/api/checkout`, `/api/stripe/*`)
 *
 * Security: Zero secret keys ever leave Worker bindings.
 */

const enc = new TextEncoder();

const PUBLIC_DEMO_VIDEOS = new Set([
  "UF8uR6Z6KLc", // Steve Jobs — 2005 Stanford Commencement Address
  "WnCSXFsJFh8", // PRECIPICE Workshop #3
  "RxiiSR6sZyQ", // PRECIPICE Workshop #2
]);

const THEME_PATTERNS = [
  ["power", /\b(power|powerful|control|authority|boss|rule|ruler|throne|dominate|agency|obey|system|empire|command)\b/i],
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

async function sha1Hex(input) {
  const buf = await crypto.subtle.digest("SHA-1", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(b64) {
  const pad = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "===".slice((pad.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}

async function mintSessionToken(payload, secret) {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 60 * 60 * 24 * 30; // 30 days
  const body = {
    email: String(payload.email || "").toLowerCase(),
    name: String(payload.name || ""),
    tier: String(payload.tier || "beta"),
    iat: nowSec,
    exp: expSec,
  };
  const encoded = b64urlEncode(JSON.stringify(body));
  const sig = await hmacHex(secret, `sl_sess.${encoded}`);
  return {
    token: `sl_sess.${encoded}.${sig}`,
    expiresAt: new Date(expSec * 1000).toISOString(),
    session: body,
  };
}

async function verifySessionToken(token, secret) {
  if (!token || !secret || typeof token !== "string" || !token.startsWith("sl_sess.")) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expected = await hmacHex(secret, `sl_sess.${encoded}`);
  if (!timingSafeEqualStr(sig, expected)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(encoded));
    const nowSec = Math.floor(Date.now() / 1000);
    if (!parsed.exp || parsed.exp < nowSec) return null;
    return parsed;
  } catch {
    return null;
  }
}

function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return `SL-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
}

function corsHeaders(env, origin) {
  const configured = (env.ALLOWED_ORIGINS || "https://scriptlab.cloud")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  const allowOrigin =
    isLocal || configured.includes(origin) ? origin : configured[0] || "https://scriptlab.cloud";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

function jsonResp(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function normalizeEmail(raw) {
  const e = String(raw || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || e.length > 180) return "";
  return e;
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

function decodeXmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function normalizeForSrcId(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");
}

function detectThemes(text) {
  const matched = [];
  for (const [name, rx] of THEME_PATTERNS) {
    if (rx.test(text)) matched.push(name);
  }
  return matched;
}

function countWords(text) {
  const clean = String(text || "").replace(/\s*\[[^\]]*\]/g, "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter((t) => /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]/.test(t)).length;
}

function parseTimedTextXml(xmlText, defaultSpeaker) {
  const rawSegs = [];

  if (xmlText.includes("<timedtext") && xmlText.includes("<p ")) {
    const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pRe.exec(xmlText)) !== null) {
      const attrs = pm[1] || "";
      const tMatch = attrs.match(/\bt="(\d+)"/);
      const dMatch = attrs.match(/\bd="(\d+)"/);
      const start = tMatch ? parseInt(tMatch[1], 10) / 1000 : 0;
      const dur = dMatch ? parseInt(dMatch[1], 10) / 1000 : 2.5;
      let txt = decodeXmlEntities(pm[2].replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim();
      if (!txt) continue;
      if (/^(\[music\]|\[applause\]|\[laughter\]|♪+|\(music\))$/i.test(txt)) continue;
      txt = txt.replace(/^♪+\s*|\s*♪+$/g, "").trim();
      if (!txt) continue;
      rawSegs.push({ start, dur, text: txt });
    }
  } else {
    const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
    let m;
    while ((m = re.exec(xmlText)) !== null) {
      const attrs = m[1] || "";
      const startMatch = attrs.match(/\bstart="([\d.]+)"/);
      const durMatch = attrs.match(/\bdur="([\d.]+)"/);
      const start = startMatch ? parseFloat(startMatch[1]) : 0;
      const dur = durMatch ? parseFloat(durMatch[1]) : 2.5;
      let txt = decodeXmlEntities(m[2].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
      if (!txt) continue;
      if (/^(\[music\]|\[applause\]|\[laughter\]|♪+|\(music\))$/i.test(txt)) continue;
      txt = txt.replace(/^♪+\s*|\s*♪+$/g, "").trim();
      if (!txt) continue;
      rawSegs.push({ start, dur, text: txt });
    }
  }

  // Coalesce short ASR fragments into natural screenplay dialogue beats
  const merged = [];
  let current = null;

  for (const seg of rawSegs) {
    let segText = seg.text;
    let explicitSpeaker = "";

    // Detect explicit speaker tags e.g. " >> STEVE JOBS: " or "INTERVIEWER: "
    const spkMatch = segText.match(/^(?:>>\s*)?([A-Z][A-Z0-9 .'-]{1,28}):\s+(.+)$/);
    if (spkMatch) {
      explicitSpeaker = spkMatch[1].trim();
      segText = spkMatch[2].trim();
    } else if (segText.startsWith(">>")) {
      segText = segText.replace(/^>>\s*/, "").trim();
      if (current) {
        merged.push(current);
        current = null;
      }
    }

    if (!current) {
      current = {
        start: seg.start,
        end: seg.start + seg.dur,
        speaker: explicitSpeaker || defaultSpeaker,
        speakerVerified: Boolean(explicitSpeaker),
        text: segText,
      };
    } else {
      const gap = seg.start - current.end;
      const curWords = countWords(current.text);
      const abbrevEnd = /(?:\b(?:U\.S|U\.K|U\.N|Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Inc|Ltd|Corp|Gov|Sen|Rep|Gen|Col|Lt|Sgt|Capt|Rev|Hon|Ph\.D|a\.m|p\.m|No|Fig|Jan|Feb|Mar|Apr|Aug|Sept|Oct|Nov|Dec)|(?:^|\s)[A-Z])\.["'”)]?$/i.test(current.text);
      const endsSentence = /[.?!]["'”)]?$/.test(current.text) && !abbrevEnd;
      const speakerChanged = explicitSpeaker && explicitSpeaker !== current.speaker;

      if (
        speakerChanged ||
        gap > 2.2 ||
        (endsSentence && curWords >= 7) ||
        curWords >= 28
      ) {
        merged.push(current);
        current = {
          start: seg.start,
          end: seg.start + seg.dur,
          speaker: explicitSpeaker || current.speaker || defaultSpeaker,
          speakerVerified: Boolean(explicitSpeaker),
          text: segText,
        };
      } else {
        current.text = `${current.text} ${segText}`.replace(/\s+/g, " ").trim();
        current.end = Math.max(current.end, seg.start + seg.dur);
      }
    }
  }
  if (current) merged.push(current);
  return merged;
}

async function fetchFallbackSubtitles(videoId, preferredLang = "en") {
  const pipedHosts = [
    "https://api.piped.private.coffee",
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
  ];
  const pref = (preferredLang || "en").toLowerCase();

  for (const host of pipedHosts) {
    try {
      const r = await fetch(`${host}/streams/${encodeURIComponent(videoId)}`, {
        headers: { Accept: "application/json", "User-Agent": "ScriptLab/1.0" },
      });
      if (!r.ok) continue;
      const d = await r.json();
      const subs = Array.isArray(d.subtitles) ? d.subtitles : [];
      if (!subs.length) continue;

      const chosen =
        subs.find((s) => (s.code || "").toLowerCase() === pref && !s.autoGenerated) ||
        subs.find((s) => (s.code || "").toLowerCase().startsWith(pref) && !s.autoGenerated) ||
        subs.find((s) => (s.code || "").toLowerCase() === pref) ||
        subs.find((s) => (s.code || "").toLowerCase().startsWith(pref)) ||
        subs[0];

      if (chosen && chosen.url) {
        const subTxt = await fetch(chosen.url).then((x) => (x.ok ? x.text() : ""));
        if (subTxt && subTxt.length > 20) {
          return {
            title: d.title || "",
            author: d.uploader || "",
            durationSeconds: Number(d.duration || 0),
            languageCode: chosen.code || "en",
            isAuto: Boolean(chosen.autoGenerated),
            availableTracks: subs.map((s) => ({
              languageCode: s.code || "en",
              name: s.name || s.code || "Track",
              isAuto: Boolean(s.autoGenerated),
            })),
            rawContent: subTxt,
            mimeType: chosen.mimeType || "",
          };
        }
      }
    } catch {}
  }
  return null;
}

function parseVttOrSrtToXml(vttText) {
  const lines = String(vttText || "").replace(/\r/g, "").split("\n");
  const items = [];
  const timeRe = /(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/;
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(timeRe);
    if (m) {
      const sH = Number(m[1] || 0), sM = Number(m[2] || 0), sS = Number(m[3] || 0), sMs = Number(m[4] || 0);
      const eH = Number(m[5] || 0), eM = Number(m[6] || 0), eS = Number(m[7] || 0), eMs = Number(m[8] || 0);
      const start = sH * 3600 + sM * 60 + sS + sMs / 1000;
      const end = eH * 3600 + eM * 60 + eS + eMs / 1000;
      const dur = Math.max(0.5, end - start);
      i++;
      const textParts = [];
      while (i < lines.length && lines[i].trim() !== "" && !timeRe.test(lines[i])) {
        const cleaned = lines[i].replace(/<[^>]+>/g, "").trim();
        if (cleaned) textParts.push(cleaned);
        i++;
      }
      const joined = textParts.join(" ").trim();
      if (joined) {
        items.push(`<text start="${start.toFixed(2)}" dur="${dur.toFixed(2)}">${joined.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`);
      }
    } else {
      i++;
    }
  }
  return `<transcript>${items.join("")}</transcript>`;
}

async function ingestYouTubeVideo(videoId, preferredLang = "en", customSpeaker = "") {
  const oembedPromise = fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
  ).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const clientAttempts = [
    {
      ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
      client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
        androidSdkVersion: 34,
        hl: "en",
        gl: "US",
      },
    },
    {
      ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
      client: {
        clientName: "IOS",
        clientVersion: "20.10.4",
        deviceMake: "Apple",
        deviceModel: "iPhone16,2",
        osName: "iPhone",
        osVersion: "18.3.2.22D82",
        hl: "en",
        gl: "US",
      },
    },
  ];

  let playerData = null;
  let activeUa = clientAttempts[0].ua;

  for (const attempt of clientAttempts) {
    const pRes = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": attempt.ua,
      },
      body: JSON.stringify({
        context: { client: attempt.client },
        videoId,
      }),
    }).catch(() => null);

    if (pRes && pRes.ok) {
      const candidate = await pRes.json().catch(() => null);
      const tracks = candidate?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (tracks.length > 0) {
        playerData = candidate;
        activeUa = attempt.ua;
        break;
      }
      if (!playerData && candidate?.videoDetails) {
        playerData = candidate;
      }
    }
  }

  const oembed = await oembedPromise;
  const details = playerData?.videoDetails || {};
  let title = details.title || oembed?.title || `YouTube Video (${videoId})`;
  let author = details.author || oembed?.author_name || "YouTube Creator";
  let durationSeconds = Number(details.lengthSeconds || 0);
  const thumbnailUrl =
    oembed?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const rawTracks =
    playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  let availableTracks = rawTracks.map((t) => ({
    languageCode: t.languageCode || "en",
    name:
      t.name?.simpleText ||
      (Array.isArray(t.name?.runs) ? t.name.runs.map((r) => r.text).join("") : t.languageCode || "Track"),
    isAuto: t.kind === "asr",
  }));

  let capXml = "";
  let chosenLang = "en";
  let chosenIsAuto = false;

  if (rawTracks.length > 0) {
    const pref = (preferredLang || "en").toLowerCase();
    const chosenTrack =
      rawTracks.find((t) => (t.languageCode || "").toLowerCase() === pref && t.kind !== "asr") ||
      rawTracks.find((t) => (t.languageCode || "").toLowerCase().startsWith(pref) && t.kind !== "asr") ||
      rawTracks.find((t) => (t.languageCode || "").toLowerCase() === pref) ||
      rawTracks.find((t) => (t.languageCode || "").toLowerCase().startsWith(pref)) ||
      rawTracks.find((t) => t.kind !== "asr") ||
      rawTracks[0];

    chosenLang = chosenTrack.languageCode || "en";
    chosenIsAuto = chosenTrack.kind === "asr";
    capXml = await fetch(chosenTrack.baseUrl, {
      headers: { "User-Agent": activeUa },
    }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  }

  // Fallback to Piped subtitle mirrors if datacenter IP hit YouTube bot check
  if (!capXml || capXml.length < 20) {
    const fb = await fetchFallbackSubtitles(videoId, preferredLang);
    if (fb) {
      if (fb.title && title.startsWith("YouTube Video")) title = fb.title;
      if (fb.author && author === "YouTube Creator") author = fb.author;
      if (fb.durationSeconds && !durationSeconds) durationSeconds = fb.durationSeconds;
      chosenLang = fb.languageCode;
      chosenIsAuto = fb.isAuto;
      availableTracks = fb.availableTracks;
      capXml = fb.rawContent.trim().startsWith("<")
        ? fb.rawContent
        : parseVttOrSrtToXml(fb.rawContent);
    }
  }

  if (!capXml || capXml.length < 20) {
    return {
      ok: true,
      captionsAvailable: false,
      video: {
        id: `yt_${videoId}`,
        youtubeId: videoId,
        title,
        shortLabel: title.length > 34 ? `${title.slice(0, 32).trim()}…` : title,
        author,
        durationSeconds,
        thumbnailUrl,
        languageCode: "",
        availableTracks: [],
        lineCount: 0,
      },
      lines: [],
    };
  }

  const fallbackSpeaker = (customSpeaker || author || "SPEAKER").trim();
  const parsedBeats = parseTimedTextXml(capXml, fallbackSpeaker);

  const sourceId = `yt_${videoId}`;
  const shortLabel = title.length > 34 ? `${title.slice(0, 32).trim()}…` : title;

  const lines = [];
  const seenIds = new Set();
  for (const beat of parsedBeats) {
    const seconds = Math.max(0, Math.floor(Number(beat.start) || 0));
    const norm = normalizeForSrcId(beat.text);
    if (!norm) continue;
    const hash = await sha1Hex(`${videoId}|${seconds}|${beat.speaker}|${norm}`);
    const srcId = `SRC-${hash.slice(0, 10)}`;
    if (seenIds.has(srcId)) continue;
    seenIds.add(srcId);

    lines.push({
      id: srcId,
      workshopId: sourceId,
      youtubeId: videoId,
      seconds,
      speaker: beat.speaker,
      speakerVerified: beat.speakerVerified,
      text: beat.text,
      wordCount: countWords(beat.text),
      themes: detectThemes(beat.text),
    });
  }

  return {
    ok: true,
    captionsAvailable: lines.length > 0,
    video: {
      id: sourceId,
      youtubeId: videoId,
      title,
      shortLabel,
      author,
      durationSeconds,
      thumbnailUrl,
      languageCode: chosenLang,
      isAutoCaptions: chosenIsAuto,
      availableTracks,
      lineCount: lines.length,
    },
    lines,
  };
}

export async function verifyStripeWebhookSignature(rawBody, sigHeader, webhookSecret, toleranceSec = 300) {
  if (!sigHeader || !webhookSecret) return { valid: false, reason: "missing_signature_or_secret" };
  const parts = sigHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const v1Sigs = [];
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx);
    const v = part.slice(idx + 1);
    if (k === "t") timestamp = v;
    if (k === "v1") v1Sigs.push(v);
  }
  if (!timestamp || v1Sigs.length === 0) return { valid: false, reason: "malformed_header" };
  const tsNum = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > toleranceSec) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }
  const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`);
  const matched = v1Sigs.some((s) => timingSafeEqualStr(s, expected));
  return matched ? { valid: true } : { valid: false, reason: "signature_mismatch" };
}

async function addEmailToIndex(kv, email) {
  const raw = await kv.get("index:waitlist_emails");
  let list = [];
  if (raw) {
    try {
      list = JSON.parse(raw);
    } catch {}
  }
  if (!list.includes(email)) {
    list.unshift(email);
    if (list.length > 5000) list = list.slice(0, 5000);
    await kv.put("index:waitlist_emails", JSON.stringify(list));
  }
  return list.length;
}

function checkAdminAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token || !env.ADMIN_ACCESS_KEY) return false;
  return timingSafeEqualStr(token, env.ADMIN_ACCESS_KEY);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(env, origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const signingSecret = env.AUTH_SIGNING_SECRET || "dev-fallback-override-in-prod";

    // 1. Health & Public Capabilities
    if (url.pathname === "/api/status" && request.method === "GET") {
      const rawIdx = await env.SCRIPTLAB_KV.get("index:waitlist_emails");
      let waitlistCount = 0;
      try {
        waitlistCount = rawIdx ? JSON.parse(rawIdx).length : 0;
      } catch {}
      return jsonResp(
        {
          service: "220-lab-film-script-lab",
          domain: "scriptlab.cloud",
          waitlist_enabled: true,
          waitlist_count: waitlistCount,
          youtube_ingest_enabled: true,
          checkout_ready: Boolean(env.STRIPE_SECRET_KEY),
          tiers: {
            creator: { cents: Number(env.PRICE_CREATOR_CENTS || 2900), mode: "subscription", display: "$29/mo" },
            studio: { cents: Number(env.PRICE_STUDIO_CENTS || 7900), mode: "subscription", display: "$79/mo" },
            lifetime: { cents: Number(env.PRICE_LIFETIME_CENTS || 24900), mode: "payment", display: "$249" },
          },
        },
        200,
        cors
      );
    }

    // 2. Waitlist Application
    if (url.pathname === "/api/waitlist/apply" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const email = normalizeEmail(body.email);
      if (!email) {
        return jsonResp({ ok: false, error: "Please enter a valid email address." }, 400, cors);
      }

      const name = String(body.name || "").trim().slice(0, 120);
      const role = String(body.role || "Filmmaker").trim().slice(0, 80);
      const youtubeUrl = String(body.youtube_url || "").trim().slice(0, 280);
      const planInterest = String(body.plan_interest || "beta").trim().slice(0, 40);
      const notes = String(body.notes || "").trim().slice(0, 600);

      const key = `waitlist:${email}`;
      const existingRaw = await env.SCRIPTLAB_KV.get(key);
      const nowIso = new Date().toISOString();

      if (existingRaw) {
        const existing = JSON.parse(existingRaw);
        const updated = {
          ...existing,
          name: name || existing.name,
          role: role || existing.role,
          youtube_url: youtubeUrl || existing.youtube_url,
          plan_interest: planInterest || existing.plan_interest,
          notes: notes || existing.notes,
          updated_at: nowIso,
        };
        await env.SCRIPTLAB_KV.put(key, JSON.stringify(updated));

        if (updated.status === "approved") {
          const minted = await mintSessionToken(updated, signingSecret);
          return jsonResp(
            {
              ok: true,
              status: "approved",
              already_approved: true,
              email: updated.email,
              name: updated.name,
              tier: updated.tier || "beta",
              access_code: updated.access_code || "",
              token: minted.token,
              expires_at: minted.expiresAt,
            },
            200,
            cors
          );
        }

        return jsonResp(
          {
            ok: true,
            status: updated.status || "pending",
            already_applied: true,
            email: updated.email,
            name: updated.name,
            queue_number: updated.queue_number || 1,
            applied_at: updated.applied_at,
          },
          200,
          cors
        );
      }

      const counterRaw = await env.SCRIPTLAB_KV.get("meta:waitlist_counter");
      const queueNumber = (Number(counterRaw || 40) || 40) + 1;
      await env.SCRIPTLAB_KV.put("meta:waitlist_counter", String(queueNumber));

      const record = {
        email,
        name: name || email.split("@")[0],
        role,
        youtube_url: youtubeUrl,
        plan_interest: planInterest,
        notes,
        status: "pending",
        tier: "beta",
        queue_number: queueNumber,
        applied_at: nowIso,
        updated_at: nowIso,
      };

      await env.SCRIPTLAB_KV.put(key, JSON.stringify(record));
      await addEmailToIndex(env.SCRIPTLAB_KV, email);

      return jsonResp(
        {
          ok: true,
          status: "pending",
          email: record.email,
          name: record.name,
          queue_number: queueNumber,
          applied_at: nowIso,
        },
        200,
        cors
      );
    }

    // 3. Check Waitlist Approval Status
    if (url.pathname === "/api/waitlist/status" && request.method === "GET") {
      const email = normalizeEmail(url.searchParams.get("email"));
      if (!email) {
        return jsonResp({ ok: false, error: "Valid email parameter required." }, 400, cors);
      }

      const raw = await env.SCRIPTLAB_KV.get(`waitlist:${email}`);
      if (!raw) {
        return jsonResp({ ok: true, found: false, status: "not_found" }, 200, cors);
      }

      const rec = JSON.parse(raw);
      if (rec.status === "approved") {
        const minted = await mintSessionToken(rec, signingSecret);
        return jsonResp(
          {
            ok: true,
            found: true,
            status: "approved",
            email: rec.email,
            name: rec.name,
            tier: rec.tier || "beta",
            access_code: rec.access_code || "",
            token: minted.token,
            expires_at: minted.expiresAt,
          },
          200,
          cors
        );
      }

      return jsonResp(
        {
          ok: true,
          found: true,
          status: rec.status || "pending",
          email: rec.email,
          name: rec.name,
          role: rec.role,
          queue_number: rec.queue_number || 1,
          applied_at: rec.applied_at,
        },
        200,
        cors
      );
    }

    // 4. Verify Studio Access (Token, Approved Email, Invite Code, or Stripe Session)
    if (url.pathname === "/api/auth/verify" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));

      // 4a. Existing Bearer / Session Token
      if (body.token) {
        const verified = await verifySessionToken(body.token, signingSecret);
        if (verified) {
          return jsonResp({ ok: true, authorized: true, session: verified }, 200, cors);
        }
      }

      // 4b. Stripe Checkout Session verification
      if (body.stripe_session_id && /^cs_(test|live)_[A-Za-z0-9]+$/.test(body.stripe_session_id)) {
        const sid = body.stripe_session_id;
        let entRaw = await env.SCRIPTLAB_KV.get(`ent:${sid}`);
        if (!entRaw && env.STRIPE_SECRET_KEY) {
          const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`, {
            headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
          });
          if (sRes.ok) {
            const sObj = await sRes.json();
            if (sObj.payment_status === "paid" || sObj.status === "complete") {
              const custEmail = normalizeEmail(sObj.customer_details?.email || body.email || "") || `${sid}@stripe.scriptlab.cloud`;
              const custName = sObj.customer_details?.name || custEmail.split("@")[0];
              const tier = sObj.metadata?.tier || "lifetime";
              const accessCode = generateAccessCode();
              const entRecord = {
                session_id: sid,
                email: custEmail,
                name: custName,
                tier,
                paid: true,
                fulfilled_at: new Date().toISOString(),
              };
              await env.SCRIPTLAB_KV.put(`ent:${sid}`, JSON.stringify(entRecord));
              const wlRec = {
                email: custEmail,
                name: custName,
                role: "Pro Filmmaker",
                status: "approved",
                tier,
                access_code: accessCode,
                approved_at: new Date().toISOString(),
                applied_at: new Date().toISOString(),
              };
              await env.SCRIPTLAB_KV.put(`waitlist:${custEmail}`, JSON.stringify(wlRec));
              await env.SCRIPTLAB_KV.put(
                `invite:${accessCode}`,
                JSON.stringify({ code: accessCode, tier, max_uses: 5, uses: 0, bound_email: custEmail })
              );
              await addEmailToIndex(env.SCRIPTLAB_KV, custEmail);
              entRaw = JSON.stringify(entRecord);
            }
          }
        }

        if (entRaw) {
          const ent = JSON.parse(entRaw);
          const minted = await mintSessionToken(ent, signingSecret);
          return jsonResp(
            {
              ok: true,
              authorized: true,
              token: minted.token,
              expires_at: minted.expiresAt,
              session: minted.session,
            },
            200,
            cors
          );
        }
      }

      // 4c. Invite / Approval Code verification
      const rawCode = String(body.invite_code || "").trim().toUpperCase();
      const inputEmail = normalizeEmail(body.email);

      if (rawCode) {
        // Check secret founder code if configured
        if (env.FOUNDER_INVITE_CODE && timingSafeEqualStr(rawCode, env.FOUNDER_INVITE_CODE.toUpperCase())) {
          const founderEmail = inputEmail || "founder@scriptlab.cloud";
          const minted = await mintSessionToken(
            { email: founderEmail, name: "220 Lab Founder", tier: "founder" },
            signingSecret
          );
          return jsonResp(
            {
              ok: true,
              authorized: true,
              token: minted.token,
              expires_at: minted.expiresAt,
              session: minted.session,
            },
            200,
            cors
          );
        }

        const invRaw = await env.SCRIPTLAB_KV.get(`invite:${rawCode}`);
        if (invRaw) {
          const inv = JSON.parse(invRaw);
          const maxUses = Number(inv.max_uses || 1);
          const uses = Number(inv.uses || 0);
          if (uses < maxUses || (inv.bound_email && inv.bound_email === inputEmail)) {
            inv.uses = uses + 1;
            await env.SCRIPTLAB_KV.put(`invite:${rawCode}`, JSON.stringify(inv));

            const targetEmail = inputEmail || inv.bound_email || `invited-${rawCode.toLowerCase()}@scriptlab.cloud`;
            const existingWlRaw = await env.SCRIPTLAB_KV.get(`waitlist:${targetEmail}`);
            const existingWl = existingWlRaw ? JSON.parse(existingWlRaw) : {};
            const wlRec = {
              ...existingWl,
              email: targetEmail,
              name: existingWl.name || body.name || targetEmail.split("@")[0],
              status: "approved",
              tier: inv.tier || "beta",
              access_code: rawCode,
              approved_at: new Date().toISOString(),
              applied_at: existingWl.applied_at || new Date().toISOString(),
            };
            await env.SCRIPTLAB_KV.put(`waitlist:${targetEmail}`, JSON.stringify(wlRec));
            await addEmailToIndex(env.SCRIPTLAB_KV, targetEmail);

            const minted = await mintSessionToken(wlRec, signingSecret);
            return jsonResp(
              {
                ok: true,
                authorized: true,
                token: minted.token,
                expires_at: minted.expiresAt,
                session: minted.session,
              },
              200,
              cors
            );
          }
          return jsonResp({ ok: false, authorized: false, error: "This invite code has reached its maximum uses." }, 403, cors);
        }
        return jsonResp({ ok: false, authorized: false, error: "Invalid invite or approval code." }, 403, cors);
      }

      // 4d. Approved Email lookup
      if (inputEmail) {
        const wlRaw = await env.SCRIPTLAB_KV.get(`waitlist:${inputEmail}`);
        if (!wlRaw) {
          return jsonResp(
            {
              ok: false,
              authorized: false,
              status: "not_found",
              error: "No waitlist application found for this email. Request access first.",
            },
            403,
            cors
          );
        }
        const wl = JSON.parse(wlRaw);
        if (wl.status !== "approved") {
          return jsonResp(
            {
              ok: false,
              authorized: false,
              status: wl.status || "pending",
              queue_number: wl.queue_number || 1,
              error: `Your application (#${wl.queue_number || 1}) is pending 220 Lab approval.`,
            },
            403,
            cors
          );
        }
        const minted = await mintSessionToken(wl, signingSecret);
        return jsonResp(
          {
            ok: true,
            authorized: true,
            token: minted.token,
            expires_at: minted.expiresAt,
            session: minted.session,
          },
          200,
          cors
        );
      }

      return jsonResp({ ok: false, authorized: false, error: "Approval verification required." }, 401, cors);
    }

    // 5. Real-Time Any-YouTube-Video Ingestion API
    if (url.pathname === "/api/youtube/ingest" && (request.method === "POST" || request.method === "GET")) {
      let rawUrl = "";
      let lang = "en";
      let speaker = "";
      let forceRefresh = false;

      if (request.method === "GET") {
        rawUrl = url.searchParams.get("url") || url.searchParams.get("v") || "";
        lang = url.searchParams.get("lang") || "en";
        speaker = url.searchParams.get("speaker") || "";
        forceRefresh = url.searchParams.get("refresh") === "1";
      } else {
        const body = await request.json().catch(() => ({}));
        rawUrl = body.url || body.videoId || "";
        lang = body.lang || "en";
        speaker = body.speaker || "";
        forceRefresh = Boolean(body.force_refresh);
      }

      const videoId = extractYouTubeId(rawUrl);
      if (!videoId) {
        return jsonResp({ ok: false, error: "Enter a valid YouTube video URL or 11-character Video ID." }, 400, cors);
      }

      // Enforce approval unless requesting one of the public landing-page demo videos
      if (!PUBLIC_DEMO_VIDEOS.has(videoId)) {
        const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
        const session = await verifySessionToken(bearer, signingSecret);
        const isAdmin = checkAdminAuth(request, env);
        if (!session && !isAdmin) {
          return jsonResp(
            {
              ok: false,
              error: "Approved 220 Lab Studio session required to ingest custom YouTube videos.",
              requires_approval: true,
            },
            401,
            cors
          );
        }
      }

      const cacheKey = `ytcache:v1:${videoId}:${lang.toLowerCase()}:${speaker.toLowerCase()}`;
      if (!forceRefresh) {
        const cached = await env.SCRIPTLAB_KV.get(cacheKey);
        if (cached) {
          return new Response(cached, {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          });
        }
      }

      try {
        const result = await ingestYouTubeVideo(videoId, lang, speaker);
        const serialized = JSON.stringify(result);
        if (result.captionsAvailable) {
          await env.SCRIPTLAB_KV.put(cacheKey, serialized, { expirationTtl: 60 * 60 * 24 });
        }
        return new Response(serialized, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...cors,
          },
        });
      } catch (err) {
        return jsonResp(
          {
            ok: false,
            error: "Unable to reach YouTube caption service right now. You can also import an .srt / .vtt transcript directly.",
            detail: String(err?.message || err),
          },
          502,
          cors
        );
      }
    }

    // 6. Zhan Petrov Stripe Hosted Checkout Session
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const tier = ["creator", "studio", "lifetime"].includes(body.tier) ? body.tier : "lifetime";
      const email = normalizeEmail(body.email);

      if (!env.STRIPE_SECRET_KEY) {
        return jsonResp(
          {
            ok: false,
            status: "stripe_key_pending",
            tier,
            error:
              "Instant checkout is connecting to Zhan Petrov's Stripe account. Request priority waitlist approval below and you'll be notified first.",
          },
          503,
          cors
        );
      }

      const siteBase = (env.PUBLIC_SITE_URL || "https://scriptlab.cloud").replace(/\/$/, "");
      const tierSpecs = {
        creator: {
          mode: "subscription",
          priceId: env.STRIPE_PRICE_CREATOR || "",
          amount: String(env.PRICE_CREATOR_CENTS || "2900"),
          name: "220 Lab · Film Script Lab — Creator Plan",
          desc: "Unlimited YouTube video transcript ingestions, 4-mode provenance screenplay workbench, Fountain & PDF exports.",
          interval: "month",
        },
        studio: {
          mode: "subscription",
          priceId: env.STRIPE_PRICE_STUDIO || "",
          amount: String(env.PRICE_STUDIO_CENTS || "7900"),
          name: "220 Lab · Film Script Lab — Studio Plan",
          desc: "Multi-video documentary & rehearsal rooms, source-linked E&O provenance CSV ledgers, priority support.",
          interval: "month",
        },
        lifetime: {
          mode: "payment",
          priceId: env.STRIPE_PRICE_LIFETIME || "",
          amount: String(env.PRICE_LIFETIME_CENTS || "24900"),
          name: "220 Lab · Film Script Lab — Founding Pass",
          desc: "One-time Founding Pass. Instant Studio approval, unlimited YouTube sources, Fountain, Courier Prime PDF & E&O CSV.",
          interval: null,
        },
      };

      const spec = tierSpecs[tier];
      const params = new URLSearchParams();
      params.set("mode", spec.mode);
      params.set("allow_promotion_codes", "true");
      if (email) params.set("customer_email", email);

      if (spec.priceId) {
        params.set("line_items[0][price]", spec.priceId);
      } else {
        params.set("line_items[0][price_data][currency]", (env.STRIPE_CURRENCY || "usd").toLowerCase());
        params.set("line_items[0][price_data][unit_amount]", spec.amount);
        params.set("line_items[0][price_data][product_data][name]", spec.name);
        params.set("line_items[0][price_data][product_data][description]", spec.desc);
        if (spec.interval) {
          params.set("line_items[0][price_data][recurring][interval]", spec.interval);
        }
      }

      params.set("line_items[0][quantity]", "1");
      params.set("success_url", `${siteBase}/app.html?session_id={CHECKOUT_SESSION_ID}`);
      params.set("cancel_url", `${siteBase}/#pricing`);
      params.set("metadata[product]", "220-lab-film-script-lab");
      params.set("metadata[tier]", tier);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const session = await stripeRes.json().catch(() => ({}));
      if (!stripeRes.ok || !session.url) {
        return jsonResp({ ok: false, error: "Could not initialize Stripe Checkout session." }, 502, cors);
      }

      return jsonResp({ ok: true, session_id: session.id, checkout_url: session.url }, 200, cors);
    }

    // 7. Verified Stripe Webhook
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
      const sigHeader = request.headers.get("Stripe-Signature") || "";
      const rawBody = await request.text();
      const check = await verifyStripeWebhookSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
      if (!check.valid) {
        return jsonResp({ error: "Invalid Stripe signature", reason: check.reason }, 400);
      }

      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        return jsonResp({ error: "Malformed JSON" }, 400);
      }

      const evtKey = `stripe_evt:${event.id}`;
      if (await env.SCRIPTLAB_KV.get(evtKey)) {
        return jsonResp({ received: true, idempotent_replay: true }, 200);
      }

      const isPaid =
        (event.type === "checkout.session.completed" &&
          (event.data?.object?.payment_status === "paid" || event.data?.object?.status === "complete")) ||
        event.type === "checkout.session.async_payment_succeeded";

      if (isPaid) {
        const sObj = event.data.object;
        const custEmail =
          normalizeEmail(sObj.customer_details?.email || sObj.customer_email || "") ||
          `${sObj.id}@stripe.scriptlab.cloud`;
        const custName = sObj.customer_details?.name || custEmail.split("@")[0];
        const tier = sObj.metadata?.tier || "lifetime";
        const accessCode = generateAccessCode();

        await env.SCRIPTLAB_KV.put(
          `ent:${sObj.id}`,
          JSON.stringify({
            session_id: sObj.id,
            email: custEmail,
            name: custName,
            tier,
            paid: true,
            amount_total: sObj.amount_total || 0,
            fulfilled_at: new Date().toISOString(),
          })
        );

        const wlRec = {
          email: custEmail,
          name: custName,
          role: "Stripe Pro Member",
          status: "approved",
          tier,
          access_code: accessCode,
          stripe_session_id: sObj.id,
          approved_at: new Date().toISOString(),
          applied_at: new Date().toISOString(),
        };
        await env.SCRIPTLAB_KV.put(`waitlist:${custEmail}`, JSON.stringify(wlRec));
        await env.SCRIPTLAB_KV.put(
          `invite:${accessCode}`,
          JSON.stringify({ code: accessCode, tier, max_uses: 5, uses: 0, bound_email: custEmail })
        );
        await addEmailToIndex(env.SCRIPTLAB_KV, custEmail);
      }

      await env.SCRIPTLAB_KV.put(evtKey, "1", { expirationTtl: 60 * 60 * 24 * 60 });
      return jsonResp({ received: true, idempotent_replay: false }, 200);
    }

    // 8. Admin Waitlist Approval & Invite Endpoints
    if (url.pathname.startsWith("/api/admin/")) {
      if (!checkAdminAuth(request, env)) {
        return jsonResp({ ok: false, error: "Unauthorized: valid 220 Lab Admin Key required." }, 401, cors);
      }

      if (url.pathname === "/api/admin/waitlist" && request.method === "GET") {
        const rawIdx = await env.SCRIPTLAB_KV.get("index:waitlist_emails");
        const emails = rawIdx ? JSON.parse(rawIdx) : [];
        const records = [];
        for (const em of emails.slice(0, 250)) {
          const r = await env.SCRIPTLAB_KV.get(`waitlist:${em}`);
          if (r) records.push(JSON.parse(r));
        }
        const rawInvIdx = await env.SCRIPTLAB_KV.get("index:invite_codes");
        const codes = rawInvIdx ? JSON.parse(rawInvIdx) : [];
        const invites = [];
        for (const c of codes.slice(0, 100)) {
          const ir = await env.SCRIPTLAB_KV.get(`invite:${c}`);
          if (ir) invites.push(JSON.parse(ir));
        }

        const counts = {
          total: records.length,
          pending: records.filter((x) => x.status === "pending").length,
          approved: records.filter((x) => x.status === "approved").length,
          rejected: records.filter((x) => x.status === "rejected").length,
        };

        return jsonResp({ ok: true, counts, records, invites }, 200, cors);
      }

      if (url.pathname === "/api/admin/approve" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        if (!email) return jsonResp({ ok: false, error: "Valid email required." }, 400, cors);

        const existingRaw = await env.SCRIPTLAB_KV.get(`waitlist:${email}`);
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        const accessCode = existing.access_code || generateAccessCode();
        const tier = body.tier || existing.tier || "beta";
        const nowIso = new Date().toISOString();

        const updated = {
          ...existing,
          email,
          name: body.name || existing.name || email.split("@")[0],
          role: body.role || existing.role || "Approved Filmmaker",
          status: "approved",
          tier,
          access_code: accessCode,
          approved_at: nowIso,
          applied_at: existing.applied_at || nowIso,
          updated_at: nowIso,
        };

        await env.SCRIPTLAB_KV.put(`waitlist:${email}`, JSON.stringify(updated));
        await env.SCRIPTLAB_KV.put(
          `invite:${accessCode}`,
          JSON.stringify({
            code: accessCode,
            tier,
            max_uses: 10,
            uses: 0,
            bound_email: email,
            created_at: nowIso,
          })
        );
        await addEmailToIndex(env.SCRIPTLAB_KV, email);

        const siteBase = (env.PUBLIC_SITE_URL || "https://scriptlab.cloud").replace(/\/$/, "");
        const magicLink = `${siteBase}/app.html?email=${encodeURIComponent(email)}&code=${encodeURIComponent(accessCode)}`;

        return jsonResp({ ok: true, record: updated, magic_link: magicLink }, 200, cors);
      }

      if (url.pathname === "/api/admin/reject" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = normalizeEmail(body.email);
        if (!email) return jsonResp({ ok: false, error: "Valid email required." }, 400, cors);
        const existingRaw = await env.SCRIPTLAB_KV.get(`waitlist:${email}`);
        if (!existingRaw) return jsonResp({ ok: false, error: "Applicant not found." }, 404, cors);
        const updated = { ...JSON.parse(existingRaw), status: "rejected", updated_at: new Date().toISOString() };
        await env.SCRIPTLAB_KV.put(`waitlist:${email}`, JSON.stringify(updated));
        return jsonResp({ ok: true, record: updated }, 200, cors);
      }

      if (url.pathname === "/api/admin/invite/create" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const rawCustom = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
        const code = rawCustom || generateAccessCode();
        const maxUses = Math.max(1, Math.min(1000, Number(body.max_uses || 10)));
        const tier = body.tier || "beta";
        const label = String(body.label || "Cohort Invite").slice(0, 80);

        const inv = {
          code,
          tier,
          max_uses: maxUses,
          uses: 0,
          label,
          created_at: new Date().toISOString(),
        };
        await env.SCRIPTLAB_KV.put(`invite:${code}`, JSON.stringify(inv));

        const rawInvIdx = await env.SCRIPTLAB_KV.get("index:invite_codes");
        const list = rawInvIdx ? JSON.parse(rawInvIdx) : [];
        if (!list.includes(code)) {
          list.unshift(code);
          await env.SCRIPTLAB_KV.put("index:invite_codes", JSON.stringify(list));
        }

        const siteBase = (env.PUBLIC_SITE_URL || "https://scriptlab.cloud").replace(/\/$/, "");
        return jsonResp(
          {
            ok: true,
            invite: inv,
            invite_url: `${siteBase}/app.html?code=${encodeURIComponent(code)}`,
          },
          200,
          cors
        );
      }
    }

    return jsonResp({ error: "Not found" }, 404, cors);
  },
};
