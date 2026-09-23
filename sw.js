const CACHE_NAME = 'flashlingo-v641';
// Pre-generated word recordings (audio/words/*.mp3). Versioned separately:
// the files are immutable, so this cache survives CACHE_NAME bumps.
//
// Bump this ONLY when the recordings themselves change — re-voicing the set,
// re-encoding it. v1 held a set built in two different voices; v2 is the
// single-voice rebuild; v3 fixed 71 words the model was substituting for a
// different word entirely (van -> "from", hazard -> "HazardO", etc.), found
// by transcribing all 13,083 recordings and cross-checking with a second
// model; v4 fixed four more the sweep had filed as "probably a homophone" —
// web was live saying "You win", which is how that heuristic was caught out.
// Without the bump, a phone that had already cached one of those words would
// keep playing the wrong one forever. v5 re-recorded japan and thailand: said
// on their own, with no sentence around them to place the language, the
// multilingual voice read both as foreign words.
const AUDIO_CACHE = 'flashlingo-audio-v5';

// Recordings whose BYTES changed under a filename they already had. Two
// caches hold a stale copy of each, and both have to be dealt with:
//
//   ours   — evicted by name on activate (see evictReRecorded). Bumping
//            AUDIO_CACHE would also do it, but that throws away all ~13,000
//            recordings to fix a handful; these are the only stale entries.
//   theirs — the CDN serves recordings as `immutable, max-age=1 year`, so
//            the refetch in audioWordResponse can be answered from the
//            browser's OWN disk cache with the very bytes we are replacing.
//            Listed words therefore refetch with `cache: 'reload'`.
//
// Every other word keeps the cheap cached path, which is the point of a
// separate audio cache. Safe to empty whenever AUDIO_CACHE is next bumped.
const RE_RECORDED = ['japan', 'thailand', 'pe', 'p-e', 'birthday', 'jam'];
// GENERATED HASHES — the values are rewritten by scripts/build-sw-manifest.js
// at deploy (first 16 hex chars of the SHA-256 of the shipped bytes); the URL
// list is maintained by hand, as ASSETS always was: a new lazy bank or sprite
// is added here. See docs/superpowers/specs/2026-09-11-sw-precache-manifest-design.md.
const PRECACHE = {
  '/': '5b544190b0402f3d',
  '/index.html': '5b544190b0402f3d',
  '/css/styles.css': '0b3b68ffb30063ec',
  '/css/night-raid.css': 'c896c1744da22e9b',
  '/fonts/nunito-var-vietnamese.woff2': 'd107f72673f443b4',
  '/fonts/nunito-var-latin.woff2': '20fc9b6fc618e7c3',
  '/js/word-data.js': 'c763481c7f37a0e0',
  '/js/retrydrill.js': '9656e5079c4a99dd',
  '/js/wrong-priority.js': 'e7cca02164688287',
  '/js/units.js': '57ce2103ea5d58fc',
  '/js/dictionary-data.js': '92cdd9c9556ed37f',
  '/js/hot-words.js': 'c2b66815391165c2',
  '/js/answer-audio.js': '0ae2dcd91e4d2af1',
  '/js/tapwords.js': '5fefbc5bafd7c3a0',
  '/js/petart.js': 'f1a57be269c6c43f',
  '/js/petcheer.js': 'ca500fbda05b9d5a',
  '/js/farm-rules.js': '12d959cfcef24e22',
  '/js/farm-art-manifest.js': '5734f86762871b2d',
  '/js/night-raid-rules.js': 'bb7abe3e1c162d0b',
  '/js/night-raid.js': '21146cd6d113b6a9',
  '/js/daily-task-catalog.js': 'beb575f818334f5f',
  '/js/daily-task.js': 'cc14da7e1a83d472',
  '/img/night-raid/isometric-home-board-skin-pad.webp': '946939c99edbd5b1',
  '/img/night-raid/isometric-home-board-unified-gate-v3.webp': '2512c26a6cc25dbb',
  '/img/night-raid/isometric-home-board-frame-v4.webp': '3e521d7d330b8101',
  '/img/night-raid/endless-meadow-tile-v2.jpg': 'e2c03f8f3a7a3ba6',
  '/img/night-raid/pet-soldiers-small-v2.webp': '22251cfa30cdf7b2',
  '/img/night-raid/pet-soldiers-large-v2.webp': '37679a574d736dc0',
  '/img/night-raid/pet-walk-small-v1.webp': 'de3e883b2ae0dd0a',
  '/img/night-raid/pet-walk-large-v1.webp': '548fa42e28e1444b',
  '/img/night-raid/pet-actions-small-v2.webp': '9652e9e02d481288',
  '/img/night-raid/animation/raider-actions-v3.webp': '984b135d848cf971',
  '/img/night-raid/animation/raider-walk-v4.webp': '890e718550de4c96',
  '/img/night-raid/pet-actions-large-v2.webp': '7693f121c42c647b',
  '/img/night-raid/home-castle.webp': '2eda4c9b658debbf',
  '/img/farm/sprout.webp': '6408d0fa1a1fa5ed',
  '/img/farm/sprout-wilted.webp': '83447cd21685ffbb',
  '/img/farm/lettuce-day1.webp': 'a53896dac97b18dd',
  '/img/farm/lettuce-wilted-young.webp': 'fcb232211ddd9d6b',
  '/img/farm/lettuce-wilted-old.webp': 'ecd67c0bc6e97a9a',
  '/img/farm/tomato-day1.webp': '82daf9f9bc01fcd3',
  '/img/farm/tomato-day2.webp': 'd5585f840df9afae',
  '/img/farm/tomato-wilted-young.webp': '7d29b06afc381323',
  '/img/farm/tomato-wilted-old.webp': '3f42b18aecdc63a2',
  '/img/farm/carrot-day1.webp': 'af8edfe9afc43d0b',
  '/img/farm/carrot-day2.webp': '1c48ff0d6fa55348',
  '/img/farm/carrot-day3.webp': '906f3aebb7a97123',
  '/img/farm/carrot-wilted-young.webp': '8e9e67dc17bc4d18',
  '/img/farm/carrot-wilted-old.webp': '8187d74df071e383',
  '/img/farm/rice-day1.webp': 'e2dbbd38eed40411',
  '/img/farm/rice-day2.webp': '9757ff9f68546c91',
  '/img/farm/rice-day3.webp': '39b62b28dae75f3c',
  '/img/farm/rice-day4.webp': '3fe2efea3ea645ca',
  '/img/farm/rice-wilted-young.webp': '17521b1e950744b9',
  '/img/farm/rice-wilted-old.webp': '05b507099844bec2',
  '/img/farm/rose-day1.webp': 'b7abba721abfd407',
  '/img/farm/rose-day2.webp': '9afe55a47a552123',
  '/img/farm/rose-day3.webp': '5fbd74170a0cb015',
  '/img/farm/rose-day4.webp': 'e0663c8abc6dd87a',
  '/img/farm/rose-day5.webp': '60c067d2d4082a0e',
  '/img/farm/rose-day6.webp': 'fd5d57ce11063cb3',
  '/img/farm/rose-wilted-young.webp': '75f00bd8d8b8740e',
  '/img/farm/rose-wilted-old.webp': '97a45600ddc5a052',
  '/img/farm/pumpkin-day1.webp': '9f60a703d1288b57',
  '/img/farm/pumpkin-day2.webp': 'd56251ae3f8247c4',
  '/img/farm/pumpkin-day3.webp': 'e34a4447a995ef0e',
  '/img/farm/pumpkin-day4.webp': 'd8bd2c7f0117cad5',
  '/img/farm/pumpkin-day5.webp': '2f57bed9502cd495',
  '/img/farm/pumpkin-day6.webp': '2f867d6cb79a86bb',
  '/img/farm/pumpkin-day7.webp': '51b99cc146970b4d',
  '/img/farm/pumpkin-day8.webp': 'a8d4eff26e27a035',
  '/img/farm/pumpkin-wilted-young.webp': 'a507c73895241707',
  '/img/farm/pumpkin-wilted-old.webp': 'b5378e86729a16a9',
  '/img/farm/fence.webp': 'e7abf8df6b5d535a',
  '/img/farm/fruit-tree.webp': '9e458ec0d3c1b377',
  '/img/farm/well.webp': '96de9b3fa313fd06',
  '/img/farm/chicken-coop.webp': '8e0fd88d49cc00e2',
  '/img/farm/barn.webp': 'c318b663a1cd6c52',
  '/img/farm/windmill.webp': '0493aa19a7bb2ef0',
  '/img/farm/cow-shed.webp': 'a842cd88e93a51ca',
  '/img/farm/farmhouse.webp': 'bc220527c466aa1a',
  '/img/farm/farm-plot.webp': '567af33a671dbc0c',
  '/img/farm/farm-plot-stone.webp': '3fdc11ce442e14aa',
  '/img/farm/farm-plot-hedge.webp': '50841766dae78834',
  '/img/farm/farm-plot-clover.webp': '4fc95bbe6d626843',
  '/img/farm/dry-ground.webp': '868e5add8f1578f1',
  '/img/night-raid/pebble-pup.webp': '0f6318527ff16cff',
  '/img/night-raid/wood-fence.webp': '945673909a8f3b6f',
  '/img/night-raid/stone-wall.webp': '4b613ed04fed824f',
  '/img/night-raid/spike-trap.webp': '124487d22a872850',
  '/img/night-raid/water-cannon.webp': 'a06d4a39e9a01029',
  '/img/night-raid/training-barracks.webp': 'e70b00ffc21f17f9',
  '/img/night-raid/rice-field.webp': '968a8070ca23b9f0',
  '/img/night-raid/tomato-field.webp': '679b01e070514188',
  '/img/night-raid/fish-pond.webp': '02364343c7073079',
  '/js/hosting.js': 'cf4974628b379adc',
  '/js/auth.js': '98c5d7278d12cc80',
  '/js/lazy-data.js': '829bad02417cb37c',
  '/js/app.js': '1b56c9ee2123f5a5',
  '/js/home.js': '3f7f07241e8848ff',
  '/js/profile.js': '99be091f5b78847d',
  '/img/sun.svg': 'bfdf1afdf99058a9',
  '/img/icon-192.svg': 'bceaad28d43b2b7e',
  '/img/icon-512.svg': 'faa0f8ef65074367',
  '/manifest.json': '2069f7d7c8ce56e4'
};
const ASSETS = Object.keys(PRECACHE);

