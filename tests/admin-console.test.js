// admin-console.test.js — disabling accounts, staying signed in, and the
// users table an admin actually has to read.
//
// Three things are pinned here that are each one careless edit from silently
// breaking, and none of which show up in a diff:
//
//   1. Disabling enforced in requireAuth, not only in login. Tokens live 90
//      days, so a login-only check would let a disabled child keep working for
//      up to three months while the switch appeared to have worked.
//   2. An admin cannot disable themselves or another admin. requireAuth
//      refuses a disabled account, so a disabled admin cannot reach the
//      endpoint that would undo it — the only way back would be editing
//      production data by hand.
//   3. The client-side profile cap equals the server's account cap. They live
//      in different runtimes and cannot share a module.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const libSrc = read('functions/api/_lib.js');
const loginSrc = read('functions/api/login.js');
const flagsSrc = read('functions/api/admin/user-flags.js');
const usersApiSrc = read('functions/api/admin/users.js');
const adminHtml = read('admin.html');
const authSrc = read('js/auth.js');
const appSrc = read('js/app.js');
const indexHtml = read('index.html');
const migrationSrc = read('db/005-disable-account.sql');
const schemaSrc = read('db/schema.sql');

// Run the dashboard's own helpers rather than describing them.
const dash = (() => {
    const script = adminHtml.match(/<script>([\s\S]*)<\/script>/)[1];
    const pick = (name) => {
        const start = script.indexOf('function ' + name + '(');
        if (start < 0) throw new Error(name + ' not found in admin.html');
        const end = script.indexOf('\n}', start);
        return script.slice(start, end + 2);
    };
    const sandbox = { String, Math, Date, Number, isNaN };
    vm.createContext(sandbox);
    vm.runInContext([pick('fold'), pick('initials'), pick('relTime')].join('\n') +
        '\nthis.fold = fold; this.initials = initials; this.relTime = relTime;', sandbox);
    return sandbox;
})();

