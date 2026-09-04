#!/usr/bin/env node
// verify.js — "is any feature broken?", answered feature by feature.
//
//   npm run verify              the source tree: inventory, server, client
//   npm run verify -- --live    also probe the deployed site
//   npm run verify -- --only=server
//
// This is deliberately NOT the unit suite. `npm test` proves that the code
// does what its author thought; this proves that a CHILD can still do each
// thing the app offers. The two fail in different ways, and the gap between
// them is where this project's worst bugs lived: every one of the 52 findings
// in the September audit was in code with green tests.
//
// The layers, in the order they run:
//
//   inventory  every screen, route and lazy bank in the app is claimed by a
//              named feature that says which layer verifies it. This is the
//              part that makes the rest trustworthy — a feature added without
//              coverage turns the run red instead of passing unnoticed.
//   server     every API route, called for real against a real SQLite
//              database: refuses a stranger, never 5xx, and the money paths
//              conserve coins.
//   client     every screen rendered for real, and its primary interaction
//              driven the way a child would.
//   live       the deployed site: the version matches, the service worker is
//              the one we shipped, every startup script really loads, and no
//              route answers a stranger.
'use strict';

const path = require('path');

const ROOT = path.join(__dirname, '..');
const C = process.stdout.isTTY
  ? { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', off: '\x1b[0m' }
  : { red: '', green: '', yellow: '', dim: '', bold: '', off: '' };

const args = process.argv.slice(2);
const wantLive = args.includes('--live');
const only = (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';

function heading(text) {
  console.log(`\n${C.bold}━━━ ${text} ${'━'.repeat(Math.max(0, 58 - text.length))}${C.off}`);
}
function line(check) {
  const mark = check.ok ? `${C.green}✓${C.off}` : `${C.red}✗${C.off}`;
  console.log(`  ${mark} ${check.feature}`);
  if (check.detail) {
    const colour = check.ok ? C.dim : C.yellow;
    console.log(`      ${colour}${check.detail}${C.off}`);
  }
}

async function layer(name, title, run) {
  if (only && only !== name) return [];
  heading(title);
  let checks;
  const started = Date.now();
  try {
    checks = (await run()).checks;
  } catch (e) {
    // A layer that cannot even run is a failure, not a skip. Swallowing this
    // is how a verification process quietly stops verifying anything.
    console.log(`  ${C.red}✗${C.off} lớp kiểm tra "${name}" không chạy được`);
    console.log(`      ${C.yellow}${e && e.stack ? e.stack.split('\n').slice(0, 4).join('\n      ') : e}${C.off}`);
    return [{ id: name + '-crashed', feature: `Lớp ${name} chạy được`, ok: false, detail: String(e && e.message || e) }];
  }
  for (const c of checks) line(c);
  const failed = checks.filter(c => !c.ok).length;
  console.log(`  ${C.dim}${checks.length} mục, ${failed} lỗi, ${((Date.now() - started) / 1000).toFixed(1)}s${C.off}`);
  return checks;
}

// A layer that has not been written yet must be loud about it. Silence here
// would read exactly like "everything passed".
function loadLayer(rel, fnName) {
  try {
    const mod = require(path.join(ROOT, rel));
    if (typeof mod[fnName] !== 'function') throw new Error(`${rel} không export ${fnName}()`);
    return mod[fnName];
  } catch (e) {
    // First line only: a require stack in the summary drowns the one thing
    // the reader needs, which is WHICH layer is missing.
    const why = String(e && e.message || e).split('\n')[0];
    return async () => ({ checks: [{ id: rel, feature: `Lớp ${rel} tồn tại và chạy được`, ok: false,
      detail: 'không nạp được: ' + why }] });
  }
}

(async () => {
  console.log(`${C.bold}Kiểm tra tính năng${C.off} ${C.dim}— ${wantLive ? 'mã nguồn + bản đang chạy' : 'mã nguồn'}${C.off}`);
  const all = [];

  all.push(...await layer('inventory', 'BẢN KÊ — app có gì, ai kiểm cái đó',
    loadLayer('tests/verify/manifest.js', 'verifyInventory')));
  all.push(...await layer('server', 'MÁY CHỦ — mọi route, gọi thật, cơ sở dữ liệu thật',
    loadLayer('tests/verify/server.js', 'verifyServer')));
  all.push(...await layer('client', 'MÀN HÌNH — vẽ thật, bấm thật',
    loadLayer('tests/verify/client.js', 'verifyClient')));
  if (wantLive) {
    all.push(...await layer('live', 'BẢN ĐANG CHẠY — thứ các bé đang mở',
      loadLayer('tests/verify/live.js', 'verifyLive')));
  }

  const failed = all.filter(c => !c.ok);
  console.log('\n' + '═'.repeat(62));
  if (!failed.length) {
    console.log(`${C.green}${C.bold}✓ ${all.length} mục — không tính năng nào bị ảnh hưởng${C.off}`);
  } else {
    console.log(`${C.red}${C.bold}✗ ${failed.length} lỗi trong ${all.length} mục${C.off}`);
    for (const f of failed) console.log(`  ${C.red}•${C.off} ${f.feature}${C.dim} — ${f.detail || ''}${C.off}`);
  }
  console.log('═'.repeat(62));
  if (!wantLive) console.log(`${C.dim}Thêm --live để kiểm cả bản đang chạy trên máy các bé.${C.off}`);
  process.exit(failed.length ? 1 : 0);
})();