// ---- where the app lives -----------------------------------------------
// The manifest's keys are APP-relative ('/js/app.js', '/' is index.html), so
// scripts/build-sw-manifest.js and the tests can read them without knowing
// the host. The app itself is not always at the origin root: on Cloudflare
// Pages it is (https://eng-pwa.pages.dev/js/app.js), on GitHub Pages it sits
// under the repo name (https://0x4123dev.github.io/learn-eng-pwa/js/app.js).
// This worker is always served from the app root, so its own URL says which:
// BASE is '/' or '/learn-eng-pwa/', and every cache key, fetch and manifest
// lookup below goes through abs()/keyOf() instead of assuming the root.
// (Before this, register('/sw.js') 404'd under the subpath and the worker
// never installed there at all.)
const BASE = (() => {
  try { return new URL('./', self.location.href).pathname; } catch (e) { return '/'; }
})();
// '/js/app.js' → BASE + 'js/app.js';  '/' → BASE.
function abs(key) { return BASE + String(key).replace(/^\//, ''); }
// The reverse, for a request's pathname: '/learn-eng-pwa/js/app.js' →
// '/js/app.js', '/learn-eng-pwa/' → '/'; a path outside the app → null.
function keyOf(pathname) {
  if (pathname === BASE) return '/';
  return pathname.startsWith(BASE) ? '/' + pathname.slice(BASE.length) : null;
}

// Install: cache all app assets, then WAIT. Updating used to call
// skipWaiting(), which could replace the active worker during a lesson.
// Waiting applies the update on the next natural close/open instead.
//
// BEST EFFORT, not all-or-nothing. cache.addAll() rejects the whole install if
// a SINGLE one of the 153 entries fails, and registerServiceWorker swallows
// that rejection — so one renamed sprite, or one dropped request on a 3G
// connection partway through 34 MB, left every device stuck on the previous
// worker for good. Online the app looked fine (the fetch handler is
// network-first), so nothing ever surfaced it; offline it served the old
// release's JS against the new index.html.
//
// Failures are collected and logged instead. A missing entry means that one
// asset needs the network, which is a far smaller problem than an update that
// can never install.
// The previous generation's cache, if one is still on the device. Every
// release bumps CACHE_NAME, so on an update there is exactly one of these;
// on a first install there is none.
function isAppCache(name) { return /^flashlingo-v\d+$/.test(name) && name !== CACHE_NAME && name !== AUDIO_CACHE; }
async function previousCache() {
  const names = (await caches.keys()).filter(isAppCache)
    .sort((a, b) => Number(b.slice(11)) - Number(a.slice(11)));
  return names.length ? { name: names[0], cache: await caches.open(names[0]) } : null;
}

// Each generation records the manifest it was installed from under a
// synthetic key, so the next install can tell which entries it already has
// the right bytes for without keeping the old worker's code around.
const MANIFEST_KEY = '/__precache-manifest__';
async function storedManifest(cache) {
  try {
    const res = await cache.match(abs(MANIFEST_KEY));
    return res ? await res.json() : {};
  } catch (e) { return {}; }
}

// First 16 hex chars of SHA-256 — what scripts/build-sw-manifest.js wrote
// into PRECACHE for the bytes it shipped.
async function hashOf(buf) {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fetch one precache entry and prove it is the file the manifest describes.
// A mismatch is a failed entry, like a 404: the SPA fallback (Pages answers
// an unknown path with 200 text/html) can no longer poison a key, and
// neither can a half-propagated deploy serving last release's bytes under
// this release's name. Returns the Response to store, or throws.
async function fetchVerified(url, want, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(response.status + ' ' + url);
  if (!url.endsWith('.html') && url !== BASE &&
      (response.headers.get('content-type') || '').indexOf('text/html') !== -1) {
    throw new Error('SPA fallback for ' + url);
  }
  const buf = await response.clone().arrayBuffer();
  const got = await hashOf(buf);
  if (got !== want) {
    // The bytes are not this release's. The usual reason is the browser's
    // OWN HTTP cache: /img, /fonts and phaser ship with a one-year
    // `immutable` (see _headers), so a sprite replaced under the same name
    // would be answered from disk with last year's pixels for as long as
    // that lasts. One retry that bypasses that cache settles it; a second
    // mismatch is a real one (a half-propagated deploy) and fails the entry.
    if (!init) return fetchVerified(url, want, { cache: 'reload' });
    throw new Error('hash ' + got + ' != ' + want + ' for ' + url);
  }
  return response;
}

// Install: copy what did not change, download and verify what did.
//
// BEST EFFORT, not all-or-nothing (see the note above). And no longer a full
// re-download: an entry whose hash is the same as in the previous
// generation's stored manifest is copied across from that cache without
// touching the network, so a release that changed three files costs three
// requests, not 216 — and never the 16 MB of sprite sheets that change
// once a year.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const prev = await previousCache();
  const prevManifest = prev ? await storedManifest(prev.cache) : {};
  let copied = 0;
  const results = await Promise.allSettled(ASSETS.map(async key => {
    const want = PRECACHE[key];
    const url = abs(key);
    if (prev && prevManifest[key] === want) {
      const kept = await prev.cache.match(url);
      if (kept) { await cache.put(url, kept); copied++; return; }
    }
    const response = await fetchVerified(url, want);
    await cache.put(url, response);
  }));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? ASSETS[i] : null))
    .filter(Boolean);
  await cache.put(abs(MANIFEST_KEY), new Response(JSON.stringify(PRECACHE), {
    headers: { 'Content-Type': 'application/json' } }));
  console.log('[sw] precache: ' + copied + ' reused, ' + (ASSETS.length - copied - failed.length) + ' downloaded, ' + failed.length + ' failed');
  if (failed.length) console.warn('[sw] precache incomplete:', failed.length, 'of', ASSETS.length, failed.slice(0, 10));
  return failed;
}

