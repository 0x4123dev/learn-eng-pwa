// app.js - Core application logic, state management, and utilities

const WORDS_PER_LESSON = 5;
const TOTAL_LESSONS = Math.ceil(ieltsVocabulary.length / WORDS_PER_LESSON);
const SRS_WORDS_PER_REVIEW = 5;
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

const achievements = [
    // Getting started
    { id: 'first-lesson', name: 'Baby Steps', icon: '🐣' },
    { id: 'lessons-5', name: 'High Five', icon: '🖐️' },
    { id: 'lessons-10', name: 'Super Student', icon: '💪' },
    { id: 'lessons-25', name: 'Bookworm', icon: '📚' },
    { id: 'lessons-50', name: 'Word Wizard', icon: '🧙' },
    { id: 'lessons-100', name: 'Genius Kid', icon: '🦸' },
    { id: 'all-lessons', name: 'Legend', icon: '👑' },

    // Streaks
    { id: 'streak-3', name: 'Hatching', icon: '🥚' },
    { id: 'streak-7', name: 'On Fire', icon: '🔥' },
    { id: 'streak-14', name: 'Unstoppable', icon: '🚀' },
    { id: 'streak-30', name: 'Super Streak', icon: '⚡' },

    // Points
    { id: 'points-100', name: 'Coin Collector', icon: '🪙' },
    { id: 'points-500', name: 'Treasure Hunter', icon: '💰' },
    { id: 'points-1000', name: 'Rich Kid', icon: '💎' },
    { id: 'points-5000', name: 'Billionaire', icon: '🏦' },

    // Accuracy & perfection
    { id: 'perfect', name: 'Bullseye', icon: '🎯' },
    { id: 'perfect-3', name: 'Triple Star', icon: '🌟' },
    { id: 'perfect-10', name: 'Perfectionist', icon: '💯' },
    { id: 'correct-100', name: 'Sharp Mind', icon: '🔪' },
    { id: 'correct-500', name: 'Brain Power', icon: '🧠' },

    // SRS & review
    { id: 'srs-first', name: 'First Review', icon: '🔁' },
    { id: 'srs-reviewer', name: 'Reviewer', icon: '🔄' },
    { id: 'srs-master', name: 'Memory Master', icon: '🐘' },
    { id: 'srs-mastery-50', name: 'Half Mastered', icon: '🏔️' },
    { id: 'srs-mastery-100', name: 'All Mastered', icon: '🏆' },

    // Fun & time-based
    { id: 'night-owl', name: 'Night Owl', icon: '🦉' },
    { id: 'early-bird', name: 'Early Bird', icon: '🐦' },
    { id: 'weekend-warrior', name: 'Weekend Hero', icon: '🦸‍♂️' },
    { id: 'speed-demon', name: 'Speed Demon', icon: '👹' },

    // Word collection milestones
    { id: 'word-collector-50', name: 'Collector', icon: '🎒' },
    { id: 'word-collector-200', name: 'Treasure Chest', icon: '🧳' },
    { id: 'word-collector-500', name: 'Word Dragon', icon: '🐉' },

    // Fun features
    { id: 'shield-saver', name: 'Shield Saver', icon: '🛡️' },
    { id: 'combo-5', name: 'Combo King', icon: '🔥' },
    { id: 'daily-5', name: 'Daily Devotee', icon: '📅' },
    { id: 'daily-15', name: 'Daily Legend', icon: '🗓️' },
    { id: 'first-battle', name: 'Challenger', icon: '⚔️' },
    { id: 'battle-5', name: 'Warrior', icon: '🗡️' },
    { id: 'hunter-first', name: 'Word Hunter', icon: '🔍' },
    { id: 'hunter-10', name: 'Expert Hunter', icon: '🎯' }
];

let currentUser = null;
let userToDelete = null;
let selectedAvatar = '😊';

// Once a child has signed in, closing the app is NOT a logout: the active
// profile is remembered in localStorage and signed straight back in on the
// next open. Only an explicit "Switch user" (or deleting that profile) clears
// the marker — that click is the passcode boundary. This used to be
// sessionStorage, which survived a reload but not an app restart, so every
// morning began with the passcode screen.
const ACTIVE_USER_KEY = 'flashlingo-active-user';
const STUDY_CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const STUDY_CHECKPOINT_MAX_AGE = 86400000;
function rememberActiveUser(username) {
    try {
        if (username) localStorage.setItem(ACTIVE_USER_KEY, username);
        else localStorage.removeItem(ACTIVE_USER_KEY);
    } catch (e) { /* storage may be unavailable in private mode */ }
}
function rememberedActiveUser() {
    try {
        const username = localStorage.getItem(ACTIVE_USER_KEY);
        if (username && getUsers().includes(username) && getUserData(username)) return username;
    } catch (e) { /* fall through to a durable study checkpoint */ }
    // Devices that signed in before this marker became durable still deserve a
    // seamless morning: a recent unfinished exercise is proof enough of who
    // was studying on this device.
    try {
        const checkpoint = JSON.parse(localStorage.getItem(STUDY_CHECKPOINT_KEY));
        const fresh = checkpoint && Date.now() - checkpoint.savedAt <= STUDY_CHECKPOINT_MAX_AGE;
        const username = fresh && checkpoint.user;
        return username && getUsers().includes(username) && getUserData(username) ? username : null;
    } catch (e) { return null; }
}

// The checkpoint is written when something CHANGES, not on a clock. It used to
// be a one-second setInterval that ran for the whole of every
// activity — a JSON.stringify of the exam's forty questions and a localStorage
// write once a second while a child sat thinking. Now:
//   - every quiz engine calls saveStudyCheckpoint() from its render function
//     (the screen and the checkpoint change together) and after it ends a
//     round (state null → checkpoint cleared, so a finished paper is never
//     offered back and paid for twice);
//   - any tap or Enter schedules one coalesced save for right after its
//     handlers ran, which is the net under everything that is not an answer:
//     hints, quits, a matched pair, a profile switch;
//   - typing saves 500 ms after the last keystroke (currentDraftInputs);
//   - going hidden / pagehide / beforeunload saves at once — the iOS reload
//     case this whole mechanism exists for;
//   - timed activities tick saveStudyCheckpointOnClock(), which keeps the
//     remaining time within STUDY_CHECKPOINT_CLOCK_MS of true.
let _studyCheckpointListening = false;
let _studyCheckpointSoon = null;        // the coalesced after-tap save
let _studyCheckpointDraftTimer = null;  // the debounced typing save
let _studyCheckpointClockAt = 0;        // last write, for the timed activities
const STUDY_CHECKPOINT_DRAFT_MS = 500;
const STUDY_CHECKPOINT_CLOCK_MS = 10000;
let _studyCheckpointRestored = false;
// One retry, not a loop. See restoreStudyCheckpoint.
let _studyCheckpointWaited = false;

function clearStudyCheckpoint() {
    try { localStorage.removeItem(STUDY_CHECKPOINT_KEY); } catch (e) {}
}

function checkpointClone(state, without) {
    const copy = Object.assign({}, state || {});
    (without || []).forEach(key => { delete copy[key]; });
    // A Set JSON-stringifies to `{}` — truthy, with no .add and no .has. The
    // review session's reviewWrongWords (js/srs.js, js/topics.js) went through
    // here, so after an iOS reload the first wrong match threw a TypeError
    // inside the click handler (the round wedged with both cards stuck
    // selected) and completeLesson threw at .has, losing the whole review:
    // no SRS update, no points, nothing saved. Serialise it as the array it
    // really is; restoreStudyCheckpoint builds the Set back.
    Object.keys(copy).forEach(key => { if (copy[key] instanceof Set) copy[key] = Array.from(copy[key]); });
    return JSON.parse(JSON.stringify(copy));
}

function currentDraftInputs() {
    const drafts = {};
    const active = document.querySelector('.screen.active');
    if (!active) return drafts;
    active.querySelectorAll('input[id],textarea[id]').forEach(el => {
        if (el.type !== 'password' && el.type !== 'hidden') drafts[el.id] = el.value;
    });
    // Speed challenge is an overlay outside the active screen.
    ['inputV2', 'inputV3'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.closest('.active')) drafts[id] = el.value;
    });
    return drafts;
}

function buildStudyCheckpoint() {
    if (!currentUser) return null;
    const base = { version:1, user:currentUser, savedAt:Date.now(), drafts:currentDraftInputs() };
    if (typeof _grammarQuizState !== 'undefined' && _grammarQuizState)
        return Object.assign(base, { kind:'grammar', screen:'grammarScreen', state:checkpointClone(_grammarQuizState) });
    if (typeof _phrQuiz !== 'undefined' && _phrQuiz)
        return Object.assign(base, { kind:'phrases', screen:'phrasesScreen', state:checkpointClone(_phrQuiz) });
    if (typeof _wfQuiz !== 'undefined' && _wfQuiz)
        return Object.assign(base, { kind:'wordform', screen:'wordformScreen', state:checkpointClone(_wfQuiz) });
    if (typeof _rwQuiz !== 'undefined' && _rwQuiz)
        return Object.assign(base, { kind:'rewrite', screen:'rewriteScreen', state:checkpointClone(_rwQuiz) });
    if (typeof _colQuiz !== 'undefined' && _colQuiz)
        return Object.assign(base, { kind:'collocation', screen:'phrasesScreen', state:checkpointClone(_colQuiz) });
    if (typeof _unitQuiz !== 'undefined' && _unitQuiz)
        return Object.assign(base, { kind:'units', screen:'gradeFourScreen', state:checkpointClone(_unitQuiz) });
    if (typeof _mathQuiz !== 'undefined' && _mathQuiz)
        return Object.assign(base, { kind:'math', screen:'mathHubScreen', state:checkpointClone(_mathQuiz) });
    if (typeof _warsQuiz !== 'undefined' && _warsQuiz) {
        const state = checkpointClone(_warsQuiz, ['timer']);
        state.remainingMs = typeof warsLeftMs === 'function' ? warsLeftMs() : Math.max(0, state.endsAt - Date.now());
        return Object.assign(base, { kind:'mathwars', screen:'mathHubScreen', state });
    }
    if (typeof _examState !== 'undefined' && _examState && !_examState.finished) {
        const state = checkpointClone(_examState, ['timerId']);
        state.remainingMs = Math.max(0, _examState.deadlineTs - Date.now());
        // The set's own screen, so a PTNK paper reopens on the PTNK tab.
        const examScreenId = (typeof EXAM_SETS !== 'undefined' && EXAM_SETS[_examState.set])
            ? EXAM_SETS[_examState.set].screen : 'examScreen';
        return Object.assign(base, { kind:'exam', screen: examScreenId, state });
    }
    const speedOverlay = document.getElementById('speedGameOverlay');
    if (speedOverlay && speedOverlay.classList.contains('active') && speedState.currentVerbs.length) {
        return Object.assign(base, { kind:'verbs', screen:'speedChallengeScreen', state:checkpointClone(speedState, ['timer']) });
    }
    const lessonActive = document.getElementById('lessonScreen')?.classList.contains('active');
    if (lessonActive && lessonState && Array.isArray(lessonState.roundWords) && lessonState.roundWords.length) {
        const state = checkpointClone(lessonState, ['selectedLeft', 'selectedRight']);
        // DOM classes know which pairs remain; saving only those prevents
        // already-matched words from returning after an iOS reload.
        const remaining = Array.from(document.querySelectorAll('#leftColumn .match-card:not(.matched)'))
            .map(el => el.dataset.word);
        if (remaining.length) {
            state.roundWords = lessonState.roundWords.filter(w => remaining.includes(w.en));
            state.matchedPairs = 0;
            return Object.assign(base, { kind:'lesson', screen:'lessonScreen', state });
        }
    }
    return null;
}

function saveStudyCheckpoint() {
    _studyCheckpointClockAt = Date.now();
    if (_studyCheckpointSoon) { clearTimeout(_studyCheckpointSoon); _studyCheckpointSoon = null; }
    if (_studyCheckpointDraftTimer) { clearTimeout(_studyCheckpointDraftTimer); _studyCheckpointDraftTimer = null; }
    try {
        const checkpoint = buildStudyCheckpoint();
        if (checkpoint) localStorage.setItem(STUDY_CHECKPOINT_KEY, JSON.stringify(checkpoint));
        else clearStudyCheckpoint();
    } catch (e) { /* a checkpoint must never interrupt the exercise */ }
}

