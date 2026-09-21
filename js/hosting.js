// hosting.js — where the server halves of the app live, decided by the host
// the page is served from. Loaded before js/auth.js (and by admin.html), so
// every caller reads one answer.
//
// The same static files ship to two hosts:
//   - Cloudflare Pages (https://eng-pwa.pages.dev/): the API is the same
//     origin (/api/* are Pages Functions on the eng_pwa_db database).
//   - GitHub Pages (https://0x4123dev.github.io/learn-eng-pwa/): static only,
//     so /api/ would 404. Its API is the separate Cloudflare Pages project
//     learn-eng-pwa-api (scripts/deploy-api.sh) on its OWN database,
//     learn_eng_pwa_db. Nothing here touches the Cloudflare app or its data.
//
// Cross-origin calls need CORS, which functions/api/_middleware.js grants to the
// GitHub origin. Tokens travel in the Authorization header (never cookies),
// so no credentialed CORS is involved.
//
// `window.API_BASE` overrides it for a local dev server
// (`npx wrangler@3 pages dev . --d1 DB=…`) or a test.
(function (global) {
  'use strict';
  const GITHUB_API = 'https://learn-eng-pwa-api.pages.dev';

  function isGitHubPages(hostname) {
    return /(^|\.)github\.io$/.test(String(hostname || ''));
  }
  // '' = same origin (Cloudflare); an absolute origin, no trailing slash, on GitHub.
  function apiBase(hostname) {
    if (global.API_BASE !== undefined && global.API_BASE !== null) return String(global.API_BASE).replace(/\/$/, '');
    return isGitHubPages(hostname) ? GITHUB_API : '';
  }
  // 'me/wins' → '/api/me/wins' here, 'https://learn-eng-pwa-api.pages.dev/api/me/wins' there.
  function apiUrl(path, hostname) {
    return apiBase(hostname) + '/api/' + String(path || '').replace(/^\/?(api\/)?/, '');
  }
  function currentHostname() {
    try { return (typeof location !== 'undefined' && location.hostname) || ''; } catch (e) { return ''; }
  }

  const Hosting = {
    isGitHubPages: () => isGitHubPages(currentHostname()),
    apiBase: () => apiBase(currentHostname()),
    apiUrl: (path) => apiUrl(path, currentHostname()),
    // The pure rules, for tests.
    _rules: { isGitHubPages, apiBase, apiUrl, GITHUB_API },
  };
  global.Hosting = Hosting;
  if (typeof module !== 'undefined' && module.exports) module.exports = Hosting;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
