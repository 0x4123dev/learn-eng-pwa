// home-yard-layout.test.js — Home owns the close-up pet HUD; the farm tab owns the yard.
//
// Once the castle garden moved out of Home, the compact pet bar could return to
// its original place at the top of the pet hero. Safe-area padding keeps it
// reachable on notched phones while the large dog stays fully visible below.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const css = read('css/styles.css');
const ui = read('js/night-raid.js');

const vm = require('vm');
const { createDocument } = require('./domshim');

// Mount the garden the way the homepage does, in a sandbox, so tests can see
// what the app actually writes into appState rather than what a pure rules
// function would return.
function mountFreshGarden(seed) {
    const doc = createDocument('<div id="yard"></div>');
    // The shim has no canvas; a permissive stub keeps any decorative painting
    // from taking the whole mount down before the walk ever started — which is
    // exactly the sort of thing that makes a test quietly measure nothing.
    const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
    const createElement = doc.createElement.bind(doc);
    doc.createElement = tag => {
        const el = createElement(tag);
        if (String(tag).toLowerCase() === 'canvas') {
            el.getContext = () => noop;
            el.toDataURL = () => 'data:,';
            el.width = el.height = 0;
        }
        return el;
    };
    const ctx = {
        console, Math, JSON, String, Number, Array, Object, Boolean, Promise, RegExp, Set, Map, Date, isNaN,
        document: doc, window: { addEventListener() {}, removeEventListener() {} },
        navigator: { vibrate() {} }, addEventListener() {}, removeEventListener() {},
        appState: Object.assign({ coins: 0, dogLevel: 1 }, seed || {}),
        currentUser: 'zzzzz', saveUserData() {}, showToast() {},
        // The walk runs on an interval. Capturing it lets a test drive the real
        // loop tick by tick instead of waiting on a clock — and a browser tab
        // that is not in front never ticks at all, so this is the only place
        // the walk can actually be observed.
        setInterval: (fn) => { ctx.__tick = fn; return 1; }, clearInterval() {},
        setTimeout: () => 0, clearTimeout() {},
        requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false }),
        performance: { now: () => ctx.__clock },
        module: { exports: {} },
    };
    ctx.__clock = 0;
    ctx.__mood = (seed && seed.__mood) || 'happy';
    ctx.getPetMood = () => ctx.__mood;
    ctx.run = (times, step) => {
        for (let i = 0; i < times; i++) { ctx.__clock += (step || 120); if (ctx.__tick) ctx.__tick(); }
    };
    ctx.dogAt = () => { const d = doc.querySelector('.nr-yard-pet'); return d && (d.dataset.x + ',' + d.dataset.y); };
    ctx.dogMode = () => { const d = doc.querySelector('.nr-yard-pet'); return d && d.dataset.mode; };
    ctx.bubble = () => { const b = doc.querySelector('[data-nr-pet-say]'); return b && !b.hidden ? b.textContent : null; };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read('js/night-raid-rules.js'), ctx);
    vm.runInContext('var NightRaidRules = module.exports; module.exports = {};', ctx);
    vm.runInContext(read('js/night-raid.js'), ctx);
    ctx.NightRaid.mountYardScene(doc.getElementById('yard'), { skipRefresh: true });
    // Swallowing a mount failure here once made the hungry-dog tests pass for
    // the wrong reason: the walk had crashed before it started, so of course the
    // dog never moved. A sandbox that did not finish mounting is a broken test,
    // not a passing one.
    if (!ctx.__tick) throw new Error('the garden mounted without starting its walk');
    return ctx;
}

const num = (src, name) => Number((src.match(new RegExp(name + '=([\\d.]+)')) || [])[1]);

suite('home: the pet bar is back inside the close-up dog habitat', () => {
    test('the bar is inside the pet hero again', () => {
        const zone = html.slice(html.indexOf('id="petHeroZone"'), html.indexOf('id="evolutionOverlay"'));
        assert.truthy(zone.includes('petHeroTopbar'), 'the pet bar must be restored to the dog habitat');
        assert.truthy(zone.indexOf('petHeroTopbar') < zone.indexOf('petHeroStage'),
            'the information bar must appear above the close-up dog');
    });

    test('it no longer consumes a separate card below the food wish', () => {
        const at = id => html.indexOf('id="' + id + '"');
        assert.truthy(at('petHeroTopbar') < at('petQuestCard'), 'the bar must be part of the hero, before the food-wish card');
    });

    test('it uses the original over-art HUD treatment', () => {
        const rule = (css.match(/\.pet-hero-topbar \{[^}]*\}/) || [''])[0];
        assert.truthy(rule, 'the bar has no rule');
        assert.truthy(/position:\s*sticky/.test(rule), 'the restored HUD must stay at the top of the hero');
        assert.truthy(/linear-gradient\(to bottom, rgba\(0,0,0/.test(rule),
            'the restored HUD needs its contrast scrim over artwork');
        const appRule = (css.match(/\.app\s*\{[^}]*\}/) || [''])[0];
        assert.truthy(appRule.includes('padding-top: var(--safe-area-top)'), 'the app shell clears the notch once for every screen');
        assert.falsy(rule.includes('safe-area-inset-top'), 'the hero must not count the notch twice and drift down over the dog');
    });
});

