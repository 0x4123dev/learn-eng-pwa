// The service worker, EXECUTED.
//
// Every defect this file covers shipped, and every one of them was invisible
// to a source grep — which is all sw.js had until now:
//
//   • install used cache.addAll, so ONE failing entry out of 153 rejected the
//     whole install; registerServiceWorker swallowed the rejection, and the
//     device stayed on the previous worker for good. Online the app looked
//     fine (network-first), offline it served the old release's JS.
//   • the fetch handler cached every same-origin GET — including /api/* with
//     a Bearer header that is not part of the Cache API key — and replayed it
//     offline, so the second child on a shared iPad got the first child's
//     castle, wallet and friend list.
//   • the offline fallback returned caches.match(...) directly, which is
//     undefined for an uncached URL: respondWith(undefined) throws, and a
//     friend-invite link /?ketban=Na never matched the precached '/' anyway.
//   • network-first had no timeout, so on lie-fi the 55 startup scripts each
//     waited out the OS socket timeout before falling back to a full cache.
//
// sw.js is a classic worker script, so it is run here in a vm with a mock
// `self`, `caches` and `fetch`.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const SW_SRC = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ORIGIN = 'https://eng-pwa.pages.dev';

// ---- a Cache Storage that behaves like the real one where it matters -------
function makeCaches() {
  const stores = new Map();
  const keyOf = req => (typeof req === 'string' ? req : req.url);
  const norm = k => (k.startsWith('http') ? new URL(k).pathname + new URL(k).search : k);

  function open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return Promise.resolve({
      put: (req, res) => { store.set(norm(keyOf(req)), res); return Promise.resolve(); },
      match: (req, opts) => Promise.resolve(find(store, norm(keyOf(req)), opts)),
      delete: req => Promise.resolve(store.delete(norm(keyOf(req)))),
      _store: store,
    });
  }
  function find(store, key, opts) {
    if (store.has(key)) return store.get(key);
    if (opts && opts.ignoreSearch) {
      const bare = key.split('?')[0];
      if (store.has(bare)) return store.get(bare);
    }
    return undefined;
  }
  return {
    open,
    keys: () => Promise.resolve([...stores.keys()]),
    delete: name => Promise.resolve(stores.delete(name)),
    match: (req, opts) => {
      const key = norm(keyOf(req));
      for (const store of stores.values()) {
        const hit = find(store, key, opts);
        if (hit) return Promise.resolve(hit);
      }
      return Promise.resolve(undefined);
    },
    _stores: stores,
  };
}

const body = (text, type) => new Response(text, { status: 200, headers: { 'Content-Type': type } });

// The worker verifies every precached body against the manifest (first 16
// hex chars of SHA-256). The shipped sw.js carries the hashes of the real
// files; a test's mock network serves 'ok', so the harness rewrites the
// PRECACHE block to the hash of whatever body each URL will get.
const crypto = require('crypto');
const sha16 = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const PRECACHE_RE = /const PRECACHE\s*=\s*\{([\s\S]*?)\};/;
const MANIFEST_URLS = (SW_SRC.match(PRECACHE_RE)[1].match(/'(\/[^']*)'\s*:/g) || []).map(k => k.slice(1, k.lastIndexOf("'")));
function withManifest(bodyFor) {
  const block = MANIFEST_URLS.map(u => `  '${u}': '${sha16(bodyFor(u))}'`).join(',\n');
  return SW_SRC.replace(PRECACHE_RE, `const PRECACHE = {\n${block}\n};`);
}

// Boot sw.js. `fetchImpl(url)` decides what the network does; `opts.bodyFor(url)`
// is the text the manifest should expect for each precached URL (default 'ok').
function bootWorker(fetchImpl, opts) {
  opts = opts || {};
  const bodyFor = opts.bodyFor || (() => 'ok');
  const listeners = {};
  const requested = [];
  let skipWaitingCalls = 0;
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Response, Request, URL, Promise, Math, Date, JSON, Number, String, Object, Array, Uint8Array, Error,
    setTimeout, clearTimeout,
    crypto: globalThis.crypto,
    caches: makeCaches(),
    fetch: (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      requested.push(url);
      // A network failure must arrive as a REJECTED promise, the way the real
      // fetch() reports it — not as a synchronous throw, which would take a
      // different path through the worker than production ever does.
      try { return Promise.resolve(fetchImpl(url, init)); }
      catch (e) { return Promise.reject(e); }
    },
    self: {
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
      location: { origin: ORIGIN },
      skipWaiting: () => { skipWaitingCalls++; },
      clients: { claim: () => Promise.resolve() },
    },
  };
  sandbox.self.caches = sandbox.caches;
  vm.createContext(sandbox);
  vm.runInContext(withManifest(bodyFor), sandbox);

  function fire(type, event) {
    const out = [];
    for (const fn of (listeners[type] || [])) out.push(fn(event));
    return out;
  }
  return { sandbox, fire, requested, listeners, skipWaiting: () => skipWaitingCalls };
}