// How complete a precache has to be before this version is allowed to replace
// the last one that worked. Best-effort fixed the old failure (one 404 killed
// the whole update, forever); on its own it created a new one, because
// `activate` deletes every other cache unconditionally. A child in a car on 3G
// who gets 60 of 153 assets before the signal drops would have had their
// COMPLETE previous cache deleted and replaced with a broken one — Grammar and
// Toán empty in the tunnel, the raid scene with no art, and nothing to retry.
//
// So: a mostly-complete install goes live and the stragglers are filled in by
// the fetch handler; a badly incomplete one still installs (it is not thrown
// away) but leaves the previous cache alone until a later attempt does better.
const PRECACHE_MIN_RATIO = 0.9;
let _precacheComplete = false;

self.addEventListener('install', event => {
  event.waitUntil(precache().then(failed => {
    _precacheComplete = failed.length <= ASSETS.length * (1 - PRECACHE_MIN_RATIO);
    if (!_precacheComplete) {
      console.warn('[sw] too incomplete to retire the previous cache:', failed.length, 'of', ASSETS.length);
    }
  }));
});

// The page sends this only after its activity guards say the child is idle.
// Keeping activation behind a message lets js/app.js defer takeover during a
// lesson or battle while still applying updates automatically afterwards.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Drop just the recordings that were re-cut under their existing filename.
// Cheap enough to redo on every activate: it is a handful of deletes, and
// the words re-download on the next tap.
async function evictReRecorded() {
  const cache = await caches.open(AUDIO_CACHE);
  // Both places a recording can be keyed: the audio CDN's path, and the
  // app's own audio/words/ under BASE (GitHub Pages serves them itself).
  await Promise.all(RE_RECORDED.map(slug => Promise.all([
    cache.delete(self.location.origin + '/audio/words/' + slug + '.mp3'),
    cache.delete(self.location.origin + abs('/audio/words/') + slug + '.mp3'),
  ])));
}