suite('home: the garden is scenery; the farm tab is where it is built', () => {
    // Released on 2026-08-25: every account sees the garden, the castle and the
    // dog walking about. Since September 2026 the Arena that hosted the yard is
    // gone: the same scene is mountable anywhere (mountYardScene), and the farm
    // tab (Nông trại) is the one place it can be edited.
    const home = read('js/home.js');

    test('Home keeps the evolving dog close-up and the farm tab owns the garden', () => {
        assert.falsy(home.includes('NightRaid.mountYardScene'), 'Home must not mount the castle garden');
        assert.truthy(home.includes("stage_el.classList.remove('yard-mode')"), 'Home must leave full-yard layout mode');
        assert.truthy(home.includes('<div class="pet-wrapper">') && home.includes('${petArtHTML}'),
            'Home must render the live dog art so level accessories remain visible');
        assert.truthy(/data-nav-key="farm"[^>]*onclick="openNightRaid\(\)"|onclick="openNightRaid\(\)"[^>]*data-nav-key="farm"/.test(html),
            'the Nông trại nav button opens the farm');
        assert.falsy(fs.existsSync(path.join(ROOT, 'js/petbattle.js')), 'the Arena is gone');
    });

    test('the garden carries no way out of itself', () => {
        // It is scenery. The only thing a finger can do to it is play with the
        // dog; navigation belongs to whoever mounted it.
        const scene = ui.slice(ui.indexOf('function mountYardScene(host,opts)'),
                               ui.indexOf('function unmountYardScene'));
        assert.truthy(scene.length > 200, 'mountYardScene could not be sliced out');
        assert.deepEqual(scene.match(/onclick="[^"]*"/g) || [], [],
            'the garden must not carry a link anywhere');
        for (const way of ['renderBuilder', 'switchScreen', 'nrShowBuilder', 'openNightRaid']) {
            assert.falsy(scene.includes(way), `the garden calls ${way}`);
        }
    });

    test('a brand-new account gets a bare lawn, not somebody else\'s fort', () => {
        // This ran against normalizeLayout(undefined) and passed happily while
        // the app was handing every new account the level-4 training home — a
        // BOT's base: eleven walls, traps and pebble pups nobody bought. The
        // seeding happens in ensure(), so the test has to go through the door
        // the app goes through.
        const state = mountFreshGarden();
        const owned = state.appState.nightRaidLayout.cells;
        assert.deepEqual(owned.map(c => c.type), [],
            'a new account must own nothing — these were never bought');
        assert.truthy(state.appState.nightRaidLayout.castleCell,
            'but it must still have a castle to stand on the lawn');
        const ensureSrc = ui.slice(ui.indexOf('function ensure()'), ui.indexOf('function ensure()') + 900);
        assert.falsy(/trainingTarget|DEFENSES\.map|cells:\[\{/.test(ensureSrc),
            'ensure() must not seed a bot base as the player\'s own home');
    });

    test('a fort already seeded onto an account is cleared, a real base is not', () => {
        // The seed was trainingTarget(4). That function left with the battle
        // rules, so this is its layout, rebuilt cell for cell: three pebble
        // pups, four spike traps, two stone walls, two wooden fences, all tier 1.
        const R = require(path.join(ROOT, 'js', 'night-raid-rules.js'));
        const cells = [];
        const add = (type, n) => { for (let i = 0; i < n; i++) cells.push({ type, gx: (cells.length % 6) * 2, gy: 6 + Math.floor(cells.length / 6) * 2, tier: 1 }); };
        add('pebble-pup', 3); add('spike-trap', 4); add('stone-wall', 2); add('wood-fence', 2);
        const seeded = R.normalizeLayout({ cells });
        assert.equal(seeded.cells.length, 11, 'the seed we are matching against still has its eleven buildings');

        // Accounts made between the garden shipping and the fix carry that fort.
        const cleaned = mountFreshGarden({ nightRaidLayout: { cells: seeded.cells } });
        assert.deepEqual(cleaned.appState.nightRaidLayout.cells.map(c => c.type), [],
            'the seeded fort should have been cleared');

        // Anything a child actually built must survive: a farm cannot be seeded,
        // and neither can an upgraded tier.
        const real = mountFreshGarden({ nightRaidLayout: { cells: seeded.cells.concat([{ type: 'rice-field', gx: 6, gy: 6, tier: 1 }]) } });
        assert.truthy(real.appState.nightRaidLayout.cells.some(c => c.type === 'rice-field'),
            'a bought farm was thrown away');
        assert.truthy(real.appState.nightRaidLayout.cells.length > 1, 'the rest of a real base went with it');

        const upgraded = mountFreshGarden({ nightRaidLayout: { cells: seeded.cells.map((c, i) => i ? c : Object.assign({}, c, { tier: 2 })) } });
        assert.truthy(upgraded.appState.nightRaidLayout.cells.length > 0,
            'an upgraded building means the base was played with, not seeded');
    });
});

suite('home: a hungry dog lies down and says so', () => {
    test('it does not take a single step while it is hungry', () => {
        const g = mountFreshGarden({ __mood: 'starving' });
        const start = g.dogAt();
        g.run(200);                              // twenty-odd seconds of walking
        assert.equal(g.dogAt(), start, 'the dog wandered off while it was starving');
        assert.equal(g.dogMode(), 'rest', 'it should be lying down');
    });

    test('the bubble is on it, and stays on it', () => {
        const g = mountFreshGarden({ __mood: 'hungry' });
        assert.truthy(/hungry/i.test(g.bubble() || ''), `bubble says ${JSON.stringify(g.bubble())}`);
        g.run(200);
        assert.truthy(/hungry/i.test(g.bubble() || ''),
            'the old bubble flashed for 2.5s and vanished — this one waits to be fed');
    });

    test('it walks again once it is fed, and the bubble goes', () => {
        const g = mountFreshGarden({ __mood: 'starving' });
        g.run(20);
        const parked = g.dogAt();
        g.__mood = 'happy';
        g.run(60);
        assert.truthy(g.dogAt() !== parked, 'a fed dog must get up and move');
        assert.equal(g.bubble(), null, 'and stop complaining');
    });

    test('a fed dog was never held still in the first place', () => {
        // Guards the obvious way to break this: freezing every dog.
        const g = mountFreshGarden();
        const start = g.dogAt();
        g.run(60);
        assert.truthy(g.dogAt() !== start, 'a happy dog stopped walking');
        assert.equal(g.bubble(), null);
    });

    test('hunger cancels an errand rather than leaving it half-done', () => {
        assert.truthy(ui.includes('state.errand=null'), 'a hungry dog must drop what it was going to do');
        assert.truthy(ui.includes('function petIsHungry()'), 'the walk must know what hungry means');
    });
});

suite('home: the dog keeps to the middle of the garden', () => {
    // Measured on the real page, as a share of the garden map: the status bar
    // of a notched phone reaches 19.7% down it, and the name, XP bar and Shop
    // buttons start at 71.2%.
    const STATUS_BAR = 19.7, BOTTOM_FURNITURE = 71.2;

    const YARD = (() => {
        const m = ui.match(/const PET_YARD=\{left:([\d.]+),top:([\d.]+),width:([\d.]+),height:([\d.]+)\}/);
        return m && { left: +m[1], top: +m[2], width: +m[3], height: +m[4] };
    })();

    const bounds = (() => {
        const top = num(ui, 'YARD_TOP_FURNITURE'), bottom = num(ui, 'YARD_BOTTOM_FURNITURE');
        const h = num(ui, 'PET_SPRITE_H') + num(ui, 'PET_SAY_H');   // dog plus the bubble over its head
        if (!YARD) return null;
        return {
            minX: YARD.left + YARD.width * .12,
            maxX: YARD.left + YARD.width - YARD.width * .12,
            minY: Math.max(YARD.top + 3, top + h),
            maxY: Math.min(YARD.top + YARD.height - 2, bottom - 2),
            spriteH: h,
        };
    })();

    test('the garden rectangle and the patrol band are both readable from source', () => {
        assert.truthy(YARD, 'PET_YARD could not be parsed — this suite is measuring nothing');
        assert.truthy(bounds && Number.isFinite(bounds.minY) && Number.isFinite(bounds.maxY),
            'the patrol band could not be parsed');
    });

    test('the dog never walks up behind the status bar, bubble and all', () => {
        // The dog is anchored at its paws; its head is a sprite-height above,
        // and when it is hungry a speech bubble sits above that. Measuring only
        // to the head left the bubble floating at 18.5%, inside the strip.
        const top = bounds.minY - bounds.spriteH;
        assert.truthy(top >= STATUS_BAR,
            `the top of it reaches ${top.toFixed(1)}% while the status bar covers down to ${STATUS_BAR}%`);
    });

    test('the dog never walks down behind the name, the XP bar or the Shop button', () => {
        assert.truthy(bounds.maxY <= BOTTOM_FURNITURE,
            `its paws reach ${bounds.maxY}% while the furniture starts at ${BOTTOM_FURNITURE}%`);
    });

    test('the band is still big enough to be worth walking', () => {
        const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
        assert.truthy(w > 40 && h > 25, `a ${w.toFixed(0)}% x ${h.toFixed(0)}% pen is too cramped to look alive`);
        // and it must sit in the middle, not hug one side
        const mid = YARD.top + YARD.height / 2, bandMid = (bounds.minY + bounds.maxY) / 2;
        assert.truthy(Math.abs(bandMid - mid) < YARD.height * .2,
            `the band is centred at ${bandMid.toFixed(1)}% against a garden centred at ${mid}%`);
    });

    test('an errand may still take the dog outside the band', () => {
        // Rice fields and ponds can be anywhere on the grid; a dog that could
        // not reach them would stand at the fence and time out.
        assert.truthy(ui.includes('const activeBounds=state.errand?'),
            'the walk must widen its bounds toward whatever it was sent to do');
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
