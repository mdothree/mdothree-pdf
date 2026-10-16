/**
 * stripe-paywall.js — MDOThree shared template (family B: json, text, pdf, image, qr).
 * Source: shared/mdothree/stripe-paywall.js. Copy it unchanged to public/js/stripe-paywall.js.
 *
 * mdothree Pro is ONE lifetime purchase (DECISIONS 2026-10-16): $29 once, no subscription,
 * Pro never expires. The only way to buy is Stripe-hosted Checkout (pro-api.js createCheckout);
 * the Stripe webhook writes subscriptions/{uid} and is the only thing that grants Pro.
 * Clients never write subscriptions/{uid} (firestore.rules deny it).
 *
 * Usage:
 *   import { initPaywall, isPremium, requirePremium, OPEN_LIMITS } from '../stripe-paywall.js';
 *   await initPaywall();
 *   if (!requirePremium('Merging more than 3 PDF files', 'pdf-merge')) return;
 */

import { ENV } from './env.js';
// PERF-008: no static Firebase SDK import; config/firebase.js loads it on demand.
import { auth, db, initFirebase, getDocData } from './config/firebase.js';
// mdothree-api client: Bearer <Firebase ID token>, guests refused, no uid in bodies,
// {success:false,error,code} mapped to honest messages.
import { PRO_OFFER, hasProEntitlement, createCheckout, createPortal, signedInUser, ProApiError, proErrorMessage } from './pro-api.js';

// ── The one Pro offer (display only; the server fixes the real price) ───────

export const PRO = PRO_OFFER;   // { plan: 'lifetime', price: '$29', label, note }

// Checkout is gated: without the flag (and the functions base URL) the upgrade
// surface shows honest "coming soon" copy instead of a purchase that leads nowhere.
// Stripe-hosted Checkout needs no publishable key on the page.
export const PRO_CHECKOUT_ENABLED = ENV.PRO_CHECKOUT_ENABLED === true && !!ENV.FIREBASE_FUNCTION_BASE_URL;

// ── Limits without Pro (each one is checked in a page controller) ───────────
//   pdfMergeFiles   pdf merge.js: more than 3 files needs Pro
//   pdfFileSizeMB   pdf merge / extract-text / pdf-to-images; image crop / resize / rotate / remove-bg
//   imagesBatch     image convert.js: more than 1 image per batch needs Pro
//   qrBatch         qr batch.js: more than 5 codes per batch needs Pro (hard max 1,000 for everyone)
//   textDiffChars   text text-diff.js: either side over 5,000 characters needs Pro
//   jsonFileSizeKB  json format.js (over 50 KB) and json-diff.js (over 100 KB, both sides together)
// JSONPath queries (json json-path.js) need Pro outright.

export const OPEN_LIMITS = {
  pdfMergeFiles:  3,
  pdfFileSizeMB:  10,
  imagesBatch:    1,
  qrBatch:        5,
  textDiffChars:  5000,
  jsonFileSizeKB: 50,
};

// What Pro unlocks across the mdothree tools: only limits the code enforces (see above).
export const PRO_UNLOCKS = [
  'Merge more than 3 PDFs at once',
  'Use PDF and image files over 10 MB (PDF merge, text extraction, PDF to images; image crop, resize, rotate, background removal)',
  'Convert more than one image per batch',
  'Generate more than 5 QR codes per batch, up to 1,000',
  'Diff texts over 5,000 characters',
  'Format JSON over 50 KB and diff JSON over 100 KB',
  'Run JSONPath queries',
  'Pro also unlocks the Pro features in the hash, password, color and time tools',
];

// ── State ─────────────────────────────────────────────────────────────────

let _premium = null;
let _user    = null;
let _sub     = null;   // subscriptions/{uid} as last read (webhook-written)

// ── Init ──────────────────────────────────────────────────────────────────

export async function initPaywall() {
  try {
    _user = await initFirebase();
    // Guests (no account, or an anonymous uid) are never Pro: a guest uid is per
    // browser + per subdomain and the API refuses to sell Pro to one.
    if (!_user || !_user.uid || _user.isAnonymous || !db) { _premium = false; _sub = null; return false; }
    _sub = await getDocData('subscriptions', _user.uid);
    _premium = hasProEntitlement(_sub);
    return _premium;
  } catch (e) {
    console.warn('[Paywall] initPaywall failed:', e.message);
    _premium = false;
    return false;
  }
}

export function isPremium() { return _premium === true; }

/** Lifetime facts from the webhook-written doc (no API call), or null without Pro. */
export function subscriptionInfo() {
  if (!hasProEntitlement(_sub)) return null;
  return { purchased: true, lifetime: true, plan: PRO_OFFER.plan };
}

/**
 * Gate a Pro action. Returns true if allowed, false + shows the modal if not.
 * @param {string} reason   Human-readable reason, shown in the modal
 * @param {string} feature  Short key for analytics (e.g. 'pdf-merge-count')
 */
