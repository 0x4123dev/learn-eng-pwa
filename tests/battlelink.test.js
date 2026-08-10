// battlelink.test.js — the realtime transport: it must prefer the WebSocket
// room, fall back to polling rather than stranding a battle, throttle aim
// spam, and relay only the narrow message set the room accepts.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const link = require(path.join(__dirname, '..', 'js', 'battlelink.js'));
const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'battle-worker', 'src', 'index.js'), 'utf8');
const wranglerSrc = fs.readFileSync(path.join(__dirname, '..', 'battle-worker', 'wrangler.toml'), 'utf8');
const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'petbattlegame.js'), 'utf8');

// Minimal fake socket so we can drive the state machine without a network.
function FakeWS(url) {
  this.url = url;
  this.readyState = 0;
  this.sent = [];
  FakeWS.last = this;
}
FakeWS.prototype.send = function (d) { this.sent.push(JSON.parse(d)); };
FakeWS.prototype.close = function () { this.readyState = 3; if (this.onclose) this.onclose(); };
FakeWS.prototype.open = function () { this.readyState = 1; if (this.onopen) this.onopen(); };
FakeWS.prototype.recv = function (obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); };

function makeLink(extra) {
  global.WebSocket = FakeWS;
  const events = { turns: [], aims: [], emotes: [], presence: [], modes: [], polls: 0 };
  const l = new link.BattleLink(Object.assign({
    battleId: 7,
    token: 'tok',
    onRemoteTurn: (m) => events.turns.push(m),
    onAim: (m) => events.aims.push(m),
    onEmote: (m) => events.emotes.push(m),
    onPresence: (m) => events.presence.push(m),
    onModeChange: (m) => events.modes.push(m),
    pollFn: () => { events.polls++; return Promise.resolve(); },
  }, extra || {}));
  return { l, events };
}

suite('battlelink: choosing a transport', () => {
    test('opens a room socket for this battle, carrying the auth token', () => {
        const { l } = makeLink();
        l.start();
        assert.truthy(FakeWS.last.url.indexOf('/room/7') > 0, FakeWS.last.url);
        assert.truthy(FakeWS.last.url.indexOf('token=tok') > 0, 'token must be sent');
        assert.truthy(/^wss:/.test(FakeWS.last.url), 'must be a secure socket');
        l.close();
    });

    test('goes live once the socket opens', () => {
        const { l, events } = makeLink();
        l.start();
        FakeWS.last.open();
        assert.equal(l.mode, 'live');
        assert.truthy(l.isLive());
        assert.truthy(events.modes.indexOf('live') >= 0);
        l.close();
    });

    test('a battle is never stranded: it falls back to polling after retries', () => {
        const { l } = makeLink();
        l.start();
        for (let i = 0; i <= link.BL_MAX_RETRIES; i++) {
            if (FakeWS.last) FakeWS.last.close();
            l.retries = link.BL_MAX_RETRIES;      // skip the backoff timers
            l._openSocket();
        }
        FakeWS.last.close();
        assert.equal(l.mode, 'polling');
        l.close();
    });

    test('with no WebSocket support at all it just polls', () => {
        const saved = global.WebSocket;
        const { l } = makeLink();
        global.WebSocket = undefined;
        l.start();
        assert.equal(l.mode, 'polling');
        l.close();
        global.WebSocket = saved;
    });

    test('without a token it never opens a socket', () => {
        const { l } = makeLink({ token: null });
        l.start();
        assert.equal(l.mode, 'polling');
        l.close();
    });
});

suite('battlelink: messages', () => {
    test('a fired turn is relayed with everything the opponent needs to replay it', () => {
        const { l } = makeLink();
        l.start(); FakeWS.last.open();
        l.sendTurn({ turnNo: 3, angle: 45, power: 70, shots: 4, damage: 22 });
        const m = FakeWS.last.sent.pop();
        assert.equal(m.t, 'turn');
        assert.deepEqual([m.turnNo, m.angle, m.power, m.shots, m.damage], [3, 45, 70, 4, 22]);
        l.close();
    });

    test('incoming turns, aims, emotes and presence reach their callbacks', () => {
        const { l, events } = makeLink();
        l.start(); FakeWS.last.open();
        FakeWS.last.recv({ t: 'turn', from: 2, turnNo: 4, angle: 30, power: 50, shots: 2, damage: 9 });
        FakeWS.last.recv({ t: 'aim', from: 2, angle: 33, power: 55 });
        FakeWS.last.recv({ t: 'emote', from: 2, e: '🎉' });
        FakeWS.last.recv({ t: 'presence', peers: 2 });
        assert.equal(events.turns.length, 1);
        assert.equal(events.aims.length, 1);
        assert.equal(events.emotes[0].e, '🎉');
        assert.equal(events.presence[0].peers, 2);
        l.close();
    });

    test('malformed frames are ignored, not crashed on', () => {
        const { l, events } = makeLink();
        l.start(); FakeWS.last.open();
        FakeWS.last.onmessage({ data: 'not json' });
        FakeWS.last.onmessage({ data: '{"no":"type"}' });
        assert.equal(events.turns.length + events.aims.length + events.emotes.length, 0);
        l.close();
    });

    test('aim updates are throttled so a dragged slider cannot flood the room', () => {
        const { l } = makeLink();
        l.start(); FakeWS.last.open();
        let accepted = 0;
        for (let i = 0; i < 50; i++) if (l.sendAim(40 + i, 60, 1)) accepted++;
        assert.equal(accepted, 1, 'only the first of a rapid burst goes out');
        l.close();
    });

    test('nothing is sent once the link is closed', () => {
        const { l } = makeLink();
        l.start(); FakeWS.last.open();
        const before = FakeWS.last.sent.length;
        l.close();
        l.sendTurn({ turnNo: 1, angle: 1, power: 1, shots: 1, damage: 0 });
        l.sendEmote('👍');
        assert.equal(FakeWS.last.sent.length, before + 1, 'only the farewell frame');
        assert.equal(FakeWS.last.sent[before].t, 'bye');
    });
});

