// account.js page controller
import { initPaywall, isPremium, openBillingPortal } from '../stripe-paywall.js';
import { initFirebase, getHistory, auth } from '../config/firebase.js';
import { ENV } from '../env.js';

const loadingState   = document.getElementById('loadingState');
const anonState      = document.getElementById('anonState');
const accountContent = document.getElementById('accountContent');
const alertArea      = document.getElementById('alertArea');

const TOOL_LABELS = {
  'pdf-merge':       '🔗 PDF Merge',
  'pdf-compress':    '🗜️ PDF Compress',
  'pdf-split':       '✂️ PDF Split',
  'image-convert':   '🔄 Image Convert',
  'image-compress':  '🗜️ Image Compress',
  'image-resize':    '↔️ Image Resize',
  'qr-generate':     '▦ QR Generate',
  'qr-batch':        '📋 QR Batch',
  'qr-scan':         '📷 QR Scan',
  'text-diff':       '⟺ Text Diff',
  'word-counter':    '🔢 Word Counter',
  'case-converter':  'Aa Case Converter',
  'json-format':     '✨ JSON Format',
  'json-path':       '🔎 JSONPath',
  'json-diff':       '⟺ JSON Diff',
};

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatExpiry(millis) {
  if (!millis) return '';
  const d = new Date(millis);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function showAlert(type, msg) {
  alertArea.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { alertArea.innerHTML = ''; }, 5000);
}

async function loadHistory() {
  const listEl = document.getElementById('historyList');
  const emptyEl = document.getElementById('historyEmpty');
  listEl.innerHTML = '<div class="text-sm text-muted" style="padding:8px;">Loading...</div>';

  const items = await getHistory(null, 30);
  listEl.innerHTML = '';

  if (!items.length) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  items.forEach(item => {
    const label = TOOL_LABELS[item.tool] || item.tool;
    const row = document.createElement('div');
    row.className = 'file-item';
    row.style.cssText = 'margin-bottom:8px;';
    row.innerHTML = `
      <span style="font-size:1rem;flex-shrink:0;">${label.split(' ')[0]}</span>
      <span class="file-item-name text-mono" style="font-size:0.82rem;">${label.slice(label.indexOf(' ')+1)}</span>
      <span class="file-item-size">${formatDate(item.timestamp)}</span>
    `;
    listEl.appendChild(row);
  });
}

async function init() {
  const [user, premium] = await Promise.all([initFirebase(), initPaywall()]);

  loadingState.classList.add('hidden');

  if (!user) {
    anonState.classList.remove('hidden');
    document.getElementById('signUpBtn').addEventListener('click', () => {
      window.location.href = 'pricing.html';
    });
    return;
  }

  accountContent.classList.remove('hidden');

  // Subscription status
  const planBadge   = document.getElementById('planBadge');
  const planDetails = document.getElementById('planDetails');
  const subActions  = document.getElementById('subActions');
  const cancelBtn   = document.getElementById('cancelBtn');

  if (premium) {
    planBadge.innerHTML = `<span style="color:var(--emerald);font-size:1.3rem;">✨</span> <span style="color:var(--emerald);">Pro</span>`;

    // Fetch live status from server
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${ENV.FIREBASE_FUNCTION_BASE_URL}/getSubscriptionStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cancelAtPeriodEnd && data.expiresAt) {
          planDetails.textContent = `Cancels ${formatExpiry(data.expiresAt)} — you keep access until then.`;
        } else if (data.expiresAt) {
          planDetails.textContent = `Renews ${formatExpiry(data.expiresAt)}.`;
          cancelBtn.style.display = 'inline-flex';
        }
        if (data.trialEnd && data.trialEnd > Date.now()) {
          planDetails.textContent = `Free trial ends ${formatExpiry(data.trialEnd)}.`;
        }
      }
    } catch (_) {}

    // Billing portal button
    const portalBtn = document.createElement('button');
    portalBtn.className = 'btn btn-secondary';
    portalBtn.textContent = '💳 Manage Billing';
    portalBtn.addEventListener('click', async () => {
      portalBtn.disabled = true;
      portalBtn.textContent = 'Opening...';
      try {
        await openBillingPortal(window.location.href);
      } catch (e) {
        showAlert('error', '❌ ' + e.message);
        portalBtn.disabled = false;
        portalBtn.textContent = '💳 Manage Billing';
      }
    });
    subActions.appendChild(portalBtn);

  } else {
    planBadge.innerHTML = `<span style="color:var(--slate-400);">Free Plan</span>`;
    planDetails.textContent = 'Upgrade to Pro for unlimited file sizes, batch processing, and more.';
    const upgradeBtn = document.createElement('a');
    upgradeBtn.className = 'btn btn-primary';
    upgradeBtn.href = 'pricing.html';
    upgradeBtn.textContent = '✨ Upgrade to Pro →';
    subActions.appendChild(upgradeBtn);
  }

  // Cancel button
  cancelBtn.addEventListener('click', async () => {
    if (!confirm('Cancel your Pro subscription? You\'ll keep access until the end of your billing period.')) return;
    cancelBtn.disabled = true;
    cancelBtn.textContent = 'Canceling...';
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${ENV.FIREBASE_FUNCTION_BASE_URL}/cancelSubscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('success', '✅ Subscription canceled. You keep Pro access until your billing period ends.');
        cancelBtn.style.display = 'none';
      } else {
        throw new Error(data.error || 'Cancellation failed');
      }
    } catch (e) {
      showAlert('error', '❌ ' + e.message);
      cancelBtn.disabled = false;
      cancelBtn.textContent = 'Cancel Plan';
    }
  });

  // Load history
  await loadHistory();
  document.getElementById('refreshHistory').addEventListener('click', loadHistory);
}

init();