export function requirePremium(reason = 'This feature', feature = 'unknown') {
  if (isPremium()) return true;
  _showModal(reason, feature);
  return false;
}

// Kept for any legacy global callers. Upgrade links in the HTML use
// data-require-premium="<reason>" data-feature="<key>" (no inline onclick, so the CSP needs no 'unsafe-inline').
if (typeof window !== 'undefined') window.requirePremium = requirePremium;
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-require-premium]');
    if (!a) return;
    e.preventDefault();
    requirePremium(a.dataset.requirePremium, a.dataset.feature || 'unknown');
  });
}

// ── Checkout (Stripe-hosted) ────────────────────────────────────────────────

/**
 * Sign in if needed, then send the browser to Stripe-hosted Checkout for the lifetime plan.
 * Resolves to 'redirect' | 'already_pro' | 'signed_out'; throws ProApiError on an API failure.
 */
export async function startCheckout() {
  await initFirebase({ force: true });
  if (!signedInUser(auth)) {
    const { openSignIn } = await import('./auth-nav.js');
    const signed = await openSignIn({ reason: 'Pro belongs to your mdothree account. Sign in or create one, then continue to checkout.' }).catch(() => null);
    if (!signed || !signedInUser(auth)) return 'signed_out';
  }
  if (await initPaywall()) return 'already_pro';
  const url = await createCheckout(PRO_OFFER.plan, { baseUrl: ENV.FIREBASE_FUNCTION_BASE_URL, auth });
  window.location.assign(url);
  return 'redirect';
}

// ── Modal ─────────────────────────────────────────────────────────────────

function _showModal(reason, feature) {
  initFirebase({ force: true });   // PERF-008: the Pro UI is where the SDK loads on demand
  _removeModal();
  _injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'pw-overlay';
  overlay.dataset.feature = feature;
  overlay.innerHTML = `
    <div id="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <div class="pw-header">
        <span class="pw-logo">m<span>.</span>three</span>
        <button class="pw-close" id="pw-close" aria-label="Close">✕</button>
      </div>

      <div class="pw-hook">
        <h2 id="pw-title">mdothree Pro</h2>
        <p class="pw-reason"><strong>${_esc(reason)}</strong><br>This is part of mdothree Pro.</p>
      </div>

      <ul class="pw-features">
        ${PRO_UNLOCKS.map(t => `<li>${_esc(t)}</li>`).join('')}
      </ul>

      <div class="pw-price" id="pw-price">
        <span class="pw-amount">${_esc(PRO_OFFER.price)}</span><span class="pw-period"> once, lifetime</span>
      </div>

      <button class="pw-cta" id="pw-cta">
        <span id="pw-cta-label">Get Pro, ${_esc(PRO_OFFER.price)} once</span>
        <span id="pw-cta-spin" class="pw-spin" style="display:none;"></span>
      </button>
      <p class="pw-fine" id="pw-fine" role="status">One payment. No subscription. Pro never expires. You pay on Stripe's secure checkout page.</p>
    </div>`;

  document.body.appendChild(overlay);

  if (!PRO_CHECKOUT_ENABLED) {
    // No live checkout yet: drop the price and disable the CTA.
    overlay.querySelector('#pw-price')?.remove();
    overlay.querySelector('#pw-title').textContent = 'Pro is coming soon';
    const ctaBtn = overlay.querySelector('#pw-cta');
    ctaBtn.disabled = true;
    ctaBtn.setAttribute('aria-disabled', 'true');
    overlay.querySelector('#pw-cta-label').textContent = 'Pro coming soon';
    overlay.querySelector('#pw-fine').textContent =
      "Pro checkout isn't open yet, so there is nothing to buy today. Every tool keeps working within its open limits.";
  }
  document.body.style.overflow = 'hidden';

  document.getElementById('pw-close').addEventListener('click', _removeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) _removeModal(); });
  document.addEventListener('keydown', _onEsc);

  if (!PRO_CHECKOUT_ENABLED) return;

  const cta   = document.getElementById('pw-cta');
  const label = document.getElementById('pw-cta-label');
  const spin  = document.getElementById('pw-cta-spin');
  const fine  = document.getElementById('pw-fine');
  const busy = on => {
    cta.disabled = on;
    label.style.display = on ? 'none' : 'inline';
    spin.style.display  = on ? 'inline-block' : 'none';
  };

  cta.addEventListener('click', async () => {
    busy(true);
    try {
      const r = await startCheckout();
      if (r === 'already_pro') { _showActive(); return; }
      if (r === 'signed_out') {
        fine.textContent = proErrorMessage(401, 'sign_in_required');
        label.textContent = `Sign in to get Pro, ${PRO_OFFER.price} once`;
        busy(false);
      }
      // 'redirect': the browser is on its way to Stripe Checkout.
    } catch (err) {
      fine.textContent = err instanceof ProApiError ? err.message : proErrorMessage(500, 'internal');
      busy(false);
    }
  });
}

