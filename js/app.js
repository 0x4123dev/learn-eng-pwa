// app.js - Core application logic, state management, and utilities

const WORDS_PER_LESSON = 5;
const TOTAL_LESSONS = Math.ceil(ieltsVocabulary.length / WORDS_PER_LESSON);
const SRS_WORDS_PER_REVIEW = 5;

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
    { id: 'hunter-10', name: 'Expert Hunter', icon: '🎯' },

    // Games
    { id: 'bubbles-first', name: 'Bubble Pop', icon: '🫧' },
    { id: 'bubbles-10', name: 'Bubble Mania', icon: '🎪' },
    { id: 'bubbles-perfect', name: 'Perfect Bubbles', icon: '💯' },

    // Music
    { id: 'rhythm-first', name: 'Beat Maker', icon: '🥁' },
    { id: 'rhythm-10', name: 'Rhythm Star', icon: '⭐' },
    { id: 'rhythm-perfect', name: 'Perfect Rhythm', icon: '🎵' },
    { id: 'chant-first', name: 'Chant Champion', icon: '🎤' },
    { id: 'syllable-sage', name: 'Syllable Sage', icon: '🔤' }
];

let currentUser = null;
let userToDelete = null;
let selectedAvatar = '😊';

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
        musicStats: {
            rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0, correctRounds: 0 },
            wordChant: { gamesPlayed: 0, correctQuizAnswers: 0 }
        }
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
    registerServiceWorker();

    // Show version on login screen
    var lv = document.getElementById('loginVersion');
    if (lv && typeof APP_VERSION !== 'undefined') lv.textContent = APP_VERSION;
}

function setupAvatarPicker() {
    const picker = document.getElementById('avatarPicker');
    picker.addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option) {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedAvatar = option.dataset.avatar;
        }
    });
}