// Activate: clean up old caches (but keep the audio cache — recordings are
// immutable and re-downloading them on every version bump would be wasteful)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      // Only retire the old caches once this version has something worth
      // replacing them with. See PRECACHE_MIN_RATIO.
      const stale = keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE);
      if (!_precacheComplete) {
        console.warn('[sw] keeping', stale.length, 'previous cache(s): this install is incomplete');
        return Promise.resolve();
      }
      return Promise.all(stale.map(key => caches.delete(key)));
    }).then(evictReRecorded).then(() => self.clients.claim())
  );
});

// Serve a word recording. Cache-first, and Range requests get a real 206
// slice of the cached body: iOS Safari probes media with Range headers and
// stalls (or refuses to play) when a service worker answers them with a
// plain 200 — this was a visible 1–2s delay on every tap-to-hear.
async function audioWordResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);
  // Key by same-origin pathname, not the request URL: the recordings moved to
  // the eng-pwa-audio Pages project (20,000-files-per-deploy limit), and this
  // keeps every MP3 a device cached before the move serving without a
  // re-download. A ranged request still hits the full cached body.
  const key = self.location.origin + new URL(request.url).pathname;
  let full = await cache.match(key);
  // Heal poisoned entries: while old clients still requested recordings from
  // the app origin, its SPA fallback answered 200 text/html — and this cache
  // outlives CACHE_NAME bumps, so a cached fallback would mute the word
  // forever.
  if (full && !isRecording(full)) { await cache.delete(key); full = null; }
  if (!full) {
    // no Range header → always a full 200
    full = await fetch(request.url, RE_RECORDED.includes(slugOf(key)) ? { cache: 'reload' } : undefined);
    if (!full.ok || !isRecording(full)) return full;   // never cache those
    await cache.put(key, full.clone());
  }
  const range = /bytes=(\d+)-(\d+)?/.exec(request.headers.get('range') || '');
  if (!range) return full;
  const buf = await full.arrayBuffer();
  const start = Number(range[1]);
  if (start >= buf.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${buf.byteLength}` }
    });
  }
  const end = range[2] ? Math.min(Number(range[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1)
    }
  });
}

// "…/audio/words/japan.mp3" -> "japan", the name generate-word-audio.js gave it.
function slugOf(url) {
  return url.slice(url.lastIndexOf('/') + 1).replace(/\.mp3$/, '');
}

// A response that can safely be cached as a word recording. Anything the SPA
// fallback produced identifies itself as text/html.
function isRecording(resp) {
  return (resp.headers.get('content-type') || '').indexOf('text/html') === -1;
}

// The same trap, for everything else: HTML arriving under a key that is not a
// page is Cloudflare Pages' catch-all answering for a file that is not there.
function isSpaFallback(request, response) {
  if ((response.headers.get('content-type') || '').indexOf('text/html') === -1) return false;
  const p = new URL(request.url).pathname;
  return p !== BASE && !p.endsWith('.html');
}

// Fetch: network-first, fall back to cache (always get latest)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // The API is NEVER cached and never replayed. The Cache API keys on the URL
  // alone: the Authorization header is not part of that key, the responses
  // carry no Vary, and the `Cache-Control: no-store` functions/api/_lib.js
  // sets does not stop cache.put(). So every authenticated GET was being
  // filed under its path and handed to whoever asked for that path next.
  //
  // On a device holding two sibling profiles — the designed maximum — the
  // second child, offline, was answered with the FIRST child's
  // /api/night-raid/home, /api/friends and /api/me/daily-tasks, with ok:true.
  // js/night-raid.js then adopted that castle and wallet into their own
  // appState and PUT it back under their own token. A stale hit was enough on
  // its own, too: it made the app believe the server had confirmed something
  // it had never been asked. admin.html runs in this scope as well, so
  // /api/admin/* (names, coin peaks, device flags) was landing in Cache
  // Storage on whatever machine an adult had used.
  if (url.origin === self.location.origin && url.pathname.startsWith(abs('/api/'))) return;

  // Word recordings are immutable → cache-first, stored in their own
  // long-lived cache so they play instantly and work offline.
  if (event.request.url.includes('/audio/words/')) {
    event.respondWith(audioWordResponse(event.request));
    return;
  }

  // Anything the manifest describes is served from the cache, first and
  // only: the bytes on the device are exactly the ones this generation
  // shipped (hash-verified at install), so asking the network for them again
  // is a round-trip per file — ~70 for a cold open — that can only return 304.
  // Freshness comes from the worker itself: the browser re-checks /sw.js on
  // every open, a changed manifest installs in the background, and
  // js/app.js swaps it in when the child is idle. A miss here is a straggler
  // the install could not fetch, and falls through to the network path below.
  const key = url.origin === self.location.origin ? keyOf(url.pathname) : null;
  const manifestHash = key !== null ? PRECACHE[key] : undefined;
  if (manifestHash !== undefined && key !== MANIFEST_KEY) {
    // THIS generation's cache only — never caches.match() across all of
    // them. An install that came up short (a weak 4G, a 34 MB first
    // download) keeps the previous generation's cache alive on purpose
    // (PRECACHE_MIN_RATIO), and a match across caches would then serve last
    // release's file for the key it never fetched — cache-first, so for
    // ever, with no network request to ever correct it. A miss here goes to
    // the network, which verifies the bytes and stores them.
    event.respondWith(
      caches.open(CACHE_NAME)
        .then(cache => cache.match(event.request, { ignoreSearch: true }))
        .then(hit => hit || networkThenCache(event, manifestHash))
    );
    return;
  }
  event.respondWith(networkThenCache(event, undefined));
});

// Network-first, but not network-forever. On "lie-fi" — associated to a
// Wi-Fi that cannot reach the internet — a bare fetch() waits for the OS
  // socket timeout, tens of seconds, and the startup bundle is 55 scripts plus
  // the stylesheet. A fully cached app took minutes to paint instead of a
  // second. Anything already in the cache is served the moment the network
  // fails to answer in time; the network response still wins if it arrives.
function networkThenCache(event, manifestHash) {
  const NETWORK_TIMEOUT_MS = 3500;
  let slowTimer = null;
  const fromNetwork = fetch(event.request).then(async response => {
    // The network answered: stop the fallback timer rather than leaving one
    // pending per request (a cold start asks for 55 scripts and a stylesheet).
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
    // Update cache with fresh response for offline use — but never store the
    // SPA fallback under a script or image key. Pages answers an unknown path
    // with 200 text/html (verified against the live site), so a renamed or
    // dropped file writes HTML under, say, /js/ptnk-data.js and poisons that
    // entry for the life of this CACHE_NAME. `nosniff` hides it while online;
    // offline the tab renders empty, and if the poisoned key is /js/app.js the
    // app does not boot at all. `precache()` has guarded this since yesterday;
    // this path did not, which made the guard mostly decorative.
    if (response.ok && !isSpaFallback(event.request, response)) {
      const clone = response.clone();
      // A manifest entry is stored only as the bytes the manifest names —
      // the same rule as install, so a straggler cannot smuggle in a stale
      // or foreign body under a verified key. Anything else keeps the old
      // rule: cache it if it is not the fallback page.
      let store = true;
      if (manifestHash !== undefined) {
        try { store = (await hashOf(await clone.clone().arrayBuffer())) === manifestHash; }
        catch (e) { store = false; }
      }
      if (store) {
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          // Cache.put rejects on a 206, on `Vary: *`, and when the quota is
          // full. None of those is a reason to fail the request the child is
          // waiting on.
          .catch(err => console.warn('[sw] could not cache', event.request.url, err));
      }
    }
    return response;
  });
  // If the cache wins the race, nothing else is listening to fromNetwork, and
  // an offline rejection would surface as an unhandled rejection in the worker.
  fromNetwork.catch(() => { if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; } });
  const raceCache = new Promise(resolve => { slowTimer = setTimeout(resolve, NETWORK_TIMEOUT_MS); })
    .then(() => caches.match(event.request, { ignoreSearch: true }))
    .then(hit => hit || fromNetwork);

  return Promise.race([fromNetwork, raceCache]).catch(async () => {
      // Offline — serve from cache. `ignoreSearch` because a query string is
      // never part of what we precached: the friend-invite link
      // /?ketban=<name> (js/friends.js) missed the cached '/' entirely.
      const hit = await caches.match(event.request, { ignoreSearch: true });
      if (hit) return hit;
      // A navigation lands on the app shell rather than the browser's
      // can't-connect page — the whole app is precached, so there is no reason
      // for a deep link to fail offline.
      if (event.request.mode === 'navigate') {
        // '/' FIRST. The live site answers /index.html with a 308 to '/', so
        // the cached /index.html entry has `redirected: true` — and returning
        // a redirected response to a navigation is a network error, which is
        // the browser's own error page again. Reaching for it first meant the
        // fallback picked the one copy that cannot be used.
        const shell = (await caches.match(abs('/'))) || (await caches.match(abs('/index.html')));
        if (shell && !shell.redirected) return shell;
        if (shell) return new Response(await shell.text(), {
          status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // Never resolve respondWith with undefined: that throws a TypeError and
      // the browser shows its own error page instead of our failure.
      return Response.error();
    });
}
