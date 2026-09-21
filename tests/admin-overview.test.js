// admin-overview.test.js — the admin landing page is every child's learning
// history: a who-studied-who-skipped grid and the activities grouped by day.
//
// The grouping is done on the page, from admin/activity, so the functions
// that do it are lifted out of admin.html by name and EXECUTED here. Two
// things are easy to get wrong and would not show in a diff:
//
//   1. A "day" is a day in Vietnam. The server stamps UTC; 23:30 UTC on the
//      13th is 06:30 on the 14th for the child, and must count as the 14th —
//      the same clock the daily tasks and coin snapshots run on.
//   2. Empty days are rows, not gaps. The parent is scanning for the day
//      nobody studied; a list that silently skips it hides the one thing
//      she opened the page to see.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const adminHtml = read('admin.html');

const page = (() => {
    const script = adminHtml.match(/<script>([\s\S]*)<\/script>/)[1];
    const pick = (name) => {
        const start = script.indexOf('function ' + name + '(');
        if (start < 0) throw new Error(name + ' not found in admin.html');
        return script.slice(start, script.indexOf('\n}', start) + 2);
    };
    const consts = script.match(/const VN_OFFSET_MS = [^;]+;/)[0]
        + script.match(/const CHILD_TABS = [^;]+;/)[0]
        + script.match(/const CHILD_SLUG = [^;]+;/)[0];
    const names = ['fold', 'dayKeyOf', 'todayKey', 'shiftDay', 'timeOf', 'dayLabel', 'shortDayLabel',
                   'summarize', 'groupByDay', 'buildGrid', 'cellClass', 'parseRoute', 'childHref',
                   'spanOf', 'taskDay', 'taskCellClass'];
    const sandbox = { String, Number, Math, Date, Set, Map, isNaN };
    vm.createContext(sandbox);
    vm.runInContext(consts + '\n' + names.map(pick).join('\n') + '\n' + names.map(n => `this.${n} = ${n};`).join(''), sandbox);
    return sandbox;
})();

// A row the way admin/activity returns it.
const row = (created_at, user_id, extra) => Object.assign(
    { created_at, user_id, username: 'u' + user_id, kind: 'exam', title: 't', score: 8, total: 10, time_spent_sec: 120 }, extra || {});

suite('admin overview: a day is a Vietnamese day', () => {
    test('a UTC stamp late in the evening belongs to the next day in GMT+7', () => {
        assert.equal(page.dayKeyOf('2026-09-13 16:59:59'), '2026-09-13', '23:59 in Vietnam is still the 13th');
        assert.equal(page.dayKeyOf('2026-09-13 17:00:00'), '2026-09-14', '00:00 in Vietnam is the 14th');
        assert.equal(page.dayKeyOf('2026-09-13T17:00:00'), '2026-09-14', 'both stamp shapes are accepted');
        assert.equal(page.dayKeyOf('garbage'), null);
        assert.equal(page.dayKeyOf(null), null);
    });

    test('the clock shown is the Vietnamese clock', () => {
        assert.equal(page.timeOf('2026-09-13 17:05:00'), '00:05');
        assert.equal(page.timeOf('2026-09-14 09:42:10'), '16:42');
    });

    test('today is computed on the same clock, and day arithmetic crosses months', () => {
        // 2026-09-30 20:00 UTC is already 1 Oct in Vietnam.
        const now = Date.UTC(2026, 8, 30, 20, 0, 0);
        assert.equal(page.todayKey(now), '2026-10-01');
        assert.equal(page.shiftDay('2026-10-01', -1), '2026-09-30');
        assert.equal(page.shiftDay('2026-03-01', -1), '2026-02-28');
        assert.equal(page.shiftDay('2024-03-01', -1), '2024-02-29', 'leap day');
    });

    test('day labels say Hôm nay / Hôm qua and then just the weekday and date', () => {
        assert.equal(page.dayLabel('2026-09-14', '2026-09-14'), 'Hôm nay · T2 14/09');
        assert.equal(page.dayLabel('2026-09-13', '2026-09-14'), 'Hôm qua · CN 13/09');
        assert.equal(page.dayLabel('2026-09-12', '2026-09-14'), 'T7 12/09');
        assert.deepEqual(page.shortDayLabel('2026-09-14'), { wd: 'T2', dm: '14/09' });
    });
});

