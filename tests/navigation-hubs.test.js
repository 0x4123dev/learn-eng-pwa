'use strict';

const fs = require('fs');
const path = require('path');
const { suite, test, assert } = require('./harness');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css', 'styles.css'), 'utf8');

function blockBetween(source, start, end) {
    const from = source.indexOf(start);
    return source.slice(from, source.indexOf(end, from));
}

suite('primary navigation: five clear destinations', () => {
    const nav = blockBetween(html, '<nav class="bottom-nav"', '</nav>');

    test('the bottom bar contains exactly five real buttons', () => {
        assert.equal((nav.match(/class="nav-item/g) || []).length, 5);
        const keys = [...nav.matchAll(/data-nav-key="([^"]+)"/g)].map(m => m[1]);
        assert.deepEqual(keys, ['home', 'learn', 'arena', 'math', 'exam']);
    });

    test('every destination has a visible label and a consistent SVG icon', () => {
        for (const label of ['Home', 'Learn', 'Arena', 'Math', 'Exam']) {
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

suite('navigation hubs: old modules remain easy to find', () => {
    test('Learn owns knowledge, review, Word Form and Rewrite', () => {
        const hub = blockBetween(html, 'id="learnHubScreen"', 'id="mathHubScreen"');
        for (const screen of [
            'topicsScreen', 'grammarScreen', 'speedChallengeScreen', 'phrasesScreen',
            'wordformScreen', 'rewriteScreen'
        ]) {
            assert.truthy(hub.includes(screen), screen + ' is missing from Learn');
        }
        assert.truthy(hub.includes('startReviewSession()'), 'Smart Review is missing from Learn');
        assert.truthy(hub.includes('id="learnDueText"'), 'Learn must show the live review count');
    });

    test('Math is now a real tab, rendered by js/math.js', () => {
        // It shipped as an honest "coming soon" placeholder; the Toán 7 formula
        // practice replaced it, so the screen is an empty container the tab
        // renders into rather than static markup.
        const hub = blockBetween(html, 'id="mathHubScreen"', '<!-- Grammar Screen -->');
        assert.falsy(hub.includes('COMING SOON'), 'the placeholder outlived the real tab');
        assert.truthy(html.includes('js/math.js'), 'index.html must load the Math tab');
        assert.truthy(/mathHubScreen'\s*&&\s*typeof renderMathHome/.test(app),
            'opening the tab must render it');
    });

    test('deep screens inherit their parent bottom-nav state', () => {
        for (const pair of [
            ["topicsScreen: 'learn'", 'Topics'],
            ["grammarScreen: 'learn'", 'Grammar'],
            ["speedChallengeScreen: 'learn'", 'Verbs'],
            ["phrasesScreen: 'learn'", 'Phrases'],
            ["petBattleScreen: 'arena'", 'Arena'],
            ["wordformScreen: 'learn'", 'Word form'],
            ["rewriteScreen: 'learn'", 'Rewrite'],
            ["mathHubScreen: 'math'", 'Math'],
            ["examScreen: 'exam'", 'Exam'],
        ]) {
            assert.truthy(app.includes(pair[0]), pair[1] + ' has no parent navigation state');
        }
        assert.truthy(app.includes('setBottomNavActive(screenId)'),
            'screen changes must update navigation without relying on a global click event');
    });

    test('Learn expands to three columns on iPad without changing phone layout', () => {
        assert.truthy(css.includes('@media (min-width: 700px)'));
        assert.truthy(css.includes('.learn-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }'));
        assert.truthy(css.includes('.math-empty { max-width: 900px; }'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
