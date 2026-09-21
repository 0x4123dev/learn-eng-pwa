// Daily-task catalog — every kind of task an admin can assign, and for each:
//   match        how to recognise one finished session in the `activities`
//                table (type + title or detail_json field) — see
//                _localHistoryItems() in js/auth.js for what gets uploaded
//   go           where the "Vào học" button sends the child:
//                switchScreen(screen) then each [fnName, ...args] in order
// Shared by admin.html (dropdowns), js/daily-task.js (deep links) and
// functions/api/_daily-task.js (SQL match rules), so the same key means the
// same thing everywhere. UMD like js/night-raid-rules.js.
var DailyTaskCatalog = (function () {
  // Recursively freezes a plain object/array tree so callers can never
  // mutate catalog data through a returned reference.
  function freezeDeep(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.keys(value).forEach(k => freezeDeep(value[k]));
    }
    return value;
  }

  const GROUPS = [
    { id: 'word-pr1', label: 'Book 1 · Public Relations 1' },
    { id: 'word-pr2', label: 'Book 2 · Public Relations 2' },
    { id: 'word-pr3', label: 'Book 3 · Public Relations 3' },
  ].map(freezeDeep);

  // The three Books: id → { group, name, unit numbers, per-unit titles }.
  const SETS = [
    // Titles mirror js/word-data.js UNIT_PR_TITLES (the bank itself is lazy
    // and this catalog is built at startup, so they are repeated here);
    // tests/daily-task-catalog.test.js keeps them in step. Seven practice
    // units per book: the book's 15 merged 1-2, 3-4, …, 13-15.
    { set: 'pr1', group: 'word-pr1', name: 'Book 1', screen: 'wordScreen', units: [1, 2, 3, 4, 5, 6, 7], titles: {
      1: 'The Role of Public Relations · Departments',
      2: 'Services · Marketing and PR',
      3: 'Spreading Information · Communication',
      4: 'Persuasion · Attracting Clients',
      5: 'Conducting Research · Types of Research',
      6: 'Conducting a Survey · Evaluating Results 1',
      7: 'Evaluating Results 2 · The Budget · Describing Change' } },
    { set: 'pr2', group: 'word-pr2', name: 'Book 2', screen: 'wordScreen', units: [1, 2, 3, 4, 5, 6, 7], titles: {
      1: 'Skills of a Public Relations Professional · Strategic Planning',
      2: 'Tactics · Corporations',
      3: 'Politics and Government · Education',
      4: 'Entertainment and Sports · Nonprofit',
      5: 'Global Public Relations · Releases 1',
      6: 'Releases 2 · Traditional Media',
      7: 'New Media · Appearances · Speeches' } },
    { set: 'pr3', group: 'word-pr3', name: 'Book 3', screen: 'wordScreen', units: [1, 2, 3, 4, 5, 6, 7], titles: {
      1: 'Influencing Public Opinion · Reaching a Diverse Audience',
      2: 'Issues Management · Reputation Management',
      3: 'Conflict Management · Crisis Management',
      4: 'Legal Matters 1 · Legal Matters 2',
      5: 'Legal Matters 3 · Ethics 1',
      6: 'Ethics 2 · Challenges in Public Relations',
      7: 'PR in the Digital Age · Education · Careers' } },
  ];

  function entry(key, group, label, activityType, match, screen, calls, size, baseKey, lazyGroup) {
    const e = { key, group, label, activityType, match, go: { screen, calls } };
    // A destination behind a lazy sub-group of its screen (js/lazy-data.js
    // GROUP_FILES): js/daily-task.js ensures it before running the calls.
    if (lazyGroup) e.go.group = lazyGroup;
    // size = how many questions the child was asked for. The count already in
    // the activity title is the SCREEN count and cannot stand in for it: a
    // 10-question Phrases practice records 20, and Word form records 30, 31 or
    // 32 for the same button. js/auth.js uploads the real figure as detail.qs.
    if (size != null) { e.size = size; e.baseKey = baseKey || key; }
    return freezeDeep(e);
  }

  const ENTRIES = [];
  // One task per unit card and one per Mix — the title IS the identity
  // ('Unit pr2-7 words practice', what js/auth.js uploads).
  for (const s of SETS) {
    const prefix = s.set + '-';
    const screen = s.screen;
    const kind = 'word';
    for (const u of s.units) {
      const unitKey = prefix + u;
      const title = s.titles[u] ? ' · ' + s.titles[u] : '';
      ENTRIES.push(entry(kind + ':' + unitKey, s.group, s.name + ' · Unit ' + u + title, 'lesson',
        { titleExact: 'Unit ' + unitKey + ' words practice' }, screen,
        [['switchUnitSet', s.set], ['startUnitPractice', unitKey]]));
    }
    const mixKey = prefix + 'mix';
    const mixTitle = 'Unit ' + mixKey + ' words practice';
    ENTRIES.push(entry(kind + ':' + mixKey, s.group, s.name + ' · 🎲 Mix', 'lesson',
      { titleExact: mixTitle }, screen,
      [['switchUnitSet', s.set], ['startUnitPractice', mixKey]]));
  }

  // ---- the menu path of every task ------------------------------------------
  // The admin picks a task the way the learner finds it: the Book, then the
  // unit. `path` is that trail of labels, and tree() below turns the flat list
  // into the cascade the admin page draws.
  function pathFor(e) {
    switch (e.group) {
      case 'word-pr1': case 'word-pr2': case 'word-pr3':
        return ['Book ' + e.group.slice(-1)];
      default: return [];
    }
  }
  // Entries are frozen deep; the path is attached before the freeze below
  // by rebuilding each entry with it.
  for (let i = 0; i < ENTRIES.length; i++) {
    ENTRIES[i] = freezeDeep(Object.assign({}, ENTRIES[i], { path: pathFor(ENTRIES[i]) }));
  }

  const BY_KEY = new Map(ENTRIES.map(e => [e.key, e]));

  function groups() { return GROUPS.slice(); }
  function entries(groupId) { return ENTRIES.filter(e => e.group === groupId); }
  function all() { return ENTRIES.slice(); }
  function get(key) { return (typeof key === 'string' && BY_KEY.get(key)) || null; }

  // The cascade: { label, children: [node…], entries: [entry…] }, root label
  // ''. Children keep first-seen order, which is the order the entries were
  // pushed — the same order the app's menus use. A node may hold both
  // sub-menus and tasks (PTNK Exams: "bất kỳ" beside the years).
  function tree() {
    const root = { label: '', children: [], entries: [] };
    for (const e of ENTRIES) {
      let node = root;
      for (const label of e.path) {
        let next = node.children.find(c => c.label === label);
        if (!next) { next = { label, children: [], entries: [] }; node.children.push(next); }
        node = next;
      }
      node.entries.push(e);
    }
    // Top menus in the order the bottom bar shows them. Deeper levels keep
    // push order.
    const ORDER = {
      '': ['Book 1', 'Book 2', 'Book 3'],
    };
    const sortBy = (node) => {
      const order = ORDER[node.label];
      if (order) node.children.sort((a, b) => {
        const ia = order.indexOf(a.label), ib = order.indexOf(b.label);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      node.children.forEach(sortBy);
    };
    sortBy(root);
    return root;
  }

  return Object.freeze({ groups, entries, all, get, tree });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyTaskCatalog;
