// pricing.js page controller — MDOThree shared template (family B). Source: shared/mdothree/pricing.js.
// mdothree Pro is ONE lifetime purchase: $29 once, no subscription, Pro never expires (DECISIONS 2026-10-16).
import { initPaywall, startCheckout, PRO, PRO_UNLOCKS, PRO_CHECKOUT_ENABLED } from '../stripe-paywall.js';
import { ProApiError, proErrorMessage } from '../pro-api.js';

const FAQ = [
  { q: 'Is it a subscription?', a: 'No. One payment, Pro never expires.' },
  PRO_CHECKOUT_ENABLED
    ? { q: 'How do I pay?', a: `Sign in or create an mdothree account, then pay ${PRO.price} once on Stripe's secure checkout page. Pro turns on for that account as soon as Stripe confirms the payment, on every mdothree tool.` }
    : { q: 'Can I buy Pro today?', a: 'Not yet. Pro checkout isn\'t open, so nothing can be charged. Every tool works now within its open limits.' },
  { q: 'Refunds?', a: 'Contact <a href="mailto:hello@mdothree.com">hello@mdothree.com</a>.' },
  { q: 'Are my files safe?', a: 'File processing happens in your browser. Your files are not uploaded to a server.' },
  { q: 'What happens when I hit a limit?', a: 'You see a prompt that names the limit. The tools keep working for anything within the open limits.' },
];

// Build FAQ (static strings only)
const faqEl = document.getElementById('faq');
FAQ.forEach(({ q, a }) => {
  const item = document.createElement('div');
  item.className = 'faq-item';
  item.innerHTML = `
    <div class="faq-q">${q} <span>+</span></div>
    <div class="faq-a">${a}</div>
  `;
  const qEl = item.querySelector('.faq-q');
  const aEl = item.querySelector('.faq-a');
  qEl.addEventListener('click', () => {
    const open = aEl.classList.toggle('open');
    qEl.querySelector('span').textContent = open ? '−' : '+';
  });
  faqEl.appendChild(item);
});

// Pro unlocks list (one source: stripe-paywall.js PRO_UNLOCKS)
const listEl = document.getElementById('proUnlocks');
if (listEl) {
  listEl.replaceChildren(...PRO_UNLOCKS.map(t => {
    const li = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = 'check';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '+';
    li.append(mark, ' ', t);
    return li;
  }));
}

// Get Pro button
initPaywall().then(premium => {
  const btn  = document.getElementById('upgradeBtn');
  const fine = document.getElementById('proFine');
  if (premium) {
    btn.textContent = 'You have Pro, lifetime';
    btn.disabled = true;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    if (fine) fine.textContent = 'Pro never expires on this account.';
  } else if (PRO_CHECKOUT_ENABLED) {
    const label = `Get Pro, ${PRO.price} once`;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.textContent = label;
    document.getElementById('proPeriod').textContent = 'one payment · lifetime';
    if (fine) fine.textContent = 'One payment. No subscription. Pro never expires. Sign in or create an account, then pay on Stripe\'s secure checkout page.';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Opening checkout...';
      try {
        const r = await startCheckout();
        if (r === 'already_pro') {
          btn.textContent = 'You have Pro, lifetime';
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
          return;
        }
        if (r === 'signed_out' && fine) fine.textContent = proErrorMessage(401, 'sign_in_required');
        if (r !== 'redirect') { btn.disabled = false; btn.textContent = label; }
      } catch (err) {
        if (fine) fine.textContent = err instanceof ProApiError ? err.message : proErrorMessage(500, 'internal');
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }
});
