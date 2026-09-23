// app.js - Core application logic, state management, and utilities

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

const achievements = [
    // Getting started
    { id: 'first-lesson', name: 'Baby Steps', icon: '🐣' },
    { id: 'lessons-5', name: 'High Five', icon: '🖐️' },
    { id: 'lessons-10', name: 'Super Student', icon: '💪' },
    { id: 'lessons-25', name: 'Bookworm', icon: '📚' },
    { id: 'lessons-50', name: 'Word Wizard', icon: '🧙' },
    { id: 'lessons-100', name: 'Genius Mind', icon: '🦸' },
    { id: 'all-lessons', name: 'Legend', icon: '👑' },

    // Streaks
    { id: 'streak-3', name: 'Hatching', icon: '🥚' },
    { id: 'streak-7', name: 'On Fire', icon: '🔥' },
    { id: 'streak-14', name: 'Unstoppable', icon: '🚀' },
    { id: 'streak-30', name: 'Super Streak', icon: '⚡' },

    // Points
    { id: 'points-100', name: 'Coin Collector', icon: '🪙' },
    { id: 'points-500', name: 'Treasure Hunter', icon: '💰' },
    { id: 'points-1000', name: 'High Roller', icon: '💎' },
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
    // The one exercise left in the app: a Book practice (js/units.js). It
    // comes back on the Word screen — the host of every Book set.
    if (typeof _unitQuiz !== 'undefined' && _unitQuiz) {
        const unitScreen = (typeof unitPracticeScreen === 'function') ? unitPracticeScreen() : 'wordScreen';
        return Object.assign(base, { kind:'units', screen: unitScreen, state:checkpointClone(_unitQuiz) });
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
    // A Book practice carries its words in the checkpoint, but its results
    // screen and the cards behind it read the lazy bank (js/word-data.js),
    // which no longer loads at startup (js/lazy-data.js). Reopening before it
    // lands would draw an empty screen, so wait — and come back here when it
    // arrives.
    if (checkpoint.kind !== 'units' || checkpoint.screen !== 'wordScreen') {
        // A checkpoint of an exercise this app no longer has (an older build's
        // grammar quiz, a maths round) is simply dropped.
        clearStudyCheckpoint();
        return false;
    }
    const notReady = typeof LazyData !== 'undefined' && !LazyData.ready('wordScreen') ? ['wordScreen'] : [];
    if (notReady.length) {
        // Ask ONCE. LazyData resolves even when a bank fails to download (a
        // tab must render what it has rather than spin), so `ready()` can
        // still be false when this promise settles — and re-arming on that was
        // an unbroken microtask loop with nothing to yield to. A learner who
        // was mid-quiz when the bank failed to load came back to a frozen page
        // with no error, and because the checkpoint was never cleared, to a
        // frozen page on EVERY open for the next 24 hours.
        if (_studyCheckpointWaited) { clearStudyCheckpoint(); return false; }
        _studyCheckpointWaited = true;
        Promise.all(notReady.map(g => LazyData.ensure(g))).then(() => restoreStudyCheckpoint());
        return false;
    }
    _studyCheckpointRestored = true;
    const s = checkpoint.state;
    try {
        activateCheckpointScreen('wordScreen');
        _unitQuiz = s;
        // Put the engine on the practice's set first, or the header names the
        // wrong book.
        if (s && s.unit && typeof _unitParse === 'function' && typeof switchUnitSet === 'function') {
            switchUnitSet(_unitParse(s.unit).set);
        }
        ['wordUnitsBar','wordSubTabs','wordHistory'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = 'none';
        });
        renderUnitQuestion();
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
    { key: 'unitsHistory', keep: 'head' },
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
        totalCorrect: 0,
        totalAnswers: 0,
        achievements: [],
        unitsHistory: [], // Book practices: { unit:'pr1-3', score, total, date, wrong:[…], skills:[…] }
        createdAt: Date.now(),
        streakShields: 0,
        bestStreak: 0,
        lastStreakMilestone: 0,
        theme: 'default',
        stickers: [],
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
        pendingShieldCelebration: null    // Streak count to celebrate after shield-saved
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
    if (typeof ActivityClock !== 'undefined') ActivityClock.hook();
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

    // Migrate: add fun features state for existing users
    if (!Array.isArray(appState.achievements)) appState.achievements = [];
    if (appState.streakShields === undefined) appState.streakShields = 0;

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
    if (appState.petBattleCastleSkin === undefined) appState.petBattleCastleSkin = 'stone-keep';
    // Nông trại (the learner's own home: js/night-raid.js) is additive and
    // local-first. Never replace a saved layout when an existing learner
    // receives the feature.
    if (appState.nightRaidLayout === undefined) appState.nightRaidLayout = null;
    if (appState.vaultCoins === undefined) appState.vaultCoins = 0;
    // Has this profile ever pushed its wallet to the server?
    //
    // js/night-raid.js adoptServerCoins restores the wallet from
    // night_raid_homes.lootable_coins EXACTLY ONCE, for a device that has
    // nothing of its own to be authoritative with — a reinstall, or a second
    // phone signing in. It is gated on this flag, which was introduced without
    // being seeded: so on the first load after that shipped, every EXISTING
    // profile looked like a fresh install, and any of them whose server mirror
    // was stale-high got a one-off refund with a cheerful toast.
    //
    // A profile that has already built something is not a fresh install. Say
    // so, so the restore does not fire for a wallet that needs no restoring.
    if (appState.nightRaidWalletSynced === undefined) {
        appState.nightRaidWalletSynced = !!(appState.nightRaidLayout || appState.vaultCoins > 0);
    }
    // Left behind by features this app no longer has (raiding, the Arena,
    // the old lessons). Dropped so the blob stops carrying them — nothing
    // reads them, and appstate-quota shedding never touched them.
    for (const k of ['nightRaidRouteLevel', 'nightRaidStars', 'nightRaidHistory', 'nightRaidPending',
        'nightRaidTicketDate', 'nightRaidTicketCount', 'nightRaidRewardDate', 'nightRaidRewardToday',
        'nightRaidClaimed', 'nightShieldUntil', 'nightRaidRuinedUntil', 'nightRaidResources', 'nightRaidResourceAt',
        'petBattleCastleSkins', 'battleHistory', 'srs', 'reviewsCompleted', 'lessonHistory', 'mistakes',
        'currentLesson', 'dailyChallenge', 'wordOfDayViewed', 'sentences', 'grammarHistory', 'phrasesHistory',
        'collocHistory', 'wordformHistory', 'rewriteHistory', 'mathHistory', 'warsHistory', 'speedChallenge',
        'ptnkHistory', 'readingHistory', 'clozeHistory', 'errorsHistory', 'grammarVocabHistory', 'phoneticsHistory',
        'allowMathFight', 'allowBot', 'allowChuyen', 'cuuchuongSeconds', 'unitsSet',
        'topicProgress', 'grammarMistakes', 'wordformMistakes', 'rewriteMistakes', 'phrasesMistakes']) {
      if (k in appState) delete appState[k];
    }
    if (appState.coinDebt === undefined) appState.coinDebt = 0;
    if (appState.nightRaidHomeDirty === undefined) appState.nightRaidHomeDirty = false;

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

    // Show main app
    document.getElementById('onboardingScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';

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
    // Nông trại: the farm's builder state, timers and yard scene.
    if (typeof NightRaid !== 'undefined' && NightRaid && typeof NightRaid.forgetProfile === 'function') {
        try { NightRaid.forgetProfile(); } catch (e) {}
    }
    // The in-progress Book practice. It has no clock, but it leaks by two
    // roads: the isUnitPracticeActive() guard in switchScreen — which asked B
    // "You are in the middle of…" about A's work — and, worse,
    // buildStudyCheckpoint() below, which reads it at every save and writes
    // whatever it finds into localStorage tagged with the CURRENT user. A
    // round left standing by A was therefore saved under B's name and offered
    // back to B, "↩️ Đã mở lại bài đang làm dở", as if it were theirs.
    if (typeof unitsForgetProfile === 'function') { try { unitsForgetProfile(); } catch (e) {} }
    if (typeof retryDrillForgetProfile === 'function') { try { retryDrillForgetProfile(); } catch (e) {} }
    // The combo counter is COINS: petComboBonus() banks whatever has accrued at
    // the end of the next round to FINISH, whoever is playing by then.
    if (typeof petCheerForgetProfile === 'function') { try { petCheerForgetProfile(); } catch (e) {} }
    // The Home screen's "name your dog" flag, and the account-link failure reason.
    if (typeof homeForgetProfile === 'function') { try { homeForgetProfile(); } catch (e) {} }
    if (typeof EngAuth !== 'undefined' && EngAuth && typeof EngAuth.forgetProfile === 'function') {
        try { EngAuth.forgetProfile(); } catch (e) {}
    }

    // ---- js/app.js's own per-child state -----------------------------------
    // "Have we already offered this child their unfinished work?" and "have we
    // already waited once for a lazy bank?" — both are about ONE child's login.
    // _studyCheckpointWaited was never reset anywhere: once A hit a slow bank,
    // B's own perfectly good checkpoint was thrown away instead of waited for.
    _studyCheckpointRestored = false;
    _studyCheckpointWaited = false;
    // Deliberately NOT cleared: _studyCheckpointListening and _updateRetryTimer.
    // Neither belongs to a profile — the first is the page's set of save
    // listeners, which re-read currentUser on every save and write nothing
    // while there is no user, and removing them would leave the NEXT profile
    // with no checkpointing at all; the second is the app-update nag.
    // _profileOriginScreen is not cleared either: openProfile() sets it
    // before anything can read it.
}

function switchUser() {
    // Save current user data
    if (currentUser && appState) {
        saveUserData(currentUser, appState);
    }

    // Hand nothing of this profile to the next one: two profiles can share a
    // device, and a round left standing used to be offered to the wrong one.
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

        // Award streak shield if 3+ Book practices today and shields < 3
        const todayCount = (appState.unitsHistory || []).filter(h =>
            h && new Date(h.date).toDateString() === today
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

// Five stable destinations own the bottom bar: Home, the three Books and
// Nông trại. Deeper screens inherit their parent highlight. The Word screen
// is shared by the three Books, so its key is whichever book is open.
const NAV_GROUP_BY_SCREEN = Object.freeze({
    homeScreen: 'home',
    dailyTaskScreen: 'home',
    profileScreen: 'home',
    nightRaidScreen: 'farm',
});
const NAV_KEY_BY_BOOK = Object.freeze({ pr1: 'book1', pr2: 'book2', pr3: 'book3' });
function navKeyForScreen(screenOrKey) {
    if (screenOrKey === 'wordScreen') {
        const set = (typeof currentUnitSet === 'function') ? currentUnitSet('word') : 'pr1';
        return NAV_KEY_BY_BOOK[set] || 'book1';
    }
    return NAV_GROUP_BY_SCREEN[screenOrKey] || screenOrKey || '';
}

function setBottomNavActive(screenOrKey) {
    const key = navKeyForScreen(screenOrKey);
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
    ensureHomeBottomNav();
}

// ---- doors into code that is not loaded yet -------------------------------
//
// The farm's script (js/lazy-data.js GROUP_FILES.farm: js/night-raid.js)
// does not load at startup, but the bottom bar and the Daily Task card call
// openNightRaid() by name. Until the group lands, that name is this
// placeholder: switch to the screen — which draws the "Đang tải…" line and
// starts the download, exactly as a deferred tab does — then call the real
// function, which js/night-raid.js declares under the SAME name and so
// replaces the placeholder the moment it runs. After that first visit the
// placeholder is gone and a tap goes straight to the real thing.
function lazyEntry(group, name, screenId) {
    const placeholder = function () {
        const args = Array.from(arguments);
        if (typeof LazyData === 'undefined') return Promise.resolve();
        // switchScreen asks before walking out of a live quiz. A "no" must
        // stop everything, not merely delay the Arena until the download ends.
        if (switchScreen(screenId) === false) return Promise.resolve();
        return LazyData.ensure(group).then(() => {
            const real = globalThis[name];
            // The download failed (LazyData resolves anyway). Calling the
            // placeholder again would loop; say so and leave the child where
            // they are.
            if (typeof real !== 'function' || real === placeholder) {
                const screen = document.getElementById(screenId);
                if (screen) screen.innerHTML = '<div class="lazy-loading" role="status">Không tải được. Kiểm tra mạng rồi thử lại nhé!</div>';
                return;
            }
            // The learner may have moved on while it downloaded.
            if (!document.getElementById(screenId)?.classList.contains('active')) return;
            return real.apply(null, args);
        });
    };
    return placeholder;
}
var openNightRaid = lazyEntry('farm', 'openNightRaid', 'nightRaidScreen');

// A Book tab: the shared Word screen, on that book's set. The set is chosen
// BEFORE the switch so the bottom bar highlights the right book at once, and
// the header names it (js/units.js renderWordHome).
function openBook(set) {
    // Another Book is a way out of a live round: the round is on one book's
    // words and switchScreen alone cannot tell (both books share wordScreen).
    if (typeof currentUnitSet === 'function' && set !== currentUnitSet('word')
        && typeof leaveWordRound === 'function' && !leaveWordRound()) return false;
    if (typeof switchUnitSet === 'function') switchUnitSet(set, { silent: true });
    if (switchScreen('wordScreen') === false) return false;
    return true;
}

// Ask before dropping a live Book practice or owed-words drill; returns false
// when the child chose to stay. Used where a round would be replaced ON the
// Word screen itself (another Book, a Daily Task deep link), which
// switchScreen's own-screen rule cannot see.
function leaveWordRound() {
    if (typeof isUnitPracticeActive === 'function' && isUnitPracticeActive()) {
        if (!confirm('You are in the middle of a practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) return false;
        if (typeof abandonUnitPractice === 'function') abandonUnitPractice();
    }
    if (typeof retryDrillKey === 'function' && retryDrillKey() === 'word') {
        if (!confirm('You are practising the words you got wrong.\nThey will still be waiting for you if you leave now.\n\nLeave anyway?')) return false;
        if (typeof abandonRetryDrill === 'function') abandonRetryDrill();
    }
    return true;
}

// Returns FALSE when the switch did not happen — a guard below asked and the
// learner chose to stay, or the screen does not exist. Callers that do more
// than switch MUST check it.
function switchScreen(screenId) {
    // A new screen is a new exercise as far as the parent's history clock
    // is concerned (js/auth.js ActivityClock).
    if (typeof ActivityClock !== 'undefined') ActivityClock.mark();
    // Guard: a Book practice (js/units.js) belongs to the Word screen. Its
    // three nav buttons all open that screen, so switching books mid-practice
    // asks too — the round is on one book's words.
    const _unitOwnScreen = (typeof unitPracticeScreen === 'function') ? unitPracticeScreen() : 'wordScreen';
    if (screenId !== _unitOwnScreen &&
        typeof isUnitPracticeActive === 'function' && isUnitPracticeActive()) {
        if (!confirm('You are in the middle of a practice.\nIf you leave now, your progress will be lost.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonUnitPractice === 'function') abandonUnitPractice();
    }

    // Guard: the owed-words drill (js/retrydrill.js, key 'word'). Nothing typed
    // is lost — each word is cleared the moment it is fixed — but the drill
    // itself used to outlive a tap on the bottom bar: it kept
    // isRetryDrillActive() true from whatever tab came next, which holds app
    // updates back (_busyWithTimedActivity) until some other drill replaced it.
    if (screenId !== 'wordScreen' &&
        typeof retryDrillKey === 'function' && retryDrillKey() === 'word') {
        if (!confirm('You are practising the words you got wrong.\nThey will still be waiting for you if you leave now.\n\nLeave anyway?')) {
            return false;
        }
        if (typeof abandonRetryDrill === 'function') abandonRetryDrill();
    }

    const nextScreen = document.getElementById(screenId);
    if (!nextScreen) return false;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    nextScreen.classList.add('active');

    setBottomNavActive(screenId);

    // The word bank does not block the first paint (js/lazy-data.js). Render
    // the Word screen only once its bank has arrived, or the learner meets an
    // empty card grid. The same wait covers CODE: filesFor('nightRaidScreen')
    // begins with the farm's own script (GROUP_FILES.farm); that screen has
    // no paint() entry because openNightRaid renders it once this returns.
    if (typeof LazyData !== 'undefined' && LazyData.filesFor(screenId).length) {
        const paint = () => {
            if (screenId === 'wordScreen' && typeof renderWordHome === 'function') renderWordHome();
        };
        // ensure() is a no-op once the bank is in, but it also records this as
        // the tab to warm next time — so call it either way.
        if (LazyData.ready(screenId)) { LazyData.ensure(screenId); paint(); }
        else {
            const target = document.getElementById(screenId);
            if (target && !target.innerHTML.trim()) {
                target.innerHTML = '<div class="lazy-loading" role="status">Đang tải bài…</div>';
            }
            // A screen whose stylesheet is still on its way (css/night-raid.css
            // — js/lazy-data.js) must not show its content
            // unstyled: the farm's opener renders synchronously right after
            // this call. Keep everything but the loading notice invisible
            // until the sheet has arrived, then let the modules that size
            // themselves from the DOM (the farm builder) re-measure.
            const cssPending = typeof LazyData.pendingCss === 'function' && LazyData.pendingCss(screenId).length > 0;
            if (cssPending) nextScreen.classList.add('lazy-css-pending');
            LazyData.ensure(screenId).then(() => {
                if (cssPending) {
                    nextScreen.classList.remove('lazy-css-pending');
                    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
                }
                // The child may have moved on while it downloaded.
                if (document.getElementById(screenId)?.classList.contains('active')) paint();
            });
        }
        nextScreen.scrollTop = 0;
        return true;
    }

    if (screenId === 'homeScreen') renderHome();
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
    'isUnitPracticeActive', 'isRetryDrillActive',
];
function _busyWithTimedActivity() {
    try {
        for (const name of _BUSY_CHECKS) {
            const fn = typeof globalThis !== 'undefined' ? globalThis[name] : undefined;
            if (typeof fn === 'function' && fn()) return true;
        }
    } catch (e) { /* a missing tab is not a reason to withhold the update */ }
    return false;
}

// When a reload costs the child nothing. "Not busy" was not enough: the
// moment a practice ENDS the child is on its results card with a finger
// already heading for "Practice again", and the 10-second poll fired right
// there — the page reloaded under the tap, went white for the whole cold
// start (on 3G, seconds), and the new round then came back out of the
// checkpoint "a long time later". A quiet moment is the app in the
// background (the best one: the reload lands before they look again), or a
// MENU screen with no tap for a while — never a results card, never a
// screen a child is reading.
const UPDATE_QUIET_SCREENS = ['homeScreen', 'profileScreen', 'dailyTaskScreen', 'onboardingScreen'];
const UPDATE_IDLE_MS = 20000;
let _lastInteractionAt = 0;
function noteInteraction() { _lastInteractionAt = Date.now(); }
function _updateQuietMoment() {
    try {
        if (typeof document !== 'undefined' && document.hidden) return true;
        const active = (typeof document !== 'undefined' && typeof document.querySelector === 'function')
            ? document.querySelector('.screen.active') : null;
        if (active && UPDATE_QUIET_SCREENS.indexOf(active.id) === -1) return false;
        return Date.now() - _lastInteractionAt >= UPDATE_IDLE_MS;
    } catch (e) { return true; }
}

function applyUpdateWhenSafe(reg) {
    if (_updateReloading) return;
    if (_busyWithTimedActivity() || !_updateQuietMoment()) {
        // Poll quietly until the child finishes AND the moment is quiet. This
        // timer belongs to the page, not to one profile, so switching users
        // must not clear it.
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

    // Relative, not '/sw.js': the app is at the origin root on Cloudflare
    // Pages but under /learn-eng-pwa/ on GitHub Pages, and an absolute path
    // 404'd there — the worker never installed, so no offline, no updates.
    // 'sw.js' resolves against the page, and the scope becomes the app root
    // in both cases.
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
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

            // The quiet-moment rule above needs to know when the child last
            // touched the app, and the app going to the background is the
            // best moment of all to swap the worker in.
            ['pointerdown', 'keydown', 'touchstart'].forEach(t =>
                document.addEventListener(t, noteInteraction, { capture: true, passive: true }));
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden' && (reg.waiting || reg.installing)) applyUpdateWhenSafe(reg);
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
// Where they are served from depends on the host the app is on:
//   - GitHub Pages (0x4123dev.github.io/learn-eng-pwa/): the repo carries
//     audio/words/ and Pages serves it, so the recordings are simply next to
//     the app — a relative path, no second host, nothing else to deploy.
//   - Cloudflare Pages: the MP3s live in their own project (eng-pwa-audio),
//     not in the app deploy — Pages caps a deployment at 20,000 files and the
//     ~13,000 recordings were crowding the app out of its own limit
//     (scripts/deploy-audio.sh ships them). The service worker keys its
//     audio cache by pathname so recordings cached before the move keep
//     playing.
// Both paths contain /audio/words/, which is what sw.js routes to the audio
// cache. The hostname is a parameter so the rule can be tested.
function wordAudioBase(hostname) {
    let host = hostname;
    if (host === undefined) {
        try { host = (typeof location !== 'undefined' && location.hostname) || ''; } catch (e) { host = ''; }
    }
    if (/(^|\.)github\.io$/.test(String(host))) return 'audio/words/';
    return 'https://eng-pwa-audio.pages.dev/audio/words/';
}
const WORD_AUDIO_PATH = wordAudioBase();

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

// ── The example sentence, read aloud ─────────────────────────────────────
// Answering a Word question reveals the sentence with the word filled in, and
// a 🔊 beside it plays the WHOLE sentence (js/units.js _unitExampleHTML).
// Recorded per WORD — a word owns one example sentence — under the same slug
// as its own recording: audio/words/<slug>.mp3 ↔ audio/sentences/<slug>.mp3
// (scripts/generate-sentence-audio.js). Only **Book 1** has them, and the
// button is only drawn there.
//
// Always a path relative to the page: these files ship inside this repo and
// are served by whatever host serves the app, unlike the word recordings,
// which live in their own Pages project when the app is on Cloudflare.
const SENTENCE_AUDIO_PATH = 'audio/sentences/';
const sentenceAudioCache = {};   // slug -> Audio element
const sentenceAudioMissing = {}; // slug -> true (failed once this session)

function sentenceAudioUrl(word) {
    const slug = wordAudioSlug(word);
    return slug ? SENTENCE_AUDIO_PATH + slug + '.mp3' : '';
}

// Play the recording of `word`'s example sentence. `text` (optional) is the
// sentence itself, spoken by the device voice only if the recording cannot
// play — better a robot reading than a button that does nothing.
function speakSentence(word, text) {
    const slug = wordAudioSlug(word);
    const fallback = () => { if (text) speakWordFallback(String(text)); };
    if (!slug || typeof Audio === 'undefined') { fallback(); return false; }
    if (sentenceAudioMissing[slug]) { fallback(); return false; }

    // One sentence at a time, and never over a word recording.
    if (currentAudio) { resetAudio(currentAudio); currentAudio = null; }

    let audio = sentenceAudioCache[slug];
    if (!audio) {
        audio = new Audio(SENTENCE_AUDIO_PATH + slug + '.mp3');
        audio.preload = 'auto';
        sentenceAudioCache[slug] = audio;
    }
    resetAudio(audio);
    currentAudio = audio;

    let settled = false;
    const giveUp = () => {
        if (settled) return;
        settled = true;
        // As with the words: a missing file can arrive as a 200 HTML page, so
        // the failure shows up as an `error` event rather than a rejection.
        sentenceAudioMissing[slug] = true;
        delete sentenceAudioCache[slug];
        audio.onerror = null;
        fallback();
    };
    audio.onended = () => { settled = true; };
    audio.onerror = giveUp;
    audio.play().catch(err => {
        if (isAutoplayBlock(err)) { settled = true; return; }
        giveUp();
    });
    return true;
}

// Warm a sentence so the 🔊 answers instantly. Silent about failures: this
// runs while the student is still typing.
function prefetchSentenceAudio(word) {
    try {
        const slug = wordAudioSlug(word);
        if (!slug || sentenceAudioMissing[slug] || sentenceAudioCache[slug] || typeof Audio === 'undefined') return;
        const audio = new Audio(SENTENCE_AUDIO_PATH + slug + '.mp3');
        audio.preload = 'auto';
        sentenceAudioCache[slug] = audio;
    } catch (e) {}
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