// One save right after the current tap's handlers have run, however many
// things asked for it. A macrotask, not a microtask, so a handler that hands
// off to a promise (LazyData.ensure, a confirm) is still seen through.
function scheduleStudyCheckpoint() {
    if (_studyCheckpointSoon) return;
    _studyCheckpointSoon = setTimeout(() => { _studyCheckpointSoon = null; saveStudyCheckpoint(); }, 0);
}

// Typing: a save STUDY_CHECKPOINT_DRAFT_MS after the last keystroke, so an
// answer half typed when iOS reloads the page comes back (restoreDraftInputs).
function scheduleDraftCheckpoint() {
    if (_studyCheckpointDraftTimer) clearTimeout(_studyCheckpointDraftTimer);
    _studyCheckpointDraftTimer = setTimeout(() => { _studyCheckpointDraftTimer = null; saveStudyCheckpoint(); }, STUDY_CHECKPOINT_DRAFT_MS);
}

// For the clocks of the timed activities (exam, Math Wars, speed verbs): the
// remaining time is part of the checkpoint and changes with nobody touching
// anything. Called every tick; writes at most once per STUDY_CHECKPOINT_CLOCK_MS.
function saveStudyCheckpointOnClock() {
    if (Date.now() - _studyCheckpointClockAt < STUDY_CHECKPOINT_CLOCK_MS) return;
    saveStudyCheckpoint();
}

function activateCheckpointScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
    setBottomNavActive(screenId);
}

function restoreDraftInputs(drafts) {
    setTimeout(() => Object.keys(drafts || {}).forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.disabled) el.value = drafts[id];
    }), 0);
}

function restoreStudyCheckpoint() {
    if (_studyCheckpointRestored || !currentUser) return false;
    let checkpoint = null;
    try { checkpoint = JSON.parse(localStorage.getItem(STUDY_CHECKPOINT_KEY)); } catch (e) {}
    if (!checkpoint || checkpoint.user !== currentUser || Date.now() - checkpoint.savedAt > STUDY_CHECKPOINT_MAX_AGE) {
        clearStudyCheckpoint();
        return false;
    }
    // Grammar and Exam checkpoints need a bank that no longer loads at
    // startup (js/lazy-data.js). Reopening the question before it lands would
    // show an empty one, so wait — and come back here when it arrives.
    const needsBankOne = {
        grammar: 'grammarScreen', exam: checkpoint.screen || 'examScreen',
        phrases: 'phrasesScreen', collocation: 'phrasesScreen',
        wordform: 'wordformScreen', rewrite: 'rewriteScreen',
        math: 'mathHubScreen', mathwars: 'mathHubScreen',
    }[checkpoint.kind];
    // A Toán 7 Học kì 2 quiz also needs its own lazy group (js/lazy-data.js
    // GROUP_FILES): the questions travel inside the checkpoint, but hints,
    // the wrong-answer list and the result screen look them up by id.
    const s0 = checkpoint.state || {};
    const needsHk2 = checkpoint.kind === 'math'
        && (Number(s0.chapter) >= 6 || /^hk2-/.test(String(s0.examId || '')));
    const needsBank = needsBankOne ? [needsBankOne].concat(needsHk2 ? ['mathHk2'] : []) : null;
    const notReady = needsBank && typeof LazyData !== 'undefined' ? needsBank.filter(g => !LazyData.ready(g)) : [];
    if (notReady.length) {
        // Ask ONCE. LazyData resolves even when a bank fails to download (a
        // tab must render what it has rather than spin), so `ready()` can
        // still be false when this promise settles — and re-arming on that was
        // an unbroken microtask loop with nothing to yield to. A child who was
        // mid-quiz when js/grammar-units.js failed to load came back to a
        // frozen page with no error, and because the checkpoint was never
        // cleared, to a frozen page on EVERY open for the next 24 hours.
        if (_studyCheckpointWaited) { clearStudyCheckpoint(); return false; }
        _studyCheckpointWaited = true;
        Promise.all(notReady.map(g => LazyData.ensure(g))).then(() => restoreStudyCheckpoint());
        return false;
    }
    _studyCheckpointRestored = true;
    const s = checkpoint.state;
    try {
        // v4.17.63 moved Grade 4 out of Topics. Migrate a checkpoint saved by
        // an older build instead of restoring its question into a hidden pane.
        activateCheckpointScreen(checkpoint.kind === 'units' ? 'gradeFourScreen' : checkpoint.screen);
        if (checkpoint.kind === 'grammar') { _grammarQuizState = s; renderGrammarQuestion(); }
        else if (checkpoint.kind === 'phrases') { _phrQuiz = s; renderPhrQuestion(); }
        else if (checkpoint.kind === 'wordform') { _wfQuiz = s; renderWfQuestion(); }
        else if (checkpoint.kind === 'rewrite') { _rwQuiz = s; renderRwQuestion(); }
        else if (checkpoint.kind === 'collocation') { _colQuiz = s; renderCollocQuestion(); }
        else if (checkpoint.kind === 'units') {
            _unitQuiz = s;
            ['unitsBar','grade4SubTabs','grade4History'].forEach(id => {
                const el = document.getElementById(id); if (el) el.style.display = 'none';
            });
            renderUnitQuestion();
        }
        else if (checkpoint.kind === 'math') { _mathQuiz = s; renderMathQuestion(); }
        else if (checkpoint.kind === 'mathwars') {
            _warsQuiz = s; _warsQuiz.endsAt = Date.now() + Math.max(1000, s.remainingMs || 0);
            _warsQuiz.timer = setInterval(warsClockTick, 250); renderWars();
        }
        else if (checkpoint.kind === 'exam') {
            if (typeof examSelectSet === 'function') examSelectSet(s.set);
            _examState = s; _examState.deadlineTs = Date.now() + Math.max(1000, s.remainingMs || 0);
            _examState.timerId = setInterval(_examTick, 1000); renderExamQuestion();
        }
        else if (checkpoint.kind === 'verbs') {
            speedState = Object.assign(speedState, s);
            document.getElementById('speedGameOverlay').classList.add('active');
            document.getElementById('bottomNav').style.display = 'none';
            showSpeedQuestion();
            speedState.timeLeft = Math.max(1000, s.timeLeft || SPEED_TIME_LIMIT);
            updateTimerBar();
        }
        else if (checkpoint.kind === 'lesson') {
            // The Set checkpointClone flattened to an array, back as a Set.
            s.reviewWrongWords = new Set(Array.isArray(s.reviewWrongWords) ? s.reviewWrongWords : []);
            lessonState = s;
            document.getElementById('bottomNav').style.display = 'none';
            renderMatchingRound();
        }
        else throw new Error('unknown checkpoint');
        restoreDraftInputs(checkpoint.drafts);
        showToast('↩️ Đã mở lại bài đang làm dở');
        return true;
    } catch (e) {
        clearStudyCheckpoint();
        return false;
    }
}

function startStudyCheckpointing() {
    if (_studyCheckpointListening) return;
    _studyCheckpointListening = true;
    // Capture phase + a deferred save: runs after every handler the tap
    // reaches, and a handler that stops propagation cannot hide from it.
    document.addEventListener('click', scheduleStudyCheckpoint, true);
    document.addEventListener('keydown', e => { if (e.key === 'Enter') scheduleStudyCheckpoint(); }, true);
    document.addEventListener('change', scheduleStudyCheckpoint, true);
    document.addEventListener('input', scheduleDraftCheckpoint, true);
    window.addEventListener('pagehide', saveStudyCheckpoint);
    window.addEventListener('beforeunload', saveStudyCheckpoint);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveStudyCheckpoint();
    });
}

let appState = null;
let selectedDifficultyFilter = 'beginning';

let lessonState = {
    categoryId: null,
    lessonNumber: 0,
    words: [],
    currentRound: 0,
    totalRounds: 0,
    roundWords: [],
    selectedLeft: null,
    selectedRight: null,
    matchedPairs: 0,
    correctInLesson: 0,
    wrongInLesson: 0,
    lessonPoints: 0
};

let currentHistoryTab = 'history';
let historyPage = 0;

let pendingLoginUser = null;

const SPEED_TIME_LIMIT = 45000; // 45 seconds
const SPEED_PENALTY_TIME = 3000; // 3 second penalty
const SPEED_QUESTIONS_PER_GAME = 10;

let speedState = {
    currentVerbs: [],
    currentIndex: 0,
    score: 0,
    streak: 0,
    bestStreakInGame: 0,
    correctCount: 0,
    timer: null,
    timeLeft: SPEED_TIME_LIMIT,
    isAnswering: false,
    level: 0,
    verbResults: [] // { v1, v2, v3, userV2, userV3, correct, timeUsed }
};

// Both readers below are called from checkExistingUsers(), the FIRST thing
// init() does. An unparseable value there — an interrupted write, a quota
// failure mid-save, a hand edit — used to throw straight out of init: no user
// list, no create form, no service worker registered, and no code path
// anywhere that could repair it. The app was dead until the site data was
// cleared by hand. Every other JSON.parse of localStorage in this codebase is
// already wrapped; these two were not.
function getUsers() {
    let users = null;
    try { users = localStorage.getItem('flashlingo-users'); } catch (e) { return []; }
    if (!users) return [];
    try {
        const parsed = JSON.parse(users);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* fall through to the repair below */ }
    // Junk is replaced, not carried: leaving it would re-throw on every open.
    try { localStorage.removeItem('flashlingo-users'); } catch (e) {}
    return [];
}

function saveUsers(users) {
    localStorage.setItem('flashlingo-users', JSON.stringify(users));
}

function getUserData(username) {
    let data = null;
    try { data = localStorage.getItem(`flashlingo-user-${username}`); } catch (e) { return null; }
    if (!data) return null;
    try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) { /* a corrupted profile must not take the whole app down */ }
    return null;
}

// Every practice menu's history lives inside this ONE blob, so it only ever
// grows — and every save re-stringifies all of it. Left unbounded it crossed
// 3MB on a busy profile: each save cost 100ms+ on an old iPad (the app "gets
// laggier every week"), and the old shed-one-line-and-retry loops did HUNDREDS
// of full re-stringifies when localStorage finally filled — a hard freeze the
// moment a child tapped "see result". Shedding now happens here, by HALVING,
// so it converges in a handful of attempts and every menu shares it.
const HISTORY_BOOKS = Object.freeze([
    // newest entry sits at index 0 (unshift-style) — trim from the tail
    { key: 'phrasesHistory', keep: 'head' }, { key: 'wordformHistory', keep: 'head' },
    { key: 'rewriteHistory', keep: 'head' }, { key: 'collocHistory', keep: 'head' },
    { key: 'unitsHistory', keep: 'head' }, { key: 'grammarHistory', keep: 'head' },
    { key: 'mathHistory', keep: 'head' }, { key: 'warsHistory', keep: 'head' },
    { key: 'nightRaidHistory', keep: 'head' },
    // appended oldest-first (push-style) — trim from the head
    { key: 'lessonHistory', keep: 'tail' },
]);
const HISTORY_FLOOR = 40;                 // recent sessions that always survive
const APPSTATE_SOFT_LIMIT = 2400000;      // ~2.4MB of a ~5MB origin quota

// Halve every history book still above the floor, keeping the NEWEST half.
// Returns false when nothing could shrink — the caller must stop retrying.
function shedHistoriesOnce(data) {
    let shrank = false;
    for (const book of HISTORY_BOOKS) {
        const list = data && data[book.key];
        if (!Array.isArray(list) || list.length <= HISTORY_FLOOR) continue;
        const keep = Math.max(HISTORY_FLOOR, Math.floor(list.length / 2));
        data[book.key] = book.keep === 'tail' ? list.slice(-keep) : list.slice(0, keep);
        shrank = true;
    }
    const speed = data && data.speedChallenge;
    if (speed && Array.isArray(speed.history) && speed.history.length > 20) {
        speed.history = speed.history.slice(-Math.max(20, Math.floor(speed.history.length / 2)));
        shrank = true;
    }
    return shrank;
}

