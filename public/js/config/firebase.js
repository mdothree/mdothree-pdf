/**
 * firebase.js — Firebase initialization using runtime ENV config
 *
 * Reads all keys from env.js (which reads from window.__ENV__ or meta tags).
 * The app works without Firebase — all tools function client-side.
 * Firebase only enables: anonymous auth, usage history, premium status sync.
 */

import { ENV } from './env.js';

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore, collection, addDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAnalytics }
  from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// ── Build config from ENV ─────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            ENV.FIREBASE_API_KEY,
  authDomain:        ENV.FIREBASE_AUTH_DOMAIN,
  projectId:         ENV.FIREBASE_PROJECT_ID,
  storageBucket:     ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId:             ENV.FIREBASE_APP_ID,
  measurementId:     ENV.FIREBASE_MEASUREMENT_ID,
};

// ── Initialize (graceful no-op if unconfigured) ───────────────────────────

let app, auth, db, analytics;
const _configured = Boolean(ENV.FIREBASE_API_KEY && ENV.FIREBASE_PROJECT_ID);

if (_configured) {
  try {
    app       = initializeApp(firebaseConfig);
    auth      = getAuth(app);
    db        = getFirestore(app);
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn('[Firebase] Init failed:', e.message);
  }
} else {
  console.info('[Firebase] No config — running without Firebase.');
}

// ── Anonymous auth ────────────────────────────────────────────────────────

export async function initFirebase() {
  if (!auth) return null;
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) return resolve(user);
      try {
        const r = await signInAnonymously(auth);
        resolve(r.user);
      } catch (e) {
        console.warn('[Firebase] Anonymous auth failed:', e.message);
        resolve(null);
      }
    });
  });
}

// ── History helpers ───────────────────────────────────────────────────────

export async function saveToHistory(toolName, metadata = {}) {
  if (!db || !auth?.currentUser) return null;
  try {
    const ref = await addDoc(collection(db, 'history'), {
      uid: auth.currentUser.uid,
      tool: toolName,
      timestamp: serverTimestamp(),
      ...metadata,
    });
    return ref.id;
  } catch (e) {
    console.warn('[Firebase] saveToHistory failed:', e.message);
    return null;
  }
}

export async function getHistory(toolName = null, maxItems = 20) {
  if (!db || !auth?.currentUser) return [];
  try {
    const c = [
      where('uid', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(maxItems),
    ];
    if (toolName) c.splice(1, 0, where('tool', '==', toolName));
    const snap = await getDocs(query(collection(db, 'history'), ...c));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[Firebase] getHistory failed:', e.message);
    return [];
  }
}

export { auth, db, analytics };
