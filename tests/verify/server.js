// tests/verify/server.js — "is any server feature broken?", answered with
// evidence, independently of tests/*.test.js.
//
// Nothing here is hardcoded from a list somebody maintains by hand: the route
// tree is walked on disk at run time, every exported handler is called, and
// the SQL those handlers actually contain is re-parsed against the schema the
// harness builds. The unit suite was written by the same hands that wrote the
// bugs; this file only trusts what it can execute.
//
//   verifyServer() -> { checks: [{ id, feature, ok, detail }], routes: [...], ms }
//
// It prints nothing. The runner prints.
'use strict';

const fs = require('fs');
const path = require('path');
const { createWorld, loadModule } = require('../pages-harness');

const ROOT = path.join(__dirname, '..', '..');
const API_DIR = path.join(ROOT, 'functions', 'api');
const METHODS = ['Get', 'Post', 'Put', 'Delete'];

// ---------------------------------------------------------------------------
// policy exceptions (routes that CANNOT answer 401 to an anonymous caller)
// ---------------------------------------------------------------------------
// /api/version is the deploy probe scripts/deploy.sh polls; login and register
// are the two doors an account is created and entered through, so neither can
// demand a token. They are named here as POLICY, not as the route list — the
// tree is still enumerated from disk, and any OTHER route that answers 200
// without a token fails loudly below. `policy-exceptions-exist` fails if one
// of these files is ever renamed, so the exemption cannot outlive its route.
const PUBLIC_OK = new Set(['functions/api/version.js']);
const PUBLIC_4XX = new Set(['functions/api/login.js', 'functions/api/register.js']);

// ---------------------------------------------------------------------------
// human names — what a parent would call the thing that just broke
// ---------------------------------------------------------------------------
const AREA = [
  ['/api/night-raid/', 'Cướp Đêm'],
  ['/api/battle/', 'Đấu Thú Cưng'],
  ['/api/math-fight/', 'Đấu Toán'],
  ['/api/daily-task/', 'Nhiệm vụ hằng ngày'],
  ['/api/me/daily-tasks', 'Nhiệm vụ hằng ngày'],
  ['/api/ghost-offering', 'Cúng Cô Hồn'],
  ['/api/coins', 'Ví xu'],
  ['/api/friends', 'Bạn bè'],
  ['/api/admin/', 'Trang quản trị'],
  ['/api/me/wins', 'Tủ cúp'],
  ['/api/me/attempts', 'Lịch sử làm đề'],
  ['/api/login', 'Đăng nhập'],
  ['/api/register', 'Tạo tài khoản'],
  ['/api/version', 'Phiên bản app'],
  ['/api/assets', 'Kho đồ của bé'],
  ['/api/activity', 'Đồng bộ bài học'],
  ['/api/attempts', 'Đồng bộ bài thi'],
  ['/api/skills', 'Đồng bộ kỹ năng'],
];
const VERB = { GET: 'xem', POST: 'gửi', PUT: 'lưu', DELETE: 'xoá' };

function areaFor(url) {
  for (const [prefix, name] of AREA) if (url.startsWith(prefix)) return name;
  return url;
}
function featureFor(url, method) {
  const tail = url.replace(/^\/api\//, '').split('/').slice(1).join('/');
  const area = areaFor(url);
  return area === url ? `${url} (${method})` : `${area}: ${VERB[method]}${tail ? ' ' + tail : ''}`;
}
function slugFor(url) {
  return url.replace(/^\//, '').replace(/[^A-Za-z0-9]+/g, '-');
}

// ---------------------------------------------------------------------------
// 1. route inventory, walked from disk
// ---------------------------------------------------------------------------
function walkRoutes(dir, rel) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('_')) continue;               // Pages never routes these
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) { out.push(...walkRoutes(abs, rel + '/' + name)); continue; }
    if (!name.endsWith('.js')) continue;
    const base = name.slice(0, -3);
    out.push({
      file: path.relative(ROOT, abs),
      url: base === 'index' ? rel : rel + '/' + base,
    });
  }
  return out;
}

// Every .js under functions/api, including the _-prefixed helpers — that is
// where most of the SQL the handlers run actually lives.
function allApiSources(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) { out.push(...allApiSources(abs)); continue; }
    if (name.endsWith('.js')) out.push(path.relative(ROOT, abs));
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. a JS lexer just wide enough to find SQL literals safely
// ---------------------------------------------------------------------------
function skipString(src, i) {
  const n = src.length, q = src[i];
  let j = i + 1;
  if (q === '`') {
    while (j < n) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`') return j + 1;
      if (src[j] === '$' && src[j + 1] === '{') {
        j += 2;
        let depth = 1;
        while (j < n && depth > 0) {
          const c = src[j];
          if (c === '\\') { j += 2; continue; }
          if (c === '"' || c === "'" || c === '`') { j = skipString(src, j); continue; }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          j++;
        }
        continue;
      }
      j++;
    }
    return n;
  }
  while (j < n) {
    if (src[j] === '\\') { j += 2; continue; }
    if (src[j] === q) return j + 1;
    if (src[j] === '\n') return j;               // unterminated — bail, don't hang
    j++;
  }
  return n;
}

const REGEX_PREV = new Set('(,=:[!&|?{};+-*%~^<>'.split('').concat(['']));
function skipRegex(src, i) {
  const n = src.length;
  let j = i + 1, klass = false;
  while (j < n) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; }
    if (c === '\n') return i + 1;                // not a regex after all
    if (klass) { if (c === ']') klass = false; }
    else if (c === '[') klass = true;
    else if (c === '/') { j++; while (j < n && /[a-z]/.test(src[j])) j++; return j; }
    j++;
  }
  return n;
}

// code[i] === 1 means index i is executable JS, not a string/comment/regex.
function lexSource(src) {
  const n = src.length;
  const code = new Uint8Array(n).fill(1);
  const strings = new Map();                     // start index -> { start, end, quote }
  let i = 0, prev = '';
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      const s = i; while (i < n && src[i] !== '\n') i++; code.fill(0, s, i); continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const s = i; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i = Math.min(n, i + 2); code.fill(0, s, i); continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const e = skipString(src, i);
      strings.set(i, { start: i, end: e, quote: c });
      code.fill(0, i, e); i = e; prev = c; continue;
    }
    if (c === '/' && REGEX_PREV.has(prev)) {
      const e = skipRegex(src, i); code.fill(0, i, e); i = e; prev = '/'; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return { code, strings };
}

function decodeLiteral(raw) {
  const body = raw.slice(1, raw.length - 1);
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (m, esc) => {
    switch (esc[0]) {
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '\r';
      case '0': return '\0';
      case 'u': case 'x': return m;              // leave as-is; never appears inside SQL here
      default: return esc;                       // \\ \' \" \` \$ …
    }
  });
}