function saveUserData(username, data) {
    let json = JSON.stringify(data);
    // Proactive bound: trim BEFORE the disk fills, so steady-state saves
    // (which run after every finished session) stay cheap on old devices.
    while (json.length > APPSTATE_SOFT_LIMIT && shedHistoriesOnce(data)) {
        json = JSON.stringify(data);
    }
    let guard = 8;
    while (true) {
        try { localStorage.setItem(`flashlingo-user-${username}`, json); return; }
        catch (e) {
            if (guard-- <= 0 || !shedHistoriesOnce(data)) throw e;
            json = JSON.stringify(data);
        }
    }
}

function deleteUserData(username) {
    localStorage.removeItem(`flashlingo-user-${username}`);
}

function createDefaultUserData(username, avatar, passcode) {
    return {
        username: username,
        avatar: avatar,
        passcode: passcode,
        points: 0,
        streak: 0,
        lastStudyDate: null,
        lessonsCompleted: 0,
        currentLesson: 0, // 0-199 for 200 total lessons
        totalCorrect: 0,
        totalAnswers: 0,
        achievements: [],
        lessonHistory: [], // Array of { lessonNum, date, points, accuracy }
        srs: {}, // { [englishWord]: { interval, ease, repetitions, nextReview, lastReview } }
        reviewsCompleted: 0, // Total words reviewed via SRS
        createdAt: Date.now(),
        streakShields: 0,
        bestStreak: 0,
        lastStreakMilestone: 0,
        theme: 'default',
        stickers: [],
        dailyChallenge: { lastDate: null, streak: 0, bestStreak: 0 },
        wordOfDayViewed: null,
        sentences: [],
        battleHistory: { wins: 0, losses: 0, draws: 0 },
        petName: null,
        petHunger: 100,
        petLastFed: Date.now(),
        petAccessories: [],
        activeAccessories: [],
        petQuest: { lastDate: null, questId: null, completed: false },
        coins: 0,
        dogGrowthXP: 0,
        dogLevel: 1,
        petPoops: [],
        lastDecayDate: null,
        petMemory: {
            lessonsTogether: 0,         // Lifetime lessons with this pet
            lastSeen: Date.now(),        // Last time user opened app
            lastSeenGreeted: null,       // Last toDateString we already greeted
            longestAbsenceDays: 0,       // Worst gap (for "you came back!")
            lastStreakBroken: 0,         // Last streak length when broken
            lastStreakBrokenDate: null,
            milestonesSeen: []           // Lifetime-lessons milestones already shown (e.g. 50, 100)
        },
        weeklyRecaps: [],                 // Array of { weekStart, weekEnd, xpEarned, daysActive[7], lessonsCompleted, perfectLessons, wordsLearned, streakAtEnd }
        lastWeeklyRecapShown: null,       // ISO date of last week recap modal shown
        pendingShieldCelebration: null,   // Streak count to celebrate after shield-saved
        topicProgress: {},                // { [topicId]: { [chunkIdx]: { mistakes, accuracy, date } } }
        grammarHistory: [],               // Array of completed quiz sessions (Grammar tab)
        grammarMistakes: {}               // { [questionId]: { qId, unitId, topic, misses, lastWrong, bookmarked } }
    };
}

const themeData = [
    { id: 'default', name: 'Classic', icon: '🌤️', cost: 0, vars: {} },
    { id: 'ocean', name: 'Ocean', icon: '🌊', cost: 500, vars: {
        '--bg-primary': '#E0F2F1', '--bg-secondary': '#B2DFDB', '--accent-green': '#00897B',
        '--accent-green-dark': '#00695C', '--accent-blue': '#0097A7', '--border-color': '#4DD0E1'
    }},
    { id: 'forest', name: 'Forest', icon: '🌲', cost: 1000, vars: {
        '--bg-primary': '#E8F5E9', '--bg-secondary': '#C8E6C9', '--accent-green': '#43A047',
        '--accent-green-dark': '#2E7D32', '--accent-blue': '#66BB6A', '--border-color': '#81C784'
    }},
    { id: 'sunset', name: 'Sunset', icon: '🌅', cost: 2000, vars: {
        '--bg-primary': '#FFF3E0', '--bg-secondary': '#FFE0B2', '--accent-green': '#FB8C00',
        '--accent-green-dark': '#EF6C00', '--accent-blue': '#FFA726', '--border-color': '#FFCC80'
    }},
    { id: 'galaxy', name: 'Galaxy', icon: '🌌', cost: 5000, vars: {
        '--bg-primary': '#EDE7F6', '--bg-secondary': '#D1C4E9', '--accent-green': '#7E57C2',
        '--accent-green-dark': '#5E35B1', '--accent-blue': '#B39DDB', '--border-color': '#B39DDB'
    }}
];

function applyTheme(themeId) {
    const theme = themeData.find(t => t.id === themeId);
    if (!theme) return;
    // Remove all inline overrides first
    const allVars = ['--bg-primary', '--bg-secondary', '--accent-green', '--accent-green-dark', '--accent-blue', '--border-color'];
    allVars.forEach(v => document.documentElement.style.removeProperty(v));
    // Apply theme variables
    Object.entries(theme.vars).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
    });
}

function init() {
    setupAvatarPicker();
    checkExistingUsers();
    // A reload is not a logout. Resume the profile already authenticated in
    // this tab instead of asking for its passcode again.
    const resumeUser = rememberedActiveUser();
    if (resumeUser) loginUser(resumeUser);
    // Feature switches an admin threw since last time. loginUser only syncs
    // when the profile still holds a passcode, so a device that simply stayed
    // signed in could keep an unlocked tab hidden indefinitely — which is
    // exactly what happened to a child waiting for Đấu Toán.
    if (resumeUser && typeof EngAuth !== 'undefined' && EngAuth.refreshFlags) {
        try { EngAuth.refreshFlags(resumeUser); } catch (e) { /* offline is fine */ }
    }
    startStudyCheckpointing();
    registerServiceWorker();

    // Show version on login screen
    var lv = document.getElementById('loginVersion');
    if (lv && typeof APP_VERSION !== 'undefined') lv.textContent = APP_VERSION;

    // Warm the commonest tap-to-hear words. Deferred and idle-scheduled so it
    // never competes with the first screen; a no-op once already warmed.
    setTimeout(() => { try { warmHotWords(); } catch (e) {} }, 3000);
}

function setupAvatarPicker() {
    const picker = document.getElementById('avatarPicker');
    picker.addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option) {
            document.querySelectorAll('.avatar-option').forEach(o => {
                o.classList.remove('selected');
                o.setAttribute('aria-pressed', 'false');
            });
            option.classList.add('selected');
            option.setAttribute('aria-pressed', 'true');
            selectedAvatar = option.dataset.avatar;
        }
    });
}

// One device may hold only so many profiles. Mirrors the server's per-device
// account cap; see EngAuth.MAX_DEVICE_PROFILES for why the number lives twice.
function maxDeviceProfiles() {
    return (typeof EngAuth !== 'undefined' && EngAuth.MAX_DEVICE_PROFILES) || 2;
}
function deviceProfilesFull() {
    return getUsers().length >= maxDeviceProfiles();
}

function checkExistingUsers() {
    const users = getUsers();
    // Offering "Create your profile" on a full device is offering a form the
    // server will refuse — the child fills it in, picks an avatar, sets a
    // passcode, and only then finds out. Hide it instead and point at the
    // two things that actually work: sign in, or delete one.
    const full = deviceProfilesFull();
    const createSection = document.getElementById('createUserSection');
    const fullNote = document.getElementById('deviceFullNote');
    if (createSection) createSection.style.display = full ? 'none' : 'block';
    if (fullNote) fullNote.style.display = full ? 'block' : 'none';

    if (users.length > 0) {
        // Show existing users
        document.getElementById('existingUsersSection').style.display = 'block';
        document.getElementById('createUserTitle').textContent = 'Or create new profile';
        renderUserList(users);
    } else {
        // No users, show create form only
        document.getElementById('existingUsersSection').style.display = 'none';
        document.getElementById('createUserTitle').textContent = 'Create your profile';
    }
}

function renderUserList(users) {
    const list = document.getElementById('userList');
    list.innerHTML = '';

    users.forEach(username => {
        const userData = getUserData(username);
        if (!userData) return;

        const card = document.createElement('div');
        card.className = 'user-card';
        // Escaped, like every other tab escapes an echoed value. These names
        // are only local — a profile created on this device — so the current
        // USERNAME_RE keeps markup out of them, but that is one relaxed regex
        // or one hand-edited profile away from being the sign-in screen
        // executing whatever a name contains, on every app open.
        const name = appEsc(userData.username);
        card.innerHTML = `
            <button type="button" class="user-open-btn" aria-label="Open ${name}'s profile">
                <span class="user-avatar" aria-hidden="true">${appEsc(userData.avatar || '😊')}</span>
                <span class="user-info">
                    <span class="user-name">${name}</span>
                    <span class="user-stats">⭐ ${appEsc(userData.points)} points · 🔥 ${appEsc(userData.streak)} streak</span>
                </span>
                <span class="user-arrow" aria-hidden="true">›</span>
            </button>
            <button type="button" class="delete-user-btn" aria-label="Delete ${name}'s profile">🗑️</button>
        `;
        card.querySelector('.user-open-btn').onclick = () => showPasscodeModal(username);
        card.querySelector('.delete-user-btn').onclick = () => showDeleteModal(username);
        list.appendChild(card);
    });
}

function createUser(e) {
    e.preventDefault();

    const username = document.getElementById('usernameInput').value.trim();
    if (!username) {
        showToast('Please enter your name');
        return;
    }

    // Reject a name the server would reject, here and now — while it still
    // costs nothing to change. A profile carrying an unusable name can never
    // reach Friends or Battle, and there is no way back short of deleting it.
    if (typeof EngAuth !== 'undefined' && EngAuth.validUsername) {
        const v = EngAuth.validUsername(username);
        if (!v.ok) { showToast(v.error); return; }
    }

    // Get passcodes
    const passcode = getPasscodeValue('create');
    const confirmPasscode = getPasscodeValue('confirm');

    // Validate passcode
    if (passcode.length !== 4) {
        document.getElementById('passcodeError').textContent = 'Please enter 4 digits';
        shakePasscodeInputs('create');
        return;
    }

    if (passcode !== confirmPasscode) {
        document.getElementById('passcodeError').textContent = 'Passcodes do not match';
        shakePasscodeInputs('confirm');
        return;
    }

    document.getElementById('passcodeError').textContent = '';

    const users = getUsers();

    // Belt and braces: the form is hidden when the device is full, but a
    // stale page or a re-submit must not slip a third profile through.
    if (users.length >= maxDeviceProfiles()) {
        showToast('This device already has ' + maxDeviceProfiles() + ' profiles');
        checkExistingUsers();
        return;
    }

    // Check if username exists
    if (users.includes(username)) {
        showToast('This name already exists');
        return;
    }

    // Create new user with passcode
    const userData = createDefaultUserData(username, selectedAvatar, passcode);
    users.push(username);

    saveUsers(users);
    saveUserData(username, userData);

    loginUser(username);
}

function getPasscodeValue(type) {
    if (type === 'login') {
        return document.getElementById('passcodeHiddenInput').value;
    }
    const container = document.getElementById(
        type === 'create' ? 'createPasscode' : 'confirmPasscode'
    );
    const inputs = container.querySelectorAll('.passcode-digit');
    return Array.from(inputs).map(i => i.value).join('');
}

function clearPasscodeInputs(type) {
    if (type === 'login') {
        const hidden = document.getElementById('passcodeHiddenInput');
        hidden.value = '';
        const displays = document.querySelectorAll('#loginPasscode .passcode-digit-display');
        displays.forEach(d => {
            d.textContent = '';
            d.classList.remove('filled', 'error', 'active');
        });
        if (displays[0]) displays[0].classList.add('active');
        return;
    }
    const container = document.getElementById(
        type === 'create' ? 'createPasscode' : 'confirmPasscode'
    );
    const inputs = container.querySelectorAll('.passcode-digit');
    inputs.forEach(i => {
        i.value = '';
        i.classList.remove('filled', 'error');
    });
    inputs[0]?.focus();
}

