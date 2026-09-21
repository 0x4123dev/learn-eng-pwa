// The feature manifest — the reason `npm run verify` can be trusted.
//
// A test suite is written by the same people who wrote the bugs, and it only
// covers what somebody remembered to cover. This file inverts that: it is a
// declared list of everything the app OFFERS A CHILD, and the check below
// fails when the app grows something the list does not claim.
//
// So a new tab, a new API route or a new lazy bank cannot land silently. The
// person adding it has to come here and say which feature it belongs to and
// how it is verified — which is exactly the step that was skipped when HK2
// maths shipped un-assignable for a semester, and when battles started writing
// a `field_version` column no migration created.
//
// It also fails in the other direction: an entry here that no longer exists in
// the app is stale, and stale entries are how a manifest quietly stops meaning
// anything.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---- what the app actually is, read from the app itself --------------------

function realScreens() {
  return [...new Set([...read('index.html').matchAll(/id="([a-zA-Z]+Screen)"/g)].map(m => m[1]))].sort();
}
function realNavDestinations() {
  const html = read('index.html');
  const direct = [...html.matchAll(/switchScreen\('([a-zA-Z]+)'\)/g)].map(m => m[1]);
  // The three Book buttons open the shared Word screen through openBook(set).
  const books = /openBook\('pr[123]'\)/.test(html) ? ['wordScreen'] : [];
  return [...new Set(direct.concat(books))].sort();
}
function realRoutes() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = dir + '/' + entry.name;
      if (entry.isDirectory()) { walk(rel); continue; }
      if (!entry.name.endsWith('.js') || entry.name.startsWith('_')) continue;
      out.push(rel.replace(/^functions\/api\//, '').replace(/\.js$/, ''));
    }
  })('functions/api');
  return out.sort();
}
function realLazyBanks() {
  const src = read('js/lazy-data.js');
  const block = src.slice(src.indexOf('SCREEN_FILES'), src.indexOf('const DICTIONARY'));
  return [...new Set([...block.matchAll(/'(js\/[a-z0-9-]+\.js)'/g)].map(m => m[1]))].sort();
}
function realMigrations() {
  return fs.readdirSync(path.join(ROOT, 'db')).filter(f => /^\d+.*\.sql$/.test(f)).sort();
}

// ---- what we claim to verify, and where -----------------------------------
//
// `verifiedBy` names the layer that actually exercises it. "server" and
// "client" are tests/verify/server.js and client.js; "suite" means the named
// file in the main suite covers it and this layer only checks it still exists.
const FEATURES = [
  { id: 'onboarding', name: 'Tạo hồ sơ và đăng nhập',
    screens: ['onboardingScreen'], routes: ['register', 'login'], verifiedBy: 'client+server' },
  { id: 'home', name: 'Trang chủ, thú cưng, cửa hàng, hồ sơ',
    screens: ['homeScreen', 'profileScreen'], routes: ['assets'], verifiedBy: 'client' },
  { id: 'word', name: 'Book 1 · 2 · 3 — Career Paths: Public Relations, 15 unit mỗi cuốn, điền từ theo tranh và câu ví dụ',
    screens: ['wordScreen'], banks: ['js/word-data.js'], verifiedBy: 'client' },
  // `banks` is everything js/lazy-data.js defers — question data AND the
  // farm's code (GROUP_FILES.farm). A code file listed here is proven by the
  // client layer the same way a bank is: the screen that needs it is opened
  // for real, the group is fetched through LazyData, and the render is
  // checked afterwards.
  { id: 'farm', name: 'Nông trại — xây nhà bằng xu, gieo hạt từ nhiệm vụ hằng ngày, thu hoạch',
    screens: ['nightRaidScreen'],
    banks: ['js/farm-art-manifest.js', 'js/night-raid.js'],
    routes: ['night-raid/home', 'night-raid/collect', 'night-raid/plant'],
    verifiedBy: 'client+server' },
  { id: 'daily-task', name: 'Nhiệm vụ hằng ngày',
    screens: ['dailyTaskScreen'],
    routes: ['me/daily-tasks'], verifiedBy: 'client+server' },
  { id: 'wallet', name: 'Ví xu và phần thưởng',
    routes: ['coins'], verifiedBy: 'server' },
  { id: 'progress-sync', name: 'Đồng bộ tiến độ lên máy chủ',
    routes: ['activity', 'attempts', 'skills', 'me/attempts'], verifiedBy: 'server' },
  { id: 'admin', name: 'Bảng quản trị',
    routes: ['admin/users', 'admin/activity', 'admin/attempts',
             'admin/user-flags', 'admin/grant-coins', 'admin/skills', 'admin/daily-tasks'], verifiedBy: 'server' },
  { id: 'version', name: 'Điểm kiểm tra bản đang chạy',
    routes: ['version'], verifiedBy: 'server+live' },
];

