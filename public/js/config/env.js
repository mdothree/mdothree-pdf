/**
 * env.js — Runtime environment configuration
 *
 * How it works (no build step required):
 *   1. In development: values come from window.__ENV__ set by a <script> in index/layout HTML
 *   2. In Vercel production: inject via vercel.json `env` block or a _headers/_middleware file
 *   3. Fallback: placeholder strings (app degrades gracefully without Firebase/Stripe)
 *
 * To use locally without a build step, create public/js/config/env.local.js:
 *   window.__ENV__ = { FIREBASE_API_KEY: "...", STRIPE_KEY: "..." };
 * and add <script src="js/config/env.local.js"></script> to your HTML (gitignored).
 */

function getEnv(key, fallback = '') {
  // Priority: window.__ENV__ > meta[name="env-KEY"] > fallback
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }
  const meta = document.querySelector(`meta[name="env-${key}"]`);
  if (meta) return meta.getAttribute('content') || fallback;
  return fallback;
}

export const ENV = {
  // ── Firebase ───────────────────────────────────────────────
  FIREBASE_API_KEY:            getEnv('FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN:        getEnv('FIREBASE_AUTH_DOMAIN'),
  FIREBASE_PROJECT_ID:         getEnv('FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET:     getEnv('FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID:getEnv('FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID:             getEnv('FIREBASE_APP_ID'),
  FIREBASE_MEASUREMENT_ID:     getEnv('FIREBASE_MEASUREMENT_ID'),

  // ── Stripe ─────────────────────────────────────────────────
  STRIPE_PUBLISHABLE_KEY:      getEnv('STRIPE_PUBLISHABLE_KEY'),
  STRIPE_PRICE_MONTHLY:        getEnv('STRIPE_PRICE_MONTHLY'),
  STRIPE_PRICE_YEARLY:         getEnv('STRIPE_PRICE_YEARLY'),

  // ── App ────────────────────────────────────────────────────
  FIREBASE_FUNCTION_BASE_URL:  getEnv('FIREBASE_FUNCTION_BASE_URL'),
  APP_ENV:                     getEnv('APP_ENV', 'production'),
};

export default ENV;