function shakePasscodeInputs(type) {
    if (type === 'login') {
        const displays = document.querySelectorAll('#loginPasscode .passcode-digit-display');
        displays.forEach(d => d.classList.add('error'));
        setTimeout(() => {
            displays.forEach(d => d.classList.remove('error'));
            clearPasscodeInputs('login');
            document.getElementById('passcodeHiddenInput').focus();
        }, 400);
        return;
    }
    const container = document.getElementById(
        type === 'create' ? 'createPasscode' : 'confirmPasscode'
    );
    const inputs = container.querySelectorAll('.passcode-digit');
    inputs.forEach(i => i.classList.add('error'));
    setTimeout(() => {
        inputs.forEach(i => i.classList.remove('error'));
        clearPasscodeInputs(type);
    }, 400);
}

function handleHiddenPasscodeInput(input) {
    // Only keep digits
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
    const val = input.value;
    const displays = document.querySelectorAll('#loginPasscode .passcode-digit-display');

    displays.forEach((d, i) => {
        d.textContent = val[i] ? '●' : '';
        d.classList.toggle('filled', !!val[i]);
        d.classList.toggle('active', i === val.length && val.length < 4);
    });

    // Auto-submit when 4 digits entered
    if (val.length === 4) {
        setTimeout(() => verifyPasscode(), 100);
    }
}

function handlePasscodeInput(input, type) {
    const value = input.value.replace(/\D/g, '');
    input.value = value;

    if (value) {
        input.classList.add('filled');
        // Move to next input
        const index = parseInt(input.dataset.index);
        const container = input.closest('.passcode-inputs');
        const nextInput = container.querySelector(`[data-index="${index + 1}"]`);
        if (nextInput) {
            nextInput.focus();
        } else if (index === 3 && type === 'login') {
            // Auto-submit when all 4 digits entered for login
            setTimeout(() => verifyPasscode(), 100);
        }
    } else {
        input.classList.remove('filled');
    }
}

function handlePasscodeKeydown(event, input, type) {
    if (event.key === 'Backspace' && !input.value) {
        const index = parseInt(input.dataset.index);
        const container = input.closest('.passcode-inputs');
        const prevInput = container.querySelector(`[data-index="${index - 1}"]`);
        if (prevInput) {
            prevInput.focus();
            prevInput.value = '';
            prevInput.classList.remove('filled');
        }
    }
}

function showPasscodeModal(username) {
    const userData = getUserData(username);
    if (!userData) return;

    pendingLoginUser = username;

    document.getElementById('passcodeModalAvatar').textContent = userData.avatar || '😊';
    document.getElementById('passcodeModalName').textContent = userData.username;
    document.getElementById('loginPasscodeError').textContent = '';
    clearPasscodeInputs('login');

    // Focus hidden input BEFORE showing modal - stays in user gesture chain for iOS
    const hiddenInput = document.getElementById('passcodeHiddenInput');
    hiddenInput.value = '';
    hiddenInput.focus();

    document.getElementById('passcodeModal').classList.add('active');
}

function closePasscodeModal() {
    document.getElementById('passcodeModal').classList.remove('active');
    document.getElementById('passcodeHiddenInput').blur();
    pendingLoginUser = null;
    clearPasscodeInputs('login');
}

function verifyPasscode() {
    if (!pendingLoginUser) return;

    const userData = getUserData(pendingLoginUser);
    if (!userData) {
        showToast('User not found');
        closePasscodeModal();
        return;
    }

    const enteredPasscode = getPasscodeValue('login');

    if (enteredPasscode === userData.passcode) {
        const usernameToLogin = pendingLoginUser;
        closePasscodeModal();
        loginUser(usernameToLogin);
    } else {
        document.getElementById('loginPasscodeError').textContent = 'Wrong passcode';
        shakePasscodeInputs('login');
    }
}

function loginUser(username) {
    const userData = getUserData(username);
    if (!userData) {
        showToast('User not found');
        return;
    }

    // A profile is entered from several roads, not only through switchUser().
    // Clear whatever the previous child left in a module before this one's
    // appState is installed, so nothing of theirs can be rendered as ours.
    if (currentUser && currentUser !== username) forgetProfileState();

    currentUser = username;
    appState = userData;
    rememberActiveUser(username);

    // Best-effort: link this profile to a server account (for exam-history sync).
    // Fire-and-forget; never blocks login and is a no-op offline.
    if (typeof EngAuth !== 'undefined' && userData.passcode) {
        EngAuth.syncAccount(username, userData.passcode);
    }

    // Migrate: add SRS data for existing users
    if (!appState.srs) {
        appState.srs = {};
        if (appState.reviewsCompleted === undefined) appState.reviewsCompleted = 0;
        // Retroactively init SRS for all previously-learned words
        if (appState.lessonHistory && appState.lessonHistory.length > 0) {
            const seenLessons = new Set(appState.lessonHistory.map(h => h.lessonNum));
            seenLessons.forEach(lessonNum => {
                const startIdx = lessonNum * WORDS_PER_LESSON;
                const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);
                lessonWords.forEach(w => {
                    if (!appState.srs[w.en]) {
                        appState.srs[w.en] = {
                            interval: 1,
                            ease: 2.5,
                            repetitions: 1,
                            nextReview: Date.now(),
                            lastReview: Date.now()
                        };
                    }
                });
            });
        }
        saveUserData(currentUser, appState);
    }

    // Migrate: add fun features state for existing users
    if (!Array.isArray(appState.achievements)) appState.achievements = [];
    if (appState.streakShields === undefined) appState.streakShields = 0;
    if (appState.bestStreak === undefined) appState.bestStreak = appState.streak || 0;
    if (appState.lastStreakMilestone === undefined) appState.lastStreakMilestone = 0;
    if (appState.petMemory === undefined) appState.petMemory = {
        lessonsTogether: appState.lessonsCompleted || 0,
        lastSeen: Date.now(),
        lastSeenGreeted: null,
        longestAbsenceDays: 0,
        lastStreakBroken: 0,
        lastStreakBrokenDate: null,
        milestonesSeen: []
    };
    if (appState.weeklyRecaps === undefined) appState.weeklyRecaps = [];
    if (appState.lastWeeklyRecapShown === undefined) appState.lastWeeklyRecapShown = null;
    if (appState.pendingShieldCelebration === undefined) appState.pendingShieldCelebration = null;
    if (appState.topicProgress === undefined) appState.topicProgress = {};
    if (appState.grammarHistory === undefined) appState.grammarHistory = [];
    if (appState.grammarMistakes === undefined) appState.grammarMistakes = {};
    if (appState.theme === undefined) appState.theme = 'default';
    if (appState.stickers === undefined) appState.stickers = [];
    if (appState.dailyChallenge === undefined) appState.dailyChallenge = { lastDate: null, streak: 0, bestStreak: 0 };
    if (appState.wordOfDayViewed === undefined) appState.wordOfDayViewed = null;
    if (appState.sentences === undefined) appState.sentences = [];
    if (appState.battleHistory === undefined) appState.battleHistory = { wins: 0, losses: 0, draws: 0 };
    // (v3.38: Word Bubbles game removed — bubblesStats no longer migrated.)
    // (v3.47: Music & Videos tabs removed — videoStats/musicStats no longer migrated.)

    // Migrate: shift lesson numbers after adding 112 house words at the start of vocabulary
    // Old lesson 0 = "important..." (IELTS), now lesson 0 = "apartment..." (house)
    // IELTS words shifted by BEGINNING_LESSONS (23) positions
    if (!appState.houseMigrated && typeof BEGINNING_LESSONS !== 'undefined') {
        // Shift currentLesson
        if (appState.currentLesson > 0) {
            appState.currentLesson += BEGINNING_LESSONS;
        }
        // Shift all lesson history entries
        if (appState.lessonHistory && appState.lessonHistory.length > 0) {
            appState.lessonHistory = appState.lessonHistory.map(h => ({
                ...h,
                lessonNum: h.lessonNum + BEGINNING_LESSONS
            }));
        }
        // Shift mistake lessonNum references
        if (appState.mistakes && appState.mistakes.length > 0) {
            appState.mistakes = appState.mistakes.map(m => ({
                ...m,
                lessonNum: m.lessonNum !== undefined ? m.lessonNum + BEGINNING_LESSONS : m.lessonNum
            }));
        }
        appState.houseMigrated = true;
        saveUserData(currentUser, appState);
    }

    // Pet system migration
    if (appState.petName === undefined) appState.petName = null;
    if (appState.petHunger === undefined) appState.petHunger = appState.lastStudyDate === new Date().toDateString() ? 100 : 50;
    if (appState.petLastFed === undefined) appState.petLastFed = appState.lastStudyDate ? new Date(appState.lastStudyDate).getTime() : Date.now();
    if (appState.petAccessories === undefined) appState.petAccessories = [];
    if (appState.activeAccessories === undefined) appState.activeAccessories = [];
    if (appState.petQuest === undefined) appState.petQuest = { lastDate: null, questId: null, completed: false };
    // Dog coin economy migration
    if (appState.coins === undefined) appState.coins = Math.floor(appState.points * 0.5) || 0; // Welcome bonus
    if (appState.dogGrowthXP === undefined) appState.dogGrowthXP = Math.floor(appState.points * 0.3) || 0; // Seed from points
    // Only derive the level when the formula is actually loaded. Writing the
    // literal 1 when home.js failed to load (a half-updated service-worker
    // cache) branded the dog level 1 PERMANENTLY — the === undefined guard
    // then protected the wrong value on every later login. Left undefined,
    // every reader falls back to (appState.dogLevel || 1) for display and the
    // next healthy login derives the real level from XP.
    if (appState.dogLevel === undefined && typeof getDogLevel === 'function') appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    if (appState.lastDecayDate === undefined) appState.lastDecayDate = null;
    if (appState.petPoops === undefined) appState.petPoops = [];
    if (!Array.isArray(appState.petBattleCastleSkins)) appState.petBattleCastleSkins = ['stone-keep'];
    if (appState.petBattleCastleSkin === undefined) appState.petBattleCastleSkin = 'stone-keep';
    // Castle Night Raid is additive and local-first. Never replace a saved
    // layout or route when an existing learner receives the feature.
    if (appState.nightRaidRouteLevel === undefined) appState.nightRaidRouteLevel = 1;
    if (!appState.nightRaidStars || typeof appState.nightRaidStars !== 'object') appState.nightRaidStars = {};
    if (!Array.isArray(appState.nightRaidHistory)) appState.nightRaidHistory = [];
    if (appState.nightRaidLayout === undefined) appState.nightRaidLayout = null;
    if (appState.nightRaidPending === undefined) appState.nightRaidPending = null;
    if (appState.nightRaidTicketDate === undefined) appState.nightRaidTicketDate = null;
    if (appState.nightRaidTicketCount === undefined) appState.nightRaidTicketCount = 0;
    if (appState.nightRaidRewardDate === undefined) appState.nightRaidRewardDate = null;
    if (appState.nightRaidRewardToday === undefined) appState.nightRaidRewardToday = 0;
    if (!appState.nightRaidClaimed || typeof appState.nightRaidClaimed !== 'object') appState.nightRaidClaimed = {};
    if (appState.vaultCoins === undefined) appState.vaultCoins = 0;
    if (appState.nightShieldUntil === undefined) appState.nightShieldUntil = null;
    if (appState.nightRaidRuinedUntil === undefined) appState.nightRaidRuinedUntil = null;
    if (!appState.nightRaidResources || typeof appState.nightRaidResources !== 'object') appState.nightRaidResources = { wood:180, stone:120, food:160 };
    if (appState.nightRaidResourceAt === undefined) appState.nightRaidResourceAt = Date.now();
    // Has this profile ever pushed its wallet to the server?
    //
    // js/night-raid.js adoptServerCoins restores the wallet from
    // night_raid_homes.lootable_coins EXACTLY ONCE, for a device that has
    // nothing of its own to be authoritative with — a reinstall, or a second
    // phone signing in. It is gated on this flag, which was introduced without
    // being seeded: so on the first load after that shipped, every EXISTING
    // child looked like a fresh install, and any of them whose server mirror
    // was stale-high got a one-off refund with a cheerful toast.
    //
    // A profile that has already played Cướp Đêm is not a fresh install, and
    // anything it has built, earned or been raided for is proof of that. Say
    // so, so the restore does not fire for a wallet that needs no restoring.
    if (appState.nightRaidWalletSynced === undefined) {
        const played = !!(appState.nightRaidLayout
            || (Array.isArray(appState.nightRaidHistory) && appState.nightRaidHistory.length)
            || (appState.nightRaidClaimed && Object.keys(appState.nightRaidClaimed).length)
            || appState.nightRaidPending
            || appState.vaultCoins > 0);
        appState.nightRaidWalletSynced = played;
    }
    if (appState.coinDebt === undefined) appState.coinDebt = 0;
    if (appState.nightRaidHomeDirty === undefined) appState.nightRaidHomeDirty = false;

    // History recovery: if currentLesson > 0 but lessonHistory is missing/short, reconstruct it
    if (appState.currentLesson > 0) {
        if (!appState.lessonHistory || !Array.isArray(appState.lessonHistory)) {
            appState.lessonHistory = [];
        }
        // If history is shorter than currentLesson, fill in the gaps
        if (appState.lessonHistory.length < appState.currentLesson) {
            const existingLessons = new Set(appState.lessonHistory.map(h => h.lessonNum));
            for (let i = 0; i < appState.currentLesson; i++) {
                if (!existingLessons.has(i)) {
                    appState.lessonHistory.push({
                        lessonNum: i,
                        date: appState.createdAt || Date.now(),
                        points: 100,
                        accuracy: 80
                    });
                }
            }
            // Sort by lesson number
            appState.lessonHistory.sort((a, b) => a.lessonNum - b.lessonNum);
        }
    }

    saveUserData(currentUser, appState);

    // Retroactive accessory check for existing users
    if (appState.petName && typeof checkAccessoryUnlocks === 'function') {
        checkAccessoryUnlocks(appState);
    }

    // Apply saved theme
    applyTheme(appState.theme);

    // Update streak
    updateStreak();

    // Track absence for pet memory (between app opens)
    if (appState.petMemory && appState.petMemory.lastSeen) {
        const gapMs = Date.now() - appState.petMemory.lastSeen;
        const gapDays = Math.floor(gapMs / 86400000);
        if (gapDays > (appState.petMemory.longestAbsenceDays || 0)) {
            appState.petMemory.longestAbsenceDays = gapDays;
        }
        appState.petMemory.pendingAbsenceGreet = gapDays; // Used by pet to pick a phrase
    }
    if (!appState.petMemory) appState.petMemory = { lessonsTogether: 0, milestonesSeen: [] };
    appState.petMemory.lastSeen = Date.now();
    saveUserData(currentUser, appState);

    // Auto-select difficulty tab based on user's current lesson
    if (typeof getDifficultyLevel === 'function' && appState.currentLesson > 0) {
        const diff = getDifficultyLevel(appState.currentLesson);
        selectedDifficultyFilter = diff.key;
    }

    // Show main app
    document.getElementById('onboardingScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';

    // Highlight the correct difficulty chip
    document.querySelectorAll('.difficulty-chip').forEach(c => c.classList.remove('active'));
    const activeChip = document.querySelector(`.difficulty-chip[data-level="${selectedDifficultyFilter}"]`);
    if (activeChip) activeChip.classList.add('active');

    renderHome();
    renderProfile();
    // Rendering Home creates the shared screen containers that each practice
    // renderer expects. Restore only after that base UI is ready.
    setTimeout(restoreStudyCheckpoint, 0);

    // v3.37 — show the daily-streak modal once per local day, right after the
    // home screen is mounted. Delayed by a frame so the modal animates over a
    // already-rendered background instead of a blank screen.
    setTimeout(() => {
        if (typeof showDailyStreakModal === 'function') {
            try { showDailyStreakModal(); } catch (e) { /* non-fatal */ }
        }
    }, 250);
}

