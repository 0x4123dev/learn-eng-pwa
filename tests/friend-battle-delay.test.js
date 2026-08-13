// friend-battle-delay.test.js — a new friendship cannot battle for 3 days.
//
// The hole this closes: register a throwaway account, befriend it, beat it,
// collect the cup. The ammo economy could not stop that on its own — it only
// asks "do you have shots left", and 20 correct answers on a fresh account is
// a few minutes of tapping. So the trophy cabinet, which is the thing the
// whole app is pointed at, could be filled without learning anything.
//
// Three days is not an arbitrary number: it is exactly the window ammo is
// earned over (activities in the last 3 days, see ammoStatsFor), so a pair of
// friends reaching their first battle have necessarily studied for it.
//
// The rule lives on the SERVER only. The client is sent an absolute timestamp
// and renders a countdown from it — it never holds its own copy of "3 days",
// because two copies of a rule is how the drift bugs in
// tests/cross-boundary-drift.test.js all started.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const battleSrc = read('functions/api/_battle.js');
const challengeSrc = read('functions/api/battle/challenge.js');
const friendsListSrc = read('functions/api/friends/index.js');
const petbattleSrc = read('js/petbattle.js');
const stylesSrc = read('css/styles.css');

const DAY = 86400000;

// _battle.js is ESM with no imports and no top-level side effects, so dropping
// the `export` keywords is enough to run the REAL module here. These tests
// execute the shipped function rather than pattern-matching its source.
const server = (() => {
    const sandbox = { Date, Number, Math, String, Object, JSON };
    vm.createContext(sandbox);
    // `function` declarations land on the sandbox by themselves, but top-level
    // `const` is script-scoped and does not — the same footgun battlecalc.js
    // documents for classic scripts. Hand the constants over explicitly.
    vm.runInContext(battleSrc.replace(/^export /gm, '') +
        '\nthis.FRIEND_BATTLE_DELAY_MS = FRIEND_BATTLE_DELAY_MS;', sandbox);
    return sandbox;
})();

// The client helper, likewise executed rather than described. pbT is stubbed
// so the assertions are about the LOGIC, not the wording.
const clientWait = (() => {
    const m = petbattleSrc.match(/function _pbFriendWait\(f\) \{[\s\S]*?\n\}/);
    if (!m) throw new Error('_pbFriendWait not found in js/petbattle.js');
    const sandbox = {
        Date, Number, Math,
        pbT: (key, vars) => (vars && vars.n !== undefined) ? `${key}:${vars.n}` : key,
    };
    vm.createContext(sandbox);
    vm.runInContext(m[0] + '\nthis.fn = _pbFriendWait;', sandbox);
    return sandbox.fn;
})();

// A friendship accepted `days` ago, in the shape SQLite's strftime('%s') gives.
const acceptedDaysAgo = (days) => String(Math.floor((Date.now() - days * DAY) / 1000));

