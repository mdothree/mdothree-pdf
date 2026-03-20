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

// Service worker registration (runs once per page load)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