function checkExistingUsers() {
    const users = getUsers();

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
            <div class="user-avatar">${userData.avatar || '😊'}</div>
            <div class="user-info">
                <div class="user-name">${userData.username}</div>
                <div class="user-stats">⭐ ${userData.points} points · 🔥 ${userData.streak} streak</div>
            </div>
            <button class="delete-user-btn" onclick="event.stopPropagation(); showDeleteModal('${username}')">🗑️</button>
            <span class="user-arrow">›</span>
        `;
        card.onclick = () => showPasscodeModal(username);
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
    if (appState.streakShields === undefined) appState.streakShields = 0;
    if (appState.theme === undefined) appState.theme = 'default';
    if (appState.stickers === undefined) appState.stickers = [];
    if (appState.dailyChallenge === undefined) appState.dailyChallenge = { lastDate: null, streak: 0, bestStreak: 0 };
    if (appState.wordOfDayViewed === undefined) appState.wordOfDayViewed = null;
    if (appState.sentences === undefined) appState.sentences = [];
    if (appState.battleHistory === undefined) appState.battleHistory = { wins: 0, losses: 0, draws: 0 };
    if (appState.bubblesStats === undefined) appState.bubblesStats = { gamesPlayed: 0, highScore: 0, bestRound: 0, totalScore: 0, totalStars: 0, wordsCollected: [], bestCombo: 0, wins: 0, difficultyStats: {} };
    // Migrate old bubblesStats to new fields
    if (appState.bubblesStats.totalScore === undefined) appState.bubblesStats.totalScore = 0;
    if (appState.bubblesStats.totalStars === undefined) appState.bubblesStats.totalStars = 0;
    if (appState.bubblesStats.wordsCollected === undefined) appState.bubblesStats.wordsCollected = [];
    if (appState.bubblesStats.bestCombo === undefined) appState.bubblesStats.bestCombo = 0;
    if (appState.bubblesStats.wins === undefined) appState.bubblesStats.wins = 0;
    if (appState.bubblesStats.difficultyStats === undefined) appState.bubblesStats.difficultyStats = {};

    // Video stats migration
    if (!appState.videoStats) appState.videoStats = { watched: [], stars: {}, wordsLearned: [], totalQuizzes: 0 };
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
    if (appState.musicStats === undefined) appState.musicStats = {
        rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0, correctRounds: 0 },
        wordChant: { gamesPlayed: 0, correctQuizAnswers: 0 }
    };

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
}

function switchUser() {
    // Save current user data
    if (currentUser && appState) {
        saveUserData(currentUser, appState);
    }

    // Reset and show onboarding
    currentUser = null;
    appState = null;

    document.getElementById('bottomNav').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('onboardingScreen').classList.add('active');

    // Reset form
    document.getElementById('usernameInput').value = '';
    document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.avatar-option').classList.add('selected');
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

    // Delete user data
    deleteUserData(userToDelete);

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
            showToast('🛡️ Streak Shield used! Streak saved!');
            unlockAchievement('shield-saver');
        } else {
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

function switchScreen(screenId) {
    // Close any open overlays
    document.querySelectorAll('.bubbles-overlay, .music-menu-overlay').forEach(el => {
        el.classList.remove('active');
        el.innerHTML = '';
    });

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (typeof event !== 'undefined' && event && event.target) {
        event.target.closest('.nav-item')?.classList.add('active');
    }

    if (screenId === 'homeScreen') renderHome();
    if (screenId === 'speedChallengeScreen') renderSpeedChallenge();
    if (screenId === 'essaysScreen') renderEssays();
    if (screenId === 'profileScreen') renderProfile();
    if (screenId === 'videoScreen' && typeof renderVideoScreen === 'function') renderVideoScreen();
}

function navigateToProfile() {
    // Remember which screen we came from
    const activeScreen = document.querySelector('.screen.active');
    _profileOriginScreen = activeScreen ? activeScreen.id : 'homeScreen';

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('profileScreen').classList.add('active');

    // Clear nav highlight (profile is no longer a nav tab)
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    renderProfile();
}

function navigateFromProfile() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(_profileOriginScreen).classList.add('active');

    // Restore nav highlight
    const screenToNav = {
        homeScreen: 0,
        speedChallengeScreen: 1,
        essaysScreen: 2
    };
    const navIdx = screenToNav[_profileOriginScreen];
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => n.classList.remove('active'));
    if (navIdx !== undefined && navItems[navIdx]) {
        navItems[navIdx].classList.add('active');
    }

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
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
            .then(reg => {
                // Check for updates immediately on every page load
                reg.update();
            })
            .catch(() => {});
    }
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

const audioCache = {};      // key -> Audio object (preloaded)
const audioPending = {};    // key -> fetch promise (dedup in-flight requests)
let currentAudio = null;

function speakWord(word) {
    const key = word.toLowerCase().trim();

    // Stop any currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    // If preloaded audio is ready, play it instantly
    if (audioCache[key]) {
        const audio = audioCache[key].cloneNode();
        currentAudio = audio;
        audio.play().catch(() => speakWordFallback(word));
        return;
    }

    // Not cached yet: play TTS instantly, fetch real audio in background for next time
    speakWordFallback(word);
    prefetchAudio(key);
}

function prefetchAudio(key) {
    // Skip if already cached or already fetching
    if (audioCache[key] || audioPending[key]) return;

    audioPending[key] = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`)
        .then(res => {
            if (!res.ok) throw new Error('not found');
            return res.json();
        })
        .then(data => {
            let audioUrl = null;
            for (const entry of data) {
                for (const phonetic of (entry.phonetics || [])) {
                    if (phonetic.audio) {
                        audioUrl = phonetic.audio;
                        break;
                    }
                }
                if (audioUrl) break;
            }
            if (audioUrl) {
                // Preload the audio file into browser cache
                const audio = new Audio();
                audio.preload = 'auto';
                audio.src = audioUrl;
                audioCache[key] = audio;
            }
        })
        .catch(() => {})
        .finally(() => { delete audioPending[key]; });
}

// Preload audio for an array of words (call when lesson starts)
function preloadLessonAudio(words) {
    words.forEach(w => {
        const key = (w.en || w).toLowerCase().trim();
        prefetchAudio(key);
    });
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