suite('friend battle delay: the server rule', () => {
    test('the wait is exactly 3 days, matching the ammo window', () => {
        assert.equal(server.FRIEND_BATTLE_DELAY_MS, 3 * DAY);
    });

    test('a friendship accepted right now must wait ~3 days', () => {
        const at = server.friendReadyFrom(acceptedDaysAgo(0));
        assert.truthy(at !== null, 'a brand-new friendship must not be battleable');
        const wait = at - Date.now();
        assert.truthy(Math.abs(wait - 3 * DAY) < 5000, `wait was ${Math.round(wait / 1000)}s, expected ~3 days`);
    });

    test('one day old and two days old are both still waiting', () => {
        for (const days of [1, 2, 2.5, 2.99]) {
            const at = server.friendReadyFrom(acceptedDaysAgo(days));
            assert.truthy(at !== null, `${days} days old should still be waiting`);
            assert.truthy(at > Date.now(), 'the deadline must be in the future');
        }
    });

    test('past three days it opens, and stays open', () => {
        for (const days of [3.01, 4, 30, 365]) {
            assert.equal(server.friendReadyFrom(acceptedDaysAgo(days)), null,
                `${days} days old should be battleable`);
        }
    });

    test('an unreadable date fails CLOSED, not open', () => {
        // The trap: Number(null) and Number('') are 0, NOT NaN. A NULL column
        // would compute a 1970 deadline, pass the "is it in the future?" test
        // and return null — handing back exactly the free pass this gate
        // removes. Every one of these must still produce a wait.
        for (const bad of [null, undefined, '', 'yesterday', NaN, {}]) {
            const at = server.friendReadyFrom(bad);
            assert.truthy(at !== null && at > Date.now(),
                `an undateable friendship (${String(bad)}) must not become battleable`);
        }
    });

    test('the clock starts when the friendship was ACCEPTED', () => {
        // A request that sits unanswered for a week is not a week of studying
        // together, so responded_at wins and created_at is only the fallback.
        assert.truthy(/COALESCE\(\s*responded_at\s*,\s*created_at\s*\)/.test(battleSrc),
            'friendBattleReadyAt must prefer responded_at over created_at');
        assert.truthy(/COALESCE\(f\.responded_at, f\.created_at\)/.test(friendsListSrc),
            'the friends list must date friendships the same way the gate does');
    });
});

