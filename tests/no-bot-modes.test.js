// tests/no-bot-modes.test.js — the two bot modes are gone for good.
//
// allow_bot used to mean "may practice against a bot" (Arena) and "may raid a
// training bot home" (Cướp Đêm). Both were pure client code that let a child
// play without a real friend — and the raid branch printed coins into the
// local wallet. The flag now means only "gets the farm and Cướp Đêm first".
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

suite('no bot modes: the Arena has no practice-vs-bot', () => {
  test('js/petbattlebot.js is deleted and nothing loads it', () => {
    assert.falsy(exists('js/petbattlebot.js'), 'js/petbattlebot.js must be deleted');
    assert.falsy(read('index.html').includes('petbattlebot.js'), 'index.html still loads the bot');
    assert.falsy(read('sw.js').includes('petbattlebot.js'), 'sw.js still precaches the bot');
  });

  test('js/petbattle.js has no practice entry point, result screen or strings', () => {
    const src = read('js/petbattle.js');
    for (const banned of ['startBotBattle', 'finishBotBattle', 'pb-practice-btn', 'pb-practice-card',
      'result.practice', 'botSetGame', 'botClearGame', 'botOnPlayerTurnDone', 'practiceBtn', 'practiceAgain', 'practiceNote']) {
      assert.falsy(src.includes(banned), 'js/petbattle.js still mentions ' + banned);
    }
  });
});

suite('no bot modes: Cướp Đêm raids real houses only', () => {
  const ui = read('js/night-raid.js');
  test('the bot target factory and its buttons are gone', () => {
    for (const banned of ['makeBotTarget', 'scoutBot', 'nrScoutBot', 'Chơi thử với Bot', 'botMode',
      'BOT NGẪU NHIÊN', 'Tìm nhà bot khác']) {
      assert.falsy(ui.includes(banned), 'js/night-raid.js still mentions ' + banned);
    }
  });
  test('the local coin path of an offline raid is gone', () => {
    // finishRaid used to pay up to 120 xu a day straight into appState.coins
    // for beating a bot. Every raid now settles through /api/night-raid/finish.
    const fn = ui.slice(ui.indexOf('function finishRaid('), ui.indexOf('function finishRaid(') + 600);
    assert.falsy(/appState\.coins\s*=/.test(fn), 'finishRaid must not touch the wallet');
    assert.falsy(fn.includes("kind:'bot'"), 'finishRaid must not write a bot history row');
    assert.truthy(fn.includes('finishOnline(target,state,commands)'), 'every raid settles online');
  });
  test('the rules module still exports trainingTarget for the simulator and its tests', () => {
    const R = require(path.join(ROOT, 'js', 'night-raid-rules.js'));
    assert.equal(typeof R.trainingTarget, 'function');
  });
});

suite('no bot modes: the flag is early access, not a bot switch', () => {
  test('admin copy no longer calls the flag "Bot on"', () => {
    assert.falsy(read('admin.html').includes('Bot on'), 'admin.html still labels the flag "Bot on"');
    assert.falsy(read('functions/api/admin/user-flags.js').includes('practice vs bot'),
      'user-flags.js still describes the flag as practice vs bot');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
