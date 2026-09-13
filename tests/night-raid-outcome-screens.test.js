// The two endings and the log that remembers them.
//
// 1. "NHÀ ĐÃ TAN HOANG" — POST /start answers 200 with {ruined:true} and no
//    raid when somebody robbed this house first. Nothing is charged: no
//    ticket, no xu, either way. The wrong ending for that is a red error
//    toast; the child picked a house, tapped TIẾN QUÂN, and is owed the story
//    of the wasted march plus a card that says, in words, that it cost them
//    nothing and when they may come back.
// 2. NHẬT KÝ — the log answered "who came to MY house?" and never "how did MY
//    raids go?", so every reward and every defeat the child earned vanished
//    the moment its result card closed. Two sections now, and an older server
//    that sends no `attacks` key must simply not draw that one.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createDocument } = require('./domshim');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const Rules = require(path.join(root, 'js', 'night-raid-rules.js'));

function ctx2d() {
  return new Proxy({}, { get: (t, k) =>
    k === 'canvas' ? { width: 0, height: 0 }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
      : k === 'measureText' ? () => ({ width: 10 })
      : k === 'getImageData' ? () => ({ data: [] })
      : (typeof k === 'string' ? () => {} : undefined) });
}
function withCanvas(doc) {
  const proto = Object.getPrototypeOf(doc.createElement('canvas'));
  if (!proto.getContext) proto.getContext = function () { return ctx2d(); };
  return doc;
}

const H = 3600000, M = 60000;