suite('admin: disabling an account', () => {
    test('the column exists, defaults to enabled, and keeps all history', () => {
        assert.truthy(/ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0/.test(migrationSrc));
        assert.falsy(/DELETE FROM/.test(migrationSrc), 'disabling must never delete anything');
        assert.truthy(/disabled\s+INTEGER NOT NULL DEFAULT 0/.test(schemaSrc), 'schema.sql must match the migration');
    });

    test('EVERY authenticated request checks it, not just login', () => {
        // The whole point. A 90-day token would otherwise outlive the switch.
        const fn = libSrc.slice(libSrc.indexOf('export async function requireAuth'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(body.includes('SELECT id, role, disabled FROM users WHERE id = ?'),
            'requireAuth must look the account up');
        assert.truthy(/if \(!row \|\| row\.disabled\) return null/.test(body),
            'a disabled or deleted account must fail auth');
    });

    test('the role comes from the row, not the token', () => {
        // Otherwise an admin demoted to 'user' keeps admin powers until their
        // token expires — the same 90-day hole in a different shape.
        const fn = libSrc.slice(libSrc.indexOf('export async function requireAuth'));
        assert.truthy(/role: row\.role/.test(fn.slice(0, fn.indexOf('\n}'))));
    });

    test('login explains it, but only after the passcode is right', () => {
        // Answering "disabled" to a wrong guess would turn login into a way to
        // discover which usernames exist.
        const disabledAt = loginSrc.indexOf('user.disabled');
        const passcodeAt = loginSrc.indexOf('timingSafeEqual');
        assert.truthy(disabledAt > 0 && passcodeAt > 0);
        assert.truthy(passcodeAt < disabledAt, 'the disabled check leaks account existence');
        assert.truthy(loginSrc.includes("code: 'account_disabled'"));
        assert.truthy(loginSrc.includes('403'));
    });

    test('an admin cannot disable themselves or another admin', () => {
        assert.truthy(/userId === auth\.uid[\s\S]{0,90}self_disable/.test(flagsSrc),
            'disabling yourself would lock you out of the console that undoes it');
        assert.truthy(/user\.role === 'admin'[\s\S]{0,90}admin_disable/.test(flagsSrc),
            'the last admin could be disabled with no way back');
    });

    test('those guards only fire when DISABLING, so re-enabling always works', () => {
        // If the guard also blocked disabled:false, an admin account switched
        // off by an earlier build could never be recovered through the API.
        assert.truthy(/if \(wantsDisable && body\.disabled\) \{/.test(flagsSrc),
            'the self/admin guards must be scoped to the disabling direction');
    });

    test('the dashboard can see and set it', () => {
        assert.truthy(usersApiSrc.includes('disabled: !!u.disabled'), 'the list must report it');
        assert.truthy(usersApiSrc.includes('has_device: !!u.has_device'),
            'the admin needs to know whether an account holds a device slot');
        assert.truthy(adminHtml.includes('act-disable') && adminHtml.includes('act-enable'));
        assert.truthy(/act-disable[\s\S]{0,400}confirm\(/.test(adminHtml),
            'signing a child out of every device deserves one confirmation');
    });

    test('delete for good: typed-name confirmation, DELETE admin/users, hidden for admins', () => {
        // Irreversible and it takes the wallet and the farm with it — a
        // confirm() OK is too cheap; the admin types the username back.
        const block = adminHtml.match(/act\('\.act-delete', b => \{[\s\S]*?\n  \}\);/);
        assert.truthy(block, 'the delete row action must be wired');
        assert.truthy(/prompt\(/.test(block[0]) && /typed\.trim\(\) !== b\.dataset\.name/.test(block[0]),
            'the typed name must match the username exactly, or nothing is deleted');
        assert.truthy(/api\('admin\/users', \{ method:'DELETE'/.test(block[0]), 'must call DELETE admin/users');
        assert.truthy(/u\.role === 'admin' \? '' : `<button class="mini danger act-delete"/.test(adminHtml),
            'no delete button on an admin row');
        assert.truthy(/act-delete[^>]*title="Xoá vĩnh viễn/.test(adminHtml), 'the title says it is permanent');
    });

    test('the page updates its own service worker, and says so when it cannot', () => {
        // admin.html is inside the worker's scope, so its scripts are served
        // cache-first from whatever generation is installed — but only
        // js/app.js ever registered, checked and swapped the worker in. An
        // adult who opens nothing but this page was still being shown the
        // pre-cut lesson tree (Eng/Toán) on 2026-09-23.
        assert.truthy(/navigator\.serviceWorker\.getRegistration\(\)/.test(adminHtml), 'the page must look for the worker');
        assert.truthy(/reg\.update\(\)/.test(adminHtml), 'and ask for a fresh sw.js on every load');
        assert.truthy(/postMessage\(\{ type: 'SKIP_WAITING' \}\)/.test(adminHtml), 'a waiting worker must be taken at once — nothing here is interruptible');
        assert.truthy(/addEventListener\('controllerchange'/.test(adminHtml) && /location\.reload\(\)/.test(adminHtml),
            'the page must reload once the new worker takes over, or it keeps the old scripts it already ran');
        assert.truthy(/staleBanner/.test(adminHtml) && /bản cũ/.test(adminHtml),
            'an update that cannot land must not look like a working picker');
        // The staleness test is the catalog itself: this product only ever
        // assigns Book practice.
        assert.truthy(/\/\^word-pr\[123\]\$\/\.test\(e\.group\)/.test(adminHtml),
            'the page must recognise a foreign catalog by its groups');
    });

    test('the disable button is hidden for admins in the UI too', () => {
        // The server refuses it anyway; offering a button that always errors is
        // a worse experience than not offering it.
        assert.truthy(/u\.role === 'admin' \? '' : \(u\.disabled/.test(adminHtml));
    });
});

suite('admin: staying signed in', () => {
    test('the checkbox exists and is on by default', () => {
        assert.truthy(/<input type="checkbox" id="keepMe" checked>/.test(adminHtml),
            'the default must be to stay signed in');
    });

    test('checked persists across a browser restart, unchecked does not', () => {
        assert.truthy(/\(keep \? localStorage : sessionStorage\)\.setItem\(TOKEN_KEY, t\)/.test(adminHtml),
            'keep → localStorage (survives a restart); otherwise sessionStorage');
        assert.truthy(/writeToken\(token, document\.getElementById\('keepMe'\)\.checked\)/.test(adminHtml));
    });

    test('a returning admin is picked up from either store', () => {
        assert.truthy(/localStorage\.getItem\(TOKEN_KEY\) \|\| sessionStorage\.getItem\(TOKEN_KEY\)/.test(adminHtml),
            'last session may have used the other store');
    });

    test('logging out clears BOTH stores', () => {
        // writeToken always clears both before writing, so a token can never be
        // left behind in the store nobody thought to clear.
        const fn = adminHtml.slice(adminHtml.indexOf('function writeToken'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        assert.truthy(body.includes('localStorage.removeItem(TOKEN_KEY)'));
        assert.truthy(body.includes('sessionStorage.removeItem(TOKEN_KEY)'));
        assert.truthy(/function logout\(\)\{[\s\S]{0,200}writeToken\(null, false\)/.test(adminHtml));
    });

    test('storage being unavailable does not break the page', () => {
        // Safari private mode throws on localStorage access.
        assert.truthy(/function readToken\(\) \{[\s\S]{0,200}catch \(e\) \{ return null; \}/.test(adminHtml));
    });
});

suite('admin: the users table reads clearly', () => {
    test('search ignores Vietnamese accents', () => {
        // A literal match makes the box useless in a Vietnamese app: "bo"
        // would never find "Bố ck".
        assert.truthy(dash.fold('Bố ck').includes('bo'), '"bo" must match "Bố ck"');
        assert.truthy(dash.fold('Vk shidou').includes('vk'));
        assert.truthy(dash.fold('Đạt').includes('dat'), 'đ must fold to d — NFD alone drops it');
        assert.equal(dash.fold('NHẬT'), 'nhat');
        assert.equal(dash.fold(null), '');
    });

    test('initials survive one-word, multi-word and accented names', () => {
        assert.equal(dash.initials('Brian'), 'B');
        assert.equal(dash.initials('Bố ck'), 'BC');
        assert.equal(dash.initials('Vk shidou'), 'VS');
        assert.equal(dash.initials(''), '?');
        assert.equal(dash.initials(null), '?');
    });

    test('last-seen is relative, with the exact time still available', () => {
        const now = Date.now();
        const at = (ms) => new Date(now - ms).toISOString().replace('T', ' ').slice(0, 19);
        assert.equal(dash.relTime(null), '—');
        assert.equal(dash.relTime(at(30 * 1000)), 'vừa xong');
        assert.equal(dash.relTime(at(45 * 60000)), '45 phút trước');
        assert.equal(dash.relTime(at(3 * 3600000)), '3 giờ trước');
        assert.equal(dash.relTime(at(5 * 86400000)), '5 ngày trước');
        assert.equal(dash.relTime(at(60 * 86400000)), '2 tháng trước');
        assert.truthy(/title="\$\{esc\(fmtDate\(u\.last_activity\)\)\}"/.test(adminHtml),
            'the exact stamp must stay on hover');
    });

    test('columns are sortable, and a new column starts on its natural order', () => {
        assert.truthy(adminHtml.includes('th.sortable'), 'headers must be sortable');
        assert.truthy(/_sort = \{ key, dir: key === 'username' \? 1 : -1 \}/.test(adminHtml),
            'names sort A-Z; counts and dates start with the biggest/newest');
        assert.truthy(/if \(_sort\.key === key\) _sort\.dir \*= -1/.test(adminHtml),
            'clicking the same column must toggle direction');
    });

    test('the history is grouped by day and the old ten-row pager is gone', () => {
        // The landing page is every child's history grouped by day, with the
        // two most recent days open and the rest folded (executed in
        // tests/admin-overview.test.js). A flat list paged by ten made a
        // parent click through "1–10 / 43" to find yesterday.
        assert.falsy(adminHtml.includes('ACT_PAGE_SIZE'), 'the paged feed was replaced by day groups');
        assert.truthy(/<details class="day"\$\{open\}>/.test(adminHtml), 'each day is a collapsible group');
        assert.truthy(/const open = i < 2 \? ' open' : ''/.test(adminHtml), 'today and yesterday open, older days folded');
        assert.truthy(adminHtml.includes('Không ai học'), 'a day nobody studied is said out loud');
    });

    test('the activity meter is anchored to the number it belongs to', () => {
        // Right-aligned digits with a left-anchored meter under them read as a
        // broken cell rather than as a comparison.
        assert.truthy(/\.meter \{[^}]*margin:3px 0 0 auto/.test(adminHtml));
    });

    test('no bare .bar rule, which would also style the page header', () => {
        // <header class="bar"> exists. A generic `.bar { height:4px; ... }`
        // for the activity meter matched it too and rendered the whole header
        // as a 4px blue strip with its buttons spilling over the stats.
        assert.falsy(/\n  \.bar \{/.test(adminHtml),
            'a top-level .bar rule collides with <header class="bar">');
        assert.falsy(/class="bar"[^>]*style="width:/.test(adminHtml),
            'the meter must not use the .bar class');
    });

    test('a disabled row is visibly different, not just differently labelled', () => {
        assert.truthy(adminHtml.includes('tr.disabled td { opacity:.55; }'));
        assert.truthy(adminHtml.includes('tr.disabled .who-name { text-decoration:line-through; }'));
        assert.truthy(adminHtml.includes('pill dead'), 'and it needs an explicit Disabled badge');
    });

    test('row buttons do not also select the row', () => {
        assert.truthy(/e\.stopPropagation\(\)/.test(adminHtml),
            'clicking Disable would otherwise also switch the activity panel');
    });
});

suite('admin on a phone: still a table at 393px', () => {
    // Checked on an iPhone 16 (393x852). A card layout was built here first and
    // reverted on feedback: cards make ONE user readable and several users
    // impossible to compare, which is the reason to open this screen at all.
    // So the table stays and everything else gives way — smaller type, tighter
    // cells, icon-only buttons, sticky name column.
    const phoneBlock = adminHtml.slice(adminHtml.indexOf('@media (max-width: 640px)'),
        adminHtml.indexOf('#dash { display:none; }'));

    test('it is a real table on a phone, not cards', () => {
        assert.falsy(/table\.cards/.test(adminHtml), 'the card layout was reverted — comparing rows matters more');
        assert.falsy(/class="cards"/.test(adminHtml));
        assert.falsy(/data-label=/.test(adminHtml), 'card-only labels must not linger as dead attributes');
        assert.falsy(/thead \{ display:none/.test(phoneBlock), 'column headers are what make columns comparable');
    });

    test('the buttons shrink to icons, which is what put them off-screen', () => {
        // Three labelled buttons need ~220px of a 351px-wide screen.
        // Asserted as a PROPERTY, not as exact pixels: these numbers were tuned
        // repeatedly to make the table fit 393px, and a test that breaks on
        // every tune teaches you to edit the test instead of read it.
        assert.truthy(/\.mini \.lbl \{ display:none; \}/.test(phoneBlock));
        assert.truthy(adminHtml.includes('<span class="lbl">'), 'the word must be in its own element to hide');
        const m = phoneBlock.match(/\.mini \{ padding:0; width:(\d+)px; height:(\d+)px/);
        assert.truthy(m, 'the icon buttons need a fixed square size');
        const [w, h] = [Number(m[1]), Number(m[2])];
        assert.equal(w, h, 'an icon button should be square');
        assert.truthy(w >= 30 && w <= 40, `icon buttons are ${w}px — too small to tap or too wide to fit`);
    });

    test('an icon-only button still announces what it does', () => {
        // display:none removes the label from the accessibility tree, so each
        // button would otherwise announce nothing but an emoji. Every .mini row
        // action counts: the five in the users table (coins, clear device,
        // enable, disable, delete for good), plus the Daily task tab's delete, which is the
        // same icon-only button in a different table. (🌱 Chơi trước and
        // 🎓 Chuyên went with the features they switched on, 2026-09.)
        const tags = adminHtml.match(/<button class="mini[\s\S]*?>/g) || [];
        assert.equal(tags.length, 6, `expected 6 row-action buttons, found ${tags.length}`);
        for (const cls of ['act-coins', 'act-clear', 'act-enable', 'act-disable', 'act-delete', 'act-daily-del']) {
            const tag = tags.find(t => t.includes(cls));
            assert.truthy(tag, cls + ' button not found');
            assert.truthy(tag.includes('aria-label='),
                cls + ' has no accessible name once its label is hidden');
        }
    });

    test('the name column stays put while the rest scrolls', () => {
        // Otherwise scrolling right to reach Actions loses track of whose row
        // you are on — which would defeat the comparison the table is for.
        assert.truthy(/#usersTable th:first-child, #usersTable td:first-child \{[\s\S]{0,80}position:sticky/.test(phoneBlock));
        assert.truthy(/#usersTable tr\.selected td:first-child \{ background:#[0-9a-f]{6}/.test(phoneBlock),
            'a sticky cell needs its own selected background, or the highlight stops at it');
    });

    test('type and spacing tighten so the columns fit', () => {
        const font = phoneBlock.match(/#usersTable \{ font-size:([\d.]+)px; \}/);
        assert.truthy(font, 'the table must set a smaller type size on phones');
        assert.truthy(Number(font[1]) < 13.5, 'phone type must be smaller than the desktop 13.5px');

        const pad = phoneBlock.match(/#usersTable th, #usersTable td \{ padding:\d+px (\d+)px; \}/);
        assert.truthy(pad, 'cells must tighten horizontally');
        assert.truthy(Number(pad[1]) <= 6, `cell padding is ${pad[1]}px — the desktop 14px does not fit`);

        const av = phoneBlock.match(/\.avatar \{ width:(\d+)px/);
        assert.truthy(av && Number(av[1]) <= 26, 'the 32px desktop avatar is too wide for the name column');
    });

    test('headers are abbreviated, because the header sets the column width', () => {
        // "LAST SEEN" is 62px against a 48px value, "ACTIVITY" 52px against
        // 25px — so the words, not the data, were what did not fit.
        assert.truthy(adminHtml.includes('<span class="th-short">Gần nhất</span>'));
        assert.truthy(adminHtml.includes('<span class="th-short">Lượt</span>'));
        assert.truthy(/\.th-short \{ display:none; \}/.test(adminHtml), 'desktop keeps the full words');
        assert.truthy(/\.th-full \{ display:none; \}/.test(phoneBlock));
        assert.truthy(/\.th-short \{ display:inline; \}/.test(phoneBlock));
    });

    test('the last pixels come from the page gutter, not from legibility', () => {
        assert.truthy(/\.wrap \{ padding-inline: 10px; \}/.test(phoneBlock),
            'squeezing the cells further would have cost readability instead');
    });

    test('one long name cannot set the width of the whole column', () => {
        assert.truthy(/\.who-name \{ display:inline-block; max-width:\d+px; overflow:hidden;/.test(phoneBlock));
        assert.truthy(/text-overflow:ellipsis/.test(phoneBlock), 'a clipped name needs an ellipsis to show it is clipped');
    });

    test('only the redundant columns give way', () => {
        // Status is dropped on phones because the row already says it: a
        // disabled row is faded and struck through and offers Enable instead
        // of Disable. The numbers an admin compares must all survive.
        assert.truthy(/th\.hide-xs, td\.hide-xs \{ display:none; \}/.test(phoneBlock));
        assert.truthy(adminHtml.includes('<th class="hide-xs">Trạng thái</th>'));
        for (const kept of ['data-sort="total_count"', 'data-sort="last_activity"', 'data-sort="username"']) {
            assert.truthy(adminHtml.includes(kept), `${kept} column must survive on a phone`);
        }
        assert.falsy(/\.who-cell[^{]*\{[^}]*display:none/.test(phoneBlock), 'the user column must never be hidden');
    });

    test('sorting is reachable without hitting a 10px header', () => {
        assert.truthy(adminHtml.includes('id="sortSel"'));
        assert.truthy(/\.sort-mobile \{ display:none; \}/.test(adminHtml), 'and hidden on desktop');
        assert.truthy(/if \(sel && sel\.value !== key\) sel\.value = key/.test(adminHtml),
            'the dropdown and the header clicks must not disagree about the current order');
    });

    test('the header wraps instead of landing on top of the stats', () => {
        assert.truthy(/header\.bar \{[^}]*flex-wrap:wrap/.test(adminHtml));
        assert.truthy(adminHtml.includes('class="bar-actions"'),
            'the buttons need their own box, or they cannot wrap as a unit');
    });

    test('the keep-me label does not call a phone a computer', () => {
        assert.truthy(adminHtml.includes('Keep me signed in on this device'));
        assert.falsy(adminHtml.includes('on this computer'));
    });
});

suite('device profiles: the app stops offering a form that would be refused', () => {
    test('the client cap equals the server cap', () => {
        // The number lives in two runtimes that cannot share a module. If they
        // drift, the app either offers a form the server refuses or blocks a
        // profile the server would have allowed.
        const client = authSrc.match(/const MAX_DEVICE_PROFILES = (\d+);/);
        const server = libSrc.match(/export const MAX_ACCOUNTS_PER_DEVICE = (\d+);/);
        assert.truthy(client && server, 'both constants must exist');
        assert.equal(Number(client[1]), Number(server[1]),
            `client allows ${client[1]} profiles but the server allows ${server[1]}`);
    });

    test('the create form is hidden once the device is full', () => {
        assert.truthy(indexHtml.includes('id="createUserSection"'), 'the form needs a handle to hide');
        assert.truthy(indexHtml.includes('id="deviceFullNote"'), 'and something must take its place');
        assert.truthy(/createSection\.style\.display = full \? 'none' : 'block'/.test(appSrc));
        assert.truthy(/fullNote\.style\.display = full \? 'block' : 'none'/.test(appSrc));
    });

    test('the explanation points at what actually works', () => {
        const note = indexHtml.slice(indexHtml.indexOf('id="deviceFullNote"'), indexHtml.indexOf('id="existingUsersSection"'));
        assert.truthy(/Choose one above/.test(note), 'signing in must be offered');
        assert.truthy(/delete a profile/i.test(note), 'and the way to make room');
    });

    test('createUser still refuses a third profile even if the form is showing', () => {
        // A stale page or a double submit must not slip one through.
        assert.truthy(/if \(users\.length >= maxDeviceProfiles\(\)\)/.test(appSrc),
            'the handler needs its own guard, not just a hidden form');
    });

    test('deleting a profile brings the form back', () => {
        const fn = appSrc.slice(appSrc.indexOf('function confirmDeleteUser()'));
        assert.truthy(fn.slice(0, fn.indexOf('\n}')).includes('checkExistingUsers()'),
            'freeing a slot must re-show the create form, or the device stays stuck');
    });

    test('the cap degrades to a sane default if EngAuth is missing', () => {
        assert.truthy(/\(typeof EngAuth !== 'undefined' && EngAuth\.MAX_DEVICE_PROFILES\) \|\| 2/.test(appSrc));
    });
});

suite('admin: the Daily task tab', () => {
    test('the Daily task tab has a panel and the catalog it needs', () => {
        assert.truthy(/<button class="admin-tab" id="tabTasks"[^>]*aria-controls="tasksPanel"/.test(adminHtml));
        assert.truthy(adminHtml.includes('id="tasksPanel"'), 'aria-controls must point at a real panel');
        assert.truthy(adminHtml.includes('<script src="js/daily-task-catalog.js">'),
            'DailyTaskCatalog fills both dropdowns');
    });

    test('the target the admin can type is the target the server accepts', () => {
        // Two caps in two runtimes: a form that offers 99 when the server tops
        // out at 50 turns a typo into an error message instead of a task.
        const client = adminHtml.match(/id="dailyTarget"[^>]*max="(\d+)"/);
        const server = read('functions/api/_daily-task.js').match(/export const MAX_TARGET = (\d+);/);
        assert.truthy(client && server, 'both caps must exist');
        assert.equal(Number(client[1]), Number(server[1]));
    });

    test('daily-task picker omits disabled accounts and has one clear save action', () => {
        // The sider is the only way to a child's page, and the picker lives
        // on that page — so the sider's filter is what keeps a disabled or
        // admin account from being assigned a task.
        assert.truthy(/function kids\(\)\{ return _users\.filter\(u=>u\.role!=='admin'&&!u\.disabled\); \}/.test(adminHtml),
            'disabled children must not be assignable from the Daily task picker');
        assert.truthy(/host\.innerHTML = kids\(\)\.map/.test(adminHtml), 'the sider lists kids() and nothing else');
        assert.falsy(adminHtml.includes('id="dailyAdd"'), 'the redundant add/reset button must stay removed');
        assert.falsy(adminHtml.includes("getElementById('dailyAdd')"), 'no dead event binding may remain');
    });

    test('daily-task assignment copy is clear and offers every Book unit plus Mix', () => {
        const catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
        // Three Books, 7 practice units and a Mix each: 24 assignable tasks, all of
        // them 'lesson' activities matched on the exact title js/auth.js
        // uploads for a finished unit practice.
        assert.deepEqual(catalog.groups().map(g => g.id), ['word-pr1', 'word-pr2', 'word-pr3']);
        for (const set of ['pr1', 'pr2', 'pr3']) {
            const book = catalog.entries('word-' + set);
            assert.equal(book.length, 8, set + ' should offer 7 units + Mix');
            assert.deepEqual(book.map(e => e.key),
                [...Array(7).keys()].map(i => `word:${set}-${i + 1}`).concat([`word:${set}-mix`]),
                set + ': units in order, Mix last');
            for (const e of book) {
                assert.equal(e.activityType, 'lesson', e.key);
                assert.deepEqual(e.match, { titleExact: 'Unit ' + e.key.slice(5) + ' words practice' }, e.key);
                assert.equal(e.go.screen, 'wordScreen', e.key);
            }
        }
        assert.truthy(catalog.get('word:pr2-7').label.includes('New Media · Appearances · Speeches'),
            'unit titles come from the Book, so a parent can tell Unit 7 of Book 2 from Unit 7 of Book 1');
        assert.deepEqual(catalog.get('word:pr3-mix').go, {
            screen: 'wordScreen', calls: [['switchUnitSet', 'pr3'], ['startUnitPractice', 'pr3-mix']],
        });
        for (const copy of ['Nhiệm vụ hằng ngày', 'Bài học viên sẽ làm',
            'Số lần phải đạt 100% mỗi ngày', 'Giao nhiệm vụ', 'Cây Book 1 / 2 / 3']) {
            assert.truthy(adminHtml.includes(copy), 'admin assignment copy is missing: ' + copy);
        }
    });

    test('the settings page keeps nothing switchable — only the API version', () => {
        // Every app-wide switch (Đấu Toán, Bảng cửu chương's clock) and the
        // Cướp Đêm rulebook went with the features they tuned. A control left
        // behind would POST to an endpoint that no longer exists.
        for (const gone of ['admin/app-flags', 'admin/night-raid-config', 'mathFightFlag', 'ccSeconds',
                            'RAID_FIELDS', 'tabRaid', 'raidPanel', 'bot-toggle', 'chuyen-toggle',
                            'allow_bot', 'allow_chuyen', 'allowBot', 'allowChuyen', 'khiên']) {
            assert.falsy(adminHtml.includes(gone), 'admin.html still carries ' + gone);
        }
        assert.truthy(adminHtml.includes('id="apiVersion"'), 'the settings page shows the API build');
        assert.truthy(/api\('version'\)/.test(adminHtml), 'read from the same endpoint deploy.sh polls');
        assert.truthy(/đã thưởng 200 xu/.test(adminHtml) && !/200 xu \+/.test(adminHtml),
            'the daily reward is 200 xu, no shield');
    });
});

suite('admin: Ant Design Pro layout, organised around the children', () => {
    // A fixed dark sider carries the menu, and the menu is mostly the
    // children: one row each, with today's task progress. Below 900px the
    // sider becomes a strip of chips across the top — picking a child is the
    // most frequent act on this console, so it is never hidden in a drawer.
    const tabletBlock = adminHtml.slice(adminHtml.indexOf('@media (max-width: 900px)'),
        adminHtml.indexOf('@media (max-width: 720px)'));

    test('the sider lists the overview, the children, settings and accounts', () => {
        const sider = adminHtml.match(/<aside class="sider"[\s\S]*?<\/aside>/);
        assert.truthy(sider, 'no <aside class="sider">');
        assert.truthy(sider[0].includes('data-route="overview"'));
        assert.truthy(sider[0].includes('id="siderKids"'), 'the children are rendered into the sider');
        assert.truthy(sider[0].includes('data-route="settings"') && sider[0].includes('data-route="accounts"'));
    });

    test('routes are hashes, so the back button and a reload land where the parent was', () => {
        assert.truthy(/window\.addEventListener\('hashchange', render\)/.test(adminHtml));
        assert.truthy(/function parseRoute\(hash\)/.test(adminHtml));
        assert.truthy(adminHtml.includes("'#/be/' + uid"), 'a child has a URL of its own');
    });

    test('the header names the open page', () => {
        assert.truthy(adminHtml.includes('id="pageTitle"'), 'no title element');
        const fn = adminHtml.slice(adminHtml.indexOf('function render(){'), adminHtml.indexOf('window.addEventListener(\'hashchange\''));
        assert.truthy(/title\.textContent = 'Tổng quan'/.test(fn) && /title\.textContent = 'Cài đặt app'/.test(fn));
    });

    test('on a tablet or phone the sider is a strip across the top, not a drawer', () => {
        assert.truthy(tabletBlock.length > 0, 'no 900px breakpoint');
        assert.truthy(/\.sider \{[^}]*flex-direction:row/.test(tabletBlock), 'the sider lays its items out in a row');
        assert.truthy(/\.sider \{[^}]*overflow-x:auto/.test(tabletBlock), 'and scrolls sideways');
        assert.falsy(adminHtml.includes('id="menuBtn"'), 'no hamburger: the children must stay visible');
        assert.truthy(/\.main \{ margin-left:0; \}/.test(tabletBlock), 'the content takes the full width');
    });

    test('the child page has the three tabs, tasks first', () => {
        const strip = adminHtml.match(/<nav class="tabs" role="tablist" aria-label="Mục của học viên">[\s\S]*?<\/nav>/);
        assert.truthy(strip, 'no child tab strip');
        const tabs = [...strip[0].matchAll(/data-tab="(\w+)"/g)].map(m => m[1]);
        assert.deepEqual(tabs, ['tasks', 'history', 'skills']);
    });

    test('Ant Design 5 tokens, not the old Duolingo-blue ramp', () => {
        assert.truthy(/--primary:#1677ff/.test(adminHtml));
        assert.falsy(/--brand:#1cb0f6/.test(adminHtml), 'the old accent must be gone');
        assert.truthy(/--sider-bg:#001529/.test(adminHtml), 'Ant Pro dark sider');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
