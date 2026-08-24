// ui-shell.test.js — high-level UX contracts for navigation and account entry.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('js/app.js');
const html = read('index.html');
const battle = read('js/petbattle.js');

suite('primary navigation UX', () => {
    test('opening a destination resets that screen scroll position', () => {
        assert.truthy(/nextScreen\.scrollTop\s*=\s*0/.test(app),
            'bottom navigation must not reopen a screen halfway down');
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

suite('arena unavailable state', () => {
    test('uses a useful card with a real arena image and recovery actions', () => {
        assert.truthy(/function _pbOfflineCard\(\)/.test(battle));
        assert.truthy(/cloudstep-meadow\/poster\.webp/.test(battle));
        assert.truthy(/offlineProfile/.test(battle));
        assert.truthy(/offlineRetry/.test(battle));
    });

    test('does not keep polling while unavailable', () => {
        const refresh = battle.slice(battle.indexOf('async function refreshPetBattle'), battle.indexOf('function pbFmtCountdown'));
        assert.truthy(/_pbStopPolling\(\)/.test(refresh));
    });
});

