// ui-shell.test.js — high-level UX contracts for navigation and account entry.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('js/app.js');
const html = read('index.html');

suite('primary navigation UX', () => {
    test('active Home continuously repairs stale full-screen nav state', () => {
        const invariant = app.slice(app.indexOf('function ensureHomeBottomNav'), app.indexOf('// ---- doors into code that is not loaded yet'));
        assert.truthy(invariant.includes("home.classList.contains('active')"),
            'repair must only run while Home is the visible destination');
        assert.truthy(invariant.includes("nav.style.display = 'flex'"));
        assert.truthy(invariant.includes('new MutationObserver(ensureHomeBottomNav)'),
            'late async style changes must also be repaired, not only initial render');
    });

    test('opening a destination resets that screen scroll position', () => {
        assert.truthy(/nextScreen\.scrollTop\s*=\s*0/.test(app),
            'bottom navigation must not reopen a screen halfway down');
    });

    test('a live Book practice cannot be discarded by a navigation mis-tap', () => {
        const nav = app.slice(app.indexOf('function switchScreen'), app.indexOf('function navigateToProfile'));
        assert.truthy(nav.includes('isUnitPracticeActive()'));
        assert.truthy(nav.includes("confirm('You are in the middle of a practice."));
        assert.truthy(nav.includes('abandonUnitPractice()'), 'confirmed exit must clean the practice up');
        assert.truthy(nav.includes('return false;'), 'cancel keeps the active practice on screen');
    });

    test('the home profile entry is a labelled button', () => {
        assert.truthy(/<button[^>]+home-user-avatar[^>]+aria-label="Open profile"/.test(html));
    });
});

suite('keyboard-ready profile selection', () => {
    test('avatar choices expose their selected state', () => {
        assert.truthy(/avatarPicker[^>]+role="group"/.test(html));
        assert.truthy(/avatar-option selected[^>]+aria-pressed="true"/.test(html));
        assert.truthy(/setAttribute\('aria-pressed', 'false'\)/.test(app));
    });

    test('existing profiles have separate open and delete buttons', () => {
        assert.truthy(/class="user-open-btn"/.test(app));
        assert.truthy(/class="delete-user-btn" aria-label="Delete/.test(app));
        assert.falsy(/card\.onclick\s*=/.test(app),
            'a clickable div is not keyboard-operable by default');
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
