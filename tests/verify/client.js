// tests/verify/client.js — "is any feature still there?", asked of the app
// itself rather than of the code that was written alongside it.
//
// The unit suite was written by the same hands as the bugs, and it mostly asks
// questions the source can answer by containing a string. This layer refuses
// to read source text as evidence. It boots the real index.html script list in
// one shared global scope — the way a browser does — logs a learner in, opens
// every screen the way a finger reaches it, and then plays: types a Book word
// right and the next one WRONG, finishes the practice, opens the farm shop.
//
// Every check has to be falsifiable. "renderX() returned a string" proves
// nothing, so each render is proved against live data instead: a Book must
// draw one card per unit in its bank, the farm's seed tray one card per crop
// in FarmRules.CROPS. And every grader is asked twice
// — once with the right answer and once with a wrong one — because a grader
// stuck on "correct" passes any test that only ever answers correctly.
//
// Exported shape:
//   verifyClient() -> Promise<{
//     checks:      [{ id, feature, ok, detail }],   // flat, one line per claim
//     screens:     [{ id, reachableFrom, opened, verified, htmlLength, textLength, sample }],
//     limitations: [string],                        // what this layer cannot see, said out loud
//     elapsedMs:   number,
//   }>
// It prints nothing; the runner prints. A screen this file has no way to open
// is reported ok:false — "unverified" is never allowed to look like "passing".
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const { createDocument } = require(path.join(ROOT, 'tests', 'domshim.js'));

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 4); i++) await tick(); };

// ---------------------------------------------------------------------------
// index.html, read as data
// ---------------------------------------------------------------------------

function readIndex() {
  const html = read('index.html');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) throw new Error('index.html has no <body>');
  const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/gi)].map((m) => m[1]);
  return { html, body, scripts };
}

// Comments are stripped before any "who calls what" scan: armory.js *mentions*
// switchScreen('armoryScreen') in a paragraph of prose, and a scanner that
// counts that as a call invents a nav destination nobody wrote.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ---------------------------------------------------------------------------
// The browser this app is small enough to need
// ---------------------------------------------------------------------------

const CTX2D = ('arc arcTo beginPath bezierCurveTo clearRect clip closePath drawImage ellipse fill fillRect '
  + 'fillText lineTo moveTo quadraticCurveTo rect resetTransform restore rotate save scale setLineDash '
  + 'setTransform stroke strokeRect strokeText transform translate putImageData').split(' ');

function make2dContext() {
  const ctx = { canvas: null };
  for (const m of CTX2D) ctx[m] = () => {};
  ctx.measureText = (t) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
  ctx.getImageData = (x, y, w, h) => ({ width: w | 0, height: h | 0, data: new Uint8Array(Math.max(0, (w | 0) * (h | 0) * 4)) });
  ctx.createLinearGradient = () => ({ addColorStop() {} });
  ctx.createRadialGradient = () => ({ addColorStop() {} });
  ctx.createPattern = () => null;
  return ctx;
}

function makeStorage(seed) {
  const store = Object.assign(Object.create(null), seed || {});
  return {
    store,
    api: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
      key: (i) => (Object.keys(store)[i] === undefined ? null : Object.keys(store)[i]),
      get length() { return Object.keys(store).length; },
    },
  };
}

