// bot-practice.test.js — 🤖 practice mode.
//
// Practice bypasses the whole ammo economy (20 shots, no cooldown, no friend),
// so it is admin-granted per user and must stay unable to pay out anything.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const bot = require(path.join(root, 'js', 'petbattlebot.js'));
const calc = require(path.join(root, 'js', 'battlecalc.js'));

const pbSrc = read('js/petbattle.js');
const flagsSrc = read('functions/api/admin/user-flags.js');
const battleSrc = read('functions/api/battle/index.js');
const adminHtml = read('admin.html');
const indexSrc = read('index.html');

suite('bot practice: the admin gate', () => {
    test('only an admin may flip the flag', () => {
        assert.truthy(flagsSrc.includes("auth.role !== 'admin'"), 'anyone could grant themselves practice mode');
        assert.truthy(flagsSrc.includes("err('Forbidden', 403)"));
        assert.truthy(flagsSrc.includes("err('Unauthorized', 401)"));
    });

    test('the endpoint validates its input', () => {
        assert.truthy(flagsSrc.includes('Number.isFinite(userId)'), 'a junk userId must be rejected');
        assert.truthy(flagsSrc.includes("err('User not found', 404)"), 'an unknown user must 404');
        assert.truthy(flagsSrc.includes('body.allowBot ? 1 : 0'), 'the flag must be coerced, not stored raw');
    });

    test('the flag is written with a bound parameter', () => {
        assert.truthy(/UPDATE users SET allow_bot = \? WHERE id = \?/.test(flagsSrc), 'no string-built SQL');
    });

    test('the arena state carries the flag to the client', () => {
        assert.truthy(battleSrc.includes('allowBot'), 'the client cannot know without it');
        assert.truthy(battleSrc.includes('SELECT allow_bot FROM users WHERE id = ?'));
    });

    test('the button only renders when the SERVER says so', () => {
        assert.truthy(pbSrc.includes('${st.allowBot ?'), 'the gate must be the server flag, not a local setting');
        // A child editing localStorage must not be able to reveal it.
        const gate = pbSrc.slice(pbSrc.indexOf('${st.allowBot ?'), pbSrc.indexOf('${st.allowBot ?') + 300);
        assert.falsy(/appState|localStorage/.test(gate), 'the gate must not read device state');
    });

    test('the admin dashboard can toggle it', () => {
        assert.truthy(adminHtml.includes('admin/user-flags'), 'no way to set the flag');
        assert.truthy(adminHtml.includes('bot-toggle'), 'no control in the users table');
        assert.truthy(adminHtml.includes('e.stopPropagation()'), 'the toggle sits in a clickable row');
        assert.truthy(adminHtml.includes("method:'POST'"), 'the api helper must send a POST');
    });
});

suite('bot practice: the bot actually plays', () => {
    const terrain = calc.buildTerrain(12345);
    const spawns = calc.spawnPoints(terrain);

    test('it finds an aim that lands near the target', () => {
        // Deterministic: no error applied, so this measures the search itself.
        const noJitter = () => 0.5;
        const aim = bot.botAim(calc, terrain, spawns[1], -1, spawns[0], 0, noJitter);
        const sim = calc.simulateShot({ terrain, from: spawns[1], facing: -1, angle: aim.angle, power: aim.power, wind: 0 });
        assert.truthy(sim.hit, 'the bot must at least hit the ground');
        assert.truthy(Math.abs(sim.hit.x - spawns[0].x) < 160,
            `landed ${Math.round(Math.abs(sim.hit.x - spawns[0].x))}px away — the search is not aiming`);
    });

    test('it aims across many seeds and winds, never returning junk', () => {
        for (const seed of [1, 99, 4242, 777777]) {
            const t = calc.buildTerrain(seed);
            const sp = calc.spawnPoints(t);
            for (const wind of [-20, 0, 20]) {
                const aim = bot.botAim(calc, t, sp[1], -1, sp[0], wind, () => 0.5);
                assert.truthy(Number.isFinite(aim.angle) && Number.isFinite(aim.power),
                    `seed ${seed} wind ${wind}: got ${JSON.stringify(aim)}`);
                assert.truthy(aim.angle >= 10 && aim.angle <= 85, `angle out of range: ${aim.angle}`);
                assert.truthy(aim.power >= 10 && aim.power <= 100, `power out of range: ${aim.power}`);
            }
        }
    });

    // A bot that never misses is not practice, it is punishment.
    test('it misses sometimes — the error is real', () => {
        const perfect = bot.botAim(calc, terrain, spawns[1], -1, spawns[0], 0, () => 0.5);
        const low = bot.botAim(calc, terrain, spawns[1], -1, spawns[0], 0, () => 0);
        const high = bot.botAim(calc, terrain, spawns[1], -1, spawns[0], 0, () => 1);
        assert.truthy(low.angle < perfect.angle, 'jitter must move the aim down');
        assert.truthy(high.angle > perfect.angle, 'and up');
        assert.truthy(bot.BOT_ANGLE_ERROR > 0 && bot.BOT_POWER_ERROR > 0);
    });

    test('practice gives the full 20 shots and a full health bar', () => {
        assert.equal(bot.BOT_AMMO, calc.AMMO_CAP, 'practice should hand over a full clip');
        assert.equal(bot.BOT_AMMO, 20);
        assert.equal(bot.BOT_HP, 100);
    });

    test('the practice view is built with that full clip on both sides', () => {
        const fn = pbSrc.slice(pbSrc.indexOf('function startBotBattle'), pbSrc.indexOf('function finishBotBattle'));
        assert.truthy(fn.includes('ammo: BOT_AMMO'), 'both pets need the full 20');
        assert.truthy(fn.includes('hp: BOT_HP'));
        assert.truthy(fn.includes('_pbStopPolling()'), 'practice must not keep talking to the server');
        assert.truthy(fn.includes('link: null'), 'and must not open a relay');
    });
});

