// js/night-raid-ruins.js — "nhà tan hoang", the clip a child gets when the
// house they attacked was already emptied today.
//
// The bug this suite exists for: the screen hands this module a canvas and then
// WAITS on onFinish before it can show anything else. Anything that makes the
// module give up quietly — no canvas, no 2D context, a host that is not an
// element — must still call onFinish, or the child is left staring at a blank
// box with no way forward. Every bail-out below is checked for exactly that.
//
// The second thing it guards is the sprite geometry. The castle-damage sheets
// look like a tidy 3x5 grid and are not: eight of the ten rubble piles hang
// below their mathematical row line, so the naive col*w/3, row*h/5 cut saws the
// bottom off the wreck. NightRaidArt.RUINS_FRAMES are measured alpha boxes, and
// the numbers here fail if anyone "simplifies" them back to the grid.
//
// There is no canvas in this sandbox, so drawing itself is exercised in the
// browser; what is testable here is the contract, the timeline and the numbers.
const { suite, test, assert } = require('./harness');
const path = require('path');

const root = path.join(__dirname, '..');
// night-raid-art.js asks CastleSkins for the skin -> sheet/row mapping (it is
// the one owner of that order). In the browser it is a global; give it one.
const CastleSkins = require(path.join(root, 'js', 'castle-skins.js'));
global.CastleSkins = CastleSkins;
const Art = require(path.join(root, 'js', 'night-raid-art.js'));
const Ruins = require(path.join(root, 'js', 'night-raid-ruins.js'));

// The real pixel dimensions of the two sprite sheets on disk.
const SHEETS = { a: { w: 1536, h: 1024 }, b: { w: 1717, h: 916 } };

// A canvas-shaped object whose 2D context swallows every brush stroke, so a
// missing brush can never be mistaken for a broken contract.
function ctx2d() {
  return new Proxy({}, {
    get: (t, k) =>
      k === 'canvas' ? { width: 0, height: 0 }
        : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
          : k === 'measureText' ? () => ({ width: 10 })
            : (typeof k === 'string' ? () => {} : undefined),
    set: () => true,
  });
}
function fakeCanvas(w = 393, h = 220) {
  return {
    width: 0, height: 0, style: {}, dataset: {}, parentNode: null,
    getBoundingClientRect: () => ({ width: w, height: h }),
    setAttribute() {}, getContext() { return ctx2d(); },
  };
}