// The literal chunks of a template, i.e. everything OUTSIDE every ${…}.
function templateChunks(raw) {
  const body = raw.slice(1, raw.length - 1);
  const out = [];
  let buf = '', i = 0;
  while (i < body.length) {
    if (body[i] === '\\') { buf += body.slice(i, i + 2); i += 2; continue; }
    if (body[i] === '$' && body[i + 1] === '{') {
      out.push(buf); buf = '';
      i += 2;
      let depth = 1;
      while (i < body.length && depth > 0) {
        const c = body[i];
        if (c === '\\') { i += 2; continue; }
        if (c === '"' || c === "'" || c === '`') { i = skipString(body, i); continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        i++;
      }
      continue;
    }
    buf += body[i]; i++;
  }
  out.push(buf);
  return out.map(chunk => decodeLiteral('`' + chunk + '`'));
}

// Walk one expression from index `j`, splitting it into string literals
// (`pieces`) and the executable glue between them (`gaps`). Stops on the first
// `stop` character seen at bracket depth 0.
function collectExpr(src, code, strings, j, stop) {
  const pieces = [], gaps = [];
  let depth = 0, gapStart = j;
  while (j < src.length) {
    const span = strings.get(j);
    if (span) { gaps.push(src.slice(gapStart, j)); pieces.push(span); j = span.end; gapStart = j; continue; }
    if (!code[j]) { j++; continue; }              // comment / regex
    const c = src[j];
    if (depth === 0 && c === stop) break;
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
    j++;
  }
  gaps.push(src.slice(gapStart, j));
  return { pieces, gaps, end: j };
}

function fragsOf(src, pieces) {
  const out = [];
  for (const p of pieces) {
    const raw = src.slice(p.start, p.end);
    if (p.quote === '`') out.push(...templateChunks(raw));
    else out.push(decodeLiteral(raw));
  }
  return out;
}

// Every `.prepare(<expr>)` in a file, classified literal vs dynamic.
function prepareSites(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { code, strings } = lexSource(src);
  const sites = [];
  const re = /\.prepare\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    if (!code[m.index]) continue;
    const open = m.index + m[0].length - 1;
    const { pieces, gaps } = collectExpr(src, code, strings, open + 1, null);
    const line = src.slice(0, m.index).split('\n').length;
    const glue = gaps.join('').replace(/\s+/g, '');
    const hasInterp = pieces.some(p => p.quote === '`' && /\$\{/.test(src.slice(p.start, p.end)));
    const literal = !hasInterp && /^\+*$/.test(glue) && pieces.length > 0;
    const where = `${file}:${line}`;
    if (literal) {
      sites.push({ where, file, line, kind: 'literal', sql: pieces.map(p => decodeLiteral(src.slice(p.start, p.end))).join('') });
      continue;
    }
    let frags = fragsOf(src, pieces);
    // `env.DB.prepare(sql)` — the statement is built into a local a few lines
    // up. Follow the one hop so those sites get fragments to match on instead
    // of silently having none.
    if (!pieces.length) {
      const ident = glue.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(ident)) {
        const decl = new RegExp('\\b(?:const|let|var)\\s+' + ident + '\\s*=', 'g');
        let d;
        while ((d = decl.exec(src))) {
          if (!code[d.index]) continue;
          const init = collectExpr(src, code, strings, d.index + d[0].length, ';');
          const got = fragsOf(src, init.pieces);
          if (got.length && SQL_HEAD.test(got[0])) { frags = got; break; }
        }
      }
    }
    sites.push({ where, file, line, kind: 'dynamic', frags });
  }
  return sites;
}

const SQL_HEAD = /^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|CREATE|PRAGMA|WITH)\b/i;
const norm = s => String(s).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// helpers shared by the exercise phases
// ---------------------------------------------------------------------------
function newWorld(seenSql) {
  const world = createWorld();
  const orig = world.env.DB.prepare.bind(world.env.DB);
  world.env.DB.prepare = sql => { seenSql.add(String(sql)); return orig(sql); };
  return world;
}

async function hit(world, handler, o) {
  try {
    const r = await world.call(handler, o);
    return { status: r.status, data: r.data, threw: null };
  } catch (e) {
    return { status: 500, data: null, threw: String((e && e.stack) || e) };
  }
}

const call = (world, handler, method, url, token, body) =>
  hit(world, handler, { method, url, token, body: method === 'GET' ? undefined : (body || {}) });

function sqlTime(ms) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 19); }

function befriend(world, a, b, daysAgo) {
  const when = sqlTime(Date.now() - daysAgo * 86400000);
  world.db.prepare(
    "INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at) VALUES (?,?,'accepted',?,?)"
  ).run(a.uid, b.uid, when, when);
}

const grantsOf = (world, uid) =>
  world.db.prepare('SELECT amount FROM coin_grants WHERE user_id=?').all(uid)
    .reduce((sum, r) => sum + Number(r.amount), 0);
const allGrants = world =>
  world.db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM coin_grants').get().s;

async function seedHome(world, user, o) {
  const home = loadModule('functions/api/night-raid/home.js');
  const r = await hit(world, home.onRequestPut, {
    method: 'PUT', url: '/api/night-raid/home', token: user.token,
    body: {
      layout: { cells: [], soldiers: 0, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: 'stone-keep', coins: o.coins == null ? 800 : o.coins,
    },
  });
  if (o.soldiers) {
    const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid);
    const layout = JSON.parse(row.layout_json);
    layout.soldiers = o.soldiers;
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?')
      .run(JSON.stringify(layout), user.uid);
  }
  return r;
}
const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

