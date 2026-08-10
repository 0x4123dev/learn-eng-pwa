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
    'Z', 'A', '9',   // the app lets you create a one-letter profile — so must the server
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

    // A profile named "Z" was created in the app, then refused by the server
    // forever ("Username must be 2–30 characters") — and the Friends tab
    // answered by asking for a passcode, which could never fix a name.
    test('a one-character name is accepted (the app allows creating one)', () => {
        assert.truthy(registerSrc.includes('username.length < 1 || username.length > 30'),
            'the server must not be stricter than the profile-creation form');
        assert.truthy(USERNAME_RE.test('Z'), '"Z" must be a valid username');
    });

    test('the upper limit still holds at 30', () => {
        assert.truthy(registerSrc.includes('username.length > 30'));
    });
});

// The whole bug class here is two validators disagreeing. Pin them together.
suite('the client and the server share ONE username rule', () => {
    const authSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
    const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
    const cm = authSrc.match(/const USERNAME_RE = (\/\^\[[^\n]*?\/u);/);
    const CLIENT_RE = cm ? eval(cm[1]) : null;

    test('js/auth.js carries the same pattern as the endpoint', () => {
        assert.truthy(CLIENT_RE, 'EngAuth must define USERNAME_RE');
        assert.equal(String(CLIENT_RE), String(USERNAME_RE));
    });

    test('the client agrees with the server on every sample', () => {
        for (const n of OK) assert.truthy(CLIENT_RE.test(n), `client must accept "${n}"`);
        for (const n of REJECT) assert.falsy(CLIENT_RE.test(n), `client must reject "${n}"`);
    });

    test('the client length rule matches the server (1–30)', () => {
        assert.truthy(authSrc.includes('n.length < 1 || n.length > 30'));
    });

    test('profile creation checks the name before making a profile', () => {
        assert.truthy(appSrc.includes('EngAuth.validUsername'),
            'createUser() must reject an unsyncable name while it is still free to change');
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

    // Typing a passcode cannot fix a name the server refused.
    test('a rejected name does not get offered a passcode box', () => {
        const m = friendsSrc.match(/const needsCode = ([^;]+);/);
        assert.truthy(m, 'needsCode not found');
        assert.falsy(/'rejected'/.test(m[1]),
            "a name rejection must not ask for a passcode — that is what made 1111 'still error'");
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
