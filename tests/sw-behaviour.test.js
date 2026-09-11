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
    const worker = bootWorker(() => body('<!doctype html>fallback', 'text/html'));
    const event = fetchEvent(ORIGIN + '/js/exam-data.js');
    worker.fire('fetch', event);
    await event.responded;
    await new Promise(r => setTimeout(r, 0));
    const hit = await worker.sandbox.caches.match(ORIGIN + '/js/exam-data.js');
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
    // Now offline.
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
    const worker = bootWorker(() => body('<!doctype html>app', 'text/html'));
    const cache = await worker.sandbox.caches.open('flashlingo-test');
    await cache.put('/', body('ROOT COPY', 'text/html'));
    await cache.put('/index.html', body('REDIRECTED COPY', 'text/html'));
    worker.sandbox.fetch = () => Promise.reject(new Error('offline'));
    const event = fetchEvent(ORIGIN + '/?ketban=Na', { mode: 'navigate' });
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
    const worker = bootWorker(url => body('cached body', 'application/javascript'), { bodyFor: () => 'cached body' });
    await install(worker);
    // The network now accepts the connection and never answers — the exact
    // shape of a Wi-Fi with no upstream.
    worker.sandbox.fetch = () => new Promise(() => {});
    const started = Date.now();
    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    const res = await event.responded;
    const waited = Date.now() - started;
    assert.truthy(res && res.ok, 'the cached copy is served');
    assert.truthy(waited < 10000, 'and within seconds, not an OS socket timeout: ' + waited + ' ms');
  });

  test('a fast network still wins — the cache is the fallback, not the default', async () => {
    const worker = bootWorker(() => body('FRESH', 'application/javascript'));
    await install(worker);
    const event = fetchEvent(ORIGIN + '/js/app.js');
    worker.fire('fetch', event);
    const res = await event.responded;
    assert.equal(await res.text(), 'FRESH', 'network-first is still network-first');
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
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(updateCode + '\n;globalThis.__applyUpdate = applyUpdateWhenSafe;', sandbox);
    const reg = { waiting: { postMessage(msg) {
      if (msg && msg.type === 'SKIP_WAITING') calls.posts++;
    } } };
    sandbox.__applyUpdate(reg);
    return calls;
  }

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
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