function _showActive() {
  const m = document.getElementById('pw-modal');
  if (!m) return;
  m.innerHTML = `
    <div style="text-align:center;padding:56px 24px;" role="status">
      <h2 style="font-family:'DM Mono',monospace;color:#10B981;font-size:1.4rem;margin-bottom:8px;">Pro is active</h2>
      <p style="color:#94A3B8;">This account already has mdothree Pro. It never expires.</p>
      <button class="pw-cta" id="pw-done" style="margin-top:20px;">Close</button>
    </div>`;
  document.getElementById('pw-done')?.addEventListener('click', _removeModal);
}

function _removeModal() {
  document.getElementById('pw-overlay')?.remove();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', _onEsc);
}

function _onEsc(e) { if (e.key === 'Escape') _removeModal(); }
function _esc(s)   { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Styles ────────────────────────────────────────────────────────────────

function _injectStyles() {
  if (document.getElementById('pw-styles')) return;
  const style = document.createElement('style');
  style.id = 'pw-styles';
  style.textContent = `
#pw-overlay {
  position:fixed;inset:0;z-index:9999;
  background:rgba(2,6,23,.88);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;padding:16px;
  animation:pw-fade 200ms ease;
}
@keyframes pw-fade { from{opacity:0} to{opacity:1} }

#pw-modal {
  background:#0F172A;border:1px solid rgba(255,255,255,.1);
  border-radius:4px;width:100%;max-width:440px;max-height:92vh;
  overflow-y:auto;padding:28px 28px 24px;
  animation:pw-up 240ms cubic-bezier(.34,1.56,.64,1);
  box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 0 1px rgba(16,185,129,.08);
}
#pw-modal::-webkit-scrollbar{width:4px}
#pw-modal::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
@keyframes pw-up { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:none} }

.pw-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.pw-logo{font-family:'DM Mono',monospace;font-size:1rem;color:#fff}
.pw-logo span{color:#10B981}
.pw-close{background:rgba(255,255,255,.06);border:none;color:#94A3B8;cursor:pointer;
  width:30px;height:30px;border-radius:4px;font-size:.85rem;transition:all 150ms;
  display:flex;align-items:center;justify-content:center}
.pw-close:hover{background:rgba(255,255,255,.12);color:#fff}

.pw-hook{text-align:center;margin-bottom:20px}
.pw-hook h2{font-family:'DM Mono',monospace;font-size:1.35rem;font-weight:500;
  color:#fff;margin-bottom:8px;letter-spacing:-.02em}
.pw-reason{font-size:.88rem;color:#94A3B8;line-height:1.5}
.pw-reason strong{color:#E2E8F0}

.pw-features{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:8px}
.pw-features li{font-size:.85rem;color:#CBD5E1;line-height:1.45;padding-left:18px;position:relative}
.pw-features li::before{content:'+';position:absolute;left:0;color:#10B981;font-family:'DM Mono',monospace}

.pw-price{text-align:center;margin-bottom:16px;padding:12px;
  background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:4px}
.pw-amount{font-family:'DM Mono',monospace;font-size:2rem;font-weight:500;color:#10B981}
.pw-period{font-size:.9rem;color:#64748B}

.pw-cta{width:100%;padding:14px;background:#10B981;color:#020617;
  font-family:'DM Mono',monospace;font-size:.9rem;font-weight:500;
  border:none;border-radius:4px;cursor:pointer;transition:all 150ms;
  margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px}
.pw-cta:hover:not(:disabled){background:#34D399;
  box-shadow:0 0 24px rgba(16,185,129,.3);transform:translateY(-1px)}
.pw-cta:disabled{opacity:.6;cursor:not-allowed;transform:none}

.pw-spin{width:18px;height:18px;border:2px solid rgba(2,6,23,.3);border-top-color:#020617;
  border-radius:50%;animation:pw-spin .65s linear infinite}
@keyframes pw-spin{to{transform:rotate(360deg)}}

.pw-fine{text-align:center;font-size:.75rem;color:#64748B;margin-bottom:4px}

@media(max-width:480px){
  #pw-modal{padding:20px 18px 18px}
  .pw-hook h2{font-size:1.15rem}
  .pw-amount{font-size:1.6rem}
}`;
  document.head.appendChild(style);
}

// ── Receipts (Stripe Customer Portal) ───────────────────────────────────────

/**
 * Redirect the signed-in user to the Stripe Customer Portal (receipts and invoices).
 * Call from the account page.
 */
export async function openBillingPortal(returnUrl = window.location.href) {
  await initFirebase({ force: true });
  const url = await createPortal(returnUrl, { baseUrl: ENV.FIREBASE_FUNCTION_BASE_URL, auth });
  window.location.assign(url);
}