// Boot index.html's <script> list into ONE vm context, in order, exactly the
// way the browser shares a global scope between them. Two consequences this
// layer relies on: a `const` declared twice across two files is a real
// SyntaxError here, and a file that uses a global before the file that defines
// it has run throws here too.
function mountApp(opts) {
  opts = opts || {};
  const { body, scripts } = readIndex();
  const doc = createDocument(body);
  const storage = makeStorage(opts.storage);
  const timers = [];
  const logged = { warn: [], error: [] };
  const quietConsole = {
    log() {}, info() {}, debug() {}, trace() {}, table() {}, group() {}, groupEnd() {},
    warn: (...a) => logged.warn.push(a.map(String).join(' ')),
    error: (...a) => logged.error.push(a.map(String).join(' ')),
  };

  const sandbox = {
    console: quietConsole,
    Math, JSON, Date, String, Number, Boolean, Array, Object, RegExp, Function,
    Set, Map, WeakMap, WeakSet, Promise, Symbol, Error, TypeError, RangeError, SyntaxError,
    Proxy, Reflect, parseInt, parseFloat, isNaN, isFinite, BigInt,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    Intl, ArrayBuffer, Uint8Array, Uint32Array, Int32Array, Float32Array, Float64Array,
    structuredClone, URL, URLSearchParams, TextEncoder, TextDecoder, btoa, atob,
    document: doc,
    localStorage: storage.api,
    sessionStorage: makeStorage().api,
    navigator: {
      vibrate() {}, userAgent: 'verify/1.0', language: 'vi', onLine: true, maxTouchPoints: 1,
      serviceWorker: {
        register: () => Promise.resolve({}), getRegistrations: () => Promise.resolve([]),
        addEventListener() {}, controller: null,
      },
      clipboard: { writeText: () => Promise.resolve() },
    },
    location: { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '', hash: '', reload() {}, assign() {} },
    history: { pushState() {}, replaceState() {}, back() {} },
    // Timers are recorded, never fired: this layer drives the app the way a
    // finger does, and a suite that lets an unattended interval repaint the
    // screen mid-assertion is testing the timer, not the feature.
    setTimeout: (fn, ms) => { timers.push({ fn, ms, kind: 'timeout' }); return timers.length; },
    setInterval: (fn, ms) => { timers.push({ fn, ms, kind: 'interval' }); return timers.length; },
    clearTimeout() {}, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    requestIdleCallback: () => 0, cancelIdleCallback() {},
    fetch: () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    Audio: class { constructor(s) { this.src = s; this.currentTime = 0; this.preload = ''; }
      play() { return Promise.resolve(); } pause() {} load() {} addEventListener() {} removeEventListener() {} },
    Image: class {
      constructor() { this.width = 64; this.height = 64; this.naturalWidth = 64; this.naturalHeight = 64; this.complete = true; this.onload = null; this.onerror = null; }
      set src(v) { this._src = v; } get src() { return this._src || ''; }
      addEventListener() {} removeEventListener() {} decode() { return Promise.resolve(); } },
    alert() {}, prompt: () => null,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    AudioContext: class {
      createOscillator() { return { connect() {}, start() {}, stop() {}, type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; }
      createGain() { return { connect() {}, gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} } }; }
      createBiquadFilter() { return { connect() {}, type: '', frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 } }; }
      createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
      createBufferSource() { return { connect() {}, start() {}, stop() {}, buffer: null }; }
      get currentTime() { return 0; } get sampleRate() { return 44100; } get destination() { return {}; }
      get state() { return 'running'; } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } },
    speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [] },
    SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    MutationObserver: class { observe() {} disconnect() {} takeRecords() { return []; } },
    crypto: { randomUUID: () => 'verify-uuid', getRandomValues: (a) => a },
    performance: { now: () => 0 },
    CustomEvent: class { constructor(t, o) { this.type = t; Object.assign(this, o || {}); } },
    Event: class { constructor(t) { this.type = t; } },
    screen: { width: 400, height: 800, orientation: { type: 'portrait-primary', lock: () => Promise.resolve(), unlock() {}, addEventListener() {} } },
    innerWidth: 400, innerHeight: 800, devicePixelRatio: 2, scrollTo() {}, scrollY: 0,
    // Every confirm() the app raises is answered from here, so a check can say
    // "the child taps Cancel" and mean it.
    __confirmAnswer: true,
    __confirmLog: [],
  };
  sandbox.confirm = (msg) => { sandbox.__confirmLog.push(String(msg)); return sandbox.__confirmAnswer; };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  sandbox.global = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
  sandbox.addEventListener = () => {}; sandbox.removeEventListener = () => {};
  sandbox.dispatchEvent = () => true;
  vm.createContext(sandbox);
  doc.defaultView = sandbox;
  // Buttons in this app carry onclick="startGrammarQuiz('unit1',10)" attributes.
  // Running them in the same context is what makes a tap in this file do what a
  // tap does on the device.
  doc.__runInline = (code) => vm.runInContext(code, sandbox, { filename: 'inline-onclick' });

  // <canvas>: the shim draws nothing, but Night Raid and the maths board paint
  // during a PLAIN render, so a missing getContext would turn "this screen
  // renders" into "this screen throws" and hide the thing being measured.
  const createElement = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = createElement(tag);
    if (String(tag).toLowerCase() === 'canvas') {
      const ctx = make2dContext(); ctx.canvas = el;
      el.getContext = () => ctx;
      el.toDataURL = () => 'data:image/png;base64,';
      el.width = 320; el.height = 320;
    }
    return el;
  };

  const loadErrors = [];
  for (const src of scripts) {
    let source;
    try { source = read(src); }
    catch (e) { loadErrors.push({ src, phase: 'read', message: e.message }); continue; }
    try { vm.runInContext(source, sandbox, { filename: src }); }
    catch (e) { loadErrors.push({ src, phase: 'run', message: e.message }); }
  }

  // Reach into the shared lexical scope: most app state is a top-level `let`
  // (appState, _unitQuiz…), which never lands on the
  // global object and so cannot be read from outside without this.
  vm.runInContext(
    'globalThis.__peek = function (n) { try { return eval(n); } catch (e) { return undefined; } };'
    + 'globalThis.__run = function (code) { return eval(code); };',
    sandbox, { filename: 'verify-bridge' });

  // Lazy banks (js/lazy-data.js) arrive as <script> tags appended to <head>,
  // and a screen's feature stylesheet (css/arena.css, css/night-raid.css,
  // css/math.css) as a <link rel="stylesheet"> the same way. Serve both from
  // disk through that same path so LazyData.ensure/ready are exercised for
  // real instead of being bypassed — a sheet that does not exist on disk
  // fails its load exactly as a 404 would, and the screen stays hidden
  // behind `.lazy-css-pending`.
  const headAppend = doc.head.appendChild.bind(doc.head);
  const banksLoaded = [];
  doc.head.appendChild = (el) => {
    const r = headAppend(el);
    if (el.tagName === 'SCRIPT' && el.src) {
      try {
        vm.runInContext(read(el.src), sandbox, { filename: el.src });
        banksLoaded.push(el.src);
        if (typeof el.onload === 'function') el.onload();
      } catch (e) {
        loadErrors.push({ src: el.src, phase: 'lazy', message: e.message });
        if (typeof el.onerror === 'function') el.onerror();
      }
    } else if (el.tagName === 'LINK' && el.rel === 'stylesheet' && el.href) {
      if (fs.existsSync(path.join(ROOT, el.href))) {
        banksLoaded.push(el.href);
        if (typeof el.onload === 'function') el.onload();
      } else {
        loadErrors.push({ src: el.href, phase: 'lazy', message: 'stylesheet missing on disk' });
        if (typeof el.onerror === 'function') el.onerror();
      }
    }
    return r;
  };

  return {
    sandbox, doc, scripts, body, loadErrors, timers, banksLoaded,
    store: storage.store, consoleLog: logged,
    peek: (n) => sandbox.__peek(n),
    run: (code) => sandbox.__run(code),
    el: (id) => doc.getElementById(id),
    state: () => sandbox.__peek('appState'),
  };
}

const TEST_USER = 'BeNa';

// Log a child in for real (loginUser + its migrations), with the network
// silenced. Anything that talks to a server is stubbed per-check, never here.
function loginTestUser(h, overrides) {
  const S = h.sandbox;
  const auth = h.peek('EngAuth');
  if (auth) {
    auth.syncAccount = () => Promise.resolve({ ok: false });
    auth.syncNow = () => Promise.resolve({ ok: true, synced: 0 });
    auth.syncAssets = () => Promise.resolve({ ok: false });
    auth.postAttempt = () => Promise.resolve();
    auth.refreshFlags = () => Promise.resolve();
    auth.tokenFor = () => null;
    auth.getAccount = () => null;
    auth.api = () => Promise.resolve({ ok: false, offline: true, data: null });
  }
  // The real shape: js/app.js stores an array of usernames, not of objects.
  h.store['flashlingo-users'] = JSON.stringify([TEST_USER]);
  const data = S.createDefaultUserData(TEST_USER, '🐶', '1234');
  Object.assign(data, overrides || {});
  h.store['flashlingo-user-' + TEST_USER] = JSON.stringify(data);
  S.loginUser(TEST_USER);
  return TEST_USER;
}

// A server that answers the three screens which cannot render without one.
function stubServer(h, replies) {
  const auth = h.peek('EngAuth');
  const calls = [];
  auth.tokenFor = () => 'verify-token';
  auth.getAccount = () => ({ id: 1, username: TEST_USER, role: 'user' });
  auth.api = (p, opts) => {
    calls.push(p);
    const r = replies(p, opts);
    return Promise.resolve(r === undefined ? { ok: false, data: { error: 'no stub for ' + p } } : r);
  };
  return calls;
}

// ---------------------------------------------------------------------------
// check plumbing
// ---------------------------------------------------------------------------

function makeRunner() {
  const checks = [];
  async function check(id, feature, fn) {
    let entry;
    try {
      const detail = await fn();
      entry = { id, feature, ok: true, detail: String(detail || 'verified') };
    } catch (e) {
      const where = (e && e.stack ? String(e.stack).split('\n').slice(1, 2).join('').trim() : '');
      entry = { id, feature, ok: false, detail: (e && e.message ? e.message : String(e)) + (where ? ' — ' + where : '') };
    }
    checks.push(entry);
    return entry;
  }
  function fail(id, feature, detail) { checks.push({ id, feature, ok: false, detail }); }
  return { checks, check, fail };
}

function must(cond, msg) { if (!cond) throw new Error(msg); }
function mustEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')');
}
const squash = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// The DOM shim's selector engine treats [attr*="x"] as an exact match, so
// "is there a button wired to startX()" has to be asked by hand.
const wiredTo = (el, needle) => el.querySelectorAll('button, [onclick]')
  .filter((n) => String(n.getAttribute('onclick') || '').includes(needle));
