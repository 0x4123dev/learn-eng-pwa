// battle-history.test.js — the arena's 📜 Lịch sử đấu panel.
// Every battle was already being written to appState.petBattleHistory and then
// never displayed anywhere, and the entry held only {won, myHp, foeHp, foe,
// date} — a "history" of four numbers and a name.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pbSrc = fs.readFileSync(path.join(root, 'js', 'petbattle.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(root, 'js', 'petbattlegame.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// Load the summary helper standalone — no DOM needed.
const vm = require('vm');
const ctx = { appState: { petBattleHistory: [] }, module: { exports: {} } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
    pbSrc.slice(pbSrc.indexOf('function _pbHistory()'), pbSrc.indexOf('function pbFmtDate'))
    + '\nthis.pbHistorySummary = pbHistorySummary;', ctx);
const summary = ctx.pbHistorySummary;

const battle = (over) => Object.assign({
    won: true, myHp: 70, foeHp: 0, foe: 'Nam', date: 1000, coins: 20,
    myLevel: 40, foeLevel: 30, shotsFired: 9, hits: 3, volleys: 5,
    damageDealt: 100, damageTaken: 30, rounds: [],
}, over || {});

suite('battle history: summary', () => {
    test('an empty history reports zeroes, not NaN', () => {
        const s = summary([]);
        assert.equal(s.total, 0);
        assert.equal(s.winRate, 0);
        assert.equal(s.accuracy, 0);
        for (const k of ['damageDealt', 'damageTaken']) assert.equal(s[k], 0);
    });

    test('wins, losses and win rate add up', () => {
        const s = summary([battle(), battle({ won: false }), battle(), battle()]);
        assert.equal(s.total, 4);
        assert.equal(s.wins, 3);
        assert.equal(s.losses, 1);
        assert.equal(s.winRate, 75);
    });

    test('damage and accuracy accumulate across battles', () => {
        const s = summary([
            battle({ hits: 2, volleys: 4, damageDealt: 50, damageTaken: 10 }),
            battle({ hits: 4, volleys: 6, damageDealt: 70, damageTaken: 20 }),
        ]);
        assert.equal(s.damageDealt, 120);
        assert.equal(s.damageTaken, 30);
        assert.equal(s.accuracy, 60);          // 6 hits / 10 volleys
    });

    test('old entries missing the new fields never break the summary', () => {
        // Battles recorded before this feature have only the original five keys.
        const legacy = { won: true, myHp: 40, foeHp: 0, foe: 'Cũ', date: 1 };
        const s = summary([legacy, battle()]);
        assert.equal(s.total, 2);
        assert.equal(s.wins, 2);
        for (const k of ['damageDealt', 'damageTaken', 'accuracy', 'winRate']) {
            assert.truthy(Number.isFinite(s[k]), `${k} became ${s[k]}`);
        }
    });

    test('the best win is the one with the most health left', () => {
        const s = summary([battle({ myHp: 20 }), battle({ myHp: 95 }), battle({ won: false, myHp: 99 })]);
        assert.equal(s.bestWin.myHp, 95, 'a loss must never count as the best win');
    });
});

