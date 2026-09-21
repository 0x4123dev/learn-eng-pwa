'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const css = require('./css-all').readAllCss();

function blockBetween(source, start, end) {
    const from = source.indexOf(start);
    return source.slice(from, source.indexOf(end, from));
}

suite('primary navigation: five clear destinations', () => {
    const nav = blockBetween(html, '<nav class="bottom-nav"', '</nav>');

    test('the bottom bar contains exactly five real buttons', () => {
        assert.equal((nav.match(/class="nav-item/g) || []).length, 5);
        const keys = [...nav.matchAll(/data-nav-key="([^"]+)"/g)].map(m => m[1]);
        assert.deepEqual(keys, ['home', 'book1', 'book2', 'book3', 'farm']);
    });

    test('every destination has a visible label and a consistent SVG icon', () => {
        for (const label of ['Home', 'Book 1', 'Book 2', 'Book 3', 'Nông trại']) {
            assert.truthy(nav.includes('<span>' + label + '</span>'), label + ' label is missing');
        }
        assert.equal((nav.match(/<svg viewBox="0 0 24 24">/g) || []).length, 5);
        assert.falsy(/[🏠📚🎓📝🔗🔤✍️🎯⚔️]/u.test(nav), 'navigation icons should not mix emoji glyph styles');
    });

    test('touch targets and keyboard focus are not compressed for small phones', () => {
        const item = blockBetween(css, '.nav-item {', '\n        }');
        assert.truthy(/min-height:\s*60px/.test(item));
        assert.truthy(css.includes('.nav-item:focus-visible'));
        assert.falsy(/\.nav-item\s*\{[^}]*font-size:\s*9px/.test(css));
    });
});

suite('navigation hubs: every screen is reachable from the bar', () => {
    test('the three Book buttons open the shared Word screen on their own set', () => {
        for (const set of ['pr1', 'pr2', 'pr3']) {
            assert.truthy(html.includes(`onclick="openBook('${set}')"`), set + ' has no bottom-bar button');
        }
        const fn = blockBetween(app, 'function openBook(set)', '\n}');
        assert.truthy(fn.includes("switchUnitSet(set, { silent: true })"), 'the set is chosen before the switch');
        assert.truthy(fn.includes("switchScreen('wordScreen')"), 'and then the Word screen opens');
    });

    test('the farm is a real tab, rendered by the lazy farm group', () => {
        // The tab's code is a lazy group (js/lazy-data.js GROUP_FILES.farm)
        // that openNightRaid() fetches on first open.
        assert.falsy(html.includes('<script src="js/night-raid.js"'), 'js/night-raid.js must not block the first paint');
        assert.truthy(require('../js/lazy-data.js').GROUP_FILES.farm.includes('js/night-raid.js'), 'the farm code must ride the farm group');
        assert.truthy(app.includes("var openNightRaid = lazyEntry('farm', 'openNightRaid', 'nightRaidScreen');"),
            'opening the tab must fetch and render it');
    });

    test('deep screens inherit their parent bottom-nav state', () => {
        for (const pair of [
            ["dailyTaskScreen: 'home'", 'Daily Task'],
            ["profileScreen: 'home'", 'Profile'],
            ["nightRaidScreen: 'farm'", 'Nông trại'],
        ]) {
            assert.truthy(app.includes(pair[0]), pair[1] + ' has no parent navigation state');
        }
        // The Word screen belongs to whichever Book is open.
        assert.truthy(app.includes("NAV_KEY_BY_BOOK = Object.freeze({ pr1: 'book1', pr2: 'book2', pr3: 'book3' })"),
            'the Word screen must highlight the Book it is showing');
        assert.truthy(app.includes('setBottomNavActive(screenId)'),
            'screen changes must update navigation without relying on a global click event');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
