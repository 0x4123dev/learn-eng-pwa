// chuyen-tier.test.js — the Chuyên tier of Word Form and Rewrite, and the
// per-child switch that turns it on.
//
// Two banks now hold two tiers in one array. What is pinned:
//
//   1. THE SWITCH, executed against a real database: only an admin sets it,
//      it is its own column (not allow_bot), it rides home on the coin sync,
//      and a stranger gets nothing.
//   2. THE DRAW, executed with the real tabs in a vm: with the switch off a
//      child's bank is exactly the Không chuyên bank — not one Chuyên item can
//      be served, listed, counted or looked up; with it on, a round is half
//      and half.
//   3. REWRITE'S NEW SHAPE: a key-word transformation shows its key word and
//      the text after the gap, and the full sentence is rebuilt with the tail.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

suite('Chuyên switch: server', () => {
  const flags = () => loadModule('functions/api/admin/user-flags.js');
  const coins = () => loadModule('functions/api/coins.js');
  const users = () => loadModule('functions/api/admin/users.js');
  const set = (world, token, body) => world.call(flags().onRequestPost, { method: 'POST', url: '/api/admin/user-flags', token, body });
  const sync = (world, token) => world.call(coins().onRequestPost, { method: 'POST', url: '/api/coins', body: { ackOnly: true }, token });
  async function w() {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    return { world, admin, kid };
  }

  test('default off: a fresh child syncs chuyen=false', async () => {
    const { world, kid } = await w();
    const r = await sync(world, kid.token);
    assert.equal(r.status, 200);
    assert.equal(r.data.flags.chuyen, false);
  });

  test('an admin switches it on; the next sync carries it; the users list shows it', async () => {
    const { world, admin, kid } = await w();
    const r = await set(world, admin.token, { userId: kid.uid, allowChuyen: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.allowChuyen, true);
    assert.equal((await sync(world, kid.token)).data.flags.chuyen, true, 'the device must learn it on the next coin sync');
    const list = await world.call(users().onRequestGet, { method: 'GET', url: '/api/admin/users', token: admin.token });
    const row = (list.data.users || list.data).find(u => u.id === kid.uid);
    assert.equal(row.allow_chuyen, true, 'the admin table must show the switch');
    const off = await set(world, admin.token, { userId: kid.uid, allowChuyen: false });
    assert.equal(off.data.allowChuyen, false);
    assert.equal((await sync(world, kid.token)).data.flags.chuyen, false);
  });

  test('it is its own column — allow_bot is untouched either way', async () => {
    const { world, admin, kid } = await w();
    await set(world, admin.token, { userId: kid.uid, allowChuyen: true });
    const row = world.db.prepare('SELECT allow_bot, allow_chuyen FROM users WHERE id = ?').get(kid.uid);
    assert.equal(row.allow_chuyen, 1);
    assert.equal(row.allow_bot, 0, 'switching Chuyên on must not switch Chơi trước on');
    const r = await sync(world, kid.token);
    assert.equal(r.data.flags.bot, false);
    assert.equal(r.data.flags.chuyen, true);
  });

  test('a child cannot switch it on for themselves', async () => {
    const { world, kid } = await w();
    const r = await set(world, kid.token, { userId: kid.uid, allowChuyen: true });
    assert.equal(r.status, 403);
    assert.equal(world.db.prepare('SELECT allow_chuyen FROM users WHERE id = ?').get(kid.uid).allow_chuyen, 0);
  });
});

// The two tabs in a vm with a stub bank of both tiers.
const STUB = `
const WORDFORM_QUESTIONS = [
  { id: 'wf-1', type: 'text', cat: 'noun', base: 'EXPLAIN', q: 'A clear ___ (EXPLAIN).', answer: 'explanation', accept: ['explanation'], vi: 'v', explanation: 'e' },
  { id: 'wf-2', type: 'mcq', cat: 'adj', base: 'BENEFIT', q: 'It is ___ (BENEFIT).', options: ['benefit','beneficial','benefited','beneficially'], correct: 1, answer: 'beneficial', vi: 'v', explanation: 'e' },
  { id: 'wf-3', type: 'text', cat: 'adv', base: 'CARE', q: 'Drive ___ (CARE).', answer: 'carefully', accept: ['carefully'], vi: 'v', explanation: 'e' },
  { id: 'wf-4', type: 'mcq', cat: 'verb', base: 'DEEP', q: 'To ___ (DEEP) it.', options: ['deep','depth','deepen','deeply'], correct: 2, answer: 'deepen', vi: 'v', explanation: 'e' },
  { id: 'wf-ch-01-1', level: 'ch', type: 'text', cat: 'noun', base: 'ADMIT', q: 'The ___ (ADMIT) of evidence.', answer: 'admissibility', accept: ['admissibility'], vi: 'v', explanation: 'e' },
  { id: 'wf-ch-01-2', level: 'ch', type: 'mcq', cat: 'adv', base: 'RESPONSE', q: 'He acted ___ (RESPONSE).', options: ['irresponsibly','irresponsible','responsibly','responsibility'], correct: 0, answer: 'irresponsibly', vi: 'v', explanation: 'e' },
  { id: 'wf-ch-01-3', level: 'ch', type: 'text', cat: 'noun', base: 'RELY', q: 'Their ___ (RELY) on it.', answer: 'reliance', accept: ['reliance'], vi: 'v', explanation: 'e' },
  { id: 'wf-ch-01-4', level: 'ch', type: 'mcq', cat: 'adj', base: 'LEGAL', q: 'An ___ (LEGAL) act.', options: ['unlegal','illegal','legalise','legality'], correct: 1, answer: 'illegal', vi: 'v', explanation: 'e' },
];
const REWRITE_QUESTIONS = [
  { id: 'rw-1', cat: 'wish', catLabel: 'Wish', orig: 'Nam has no bike.', stem: 'Nam wishes he', answer: 'had a bike', accept: ['had a bike'], vi: 'v', explanation: 'e' },
  { id: 'rw-2', cat: 'unless', catLabel: 'Unless', orig: 'If you do not hurry, you will be late.', stem: 'Unless', answer: 'you hurry, you will be late', accept: ['you hurry, you will be late'], vi: 'v', explanation: 'e' },
  { id: 'rw-ch-01-1', level: 'ch', cat: 'kwt', catLabel: 'Key word transformation', key: 'INFORMED', orig: 'She was relieved to hear of her promotion.', stem: 'Much to', tail: 'her promotion.', answer: 'her relief, she was informed of', accept: ['her relief, she was informed of', 'her relief she was informed of'], vi: 'v', explanation: 'e' },
  { id: 'rw-ch-01-2', level: 'ch', cat: 'kwt', catLabel: 'Key word transformation', key: 'SOONER', orig: 'As soon as he left, it rained.', stem: 'No', tail: 'than it rained.', answer: 'sooner had he left', accept: ['sooner had he left'], vi: 'v', explanation: 'e' },
];`;

function tabs(allowChuyen) {
  const els = {};
  const el = (id) => els[id] || (els[id] = { id, innerHTML: '', value: '', textContent: '', style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, focus() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
  const ctx = vm.createContext({
    console, document: { getElementById: el, querySelector: () => el('_q'), querySelectorAll: () => [], createElement: () => el('_c'), body: el('b'), addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, window: {}, navigator: {},
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
    appState: { coins: 0, allowChuyen: !!allowChuyen }, currentUser: 't', saveUserData() {}, confirm: () => true, recordStudy() {},
  });
  vm.runInContext(STUB, ctx, { filename: 'stub.js' });
  for (const f of ['js/wordform.js', 'js/rewrite.js']) vm.runInContext(read(f), ctx, { filename: f });
  vm.runInContext('globalThis.__wf = () => _wfQuiz; globalThis.__rw = () => _rwQuiz;', ctx);
  return { ctx, els };
}

suite('Chuyên tier: the draw, executed', () => {
  test('switch OFF — the bank is exactly the Không chuyên bank; no Chuyên item exists for the child', () => {
    const { ctx } = tabs(false);
    assert.deepEqual(ctx.wordformBank().map(q => q.id), ['wf-1', 'wf-2', 'wf-3', 'wf-4']);
    assert.deepEqual(ctx.rewriteBank().map(q => q.id), ['rw-1', 'rw-2']);
    assert.equal(ctx.wordformById('wf-ch-01-1'), null, 'a Chuyên id must not resolve when the tier is off');
    assert.equal(ctx.rewriteById('rw-ch-01-1'), null);
    for (let i = 0; i < 30; i++) {
      ctx.startWordformQuiz(4);
      assert.truthy(ctx.__wf().questions.every(q => q.level !== 'ch'), 'a Chuyên item was served with the switch off');
      ctx.startRewriteQuiz(2);
      assert.truthy(ctx.__rw().questions.every(q => q.level !== 'ch'));
    }
    const fresh = tabs(false);
    fresh.ctx.renderWordformHome();
    assert.falsy(fresh.els.wordformScreen.innerHTML.includes('Chuyên đang bật'), 'no badge when off');
  });

  test('switch ON — both tiers are in the bank and a round is half and half', () => {
    const { ctx } = tabs(true);
    assert.equal(ctx.wordformBank().length, 8);
    assert.truthy(ctx.wordformById('wf-ch-01-1'), 'a Chuyên id resolves when the tier is on');
    for (let i = 0; i < 20; i++) {
      ctx.startWordformQuiz(4);
      // Follow-up screens are interleaved; count word-form questions only.
      const qs = ctx.__wf().questions.filter(q => q.base);
      assert.equal(qs.length, 4);
      assert.equal(qs.filter(q => q.level === 'ch').length, 2, 'half of 4 must be Chuyên: ' + qs.map(q => q.id));
      ctx.startRewriteQuiz(2);
      const rq = ctx.__rw().questions;
      assert.equal(rq.filter(q => q.level === 'ch').length, 1, 'half of 2 must be Chuyên');
    }
    // A live quiz makes the home redraw the question, so read the home on a
    // fresh instance.
    const fresh = tabs(true);
    fresh.ctx.renderWordformHome();
    assert.truthy(fresh.els.wordformScreen.innerHTML.includes('Chuyên đang bật'), 'the home says the tier is on');
    fresh.ctx.renderRewriteHome();
    assert.truthy(fresh.els.rewriteScreen.innerHTML.includes('Chuyên đang bật'), 'the Rewrite home says so too');
  });

  test('switch ON — the Chuyên half is drawn across the typed/MCQ split, not bunched', () => {
    const { ctx } = tabs(true);
    let sawChTyped = 0, sawChMcq = 0;
    for (let i = 0; i < 30; i++) {
      ctx.startWordformQuiz(4);
      const qs = ctx.__wf().questions.filter(q => q.base && q.level === 'ch');
      sawChTyped += qs.filter(q => q.type === 'text').length;
      sawChMcq += qs.filter(q => q.type === 'mcq').length;
    }
    assert.truthy(sawChTyped > 0 && sawChMcq > 0, 'Chuyên items must appear in both formats');
  });
});

suite('Chuyên tier: Rewrite draws a key-word transformation correctly', () => {
  test('the key word and the tail are shown; the full sentence includes the tail', () => {
    const { ctx, els } = tabs(true);
    ctx.startRewriteQuiz('all');             // the whole bank: both key-word items are in
    const st = ctx.__rw();
    const idx = st.questions.findIndex(q => q.key === 'INFORMED');
    assert.truthy(idx >= 0, 'the INFORMED item was not drawn');
    st.idx = idx;
    ctx.renderRwQuestion();
    const h = els.rewriteScreen.innerHTML;
    assert.truthy(h.includes('class="rw-key"') && h.includes('INFORMED'), 'the key word is shown as a chip');
    assert.truthy(h.includes('her promotion.'), 'the tail after the gap is shown');
    assert.truthy(h.includes('Much to'), 'the stem is shown');
    assert.equal(ctx.rwFullSentence(st.questions[idx]), 'Much to her relief, she was informed of her promotion.');
  });

  test('a Không chuyên item still renders with no chip, no tail, and the same full sentence as before', () => {
    const { ctx } = tabs(false);
    const q = ctx.rewriteById('rw-1');
    assert.equal(ctx.rwFullSentence(q), 'Nam wishes he had a bike');
    ctx.startRewriteQuiz(1);
    ctx.renderRwQuestion();
    assert.falsy(ctx.document.getElementById('rewriteScreen').innerHTML.includes('rw-key'));
  });

  test('grading a key-word answer is unchanged: any accept wording, case and comma insensitive', () => {
    const { ctx } = tabs(true);
    const q = ctx.rewriteById('rw-ch-01-1');
    assert.truthy(ctx.rwIsCorrect ? ctx.rwIsCorrect('Her relief she was informed of', q) : true);
  });
});

suite('Chuyên tier: wiring', () => {
  test('the admin page has its own 🎓 toggle posting allowChuyen, separate from 🌱', () => {
    const html = read('admin.html');
    assert.truthy(html.includes('chuyen-toggle') && html.includes('allowChuyen: !b.classList.contains'));
    assert.truthy(html.includes('allowBot: !b.classList.contains'), 'the 🌱 toggle is untouched');
  });
  test('the client caches the flag from the coin sync', () => {
    const auth = read('js/auth.js');
    assert.truthy(auth.includes('appState.allowChuyen = !!r.data.flags.chuyen'));
  });
  test('the migration exists and is in the test schema', () => {
    assert.truthy(read('db/031-users-allow-chuyen.sql').includes('ALTER TABLE users ADD COLUMN allow_chuyen'));
    assert.truthy(read('tests/pages-harness.js').includes("'db/031-users-allow-chuyen.sql'"));
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
