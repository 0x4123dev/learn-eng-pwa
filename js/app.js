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

let _studyCheckpointTimer = null;
let _studyCheckpointRestored = false;

function clearStudyCheckpoint() {
    try { localStorage.removeItem(STUDY_CHECKPOINT_KEY); } catch (e) {}
}

function checkpointClone(state, without) {
    const copy = Object.assign({}, state || {});
    (without || []).forEach(key => { delete copy[key]; });
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
        return Object.assign(base, { kind:'units', screen:'topicsScreen', state:checkpointClone(_unitQuiz) });
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
        return Object.assign(base, { kind:'exam', screen:'examScreen', state });
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
    try {
        const checkpoint = buildStudyCheckpoint();
        if (checkpoint) localStorage.setItem(STUDY_CHECKPOINT_KEY, JSON.stringify(checkpoint));
        else clearStudyCheckpoint();
    } catch (e) { /* a checkpoint must never interrupt the exercise */ }
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
    _studyCheckpointRestored = true;
    const s = checkpoint.state;
    try {
        activateCheckpointScreen(checkpoint.screen);
        if (checkpoint.kind === 'grammar') { _grammarQuizState = s; renderGrammarQuestion(); }
        else if (checkpoint.kind === 'phrases') { _phrQuiz = s; renderPhrQuestion(); }
        else if (checkpoint.kind === 'wordform') { _wfQuiz = s; renderWfQuestion(); }
        else if (checkpoint.kind === 'rewrite') { _rwQuiz = s; renderRwQuestion(); }
        else if (checkpoint.kind === 'collocation') { _colQuiz = s; renderCollocQuestion(); }
        else if (checkpoint.kind === 'units') {
            _unitQuiz = s;
            ['topicsGrid','topicsReviewCard','topicsSrBanner','unitsBar','topicsSubTabs','topicsHistory'].forEach(id => {
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
    if (_studyCheckpointTimer) return;
    _studyCheckpointTimer = setInterval(saveStudyCheckpoint, 1000);
    window.addEventListener('pagehide', saveStudyCheckpoint);
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

function getUsers() {
    const users = localStorage.getItem('flashlingo-users');
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) {
    localStorage.setItem('flashlingo-users', JSON.stringify(users));
}

function getUserData(username) {
    const data = localStorage.getItem(`flashlingo-user-${username}`);
    return data ? JSON.parse(data) : null;
}

function saveUserData(username, data) {
    localStorage.setItem(`flashlingo-user-${username}`, JSON.stringify(data));
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
        card.innerHTML = `
            <button type="button" class="user-open-btn" aria-label="Open ${userData.username}'s profile">
                <span class="user-avatar" aria-hidden="true">${userData.avatar || '😊'}</span>
                <span class="user-info">
                    <span class="user-name">${userData.username}</span>
                    <span class="user-stats">⭐ ${userData.points} points · 🔥 ${userData.streak} streak</span>
                </span>
                <span class="user-arrow" aria-hidden="true">›</span>
            </button>
            <button type="button" class="delete-user-btn" aria-label="Delete ${userData.username}'s profile">🗑️</button>
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
    if (appState.dogLevel === undefined) appState.dogLevel = typeof getDogLevel === 'function' ? getDogLevel(appState.dogGrowthXP) : 1;
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
    if (!Array.isArray(appState.battleTeammates)) appState.battleTeammates = [];
    if (!appState.nightRaidResources || typeof appState.nightRaidResources !== 'object') appState.nightRaidResources = { wood:180, stone:120, food:160 };
    if (appState.nightRaidResourceAt === undefined) appState.nightRaidResourceAt = Date.now();

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

function switchUser() {
    // Save current user data
    if (currentUser && appState) {
        saveUserData(currentUser, appState);
    }

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
    learnHubScreen: 'learn',
    topicsScreen: 'learn',
    grammarScreen: 'learn',
    speedChallengeScreen: 'learn',
    phrasesScreen: 'learn',
    wordformScreen: 'learn',
    rewriteScreen: 'learn',
    petBattleScreen: 'arena',
    nightRaidScreen: 'arena',
    mathHubScreen: 'math',
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

function switchScreen(screenId) {
    // Guard: warn before leaving an in-progress grammar exam (tapping a different
    // bottom-nav tab would otherwise silently discard the user's answers).
    if (screenId !== 'grammarScreen' &&
        typeof isGrammarQuizActive === 'function' && isGrammarQuizActive()) {
        if (!confirm('You are in the middle of an exam.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return; // stay on the quiz
        }
        if (typeof abandonGrammarQuiz === 'function') abandonGrammarQuiz();
    }

    // Guard: warn before leaving an in-progress timed exam (Exam tab).
    if (screenId !== 'examScreen' &&
        typeof isExamActive === 'function' && isExamActive()) {
        if (!confirm('You are in the middle of a timed exam.\nIf you leave now, your progress will be lost and it will NOT be saved.\n\nLeave anyway?')) {
            return; // stay on the exam
        }
        if (typeof abandonExam === 'function') abandonExam();
    }

    // Guard: warn before leaving an in-progress Word form practice.
    if (screenId !== 'wordformScreen' &&
        typeof isWordformQuizActive === 'function' && isWordformQuizActive()) {
        if (!confirm('You are in the middle of a Word form practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return;
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
            return;
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
        if (!confirm('Con đang đấu toán với bạn.\nThoát bây giờ là XỬ THUA và mất tiền cược.\n\nVẫn thoát?')) {
            return; // stay in the fight
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
            return;
        }
        if (typeof abandonWars === 'function') abandonWars();
    }

    // Guard: warn before leaving an in-progress Rewrite practice.
    if (screenId !== 'rewriteScreen' &&
        typeof isRewriteQuizActive === 'function' && isRewriteQuizActive()) {
        if (!confirm('You are in the middle of a Rewrite practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return;
        }
        if (typeof abandonRewriteQuiz === 'function') abandonRewriteQuiz();
    }

    const nextScreen = document.getElementById(screenId);
    if (!nextScreen) return;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    nextScreen.classList.add('active');

    setBottomNavActive(screenId);

    if (screenId === 'homeScreen') renderHome();
    if (screenId === 'learnHubScreen') renderLearnHub();
    if (screenId === 'mathHubScreen' && typeof renderMathHome === 'function') renderMathHome();
    if (screenId === 'speedChallengeScreen') renderSpeedChallenge();
    if (screenId === 'phrasesScreen' && typeof renderPhrasesHome === 'function') renderPhrasesHome();
    if (screenId === 'wordformScreen' && typeof renderWordformHome === 'function') renderWordformHome();
    if (screenId === 'rewriteScreen' && typeof renderRewriteHome === 'function') renderRewriteHome();
    if (screenId === 'examScreen' && typeof renderExamHome === 'function') renderExamHome();
    if (screenId === 'profileScreen') renderProfile();

    // Do this after rendering: Home replaces its pet hero contents, and scroll
    // anchoring can otherwise restore the old offset after we reset it.
    nextScreen.scrollTop = 0;
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            if (nextScreen.classList.contains('active')) nextScreen.scrollTop = 0;
        });
    }
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

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then(reg => {
            // Force a check on every load — gets us the freshest sw.js even
            // if the browser would otherwise cache it.
            reg.update();

            // Watch for an updated sw.js becoming available.
            reg.addEventListener('updatefound', () => {
                const installing = reg.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    // "installed" + an existing controller means a NEW SW is
                    // ready. Leave it waiting: it activates after the learner
                    // naturally closes this app, never mid-question.
                    if (installing.state === 'installed' &&
                        navigator.serviceWorker.controller) {
                        console.log('[FlashLingo] Update downloaded — waiting for the next app open.');
                    }
                });
            });

            // Never reload a live lesson when a new worker takes over. The
            // current page can safely finish with the JS it already loaded;
            // the new cache is used on the next natural open/reload.
            const wasControlled = !!navigator.serviceWorker.controller;
            let updateNoticeShown = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // Ignore the first-ever worker claiming a previously
                // uncontrolled page; that is installation, not an update.
                if (!wasControlled || updateNoticeShown) return;
                updateNoticeShown = true;
                console.log('[FlashLingo] New version installed — will use it next time the app opens.');
                if (typeof showToast === 'function') showToast('✅ App updated — ready next time you open it');
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

function wordAudioSlug(word) {
    return String(word).toLowerCase().trim()
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
    audio.onended = finish;
    audio.play().catch((err) => {
        if (isAutoplayBlock(err)) {
            // The browser refused because no gesture was in play. The file is
            // fine — blacklisting it here would send every later tap of this
            // word to the robot voice for the rest of the session.
            finish();
            return;
        }
        audioMissing[slug] = true;
        delete audioCache[slug];
        speakWordFallback(word);
        setTimeout(finish, 700);
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

document.addEventListener('DOMContentLoaded', init);
