// js/auth-nav.js — MDOThree shared template, adapter for surfaces built on js/config/firebase.js
// (json, text, pdf, image, qr). Source: shared/mdothree/auth-nav.firebase.js.
// Feeds the nav cluster (site-chrome.js) with the REAL Firebase auth state and the checkout flag.
//  - PRO_CHECKOUT_ENABLED=false (#66b, today): nothing changes. The Pro control stays
//    "Pro (coming soon)" -> mdothree.com/pro and signed-out visitors see no account control.
//  - When it is on (with its Stripe + functions config, same rule as stripe-paywall.js) the Pro control
//    opens /pricing and signed-out visitors get a "Sign in" button that opens js/auth-ui.js.
//  - A real (non-anonymous) Firebase user gets the account menu: Your account (/account) + Sign out.
//  - openSignIn() is the one entry point the Pro / account UI uses; auth-ui.js loads only when it is called.
//  - PERF-008: the Firebase SDK is not loaded for the nav on a first visit. With no session in this
//    browser the nav shows "signed out" at once and attaches to auth when the SDK loads later
//    (sign-in, Pro modal, account page).
import { ENV } from './env.js';

const chromeReady = () => window.mdoChrome
  ? Promise.resolve(window.mdoChrome)
  : new Promise(res => document.addEventListener('mdo-chrome-ready', () => res(window.mdoChrome), { once: true }));

export const checkoutOn = ENV.PRO_CHECKOUT_ENABLED === true && !!ENV.STRIPE_PUBLISHABLE_KEY && !!ENV.FIREBASE_FUNCTION_BASE_URL;

async function getAuthInstance() {
  const fb = await import('./config/firebase.js');
  await fb.initFirebase({ force: true });
  return fb.auth;
}

/**
 * Open the shared sign-in / create-account / reset dialog. Resolves to the signed-in user, or null.
 * @param {{ mode?: 'signin'|'signup'|'reset', reason?: string }} [opts]
 */
export async function openSignIn(opts = {}) {
  const ui = await import('./auth-ui.js');
  return ui.openAuthDialog({ ...opts, getAuth: getAuthInstance });
}

chromeReady().then(async chrome => {
  if (checkoutOn) chrome.setCheckout({ enabled: true, href: '/pricing' });
  const signedOutOpts = checkoutOn ? { signIn: () => openSignIn() } : {};
  const attach = async auth => {
    const { onAuthStateChanged, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    onAuthStateChanged(auth, u => chrome.setUser(u && !u.isAnonymous ? u : null, {
      ...signedOutOpts,
      signOut: () => signOut(auth),
      accountHref: '/account',
    }));
  };
  try {
    const fb = await import('./config/firebase.js');
    await fb.initFirebase();          // loads the SDK only when a session may exist here
    if (!fb.auth) chrome.setUser(null, signedOutOpts);
    fb.onFirebaseReady(a => attach(a).catch(() => chrome.setUser(null, signedOutOpts)));
  } catch (e) {
    chrome.setUser(null);   // Firebase unreachable: signed out, tools keep working
  }
});
