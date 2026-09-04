// The ghost-offering event runs ONE night. Three separately-written pieces have
// to agree on which night: the child's screen, the Pages API that pays the
// coins, and the WebSocket Worker that hands out item locks. The Worker ships
// on its own `wrangler deploy`, so nothing at deploy time forces the two halves
// to move together — only these tests do.
//
// Two kinds of test live here:
//   1. the schedule itself is right (22:00–24:00 GMT+7 on the stated date);
//   2. nobody has reintroduced a second copy of the date.
'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SCHEDULE = require('../js/ghost-offering-schedule.js');

const HOUR = 60 * 60 * 1000;

// Every file that needs to know when the event happens.
const CONSUMERS = [
  'js/ghost-offering-event.js',
  'functions/api/ghost-offering.js',
  'battle-worker/src/index.js',
];

suite('ghost offering: the schedule is one source of truth', () => {
    test('every consumer imports the shared schedule instead of its own copy', () => {
        for (const f of CONSUMERS) {
            assert.truthy(/ghost-offering-schedule/.test(read(f)),
                `${f} does not read js/ghost-offering-schedule.js`);
        }
    });

    // The failure this guards against is silent: the child's screen counts down
    // and unlocks, then every socket is refused with 409 Wrong event room, and
    // nothing on screen says why.
    test('no consumer hardcodes a date or a UTC timestamp of its own', () => {
        for (const f of CONSUMERS) {
            const code = read(f)
                .split('\n')
                .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))   // prose may name the date
                .join('\n');
            assert.falsy(/\d{4}-\d{2}-\d{2}/.test(code),
                `${f} contains a literal YYYY-MM-DD outside a comment`);
            assert.falsy(/Date\.UTC\s*\(/.test(code),
                `${f} builds its own event instant with Date.UTC`);
        }
    });

    test('the room names are built in one place, never string-concatenated again', () => {
        for (const f of CONSUMERS) {
            const code = read(f);
            assert.falsy(/['"]qa-human-['"]\s*\+/.test(code), `${f} rebuilds the human QA room name`);
            assert.falsy(/['"]qa-['"]\s*\+\s*(roomDate|eventDate)/.test(code), `${f} rebuilds the QA room name`);
        }
    });

    test('the shared module is loaded before the screen that uses it, and cached offline', () => {
        const html = read('index.html');
        const iSchedule = html.indexOf('js/ghost-offering-schedule.js');
        const iEvent = html.indexOf('js/ghost-offering-event.js');
        assert.truthy(iSchedule > -1, 'index.html never loads the schedule');
        assert.truthy(iSchedule < iEvent, 'the schedule must load before the event screen reads it');
        assert.truthy(read('sw.js').includes("'/js/ghost-offering-schedule.js'"),
            'the schedule is not precached, so the event breaks offline');
    });
});

suite('ghost offering: the night of the event', () => {
    // 22:00 GMT+7 on 10 Sep 2026. Written out as an absolute instant so a
    // mistyped month or hour fails here rather than on the night.
    const OPEN = Date.parse('2026-09-10T15:00:00.000Z');

    test('the window opens at 22:00 GMT+7 and lasts two hours', () => {
        assert.equal(SCHEDULE.OPENS_AT, OPEN, 'the event does not open at 22:00 GMT+7 on 10 Sep 2026');
        assert.equal(SCHEDULE.DURATION_MS, 2 * HOUR, 'the ceremony is a two-hour window');
        assert.equal(SCHEDULE.CLOSES_AT, OPEN + 2 * HOUR);
        assert.equal(new Date(SCHEDULE.OPENS_AT + SCHEDULE.TZ_OFFSET_MS).toISOString().slice(11, 16), '22:00');
    });

    // EVENT_DATE is not decoration: it is the name of the public room. If it
    // ever drifts from OPENS_AT, children join a room on one date while the
    // window opens on another.
    test('the room name is the GMT+7 calendar date the window opens on', () => {
        assert.equal(SCHEDULE.EVENT_DATE, SCHEDULE.localDate(SCHEDULE.OPENS_AT));
        assert.equal(SCHEDULE.EVENT_DATE, SCHEDULE.publicRoomId());
        assert.equal(SCHEDULE.localDate(SCHEDULE.CLOSES_AT - 1), SCHEDULE.EVENT_DATE,
            'the window must not run past midnight into the next room name');
    });

    test('the window is shut before, open during, and ended after — to the millisecond', () => {
        const at = ms => SCHEDULE.eventWindow(ms);
        assert.falsy(at(OPEN - 1).open, 'one millisecond early must still be locked');
        assert.falsy(at(OPEN - 1).ended);
        assert.truthy(at(OPEN).open, 'the event must be open on the stroke of 22:00');
        assert.truthy(at(OPEN + 2 * HOUR - 1).open, 'the last millisecond still counts');
        assert.falsy(at(OPEN + 2 * HOUR).open, 'midnight closes the table');
        assert.truthy(at(OPEN + 2 * HOUR).ended);
        assert.equal(at(OPEN - 1).nextOpensAt, OPEN, 'the countdown must point at the event');
    });

    test('QA rooms are separate from the public table, so a tester cannot take a real offering', () => {
        const pub = SCHEDULE.roomIdFor({ preview: false });
        const qa = SCHEDULE.roomIdFor({ preview: true, humanTest: false });
        const human = SCHEDULE.roomIdFor({ preview: true, humanTest: true });
        assert.equal(pub, SCHEDULE.EVENT_DATE);
        assert.equal(qa, SCHEDULE.qaRoomId());
        assert.equal(human, SCHEDULE.humanTestRoomId());
        assert.equal(new Set([pub, qa, human]).size, 3, 'the three rooms must have distinct names');
        // The Worker's regex only accepts [A-Za-z0-9_-]{1,64} as a room name.
        for (const id of [pub, qa, human]) {
            assert.truthy(/^[A-Za-z0-9_-]{1,64}$/.test(id), `the Worker would 404 on room name ${id}`);
        }
    });

    test('the schedule object is frozen: nothing can move the event at runtime', () => {
        try { SCHEDULE.EVENT_DATE = '1999-01-01'; } catch (_) { /* strict mode throws */ }
        assert.equal(SCHEDULE.EVENT_DATE, SCHEDULE.localDate(SCHEDULE.OPENS_AT));
    });
});

suite('ghost offering: the API answers with exactly the shared schedule', () => {
    const { createWorld, loadModule } = require('./pages-harness');
    const handler = loadModule('functions/api/ghost-offering.js');

    async function windowFor(allowBot) {
        const world = createWorld();
        const user = await world.createUser({ username: allowBot ? 'qa' : 'be', allowBot });
        return world.call(handler.onRequestGet, { method: 'GET', token: user.token, url: '/api/ghost-offering' });
    }

    test('a bot-off child gets the shared window and the public room', async () => {
        const res = await windowFor(false);
        assert.equal(res.status, 200, 'the event API must answer a signed-in child');
        assert.equal(res.data.eventDate, SCHEDULE.EVENT_DATE);
        assert.equal(res.data.opensAt, SCHEDULE.OPENS_AT);
        assert.equal(res.data.closesAt, SCHEDULE.CLOSES_AT);
        assert.equal(res.data.roomId, SCHEDULE.publicRoomId(),
            'a bot-off child must land in the public room, not a QA room');
    });

    test('a QA account is sent to a QA room, never the public one', async () => {
        const res = await windowFor(true);
        assert.equal(res.status, 200);
        assert.equal(res.data.roomId, SCHEDULE.qaRoomId());
        assert.falsy(res.data.roomId === SCHEDULE.publicRoomId(),
            'a tester must never be able to take an offering off the real table');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
