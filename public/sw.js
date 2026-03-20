/**
 * sw.js — Service Worker for mdothree tools
 *
 * Strategy: Cache-first for static assets, network-first for HTML pages.
 * Tools that work entirely client-side (text, JSON, QR) will work offline.
 * PDF tools need pdf-lib + pdfjs CDN — cached on first visit.
 *
 * Register from any HTML page:
 *   if ('serviceWorker' in navigator) {
 *     navigator.serviceWorker.register('/sw.js');
 *   }
 */

'use strict';

const CACHE_NAME = 'mdothree-v1';

// Assets to pre-cache on install
const PRECACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/env.js',
  '/js/nav-toggle.js',
  '/js/stripe-paywall.js',
  '/js/config/firebase.js',
  '/manifest.json',
  '/favicon.svg',
  '/404.html',
];

// CDN resources to cache on first use
const CDN_CACHE = 'mdothree-cdn-v1';
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
];

// ── Install: pre-cache core assets ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache with network fallback ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache Firebase auth/Firestore/Stripe API calls
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('/v1/') ||
      url.hostname === 'api.stripe.com' ||
      url.hostname === 'js.stripe.com' ||
      url.hostname.includes('cloudfunctions.net')) {
    return; // Let browser handle normally
  }

  // CDN resources: cache-first with long TTL
  if (CDN_HOSTS.some(h => url.hostname === h)) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Local HTML pages: network-first (always get fresh HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request)
          .then(cached => cached || caches.match('/404.html'))
        )
    );
    return;
  }

  // Local CSS/JS/images: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          }).catch(() => new Response('Offline', { status: 503 }));
        })
      )
    );
  }
});