suite('admin overview: history grouped by day', () => {
    const today = '2026-09-14';
    const rows = [
        row('2026-09-14 09:00:00', 1),                       // today 16:00 VN
        row('2026-09-14 02:00:00', 2, { score: 5, total: 10 }),
        row('2026-09-13 17:30:00', 1),                       // 00:30 VN on the 14th → today
        row('2026-09-12 10:00:00', 1, { kind: 'lesson', score: null, total: null, time_spent_sec: null }),
        row('2026-09-10 10:00:00', 3),
    ];

    test('every day in the range is a row, newest first, empty days included', () => {
        const days = page.groupByDay(rows, 7, today);
        assert.deepEqual(days.map(d => d.key),
            ['2026-09-14', '2026-09-13', '2026-09-12', '2026-09-11', '2026-09-10', '2026-09-09', '2026-09-08']);
        assert.equal(days[1].rows.length, 0, 'the 13th has no rows: the 17:30 UTC one is the 14th in Vietnam');
        assert.equal(days[1].sum.n, 0);
        assert.equal(days[0].rows.length, 3);
        assert.equal(days[0].label, 'Hôm nay · T2 14/09');
    });

    test('a day summary counts children, rows, score across scored rows and exam minutes', () => {
        const days = page.groupByDay(rows, 7, today);
        const t = days[0].sum;
        assert.equal(t.users, 2);
        assert.equal(t.n, 3);
        assert.equal(t.pct, Math.round(21 / 30 * 100), 'a sum over rows, not a mean of percentages');
        assert.equal(t.minutes, 6);
        const lesson = days[2].sum;
        assert.equal(lesson.pct, null, 'an unscored day has no percentage rather than 0%');
        assert.equal(lesson.minutes, 0);
    });

    test('rows outside the range are simply not shown', () => {
        const days = page.groupByDay(rows, 3, today);
        assert.equal(days.length, 3);
        assert.equal(days.reduce((n, d) => n + d.rows.length, 0), 4, 'the 10th falls outside three days');
    });

    test('the summarizer is robust to missing fields', () => {
        const s = page.summarize([{ user_id: 1 }, { user_id: 1, score: 3, total: 0 }]);
        assert.deepEqual(s, { n: 2, users: 1, pct: null, minutes: 0 });
    });
});

