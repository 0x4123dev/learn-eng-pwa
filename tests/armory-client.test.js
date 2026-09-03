// Kho Khiên & Kiếm on the client: js/armory.js + js/daily-task.js mounted
// against the DOM shim, driven the way a child would — open it, tap a gift
// choice, watch the collection light up — and the redesigned task screen.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createDocument } = require('./domshim');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TODAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 17 * 3600000).toISOString().slice(0, 10);

const TASKS = [
  { id: 1, kind: 'units:hk1-mix', label: 'Units HK1 · 🎲 Mix', target: 5, count: 2, done: false },
  { id: 2, kind: 'phrases', label: 'Phrases practice', target: 1, count: 1, done: true },
];
function stateWith(over) {
  return { dailyTask: Object.assign({
    fetchedAt: Date.now(), date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false,
    shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [],
  }, over || {}) };
}

function mount(opts) {
  opts = opts || {};
  const doc = createDocument(
    '<div class="app"><div class="screens-container">'
    + '<div class="screen active" id="homeScreen"><div id="dailyTaskCard"></div></div>'
    + '<div class="screen daily-task-screen" id="dailyTaskScreen"></div>'
    + '<div class="screen" id="nightRaidScreen"></div>'
    + '</div><div id="bottomNav"></div></div>');
  const calls = [];
  const ctx = {
    console, Date, Math, JSON, Object, Array, Promise, Number, String, RegExp, Error, Set, Map,
    setTimeout, clearTimeout,
    document: doc,
    appState: opts.appState || {},
    currentUser: 'kid',
    saveUserData: () => calls.push(['save']),
    showToast: m => calls.push(['toast', String(m)]),
    createConfetti: () => calls.push(['confetti']),
    switchScreen: id => {
      calls.push(['switchScreen', id]);
      if (opts.switchOk === false) return false;
      const next = doc.getElementById(id);
      if (!next) return false;
      for (const s of doc.querySelectorAll('.screen')) s.classList.remove('active');
      next.classList.add('active');
      return true;
    },
    setBottomNavActive: s => calls.push(['nav', s]),
    NightRaid: { renderHome: () => calls.push(['nrRenderHome']) },
    EngAuth: {
      tokenFor: () => (opts.token === undefined ? 'tok' : opts.token),
      api: async (p, o) => { calls.push(['api', p, (o && o.method) || 'GET', o && o.body]); return opts.api ? opts.api(p, o) : { ok: false, data: null }; },
      refreshFlags: () => calls.push(['refreshFlags']),
    },
  };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  for (const f of ['js/night-raid-rules.js', 'js/daily-task-catalog.js', 'js/daily-task.js', 'js/armory.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const html = id => { const el = doc.getElementById(id); return el ? el.innerHTML : ''; };
  return { ctx, doc, calls, html, Armory: ctx.Armory, DailyTask: ctx.DailyTask, Rules: ctx.NightRaidRules };
}

suite('armory client: the collection', () => {
  test('0/0 and nothing waiting: dashed silhouettes, an empty gift, no claim buttons, +0 DAM', () => {
    const { Armory, html } = mount({ appState: stateWith() });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('Kho Khiên &amp; Kiếm'));
    assert.truthy(out.includes('Chưa có quà chờ mở'));
    assert.falsy(out.includes('Armory.claim('), 'nothing to claim');
    assert.falsy(out.includes('Armory.claimAll('));
    assert.truthy(out.includes('am-card shield empty'), 'the shield card is a silhouette');
    assert.truthy(out.includes('am-card sword empty'));
    assert.truthy(out.includes('+0 DAM'));
    assert.truthy(out.includes('0/10 kiếm'));
    assert.truthy(out.includes('mở quà để lấy khiên'), 'the empty slot says what could be earned');
    assert.falsy(out.includes('Armory.activateShield()'), 'no shield to activate');
  });

  test('two gifts, two shields, three swords: the gift lists both choices for the oldest day, offers open-all, cards are lit, +30 DAM · 3/10', () => {
    const { Armory, html } = mount({ appState: stateWith({ pending: [YESTERDAY, TODAY], shields: { count: 2, activeUntil: 0 }, swords: { count: 3 } }) });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('2 món quà'), out);
    assert.truthy(out.includes('am-gift has'), 'the gift card is lit (and pulses)');
    assert.truthy(out.includes(`Armory.claim('${YESTERDAY}','shield')`), 'the oldest day is the one being opened');
    assert.truthy(out.includes(`Armory.claim('${YESTERDAY}','sword')`));
    assert.falsy(out.includes(`Armory.claim('${TODAY}'`), 'the newer day waits its turn');
    assert.truthy(out.includes('Quà Hôm qua'));
    assert.truthy(out.includes('còn 1 quà nữa'));
    assert.truthy(out.includes("Armory.claimAll('shield')"));
    assert.truthy(out.includes("Armory.claimAll('sword')"));
    assert.truthy(out.includes('am-card shield has'));
    assert.truthy(out.includes('am-card sword has'));
    assert.truthy(out.includes('>x2<'), 'shield count badge');
    assert.truthy(out.includes('>x3<'), 'sword count badge');
    assert.truthy(out.includes('+30 DAM'));
    assert.truthy(out.includes('3/10 kiếm'));
    assert.truthy(out.includes('Armory.activateShield()'), 'shields can be switched on from here');
    assert.truthy(out.includes('24 giờ không ai cướp được nhà'), 'one line says what a shield does');
    assert.truthy(out.includes('+10 DAM mỗi lần đi cướp'), 'one line says what a sword does');
    assert.equal((out.match(/class="am-meter"/g) || []).length, 1);
    assert.equal((out.match(/<i class="on"><\/i>/g) || []).length, 3, 'three of ten meter segments lit');
  });

  test('a single gift has no open-all row; the choices name today', () => {
    const { Armory, html } = mount({ appState: stateWith({ pending: [TODAY] }) });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('1 món quà'));
    assert.truthy(out.includes('Quà Hôm nay'));
    assert.falsy(out.includes('Armory.claimAll('));
  });

  test('the sword cap: 12 swords show +100 DAM · 10/10 and the "pick shields now" hint', () => {
    const { Armory, html, Rules } = mount({ appState: stateWith({ swords: { count: 12 } }) });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('+' + Rules.swordBonus(12) + ' DAM'));
    assert.truthy(out.includes('+100 DAM'));
    assert.truthy(out.includes('10/10 kiếm'));
    assert.truthy(out.includes('>x12<'), 'the stock itself is still shown');
    assert.truthy(out.includes('Lần sau chọn khiên nhé'));
  });

  test('an active shield reads as a status pill with the time left, and cannot be re-activated', () => {
    const { Armory, html } = mount({ appState: stateWith({ shields: { count: 1, activeUntil: Date.now() + 2 * 3600000 + 5 * 60000 } }) });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('dt-pill on'));
    assert.truthy(out.includes('Đang bảo vệ'));
    assert.truthy(/còn 2 giờ/.test(out), out.match(/còn [^<]*/)[0]);
    assert.falsy(out.includes('Armory.activateShield()'));
  });

  test('fmtDay speaks like a child: Hôm nay, Hôm qua, then dd/mm; junk is escaped, not trusted', () => {
    const { Armory } = mount({ appState: stateWith() });
    assert.equal(Armory.fmtDay(TODAY), 'Hôm nay');
    assert.equal(Armory.fmtDay(YESTERDAY), 'Hôm qua');
    assert.equal(Armory.fmtDay('2026-08-30'), '30/08');
    assert.equal(Armory.fmtDay('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  });

  test('"đã mở gần đây" lists only days that were opened', () => {
    const { Armory, html } = mount({ appState: stateWith({ pending: [TODAY], recent: [{ date: TODAY, kind: null }, { date: '2026-08-30', kind: 'sword' }, { date: '2026-08-29', kind: 'shield' }] }) });
    Armory.render();
    const out = html('armoryScreen');
    assert.truthy(out.includes('30/08 · ⚔️ Kiếm'));
    assert.truthy(out.includes('29/08 · 🛡️ Khiên'));
    assert.equal((out.match(/<li>/g) || []).length, 2, 'the pending day is not listed as opened');
  });
});

suite('armory client: opening and closing', () => {
  test('open() builds #armoryScreen beside #dailyTaskScreen, switches to it, paints, and refreshes', async () => {
    const { Armory, doc, calls, html } = mount({ appState: stateWith({ pending: [TODAY] }) });
    assert.falsy(doc.getElementById('armoryScreen'), 'index.html does not carry the screen');
    assert.equal(Armory.open(), true);
    const el = doc.getElementById('armoryScreen');
    assert.truthy(el, 'the screen was created');
    assert.truthy(el.classList.contains('screen') && el.classList.contains('daily-task-screen'), el.className);
    assert.truthy(el.classList.contains('active'), 'and switched to');
    assert.equal(el.parentElement && el.parentElement.className, 'screens-container', 'same parent as the other screens');
    assert.truthy(html('armoryScreen').includes('1 món quà'));
    assert.truthy(calls.some(c => c[0] === 'switchScreen' && c[1] === 'armoryScreen'));
    await new Promise(r => setTimeout(r, 0));
    assert.truthy(calls.some(c => c[0] === 'api' && c[1] === 'me/daily-tasks'), 'a fresh poll, not the 30 s cache');
    Armory.open();
    assert.equal(doc.querySelectorAll('#armoryScreen').length, 1, 'opening twice does not build a second screen');
  });

  test('a refused switchScreen paints nothing', () => {
    const { Armory, html, calls } = mount({ appState: stateWith(), switchOk: false });
    assert.equal(Armory.open(), false);
    assert.equal(html('armoryScreen'), '');
    assert.falsy(calls.some(c => c[0] === 'api'));
  });

  test('close() goes back where the child came from and repaints that screen', () => {
    const { Armory, DailyTask, doc, calls, html } = mount({ appState: stateWith({ pending: [TODAY], swords: { count: 2 } }) });
    // From Home.
    Armory.open(); Armory.close();
    assert.truthy(doc.getElementById('homeScreen').classList.contains('active'));
    // From the task screen.
    DailyTask.open();
    Armory.open();
    doc.getElementById('dailyTaskScreen').innerHTML = '';
    Armory.close();
    assert.truthy(doc.getElementById('dailyTaskScreen').classList.contains('active'));
    assert.truthy(html('dailyTaskScreen').includes('Nhiệm vụ hôm nay'), 'the task screen is repainted');
    // From the Night Raid home — its HUD shows DAM, which the swords change.
    calls.length = 0;
    doc.getElementById('nightRaidScreen').classList.add('active');
    for (const s of doc.querySelectorAll('.screen')) if (s.id !== 'nightRaidScreen') s.classList.remove('active');
    Armory.open(); Armory.close();
    assert.truthy(doc.getElementById('nightRaidScreen').classList.contains('active'));
    assert.truthy(calls.some(c => c[0] === 'nrRenderHome'), 'Night Raid home re-rendered with the new DAM');
  });
});

function claimReply(over) {
  return { ok: true, data: Object.assign({ ok: true, date: YESTERDAY, kind: 'sword',
    armory: { shields: { count: 0, activeUntil: 0 }, swords: { count: 1 }, pending: [TODAY], recent: [{ date: TODAY, kind: null }, { date: YESTERDAY, kind: 'sword' }], ready: true } }, over || {}) };
}

suite('armory client: opening a gift', () => {
  test('claim posts {date, kind}, folds the reply into appState, celebrates, and the card pops with its badge counting up', async () => {
    const { Armory, ctx, calls, html } = mount({
      appState: stateWith({ pending: [YESTERDAY, TODAY] }),
      api: async p => (p === 'daily-task/claim' ? claimReply() : { ok: false, data: null }),
    });
    Armory.render();
    assert.equal(await Armory.claim(YESTERDAY, 'sword'), true);
    const post = calls.find(c => c[0] === 'api' && c[1] === 'daily-task/claim');
    assert.truthy(post, 'POSTed');
    assert.equal(post[2], 'POST');
    assert.deepEqual(post[3], { date: YESTERDAY, kind: 'sword' });
    assert.equal(ctx.appState.dailyTask.swords.count, 1, 'the reply is the truth');
    assert.deepEqual(ctx.appState.dailyTask.pending, [TODAY]);
    assert.deepEqual(ctx.appState.dailyTask.tasks, TASKS, 'tasks untouched');
    assert.truthy(calls.some(c => c[0] === 'save'), 'persisted');
    assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes('+1 kiếm') && c[1].includes('+10 DAM')), JSON.stringify(calls.filter(c => c[0] === 'toast')));
    assert.truthy(calls.some(c => c[0] === 'confetti'));
    const out = html('armoryScreen');
    assert.truthy(out.includes('am-card sword has am-celebrate'), 'the sword card pops');
    assert.falsy(out.includes('am-card shield has am-celebrate') || out.includes('am-card shield empty am-celebrate'), 'only the claimed card');
    assert.truthy(out.includes('class="am-burst"'), 'sparks');
    assert.truthy(out.includes('data-from="0" data-to="1"'), 'the badge counts from 0 up to 1');
    assert.truthy(html('dailyTaskCard').includes('⚔️ 1'), 'the home card follows');
    await new Promise(r => setTimeout(r, 900));
    assert.truthy(out.includes(`Armory.claim('${TODAY}','shield')`), 'the next gift is offered');
  });

  test('claim-all posts {kind} and says how many were opened', async () => {
    const { Armory, calls, ctx } = mount({
      appState: stateWith({ pending: [YESTERDAY, TODAY, '2026-08-30'], shields: { count: 1, activeUntil: 0 } }),
      api: async p => (p === 'daily-task/claim-all'
        ? { ok: true, data: { ok: true, kind: 'shield', claimed: 3, armory: { shields: { count: 4, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [] } } }
        : { ok: false, data: null }),
    });
    assert.equal(await Armory.claimAll('shield'), true);
    const post = calls.find(c => c[0] === 'api' && c[1] === 'daily-task/claim-all');
    assert.deepEqual(post[3], { kind: 'shield' });
    assert.equal(ctx.appState.dailyTask.shields.count, 4);
    assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes('+3 khiên')));
  });

  test('a double tap sends one POST; the buttons are disabled while it is in flight', async () => {
    let posts = 0;
    const { Armory, html } = mount({
      appState: stateWith({ pending: [YESTERDAY] }),
      api: async p => { if (p === 'daily-task/claim') { posts++; return new Promise(r => setTimeout(() => r(claimReply({ armory: { shields: { count: 0, activeUntil: 0 }, swords: { count: 1 }, pending: [], recent: [] } })), 5)); } return { ok: false, data: null }; },
    });
    Armory.render();
    const first = Armory.claim(YESTERDAY, 'sword');
    assert.truthy(html('armoryScreen').includes('am-choice sword" onclick="Armory.claim(\'' + YESTERDAY + '\',\'sword\')" disabled'), 'disabled while pending: ' + html('armoryScreen').slice(0, 400));
    const second = Armory.claim(YESTERDAY, 'sword');
    await first; await second;
    assert.equal(posts, 1);
    assert.falsy(html('armoryScreen').includes(' disabled'), 're-enabled afterwards');
  });

  test('every refusal is explained in the child\'s words, and the armory in the refusal still repaints the screen', async () => {
    const cases = [['claimed', 'con mở rồi'], ['no_reward', 'chưa có quà'], ['not_ready', 'nâng cấp']];
    for (const [code, words] of cases) {
      const { Armory, calls, ctx } = mount({
        appState: stateWith({ pending: [YESTERDAY] }),
        api: async () => ({ ok: false, status: 409, data: { code, armory: { shields: { count: 5, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [] } } }),
      });
      assert.equal(await Armory.claim(YESTERDAY, 'shield'), false);
      assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes(words)), code + ' → ' + JSON.stringify(calls.filter(c => c[0] === 'toast')));
      assert.equal(ctx.appState.dailyTask.shields.count, 5, 'the server\'s view wins even on a refusal');
      assert.deepEqual(ctx.appState.dailyTask.pending, []);
      assert.falsy(calls.some(c => c[0] === 'confetti'), 'no celebration for a refusal');
    }
  });

  test('offline: the thrown request is caught and explained; nothing is left disabled', async () => {
    const { Armory, calls, html } = mount({ appState: stateWith({ pending: [YESTERDAY] }), api: async () => { throw new Error('down'); } });
    assert.equal(await Armory.claim(YESTERDAY, 'sword'), false);
    assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes('Không có mạng')));
    assert.falsy(html('armoryScreen').includes(' disabled'));
  });

  test('without a login the child is asked to sign in and nothing is sent', async () => {
    const { Armory, calls } = mount({ appState: stateWith({ pending: [YESTERDAY] }), token: null });
    assert.equal(await Armory.claim(YESTERDAY, 'sword'), false);
    assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes('Đăng nhập')));
    assert.falsy(calls.some(c => c[0] === 'api'));
  });

  test('activating a shield from the armory goes through DailyTask and repaints as protected', async () => {
    const { Armory, html } = mount({
      appState: stateWith({ shields: { count: 1, activeUntil: 0 } }),
      api: async p => (p === 'night-raid/shield'
        ? { ok: true, data: {} }
        : { ok: true, data: { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: Date.now() + 24 * 3600000 }, swords: { count: 0 }, pending: [], recent: [] } }),
    });
    Armory.render();
    assert.truthy(html('armoryScreen').includes('Armory.activateShield()'));
    await Armory.activateShield();
    const out = html('armoryScreen');
    assert.truthy(out.includes('Đang bảo vệ'), out);
    assert.truthy(out.includes('>x0<'));
    assert.falsy(out.includes('Armory.activateShield()'));
  });
});