const clip = (s, n) => (String(s).length > (n || 160) ? String(s).slice(0, n || 160) + '…' : String(s));

// ---------------------------------------------------------------------------
// static scanning of the script list (boot integrity)
// ---------------------------------------------------------------------------

// Top-level declarations of a file, as a browser would put them in the shared
// global scope. Column-0 anchored on purpose: anything indented is inside a
// function or an IIFE and is nobody else's business.
function topLevelDeclarations(src) {
  const out = [];
  const clean = stripComments(src);
  const re = /^(?:async\s+)?(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(clean))) out.push({ kind: m[1], name: m[2] });
  return out;
}

// Globals a file CALLS while it is still loading — the load-order hazard.
// `defineRetryDrill(...)` and `if (typeof X === 'function') X(...)` at column 0
// both run the moment the <script> is parsed, so whatever they name has to
// have been defined by an earlier <script>.
function topLevelCalls(src) {
  const out = new Set();
  const clean = stripComments(src);
  for (const line of clean.split('\n')) {
    if (!line || /^\s/.test(line)) continue;
    let m = line.match(/^if\s*\(\s*typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*['"]function['"]\s*\)\s*([A-Za-z_$][\w$]*)\s*\(/);
    if (m) { out.add(m[1]); out.add(m[2]); continue; }
    m = line.match(/^([A-Za-z_$][\w$]*)\s*\(/);
    if (m && !['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function'].includes(m[1])) out.add(m[1]);
    m = line.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*\(/);
    if (m) out.add(m[1]);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// screen inventory
// ---------------------------------------------------------------------------

function screenInventory() {
  const { body } = readIndex();
  const doc = createDocument(body);
  const byClass = doc.querySelectorAll('.screen').map((el) => el.id);
  const byId = [...body.matchAll(/id="([A-Za-z_][\w]*Screen)"/g)].map((m) => m[1]);
  return { byClass, byId, doc, body };
}

// Every place a screen is reached from: the bottom bar, a hub card, another
// screen's markup, or a line of JS. Read at runtime, never listed by hand.
function reachability(screenIds) {
  const { body } = readIndex();
  const doc = createDocument(body);
  const from = Object.create(null);
  for (const id of screenIds) from[id] = [];
  const note = (id, where) => { if (!from[id]) from[id] = []; if (!from[id].includes(where)) from[id].push(where); };

  doc.querySelectorAll('[onclick]').forEach((el) => {
    const code = el.getAttribute('onclick') || '';
    for (const m of code.matchAll(/switchScreen\(\s*['"]([\w]+)['"]\s*\)/g)) {
      const inNav = !!el.closest('.bottom-nav');
      const host = el.closest('.screen');
      note(m[1], inNav ? 'bottom nav' : ('markup in ' + ((host && host.id) || 'index.html')));
    }
    for (const m of code.matchAll(/\b(openNightRaid|openBook|navigateToProfile)\s*\(/g)) {
      const map = { openNightRaid: 'nightRaidScreen', openBook: 'wordScreen', navigateToProfile: 'profileScreen' };
      if (map[m[1]]) note(map[m[1]], el.closest('.bottom-nav') ? 'bottom nav' : 'markup');
    }
  });

  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((n) => n.endsWith('.js'))) {
    const src = stripComments(read(path.join('js', f)));
    for (const m of src.matchAll(/switchScreen\(\s*['"]([\w]+)['"]\s*\)/g)) note(m[1], 'js/' + f);
    for (const m of src.matchAll(/getElementById\(\s*['"]([\w]+Screen)['"]\s*\)\.classList\.add\(\s*['"]active['"]\s*\)/g)) note(m[1], 'js/' + f);
  }
  return from;
}

// ---------------------------------------------------------------------------
// how a child opens each screen, and what proves it really opened
// ---------------------------------------------------------------------------
//
// Keyed by the ids DISCOVERED in index.html. A screen with no entry here is
// reported as a failure, not skipped — that is how a new screen nobody taught
// this file about becomes visible instead of silently unverified.

function screenPlaybook() {
  return {
    onboardingScreen: {
      title: 'Màn hình đăng nhập: chọn hồ sơ',
      // The real way back here: the "switch profile" button on the home screen.
      open: async (h) => { h.sandbox.switchUser(); },
      prove: (h, el) => {
        const cards = el.querySelectorAll('.user-card');
        const users = h.sandbox.getUsers();
        mustEqual(cards.length, users.length, 'one profile card per saved profile');
        must(squash(el.textContent).includes(TEST_USER), 'the profile name is on screen');
        return cards.length + ' profile card(s), naming ' + TEST_USER;
      },
    },
    homeScreen: {
      title: 'Trang chủ: tên học viên, phiên bản, ba cuốn sách',
      open: async (h) => {
        if (!h.peek('currentUser')) h.sandbox.loginUser(TEST_USER);   // arriving from the login screen
        h.sandbox.switchScreen('homeScreen');
      },
      prove: (h, el) => {
        const text = squash(el.textContent);
        must(text.includes(TEST_USER), 'the home screen greets this child by name');
        must(text.includes(h.peek('APP_VERSION')), 'the running version is shown: ' + h.peek('APP_VERSION'));
        // The skills panel is collapsed by default; open it the way a tap does.
        h.sandbox.toggleHomeSkillsDetails();
        const panel = squash(h.el('homeSkillsPanel').textContent);
        for (const b of ['Book 1', 'Book 2', 'Book 3']) must(panel.includes(b), 'the skills panel has a row for ' + b);
        must(!/Grammar|Grade 4|Phrases|Word form|Rewrite|Verbs/.test(panel), 'no cut skill is listed');
        h.sandbox.toggleHomeSkillsDetails();
        return 'greets ' + TEST_USER + ', shows ' + h.peek('APP_VERSION') + ', rows for Book 1·2·3';
      },
    },
    dailyTaskScreen: {
      title: 'Nhiệm vụ hôm nay: danh sách việc phải làm',
      open: async (h) => {
        stubServer(h, (p) => {
          if (/daily-task/.test(p)) return { ok: true, data: {
            date: '2026-01-01', tasks: [
              { kind: 'word:pr1-1', target: 1, done: 0, progress: 0 },
              { kind: 'word:pr2-mix', target: 1, done: 0, progress: 0 },
            ], allDone: false, rewardedToday: false, justRewarded: false,
            seeds: { progress: 0, goal: 2, next: { id: 'lettuce', name: 'Rau cải' }, inventory: [], recent: [] } } };
          return { ok: false, data: null };
        });
        h.peek('DailyTask').open();
        await settle(8);
      },
      prove: (h, el) => {
        const rows = el.querySelectorAll('.dt-task, .dt-list > *');
        must(rows.length >= 2, 'one row per task the server sent (got ' + rows.length + ')');
        const text = squash(el.textContent);
        must(!/khiên|kiếm|Kho Khiên/i.test(text), 'no shield/sword/armory copy survives on the task screen');
        must(text.includes('200'), 'the 200 xu reward is what the screen promises');
        return rows.length + ' task row(s) from the stubbed server, 200 xu promised';
      },
    },
    wordScreen: {
      title: 'Book 1: 7 thẻ Unit (gộp 15 bài) + Mix, bộ từ Career Paths đã tải, tiêu đề đúng cuốn',
      open: async (h) => { h.sandbox.openBook('pr1'); await settle(); },
      prove: (h, el) => {
        const bank = h.peek('UNIT_WORDS_PR1');
        must(Array.isArray(bank) && bank.length > 0, 'the Career Paths bank arrived (lazy)');
        const bar = h.el('wordUnitsBar');
        must(bar && bar.innerHTML.trim().length > 0, 'the Word cards are drawn on the Word screen');
        const cards = bar.querySelectorAll('.g4-card').filter((c) => !c.classList.contains('g4-mix-card'));
        mustEqual(cards.length, 8, 'one card per practice unit of Book 1 (its first eight units, ~30 words each)');
        must(squash(bar.textContent).includes('Bài 8'), 'the last card says which book unit it is');
        must(bar.querySelectorAll('.g4-mix-card').length === 1, 'and a Mix card');
        mustEqual(bar.querySelectorAll('.g4-set-tabs .grammar-subtab').length, 0, 'no set strip: the bottom bar picks the book');
        must(squash(h.el('wordTitle').textContent).includes('Book 1'), 'the header names the open book');
        const titles = h.peek('UNIT_PR_TITLES');
        must(squash(bar.textContent).includes(titles.pr1[1]), 'the first unit is titled from the bank: ' + titles.pr1[1]);
        must(el.querySelectorAll('#wordSubTabs .grammar-subtab').length === 2, 'practice/history tabs are drawn');
        // The other two buttons swap the book on the same screen.
        h.sandbox.openBook('pr3');
        must(squash(h.el('wordTitle').textContent).includes('Book 3'), 'Book 3 button re-titles the screen');
        mustEqual(h.el('wordUnitsBar').querySelectorAll('.g4-card').filter((c) => !c.classList.contains('g4-mix-card')).length, 7, 'and draws Book 3\'s 7 units');
        const active = h.el('bottomNav').querySelectorAll('.nav-item.active').map((b) => b.dataset.navKey);
        mustEqual(active.join(','), 'book3', 'the bottom bar highlights Book 3');
        h.sandbox.openBook('pr1');
        return '8 unit cards for Book 1, 7 for Book 3, Mix each; header and nav follow the button';
      },
    },
    profileScreen: {
      title: 'Hồ sơ: điểm, chuỗi ngày, giao diện',
      open: async (h) => { h.sandbox.navigateToProfile(); },
      prove: (h, el) => {
        const text = squash(el.textContent);
        must(text.includes(TEST_USER), 'the profile names this child');
        must(text.includes(String(h.state().points)), 'the point total comes from appState (' + h.state().points + ')');
        return 'names ' + TEST_USER + ' and echoes points=' + h.state().points;
      },
    },
    nightRaidScreen: {
      title: 'Nông trại: nhà của bạn, thanh nhiệm vụ, cửa hàng và kho hạt giống',
      open: async (h) => {
        const Farm = h.peek('FarmRules');
        const seeds = { progress: 1, goal: 2, next: { id: 'lettuce', name: 'Rau cải' },
          inventory: Farm.CROPS.map((crop) => ({ id: crop.id, name: crop.name.vi, quantity: 1 })), recent: [] };
        stubServer(h, (p) => {
          // The real GET returns the home row AND the farm clock the plants are
          // drawn from — {home, dayCount, ctx}. Sending less would let a screen
          // that has lost the clock still look verified.
          if (p === 'night-raid/home') {
            return { ok: true, data: {
              home: { coins: h.state().coins, dogLevel: h.state().dogLevel, layout: null },
              dayCount: 3,
              ctx: { today: '2026-01-08', doneYesterday: true, doneToday: false },
              seeds,
            } };
          }
          return { ok: false, data: { error: 'not stubbed' } };
        });
        h.sandbox.openNightRaid();
        await settle(10);
      },
      prove: (h, el) => {
        const text = squash(el.textContent);
        // Raiding is gone: nothing on this screen may lead to another home.
        mustEqual(wiredTo(el, 'nrShowLiveTargets').length, 0, 'no "đi cướp" button');
        mustEqual(wiredTo(el, 'nrShowReports').length, 0, 'no raid reports button');
        mustEqual(wiredTo(el, 'nrOpenArmory').length, 0, 'no armory button');
        must(!/Cướp Đêm|CƯỚP ĐÊM/.test(text), 'the screen no longer calls itself Cướp Đêm');
        must(h.el('bottomNav').style.display !== 'none', 'the bottom bar stays: the farm is a tab, not a game screen');
        // The yard only grows on the days the learner finishes every task, so
        // the task bar has to say so.
        must(text.includes('nhiệm vụ'), 'the task bar ties the garden to today\'s tasks');

        // Coin purchases stay in SHOP. Earned seeds have their own peer-level
        // inventory action so a child never mistakes them for paid items.
        h.sandbox.nrShowBuilder();
        const shop = el.querySelector('#nrBuildShop');
        must(shop, 'the builder draws no shop — nothing on this screen can be bought');
        const tabs = shop.querySelectorAll('.nr-shop-tabs button');
        for (const [id, label] of [['defense', 'Phòng thủ'], ['farm', 'Nông trại'], ['expand', 'Mở rộng']]) {
          const tab = tabs.filter((t) => String(t.getAttribute('onclick') || '').includes("nrSelectShopTab('" + id + "')"));
          mustEqual(tab.length, 1, 'the shop offers exactly one "' + id + '" tab');
          mustEqual(tab[0].getAttribute('aria-label'), label, 'the ' + id + ' icon announces "' + label + '"');
          must(!squash(tab[0].textContent), 'the ' + id + ' tab is icon-only and does not spend room on text');
        }
        mustEqual(tabs.filter((t) => String(t.getAttribute('onclick') || '').includes("nrSelectShopTab('seeds')")).length, 0,
          'Hạt giống must not remain in the coin shop');
        must(wiredTo(el, 'nrOpenSeeds').length >= 1, 'the builder has a peer-level seed inventory action');

        // Every crop the rules define must be on sale. Derived from the live
        // FarmRules, never from a list typed here: add a crop and forget the
        // shop, and this goes red.
        const Farm = h.peek('FarmRules');
        must(Farm && Array.isArray(Farm.CROPS) && Farm.CROPS.length > 0, 'FarmRules.CROPS is not loaded — js/farm-rules.js never ran');
        h.sandbox.nrOpenSeeds();
        const tray = el.querySelector('.nr-build-tray');
        must(tray, 'the seed inventory draws no tray');
        const cards = tray.querySelectorAll('.nr-build-item');
        mustEqual(cards.length, Farm.CROPS.length, 'the inventory shows one card per crop in FarmRules.CROPS');
        const trayText = squash(tray.textContent);
        for (const crop of Farm.CROPS) {
          const card = cards.filter((c) => String(c.getAttribute('onclick') || '').includes("nrSelectBuild('" + crop.id + "')"));
          mustEqual(card.length, 1, 'crop "' + crop.id + '" exists in FarmRules but is missing from the seed inventory');
          must(trayText.includes(crop.name.vi), 'the ' + crop.id + ' card names it in Vietnamese: ' + crop.name.vi);
          must(squash(card[0].textContent).includes('x1 hạt'), 'the ' + crop.id + ' card shows the earned quantity');
          must(!card[0].querySelector('.nr-item-price'), 'the ' + crop.id + ' seed has no coin price');
        }
        return 'castle yard with a task bar and no raid action; earned-seed inventory lists all '
          + Farm.CROPS.length + ' crops (' + Farm.CROPS.map((c) => c.name.vi).join(', ') + '); coin shop keeps '
          + tabs.length + ' tabs';
      },
    },
  };
}

// ---------------------------------------------------------------------------
// the verification itself
// ---------------------------------------------------------------------------

async function verifyClient() {
  const R = makeRunner();
  const started = Date.now();
  const screens = [];

  // ===== boot integrity ====================================================

  const idx = readIndex();

  await R.check('boot-scripts-exist-and-parse',
    'Khởi động: mọi tệp <script> trong index.html tồn tại và không lỗi cú pháp',
    () => {
      must(idx.scripts.length > 0, 'index.html lists no <script src>');
      const bad = [];
      for (const src of idx.scripts) {
        const abs = path.join(ROOT, src);
        if (!fs.existsSync(abs)) { bad.push(src + ' (missing file)'); continue; }
        try { new vm.Script(fs.readFileSync(abs, 'utf8'), { filename: src }); }
        catch (e) { bad.push(src + ' (' + e.message + ')'); }
      }
      mustEqual(bad.length, 0, 'scripts that will not parse: ' + bad.join('; '));
      return idx.scripts.length + ' scripts, all present and parsing';
    });

  // Booting the whole list in one shared context IS the load-order test: a
  // `const` declared twice is a SyntaxError here exactly as in a browser, and
  // a file that touches a not-yet-defined global throws here too.
  const boot = mountApp();
  await R.check('boot-load-order-runs-clean',
    'Khởi động: mọi tệp <script> chạy đúng thứ tự, không tệp nào ném lỗi',
    () => {
      mustEqual(boot.loadErrors.length, 0,
        'files that threw while loading: ' + boot.loadErrors.map((e) => e.src + ' → ' + e.message).join('; '));
      must(typeof boot.sandbox.switchScreen === 'function', 'switchScreen is defined after boot');
      must(typeof boot.sandbox.init === 'function', 'init is defined after boot');
      return boot.scripts.length + ' scripts booted into one global scope with no error';
    });

  // The farm is code the first paint does not carry (js/lazy-data.js
  // GROUP_FILES.farm). Each group must run cleanly AFTER the startup set, in
  // its own order, and the name startup code reaches for by hand —
  // openNightRaid — must stop being a placeholder once the real file has run.
  // A group that threw would otherwise be a farm that says "Đang tải…" forever.
  {
    const groups = Object.keys(boot.sandbox.LazyData.GROUP_FILES)
      .filter((g) => boot.sandbox.LazyData.GROUP_FILES[g].some((f) => !/-data|-exams|-lessons|-source-exams/.test(f)));
    must(groups.includes('farm'), 'expected the farm code group, found: ' + groups.join(', '));
    for (const group of groups) {
      await R.check('boot-lazy-group-runs-clean-' + group,
        'Khởi động: nhóm mã tải chậm "' + group + '" chạy sạch sau khi khởi động',
        async () => {
          const h = mountApp();
          mustEqual(h.loadErrors.length, 0, 'the startup set itself threw');
          const before = { openNightRaid: h.sandbox.openNightRaid };
          const files = h.sandbox.LazyData.GROUP_FILES[group];
          for (const f of files) must(!h.scripts.includes(f), f + ' is ALSO an eager <script> — it would run twice');
          await h.sandbox.LazyData.ensure(group);
          await settle();
          const lazyErrors = h.loadErrors.filter((e) => e.phase === 'lazy');
          mustEqual(lazyErrors.length, 0,
            'files that threw while loading lazily: ' + lazyErrors.map((e) => e.src + ' → ' + e.message).join('; '));
          mustEqual(h.banksLoaded.filter((f) => files.includes(f)).length, files.length, 'not every file of the group ran');
          must(h.sandbox.LazyData.ready(group), 'LazyData does not report the group ready');
          if (group === 'farm') {
            must(typeof h.sandbox.openNightRaid === 'function', 'openNightRaid vanished');
            must(h.sandbox.openNightRaid !== before.openNightRaid, 'openNightRaid is still the startup placeholder after the farm code ran');
          }
          return files.length + ' files ran after the ' + h.scripts.length + ' startup scripts with no error';
        });
    }
  }

  const declBy = new Map();       // name → [files]
  const declKind = new Map();     // name → kind
  const perFileDecls = new Map();
  for (const src of idx.scripts) {
    const decls = topLevelDeclarations(read(src));
    perFileDecls.set(src, decls);
    for (const d of decls) {
      if (!declBy.has(d.name)) declBy.set(d.name, []);
      declBy.get(d.name).push(src);
      declKind.set(d.name, d.kind);
    }
  }

  await R.check('boot-no-duplicate-global-declarations',
    'Khởi động: không tên toàn cục nào bị khai báo hai lần',
    () => {
      const dupes = [...declBy.entries()].filter(([, files]) => files.length > 1)
        .map(([name, files]) => name + ' (' + declKind.get(name) + ') in ' + files.join(' + '));
      mustEqual(dupes.length, 0, 'declared twice, so the later file silently wins: ' + dupes.join('; '));
      return declBy.size + ' distinct top-level names across ' + idx.scripts.length + ' files, none repeated';
    });

  await R.check('boot-top-level-calls-are-already-defined',
    'Khởi động: tệp nào gọi hàm lúc nạp thì hàm đó phải nạp trước',
    () => {
      const order = new Map(idx.scripts.map((s, i) => [s, i]));
      const problems = [];
      let examined = 0;
      const examples = [];
      for (const src of idx.scripts) {
        for (const name of topLevelCalls(read(src))) {
          const owners = declBy.get(name);
          if (!owners) continue;                       // a browser global, or defined lazily
          examined++;
          if (examples.length < 3 && owners[0] !== src) examples.push(src + '→' + name + '() from ' + owners[0]);
          const earliest = Math.min(...owners.map((o) => order.get(o)));
          if (earliest > order.get(src)) {
            problems.push(src + ' calls ' + name + '() at load time but ' + owners[0] + ' loads later');
          }
        }
      }
      // A check that examined nothing proves nothing, so say so instead of passing.
      must(examined > 0, 'the load-time-call scanner matched no calls at all — it is broken, not the app');
      mustEqual(problems.length, 0, problems.join('; '));
      return examined + ' load-time calls resolved against the <script> order (e.g. ' + examples.join(', ') + ')';
    });

  // Junk in localStorage: every key the app reads, poisoned one at a time.
  const STORAGE_KEYS = [
    'flashlingo-users', 'flashlingo-user-' + TEST_USER, 'flashlingo-active-user',
    'flashlingo-study-checkpoint-v1', 'flashlingo_examHistory', 'flashlingo_device_id',
    'flashlingo_accounts', 'flashlingo-last-tab', 'hotWordsWarmed-v2',
    'flashlingo-streak-shown-' + TEST_USER,
  ];
  const JUNK = ['{', 'null', '[]', '{"unexpected":true}', '"a string"'];
  const goodStore = () => ({
    'flashlingo-users': JSON.stringify([TEST_USER]),
    ['flashlingo-user-' + TEST_USER]: JSON.stringify({ username: TEST_USER, avatar: '🐶', passcode: '1234', points: 5, coins: 10, srs: {} }),
    'flashlingo-active-user': TEST_USER,
    'flashlingo-study-checkpoint-v1': JSON.stringify({ kind: 'units', screen: 'wordScreen', state: {} }),
    'flashlingo_examHistory': JSON.stringify([]),
    'flashlingo_device_id': 'dev-1',
    'flashlingo_accounts': JSON.stringify({}),
    'flashlingo-last-tab': 'wordScreen',
    'hotWordsWarmed-v2': '0',
    ['flashlingo-streak-shown-' + TEST_USER]: new Date().toDateString(),
  });

  await R.check('boot-init-on-a-clean-device',
    'Khởi động: init() chạy được trên máy chưa có dữ liệu',
    () => {
      const h = mountApp();
      h.sandbox.init();
      must(h.el('onboardingScreen').classList.contains('active'), 'a clean device lands on the login screen');
      return 'init() on empty storage → onboarding screen active';
    });

  for (const key of STORAGE_KEYS) {
    await R.check('boot-init-survives-junk-' + key.replace(/[^\w-]/g, '_'),
      'Khởi động: init() không sập khi ' + key + ' chứa rác',
      () => {
        const survived = [];
        for (const junk of JUNK) {
          const store = goodStore();
          store[key] = junk;
          const h = mountApp({ storage: store });
          mustEqual(h.loadErrors.length, 0, 'the app did not even load with ' + key + ' = ' + junk);
          h.sandbox.init();               // throws → the check fails, which is the point
          survived.push(junk);
        }
        return 'init() survived ' + survived.length + ' junk values in ' + key;
      });
  }

  // ===== the screen inventory =============================================

  const inv = screenInventory();
  const playbook = screenPlaybook();

  await R.check('screens-inventory-is-consistent',
    'Màn hình: mọi <div class="screen"> đều có id …Screen và ngược lại',
    () => {
      const missingClass = inv.byId.filter((id) => !inv.byClass.includes(id));
      const missingId = inv.byClass.filter((id) => !/Screen$/.test(id));
      mustEqual(missingClass.length, 0, 'ids ending in "Screen" without class="screen": ' + missingClass.join(', '));
      mustEqual(missingId.length, 0, 'elements with class="screen" whose id is not a …Screen: ' + missingId.join(', '));
      must(inv.byClass.length >= 6, 'the inventory found only ' + inv.byClass.length + ' screens — the parser is probably wrong');
      return inv.byClass.length + ' screens found at runtime: ' + inv.byClass.join(', ');
    });

  const reach = reachability(inv.byClass);

  await R.check('screens-nav-targets-all-exist',
    'Điều hướng: mọi switchScreen("…") đều trỏ tới một màn hình có thật',
    () => {
      const targets = new Set();
      for (const m of stripComments(idx.html).matchAll(/switchScreen\(\s*['"](\w+)['"]\s*\)/g)) targets.add(m[1]);
      for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter((n) => n.endsWith('.js'))) {
        for (const m of stripComments(read(path.join('js', f))).matchAll(/switchScreen\(\s*['"](\w+)['"]\s*\)/g)) targets.add(m[1]);
      }
      const unknown = [...targets].filter((t) => !inv.byClass.includes(t));
      // armoryScreen is legitimately built at runtime; prove that, don't assume it.
      const built = [];
      for (const t of unknown) {
        const h = mountApp();
        loginTestUser(h, { coins: 500, dailyTask: { shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [] } });
        try {
          if (t === 'armoryScreen' && h.peek('Armory')) h.peek('Armory').open();
        } catch (e) { /* the assertion below is what reports it */ }
        if (h.el(t)) built.push(t);
      }
      const ghosts = unknown.filter((t) => !built.includes(t));
      mustEqual(ghosts.length, 0, 'switchScreen targets that are no screen at all: ' + ghosts.join(', '));
      return targets.size + ' distinct nav targets; ' + (built.length ? built.join(', ') + ' built at runtime' : 'all present in index.html');
    });

  for (const id of inv.byClass) {
    const sources = reach[id] || [];
    await R.check('screen-reachable-' + id,
      'Đường vào: bé có cách nào mở được "' + id + '" không',
      () => {
        must(sources.length > 0,
          'nothing in index.html or js/ ever opens ' + id + ' — it is dead weight or the way in was deleted');
        return 'reachable from: ' + sources.join(', ');
      });
  }

  // ===== every screen actually renders ====================================

  {
    const h = mountApp();
    loginTestUser(h, { coins: 3000, points: 480, lessonsCompleted: 6, dogLevel: 3, dogGrowthXP: 400 });
    for (const id of inv.byClass) {
      const entry = playbook[id];
      if (!entry) {
        R.fail('screen-renders-' + id,
          'Hiển thị: màn hình "' + id + '"',
          'this screen exists in index.html but tests/verify/client.js has no way to open it — it is UNVERIFIED, not passing');
        screens.push({ id, reachableFrom: reach[id] || [], opened: false, verified: false, note: 'no opener defined' });
        continue;
      }
      let openError = null;
      try { await entry.open(h); await settle(); }
      catch (e) { openError = e; }
      const el = h.el(id);
      const html = el ? el.innerHTML : '';
      const text = el ? squash(el.textContent) : '';
      // eslint-disable-next-line no-loop-func
      await R.check('screen-renders-' + id, 'Hiển thị: ' + entry.title, () => {
        if (openError) throw new Error('opening it threw: ' + openError.message);
        must(el, 'the screen element vanished from the DOM');
        must(el.classList.contains('active'), 'opening it did not make it the active screen');
        must(html.trim().length > 0, 'the screen rendered nothing at all');
        must(text.length > 0, 'the screen has markup but no readable text');
        must(!/Đang tải bài/.test(text), 'the screen is still showing the lazy-loading placeholder');
        must(!el.classList.contains('lazy-css-pending'), 'the screen is still hidden behind its lazy stylesheet (js/lazy-data.js SCREEN_FILES)');
        return entry.prove(h, el);
      });
      screens.push({
        id, reachableFrom: reach[id] || [], opened: !openError, verified: !openError && html.trim().length > 0,
        htmlLength: html.length, textLength: text.length,
        sample: clip(text, 90),
      });
      // The login screen is reached by signing OUT; sign back in for the rest.
      if (!h.peek('currentUser')) h.sandbox.loginUser(TEST_USER);
    }
  }

  // ===== a wallet that only moves when the app says it moves ==============

  await R.check('wallet-untouched-by-plain-rendering',
    'Ví xu: chỉ mở màn hình thì số xu không được đổi',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 1234, points: 100, lessonsCompleted: 6, dogLevel: 3 });
      const before = h.state().coins;
      const drifted = [];
      let rendered = 0;
      for (const id of inv.byClass) {
        const entry = playbook[id];
        if (!entry) continue;
        try { await entry.open(h); await settle(); } catch (e) { /* the render check owns that failure */ }
        if (!h.peek('currentUser')) h.sandbox.loginUser(TEST_USER);   // the login screen signs out
        rendered++;
        const now = h.state().coins;
        if (now !== before) { drifted.push(id + ': ' + before + ' → ' + now); h.state().coins = before; }
      }
      mustEqual(drifted.length, 0, 'rendering moved the wallet — this app has printed coins this way before: ' + drifted.join('; '));
      return 'coins stayed at ' + before + ' across ' + rendered + ' screen renders';
    });

  // ===== the primary interaction of every screen that plays ==============

  await R.check('play-word-type-right-and-wrong-finish',
    'Word: mở Unit 1 Book 1, gõ đúng, gõ sai, xem kết quả trên màn hình Word',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('wordScreen'); await settle();
      const bank = h.peek('UNIT_WORDS_PR1');
      must(Array.isArray(bank) && bank.length, 'the Career Paths bank arrived');
      const coinsBefore = h.peek('appState').coins;
      const histBefore = (h.peek('appState').unitsHistory || []).length;
      h.sandbox.startUnitPractice('pr1-1');
      const st = h.peek('_unitQuiz');
      must(st, 'a Word practice started');
      mustEqual(h.sandbox.unitPracticeScreen(), 'wordScreen', 'the practice belongs to the Word screen');
      must(h.el('wordDetail').querySelector('#unitTextInput'), 'the typing box is on the Word screen');
      must(st.questions.every((q) => q.w.set === 'pr1' && q.w.unit === 1), 'every question is a Book 1 Unit 1 word');
      // Right answer: the full word.
      h.el('unitTextInput').value = st.questions[0].w.en;
      h.sandbox.submitUnitAnswer();
      mustEqual(st.answers[0].isCorrect, true, 'the right word is graded correct');
      must(squash(h.el('wordDetail').textContent).includes('Chính xác'), 'and shown as correct');
      h.sandbox.nextUnitQuestion();
      // Wrong answer: nonsense.
      h.el('unitTextInput').value = 'zzzz';
      h.sandbox.submitUnitAnswer();
      mustEqual(st.answers[1].isCorrect, false, 'nonsense is graded wrong');
      must(squash(h.el('wordDetail').textContent).includes(st.questions[1].w.en), 'the right answer is shown');
      const right = st.answers.filter((a) => a && a.isCorrect).length;
      h.sandbox.finishUnitPractice();
      const app = h.peek('appState');
      mustEqual(app.unitsHistory.length, histBefore + 1, 'finishing writes one history row');
      mustEqual(String(app.unitsHistory[0].unit), 'pr1-1', 'the row is keyed to the Word unit');
      mustEqual(app.coins, coinsBefore + right * 5, 'five coins per right answer, no more');
      must(!h.sandbox.isUnitPracticeActive(), 'the practice is over');
      must(h.sandbox.unitsRetryCount('word') >= 1, 'the missed word is owed on the Word queue');
      return 'Book 1 Unit 1: right graded right, wrong graded wrong, row keyed pr1-1, +' + (right * 5) + ' xu';
    });

  // ===== the wrong-answer paths that carry state =========================

  await R.check('retry-drill-owes-back-a-missed-question',
    'Luyện lại: làm sai một từ thì từ đó bị nợ lại',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.openBook('pr1'); await settle();
      mustEqual(h.sandbox.retryCount('word'), 0, 'the learner starts owing nothing');
      h.sandbox.startUnitPractice('pr1-2');
      const st = h.peek('_unitQuiz');
      must(st, 'a practice started');
      // Answer every word WRONG on purpose.
      for (let i = 0; i < st.questions.length; i++) {
        if (i) h.sandbox.nextUnitQuestion();
        h.el('unitTextInput').value = 'zzzz';
        h.sandbox.submitUnitAnswer();
      }
      h.sandbox.finishUnitPractice();
      const owed = h.sandbox.retryCount('word');
      must(owed > 0, 'missed words must leave a debt, but retryCount(word) is ' + owed);
      return owed + ' word(s) owed back after a deliberately bad practice';
    });

  await R.check('retry-drill-gate-blocks-then-clears',
    'Luyện lại: chưa trả nợ thì không mở bài mới; trả xong thì mở lại được',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.openBook('pr1'); await settle();
      const bank = h.sandbox.unitsBank('pr1');
      const owed = bank.slice(0, 2);
      h.sandbox.retryAdd('word', owed);
      mustEqual(h.sandbox.retryCount('word'), 2, 'two words are owed');

      // The gate: asking for a new practice must open the drill instead.
      h.sandbox.startUnitPractice('pr1-3');
      must(!h.peek('_unitQuiz'), 'a new practice must NOT start while a debt is owed');
      must(h.sandbox.isRetryDrillActive(), 'the drill must open instead');
      mustEqual(h.sandbox.retryDrillKey(), 'word', 'and it must be the Book drill');

      const cfg = h.sandbox.retryCfg('word');
      // A wrong answer keeps the debt.
      const first = h.peek('_retryDrill').queue[0];
      h.el('retryInput').value = 'definitely-not-the-answer';
      h.sandbox.submitRetryAnswer();
      mustEqual(h.peek('_retryDrill').answered.ok, false, 'a wrong answer in the drill is marked wrong');
      mustEqual(h.sandbox.retryCount('word'), 2, 'and the debt does not shrink');
      h.sandbox.nextRetryQuestion();

      // Now answer both correctly; the debt must clear.
      for (let guard = 0; guard < 10 && h.sandbox.isRetryDrillActive(); guard++) {
        const drill = h.peek('_retryDrill');
        if (!drill || !drill.queue.length) break;
        const item = drill.queue[drill.idx % drill.queue.length];
        h.el('retryInput').value = cfg.answerText(item);
        h.sandbox.submitRetryAnswer();
        must(h.peek('_retryDrill') && h.peek('_retryDrill').answered.ok === true,
          'the drill rejected its own answerText() for ' + cfg.idOf(item));
        h.sandbox.nextRetryQuestion();
      }
      mustEqual(h.sandbox.retryCount('word'), 0, 'answering everything owed must clear the debt');
      must(!h.sandbox.isRetryDrillActive(), 'and close the drill');

      // The gate is open again.
      h.sandbox.startUnitPractice('pr1-3');
      must(h.peek('_unitQuiz'), 'a new practice must start once nothing is owed');
      return 'owed 2 → wrong answer kept the debt → 2 right answers cleared it → practice reopened (first owed: '
        + cfg.idOf(first) + ')';
    });

  await R.check('retry-drill-debt-survives-a-reload',
    'Luyện lại: nợ vẫn còn sau khi đóng và mở lại ứng dụng',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.openBook('pr1'); await settle();
      h.sandbox.retryAdd('word', h.sandbox.unitsBank('pr1').slice(0, 3));
      mustEqual(h.sandbox.retryCount('word'), 3, 'three owed before the reload');
      const saved = h.store['flashlingo-user-' + TEST_USER];
      must(saved && JSON.parse(saved).wordRetry && JSON.parse(saved).wordRetry.length === 3,
        'the debt must be written to storage, not just held in memory');
      // A genuine cold start: a second mount reading the same localStorage.
      const h2 = mountApp({ storage: Object.assign({}, h.store) });
      h2.sandbox.loginUser(TEST_USER);
      h2.sandbox.openBook('pr1'); await settle();
      mustEqual(h2.sandbox.retryCount('word'), 3, 'the debt must still be owed after a reload');
      h2.sandbox.startUnitPractice('pr1-4');
      must(!h2.peek('_unitQuiz'), 'and must still block a new practice');
      return '3 owed words survived a full remount and still gate the Books';
    });

  await R.check('wrong-priority-forces-a-missed-item-back',
    'Ưu tiên câu sai: câu từng sai phải quay lại cho tới khi đúng 5 lần liền',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      const pool = Array.from({ length: 40 }, (_, i) => ({ id: 'q' + i }));
      const missed = 'q7';
      h.sandbox.prioRecord('verifykey', [], [missed]);
      mustEqual(h.sandbox.prioStreak('verifykey', missed), 0, 'a freshly missed item starts at streak 0');
      const forced = h.sandbox.prioForced('verifykey', pool, 10);
      must(forced.some((x) => x.id === missed), 'the missed item must be forced back into the draw');

      // Five right answers in a row release it (PRIO_GRADUATE).
      const grad = h.peek('PRIO_GRADUATE');
      for (let i = 0; i < grad; i++) h.sandbox.prioRecord('verifykey', [missed], []);
      const after = h.sandbox.prioForced('verifykey', pool, 10);
      must(!after.some((x) => x.id === missed),
        'after ' + grad + ' correct answers in a row the item must be released, but it is still forced');
      must(!h.sandbox.prioStreak('verifykey', missed), 'and its record is gone');

      // One more miss puts it straight back.
      h.sandbox.prioRecord('verifykey', [], [missed]);
      must(h.sandbox.prioForced('verifykey', pool, 10).some((x) => x.id === missed),
        'missing it again must owe it back again');
      return 'q7 forced back, released after ' + grad + ' correct in a row, forced again after the next miss';
    });

  await R.check('wrong-priority-is-scoped-to-its-pool',
    'Ưu tiên câu sai: câu sai ở phần này không lọt sang phần khác',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.prioRecord('scopekey', [], ['fromUnit3']);
      const otherPool = Array.from({ length: 20 }, (_, i) => ({ id: 'unit5-' + i }));
      const forced = h.sandbox.prioForced('scopekey', otherPool, 10);
      mustEqual(forced.length, 0, 'a miss from another unit must not leak into this pool');
      const ownPool = otherPool.concat([{ id: 'fromUnit3' }]);
      must(h.sandbox.prioForced('scopekey', ownPool, 10).some((x) => x.id === 'fromUnit3'),
        'but it must come back in the pool it belongs to');
      return 'a Unit-3 miss stays out of a Unit-5 draw and returns in its own';
    });

  await R.check('quiz-in-progress-guards-the-bottom-nav',
    'Bỏ dở bài: chuyển tab giữa chừng phải hỏi trước, và bấm Huỷ thì ở lại',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.openBook('pr1'); await settle();
      h.sandbox.startUnitPractice('pr1-1');
      must(h.sandbox.isUnitPracticeActive(), 'a practice is running');
      h.sandbox.__confirmAnswer = false;                      // the child taps "stay"
      h.sandbox.__confirmLog.length = 0;
      const left = h.sandbox.switchScreen('homeScreen');
      mustEqual(left, false, 'tapping another tab must not leave the quiz when the child says no');
      must(h.sandbox.__confirmLog.length === 1, 'and it must actually have asked (' + h.sandbox.__confirmLog.length + ' prompts)');
      must(h.sandbox.isUnitPracticeActive(), 'the practice must still be running');
      h.sandbox.__confirmAnswer = true;                       // now the learner says yes
      mustEqual(h.sandbox.switchScreen('homeScreen'), true, 'saying yes must leave');
      must(!h.sandbox.isUnitPracticeActive(), 'and must end the practice');
      return 'asked before leaving; Cancel kept the quiz, OK ended it';
    });

  const limitations = [
    'Pixels and layout: the DOM shim does no layout, so overlap, clipping, z-order and off-screen buttons are invisible here. They belong in a browser.',
    'Pointer gestures: the farm builder\'s drag-and-drop is not driven at all.',
    'Canvas: the farm yard paints into a stubbed 2D context, so its artwork is never checked — only that painting does not throw.',
    'Timers: setTimeout/setInterval are recorded, not fired, so the farm production ticker is not exercised.',
    'Audio: speakWord/answer-audio are stubbed, so the answer gate is proved to exist but never actually heard.',
    'The server: Pet Battle, Night Raid, Đấu Toán, Cướp Cô Hồn and the daily-task/armory claims run against stubbed replies. What the real Functions endpoints do is another layer\'s job.',
    'Math Wars and Đấu Toán (MathFight) rounds are not played here; only their hub entries are verified to render.',
  ];

  return { checks: R.checks, screens, limitations, elapsedMs: Date.now() - started };
}

module.exports = { verifyClient, mountApp, loginTestUser, stubServer, screenInventory, reachability };

// Running the file directly is a runner, so printing here is the runner's job,
// not the export's.
if (require.main === module) {
  verifyClient().then((res) => {
    const bad = res.checks.filter((c) => !c.ok);
    for (const c of res.checks) {
      process.stdout.write((c.ok ? '  ok  ' : '  FAIL') + '  ' + c.id + '  —  ' + c.feature + '\n');
      if (!c.ok) process.stdout.write('        ' + c.detail + '\n');
    }
    process.stdout.write('\nNot covered by this layer:\n');
    for (const l of res.limitations) process.stdout.write('  · ' + l + '\n');
    process.stdout.write('\n' + (res.checks.length - bad.length) + '/' + res.checks.length
      + ' checks passed, ' + res.screens.length + ' screens, ' + res.elapsedMs + ' ms\n');
    process.exit(bad.length ? 1 : 0);
  }).catch((e) => {
    process.stdout.write('verifyClient() itself threw: ' + (e && e.stack || e) + '\n');
    process.exit(2);
  });
}