suite('night raid ruins: the module contract', () => {
  test('is a frozen module exposing the play() the screen codes against', () => {
    assert.equal(typeof Ruins.play, 'function');
    assert.truthy(Object.isFrozen(Ruins), 'the module must be frozen like its neighbours');
    assert.equal(Ruins.play.length, 3, 'play(canvasOrHost, target, options)');
    for (const key of ['BEATS', 'DURATION_MS', 'MARCH_END', 'REVEAL_END', 'BEAT_END', 'TURN_END', 'RETREAT_END'])
      assert.truthy(Ruins[key] !== undefined, 'missing export ' + key);
    assert.truthy(Object.isFrozen(Ruins.BEATS));
  });

  test('the beat sheet adds up to the duration it claims, and it is a 4-6 second story', () => {
    const sum = Object.keys(Ruins.BEATS).reduce((n, k) => n + Ruins.BEATS[k], 0);
    assert.equal(sum, Ruins.DURATION_MS, 'the beats must account for the whole clip');
    assert.inRange(Ruins.DURATION_MS, 4000, 6000, 'the brief asks for 4-6 seconds');
    const marks = [0, Ruins.MARCH_END, Ruins.REVEAL_END, Ruins.BEAT_END, Ruins.TURN_END, Ruins.RETREAT_END, Ruins.DURATION_MS];
    for (let i = 1; i < marks.length; i++)
      assert.truthy(marks[i] > marks[i - 1], 'the beats must run forward: ' + marks.join(' < '));
    assert.equal(Ruins.MARCH_END, Ruins.BEATS.march);
    assert.equal(Ruins.RETREAT_END + Ruins.BEATS.hold, Ruins.DURATION_MS);
  });

  test('a missing, blank or context-less target still calls onFinish instead of throwing', () => {
    const targets = [
      ['nothing at all', null],
      ['undefined', undefined],
      ['a bare object that is neither canvas nor element', {}],
      ['an element whose getContext returns null', { getContext: () => null, setAttribute() {}, style: {} }],
      ['an element whose getContext throws', { getContext: () => { throw new Error('no gl'); }, setAttribute() {}, style: {} }],
    ];
    for (const [label, host] of targets) {
      let finished = 0;
      let handle;
      handle = Ruins.play(host, { castleSkin: 'stone-keep', name: 'Bo' }, { onFinish: () => finished++ });
      assert.equal(finished, 1, label + ': onFinish must fire or the screen hangs');
      assert.truthy(handle && typeof handle.destroy === 'function', label + ': must still return a handle');
      assert.equal(handle.durationMs, Ruins.DURATION_MS, label + ': the handle reports the same clip length');
      assert.truthy(handle.finished, label + ': a bail-out handle is already finished');
      handle.destroy(); handle.destroy();
      assert.equal(finished, 1, label + ': and it must fire exactly once');
    }
  });

  test('play() survives a caller with no onFinish, no target and no options', () => {
    Ruins.play(null).destroy();
    Ruins.play(null, null, null).destroy();
    Ruins.play({}, {}, {}).destroy();
    const h = Ruins.play(fakeCanvas(), {});      // no options object at all
    assert.truthy(h && typeof h.destroy === 'function');
    h.destroy();
  });

  test('destroy() is idempotent, and is a stop rather than a finish', () => {
    let finished = 0;
    const handle = Ruins.play(fakeCanvas(), { castleSkin: 'forest-fort', name: 'Bảo An' }, { onFinish: () => finished++ });
    assert.equal(finished, 0, 'the story has not been told yet');
    assert.falsy(handle.finished, 'a live clip is not finished');
    assert.equal(handle.durationMs, Ruins.DURATION_MS);
    handle.destroy(); handle.destroy(); handle.destroy();
    assert.truthy(handle.finished, 'a destroyed clip reports itself finished');
    assert.equal(finished, 0, 'closing the screen must not fire the callback that advances it');
  });

  test('left alone, the story reaches its end and calls onFinish exactly once', async () => {
    // A stubbed clock: the module reads performance.now(), so jumping it past
    // the duration makes the next scheduled frame the last one.
    const realPerf = global.performance;
    let clock = 0;
    global.performance = { now: () => clock };
    try {
      let finished = 0;
      const handle = Ruins.play(fakeCanvas(), { castleSkin: 'stone-keep', name: 'Bo' }, { onFinish: () => finished++ });
      clock = Ruins.DURATION_MS + 1;
      await new Promise(r => setTimeout(r, 120));
      assert.equal(finished, 1, 'the clip must end by itself, not wait for a rAF that never comes');
      handle.destroy();
      await new Promise(r => setTimeout(r, 60));
      assert.equal(finished, 1, 'and never fire a second time');
    } finally {
      if (realPerf === undefined) delete global.performance; else global.performance = realPerf;
    }
  });
});

