const CACHE_NAME = 'flashlingo-v613';
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
  '/': 'fc54d8b47f6c812f',
  '/index.html': 'fc54d8b47f6c812f',
  '/css/styles.css': '973cbd97c614e9a3',
  '/css/night-raid.css': '77128c1a5f2efebf',
  '/css/arena.css': 'd525cb14151473bf',
  '/css/math.css': '502ad61b4504bbf1',
  '/fonts/nunito-var-vietnamese.woff2': 'd107f72673f443b4',
  '/fonts/nunito-var-latin.woff2': '20fc9b6fc618e7c3',
  '/js/vocabulary.js': '1378ebad4b384c3b',
  '/js/castle-skins.js': '3a864f4a4377219c',
  '/js/units-data.js': '5c71decf6f1f23b9',
  '/js/units-hk1-data.js': 'd2e4cdd069d3f6c4',
  '/js/units-hk2-data.js': '62fc4fd4f3582f4e',
  '/js/units-posthk-data.js': '377ff9420d4c520f',
  '/js/retrydrill.js': '99283ff3257f3874',
  '/js/wrong-priority.js': 'dc5d6a6389b897d1',
  '/js/units.js': '67ab630301736d2d',
  '/js/topics.js': '691074ac29571a5a',
  '/js/grammar-units.js': '935d95c94da407dd',
  '/js/grammar-lessons.js': '286dc1b7724e941b',
  '/js/grammar-ui.js': 'ac032044bc147248',
  '/js/phrases-data.js': '39d591ab27f954aa',
  '/js/phrases-meanings.js': '94524b328a1d4b12',
  '/js/phrases.js': '139bb7385b7fe13e',
  '/js/collocation-data.js': 'fc23a2caa6a64e52',
  '/js/collocation-followups.js': '6d11f03502ff2ff8',
  '/js/collocation.js': 'd57b1ffe25f40dc7',
  '/js/dictionary-data.js': 'fa813feaa3d61121',
  '/js/hot-words.js': '740acc8dbbca2298',
  '/js/answer-audio.js': 'd8970376079fcbba',
  '/js/math-data.js': 'ac75fe7785ee0be6',
  '/js/math-luythua.js': '98cef3e6723649ed',
  '/js/math-lessons.js': '75c2b76bf814f5db',
  '/js/math-glossary.js': '2141f1cfe9717250',
  '/js/math-figures.js': 'dc4fa5145cfb59a8',
  '/js/math-exams.js': 'c369af684b492dc5',
  '/js/math-source-exams.js': '00c4682ced79d25d',
  '/js/math-data-hk2.js': 'e02d7edb1d638123',
  '/js/math-exams-hk2.js': '4d6849cf982dfdb4',
  '/js/math-lessons-hk2.js': '8771125dd771d7c0',
  '/js/math-source-exams-hk2.js': 'b24fffb3f284a2b5',
  '/js/math4-data.js': '38d4cb97d9dc5a14',
  '/js/mathwars.js': '99ff688edfbdf274',
  '/js/math-tables.js': '4a99d90fa4bfa04b',
  '/js/math-fight-rules.js': '3c3329522bd99e52',
  '/js/math-fight-bank.js': 'ad953b7b7e2f4b55',
  '/js/mathwars-bank.js': 'c69df237dc1ee552',
  '/js/math-fight.js': '55cca4be1a615614',
  '/js/math.js': 'ab0e3506d0376adb',
  '/js/math-copy.js': '930d0cbc38a2d897',
  '/js/math-board.js': 'a1d9cd1ed35a4682',
  '/js/tapwords.js': '8220242610538163',
  '/js/petart.js': '27b9b7e9407b5c9f',
  '/js/petcheer.js': '340c021553c45466',
  '/js/battlecalc.js': '138c7c545c773982',
  '/js/battle-teammates.js': '73e89d1f965897d1',
  '/js/battle-camera.js': '4032f785300b0c48',
  '/js/battle-scenes.js': '45951e391c85e908',
  '/js/farm-rules.js': '8c23dc94a458bc7e',
  '/js/farm-art-manifest.js': 'ddd2848674313698',
  '/js/night-raid-rules.js': '61733e79273e3b9d',
  '/js/night-raid-choreo.js': 'a5865b224f76bef9',
  '/js/night-raid-art.js': 'a25c42b035a73908',
  '/js/night-raid-game.js': 'a1c49e7d6b88ab8f',
  '/js/night-raid-ruins.js': 'e33927c66a7800b4',
  '/js/night-raid-phaser.js': '6cca7987176593d1',
  '/js/phaser.min.js': 'e92ddef111ba42e9',
  '/js/night-raid.js': '715396c67dd94394',
  '/js/ghost-offering-schedule.js': 'ae5aecb3c5bfc10c',
  '/js/ghost-offering-link.js': 'ffdffe7641eb7d36',
  '/js/ghost-offering-event.js': 'cee57fc77b7065d8',
  '/js/daily-task-catalog.js': 'f09af62cfff588ab',
  '/js/daily-task.js': 'ae48a210b56a8ff4',
  '/js/armory.js': '61176c8f2efb15b0',
  '/img/ghost-offering/courtyard-v1.webp': 'b790dd596c3b6415',
  '/img/ghost-offering/roast-pig-v2.webp': '5c5ca147b49bae39',
  '/img/ghost-offering/boiled-chicken-v2.webp': 'fd12d91162111fea',
  '/img/ghost-offering/fruit-basket-v2.webp': '2a013f9a04dc0110',
  '/img/night-raid/isometric-home-board-skin-pad.webp': '946939c99edbd5b1',
  '/img/night-raid/isometric-home-board-unified-gate-v3.webp': '2512c26a6cc25dbb',
  '/img/night-raid/isometric-home-board-frame-v4.webp': '3e521d7d330b8101',
  '/img/night-raid/endless-meadow-tile-v2.jpg': 'e2c03f8f3a7a3ba6',
  '/img/night-raid/raider-squad.webp': 'c72c36b3854e2d45',
  '/img/night-raid/animation/raider-actions-v2.webp': '38942f05a94771f7',
  '/img/night-raid/animation/raider-walk-v3.webp': '0ce0b3b8cc4ae229',
  '/img/night-raid/pet-soldiers-small-v2.webp': '22251cfa30cdf7b2',
  '/img/night-raid/pet-soldiers-large-v2.webp': '37679a574d736dc0',
  '/img/night-raid/pet-walk-small-v1.webp': 'de3e883b2ae0dd0a',
  '/img/night-raid/pet-walk-large-v1.webp': '548fa42e28e1444b',
  '/img/night-raid/pet-actions-small-v2.webp': '9652e9e02d481288',
  '/img/night-raid/pet-actions-large-v2.webp': '7693f121c42c647b',
  '/img/night-raid/home-castle.webp': '1cd64d7351eec255',
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
  '/js/friends.js': '725f7eab9e246297',
  '/js/battlelink.js': 'ec758f8f761ebd25',
  '/js/petbattle.js': '191331c2f64ba086',
  '/js/petbattlegame.js': '6fcca707f11bef87',
  '/js/cups.js': 'b3d83038e45cdd49',
  '/js/wordform-data.js': '00f0bc5169895eb3',
  '/js/wordform-followups.js': 'ee823c230a9bf14a',
  '/js/wordform-lessons.js': '641a5bf624360c13',
  '/js/wordform.js': 'c72ca5ed59d21a58',
  '/js/rewrite-data.js': 'b929edd14e78a20b',
  '/js/rewrite-lessons.js': 'ceb93eab38ce7e8c',
  '/js/rewrite.js': 'db5afab4cdaead74',
  '/js/exam-data.js': '21096c15ca2bec98',
  '/js/ptnk-data.js': '299029469113f2f0',
  '/js/reading-data.js': '0898cfb2619ef52d',
  '/js/cloze-data.js': '7135a45b7fab5703',
  '/js/errors-data.js': 'cfb18feafdc34b43',
  '/js/grammar-vocab-data.js': 'c626e371a5945700',
  '/js/phonetics-data.js': '9ebca2e9478c163c',
  '/js/phonetics-lessons.js': '8e328ea6b4e6e472',
  '/js/exam-lessons.js': '6a0e0aaa9f66f5d2',
  '/js/auth.js': '4751810294171ca5',
  '/js/lazy-data.js': '693da5fa1172b12f',
  '/js/app.js': '899025dff4cfacec',
  '/js/srs.js': '9f98ba86f249bef8',
  '/js/home.js': '3a3cc0986a86e08c',
  '/js/lessons.js': '2f7e4be284ac076c',
  '/js/verbs.js': '642747574edd8d16',
  '/js/exam.js': 'cad5a74de0dff1ff',
  '/js/ptnk.js': '1852c8826c3aecaa',
  '/js/practice-sets.js': 'daf1b96a517bff11',
  '/js/profile.js': '169896d307335231',
  '/js/daily-challenge.js': '0f09dcdaa3868acb',
  '/js/sentence-builder.js': 'c46f94fa948c1d71',
  '/js/battle.js': '491a43a47d340c83',
  '/js/word-hunt.js': 'd2dca545af4cdd67',
  '/js/topic-vocab.js': '4cd542c0d5e30bc3',
  '/img/sun.svg': 'bfdf1afdf99058a9',
  '/img/icon-192.svg': 'bceaad28d43b2b7e',
  '/img/icon-512.svg': 'faa0f8ef65074367',
  '/img/battle-teammates/rocket-ranger.jpg': 'd3ee846e624c2426',
  '/img/battle-teammates/castle-mechanic.jpg': 'ca1972420e09b13b',
  '/img/battle-teammates/royal-guard.jpg': '6322eecb59a8ffb2',
  '/img/castle-skins/castles-atlas-a.webp': '199861698c731f58',
  '/img/castle-skins/castles-atlas-b.webp': 'def32229be24fcd8',
  '/img/battle-scenes/cloudstep-meadow/poster.webp': '11c97414061596ad',
  '/img/battle-scenes/clockwork-canyon/poster.webp': '794c28496b74bce2',
  '/img/battle-scenes/sakura-shrine/poster.webp': 'd759f605afcdd294',
  '/img/battle-scenes/aurora-glacier/poster.webp': '701f9920adda6cfb',
  '/img/battle-scenes/ember-caldera/poster.webp': '0d00694df459baa5',
  '/img/battle-scenes/pirate-lagoon/poster.webp': 'be23dfe6fb24f84c',
  '/img/battle-scenes/firefly-forest/poster.webp': 'e74c9dda1e5d6b2e',
  '/img/battle-scenes/moonlit-rooftops/poster.webp': '5539625117126561',
  '/img/battle-scenes/candy-cloudworks/poster.webp': '40725101f0a1beb0',
  '/img/battle-scenes/cosmic-observatory/poster.webp': 'f4a25dba74ffe537',
  '/img/battle-scenes/tropical-monolith/poster.webp': '956b5f42878deded',
  '/img/battle-scenes/aurora-ice-spire/poster.webp': 'afefe2e84b40f28c',
  '/img/battle-scenes/giant-mushroom-grove/poster.webp': '7e19542c6f5f9b19',
  '/img/battle-scenes/thunder-totem-canyon/poster.webp': '3dc710807070b609',
  '/img/battle-scenes/crystal-rift/poster.webp': '18e4252c70e29b42',
  '/img/battle-scenes/sunken-temple-lagoon/poster.webp': '24d94dc7318b0fbc',
  '/img/battle-scenes/dragonbone-desert/poster.webp': 'fc74a94229228314',
  '/img/battle-scenes/moon-gate-ruins/poster.webp': '48e37bc435cbe4d6',
  '/img/battle-scenes/sky-beanstalk/poster.webp': '5282bc5b8155388c',
  '/img/battle-scenes/candy-volcano/poster.webp': '041a75e528adfd06',
  '/img/battle-scenes/cloudstep-meadow/far-strip.webp': '2eae103f3e8dfd14',
  '/img/battle-scenes/cloudstep-meadow/zone-left.webp': 'e4ef57c2fc8475df',
  '/img/battle-scenes/cloudstep-meadow/zone-center.webp': '7e5de36357584455',
  '/img/battle-scenes/cloudstep-meadow/zone-right.webp': 'dcbd1f62cc3c8a24',
  '/manifest.json': 'bbc6c7b399ffbf3b'
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
async function fetchVerified(url, want, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(response.status + ' ' + url);
  if (!url.endsWith('.html') && url !== '/' &&
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