// Per-child state that lives in a module rather than in appState. Modules opt
// in by exposing a silent teardown; anything without one simply is not asked.
function forgetProfileState() {
    if (typeof pbForgetProfile === 'function') { try { pbForgetProfile(); } catch (e) {} }
    if (typeof NightRaid !== 'undefined' && NightRaid && typeof NightRaid.forgetProfile === 'function') {
        try { NightRaid.forgetProfile(); } catch (e) {}
    }
    // The trophy cabinet's once-a-session reconcile latch, and the friends
    // list the Profile screen paints before its own refresh lands.
    if (typeof cupsForgetProfile === 'function') { try { cupsForgetProfile(); } catch (e) {} }
    if (typeof friendsForgetProfile === 'function') { try { friendsForgetProfile(); } catch (e) {} }
    // Cướp Cô Hồn. Not its own close(): that one ends by re-arming the arena
    // poll, which would undo pbForgetProfile() two lines above. Its teardown
    // stops at the unlock, and leaves petBattleScreen exactly as
    // pbForgetProfile does, so the order of the two does not matter.
    if (typeof GhostOfferingEvent !== 'undefined' && GhostOfferingEvent
        && typeof GhostOfferingEvent.forgetProfile === 'function') {
        try { GhostOfferingEvent.forgetProfile(); } catch (e) {}
    }
    // Everything with a clock of its own. Each of these keeps ticking against
    // whatever appState is current, so a timer that outlives the switch spends
    // the NEXT child's minutes and banks into the next child's profile.
    if (typeof MathFight !== 'undefined' && MathFight && typeof MathFight.forgetProfile === 'function') {
        try { MathFight.forgetProfile(); } catch (e) {}
    }
    if (typeof examForgetProfile === 'function') { try { examForgetProfile(); } catch (e) {} }
    if (typeof warsForgetProfile === 'function') { try { warsForgetProfile(); } catch (e) {} }
    if (typeof mathTablesForgetProfile === 'function') { try { mathTablesForgetProfile(); } catch (e) {} }
    if (typeof verbsForgetProfile === 'function') { try { verbsForgetProfile(); } catch (e) {} }
    // The maths scratch pad: four sheets of the previous child's handwriting.
    if (typeof mathBoardForgetProfile === 'function') { try { mathBoardForgetProfile(); } catch (e) {} }

    // Every in-progress round. None of these has a clock, but all of them leak
    // by the same two roads: the is…Active() guards in switchScreen — which
    // asked B "You are in the middle of…" about A's work — and, worse,
    // buildStudyCheckpoint() below, which reads them at every save and writes
    // whichever it finds into localStorage tagged with the CURRENT user. A
    // round left standing by A was therefore saved under B's name and offered
    // back to B, "↩️ Đã mở lại bài đang làm dở", as if it were theirs.
    if (typeof unitsForgetProfile === 'function') { try { unitsForgetProfile(); } catch (e) {} }
    if (typeof phrasesForgetProfile === 'function') { try { phrasesForgetProfile(); } catch (e) {} }
    if (typeof wordformForgetProfile === 'function') { try { wordformForgetProfile(); } catch (e) {} }
    if (typeof rewriteForgetProfile === 'function') { try { rewriteForgetProfile(); } catch (e) {} }
    if (typeof collocForgetProfile === 'function') { try { collocForgetProfile(); } catch (e) {} }
    if (typeof grammarForgetProfile === 'function') { try { grammarForgetProfile(); } catch (e) {} }
    if (typeof mathForgetProfile === 'function') { try { mathForgetProfile(); } catch (e) {} }
    if (typeof retryDrillForgetProfile === 'function') { try { retryDrillForgetProfile(); } catch (e) {} }
    // The combo counter is COINS: petComboBonus() banks whatever has accrued at
    // the end of the next round to FINISH, whoever is playing by then.
    if (typeof petCheerForgetProfile === 'function') { try { petCheerForgetProfile(); } catch (e) {} }
    // The Home screen's "name your dog" flag, and the account-link failure
    // reason that js/friends.js turns into a sentence the child reads.
    if (typeof homeForgetProfile === 'function') { try { homeForgetProfile(); } catch (e) {} }
    if (typeof EngAuth !== 'undefined' && EngAuth && typeof EngAuth.forgetProfile === 'function') {
        try { EngAuth.forgetProfile(); } catch (e) {}
    }

    // ---- js/app.js's own per-child state -----------------------------------
    // A matching round in progress. Its screen is deactivated by switchUser,
    // but the words, the points and the wrong-word Set are the previous
    // child's, and buildStudyCheckpoint reads them.
    lessonState = {
        categoryId: null, lessonNumber: 0, words: [], currentRound: 0, totalRounds: 0,
        roundWords: [], selectedLeft: null, selectedRight: null, matchedPairs: 0,
        correctInLesson: 0, wrongInLesson: 0, lessonPoints: 0,
    };
    // "Have we already offered this child their unfinished work?" and "have we
    // already waited once for a lazy bank?" — both are about ONE child's login.
    // _studyCheckpointWaited was never reset anywhere: once A hit a slow bank,
    // B's own perfectly good checkpoint was thrown away instead of waited for.
    _studyCheckpointRestored = false;
    _studyCheckpointWaited = false;
    // Where the Home screen was left standing: A's history tab, A's page, and
    // the word band A was working through.
    currentHistoryTab = 'history';
    historyPage = 0;
    selectedDifficultyFilter = 'beginning';
    // Deliberately NOT cleared: _studyCheckpointListening and _updateRetryTimer.
    // Neither belongs to a child — the first is the page's set of save
    // listeners, which re-read currentUser on every save and write nothing
    // while there is no user, and removing them would leave the NEXT child
    // with no checkpointing at all; the second is the app-update nag. _profileOriginScreen is not cleared either: openProfile() sets it
    // before anything can read it.
}

function switchUser() {
    // Save current user data
    if (currentUser && appState) {
        saveUserData(currentUser, appState);
    }

    // Hand nothing of this child to the next one. Two children share one iPad
    // and battle each other on it; a live pet battle used to survive the
    // switch, and startPetBattleGame's "a live game keeps the screen" guard
    // then showed the SECOND child the first child's battle — their pet, their
    // castle — with the relay still animating turns nobody was controlling.
    forgetProfileState();

    // Reset and show onboarding
    currentUser = null;
    appState = null;
    rememberActiveUser(null);
    clearStudyCheckpoint();
    _studyCheckpointRestored = false;

    document.getElementById('bottomNav').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('onboardingScreen').classList.add('active');

    // Reset form
    document.getElementById('usernameInput').value = '';
    document.querySelectorAll('.avatar-option').forEach(o => {
        o.classList.remove('selected');
        o.setAttribute('aria-pressed', 'false');
    });
    const firstAvatar = document.querySelector('.avatar-option');
    firstAvatar.classList.add('selected');
    firstAvatar.setAttribute('aria-pressed', 'true');
    selectedAvatar = '😊';

    // Clear passcode inputs
    clearPasscodeInputs('create');
    clearPasscodeInputs('confirm');
    document.getElementById('passcodeError').textContent = '';

    checkExistingUsers();
}

function showDeleteModal(username) {
    userToDelete = username;
    document.getElementById('deleteModalText').textContent =
        `This will permanently delete "${username}" and all their progress.`;
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
    userToDelete = null;
}

function confirmDeleteUser() {
    if (!userToDelete) return;

    // Remove from users list
    let users = getUsers();
    users = users.filter(u => u !== userToDelete);
    saveUsers(users);

    const deletingActiveSession = rememberedActiveUser() === userToDelete;
    // Delete user data
    deleteUserData(userToDelete);
    if (deletingActiveSession) rememberActiveUser(null);

    closeDeleteModal();
    showToast('User deleted');

    // Refresh user list
    checkExistingUsers();
}

function updateStreak() {
    if (!appState) return;

    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (appState.lastStudyDate === today) {
        // Already studied today
    } else if (appState.lastStudyDate === yesterday) {
        // Continue streak on next study
    } else if (appState.lastStudyDate && appState.lastStudyDate !== today) {
        // Check streak shield before resetting
        if (appState.streakShields && appState.streakShields > 0) {
            appState.streakShields--;
            // Mark for celebration on next render (instead of toast)
            appState.pendingShieldCelebration = appState.streak || 0;
            // Roll lastStudyDate forward so streak doesn't break again tomorrow
            appState.lastStudyDate = new Date(Date.now() - 86400000).toDateString();
            unlockAchievement('shield-saver');
        } else {
            // Streak is being lost — record sad pet memory
            if (appState.streak >= 3 && !appState.petMemory) appState.petMemory = {};
            if (appState.streak >= 3) {
                appState.petMemory = appState.petMemory || {};
                appState.petMemory.lastStreakBroken = appState.streak;
                appState.petMemory.lastStreakBrokenDate = Date.now();
            }
            appState.streak = 0;
        }
    }
    saveUserData(currentUser, appState);
}