suite('daily task client: what the gift changed on the home card and the task screen', () => {
  test('the home card carries the collection chip and a gift badge that opens the armory', () => {
    const { DailyTask, html } = mount({ appState: stateWith({ pending: [YESTERDAY, TODAY], shields: { count: 1, activeUntil: 0 }, swords: { count: 3 } }) });
    DailyTask.renderHomeCard();
    const out = html('dailyTaskCard');
    assert.truthy(out.includes('class="dt-card-badge">2<'), out);
    assert.truthy(out.includes('2 phần thưởng chờ con chọn'), 'the count is read out in the card label');
    assert.truthy(out.includes('🛡️ 1 ⚔️ 3'));
    assert.truthy(out.includes('Armory.open()'));
    assert.truthy(out.includes('DailyTask.open()'), 'the card itself still opens the task list');
    const none = mount({ appState: stateWith({ pending: [] }) });
    none.DailyTask.renderHomeCard();
    assert.falsy(none.html('dailyTaskCard').includes('dt-card-badge'), 'no gift → no bubble');
  });

  test('a child whose tasks were switched off but who still has a gift still sees the card', () => {
    const { DailyTask, html } = mount({ appState: stateWith({ tasks: [], pending: [YESTERDAY] }) });
    DailyTask.renderHomeCard();
    assert.truthy(html('dailyTaskCard').includes('1 phần thưởng chờ con chọn'));
    const empty = mount({ appState: stateWith({ tasks: [], pending: [] }) });
    empty.DailyTask.renderHomeCard();
    assert.equal(empty.html('dailyTaskCard'), '', 'nothing assigned, nothing waiting → no card');
  });

  test('the completion toast says a gift is waiting, with the count, instead of "+1 khiên"', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [YESTERDAY, TODAY], recent: [] };
    const { DailyTask, calls, ctx } = mount({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    const toast = calls.find(c => c[0] === 'toast');
    assert.truthy(toast, 'celebrated');
    assert.truthy(toast[1].includes('+200 xu'), toast[1]);
    assert.truthy(toast[1].includes('có 2 phần thưởng chờ con chọn'), toast[1]);
    assert.falsy(toast[1].includes('khiên'), 'no shield is promised — the child chooses');
    assert.deepEqual(ctx.appState.dailyTask.pending, [YESTERDAY, TODAY], 'stored');
    assert.deepEqual(ctx.appState.dailyTask.swords, { count: 0 });
  });

  test('a new pending day is worth a profile write; the same reply again is not', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [] };
    const { DailyTask, calls } = mount({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 1);
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 1);
    reply.pending = [YESTERDAY];
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 2, 'a gift arrived → written');
    reply.swords = { count: 1 }; reply.pending = [];
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 3, 'a sword arrived → written');
  });

  test('refresh("armory") is never served from the 30 s cache', async () => {
    let n = 0;
    const { DailyTask } = mount({ appState: stateWith(), api: async () => { n++; return { ok: true, data: { date: TODAY, tasks: TASKS, shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [], recent: [] } }; } });
    await DailyTask.refresh('home');
    assert.equal(n, 0);
    await DailyTask.refresh('armory');
    assert.equal(n, 1);
  });

  test('the task screen: ring shows done/total, tasks are check rows, the strip shows both stocks, the gift button appears only when something waits', () => {
    let r = mount({ appState: stateWith({ swords: { count: 3 }, shields: { count: 0, activeUntil: 0 } }) });
    r.DailyTask.renderScreen();
    let out = r.html('dailyTaskScreen');
    assert.truthy(out.includes('class="dt-ring"'));
    assert.truthy(out.includes('<b>1/2</b>'), 'one of two done in the ring');
    assert.truthy(out.includes('Còn 1 nhiệm vụ nữa thôi!'));
    assert.equal((out.match(/class="dt-check"/g) || []).length, 2, 'a check circle per task');
    assert.truthy(out.includes('dt-mini sword has'), 'swords owned → lit');
    assert.truthy(out.includes('dt-mini shield "') || out.includes('dt-mini shield "'), 'no shields → silhouette');
    assert.truthy(out.includes('<b>x3</b>'));
    assert.falsy(out.includes('dt-gift-cta'), 'no gift waiting');
    assert.truthy(out.includes('Mở Kho Khiên'));
    r = mount({ appState: stateWith({ pending: [TODAY], tasks: TASKS.map(t => Object.assign({}, t, { count: t.target, done: true })), allDone: true, rewardedToday: true }) });
    r.DailyTask.renderScreen();
    out = r.html('dailyTaskScreen');
    assert.truthy(out.includes('dt-hero done'));
    assert.truthy(out.includes('Hôm nay xong rồi 🎉'));
    assert.truthy(out.includes('<b>2/2</b>'));
    assert.truthy(out.includes('dt-gift-cta') && out.includes('Mở quà nào!'));
    assert.truthy(out.includes('stroke-dashoffset:0.0'), 'the ring is full');
  });

  test('the ring geometry: an empty day leaves the arc fully undrawn, half a day draws half', () => {
    const { DailyTask, html } = mount({ appState: stateWith({ tasks: [TASKS[0], TASKS[0], TASKS[1], TASKS[1]] }) });
    DailyTask.renderScreen();
    assert.truthy(html('dailyTaskScreen').includes('stroke-dashoffset:81.7'), 'half of 163.4');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