// A fetch event whose respondWith / waitUntil promise the test can await.
function fetchEvent(url, opts) {
  opts = opts || {};
  const event = {
    request: new Request(url, { method: opts.method || 'GET' }),
    responded: null,
    respondWith(p) { event.responded = p; },
  };
  if (opts.mode) Object.defineProperty(event.request, 'mode', { value: opts.mode });
  return event;
}
async function install(worker) {
  let waited = null;
  worker.fire('install', { waitUntil: p => { waited = p; } });
  assert.truthy(waited, 'install must waitUntil something');
  return waited;
}
const ASSET_COUNT = (SW_SRC.match(/const PRECACHE\s*=\s*\{([\s\S]*?)\};/)[1].match(/'\/[^']*'\s*:/g) || []).length;
const CACHE_NAME = SW_SRC.match(/const CACHE_NAME = '([^']+)'/)[1];
const MANIFEST_KEY = SW_SRC.match(/const MANIFEST_KEY = '([^']+)'/)[1];
const PRECACHE_MIN_RATIO = Number(SW_SRC.match(/const PRECACHE_MIN_RATIO = ([\d.]+)/)[1]);
// Install fetches by path ('/js/app.js'); a fetch event carries the full URL.
const pathOf = u => (u.startsWith('http') ? new URL(u).pathname : u);
// The fetch handler stores its copy after respondWith resolves (open → hash →
// put); give those microtasks and timers a moment to land.
const settle = () => new Promise(r => setTimeout(r, 20));
async function activate(worker) {
  let waited = null;
  worker.fire('activate', { waitUntil: p => { waited = p; } });
  await waited;
}
// The generation cache as the worker sees it: only what THIS install wrote.
const currentStore = worker => worker.sandbox.caches._stores.get(CACHE_NAME) || new Map();
// A previous release's cache, complete: every manifest URL with the body
// `bodyFor` describes, plus (unless told otherwise) the manifest record that
// release's install would have written.
async function seedPreviousCache(worker, name, bodyFor, opts) {
  opts = opts || {};
  const prev = await worker.sandbox.caches.open(name);
  const manifest = {};
  for (const u of MANIFEST_URLS) {
    const text = bodyFor(u);
    manifest[u] = sha16(text);
    await prev.put(u, body(text, u.endsWith('.html') || u === '/' ? 'text/html' : 'application/javascript'));
  }
  if (!opts.noManifest) {
    await prev.put(MANIFEST_KEY, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }));
  }
  return prev;
}

suite('service worker: install is best effort, never all-or-nothing', () => {
  test('one 404 among 153 assets no longer throws the whole update away', async () => {
    const worker = bootWorker(url =>
      url === '/js/night-raid.js'
        ? new Response('nope', { status: 404 })
        : body('ok', url.endsWith('.css') ? 'text/css' : 'application/javascript'));
    await install(worker);                       // must RESOLVE, not reject
    assert.equal(worker.requested.length, ASSET_COUNT, 'every asset is still attempted');
    const cache = await worker.sandbox.caches.open('x');
    const stored = [...worker.sandbox.caches._stores.values()][0];
    assert.equal(stored.size, ASSET_COUNT - 1 + 1, 'everything that could be cached, was (+ the stored manifest)');
    assert.falsy(stored.has('/js/night-raid.js'), 'and the broken one is simply absent');
  });

  test('a whole network outage still installs, so the next open can retry', async () => {
    const worker = bootWorker(() => { throw new Error('offline'); });
    await install(worker);
    // Resolving is not the point — this used to assert only that, and it
    // passed with an empty cache while `activate` went on to delete the
    // previous, COMPLETE one.
    const stored = [...worker.sandbox.caches._stores.values()][0];
    assert.truthy(!stored || stored.size <= 1, 'nothing could be fetched, so nothing but the manifest record was stored');
  });

  test('a half-finished install does NOT retire the cache that still works', async () => {
    // A child on 3G in a car: 60 of 153 assets land, the signal drops. Under
    // best-effort-plus-unconditional-activate they would have lost a complete
    // previous cache and been left with a broken one — Grammar and Toán empty
    // in the tunnel, the raid scene with no art, and nothing to retry.
    let served = 0;
    const worker = bootWorker(url => {
      if (served++ > 60) throw new Error('signal lost');
      return body('ok', 'application/javascript');
    });
    // The previous release's cache, complete and working.
    const previous = await worker.sandbox.caches.open('flashlingo-v999');
    await previous.put('/js/app.js', body('OLD BUT WORKING', 'application/javascript'));

    await install(worker);
    let waited = null;
    worker.fire('activate', { waitUntil: p => { waited = p; } });
    await waited;

    assert.truthy(worker.sandbox.caches._stores.has('flashlingo-v999'),
      'the last cache that worked must survive a bad install');
    const kept = await (await worker.sandbox.caches.open('flashlingo-v999')).match('/js/app.js');
    assert.equal(await kept.text(), 'OLD BUT WORKING');
  });

  test('a complete install DOES retire the old cache — no unbounded growth', async () => {
    const worker = bootWorker(() => body('ok', 'application/javascript'));
    const previous = await worker.sandbox.caches.open('flashlingo-v999');
    await previous.put('/js/app.js', body('OLD', 'application/javascript'));
    await install(worker);
    let waited = null;
    worker.fire('activate', { waitUntil: p => { waited = p; } });
    await waited;
    assert.falsy(worker.sandbox.caches._stores.has('flashlingo-v999'),
      'a good install cleans up after the one it replaces');
  });

  test('the SPA fallback is never cached under a script or image key', async () => {
    // Cloudflare Pages answers an unknown path with 200 text/html. Caching
    // that as /js/app.js poisons the entry for the life of this CACHE_NAME —
    // exactly how the word recordings were once muted.
    const worker = bootWorker(url =>
      url === '/js/app.js' ? body('<!doctype html>', 'text/html')
                           : body('ok', 'application/javascript'));
    await install(worker);
    const stored = [...worker.sandbox.caches._stores.values()][0];
    assert.falsy(stored.has('/js/app.js'), 'an HTML body must not masquerade as the app');
    assert.truthy(stored.has('/index.html'), 'but real HTML entries are still cached');
  });

  test('and the FETCH path refuses it too — the install guard alone was decorative', async () => {
    // Verified against the live site: GET /js/does-not-exist.js answers 200
    // text/html. A renamed file still listed in SCREEN_FILES, or a request
    // landing mid-deploy, wrote HTML under a .js key and poisoned it for the
    // life of this CACHE_NAME. `nosniff` hides that online; offline the tab
    // renders empty, and if the key is /js/app.js the app does not boot.
    //
    // /js/word-data.js is a manifest key, but nothing was installed, so this
    // is the straggler path: cache miss → network. The guard here is what
    // stands between a mid-deploy request and a poisoned entry.
    const worker = bootWorker(() => body('<!doctype html>fallback', 'text/html'));
    const event = fetchEvent(ORIGIN + '/js/word-data.js');
    worker.fire('fetch', event);
    await event.responded;
    await new Promise(r => setTimeout(r, 0));
    const hit = await worker.sandbox.caches.match(ORIGIN + '/js/word-data.js');
    assert.falsy(hit, 'the SPA fallback must never be stored under a script key');
  });

  test('a real HTML page still caches normally through the fetch path', async () => {
    const worker = bootWorker(() => body('<!doctype html>the app', 'text/html'), { bodyFor: () => '<!doctype html>the app' });
    const event = fetchEvent(ORIGIN + '/index.html');
    worker.fire('fetch', event);
    await event.responded;
    await new Promise(r => setTimeout(r, 0));
    assert.truthy(await worker.sandbox.caches.match(ORIGIN + '/index.html'),
      'the guard is about the KEY, not about HTML');
  });
});