suite('night raid ruins: skin -> rubble frame', () => {
  test('every castle skin maps to the sheet and row CastleSkins already assigns it', () => {
    // castle-damage-a holds the first five skins, castle-damage-b the last five,
    // in CastleSkins order — the same split CastleSkins.atlasCell reports.
    CastleSkins.skins.forEach((skin, index) => {
      const frame = Art.ruinsFrame(skin.id);
      const cell = CastleSkins.atlasCell(skin.id);
      assert.equal(frame.sheet, index < 5 ? 'a' : 'b', skin.id + ' is on the wrong sheet');
      assert.equal(frame.row, index % 5, skin.id + ' is on the wrong row');
      assert.equal(frame.sheet, cell.atlas ? 'b' : 'a', skin.id + ': must reuse CastleSkins.atlasCell');
      assert.equal(frame.row, cell.cell, skin.id + ': must reuse CastleSkins.atlasCell');
      assert.truthy(frame.src.includes('castle-damage-' + frame.sheet + '-v2.webp'), skin.id + ': wrong sheet file');
    });
    assert.equal(CastleSkins.skins.length, 10, 'ten skins, two sheets of five rows');
  });

  test('an unknown, empty or nonsense skin id falls back to the starter keep', () => {
    const fallback = Art.ruinsFrame('stone-keep');
    for (const bad of [undefined, null, '', 'not-a-castle', 0, 42, {}, [], 'STONE-KEEP']) {
      const frame = Art.ruinsFrame(bad);
      assert.equal(frame.sheet, fallback.sheet, JSON.stringify(bad) + ' must fall back safely');
      assert.equal(frame.row, fallback.row, JSON.stringify(bad) + ' must fall back safely');
      assert.equal(frame.sx, fallback.sx);
    }
  });

  test('the rubble frames are measured boxes, not the naive 3x5 grid', () => {
    for (const sheet of ['a', 'b']) {
      const size = SHEETS[sheet], frames = Art.RUINS_FRAMES[sheet];
      assert.equal(frames.length, 5, 'five castle rows per sheet');
      let crossesRowLine = 0;
      frames.forEach((f, row) => {
        const [sx, sy, sw, sh] = f;
        assert.truthy(sw > 0 && sh > 0, sheet + row + ': empty frame');
        assert.truthy(sx >= 0 && sx + sw <= size.w, sheet + row + ': runs off the sheet horizontally');
        assert.truthy(sy >= 0 && sy + sh <= size.h, sheet + row + ': runs off the sheet vertically');
        // Column 3 of 3 is the rubble; the pile may start just left of the
        // mathematical column line, but its middle is firmly in that column.
        assert.truthy(sx + sw / 2 > size.w * 2 / 3, sheet + row + ': not the ruins column');
        // A pile is a wide low heap. A tall frame means someone grabbed the
        // intact castle above it by mistake.
        assert.inRange(sw / sh, 2.3, 3.8, sheet + row + ': aspect is not a rubble heap');
        if (sy + sh > (row + 1) * size.h / 5 + 1) crossesRowLine++;
      });
      assert.truthy(crossesRowLine >= 3,
        'sheet ' + sheet + ': the piles overflow their grid rows — this is exactly why the frames are measured');
    }
    // Frames never overlap vertically, so no pile can leak into its neighbour.
    for (const sheet of ['a', 'b']) {
      const frames = Art.RUINS_FRAMES[sheet];
      for (let i = 1; i < frames.length; i++)
        assert.truthy(frames[i][1] > frames[i - 1][1] + frames[i - 1][3],
          'sheet ' + sheet + ' row ' + i + ' starts before row ' + (i - 1) + ' ends');
    }
  });

  test('the frames and the whole art module stay frozen', () => {
    assert.truthy(Object.isFrozen(Art), 'NightRaidArt must stay frozen');
    assert.truthy(Object.isFrozen(Art.RUINS_FRAMES));
    assert.truthy(Object.isFrozen(Art.RUINS_FRAMES.a));
    assert.truthy(Object.isFrozen(Art.RUINS_FRAMES.a[0]));
    assert.truthy(Object.isFrozen(Art.RUINS_SHEETS));
    // The brushes the battle already depends on must survive this addition.
    for (const fn of ['drawScene', 'drawCastle', 'drawDefense', 'drawRaider', 'drawProjectile', 'drawClashSpark', 'roundRect', 'preloadDefenses'])
      assert.equal(typeof Art[fn], 'function', 'NightRaidArt lost ' + fn);
    for (const fn of ['ruinsFrame', 'preloadRuins', 'drawRuins'])
      assert.equal(typeof Art[fn], 'function', 'NightRaidArt is missing ' + fn);
  });

  test('drawRuins declines quietly until the sheet has decoded, and never throws', () => {
    // No Image in this sandbox, so nothing can be loaded: the painter must
    // return null and let the caller draw its stand-in silhouette.
    assert.equal(Art.drawRuins(ctx2d(), 100, 200, 'stone-keep', 300), null);
    assert.equal(Art.drawRuins(null, 100, 200, 'stone-keep', 300), null);
    assert.equal(Art.preloadRuins('stone-keep'), null);
    let rang = 0;
    Art.preloadRuins('coral-palace', () => rang++);   // must not throw without Image
    assert.equal(rang, 0);
  });
});

