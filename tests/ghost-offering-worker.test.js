// Drives the REAL battle-worker source (battle-worker/src/index.js) with a
// stubbed env, instead of grepping it for strings.
//
// This is the half of the event that ships on its own `wrangler deploy`, so it
// is the half most likely to drift from the Pages app. What matters is not that
// the file mentions the right words but that a socket ends up in the right
// room at the right time — so every assertion here is a status code or the URL
// the Worker actually forwards to the Durable Object.
'use strict';

const { suite, test, assert } = require('./harness');
const { loadModule, AUTH_SECRET } = require('./pages-harness');

const SCHEDULE = require('../js/ghost-offering-schedule.js');
const worker = loadModule('battle-worker/src/index.js').default;
const lib = loadModule('functions/api/_lib.js');

const OPEN_AT = SCHEDULE.OPENS_AT;
const KID = { username: 'be', allow_bot: 0 };
const QA = { username: 'qa', allow_bot: 1 };

// The Worker reads the signing secret out of D1's config table and looks the
// player up in users. Nothing else touches the database on this path.
function envFor(user, forwarded) {
    return {
        GHOST_OFFERING_ROOM: {
            idFromName: name => name,
            get: name => ({
                fetch(req) { forwarded.push({ name, url: req.url }); return new Response('joined', { status: 200 }); },
            }),
        },
        DB: {
            prepare(sql) {
                return { bind() { return { async first() {
                    if (/config/.test(sql)) return { value: AUTH_SECRET };
                    if (/users/.test(sql)) return user;
                    return null;
                } }; } };
            },
        },
    };
}

async function connect(opts) {
    const o = opts || {};
    const forwarded = [];
    const token = o.token !== undefined ? o.token
        : await lib.signToken({ uid: 7, username: (o.user || KID).username }, AUTH_SECRET);
    const qs = new URLSearchParams();
    if (token) qs.set('token', token);
    if (o.bot !== undefined) qs.set('bot', String(o.bot));
    const url = `https://relay.test${o.path}${qs.toString() ? '?' + qs : ''}`;
    const headers = o.upgrade === false ? {} : { Upgrade: 'websocket' };

    // The Worker asks Date.now() for the window; freeze it for the test.
    const realNow = Date.now;
    if (o.at !== undefined) Date.now = () => o.at;
    try {
        const res = await worker.fetch(new Request(url, { headers }), envFor(o.user || KID, forwarded));
        return { status: res.status, body: await res.text(), forwarded };
    } finally { Date.now = realNow; }
}

suite('ghost offering relay: only the right people, at the right time', () => {
    test('an unknown path is 404 and a non-websocket request is 426', async () => {
        assert.equal((await connect({ path: '/nope', upgrade: false })).status, 404);
        const r = await connect({ path: '/offering/' + SCHEDULE.publicRoomId(), upgrade: false });
        assert.equal(r.status, 426, 'the offering route must exist');
        assert.equal(r.body, 'Expected WebSocket');
    });

    test('an unsigned or missing token never reaches a room', async () => {
        const room = '/offering/' + SCHEDULE.publicRoomId();
        assert.equal((await connect({ path: room, token: '', at: OPEN_AT })).status, 401);
        assert.equal((await connect({ path: room, token: 'forged.signature', at: OPEN_AT })).status, 401);
    });

    // The whole point of the shared schedule: this boundary and the child's
    // countdown are computed from the same numbers.
    test('a child is refused before 22:00, admitted during, refused after', async () => {
        const room = '/offering/' + SCHEDULE.publicRoomId();
        const early = await connect({ path: room, at: OPEN_AT - 1 });
        assert.equal(early.status, 403, 'one millisecond early must still be locked');
        assert.equal(early.body, 'Event is locked');

        const during = await connect({ path: room, at: OPEN_AT });
        assert.equal(during.status, 200, 'the child must get in on the stroke of 22:00');
        assert.equal(during.forwarded.length, 1);

        const last = await connect({ path: room, at: SCHEDULE.CLOSES_AT - 1 });
        assert.equal(last.status, 200, 'the last millisecond still counts');

        const after = await connect({ path: room, at: SCHEDULE.CLOSES_AT });
        assert.equal(after.status, 403, 'midnight closes the table');
    });

    test('the child lands in the room the schedule names, not one the client picked', async () => {
        const r = await connect({ path: '/offering/' + SCHEDULE.publicRoomId(), at: OPEN_AT });
        assert.equal(r.forwarded[0].name, 'offering-' + SCHEDULE.publicRoomId(),
            'the Durable Object id must be derived from the shared schedule');

        // A client that invents a room is rejected rather than quietly given
        // a private table where nobody else can see the offerings.
        const wrong = await connect({ path: '/offering/2020-01-01', at: OPEN_AT });
        assert.equal(wrong.status, 409);
        assert.equal(wrong.body, 'Wrong event room');
        assert.equal(wrong.forwarded.length, 0);
    });

    test('a QA account can play early, but never at the children’s table', async () => {
        const early = SCHEDULE.OPENS_AT - 7 * 24 * 3600 * 1000;
        const qa = await connect({ path: '/offering/' + SCHEDULE.qaRoomId(), user: QA, at: early });
        assert.equal(qa.status, 200, 'allow_bot testers play before the night');
        assert.equal(qa.forwarded[0].name, 'offering-' + SCHEDULE.qaRoomId());

        const stealing = await connect({ path: '/offering/' + SCHEDULE.publicRoomId(), user: QA, at: early });
        assert.equal(stealing.status, 409, 'a tester must not be able to take a real offering');
        assert.equal(stealing.forwarded.length, 0);
    });

    test('the human QA room takes real testers only — no bot-off users, no simulated bots', async () => {
        const early = SCHEDULE.OPENS_AT - 3600 * 1000;
        const path = '/offering/' + SCHEDULE.humanTestRoomId();
        assert.equal((await connect({ path, user: QA, at: early })).status, 200);
        assert.equal((await connect({ path, user: QA, bot: 0, at: early })).status, 403,
            'a simulated bot socket cannot sit at the human test table');
        assert.equal((await connect({ path, user: KID, at: early })).status, 403,
            'a bot-off child is locked out before the night, QA room or not');
    });

    test('a bot id is accepted only from a QA account and only for the two stand-ins', async () => {
        const early = SCHEDULE.OPENS_AT - 3600 * 1000;
        const room = '/offering/' + SCHEDULE.qaRoomId();
        assert.equal((await connect({ path: room, user: QA, bot: 1, at: early })).status, 200);
        assert.equal((await connect({ path: room, user: QA, bot: 2, at: early })).status, 403, 'only bots 0 and 1 exist');
        assert.equal((await connect({ path: room, user: KID, bot: 0, at: OPEN_AT })).status, 403,
            'a normal child cannot claim to be a bot');
    });

    test('the player name and actor id the room receives cannot be chosen by the client', async () => {
        const r = await connect({ path: '/offering/' + SCHEDULE.publicRoomId(), at: OPEN_AT });
        const url = new URL(r.forwarded[0].url);
        assert.equal(url.searchParams.get('uid'), '7', 'the uid comes from the signed token');
        assert.equal(url.searchParams.get('name'), KID.username, 'the name comes from the database row');
        assert.equal(url.searchParams.get('actor'), 'user-7');
        assert.equal(url.searchParams.get('token'), null, 'the auth token must not be handed on to the room');
    });
});