suite('service worker: the API is never cached and never replayed', () => {
  const API = [
    '/api/night-raid/home', '/api/friends', '/api/me/daily-tasks',
    '/api/math-fight', '/api/admin/users',
  ];

  test('an authenticated GET is left entirely alone', async () => {
    const worker = bootWorker(() => body('{"ok":true}', 'application/json'));
    for (const p of API) {
      const event = fetchEvent(ORIGIN + p);
      worker.fire('fetch', event);
      assert.falsy(event.responded, p + ' must fall through to the network untouched');
    }
    assert.equal(worker.sandbox.caches._stores.size, 0, 'nothing about /api/ reaches Cache Storage');
  });

  test('a sibling offline cannot be handed the other child\'s reply', async () => {
    // Kid A online, then Kid B offline on the same device.
    let online = true;
    const worker = bootWorker(url => {
      if (!online) throw new Error('offline');
      return body('{"coins":9999,"layout":"A"}', 'application/json');
    });
    const first = fetchEvent(ORIGIN + '/api/night-raid/home');
    worker.fire('fetch', first);
    assert.falsy(first.responded);

    online = false;
    const second = fetchEvent(ORIGIN + '/api/night-raid/home');
    worker.fire('fetch', second);
    assert.falsy(second.responded, 'offline must be a real network error, not a replay');
  });

  test('static assets ARE still cached — the exclusion is /api/ only', async () => {
    const worker = bootWorker(() => body('console.log(1)', 'application/javascript'), { bodyFor: () => 'console.log(1)' });
    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    assert.truthy(event.responded, 'a script must be handled');
    await event.responded;
    await new Promise(r => setTimeout(r, 0));
    const hit = await worker.sandbox.caches.match(ORIGIN + '/js/app.js');
    assert.truthy(hit, 'and stored for offline');
  });
});

suite('service worker: offline always lands on the app', () => {
  test('a friend-invite link with a query string opens the cached shell', async () => {
    const worker = bootWorker(() => body('<!doctype html>app', 'text/html'), { bodyFor: () => '<!doctype html>app' });
    await install(worker);
    const worker2 = worker;
    // Now offline. '/' is a manifest key, so the invite link is answered
    // cache-first (ignoreSearch) before the offline fallback is even reached
    // — the same query-string blindness, one step earlier. The fallback's own
    // handling of an uncached navigation is covered by the next test.
    worker2.sandbox.fetch = () => Promise.reject(new Error('offline'));
    const event = fetchEvent(ORIGIN + '/?ketban=Na', { mode: 'navigate' });
    worker2.fire('fetch', event);
    assert.truthy(event.responded);
    const res = await event.responded;
    assert.truthy(res && res.status === 200, 'the invite link must still open the app');
    assert.equal(await res.text(), '<!doctype html>app');
  });

  test('the shell fallback reaches for / first, not the redirected copy', async () => {
    // The live site answers /index.html with a 308 to '/', so that cached
    // entry is `redirected: true` — and handing a redirected response to a
    // navigation is a network error, i.e. the browser's error page again.
    //
    // This used to navigate to /?ketban=Na. '/' is a manifest key now, so
    // that request is served cache-first and never reaches the fallback; the
    // shell branch is only for a navigation to a path the cache does not
    // hold at all — a bookmark from a URL shape the app no longer uses.
    const worker = bootWorker(() => body('<!doctype html>app', 'text/html'));
    const cache = await worker.sandbox.caches.open('flashlingo-test');
    await cache.put('/', body('ROOT COPY', 'text/html'));
    await cache.put('/index.html', body('REDIRECTED COPY', 'text/html'));
    worker.sandbox.fetch = () => Promise.reject(new Error('offline'));
    const event = fetchEvent(ORIGIN + '/lesson/12', { mode: 'navigate' });
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'ROOT COPY', 'the clean entry must win');
  });

  test('an uncached URL fails as a Response, never as undefined', async () => {
    // respondWith(undefined) throws a TypeError and the browser shows its own
    // error page instead of ours.
    const worker = bootWorker(() => { throw new Error('offline'); });
    const event = fetchEvent(ORIGIN + '/img/never-precached.png');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.truthy(res instanceof Response, 'a Response, not undefined');
    assert.truthy(res.type === 'error' || res.status === 0 || !res.ok, 'and it is an error response');
  });
});