suite('bot practice: the bot obeys its own ammo', () => {
    // Math.max(1, …) fired a phantom poop on an empty clip: the HUD showed
    // "0 💩" while the bot kept shooting, and with rounds now running until
    // the ammo does, the battle could not end.
    test('an empty clip passes the turn instead of firing', () => {
        const src = read('js/petbattlebot.js');
        assert.truthy(src.includes('if (maxShots <= 0)'), 'no empty-clip guard');
        const fn = src.slice(src.indexOf('function botTakeTurn'), src.indexOf('function _botEndOfTurn'));
        assert.truthy(fn.indexOf('maxShots <= 0') < fn.indexOf('botAim'),
            'the guard must come before the bot spends effort aiming');
    });

    test('the bot never fires more than it holds', () => {
        for (const ammo of [0, 1, 2, 3, 4, 10]) {
            const max = calc.maxShotsThisTurn(ammo);
            assert.truthy(max <= ammo, `maxShotsThisTurn(${ammo}) = ${max}`);
            assert.truthy(max <= calc.BARRELS);
        }
    });
});

suite('bot practice: it stays worthless, on purpose', () => {
    test('a practice result is flagged as practice', () => {
        const botSrc = read('js/petbattlebot.js');
        assert.truthy(botSrc.includes('practice: true'), 'the result must be distinguishable');
    });

    test('finishPetBattle diverts practice before any payout', () => {
        const fin = pbSrc.slice(pbSrc.indexOf('function finishPetBattle'));
        const head = fin.slice(0, 400);
        assert.truthy(head.includes('result.practice'), 'no practice check');
        assert.truthy(head.indexOf('result.practice') < head.indexOf('coins'), 'the check must come first');
    });

    test('practice never writes a history row', () => {
        const fn = pbSrc.slice(pbSrc.indexOf('function finishBotBattle'), pbSrc.indexOf('// Battle over'));
        assert.falsy(fn.includes('petBattleHistory'), 'practice must not pollute the real record');
    });

    test('the child is told practice pays nothing', () => {
        for (const lang of ['en', 'vi']) {
            const table = pbSrc.slice(pbSrc.indexOf(`  ${lang}: {`));
            assert.truthy(table.includes('practiceNote'), `${lang} is missing the explanation`);
        }
    });

    // Rounds are not fixed any more: one poop per turn stretches a full clip
    // into twenty rounds, and play stops when the ammo does.
    test('practice ends when the poop runs out, not after a fixed five rounds', () => {
        const botSrc = read('js/petbattlebot.js');
        assert.falsy(botSrc.includes('C.BATTLE_ROUNDS * 2'), 'the fixed round cap should be gone');
        assert.truthy(botSrc.includes('g.myAmmo <= 0 && g.foeAmmo <= 0'), 'both sides empty ends it');
        assert.truthy(botSrc.includes('C.MAX_TURNS'), 'a runaway guard must still exist');
    });
});

suite('bot practice: wired in', () => {
    test('petbattlebot.js is loaded and cached', () => {
        assert.truthy(indexSrc.includes('js/petbattlebot.js'), 'not loaded');
        assert.truthy(read('sw.js').includes('/js/petbattlebot.js'), 'not cached — would 404 offline');
    });

    test('leaving the arena clears the bot game', () => {
        const fn = pbSrc.slice(pbSrc.indexOf('function closePetBattle'), pbSrc.indexOf('async function refreshPetBattle'));
        assert.truthy(fn.includes('botClearGame'), 'a stale bot game would keep firing');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
