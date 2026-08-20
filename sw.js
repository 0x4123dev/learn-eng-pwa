const CACHE_NAME = 'flashlingo-v348';
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
const RE_RECORDED = ['japan', 'thailand', 'pe', 'p-e'];
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/vocabulary.js',
  '/js/castle-skins.js',
  '/js/units-data.js',
  '/js/units-hk1-data.js',
  '/js/units-hk2-data.js',
  '/js/retrydrill.js',
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
  '/js/math-lessons.js',
  '/js/math-glossary.js',
  '/js/math-figures.js',
  '/js/math-exams.js',
  '/js/math-source-exams.js',
  '/assets/math-exams/hk1-1-page2.jpg',
  '/assets/math-exams/hk1-2-page1.jpg',
  '/assets/math-exams/hk1-2-page2.jpg',
  '/assets/math-exams/hk1-3-page1.jpg',
  '/assets/math-exams/hk1-3-page2.jpg',
  '/assets/math-exams/hk1-4-page1.jpg',
  '/assets/math-exams/hk1-4-page2.jpg',
  '/assets/math-exams/hk1-4-page3.jpg',
  '/assets/math-exams/hk1-5-page1.jpg',
  '/assets/math-exams/hk1-5-page2.jpg',
  '/js/mathwars.js',
  '/js/math.js',
  '/js/math-board.js',
  '/js/tapwords.js',
  '/js/petart.js',
  '/js/petcheer.js',
  '/js/battlecalc.js',
  '/js/battle-teammates.js',
  '/js/battle-camera.js',
  '/js/battle-scenes.js',
  '/js/friends.js',
  '/js/battlelink.js',
  '/js/petbattle.js',
  '/js/petbattlegame.js',
  '/js/petbattlebot.js',
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
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
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
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE).map(key => caches.delete(key))
      )
    ).then(evictReRecorded).then(() => self.clients.claim())
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

// Fetch: network-first, fall back to cache (always get latest)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Word recordings are immutable → cache-first, stored in their own
  // long-lived cache so they play instantly and work offline.
  if (event.request.url.includes('/audio/words/')) {
    event.respondWith(audioWordResponse(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      // Update cache with fresh response for offline use
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // Offline — serve from cache
      return caches.match(event.request);
    })
  );
});
