// The deployed site, probed from outside.
//
// Everything else in `npm run verify` runs against the source tree. This layer
// asks the one question the source cannot answer: is the thing children are
// actually using right now the thing we think we shipped?
//
// It exists because two of this project's worst failures were invisible from
// the repo. The service worker's install could reject and leave every device
// on the previous release while the site looked perfectly healthy online. And
// `battles.field_version` was written by code that had no migration for it —
// production worked only because someone had altered the database by hand, so
// the repo and the live site had quietly disagreed for months.
//
// Read-only: it signs in as nobody, writes nothing, and every route it calls
// is expected to refuse it.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { realRoutes } = require('./manifest');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_BASE = 'https://eng-pwa.pages.dev';
const TIMEOUT_MS = 15000;
const HASH_CONCURRENCY = 8;
const NO_CACHE = { headers: { 'Cache-Control': 'no-cache' } };
// The hash scripts/build-sw-manifest.js writes before it has run: a manifest
// full of these was never built, and the worker would reject every file.
const PLACEHOLDER_HASH = '0000000000000000';

async function get(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, Object.assign({ signal: ctrl.signal, redirect: 'follow' }, opts || {}));
  } finally { clearTimeout(timer); }
}

// The `const PRECACHE = { '/x': '0123456789abcdef', … }` block of a sw.js
// source: [{ url, hash }] in file order, or null when there is no such block.
function parsePrecache(src) {
  const m = src.match(/const PRECACHE = \{([\s\S]*?)\};/);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'\s*:\s*'([0-9a-f]{16})'/g)].map(x => ({ url: x[1], hash: x[2] }));
}