suite('service worker: lie-fi does not stall a fully cached app', () => {
  test('a hanging network gives way to the cache instead of waiting it out', async () => {
    const worker = bootWorker(url =>
      body(pathOf(url) === '/admin.html' ? 'admin page' : 'cached body',
        pathOf(url).endsWith('.html') ? 'text/html' : 'application/javascript'),
      { bodyFor: () => 'cached body' });
    await install(worker);
    // /admin.html is not a manifest key (it is the adult's page, not the
    // child's app), so it is only ever cached by the fetch path. Visit it
    // once online so there is a copy to fall back to.
    const warm = fetchEvent(ORIGIN + '/admin.html');
    worker.fire('fetch', warm);
    await warm.responded;
    await settle();
    // The network now accepts the connection and never answers — the exact
    // shape of a Wi-Fi with no upstream.
    worker.sandbox.fetch = () => new Promise(() => {});

    // A manifest URL is cache-first: it does not wait on the network AT ALL,
    // which is how a fully cached app paints in a second on lie-fi.
    let started = Date.now();
    const app = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', app);
    const appRes = await app.responded;
    const appWaited = Date.now() - started;
    assert.equal(await appRes.text(), 'cached body', 'the installed copy is served');
    assert.truthy(appWaited < 1000, 'without waiting out any timeout: ' + appWaited + ' ms');

    // Everything else is still network-first, so this one races the timeout
    // — but it is a timeout of seconds, not the OS socket's tens of seconds.
    started = Date.now();
    const event = fetchEvent(ORIGIN + '/admin.html');
    worker.fire('fetch', event);
    const res = await event.responded;
    const waited = Date.now() - started;
    assert.truthy(res && res.ok, 'the cached copy is served');
    assert.equal(await res.text(), 'admin page');
    assert.truthy(waited < 10000, 'and within seconds, not an OS socket timeout: ' + waited + ' ms');
  });

  test('a fast network still wins — the cache is the fallback, not the default', async () => {
    // Manifest URLs are cache-first now (see the "served from the device"
    // suite), so this holds for everything ELSE the app fetches from its own
    // origin: /admin.html is same-origin and not a PRECACHE key, and it
    // stays network-first with the cache as the fallback.
    assert.falsy(MANIFEST_URLS.includes('/admin.html'), 'this test needs a NON-manifest URL');
    const worker = bootWorker(url =>
      body(pathOf(url) === '/admin.html' ? 'FRESH' : 'ok', pathOf(url).endsWith('.html') ? 'text/html' : 'application/javascript'));
    await install(worker);
    // A stale copy is on the device; the network must beat it anyway.
    const cache = await worker.sandbox.caches.open(CACHE_NAME);
    await cache.put('/admin.html', body('STALE', 'text/html'));
    const before = worker.requested.length;
    const event = fetchEvent(ORIGIN + '/admin.html');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'FRESH', 'network-first is still network-first');
    assert.equal(worker.requested.length, before + 1, 'and it did go to the network');
  });
});

