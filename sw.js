const CACHE_NAME = 'flashlingo-v543';
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
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/vocabulary.js',
  '/js/castle-skins.js',
  '/js/units-data.js',
  '/js/units-hk1-data.js',
  '/js/units-hk2-data.js',
  '/js/units-posthk-data.js',
  '/js/retrydrill.js',
  '/js/wrong-priority.js',
  '/js/units.js',
  '/js/topics.js',
  '/js/grammar-units.js',
  '/js/grammar-lessons.js',
  '/js/grammar-ui.js',
  '/js/phrases-data.js',
  '/js/phrases-meanings.js',
  '/js/phrases.js',
  '/js/collocation-data.js',
  '/js/collocation-followups.js',
  '/js/collocation.js',
  '/js/dictionary-data.js',
  '/js/hot-words.js',
  '/js/answer-audio.js',
  '/js/math-data.js',
  '/js/math-luythua.js',
  '/js/math-lessons.js',
  '/js/math-glossary.js',
  '/js/math-figures.js',
  '/js/math-exams.js',
  '/js/math-source-exams.js',
  '/js/math-data-hk2.js',
  '/js/math-exams-hk2.js',
  '/js/math-lessons-hk2.js',
  '/js/math-source-exams-hk2.js',
  '/js/math4-data.js',
  '/js/mathwars.js',
  '/js/math-fight-rules.js',
  '/js/math-fight-bank.js',
  '/js/math-fight.js',
  '/js/math.js',
  '/js/math-copy.js',
  '/js/math-board.js',
  '/js/tapwords.js',
  '/js/petart.js',
  '/js/petcheer.js',
  '/js/battlecalc.js',
  '/js/battle-teammates.js',
  '/js/battle-camera.js',
  '/js/battle-scenes.js',
  '/js/farm-rules.js',
  '/js/farm-art-manifest.js',
  '/js/night-raid-rules.js',
  '/js/night-raid-choreo.js',
  '/js/night-raid-art.js',
  '/js/night-raid-game.js',
  '/js/night-raid-ruins.js',
  '/js/night-raid-phaser.js',
  '/js/phaser.min.js',
  '/js/night-raid.js',
  '/js/ghost-offering-schedule.js',
  '/js/ghost-offering-link.js',
  '/js/ghost-offering-event.js',
  '/js/daily-task-catalog.js',
  '/js/daily-task.js',
  '/js/armory.js',
  '/img/ghost-offering/courtyard-v1.webp',
  '/img/ghost-offering/roast-pig-v2.png',
  '/img/ghost-offering/boiled-chicken-v2.png',
  '/img/ghost-offering/fruit-basket-v2.png',
  '/img/night-raid/isometric-home-board-skin-pad.webp',
  '/img/night-raid/isometric-home-board-unified-gate-v3.webp',
  '/img/night-raid/isometric-home-board-frame-v4.png',
  '/img/night-raid/endless-meadow-tile-v2.jpg',
  '/img/night-raid/raider-squad.webp',
  '/img/night-raid/animation/raider-actions-v2.webp',
  '/img/night-raid/animation/raider-walk-v3.png',
  '/img/night-raid/pet-soldiers-small-v2.webp',
  '/img/night-raid/pet-soldiers-large-v2.webp',
  '/img/night-raid/pet-walk-small-v1.png',
  '/img/night-raid/pet-walk-large-v1.png',
  '/img/night-raid/pet-actions-small-v2.png',
  '/img/night-raid/pet-actions-large-v2.png',
  '/img/night-raid/home-castle.webp',
  '/img/farm/sprout.webp',
  '/img/farm/sprout-wilted.webp',
  '/img/farm/lettuce-day1.webp',
  '/img/farm/lettuce-wilted-young.webp',
  '/img/farm/lettuce-wilted-old.webp',
  '/img/farm/tomato-day1.webp',
  '/img/farm/tomato-day2.webp',
  '/img/farm/tomato-wilted-young.webp',
  '/img/farm/tomato-wilted-old.webp',
  '/img/farm/carrot-day1.webp',
  '/img/farm/carrot-day2.webp',
  '/img/farm/carrot-day3.webp',
  '/img/farm/carrot-wilted-young.webp',
  '/img/farm/carrot-wilted-old.webp',
  '/img/farm/rice-day1.webp',
  '/img/farm/rice-day2.webp',
  '/img/farm/rice-day3.webp',
  '/img/farm/rice-day4.webp',
  '/img/farm/rice-wilted-young.webp',
  '/img/farm/rice-wilted-old.webp',
  '/img/farm/rose-day1.webp',
  '/img/farm/rose-day2.webp',
  '/img/farm/rose-day3.webp',
  '/img/farm/rose-day4.webp',
  '/img/farm/rose-day5.webp',
  '/img/farm/rose-day6.webp',
  '/img/farm/rose-wilted-young.webp',
  '/img/farm/rose-wilted-old.webp',
  '/img/farm/pumpkin-day1.webp',
  '/img/farm/pumpkin-day2.webp',
  '/img/farm/pumpkin-day3.webp',
  '/img/farm/pumpkin-day4.webp',
  '/img/farm/pumpkin-day5.webp',
  '/img/farm/pumpkin-day6.webp',
  '/img/farm/pumpkin-day7.webp',
  '/img/farm/pumpkin-day8.webp',
  '/img/farm/pumpkin-wilted-young.webp',
  '/img/farm/pumpkin-wilted-old.webp',
  '/img/farm/fence.webp',
  '/img/farm/fruit-tree.webp',
  '/img/farm/well.webp',
  '/img/farm/chicken-coop.webp',
  '/img/farm/barn.webp',
  '/img/farm/windmill.webp',
  '/img/farm/cow-shed.webp',
  '/img/farm/farmhouse.webp',
  '/img/farm/farm-plot.webp',
  '/img/farm/dry-ground.webp',
  '/img/night-raid/pebble-pup.webp',
  '/img/night-raid/wood-fence.webp',
  '/img/night-raid/stone-wall.webp',
  '/img/night-raid/spike-trap.webp',
  '/img/night-raid/water-cannon.webp',
  '/img/night-raid/training-barracks.png',
  '/img/night-raid/rice-field.png',
  '/img/night-raid/tomato-field.png',
  '/img/night-raid/fish-pond.png',
  '/js/friends.js',
  '/js/battlelink.js',
  '/js/petbattle.js',
  '/js/petbattlegame.js',
  '/js/cups.js',
  '/js/wordform-data.js',
  '/js/wordform-followups.js',
  '/js/wordform-lessons.js',
  '/js/wordform.js',
  '/js/rewrite-data.js',
  '/js/rewrite-lessons.js',
  '/js/rewrite.js',
  '/js/exam-data.js',
  '/js/exam-lessons.js',
  '/js/auth.js',
  '/js/lazy-data.js',
  '/js/app.js',
  '/js/srs.js',
  '/js/home.js',
  '/js/lessons.js',
  '/js/verbs.js',
  '/js/exam.js',
  '/js/profile.js',
  '/js/daily-challenge.js',
  '/js/sentence-builder.js',
  '/js/battle.js',
  '/js/word-hunt.js',
  '/js/topic-vocab.js',
  '/img/sun.svg',
  '/img/icon-192.svg',
  '/img/icon-512.svg',
  '/img/battle-teammates/rocket-ranger.jpg',
  '/img/battle-teammates/castle-mechanic.jpg',
  '/img/battle-teammates/royal-guard.jpg',
  '/img/castle-skins/castles-atlas-a.png',
  '/img/castle-skins/castles-atlas-b.png',
  '/img/battle-scenes/cloudstep-meadow/poster.webp',
  '/img/battle-scenes/clockwork-canyon/poster.webp',
  '/img/battle-scenes/sakura-shrine/poster.webp',
  '/img/battle-scenes/aurora-glacier/poster.webp',
  '/img/battle-scenes/ember-caldera/poster.webp',
  '/img/battle-scenes/pirate-lagoon/poster.webp',
  '/img/battle-scenes/firefly-forest/poster.webp',
  '/img/battle-scenes/moonlit-rooftops/poster.webp',
  '/img/battle-scenes/candy-cloudworks/poster.webp',
  '/img/battle-scenes/cosmic-observatory/poster.webp',
  '/img/battle-scenes/tropical-monolith/poster.webp',
  '/img/battle-scenes/aurora-ice-spire/poster.webp',
  '/img/battle-scenes/giant-mushroom-grove/poster.webp',
  '/img/battle-scenes/thunder-totem-canyon/poster.webp',
  '/img/battle-scenes/crystal-rift/poster.webp',
  '/img/battle-scenes/sunken-temple-lagoon/poster.webp',
  '/img/battle-scenes/dragonbone-desert/poster.webp',
  '/img/battle-scenes/moon-gate-ruins/poster.webp',
  '/img/battle-scenes/sky-beanstalk/poster.webp',
  '/img/battle-scenes/candy-volcano/poster.webp',
  '/img/battle-scenes/cloudstep-meadow/far-strip.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-left.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-center.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-right.webp',
  '/manifest.json'
];

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
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(ASSETS.map(async url => {
    // Default cache mode, exactly as cache.addAll used: 20 MB of the precache
    // is night-raid sprite sheets that do not change between releases, and
    // forcing a network re-download of all of them on every version bump is
    // what made this install fragile in the first place.
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status + ' ' + url);
    // Cloudflare Pages answers an unknown path with the SPA fallback: 200 and
    // text/html. Caching that under a .js or .png key poisons the entry for
    // the life of this CACHE_NAME — exactly how the word recordings were
    // muted once (see isRecording below).
    if (!url.endsWith('.html') && url !== '/' &&
        (response.headers.get('content-type') || '').indexOf('text/html') !== -1) {
      throw new Error('SPA fallback for ' + url);
    }
    await cache.put(url, response);
  }));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? ASSETS[i] : null))
    .filter(Boolean);
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

