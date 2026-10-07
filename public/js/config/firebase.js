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
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
function getFirebaseApp() {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  initAppCheck(_app);
  return _app;
}

// App Check (OFF by default). Enable with window.__ENV__ / meta:
//   FIREBASE_APPCHECK_ENABLED=true, FIREBASE_APPCHECK_SITE_KEY=<reCAPTCHA Enterprise key>
// Register the key in Firebase console > App Check first; do not enforce until the
// console shows verified traffic.
function initAppCheck(app) {
  const on = String((typeof window !== 'undefined' && window.__ENV__?.FIREBASE_APPCHECK_ENABLED) || '') === 'true';
  const key = (typeof window !== 'undefined' && window.__ENV__?.FIREBASE_APPCHECK_SITE_KEY) || '';
  if (!on || !key) return;
  import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check.js')
    .then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) => initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(key),
      isTokenAutoRefreshEnabled: true,
    }))
    .catch(e => console.warn('[Firebase] App Check init failed:', e?.message));
}

let _initPromise = null;

/**
 * Initialise once; resolves to the signed-in user or null. No anonymous account is
 * created any more: a guest uid can never hold Pro (per browser + per subdomain,
 * refused by the API), so minting one per visitor only stored data for nothing.
 */
export function initFirebase() {
  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        const app = getFirebaseApp();
        auth = getAuth(app);
        db = getFirestore(app);
        const user = await new Promise(resolve => {
          const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
        });
        return user || null;
      } catch (e) {
        console.warn('[Firebase] init failed:', e?.message);
        return null;
      }
    })();
  }
  return _initPromise;
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
  initialize: async () => Boolean(await initFirebase()),
  getAuth: () => auth,
  getFirestore: () => db,
  getCurrentUser: () => auth?.currentUser || null,
};
