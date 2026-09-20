// hosting.js — where the server halves of the app live, decided by the host
// the page is served from. Loaded before js/auth.js (and by admin.html), so
// every caller reads one answer.
//
// The same static files ship to two hosts:
//   - Cloudflare Pages (https://eng-pwa.pages.dev/): the API is the same
//     origin (/api/* are Pages Functions on the eng_pwa_db database) and the
//     realtime battle rooms are the eng-pwa-battle Worker.
//   - GitHub Pages (https://0x4123dev.github.io/learn-eng-pwa/): static only,
//     so /api/ would 404. Its API is the separate Cloudflare Pages project
//     learn-eng-pwa-api (scripts/deploy-api.sh) on its OWN database,
//     learn_eng_pwa_db, and its battle rooms the learn-eng-pwa-battle Worker
//     behind that same API domain (/ws/…), so no workers.dev name shows.
//     Nothing here touches the Cloudflare app or its data: different
//     project, different database, different Worker.
//
// Cross-origin calls need CORS, which functions/api/_middleware.js grants to the
// GitHub origin. Tokens travel in the Authorization header (never cookies),
// so no credentialed CORS is involved.
//
// `window.API_BASE` / `window.BATTLE_WS_URL` override either for a local
// dev server (`npx wrangler@3 pages dev . --d1 DB=…`) or a test.
(function (global) {
  'use strict';
  const GITHUB_API = 'https://learn-eng-pwa-api.pages.dev';
  // The rooms sit behind the API's own domain (functions/ws/[[path]].js
  // forwards the upgrade over a service binding), so no workers.dev name —
  // which carries the account owner's subdomain — is ever in the app.
  const GITHUB_BATTLE_WS = 'wss://learn-eng-pwa-api.pages.dev/ws';
  const CLOUDFLARE_BATTLE_WS = 'wss://eng-pwa-battle.minhdoanh.workers.dev';

  function isGitHubPages(hostname) {
    return /(^|\.)github\.io$/.test(String(hostname || ''));
  }
  // '' = same origin (Cloudflare); an absolute origin, no trailing slash, on GitHub.
  function apiBase(hostname) {
    if (global.API_BASE !== undefined && global.API_BASE !== null) return String(global.API_BASE).replace(/\/$/, '');
    return isGitHubPages(hostname) ? GITHUB_API : '';
  }
  function battleWsBase(hostname) {
    if (global.BATTLE_WS_URL) return String(global.BATTLE_WS_URL).replace(/\/$/, '');
    return isGitHubPages(hostname) ? GITHUB_BATTLE_WS : CLOUDFLARE_BATTLE_WS;
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
    battleWsBase: () => battleWsBase(currentHostname()),
    // The pure rules, for tests.
    _rules: { isGitHubPages, apiBase, battleWsBase, apiUrl, GITHUB_API, GITHUB_BATTLE_WS, CLOUDFLARE_BATTLE_WS },
  };
  global.Hosting = Hosting;
  if (typeof module !== 'undefined' && module.exports) module.exports = Hosting;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