function recordStudy() {
    if (!appState) return;

    const today = new Date().toDateString();
    if (appState.lastStudyDate !== today) {
        if (appState.lastStudyDate === new Date(Date.now() - 86400000).toDateString()) {
            appState.streak++;
        } else {
            appState.streak = 1;
        }
        appState.lastStudyDate = today;

        if (appState.streak >= 3) unlockAchievement('streak-3');
        if (appState.streak >= 7) unlockAchievement('streak-7');
        if (appState.streak >= 14) unlockAchievement('streak-14');
        if (appState.streak >= 30) unlockAchievement('streak-30');

        // Update best streak
        if (appState.streak > (appState.bestStreak || 0)) {
            appState.bestStreak = appState.streak;
        }

        // Check for streak milestone celebration
        const prevMilestone = appState.lastStreakMilestone || 0;
        const milestone = STREAK_MILESTONES.find(m => m <= appState.streak && m > prevMilestone);
        if (milestone && typeof showStreakMilestone === 'function') {
            setTimeout(() => showStreakMilestone(milestone), 1500);
        }

        // Award streak shield if 3+ lessons today and shields < 3
        const todayCount = (appState.lessonHistory || []).filter(h =>
            new Date(h.date).toDateString() === today
        ).length;
        if (todayCount >= 3 && (appState.streakShields || 0) < 3) {
            appState.streakShields = (appState.streakShields || 0) + 1;
            showToast(`🛡️ Streak Shield earned! (${appState.streakShields}/3)`);
        }

        // Time-based achievements
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) unlockAchievement('night-owl');
        if (hour >= 5 && hour < 7) unlockAchievement('early-bird');
        const day = new Date().getDay();
        if (day === 0 || day === 6) unlockAchievement('weekend-warrior');
    }
    saveUserData(currentUser, appState);
}

let _profileOriginScreen = 'homeScreen';

// Five stable destinations own the bottom bar. Deeper activity screens inherit
// their parent highlight, so opening Grammar still reads as being inside Learn.
const NAV_GROUP_BY_SCREEN = Object.freeze({
    homeScreen: 'home',
    dailyTaskScreen: 'home',
    armoryScreen: 'home',
    learnHubScreen: 'learn',
    gradeFourScreen: 'learn',
    topicsScreen: 'learn',
    grammarScreen: 'learn',
    speedChallengeScreen: 'learn',
    phrasesScreen: 'learn',
    wordformScreen: 'learn',
    rewriteScreen: 'learn',
    petBattleScreen: 'arena',
    nightRaidScreen: 'arena',
    mathHubScreen: 'math',
    ptnkScreen: 'learn',
    readingScreen: 'learn',
    clozeScreen: 'learn',
    errorsScreen: 'learn',
    grammarVocabScreen: 'learn',
    phoneticsScreen: 'learn',
    examScreen: 'exam'
});

function setBottomNavActive(screenOrKey) {
    const key = NAV_GROUP_BY_SCREEN[screenOrKey] || screenOrKey || '';
    document.querySelectorAll('.nav-item').forEach(item => {
        const active = item.dataset && item.dataset.navKey === key;
        item.classList[active ? 'add' : 'remove']('active');
        item.setAttribute('aria-current', active ? 'page' : 'false');
    });
}

// Bottom-nav visibility is changed by several full-screen lessons and games.
// Those flows normally restore it on exit, but a reload, an interrupted async
// hand-off, or stale whiteboard state can leave the inline `display:none`
// behind after Home is already active. Home never has a legitimate full-screen
// child of its own, so make that state an invariant instead of relying on every
// feature's cleanup path being perfect.
function ensureHomeBottomNav() {
    const home = document.getElementById('homeScreen');
    const nav = document.getElementById('bottomNav');
    if (!home || !nav || !home.classList.contains('active') || !currentUser || !appState) return;

    const board = document.getElementById('mathBoardOverlay');
    const boardVisible = !!(board && !board.classList.contains('hidden'));
    if (boardVisible) return;

    // A killed/reloaded board used to leave this class behind. Its !important
    // CSS rule wins over `nav.style.display = 'flex'`, which explains why the
    // earlier one-shot repair in renderHome was not sufficient.
    if (document.documentElement.classList.contains('math-board-open')) {
        document.documentElement.classList.remove('math-board-open');
    }
    if (nav.style.display !== 'flex') nav.style.display = 'flex';
    if (nav.hasAttribute('aria-hidden')) nav.removeAttribute('aria-hidden');
}

let _homeBottomNavObserver = null;
function installHomeBottomNavInvariant() {
    if (_homeBottomNavObserver || typeof MutationObserver === 'undefined') return;
    const home = document.getElementById('homeScreen');
    const nav = document.getElementById('bottomNav');
    if (!home || !nav) return;

    // Watch only the attributes that can affect this invariant. Observing the
    // whole app subtree caused needless work while animations were running.
    _homeBottomNavObserver = new MutationObserver(ensureHomeBottomNav);
    _homeBottomNavObserver.observe(home, { attributes: true, attributeFilter: ['class'] });
    _homeBottomNavObserver.observe(nav, { attributes: true, attributeFilter: ['style', 'aria-hidden'] });
    _homeBottomNavObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const board = document.getElementById('mathBoardOverlay');
    if (board) _homeBottomNavObserver.observe(board, { attributes: true, attributeFilter: ['class'] });
    ensureHomeBottomNav();
}

function renderLearnHub() {
    const label = document.getElementById('learnDueText');
    if (!label) return;
    let due = 0;
    try {
        due = typeof getReviewCount === 'function' ? Math.max(0, getReviewCount()) : 0;
    } catch (e) { due = 0; }
    label.textContent = due
        ? due + (due === 1 ? ' word is ready to review.' : ' words are ready to review.')
        : 'Nothing due yet — practise again to build your queue.';
}

