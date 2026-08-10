// friend-link.test.js — the quick connect link.
// Adding a friend meant typing their name EXACTLY, accents and all. A shared
// link carries the name instead — but a link is untrusted input, so it may
// only ever PREFILL a request. The tap is the consent.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'friends.js'), 'utf8');
const petbattleSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'petbattle.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf8');

// Rebuild the link exactly as the app does, so a changed shape fails here.
const PARAM = (src.match(/const FR_INVITE_PARAM = '([^']+)'/) || [])[1];
const link = (origin, name) => origin + '/?' + PARAM + '=' + encodeURIComponent(name);

suite('quick connect link', () => {
    test('the app defines a link parameter and a session key', () => {
        assert.truthy(PARAM, 'FR_INVITE_PARAM missing');
        assert.truthy(src.includes('FR_INVITE_KEY'), 'a pending invite must survive the login screen');
    });

    test('a Vietnamese name survives the round trip', () => {
        for (const name of ['Nhật', 'Bé Na', 'Nguyễn Văn A', 'Z', 'Trần Thị Hồng']) {
            const url = link('https://eng-pwa.pages.dev', name);
            const back = decodeURIComponent(new URL(url).searchParams.get(PARAM));
            assert.equal(back, name, `"${name}" must survive encode → decode`);
        }
    });

    test('names with spaces and marks are percent-encoded, not raw', () => {
        const url = link('https://eng-pwa.pages.dev', 'Bé Na');
        assert.falsy(url.includes(' '), 'a raw space breaks the link when pasted into chat');
        assert.truthy(url.includes('%20') || url.includes('+'), url);
    });

    // The whole point: a link names someone, it does not authorise anything.
    test('a link never sends a request on its own', () => {
        const capture = src.slice(src.indexOf('function _frCaptureInvite'), src.indexOf('function _frPendingInvite'));
        assert.falsy(/_frApi\s*\(/.test(capture), 'capturing an invite must not call the API');
        assert.falsy(/method:\s*'POST'/.test(capture), 'capturing an invite must not POST');
        assert.truthy(src.includes('acceptQuickInvite'), 'sending must be its own, tapped action');
        const accept = src.slice(src.indexOf('async function acceptQuickInvite'));
        assert.truthy(accept.includes("method: 'POST'"), 'the tapped action is what posts');
    });

    test('an invite is validated before it is stored', () => {
        const capture = src.slice(src.indexOf('function _frCaptureInvite'), src.indexOf('function _frPendingInvite'));
        assert.truthy(capture.includes('validUsername'), 'a link name gets the same rule as a typed one');
        assert.truthy(capture.includes('slice(0, 30)'), 'and the same length bound');
    });

    test('the URL is cleaned so a reload does not replay the invite', () => {
        assert.truthy(src.includes('history.replaceState'), 'strip the param after reading it');
    });

    test('the app ignores a link pointing at yourself', () => {
        const pending = src.slice(src.indexOf('function _frPendingInvite'), src.indexOf('function _frClearPendingInvite'));
        assert.truthy(pending.includes('currentUser'), 'own-link check missing');
    });

    test('accepting clears the pending invite so it cannot double-send', () => {
        const accept = src.slice(src.indexOf('async function acceptQuickInvite'), src.indexOf('function dismissQuickInvite'));
        assert.truthy(accept.includes('_frClearPendingInvite'), 'a sent invite must not linger');
    });

    test('the name shown in the banner is escaped', () => {
        assert.truthy(src.includes('frEsc(linkInvite)'), 'a link-supplied name is rendered as text, never markup');
    });

    test('sharing falls back to the clipboard when there is no share sheet', () => {
        const share = src.slice(src.indexOf('async function shareFriendLink'), src.indexOf('async function acceptQuickInvite'));
        assert.truthy(share.includes('navigator.share'), 'use the native sheet when present');
        assert.truthy(share.includes('clipboard'), 'desktop needs a fallback');
    });
});

suite('reaching friends is one tap from the arena', () => {
    test('the empty arena links to friends instead of describing the route', () => {
        assert.truthy(petbattleSrc.includes('pbGoToFriends'), 'a button, not an instruction');
        assert.falsy(/Vào Hồ sơ → 👥 Bạn bè để kết bạn/.test(petbattleSrc), 'the dead-end text should be gone');
    });

    test('it lands on the friends section, not the top of the profile', () => {
        const fn = petbattleSrc.slice(petbattleSrc.indexOf('function pbGoToFriends'));
        assert.truthy(fn.includes('friendsSection'), 'scroll to the section itself');
    });

    test('the share button and quick card are styled', () => {
        for (const cls of ['.friend-share-btn', '.friend-quick-card', '.friend-quick-skip']) {
            assert.truthy(cssSrc.includes(cls), `${cls} has no styles`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