function mount(server, extra) {
  const doc = withCanvas(createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div>'));
  const toasts = [], timers = [], battles = [], calls = [];
  class FakeAutoBattle {
    constructor(host, target, options) { this.target = target; this.options = options || {}; battles.push(this); }
    start() {} charge() { return true; } destroy() { this.destroyed = true; }
  }
  const api = (route, opts) => {
    const key = String(route).split('/').pop();
    calls.push({ key, opts });
    const reply = server && server[key];
    return Promise.resolve(reply === undefined ? { ok: false, data: null } : (typeof reply === 'function' ? reply(opts) : reply));
  };
  const state = {
    coins: 9000, dogLevel: 12, dogGrowthXP: 30000, allowBot: true,
    petBattleCastleSkin: 'stone-keep',
    nightRaidLayout: { cells: [], soldiers: 6, dogLane: 2 },
    nightRaidHistory: [], nightRaidClaimed: {}, nightRaidRewardToday: 0,
    nightRaidRewardDate: null, nightRaidTicketCount: 0, vaultCoins: 0,
    nightRaidStars: {}, nightRaidRouteLevel: 1,
  };
  const ctx = Object.assign({
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise,
    RegExp, Set, Map, isNaN, parseInt, parseFloat, Error,
    document: doc,
    window: { addEventListener() {}, innerWidth: 375 },
    innerWidth: 375,
    navigator: { vibrate() {} },
    NightRaidRules: Rules,
    NightRaidGame: { AutoBattle: FakeAutoBattle },
    NightRaidArt: new Proxy({}, { get: () => () => {}, has: () => true }),
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' } }), preload() {} },
    currentUser: 'Bé Na',
    appState: state,
    saveUserData() {},
    showToast(m) { toasts.push(String(m)); },
    // The win/lose card is appended from inside a setTimeout so the final
    // frame can breathe for a beat. Run those callbacks straight away, or the
    // card these tests are about never lands in the DOM at all.
    setTimeout: (fn) => { try { fn(); } catch (e) { console.warn(e); } return 0; }, clearTimeout() {},
    setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    confirm: () => true,
    EngAuth: { tokenFor: () => 'tok', api },
  }, extra || {});
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/night-raid.js'), ctx, { filename: 'js/night-raid.js' });
  return { ctx, doc, toasts, timers, battles, calls, state, screen: () => doc.getElementById('nightRaidScreen') };
}
const settle = () => new Promise(r => setImmediate(r));
const flush = async (n = 4) => { for (let i = 0; i < n; i++) await settle(); };

const FRIEND = { targetId: 7, name: 'Tí', homeLevel: 4, difficulty: 'Cân bằng', retryAt: 0 };
const friendsReply = { ok: true, data: { friends: [FRIEND], me: { hasHome: true, lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 3 } };
const targetsReply = { ok: true, data: { targets: [], ticketsLeft: 3 } };
const ACTIVE_RAID = { ok: true, data: { raid: Object.assign({}, FRIEND, {
  raidId: 'a'.repeat(32), expiresAt: Date.now() + 15 * M,
  layout: { cells: [], soldiers: 0, dogLane: 2 }, dogLevel: 1,
  attackerDamage: 50, attackerSoldiers: 6, defense: 20, castleHp: 188,
}) } };

// Walk the child in: the TẤN CÔNG row enters the moving battle directly.
async function marchOn(server, extra) {
  const w = mount(server, extra);
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showLiveTargets(); await settle();
  w.ctx.NightRaid.attackLive(0); await settle();
  await flush();
  return w;
}

suite('kết quả chỉ xuất hiện sau khi máy chủ xác nhận', () => {
  test('mất mạng shows a neutral confirmation screen, then retry paints the verified amount', async () => {
    let finishReply={ok:false,data:null};
    const w=await marchOn({friends:friendsReply,targets:targetsReply,start:ACTIVE_RAID,finish:()=>finishReply});
    const battle=w.battles[w.battles.length-1];
    battle.options.onFinish({status:'won',damage:50,defense:20,castleHp:0},[]);
    await flush();
    let out=w.screen().innerHTML;
    assert.truthy(out.includes('ĐANG XÁC NHẬN'),'there is a dedicated pending result screen');
    assert.falsy(out.includes('CHIẾN THẮNG')||out.includes('+0 xu'),'an unverified simulation is never celebrated');
    assert.equal(w.state.coins,9000,'no server verdict means no wallet change');
    finishReply={ok:true,data:{result:{won:false,shielded:true,reward:0,loss:37,defenderGain:37,stars:0,damage:50,defense:100000,castleHp:188}}};
    await w.ctx.NightRaid.retryRaidResult();await flush();
    out=w.screen().innerHTML;
    assert.truthy(out.includes('THẤT BẠI')&&out.includes('mất 37 xu'),'shield copy uses the server-confirmed loss');
    assert.falsy(out.includes('mất 200 xu'),'no configured penalty is hardcoded');
    assert.equal(w.state.coins,8963);
  });

  test('a verified win over an empty vault pays and explains the 100-xu victory reward', async () => {
    const result={won:true,reward:100,rewardReason:'victory_bonus',loot:0,victoryBonus:100,loss:0,stars:3,damage:50,defense:20,castleHp:0};
    const w=await marchOn({friends:friendsReply,targets:targetsReply,start:ACTIVE_RAID,
      finish:{ok:true,data:{result}}});
    const battle=w.battles[w.battles.length-1];
    battle.options.onFinish({status:'won',damage:50,defense:20,castleHp:0},[]);
    await flush();
    const out=w.screen().innerHTML;
    assert.truthy(out.includes('CHIẾN THẮNG'));
    assert.truthy(out.includes('Kho đối thủ trống'));
    assert.truthy(out.includes('100 xu cho phí hành quân và chiến thắng'));
    assert.truthy(out.includes('+100 xu'));
  });
});

const RUINED = (over) => ({ ok: true, data: Object.assign(
  { ruined: true, retryAt: 0, castleSkin: 'moss-tower', name: 'Tí', homeLevel: 4 }, over || {}) });

suite('NHÀ ĐÃ TAN HOANG: the house somebody else got to first', () => {
  test('the ruins scene is played on the battle canvas, with the skin and the name', async () => {
    const plays = [];
    const w = await marchOn({ friends: friendsReply, targets: targetsReply, start: RUINED() }, {
      NightRaidRuins: {
        play(host, about, options) { plays.push({ host, about, options }); return { destroy() { this.destroyed = true; } }; },
      },
    });
    assert.equal(plays.length, 1, 'the march-in must be shown, not skipped');
    assert.truthy(plays[0].host, 'it is handed the stage it draws on');
    assert.equal(plays[0].about.castleSkin, 'moss-tower', 'the right castle falls down');
    assert.equal(plays[0].about.name, 'Tí');
    assert.equal(typeof plays[0].options.onFinish, 'function');
    // Until the scene says it is done, no card: the story comes first.
    assert.falsy(w.doc.getElementById('nrResultPop'), 'the card must wait for onFinish');
    plays[0].options.onFinish();
    assert.truthy(w.doc.getElementById('nrResultPop'), 'and drop once the troops have turned back');
  });

  test('the card says NHÀ ĐÃ TAN HOANG, 0 xu won, 0 xu lost, and when to come back', async () => {
    const now = Date.now();
    const w = await marchOn({ friends: friendsReply, targets: targetsReply, start: RUINED({ retryAt: now + 12 * H }) });
    // No ruins module here: the card must still be the whole story.
    const pop = w.doc.getElementById('nrResultPop');
    assert.truthy(pop, 'a missing animation module can never swallow the result');
    const html = pop.innerHTML;
    assert.truthy(html.includes('NHÀ ĐÃ TAN HOANG'), 'the heading names the ending');
    assert.truthy(html.includes('Có đội khác tới trước'), 'and says who beat us to it');
    assert.truthy(html.includes('CƯỚP ĐƯỢC'), '0 xu won…');
    assert.truthy(html.includes('BỊ MẤT'), '…and 0 xu lost, both spelled out');
    assert.equal((html.match(/0 xu/g) || []).length, 2, 'exactly two zeroes: nothing in, nothing out');
    assert.truthy(html.includes('12:00:00'), 'the 12 h timer is on the card');
    assert.truthy(html.includes('Con quay lại nhà này được lúc'), 'with the clock time it opens');
    assert.truthy(html.includes('nrShowLiveTargets()'), 'try another house');
    assert.truthy(html.includes('nrHome()'), 'or go home');
    assert.truthy(pop.classList.contains('ruined'), 'it wears its own palette, not the defeat one');
  });

  test('nothing is charged: no ticket spent, no xu moved, no pending raid to reconcile', async () => {
    const before = 9000;
    const w = await marchOn({ friends: friendsReply, targets: targetsReply, start: RUINED({ retryAt: Date.now() + 12 * H }) });
    assert.equal(w.state.coins, before, 'the wallet must not move');
    assert.falsy(w.state.nightRaidPending, 'no raid row exists, so there is nothing to retry later');
    assert.falsy(w.calls.some(c => c.key === 'finish'), '/finish is never called for a raid that never started');
    assert.falsy(w.doc.getElementById('nrStartRaid'), 'the one button is gone, as it is in a real fight');
    // Walking away is free — start.js wrote nothing.
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'leaving must not warn about a raid that was never committed');
  });

  test('a ruins module that throws still ends the night with the card', async () => {
    const w = await marchOn({ friends: friendsReply, targets: targetsReply, start: RUINED() }, {
      NightRaidRuins: { play() { throw new Error('no webgl'); } },
    });
    assert.truthy(w.doc.getElementById('nrResultPop'), 'the child must never be stranded on a dead stage');
    assert.truthy(w.doc.getElementById('nrResultPop').innerHTML.includes('NHÀ ĐÃ TAN HOANG'));
  });

  test('leaving the ruined stage tears the scene down', async () => {
    let destroyed = 0;
    const w = await marchOn({ friends: friendsReply, targets: targetsReply, start: RUINED() }, {
      NightRaidRuins: { play() { return { destroy() { destroyed++; } }; } },
    });
    w.ctx.NightRaid.renderHome();
    assert.equal(destroyed, 1, 'a scene left running behind the home stage burns the phone battery');
  });

  test('a normal /start still opens a normal fight', async () => {
    // The ruined branch must not swallow the ordinary reply.
    const w = await marchOn({
      friends: friendsReply, targets: targetsReply,
      start: { ok: true, data: { raid: { raidId: 'r-1', defense: 120, layout: { cells: [], soldiers: 0, dogLane: 2 }, castleHp: 200 } } },
    });
    assert.falsy(w.doc.getElementById('nrResultPop'), 'no ruined card');
    assert.equal(w.state.nightRaidPending && w.state.nightRaidPending.raidId, 'r-1', 'the raid is remembered as usual');
  });
});

suite('the defeat card names where the coins went', () => {
  test('a loss says the fee is gone and the defender was paid for holding', async () => {
    const w = await marchOn({
      friends: friendsReply, targets: targetsReply,
      start: { ok: true, data: { raid: { raidId: 'r-2', defense: 9999, layout: { cells: [], soldiers: 0, dogLane: 2 }, castleHp: 200 } } },
      finish: { ok: true, data: { result: { won: false, stars: 0, reward: 0, loss: 20, defenderGain: 20, damage: 10, defense: 9999, margin: -99 } } },
    });
    // Drive the fake battle to its (lost) end the way the renderer would.
    const battle = w.battles[w.battles.length - 1];
    battle.options.onFinish({ status: 'lost', damage: 10, defense: 9999, margin: -99 }, []);
    await flush();
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('-20 xu phí hành quân'), 'the child still sees what it cost');
    assert.truthy(html.includes('được thưởng giữ thành +20 xu'), 'and that the other house was paid for holding');
    assert.falsy(html.includes('đã lấy'), 'the fee is burned — nobody "took" it');
    assert.truthy(html.includes('Tí'), 'the defender is named');
  });

  test('a loss with no defenderGain keeps the plain line', async () => {
    const w = await marchOn({
      friends: friendsReply, targets: targetsReply,
      start: { ok: true, data: { raid: { raidId: 'r-3', defense: 9999, layout: { cells: [], soldiers: 0, dogLane: 2 }, castleHp: 200 } } },
      finish: { ok: true, data: { result: { won: false, stars: 0, reward: 0, loss: 20, damage: 10, defense: 9999, margin: -99 } } },
    });
    const battle = w.battles[w.battles.length - 1];
    battle.options.onFinish({ status: 'lost', damage: 10, defense: 9999, margin: -99 }, []);
    await flush();
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('-20 xu phí hành quân'));
    assert.falsy(html.includes('giữ thành'), 'no invented reward');
  });
});