// Returns FALSE when the switch did not happen — a guard below asked the child
// and they chose to stay, or the screen does not exist. Callers that do more
// than switch (openPetBattle starts polling) MUST check it: carrying on after a
// refusal is how the Arena once ended up running behind a live đề thi.
function switchScreen(screenId) {
    // Guard the live Ghost Offering scene. Previously the bottom navigation
    // merely hid the Arena screen, leaving go-event-active/overflow:hidden on
    // it. Returning to Arena then showed a lobby that could no longer scroll.
    if (screenId !== 'petBattleScreen' &&
        typeof GhostOfferingEvent !== 'undefined' &&
        GhostOfferingEvent.isActive && GhostOfferingEvent.isActive()) {
        if (!confirm('Con đang chơi Cướp Cô Hồn.\nThoát bây giờ thì dây đang kéo sẽ bị bỏ.\n\nCon có chắc muốn thoát không?')) {
            return false;
        }
        GhostOfferingEvent.close();
    }

    // Guard: warn before leaving an in-progress grammar exam (tapping a different
    // bottom-nav tab would otherwise silently discard the user's answers).
    if (screenId !== 'grammarScreen' &&
        typeof isGrammarQuizActive === 'function' && isGrammarQuizActive()) {
        if (!confirm('You are in the middle of an exam.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false; // stay on the quiz
        }
        if (typeof abandonGrammarQuiz === 'function') abandonGrammarQuiz();
    }

    // Guard: warn before leaving an in-progress timed exam (Exam tab, or the
    // PTNK tab — both run on the same engine, each on its own screen).
    const _examOwnScreen = (typeof _examSetCfg === 'function') ? _examSetCfg().screen : 'examScreen';
    if (screenId !== _examOwnScreen &&
        typeof isExamActive === 'function' && isExamActive()) {
        if (!confirm('You are in the middle of a timed exam.\nIf you leave now, your progress will be lost and it will NOT be saved.\n\nLeave anyway?')) {
            return false; // stay on the exam
        }
        if (typeof abandonExam === 'function') abandonExam();
    }

    // Guard: warn before leaving an in-progress Word form practice.
    if (screenId !== 'wordformScreen' &&
        typeof isWordformQuizActive === 'function' && isWordformQuizActive()) {
        if (!confirm('You are in the middle of a Word form practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonWordformQuiz === 'function') abandonWordformQuiz();
    }

    // Guard: warn before leaving an in-progress Toán 7 round — or the retry
    // drill, which is just as easy to lose to a mis-tap on the bottom bar.
    // Asked in Vietnamese because the whole tab is.
    if (screenId !== 'mathHubScreen' &&
        ((typeof isMathQuizActive === 'function' && isMathQuizActive()) ||
         (typeof retryDrillKey === 'function' && retryDrillKey() === 'math'))) {
        if (!confirm('Con đang làm dở bài Toán.\nRa khỏi bây giờ thì phần đã làm sẽ mất.\n\nVẫn ra chứ?')) {
            return false;
        }
        if (typeof abandonMathQuiz === 'function') abandonMathQuiz();
        if (typeof abandonRetryDrill === 'function' &&
            typeof retryDrillKey === 'function' && retryDrillKey() === 'math') {
            abandonRetryDrill();
        }
    }

    // Guard: warn before walking out of a live Đấu Toán. Unlike a quiz, this
    // one has another child sitting on the other side and 200 coins on the
    // table — leaving IS a loss, so say so before it happens rather than
    // letting the server's walk-away timer decide 20 seconds later.
    if (screenId !== 'mathHubScreen' &&
        typeof MathFight !== 'undefined' && MathFight.isFighting && MathFight.isFighting()) {
        if (!confirm('Con đang đấu toán với bạn.\n\nThoát bây giờ sẽ ĐÓNG trận và chấm điểm luôn — con bị XỬ THUA và mất tiền cược.\n\nVẫn thoát?')) {
            return false; // stay in the fight
        }
        if (MathFight.forfeitNow) MathFight.forfeitNow();
    }

    // Guard: the Math Wars round. Its own guard rather than a clause on the
    // one above, because what is lost is different — two minutes of a timed
    // round that is scored only when it ends, so walking out mid-way scores
    // nothing at all.
    if (screenId !== 'mathHubScreen' &&
        typeof isWarsActive === 'function' && isWarsActive()) {
        const left = (typeof warsClockText === 'function' && typeof warsLeftMs === 'function')
            ? warsClockText(warsLeftMs()) : '';
        if (!confirm('Con đang trong trận Math Wars' + (left ? ', còn ' + left : '') + '.\n'
                   + 'Ra bây giờ thì trận này không được tính điểm.\n\nVẫn ra chứ?')) {
            return false;
        }
        if (typeof abandonWars === 'function') abandonWars();
    }

    // Guard: a bảng cửu chương round. Under a minute, scored only when it
    // ends — the shortest clock in the app and therefore the easiest to lose
    // to a mis-tap on the nav bar.
    if (screenId !== 'mathHubScreen' &&
        typeof isMathTablesActive === 'function' && isMathTablesActive()) {
        const left = (typeof mathTablesClockText === 'function' && typeof mathTablesLeftMs === 'function')
            ? mathTablesClockText(mathTablesLeftMs()) : '';
        if (!confirm('Con đang làm bảng cửu chương' + (left ? ', còn ' + left : '') + '.\n'
                   + 'Ra bây giờ thì lượt này không được tính điểm.\n\nVẫn ra chứ?')) {
            return false;
        }
        if (typeof abandonMathTables === 'function') abandonMathTables();
    }

    // Guard: a live Night Raid. The raid stage hides the bottom bar, so this is
    // a backstop rather than the front line — but the server has already
    // written the raid row by the time the army marches, and start.js refuses
    // a second visit to the same home today, so leaving costs the house.
    // NightRaid.close() asks and clears the raid before it calls us, so a child
    // who has already answered is never asked twice.
    if (screenId !== 'nightRaidScreen' &&
        typeof NightRaid !== 'undefined' && NightRaid.isRaiding && NightRaid.isRaiding()) {
        if (!confirm('Con đang cướp nhà bạn.\nBỏ ngang thì hôm nay không vào lại nhà này được nữa, và không nhận được xu nào.\n\nVẫn thoát?')) {
            return false;
        }
        if (NightRaid.abandonRaid) NightRaid.abandonRaid();
    }

    // Guard: Phrases and Collocation share one screen, and BOTH were missing
    // from this list — a mis-tap on the bottom bar ended either practice with
    // no question asked at all.
    if (screenId !== 'phrasesScreen' &&
        typeof isPhrasesQuizActive === 'function' && isPhrasesQuizActive()) {
        if (!confirm('You are in the middle of a Phrases practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonPhrasesQuiz === 'function') abandonPhrasesQuiz();
    }

    if (screenId !== 'phrasesScreen' &&
        typeof isCollocActive === 'function' && isCollocActive()) {
        if (!confirm('You are in the middle of a Collocation practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonCollocPractice === 'function') abandonCollocPractice();
    }

    // Guard: the Grade 4 units practice has its own Learn destination.
    if (screenId !== 'gradeFourScreen' &&
        typeof isUnitPracticeActive === 'function' && isUnitPracticeActive()) {
        if (!confirm('You are in the middle of a practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonUnitPractice === 'function') abandonUnitPractice();
    }

    // Guard: warn before leaving an in-progress Rewrite practice.
    if (screenId !== 'rewriteScreen' &&
        typeof isRewriteQuizActive === 'function' && isRewriteQuizActive()) {
        if (!confirm('You are in the middle of a Rewrite practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonRewriteQuiz === 'function') abandonRewriteQuiz();
    }

    const nextScreen = document.getElementById(screenId);
    if (!nextScreen) return false;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    nextScreen.classList.add('active');

    setBottomNavActive(screenId);

    // The Grammar and Exam banks are 4.7 MB and no longer block the first
    // paint (js/lazy-data.js). Render such a tab only once its bank has
    // arrived, or the child meets an empty question list. Everything else
    // renders synchronously exactly as before.
    if (typeof LazyData !== 'undefined' && LazyData.filesFor(screenId).length) {
        const paint = () => {
            if (screenId === 'grammarScreen' && typeof renderGrammarHome === 'function') renderGrammarHome();
            else if (screenId === 'examScreen' && typeof renderExamHome === 'function') renderExamHome();
            else if (screenId === 'ptnkScreen' && typeof renderPtnkHome === 'function') renderPtnkHome();
            else if (screenId === 'readingScreen' && typeof renderReadingHome === 'function') renderReadingHome();
            else if (screenId === 'clozeScreen' && typeof renderClozeHome === 'function') renderClozeHome();
            else if (screenId === 'errorsScreen' && typeof renderErrorsHome === 'function') renderErrorsHome();
            else if (screenId === 'grammarVocabScreen' && typeof renderGrammarVocabHome === 'function') renderGrammarVocabHome();
            else if (screenId === 'phoneticsScreen' && typeof renderPhoneticsHome === 'function') renderPhoneticsHome();
            else if (screenId === 'phrasesScreen' && typeof renderPhrasesHome === 'function') renderPhrasesHome();
            else if (screenId === 'wordformScreen' && typeof renderWordformHome === 'function') renderWordformHome();
            else if (screenId === 'rewriteScreen' && typeof renderRewriteHome === 'function') renderRewriteHome();
            else if (screenId === 'mathHubScreen' && typeof renderMathHome === 'function') renderMathHome();
        };
        // ensure() is a no-op once the bank is in, but it also records this as
        // the tab to warm next time — so call it either way.
        if (LazyData.ready(screenId)) { LazyData.ensure(screenId); paint(); }
        else {
            const target = document.getElementById(screenId);
            if (target && !target.innerHTML.trim()) {
                target.innerHTML = '<div class="lazy-loading" role="status">Đang tải bài…</div>';
            }
            LazyData.ensure(screenId).then(() => {
                // The child may have moved on while it downloaded.
                if (document.getElementById(screenId)?.classList.contains('active')) paint();
            });
        }
        nextScreen.scrollTop = 0;
        return true;
    }

    if (screenId === 'homeScreen') renderHome();
    if (screenId === 'learnHubScreen') renderLearnHub();
    if (screenId === 'gradeFourScreen' && typeof renderGrade4Home === 'function') renderGrade4Home();
    if (screenId === 'mathHubScreen' && typeof renderMathHome === 'function') renderMathHome();
    if (screenId === 'speedChallengeScreen') renderSpeedChallenge();
    if (screenId === 'phrasesScreen' && typeof renderPhrasesHome === 'function') renderPhrasesHome();
    if (screenId === 'wordformScreen' && typeof renderWordformHome === 'function') renderWordformHome();
    if (screenId === 'rewriteScreen' && typeof renderRewriteHome === 'function') renderRewriteHome();
    if (screenId === 'examScreen' && typeof renderExamHome === 'function') renderExamHome();
    if (screenId === 'ptnkScreen' && typeof renderPtnkHome === 'function') renderPtnkHome();
    if (screenId === 'readingScreen' && typeof renderReadingHome === 'function') renderReadingHome();
    if (screenId === 'clozeScreen' && typeof renderClozeHome === 'function') renderClozeHome();
    if (screenId === 'errorsScreen' && typeof renderErrorsHome === 'function') renderErrorsHome();
    if (screenId === 'grammarVocabScreen' && typeof renderGrammarVocabHome === 'function') renderGrammarVocabHome();
    if (screenId === 'phoneticsScreen' && typeof renderPhoneticsHome === 'function') renderPhoneticsHome();
    if (screenId === 'profileScreen') renderProfile();

    // Do this after rendering: Home replaces its pet hero contents, and scroll
    // anchoring can otherwise restore the old offset after we reset it.
    nextScreen.scrollTop = 0;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            if (nextScreen.classList.contains('active')) nextScreen.scrollTop = 0;
        });
    }
    return true;
}

function navigateToProfile() {
    // Remember which screen we came from
    const activeScreen = document.querySelector('.screen.active');
    _profileOriginScreen = activeScreen ? activeScreen.id : 'homeScreen';

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const profileScreen = document.getElementById('profileScreen');
    profileScreen.classList.add('active');
    profileScreen.scrollTop = 0;

    // Clear nav highlight (profile is no longer a nav tab)
    setBottomNavActive('');

    renderProfile();
}

function navigateFromProfile() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(_profileOriginScreen).classList.add('active');

    setBottomNavActive(_profileOriginScreen);

    if (_profileOriginScreen === 'homeScreen') renderHome();
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// All five characters, including both quote marks: an escaper that stops at
// &, < and > still lets a value break out of an attribute, which is where the
// user list puts a name (aria-label).
function appEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 2500);
}

function createConfetti() {
    const container = document.getElementById('confettiContainer');
    container.innerHTML = '';
    const colors = ['#58cc02', '#1cb0f6', '#ff9600', '#ff4b4b', '#ce82ff'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 0.5}s`;
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        container.appendChild(confetti);
    }

    setTimeout(() => container.innerHTML = '', 4000);
}

// ---- background app updates ---------------------------------------------
//
// install deliberately does NOT call skipWaiting(): swapping the worker under
// a child in the middle of a question is worse than running yesterday's build
// for another minute. The page, which knows whether a lesson or battle is in
// progress, activates the already-downloaded worker as soon as the app is idle.
// No child-facing button is needed.
let _updateReloading = false;
let _updateRetryTimer = null;

// Anything a child would lose by reloading. This is the SAME list switchScreen
// guards with a confirm() — an update that reloads must be at least as careful
// as tapping a nav tab, and the first version of this checked four of eleven.
const _BUSY_CHECKS = [
    'isCollocActive', 'isExamActive', 'isGrammarQuizActive', 'isMathQuizActive',
    'isMathTablesActive', 'isPhrasesQuizActive', 'isRewriteQuizActive',
    'isUnitPracticeActive', 'isWarsActive', 'isWordformQuizActive', 'isRetryDrillActive',
];
function _busyWithTimedActivity() {
    try {
        for (const name of _BUSY_CHECKS) {
            const fn = typeof globalThis !== 'undefined' ? globalThis[name] : undefined;
            if (typeof fn === 'function' && fn()) return true;
        }
        const speed = document.getElementById('speedGameOverlay');
        if (speed && speed.classList.contains('active')) return true;
        // Matching-pairs lessons predate the shared is…Active helpers. Treat
        // the visible lesson screen as work in progress so a background update
        // never makes the cards disappear under the child's finger.
        const lesson = document.getElementById('lessonScreen');
        if (lesson && lesson.classList.contains('active')) return true;
        if (typeof NightRaid !== 'undefined' && NightRaid.isRaiding && NightRaid.isRaiding()) return true;
        if (typeof MathFight !== 'undefined' && MathFight.isFighting && MathFight.isFighting()) return true;
        if (typeof GhostOfferingEvent !== 'undefined' && GhostOfferingEvent.isActive
            && GhostOfferingEvent.isActive()) return true;
        // A pet battle in progress is a live match against another child.
        if (typeof _pbGame !== 'undefined' && _pbGame) return true;
    } catch (e) { /* a missing tab is not a reason to withhold the update */ }
    return false;
}

function applyUpdateWhenSafe(reg) {
    if (_updateReloading) return;
    if (_busyWithTimedActivity()) {
        // Poll quietly until the child finishes. This timer belongs to the
        // page, not to one profile, so switching users must not clear it.
        if (!_updateRetryTimer) {
            _updateRetryTimer = setInterval(() => applyUpdateWhenSafe(reg), 10000);
        }
        return;
    }
    if (_updateRetryTimer) { clearInterval(_updateRetryTimer); _updateRetryTimer = null; }

    const waiting = reg.waiting || reg.installing;
    if (!waiting) return;
    // Save once more immediately before the reload. Most interactions already
    // save as they happen; this also covers a draft typed since the last
    // one-second checkpoint tick.
    try { if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint(); } catch (e) {}
    try {
        if (currentUser && appState && typeof saveUserData === 'function') {
            saveUserData(currentUser, appState);
        }
    } catch (e) {}

    _updateReloading = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    // `controllerchange` below is the only proof that the new worker actually
    // took over. Never force a timed reload back into the same waiting worker.
    setTimeout(() => {
        if (!_updateReloading) return;
        _updateReloading = false;
        if (!_updateRetryTimer) {
            _updateRetryTimer = setInterval(() => applyUpdateWhenSafe(reg), 60000);
        }
    }, 12000);
}

// The browser re-checks sw.js on every page load (updateViaCache: 'none'
// below), but a phone left open on the Home screen overnight never loads the
// page again, so it would keep yesterday's worker until someone reloads. Ask
// for a re-check when the tab comes back into view, at most once an hour: a
// check is one conditional request for sw.js, and a changed manifest then
// installs in the background and applyUpdateWhenSafe swaps it in when idle.
const SW_UPDATE_RECHECK_MS = 60 * 60 * 1000;
let _swLastCheck = 0;

function swUpdateDue(now, last) {
    return now - last >= SW_UPDATE_RECHECK_MS;
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(reg => {
            // Force a check on every load — gets us the freshest sw.js even
            // if the browser would otherwise cache it.
            reg.update();
            _swLastCheck = Date.now();

            // …and again when the app becomes visible after an hour away.
            // Guarded: an update() that rejects (offline, sw.js 5xx) must
            // never surface as an error in the page.
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState !== 'visible') return;
                const now = Date.now();
                if (!swUpdateDue(now, _swLastCheck)) return;
                _swLastCheck = now;
                try {
                    const p = reg.update();
                    if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch (e) { /* nothing to do: the next visible hour retries */ }
            });

            // Watch for an updated sw.js becoming available.
            reg.addEventListener('updatefound', () => {
                const installing = reg.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    // "installed" + an existing controller means a NEW SW is
                    // ready and waiting. The page applies it immediately when
                    // idle, or keeps retrying quietly until the activity ends.
                    if (installing.state === 'installed' &&
                        navigator.serviceWorker.controller) {
                        applyUpdateWhenSafe(reg);
                    }
                });
            });
            // A worker that finished installing while the app was closed is
            // already sitting in `waiting` when we register.
            if (reg.waiting && navigator.serviceWorker.controller) applyUpdateWhenSafe(reg);

            // Never reload a live lesson when a new worker takes over. The
            // current page can safely finish with the JS it already loaded.
            const wasControlled = !!navigator.serviceWorker.controller;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // Ignore the first-ever worker claiming a previously
                // uncontrolled page; that is installation, not an update.
                if (!wasControlled) return;
                // Only the idle-page handoff above arms this reload.
                if (_updateReloading) window.location.reload();
            });
        })
        .catch(() => {});
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Every word ships a pre-generated ElevenLabs recording (one voice for the
// whole app) at audio/words/<slug>.mp3 — see scripts/generate-word-audio.js,
// which must produce the same slugs.
//
// The MP3s live in their own Cloudflare Pages project (eng-pwa-audio), not in
// the app deploy: Pages caps a deployment at 20,000 files and the ~13,000
// recordings were crowding the app out of its own limit. Same Cloudflare CDN,
// same per-file URLs, and the service worker keys its audio cache by pathname
// so recordings cached before the move keep playing. New recordings go live
// with scripts/deploy-audio.sh.
const WORD_AUDIO_PATH = 'https://eng-pwa-audio.pages.dev/audio/words/';

// A word that is said as letters rather than read: "IT" the school subject is
// "eye-TEE". Lower-casing folds it into "it" the pronoun — the 22nd commonest
// word in the app — so the subject would forever play the pronoun's recording.
// The alias is keyed on the exact spelling, before the case is thrown away, and
// only a spelling no ordinary sentence uses may appear here. Mirrored in
// scripts/generate-word-audio.js; tests/word-audio.test.js keeps the two equal.
// `say` is what the browser voice is given when the recording has not reached
// the device — without it the fallback reads "IT" as the pronoun again, which
// is the very thing being fixed.
const AUDIO_SLUG_ALIASES = { IT: { slug: 'i-t', say: 'I.T.' } };

function audioAlias(word) {
    const raw = String(word).trim();
    return Object.prototype.hasOwnProperty.call(AUDIO_SLUG_ALIASES, raw) ? AUDIO_SLUG_ALIASES[raw] : null;
}

function wordAudioSlug(word) {
    const raw = String(word).trim();
    const alias = audioAlias(raw);
    if (alias) return alias.slug;
    return raw.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const audioCache = {};      // slug -> Audio element (preloading or ready)
const audioMissing = {};    // slug -> true (failed once; skip until next session)
let currentAudio = null;

// onDone (optional) fires when this word finishes, so callers can chain —
// answer-audio.js speaks "conclusive/ resign" as two words back to back.
// It fires on failure too, or a broken part would stall the chain forever.
// Stop an element and rewind it, without ever throwing.
//
// iOS Safari raises InvalidStateError when currentTime is set on a media
// element that has no source loaded — Chrome allows it silently, so this only
// ever fails on a phone. It matters far beyond the audio: speakWord() runs
// inside the matching-card onclick BEFORE selectCard(), so one throw here
// stopped every card tap on the lesson screen from registering.
function resetAudio(el) {
    if (!el) return;
    try { el.pause(); } catch (e) {}
    try { if (el.src && el.currentTime > 0) el.currentTime = 0; } catch (e) {}
}

function speakWord(word, onDone) {
    const finish = () => { if (typeof onDone === 'function') { try { onDone(); } catch (e) {} } };

    // Stop any currently playing audio
    if (currentAudio) {
        resetAudio(currentAudio);
        currentAudio = null;
    }

    const slug = wordAudioSlug(word);
    if (!slug || audioMissing[slug] || typeof Audio === 'undefined') {
        speakWordFallback(word);
        setTimeout(finish, 700);   // no 'ended' event to wait on
        return;
    }

    // Play the cached element itself. A cloneNode() here would copy the URL
    // but not the downloaded bytes, silently re-fetching the file on every
    // tap — the preload would never be the thing that actually plays.
    let audio = audioCache[slug];
    if (!audio) {
        audio = new Audio(WORD_AUDIO_PATH + slug + '.mp3');
        audio.preload = 'auto';
        audioCache[slug] = audio;
    }

    resetAudio(audio);
    currentAudio = audio;

    // A recording that is missing does not arrive as a 404. The recordings are
    // served by their own Pages project, and Pages answers an unknown path with
    // its index page: HTTP 200, text/html, 127 bytes. The element accepts that,
    // some browsers RESOLVE play() on it, and the failure surfaces later as an
    // `error` event — with only onended wired, nothing ran at all and the child
    // heard silence, with onDone never firing to release a chained word.
    let settled = false;
    const giveUp = () => {
        if (settled) return;
        settled = true;
        audioMissing[slug] = true;
        delete audioCache[slug];
        audio.onerror = null;
        speakWordFallback(word);
        setTimeout(finish, 700);
    };
    audio.onended = () => { if (!settled) { settled = true; finish(); } };
    audio.onerror = giveUp;
    audio.play().catch((err) => {
        if (isAutoplayBlock(err)) {
            // The browser refused because no gesture was in play. The file is
            // fine — blacklisting it here would send every later tap of this
            // word to the robot voice for the rest of the session.
            if (!settled) { settled = true; finish(); }
            return;
        }
        giveUp();
    });
}

// A refused autoplay is a policy decision, not a broken recording.
function isAutoplayBlock(err) {
    return !!err && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

// Speak several words back to back — "drink → drank → drunk".
//
// All of them go through ONE reused element, and that matters: phones only
// permit audio a user gesture started, and the gesture unlocks the specific
// element it played. Handing word two to a freshly-created element got its
// play() refused, which fell through to speakWordFallback and finished the
// sentence in the device's robot voice — a different, often male speaker
// halfway through the answer.
let sequenceAudio = null;

// opts.fallback === false → if a part cannot play, say nothing rather than
// substitute the device's robot voice. Used by the automatic pronunciation
// after answering: the student has to tap 🔊 anyway, and that tap plays the
// real recording, so a second speaker mid-answer is pure confusion.
function speakSequence(words, opts) {
    const allowFallback = !(opts && opts.fallback === false);
    const list = (words || []).map(w => String(w == null ? '' : w).trim()).filter(Boolean);
    if (!list.length) return 0;
    if (typeof Audio === 'undefined') {
        if (allowFallback) speakWordFallback(list[0]);
        return list.length;
    }

    if (currentAudio && currentAudio !== sequenceAudio) resetAudio(currentAudio);
    if (!sequenceAudio) sequenceAudio = new Audio();
    const el = sequenceAudio;
    try { el.pause(); } catch (e) {}
    currentAudio = el;

    let i = 0;
    const playNext = () => {
        if (i >= list.length) return;
        const word = list[i++];
        const slug = wordAudioSlug(word);
        if (!slug || audioMissing[slug]) {
            if (allowFallback) {
                speakWordFallback(word);
                setTimeout(playNext, 700);   // no 'ended' to wait on
            }
            return;
        }
        el.onended = playNext;
        // A freshly assigned src already starts at 0, and touching currentTime
        // before the media has loaded is exactly what iOS refuses.
        el.src = WORD_AUDIO_PATH + slug + '.mp3';
        el.play().catch((err) => {
            if (isAutoplayBlock(err)) return;   // stop quietly; the tap will play it
            audioMissing[slug] = true;
            if (allowFallback) {
                speakWordFallback(word);
                setTimeout(playNext, 700);
            }
        });
    };
    playNext();
    return list.length;
}

// Warm one word into the service-worker cache.
//
// This must NOT build an HTMLAudioElement. Opening a topic detail screen
// preloads every word in the topic — up to 851 — and one media element per
// word meant 851 of them alive at once, each with preload="auto". Phones cap
// how many media elements can exist and the tab locks up; that is what froze
// the Topics screen after a couple of taps. A fetch costs nothing to keep,
// the service worker caches it identically, and playback still builds exactly
// one element, when the word is actually played.
function prefetchAudio(word) {
    warmWord(word);
}

// Warm a screen's worth of words: batched and idle-scheduled so a 400-word
// topic never floods the network or the main thread.
function preloadLessonAudio(words) {
    const list = (words || [])
        .map(w => (w && w.en) || w)
        .filter(w => typeof w === 'string' && w.trim());
    if (!list.length) return 0;

    const idle = (fn) => (typeof requestIdleCallback === 'function')
        ? requestIdleCallback(fn)
        : setTimeout(fn, 60);

    let i = 0;
    const step = () => {
        const batch = list.slice(i, i + WARM_BATCH);
        i += batch.length;
        batch.forEach(w => warmWord(w));
        if (i < list.length) idle(step);
    };
    step();               // first batch now, the rest as the device allows
    return list.length;
}

// ── Hot-word warming ────────────────────────────────────────────────────
// A safety net, not the main mechanism: twPrefetch() warms each question's own
// words as it renders, well before any of them can be tapped. HOT_WORDS
// (generated by scripts/build-hot-words.js) is a small ranked list — 100 words,
// 1.3 MB — warmed once so the very first taps, and taps on a slow or absent
// network, still land instantly.
//
// fetch(), not Audio elements: 1,000 media elements would be a memory
// problem, and the service worker caches the response either way.
// Words warmed so far (resume point). Keyed to the audio-cache version so a
// re-voiced set re-warms instead of being suppressed by an old completion mark.
const HOT_WORDS_FLAG = 'hotWordsWarmed-v2';
const WARM_BATCH = 6;
const warmedSlugs = new Set();             // fetched this session — never twice

// Pull one recording into the service-worker cache without creating a media
// element. Returns true if this call started the fetch. Used both by the hot
// list and by twPrefetch, which warms the current question's words while the
// student is still answering it (tap-to-hear only unlocks after they answer,
// so that whole window is free network time).
function warmWord(word) {
    const slug = wordAudioSlug(word);
    if (!slug || warmedSlugs.has(slug) || audioMissing[slug] || typeof fetch !== 'function') return false;
    warmedSlugs.add(slug);
    fetch(WORD_AUDIO_PATH + slug + '.mp3').catch(() => {});
    return true;
}

function warmHotWords(list) {
    list = list || (typeof HOT_WORDS !== 'undefined' ? HOT_WORDS : []);
    if (!list.length || typeof fetch !== 'function') return 0;

    // Never spend someone's data behind their back.
    const conn = (typeof navigator !== 'undefined' && navigator.connection) || null;
    if (conn && (conn.saveData || /(^|\W)2g$/.test(conn.effectiveType || ''))) return 0;

    // Resume where a previous visit stopped; skip entirely once finished.
    let i = 0;
    try { i = Math.max(0, parseInt(localStorage.getItem(HOT_WORDS_FLAG), 10) || 0); } catch (e) {}
    if (i >= list.length) return 0;

    const idle = (fn) => (typeof requestIdleCallback === 'function')
        ? requestIdleCallback(fn)
        : setTimeout(fn, 300);

    const step = () => {
        if (i >= list.length) return;
        const batch = list.slice(i, i + WARM_BATCH);
        i += batch.length;
        // Record progress as the batch is dispatched, not when it resolves:
        // a visit that ends mid-warm then resumes here instead of restarting.
        try { localStorage.setItem(HOT_WORDS_FLAG, String(i)); } catch (e) {}
        const done = () => idle(step);
        Promise.all(batch.map(w => {
            warmedSlugs.add(wordAudioSlug(w));
            return fetch(WORD_AUDIO_PATH + wordAudioSlug(w) + '.mp3').catch(() => {});
        })).then(done, done);
    };
    const remaining = list.length - i;   // captured before step() advances i
    idle(step);
    return remaining;
}

function speakWordFallback(word) {
    if (!('speechSynthesis' in window)) return;

    // A word said as letters has to be handed to the voice that way, or the
    // engine reads it as the ordinary word it is spelled like.
    const alias = audioAlias(word);
    if (alias && alias.say) word = alias.say;

    const synth = window.speechSynthesis;
    synth.cancel();

    // iOS Safari needs a brief pause after cancel() before speak() will work
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = synth.getVoices();
        const englishVoice = voices.find(v =>
            v.lang.startsWith('en') && v.name.includes('Female')
        ) || voices.find(v => v.lang.startsWith('en-US'))
          || voices.find(v => v.lang.startsWith('en'));

        if (englishVoice) utterance.voice = englishVoice;
        synth.speak(utterance);
    }, 50);
}

// Load voices when available
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    installHomeBottomNavInvariant();
    // The deferred question banks (js/lazy-data.js) start downloading once the
    // app is interactive, so a tab opened a few seconds later finds them
    // already in memory — without any of that weight in the first paint.
    if (typeof LazyData !== 'undefined') LazyData.warmSoon();
});