suite('service worker: manifest URLs are served from the device, verified', () => {
  // Every URL in PRECACHE was hash-verified at install, so the bytes on the
  // device ARE the release. Asking the network again is a round-trip per
  // file (~70 on a cold open) that can only answer 304 — or, on lie-fi, hang.
  const js = text => body(text, 'application/javascript');

  test('after a good install a manifest URL is answered with zero fetches', async () => {
    let installed = false;
    // Once installed, the network would hand back something newer; the
    // worker must not even ask.
    const worker = bootWorker(() => js(installed ? 'FRESH' : 'ok'));
    await install(worker);
    installed = true;
    const before = worker.requested.length;
    assert.equal(before, ASSET_COUNT, 'the install fetched every entry once');

    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'ok', 'the verified copy from install, not the network');
    await settle();
    assert.equal(worker.requested.length, before, 'no fetch was made for it');
  });

  test('a straggler the install could not get falls through to the network and is cached once its bytes match', async () => {
    let installing = true;
    const worker = bootWorker(url =>
      (installing && pathOf(url) === '/js/app.js') ? new Response('nope', { status: 404 }) : js('ok'));
    await install(worker);
    installing = false;
    assert.falsy(currentStore(worker).has('/js/app.js'), 'the 404 left a hole in the install');

    const before = worker.requested.length;
    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'ok', 'the page is served from the network');
    assert.equal(worker.requested.length, before + 1, 'exactly one request, for the straggler');
    await settle();
    const stored = currentStore(worker).get('/js/app.js');
    assert.truthy(stored, 'and the hole is filled');
    assert.equal(await stored.text(), 'ok', 'with the bytes the manifest names');
  });

  test('a straggler whose bytes do not match the manifest is served but NOT stored', async () => {
    // A half-propagated deploy: this release's sw.js, last release's
    // /js/app.js still on the edge. The child gets a working page either
    // way; the cache must not learn a body that the manifest does not vouch
    // for, or the mismatch would outlive the deploy.
    let installing = true;
    const worker = bootWorker(url => {
      if (pathOf(url) !== '/js/app.js') return js('ok');
      return installing ? new Response('nope', { status: 404 }) : js('LAST RELEASE');
    });
    await install(worker);
    installing = false;

    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'LAST RELEASE', 'served to the page as the network answered');
    await settle();
    assert.falsy(currentStore(worker).has('/js/app.js'), 'but never written under a verified key');
    assert.falsy(await worker.sandbox.caches.match(ORIGIN + '/js/app.js'), 'in any cache');
  });

  test('the manifest record is written at install and is never served to a page', async () => {
    const worker = bootWorker(url =>
      // What the live site says to a path that is not a file: the SPA fallback.
      pathOf(url) === MANIFEST_KEY ? body('<!doctype html>fallback', 'text/html') : js('ok'));
    await install(worker);
    const record = currentStore(worker).get(MANIFEST_KEY);
    assert.truthy(record, 'install wrote ' + MANIFEST_KEY);
    const expected = {};
    for (const u of MANIFEST_URLS) expected[u] = sha16('ok');
    assert.deepEqual(await record.clone().json(), expected, 'holding the PRECACHE table this worker installed from');
    assert.equal(worker.requested.length, ASSET_COUNT, 'the record itself was never fetched');

    // No page asks for it; if one did, it is a normal miss: network path,
    // not the record.
    const event = fetchEvent(ORIGIN + MANIFEST_KEY);
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(worker.requested.length, ASSET_COUNT + 1, 'the request went to the network');
    assert.equal(await res.text(), '<!doctype html>fallback', 'and the page got the network answer, not the record');
    await settle();
    const after = currentStore(worker).get(MANIFEST_KEY);
    assert.deepEqual(await after.clone().json(), expected, 'the record survived the page fetch (SPA fallback is never cached)');
  });
});

