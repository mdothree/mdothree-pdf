/**
 * stripe-paywall.js — Embedded Stripe Elements paywall modal
 *
 * Usage:
 *   import { initPaywall, isPremium, requirePremium } from '../stripe-paywall.js';
 *   await initPaywall();
 *   if (!requirePremium('Batch processing', 'pdf-merge')) return;
 */

import { ENV } from './env.js';
import { auth, db, initFirebase } from './firebase.js';
import { getDoc, setDoc, doc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Plans (priceIds come from ENV) ────────────────────────────────────────

export const PLANS = {
  monthly: {
    priceId: ENV.STRIPE_PRICE_MONTHLY,
    label:   'Pro Monthly',
    price:   '$4.99',
    period:  'month',
  },
  yearly: {
    priceId: ENV.STRIPE_PRICE_YEARLY,
    label:   'Pro Yearly',
    price:   '$39.99',
    period:  'year',
    badge:   'Save 33%',
  },
};

// ── Free tier limits ──────────────────────────────────────────────────────

export const FREE_LIMITS = {
  pdfMergeFiles:  3,
  pdfFileSizeMB:  10,
  imagesBatch:    1,
  qrBatch:        5,
  textDiffChars:  5000,
  jsonFileSizeKB: 50,
};

// ── State ─────────────────────────────────────────────────────────────────

let _premium = null;
let _stripe  = null;
let _user    = null;

// ── Init ──────────────────────────────────────────────────────────────────

export async function initPaywall() {
  try {
    _user = await initFirebase();
    if (!_user || !db) { _premium = false; return false; }
    const snap = await getDoc(doc(db, 'subscriptions', _user.uid));
    if (snap.exists()) {
      const d   = snap.data();
      const exp = d.expiresAt?.toMillis?.() || 0;
      _premium  = d.status === 'active' && exp > Date.now();
    } else {
      _premium = false;
    }
    return _premium;
  } catch (e) {
    console.warn('[Paywall] initPaywall failed:', e.message);
    _premium = false;
    return false;
  }
}

export function isPremium() { return _premium === true; }

/**
 * Gate a premium action. Returns true if allowed, false + shows modal if not.
 * @param {string} reason   Human-readable reason, shown in the modal
 * @param {string} feature  Short key for analytics (e.g. 'pdf-merge-count')
 */
export function requirePremium(reason = 'This feature', feature = 'unknown') {
  if (isPremium()) return true;
  _showModal(reason, feature);
  return false;
}

// ── Stripe lazy loader ────────────────────────────────────────────────────

async function _loadStripe() {
  if (_stripe) return _stripe;
  if (!window.Stripe) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = res;
      s.onerror = () => rej(new Error('Failed to load Stripe.js'));
      document.head.appendChild(s);
    });
  }
  _stripe = window.Stripe(ENV.STRIPE_PUBLISHABLE_KEY);
  return _stripe;
}

// ── Modal ─────────────────────────────────────────────────────────────────

