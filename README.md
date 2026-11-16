# 220 Lab · Film Script Lab (`scriptlab.cloud`)

**Turn any YouTube video into a verbatim shooting screenplay.**

Built by **220 Lab** (Zhan Petrov), **Film Script Lab** generalizes the verbatim workshop-to-screenplay workbench pioneered on *Precipice* so directors, documentary editors, biopic screenwriters, and investigative journalists can cut and write from **any public or unlisted YouTube video**.

- **Production Domain:** [https://scriptlab.cloud](https://scriptlab.cloud)
- **GitHub Pages Mirror:** [https://zhanpetrov.github.io/scriptlab/](https://zhanpetrov.github.io/scriptlab/)
- **Studio Workbench (Approval-Gated):** [`/app.html`](https://scriptlab.cloud/app.html)
- **220 Lab Waitlist Approval Console:** [`/admin.html`](https://scriptlab.cloud/admin.html)
- **Edge API (Cloudflare Worker + KV):** `https://scriptlab-api.zhanpetrov8.workers.dev`

---

## Core Architecture

1. **Universal YouTube Ingestion (`worker/index.js` + `scripts/ingest_youtube.py`)**
   - Paste any `youtube.com/watch?v=...`, `youtu.be/...`, Shorts, livestream, or unlisted video URL.
   - Extracts metadata, caption tracks, and natural spoken sentence beats, computing permanent **`SRC-` SHA-1 provenance IDs**:
     ```text
     "SRC-" + sha1("{youtubeId}|{seconds}|{speaker}|{normalized_text}")[:10]
     ```
   - Supports `.srt`, `.vtt`, Whisper `.json`, and plain timestamped transcript import right inside the Studio modal—plus a local Python companion (`python3 scripts/ingest_youtube.py --serve` on `127.0.0.1:8788`) for raw camera uploads.

2. **Four Unmistakable Dialogue Modes**
   - **`ORIGINAL` (Solid Forest Green):** Read-only verbatim spoken words locked to a permanent `SRC-` ID and YouTube timestamp. Editorial `[brackets]` appear grey/italic on screen and strip automatically in Fountain & PDF printouts.
   - **`ADAPTED` (Dashed Amber):** Editable screenplay rhythm while keeping the verbatim quote permanently attached underneath with 1-click **Restore Original**.
   - **`AI SUGGESTION` (Dotted Purple):** Quarantined dramatic bridges—never confused with a real person’s words.
   - **`WRITTEN` (Double Slate):** Pure screenwriter dialogue with no video source.

3. **Waitlist Approval Gate + Zhan Petrov Stripe Checkout + PostHog Telemetry**
   - Server-enforced waitlist (`POST /api/waitlist/apply`), 1-click approval & invite codes (`/admin.html`), 30-day HMAC-SHA256 Studio session tokens (`POST /api/auth/verify`), Hosted Stripe Checkout (`/api/checkout`) + verified Webhooks (`/api/stripe/webhook`), and PostHog funnel analytics (`config.js` + `scripts/analytics.js`).

4. **Production & Legal Clearance Exports**
   - **Fountain (`.fountain` · `⌘E`)** for Final Draft, Highland, and Fade In.
   - **US Letter Courier Prime PDF (`12pt`, `1.5in` left margin)** via native `@media print`.
   - **E&O Source Provenance CSV** linking every sourced line to its exact `https://youtu.be/...?t=Ns` timestamp.
   - **Portable `.scriptlab.json` Project Bundles** (backward-compatible with `precipice.scriptlab`).

---

## Local Companion Bridge (Optional)

```bash
python3 scripts/ingest_youtube.py --serve
```

---

## Security Guarantee

Zero secret keys (`sk_live_...`, `whsec_...`, Porkbun `pk1_...`/`sk1_...`, or `SCRIPTLAB_ADMIN_KEY`) are ever stored in this repository. All server secrets live exclusively in Cloudflare Worker encrypted bindings (`npx wrangler secret put`).
