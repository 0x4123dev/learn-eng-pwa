// battlelink.test.js — the realtime transport: it must prefer the WebSocket
// room, fall back to polling rather than stranding a battle, throttle aim
// spam, and relay only the narrow message set the room accepts.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const link = require(path.join(__dirname, '..', 'js', 'battlelink.js'));
const game = require(path.join(__dirname, '..', 'js', 'petbattlegame.js'));
const workerSrc = fs.readFileSync(path.join(__dirname, '..', 'battle-worker', 'src', 'index.js'), 'utf8');
const wranglerSrc = fs.readFileSync(path.join(__dirname, '..', 'battle-worker', 'wrangler.toml'), 'utf8');
const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'petbattlegame.js'), 'utf8');
const petbattleSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'petbattle.js'), 'utf8');
const stylesSrc = require('./css-all').readAllCss();

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
        // The words moved into PB_STR when the battle became bilingual; the
        // wording itself is pinned there, in both languages.
        for (const key of ['gLive', 'gWaitPeer', 'gConnecting', 'gSlow']) {
            assert.truthy(gameSrc.includes(`gT('${key}')`), `${key} label`);
        }
        assert.truthy(petbattleSrc.includes('gLive:'), 'the live label must exist in the string table');
    });
});

suite('battle game: efficient and accessible UI', () => {
    test('the battle shell is mounted once and later renders update it in place', () => {
        assert.truthy(gameSrc.includes('if (!this._shellReady)'), 'render must guard the one-time shell mount');
        assert.truthy(gameSrc.includes('this._updateUi(maxShots)'), 'later renders must update existing controls');
    });

    test('animation frames run only while visual effects are active', () => {
        assert.falsy(gameSrc.includes('this.loop();'), 'start must not launch a permanent 60 FPS loop');
        assert.truthy(gameSrc.includes('_hasActiveAnimation'));
        assert.truthy(gameSrc.includes('if (this._hasActiveAnimation()) this._requestFrame()'));
    });

    test('HP, controls, live status, and canvas expose accessible semantics', () => {
        // The two pet panels were removed; HP now lives on the battlefield
        // strip, which therefore must NOT be aria-hidden or the information
        // leaves the screen-reader path entirely.
        assert.truthy(gameSrc.includes('role="progressbar"'), 'HP must still be a readable value');
        const strip = gameSrc.slice(gameSrc.indexOf('class="pb-field-status"'), gameSrc.indexOf('class="pb-field-status"') + 200);
        assert.falsy(strip.includes('aria-hidden'), 'the only source of HP must not be hidden');
        assert.truthy(gameSrc.includes('aria-valuenow'));
        assert.truthy(gameSrc.includes('tabindex="0"'));
        assert.truthy(gameSrc.includes("gT('gCanvasHelp')"), 'the canvas needs a described-by help string');
        // …and that help must still teach the keyboard controls, in both languages.
        assert.truthy(/gCanvasHelp: 'Each pet[^']*Arrow keys/.test(petbattleSrc), 'English help must mention arrow keys');
        assert.truthy(/gCanvasHelp: '[^']*phím mũi tên/.test(petbattleSrc), 'Vietnamese help must mention arrow keys');
        assert.truthy(gameSrc.includes('aria-live="polite"'));
        assert.truthy(gameSrc.includes('role="img" aria-label='));
    });

    test('battle controls have touch targets, keyboard focus, and reduced-motion support', () => {
        assert.truthy(/\.pb-emote\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(stylesSrc));
        assert.truthy(stylesSrc.includes(':focus-visible'));
        assert.truthy(stylesSrc.includes('@media (prefers-reduced-motion: reduce)'));
        assert.truthy(gameSrc.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
    });
});

