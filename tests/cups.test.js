// cups.test.js — 🏆 the trophy cabinet: earning, merging, and the invariant
// that merging never costs a child anything it earned.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const cupsSrc = fs.readFileSync(path.join(root, 'js', 'cups.js'), 'utf8');
const pbSrc = fs.readFileSync(path.join(root, 'js', 'petbattle.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

// Fresh sandbox per test — appState is global in the app.
function load(initial) {
    const ctx = { appState: initial || {}, module: { exports: {} }, document: { getElementById: () => null } };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(cupsSrc, ctx);
    return { api: ctx.module.exports, ctx };
}

suite('cups: earning', () => {
    test('a new profile starts with an empty cabinet', () => {
        const { api } = load();
        const c = api.cupState();
        assert.equal(c.basic, 0); assert.equal(c.ruby, 0);
        assert.equal(c.diamond, 0); assert.equal(c.won, 0);
    });

    test('winning awards exactly one cup', () => {
        const { api } = load();
        api.awardCup();
        const c = api.cupState();
        assert.equal(c.basic, 1);
        assert.equal(c.won, 1, 'lifetime wins is tracked separately from the shelf');
    });

    test('a corrupt or missing cups object is repaired, not crashed on', () => {
        for (const bad of [null, undefined, 'nonsense', 42, { basic: -5, ruby: 'x', diamond: null }]) {
            const { api } = load({ cups: bad });
            const c = api.cupState();
            for (const k of ['basic', 'ruby', 'diamond', 'won']) {
                assert.truthy(Number.isFinite(c[k]) && c[k] >= 0, `${k} became ${c[k]} from ${JSON.stringify(bad)}`);
            }
        }
    });
});

suite('cups: merging 5 → ruby → diamond', () => {
    test('four cups cannot merge; five can', () => {
        const { api } = load({ cups: { basic: 4, ruby: 0, diamond: 0, won: 4 } });
        assert.falsy(api.canMergeCups('basic'));
        api.awardCup();
        assert.truthy(api.canMergeCups('basic'));
    });

    test('merging five cups yields one ruby', () => {
        const { api } = load({ cups: { basic: 5, ruby: 0, diamond: 0, won: 5 } });
        api.mergeCups('basic');
        const c = api.cupState();
        assert.equal(c.basic, 0);
        assert.equal(c.ruby, 1);
    });

    test('merging five rubies yields one diamond', () => {
        const { api } = load({ cups: { basic: 0, ruby: 5, diamond: 0, won: 25 } });
        api.mergeCups('ruby');
        const c = api.cupState();
        assert.equal(c.ruby, 0);
        assert.equal(c.diamond, 1);
    });

    test('a merge consumes exactly five, leaving the remainder alone', () => {
        const { api } = load({ cups: { basic: 7, ruby: 0, diamond: 0, won: 7 } });
        api.mergeCups('basic');
        const c = api.cupState();
        assert.equal(c.basic, 2, 'the two spare cups must survive');
        assert.equal(c.ruby, 1);
    });

    test('diamond is the top — it never merges further', () => {
        const { api } = load({ cups: { basic: 0, ruby: 0, diamond: 9, won: 225 } });
        assert.falsy(api.canMergeCups('diamond'));
        assert.equal(api.mergeCups('diamond'), null);
        assert.equal(api.cupState().diamond, 9, 'a refused merge must not consume anything');
    });

    test('merging without enough cups changes nothing', () => {
        const { api } = load({ cups: { basic: 3, ruby: 2, diamond: 0, won: 13 } });
        assert.equal(api.mergeCups('basic'), null);
        assert.equal(api.mergeCups('ruby'), null);
        const c = api.cupState();
        assert.equal(c.basic, 3); assert.equal(c.ruby, 2); assert.equal(c.diamond, 0);
    });

    // The invariant that matters: a child must never feel merging cost them.
    test('total value is unchanged by any merge', () => {
        const { api } = load({ cups: { basic: 27, ruby: 0, diamond: 0, won: 27 } });
        const start = api.cupTotalValue();
        assert.equal(start, 27);
        api.mergeCups('basic'); assert.equal(api.cupTotalValue(), start);
        api.mergeCups('basic'); assert.equal(api.cupTotalValue(), start);
        api.mergeCups('basic'); assert.equal(api.cupTotalValue(), start);
        api.mergeCups('basic'); assert.equal(api.cupTotalValue(), start);
        api.mergeCups('basic'); assert.equal(api.cupTotalValue(), start);
        assert.equal(api.cupState().ruby, 5, 'five merges make five rubies');
        api.mergeCups('ruby');
        assert.equal(api.cupTotalValue(), start, 'a diamond is worth exactly 25 cups');
        assert.equal(api.cupState().diamond, 1);
    });

    test('25 wins can become one diamond, and lifetime wins still reads 25', () => {
        const { api } = load();
        for (let i = 0; i < 25; i++) api.awardCup();
        for (let i = 0; i < 5; i++) api.mergeCups('basic');
        api.mergeCups('ruby');
        const c = api.cupState();
        assert.equal(c.diamond, 1);
        assert.equal(c.basic, 0);
        assert.equal(c.ruby, 0);
        assert.equal(c.won, 25, 'merging must never rewrite history');
        assert.equal(api.cupTotalValue(), 25);
    });
});

suite('cups: what the shelf tells the child', () => {
    test('an empty shelf asks for five, not zero', () => {
        const { api } = load();
        assert.equal(api.cupProgress('basic').need, 5);
        assert.falsy(api.cupProgress('basic').ready);
    });

    test('progress counts down toward the next merge', () => {
        const { api } = load({ cups: { basic: 3, ruby: 0, diamond: 0, won: 3 } });
        assert.equal(api.cupProgress('basic').need, 2);
    });

    test('at five it says ready instead of "0 more"', () => {
        const { api } = load({ cups: { basic: 5, ruby: 0, diamond: 0, won: 5 } });
        const p = api.cupProgress('basic');
        assert.truthy(p.ready);
        assert.equal(p.need, 0);
    });

    test('diamond is flagged as the top of the ladder', () => {
        const { api } = load({ cups: { basic: 0, ruby: 0, diamond: 2, won: 50 } });
        assert.truthy(api.cupProgress('diamond').top);
    });
});

suite('cups: only real wins count', () => {
    test('a friend win awards a cup', () => {
        const fin = pbSrc.slice(pbSrc.indexOf('function finishPetBattle'));
        assert.truthy(fin.includes('awardCup(1)'), 'a real win must award a cup');
        assert.truthy(/if \(won && typeof awardCup/.test(fin), 'and only when the battle was won');
    });

});

// The cabinet is local, the battles are not. A reinstall used to wipe 25
// victories' worth of trophies while the server still knew about every one.
suite('cups: rebuilt from the server battle record', () => {
    test('a fresh install recovers every win as a cup', () => {
        const { api } = load();                       // empty cabinet
        api.applyServerWins(25);
        const c = api.cupState();
        assert.equal(c.basic, 25, 'all 25 wins come back as cups');
        assert.equal(c.won, 25, 'and lifetime wins is restored');
        assert.equal(api.cupTotalValue(), 25);
    });

    test('only the wins the device has not seen are added', () => {
        const { api } = load({ cups: { basic: 3, ruby: 0, diamond: 0, won: 3 } });
        api.applyServerWins(7);
        const c = api.cupState();
        assert.equal(c.basic, 7, '4 unseen wins added to the 3 already there');
        assert.equal(c.won, 7);
    });

    // Merging is a choice the child made; a rebuild must not undo it.
    test('merged tiers survive a reconcile untouched', () => {
        const { api } = load({ cups: { basic: 1, ruby: 2, diamond: 1, won: 36 } });
        api.applyServerWins(40);
        const c = api.cupState();
        assert.equal(c.ruby, 2, 'ruby cups must not be melted back down');
        assert.equal(c.diamond, 1, 'nor the diamond');
        assert.equal(c.basic, 5, 'the 4 unseen wins land on the basic shelf');
        assert.equal(api.cupTotalValue(), 40);
    });

    // The rule that matters: reconciling may only ever ADD.
    test('a server that is behind never takes a trophy away', () => {
        const { api } = load({ cups: { basic: 2, ruby: 1, diamond: 0, won: 7 } });
        const before = api.cupTotalValue();
        api.applyServerWins(3);                       // stale or another device
        const c = api.cupState();
        assert.equal(c.won, 7, 'lifetime wins must not go backwards');
        assert.equal(api.cupTotalValue(), before, 'total value must never drop');
        assert.equal(c.ruby, 1);
    });

    test('junk or missing counts change nothing', () => {
        for (const bad of [null, undefined, NaN, -5, 'twelve', {}]) {
            const { api } = load({ cups: { basic: 4, ruby: 0, diamond: 0, won: 4 } });
            api.applyServerWins(bad);
            assert.equal(api.cupState().basic, 4, `applyServerWins(${JSON.stringify(bad)}) altered the shelf`);
            assert.equal(api.cupState().won, 4);
        }
    });

    test('reconciling twice does not double-count', () => {
        const { api } = load();
        api.applyServerWins(9);
        api.applyServerWins(9);
        api.applyServerWins(9);
        assert.equal(api.cupState().basic, 9);
        assert.equal(api.cupState().won, 9);
    });

    test('a win earned locally before the server catches up is kept', () => {
        const { api } = load({ cups: { basic: 5, ruby: 0, diamond: 0, won: 5 } });
        api.awardCup();                               // just won, server not updated yet
        api.applyServerWins(5);                       // server still reports the old count
        assert.equal(api.cupState().won, 6, 'the fresh win must survive');
        assert.equal(api.cupState().basic, 6);
    });
});

suite('cups: the sync is safe by construction', () => {
    const src = fs.readFileSync(path.join(root, 'js', 'cups.js'), 'utf8');
    const server = fs.readFileSync(path.join(root, 'functions', 'api', 'me', 'wins.js'), 'utf8');

    test('a failed or offline request leaves the cabinet alone', () => {
        const fn = src.slice(src.indexOf('async function reconcileCupsFromServer'));
        assert.truthy(fn.includes('if (!token) return null'), 'no token must mean no change');
        assert.truthy(fn.includes('catch (e) { return null; }'), 'a thrown request must not clear cups');
        assert.truthy(fn.includes('!r.ok'), 'a failed response must not be treated as zero wins');
    });

    test('the endpoint counts only finished battles this user won', () => {
        assert.truthy(server.includes('winner_id = ?'), 'must count only this user');
        assert.truthy(server.includes("status = 'done'"), 'an abandoned battle is not a win');
        assert.truthy(server.includes("requireAuth"), 'wins must not be readable for anyone else');
    });

    test('the cabinet asks the server at most once per session', () => {
        assert.truthy(src.includes('_cupsReconciled'), 'no guard against a request per render');
        const render = src.slice(src.indexOf('function renderCupCabinet'));
        assert.truthy(render.indexOf('_cupsReconciled = true') < render.indexOf('reconcileCupsFromServer'),
            'the flag must be set BEFORE the call, or a slow response re-enters');
    });

    test('login triggers a reconcile so the cabinet is ready when opened', () => {
        const auth = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
        assert.truthy(auth.includes('reconcileCupsFromServer'), 'login must rebuild the cabinet');
    });
});

suite('cups: wired into the app', () => {
    test('the cabinet has a home in the profile', () => {
        assert.truthy(indexSrc.includes('id="cupCabinet"'), 'no container in the profile');
        const profileSrc = fs.readFileSync(path.join(root, 'js', 'profile.js'), 'utf8');
        assert.truthy(profileSrc.includes('renderCupCabinet'), 'the profile never renders it');
    });

    test('cups.js is loaded and cached', () => {
        assert.truthy(indexSrc.includes('js/cups.js'), 'not loaded by index.html');
        assert.truthy(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('/js/cups.js'),
            'not in the service worker cache list — it would 404 offline');
    });

    test('each tier is styled distinctly', () => {
        for (const cls of ['.cup-basic', '.cup-ruby', '.cup-diamond', '.cup-merge-btn']) {
            assert.truthy(cssSrc.includes(cls), `${cls} has no styles`);
        }
    });
});

// A cup counted away in a cabinet motivates nobody. The moment just after a
// battle is when "two more and this becomes a Ruby Cup" actually lands, so
// every result card — win and loss alike — carries the ladder.
suite('cups: the reward ladder on the result card', () => {
    const pb = fs.readFileSync(path.join(root, 'js', 'petbattle.js'), 'utf8');
    const styles = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
    // Just the ladder builder: from its own `function` line to the next one.
    // The end marker used to be the "practice vs bot" section comment, deleted
    // with practice mode (2026-09) — indexOf then returned -1, the slice
    // quietly stretched to the end of the file, and every assertion below was
    // matching anything, anywhere in js/petbattle.js.
    const ladder = pb.slice(pb.indexOf('function _pbCupLadderHTML'), pb.indexOf('function finishPetBattle('));

    test('the slice really is only the ladder builder', () => {
        assert.truthy(ladder.length > 0, 'both slice markers must still exist in js/petbattle.js');
        assert.falsy(ladder.includes('module.exports'),
            'the slice ran past the function to the end of the file — the assertions below prove nothing');
    });

    test('a win shows the cup that was just earned', () => {
        assert.truthy(ladder.includes('pb-cup-prize'), 'the prize must be visible, not implied');
        assert.truthy(ladder.includes("earned ?"), 'only a real win shows +1');
    });

    test('the next milestone is spelled out, not left to arithmetic', () => {
        assert.truthy(ladder.includes("pbT('cupNextRuby'"), 'the child should be told how many more');
        assert.truthy(ladder.includes("pbT('cupNextDiamond'"));
    });

    test('the diamond cup is always shown, even when far away', () => {
        assert.truthy(ladder.includes('pb-cup-dream'), 'the thing worth chasing must be on screen');
        assert.truthy(ladder.includes("pbT('cupDiamondGoal'"), 'and its price named');
        assert.truthy(styles.includes('.pb-cup-dream-art'), 'it needs art, not just a label');
        assert.truthy(styles.includes('cup-dream-shimmer'), 'a locked prize should still catch the eye');
    });

    test('the five-slot row shows progress toward the next ruby', () => {
        assert.truthy(ladder.includes('pb-cup-slot'), 'progress must be visual');
        assert.truthy(ladder.includes('length: merge'), 'the row length comes from the merge rule');
    });

    test('the merge rule comes from the shared constant, not a typed 5', () => {
        assert.truthy(ladder.includes('CUP_MERGE'), 'a retyped 5 would drift from mergeCups()');
        assert.truthy(ladder.includes("pbT('cupLadder', { n: merge })"));
    });

    test('the ladder appears on a WIN', () => {
        const fin = pb.slice(pb.indexOf('function finishPetBattle'));
        assert.truthy(fin.includes('_pbCupLadderHTML(!!won)'));
        assert.truthy(fin.includes("pbT('cupWonBig')"), 'a win needs a loud message');
    });

    test('the ladder also appears on a LOSS, with a reason to come back', () => {
        const fin = pb.slice(pb.indexOf('function finishPetBattle'));
        assert.truthy(fin.includes("pbT('cupLoseTease')"), 'losing should still point at the prize');
    });

    test('every ladder string exists in both languages', () => {
        // cupPracticeTease was dropped with practice-vs-bot mode (2026-09): its
        // only reader was finishBotBattle, and a string kept alive by nothing
        // but this list is dead weight that reads as a live promise.
        for (const key of ['cupWonBig', 'cupNextRuby', 'cupNextDiamond', 'cupTopReached',
            'cupDiamondName', 'cupDiamondGoal', 'cupLadder',
            'cupLoseTease', 'cupCabinetCta']) {
            assert.truthy(new RegExp(key + ":\\s*'[^']+'").test(pb), `${key} missing`);
            assert.truthy((pb.match(new RegExp(key + ':', 'g')) || []).length >= 2,
                `${key} is only defined once — one language is missing it`);
        }
    });

    test('a missing cabinet degrades to no ladder rather than throwing', () => {
        assert.truthy(ladder.includes("typeof cupState !== 'function'"), 'cups.js may not be loaded');
        assert.truthy(ladder.includes('catch (e) { return \'\'; }'), 'a broken save must not break the result card');
    });

    test('the ladder respects reduced motion', () => {
        const rm = styles.slice(styles.lastIndexOf('@media (prefers-reduced-motion: reduce)', styles.indexOf('.pb-cup-cabinet')));
        assert.truthy(styles.includes('.pb-cup-prize-icon, .pb-cup-dream-art { animation: none'),
            'the pop and shimmer must be switchable off');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}

// ---- selling ----
suite('cups: selling for coins', () => {
    test('selling a basic cup pays 500 coins and takes one cup off the shelf', () => {
        const { api, ctx } = load({ coins: 100, cups: { basic: 3, ruby: 0, diamond: 0, won: 3 } });
        const c = api.sellCup('basic');
        assert.equal(c.basic, 2);
        assert.equal(ctx.appState.coins, 600);
    });

    test('ruby and diamond sell at their honest worth: 2500 and 12500', () => {
        assert.equal(load().api.cupSellPrice('basic'), 500);
        assert.equal(load().api.cupSellPrice('ruby'), 2500);
        assert.equal(load().api.cupSellPrice('diamond'), 12500);
        const { api, ctx } = load({ coins: 0, cups: { basic: 0, ruby: 1, diamond: 1, won: 30 } });
        api.sellCup('ruby'); api.sellCup('diamond');
        assert.equal(ctx.appState.coins, 15000);
    });

    test('an empty shelf sells nothing and pays nothing', () => {
        const { api, ctx } = load({ coins: 7, cups: { basic: 0, ruby: 0, diamond: 0, won: 5 } });
        assert.equal(api.sellCup('basic'), null);
        assert.equal(ctx.appState.coins, 7);
    });

    test('selling never touches the lifetime win count, so a sync cannot resurrect the cup', () => {
        const { api, ctx } = load({ coins: 0, cups: { basic: 4, ruby: 0, diamond: 0, won: 4 } });
        api.sellCup('basic');
        assert.equal(ctx.appState.cups.won, 4, 'won is history, not inventory');
        // The server still remembers 4 wins — reconciling must ADD nothing.
        api.applyServerWins(4);
        assert.equal(ctx.appState.cups.basic, 3, 'the sold cup stayed sold');
    });

    test('the cabinet offers a sell button and a make-sure dialog', () => {
        assert.truthy(cupsSrc.includes('cup-sell-btn'));
        assert.truthy(cupsSrc.includes("promptSellCup('${tier}')"));
        assert.truthy(cupsSrc.includes('Chắc chưa?'), 'the dialog must ask before the cup is gone');
        assert.truthy(cupsSrc.includes('cup-sell-confirm') && cupsSrc.includes('cancelSellCup'));
        assert.truthy(cssSrc.includes('.cup-sell-backdrop'));
    });
});
