/**
 * config/firebase.js — the ONLY Firebase init for mdothree-pdf (project mdo3d-utilities).
 * Modular v10 SDK, single initializeApp, no compat <script> tags (they were only on
 * index.html, so Pro could never be detected on the tool pages).
 *
 * Firebase is used for ONE thing: reading the caller's own subscriptions/{uid} doc
 * (written only by the Stripe webhook). Tool history stays in this browser
 * (localStorage) — nothing the user types, uploads or produces is sent to Firestore.
 *
 * Config: window.__ENV__ / <meta name="env-FIREBASE_*"> (see ../env.js) override the
 * committed default. The web API key is public by design but MUST be restricted in
 * GCP (APIs & Services > Credentials) to HTTP referrers https://*.mdothree.com/* and
 * https://mdothree.com/*.
 */
import { ENV } from '../env.js';

// PERF-008 (the PERF-002 method from mdothree-hash/-color): the Firebase SDK (~174 KB from
// www.gstatic.com) is NOT requested on a plain first visit. Nothing here imports it statically;
// initFirebase() loads it only when
//   - this browser already has a session here (mdo:fb-session marker, or the SDK's own
//     IndexedDB store from an earlier visit), or
//   - the visitor comes back from checkout / the billing portal (?session_id, ?success, ...), or
//   - the Pro / account UI opens or the visitor signs in: callers pass { force: true }
//     (auth-nav.js openSignIn, the paywall modal, the account page).
// Without a session there is no user to find (no anonymous accounts are minted), so a lazy
// "signed out" answer is the same answer the SDK would give.
export const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.0/';

const APP_NAME = 'mdothree-pdf';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkNK59CoXyS9qn65c2mbWiBVT_KUOgul4",
  authDomain: "mdo3d-utilities.firebaseapp.com",
  projectId: "mdo3d-utilities",
  storageBucket: "mdo3d-utilities.firebasestorage.app",
  messagingSenderId: "699798570384",
  appId: "1:699798570384:web:aa658f6732f1db10e31f15"
};

const FIREBASE_CONFIG = ENV.FIREBASE_API_KEY && ENV.FIREBASE_PROJECT_ID
  ? {
      apiKey: ENV.FIREBASE_API_KEY,
      authDomain: ENV.FIREBASE_AUTH_DOMAIN,
      projectId: ENV.FIREBASE_PROJECT_ID,
      storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
      appId: ENV.FIREBASE_APP_ID,
    }
  : DEFAULT_FIREBASE_CONFIG;

// Live bindings: populated by initFirebase().
export let auth = null;
export let db = null;
export const analytics = null;

let _app = null;
function getFirebaseApp(appMod) {
  if (_app) return _app;
  _app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
  initAppCheck(_app);
  return _app;
}

// Set while this browser holds a Firebase user on this origin; lets the next visit restore the
// session without loading the SDK to find out.
const SESSION_MARK = 'mdo:fb-session';
function markSession(on) {
  try { if (on) localStorage.setItem(SESSION_MARK, '1'); else localStorage.removeItem(SESSION_MARK); } catch { /* storage blocked */ }
}

const RETURN_PARAMS = ['session_id', 'stripe_success', 'success', 'checkout', 'portal'];
let _wantPromise = null;
/**
 * Should this page load restore Firebase state up front? True when a session exists here (our
 * marker, or the SDK's IndexedDB store) or on a checkout / portal return. Never loads the SDK.
 * Where IndexedDB cannot be listed, it answers true (the pre-PERF-008 behaviour).
 */
export function wantsFirebaseOnLoad() {
  if (!_wantPromise) {
    _wantPromise = (async () => {
      if (_initPromise) return true;
      try { if (localStorage.getItem(SESSION_MARK) === '1') return true; } catch { /* storage blocked */ }
      try {
        const q = new URLSearchParams(location.search);
        if (RETURN_PARAMS.some(k => q.has(k))) return true;
      } catch { /* no location */ }
      try {
        if (typeof indexedDB === 'undefined') return false;
        if (!indexedDB.databases) return true;
        const dbs = await indexedDB.databases();
        return dbs.some(d => d && d.name === 'firebaseLocalStorageDb');
      } catch { return true; }
    })();
  }
  return _wantPromise;
}