// The manual aim controls and camera anchors were first written in the dark
// palette of the canvas HUD, then dropped into .pb-controls — a LIGHT frosted
// card. Measured contrast was 1.2-1.5 against a 4.5 bar: pale text on a
// near-white panel, which looks fine in a diff and is invisible on a phone.
// Nothing in a code review catches that, so it is pinned here.
suite('battle controls: readable on the light panel', () => {
    // Colours that belong to the dark HUD and must never appear on the light
    // control card again.
    const DARK_HUD_INK = ['#cbd5e1', '#e2e8f0', '#94a3b8', 'rgba(255,255,255,0.75)', 'rgba(255, 255, 255, 0.75)'];

    const block = (selector) => {
        const i = stylesSrc.indexOf(selector + ' {');
        assert.truthy(i >= 0, `${selector} has no styles`);
        return stylesSrc.slice(i, stylesSrc.indexOf('}', i));
    };

    test('the control panel really is light, so its ink must be dark', () => {
        assert.truthy(block('.pb-controls').includes('background: rgba(255,255,255,.78)'),
            'if this panel goes dark, every colour below has to be revisited');
    });

    for (const sel of ['.pb-aim-name', '.pb-aim-val', '.pb-step', '.pb-anchor']) {
        test(`${sel} does not use dark-HUD ink on the light card`, () => {
            const css = block(sel);
            for (const ink of DARK_HUD_INK) {
                assert.falsy(css.includes(ink), `${sel} uses ${ink} — pale text on a near-white panel`);
            }
            assert.truthy(/color: #[0-9a-f]{6}/i.test(css), `${sel} needs an explicit colour`);
        });
    }

    test('the steppers are a solid fill, not a translucent tint of their own ink', () => {
        const css = block('.pb-step');
        // background rgba(253,224,71,.14) + colour #fde047 was yellow on
        // near-yellow: a 1.24 contrast ratio.
        assert.falsy(/background: rgba\(253, ?224, ?71/.test(css), 'a wash of the text colour is not a background');
        assert.truthy(css.includes('background: #'), 'a 44px button needs a solid fill to read');
    });

    test('the in-battle flags follow the callout, which is also light', () => {
        assert.truthy(block('.pb-turn-callout').includes('background: rgba(236,254,255,.9)'),
            'the callout is a pale pill — white flag text would vanish on it');
        const flag = stylesSrc.slice(stylesSrc.indexOf('.pb-game-lang .pb-flag span'));
        assert.falsy(flag.slice(0, 120).includes('rgba(255,255,255'), 'white flag labels on a pale pill');
    });

    test('every control keeps a 44px touch target', () => {
        assert.truthy(block('.pb-step').includes('height: 44px'));
        assert.truthy(block('.pb-anchor').includes('min-height: 44px'));
    });
});

suite('battle turns are never silently dropped', () => {
    // _seenTurn (and the poll cursor with it) advanced BEFORE the !busy guard,
    // so an opponent turn arriving mid-animation was marked seen and thrown
    // away — the poll would never fetch it again and the shot simply never
    // played. A poll after a reconnect returning two turns lost the second.
    test('a turn arriving during an animation is queued, not discarded', () => {
        assert.truthy(gameSrc.includes('_queueTurn'), 'no queue exists');
        const live = gameSrc.slice(gameSrc.indexOf('prototype.onLiveTurn'), gameSrc.indexOf('prototype._queueTurn'));
        assert.falsy(/!this\.busy/.test(live), 'onLiveTurn must not drop on busy');
        const server = gameSrc.slice(gameSrc.indexOf('prototype.onServerState'));
        assert.falsy(/!this\.busy\) this\._replay/.test(server.slice(0, 600)), 'onServerState must not drop on busy');
    });

    test('the queue replays each turn exactly once, in order', () => {
        const q = gameSrc.slice(gameSrc.indexOf('prototype._queueTurn'), gameSrc.indexOf('prototype.onOpponentAim'));
        assert.truthy(q.includes('some(t => t.turn_no === turn.turn_no)'), 'a repeat must not double-replay');
        assert.truthy(q.includes('sort((a, b) => a.turn_no - b.turn_no)'), 'turns must play in order');
        assert.truthy(q.includes('if (this.finished || this.busy) return'), 'draining must wait for a safe boundary');
    });

    test('the queue drains when each animation finishes', () => {
        const fire = gameSrc.slice(gameSrc.indexOf('prototype._launchMyVolley'), gameSrc.indexOf('prototype._replay'));
        assert.truthy(fire.includes('this._drainTurns()'), 'after my own volley');
        const replay = gameSrc.slice(gameSrc.indexOf('prototype._launchFoeVolley'));
        assert.truthy(replay.slice(0, 1400).includes('this._drainTurns()'), 'after a replayed volley');
    });

    test('a destroyed game replays nothing', () => {
        const d = gameSrc.slice(gameSrc.indexOf('prototype.destroy'));
        assert.truthy(d.slice(0, 300).includes('_turnQueue = []'), 'the queue must be emptied on destroy');
    });
});

suite('battles run until the poop runs out', () => {
    const calc = require(path.join(__dirname, '..', 'js', 'battlecalc.js'));
    const turnSrc2 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'api', 'battle', 'turn.js'), 'utf8');

    test('the round counter is no longer capped at five', () => {
        assert.falsy(gameSrc.includes('Math.min(this.calc.BATTLE_ROUNDS, Math.ceil(this.turnNo / 2))'),
            'rounds must not be clamped to BATTLE_ROUNDS');
        assert.truthy(gameSrc.includes('Math.max(1, Math.ceil(this.turnNo / 2))'));
    });

    test('one poop per turn stretches a full clip into twenty rounds', () => {
        // 20 shots fired one at a time = 20 of my turns = 40 turns total.
        assert.equal(calc.AMMO_CAP, 20);
        assert.truthy(calc.MAX_TURNS >= calc.AMMO_CAP * 2, `MAX_TURNS ${calc.MAX_TURNS} cuts a legal duel short`);
    });

    test('the server ends the battle on ammo, not on a round number', () => {
        assert.falsy(turnSrc2.includes('BATTLE_ROUNDS * 2'), 'the fixed round cap should be gone');
        assert.truthy(turnSrc2.includes('myAmmoAfter <= 0 && foeAmmo <= 0'), 'both sides empty ends it');
        assert.truthy(turnSrc2.includes('nextTurnNo > MAX_TURNS'), 'a runaway guard must still exist');
    });

    test('a player with no poop left does not block the one who has some', () => {
        assert.truthy(turnSrc2.includes('const foeCanFire = foeAmmo > 0'), 'turn handover must consider ammo');
        assert.truthy(turnSrc2.includes('nextUserId'), 'the next shooter must be chosen, not assumed');
    });

    test('an empty clip passes the turn instead of firing a phantom poop', () => {
        assert.truthy(gameSrc.includes('if (maxShots <= 0) { this._passTurn(); return; }'));
        const pass = gameSrc.slice(gameSrc.indexOf('prototype._passTurn'));
        assert.truthy(pass.slice(0, 500).includes('shots: 0'), 'a pass must cost no ammo');
    });
});

