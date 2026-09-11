const CACHE_NAME = 'flashlingo-v608';
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
  '/': '0000000000000000',
  '/index.html': '0000000000000000',
  '/css/styles.css': '0000000000000000',
  '/fonts/nunito-var-vietnamese.woff2': '0000000000000000',
  '/fonts/nunito-var-latin.woff2': '0000000000000000',
  '/js/vocabulary.js': '0000000000000000',
  '/js/castle-skins.js': '0000000000000000',
  '/js/units-data.js': '0000000000000000',
  '/js/units-hk1-data.js': '0000000000000000',
  '/js/units-hk2-data.js': '0000000000000000',
  '/js/units-posthk-data.js': '0000000000000000',
  '/js/retrydrill.js': '0000000000000000',
  '/js/wrong-priority.js': '0000000000000000',
  '/js/units.js': '0000000000000000',
  '/js/topics.js': '0000000000000000',
  '/js/grammar-units.js': '0000000000000000',
  '/js/grammar-lessons.js': '0000000000000000',
  '/js/grammar-ui.js': '0000000000000000',
  '/js/phrases-data.js': '0000000000000000',
  '/js/phrases-meanings.js': '0000000000000000',
  '/js/phrases.js': '0000000000000000',
  '/js/collocation-data.js': '0000000000000000',
  '/js/collocation-followups.js': '0000000000000000',
  '/js/collocation.js': '0000000000000000',
  '/js/dictionary-data.js': '0000000000000000',
  '/js/hot-words.js': '0000000000000000',
  '/js/answer-audio.js': '0000000000000000',
  '/js/math-data.js': '0000000000000000',
  '/js/math-luythua.js': '0000000000000000',
  '/js/math-lessons.js': '0000000000000000',
  '/js/math-glossary.js': '0000000000000000',
  '/js/math-figures.js': '0000000000000000',
  '/js/math-exams.js': '0000000000000000',
  '/js/math-source-exams.js': '0000000000000000',
  '/js/math-data-hk2.js': '0000000000000000',
  '/js/math-exams-hk2.js': '0000000000000000',
  '/js/math-lessons-hk2.js': '0000000000000000',
  '/js/math-source-exams-hk2.js': '0000000000000000',
  '/js/math4-data.js': '0000000000000000',
  '/js/mathwars.js': '0000000000000000',
  '/js/math-tables.js': '0000000000000000',
  '/js/math-fight-rules.js': '0000000000000000',
  '/js/math-fight-bank.js': '0000000000000000',
  '/js/mathwars-bank.js': '0000000000000000',
  '/js/math-fight.js': '0000000000000000',
  '/js/math.js': '0000000000000000',
  '/js/math-copy.js': '0000000000000000',
  '/js/math-board.js': '0000000000000000',
  '/js/tapwords.js': '0000000000000000',
  '/js/petart.js': '0000000000000000',
  '/js/petcheer.js': '0000000000000000',
  '/js/battlecalc.js': '0000000000000000',
  '/js/battle-teammates.js': '0000000000000000',
  '/js/battle-camera.js': '0000000000000000',
  '/js/battle-scenes.js': '0000000000000000',
  '/js/farm-rules.js': '0000000000000000',
  '/js/farm-art-manifest.js': '0000000000000000',
  '/js/night-raid-rules.js': '0000000000000000',
  '/js/night-raid-choreo.js': '0000000000000000',
  '/js/night-raid-art.js': '0000000000000000',
  '/js/night-raid-game.js': '0000000000000000',
  '/js/night-raid-ruins.js': '0000000000000000',
  '/js/night-raid-phaser.js': '0000000000000000',
  '/js/phaser.min.js': '0000000000000000',
  '/js/night-raid.js': '0000000000000000',
  '/js/ghost-offering-schedule.js': '0000000000000000',
  '/js/ghost-offering-link.js': '0000000000000000',
  '/js/ghost-offering-event.js': '0000000000000000',
  '/js/daily-task-catalog.js': '0000000000000000',
  '/js/daily-task.js': '0000000000000000',
  '/js/armory.js': '0000000000000000',
  '/img/ghost-offering/courtyard-v1.webp': '0000000000000000',
  '/img/ghost-offering/roast-pig-v2.webp': '0000000000000000',
  '/img/ghost-offering/boiled-chicken-v2.webp': '0000000000000000',
  '/img/ghost-offering/fruit-basket-v2.webp': '0000000000000000',
  '/img/night-raid/isometric-home-board-skin-pad.webp': '0000000000000000',
  '/img/night-raid/isometric-home-board-unified-gate-v3.webp': '0000000000000000',
  '/img/night-raid/isometric-home-board-frame-v4.webp': '0000000000000000',
  '/img/night-raid/endless-meadow-tile-v2.jpg': '0000000000000000',
  '/img/night-raid/raider-squad.webp': '0000000000000000',
  '/img/night-raid/animation/raider-actions-v2.webp': '0000000000000000',
  '/img/night-raid/animation/raider-walk-v3.webp': '0000000000000000',
  '/img/night-raid/pet-soldiers-small-v2.webp': '0000000000000000',
  '/img/night-raid/pet-soldiers-large-v2.webp': '0000000000000000',
  '/img/night-raid/pet-walk-small-v1.webp': '0000000000000000',
  '/img/night-raid/pet-walk-large-v1.webp': '0000000000000000',
  '/img/night-raid/pet-actions-small-v2.webp': '0000000000000000',
  '/img/night-raid/pet-actions-large-v2.webp': '0000000000000000',
  '/img/night-raid/home-castle.webp': '0000000000000000',
  '/img/farm/sprout.webp': '0000000000000000',
  '/img/farm/sprout-wilted.webp': '0000000000000000',
  '/img/farm/lettuce-day1.webp': '0000000000000000',
  '/img/farm/lettuce-wilted-young.webp': '0000000000000000',
  '/img/farm/lettuce-wilted-old.webp': '0000000000000000',
  '/img/farm/tomato-day1.webp': '0000000000000000',
  '/img/farm/tomato-day2.webp': '0000000000000000',
  '/img/farm/tomato-wilted-young.webp': '0000000000000000',
  '/img/farm/tomato-wilted-old.webp': '0000000000000000',
  '/img/farm/carrot-day1.webp': '0000000000000000',
  '/img/farm/carrot-day2.webp': '0000000000000000',
  '/img/farm/carrot-day3.webp': '0000000000000000',
  '/img/farm/carrot-wilted-young.webp': '0000000000000000',
  '/img/farm/carrot-wilted-old.webp': '0000000000000000',
  '/img/farm/rice-day1.webp': '0000000000000000',
  '/img/farm/rice-day2.webp': '0000000000000000',
  '/img/farm/rice-day3.webp': '0000000000000000',
  '/img/farm/rice-day4.webp': '0000000000000000',
  '/img/farm/rice-wilted-young.webp': '0000000000000000',
  '/img/farm/rice-wilted-old.webp': '0000000000000000',
  '/img/farm/rose-day1.webp': '0000000000000000',
  '/img/farm/rose-day2.webp': '0000000000000000',
  '/img/farm/rose-day3.webp': '0000000000000000',
  '/img/farm/rose-day4.webp': '0000000000000000',
  '/img/farm/rose-day5.webp': '0000000000000000',
  '/img/farm/rose-day6.webp': '0000000000000000',
  '/img/farm/rose-wilted-young.webp': '0000000000000000',
  '/img/farm/rose-wilted-old.webp': '0000000000000000',
  '/img/farm/pumpkin-day1.webp': '0000000000000000',
  '/img/farm/pumpkin-day2.webp': '0000000000000000',
  '/img/farm/pumpkin-day3.webp': '0000000000000000',
  '/img/farm/pumpkin-day4.webp': '0000000000000000',
  '/img/farm/pumpkin-day5.webp': '0000000000000000',
  '/img/farm/pumpkin-day6.webp': '0000000000000000',
  '/img/farm/pumpkin-day7.webp': '0000000000000000',
  '/img/farm/pumpkin-day8.webp': '0000000000000000',
  '/img/farm/pumpkin-wilted-young.webp': '0000000000000000',
  '/img/farm/pumpkin-wilted-old.webp': '0000000000000000',
  '/img/farm/fence.webp': '0000000000000000',
  '/img/farm/fruit-tree.webp': '0000000000000000',
  '/img/farm/well.webp': '0000000000000000',
  '/img/farm/chicken-coop.webp': '0000000000000000',
  '/img/farm/barn.webp': '0000000000000000',
  '/img/farm/windmill.webp': '0000000000000000',
  '/img/farm/cow-shed.webp': '0000000000000000',
  '/img/farm/farmhouse.webp': '0000000000000000',
  '/img/farm/farm-plot.webp': '0000000000000000',
  '/img/farm/farm-plot-stone.webp': '0000000000000000',
  '/img/farm/farm-plot-hedge.webp': '0000000000000000',
  '/img/farm/farm-plot-clover.webp': '0000000000000000',
  '/img/farm/dry-ground.webp': '0000000000000000',
  '/img/night-raid/pebble-pup.webp': '0000000000000000',
  '/img/night-raid/wood-fence.webp': '0000000000000000',
  '/img/night-raid/stone-wall.webp': '0000000000000000',
  '/img/night-raid/spike-trap.webp': '0000000000000000',
  '/img/night-raid/water-cannon.webp': '0000000000000000',
  '/img/night-raid/training-barracks.webp': '0000000000000000',
  '/img/night-raid/rice-field.webp': '0000000000000000',
  '/img/night-raid/tomato-field.webp': '0000000000000000',
  '/img/night-raid/fish-pond.webp': '0000000000000000',
  '/js/friends.js': '0000000000000000',
  '/js/battlelink.js': '0000000000000000',
  '/js/petbattle.js': '0000000000000000',
  '/js/petbattlegame.js': '0000000000000000',
  '/js/cups.js': '0000000000000000',
  '/js/wordform-data.js': '0000000000000000',
  '/js/wordform-followups.js': '0000000000000000',
  '/js/wordform-lessons.js': '0000000000000000',
  '/js/wordform.js': '0000000000000000',
  '/js/rewrite-data.js': '0000000000000000',
  '/js/rewrite-lessons.js': '0000000000000000',
  '/js/rewrite.js': '0000000000000000',
  '/js/exam-data.js': '0000000000000000',
  '/js/ptnk-data.js': '0000000000000000',
  '/js/reading-data.js': '0000000000000000',
  '/js/cloze-data.js': '0000000000000000',
  '/js/errors-data.js': '0000000000000000',
  '/js/grammar-vocab-data.js': '0000000000000000',
  '/js/phonetics-data.js': '0000000000000000',
  '/js/phonetics-lessons.js': '0000000000000000',
  '/js/exam-lessons.js': '0000000000000000',
  '/js/auth.js': '0000000000000000',
  '/js/lazy-data.js': '0000000000000000',
  '/js/app.js': '0000000000000000',
  '/js/srs.js': '0000000000000000',
  '/js/home.js': '0000000000000000',
  '/js/lessons.js': '0000000000000000',
  '/js/verbs.js': '0000000000000000',
  '/js/exam.js': '0000000000000000',
  '/js/ptnk.js': '0000000000000000',
  '/js/practice-sets.js': '0000000000000000',
  '/js/profile.js': '0000000000000000',
  '/js/daily-challenge.js': '0000000000000000',
  '/js/sentence-builder.js': '0000000000000000',
  '/js/battle.js': '0000000000000000',
  '/js/word-hunt.js': '0000000000000000',
  '/js/topic-vocab.js': '0000000000000000',
  '/img/sun.svg': '0000000000000000',
  '/img/icon-192.svg': '0000000000000000',
  '/img/icon-512.svg': '0000000000000000',
  '/img/battle-teammates/rocket-ranger.jpg': '0000000000000000',
  '/img/battle-teammates/castle-mechanic.jpg': '0000000000000000',
  '/img/battle-teammates/royal-guard.jpg': '0000000000000000',
  '/img/castle-skins/castles-atlas-a.webp': '0000000000000000',
  '/img/castle-skins/castles-atlas-b.webp': '0000000000000000',
  '/img/battle-scenes/cloudstep-meadow/poster.webp': '0000000000000000',
  '/img/battle-scenes/clockwork-canyon/poster.webp': '0000000000000000',
  '/img/battle-scenes/sakura-shrine/poster.webp': '0000000000000000',
  '/img/battle-scenes/aurora-glacier/poster.webp': '0000000000000000',
  '/img/battle-scenes/ember-caldera/poster.webp': '0000000000000000',
  '/img/battle-scenes/pirate-lagoon/poster.webp': '0000000000000000',
  '/img/battle-scenes/firefly-forest/poster.webp': '0000000000000000',
  '/img/battle-scenes/moonlit-rooftops/poster.webp': '0000000000000000',
  '/img/battle-scenes/candy-cloudworks/poster.webp': '0000000000000000',
  '/img/battle-scenes/cosmic-observatory/poster.webp': '0000000000000000',
  '/img/battle-scenes/tropical-monolith/poster.webp': '0000000000000000',
  '/img/battle-scenes/aurora-ice-spire/poster.webp': '0000000000000000',
  '/img/battle-scenes/giant-mushroom-grove/poster.webp': '0000000000000000',
  '/img/battle-scenes/thunder-totem-canyon/poster.webp': '0000000000000000',
  '/img/battle-scenes/crystal-rift/poster.webp': '0000000000000000',
  '/img/battle-scenes/sunken-temple-lagoon/poster.webp': '0000000000000000',
  '/img/battle-scenes/dragonbone-desert/poster.webp': '0000000000000000',
  '/img/battle-scenes/moon-gate-ruins/poster.webp': '0000000000000000',
  '/img/battle-scenes/sky-beanstalk/poster.webp': '0000000000000000',
  '/img/battle-scenes/candy-volcano/poster.webp': '0000000000000000',
  '/img/battle-scenes/cloudstep-meadow/far-strip.webp': '0000000000000000',
  '/img/battle-scenes/cloudstep-meadow/zone-left.webp': '0000000000000000',
  '/img/battle-scenes/cloudstep-meadow/zone-center.webp': '0000000000000000',
  '/img/battle-scenes/cloudstep-meadow/zone-right.webp': '0000000000000000',
  '/manifest.json': '0000000000000000'
};
const ASSETS = Object.keys(PRECACHE);

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
    const res = await cache.match(MANIFEST_KEY);
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
async function fetchVerified(url, want) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(response.status + ' ' + url);
  if (!url.endsWith('.html') && url !== '/' &&
      (response.headers.get('content-type') || '').indexOf('text/html') !== -1) {
    throw new Error('SPA fallback for ' + url);
  }
  const buf = await response.clone().arrayBuffer();
  const got = await hashOf(buf);
  if (got !== want) throw new Error('hash ' + got + ' != ' + want + ' for ' + url);
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
  const results = await Promise.allSettled(ASSETS.map(async url => {
    const want = PRECACHE[url];
    if (prev && prevManifest[url] === want) {
      const kept = await prev.cache.match(url);
      if (kept) { await cache.put(url, kept); copied++; return; }
    }
    const response = await fetchVerified(url, want);
    await cache.put(url, response);
  }));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? ASSETS[i] : null))
    .filter(Boolean);
  await cache.put(MANIFEST_KEY, new Response(JSON.stringify(PRECACHE), {
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

  // Anything the manifest describes is served from the cache, first and
  // only: the bytes on the device are exactly the ones this generation
  // shipped (hash-verified at install), so asking the network for them again
  // is a round-trip per file — ~70 for a cold open — that can only return 304.
  // Freshness comes from the worker itself: the browser re-checks /sw.js on
  // every open, a changed manifest installs in the background, and
  // js/app.js swaps it in when the child is idle. A miss here is a straggler
  // the install could not fetch, and falls through to the network path below.
  const manifestHash = url.origin === self.location.origin ? PRECACHE[url.pathname] : undefined;
  if (manifestHash !== undefined && url.pathname !== MANIFEST_KEY) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true })
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
    // dropped file writes HTML under, say, /js/exam-data.js and poisons that
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
        const shell = (await caches.match('/')) || (await caches.match('/index.html'));
        if (shell && !shell.redirected) return shell;
        if (shell) return new Response(await shell.text(), {
          status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
      // Never resolve respondWith with undefined: that throws a TypeError and
      // the browser shows its own error page instead of our failure.
      return Response.error();
    });
}