suite('friend battle delay: the challenge endpoint enforces it', () => {
    test('the gate runs before any battle row is written', () => {
        const gate = challengeSrc.indexOf('friendBattleReadyAt');
        const insert = challengeSrc.indexOf('INSERT INTO battles');
        assert.truthy(gate > 0, 'challenge.js must call friendBattleReadyAt');
        assert.truthy(insert > 0, 'challenge.js must insert a battle');
        assert.truthy(gate < insert, 'the wait is checked AFTER the battle is created — too late');
    });

    test('it refuses with 429 and tells the client when to come back', () => {
        const call = challengeSrc.slice(challengeSrc.indexOf('const friendReadyAt'),
            challengeSrc.indexOf('currentBattle(env, auth.uid)'));
        assert.truthy(call.includes('429'), 'a "not yet" is a 429, like the other cooldowns');
        assert.truthy(call.includes('readyAt'),
            'the client needs the timestamp back, or it can only repeat a sentence');
    });

    test('err() can actually carry that timestamp', () => {
        // The gate is worthless if err() silently drops the extra field.
        const libSrc = read('functions/api/_lib.js');
        assert.truthy(/export function err\(message, status = 400, extra/.test(libSrc),
            'err() must accept machine-readable detail alongside the message');
    });

    test('being friends at all is still checked first', () => {
        assert.truthy(challengeSrc.indexOf('areFriends') < challengeSrc.indexOf('friendBattleReadyAt'),
            'a stranger should be told they are not friends, not given a countdown');
    });
});

suite('friend battle delay: the client only renders what the server decided', () => {
    test('the friends list sends an absolute battleReadyAt', () => {
        assert.truthy(friendsListSrc.includes('entry.battleReadyAt = friendReadyFrom(r.since)'),
            'each accepted friend must carry its own deadline');
        assert.truthy(friendsListSrc.includes("import { friendReadyFrom } from '../_battle.js'"),
            'the list must use the SAME function the gate uses, not a second copy');
    });

    test('the client holds no copy of the 3-day rule', () => {
        // This is the drift guard. If a future edit hardcodes the threshold in
        // the client, the two will disagree the day the server value changes.
        const helper = petbattleSrc.match(/function _pbFriendWait\(f\) \{[\s\S]*?\n\}/)[0];
        assert.falsy(/259200000|3 \* 24|3 \* DAY/.test(helper),
            'the client computed its own 3-day deadline instead of using the server timestamp');
        assert.truthy(helper.includes('battleReadyAt'), 'it must read the server field');
    });

    test('a waiting friend shows the days left; a ready one shows nothing', () => {
        assert.equal(clientWait({ battleReadyAt: Date.now() + 2.2 * DAY }), 'friendNewDays:3');
        assert.equal(clientWait({ battleReadyAt: Date.now() + 1.2 * DAY }), 'friendNewDays:2');
        assert.equal(clientWait({ battleReadyAt: Date.now() + 0.2 * DAY }), 'friendNewDay1',
            'English needs "1 day", not "1 days" — a child reads this');
        assert.equal(clientWait({ battleReadyAt: Date.now() - DAY }), '', 'a past deadline is no wait');
        assert.equal(clientWait({ battleReadyAt: Date.now() }), '', 'exactly now is no wait');
    });

    test('a missing or junk deadline never locks a friend out of the UI', () => {
        // The server is the enforcement; the button is a courtesy. An older
        // client, an offline cache or a failed field must not strand a friend
        // who is in fact allowed to battle — the server will say no if not.
        for (const f of [{}, { battleReadyAt: null }, { battleReadyAt: 'soon' }, null, undefined]) {
            assert.equal(clientWait(f), '', `unexpected wait for ${JSON.stringify(f)}`);
        }
    });

    test('both languages explain the wait', () => {
        for (const key of ['friendNewDays', 'friendNewDay1', 'friendNewSoon', 'friendNewWhy', 'friendAllNew']) {
            const hits = petbattleSrc.split(key + ':').length - 1;
            assert.equal(hits, 2, `${key} must exist in BOTH the English and Vietnamese tables`);
        }
        assert.truthy(/friendNewWhy: '[^']*3 days/.test(petbattleSrc), 'English must name the 3 days');
        assert.truthy(/friendNewWhy: '[^']*3 ngày/.test(petbattleSrc), 'Vietnamese must name the 3 days');
    });

    test('the countdown is readable, not faded to 45% like a disabled row', () => {
        // .pb-friend:disabled drops to opacity .45. The countdown IS the
        // message on that row, so a waiting friend keeps full opacity and is
        // marked out by a dashed border and a chip instead.
        assert.truthy(stylesSrc.includes('.pb-friend.waiting:disabled { opacity: 1'),
            'a waiting friend must not inherit the 0.45 fade that hides its own countdown');
        const chip = stylesSrc.slice(stylesSrc.indexOf('.pb-friend-wait {'));
        assert.truthy(chip.slice(0, 200).includes('color: #334155'), 'the chip needs dark ink');
        assert.truthy(chip.slice(0, 200).includes('background: #e2e8f0'), 'on a solid light fill');
    });

    test('the header does not promise a battle when nobody is old enough', () => {
        // "Ready! Pick a friend to challenge:" above a list where every row is
        // greyed out reads as a broken app, not as a rule.
        assert.truthy(petbattleSrc.includes('const allWaiting ='), 'the lobby must know when every friend is waiting');
        assert.truthy(/allWaiting[\s\S]{0,120}friendAllNew/.test(petbattleSrc),
            'an all-waiting list needs its own heading, not the ready one');
        assert.truthy(/friendAllNew: '[^']*3 days/.test(petbattleSrc), 'English must name the 3 days');
        assert.truthy(/friendAllNew: '[^']*3 ngày/.test(petbattleSrc), 'Vietnamese must name the 3 days');
    });

    test('the lobby redraws when a countdown ticks over a day', () => {
        // The lobby skips re-render when its signature is unchanged. If the
        // signature only held user ids, "2 days" would stay on screen after it
        // became "1 day" — and after it became battleable.
        assert.truthy(petbattleSrc.includes('f.userId, _pbFriendWait(f)'),
            'the render signature must include each friend\'s wait label');
        assert.truthy(petbattleSrc.includes('_pbFriendWait(f)]), allWaiting,'),
            'and the all-waiting flag, or the heading would stick after the last friend matures');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
