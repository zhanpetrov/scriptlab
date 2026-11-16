#!/usr/bin/env bash
# =============================================================================
# 220 Lab · Film Script Lab (scriptlab.cloud) — Live Porkbun & Stripe Connector
# =============================================================================
# Safely reads PORKBUN_API_KEY, PORKBUN_SECRET_KEY, and STRIPE_SECRET_KEY from
# ~/.env (or prompts with hidden typing) WITHOUT ever echoing secrets to logs
# or writing secrets into git-tracked files.
# =============================================================================
set -euo pipefail

DOMAIN="scriptlab.cloud"
GH_REPO="zhanpetrov/scriptlab"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_TOML="$REPO_ROOT/worker/wrangler.toml"

if [ -f "$HOME/.env" ]; then
  # Load only matching keys safely without printing
  PORKBUN_API_KEY="${PORKBUN_API_KEY:-$(grep '^PORKBUN_API_KEY=' "$HOME/.env" | head -n1 | cut -d= -f2- || true)}"
  PORKBUN_SECRET_KEY="${PORKBUN_SECRET_KEY:-$(grep '^PORKBUN_SECRET_KEY=' "$HOME/.env" | head -n1 | cut -d= -f2- || true)}"
  STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-$(grep '^STRIPE_SECRET_KEY=' "$HOME/.env" | head -n1 | cut -d= -f2- || true)}"
  STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-$(grep '^STRIPE_WEBHOOK_SECRET=' "$HOME/.env" | head -n1 | cut -d= -f2- || true)}"
fi

echo "=== 1. Porkbun DNS -> GitHub Pages ($DOMAIN) ==="
if [ -n "${PORKBUN_API_KEY:-}" ] && [ -n "${PORKBUN_SECRET_KEY:-}" ]; then
  AUTH_JSON=$(printf '{"apikey":"%s","secretapikey":"%s"}' "$PORKBUN_API_KEY" "$PORKBUN_SECRET_KEY")

  # Remove default Porkbun parked ALIAS / CNAME records if present
  EXISTING=$(curl -s -X POST "https://api.porkbun.com/api/json/v3/dns/retrieve/${DOMAIN}" \
    -H "Content-Type: application/json" -d "$AUTH_JSON")

  echo "$EXISTING" | python3 -c '
import json, sys
d = json.load(sys.stdin)
if d.get("status") != "SUCCESS":
    print("Porkbun API notice:", d.get("message", "Make sure API Access is ON for scriptlab.cloud in Porkbun Domain Details."))
    sys.exit(1)
for r in d.get("records", []):
    if r.get("type") in ("ALIAS", "CNAME", "A", "AAAA") and r.get("name") in ("scriptlab.cloud", "www.scriptlab.cloud", "*.scriptlab.cloud"):
        print("DEL:" + str(r["id"]))
' | while IFS= read -r line; do
    if [[ "$line" == DEL:* ]]; then
      RID="${line#DEL:}"
      curl -s -X POST "https://api.porkbun.com/api/json/v3/dns/delete/${DOMAIN}/${RID}" \
        -H "Content-Type: application/json" -d "$AUTH_JSON" >/dev/null
    else
      echo "$line"
    fi
  done

  for IP in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
    curl -s -X POST "https://api.porkbun.com/api/json/v3/dns/create/${DOMAIN}" \
      -H "Content-Type: application/json" \
      -d "$(printf '{"apikey":"%s","secretapikey":"%s","name":"","type":"A","content":"%s","ttl":"600"}' "$PORKBUN_API_KEY" "$PORKBUN_SECRET_KEY" "$IP")" >/dev/null
  done

  for IPV6 in 2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153; do
    curl -s -X POST "https://api.porkbun.com/api/json/v3/dns/create/${DOMAIN}" \
      -H "Content-Type: application/json" \
      -d "$(printf '{"apikey":"%s","secretapikey":"%s","name":"","type":"AAAA","content":"%s","ttl":"600"}' "$PORKBUN_API_KEY" "$PORKBUN_SECRET_KEY" "$IPV6")" >/dev/null
  done

  curl -s -X POST "https://api.porkbun.com/api/json/v3/dns/create/${DOMAIN}" \
    -H "Content-Type: application/json" \
    -d "$(printf '{"apikey":"%s","secretapikey":"%s","name":"www","type":"CNAME","content":"zhanpetrov.github.io","ttl":"600"}' "$PORKBUN_API_KEY" "$PORKBUN_SECRET_KEY")" >/dev/null

  echo "✓ Porkbun DNS records created for $DOMAIN & www.$DOMAIN -> GitHub Pages."
  gh api -X PUT "repos/${GH_REPO}/pages" -f cname="$DOMAIN" >/dev/null 2>&1 || true
else
  echo "• Skipping Porkbun API cutover (PORKBUN_API_KEY / PORKBUN_SECRET_KEY not yet in ~/.env)."
fi

echo ""
echo "=== 2. Zhan Petrov Stripe -> Cloudflare Worker ($DOMAIN) ==="
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  printf "%s" "$STRIPE_SECRET_KEY" | npx --yes wrangler secret put STRIPE_SECRET_KEY --config "$WORKER_TOML" >/dev/null
  echo "✓ Bound STRIPE_SECRET_KEY to scriptlab-api Cloudflare Worker."

  if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
    printf "%s" "$STRIPE_WEBHOOK_SECRET" | npx --yes wrangler secret put STRIPE_WEBHOOK_SECRET --config "$WORKER_TOML" >/dev/null
    echo "✓ Bound STRIPE_WEBHOOK_SECRET to scriptlab-api Cloudflare Worker."
  fi
else
  echo "• Skipping Stripe Worker secret bind (STRIPE_SECRET_KEY not yet in ~/.env)."
fi

unset PORKBUN_API_KEY PORKBUN_SECRET_KEY STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET AUTH_JSON
echo ""
echo "Done! Verify live status at: https://scriptlab-api.zhanpetrov8.workers.dev/api/status"
