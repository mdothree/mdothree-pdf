// account.js page controller — MDOThree shared template (family B). Source: shared/mdothree/account.js.
// mdothree Pro is a lifetime purchase: the page shows "Pro, lifetime" and a Receipts link (Stripe portal).
import { initPaywall, openBillingPortal, subscriptionInfo, PRO, PRO_CHECKOUT_ENABLED } from '../stripe-paywall.js';
import { initFirebase, getHistory, auth } from '../config/firebase.js';

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

function showAlert(type, msg) {
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = msg;
  alertArea.replaceChildren(div);
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
  const [user, premium] = await Promise.all([initFirebase({ force: true }), initPaywall()])   // PERF-008: the account UI loads the SDK;

  loadingState.classList.add('hidden');

  if (!user || user.isAnonymous) {
    anonState.classList.remove('hidden');
    const signUpBtn = document.getElementById('signUpBtn');
    if (PRO_CHECKOUT_ENABLED) {
      // Sign-in opens with Pro checkout (#66b). Until then this card keeps its "coming soon" copy.
      const h = anonState.querySelector('h2'); const p = anonState.querySelector('p');
      if (h) h.textContent = 'Sign in to your account';
      if (p) p.textContent = 'Sign in or create an mdothree account to see Pro and your receipts. One account works on every mdothree tool.';
      signUpBtn.textContent = 'Sign in or create an account';
      signUpBtn.addEventListener('click', async () => {
        const { openSignIn } = await import('../auth-nav.js');
        const signed = await openSignIn().catch(() => null);
        if (signed) window.location.reload();
      });
      return;
    }
    signUpBtn.addEventListener('click', () => {
      window.location.href = '/pricing';
    });
    return;
  }

  accountContent.classList.remove('hidden');

  // Pro status (lifetime: no renewal, nothing to cancel)
  const planBadge   = document.getElementById('planBadge');
  const planDetails = document.getElementById('planDetails');
  const subActions  = document.getElementById('subActions');

  if (premium && subscriptionInfo()) {
    planBadge.innerHTML = `<span style="color:var(--emerald);">Pro, lifetime</span>`;
    planDetails.textContent = 'One payment. Pro never expires on this account, on every mdothree tool.';

    // Receipts live in the Stripe Customer Portal (createBillingPortalSession).
    const portalBtn = document.createElement('button');
    portalBtn.className = 'btn btn-secondary';
    portalBtn.textContent = 'Receipts';
    portalBtn.addEventListener('click', async () => {
      portalBtn.disabled = true;
      portalBtn.textContent = 'Opening...';
      try {
        await openBillingPortal(window.location.href);
      } catch (e) {
        showAlert('error', e.message);
        portalBtn.disabled = false;
        portalBtn.textContent = 'Receipts';
      }
    });
    subActions.appendChild(portalBtn);

  } else {
    planBadge.innerHTML = `<span style="color:var(--slate-400);">Not on Pro</span>`;
    const upgradeBtn = document.createElement('a');
    upgradeBtn.className = 'btn btn-primary';
    upgradeBtn.href = '/pricing';
    if (PRO_CHECKOUT_ENABLED) {
      planDetails.textContent = `mdothree Pro is ${PRO.price} once, lifetime. No subscription.`;
      upgradeBtn.textContent = `Get Pro, ${PRO.price} once`;
    } else {
      planDetails.textContent = 'Pro is coming soon. Nothing to buy yet.';
      upgradeBtn.textContent = 'Pro (coming soon)';
    }
    subActions.appendChild(upgradeBtn);
  }

  // Load history
  await loadHistory();
  document.getElementById('refreshHistory').addEventListener('click', loadHistory);
}

init();
