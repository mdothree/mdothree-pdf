// pricing.js page controller
import { initPaywall, isPremium, requirePremium, PLANS } from '../stripe-paywall.js';

const FAQ = [
  { q: 'Is there really a 7-day free trial?', a: 'Yes. You won\'t be charged for 7 days. Cancel anytime before the trial ends and you\'ll never be billed.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel from your Account page at any time. You keep Pro access until the end of your current billing period.' },
  { q: 'Are my files safe?', a: 'All file processing happens in your browser using client-side JavaScript. Your files are never uploaded to any server — they never leave your device.' },
  { q: 'What payment methods do you accept?', a: 'All major credit and debit cards via Stripe. Apple Pay and Google Pay are also supported on supported browsers.' },
  { q: 'What happens when I hit a free limit?', a: 'You\'ll see a prompt explaining the limit and an option to upgrade. Free tools continue to work for operations within the free tier.' },
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
      document.getElementById('proAmount').innerHTML = '<sup>$</sup>3.33';
      document.getElementById('proPeriod').textContent = 'per month, billed $39.99/yr · 7-day free trial';
    } else {
      document.getElementById('proAmount').innerHTML = '<sup>$</sup>4.99';
      document.getElementById('proPeriod').textContent = 'per month · 7-day free trial';
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
  } else {
    btn.addEventListener('click', () => {
      requirePremium('Upgrade to Pro for unlimited access', `pricing-${billing}`);
    });
  }
});