suite('battle history: what gets recorded', () => {
    test('the game logs each volley as it resolves', () => {
        assert.truthy(gameSrc.includes('_logTurn'), 'no per-turn log');
        const fn = gameSrc.slice(gameSrc.indexOf('PetBattleGame.prototype._logTurn'));
        for (const k of ['round', 'shots', 'angle', 'power', 'wind', 'damage', 'myHp', 'foeHp']) {
            assert.truthy(fn.includes(k + ':'), `the log needs ${k}`);
        }
    });

    test('the log is bounded so a stuck battle cannot grow it forever', () => {
        const fn = gameSrc.slice(gameSrc.indexOf('PetBattleGame.prototype._logTurn'));
        assert.truthy(/length >= \d+/.test(fn), 'unbounded log');
    });

    test('the finished battle hands the rounds to the recorder', () => {
        const fin = gameSrc.slice(gameSrc.indexOf('this.onFinish({'));
        assert.truthy(fin.includes('rounds:'), 'rounds must reach finishPetBattle');
        assert.truthy(fin.includes('foeLevel:') && fin.includes('myLevel:'), 'levels give the result context');
    });

    test('history stays capped at 100 battles', () => {
        assert.truthy(pbSrc.includes('petBattleHistory.length = 100'), 'localStorage is not infinite');
    });

    test('mine and theirs are separated when totalling damage', () => {
        const rec = pbSrc.slice(pbSrc.indexOf('const rounds = Array.isArray(result.rounds)'));
        assert.truthy(rec.includes('rounds.filter(r => r.mine)'), 'damage dealt is my volleys');
        assert.truthy(rec.includes('rounds.filter(r => !r.mine)'), 'damage taken is theirs');
    });
});

suite('battle history: the panel', () => {
    test('the arena renders the history panel', () => {
        assert.truthy(pbSrc.includes('${_pbHistoryPanel()}'), 'panel is not wired into the arena');
    });

    test('a battle with no round log says so instead of showing an empty box', () => {
        const detail = pbSrc.slice(pbSrc.indexOf('function _pbHistoryDetail'), pbSrc.indexOf('function _pbHistoryPanel'));
        assert.truthy(detail.includes("pbT('histNoDetail')"), 'legacy battles need an explanation');
        // …and it must exist in both languages (parity itself is pinned in
        // tests/battle-i18n.test.js; this keeps the check next to its use).
        for (const lang of ['en', 'vi']) {
            assert.truthy(new RegExp(`histNoDetail: '[^']+'`).test(pbSrc), `${lang} needs the string`);
        }
    });

    test('opponent names are escaped wherever they are shown', () => {
        const panel = pbSrc.slice(pbSrc.indexOf('function _pbHistoryDetail'), pbSrc.indexOf('function _pbHistoryPanel') + 2000);
        assert.falsy(/\$\{b\.foe\}/.test(panel), 'a raw name is an injection point');
        assert.truthy(panel.includes('pbEsc(b.foe'), 'names must go through pbEsc');
    });

    test('the panel and its rows are styled', () => {
        for (const cls of ['.pb-hist-card', '.pb-hist-summary', '.pb-hist-turn', '.pb-hist-detail']) {
            assert.truthy(cssSrc.includes(cls), `${cls} has no styles`);
        }
    });
});

suite('home screen: the arena button replaced the sync button', () => {
    test('the sync fab is gone from the home screen', () => {
        assert.falsy(indexSrc.includes('syncNowUI()'), 'the manual sync button should be removed');
        assert.falsy(indexSrc.includes('sync-fab'), 'and its markup with it');
    });

    test('a battle fab takes its place', () => {
        assert.truthy(indexSrc.includes('battle-fab'), 'no arena button on the home screen');
        assert.truthy(indexSrc.includes('openPetBattle()'), 'the fab must open the arena');
        assert.truthy(cssSrc.includes('.battle-fab'), 'the fab has no styles');
    });

    // Removing the button is only safe because syncing is automatic.
    test('syncing still happens without a button to press', () => {
        const modules = ['lessons.js', 'phrases.js', 'rewrite.js', 'collocation.js', 'grammar-ui.js'];
        for (const m of modules) {
            const s = fs.readFileSync(path.join(root, 'js', m), 'utf8');
            assert.truthy(s.includes('EngAuth.syncNow()'), `${m} must still sync on its own`);
        }
        const auth = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
        assert.truthy(auth.includes('syncNow();'), 'and login must sync too');
    });

    test('the sync handler survives its button being gone', () => {
        const auth = fs.readFileSync(path.join(root, 'js', 'auth.js'), 'utf8');
        const fn = auth.slice(auth.indexOf('async function syncNowUI'));
        assert.truthy(fn.includes('if (btn)'), 'getElementById now returns null — every use must be guarded');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
