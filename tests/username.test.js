// username.test.js — the account-name rule. This is a Vietnamese app, so the
// server MUST accept accented names; an ASCII-only \w rejected every one of
// them with a 400 that surfaced as a vague "server busy" in the Friends tab.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const registerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'functions', 'api', 'register.js'), 'utf8');

// Pull the live pattern out of the endpoint so the test can never drift.
const m = registerSrc.match(/if \(!(\/\^\[[^\n]*?\/u)\.test\(username\)\)/);
const USERNAME_RE = m ? eval(m[1]) : null;

const OK = [
    'Nhật', 'Bé Na', 'Đạt', 'Nguyễn Văn A', 'Trần Thị Hồng',
    'Shidou', 'Vk shidou', 'Nhuxinhdep', 'admin',
    'be_na', 'Anh-Thu', 'Le Van 2', 'Bảo Ngọc.', 'ひかり', '안나', 'Мария',
];
const REJECT = [
    '<script>', 'a\nb', 'bad/slash', 'semi;colon', 'quote"name', "tick'name",
    'star*', 'pipe|', 'brace{}', 'at@sign', 'hash#tag', 'percent%',
];

suite('usernames: a Vietnamese app must accept Vietnamese names', () => {
    test('the endpoint uses a Unicode-aware pattern', () => {
        assert.truthy(USERNAME_RE, 'username pattern not found in register.js');
        assert.truthy(registerSrc.includes('\\p{L}'), 'must match letters of any language');
        assert.truthy(/\/u[^a-z]/.test(registerSrc), 'pattern needs the /u flag');
    });

    test('accented Vietnamese names are accepted', () => {
        for (const name of ['Nhật', 'Bé Na', 'Đạt', 'Nguyễn Văn A', 'Trần Thị Hồng', 'Bảo Ngọc.']) {
            assert.truthy(USERNAME_RE.test(name), `"${name}" must be a valid username`);
        }
    });

    test('the names already on this server still validate', () => {
        for (const name of ['admin', 'Oleole', 'Brian', 'Nhuxinhdep', 'Vk shidou', 'Shidou']) {
            assert.truthy(USERNAME_RE.test(name), `existing account "${name}" must stay valid`);
        }
    });

    test('other scripts work too (the rule is not Vietnamese-only)', () => {
        for (const name of ['ひかり', '안나', 'Мария']) {
            assert.truthy(USERNAME_RE.test(name), `"${name}" should be allowed`);
        }
    });

    test('digits, space, dot, underscore and hyphen are allowed', () => {
        for (const name of ['be_na', 'Anh-Thu', 'Le Van 2', 'user.name']) {
            assert.truthy(USERNAME_RE.test(name), name);
        }
    });

    test('markup and control characters are still rejected', () => {
        for (const name of REJECT) {
            assert.falsy(USERNAME_RE.test(name), `"${name}" must be rejected`);
        }
    });

    test('every accepted sample passes and every rejected one fails', () => {
        assert.equal(OK.filter(n => !USERNAME_RE.test(n)).length, 0);
        assert.equal(REJECT.filter(n => USERNAME_RE.test(n)).length, 0);
    });

    test('length limits are unchanged (2–30)', () => {
        assert.truthy(registerSrc.includes('username.length < 2 || username.length > 30'));
    });
});

suite('link failures are reported honestly', () => {
    const authSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
    const friendsSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'friends.js'), 'utf8');

    test('a 4xx rejection keeps the server\'s own message', () => {
        assert.truthy(authSrc.includes("reason: 'rejected'") || authSrc.includes("'rejected' : 'server'"),
            'a client-side rejection must be distinguishable from a server outage');
        assert.truthy(authSrc.includes('r.data.error'), 'the server message must be kept');
    });

    test('the Friends tab shows that detail rather than a generic excuse', () => {
        assert.truthy(friendsSrc.includes('rejected:'), 'rejected needs its own message');
        assert.truthy(friendsSrc.includes('st.detail'), 'the detail must reach the UI');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