// ---------------------------------------------------------------------------
// verifyServer
// ---------------------------------------------------------------------------
async function verifyServer() {
  const started = Date.now();
  const checks = [];
  const add = (id, feature, ok, detail) => { checks.push({ id, feature, ok, detail: String(detail) }); };
  const seenSql = new Set();

  // Handlers log through console; keep the runner's output clean but keep the
  // lines so a failing check can quote them.
  const logged = [];
  const realConsole = {};
  for (const level of ['log', 'warn', 'error', 'info', 'debug']) {
    realConsole[level] = console[level];
    console[level] = (...args) => { logged.push(level + ': ' + args.map(String).join(' ')); };
  }
  const drainLogs = () => { const out = logged.slice(); logged.length = 0; return out; };

  try {
    // --- phase 1: what routes exist, and what do they export? --------------
    const routes = walkRoutes(API_DIR, '/api');
    for (const r of routes) {
      let mod = null, loadErr = null;
      try { mod = loadModule(r.file); } catch (e) { loadErr = String((e && e.message) || e); }
      r.methods = [];
      if (mod) for (const m of METHODS) if (typeof mod['onRequest' + m] === 'function') r.methods.push(m.toUpperCase());
      r.handlers = mod;
      const id = 'route-exports.' + slugFor(r.url);
      if (loadErr) add(id, featureFor(r.url, 'GET'), false, `${r.file} does not even load: ${loadErr}`);
      else if (!r.methods.length) add(id, featureFor(r.url, 'GET'), false,
        `${r.file} is routed at ${r.url} but exports no onRequestGet/Post/Put/Delete — every call to it is a 405`);
      else add(id, featureFor(r.url, r.methods[0]), true, `${r.url} → ${r.methods.join(', ')} (${r.file})`);
    }
    add('route-inventory', 'Toàn bộ API', routes.length >= 40,
      `${routes.length} routed files under functions/api, ` +
      `${routes.reduce((n, r) => n + r.methods.length, 0)} exported handlers (walked from disk, not a list)`);

    for (const f of [...PUBLIC_OK, ...PUBLIC_4XX]) {
      add('policy-exception-exists.' + slugFor(f), areaFor('/api/' + path.basename(f, '.js')),
        routes.some(r => r.file === f),
        `${f} is exempted from the "must answer 401 without a token" rule; the exemption must not outlive the route it names`);
    }

    // --- phase 2: no token, no data ---------------------------------------
    const anon = newWorld(seenSql);
    const FORGED = 'ZXlKMWFXUWlPakY5.bm90LWEtc2lnbmF0dXJl';
    for (const r of routes) {
      for (const method of r.methods) {
        const h = r.handlers['onRequest' + method[0] + method.slice(1).toLowerCase()];
        const bare = await call(anon, h, method, r.url, null, {});
        const forged = await call(anon, h, method, r.url, FORGED, {});
        const logs = drainLogs();
        const id = `unauth.${method.toLowerCase()}.${slugFor(r.url)}`;
        const feature = featureFor(r.url, method);
        const seen = `no-token=${bare.status}, forged-token=${forged.status}`;
        if (PUBLIC_OK.has(r.file)) {
          const v = bare.data && bare.data.version;
          add(id, feature, bare.status === 200 && /^\d+\.\d+\.\d+$/.test(String(v)),
            `public by design (deploy probe): ${bare.status} version=${JSON.stringify(v)}`);
          continue;
        }
        if (PUBLIC_4XX.has(r.file)) {
          const ok = bare.status >= 400 && bare.status < 500 && forged.status >= 400 && forged.status < 500;
          add(id, feature, ok,
            ok ? `public by necessity, refuses an empty body: ${seen}`
               : `a door route must still refuse an empty/forged request: ${seen}${bare.threw ? ' THREW ' + bare.threw : ''}`);
          continue;
        }
        const both = [bare, forged];
        const bad5xx = both.find(x => x.status >= 500);
        const bad200 = both.find(x => x.status >= 200 && x.status < 300);
        const wrong = both.find(x => x.status !== 401 && x.status !== 403);
        if (bad5xx) add(id, feature, false, `EXPLODES for an anonymous caller (${seen})${bad5xx.threw ? ': ' + bad5xx.threw : ''} ${logs.join(' | ')}`);
        else if (bad200) add(id, feature, false, `ANSWERS A STRANGER: ${seen} — ${JSON.stringify(bad200.data).slice(0, 200)}`);
        else if (wrong) add(id, feature, false, `must answer 401/403 without a token, answered ${seen}`);
        else add(id, feature, true, `refused: ${seen}`);
      }
    }

    // --- phase 3: a real token, on a real database -------------------------
    // Four personas across two flag states, so a route that is gated on
    // users.allow_bot or the math_fight app flag is genuinely entered rather
    // than bouncing off its own 403.
    const w = newWorld(seenSql);
    const kid = await w.createUser({ username: 'Bé Thường' });
    const bot = await w.createUser({ username: 'Bé QA', allowBot: true });
    const boss = await w.createUser({ username: 'Bố', role: 'admin' });
    const personas = [['plain', kid], ['allow_bot', bot], ['admin', boss]];

    const statuses = new Map();                   // "METHOD url" -> { persona: status }
    const runSweep = async (label, list) => {
      for (const r of routes) {
        for (const method of r.methods) {
          const h = r.handlers['onRequest' + method[0] + method.slice(1).toLowerCase()];
          const key = method + ' ' + r.url;
          if (!statuses.has(key)) statuses.set(key, {});
          for (const [name, user] of list) {
            const res = await call(w, h, method, r.url, user.token, {});
            statuses.get(key)[label + ':' + name] = res.status;
            if (res.status >= 500) statuses.get(key).boom = (res.threw || JSON.stringify(res.data) || '5xx') + ' ' + drainLogs().join(' | ');
          }
          drainLogs();
        }
      }
    };
    await runSweep('flagOff', personas);
    w.db.prepare("INSERT INTO app_flags(key,value,updated_at,updated_by) VALUES('math_fight',1,?,0) " +
      'ON CONFLICT(key) DO UPDATE SET value=1').run(Date.now());
    await runSweep('flagOn', [['allow_bot', bot]]);

    let flagFlips = [];
    for (const r of routes) {
      for (const method of r.methods) {
        const key = method + ' ' + r.url;
        const s = statuses.get(key);
        const id = `auth.${method.toLowerCase()}.${slugFor(r.url)}`;
        const feature = featureFor(r.url, method);
        const shown = Object.entries(s).filter(([k]) => k !== 'boom')
          .map(([k, v]) => `${k}=${v}`).join(' ');
        if (s.boom) { add(id, feature, false, `5xx with a valid token: ${shown} — ${String(s.boom).slice(0, 300)}`); continue; }
        const opened = Object.entries(s).some(([k, v]) => k !== 'boom' && v !== 403);
        if (!opened) { add(id, feature, false, `every persona was refused 403 — the route was never actually entered: ${shown}`); continue; }
        add(id, feature, true, `no 5xx; ${shown}`);
        if (s['flagOff:allow_bot'] === 403 && s['flagOn:allow_bot'] !== 403) flagFlips.push(`${key} 403→${s['flagOn:allow_bot']}`);
      }
    }
    add('feature-flag.math_fight', 'Đấu Toán: công tắc bật/tắt', flagFlips.length > 0,
      flagFlips.length
        ? `the math_fight app flag really opens: ${flagFlips.join(', ')}`
        : 'no route changed behaviour when app_flags.math_fight was switched on — either the flag is dead or the sweep never reached the gated routes');
    const publicRaid = routes.flatMap(r => r.methods.map(m => [m + ' ' + r.url, statuses.get(m + ' ' + r.url)]))
      .filter(([key]) => key.includes(' /api/night-raid/'));
    const gatedRaid = publicRaid.filter(([, s]) => s && s['flagOff:plain'] === 403).map(([key]) => key);
    add('feature.night-raid-global', 'Cướp Đêm: mở cho mọi bé', publicRaid.length > 0 && gatedRaid.length === 0,
      gatedRaid.length
        ? `normal children are still blocked from: ${gatedRaid.join(', ')}`
        : `all ${publicRaid.length} Night Raid route(s) enter normally for a signed-in child without allow_bot`);

    // --- phase 4: the money paths -----------------------------------------
    await moneyChecks(add, seenSql, drainLogs);

    // --- phase 5: schema drift --------------------------------------------
    schemaChecks(add, seenSql);
    drainLogs();

    return { checks, routes: routes.map(r => ({ file: r.file, url: r.url, methods: r.methods })), ms: Date.now() - started };
  } finally {
    for (const level of Object.keys(realConsole)) console[level] = realConsole[level];
  }
}