const REPORT = (over) => Object.assign({
  id: 'r1', attackerName: 'Gia Hân', seen: false, finishedAt: Date.now() - 2 * H,
  rulesVersion: 2, snapshot: { cells: [] }, commands: [],
  result: { won: true, shielded: false, castleHp: 0, damage: 700, defense: 600, stars: 3 },
}, over || {});

async function openLog(reportsReply) {
  const w = mount({ reports: reportsReply });
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showReports(); await settle();
  return w;
}

suite('NHẬT KÝ: both sides of the night', () => {
  test('replay shows the snapshotted attacking dog and gives old raids a visible fallback', async () => {
    const realPet = { level: 43, name: 'Milo', breed: 'Beagle', atlas: 'small', cell: 2 };
    const current = await openLog({ ok: true, data: { reports: [REPORT({ snapshot: { cells: [], attackerPet: realPet } })], attacks: [] } });
    current.ctx.NightRaid.replayReport(0);
    assert.deepEqual(current.battles[current.battles.length - 1].options.pet, realPet);

    const legacy = await openLog({ ok: true, data: { reports: [REPORT()], attacks: [] } });
    legacy.ctx.NightRaid.replayReport(0);
    const fallback = legacy.battles[legacy.battles.length - 1].options.pet;
    assert.equal(fallback.name, 'Gia Hân');
    assert.equal(fallback.atlas, 'small');
    assert.equal(fallback.cell, 0);
  });

  test('it shows what the child did, then what came to their door', async () => {
    const w = await openLog({ ok: true, data: {
      reports: [REPORT()],
      attacks: [
        { id: 'a1', defenderName: 'Bảo An', finishedAt: Date.now() - 3 * H, kind: 'won', reward: 60, loss: 0, stars: 3, result: { won: true } },
        { id: 'a2', defenderName: 'Đức Duy', finishedAt: Date.now() - 5 * H, kind: 'lost', reward: 0, loss: 20, stars: 0, result: { won: false } },
        { id: 'a3', defenderName: 'Thảo Nhi', finishedAt: Date.now() - 8 * H, kind: 'ruined', reward: 0, loss: 0, stars: 0, result: { won: false } },
      ],
    } });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Con đi cướp'), 'the child\'s own raids');
    assert.truthy(html.includes('Nhà con bị cướp'), 'and the defence log');
    assert.truthy(html.indexOf('Con đi cướp') < html.indexOf('Nhà con bị cướp'),
      'the child asks "how did MY raids go?" first');
    // The three endings, each with its money said out loud.
    assert.truthy(html.includes('CƯỚP ĐƯỢC'), 'a win is labelled');
    assert.truthy(html.includes('+60 xu'), 'and pays');
    assert.truthy(html.includes('★★★'), 'with its stars');
    assert.truthy(html.includes('BỊ ĐÁNH BẬT'), 'a defeat is labelled');
    assert.truthy(html.includes('-20 xu'), 'and costs');
    assert.truthy(html.includes('NHÀ ĐÃ TAN HOANG'), 'a ruined house is labelled');
    assert.truthy(html.includes('0 xu'), 'and moves nothing');
    assert.equal(w.screen().querySelectorAll('.nr-attack-card').length, 3);
    // The defence rows keep their replay button and their indices.
    assert.truthy(html.includes('nrReplayReport(0)'), 'replay still reaches raidReports[0]');
    assert.truthy(html.includes('Gia Hân'));
  });

  test('an older server with no `attacks` key simply omits that section', async () => {
    const w = await openLog({ ok: true, data: { reports: [REPORT()] } });
    const html = w.screen().innerHTML;
    assert.falsy(html.includes('Con đi cướp'), 'an empty heading over nothing reads as a broken screen');
    assert.truthy(html.includes('Nhà con bị cướp'), 'the defence log is unchanged');
    assert.truthy(html.includes('nrReplayReport(0)'));
    assert.truthy(html.includes('closeNightRaid()'), 'the shared X is still the way out');
    assert.falsy(html.includes('nrHome()'), 'the journal must not add a duplicate back button');
  });

  test('an empty attacks list says so instead of showing a bare heading', async () => {
    const w = await openLog({ ok: true, data: { reports: [], attacks: [] } });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Con đi cướp'));
    assert.truthy(html.includes('Con chưa đi cướp nhà nào'));
    assert.truthy(html.includes('Đêm nay vẫn yên bình'), 'and the defence side has its own empty state');
  });

  test('an attack row written before `kind` existed still shows up', async () => {
    const w = await openLog({ ok: true, data: {
      reports: [],
      attacks: [{ id: 'old', defenderName: 'Cũ', finishedAt: Date.now(), reward: 40, loss: 0, stars: 2, result: { won: true } }],
    } });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Cũ'), 'a row must never be dropped out of the child\'s history');
    assert.truthy(html.includes('+40 xu'));
  });

  test('a breached empty vault is never described as stealing zero coins', async () => {
    const w = await openLog({ ok: true, data: {
      reports: [], attacks: [{ id: 'empty', defenderName: 'Kho trống', finishedAt: Date.now(),
        kind: 'won', reward: 0, stars: 3, result: { won: true, rewardReason: 'empty_vault' } }],
    } });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Kho trống'));
    assert.truthy(html.includes('không có xu để lấy'));
    assert.falsy(html.includes('+0 xu'), 'breaking an empty castle is not stealing zero coins');
  });

  test('a held wall shows the "giữ thành" reward the server paid; a capped one shows no +0', async () => {
    const held = { won: false, shielded: false, castleHp: 150, damage: 200, defense: 600, stars: 0, loss: 100, defenderGain: 100, defenseReason: 'defense_reward' };
    const w = await openLog({ ok: true, data: { attacks: [], reports: [
      REPORT({ id: 'held', attackerName: 'Minh Anh', result: held }),
      REPORT({ id: 'shield', attackerName: 'Bảo Lâm', result: Object.assign({}, held, { shielded: true, loss: 200 }) }),
      REPORT({ id: 'capped', attackerName: 'Khánh Vy', result: Object.assign({}, held, { defenderGain: 0, defenseReason: 'daily_cap' }) }),
      REPORT({ id: 'legacy', attackerName: 'Ngày xưa', result: { won: false, castleHp: 150, damage: 1, defense: 9 } }),
      REPORT({ id: 'breach', attackerName: 'Gia Hân' }),
    ] } });
    const cards = [...w.screen().querySelectorAll('.nr-report-card')].map(c => c.innerHTML);
    assert.equal(cards.length, 5);
    assert.truthy(cards[0].includes('PHÒNG THỦ THÀNH CÔNG') && cards[0].includes('Giữ thành +100 xu'), 'a plain hold names its reward');
    assert.truthy(cards[1].includes('KHIÊN ĐÃ CHẶN') && cards[1].includes('Giữ thành +100 xu'), 'a shielded hold is paid the same and says so');
    assert.falsy(cards[0].includes('đã lấy'), 'the raider\'s fee is burned; nobody "took" it');
    assert.falsy(cards[2].includes('Giữ thành'), 'a capped hold draws no "+0 xu" line');
    assert.falsy(cards[3].includes('Giữ thành'), 'a row settled before db/032 has no reward to show');
    assert.truthy(cards[4].includes('TƯỜNG ĐÃ BỊ PHÁ') && !cards[4].includes('Giữ thành'), 'a breach earns nothing');
  });

  test('names in the log are escaped', async () => {
    const w = await openLog({ ok: true, data: {
      reports: [], attacks: [{ id: 'x', defenderName: '<b>x</b>', finishedAt: Date.now(), kind: 'won', reward: 1, stars: 1 }],
    } });
    assert.truthy(w.screen().innerHTML.includes('&lt;b&gt;x&lt;/b&gt;'));
  });

  test('a server that refuses keeps the shared X without adding a second back block', async () => {
    const w = await openLog({ ok: false, data: { error: 'Đăng nhập để mở Phase 2' } });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Chưa thể mở nhật ký'));
    assert.truthy(html.includes('closeNightRaid()'));
    assert.falsy(html.includes('nrHome()'));
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