suite('battle room worker: safety and shape', () => {
    test('only the two players of a live battle may enter a room', () => {
        assert.truthy(workerSrc.includes('verifyToken'), 'must verify the signed token');
        assert.truthy(workerSrc.includes('challenger_id !== payload.uid'), 'must check participation');
        assert.truthy(workerSrc.includes("status !== 'active'"), 'must reject finished battles');
    });

    test('the room relays only a narrow, known message set', () => {
        assert.truthy(/RELAY_TYPES = new Set\(\['turn', 'aim', 'emote', 'hello', 'bye'\]\)/.test(workerSrc));
        assert.truthy(workerSrc.includes('EMOTES.has(msg.e)'), 'emotes must be from the fixed list');
    });

    test('there is no free-text channel anywhere in the room', () => {
        // `name` on hello is the only string, and it is length-capped.
        const strings = workerSrc.match(/String\(msg\.[a-z]+ \|\| ''\)[^\n]*/g) || [];
        for (const s of strings) assert.truthy(s.includes('.slice('), 'every relayed string must be capped: ' + s);
    });

    test('identity comes from the verified token, never from the client', () => {
        assert.truthy(workerSrc.includes("fwd.searchParams.set('uid'"), 'server sets uid');
        assert.truthy(workerSrc.includes("fwd.searchParams.delete('token')"), 'token is not forwarded');
        assert.truthy(workerSrc.includes('deserializeAttachment'), 'sender identity read from the socket');
    });

    test('the worker is configured for a free-plan SQLite Durable Object', () => {
        assert.truthy(wranglerSrc.includes('new_sqlite_classes = ["BattleRoom"]'));
        assert.truthy(wranglerSrc.includes('class_name = "BattleRoom"'));
        assert.truthy(wranglerSrc.includes('eng_pwa_db'), 'shares the app database');
    });

    test('sockets hibernate so an idle room costs nothing', () => {
        assert.truthy(workerSrc.includes('acceptWebSocket'), 'must use the hibernation API');
        assert.truthy(workerSrc.includes('webSocketMessage'), 'hibernation-style handlers');
    });

    test('D1 remains the referee — the room never writes HP or results', () => {
        assert.falsy(/UPDATE\s+battles/i.test(workerSrc), 'the relay must not mutate battle state');
        assert.falsy(/INSERT\s+INTO/i.test(workerSrc), 'the relay must not write turns');
    });
});

suite('battle game: live features are wired', () => {
    test('a relayed turn replays immediately, and only once', () => {
        assert.truthy(gameSrc.includes('onLiveTurn'), 'game must accept relayed turns');
        assert.truthy(gameSrc.includes('turn.turn_no <= (this._seenTurn || 0)'), 'must de-duplicate');
    });

    test('the opponent\'s aim is drawn as a ghost arc and expires', () => {
        assert.truthy(gameSrc.includes('onOpponentAim'));
        assert.truthy(gameSrc.includes('foeAiming') && gameSrc.includes('setLineDash'), 'ghost arc drawn');
        assert.truthy(gameSrc.includes('4000'), 'a stale aim must fade');
    });

    test('emotes are emoji-only and animate away', () => {
        assert.truthy(gameSrc.includes('_pbGameEmote'));
        assert.truthy(/\['👍', '😮', '🎉', '😅', '🔥'\]/.test(gameSrc), 'fixed emoji set in the UI');
    });

    test('the child can see whether the battle is live or slow', () => {
        assert.truthy(gameSrc.includes('pb-link'), 'connection pill rendered');
        assert.truthy(gameSrc.includes('Trực tiếp'), 'live label');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
