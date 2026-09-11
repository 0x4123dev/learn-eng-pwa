// tests/verify/client.js — "is any feature still there?", asked of the app
// itself rather than of the code that was written alongside it.
//
// The unit suite was written by the same hands as the bugs, and it mostly asks
// questions the source can answer by containing a string. This layer refuses
// to read source text as evidence. It boots the real index.html script list in
// one shared global scope — the way a browser does — logs a child in, opens
// every screen the way a finger reaches it, and then plays: matches a pair,
// answers a grammar question right and the next one WRONG, types a verb,
// finishes an exam, finds a word in the hunt grid, opens the raid target list.
//
// Every check has to be falsifiable. "renderX() returned a string" proves
// nothing, so each render is proved against live data instead: Grammar must
// draw one card per unit in GRAMMAR_UNITS, Phrases must print the real bank
// size, Verbs must echo a best score planted in appState, Night Raid must show
// one row per friend the stubbed server sent. And every grader is asked twice
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
  // (appState, _grammarQuizState, speedState…), which never lands on the
  // global object and so cannot be read from outside without this.
  vm.runInContext(
    'globalThis.__peek = function (n) { try { return eval(n); } catch (e) { return undefined; } };'
    + 'globalThis.__run = function (code) { return eval(code); };',
    sandbox, { filename: 'verify-bridge' });

  // Lazy banks (js/lazy-data.js) arrive as <script> tags appended to <head>.
  // Serve them from disk through that same path so LazyData.ensure/ready are
  // exercised for real instead of being bypassed.
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
    for (const m of code.matchAll(/\b(openPetBattle|openNightRaid|openWordHunt|navigateToProfile)\s*\(/g)) {
      const map = { openPetBattle: 'petBattleScreen', openNightRaid: 'nightRaidScreen', navigateToProfile: 'profileScreen' };
      if (map[m[1]]) note(map[m[1]], 'markup');
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
      title: 'Trang chủ: tên bé, phiên bản, thẻ kỹ năng',
      open: async (h) => {
        if (!h.peek('currentUser')) h.sandbox.loginUser(TEST_USER);   // arriving from the login screen
        h.sandbox.switchScreen('homeScreen');
      },
      prove: (h, el) => {
        const text = squash(el.textContent);
        must(text.includes(TEST_USER), 'the home screen greets this child by name');
        must(text.includes(h.peek('APP_VERSION')), 'the running version is shown: ' + h.peek('APP_VERSION'));
        return 'greets ' + TEST_USER + ', shows ' + h.peek('APP_VERSION') + ', ' + el.innerHTML.length + ' chars';
      },
    },
    dailyTaskScreen: {
      title: 'Nhiệm vụ hôm nay: danh sách việc phải làm',
      open: async (h) => {
        stubServer(h, (p) => {
          if (/daily-task/.test(p)) return { ok: true, data: {
            date: '2026-01-01', tasks: [
              { kind: 'grammar', target: 1, done: 0, progress: 0 },
              { kind: 'math', target: 1, done: 0, progress: 0 },
            ], allDone: false, shields: { count: 1, activeUntil: 0 }, swords: { count: 2 }, pending: [], recent: [] } };
          return { ok: false, data: null };
        });
        h.peek('DailyTask').open();
        await settle(8);
      },
      prove: (h, el) => {
        const rows = el.querySelectorAll('.dt-task, .dt-list > *');
        must(rows.length >= 2, 'one row per task the server sent (got ' + rows.length + ')');
        must(squash(el.textContent).includes('Kiếm'), 'the armory strip is drawn');
        return rows.length + ' task row(s) from the stubbed server';
      },
    },
    lessonScreen: {
      title: 'Bài học từ vựng: hai cột thẻ để ghép',
      open: async (h) => { h.sandbox.startLesson(0); },
      prove: (h, el) => {
        const left = el.querySelectorAll('#leftColumn .match-card');
        const right = el.querySelectorAll('#rightColumn .match-card');
        const per = h.peek('WORDS_PER_LESSON');
        mustEqual(left.length, per, 'left column holds one card per lesson word');
        mustEqual(right.length, per, 'right column holds one card per lesson word');
        const vocab = h.peek('ieltsVocabulary');
        const words = right.map((c) => c.getAttribute('data-word'));
        must(words.every((w) => vocab.some((v) => v.en === w)), 'every card is a real vocabulary word');
        return per + ' pairs drawn from ieltsVocabulary (' + words.slice(0, 3).join(', ') + '…)';
      },
    },
    speedChallengeScreen: {
      title: 'Động từ bất quy tắc: bảng điểm + nút bắt đầu',
      open: async (h) => {
        const st = h.state();
        st.speedChallenge = { bestScore: 4242, bestStreak: 7, totalGames: 3 };
        h.sandbox.switchScreen('speedChallengeScreen');
      },
      prove: (h, el) => {
        mustEqual(h.el('bestScore').textContent, '4242', 'the best score comes from appState, not from the markup');
        mustEqual(h.el('bestStreak').textContent, '7', 'and so does the best streak');
        must(wiredTo(el, 'startSpeedChallenge').length >= 1, 'a Start button exists');
        return 'best score 4242 / streak 7 read back from appState';
      },
    },
    examScreen: {
      title: 'Đề thi: danh sách các đề',
      open: async (h) => { h.sandbox.switchScreen('examScreen'); await settle(); },
      prove: (h, el) => {
        const exams = h.peek('EXAMS');
        must(Array.isArray(exams) && exams.length > 0, 'the exam bank arrived (lazy)');
        const text = squash(el.textContent);
        must(text.includes(exams[0].title), 'the first exam is listed by its real title: ' + exams[0].title);
        must(text.includes(String(exams[0].questions.length)), 'its real question count is shown');
        return exams.length + ' exams in bank; "' + exams[0].title + '" listed with ' + exams[0].questions.length + ' questions';
      },
    },
    ptnkScreen: {
      title: 'PTNK: danh sách đề thật, mở một đề, trả lời, thoát',
      open: async (h) => { h.sandbox.switchScreen('ptnkScreen'); await settle(); },
      prove: (h, el) => {
        // Same engine as the Exam tab, its own bank and its own screen. What
        // can go wrong silently: the bank not arriving (an empty year list),
        // a paper opening on the WRONG screen (the HCMC one), or the answer
        // buttons rendering but not advancing. Each is checked by doing it.
        const bank = h.peek('PTNK_EXAMS');
        must(Array.isArray(bank) && bank.length > 0, 'the PTNK bank arrived (lazy)');
        const text = squash(el.textContent);
        must(text.includes(bank[0].title), 'the first paper is listed by its real title: ' + bank[0].title);
        must(wiredTo(el, 'startPtnkExam').length === bank.length,
          'every paper in the bank has a button (' + wiredTo(el, 'startPtnkExam').length + '/' + bank.length + ')');
        const years = (h.el('ptnkScreen').innerHTML.match(/ptnk-year">\d{4}</g) || []);
        must(years.length >= 2, 'papers are grouped under year headings');
        h.sandbox.startExam(bank[0].id, 'ptnk');
        must(h.sandbox.isExamActive(), 'the paper did not start');
        must(h.sandbox.examCurrentSet() === 'ptnk', 'the paper opened in the ptnk set, not the HCMC one');
        const q = h.el('ptnkScreen').textContent;
        must(q.length > 20, 'the first question is drawn on the PTNK screen, not the Exam screen');
        h.sandbox.abandonExam();
        must(!h.sandbox.isExamActive(), 'the paper did not stop');
        h.sandbox.renderPtnkHome();
        return bank.length + ' PTNK papers listed under ' + years.length + ' years; "' + bank[0].title + '" opens in the ptnk set';
      },
    },
    readingScreen: {
      title: 'Đọc hiểu: danh sách bài, mở một bài, thấy đoạn văn, trả lời',
      open: async (h) => { h.sandbox.switchScreen('readingScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.peek('READING_PASSAGES');
        must(Array.isArray(bank) && bank.length > 0, 'the reading bank arrived (lazy)');
        must(wiredTo(el, 'startReadingPassage').length === bank.length, 'every passage has a card');
        must(bank.some(p => p.level === 'kc') && bank.some(p => p.level === 'ch'), 'both levels are in the bank');
        h.sandbox.startExam(bank[0].id, 'reading');
        must(h.sandbox.isExamActive() && h.sandbox.examCurrentSet() === 'reading', 'the passage opened in the reading set');
        const text = squash(h.el('readingScreen').textContent);
        must(text.includes(squash(bank[0].passage.replace(/<[^>]+>/g, ' ')).slice(0, 40)), 'the passage is drawn above the question');
        h.sandbox.abandonExam();
        h.sandbox.renderReadingHome();
        return bank.length + ' passages; "' + bank[0].title + '" opens with its passage on screen';
      },
    },
    clozeScreen: {
      title: 'Điền từ: danh sách đoạn, mở một đoạn, thấy 10 chỗ trống',
      open: async (h) => { h.sandbox.switchScreen('clozeScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.peek('CLOZE_PASSAGES');
        must(Array.isArray(bank) && bank.length > 0, 'the cloze bank arrived (lazy)');
        must(wiredTo(el, 'startClozePassage').length === bank.length, 'every text has a card');
        must(bank.some(p => p.mode === 'mcq') && bank.some(p => p.mode === 'open'), 'both cloze modes are in the bank');
        h.sandbox.startExam(bank[0].id, 'cloze');
        must(h.sandbox.isExamActive() && h.sandbox.examCurrentSet() === 'cloze', 'the text opened in the cloze set');
        must(squash(h.el('clozeScreen').textContent).includes('(10)____'), 'all ten blanks are on screen');
        h.sandbox.abandonExam();
        h.sandbox.renderClozeHome();
        return bank.length + ' cloze texts; "' + bank[0].title + '" opens with its ten blanks';
      },
    },
    errorsScreen: {
      title: 'Tìm lỗi sai: bắt đầu một lượt, thấy bốn phần gạch chân, trả lời',
      open: async (h) => { h.sandbox.switchScreen('errorsScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.peek('ERROR_ITEMS');
        must(Array.isArray(bank) && bank.length >= 20, 'the errors bank arrived (lazy)');
        must(wiredTo(el, 'startErrorsRound').length === 2, 'one round per level');
        h.sandbox.startErrorsRound('kc');
        must(h.sandbox.isExamActive() && h.sandbox.examCurrentSet() === 'errors', 'the round started in the errors set');
        const opts = h.el('errorsScreen').querySelectorAll('.grammar-option');
        must(opts.length === 4, 'four segments to choose from');
        h.sandbox.answerExamChoice(0);
        must(h.sandbox.isExamActive(), 'one answer does not end a ten-item round');
        h.sandbox.abandonExam();
        h.sandbox.renderErrorsHome();
        return bank.length + ' items; a Không chuyên round opens with four segments';
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
    petBattleScreen: {
      title: 'Đấu trường thú cưng: danh sách bạn để thách đấu',
      open: async (h) => {
        stubServer(h, (p) => {
          if (p === 'battle') return { ok: true, data: { ammo: 3, readyAt: 0, stats: { wins: 1, losses: 0 }, battle: null } };
          return { ok: false, data: null };
        });
        h.run("_friendsData = { friends: [{userId:22,username:'Oleole'},{userId:33,username:'Mai'},{userId:44,username:'Bin'}], incoming: [], outgoing: [] }");
        h.sandbox.openPetBattle();
        await settle(8);
      },
      prove: (h, el) => {
        const rows = el.querySelectorAll('.pb-friend');
        mustEqual(rows.length, 3, 'one row per friend the server listed');
        const names = squash(el.textContent);
        for (const n of ['Oleole', 'Mai', 'Bin']) must(names.includes(n), 'friend ' + n + ' is on screen');
        return '3 friend rows: Oleole, Mai, Bin';
      },
    },
    nightRaidScreen: {
      title: 'Cướp Đêm: nhà của bé, chỉ số DAM/DEF, và cửa hàng nông trại',
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
        for (const chip of ['DAM', 'DEF', 'LÍNH']) must(text.includes(chip), 'the ' + chip + ' chip is drawn');
        must(wiredTo(el, 'nrShowLiveTargets').length >= 1 || text.includes('CƯỚP ĐÊM'), 'the raid action is offered');
        // The farm is the other half of this screen: the yard only grows on the
        // days the child finishes every task, so the task bar has to say so.
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
        return 'castle yard with DAM/DEF/LÍNH chips and a task bar; earned-seed inventory lists all '
          + Farm.CROPS.length + ' crops (' + Farm.CROPS.map((c) => c.name.vi).join(', ') + '); coin shop keeps '
          + tabs.length + ' tabs';
      },
    },
    learnHubScreen: {
      title: 'Trang Học: các thẻ dẫn tới từng kỹ năng',
      open: async (h) => { h.sandbox.switchScreen('learnHubScreen'); },
      prove: (h, el) => {
        const cards = el.querySelectorAll('.nav-hub-card');
        // Derived from index.html, not from a number typed here.
        const declared = (readIndex().body.match(/class="nav-hub-card[^"]*"/g) || []).length;
        mustEqual(cards.length, declared, 'every hub card declared in index.html is on screen');
        const targets = cards.map((c) => (c.getAttribute('onclick') || '').match(/switchScreen\(['"](\w+)['"]\)/)).filter(Boolean).map((m) => m[1]);
        must(targets.length >= 5, 'the hub cards point at screens (' + targets.length + ' do)');
        return cards.length + ' hub cards → ' + targets.join(', ');
      },
    },
    mathHubScreen: {
      title: 'Toán: chọn phần, rồi chọn chương',
      open: async (h) => { h.sandbox.switchScreen('mathHubScreen'); await settle(); },
      prove: (h, el) => {
        must(wiredTo(el, 'openMathSection').length >= 2, 'the hub offers its sections');
        h.sandbox.openMathSection('toan7');
        must(wiredTo(h.el('mathHubScreen'), 'openMathSection').length >= 2, 'Toán 7 offers both semesters');
        const listed = [];
        for (const semester of ['hk1', 'hk2']) {
          h.sandbox.openMathSection(semester);
          const chapters = h.sandbox.mathChapters();
          must(chapters.length > 0, semester + ' has no chapters — its bank did not arrive');
          const text = squash(h.el('mathHubScreen').textContent);
          const missing = chapters.filter((c) => !text.includes(c.title));
          mustEqual(missing.length, 0, semester + ' hides chapters that exist in the bank: ' + missing.map((c) => c.title).join(', '));
          listed.push(semester + '=' + chapters.length);
        }
        // Toán 4 is a second môn in the same tab, and its bank is lazy like
        // the rest — a card that leads to an empty paper is the failure this
        // catches.
        h.sandbox.openMathSection('toan4');
        const g4 = h.sandbox.math4Types();
        must(g4.length > 0, 'Toán 4 has no dạng — its bank did not arrive');
        const g4text = squash(h.el('mathHubScreen').textContent);
        const hidden = g4.filter((t) => !g4text.includes(t.title));
        mustEqual(hidden.length, 0, 'Toán 4 hides dạng that exist: ' + hidden.map((t) => t.title).join(', '));
        must(wiredTo(h.el('mathHubScreen'), 'startMath4Pre').length >= 1, 'Toán 4 offers no Pre paper');
        // Bảng cửu chương: six drills behind one CTA. Open it, start the
        // hardest one, answer a question and prove the round advances — the
        // clock is 30 seconds, so a screen that renders but does not respond
        // to a tap is indistinguishable from one that works until a child has
        // already lost the round.
        h.sandbox.openMathSection('cuuchuong');
        const cc = h.el('mathHubScreen');
        mustEqual(wiredTo(cc, 'startMathTables').length, 6,
          'Bảng cửu chương must offer all six drills');
        h.sandbox.startMathTables('d', '89');
        must(h.sandbox.isMathTablesActive(), 'the bảng chia 8, 9 round did not start');
        const ccOpts = h.el('mathHubScreen').querySelectorAll('.wars-option');
        mustEqual(ccOpts.length, 4, 'a cửu chương question must offer four answers');
        h.sandbox.answerMathTables(0);
        must(h.sandbox.isMathTablesActive(), 'one answer must not end a ten-question round');
        h.sandbox.abandonMathTables();
        must(!h.sandbox.isMathTablesActive(), 'the round did not stop');
        h.sandbox.openMathSection('home');
        return 'every chapter listed in both semesters (' + listed.join(', ')
          + '), Toán 4 lists ' + g4.length + ' dạng';
      },
    },
    grammarScreen: {
      title: 'Ngữ pháp: danh sách 13 unit',
      open: async (h) => { h.sandbox.switchScreen('grammarScreen'); await settle(); },
      prove: (h, el) => {
        const units = h.peek('GRAMMAR_UNITS');
        must(Array.isArray(units) && units.length > 0, 'the grammar bank arrived (lazy)');
        mustEqual(el.querySelectorAll('.grammar-unit-card').length, units.length, 'one card per unit in GRAMMAR_UNITS');
        must(squash(el.textContent).includes(units[0].name), 'the first unit is named: ' + units[0].name);
        return units.length + ' unit cards, first = "' + units[0].name + '"';
      },
    },
    phrasesScreen: {
      title: 'Giới từ / cụm từ: trang chính',
      open: async (h) => { h.sandbox.switchScreen('phrasesScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.peek('PREPOSITION_QUESTIONS');
        must(Array.isArray(bank) && bank.length > 0, 'the phrases bank arrived (lazy)');
        must(squash(el.textContent).includes(String(bank.length)), 'the real bank size (' + bank.length + ') is printed');
        must(wiredTo(el, 'startPhrasesQuiz').length >= 1, 'a practice button is offered');
        return 'bank of ' + bank.length + ' printed on screen';
      },
    },
    wordformScreen: {
      title: 'Word form: trang chính',
      open: async (h) => { h.sandbox.switchScreen('wordformScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.sandbox.wordformBank();
        must(bank.length > 0, 'the word-form bank arrived (lazy)');
        must(squash(el.textContent).includes(String(bank.length)), 'the real bank size (' + bank.length + ') is printed');
        must(wiredTo(el, 'startWordformQuiz').length >= 1, 'a practice button is offered');
        return 'bank of ' + bank.length + ' printed on screen';
      },
    },
    rewriteScreen: {
      title: 'Rewrite: trang chính',
      open: async (h) => { h.sandbox.switchScreen('rewriteScreen'); await settle(); },
      prove: (h, el) => {
        const bank = h.sandbox.rewriteBank();
        must(bank.length > 0, 'the rewrite bank arrived (lazy)');
        must(squash(el.textContent).includes(String(bank.length)), 'the real bank size (' + bank.length + ') is printed');
        must(wiredTo(el, 'startRewriteQuiz').length >= 1, 'a practice button is offered');
        return 'bank of ' + bank.length + ' printed on screen';
      },
    },
    gradeFourScreen: {
      title: 'Grade 4 trực tiếp từ Learn',
      open: async (h) => { h.sandbox.switchScreen('gradeFourScreen'); h.sandbox.renderGrade4Home(); },
      prove: (h, el) => {
        const bar = h.el('unitsBar');
        const cards = bar.querySelectorAll('.g4-card').filter((c) => !c.classList.contains('g4-mix-card'));
        const units = h.sandbox.unitsList();
        must(cards.length > 0, 'the Grade-4 unit cards are drawn');
        mustEqual(cards.length, units.length, 'one card per unit in the active set');
        must(el.querySelectorAll('#grade4SubTabs .grammar-subtab').length === 2, 'practice/history tabs are drawn');
        return cards.length + ' Grade-4 unit cards on its own screen';
      },
    },
    topicsScreen: {
      title: 'Topics: từ vựng theo chủ đề',
      open: async (h) => { h.sandbox.switchScreen('topicsScreen'); h.sandbox.renderTopicsHome(); },
      prove: (h, el) => {
        const cards = el.querySelectorAll('#topicsGrid .topic-card');
        must(cards.length > 0, 'the vocabulary topic cards are drawn');
        mustEqual(el.querySelectorAll('#unitsBar').length, 0, 'Grade 4 is no longer nested inside Topics');
        return cards.length + ' vocabulary topic cards, no nested Grade 4 menu';
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
    'Khởi động: 64 tệp chạy đúng thứ tự, không tệp nào ném lỗi',
    () => {
      mustEqual(boot.loadErrors.length, 0,
        'files that threw while loading: ' + boot.loadErrors.map((e) => e.src + ' → ' + e.message).join('; '));
      must(typeof boot.sandbox.switchScreen === 'function', 'switchScreen is defined after boot');
      must(typeof boot.sandbox.init === 'function', 'init is defined after boot');
      return boot.scripts.length + ' scripts booted into one global scope with no error';
    });

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
    'flashlingo-study-checkpoint-v1': JSON.stringify({ kind: 'lesson', screen: 'lessonScreen', state: {} }),
    'flashlingo_examHistory': JSON.stringify([]),
    'flashlingo_device_id': 'dev-1',
    'flashlingo_accounts': JSON.stringify({}),
    'flashlingo-last-tab': 'grammarScreen',
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
      must(inv.byClass.length >= 10, 'the inventory found only ' + inv.byClass.length + ' screens — the parser is probably wrong');
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

  await R.check('screen-renders-armoryScreen',
    'Kho Khiên & Kiếm: màn hình được dựng lúc chạy, không có trong index.html',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 500 });
      must(!h.el('armoryScreen'), 'index.html must NOT already carry this screen — it is built by js/armory.js');
      stubServer(h, (p) => (/daily-task/.test(p)
        ? { ok: true, data: { date: '2026-01-01', tasks: [], allDone: true,
            shields: { count: 1, activeUntil: 0 }, swords: { count: 3 }, pending: ['2026-01-01'], recent: [] } }
        : { ok: false, data: null }));
      h.peek('Armory').open();
      await settle(8);
      const el = h.el('armoryScreen');
      must(el, 'Armory.open() did not build #armoryScreen');
      must(el.classList.contains('active'), 'and did not make it the active screen');
      must(el.innerHTML.trim().length > 0, 'and it rendered nothing');
      const text = squash(el.textContent);
      must(text.includes('Khiên') && text.includes('Kiếm'), 'both collection cards are drawn');
      const rules = h.peek('NightRaidRules');
      const dam = rules && typeof rules.swordBonus === 'function' ? rules.swordBonus(3) : null;
      must(dam === null || text.includes(String(dam)), 'the sword bonus shown (+' + dam + ' DAM) comes from NightRaidRules');
      return 'built at runtime; shows 1 shield / 3 swords' + (dam === null ? '' : ' worth +' + dam + ' DAM');
    });

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

  await R.check('wallet-earns-on-a-finished-maths-round',
    'Ví xu: làm xong một lượt Toán thì được cộng xu',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 1000 });
      h.sandbox.switchScreen('mathHubScreen'); await settle();
      const rate = h.peek('MATH_COINS_PER_CORRECT');
      const chapter = h.sandbox.mathChapters()[0].num;
      h.sandbox.startMathQuiz(chapter);
      const st = h.peek('_mathQuiz');
      must(st, 'the round started');
      const mcq = st.questions.map((q, i) => (h.sandbox.mathIsTyped(q) ? -1 : i)).filter((i) => i >= 0);
      must(mcq.length >= 2, 'the round has multiple-choice questions to answer');
      st.answers = st.questions.map((q, i) => (mcq.includes(i) ? q.correct : null));
      const expectedScore = st.answers.reduce((s, a, i) => s + (h.sandbox.mathIsCorrect(st.questions[i], a) ? 1 : 0), 0);
      const before = h.state().coins;
      h.sandbox.finishMathQuiz();
      const gained = h.state().coins - before;
      must(gained >= expectedScore * rate, 'expected at least ' + (expectedScore * rate) + ' coins for ' + expectedScore + ' correct, got ' + gained);
      must(gained > 0, 'a finished round paid nothing');
      return expectedScore + ' correct × ' + rate + ' xu → wallet ' + before + ' → ' + h.state().coins;
    });

  await R.check('wallet-spends-on-a-shield',
    'Ví xu: mua khiên thì trừ đúng số xu, và hết tiền thì không mua được',
    async () => {
      const h = mountApp();
      const price = h.peek('SHIELD_PRICE');
      must(typeof price === 'number' && price > 0, 'SHIELD_PRICE is a real price');
      loginTestUser(h, { coins: price + 5, streakShields: 0 });
      h.sandbox.switchScreen('homeScreen');
      h.sandbox.buyShield();
      mustEqual(h.state().coins, 5, 'the shield cost exactly ' + price);
      mustEqual(h.state().streakShields, 1, 'and one shield arrived');
      // Now broke: the same tap must change nothing at all.
      h.sandbox.buyShield();
      mustEqual(h.state().coins, 5, 'a purchase with too few coins must not move the wallet');
      mustEqual(h.state().streakShields, 1, 'and must not hand out a free shield');
      return 'paid ' + price + ' for a shield; a second tap with 5 xu left changed nothing';
    });

  // ===== the primary interaction of every screen that plays ==============

  await R.check('play-topics-matching-pair',
    'Từ vựng: mở bài, ghép đúng một cặp, ghép sai một cặp',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.startLesson(0);
      const left = () => h.el('leftColumn').querySelectorAll('.match-card');
      const right = () => h.el('rightColumn').querySelectorAll('.match-card');
      const l = left()[0];
      const word = l.getAttribute('data-word');
      const r = right().find((c) => c.getAttribute('data-word') === word);
      must(r, 'the matching English card is on screen');
      l.click(); r.click();
      const afterGood = h.peek('lessonState');
      mustEqual(afterGood.matchedPairs, 1, 'a correct pair must count as matched');
      mustEqual(afterGood.correctInLesson, 1, 'and must be recorded as correct');
      must(l.classList.contains('matched') && r.classList.contains('matched'), 'both cards must show as matched');
      // A wrong pair must NOT be accepted.
      const l2 = left().find((c) => !c.classList.contains('matched'));
      const r2 = right().find((c) => !c.classList.contains('matched') && c.getAttribute('data-word') !== l2.getAttribute('data-word'));
      must(l2 && r2, 'there are unmatched cards left to mis-match');
      const wrongBefore = h.peek('lessonState').wrongInLesson;
      l2.click(); r2.click();
      const st = h.peek('lessonState');
      mustEqual(st.matchedPairs, 1, 'a wrong pair must NOT count as matched');
      mustEqual(st.wrongInLesson, wrongBefore + 1, 'a wrong pair must be recorded as wrong');
      return 'matched "' + word + '" correctly; a deliberate mis-match was rejected and counted wrong';
    });

  await R.check('play-grammar-answer-right-and-wrong',
    'Ngữ pháp: mở tab, trả lời một câu đúng và một câu sai',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('grammarScreen'); await settle();
      const unit = h.peek('GRAMMAR_UNITS')[0];
      h.sandbox.startGrammarQuiz(unit.id, 4);
      let st = h.peek('_grammarQuizState');
      must(st && st.questions.length >= 2, 'a quiz of at least 2 questions started');
      // The first multiple-choice question that has ANOTHER one after it.
      // Picking simply the first MC made this check a dice roll: a draw that
      // put the only MC last had nextGrammarQuestion() finish the quiz, the
      // state went null, and line "st.questions" below threw — one run in
      // several, on nothing the app did wrong.
      const mcs = st.questions.map((q, i) => (q.type !== 'arrangement' ? i : -1)).filter((i) => i >= 0);
      must(mcs.length >= 2, 'there are two multiple-choice questions to answer (got ' + mcs.length + ')');
      const mc = mcs[0];
      st.currentIdx = mc;
      h.sandbox.renderGrammarQuestion();
      const q = st.questions[mc];
      h.sandbox.answerGrammarQuestion(q.correct);
      let opts = h.el('grammarScreen').querySelectorAll('.grammar-option');
      mustEqual(opts.length, q.options.length, 'every option is on screen');
      must(opts[q.correct].classList.contains('correct'), 'the right answer must be marked correct');
      mustEqual(opts.filter((o) => o.classList.contains('wrong')).length, 0, 'nothing may be marked wrong when the child was right');
      // Now the same grader, given a wrong answer.
      h.sandbox.nextGrammarQuestion();
      st = h.peek('_grammarQuizState');
      must(st && st.questions, 'the quiz is still running after one answer');
      const mc2 = mcs[1];
      st.currentIdx = mc2;
      h.sandbox.renderGrammarQuestion();
      const q2 = st.questions[mc2];
      const bad = (q2.correct + 1) % q2.options.length;
      h.sandbox.answerGrammarQuestion(bad);
      opts = h.el('grammarScreen').querySelectorAll('.grammar-option');
      must(opts[bad].classList.contains('wrong'), 'a wrong answer must be marked wrong — a grader stuck on "correct" fails here');
      must(opts[q2.correct].classList.contains('correct'), 'and the right one must still be shown');
      h.sandbox.abandonGrammarQuiz();
      return 'unit "' + unit.name + '": right answer marked correct, wrong answer marked wrong';
    });

  await R.check('play-verbs-speed-challenge',
    'Động từ: chơi thử thách tốc độ, gõ đúng một động từ rồi gõ sai một động từ',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('speedChallengeScreen');
      h.sandbox.startSpeedChallenge(1);
      const ss = h.peek('speedState');
      must(ss && ss.currentVerbs.length > 1, 'a challenge with more than one verb started');
      const v = ss.currentVerbs[0];
      h.el('inputV2').value = v.v2.split('/')[0].trim();
      h.el('inputV3').value = v.v3.split('/')[0].trim();
      h.sandbox.submitSpeedAnswer();
      mustEqual(ss.correctCount, 1, 'the right forms must score');
      must(ss.score > 0, 'a correct verb must add points (got ' + ss.score + ')');
      mustEqual(ss.verbResults[0].correct, true, 'and be recorded as correct');
      must(h.el('speedFeedback').className.includes('correct'), 'the feedback must say correct');
      h.sandbox.nextSpeedQuestion();
      h.el('inputV2').value = 'zzzz'; h.el('inputV3').value = 'zzzz';
      h.sandbox.submitSpeedAnswer();
      mustEqual(ss.correctCount, 1, 'nonsense must NOT score');
      mustEqual(ss.verbResults[1].correct, false, 'and must be recorded as wrong');
      mustEqual(ss.streak, 0, 'a wrong answer must break the streak');
      must(h.el('speedFeedback').className.includes('wrong'), 'the feedback must say wrong');
      // Both forms have to be right. Half-right answers are the ones a lazy
      // grader lets through, so ask for each half on its own.
      const half = [];
      for (const [which, v2, v3] of [['V3 wrong', null, 'zzzz'], ['V2 wrong', 'zzzz', null]]) {
        h.sandbox.nextSpeedQuestion();
        const cur = ss.currentVerbs[ss.currentIndex];
        if (!cur) break;
        h.el('inputV2').value = v2 === null ? cur.v2.split('/')[0].trim() : v2;
        h.el('inputV3').value = v3 === null ? cur.v3.split('/')[0].trim() : v3;
        const scoreBefore = ss.score;
        h.sandbox.submitSpeedAnswer();
        const rec = ss.verbResults[ss.verbResults.length - 1];
        mustEqual(rec.correct, false, 'a half-right answer (' + which + ') must NOT be accepted');
        mustEqual(ss.score, scoreBefore, 'and must not score');
        half.push(which);
      }
      return v.v1 + ' → ' + v.v2 + ' accepted (+' + ss.score + '); "zzzz" rejected; half-right rejected ('
        + half.join(', ') + ')';
    });

  await R.check('play-phrases-answer-right-and-wrong',
    'Giới từ: luyện tập, chọn đúng rồi chọn sai',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('phrasesScreen'); await settle();
      h.sandbox.startPhrasesQuiz(6);
      const st = h.peek('_phrQuiz');
      must(st, 'a phrases practice started');
      const i1 = st.questions.findIndex((q) => !q.typed);
      must(i1 >= 0, 'there is a multiple-choice question');
      st.idx = i1; h.sandbox.renderPhrQuestion();
      const q = st.questions[i1];
      h.sandbox.answerPhrQuestion(q.correct);
      let opts = h.el('phrasesScreen').querySelectorAll('.grammar-option');
      must(opts[q.correct].classList.contains('correct'), 'the right preposition must be marked correct');
      mustEqual(opts.filter((o) => o.classList.contains('wrong')).length, 0, 'nothing is marked wrong when the child was right');
      const i2 = st.questions.findIndex((qq, i) => i > i1 && !qq.typed);
      must(i2 >= 0, 'there is a second multiple-choice question');
      st.idx = i2; h.sandbox.renderPhrQuestion();
      const q2 = st.questions[i2];
      const bad = (q2.correct + 1) % q2.options.length;
      h.sandbox.answerPhrQuestion(bad);
      opts = h.el('phrasesScreen').querySelectorAll('.grammar-option');
      must(opts[bad].classList.contains('wrong'), 'a wrong preposition must be marked wrong');
      // The paint is one grader; the SCORE is another. Answer a known mix and
      // read back what the session actually recorded.
      const choiceIdx = st.questions.map((qq, i) => (qq.typed || !Array.isArray(qq.options) ? -1 : i)).filter((i) => i >= 0);
      must(choiceIdx.length >= 2, 'the practice has multiple-choice questions to score');
      const wantRight = choiceIdx.slice(0, Math.ceil(choiceIdx.length / 2));
      st.answers = st.questions.map((qq, i) => {
        if (!choiceIdx.includes(i)) return null;
        return wantRight.includes(i) ? qq.correct : (qq.correct + 1) % qq.options.length;
      });
      const before = h.sandbox.phrasesHistory().length;
      h.sandbox.finishPhrasesQuiz();
      const session = h.sandbox.phrasesHistory()[0];
      mustEqual(h.sandbox.phrasesHistory().length, before + 1, 'finishing writes one session');
      mustEqual(session.score, wantRight.length,
        'the recorded score must count ONLY the right answers — a grader stuck on "correct" fails here');
      mustEqual(session.total, st.questions.length, 'out of every question asked');
      return 'right marked correct, wrong marked wrong, and the session scored '
        + session.score + '/' + session.total + ' (' + wantRight.length + ' answered right on purpose)';
    });

  await R.check('play-collocation-answer-right-and-wrong',
    'Collocation: luyện tập trong tab Phrases, chọn đúng rồi chọn sai',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('phrasesScreen'); await settle();
      must(h.sandbox.collocBank().length > 0, 'the collocation bank arrived (lazy, shares the Phrases screen)');
      h.sandbox.startCollocPractice(8);
      const st = h.peek('_colQuiz');
      must(st, 'a collocation practice started');
      const pick = (from) => st.questions.findIndex((q, i) => i > from && !q.followup && Array.isArray(q.options));
      const i1 = pick(-1);
      must(i1 >= 0, 'there is a multiple-choice collocation');
      st.idx = i1; h.sandbox.renderCollocQuestion();
      const q = st.questions[i1];
      h.sandbox.answerCollocChoice(q.correct);
      mustEqual(st.answers[i1].isCorrect, true, 'the right collocation must be graded correct');
      let opts = h.el('phrasesScreen').querySelectorAll('.grammar-option');
      must(opts[q.correct].classList.contains('correct'), 'and shown as correct');
      const i2 = pick(i1);
      must(i2 >= 0, 'there is a second multiple-choice collocation');
      st.idx = i2; h.sandbox.renderCollocQuestion();
      const q2 = st.questions[i2];
      const bad = (q2.correct + 1) % q2.options.length;
      h.sandbox.answerCollocChoice(bad);
      mustEqual(st.answers[i2].isCorrect, false, 'a wrong collocation must be graded wrong');
      opts = h.el('phrasesScreen').querySelectorAll('.grammar-option');
      must(opts[bad].classList.contains('wrong'), 'and shown as wrong');
      h.run('_colQuiz = null');
      return 'right answer marked correct, wrong answer marked wrong';
    });

  await R.check('play-wordform-answer-right-and-wrong',
    'Word form: luyện tập, chọn đúng rồi chọn sai, và điểm cuối buổi phải khớp',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('wordformScreen'); await settle();
      h.sandbox.startWordformQuiz(6);
      const st = h.peek('_wfQuiz');
      must(st, 'a word-form practice started');
      const i1 = st.questions.findIndex((q) => !q.followup && !q.typed && Array.isArray(q.options));
      must(i1 >= 0, 'there is a multiple-choice question');
      st.idx = i1; h.sandbox.renderWfQuestion();
      const q = st.questions[i1];
      h.sandbox.answerWfQuestion(q.correct);
      let opts = h.el('wordformScreen').querySelectorAll('.grammar-option');
      must(opts[q.correct].classList.contains('correct'), 'the right form must be marked correct');
      mustEqual(opts.filter((o) => o.classList.contains('wrong')).length, 0, 'nothing is marked wrong when the child was right');
      const i2 = st.questions.findIndex((qq, i) => i > i1 && !qq.followup && !qq.typed && Array.isArray(qq.options));
      must(i2 >= 0, 'there is a second multiple-choice question');
      st.idx = i2; h.sandbox.renderWfQuestion();
      const q2 = st.questions[i2];
      const bad = (q2.correct + 1) % q2.options.length;
      h.sandbox.answerWfQuestion(bad);
      opts = h.el('wordformScreen').querySelectorAll('.grammar-option');
      must(opts[bad].classList.contains('wrong'), 'a wrong form must be marked wrong');

      // Now play the WHOLE practice through the real tap handlers — base
      // questions alternately right and wrong, every understanding check right
      // — and hold the app to the score that implies.
      let expected = 0, answeredRight = 0, answeredWrong = 0, checks = 0;
      let flip = true;
      for (let i = 0; i < st.questions.length; i++) {
        const qq = st.questions[i];
        st.idx = i;
        if (st.answers[i] !== null) {                      // the two answered above
          if (st.answers[i].isCorrect) { expected++; answeredRight++; } else answeredWrong++;
          continue;
        }
        h.sandbox.renderWfQuestion();
        if (qq.followup) {
          for (const part of h.sandbox.wfFollowParts(qq)) { h.sandbox.answerWfFollowup(part, qq[part].correct); expected++; checks++; }
          continue;
        }
        const wantRight = (flip = !flip);
        if (qq.typed || !Array.isArray(qq.options)) {
          const input = h.el('wfTextInput');
          must(input, 'a typed question must offer a text box');
          input.value = wantRight ? (qq.answer || '') : 'zzz-not-a-word';
          h.sandbox.submitWfText();
        } else {
          h.sandbox.answerWfQuestion(wantRight ? qq.correct : (qq.correct + 1) % qq.options.length);
        }
        const graded = st.answers[i] && st.answers[i].isCorrect;
        mustEqual(!!graded, !!wantRight,
          'question ' + i + ' was answered ' + (wantRight ? 'RIGHT' : 'WRONG') + ' but graded ' + (graded ? 'correct' : 'wrong'));
        if (graded) { expected++; answeredRight++; } else answeredWrong++;
      }
      const before = h.sandbox.wordformHistory().length;
      h.sandbox.finishWordformQuiz();
      const session = h.sandbox.wordformHistory()[0];
      mustEqual(h.sandbox.wordformHistory().length, before + 1, 'finishing writes one session');
      mustEqual(session.score, expected,
        'the recorded score must count only what was actually right — a grader stuck on "correct" fails here');
      must(answeredWrong > 0, 'the run has to contain wrong answers for that to mean anything');
      return 'played ' + st.questions.length + ' screens (' + answeredRight + ' right, ' + answeredWrong
        + ' wrong, ' + checks + ' understanding checks) → recorded ' + session.score + '/' + session.total;
    });

  await R.check('play-rewrite-typed-right-and-wrong',
    'Rewrite: gõ đúng câu rồi gõ sai câu',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('rewriteScreen'); await settle();
      h.sandbox.startRewriteQuiz(4);
      const st = h.peek('_rwQuiz');
      must(st && st.questions.length >= 2, 'a rewrite practice of at least 2 questions started');
      const q = st.questions[0];
      const good = q.answer || (q.accept || [])[0];
      must(good, 'the first question has a model answer to type');
      h.el('rwTextInput').value = good;
      h.sandbox.submitRwText();
      must(st.answers[0] && st.answers[0].isCorrect === true, 'the model answer must be graded correct');
      h.sandbox.nextRwQuestion();
      h.el('rwTextInput').value = 'qqqq wrong sentence qqqq';
      h.sandbox.submitRwText();
      must(st.answers[1] && st.answers[1].isCorrect === false, 'nonsense must be graded wrong — a grader stuck on "correct" fails here');
      h.run('_rwQuiz = null');
      return 'model answer accepted, nonsense rejected';
    });

  await R.check('play-exam-start-answer-finish-score',
    'Đề thi: mở đề, trả lời, nộp bài, điểm được lưu lại',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('examScreen'); await settle();
      const exam = h.peek('EXAMS')[0];
      const before = h.sandbox.loadExamHistory().length;
      h.sandbox.startExam(exam.id);
      const s = h.peek('_examState');
      must(s, 'the exam started');
      must(h.sandbox.isExamActive(), 'the app knows an exam is running (that is what guards the nav)');
      const i1 = s.questions.findIndex((q) => q.type !== 'text');
      must(i1 >= 0, 'there is a multiple-choice question');
      s.idx = i1; h.sandbox.renderExamQuestion();
      h.sandbox.answerExamChoice(s.questions[i1].correct);
      mustEqual(s.answers[i1].isCorrect, true, 'the right answer must be graded correct');
      const opts = h.el('examScreen').querySelectorAll('.grammar-option');
      must(opts.length === 0 || opts[s.questions[i1].correct].classList.contains('correct'), 'and shown as correct');
      const i2 = s.questions.findIndex((q, i) => i > i1 && q.type !== 'text');
      must(i2 >= 0, 'there is a second multiple-choice question');
      s.idx = i2; h.sandbox.renderExamQuestion();
      const q2 = s.questions[i2];
      h.sandbox.answerExamChoice((q2.correct + 1) % q2.options.length);
      mustEqual(s.answers[i2].isCorrect, false, 'a wrong answer must be graded wrong');
      const answered = s.answers.filter((a) => a && a.isCorrect).length;
      h.sandbox.finishExam(false);
      const hist = h.sandbox.loadExamHistory();
      mustEqual(hist.length, before + 1, 'finishing must write one attempt to history');
      mustEqual(hist[0].examId, exam.id, 'the attempt names the exam that was taken');
      mustEqual(hist[0].score, answered, 'the recorded score is the number actually answered right');
      mustEqual(hist[0].total, exam.questions.length, 'out of the real question count');
      must(!h.sandbox.isExamActive(), 'the exam is over');
      return '"' + exam.title + '": ' + hist[0].score + '/' + hist[0].total + ' written to history';
    });

  await R.check('play-math-answer-right-and-wrong',
    'Toán: mở chương, trả lời đúng rồi trả lời sai',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('mathHubScreen'); await settle();
      const chapter = h.sandbox.mathChapters()[0];
      h.sandbox.startMathQuiz(chapter.num);
      const st = h.peek('_mathQuiz');
      must(st, 'a maths round started');
      const i1 = st.questions.findIndex((q) => !h.sandbox.mathIsTyped(q));
      must(i1 >= 0, 'there is a multiple-choice question');
      st.idx = i1; h.sandbox.renderMathQuestion();
      const q = st.questions[i1];
      h.sandbox.answerMathQuestion(q.correct);
      let opts = h.el('mathHubScreen').querySelectorAll('.grammar-option');
      must(opts[q.correct].classList.contains('correct'), 'the right answer must be marked correct');
      must(h.sandbox.mathIsCorrect(q, q.correct), 'and the grader must agree');
      const i2 = st.questions.findIndex((qq, i) => i > i1 && !h.sandbox.mathIsTyped(qq));
      must(i2 >= 0, 'there is a second multiple-choice question');
      st.idx = i2; h.sandbox.renderMathQuestion();
      const q2 = st.questions[i2];
      const bad = (q2.correct + 1) % q2.options.length;
      h.sandbox.answerMathQuestion(bad);
      opts = h.el('mathHubScreen').querySelectorAll('.grammar-option');
      must(opts[bad].classList.contains('wrong'), 'a wrong answer must be marked wrong');
      must(!h.sandbox.mathIsCorrect(q2, bad), 'and the grader must agree it is wrong');
      h.run('_mathQuiz = null');
      return chapter.title + ': right answer marked correct, wrong answer marked wrong';
    });

  await R.check('play-toan4-pre-paper',
    'Toán 4: làm trọn một đề Pre — chọn đáp án, xem lời giải, khoá thanh dưới',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 0 });
      h.sandbox.switchScreen('mathHubScreen'); await settle();
      h.sandbox.openMathSection('toan4');
      h.sandbox.startMath4Pre();
      const st = h.peek('_mathQuiz');
      must(st, 'the Pre paper did not open');
      mustEqual(st.questions.length, 10, 'a Pre paper is ten questions');
      mustEqual(st.questions.map((q) => q.t).join(''), '1122334455', 'two of each dạng, in đề order');
      const nav = h.el('bottomNav');
      mustEqual(nav.style.display, 'none', 'the bottom bar must be hidden while a paper is open');
      // Sit it the way a child does: one tap among four large choices, read
      // the explanation from the source bank, then move to the next question.
      for (let i = 0; i < 10; i++) {
        const q = h.sandbox.mathCurrentQuestion();
        must(q, 'ran out of questions at ' + i);
        must(!h.sandbox.mathHasAnswerParts(q), q.id + ' still renders input boxes');
        mustEqual(q.options.length, 4, q.id + ' must have four answers');
        mustEqual(new Set(q.options).size, 4, q.id + ' repeats an answer');
        let opts = h.el('mathHubScreen').querySelectorAll('.grammar-option');
        mustEqual(opts.length, 4, q.id + ' did not draw four buttons');
        h.sandbox.answerMathQuestion(q.correct);
        opts = h.el('mathHubScreen').querySelectorAll('.grammar-option');
        must(opts[q.correct].classList.contains('correct'), q.id + ' did not mark the right answer');
        must(h.el('mathHubScreen').querySelector('.grammar-explanation'), q.id + ' did not show its explanation');
        h.sandbox.nextMathQuestion();
      }
      must(!h.sandbox.isMathQuizActive(), 'the paper is over');
      mustEqual(nav.style.display, '', 'the bottom bar must come back');
      const hist = h.peek('appState').mathHistory;
      mustEqual(hist[0].score, 10, 'a perfect sitting scores 10');
      mustEqual(hist[0].grade, 4, 'the run must be filed as Toán 4');
      mustEqual(hist[0].g4set, 'pre', 'and carry what the daily task matches on');
      must(h.peek('appState').coins >= 70,
        '10 × 2 xu plus the 50-xu perfect bonus (pet combo may add more)');
      must(h.el('mathHubScreen').textContent.includes('+50 xu'),
        'the result must name the exact 50-xu perfect bonus');
      return '10/10 selected from four answers, at least +70 xu, filed as ' + hist[0].label;
    });

  await R.check('play-word-hunt-find-a-word',
    'Săn chữ: tìm đúng một từ trong lưới, và một lựa chọn bừa bị từ chối',
    async () => {
      const h = mountApp();
      const vocab = h.peek('ieltsVocabulary');
      const srs = {};
      vocab.filter((w) => /^[a-z]{3,8}$/i.test(w.en)).slice(0, 12)
        .forEach((w) => { srs[w.en] = { interval: 1, ease: 2.5, repetitions: 1, nextReview: Date.now(), lastReview: Date.now() }; });
      loginTestUser(h, { coins: 100, points: 500, lessonsCompleted: 5, srs });
      h.sandbox.openWordHunt();
      const hs = h.peek('huntState');
      must(hs && hs.words.length > 0, 'a hunt started with words to find');
      const grid = hs.grid;
      const target = hs.words[0].en.toUpperCase();
      const N = grid.length;
      const dirs = [[0, 1], [1, 0], [1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1], [-1, 1]];
      let cells = null;
      for (let r = 0; r < N && !cells; r++) {
        for (let c = 0; c < N && !cells; c++) {
          for (const [dr, dc] of dirs) {
            const cs = []; let ok = true;
            for (let k = 0; k < target.length; k++) {
              const rr = r + dr * k, cc = c + dc * k;
              if (rr < 0 || cc < 0 || rr >= N || cc >= N || grid[rr][cc] !== target[k]) { ok = false; break; }
              cs.push({ r: rr, c: cc });
            }
            if (ok) { cells = cs; break; }
          }
        }
      }
      must(cells, '"' + target + '" was never actually placed in the grid it must be found in');
      const pointsBefore = h.state().points;
      hs.selectedCells = cells;
      h.sandbox.checkHuntSelection();
      mustEqual(h.peek('huntState').foundWords.length, 1, 'tracing the word must find it');
      mustEqual(h.peek('huntState').foundWords[0], hs.words[0].en, 'and it must be the word that was traced');
      must(h.state().points > pointsBefore, 'finding a word must score (' + pointsBefore + ' → ' + h.state().points + ')');
      const after = h.state().points;
      const hs2 = h.peek('huntState');
      hs2.selectedCells = [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }];
      h.sandbox.checkHuntSelection();
      const stillFound = h.peek('huntState').foundWords.length;
      must(stillFound <= 1, 'a random drag must not be accepted as a find');
      mustEqual(h.state().points, after, 'and must not score');
      return 'found "' + target + '" (+' + (after - pointsBefore) + ' points); a random three-cell drag scored nothing';
    });

  await R.check('play-pet-battle-friend-list',
    'Đấu trường: mở đấu trường, thấy danh sách bạn bè',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100, dogLevel: 4 });
      stubServer(h, (p) => {
        if (p === 'battle') return { ok: true, data: { ammo: 2, readyAt: 0, stats: { wins: 3, losses: 1 }, battle: null } };
        return { ok: false, data: null };
      });
      h.run("_friendsData = { friends: [{userId:22,username:'Oleole'},{userId:33,username:'Mai'}], incoming: [], outgoing: [] }");
      h.sandbox.openPetBattle();
      await settle(8);
      const el = h.el('petBattleScreen');
      const rows = el.querySelectorAll('.pb-friend');
      mustEqual(rows.length, 2, 'one challenge row per friend');
      const text = squash(el.textContent);
      must(text.includes('Oleole') && text.includes('Mai'), 'both friends are named');
      must(rows.every((r) => /challengePetFriend\(\d+\)/.test(r.getAttribute('onclick') || '')),
        'each row is wired to a real challenge, not a dead button');
      return '2 friend rows, each wired to challengePetFriend()';
    });

  await R.check('play-night-raid-target-list',
    'Cướp Đêm: mở nhà của bé, rồi mở danh sách nhà để cướp',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 2000, dogLevel: 4 });
      stubServer(h, (p) => {
        if (p === 'night-raid/home') return { ok: true, data: { home: { coins: 2000, dogLevel: 4, layout: null } } };
        if (p === 'night-raid/friends') return { ok: true, data: {
          me: { lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 3,
          friends: [{ userId: 22, name: 'Oleole', homeLevel: 2, difficulty: 'Dễ' },
                    { userId: 33, name: 'Mai', homeLevel: 3, difficulty: 'Vừa' }] } };
        return { ok: false, data: { error: 'not stubbed' } };
      });
      h.sandbox.openNightRaid();
      await settle(10);
      const el = h.el('nightRaidScreen');
      must(squash(el.textContent).includes('DAM'), 'the raid home shows the attack chip');
      await h.peek('NightRaid').showLiveTargets();
      await settle(8);
      const text = squash(el.textContent);
      const friendRows = el.querySelectorAll('.nr-friend-list li, .nr-friend-row');
      must(text.includes('Oleole') && text.includes('Mai'), 'both friends appear as houses to raid');
      must(friendRows.length >= 2, 'one row per friend (' + friendRows.length + ' found)');
      must(text.includes('3 lượt còn lại'), 'the remaining raid tickets come from the server');
      return '2 real friend houses listed, 3 tickets shown';
    });

  // ===== the wrong-answer paths that carry state =========================

  await R.check('retry-drill-owes-back-a-missed-question',
    'Luyện lại: làm sai một câu thì câu đó bị nợ lại',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('wordformScreen'); await settle();
      mustEqual(h.sandbox.retryCount('wf'), 0, 'the child starts owing nothing');
      h.sandbox.startWordformQuiz(6);
      const st = h.peek('_wfQuiz');
      must(st, 'a practice started');
      // Answer every multiple-choice question WRONG on purpose.
      st.answers = st.questions.map((q) => (Array.isArray(q.options) && !q.typed ? (q.correct + 1) % q.options.length : null));
      st.idx = st.questions.length - 1;
      h.sandbox.finishWordformQuiz();
      const owed = h.sandbox.retryCount('wf');
      must(owed > 0, 'missing questions must leave a debt, but retryCount(wf) is ' + owed);
      return owed + ' question(s) owed back after a deliberately bad practice';
    });

  await R.check('retry-drill-gate-blocks-then-clears',
    'Luyện lại: chưa trả nợ thì không mở bài mới; trả xong thì mở lại được',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('wordformScreen'); await settle();
      const bank = h.sandbox.wordformBank();
      const owed = bank.slice(0, 2);
      h.sandbox.retryAdd('wf', owed);
      mustEqual(h.sandbox.retryCount('wf'), 2, 'two questions are owed');

      // The gate: asking for a new practice must open the drill instead.
      h.sandbox.startWordformQuiz(10);
      must(!h.peek('_wfQuiz'), 'a new practice must NOT start while a debt is owed');
      must(h.sandbox.isRetryDrillActive(), 'the drill must open instead');
      mustEqual(h.sandbox.retryDrillKey(), 'wf', 'and it must be the word-form drill');

      const cfg = h.sandbox.retryCfg('wf');
      // A wrong answer keeps the debt.
      const first = h.peek('_retryDrill').queue[0];
      h.el('retryInput').value = 'definitely-not-the-answer';
      h.sandbox.submitRetryAnswer();
      mustEqual(h.peek('_retryDrill').answered.ok, false, 'a wrong answer in the drill is marked wrong');
      mustEqual(h.sandbox.retryCount('wf'), 2, 'and the debt does not shrink');
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
      mustEqual(h.sandbox.retryCount('wf'), 0, 'answering everything owed must clear the debt');
      must(!h.sandbox.isRetryDrillActive(), 'and close the drill');

      // The gate is open again.
      h.sandbox.startWordformQuiz(6);
      must(h.peek('_wfQuiz'), 'a new practice must start once nothing is owed');
      return 'owed 2 → wrong answer kept the debt → 2 right answers cleared it → practice reopened (first owed: '
        + cfg.idOf(first) + ')';
    });

  await R.check('retry-drill-debt-survives-a-reload',
    'Luyện lại: nợ vẫn còn sau khi đóng và mở lại ứng dụng',
    async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100 });
      h.sandbox.switchScreen('wordformScreen'); await settle();
      h.sandbox.retryAdd('wf', h.sandbox.wordformBank().slice(0, 3));
      mustEqual(h.sandbox.retryCount('wf'), 3, 'three owed before the reload');
      const saved = h.store['flashlingo-user-' + TEST_USER];
      must(saved && JSON.parse(saved).wfRetry && JSON.parse(saved).wfRetry.length === 3,
        'the debt must be written to storage, not just held in memory');
      // A genuine cold start: a second mount reading the same localStorage.
      const h2 = mountApp({ storage: Object.assign({}, h.store) });
      h2.sandbox.loginUser(TEST_USER);
      h2.sandbox.switchScreen('wordformScreen'); await settle();
      mustEqual(h2.sandbox.retryCount('wf'), 3, 'the debt must still be owed after a reload');
      h2.sandbox.startWordformQuiz(10);
      must(!h2.peek('_wfQuiz'), 'and must still block a new practice');
      return '3 owed questions survived a full remount and still gate the tab';
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
      h.sandbox.switchScreen('grammarScreen'); await settle();
      h.sandbox.startGrammarQuiz(h.peek('GRAMMAR_UNITS')[0].id, 5);
      must(h.sandbox.isGrammarQuizActive(), 'a quiz is running');
      h.sandbox.__confirmAnswer = false;                      // the child taps "stay"
      h.sandbox.__confirmLog.length = 0;
      const left = h.sandbox.switchScreen('homeScreen');
      mustEqual(left, false, 'tapping another tab must not leave the quiz when the child says no');
      must(h.sandbox.__confirmLog.length === 1, 'and it must actually have asked (' + h.sandbox.__confirmLog.length + ' prompts)');
      must(h.sandbox.isGrammarQuizActive(), 'the quiz must still be running');
      h.sandbox.__confirmAnswer = true;                       // now the child says yes
      mustEqual(h.sandbox.switchScreen('homeScreen'), true, 'saying yes must leave');
      must(!h.sandbox.isGrammarQuizActive(), 'and must end the quiz');
      return 'asked before leaving; Cancel kept the quiz, OK ended it';
    });

  // ===== a claim the screen makes that the data must back ================

  await R.check('verbs-start-button-tells-the-truth',
    'Động từ: nút "All N verbs" phải khớp số động từ thật trong dữ liệu',
    async () => {
      const h = mountApp();
      loginTestUser(h, {});
      // Rendered, not read out of index.html. The number used to be typed into
      // the markup — it said 144 while the bank held 257, because the bank grew
      // and the label did not. It is derived now, so this has to render the
      // screen to see what a child would actually be promised.
      h.sandbox.renderSpeedChallenge();
      const label = squash(h.el('speedChallengeScreen').textContent);
      const m = label.match(/All\s+(\d+)\s+verbs/i);
      must(m, 'the Start button no longer states how many verbs there are');
      const claimed = Number(m[1]);
      const actual = h.peek('irregularVerbs').length;
      mustEqual(claimed, actual, 'the button promises ' + claimed + ' verbs but irregularVerbs holds ' + actual);
      return 'button says ' + claimed + ', bank holds ' + actual;
    });

  // What this layer CANNOT see. Named rather than left as a gap, because the
  // dangerous kind of coverage is the kind nobody knows is missing. Nothing
  // below is asserted anywhere in this file, so no check quietly passes for it.
  const limitations = [
    'Pixels and layout: the DOM shim does no layout, so overlap, clipping, z-order and off-screen buttons are invisible here. They belong in a browser.',
    'Pointer gestures: Word Hunt is driven through checkHuntSelection() with real grid cells rather than a drag across .wh-cell nodes, and the Night Raid builder\'s drag-and-drop is not driven at all.',
    'Canvas and Phaser: the pet-battle fight, the Night Raid march and the maths board paint into a stubbed 2D context, so their artwork is never checked — only that painting does not throw.',
    'Timers: setTimeout/setInterval are recorded, not fired, so the speed-challenge countdown, the exam auto-submit at 0:00 and the lobby polls are not exercised.',
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
