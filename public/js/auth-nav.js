// js/auth-nav.js — MDOThree shared template, adapter for surfaces built on js/config/firebase.js
// (json, text, pdf, image, qr). Source: shared/mdothree/auth-nav.firebase.js.
// Feeds the nav cluster (site-chrome.js) with the REAL Firebase auth state and the checkout flag.
//  - These surfaces have no sign-in flow yet, so signed-out visitors see no account control at all
//    (never a "Sign in" button that leads nowhere).
//  - A real (non-anonymous) Firebase user gets the account menu: Your account (/account) + Sign out.
//  - PRO_CHECKOUT_ENABLED=false (#66b): the Pro control stays "Pro (coming soon)" -> mdothree.com/pro.
//    When it is on (with its Stripe + functions config, same rule as stripe-paywall.js) it opens /pricing.
import { ENV } from './env.js';

const chromeReady = () => window.mdoChrome
  ? Promise.resolve(window.mdoChrome)
  : new Promise(res => document.addEventListener('mdo-chrome-ready', () => res(window.mdoChrome), { once: true }));

const checkoutOn = ENV.PRO_CHECKOUT_ENABLED === true && !!ENV.STRIPE_PUBLISHABLE_KEY && !!ENV.FIREBASE_FUNCTION_BASE_URL;

chromeReady().then(async chrome => {
  if (checkoutOn) chrome.setCheckout({ enabled: true, href: '/pricing' });
  try {
    const [{ initFirebase }, { onAuthStateChanged, signOut }] = await Promise.all([
      import('./config/firebase.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'),
    ]);
    await initFirebase();
    const { auth } = await import('./config/firebase.js');
    if (!auth) { chrome.setUser(null); return; }
    onAuthStateChanged(auth, u => chrome.setUser(u && !u.isAnonymous ? u : null, {
      signOut: () => signOut(auth),
      accountHref: '/account',
    }));
  } catch (e) {
    chrome.setUser(null);   // Firebase unreachable: signed out, tools keep working
  }
});
