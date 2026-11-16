# CLAUDE.md — Operations & Live Wiring Playbook (`scriptlab.cloud`)

This repository powers **220 Lab · Film Script Lab** (`https://scriptlab.cloud`).

## What Is Already Live

1. **GitHub Repository & Pages:** `https://github.com/zhanpetrov/scriptlab` (`CNAME` -> `scriptlab.cloud`).
2. **Cloudflare Worker + KV (`scriptlab-api`):**
   - Deployed at `https://scriptlab-api.zhanpetrov8.workers.dev`
   - KV Namespace `SCRIPTLAB_KV` (`cda828eb5a0f4cfa88122020bc316bbe`)
   - `AUTH_SIGNING_SECRET`, `ADMIN_ACCESS_KEY`, and `FOUNDER_INVITE_CODE` are already bound in Cloudflare Worker secrets (and stored locally in `~/.env` on the studio Mac as `SCRIPTLAB_ADMIN_KEY` and `SCRIPTLAB_FOUNDER_CODE`).
   - Founder email `zhanpetrov8@gmail.com` is already approved (`tier: "founder"`).
3. **Zhan Petrov PostHog Analytics:**
   - Connected live in `config.js` (`phc_uJr3VL227dqniV4s4QLjuRvL65oqhhF4TKocPeHgTTPb` on `https://us.i.posthog.com`) with super-property `product = "220-lab-film-script-lab"`.

---

## Final 60-Second Live Cutover: Porkbun (`scriptlab.cloud`) + Zhan Petrov Stripe

Never paste secret keys into chat or commit them to git. Run these hidden-input commands directly in your macOS Terminal:

```bash
# 1. Save Porkbun API keys (https://porkbun.com/account/api — ensure API Access is ON for scriptlab.cloud)
printf "Enter PORKBUN_API_KEY (typing hidden): " && read -s val && echo && echo "PORKBUN_API_KEY=$val" >> ~/.env && echo "Saved."
printf "Enter PORKBUN_SECRET_KEY (typing hidden): " && read -s val && echo && echo "PORKBUN_SECRET_KEY=$val" >> ~/.env && echo "Saved."

# 2. Save Zhan Petrov Stripe Secret Key (https://dashboard.stripe.com/apikeys)
printf "Enter STRIPE_SECRET_KEY (typing hidden): " && read -s val && echo && echo "STRIPE_SECRET_KEY=$val" >> ~/.env && echo "Saved."

# 3. Run the automated connector (points Porkbun DNS -> GitHub Pages & binds Stripe to Cloudflare Worker)
bash "/Volumes/T7 Shield/DID AI KILL US ????/scriptlab/scripts/connect_live.sh"
```

### Optional: Stripe Webhook for Redundant Async Fulfillment
In Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- **Endpoint URL:** `https://scriptlab-api.zhanpetrov8.workers.dev/api/stripe/webhook`
- **Events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- Save `whsec_...` into `~/.env` (`STRIPE_WEBHOOK_SECRET=...`) and re-run `bash scripts/connect_live.sh`.

---

## Pre-Push Verification Checklist

```bash
export COPYFILE_DISABLE=1
dot_clean -m . 2>/dev/null || true
node --check config.js && node --check scripts/analytics.js && node --check scripts/landing.js && node --check scripts/studio.js && node --check scripts/admin.js && node --check worker/index.js
! git grep -E '(sk_live_|sk_test_|rk_live_|whsec_|sk1_|pk1_|sl_admin_)[0-9A-Za-z_]{10,}' -- .
```