function _showModal(reason, feature) {
  _removeModal();
  _injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'pw-overlay';
  overlay.innerHTML = `
    <div id="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <div class="pw-header">
        <span class="pw-logo">m<span>.</span>three</span>
        <button class="pw-close" id="pw-close" aria-label="Close">✕</button>
      </div>

      <div class="pw-hook">
        <div class="pw-lock-icon">🔒</div>
        <h2 id="pw-title">Upgrade to Pro</h2>
        <p class="pw-reason"><strong>${_esc(reason)}</strong> requires a Pro subscription.</p>
      </div>

      <div class="pw-toggle">
        <button class="pw-plan active" data-plan="monthly">Monthly</button>
        <button class="pw-plan" data-plan="yearly">
          Yearly <span class="pw-badge">Save 33%</span>
        </button>
      </div>

      <ul class="pw-features">
        <li>✅ Unlimited file merges &amp; batch operations</li>
        <li>✅ Files up to 500MB (PDF &amp; images)</li>
        <li>✅ Batch QR generation — up to 1,000 codes</li>
        <li>✅ Unlimited text diff &amp; JSON formatting</li>
        <li>✅ JSONPath query tool</li>
        <li>✅ Zero ads — ever</li>
        <li>✅ Priority processing</li>
      </ul>

      <div class="pw-price" id="pw-price">
        <span class="pw-amount">$4.99</span><span class="pw-period"> / month</span>
      </div>

      <div id="pw-payment" style="display:none;">
        <div id="pw-card-mount" class="pw-card-mount"></div>
        <div id="pw-card-error" class="pw-card-error" role="alert"></div>
        <p class="pw-secure">🔒 Payments secured by Stripe. Cancel anytime.</p>
      </div>

      <button class="pw-cta" id="pw-cta">
        <span id="pw-cta-label">Start 7-Day Free Trial →</span>
        <span id="pw-cta-spin" class="pw-spin" style="display:none;"></span>
      </button>
      <p class="pw-fine">No charge for 7 days. Cancel before trial ends.</p>

      <div class="pw-trust">
        <span>🔒 SSL encrypted</span>
        <span>💳 Stripe secured</span>
        <span>🔄 Cancel anytime</span>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Close handlers
  document.getElementById('pw-close').addEventListener('click', _removeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) _removeModal(); });
  document.addEventListener('keydown', _onEsc);

  // Plan toggle
  let selectedPlan = 'monthly';
  overlay.querySelectorAll('.pw-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.pw-plan').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPlan = btn.dataset.plan;
      const p = PLANS[selectedPlan];
      document.getElementById('pw-price').innerHTML =
        `<span class="pw-amount">${p.price}</span><span class="pw-period"> / ${p.period}</span>`;
    });
  });

  // CTA flow
  let step = 'cta';  // 'cta' | 'payment' | 'processing'
  let cardElement = null;

  document.getElementById('pw-cta').addEventListener('click', async () => {
    if (step === 'cta') {
      step = 'payment';
      document.getElementById('pw-cta-label').textContent = 'Pay & Activate';
      document.getElementById('pw-payment').style.display = 'block';
      try {
        const stripe    = await _loadStripe();
        const elements  = stripe.elements({
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary:    '#10B981',
              colorBackground: '#1E293B',
              colorText:       '#E2E8F0',
              colorDanger:     '#EF4444',
              fontFamily:      'DM Mono, monospace',
              borderRadius:    '8px',
            },
          },
        });
        cardElement = elements.create('card', {
          style: {
            base:    { iconColor: '#10B981', color: '#E2E8F0', fontSize: '15px', '::placeholder': { color: '#475569' } },
            invalid: { iconColor: '#EF4444', color: '#FCA5A5' },
          },
        });
        cardElement.mount('#pw-card-mount');
        cardElement.on('change', e => {
          document.getElementById('pw-card-error').textContent = e.error?.message || '';
        });
      } catch (err) {
        document.getElementById('pw-card-error').textContent = 'Could not load payment form: ' + err.message;
      }

    } else if (step === 'payment') {
      if (!cardElement || !_stripe) return;
      step = 'processing';
      document.getElementById('pw-cta-label').style.display = 'none';
      document.getElementById('pw-cta-spin').style.display  = 'inline-block';
      document.getElementById('pw-cta').disabled = true;

      try {
        const { paymentMethod, error } = await _stripe.createPaymentMethod({
          type: 'card', card: cardElement,
        });
        if (error) throw new Error(error.message);

        const res = await fetch(`${ENV.FIREBASE_FUNCTION_BASE_URL}/createSubscription`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            paymentMethodId: paymentMethod.id,
            priceId:         PLANS[selectedPlan].priceId,
            uid:             _user?.uid,
            feature,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Payment failed');
        const result = await res.json();

        if (result.requiresAction) {
          const { error: ce } = await _stripe.confirmCardPayment(result.clientSecret);
          if (ce) throw new Error(ce.message);
        }

        _premium = true;
        _showSuccess();
        setTimeout(_removeModal, 2500);
      } catch (err) {
        document.getElementById('pw-card-error').textContent = '❌ ' + err.message;
        step = 'payment';
        document.getElementById('pw-cta-label').style.display = 'inline';
        document.getElementById('pw-cta-spin').style.display  = 'none';
        document.getElementById('pw-cta').disabled = false;
      }
    }
  });
}

function _showSuccess() {
  const m = document.getElementById('pw-modal');
  if (!m) return;
  m.innerHTML = `
    <div style="text-align:center;padding:56px 24px;">
      <div style="font-size:3rem;margin-bottom:16px;">🎉</div>
      <h2 style="font-family:'DM Mono',monospace;color:#10B981;font-size:1.4rem;margin-bottom:8px;">You're Pro!</h2>
      <p style="color:#94A3B8;">All features unlocked. Enjoy!</p>
    </div>`;
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
  border-radius:20px;width:100%;max-width:440px;max-height:92vh;
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
  width:30px;height:30px;border-radius:50%;font-size:.85rem;transition:all 150ms;
  display:flex;align-items:center;justify-content:center}
.pw-close:hover{background:rgba(255,255,255,.12);color:#fff}

.pw-hook{text-align:center;margin-bottom:20px}
.pw-lock-icon{font-size:2.2rem;margin-bottom:10px}
.pw-hook h2{font-family:'DM Mono',monospace;font-size:1.35rem;font-weight:500;
  color:#fff;margin-bottom:8px;letter-spacing:-.02em}
.pw-reason{font-size:.88rem;color:#94A3B8;line-height:1.5}
.pw-reason strong{color:#E2E8F0}

.pw-toggle{display:flex;gap:8px;background:#1E293B;border-radius:10px;
  padding:4px;margin-bottom:20px}
.pw-plan{flex:1;padding:9px 12px;font-family:'DM Mono',monospace;font-size:.8rem;
  border:none;border-radius:7px;cursor:pointer;background:transparent;color:#64748B;
  transition:all 150ms;display:flex;align-items:center;justify-content:center;gap:6px}
.pw-plan.active{background:rgba(16,185,129,.15);color:#34D399;
  box-shadow:0 0 0 1px rgba(16,185,129,.3)}
.pw-badge{background:#10B981;color:#020617;font-size:.65rem;padding:2px 6px;
  border-radius:999px;font-weight:600;letter-spacing:.03em}

.pw-features{list-style:none;margin-bottom:20px;display:flex;flex-direction:column;gap:8px}
.pw-features li{font-size:.85rem;color:#CBD5E1}

.pw-price{text-align:center;margin-bottom:16px;padding:12px;
  background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.15);border-radius:10px}
.pw-amount{font-family:'DM Mono',monospace;font-size:2rem;font-weight:500;color:#10B981}
.pw-period{font-size:.9rem;color:#64748B}

.pw-card-mount{background:#1E293B;border:1px solid rgba(255,255,255,.1);border-radius:8px;
  padding:14px 16px;margin-bottom:8px;transition:border-color 150ms}
.pw-card-mount:focus-within{border-color:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}
.pw-card-error{font-family:'DM Mono',monospace;font-size:.8rem;color:#FCA5A5;
  min-height:20px;margin-bottom:8px}
.pw-secure{font-size:.75rem;color:#475569;text-align:center;margin-bottom:14px}

.pw-cta{width:100%;padding:14px;background:#10B981;color:#020617;
  font-family:'DM Mono',monospace;font-size:.9rem;font-weight:500;
  border:none;border-radius:10px;cursor:pointer;transition:all 150ms;
  margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px}
.pw-cta:hover:not(:disabled){background:#34D399;
  box-shadow:0 0 24px rgba(16,185,129,.3);transform:translateY(-1px)}
.pw-cta:disabled{opacity:.6;cursor:not-allowed;transform:none}

.pw-spin{width:18px;height:18px;border:2px solid rgba(2,6,23,.3);border-top-color:#020617;
  border-radius:50%;animation:pw-spin .65s linear infinite}
@keyframes pw-spin{to{transform:rotate(360deg)}}

.pw-fine{text-align:center;font-size:.75rem;color:#475569;margin-bottom:16px}
.pw-trust{display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
.pw-trust span{font-size:.72rem;color:#334155;font-family:'DM Mono',monospace}

@media(max-width:480px){
  #pw-modal{padding:20px 18px 18px}
  .pw-hook h2{font-size:1.15rem}
  .pw-amount{font-size:1.6rem}
}`;
  document.head.appendChild(style);
}

// ── Billing portal helper ─────────────────────────────────────────────────────

/**
 * Redirect the current user to the Stripe Customer Portal.
 * Call from an account/billing page.
 */
export async function openBillingPortal(returnUrl = window.location.href) {
  if (!_user) throw new Error('Not authenticated');
  const idToken = await _user.getIdToken();
  const res = await fetch(`${ENV.FIREBASE_FUNCTION_BASE_URL}/createBillingPortalSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ returnUrl }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to open billing portal');
  const { url } = await res.json();
  window.location.href = url;
}