suite('service worker: an update downloads only what changed', () => {
  const js = text => body(text, 'application/javascript');
  const PREV = 'flashlingo-v999';

  test('stale bytes from the browser\'s own HTTP cache are retried once with cache: "reload"', async () => {
    // /img, /fonts and phaser ship with a one-year `immutable` (_headers). A
    // sprite replaced under the same name would be answered from the disk
    // cache with last year's pixels; the worker must not give up on that.
    const STALE = '/img/night-raid/home-castle.webp';
    const calls = [];
    const worker = bootWorker((url, init) => {
      if (pathOf(url) === STALE) {
        calls.push(init && init.cache);
        return js(init && init.cache === 'reload' ? 'ok' : 'LAST YEAR');
      }
      return js('ok');
    });
    await install(worker);
    assert.deepEqual(calls, [undefined, 'reload'], 'default fetch, then exactly one cache-bypassing retry');
    assert.equal(await currentStore(worker).get(STALE).clone().text(), 'ok', 'the fresh bytes are what got stored');
    assert.equal(currentStore(worker).size, ASSET_COUNT + 1, 'nothing else was affected');
  });

  test('a body that is wrong even after the retry is a failed entry', async () => {
    const BAD = '/js/exam.js';
    let n = 0;
    const worker = bootWorker(url => { if (pathOf(url) === BAD) { n++; return js('WRONG'); } return js('ok'); });
    await install(worker);
    assert.equal(n, 2, 'one attempt plus one bypassing retry, then it stops');
    assert.falsy(currentStore(worker).has(BAD), 'not stored');
  });

  test('a stale copy left in the previous generation is never served cache-first', async () => {
    // The install came up short (>10% failed), so activate kept the previous
    // cache — which holds LAST release's /js/collocation.js. That file must
    // come from the network (verified), not from the old cache.
    const STALE = '/js/collocation.js';
    // Every image 404s (a weak 4G mid-download) — more than 10% of the
    // manifest — and so does the file under test.
    const worker = bootWorker(url =>
      (pathOf(url) === STALE || pathOf(url).startsWith('/img/')) ? new Response('nope', { status: 404 }) : js('ok'));
    await seedPreviousCache(worker, PREV, () => 'LAST RELEASE', { noManifest: true });
    await install(worker);
    await activate(worker);
    assert.truthy(worker.sandbox.caches._stores.has(PREV), 'the previous cache survived (install incomplete)');
    // The network is back and serves this release's bytes.
    worker.sandbox.fetch = () => Promise.resolve(js('ok'));
    const event = fetchEvent(ORIGIN + STALE);
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'ok', 'this release, not the previous cache\'s copy');
    await settle();
    assert.truthy(currentStore(worker).has(STALE), 'and it is now stored in THIS generation');
  });

  test('a first install with no previous cache fetches every entry', async () => {
    const worker = bootWorker(() => js('ok'));
    await install(worker);
    assert.equal(worker.requested.length, ASSET_COUNT, 'one request per manifest URL');
    assert.deepEqual([...new Set(worker.requested.map(pathOf))].sort(), [...MANIFEST_URLS].sort(), 'each of them exactly once');
    assert.equal(currentStore(worker).size, ASSET_COUNT + 1, 'every entry stored, plus the manifest record');
  });

  test('a release that changed two files downloads two files; the rest are copied from the previous cache', async () => {
    const CHANGED = ['/js/app.js', '/js/night-raid.js'];
    const bodyFor = u => (CHANGED.includes(u) ? 'NEW ' + u : 'ok');
    // The network serves the changed files correctly and would serve the
    // WRONG bytes for anything else — so an unchanged entry that ends up in
    // the new cache with the right body can only have come from the copy.
    const worker = bootWorker(url =>
      js(CHANGED.includes(pathOf(url)) ? bodyFor(pathOf(url)) : 'NOT WHAT THE MANIFEST SAYS'), { bodyFor });
    await seedPreviousCache(worker, PREV, () => 'ok');

    await install(worker);
    assert.deepEqual(worker.requested.map(pathOf).sort(), [...CHANGED].sort(), 'exactly the two changed files were requested');
    const store = currentStore(worker);
    assert.equal(store.size, ASSET_COUNT + 1, 'the new generation is complete');
    for (const u of MANIFEST_URLS) {
      assert.truthy(store.has(u), 'present in the new cache: ' + u);
      assert.equal(await store.get(u).clone().text(), bodyFor(u), 'right bytes for ' + u);
    }
    assert.deepEqual(await store.get(MANIFEST_KEY).clone().json(),
      Object.fromEntries(MANIFEST_URLS.map(u => [u, sha16(bodyFor(u))])),
      'the new manifest record is the one the NEXT install will copy from');

    await activate(worker);
    assert.falsy(worker.sandbox.caches._stores.has(PREV), 'a complete update retires the previous generation');
  });

  test('a previous cache from before manifests causes a full download, not a crash', async () => {
    const worker = bootWorker(() => js('ok'));
    // A pre-manifest release: every file, no record of what it installed.
    await seedPreviousCache(worker, PREV, () => 'ok', { noManifest: true });
    await install(worker);                       // must RESOLVE
    assert.equal(worker.requested.length, ASSET_COUNT, 'nothing can be trusted, so everything is fetched');
    assert.equal(currentStore(worker).size, ASSET_COUNT + 1, 'and the new generation is complete');
    await activate(worker);
    assert.falsy(worker.sandbox.caches._stores.has(PREV), 'the old cache is retired as usual');
  });

  test('a downloaded body that does not match the manifest is a failed entry, like a 404', async () => {
    const worker = bootWorker(url => js(pathOf(url) === '/js/app.js' ? 'WRONG BYTES' : 'ok'));
    await seedPreviousCache(worker, PREV, () => 'old');   // every hash differs → full download
    await install(worker);
    const store = currentStore(worker);
    assert.falsy(store.has('/js/app.js'), 'the mismatch is not stored');
    assert.equal(store.size, ASSET_COUNT - 1 + 1, 'everything else is, plus the record');
    await activate(worker);
    assert.falsy(worker.sandbox.caches._stores.has(PREV), 'one failure of ' + ASSET_COUNT + ' is within PRECACHE_MIN_RATIO');
  });

  test('a release where more than 10% of the bytes are wrong keeps the previous cache', async () => {
    // The threshold is the same one that guards a half-finished download:
    // a bad deploy (or a CDN serving a mix of two releases) must not retire
    // the last generation that worked.
    const tooMany = Math.floor(ASSET_COUNT * (1 - PRECACHE_MIN_RATIO)) + 1;
    const WRONG = new Set(MANIFEST_URLS.slice(0, tooMany));
    const worker = bootWorker(url => js(WRONG.has(pathOf(url)) ? 'WRONG BYTES' : 'ok'));
    await seedPreviousCache(worker, PREV, () => 'old');
    await install(worker);                       // still resolves: best effort
    const store = currentStore(worker);
    for (const u of WRONG) assert.falsy(store.has(u), 'not stored: ' + u);
    assert.equal(store.size, ASSET_COUNT - tooMany + 1, 'the good entries are kept for the retry');
    await activate(worker);
    assert.truthy(worker.sandbox.caches._stores.has(PREV), 'the cache that still works survives');
    const kept = await (await worker.sandbox.caches.open(PREV)).match('/js/app.js');
    assert.equal(await kept.text(), 'old', 'intact');
  });
});

suite('service worker: an update takes over only when the page says it is safe', () => {
  test('install never calls skipWaiting on its own', async () => {
    const worker = bootWorker(() => body('ok', 'application/javascript'));
    await install(worker);
    assert.equal(worker.skipWaiting(), 0, 'a new worker must not replace one mid-lesson');
  });

  test('the page can activate the downloaded worker, and only then', async () => {
    const worker = bootWorker(() => body('ok', 'application/javascript'));
    worker.fire('message', { data: { type: 'SOMETHING_ELSE' } });
    assert.equal(worker.skipWaiting(), 0);
    worker.fire('message', { data: { type: 'SKIP_WAITING' } });
    assert.equal(worker.skipWaiting(), 1, 'the idle page asked the downloaded worker to take over');
  });
});

