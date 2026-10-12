/**
 * nav-toggle.js — Mobile hamburger menu controller
 * Loaded as a regular (non-module) script on every page.
 * Kept as a classic script (not module) so it executes synchronously
 * after the DOM is parsed, without needing defer or DOMContentLoaded.
 */
(function () {
  'use strict';

  var btn = document.getElementById('navHamburger');
  var nav = document.querySelector('.nav-links');

  if (!btn || !nav) return;

  function openMenu() {
    nav.classList.add('open');
    btn.textContent = '✕';
    btn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    nav.classList.remove('open');
    btn.textContent = '☰';
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    nav.classList.contains('open') ? closeMenu() : openMenu();
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  // Close when a nav link is clicked (mobile UX)
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', closeMenu);
  });
})();

// Drop zones (A11Y-011 nested-interactive, A11Y-006 label-in-name): the transparent
// native <input type="file"> that covers each zone is the real control. Clicking the zone
// lands on it, and it is natively keyboard-operable. The wrapper used to also be a
// role="button" with tabindex="0" and a reworded aria-label, which nested one control
// inside another and gave keyboard users two stops for the same picker. Strip the wrapper
// semantics, show the focus ring on the zone, and name the input from the zone's visible
// text when the page gives it no label of its own.
document.querySelectorAll('.drop-zone[role="button"]').forEach(function (zone) {
  var input = zone.querySelector('input[type="file"]');
  if (!input) return;
  var copy = zone.cloneNode(true);
  copy.querySelectorAll('.drop-zone-icon, input').forEach(function (n) { n.remove(); });
  var visible = (copy.textContent || '').replace(/\s+/g, ' ').trim();
  zone.removeAttribute('role');
  zone.removeAttribute('tabindex');
  zone.removeAttribute('aria-label');
  if (!(input.labels && input.labels.length) && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby') && visible) {
    input.setAttribute('aria-label', visible);
  }
});

// Service worker registration (runs once per page load)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
