const CACHE_NAME = 'flashlingo-v67';
const ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/vocabulary.js',
  '/js/essays.js',
  '/js/app.js',
  '/js/srs.js',
  '/js/home.js',
  '/js/lessons.js',
  '/js/verbs.js',
  '/js/essays-reader.js',
  '/js/profile.js',
  '/js/daily-challenge.js',
  '/js/sentence-builder.js',
  '/js/battle.js',
  '/js/word-hunt.js',
  '/js/word-bubbles.js',
  '/js/rhythm-tap.js',
  '/js/videos.js',
  '/js/lyrics-player.js',
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
