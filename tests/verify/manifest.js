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
  return [...new Set([...read('index.html').matchAll(/switchScreen\('([a-zA-Z]+)'\)/g)].map(m => m[1]))].sort();
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
  { id: 'home', name: 'Trang chủ, thú cưng, cửa hàng',
    screens: ['homeScreen', 'profileScreen', 'learnHubScreen'], routes: ['assets', 'me/wins'], verifiedBy: 'client' },
  { id: 'topics', name: 'Chủ đề và bài học ghép từ',
    screens: ['topicsScreen', 'lessonScreen'], routes: [], verifiedBy: 'client' },
  { id: 'grammar', name: 'Ngữ pháp — 13 unit',
    screens: ['grammarScreen'], banks: ['js/grammar-units.js', 'js/grammar-lessons.js'], verifiedBy: 'client' },
  { id: 'verbs', name: 'Động từ bất quy tắc — Speed Challenge',
    screens: ['speedChallengeScreen'], verifiedBy: 'client' },
  { id: 'phrases', name: 'Cụm động từ và collocation',
    screens: ['phrasesScreen'],
    banks: ['js/phrases-data.js', 'js/phrases-meanings.js', 'js/collocation-data.js', 'js/collocation-followups.js'],
    verifiedBy: 'client' },
  { id: 'wordform', name: 'Word form',
    screens: ['wordformScreen'],
    banks: ['js/wordform-data.js', 'js/wordform-lessons.js', 'js/wordform-followups.js'], verifiedBy: 'client' },
  { id: 'rewrite', name: 'Viết lại câu',
    screens: ['rewriteScreen'], banks: ['js/rewrite-data.js', 'js/rewrite-lessons.js'], verifiedBy: 'client' },
  { id: 'exam', name: 'Đề thi có tính giờ',
    screens: ['examScreen'], banks: ['js/exam-data.js', 'js/exam-lessons.js'], verifiedBy: 'client' },
  { id: 'math', name: 'Toán 7 — luyện tập và đề thi',
    screens: ['mathHubScreen'],
    banks: ['js/math-data.js', 'js/math-exams.js', 'js/math-lessons.js', 'js/math-luythua.js',
            'js/math-source-exams.js', 'js/math-fight-bank.js', 'js/math-data-hk2.js',
            'js/math-exams-hk2.js', 'js/math-lessons-hk2.js', 'js/math-source-exams-hk2.js'],
    verifiedBy: 'client' },
  { id: 'math-fight', name: 'Đấu Toán với bạn',
    routes: ['math-fight/index', 'math-fight/challenge', 'math-fight/respond',
             'math-fight/progress', 'math-fight/submit'], verifiedBy: 'server' },
  { id: 'pet-battle', name: 'Đấu thú cưng',
    screens: ['petBattleScreen'],
    routes: ['battle/index', 'battle/challenge', 'battle/respond', 'battle/state', 'battle/turn'],
    verifiedBy: 'client+server' },
  { id: 'night-raid', name: 'Cướp Đêm và nông trại theo ngày nhiệm vụ',
    screens: ['nightRaidScreen'],
    routes: ['night-raid/home', 'night-raid/start', 'night-raid/finish', 'night-raid/targets',
             'night-raid/friends', 'night-raid/reports', 'night-raid/collect', 'night-raid/shield'],
    verifiedBy: 'client+server' },
  { id: 'ghost-offering', name: 'Cúng cô hồn (sự kiện)',
    routes: ['ghost-offering'], verifiedBy: 'server' },
  { id: 'daily-task', name: 'Nhiệm vụ hằng ngày',
    screens: ['dailyTaskScreen'],
    routes: ['daily-task/claim', 'daily-task/claim-all', 'me/daily-tasks'], verifiedBy: 'client+server' },
  { id: 'friends', name: 'Bạn bè',
    routes: ['friends/index', 'friends/respond', 'friends/activity'], verifiedBy: 'server' },
  { id: 'wallet', name: 'Ví xu và phần thưởng',
    routes: ['coins'], verifiedBy: 'server' },
  { id: 'progress-sync', name: 'Đồng bộ tiến độ lên máy chủ',
    routes: ['activity', 'attempts', 'skills', 'me/attempts'], verifiedBy: 'server' },
  { id: 'admin', name: 'Bảng quản trị',
    routes: ['admin/users', 'admin/activity', 'admin/attempts', 'admin/app-flags',
             'admin/user-flags', 'admin/grant-coins', 'admin/skills', 'admin/daily-tasks',
             'admin/night-raid-config'], verifiedBy: 'server' },
  { id: 'version', name: 'Điểm kiểm tra bản đang chạy',
    routes: ['version'], verifiedBy: 'server+live' },
];

// Screens the app builds at RUNTIME rather than declaring in index.html, so
// realScreens() cannot see them. Listing them by hand is a compromise, but a
// named compromise: the check below fails if one of these stops existing, and
// the rule that every screen must be claimed still applies to it.
const RUNTIME_SCREENS = {
    armoryScreen: { source: 'js/armory.js', feature: 'night-raid' },
};

// Screens with no nav entry are reached from another screen, on purpose.
const REACHED_FROM_ELSEWHERE = {
  onboardingScreen: 'shown by init() when the device has no signed-in profile',
  lessonScreen: 'opened from topicsScreen by starting a lesson',
  petBattleScreen: 'opened from homeScreen',
  nightRaidScreen: 'opened from petBattleScreen',
  dailyTaskScreen: 'opened from homeScreen',
  profileScreen: 'opened from the home header',
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
