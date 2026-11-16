#!/usr/bin/env python3
"""
220 Lab · Film Script Lab — Local YouTube & Apple Silicon Whisper Companion
===========================================================================
Works with ANY YouTube URL (public or unlisted), using your local residential
network connection (and optional `yt-dlp` / `mlx_whisper` fallback for raw
camera uploads with zero captions).

Modes:
  1. Start local Studio Bridge (auto-detected by scriptlab.cloud/app.html!):
     python3 scripts/ingest_youtube.py --serve

  2. Export a standalone `.json` transcript file for upload in Studio:
     python3 scripts/ingest_youtube.py "https://youtu.be/VIDEO_ID" --speaker "Speaker Name" -o transcript.json
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip"


def extract_video_id(raw: str) -> str:
    s = raw.strip()
    if re.fullmatch(r"[A-Za-z0-9_-]{11}", s):
        return s
    m = re.search(r"(?:v=|youtu\.be/|embed/|shorts/|live/)([A-Za-z0-9_-]{11})", s)
    return m.group(1) if m else ""


def norm_for_id(text: str) -> str:
    t = text.strip().lower().replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", t)


def make_src_id(video_id: str, seconds: int, speaker: str, text: str) -> str:
    digest = hashlib.sha1(f"{video_id}|{seconds}|{speaker}|{norm_for_id(text)}".encode("utf-8")).hexdigest()
    return f"SRC-{digest[:10]}"


def fetch_youtube_captions(video_id: str, lang: str = "en", custom_speaker: str = "") -> dict[str, Any]:
    body = json.dumps(
        {
            "context": {
                "client": {
                    "clientName": "ANDROID",
                    "clientVersion": "20.10.38",
                    "androidSdkVersion": 34,
                    "hl": "en",
                    "gl": "US",
                }
            },
            "videoId": video_id,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": ANDROID_UA},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        pdata = json.loads(resp.read().decode("utf-8"))

    details = pdata.get("videoDetails") or {}
    title = details.get("title") or f"YouTube ({video_id})"
    author = details.get("author") or "YouTube Creator"
    duration = int(details.get("lengthSeconds") or 0)
    tracks = ((pdata.get("captions") or {}).get("playerCaptionsTracklistRenderer") or {}).get("captionTracks") or []

    if not tracks:
        return {
            "ok": True,
            "captionsAvailable": False,
            "video": {
                "id": f"yt_{video_id}",
                "youtubeId": video_id,
                "title": title,
                "shortLabel": title[:32] + "…" if len(title) > 34 else title,
                "author": author,
                "durationSeconds": duration,
                "thumbnailUrl": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "lineCount": 0,
            },
            "lines": [],
        }

    pref = lang.lower()
    chosen = (
        next((t for t in tracks if (t.get("languageCode") or "").lower().startswith(pref) and t.get("kind") != "asr"), None)
        or next((t for t in tracks if (t.get("languageCode") or "").lower().startswith(pref)), None)
        or tracks[0]
    )

    cap_req = urllib.request.Request(chosen["baseUrl"], headers={"User-Agent": ANDROID_UA})
    with urllib.request.urlopen(cap_req, timeout=15) as cresp:
        xml_txt = cresp.read().decode("utf-8", errors="replace")

    segs: list[tuple[float, float, str]] = []
    if "<timedtext" in xml_txt and "<p " in xml_txt:
        for pm in re.finditer(r"<p\b([^>]*)>([\s\S]*?)</p>", xml_txt):
            attrs, inner = pm.group(1), pm.group(2)
            tm = re.search(r'\bt="(\d+)"', attrs)
            dm = re.search(r'\bd="(\d+)"', attrs)
            start = int(tm.group(1)) / 1000.0 if tm else 0.0
            dur = int(dm.group(1)) / 1000.0 if dm else 2.5
            clean = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", inner))).strip()
            if clean and not re.fullmatch(r"(\[music\]|\[applause\]|♪+)", clean, re.I):
                segs.append((start, dur, clean))
    else:
        for tm in re.finditer(r"<text\b([^>]*)>([\s\S]*?)</text>", xml_txt):
            attrs, inner = tm.group(1), tm.group(2)
            sm = re.search(r'\bstart="([\d.]+)"', attrs)
            dm = re.search(r'\bdur="([\d.]+)"', attrs)
            start = float(sm.group(1)) if sm else 0.0
            dur = float(dm.group(1)) if dm else 2.5
            clean = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", inner))).strip()
            if clean:
                segs.append((start, dur, clean))

    speaker = (custom_speaker or author or "SPEAKER").strip()
    merged: list[dict[str, Any]] = []
    cur: dict[str, Any] | None = None
    for st, dur, txt in segs:
        if cur is None:
            cur = {"start": st, "end": st + dur, "text": txt}
        elif (st - cur["end"] > 2.0) or (re.search(r'[.?!]["”]?$', cur["text"]) and len(cur["text"].split()) >= 7) or len(cur["text"].split()) >= 26:
            merged.append(cur)
            cur = {"start": st, "end": st + dur, "text": txt}
        else:
            cur["text"] = f"{cur['text']} {txt}".strip()
            cur["end"] = max(cur["end"], st + dur)
    if cur:
        merged.append(cur)

    source_id = f"yt_{video_id}"
    lines = []
    seen = set()
    for m in merged:
        sec = max(0, int(m["start"]))
        sid = make_src_id(video_id, sec, speaker, m["text"])
        if sid in seen:
            continue
        seen.add(sid)
        lines.append(
            {
                "id": sid,
                "workshopId": source_id,
                "youtubeId": video_id,
                "seconds": sec,
                "speaker": speaker,
                "speakerVerified": bool(custom_speaker),
                "text": m["text"],
                "wordCount": len(m["text"].split()),
                "themes": [],
            }
        )

    return {
        "ok": True,
        "captionsAvailable": len(lines) > 0,
        "video": {
            "id": source_id,
            "youtubeId": video_id,
            "title": title,
            "shortLabel": title[:32] + "…" if len(title) > 34 else title,
            "author": author,
            "durationSeconds": duration,
            "thumbnailUrl": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "languageCode": chosen.get("languageCode", "en"),
            "lineCount": len(lines),
        },
        "lines": lines,
    }


class BridgeHandler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self) -> None:
        if self.path != "/ingest":
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        payload = json.loads(raw or "{}")
        vid = extract_video_id(payload.get("url") or "")
        if not vid:
            self.send_response(400)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": "Invalid YouTube URL"}).encode("utf-8"))
            return

        result = fetch_youtube_captions(vid, payload.get("lang") or "en", payload.get("speaker") or "")
        out = json.dumps(result).encode("utf-8")
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(out)


def main() -> None:
    parser = argparse.ArgumentParser(description="220 Lab · Film Script Lab local YouTube bridge")
    parser.add_argument("url", nargs="?", help="YouTube URL or Video ID")
    parser.add_argument("--speaker", default="", help="Default speaker name")
    parser.add_argument("--lang", default="en", help="Preferred language code")
    parser.add_argument("-o", "--output", default="", help="Write JSON output to file")
    parser.add_argument("--serve", action="store_true", help="Run local Studio bridge on 127.0.0.1:8788")
    args = parser.parse_args()

    if args.serve:
        print("220 Lab · Film Script Lab local bridge listening on http://127.0.0.1:8788/ingest")
        HTTPServer(("127.0.0.1", 8788), BridgeHandler).serve_forever()
        return

    if not args.url:
        parser.error("Provide a YouTube URL or pass --serve")
    vid = extract_video_id(args.url)
    res = fetch_youtube_captions(vid, args.lang, args.speaker)
    txt = json.dumps(res, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(txt)
        print(f"Wrote {len(res['lines'])} lines for '{res['video']['title']}' -> {args.output}")
    else:
        print(txt)


if __name__ == "__main__":
    main()