function sha16(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

// Run `fn` over `items`, at most `width` at a time, keeping the order.
async function mapLimited(items, width, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  return out;
}

async function verifyLive(baseUrl) {
  const base = (baseUrl || process.env.VERIFY_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const checks = [];
  const add = (id, feature, ok, detail) => checks.push({ id, feature, ok, detail });
  const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

  // 1. Is the Functions bundle the one this checkout describes?
  try {
    const res = await get(base + '/api/version');
    const body = await res.json();
    add('live-version', 'Bản đang chạy khớp với checkout này', res.ok && body.version === expected,
      res.ok ? `live ${body.version}, repo ${expected}` : `HTTP ${res.status}`);
  } catch (e) {
    add('live-version', 'Bản đang chạy khớp với checkout này', false, 'không gọi được /api/version: ' + e.message);
  }

  // 2. The service worker actually served, and carrying the rules it must.
  //    A stale sw.js is how a device keeps running last month's app.
  try {
    const res = await get(base + '/sw.js');
    const src = await res.text();
    const localCache = (fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/flashlingo-v\d+/) || [])[0];
    const liveCache = (src.match(/flashlingo-v\d+/) || [])[0];
    add('live-sw-version', 'Service worker đang chạy đúng phiên bản', liveCache === localCache,
      `live ${liveCache}, repo ${localCache}`);
    add('live-sw-api-skip', 'Service worker không cache /api/', src.includes("pathname.startsWith('/api/')"),
      'API phải đi thẳng ra mạng — cache theo URL từng trả dữ liệu của bé khác');
    add('live-sw-best-effort', 'Cài service worker theo kiểu best-effort',
      src.includes('ASSETS.map(async url') && !src.includes('cache.addAll(ASSETS)'),
      'một file lỗi không được làm hỏng cả bản cài');
  } catch (e) {
    add('live-sw-version', 'Service worker đang chạy đúng phiên bản', false, 'không tải được /sw.js: ' + e.message);
  }

  // 2b. The manifest inside the served sw.js must describe the served bytes.
  //     The worker installs cache-first from that manifest and REJECTS any
  //     file whose SHA-256 differs from the value it carries — so a sw.js
  //     whose hashes belong to another build is a release no device can
  //     install, while the site itself looks perfectly healthy online.
  //     This is the only place the two halves of a deploy are compared.
  const MANIFEST_ID = 'live-sw-manifest';
  const MANIFEST_FEATURE = 'Manifest trong sw.js khớp với file đang phục vụ';
  try {
    const res = await get(base + '/sw.js', NO_CACHE);
    const src = await res.text();
    const entries = res.ok ? parsePrecache(src) : null;
    if (!entries || !entries.length) {
      add(MANIFEST_ID, MANIFEST_FEATURE, false,
        res.ok ? 'sw.js đang chạy không có khối `const PRECACHE = { … }`' : `HTTP ${res.status}`);
    } else if (entries.some(e => e.hash === PLACEHOLDER_HASH)) {
      const blank = entries.filter(e => e.hash === PLACEHOLDER_HASH).map(e => e.url);
      add(MANIFEST_ID, MANIFEST_FEATURE, false,
        `deploy đã ship manifest chưa build — ${blank.length} hash còn là ${PLACEHOLDER_HASH}: ${blank.slice(0, 5).join(', ')}${blank.length > 5 ? ', …' : ''}`);
    } else {
      // Sprites, MP3s and fonts are left out: they are immutable by name and
      // would make this a 30 MB download. The files that carry code are what
      // a stale manifest breaks.
      const textual = entries.filter(e => e.url === '/' || /\.(js|css|html|json)$/.test(e.url));
      const results = await mapLimited(textual, HASH_CONCURRENCY, async e => {
        try {
          // Pages 308s /index.html to /; `get` follows, so both keys hash the
          // shell that is actually served.
          const r = await get(base + e.url, NO_CACHE);
          if (!r.ok) return { url: e.url, ok: false, why: `HTTP ${r.status}` };
          const type = r.headers.get('content-type') || '';
          const isPage = e.url === '/' || e.url.endsWith('.html');
          // The SPA fallback answers an unknown path with 200 text/html —
          // a script that comes back as HTML is a 404 wearing a disguise.
          if (!isPage && type.indexOf('text/html') !== -1) return { url: e.url, ok: false, why: 'trả về HTML (SPA fallback)' };
          const got = sha16(Buffer.from(await r.arrayBuffer()));
          return { url: e.url, ok: got === e.hash, why: `manifest ${e.hash}, thật ${got}` };
        } catch (err) { return { url: e.url, ok: false, why: err.message }; }
      });
      const bad = results.filter(r => !r.ok);
      add(MANIFEST_ID, MANIFEST_FEATURE, bad.length === 0,
        bad.length ? `${bad.length}/${results.length} lệch: ` + bad.map(b => `${b.url} → ${b.why}`).join('; ')
                   : `${results.length}/${results.length} khớp (${entries.length} mục trong manifest)`);
    }
  } catch (e) {
    add(MANIFEST_ID, MANIFEST_FEATURE, false, 'không tải được /sw.js: ' + e.message);
  }

  // 3. The app shell and every startup script really load. A 404 here is an
  //    app that opens to a blank screen for a child with a cold cache.
  let scripts = [];
  try {
    const res = await get(base + '/');
    const html = await res.text();
    scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !s.startsWith('http'));
    add('live-shell', 'Trang chủ tải được', res.ok && html.includes('FlashLingo'), `HTTP ${res.status}, ${scripts.length} script`);
  } catch (e) {
    add('live-shell', 'Trang chủ tải được', false, e.message);
  }
  if (scripts.length) {
    const results = await Promise.all(scripts.map(async src => {
      try {
        const r = await get(base + '/' + src.replace(/^\//, ''), { method: 'GET' });
        const type = r.headers.get('content-type') || '';
        // Pages answers an unknown path with the SPA fallback: 200 text/html.
        // A script that comes back as HTML is a 404 wearing a disguise.
        return { src, ok: r.ok && type.indexOf('text/html') === -1, why: `HTTP ${r.status} ${type.split(';')[0]}` };
      } catch (e) { return { src, ok: false, why: e.message }; }
    }));
    const bad = results.filter(r => !r.ok);
    add('live-scripts', 'Mọi script khởi động đều tải được', bad.length === 0,
      bad.length ? bad.map(b => `${b.src} → ${b.why}`).join('; ') : `${results.length} script, tất cả đều là JS thật`);
  }

  // 4. Every API route answers — and refuses. A 5xx here is a route that
  //    crashes before it even looks at who is asking, which is what a missing
  //    database column looks like from outside.
  //
  //    Each route is probed with the verb it actually exports. Sending GET to
  //    a POST-only Function does not reach the Function at all: Pages falls
  //    through to the static handler and answers the SPA shell with 200, which
  //    reads exactly like an endpoint leaking data to a stranger.
  const methodOf = { onRequestGet: 'GET', onRequestPost: 'POST', onRequestPut: 'PUT', onRequestDelete: 'DELETE' };
  const routes = realRoutes().filter(r => r !== 'version').flatMap(r => {
    const src = fs.readFileSync(path.join(ROOT, 'functions/api', r + '.js'), 'utf8');
    const verbs = Object.keys(methodOf).filter(h => src.includes('export async function ' + h) || src.includes('export function ' + h));
    return verbs.map(v => ({ r, method: methodOf[v] }));
  });
  const probes = await Promise.all(routes.map(async ({ r, method }) => {
    try {
      const res = await get(`${base}/api/${r}`, method === 'GET' ? undefined
        : { method, headers: { 'Content-Type': 'application/json' }, body: '{}' });
      return { r: `${method} ${r}`, status: res.status };
    } catch (e) { return { r: `${method} ${r}`, status: 0, err: e.message }; }
  }));
  const crashed = probes.filter(p => p.status >= 500 || p.status === 0);
  add('live-routes-alive', 'Không route nào sập khi chưa đăng nhập', crashed.length === 0,
    crashed.length ? crashed.map(p => `${p.r} → ${p.err || p.status}`).join('; ')
                   : `${probes.length} route, không có 5xx`);
  // A public route may answer 200 to a well-formed request, but none of these
  // is being sent one: an empty body is not a login and not a registration.
  const leaky = probes.filter(p => p.status === 200);
  add('live-routes-closed', 'Không route nào trả dữ liệu cho người lạ', leaky.length === 0,
    leaky.length ? `trả 200 khi chưa đăng nhập: ${leaky.map(p => p.r).join(', ')}` : 'tất cả đều đòi đăng nhập');

  // 5. A token in the query string must not authenticate anything.
  try {
    const res = await get(`${base}/api/friends?token=whatever`);
    add('live-no-query-token', 'Token trong URL không mở được gì', res.status === 401 || res.status === 403,
      `HTTP ${res.status}`);
  } catch (e) {
    add('live-no-query-token', 'Token trong URL không mở được gì', false, e.message);
  }

  return { checks, base };
}

module.exports = { verifyLive, parsePrecache, sha16, mapLimited };
