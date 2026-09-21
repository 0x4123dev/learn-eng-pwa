// Skill analytics is background-only for learners and visible only in admin.
// These tests pin the cross-file contract: producers → sync → D1 → admin.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const schema = read('db/schema.sql');
const migration = read('db/008-learning-skills.sql');
const ingest = read('functions/api/skills.js');
const report = read('functions/api/admin/skills.js');
const auth = read('js/auth.js');
const admin = read('admin.html');

suite('skill analytics: storage and access', () => {
  test('fresh installs and existing installs define the same table', () => {
    for (const sql of [schema, migration]) {
      assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS learning_skill_results'));
      assert.truthy(sql.includes('UNIQUE(user_id, client_session_id, skill_key)'),
        'offline re-sync must not duplicate a completed session');
      assert.truthy(sql.includes('idx_skill_results_user_menu_date'),
        'admin user/menu/date drill-down needs an index');
    }
  });

  test('only an authenticated learner can upload and only admin can report', () => {
    assert.truthy(ingest.includes('requireAuth(request, env)'));
    assert.truthy(report.includes('requireAuth(request, env)'));
    assert.truthy(report.includes("auth.role !== 'admin'"));
    assert.truthy(report.includes("return err('Forbidden', 403)"));
  });

  test('ingest is bounded and validates the one menu left', () => {
    // The Book units are the only practice since the 2026-09 cut. js/auth.js
    // has always filed them under 'grade4' and the stored rows carry that
    // name, so the whitelist keeps it and nothing else — a row for a cut
    // menu is dropped, not stored under a taxonomy nobody reads.
    assert.truthy(ingest.includes('const MAX_BATCH = 400'));
    const menus = (src) => [...(/const MENUS = \[([^\]]*)\]/.exec(src) || ['', ''])[1].matchAll(/'([a-z0-9]+)'/g)].map(m => m[1]);
    assert.deepEqual(menus(ingest), ['grade4']);
    assert.deepEqual(menus(report), ['grade4'], 'the admin report filters on the same list');
    assert.truthy(ingest.includes('slice(0, 20)'), 'wrong references must stay bounded');
    assert.truthy(ingest.includes('INSERT OR IGNORE'), 'replays must be idempotent');
  });
});

suite('skill analytics: background producers', () => {
  test('the Book units attach hidden skill summaries to their history', () => {
    const units = read('js/units.js');
    assert.truthy(units.includes('skills:'), 'units.js does not save skill results');
    assert.falsy(units.includes('skillAnalytics'), 'units.js accidentally gained admin UI');
  });

  test('sync has its own retry ledger and does not post after every answer', () => {
    assert.truthy(auth.includes('function _localSkillItems()'));
    assert.truthy(auth.includes("api('skills'"));
    assert.truthy(auth.includes('syncedSkillKeys'));
    assert.truthy(auth.includes('skillSyncEpoch'));
    assert.truthy(auth.includes("(appState.unitsHistory || []).forEach"));
    assert.truthy(auth.includes("addSession('grade4'"), 'the Book units must file under the menu the server accepts');
    // Every menu the client files under must be one the server keeps —
    // otherwise clean() drops the row and the client marks it synced anyway.
    const filed = [...new Set([...auth.matchAll(/addSession\('([a-z0-9]+)'/g)].map(m => m[1]))];
    assert.deepEqual(filed, ['grade4']);
    assert.truthy(auth.includes('const SKILL_SYNC_EPOCH = 2'));
  });
});

suite('skill analytics: admin-only dashboard', () => {
  test('admin can filter a selected user by menu and time range', () => {
    assert.truthy(admin.includes('id="skillMenu"'));
    assert.truthy(admin.includes('id="skillDays"'));
    assert.truthy(admin.includes('<option value="1">1 ngày</option>'));
    assert.truthy(report.includes("['1', '7', '30', '90', '365', 'all']"));
    assert.truthy(admin.includes('admin/skills?days='));
    assert.truthy(admin.includes('selectSkillUser(uid, name)'));
  });

  test('competency analytics is a responsive admin tab whose menu filter matches the server', () => {
    assert.truthy(admin.includes('role="tablist"'));
    assert.truthy(admin.includes('id="skillsPanel"'));
    assert.truthy(admin.includes('data-tab="skills"'), 'the child page has a Năng lực tab');
    assert.truthy(/if \(tab === 'skills'\) loadSkills\(_skillUser, _skillName\)/.test(admin), 'opening the tab loads the open child');
    assert.truthy(admin.includes('@media (max-width: 640px)'));
    assert.truthy(admin.includes('min-height:44px'));
    // The filter offers exactly the menus admin/skills accepts: an option for
    // a cut menu would be a filter that always comes back empty.
    const sel = /<select id="skillMenu">([\s\S]*?)<\/select>/.exec(admin);
    assert.truthy(sel, 'no menu filter');
    const offered = [...sel[1].matchAll(/value="([a-z0-9]+)"/g)].map(m => m[1]);
    assert.deepEqual(offered, ['grade4']);
    assert.truthy(/SKILL_MENU_LABEL = \{ grade4:/.test(admin), 'and the menu has a readable label');
    assert.truthy(admin.includes('Ưu tiên giao bài'));
  });

  test('weak/strong labels require evidence and are not color-only', () => {
    assert.truthy(admin.includes('row.attempts < 5'));
    assert.truthy(admin.includes("label:'Cần luyện ngay'"));
    assert.truthy(admin.includes("label:'Mạnh'"));
    assert.truthy(admin.includes('role="progressbar"'));
    assert.truthy(admin.includes('aria-valuenow'));
  });

  test('the learner-facing document is untouched by analytics UI', () => {
    const index = read('index.html');
    assert.falsy(index.includes('skillAnalytics'));
    assert.falsy(index.includes('learning_skill_results'));
    assert.truthy(admin.includes('id="skillAnalytics"'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
