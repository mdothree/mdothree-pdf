// pricing.js page controller
import { initPaywall, isPremium, requirePremium, PLANS, PRO_CHECKOUT_ENABLED } from '../stripe-paywall.js';
// No trial: the hardened API sells the $4/$36 prices only and bills on subscribe.
const TRIAL_NOTE = PRO_CHECKOUT_ENABLED ? ' · cancel anytime' : ' · coming soon';

const FAQ = [
  PRO_CHECKOUT_ENABLED
    ? { q: 'When am I billed?', a: 'When you subscribe: $4 a month, or $36 a year. Cancel anytime from your Account page and you keep Pro until the end of the period you paid for.' }
    : { q: 'Can I buy Pro today?', a: 'Not yet. Pro checkout isn\'t open, so nothing can be charged. Every core tool works now within its standard limits.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel from your Account page at any time. You keep Pro access until the end of your current billing period.' },
  { q: 'Are my files safe?', a: 'All file processing happens in your browser using client-side JavaScript. Your files are never uploaded to any server — they never leave your device.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards via Stripe. Apple Pay and Google Pay are also supported on supported browsers.' },
  { q: 'What happens when I hit a limit?', a: 'You\'ll see a prompt explaining the limit and an option to upgrade. The tools keep working for anything within the standard limits.' },
  { q: 'Is there a student or non-profit discount?', a: 'Email us at hello@mdothree.com with proof of status and we\'ll sort something out.' },
];

// Build FAQ
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

// Billing toggle
let billing = 'monthly';
document.querySelectorAll('[data-billing]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-billing]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    billing = btn.dataset.billing;
    if (billing === 'yearly') {
      document.getElementById('proAmount').innerHTML = '<sup>$</sup>3';
      document.getElementById('proPeriod').textContent = 'per month, billed $36/yr' + TRIAL_NOTE;
    } else {
      document.getElementById('proAmount').innerHTML = '<sup>$</sup>4';
      document.getElementById('proPeriod').textContent = 'per month' + TRIAL_NOTE;
    }
  });
});

// Upgrade button
initPaywall().then(premium => {
  const btn = document.getElementById('upgradeBtn');
  if (premium) {
    btn.textContent = '✅ You\'re on Pro';
    btn.disabled = true;
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else if (PRO_CHECKOUT_ENABLED) {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.textContent = 'Get Pro →';
    document.getElementById('proPeriod').textContent = 'per month' + TRIAL_NOTE;
    const fine = document.getElementById('proFine');
    if (fine) fine.textContent = 'Billed today. Cancel anytime. Sign in or create an account at checkout.';
    btn.addEventListener('click', () => {
      requirePremium('Upgrade to Pro for unlimited access', `pricing-${billing}`);
    });
  }
});
