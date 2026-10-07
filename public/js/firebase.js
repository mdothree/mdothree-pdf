/**
 * firebase.js — compatibility shim.
 *
 * Some modules import Firebase helpers from './firebase.js'. The real (modular SDK)
 * implementation lives in './config/firebase.js'; this re-exports it.
 */
export {
  auth,
  db,
  analytics,
  initFirebase,
  saveToHistory,
  getHistory,
  firebaseConfig,
} from './config/firebase.js';