// Listeners waiting for the SDK (auth-nav.js attaches the account menu when it loads later).
const _ready = [];
/** Call cb(auth) once the SDK has loaded (now, if it already has). */
export function onFirebaseReady(cb) {
  if (auth) { try { cb(auth); } catch { /* ignore */ } return; }
  _ready.push(cb);
}

// App Check (OFF by default). Enable with window.__ENV__ / meta:
//   FIREBASE_APPCHECK_ENABLED=true, FIREBASE_APPCHECK_SITE_KEY=<reCAPTCHA Enterprise key>
// Register the key in Firebase console > App Check first; do not enforce until the
// console shows verified traffic.
function initAppCheck(app) {
  const on = String((typeof window !== 'undefined' && window.__ENV__?.FIREBASE_APPCHECK_ENABLED) || '') === 'true';
  const key = (typeof window !== 'undefined' && window.__ENV__?.FIREBASE_APPCHECK_SITE_KEY) || '';
  if (!on || !key) return;
  import(SDK_BASE + 'firebase-app-check.js')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true,
    }))
    .catch(e => console.warn('[Firebase] App Check init failed:', e?.message));
}

let _initPromise = null;

function startFirebase() {
  _initPromise = (async () => {
    try {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(SDK_BASE + 'firebase-app.js'),
        import(SDK_BASE + 'firebase-auth.js'),
        import(SDK_BASE + 'firebase-firestore.js'),
      ]);
      const app = getFirebaseApp(appMod);
      auth = authMod.getAuth(app);
      db = fsMod.getFirestore(app);
      const user = await new Promise(resolve => {
        const unsub = authMod.onAuthStateChanged(auth, u => { unsub(); resolve(u); });
      });
      try { authMod.onAuthStateChanged(auth, u => markSession(!!u)); } catch { /* ignore */ }
      _ready.splice(0).forEach(fn => { try { fn(auth); } catch { /* ignore */ } });
      return user || null;
    } catch (e) {
      console.warn('[Firebase] init failed:', e?.message);
      return null;
    }
  })();
  return _initPromise;
}

/**
 * Initialise once; resolves to the signed-in user or null. No anonymous account is
 * created any more: a guest uid can never hold Pro (per browser + per subdomain,
 * refused by the API), so minting one per visitor only stored data for nothing.
 *
 * PERF-008: without { force: true } this loads the SDK only when wantsFirebaseOnLoad()
 * says a session may exist here; otherwise it resolves to null (signed out) and loads
 * nothing. Pass { force: true } from sign-in / Pro / account UI.
 * @param {{ force?: boolean }} [opts]
 */
export function initFirebase({ force = false } = {}) {
  if (_initPromise) return _initPromise;
  if (force) return startFirebase();
  return wantsFirebaseOnLoad().then(want => _initPromise || (want ? startFirebase() : null));
}

/** Firestore doc read helper so callers never import the SDK statically. */
export async function getDocData(path, id) {
  if (!db) return null;
  const { doc, getDoc } = await import(SDK_BASE + 'firebase-firestore.js');
  const snap = await getDoc(doc(db, path, id));
  return snap.exists() ? snap.data() : null;
}

// ── Tool history: this browser only ─────────────────────────────────────────
const HISTORY_KEY = `mdothree:history:${APP_NAME}`;
const HISTORY_MAX = 50;

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') || []; } catch { return []; }
}

/** Record a tool run locally (metadata only: counts/settings, never content). */
export async function saveToHistory(toolName, metadata = {}) {
  try {
    const items = readHistory();
    const entry = { id: String(Date.now()) + Math.random().toString(36).slice(2, 6), tool: toolName, timestamp: Date.now() };
    for (const [k, v] of Object.entries(metadata || {})) {
      if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 100)) entry[k] = v;
    }
    items.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
    return entry.id;
  } catch {
    return null;
  }
}

export async function getHistory(toolName = null, maxItems = 20) {
  const items = readHistory();
  return (toolName ? items.filter(i => i.tool === toolName) : items).slice(0, maxItems);
}

// Back-compat for modules that imported the old compat-SDK service object.
export const firebaseConfig = {
  initialize: async () => Boolean(await initFirebase({ force: true })),
  getAuth: () => auth,
  getFirestore: () => db,
  getCurrentUser: () => auth?.currentUser || null,
};
