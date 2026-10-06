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

// Keyboard access for drop zones: they are role="button" + tabindex="0" but
// had no key handler, so Enter/Space on a focused drop zone did nothing.
document.querySelectorAll('.drop-zone[role="button"]').forEach(function (zone) {
  zone.addEventListener('keydown', function (e) {
    if (e.target !== zone || (e.key !== 'Enter' && e.key !== ' ')) return;
    var input = zone.querySelector('input[type="file"]');
    if (input) { e.preventDefault(); input.click(); }
  });
});

// Service worker registration (runs once per page load)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