// The child taps "Tải bản mới" on the update toast (js/app.js). Until then a
// new worker waits, so an update can never replace the running app in the
// middle of a lesson.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Drop just the recordings that were re-cut under their existing filename.
// Cheap enough to redo on every activate: it is a handful of deletes, and
// the words re-download on the next tap.
async function evictReRecorded() {
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.all(RE_RECORDED.map(
    slug => cache.delete(self.location.origin + '/audio/words/' + slug + '.mp3')));
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
  return p !== '/' && !p.endsWith('.html');
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
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  // Word recordings are immutable → cache-first, stored in their own
  // long-lived cache so they play instantly and work offline.
  if (event.request.url.includes('/audio/words/')) {
    event.respondWith(audioWordResponse(event.request));
    return;
  }

  // Network-first, but not network-forever. On "lie-fi" — associated to a
  // Wi-Fi that cannot reach the internet — a bare fetch() waits for the OS
  // socket timeout, tens of seconds, and the startup bundle is 55 scripts plus
  // the stylesheet. A fully cached app took minutes to paint instead of a
  // second. Anything already in the cache is served the moment the network
  // fails to answer in time; the network response still wins if it arrives.
  const NETWORK_TIMEOUT_MS = 3500;
  let slowTimer = null;
  const fromNetwork = fetch(event.request).then(response => {
    // The network answered: stop the fallback timer rather than leaving one
    // pending per request (a cold start asks for 55 scripts and a stylesheet).
    if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; }
    // Update cache with fresh response for offline use — but never store the
    // SPA fallback under a script or image key. Pages answers an unknown path
    // with 200 text/html (verified against the live site), so a renamed or
    // dropped file writes HTML under, say, /js/exam-data.js and poisons that
    // entry for the life of this CACHE_NAME. `nosniff` hides it while online;
    // offline the tab renders empty, and if the poisoned key is /js/app.js the
    // app does not boot at all. `precache()` has guarded this since yesterday;
    // this path did not, which made the guard mostly decorative.
    if (response.ok && !isSpaFallback(event.request, response)) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        // Cache.put rejects on a 206, on `Vary: *`, and when the quota is
        // full. None of those is a reason to fail the request the child is
        // waiting on.
        .catch(err => console.warn('[sw] could not cache', event.request.url, err));
    }
    return response;
  });
  // If the cache wins the race, nothing else is listening to fromNetwork, and
  // an offline rejection would surface as an unhandled rejection in the worker.
  fromNetwork.catch(() => { if (slowTimer !== null) { clearTimeout(slowTimer); slowTimer = null; } });
  const raceCache = new Promise(resolve => { slowTimer = setTimeout(resolve, NETWORK_TIMEOUT_MS); })
    .then(() => caches.match(event.request, { ignoreSearch: true }))
    .then(hit => hit || fromNetwork);

  event.respondWith(
    Promise.race([fromNetwork, raceCache]).catch(async () => {
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
        const shell = (await caches.match('/')) || (await caches.match('/index.html'));
        if (shell && !shell.redirected) return shell;
        if (shell) return new Response(await shell.text(), {
          status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // Never resolve respondWith with undefined: that throws a TypeError and
      // the browser shows its own error page instead of our failure.
      return Response.error();
    })
  );
});