suite('service worker: background updates are automatic but safe', () => {
  const APP = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  const apply = APP.slice(APP.indexOf('function applyUpdateWhenSafe('), APP.indexOf('function registerServiceWorker('));
  const updateCode = APP.slice(APP.indexOf('let _updateReloading'), APP.indexOf('function registerServiceWorker('));

  function runUpdater(options) {
    const opts = options || {};
    const calls = { posts: 0, checkpoints: 0, saves: 0, intervals: [] };
    const sandbox = {
      console, globalThis: null, currentUser: 'kid', appState: { coins: 10 },
      setInterval(fn, ms) { calls.intervals.push({ fn, ms }); return calls.intervals.length; },
      clearInterval() {}, setTimeout() { return 1; },
      saveStudyCheckpoint() { calls.checkpoints++; },
      saveUserData() { calls.saves++; },
      document: { getElementById(id) {
        if (id === 'lessonScreen') return { classList: { contains: () => !!opts.lesson } };
        return null;
      } },
    };
    if (opts.math) sandbox.isMathQuizActive = () => true;
    // The quiet-moment rule: which screen is up, whether the app is hidden,
    // and how long since the child last touched it.
    sandbox.document.hidden = !!opts.hidden;
    sandbox.document.querySelector = (sel) => (sel === '.screen.active' && opts.screen ? { id: opts.screen } : null);
    sandbox.Date = { now: () => 1000000 };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(updateCode + '\n;globalThis.__applyUpdate = applyUpdateWhenSafe;'
      + (opts.tappedAgo != null ? '\n;_lastInteractionAt = Date.now() - ' + opts.tappedAgo + ';' : ''), sandbox);
    const reg = { waiting: { postMessage(msg) {
      if (msg && msg.type === 'SKIP_WAITING') calls.posts++;
    } } };
    sandbox.__applyUpdate(reg);
    return calls;
  }

  test('a results card is not a quiet moment: the tap heading for "Practice again" must not meet a reload', () => {
    // The finish screen is not "busy", so the 10 s poll used to fire there.
    const results = runUpdater({ screen: 'phrasesScreen', tappedAgo: 1500 });
    assert.equal(results.posts, 0, 'no SKIP_WAITING on a results/practice screen');
    assert.equal(results.intervals[0].ms, 10000, 'it keeps polling instead');
    const fresh = runUpdater({ screen: 'homeScreen', tappedAgo: 1500 });
    assert.equal(fresh.posts, 0, 'a tap 1.5 s ago on Home is not quiet either');
    const idle = runUpdater({ screen: 'homeScreen', tappedAgo: 25000 });
    assert.equal(idle.posts, 1, 'Home with no tap for 25 s is the moment');
    const hidden = runUpdater({ screen: 'phrasesScreen', tappedAgo: 500, hidden: true });
    assert.equal(hidden.posts, 1, 'the app in the background is always a quiet moment');
    assert.truthy(/visibilityState === 'hidden'[^\n]*applyUpdateWhenSafe\(reg\)/.test(APP), 'going to the background applies a waiting update at once');
    assert.truthy(/noteInteraction/.test(APP.slice(APP.indexOf('function registerServiceWorker('))), 'taps are tracked');
  });

  test('there is no update banner or button for the child to handle', () => {
    assert.falsy(APP.includes('sw-update-bar'));
    assert.falsy(APP.includes('Tải bản mới'));
    assert.falsy(APP.includes('Có bản mới của app'));
  });

  test('a busy child is deferred before the worker is told to take over', () => {
    const busyAt = apply.indexOf('_busyWithTimedActivity()');
    const skipAt = apply.indexOf('SKIP_WAITING');
    assert.truthy(busyAt >= 0 && skipAt >= 0 && busyAt < skipAt,
      'activity guard must run before activation');
    assert.truthy(/setInterval\(\(\) => applyUpdateWhenSafe\(reg\), 10000\)/.test(apply),
      'the update must retry quietly after the activity ends');
    const guard = APP.slice(APP.indexOf('function _busyWithTimedActivity'), APP.indexOf('function applyUpdateWhenSafe'));
    assert.truthy(/lessonScreen/.test(guard), 'matching-pairs lessons must count as in-progress work too');
    const math = runUpdater({ math: true });
    const lesson = runUpdater({ lesson: true });
    assert.equal(math.posts, 0);
    assert.equal(lesson.posts, 0);
    assert.equal(math.intervals[0].ms, 10000);
    assert.equal(lesson.intervals[0].ms, 10000);
  });

  test('every activity switchScreen guards, the reload guards too', () => {
    // The first version checked four of the nine. An update that reloads must
    // be at least as careful as tapping a nav tab.
    const APP_SRC = APP;
    const sw = APP_SRC.slice(APP_SRC.indexOf('function switchScreen('));
    const guarded = [...new Set([...sw.slice(0, 9000).matchAll(/&& (is[A-Za-z]+)\(\)/g)].map(m => m[1]))];
    const list = APP_SRC.slice(APP_SRC.indexOf('const _BUSY_CHECKS'), APP_SRC.indexOf('function _busyWithTimedActivity'));
    const missing = guarded.filter(g => !list.includes(`'${g}'`));
    assert.equal(missing.length, 0, 'not guarded against a reload: ' + missing.join(', '));
    assert.truthy(guarded.length >= 9, 'the guard list must not have shrunk: ' + guarded.length);
  });

  test('drafts and profile state are saved immediately before activation', () => {
    const skipAt = apply.indexOf('SKIP_WAITING');
    const saveDraftAt = apply.indexOf('saveStudyCheckpoint()');
    const saveProfileAt = apply.indexOf('saveUserData(currentUser, appState)');
    assert.truthy(saveDraftAt >= 0 && saveDraftAt < skipAt);
    assert.truthy(saveProfileAt >= 0 && saveProfileAt < skipAt);
    assert.falsy(/setTimeout\([^)]*location\.reload/.test(apply),
      'a timeout must never reload back into the same waiting worker');
    const idle = runUpdater({});
    assert.equal(idle.checkpoints, 1);
    assert.equal(idle.saves, 1);
    assert.equal(idle.posts, 1, 'an idle update must apply without a click');
  });

  // A phone left open on Home overnight never reloads the page, so the
  // per-load `reg.update()` never runs again and the device keeps last
  // night's worker until someone reloads. The page must ask again when it
  // comes back into view — but not on every tab switch.
  const HOUR = 60 * 60 * 1000;
  const gateCode = APP.slice(APP.indexOf('const SW_UPDATE_RECHECK_MS'), APP.indexOf('function registerServiceWorker('));

  test('swUpdateDue: an hour since the last check, and not a minute less', () => {
    const sandbox = { globalThis: null };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(gateCode + '\n;globalThis.__due = swUpdateDue;', sandbox);
    const due = sandbox.__due;
    const t0 = 1_700_000_000_000;
    assert.equal(due(t0 + HOUR - 1, t0), false, '59m59s is not yet due');
    assert.equal(due(t0 + HOUR, t0), true, 'exactly an hour is due');
    assert.equal(due(t0 + 9 * HOUR, t0), true, 'overnight is due');
    assert.equal(due(t0, t0), false, 'just checked');
    assert.equal(due(t0, 0), true, 'never checked counts as due');
  });

  // registerServiceWorker, EXECUTED with a fake registration: the listener
  // exists, respects the one-hour gate, ignores the tab going hidden, and a
  // rejected update() neither throws nor surfaces as an unhandled rejection.
  async function runRegistration(updateImpl) {
    const regCode = APP.slice(APP.indexOf('function registerServiceWorker()'), APP.indexOf('function formatDate('));
    const listeners = {};
    const calls = { updates: 0, registerOpts: null };
    const reg = {
      update() { calls.updates++; return updateImpl ? updateImpl(calls.updates) : Promise.resolve(); },
      addEventListener() {}, waiting: null, installing: null,
    };
    const sandbox = {
      console, globalThis: null, clock: 1_700_000_000_000,
      navigator: { serviceWorker: {
        controller: null,
        register(url, opts) { calls.registerOpts = opts; return Promise.resolve(reg); },
        addEventListener() {},
      } },
      document: { visibilityState: 'visible', addEventListener(type, fn) { listeners[type] = fn; } },
      window: { addEventListener() {}, location: { reload() { throw new Error('must not reload'); } } },
      setTimeout() { return 1; }, setInterval() { return 1; }, clearInterval() {},
      applyUpdateWhenSafe() {},
    };
    sandbox.Date = { now: () => sandbox.clock };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(gateCode + regCode + '\n;registerServiceWorker();', sandbox);
    await new Promise(r => setImmediate(r));
    return { sandbox, listeners, calls,
      show(atMs) { sandbox.clock = atMs; sandbox.document.visibilityState = 'visible'; listeners.visibilitychange(); },
      hide(atMs) { sandbox.clock = atMs; sandbox.document.visibilityState = 'hidden'; listeners.visibilitychange(); } };
  }

  test('the page re-checks for a new sw.js when it becomes visible after an hour', async () => {
    const t0 = 1_700_000_000_000;
    const run = await runRegistration();
    assert.equal(run.calls.registerOpts.updateViaCache, 'none', 'the browser must not serve sw.js from its HTTP cache');
    assert.equal(run.calls.updates, 1, 'one check on load');
    assert.truthy(typeof run.listeners.visibilitychange === 'function', 'a visibilitychange listener is installed');
    run.show(t0 + 5 * 60 * 1000);
    assert.equal(run.calls.updates, 1, 'a tab switch five minutes later is not a re-check');
    run.show(t0 + HOUR - 1000);
    assert.equal(run.calls.updates, 1, 'fifty-nine minutes is not an hour');
    run.hide(t0 + 2 * HOUR);
    assert.equal(run.calls.updates, 1, 'going hidden never checks');
    run.show(t0 + 2 * HOUR);
    assert.equal(run.calls.updates, 2, 'coming back after an hour checks');
    run.show(t0 + 2 * HOUR + 1000);
    assert.equal(run.calls.updates, 2, 'and the gate restarts from that check');
    run.show(t0 + 3 * HOUR + 1000);
    assert.equal(run.calls.updates, 3);
  });

  test('a failing update() on visibilitychange is swallowed, not thrown', async () => {
    const t0 = 1_700_000_000_000;
    const unhandled = [];
    const onUnhandled = e => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
      const rejecting = await runRegistration(n => n > 1 ? Promise.reject(new Error('offline')) : Promise.resolve());
      assert.equal(rejecting.calls.updates, 1, 'the load-time check ran');
      rejecting.show(t0 + 2 * HOUR);
      assert.equal(rejecting.calls.updates, 2);
      await new Promise(r => setImmediate(r));
      await new Promise(r => setImmediate(r));
      // The load-time call resolves; only the visibility re-check throws.
      const throwing = await runRegistration(n => { if (n > 1) throw new Error('InvalidStateError'); return Promise.resolve(); });
      throwing.show(t0 + 2 * HOUR);
      assert.equal(throwing.calls.updates, 2, 'a synchronous throw from update() is caught');
      await new Promise(r => setImmediate(r));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
    assert.equal(unhandled.length, 0, 'no unhandled rejection reached the page');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