suite('battle game: Gunbound-style house arena', () => {
    test('house damage advances through six states, and only 100 HP is pristine', () => {
        assert.deepEqual([100, 99, 75, 50, 25, 0].map(game.pbHouseDamageStage), [0, 1, 2, 3, 4, 5]);
        for (let hp = 100; hp >= 0; hp--) {
            assert.inRange(game.pbHouseDamageStage(hp), 0, 5);
        }
    });

    // A four-stage ladder meant a 100→99 hit changed nothing on screen: the
    // child landed a shot and the house looked untouched.
    test('a single point of damage visibly breaks the house', () => {
        assert.equal(game.pbHouseDamageStage(100), 0, '100 HP is the only pristine state');
        assert.equal(game.pbHouseDamageStage(99), 1, 'one point of damage must show');
        assert.truthy(gameSrc.includes('if (damage === 0) {'), 'the pristine tower needs its own art');
        assert.truthy(gameSrc.includes('else if (damage < 4) {'), 'stage 1 needs a broken-tower silhouette');
        assert.truthy(gameSrc.includes('38×42px bite'), 'stage 1 breach must be deliberately phone-readable');
        assert.truthy(gameSrc.includes('Exposed black interior'), 'the missing wall must expose the castle interior');
    });

    test('every castle stage renders safely in both directions', () => {
        const gradient = { addColorStop() {} };
        const ctx = new Proxy({ createLinearGradient: () => gradient }, {
            get(target, key) {
                if (key in target) return target[key];
                if (typeof key === 'string') return () => {};
            },
            set(target, key, value) { target[key] = value; return true; },
        });
        for (const hp of [100, 99, 75, 50, 25, 0]) {
            for (const facing of [1, -1]) {
                game.PetBattleGame.prototype._drawHouse.call(
                    { ctx }, { x: 140, y: 360 }, null, facing, hp, 45, '#38bdf8', 17
                );
            }
        }
    });

    test('five hearts drain proportionally with every HP change', () => {
        for (const hp of [100, 99, 73, 50, 1, 0]) {
            const fills = game.pbHeartFills(hp);
            assert.equal(fills.length, 5);
            assert.equal(fills.reduce((sum, n) => sum + n, 0), hp * 5, `heart fill at ${hp} HP`);
            fills.forEach(n => assert.inRange(n, 0, 100));
        }
    });

    test('both pets render inside HP-driven houses and hit messages mention house damage', () => {
        assert.truthy(gameSrc.includes('this._drawHouse(this.mePos'));
        assert.truthy(gameSrc.includes('this._drawHouse(this.foePos'));
        assert.truthy(gameSrc.includes('pbHouseDamageStage(hp)'));
        assert.truthy(gameSrc.includes("gT('gHit'"), 'hit banner must be translatable');
        assert.truthy(gameSrc.includes("gT('gHitMe'"), 'incoming-hit banner must be translatable');
    });

    test('the active cannon has a visible guide tied to angle and power', () => {
        assert.truthy(gameSrc.includes('this._drawAimGuide(this.mePos'));
        assert.truthy(gameSrc.includes('const length = 46 + Math.max(10, Math.min(100, power)) * .58'));
        assert.truthy(gameSrc.includes("ctx.fillText(Math.round(angle) + '°'"));
        assert.truthy(gameSrc.includes('Math.atan2(startY - y, forward)'));
    });

    test('the HUD includes partial hearts and a high-contrast arcade arena', () => {
        // The hearts are drawn on the canvas now (pbHeartFills); the old DOM
        // HUD (.pb-hud, .pb-heart::before) is gone from the game source
        // (tests/battle-camera-follow.test.js) and its rules were pruned as
        // dead in the stylesheet split.
        assert.truthy(gameSrc.includes('pbHeartFills'));
        assert.truthy(stylesSrc.includes('border: 4px solid #182b66'));
        assert.truthy(stylesSrc.includes('@media (max-width: 380px)'));
    });

    test('the battlefield supports direct aiming and precise keyboard controls', () => {
        assert.truthy(gameSrc.includes("this.canvas.addEventListener('pointerdown'"));
        assert.truthy(gameSrc.includes("this.canvas.addEventListener('pointermove'"));
        assert.truthy(gameSrc.includes("key === 'ArrowLeft'"));
        assert.truthy(gameSrc.includes("key === 'ArrowUp'"));
        assert.truthy(gameSrc.includes("if (key === ' ') { this.fire(); return; }"));
        // The "drag to aim" hint was removed from the canvas at the user's
        // request; the aim instruction below the field still explains it.
        assert.truthy(gameSrc.includes("gT('gAimTitle')"), 'aiming must still be explained somewhere');
    });

    test('rich feedback includes trajectory dots, wind ribbons, and bounded impact particles', () => {
        assert.truthy(gameSrc.includes('this._drawTrajectoryPreview(this.mePos'));
        assert.truthy(gameSrc.includes('// Wind ribbons'));
        assert.truthy(gameSrc.includes('this.impactParticles.push'));
        assert.truthy(gameSrc.includes('this.impactParticles = this.impactParticles.filter'));
        assert.truthy(gameSrc.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
    });

    test('both projectile types leave bounded smoke that lingers after flight', () => {
        assert.truthy(gameSrc.includes('this.projectileSmoke = []'));
        assert.truthy(gameSrc.includes('this.projectileSmoke = this.projectileSmoke.filter'));
        assert.truthy(gameSrc.includes('this.projectileSmoke.length<180'), 'smoke must stay bounded on a five-shot volley');
        assert.truthy(gameSrc.includes("smoke.rocket?'#46505d':'#54463e'"), 'rocket and poop smoke need distinct tones');
        assert.truthy(gameSrc.includes('this.projectileSmoke.length > 0'), 'lingering smoke must keep the animation loop alive');
    });

    test('the fire control stays in the thumb zone without scrolling', () => {
        assert.truthy(gameSrc.includes('class="pb-fire-dock"'));
        assert.truthy(stylesSrc.includes('.pb-fire-dock'));
        assert.truthy(stylesSrc.includes('position: fixed'), 'the fire dock must stay visible while the tall arena scrolls');
        assert.truthy(stylesSrc.includes('env(safe-area-inset-bottom'), 'the fire dock must clear iPhone and iPad safe areas');
    });

    test('poop ammunition replaces tia controls and flies slowly enough to follow', () => {
        assert.truthy(gameSrc.includes('function _pbDrawPoopProjectile'), 'poop needs stable high-contrast canvas art');
        assert.truthy(gameSrc.includes('_pbDrawPoopProjectile(ctx,f.size,f.i)'), 'flight must use the purpose-drawn shell');
        assert.truthy(gameSrc.includes('pb-poop-stack'));
        assert.truthy(gameSrc.includes('while (f.tick >= 2 && f.i < f.points.length - 1)'),
            'one path point per two 60Hz ticks — the readable pace');
        // rAF fires at the display rate, so frame-counting ran a 120Hz iPhone
        // at double speed. Pacing must come from elapsed time.
        assert.truthy(gameSrc.includes('PetBattleGame.prototype.step = function (k)'), 'step must take elapsed time');
        assert.truthy(gameSrc.includes('(t - last) / 16.667'), 'frames must be measured, not counted');
        assert.truthy(gameSrc.includes('Math.min(3, k)'), 'a backgrounded tab must not teleport a shell');
        assert.falsy(gameSrc.includes('>1 TIA<'));
    });

    // Dragging the battlefield is quick but coarse. Manual controls came back
    // so a child can dial in the last two degrees after a near miss — three
    // ways to set one number, which only works while they all agree.
    test('angle and power can be set by hand as well as by dragging', () => {
        assert.truthy(gameSrc.includes('id="pbAngle"') && gameSrc.includes('id="pbPower"'), 'sliders missing');
        assert.truthy(gameSrc.includes('type="range"'), 'a coarse control is still wanted');
        for (const id of ['pbAngleDown', 'pbAngleUp', 'pbPowerDown', 'pbPowerUp']) {
            assert.truthy(gameSrc.includes(`id="${id}"`), `${id} stepper missing`);
        }
        assert.truthy(gameSrc.includes("_pbGameNudge('angle', -1)"), 'the point is an exact single step');
        assert.truthy(gameSrc.includes("_pbGameNudge('power', 1)"));
    });

    test('every way of aiming clamps to the same range', () => {
        const bounds = gameSrc.match(/PB_ANGLE_MIN = (\d+), PB_ANGLE_MAX = (\d+)/);
        const pbounds = gameSrc.match(/PB_POWER_MIN = (\d+), PB_POWER_MAX = (\d+)/);
        assert.truthy(bounds && pbounds, 'aim bounds must be named, not scattered');
        // …and the slider, the drag handler and the arrow keys must all use them.
        assert.truthy(gameSrc.includes('min="${this.minAngle}" max="' + bounds[2] + '"'), 'the angle slider disagrees with the active map clamp');
        assert.truthy(gameSrc.includes(`min="${pbounds[1]}" max="${pbounds[2]}"`), 'the power slider disagrees with the clamp');
        // Every path must clamp through the NAMED constants, not a retyped
        // literal — that is what keeps them from drifting apart.
        const angleClamps = (gameSrc.match(/Math\.(?:max|min)\((?:this\.|g\.)?minAngle|Math\.min\(PB_ANGLE_MAX/g) || []).length;
        const powerClamps = (gameSrc.match(/Math\.(?:max|min)\(PB_POWER_(?:MIN|MAX)/g) || []).length;
        assert.truthy(angleClamps >= 5, `only ${angleClamps} angle clamps use the active map bounds`);
        assert.truthy(powerClamps >= 4, `only ${powerClamps} power clamps use the constant`);
        assert.falsy(/this\.angle = Math\.max\(10, Math\.min\(80/.test(gameSrc),
            'the drag handler still retypes the angle bounds');
        assert.falsy(/this\.power = Math\.max\(10, Math\.min\(100/.test(gameSrc),
            'the drag handler still retypes the power bounds');
    });

    test('manual aim is refused when it is not your turn', () => {
        for (const fn of ['_pbGameSetAngle', '_pbGameSetPower']) {
            const body = gameSrc.slice(gameSrc.indexOf('function ' + fn));
            assert.truthy(body.slice(0, 260).includes('!g.myTurn || g.busy'),
                `${fn} must not let a child re-aim mid-flight or on the opponent's turn`);
        }
        assert.truthy(gameSrc.includes("for (const id of ['pbAngle', 'pbPower', 'pbAngleDown'"),
            'the controls must also be visibly disabled, not just inert');
    });

    test('a manual change is broadcast like any other aim', () => {
        for (const fn of ['_pbGameSetAngle', '_pbGameSetPower']) {
            const body = gameSrc.slice(gameSrc.indexOf('function ' + fn), gameSrc.indexOf('function ' + fn) + 400);
            assert.truthy(body.includes('_pbBroadcastAim(g)'),
                `${fn} must let the opponent watch the aim move`);
        }
    });

    test('the sliders follow a drag instead of arguing with it', () => {
        const ui = gameSrc.slice(gameSrc.indexOf('prototype._updateUi'));
        assert.truthy(ui.includes("this._el('pbAngle'); if (angleEl) angleEl.value"),
            'a drag must move the slider too, or the two disagree');
        assert.truthy(ui.includes("text('pbAngleVal'"), 'the number must track the model');
    });

    test('pet levels stay visible and a destroyed house leaves pet and rubble outdoors', () => {
        // Level is drawn ON each castle now — the pet panels are gone and
        // repeating it on the overlay was the same number twice.
        assert.truthy(gameSrc.includes("ctx.fillText('LV.'"), 'each castle must wear its level');
        assert.truthy(gameSrc.includes('_drawHouse'), 'and the castle is what draws it');
        assert.truthy(gameSrc.includes("ctx.fillText('LV.'"));
        assert.truthy(gameSrc.includes('// At zero HP the castle is truly gone'));
        assert.truthy(gameSrc.includes('if (damage < 4)'), 'critical damage must replace the intact wall');
        assert.truthy(gameSrc.includes('if (damage >= 5)'), 'zero HP must collapse to rubble');
        assert.truthy(gameSrc.includes('this.houseImpacts.push'));
        assert.truthy(gameSrc.includes('this.castleDebris.push'), 'impact must throw large masonry fragments');
        assert.truthy(gameSrc.includes('this.castleDebris = this.castleDebris.filter'), 'debris animation must clean itself up');
        assert.truthy(gameSrc.includes('createRadialGradient(e.x-radius'), 'explosion needs a layered fireball');
        assert.truthy(gameSrc.includes('navigator.vibrate([28,18,46])'), 'a damaging hit should have bounded haptic feedback');
    });

    test('castle hits leave persistent deep cavities at the real impact point', () => {
        assert.truthy(gameSrc.includes('this.castleHoles = []'));
        assert.truthy(gameSrc.includes('prototype._recordCastleHole'));
        assert.truthy(gameSrc.includes('prototype._drawCastleHoles'));
        assert.truthy(gameSrc.includes('hole.depth=Math.min(1,hole.depth+.2)'), 'repeat hits should deepen a nearby hole');
        assert.truthy(gameSrc.includes('if (sameSide.length>=5)'), 'persistent holes must be visually bounded');
        assert.truthy(gameSrc.includes('this._recordCastleHole(f.target,f.hit,f.damage)'));
        assert.truthy(gameSrc.includes('createRadialGradient(-r*.2,-r*.22'), 'the hole needs a shaded deep core');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