suite('night raid ruins: the choreography is a pure function of time', () => {
  const L = Ruins.layout(900, 520);

  test('the same millisecond always produces the same frame', () => {
    for (const t of [0, 700, 1500, 2400, 3300, 3450, 3600, 4500, Ruins.DURATION_MS]) {
      assert.deepEqual(Ruins.squadAt(L, t), Ruins.squadAt(L, t), 'squadAt must be deterministic at t=' + t);
    }
  });

  test('troops march in from the right, stop, turn, and walk back out the way they came', () => {
    const start = Ruins.squadAt(L, 0);
    assert.truthy(start.x >= L.w, 'the squad starts off the right edge');
    assert.equal(start.facing, -1, 'and walks left, towards the house');
    assert.truthy(start.moving, 'feet moving on the way in');

    // Marching in: always closer to the house than the millisecond before.
    let previous = start.x;
    for (let t = 60; t <= Ruins.MARCH_END; t += 60) {
      const now = Ruins.squadAt(L, t);
      assert.truthy(now.x <= previous + 0.001, 'the march must not go backwards at t=' + t);
      previous = now.x;
    }
    assert.inRange(previous, L.stopX - 1, L.stopX + 1, 'the march ends at the halt line');

    // The reveal and the beat: standing still, still facing the wreck.
    for (const t of [Ruins.MARCH_END + 200, Ruins.REVEAL_END, Ruins.REVEAL_END + 400, Ruins.BEAT_END - 1]) {
      const s = Ruins.squadAt(L, t);
      assert.falsy(s.moving, 'nobody walks during the reveal/beat at t=' + t);
      assert.equal(s.facing, -1, 'still looking at the ruins at t=' + t);
      assert.inRange(s.x, L.stopX - L.soldierH * 0.2, L.stopX + L.soldierH * 0.2, 'holds its ground at t=' + t);
    }

    // The turn: facing sweeps from -1 through 0 to +1, and nothing walks.
    const mid = Ruins.squadAt(L, (Ruins.BEAT_END + Ruins.TURN_END) / 2);
    assert.truthy(mid.turning, 'the middle of the turn must be flagged as turning');
    assert.falsy(mid.moving, 'the squad turns on the spot, it does not walk round');
    assert.inRange(mid.facing, -0.2, 0.2, 'edge-on halfway through the turn');
    assert.truthy(Ruins.squadAt(L, Ruins.BEAT_END + 20).facing < 0, 'still mostly facing the house early in the turn');
    assert.truthy(Ruins.squadAt(L, Ruins.TURN_END - 20).facing > 0, 'mostly facing home late in the turn');

    // Walking home: monotonically away, and gone before the clip ends.
    previous = Ruins.squadAt(L, Ruins.TURN_END).x;
    for (let t = Ruins.TURN_END + 60; t <= Ruins.RETREAT_END; t += 60) {
      const now = Ruins.squadAt(L, t);
      assert.truthy(now.x >= previous - 0.001, 'the retreat must not go backwards at t=' + t);
      assert.equal(now.facing, 1, 'facing home at t=' + t);
      assert.truthy(now.moving, 'feet moving on the way out at t=' + t);
      previous = now.x;
    }
    const end = Ruins.squadAt(L, Ruins.DURATION_MS);
    assert.truthy(end.x > L.w + L.soldierH, 'the squad is off the canvas before the last frame');
  });

  test('the retreat actually covers ground early instead of stalling', () => {
    // A plain quadratic left them standing still for a third of the walk home.
    const quarter = (Ruins.squadAt(L, Ruins.TURN_END + (Ruins.RETREAT_END - Ruins.TURN_END) * 0.25).x - L.stopX) / (L.exitX - L.stopX);
    const half = (Ruins.squadAt(L, Ruins.TURN_END + (Ruins.RETREAT_END - Ruins.TURN_END) * 0.5).x - L.stopX) / (L.exitX - L.stopX);
    assert.inRange(quarter, 0.1, 0.35, 'a quarter of the way through the retreat they should have moved');
    assert.inRange(half, 0.3, 0.6, 'and be roughly half way out at half time');
  });
});

suite('night raid ruins: the layout reads on any box the screen gives it', () => {
  // Portrait strips, wide banners, the default 300x150 canvas, a 320px phone.
  const BOXES = [[786, 440], [640, 400], [786, 520], [900, 520], [1200, 300], [640, 900], [300, 150], [320, 600]];

  test('the rubble sits fully inside the frame with room on its left for the tracks', () => {
    for (const [w, h] of BOXES) {
      const L = Ruins.layout(w, h);
      const left = L.ruinX - L.ruinW / 2, right = L.ruinX + L.ruinW / 2;
      assert.truthy(left > 0, w + 'x' + h + ': the pile hangs off the left edge');
      assert.truthy(right < w, w + 'x' + h + ': the pile hangs off the right edge');
      assert.truthy(left > w * 0.05, w + 'x' + h + ': no room left of the pile for the thief\'s tracks');
      assert.inRange(L.groundY, h * 0.6, h * 0.95, w + 'x' + h + ': the ground line left the frame');
      assert.truthy(L.groundY + L.soldierH * 0.25 < h, w + 'x' + h + ': feet below the bottom edge');
    }
  });

  test('the squad halts clear of the rubble instead of standing in it', () => {
    for (const [w, h] of BOXES) {
      const L = Ruins.layout(w, h);
      const petLeftEdge = L.stopX - L.petH / 2, ruinRight = L.ruinX + L.ruinW / 2;
      assert.truthy(petLeftEdge > ruinRight, w + 'x' + h + ': the pet stops inside the wreck');
      assert.truthy(L.stopX < w, w + 'x' + h + ': the squad halts off screen');
      assert.truthy(L.enterX > w, w + 'x' + h + ': the squad must start off the right edge');
      assert.truthy(L.exitX > L.enterX - 1, w + 'x' + h + ': it must leave at least as far as it came from');
    }
  });

  test('troops are sized off the shorter side, so a tall narrow box does not grow giants', () => {
    const tall = Ruins.layout(320, 900), wide = Ruins.layout(1200, 300);
    assert.truthy(tall.soldierH < 320 * 0.2, 'a narrow canvas must not get 120px soldiers');
    assert.inRange(wide.soldierH, 22, 120);
    for (const [w, h] of BOXES) {
      const L = Ruins.layout(w, h);
      assert.inRange(L.soldierH, 22, 120, w + 'x' + h + ': soldier height out of bounds');
      assert.truthy(L.petH > L.soldierH, 'the dog leads and reads a head taller');
    }
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
