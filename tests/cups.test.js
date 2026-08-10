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

    test('a practice battle never reaches the award', () => {
        const fin = pbSrc.slice(pbSrc.indexOf('function finishPetBattle'));
        const guard = fin.slice(0, fin.indexOf('awardCup'));
        assert.truthy(guard.includes('result.practice') && guard.includes('return finishBotBattle'),
            'practice must short-circuit before any reward');
    });

    test('the practice result path awards nothing at all', () => {
        const fn = pbSrc.slice(pbSrc.indexOf('function finishBotBattle'), pbSrc.indexOf('// Battle over'));
        for (const banned of ['awardCup', 'appState.coins', 'petBattleHistory']) {
            assert.falsy(fn.includes(banned), `practice must not touch ${banned}`);
        }
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

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
