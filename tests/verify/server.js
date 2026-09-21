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
  ['/api/night-raid/', 'Nông trại'],
  ['/api/me/daily-tasks', 'Nhiệm vụ hằng ngày'],
  ['/api/coins', 'Ví xu'],
  ['/api/admin/', 'Trang quản trị'],
  ['/api/me/attempts', 'Lịch sử làm đề'],
  ['/api/login', 'Đăng nhập'],
  ['/api/register', 'Tạo tài khoản'],
  ['/api/version', 'Phiên bản app'],
  ['/api/assets', 'Kho đồ của bạn'],
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

const grantsOf = (world, uid) =>
  world.db.prepare('SELECT amount FROM coin_grants WHERE user_id=?').all(uid)
    .reduce((sum, r) => sum + Number(r.amount), 0);
const allGrants = world =>
  world.db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM coin_grants').get().s;

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
    add('route-inventory', 'Toàn bộ API', routes.length >= 15,
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
    // Two personas — a learner and an admin — so every route is genuinely
    // entered rather than bouncing off its own 403.
    const w = newWorld(seenSql);
    const kid = await w.createUser({ username: 'Học viên' });
    const boss = await w.createUser({ username: 'Admin', role: 'admin' });
    const personas = [['plain', kid], ['admin', boss]];

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
    await runSweep('as', personas);

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
      }
    }
    const farmRoutes = routes.flatMap(r => r.methods.map(m => [m + ' ' + r.url, statuses.get(m + ' ' + r.url)]))
      .filter(([key]) => key.includes(' /api/night-raid/'));
    const gatedFarm = farmRoutes.filter(([, s]) => s && s['as:plain'] === 403).map(([key]) => key);
    add('feature.farm-open', 'Nông trại: mở cho mọi học viên', farmRoutes.length > 0 && gatedFarm.length === 0,
      gatedFarm.length
        ? `signed-in learners are still blocked from: ${gatedFarm.join(', ')}`
        : `all ${farmRoutes.length} farm route(s) enter normally for a signed-in learner`);

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
  const coins = loadModule('functions/api/coins.js');

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

  // ---- Nhiệm vụ hằng ngày: earn → 200 xu, once ----
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

    const rewardRows = w.db.prepare('SELECT COUNT(*) AS n FROM daily_task_rewards WHERE user_id=?').get(child.uid).n;

    const ok = created.status === 200 && view.status === 200 && view.data.allDone === true
      && paidOnce === 200 && paidTwice === 200 && Number(rewardRows) === 1;
    add('money.daily-task-claim', 'Nhiệm vụ hằng ngày: xong việc, nhận 200 xu', ok,
      ok ? `task "${entry.key}" completed once → exactly 200 xu and one reward row (the farm's clock); a second look pays nothing more`
         : `create=${created.status} view=${view.status} allDone=${view.data && view.data.allDone} paid=${paidOnce}/${paidTwice} rows=${rewardRows} :: ${JSON.stringify(view.data).slice(0, 250)}`);

    // The admin's per-day history (the who-did-their-tasks grid): the one
    // assembled query in progressRange() runs here for real, and the day the
    // session above landed on must show the task as done.
    const grid = await hit(w, adminTasks.onRequestGet, { method: 'GET', url: '/api/admin/daily-tasks?user_id=' + child.uid + '&days=7', token: boss.token });
    const hist = (grid.data && grid.data.history) || [];
    const last = hist[hist.length - 1];
    const okGrid = grid.status === 200 && hist.length === 7 && last && last.date === view.data.date
      && last.tasks.length === 1 && last.tasks[0].done === true && last.allDone === true && last.rewarded === true;
    add('admin.daily-task-history', 'Admin: lưới "ai làm nhiệm vụ, ai bỏ" đọc đúng 7 ngày', okGrid,
      okGrid ? `7 days back, today ${last.date}: 1 task, done, all done, rewarded — the grid cell would be green`
             : `status=${grid.status} days=${hist.length} last=${JSON.stringify(last).slice(0, 200)}`);

  } catch (e) {
    add('money.daily-task-claim', 'Nhiệm vụ hằng ngày: xong việc, nhận 200 xu', false, 'threw: ' + ((e && e.stack) || e));
  }

  // ---- Nông trại: một ngày nhiệm vụ xong là cây lớn một nấc, chín thì ra xu ----
  // Spec 7 asks the verify manifest to cover the farm on the server too. The
  // client playbook walks the SHOP; this walks the money and the clock: the
  // ONLY thing that grows a plant is a row in daily_task_rewards, and the
  // harvest pays the crop's yield out of the same lootable_coins column the
  // 24h fields always used. Every number below comes from js/farm-rules.js —
  // the premise of this file is that expectations are read from live data.
  try {
    const w = newWorld(seenSql);
    const kid = await w.createUser({ username: 'Nông Dân' });
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
    add('money.farm-harvest-per-task-day', 'Nông trại: lớn theo ngày nhiệm vụ, hái ra xu', ok,
      ok ? `${crop.name.vi} planted on task-day 1 (the server refused the client's day=-999 / at=2000-01-01), paid nothing while it was ${crop.days - 1} of ${crop.days} days grown, then paid exactly ${crop.yield} xu on the day it ripened and left the board; lootable_coins moved by ${crop.yield}; the barracks charged 1 banked day for soldier 1, then 2 for soldier 2 while preserving its extra day; 0 coin_grants rows — the harvest never touches that ledger`
         : `put=${planted.status} plant=${plantedSeed.status} stamped=${stampedToday} (${JSON.stringify(seeded)}) unripeAfter${crop.days - 1}=${stillGrowing} collect=${paid.status} coins=${paid.data && paid.data.collectedCoins} want=${crop.yield} purse=${purse} cropGone=${gone} harvested=${harvestedIt} soldiers=${earlySoldiers}+${soldiers} stock=${board.soldiers} grants=${grantsOf(w, kid.uid)}`);

    // And the clock the farm does NOT have: hours must move nothing.
    const before = JSON.stringify(boardOf().cells);
    const idle = await collect();
    const okIdle = idle.status === 200 && !!idle.data.nothingReady
      && JSON.stringify(boardOf().cells) === before && purseOf() === crop.yield;
    add('money.farm-grows-on-tasks-not-hours', 'Nông trại: không lớn theo giờ', okIdle,
      okIdle ? 'a second harvest with no new daily_task_rewards row pays nothing and changes no cell — only a finished task-day moves the farm'
             : `status=${idle.status} nothingReady=${idle.data && idle.data.nothingReady} purse=${purseOf()} want=${crop.yield} boardChanged=${JSON.stringify(boardOf().cells) !== before}`);
  } catch (e) { add('money.farm-harvest-per-task-day', 'Nông trại: lớn theo ngày nhiệm vụ, hái ra xu', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- extra executions purely so dynamically-built SQL is covered ----
  try {
    const w = newWorld(seenSql);
    const boss = await w.createUser({ role: 'admin' });
    const adminActivity = loadModule('functions/api/admin/activity.js');
    const a1 = await hit(w, adminActivity.onRequestGet, { method: 'GET', url: '/api/admin/activity', token: boss.token });
    const a2 = await hit(w, adminActivity.onRequestGet, { method: 'GET', url: '/api/admin/activity?userId=' + boss.uid, token: boss.token });
    const ok = a1.status === 200 && a2.status === 200;
    add('admin.console-reads', 'Trang quản trị: bảng hoạt động', ok,
      ok ? 'GET /api/admin/activity (all learners and filtered to one) answers 200 — it builds its SQL at run time, so this is the only way its column names get checked'
         : `activity=${a1.status} activity?userId=${a2.status}`);
  } catch (e) { add('admin.console-reads', 'Trang quản trị: bảng hoạt động', false, 'threw: ' + ((e && e.stack) || e)); }

  // ---- Admin: xoá vĩnh viễn một tài khoản ----
  // The purge assembles one DELETE per (table, column) at run time, so this
  // is where every one of them runs against the real schema. A learner with
  // a wallet, a task and a farm goes; a second learner keeps everything.
  try {
    const w = newWorld(seenSql);
    const boss = await w.createUser({ role: 'admin' });
    const kid = await w.createUser({});
    const other = await w.createUser({});
    const grant = loadModule('functions/api/admin/grant-coins.js');
    for (const u of [kid, other]) {
      await hit(w, grant.onRequestPost, { url: '/api/admin/grant-coins', token: boss.token, body: { userId: u.uid, amount: 40 } });
      w.db.prepare('INSERT INTO activities (user_id, type, title, score, total, created_at) VALUES (?,?,?,?,?,?)')
        .run(u.uid, 'lesson', 'Unit 1 words practice', 5, 5, sqlTime(Date.now()));
    }
    const home = loadModule('functions/api/night-raid/home.js');
    await hit(w, home.onRequestPut, { method: 'PUT', url: '/api/night-raid/home', token: kid.token, body: { layout: { cells: [], dogLane: 2 }, lootableCoins: 40 } });
    const usersApi = loadModule('functions/api/admin/users.js');
    const gone = await hit(w, usersApi.onRequestDelete, { method: 'DELETE', url: '/api/admin/users', token: boss.token, body: { userId: kid.uid } });
    const self = await hit(w, usersApi.onRequestDelete, { method: 'DELETE', url: '/api/admin/users', token: boss.token, body: { userId: boss.uid } });
    const left = w.db.prepare('SELECT COUNT(*) AS n FROM users WHERE id=?').get(kid.uid).n;
    const orphans = usersApi.USER_TABLES.flatMap(([t, cols]) => cols.map(c => [t + '.' + c, w.db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${c}=?`).get(kid.uid).n]))
      .filter(([, n]) => Number(n) > 0).map(([k]) => k);
    const otherKept = grantsOf(w, other.uid) === 40
      && w.db.prepare('SELECT COUNT(*) AS n FROM activities WHERE user_id=?').get(other.uid).n === 1;
    const list = await hit(w, usersApi.onRequestGet, { method: 'GET', url: '/api/admin/users', token: boss.token });
    const listed = list.status === 200 && list.data.users.map(u => u.id);
    const ok = gone.status === 200 && Number(left) === 0 && orphans.length === 0 && otherKept
      && self.status === 400 && listed && !listed.includes(kid.uid) && listed.includes(other.uid);
    add('admin.delete-user', 'Trang quản trị: xoá vĩnh viễn tài khoản', ok,
      ok ? `DELETE /api/admin/users took the learner and every row in ${usersApi.USER_TABLES.length} tables; the other learner kept 40 xu and their history; the admin cannot delete themself; the list no longer shows the account`
         : `delete=${gone.status} left=${left} orphans=${orphans.join(',')} otherKept=${otherKept} self=${self.status} listed=${JSON.stringify(listed)} :: ${JSON.stringify(gone.data)}`);
  } catch (e) { add('admin.delete-user', 'Trang quản trị: xoá vĩnh viễn tài khoản', false, 'threw: ' + ((e && e.stack) || e)); }

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
  add('schema.scanner-alive', 'Toàn bộ API: bộ dò SQL còn hoạt động', sqlLiteral.length > 40 && dynamic.length > 0,
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