// ---------------------------------------------------------------------------
// money: the paths that must never regress
// ---------------------------------------------------------------------------
async function moneyChecks(add, seenSql, drainLogs) {
  const NR = 'Cướp Đêm';
  const start = loadModule('functions/api/night-raid/start.js');
  const finish = loadModule('functions/api/night-raid/finish.js');
  const coins = loadModule('functions/api/coins.js');
  const ghost = loadModule('functions/api/ghost-offering.js');

  // ---- Cướp Đêm: a WIN debits only its loot portion ----
  try {
    const w = newWorld(seenSql);
    const attacker = await w.createUser({ allowBot: true });
    const victim = await w.createUser({ allowBot: true });
    await seedHome(w, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(w, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await hit(w, start.onRequestPost, { url: '/api/night-raid/start', token: attacker.token, body: { targetId: victim.uid } });
    const f = await hit(w, finish.onRequestPost, { url: '/api/night-raid/finish', token: attacker.token, body: { raidId: s.data && s.data.raid && s.data.raid.raidId } });
    const res = (f.data && f.data.result) || {};
    const reward = Number(res.reward || 0);
    const loot = Number(res.loot || 0);
    const bonus = Number(res.victoryBonus || 0);
    const victimOwed = grantsOf(w, victim.uid);
    const attackerOwed = grantsOf(w, attacker.uid);
    const world = allGrants(w);
    const ok = f.status === 200 && res.won === true && reward > 0
      && reward === loot + bonus && victimOwed === -loot && attackerOwed === 0 && world === -loot;
    add('money.raid-win', `${NR}: đánh thắng nhà bạn`, ok,
      ok ? `won ${reward} xu = ${loot} loot + ${bonus} system bonus; the victim's device is debited exactly -${loot}, while the attacker applies the total once per raidId on their own phone`
         : `start=${s.status} finish=${f.status} won=${res.won} reward=${reward} loot=${loot} bonus=${bonus} victimOwed=${victimOwed} attackerOwed=${attackerOwed} ledgerSum=${world} :: ${JSON.stringify(f.data).slice(0, 300)}`);
  } catch (e) { add('money.raid-win', `${NR}: đánh thắng nhà bạn`, false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Cướp Đêm: a LOSS moves the same money the other way ----
  try {
    const w = newWorld(seenSql);
    const attacker = await w.createUser({ allowBot: true });
    const defender = await w.createUser({ allowBot: true });
    await seedHome(w, attacker, Object.assign({ coins: 900 }, WEAK));
    await seedHome(w, defender, Object.assign({ coins: 900 }, STRONG));
    const s = await hit(w, start.onRequestPost, { url: '/api/night-raid/start', token: attacker.token, body: { targetId: defender.uid } });
    const f = await hit(w, finish.onRequestPost, { url: '/api/night-raid/finish', token: attacker.token, body: { raidId: s.data && s.data.raid && s.data.raid.raidId } });
    const res = (f.data && f.data.result) || {};
    const loss = Number(res.loss || 0);
    const defOwed = grantsOf(w, defender.uid);
    const atkOwed = grantsOf(w, attacker.uid);
    const ok = f.status === 200 && res.won === false && loss > 0
      && Number(res.defenderGain) === loss && defOwed === loss && atkOwed === 0 && allGrants(w) === loss;
    add('money.raid-loss', `${NR}: đánh thua, mất xu`, ok,
      ok ? `lost ${loss} xu; the defender is credited exactly +${loss} and the attacker pays on their own device (0 server-side) — the two halves are equal and opposite`
         : `start=${s.status} finish=${f.status} won=${res.won} loss=${loss} defenderGain=${res.defenderGain} defOwed=${defOwed} atkOwed=${atkOwed} :: ${JSON.stringify(f.data).slice(0, 300)}`);
  } catch (e) { add('money.raid-loss', `${NR}: đánh thua, mất xu`, false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Cướp Đêm: one raid settles once, however many /finish calls arrive ----
  try {
    const w = newWorld(seenSql);
    const attacker = await w.createUser({ allowBot: true });
    const victim = await w.createUser({ allowBot: true });
    await seedHome(w, attacker, Object.assign({ coins: 500 }, STRONG));
    await seedHome(w, victim, Object.assign({ coins: 1000 }, WEAK));
    const s = await hit(w, start.onRequestPost, { url: '/api/night-raid/start', token: attacker.token, body: { targetId: victim.uid } });
    const raidId = s.data && s.data.raid && s.data.raid.raidId;
    const [a, b] = await Promise.all([
      hit(w, finish.onRequestPost, { url: '/api/night-raid/finish', token: attacker.token, body: { raidId } }),
      hit(w, finish.onRequestPost, { url: '/api/night-raid/finish', token: attacker.token, body: { raidId } }),
    ]);
    const reward = Number((a.data && a.data.result && a.data.result.reward) || 0);
    const loot = Number((a.data && a.data.result && a.data.result.loot) || 0);
    const rows = w.db.prepare('SELECT COUNT(*) AS n FROM coin_grants WHERE user_id=?').get(victim.uid).n;
    const ok = a.status === 200 && b.status === 200 && reward > 0 && Number(rows) === 1 && grantsOf(w, victim.uid) === -loot;
    add('money.raid-settled-once', `${NR}: bấm hai lần chỉ tính một`, ok,
      ok ? `two overlapping /finish calls for one raid wrote exactly 1 loot IOU row of -${loot}`
         : `a=${a.status} b=${b.status} reward=${reward} loot=${loot} iouRows=${rows} owed=${grantsOf(w, victim.uid)}`);
  } catch (e) { add('money.raid-settled-once', `${NR}: bấm hai lần chỉ tính một`, false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- POST /api/coins: claim → ack → not re-offered ----
  try {
    const w = newWorld(seenSql);
    const child = await w.createUser({});
    w.db.prepare("INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,0)").run(child.uid, 250, 'verify gift');
    const claim = await hit(w, coins.onRequestPost, { url: '/api/coins', token: child.token, body: { proto: 2, device: 'dverifydevice001' } });
    const receipt = claim.data && claim.data.receipt;
    const ack = await hit(w, coins.onRequestPost, { url: '/api/coins', token: child.token, body: { ackOnly: true, ackReceipts: [receipt] } });
    w.db.prepare("UPDATE coin_grants SET claimed_at = datetime('now','-2 hours') WHERE user_id=? AND claimed_at IS NOT NULL").run(child.uid);
    const again = await hit(w, coins.onRequestPost, { url: '/api/coins', token: child.token, body: { proto: 2, device: 'dverifydevice001' } });
    const ok = claim.status === 200 && Number(claim.data.granted) === 250 && /^[a-f0-9]{32}$/.test(String(receipt))
      && ack.status === 200 && again.status === 200 && Number(again.data.granted) === 0 && !again.data.receipt;
    add('money.coins-claim-ack', 'Ví xu: nhận quà một lần duy nhất', ok,
      ok ? 'a 250 xu IOU is paid once, acked with its receipt, and is never offered again even after the 10-minute reclaim window'
         : `claim=${claim.status}/${claim.data && claim.data.granted} receipt=${receipt} ack=${ack.status} replay=${again.status}/${again.data && again.data.granted}`);
  } catch (e) { add('money.coins-claim-ack', 'Ví xu: nhận quà một lần duy nhất', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- POST /api/coins: an un-acked claim belongs to ONE device ----
  try {
    const w = newWorld(seenSql);
    const child = await w.createUser({});
    w.db.prepare("INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,0)").run(child.uid, -120, 'verify raid debit');
    const phone = await hit(w, coins.onRequestPost, { url: '/api/coins', token: child.token, body: { proto: 2, device: 'dphone0000000001' } });
    w.db.prepare("UPDATE coin_grants SET claimed_at = datetime('now','-2 hours') WHERE user_id=? AND claimed_at IS NOT NULL").run(child.uid);
    const tablet = await hit(w, coins.onRequestPost, { url: '/api/coins', token: child.token, body: { proto: 2, device: 'dtablet000000001' } });
    const ok = Number(phone.data.granted) === -120 && Number(tablet.data.granted) === 0;
    add('money.coins-negative-once', 'Ví xu: bị trừ đúng một lần', ok,
      ok ? 'a negative IOU (how Cướp Đêm charges the sleeping side) lands on the device that claimed it and is never re-offered to a second device'
         : `phone=${phone.data && phone.data.granted} tablet=${tablet.data && tablet.data.granted} — a second device being charged again is a double DEBIT`);
  } catch (e) { add('money.coins-negative-once', 'Ví xu: bị trừ đúng một lần', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Cúng Cô Hồn: the scene replays, the coins do not ----
  try {
    const w = newWorld(seenSql);
    const child = await w.createUser({ allowBot: true });
    const g1 = await hit(w, ghost.onRequestGet, { method: 'GET', url: '/api/ghost-offering', token: child.token });
    const c1 = await hit(w, ghost.onRequestPost, { url: '/api/ghost-offering', token: child.token, body: { itemId: 'pig', sessionId: g1.data.sessionId } });
    const g2 = await hit(w, ghost.onRequestGet, { method: 'GET', url: '/api/ghost-offering', token: child.token });
    const c2 = await hit(w, ghost.onRequestPost, { url: '/api/ghost-offering', token: child.token, body: { itemId: 'pig', sessionId: g2.data.sessionId } });
    const owed = grantsOf(w, child.uid);
    const ok = c1.status === 200 && Number(c1.data.reward) === 200 && c2.status === 200
      && Number(c2.data.reward) === 0 && c2.data.replay === true
      && g2.data.sessionId !== g1.data.sessionId && owed === 200;
    add('money.ghost-offering-once-a-day', 'Cúng Cô Hồn: mâm cúng chỉ trả tiền một lần mỗi ngày', ok,
      ok ? 'reopening the screen mints a fresh preview session and re-lays the table, but the pig pays 200 xu exactly once per event day (ledger total 200)'
         : `first=${c1.status}/${c1.data && c1.data.reward} second=${c2.status}/${c2.data && c2.data.reward} replay=${c2.data && c2.data.replay} freshSession=${g2.data && g2.data.sessionId !== g1.data.sessionId} owed=${owed}`);
  } catch (e) { add('money.ghost-offering-once-a-day', 'Cúng Cô Hồn: mâm cúng chỉ trả tiền một lần mỗi ngày', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Nhiệm vụ hằng ngày: earn → 200 xu → turn the pick into a shield ----
  try {
    const w = newWorld(seenSql);
    const child = await w.createUser({});
    const boss = await w.createUser({ role: 'admin' });
    const catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const entry = catalog.all().find(e => e.match && (e.match.titlePrefix || e.match.titleExact) && !e.match.noField);
    const adminTasks = loadModule('functions/api/admin/daily-tasks.js');
    const created = await hit(w, adminTasks.onRequestPost, {
      url: '/api/admin/daily-tasks', token: boss.token,
      body: { userId: child.uid, kind: entry.key, target: 1 },
    });
    // One finished session that satisfies the catalog rule, written the way
    // /api/activity writes it.
    const detail = {};
    if (entry.match.detail) {
      detail[entry.match.detail.field] = entry.match.detail.prefix != null
        ? entry.match.detail.prefix + 'x' : entry.match.detail.value;
    }
    w.db.prepare('INSERT INTO activities (user_id, type, title, score, total, detail_json, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(child.uid, entry.activityType,
        entry.match.titleExact || (entry.match.titlePrefix + ' · 10/10'),
        10, 10, JSON.stringify(detail), sqlTime(Date.now()));

    const me = loadModule('functions/api/me/daily-tasks.js');
    const view = await hit(w, me.onRequestGet, { method: 'GET', url: '/api/me/daily-tasks', token: child.token });
    const paidOnce = grantsOf(w, child.uid);
    const again = await hit(w, me.onRequestGet, { method: 'GET', url: '/api/me/daily-tasks', token: child.token });
    const paidTwice = grantsOf(w, child.uid);

    const claim = loadModule('functions/api/daily-task/claim.js');
    const pick = await hit(w, claim.onRequestPost, { url: '/api/daily-task/claim', token: child.token, body: { date: view.data.date, kind: 'shield' } });
    const dup = await hit(w, claim.onRequestPost, { url: '/api/daily-task/claim', token: child.token, body: { date: view.data.date, kind: 'shield' } });
    const shields = w.db.prepare('SELECT night_shields FROM users WHERE id=?').get(child.uid).night_shields;

    const ok = created.status === 200 && view.status === 200 && view.data.allDone === true
      && paidOnce === 200 && paidTwice === 200
      && pick.status === 200 && dup.status === 409 && Number(shields) === 1;
    add('money.daily-task-claim', 'Nhiệm vụ hằng ngày: xong việc, nhận 200 xu và một khiên', ok,
      ok ? `task "${entry.key}" completed once → exactly 200 xu (a second look pays nothing more), and the pick turns into 1 khiên; a repeat claim answers 409 and credits nothing`
         : `create=${created.status} view=${view.status} allDone=${view.data && view.data.allDone} paid=${paidOnce}/${paidTwice} claim=${pick.status} repeat=${dup.status} shields=${shields} :: ${JSON.stringify(view.data).slice(0, 250)}`);

    // claim-all, so the other dynamic UPDATE in _daily-task.js is executed too
    const child2 = await w.createUser({});
    w.db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?,?,200,1)").run(child2.uid, '2026-01-01');
    const claimAll = loadModule('functions/api/daily-task/claim-all.js');
    const all = await hit(w, claimAll.onRequestPost, { url: '/api/daily-task/claim-all', token: child2.token, body: { kind: 'sword' } });
    const swords = w.db.prepare('SELECT night_swords FROM users WHERE id=?').get(child2.uid).night_swords;
    const okAll = all.status === 200 && Number(all.data.claimed) === 1 && Number(swords) === 1;
    add('money.daily-task-claim-all', 'Nhiệm vụ hằng ngày: nhận tất cả làm kiếm', okAll,
      okAll ? 'one pending reward day turned into exactly 1 kiếm in a single transaction'
            : `status=${all.status} claimed=${all.data && all.data.claimed} swords=${swords}`);
  } catch (e) {
    add('money.daily-task-claim', 'Nhiệm vụ hằng ngày: xong việc, nhận 200 xu và một khiên', false, 'threw: ' + ((e && e.stack) || e));
  }

  // ---- Đấu Thú Cưng: challenge → respond → turn → a finished battle ----
  try {
    const w = newWorld(seenSql);
    const a = await w.createUser({ username: 'Chủ nhà' });
    const b = await w.createUser({ username: 'Khách' });
    befriend(w, a, b, 5);
    for (const u of [a, b]) {
      w.db.prepare('INSERT INTO activities (user_id, type, title, score, total, created_at) VALUES (?,?,?,?,?,?)')
        .run(u.uid, 'grammar', 'Verify warmup', 20, 20, sqlTime(Date.now()));
    }
    const challenge = loadModule('functions/api/battle/challenge.js');
    const respond = loadModule('functions/api/battle/respond.js');
    const hire = loadModule('functions/api/battle/hire.js');
    const turn = loadModule('functions/api/battle/turn.js');
    const c = await hit(w, challenge.onRequestPost, { url: '/api/battle/challenge', token: a.token, body: { friendId: b.uid, level: 10, stage: 'chihuahua', petName: 'Miu' } });
    const battleId = c.data && c.data.battle && c.data.battle.id;
    const r = await hit(w, respond.onRequestPost, { url: '/api/battle/respond', token: b.token, body: { battleId, accept: true, level: 10 } });
    const hired = await hit(w, hire.onRequestPost, { url: '/api/battle/hire', token: a.token, body: { battleId, hires: ['engineer'] } });
    // One shot each, so the arena reaches its "both out of ammo" ending and
    // the finishing UPDATE (a different, dynamically built statement) runs.
    w.db.prepare('UPDATE battles SET challenger_ammo=1, opponent_ammo=1 WHERE id=?').run(battleId);
    const before = w.db.prepare('SELECT * FROM battles WHERE id=?').get(battleId);
    const t1 = await hit(w, turn.onRequestPost, { url: '/api/battle/turn', token: a.token, body: { battleId, turnNo: before.turn_no, angle: 45, power: 80, shots: 1, rawDamage: 9999 } });
    const mid = w.db.prepare('SELECT * FROM battles WHERE id=?').get(battleId);
    const t2 = await hit(w, turn.onRequestPost, { url: '/api/battle/turn', token: b.token, body: { battleId, turnNo: mid.turn_no, angle: 45, power: 80, shots: 1, rawDamage: 9999 } });
    const end = w.db.prepare('SELECT * FROM battles WHERE id=?').get(battleId);
    const turnsRecorded = w.db.prepare('SELECT COUNT(*) AS n FROM battle_turns WHERE battle_id=?').get(battleId).n;
    const ok = c.status === 200 && r.status === 200 && hired.status === 200 && t1.status === 200 && t2.status === 200
      && String(mid.status) === 'active' && String(end.status) === 'done'
      && JSON.parse(end.challenger_hires || '[]').includes('engineer')
      && Number(end.challenger_ammo) === 0 && Number(end.opponent_ammo) === 0
      && Number(turnsRecorded) === 2 && allGrants(w) === 0;
    add('money.battle-flow', 'Đấu Thú Cưng: mời → nhận lời → bắn → kết thúc', ok,
      ok ? `a full arena run: invite → accept → hire → two volleys → status 'done', both magazines spent, 2 turns recorded, winner_id=${end.winner_id}, and the arena created 0 coin_grants rows (it must not print money)`
         : `challenge=${c.status} respond=${r.status} hire=${hired.status} turn1=${t1.status} turn2=${t2.status} mid=${mid && mid.status} end=${end && end.status} turns=${turnsRecorded} grants=${allGrants(w)} :: ${JSON.stringify(c.data).slice(0, 200)} ${JSON.stringify(t1.data).slice(0, 200)}`);

    // A client that claims a ceiling it never earned must not be believed.
    const w2 = newWorld(seenSql);
    const x = await w2.createUser({}); const y = await w2.createUser({});
    befriend(w2, x, y, 5);
    for (const u of [x, y]) {
      w2.db.prepare('INSERT INTO activities (user_id, type, title, score, total, created_at) VALUES (?,?,?,?,?,?)')
        .run(u.uid, 'grammar', 'Verify warmup', 20, 20, sqlTime(Date.now()));
    }
    const c2 = await hit(w2, challenge.onRequestPost, { url: '/api/battle/challenge', token: x.token, body: { friendId: y.uid, level: 200 } });
    const id2 = c2.data && c2.data.battle && c2.data.battle.id;
    await hit(w2, respond.onRequestPost, { url: '/api/battle/respond', token: y.token, body: { battleId: id2, accept: true, level: 200 } });
    const row2 = w2.db.prepare('SELECT * FROM battles WHERE id=?').get(id2);
    // Straight up at zero power: the shell cannot reach the other castle.
    await hit(w2, turn.onRequestPost, { url: '/api/battle/turn', token: x.token, body: { battleId: id2, turnNo: row2.turn_no, angle: 90, power: 0, shots: 1, rawDamage: 100000 } });
    const dmg = w2.db.prepare('SELECT damage FROM battle_turns WHERE battle_id=? AND turn_no=?').get(id2, row2.turn_no);
    const okCheat = dmg && Number(dmg.damage) === 0;
    add('money.battle-damage-not-declared', 'Đấu Thú Cưng: không bắn trúng thì không ăn gian được', okCheat,
      okCheat ? 'a shot fired straight up at zero power scored 0, even though the client reported 100000 — the server re-runs the volley instead of believing the device'
              : `the server stored damage=${dmg && dmg.damage} for a shot that cannot possibly connect`);
  } catch (e) { add('money.battle-flow', 'Đấu Thú Cưng: mời → nhận lời → bắn → kết thúc', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Đấu Toán: challenge → respond → submit → settle → paid ----
  try {
    const MF = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
    const wars = require(path.join(ROOT, 'js', 'mathwars.js'));
    const { MATH_FIGHT_BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));
    global.MATH_FIGHT_BANK = MATH_FIGHT_BANK;
    global.MathFightRules = MF;
    global.warsQuestions = wars.warsQuestions;

    const w = newWorld(seenSql);
    w.db.prepare("INSERT INTO app_flags(key,value,updated_at,updated_by) VALUES('math_fight',1,?,0) " +
      'ON CONFLICT(key) DO UPDATE SET value=1').run(Date.now());
    const a = await w.createUser({ username: 'Toán A' });
    const b = await w.createUser({ username: 'Toán B' });
    befriend(w, a, b, 5);
    const mfChallenge = loadModule('functions/api/math-fight/challenge.js');
    const mfRespond = loadModule('functions/api/math-fight/respond.js');
    const mfSubmit = loadModule('functions/api/math-fight/submit.js');

    // The tab's own list first: with a friend in it, the set-based "who is
    // already fighting?" read is actually executed.
    const mfList = loadModule('functions/api/math-fight/index.js');
    const list = await hit(w, mfList.onRequestGet, { method: 'GET', url: '/api/math-fight', token: a.token });
    add('money.math-fight-list', 'Đấu Toán: danh sách bạn để thách đấu', list.status === 200 && Array.isArray(list.data.friends) && list.data.friends.length === 1,
      list.status === 200 && Array.isArray(list.data.friends)
        ? `GET /api/math-fight lists ${list.data.friends.length} challengeable friend(s)`
        : `status=${list.status} :: ${JSON.stringify(list.data).slice(0, 200)}`);

    const off = await hit(w, mfChallenge.onRequestPost, { url: '/api/math-fight/challenge', token: a.token, body: { friendId: b.uid, level: 3, foeLevel: 3 } });
    const fightId = off.data && off.data.fight && off.data.fight.fightId;
    const acc = await hit(w, mfRespond.onRequestPost, { url: '/api/math-fight/respond', token: b.token, body: { fightId, accept: true } });
    const row = w.db.prepare('SELECT * FROM math_fights WHERE id=?').get(fightId);
    const perfect = MF.fightQuestions(row.seed, row.challenger_level, MATH_FIGHT_BANK).map(q => q.answer);
    const winner = await hit(w, mfSubmit.onRequestPost, { url: '/api/math-fight/submit', token: a.token, body: { fightId, answers: perfect, coins: 500 } });
    const loser = await hit(w, mfSubmit.onRequestPost, { url: '/api/math-fight/submit', token: b.token, body: { fightId, answers: [], coins: 500 } });
    const done = w.db.prepare('SELECT * FROM math_fights WHERE id=?').get(fightId);
    const winCoins = Number(winner.data && winner.data.coins);
    // The winner's own /submit answered before the loser's, so re-ask for the
    // settled verdict the way js/math-fight.js does.
    const winClaim = await hit(w, mfSubmit.onRequestPost, { url: '/api/math-fight/submit', token: a.token, body: { fightId, answers: perfect, coins: 500 } });
    const paidWin = Number(winClaim.data && winClaim.data.coins);
    const paidLose = Number(loser.data && loser.data.coins);
    const ok = off.status === 200 && acc.status === 200 && winner.status === 200 && loser.status === 200
      && String(done.status) === 'done' && Number(done.winner_id) === a.uid
      && paidWin === MF.PRIZE && paidLose === -MF.PRIZE;
    add('money.math-fight-flow', 'Đấu Toán: thách đấu → nhận lời → nộp bài → chia xu', ok,
      ok ? `a full duel: 20/20 beats 0/20, the fight settles once, the winner is offered +${paidWin} and the loser -${-paidLose} — equal and opposite, and neither number comes from the device`
         : `challenge=${off.status} respond=${acc.status} submitWin=${winner.status} submitLose=${loser.status} status=${done && done.status} winner=${done && done.winner_id}(expect ${a.uid}) winnerCoins=${winCoins}/${paidWin} loserCoins=${paidLose} :: ${JSON.stringify(off.data).slice(0, 200)}`);

    // A settled fight must not pay a second time.
    const replay = await hit(w, mfSubmit.onRequestPost, { url: '/api/math-fight/submit', token: a.token, body: { fightId, answers: perfect, coins: 500 } });
    const after = w.db.prepare('SELECT finished_at, winner_id FROM math_fights WHERE id=?').get(fightId);
    const okReplay = replay.status === 200 && Number(after.winner_id) === a.uid
      && Number(after.finished_at) === Number(done.finished_at);
    add('money.math-fight-verdict-stands', 'Đấu Toán: kết quả đã chốt thì không đổi', okReplay,
      okReplay ? 'a third /submit on a finished fight replays the same verdict and does not re-settle it'
               : `replay=${replay.status} winner=${after && after.winner_id} finished_at ${after && after.finished_at} vs ${done && done.finished_at}`);

    // /progress is the pulse; it must never carry money.
    const mfProgress = loadModule('functions/api/math-fight/progress.js');
    const pulse = await hit(w, mfProgress.onRequestPost, { url: '/api/math-fight/progress', token: a.token, body: { fightId, answers: [] } });
    add('money.math-fight-pulse-carries-no-money', 'Đấu Toán: nhịp 5 giây không mang tiền', pulse.status === 200 && !pulse.data.coins,
      pulse.status === 200 && !pulse.data.coins
        ? 'POST /progress answers 200 and carries no coin field — the money is only ever claimed through /submit'
        : `status=${pulse.status} coins=${pulse.data && pulse.data.coins}`);
  } catch (e) { add('money.math-fight-flow', 'Đấu Toán: thách đấu → nhận lời → nộp bài → chia xu', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Nông trại: một ngày nhiệm vụ xong là cây lớn một nấc, chín thì ra xu ----
  // Spec 7 asks the verify manifest to cover the farm on the server too. The
  // client playbook walks the SHOP; this walks the money and the clock: the
  // ONLY thing that grows a plant is a row in daily_task_rewards, and the
  // harvest pays the crop's yield out of the same lootable_coins column the
  // 24h fields always used. Every number below comes from js/farm-rules.js —
  // the premise of this file is that expectations are read from live data.
  try {
    const w = newWorld(seenSql);
    const kid = await w.createUser({ username: 'Bé Nông Dân', allowBot: true });
    const Farm = require(path.join(ROOT, 'js', 'farm-rules.js'));
    const crop = Farm.cropById('carrot') || Farm.CROPS[Farm.CROPS.length - 1];
    const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
    // One finished task-day per past calendar day. daily_task_rewards is keyed
    // (user_id, task_date), so a day can never be counted twice.
    let daysBanked = 0;
    const finishADay = () => {
      daysBanked++;
      w.db.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?,?,200,1)')
        .run(kid.uid, gmt7(Date.now() - daysBanked * 86400000));
    };
    const home = loadModule('functions/api/night-raid/home.js');
    const plantRoute = loadModule('functions/api/night-raid/plant.js');
    const collectRoute = loadModule('functions/api/night-raid/collect.js');
    const boardOf = () => JSON.parse(w.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(kid.uid).layout_json);
    const purseOf = () => Number(w.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(kid.uid).lootable_coins);
    const collect = () => hit(w, collectRoute.onRequestPost, { url: '/api/night-raid/collect', token: kid.token, body: {} });

    finishADay();                                       // dayCount 1: the farm has a day
    // Create the empty home, buy the barracks through the server-authoritative
    // purchase operation, then plant through the only route allowed to spend
    // a server-owned seed.
    await hit(w, home.onRequestPut, {
      method: 'PUT', url: '/api/night-raid/home', token: kid.token,
      body: { layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 1, castleSkin: 'stone-keep', coins: 8000 } });
    const planted = await hit(w, home.onRequestPut, {
      method: 'PUT', url: '/api/night-raid/home', token: kid.token,
      body: { layout: { cells: [{ type: 'training-barracks', gx: 8, gy: 8, uid: 'p-verify0001' }], soldiers: 0, dogLane: 2 },
              dogLevel: 1, castleSkin: 'stone-keep', barracksPurchase: { uid: 'p-verify0001', gx: 8, gy: 8 } } });
    w.db.prepare('INSERT INTO farm_seed_inventory(user_id,crop_id,quantity) VALUES(?,?,1)').run(kid.uid, crop.id);
    const plantedSeed = await hit(w, plantRoute.onRequestPost, {
      method: 'POST', url: '/api/night-raid/plant', token: kid.token,
      body: { cropId: crop.id, gx: 1, gy: 1, zone: 0, day: -999, at: '2000-01-01' } });
    const seeded = boardOf().cells.find(c => c.type === crop.id);
    const plantedUid = seeded && seeded.uid;
    const stampedToday = !!seeded && seeded.day === 1 && seeded.at === gmt7(Date.now());

    // One task-day short of ripe: the harvest must not pay a xu for the plant,
    // and must leave it standing. (The barracks beside it pays soldier 1 from
    // one of its banked days; the crop must not ride on that separate clock.)
    for (let i = 1; i < crop.days; i++) finishADay();
    const early = await collect();
    const earlySoldiers = Number((early.data && early.data.collectedSoldiers) || 0);
    const stillGrowing = early.status === 200 && purseOf() === 0
      && boardOf().cells.some(c => c.uid === plantedUid);

    finishADay();                                       // the day it ripens on
    const paid = await collect();
    const purse = purseOf(), board = boardOf();
    const gone = !board.cells.some(c => c.uid === plantedUid);
    const harvestedIt = Array.isArray(paid.data && paid.data.harvested)
      && paid.data.harvested.some(h => h.type === crop.id);
    const soldiers = Number(paid.data && paid.data.collectedSoldiers);

    const ok = planted.status === 200 && plantedSeed.status === 200 && stampedToday && stillGrowing && paid.status === 200
      && Number(paid.data.collectedCoins) === crop.yield && purse === crop.yield
      && gone && harvestedIt && earlySoldiers === 1 && soldiers === 1
      && Number(board.soldiers) === earlySoldiers + soldiers
      && grantsOf(w, kid.uid) === 0;
    add('money.farm-harvest-per-task-day', 'Cướp Đêm: nông trại lớn theo ngày nhiệm vụ, hái ra xu', ok,
      ok ? `${crop.name.vi} planted on task-day 1 (the server refused the client's day=-999 / at=2000-01-01), paid nothing while it was ${crop.days - 1} of ${crop.days} days grown, then paid exactly ${crop.yield} xu on the day it ripened and left the board; lootable_coins moved by ${crop.yield}; the barracks charged 1 banked day for soldier 1, then 2 for soldier 2 while preserving its extra day; 0 coin_grants rows — the harvest never touches that ledger`
         : `put=${planted.status} plant=${plantedSeed.status} stamped=${stampedToday} (${JSON.stringify(seeded)}) unripeAfter${crop.days - 1}=${stillGrowing} collect=${paid.status} coins=${paid.data && paid.data.collectedCoins} want=${crop.yield} purse=${purse} cropGone=${gone} harvested=${harvestedIt} soldiers=${earlySoldiers}+${soldiers} stock=${board.soldiers} grants=${grantsOf(w, kid.uid)}`);

    // And the clock the farm does NOT have: hours must move nothing.
    const before = JSON.stringify(boardOf().cells);
    const idle = await collect();
    const okIdle = idle.status === 200 && !!idle.data.nothingReady
      && JSON.stringify(boardOf().cells) === before && purseOf() === crop.yield;
    add('money.farm-grows-on-tasks-not-hours', 'Cướp Đêm: nông trại không lớn theo giờ', okIdle,
      okIdle ? 'a second harvest with no new daily_task_rewards row pays nothing and changes no cell — only a finished task-day moves the farm'
             : `status=${idle.status} nothingReady=${idle.data && idle.data.nothingReady} purse=${purseOf()} want=${crop.yield} boardChanged=${JSON.stringify(boardOf().cells) !== before}`);
  } catch (e) { add('money.farm-harvest-per-task-day', 'Cướp Đêm: nông trại lớn theo ngày nhiệm vụ, hái ra xu', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- extra executions purely so dynamically-built SQL is covered ----
  try {
    const w = newWorld(seenSql);
    const boss = await w.createUser({ role: 'admin' });
    const adminActivity = loadModule('functions/api/admin/activity.js');
    const appFlags = loadModule('functions/api/admin/app-flags.js');
    const a1 = await hit(w, adminActivity.onRequestGet, { method: 'GET', url: '/api/admin/activity', token: boss.token });
    const a2 = await hit(w, adminActivity.onRequestGet, { method: 'GET', url: '/api/admin/activity?userId=' + boss.uid, token: boss.token });
    const f1 = await hit(w, appFlags.onRequestGet, { method: 'GET', url: '/api/admin/app-flags', token: boss.token });
    const ok = a1.status === 200 && a2.status === 200 && f1.status === 200;
    add('admin.console-reads', 'Trang quản trị: bảng hoạt động và công tắc tính năng', ok,
      ok ? 'GET /api/admin/activity (all children and filtered to one) and GET /api/admin/app-flags both answer 200 — both build their SQL at run time, so this is the only way their column names get checked'
         : `activity=${a1.status} activity?userId=${a2.status} app-flags=${f1.status}`);
  } catch (e) { add('admin.console-reads', 'Trang quản trị: bảng hoạt động và công tắc tính năng', false, 'threw: ' + ((e && e.stack) || e)); }

  drainLogs();
}

// ---------------------------------------------------------------------------
// schema drift
// ---------------------------------------------------------------------------
function schemaChecks(add, seenSql) {
  // The authority is the database tests/pages-harness.js builds from its
  // SQL_FILES list — the same one every executed check above ran against.
  const schemaDb = createWorld().db;
  const files = allApiSources(API_DIR);
  const sites = [];
  for (const f of files) {
    try { sites.push(...prepareSites(f)); }
    catch (e) { add('schema.scan.' + slugFor(f), 'Toàn bộ API', false, `could not scan ${f} for SQL: ${(e && e.message) || e}`); }
  }

  const literal = sites.filter(s => s.kind === 'literal');
  const dynamic = sites.filter(s => s.kind === 'dynamic');
  const notSql = literal.filter(s => !SQL_HEAD.test(s.sql));
  const sqlLiteral = literal.filter(s => SQL_HEAD.test(s.sql));

  const broken = [];
  for (const s of sqlLiteral) {
    try { schemaDb.prepare(s.sql).finalize?.(); }
    catch (e) { broken.push(`${s.where}: ${(e && e.message) || e} :: ${norm(s.sql).slice(0, 160)}`); }
  }
  add('schema.literal-sql', 'Toàn bộ API: tên cột trong cơ sở dữ liệu', broken.length === 0,
    broken.length === 0
      ? `all ${sqlLiteral.length} fully-literal SQL statements across ${files.length} files under functions/api PREPARE cleanly against the harness schema — every table and column they name exists (this is the check that would have caught battles.field_version)`
      : `${broken.length} statement(s) name something the schema does not have:\n  ` + broken.join('\n  '));

  add('schema.every-prepare-is-sql', 'Toàn bộ API: mọi câu lệnh đều đọc được', notSql.length === 0,
    notSql.length === 0
      ? `every literal .prepare() argument parsed as SQL — the scanner is not quietly skipping statements`
      : `${notSql.length} literal .prepare() argument(s) did not look like SQL and were NOT checked: ` +
        notSql.map(s => `${s.where} (${norm(s.sql).slice(0, 60)})`).join(', '));

  // Dynamic statements cannot be parsed statically. They are covered only if
  // the exercise phases above actually executed them — node:sqlite prepares
  // every statement it runs, so an executed statement with a bad column name
  // would already have thrown. This is the honest boundary of the check.
  //
  // A site is matched by its literal skeleton (its chunks in order, anchored at
  // both ends, with the interpolations free). Two rules keep that from being
  // credited by somebody else's statement:
  //   * the match is anchored, so it cannot be a substring of a longer query;
  //   * a statement that is itself one of the FULLY LITERAL statements in the
  //     tree cannot count — a dynamic site always emits text no literal site
  //     emits, so a literal match means the skeleton was too generic and the
  //     real site never ran. (`SELECT ${col} FROM users WHERE id = ?` used to
  //     be credited by _lib.js's own `SELECT id, role, disabled FROM users…`.)
  const literalSet = new Set(sqlLiteral.map(s => norm(s.sql)));
  const runtime = [...seenSql].map(norm);
  const fresh = runtime.filter(r => !literalSet.has(r));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const uncovered = [];
  for (const s of dynamic) {
    const parts = s.frags.map(norm);
    const body = parts.filter(Boolean).map(esc).join('.*?');
    let covered = false;
    if (body) {
      const re = new RegExp((parts[0] ? '^' : '') + body + (parts[parts.length - 1] ? '$' : ''));
      covered = fresh.some(r => re.test(r));
    }
    if (!covered) uncovered.push(s.where);
  }
  add('schema.dynamic-sql-executed', 'Toàn bộ API: câu lệnh ghép động cũng phải chạy thật', uncovered.length === 0,
    uncovered.length === 0
      ? `all ${dynamic.length} run-time-assembled statements were EXECUTED by the checks above (${runtime.length} distinct statements ran), so SQLite validated their tables and columns too`
      : `${uncovered.length} of ${dynamic.length} run-time-assembled statements were never executed, so nothing verified their column names: ` + uncovered.join(', '));

  // A guard on the scanner itself: if it ever stops finding SQL (a refactor to
  // a query builder, a lexer bug), the two checks above would pass vacuously.
  add('schema.scanner-alive', 'Toàn bộ API: bộ dò SQL còn hoạt động', sqlLiteral.length > 100 && dynamic.length > 0,
    `${sites.length} .prepare() call sites found: ${sqlLiteral.length} fully literal, ${dynamic.length} assembled at run time, ${notSql.length} unrecognised`);
}

module.exports = { verifyServer };

if (require.main === module) {
  verifyServer().then(r => {
    const bad = r.checks.filter(c => !c.ok);
    process.stdout.write(
      r.checks.map(c => `${c.ok ? 'ok  ' : 'FAIL'} ${c.id} — ${c.feature}\n     ${c.detail}\n`).join('') +
      `\n${r.checks.length - bad.length}/${r.checks.length} ok, ${r.routes.length} routes, ${r.ms} ms\n`);
    process.exit(bad.length ? 1 : 0);
  }).catch(e => { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(2); });
}
