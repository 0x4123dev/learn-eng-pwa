const CACHE_NAME = 'flashlingo-v268';
// Pre-generated word recordings (audio/words/*.mp3). Versioned separately:
// the files are immutable, so this cache survives CACHE_NAME bumps.
const AUDIO_CACHE = 'flashlingo-audio-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/vocabulary.js',
  '/js/units-data.js',
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
  '/js/collocation.js',
  '/js/dictionary-data.js',
  '/js/hot-words.js',
  '/js/tapwords.js',
  '/js/petart.js',
  '/js/petcheer.js',
  '/js/battlecalc.js',
  '/js/battle-camera.js',
  '/js/battle-scenes.js',
  '/js/friends.js',
  '/js/battlelink.js',
  '/js/petbattle.js',
  '/js/petbattlegame.js',
  '/js/petbattlebot.js',
  '/js/cups.js',
  '/js/wordform-data.js',
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
  '/img/pets/chihuahua.png',
  '/img/pets/beagle.png',
  '/img/pets/poodle.png',
  '/img/pets/retriever.png',
  '/img/pets/dalmatian.png',
  '/img/pets/husky.png',
  '/img/pets/shepherd.png',
  '/img/pets/akita.png',
  '/img/pets/royal.png',
  '/img/pets/diamond.png',
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
  '/img/battle-scenes/cloudstep-meadow/far-strip.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-left.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-center.webp',
  '/img/battle-scenes/cloudstep-meadow/zone-right.webp',
  '/manifest.json'
];

// Install: cache all app assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches (but keep the audio cache — recordings are
// immutable and re-downloading them on every version bump would be wasteful)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== AUDIO_CACHE).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Listen for the client telling a waiting SW to take over immediately.
// Used by the page's "new version available" detector in app.js so the
// new sw.js doesn't sit idle behind an old active SW.
self.addEventListener('message', event => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Serve a word recording. Cache-first, and Range requests get a real 206
// slice of the cached body: iOS Safari probes media with Range headers and
// stalls (or refuses to play) when a service worker answers them with a
// plain 200 — this was a visible 1–2s delay on every tap-to-hear.
async function audioWordResponse(request) {
  const cache = await caches.open(AUDIO_CACHE);
  // Match/store by URL so a ranged request still hits the full cached body.
  let full = await cache.match(request.url);
  if (!full) {
    full = await fetch(request.url);   // no Range header → always a full 200
    if (!full.ok) return full;
    await cache.put(request.url, full.clone());
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
