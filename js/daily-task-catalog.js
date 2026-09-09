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
    { id: 'math4', label: 'Toán 4' },
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
  // Chapter numbers are unique across the two semesters (1–5 HK1, 6–10 HK2),
  // and startMathQuiz(ch) answers a named chapter from the full bank — but the
  // HK2 view has to be opened first so the quiz screen, history and "ôn tổng
  // hợp" stay on the right semester.
  const CHAPTER_TITLES = [
    [1, 'Số hữu tỉ', 'hk1'], [2, 'Số thực', 'hk1'], [3, 'Góc và đường thẳng song song', 'hk1'],
    [4, 'Tam giác bằng nhau', 'hk1'], [5, 'Thu thập và biểu diễn dữ liệu', 'hk1'],
    [6, 'Tỉ lệ thức và đại lượng tỉ lệ', 'hk2'],
    [7, 'Biểu thức đại số và đa thức một biến', 'hk2'],
    [8, 'Làm quen với biến cố và xác suất của biến cố', 'hk2'],
    [9, 'Quan hệ giữa các yếu tố trong một tam giác', 'hk2'],
    [10, 'Một số hình khối trong thực tiễn', 'hk2'],
  ];
  const EXAM_TITLES = [
    ['hk1-exam1', 'HK1 Exam 1'], ['hk1-exam2', 'HK1 Exam 2'], ['hk1-exam3', 'HK1 Exam 3'],
    ['hk1-exam4', 'HK1 Exam 4'], ['hk1-exam5', 'HK1 Exam 5'], ['hk1-exam6', 'HK1 Exam 6'],
    ['hk1-exam7', 'HK1 Exam 7'], ['hk1-exam8', 'HK1 Exam 8'], ['hk1-exam9', 'HK1 Exam 9'],
    ['hk1-exam10', 'HK1 Exam 10'],
    ['hk1-source-1', 'HK1 1 (THCS Trần Quý Cáp)'], ['hk1-source-2', 'HK1 2 (THCS Phạm Hữu Lầu)'],
    ['hk1-source-3', 'HK1 3 (THCS An Điền)'], ['hk1-source-4', 'HK1 4 (THCS Tương Bình Hiệp)'],
    ['hk1-source-5', 'HK1 5 (THCS Lý Thánh Tông)'],
    // HK2 — the admin page had nothing to hand out for semester 2 until these
    // were listed: the catalog is the only thing the dropdown knows.
    ['hk2-exam1', 'HK2 Exam 1'],
    ['hk2-exam2', 'HK2 Exam 2'],
    ['hk2-exam3', 'HK2 Exam 3'],
    ['hk2-exam4', 'HK2 Exam 4'],
    ['hk2-exam5', 'HK2 Exam 5'],
    ['hk2-exam6', 'HK2 Exam 6'],
    ['hk2-exam7', 'HK2 Exam 7'],
    ['hk2-exam8', 'HK2 Exam 8'],
    ['hk2-exam9', 'HK2 Exam 9'],
    ['hk2-exam10', 'HK2 Exam 10'],
    ['hk2-src-01', 'HK2 THCS Chu Văn An (Cầu Ông Lãnh)'],
    ['hk2-src-02', 'HK2 THCS Chu Văn An (Gia Lai)'],
    ['hk2-src-03', 'HK2 THCS Chúc Sơn'],
    ['hk2-src-04', 'HK2 THCS Lý Tự Trọng (Bình Nguyên)'],
    ['hk2-src-05', 'HK2 THCS Nguyễn Huệ'],
    ['hk2-src-06', 'HK2 THCS Nguyễn Thị Thập'],
    ['hk2-src-07', 'HK2 THCS Nguyễn Trường Tộ'],
    ['hk2-src-08', 'HK2 THCS Phúc Đồng'],
    ['hk2-src-09', 'HK2 THCS Phước Bửu'],
    ['hk2-src-10', 'HK2 THCS Phước Thạnh'],
    ['hk2-src-11', 'HK2 THCS Phương Đông'],
    ['hk2-src-12', 'HK2 THCS Tam Hưng'],
    ['hk2-src-13', 'HK2 THCS Võ Trường Toản'],
    ['hk2-src-14', 'HK2 Tre Việt (Hóc Môn)'],
    ['hk2-src-15', 'HK2 THCS Bùi Văn Thủ (Hóc Môn)'],
    ['hk2-src-16', 'HK2 THCS Đặng Công Bỉnh'],
    ['hk2-src-17', 'HK2 THCS Đặng Thúc Vịnh'],
    ['hk2-src-18', 'HK2 THCS Đỗ Văn Dậy'],
    ['hk2-src-19', 'HK2 THCS Đông Thạnh'],
    ['hk2-src-20', 'HK2 THCS Hà Huy Tập'],
    ['hk2-src-21', 'HK2 THCS Lý Chính Thắng 1'],
    ['hk2-src-22', 'HK2 THCS Nguyễn An Khương'],
    ['hk2-src-23', 'HK2 THCS Nguyễn Hồng Đào'],
    ['hk2-src-24', 'HK2 THCS Nguyễn Thị Minh Khai'],
    ['hk2-src-25', 'HK2 THCS Nguyễn Văn Bứa'],
    ['hk2-src-26', 'HK2 THCS Phan Công Hớn'],
    ['hk2-src-27', 'HK2 THCS Tam Đông 1'],
    ['hk2-src-28', 'HK2 THCS Tân Xuân'],
    ['hk2-src-29', 'HK2 THCS Tô Ký'],
    ['hk2-src-30', 'HK2 THCS Xuân Thới Thượng'],
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
  ENTRIES.push(entry('vocab', 'practice', 'Vocabulary lesson (từ vựng hôm nay)', 'lesson',
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
        { titleExact: 'Unit ' + unitKey + ' words practice' }, 'gradeFourScreen',
        [['switchUnitSet', s.set], ['startUnitPractice', unitKey]]));
    }
    const mixKey = s.set === 'pre' ? 'mix' : prefix + 'mix';
    const mixTitle = s.set === 'pre' ? 'Mix 12 units words practice' : 'Unit ' + mixKey + ' words practice';
    ENTRIES.push(entry('units:' + mixKey, s.group, 'Units ' + s.name + ' · 🎲 Mix', 'lesson',
      { titleExact: mixTitle }, 'gradeFourScreen',
      [['switchUnitSet', s.set], ['startUnitPractice', mixKey]]));
  }
  // Toán 7 — detail_json carries examId (mock exams) or chapter (drills).
  ENTRIES.push(entry('math-exam:any-hk1', 'math-exam', 'Toán 7 · Đề thi HK1 bất kỳ', 'math',
    { detail: { field: 'examId', prefix: 'hk1-' } }, 'mathHubScreen', [['openMathSection', 'hk1'], ['switchMathSubTab', 'exams']]));
  ENTRIES.push(entry('math-exam:any-hk2', 'math-exam', 'Toán 7 · Đề thi HK2 bất kỳ', 'math',
    { detail: { field: 'examId', prefix: 'hk2-' } }, 'mathHubScreen', [['openMathSection', 'hk2'], ['switchMathSubTab', 'exams']]));
  // startMathExam(id) looks the id up in the semester the child is standing
  // in, so the deep link opens that semester first — an HK2 id from the HK1
  // view would simply do nothing.
  for (const [id, title] of EXAM_TITLES) {
    const sem = id.startsWith('hk2-') ? 'hk2' : 'hk1';
    ENTRIES.push(entry('math-exam:' + id, 'math-exam', 'Toán 7 · Đề thi ' + title, 'math',
      { detail: { field: 'examId', value: id } }, 'mathHubScreen', [['openMathSection', sem], ['startMathExam', id]]));
  }
  for (const [num, title, sem] of CHAPTER_TITLES) {
    ENTRIES.push(entry('math-chapter:' + num, 'math-chapter', 'Toán 7 · Chương ' + num + ' · ' + title, 'math',
      { detail: { field: 'chapter', value: num }, noField: 'examId' }, 'mathHubScreen', [['openMathSection', sem], ['startMathQuiz', num]]));
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
  // Toán 4 · Mix / Pre. They ride the 'math' activity type like everything else in
  // the tab, and is told apart by detail.g4set — NOT by chapter, which for a
  // Toán 4 paper is the string 'g4-pre' and would silently match nothing, and
  // not by title either, since a title is a label an author may reword.
  ENTRIES.push(entry('math4:pre', 'math4', 'Pre · Chọn 1 trong 4 đáp án · phải đúng 10/10', 'math',
    { detail: { field: 'g4set', value: 'pre' } }, 'mathHubScreen',
    [['openMathSection', 'toan4'], ['startMath4Pre']]));
  ENTRIES.push(entry('math4:mix', 'math4', 'Mix · Nhập đáp án · phải đúng 10/10', 'math',
    { detail: { field: 'g4set', value: 'mix' } }, 'mathHubScreen',
    [['openMathSection', 'toan4'], ['startMath4Mix']]));

  // Bảng cửu chương — six drills, and three "bất kỳ" tasks over them.
  //
  // Every code starts with 'cc', nhân codes with 'ccx' and chia codes with
  // 'ccd', so all three loose tasks are a single PREFIX clause rather than a
  // list that would have to be edited every time a table group is added.
  // matchSql() already supports detail prefixes (it is how the "đề thi HK1 bất
  // kỳ" task works).
  //
  // "phải đúng 10/10" is not a rule this file enforces — progress() counts
  // only sessions with score == total, and a cửu chương round always records
  // total = 10 even when the clock cut it short. The label just says so out
  // loud, because an admin setting the day's work should not have to know that.
  const CC_GROUPS = [['2345', '2, 3, 4, 5'], ['67', '6, 7'], ['89', '8, 9']];
  ENTRIES.push(entry('math4:cc', 'math4', 'Bảng cửu chương · bất kỳ bài nào (phải đúng 10/10)', 'math',
    { detail: { field: 'g4set', prefix: 'cc' } }, 'mathHubScreen',
    [['openMathSection', 'cuuchuong'], ['startMathTables', 'x', '2345']]));
  ENTRIES.push(entry('math4:ccx', 'math4', 'Bảng nhân · bất kỳ bảng nào (phải đúng 10/10)', 'math',
    { detail: { field: 'g4set', prefix: 'ccx' } }, 'mathHubScreen',
    [['openMathSection', 'cuuchuong'], ['startMathTables', 'x', '2345']]));
  ENTRIES.push(entry('math4:ccd', 'math4', 'Bảng chia · bất kỳ bảng nào (phải đúng 10/10)', 'math',
    { detail: { field: 'g4set', prefix: 'ccd' } }, 'mathHubScreen',
    [['openMathSection', 'cuuchuong'], ['startMathTables', 'd', '2345']]));
  for (const [op, word] of [['x', 'Bảng nhân '], ['d', 'Bảng chia ']]) {
    for (const [group, label] of CC_GROUPS) {
      ENTRIES.push(entry('math4:cc' + op + group, 'math4',
        word + label + ' (phải đúng 10/10)', 'math',
        { detail: { field: 'g4set', value: 'cc' + op + group } }, 'mathHubScreen',
        [['openMathSection', 'cuuchuong'], ['startMathTables', op, group]]));
    }
  }

  const BY_KEY = new Map(ENTRIES.map(e => [e.key, e]));

  function groups() { return GROUPS.slice(); }
  function entries(groupId) { return ENTRIES.filter(e => e.group === groupId); }
  function all() { return ENTRIES.slice(); }
  function get(key) { return (typeof key === 'string' && BY_KEY.get(key)) || null; }

  return Object.freeze({ groups, entries, all, get });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = DailyTaskCatalog;
