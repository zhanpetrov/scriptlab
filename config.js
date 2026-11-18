// ============================================================================
// 220 LAB · FILM SCRIPT LAB (scriptlab.cloud) — Central Configuration
// ============================================================================
// Single source of truth for:
// 1. Custom Domain (`scriptlab.cloud` via Porkbun + GitHub Pages)
// 2. Edge API (`scriptlab-api` Cloudflare Worker: Waitlist, Approval Gate,
//    Any-YouTube-Video Transcript Ingestion & Stripe Checkout)
// 3. Zhan Petrov PostHog Analytics (`phc_...` public project ingestion token)
// 4. Zhan Petrov Stripe Commercial Checkout (Worker API or Payment Links)
//
// SECURITY RULE: NEVER place secret keys (`sk_live_...`, `rk_live_...`,
// `whsec_...`, Porkbun `pk1_...`/`sk1_...`, or `SCRIPTLAB_ADMIN_KEY`) here.
// ============================================================================

window.SCRIPTLAB_CONFIG = {
  BRAND: "220 Lab",
  PRODUCT_NAME: "Film Script Lab",
  FULL_TITLE: "220 Lab · Film Script Lab",
  SITE_URL: "https://scriptlab.cloud",
  GITHUB_REPO: "https://github.com/zhanpetrov/scriptlab",

  // Live Cloudflare Worker API (Waitlist, Approval Gate, YouTube Ingest & Stripe)
  WORKER_URL: "https://scriptlab-api.zhanpetrov8.workers.dev",

  // Zhan Petrov PostHog Analytics (US Cloud)
  POSTHOG_KEY: "phc_uJr3VL227dqniV4s4QLjuRvL65oqhhF4TKocPeHgTTPb",
  POSTHOG_HOST: "https://us.i.posthog.com",

  // Commercial Checkout Mode:
  // - "worker": Uses Cloudflare Worker `/api/checkout` with STRIPE_SECRET_KEY
  // - "links":  Uses direct Stripe Payment Links pasted into `plans.*.paymentLink`
  STRIPE_MODE: "worker",
  STRIPE_PUBLISHABLE_KEY: "",

  // Commercial Plans (Zhan Petrov Stripe)
  plans: {
    beta: {
      id: "beta",
      name: "Early Access Cohort",
      badge: "Approval Required",
      price: "$0",
      period: "during beta",
      cta: "Request Approval",
      paymentLink: "",
    },
    creator: {
      id: "creator",
      name: "Creator",
      badge: "Individual Filmmaker",
      price: "$29",
      period: "/ month",
      cta: "Start Creator Plan",
      paymentLink: "", // Optional direct https://buy.stripe.com/... link
    },
    studio: {
      id: "studio",
      name: "Studio",
      badge: "Production & Editorial",
      price: "$79",
      period: "/ month",
      cta: "Start Studio Plan",
      paymentLink: "", // Optional direct https://buy.stripe.com/... link
    },
    lifetime: {
      id: "lifetime",
      name: "Founding Pass",
      badge: "Limited · First 100 Filmmakers",
      price: "$249",
      period: "one-time",
      cta: "Buy Founding Pass — $249",
      paymentLink: "", // Optional direct https://buy.stripe.com/... link
    },
  },

  // [ZHAN: hello@scriptlab.cloud?]
  CONTACT_EMAIL: "zhanpetrov8@gmail.com",
  STUDIO_CREDITS: "A film by Zhan Petrov / 220 Lab",
};