suite('admin overview: the who-studied grid', () => {
    const today = '2026-09-14';
    const users = [{ id: 1, username: 'An' }, { id: 2, username: 'Bình' }, { id: 3, username: 'Cúc' }];
    const rows = [
        row('2026-09-14 09:00:00', 1), row('2026-09-14 10:00:00', 1, { score: 2, total: 10 }),
        row('2026-09-13 17:30:00', 2),                      // the 14th in Vietnam
        row('2026-09-12 10:00:00', 2, { score: null, total: null }),
        row('2026-09-01 10:00:00', 1),                      // outside 7 days
    ];

    test('columns are the last N days oldest → newest, rows are the children busiest first', () => {
        const g = page.buildGrid(rows, users, 7, today);
        assert.deepEqual(g.keys, ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
        assert.deepEqual(g.rows.map(r => r.user.username), ['An', 'Bình', 'Cúc'], 'An 2, Bình 2 → alphabetical, Cúc 0 last');
        assert.deepEqual(g.rows.map(r => r.n), [2, 2, 0]);
    });

    test('a cell is the count and the summed score of that child that day', () => {
        const g = page.buildGrid(rows, users, 7, today);
        const an = g.rows.find(r => r.user.username === 'An');
        assert.deepEqual(an.cells['2026-09-14'], { n: 2, score: 10, total: 20 });
        assert.equal(an.cells['2026-09-01'], undefined, 'outside the range: not counted');
        const binh = g.rows.find(r => r.user.username === 'Bình');
        assert.equal(binh.cells['2026-09-14'].n, 1, 'the late UTC row lands on the 14th');
        assert.equal(binh.cells['2026-09-13'], undefined);
        assert.deepEqual(binh.cells['2026-09-12'], { n: 1, score: 0, total: 0 });
    });

    test('cell colour follows the score; unscored and empty cells are told apart', () => {
        assert.equal(page.cellClass(undefined), 'zero');
        assert.equal(page.cellClass({ n: 0 }), 'zero');
        assert.equal(page.cellClass({ n: 1, score: 0, total: 0 }), 'none');
        assert.equal(page.cellClass({ n: 2, score: 15, total: 20 }), 'good');
        assert.equal(page.cellClass({ n: 2, score: 12, total: 20 }), 'mid');
        assert.equal(page.cellClass({ n: 2, score: 9, total: 20 }), 'low');
    });

    test('a child with no rows is still a row in the grid', () => {
        const g = page.buildGrid([], users, 7, today);
        assert.equal(g.rows.length, 3);
        assert.deepEqual(g.rows.map(r => r.n), [0, 0, 0]);
    });
});

suite('admin overview: the grid is about daily tasks, and the history shows how long each took', () => {
    const hist = [
        { date: '2026-09-12', tasks: [{ done: true }, { done: true }], allDone: true, rewarded: true },
        { date: '2026-09-13', tasks: [{ done: true }, { done: false }, { done: false }], allDone: false, rewarded: false },
        { date: '2026-09-14', tasks: [{ done: false }], allDone: false, rewarded: false },
        { date: '2026-09-11', tasks: [], allDone: false, rewarded: false },
    ];

    test('a day\'s cell is done/total of the tasks in force that day, or nothing when none were', () => {
        assert.deepEqual(page.taskDay(hist, '2026-09-12'), { done: 2, total: 2, allDone: true, rewarded: true });
        assert.deepEqual(page.taskDay(hist, '2026-09-13'), { done: 1, total: 3, allDone: false, rewarded: false });
        assert.equal(page.taskDay(hist, '2026-09-11'), null, 'no task that day is not "0 done"');
        assert.equal(page.taskDay(hist, '2026-09-10'), null);
        assert.equal(page.taskDay(undefined, '2026-09-12'), null, 'before the tasks have loaded');
    });

    test('cell colour: green all done, amber some, red none, grey no task', () => {
        assert.equal(page.taskCellClass(page.taskDay(hist, '2026-09-12')), 'good');
        assert.equal(page.taskCellClass(page.taskDay(hist, '2026-09-13')), 'mid');
        assert.equal(page.taskCellClass(page.taskDay(hist, '2026-09-14')), 'low');
        assert.equal(page.taskCellClass(null), 'zero');
    });

    test('the page asks for 31 days of task history per child and draws the cells from it', () => {
        assert.truthy(adminHtml.includes("'&days=31'"), 'the grid needs every day in the 30-day range');
        assert.truthy(/taskDay\(hist, k\)/.test(adminHtml), 'cells come from the task history');
        assert.falsy(adminHtml.includes('grid-legend'), 'no legend: the cells say ✓ / 1/3 / 0/2 themselves');
    });

    test('"bắt đầu → xong · phút" from the end stamp and the seconds it took', () => {
        assert.equal(page.spanOf('2026-09-14 09:32:00', 720), '16:20 → 16:32 · 12 phút');
        assert.equal(page.spanOf('2026-09-14 09:32:00', 20), '16:31 → 16:32 · < 1 phút');
        assert.equal(page.spanOf('2026-09-13 17:05:00', 600), '23:55 → 00:05 · 10 phút', 'a span across midnight');
        assert.equal(page.spanOf('2026-09-14 09:32:00', null), '', 'rows from before the clock have no span');
        assert.equal(page.spanOf('2026-09-14 09:32:00', -5), '');
        assert.equal(page.spanOf('garbage', 60), '');
    });

    test('the grid shows two children, then a button for the rest', () => {
        assert.truthy(/const GRID_ROWS_SHOWN = 2;/.test(adminHtml));
        assert.truthy(/!_gridAll && idx >= GRID_ROWS_SHOWN \? ' class="more" hidden' : ''/.test(adminHtml), 'rows past the second start hidden');
        assert.truthy(/Xem thêm \$\{hiddenKids\} học viên/.test(adminHtml), 'the button says how many learners are folded');
        assert.truthy(/_gridAll = true; renderGrid\(\);/.test(adminHtml) && /_gridAll = false; renderGrid\(\);/.test(adminHtml), 'and it folds back');
        const fn = adminHtml.slice(adminHtml.indexOf('function buildGrid('), adminHtml.indexOf('function cellClass('));
        assert.truthy(/sort\(\(a, b\) => b\.n - a\.n/.test(fn), 'the two shown are the busiest, so the fold hides the quiet ones');
    });

    test('five rows a day, then a button for the rest', () => {
        assert.truthy(/const HIST_ROWS_SHOWN = 5;/.test(adminHtml));
        assert.truthy(/j >= HIST_ROWS_SHOWN \? ' class="more" hidden' : ''/.test(adminHtml), 'rows past the fifth start hidden');
        assert.truthy(/Xem thêm \$\{hidden\} lượt/.test(adminHtml), 'the button says how many are folded');
        assert.truthy(/day\.querySelectorAll\('tr\.more'\)\.forEach\(tr => \{ tr\.hidden = false; \}\)/.test(adminHtml),
            'and reveals only that day');
    });

    test('the history column is the span for every kind, not the exam timer only', () => {
        assert.truthy(adminHtml.includes('spanOf(a.created_at, a.time_spent_sec)'));
        assert.falsy(/a\.kind==='exam' \? fmtTime/.test(adminHtml), 'the exam-only branch must be gone');
        assert.truthy(adminHtml.includes('<th>Bắt đầu → xong</th>'));
    });
});

suite('admin overview: routes', () => {
    test('every page has a hash, and unknown hashes fall back to the overview', () => {
        assert.deepEqual(page.parseRoute(''), { view: 'overview', uid: null, tab: null });
        assert.deepEqual(page.parseRoute('#/'), { view: 'overview', uid: null, tab: null });
        assert.deepEqual(page.parseRoute('#/be/12'), { view: 'child', uid: '12', tab: 'tasks' });
        assert.deepEqual(page.parseRoute('#/be/12/lich-su'), { view: 'child', uid: '12', tab: 'history' });
        assert.deepEqual(page.parseRoute('#/be/12/nang-luc'), { view: 'child', uid: '12', tab: 'skills' });
        assert.deepEqual(page.parseRoute('#/be/abc'), { view: 'overview', uid: null, tab: null }, 'a non-numeric id is not a child');
        assert.deepEqual(page.parseRoute('#/cai-dat'), { view: 'settings', uid: null, tab: 'flags' });
        assert.deepEqual(page.parseRoute('#/cai-dat/cuop-dem'), { view: 'settings', uid: null, tab: 'raid' });
        assert.deepEqual(page.parseRoute('#/tai-khoan'), { view: 'accounts', uid: null, tab: null });
        assert.deepEqual(page.parseRoute('#/nonsense'), { view: 'overview', uid: null, tab: null });
    });

    test('a child link round-trips through the parser', () => {
        for (const tab of ['tasks', 'history', 'skills']) {
            assert.deepEqual(page.parseRoute(page.childHref(7, tab)), { view: 'child', uid: '7', tab });
        }
    });
});

suite('admin overview: the page is wired to the data it needs', () => {
    test('the overview loads every child\'s tasks so the grid can show today\'s progress', () => {
        assert.truthy(/async function loadAllTasks\(\)/.test(adminHtml));
        assert.truthy(/Promise\.all\(kids\(\)\.map/.test(adminHtml), 'one call per child, in parallel');
        assert.truthy(adminHtml.includes('Nhiệm vụ hôm nay'), 'the grid has a task column');
    });

    test('a child\'s history is fetched for that child alone, not sliced from the shared 1000 rows', () => {
        assert.truthy(/api\('admin\/activity\?user_id=' \+ encodeURIComponent\(uid\)\)/.test(adminHtml));
    });

    test('the task list lets the number of times be changed in place', () => {
        // The API has no edit, so a new target is delete + create, and a
        // create that fails after the delete must be reported, never swallowed.
        const fn = adminHtml.slice(adminHtml.indexOf("box.querySelector('.save-target').onclick"), adminHtml.indexOf('// The picker.'));
        assert.truthy(/method:'DELETE'/.test(fn) && /method:'POST'/.test(fn));
        assert.truthy(/Không đổi được số lần/.test(fn), 'a half-done edit is said out loud');
    });

    test('assigning reports duplicates and the cap in the page, not in an alert', () => {
        const fn = adminHtml.slice(adminHtml.indexOf('async function assignTask('), adminHtml.indexOf('// ── Lịch sử của một bé'));
        assert.truthy(/e\.code === 'duplicate'/.test(fn) && /e\.code === 'too_many'/.test(fn));
        assert.falsy(/alert\(/.test(fn), 'the note under the picker is where the answer goes');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
