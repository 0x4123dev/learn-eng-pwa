const CACHE_NAME = 'flashlingo-v259';
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

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
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

// Fetch: network-first, fall back to cache (always get latest)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

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
