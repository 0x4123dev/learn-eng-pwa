// Loads real Cloudflare Pages Functions (functions/api/*.js, ES modules) into
// plain Node so tests can call onRequestGet/Post/Put with a real Request and a
// SQLite-backed env.DB (tests/d1-mock.js). The transform is deliberately dumb:
// it only rewrites the import/export shapes this repo actually uses, and
// throws on anything else so a new syntax fails loudly instead of silently
// testing nothing.
'use strict';

const fs = require('fs');
const path = require('path');
const { createD1 } = require('./d1-mock');

const ROOT = path.join(__dirname, '..');
const cache = new Map();

function transform(src, file) {
  const exported = [];
  let out = src;
  // import Default from './x.js';
  out = out.replace(/^import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"];?/gm,
    (_, name, spec) => `const ${name} = __importDefault(${JSON.stringify(spec)});`);
  // import { a, b } from './x.js';
  out = out.replace(/^import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"];?/gm,
    (_, names, spec) => {
      if (/\bas\b/.test(names)) throw new Error('import alias not supported in ' + file);
      return `const {${names}} = __import(${JSON.stringify(spec)});`;
    });
  // export [async] function name / export const NAME / export class Name
  out = out.replace(/^export\s+(async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (_, kw, name) => { exported.push(name); return `${kw} ${name}`; });
  out = out.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (_, kw, name) => { exported.push(name); return `${kw} ${name}`; });
  // export default { … };  (Cloudflare Worker entry shape)
  out = out.replace(/^export\s+default\s+/m, '__exportsObj.default = ');
  if (/^export\s/m.test(out)) {
    throw new Error('unsupported export shape left in ' + file);
  }
  out += '\n;Object.assign(__exportsObj, {' + exported.join(',') + '});\n';
  return out;
}

function loadModule(file) {
  const abs = path.resolve(ROOT, file);
  if (cache.has(abs)) return cache.get(abs);
  const src = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  const localImport = (spec) => loadModule(path.resolve(dir, spec));
  const localImportDefault = (spec) => {
    const m = localImport(spec);
    return m && m.default !== undefined ? m.default : m;
  };

  let exportsObj;
  if (/^\s*(import|export)\s/m.test(src)) {
    exportsObj = {};
    const body = transform(src, file);
    const fn = new Function('__import', '__importDefault', '__exportsObj', body);
    fn(localImport, localImportDefault, exportsObj);
  } else {
    // Plain-script module (e.g. js/night-raid-rules.js) with a CJS fallback.
    // It also gets a real `require` for relative specs: js/night-raid-rules.js
    // reaches js/farm-rules.js through exactly that fallback in Node and in
    // the Pages bundle (esbuild wraps a `module.exports` file as CJS). Without
    // one here `typeof require` is 'undefined' inside new Function, its
    // `FarmRules` silently becomes null, and every farm rule tests as a no-op.
    const module = { exports: {} };
    const cjsRequire = (spec) => {
      if (!/^\.{1,2}\//.test(spec)) throw new Error('bare require(' + spec + ') not supported in ' + file);
      return localImport(spec);
    };
    const fn = new Function('module', 'exports', 'require', src);
    fn(module, module.exports, cjsRequire);
    exportsObj = module.exports;
  }
  cache.set(abs, exportsObj);
  return exportsObj;
}

// ---- world: a fresh DB with the schema every handler expects ----

const AUTH_SECRET = 'test-auth-secret';
// schema.sql is canonical; the listed migrations are CREATE-only and mirror a
// real rebuild (the ALTER-only migrations 003–007 predate schema.sql's
// current shape and would fail on replay, exactly like production).
const SQL_FILES = [
  'db/schema.sql',
  'db/002-friends-battle.sql',
  // The ALTERs that finish the arena. They are replayable here because 002
  // creates `battles`/`battle_turns` from scratch a line earlier — and they
  // have to be, or the mock keeps answering "no such column" for the columns
  // every battle handler actually writes. db/022 is the one that had never
  // been written down at all: challenge.js has been INSERTing field_version
  // since c6e7752b against a hand-altered production database.
  'db/003-battle-backgrounds.sql',
  'db/006-battle-teammates.sql',
  'db/007-castle-skins.sql',
  'db/022-battle-field-version.sql',
  'db/008-learning-skills.sql',
  'db/009-night-raid.sql',
  'db/010-coin-grants.sql',
  'db/011-math-fight.sql',
  'db/030-cuuchuong-seconds.sql',   // seeds cuuchuong_seconds into app_flags
  'db/012-ghost-offering-event.sql',
  'db/013-daily-coin-snapshots.sql',
  // Must run AFTER 009: it drops the unique (attacker, defender, ICT day)
  // index 009 creates, which a real database no longer has either.
  'db/021-night-raid-rules.sql',
  // One in-flight raid per attacker (the other half of the ticket rule).
  'db/023-night-raid-one-active.sql',
  // One offering pays one child once per event day, however many preview
  // rounds they replay.
  'db/024-ghost-offering-payouts.sql',
  // The index the Đấu Toán reaper needs: it runs on every 3-second list poll
  // and had no index on deadline_at at all.
  'db/026-math-fight-deadline-index.sql',
  'db/027-battle-reaper-index.sql',
];

function createWorld(opts) {
  opts = opts || {};
  const { db, d1 } = createD1();
  for (const f of (opts.sqlFiles || SQL_FILES)) {
    db.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  }
  db.prepare('INSERT OR REPLACE INTO config(key,value) VALUES(?,?)')
    .run('auth_secret', AUTH_SECRET);
  const env = { DB: d1 };
  const lib = loadModule('functions/api/_lib.js');

  let seq = 0;
  async function createUser(o) {
    o = o || {};
    const name = o.username || ('kid' + (++seq));
    const info = db.prepare(
      'INSERT INTO users (username, passcode_hash, salt, role) VALUES (?,?,?,?)'
    ).run(name, 'x', 'x', o.role || 'user');
    const uid = Number(info.lastInsertRowid);
    if (o.allowBot) db.prepare('UPDATE users SET allow_bot=1 WHERE id=?').run(uid);
    const token = await lib.signToken({ uid, username: name }, AUTH_SECRET);
    return { uid, username: name, token };
  }

  async function call(handler, o) {
    o = o || {};
    const headers = { 'Content-Type': 'application/json' };
    if (o.token) headers['Authorization'] = 'Bearer ' + o.token;
    const request = new Request('http://app.test' + (o.url || '/api/x'), {
      method: o.method || 'POST',
      headers,
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
    const res = await handler({ request, env });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, ok: res.status >= 200 && res.status < 300, data };
  }

  return { db, d1, env, createUser, call, loadModule };
}

module.exports = { createWorld, loadModule, AUTH_SECRET };