// Screens the app builds at RUNTIME rather than declaring in index.html, so
// realScreens() cannot see them. Listing them by hand is a compromise, but a
// named compromise: the check below fails if one of these stops existing, and
// the rule that every screen must be claimed still applies to it.
const RUNTIME_SCREENS = {};

// Screens with no nav entry are reached from another screen, on purpose.
const REACHED_FROM_ELSEWHERE = {
  onboardingScreen: 'shown by init() when the device has no signed-in profile',
  dailyTaskScreen: 'opened from homeScreen',
  profileScreen: 'opened from the home header',
  // The bottom bar reaches it through openNightRaid(), not switchScreen(),
  // so realNavDestinations() (which scrapes switchScreen calls) misses it.
  nightRaidScreen: 'the Nông trại nav button calls openNightRaid() (a lazyEntry, not switchScreen)',
};

// ---- the check -------------------------------------------------------------

function verifyInventory() {
  const checks = [];
  const add = (id, feature, ok, detail) => checks.push({ id, feature, ok, detail });

  const claimed = key => new Set(FEATURES.flatMap(f => f[key] || []));
  const owner = (key, value) => (FEATURES.find(f => (f[key] || []).includes(value)) || {}).name;

  for (const [key, real, label] of [
    ['screens', realScreens(), 'màn hình'],
    ['routes', realRoutes(), 'API route'],
    ['banks', realLazyBanks(), 'bank tải chậm'],
  ]) {
    const mine = claimed(key);
    const unclaimed = real.filter(x => !mine.has(x));
    add(`inventory-${key}-covered`, `Bản kê phủ hết ${label}`, unclaimed.length === 0,
      unclaimed.length
        ? `${unclaimed.length} ${label} không thuộc tính năng nào trong manifest: ${unclaimed.join(', ')} — thêm vào FEATURES và nói rõ layer nào kiểm nó`
        : `${real.length} ${label}, tất cả đều có chủ`);
    const stale = [...mine].filter(x => !real.includes(x));
    add(`inventory-${key}-stale`, `Bản kê không còn mục chết (${label})`, stale.length === 0,
      stale.length ? `manifest còn nhắc tới thứ không tồn tại: ${stale.join(', ')}` : 'không có mục chết');
  }

  // A screen the app builds at runtime is still a screen a child sees.
  const runtimeMissing = Object.entries(RUNTIME_SCREENS)
    .filter(([id, meta]) => !read(meta.source).includes(id));
  add('inventory-runtime-screens', 'Màn hình dựng lúc chạy vẫn được kê', runtimeMissing.length === 0,
    runtimeMissing.length
      ? `không còn tồn tại: ${runtimeMissing.map(([id]) => id).join(', ')}`
      : `${Object.keys(RUNTIME_SCREENS).length} màn dựng bằng JS (${Object.keys(RUNTIME_SCREENS).join(', ')})`);
  const runtimeUnowned = Object.entries(RUNTIME_SCREENS)
    .filter(([, meta]) => !FEATURES.some(f => f.id === meta.feature));
  add('inventory-runtime-owned', 'Và chúng thuộc về một tính năng có thật', runtimeUnowned.length === 0,
    runtimeUnowned.length ? `chủ không tồn tại: ${runtimeUnowned.map(([id]) => id).join(', ')}` : 'có chủ');

  // Every screen is reachable: from the bottom nav, or named as deliberately
  // reached from somewhere else.
  const nav = new Set(realNavDestinations());
  const orphans = realScreens().filter(s => !nav.has(s) && !REACHED_FROM_ELSEWHERE[s]);
  add('inventory-screens-reachable', 'Mọi màn hình đều có đường tới', orphans.length === 0,
    orphans.length ? `không có đường tới: ${orphans.join(', ')}` : `${nav.size} tab + ${Object.keys(REACHED_FROM_ELSEWHERE).length} màn mở từ nơi khác`);

  // Every feature says which layer proves it. A feature with no verifier is a
  // feature nobody is watching.
  const unverified = FEATURES.filter(f => !f.verifiedBy);
  add('inventory-features-verified', 'Mọi tính năng nói rõ ai kiểm nó', unverified.length === 0,
    unverified.length ? `thiếu verifiedBy: ${unverified.map(f => f.id).join(', ')}` : `${FEATURES.length} tính năng`);

  // Migrations are numbered and unique — a duplicate number is two people
  // editing the same database from two branches.
  const migrations = realMigrations();
  const numbers = migrations.map(f => f.slice(0, 3));
  const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  add('inventory-migrations', 'Migration đánh số liên tục, không trùng', dupes.length === 0,
    dupes.length ? `số migration bị trùng: ${[...new Set(dupes)].join(', ')}` : `${migrations.length} migration, mới nhất ${migrations[migrations.length - 1]}`);

  return { checks, features: FEATURES, screens: realScreens(), routes: realRoutes() };
}

module.exports = { verifyInventory, FEATURES, RUNTIME_SCREENS, realScreens, realRoutes, realLazyBanks, realNavDestinations };
