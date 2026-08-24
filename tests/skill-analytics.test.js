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

  test('ingest is bounded and validates the supported menu taxonomy', () => {
    assert.truthy(ingest.includes('const MAX_BATCH = 400'));
    for (const menu of ['math7', 'mathwars', 'grade4', 'wordform', 'grammar', 'phrases', 'verbs', 'rewrite', 'collocation']) {
      assert.truthy(ingest.includes("'" + menu + "'"), 'missing menu ' + menu);
    }
    assert.truthy(ingest.includes('slice(0, 20)'), 'wrong references must stay bounded');
    assert.truthy(ingest.includes('INSERT OR IGNORE'), 'replays must be idempotent');
  });
});

suite('skill analytics: background producers', () => {
  test('all four requested menus attach hidden skill summaries', () => {
    const files = {
      math7: read('js/math.js'),
      mathwars: read('js/mathwars.js'),
      grade4: read('js/units.js'),
      wordform: read('js/wordform.js'),
    };
    Object.entries(files).forEach(([menu, source]) => {
      assert.truthy(source.includes('skills:'), menu + ' does not save skill results');
      assert.falsy(source.includes('skillAnalytics'), menu + ' accidentally gained admin UI');
    });
    assert.truthy(files.mathwars.includes("':': 'divide'"), 'division must be independently measurable');
    assert.truthy(files.mathwars.includes("'+': 'add'"), 'addition must be independently measurable');
    assert.truthy(files.wordform.includes("neg: 'negative.prefix'"));
  });

  test('all English practice menus record detailed skill summaries', () => {
    const files = {
      grammar: read('js/grammar-units.js'), phrases: read('js/phrases.js'),
      verbs: read('js/verbs.js'), rewrite: read('js/rewrite.js'), collocation: read('js/collocation.js'),
    };
    Object.entries(files).forEach(([menu, source]) => {
      assert.truthy(source.includes('SkillSummaries'), menu + ' needs a skill taxonomy helper');
      assert.truthy(source.includes('skills:'), menu + ' does not attach results to history');
    });
    assert.truthy(files.verbs.includes("skillKey:'verbs.v2"), 'V2 must be independently measurable');
    assert.truthy(files.verbs.includes("skillKey:'verbs.v3"), 'V3 must be independently measurable');
    assert.truthy(files.collocation.includes('collocation.understanding.meaning'));
    assert.truthy(files.collocation.includes('collocation.understanding.reason'));
  });

  test('sync has its own retry ledger and does not post after every answer', () => {
    assert.truthy(auth.includes('function _localSkillItems()'));
    assert.truthy(auth.includes("api('skills'"));
    assert.truthy(auth.includes('syncedSkillKeys'));
    assert.truthy(auth.includes('skillSyncEpoch'));
    assert.truthy(auth.includes("(appState.mathHistory || []).forEach"));
    assert.truthy(auth.includes("(appState.warsHistory || []).forEach"));
    assert.truthy(auth.includes("(appState.unitsHistory || []).forEach"));
    assert.truthy(auth.includes("(appState.wordformHistory || []).forEach"));
    for (const menu of ['grammar', 'phrases', 'verbs', 'rewrite', 'collocation']) {
      assert.truthy(auth.includes("addSession('" + menu + "'"), 'sync missing ' + menu);
    }
    assert.truthy(auth.includes('const SKILL_SYNC_EPOCH = 2'));
  });
});

suite('skill analytics: admin-only dashboard', () => {
  test('admin can filter a selected user by menu and time range', () => {
    assert.truthy(admin.includes('id="skillMenu"'));
    assert.truthy(admin.includes('id="skillUser"'));
    assert.truthy(admin.includes('id="skillDays"'));
    assert.truthy(admin.includes('<option value="1">1 ngày</option>'));
    assert.truthy(report.includes("['1', '7', '30', '90', '365', 'all']"));
    assert.truthy(admin.includes('admin/skills?days='));
    assert.truthy(admin.includes('selectSkillUser(uid, name)'));
  });

  test('competency analytics is a responsive admin tab with every menu', () => {
    assert.truthy(admin.includes('role="tablist"'));
    assert.truthy(admin.includes('id="skillsPanel"'));
    assert.truthy(admin.includes("switchAdminTab('skills')"));
    assert.truthy(admin.includes('@media (max-width: 640px)'));
    assert.truthy(admin.includes('min-height:44px'));
    for (const menu of ['grammar', 'phrases', 'verbs', 'rewrite', 'collocation']) {
      assert.truthy(admin.includes('value="' + menu + '"'), 'admin filter missing ' + menu);
    }
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
