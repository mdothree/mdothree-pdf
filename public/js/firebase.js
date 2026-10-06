/**
 * firebase.js — compatibility shim.
 *
 * stripe-paywall.js (and page controllers) import Firebase helpers from
 * './firebase.js'. The real implementation lives in './config/firebase.js'.
 * This module re-exports that interface so the relative import resolves on
 * production instead of 404-ing.
 */
export {
  auth,
  db,
  analytics,
  initFirebase,
  saveToHistory,
  getHistory,
} from './config/firebase.js';
