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
    { id: 'practice', label: 'Luyện tập tiếng Anh' },
    { id: 'grammar', label: 'Grammar (theo unit)' },
    { id: 'units-pre', label: 'Units Pre (từ điển tranh)' },
    { id: 'units-hk1', label: 'Units HK1 (Global Success Tập 1)' },
    { id: 'units-hk2', label: 'Units HK2 (Global Success Tập 2)' },
    { id: 'units-posthk', label: 'Units Post (Maths 4 & Science 4)' },
    { id: 'math-exam', label: 'Toán 7 · Đề thi' },
    { id: 'math-chapter', label: 'Toán 7 · Luyện chương' },
    { id: 'math-wars', label: 'Toán 7 · Math Wars' },
  ].map(freezeDeep);

  const GRAMMAR_NAMES = [
    ['unit1', 'Unit 1: People'], ['unit2', 'Unit 2: Possessions'], ['unit3', 'Unit 3: Places'],
    ['unit4', 'Unit 4: Free time'], ['unit5', 'Unit 5: Food'], ['unit6', 'Unit 6: Past lives'],
    ['unit7', 'Unit 7: Journeys'], ['unit8', 'Unit 8: Appearance'], ['unit9', 'Unit 9: Entertainment'],
    ['unit10', 'Unit 10: Learning'], ['unit11', 'Unit 11: Tourism'], ['unit12', 'Unit 12: Tenses'],
    ['unit13', 'Unit 13: Exam'],
  ];
  // Unit sets: id → { group, set label, unit numbers, per-unit titles }.
  const SETS = [
    { set: 'pre', group: 'units-pre', name: 'Pre', units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], titles: {} },
    { set: 'hk1', group: 'units-hk1', name: 'HK1', units: [1, 2, 3, 4, 5], titles: {
      1: 'My friends · Time and daily routines', 2: 'My week · My birthday party',
      3: 'Things we can do · Our school facilities', 4: 'Our timetables · My favourite subjects',
      5: 'Our sports day · Our summer holidays' } },
    { set: 'hk2', group: 'units-hk2', name: 'HK2', units: [1, 2, 3, 4, 5], titles: {
      1: 'My home · Jobs', 2: 'Appearance · Daily activities', 3: "My family's weekends · Weather",
      4: 'In the city · At the shopping centre', 5: 'The animal world · At summer camp' } },
    { set: 'posthk', group: 'units-posthk', name: 'Post', units: [1, 2, 3, 4, 5], titles: {
      1: 'Maths · Numbers, money and the four operations', 2: 'Maths · Fractions, shapes and measuring',
      3: 'Science · Matter, energy, light and sound', 4: 'Science · Living things and food chains',
      5: 'Science · Food, health and everyday science' } },
  ];
  const CHAPTER_TITLES = [
    [1, 'Số hữu tỉ'], [2, 'Số thực'], [3, 'Góc và đường thẳng song song'],
    [4, 'Tam giác bằng nhau'], [5, 'Thu thập và biểu diễn dữ liệu'],
  ];
  const EXAM_TITLES = [
    ['hk1-exam1', 'HK1 Exam 1'], ['hk1-exam2', 'HK1 Exam 2'], ['hk1-exam3', 'HK1 Exam 3'],
    ['hk1-exam4', 'HK1 Exam 4'], ['hk1-exam5', 'HK1 Exam 5'], ['hk1-exam6', 'HK1 Exam 6'],
    ['hk1-exam7', 'HK1 Exam 7'], ['hk1-exam8', 'HK1 Exam 8'], ['hk1-exam9', 'HK1 Exam 9'],
    ['hk1-exam10', 'HK1 Exam 10'],
    ['hk1-source-1', 'HK1 1 (THCS Trần Quý Cáp)'], ['hk1-source-2', 'HK1 2 (THCS Phạm Hữu Lầu)'],
    ['hk1-source-3', 'HK1 3 (THCS An Điền)'], ['hk1-source-4', 'HK1 4 (THCS Tương Bình Hiệp)'],
    ['hk1-source-5', 'HK1 5 (THCS Lý Thánh Tông)'],
  ];

  function entry(key, group, label, activityType, match, screen, calls, size, baseKey) {
    const e = { key, group, label, activityType, match, go: { screen, calls } };
    // size = how many questions the child was asked for. The count already in
    // the activity title is the SCREEN count and cannot stand in for it: a
    // 10-question Phrases practice records 20, and Word form records 30, 31 or
    // 32 for the same button. js/auth.js uploads the real figure as detail.qs.
    if (size != null) { e.size = size; e.baseKey = baseKey || key; }
    return freezeDeep(e);
  }

  // Practice tabs that really offer more than one length. Rewrite has only a
  // 10-question button, Verbs picks a level rather than a length, and the
  // Units and Toán 7 tabs are fixed — so none of those take a size.
  const SIZES = { phrases: [10, 20], collocation: [10, 20], wordform: [10, 20] };
  const GRAMMAR_SIZES = [10, 25];
  function withSize(match, n) {
    return Object.assign({}, match, { detail: { field: 'qs', value: n } });
  }

  const ENTRIES = [];
  // Practice tabs — one session each, any length. Titles come from js/auth.js.
  // One task per BUTTON the child can press, because that is what an admin
  // means when they set the day's work. The size-agnostic entry stays first:
  // tasks assigned before lengths existed still resolve through it.
  const PRACTICE_SIZED = [
    ['phrases', 'Phrases practice', 'Phrases', 'phrases', 'phrasesScreen',
      n => [['switchPhrSubTab', 'practice'], ['startPhrasesQuiz', n]]],
    ['collocation', 'Collocation practice', 'Collocation', 'collocation', 'phrasesScreen',
      n => [['switchPhrSubTab', 'colloc'], ['startCollocPractice', n]]],
    ['wordform', 'Word form practice', 'Word form', 'wordform', 'wordformScreen',
      n => [['startWordformQuiz', n]]],
  ];
  for (const [key, titlePrefix, short, type, screen, calls] of PRACTICE_SIZED) {
    const sizes = SIZES[key];
    const big = sizes[sizes.length - 1];
    ENTRIES.push(entry(key, 'practice', titlePrefix + ' (bất kỳ độ dài)', type,
      { titlePrefix }, screen, calls(big)));
    for (const n of sizes) {
      ENTRIES.push(entry(key + ':' + n, 'practice', short + ' ' + n + ' câu', type,
        withSize({ titlePrefix }, n), screen, calls(n), n, key));
    }
  }
  ENTRIES.push(entry('rewrite', 'practice', 'Rewrite practice', 'rewrite',
    { titlePrefix: 'Rewrite practice' }, 'rewriteScreen', [['startRewriteQuiz', 10]]));
  ENTRIES.push(entry('verbs', 'practice', 'Verbs challenge', 'verbs',
    { titlePrefix: 'Verbs challenge' }, 'speedChallengeScreen', [['startSpeedChallenge', 0]]));
  ENTRIES.push(entry('vocab', 'practice', 'Vocabulary lesson (từ vựng hôm nay · ≥90% là đạt)', 'lesson',
    { titlePrefix: 'Vocabulary lesson' }, 'homeScreen', [['goLearnToday']]));
  // Grammar — detail_json carries unitId.
  for (const [id, name] of GRAMMAR_NAMES) {
    ENTRIES.push(entry('grammar:' + id, 'grammar', 'Grammar · ' + name + ' (bất kỳ độ dài)', 'grammar',
      { detail: { field: 'unitId', value: id } }, 'grammarScreen', [['startGrammarQuiz', id, 25]]));
    for (const n of GRAMMAR_SIZES) {
      // A match rule carries one detail clause, so the unit and the length
      // travel together in a single field that js/auth.js writes as one.
      ENTRIES.push(entry('grammar:' + id + ':' + n, 'grammar', 'Grammar · ' + name + ' · ' + n + ' câu', 'grammar',
        { detail: { field: 'unitQs', value: id + ':' + n } }, 'grammarScreen',
        [['startGrammarQuiz', id, n]], n, 'grammar:' + id));
    }
  }
  // Units words practice — the title IS the identity ('Unit hk1-3 words practice').
  for (const s of SETS) {
    const prefix = s.set === 'pre' ? '' : s.set + '-';
    for (const u of s.units) {
      const unitKey = s.set === 'pre' ? u : prefix + u;
      const title = s.titles[u] ? ' · ' + s.titles[u] : '';
      ENTRIES.push(entry('units:' + unitKey, s.group, 'Units ' + s.name + ' · Unit ' + u + title, 'lesson',
        { titleExact: 'Unit ' + unitKey + ' words practice' }, 'topicsScreen',
        [['switchTopicsSubTab', 'grade4'], ['switchUnitSet', s.set], ['startUnitPractice', unitKey]]));
    }
    const mixKey = s.set === 'pre' ? 'mix' : prefix + 'mix';
    const mixTitle = s.set === 'pre' ? 'Mix 12 units words practice' : 'Unit ' + mixKey + ' words practice';
    ENTRIES.push(entry('units:' + mixKey, s.group, 'Units ' + s.name + ' · 🎲 Mix', 'lesson',
      { titleExact: mixTitle }, 'topicsScreen',
      [['switchTopicsSubTab', 'grade4'], ['switchUnitSet', s.set], ['startUnitPractice', mixKey]]));
  }
  // Toán 7 — detail_json carries examId (mock exams) or chapter (drills).
  ENTRIES.push(entry('math-exam:any-hk1', 'math-exam', 'Toán 7 · Đề thi HK1 bất kỳ', 'math',
    { detail: { field: 'examId', prefix: 'hk1-' } }, 'mathHubScreen', [['openMathSection', 'hk1'], ['switchMathSubTab', 'exams']]));
  for (const [id, title] of EXAM_TITLES) {
    ENTRIES.push(entry('math-exam:' + id, 'math-exam', 'Toán 7 · Đề thi ' + title, 'math',
      { detail: { field: 'examId', value: id } }, 'mathHubScreen', [['startMathExam', id]]));
  }
  for (const [num, title] of CHAPTER_TITLES) {
    ENTRIES.push(entry('math-chapter:' + num, 'math-chapter', 'Toán 7 · Chương ' + num + ' · ' + title, 'math',
      { detail: { field: 'chapter', value: num }, noField: 'examId' }, 'mathHubScreen', [['startMathQuiz', num]]));
  }
  // Math Wars rides the 'math' activity type too, but its title is its identity
  // ('Math Wars · 8/10 câu') and it carries neither examId nor chapter — so it
  // can never satisfy an exam or a chapter task, nor they it.
  //
  // A round records total = the full 10 questions, not the number reached
  // before the clock ran out. progress() counts only sessions with
  // score = total, so this task means a clean 10/10: answering four and timing
  // out scores 4 of 10 and does not count.
  ENTRIES.push(entry('mathwars', 'math-wars', 'Toán 7 · Math Wars (phải đúng 10/10)', 'math',
    { titlePrefix: 'Math Wars' }, 'mathHubScreen', [['openMathSection', 'wars'], ['startWarsRound']]));

  const BY_KEY = new Map(ENTRIES.map(e => [e.key, e]));

  function groups() { return GROUPS.slice(); }
  function entries(groupId) { return ENTRIES.filter(e => e.group === groupId); }
  function all() { return ENTRIES.slice(); }
  function get(key) { return (typeof key === 'string' && BY_KEY.get(key)) || null; }

  return Object.freeze({ groups, entries, all, get });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyTaskCatalog;
