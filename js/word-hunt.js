// word-hunt.js - Word Hunt Grid Game

const GRID_SIZE = 10;
const HUNT_WORDS = 3;
const HUNT_TIME = 60000;

let huntState = {
    grid: [],
    words: [],
    foundWords: [],
    selecting: false,
    selectedCells: [],
    timer: null,
    timeLeft: HUNT_TIME,
    startTime: 0,
    huntsCompleted: 0
};

function renderWordHuntCard() {
    const card = document.getElementById('wordHuntCard');
    if (!card) return;

    // Only show after 3+ completed lessons
    if ((appState.lessonsCompleted || 0) < 3) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';

    card.innerHTML = `
        <div class="wh-card-header">
            <span class="wh-card-icon">🔍</span>
            <span class="wh-card-title">Word Hunt</span>
        </div>
        <div class="wh-card-desc">Find hidden words in the grid!</div>
        <button class="primary-btn wh-start-btn" onclick="openWordHunt()">Play</button>
    `;
}

function openWordHunt() {
    // Pick 3 words (3-8 letters) from completed lessons
    const srsWords = appState.srs ? Object.keys(appState.srs) : [];
    const validWords = srsWords
        .filter(w => w.length >= 3 && w.length <= 8 && /^[a-z]+$/i.test(w))
        .map(en => ieltsVocabulary.find(w => w.en === en))
        .filter(Boolean);

    if (validWords.length < HUNT_WORDS) {
        showToast('Learn more words first! Need 3+ short words.');
        return;
    }

    const picked = shuffleArray(validWords).slice(0, HUNT_WORDS);

    huntState = {
        grid: [],
        words: picked,
        foundWords: [],
        selecting: false,
        selectedCells: [],
        timer: null,
        timeLeft: HUNT_TIME,
        startTime: Date.now()
    };

    huntState.grid = generateGrid(picked);
    showWordHuntOverlay();
    startHuntTimer();
}

function generateGrid(words) {
    const grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
    const directions = [
        [0, 1],   // horizontal
        [1, 0],   // vertical
        [1, 1],   // diagonal down-right
        [0, -1],  // horizontal reverse
        [-1, 0],  // vertical reverse
        [-1, -1]  // diagonal up-left
    ];

    words.forEach(wordObj => {
        const word = wordObj.en.toUpperCase();
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
            attempts++;
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const row = Math.floor(Math.random() * GRID_SIZE);
            const col = Math.floor(Math.random() * GRID_SIZE);

            // Check if word fits
            const endRow = row + dir[0] * (word.length - 1);
            const endCol = col + dir[1] * (word.length - 1);
            if (endRow < 0 || endRow >= GRID_SIZE || endCol < 0 || endCol >= GRID_SIZE) continue;

            // Check for conflicts
            let canPlace = true;
            for (let i = 0; i < word.length; i++) {
                const r = row + dir[0] * i;
                const c = col + dir[1] * i;
                if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
                    canPlace = false;
                    break;
                }
            }

            if (canPlace) {
                for (let i = 0; i < word.length; i++) {
                    const r = row + dir[0] * i;
                    const c = col + dir[1] * i;
                    grid[r][c] = word[i];
                }
                wordObj._gridStart = { row, col };
                wordObj._gridDir = dir;
                placed = true;
            }
        }
    });

    // Fill empty cells with weighted random letters
    const commonLetters = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c] === '') {
                const idx = Math.floor(Math.random() * Math.min(15, commonLetters.length));
                grid[r][c] = commonLetters[idx];
            }
        }
    }

    return grid;
}

function showWordHuntOverlay() {
    const overlay = document.getElementById('wordHuntOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    renderHuntUI();
}

function renderHuntUI() {
    const overlay = document.getElementById('wordHuntOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="wh-game-header">
            <button class="close-btn" onclick="endWordHunt()">×</button>
            <span class="wh-timer${huntState.timeLeft <= 10000 ? ' danger' : ''}" id="whTimer">${Math.ceil(huntState.timeLeft / 1000)}s</span>
            <span class="wh-found">${huntState.foundWords.length}/${HUNT_WORDS}</span>
        </div>
        <div class="wh-targets">
            ${huntState.words.map(w => {
                const found = huntState.foundWords.includes(w.en);
                return `<div class="wh-target${found ? ' found' : ''}">
                    <span class="wh-target-word">${w.en.toUpperCase()}</span>
                    ${found ? `<span class="wh-target-vi">${w.vi}</span>` : ''}
                </div>`;
            }).join('')}
        </div>
        <div class="wh-grid" id="whGrid">
            ${huntState.grid.map((row, r) =>
                row.map((letter, c) => {
                    const isFound = huntState.words.some(w => {
                        if (!huntState.foundWords.includes(w.en)) return false;
                        const s = w._gridStart;
                        const d = w._gridDir;
                        if (!s || !d) return false;
                        for (let i = 0; i < w.en.length; i++) {
                            if (s.row + d[0] * i === r && s.col + d[1] * i === c) return true;
                        }
                        return false;
                    });
                    const isSelected = huntState.selectedCells.some(sc => sc.r === r && sc.c === c);
                    return `<div class="wh-cell${isFound ? ' found' : ''}${isSelected ? ' selected' : ''}"
                        data-r="${r}" data-c="${c}">${letter}</div>`;
                }).join('')
            ).join('')}
        </div>
        <div class="wh-meaning-popup" id="whMeaningPopup"></div>
    `;

    // Add touch/mouse events to grid
    const grid = document.getElementById('whGrid');
    if (!grid) return;

    grid.addEventListener('mousedown', (e) => whStartSelect(e));
    grid.addEventListener('mousemove', (e) => whMoveSelect(e));
    grid.addEventListener('mouseup', () => whEndSelect());
    grid.addEventListener('touchstart', (e) => { e.preventDefault(); whStartSelect(e); }, { passive: false });
    grid.addEventListener('touchmove', (e) => { e.preventDefault(); whMoveSelect(e); }, { passive: false });
    grid.addEventListener('touchend', () => whEndSelect());
}

function getCellFromEvent(e) {
    const touch = e.touches ? e.touches[0] : e;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.classList.contains('wh-cell')) {
        return { r: parseInt(el.dataset.r), c: parseInt(el.dataset.c), el };
    }
    return null;
}

function whStartSelect(e) {
    const cell = getCellFromEvent(e);
    if (!cell) return;
    huntState.selecting = true;
    huntState.selectedCells = [cell];
    cell.el.classList.add('selected');
}

function whMoveSelect(e) {
    if (!huntState.selecting) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;

    const start = huntState.selectedCells[0];
    if (!start) return;

    // Calculate direction from start to current
    const dr = Math.sign(cell.r - start.r);
    const dc = Math.sign(cell.c - start.c);

    // Must be in a straight line
    if (dr === 0 && dc === 0) return;
    const diffR = Math.abs(cell.r - start.r);
    const diffC = Math.abs(cell.c - start.c);
    if (dr !== 0 && dc !== 0 && diffR !== diffC) return; // Not diagonal

    // Build selection along the line
    const newCells = [];
    const steps = Math.max(diffR, diffC);
    for (let i = 0; i <= steps; i++) {
        newCells.push({ r: start.r + dr * i, c: start.c + dc * i });
    }

    // Clear old selection
    document.querySelectorAll('.wh-cell.selected').forEach(el => el.classList.remove('selected'));

    // Apply new selection
    huntState.selectedCells = newCells;
    newCells.forEach(sc => {
        const el = document.querySelector(`.wh-cell[data-r="${sc.r}"][data-c="${sc.c}"]`);
        if (el) el.classList.add('selected');
    });
}

function whEndSelect() {
    if (!huntState.selecting) return;
    huntState.selecting = false;
    checkHuntSelection();
}

function checkHuntSelection() {
    const selectedLetters = huntState.selectedCells.map(sc => huntState.grid[sc.r][sc.c]).join('');
    const reversed = selectedLetters.split('').reverse().join('');

    const matchedWord = huntState.words.find(w =>
        !huntState.foundWords.includes(w.en) &&
        (w.en.toUpperCase() === selectedLetters || w.en.toUpperCase() === reversed)
    );

    if (matchedWord) {
        huntState.foundWords.push(matchedWord.en);
        // Show meaning popup
        const popup = document.getElementById('whMeaningPopup');
        if (popup) {
            popup.textContent = `${matchedWord.emoji} ${matchedWord.en} = ${matchedWord.vi}`;
            popup.classList.add('active');
            setTimeout(() => popup.classList.remove('active'), 1500);
        }
        appState.points += 30;
        saveUserData(currentUser, appState);
        speakWord(matchedWord.en);

        if (huntState.foundWords.length >= HUNT_WORDS) {
            setTimeout(() => completeWordHunt(), 800);
        } else {
            renderHuntUI();
        }
    } else {
        // Wrong - red flash
        huntState.selectedCells.forEach(sc => {
            const el = document.querySelector(`.wh-cell[data-r="${sc.r}"][data-c="${sc.c}"]`);
            if (el) {
                el.classList.remove('selected');
                el.classList.add('wrong');
                setTimeout(() => el.classList.remove('wrong'), 400);
            }
        });
        huntState.selectedCells = [];
    }
}

function startHuntTimer() {
    huntState.timer = setInterval(() => {
        huntState.timeLeft = Math.max(0, HUNT_TIME - (Date.now() - huntState.startTime));
        const timerEl = document.getElementById('whTimer');
        if (timerEl) {
            const secs = Math.ceil(huntState.timeLeft / 1000);
            timerEl.textContent = secs + 's';
            if (secs <= 10) timerEl.classList.add('danger');
        }
        if (huntState.timeLeft <= 0) {
            clearInterval(huntState.timer);
            completeWordHunt();
        }
    }, 200);
}

function completeWordHunt() {
    clearInterval(huntState.timer);
    const found = huntState.foundWords.length;
    const total = HUNT_WORDS;
    const points = found * 30;

    // Achievements
    if (found > 0) unlockAchievement('hunter-first');
    if (!huntState._huntsWon) huntState._huntsWon = 0;
    if (found === total) {
        huntState._huntsWon++;
        // Track wins in appState for achievement
        if (!appState._huntWins) appState._huntWins = 0;
        appState._huntWins++;
        if (appState._huntWins >= 10) unlockAchievement('hunter-10');
        saveUserData(currentUser, appState);
    }

    const overlay = document.getElementById('wordHuntOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="wh-complete">
            <div class="wh-complete-icon">${found === total ? '🏆' : '⏱️'}</div>
            <h2>${found === total ? 'All Found!' : 'Time\'s Up!'}</h2>
            <div class="wh-complete-score">${found}/${total} words found</div>
            <div class="wh-complete-points">+${points} points</div>
            <button class="primary-btn" onclick="closeWordHunt()">Done</button>
        </div>
    `;

    if (found === total) createConfetti();
}

function endWordHunt() {
    clearInterval(huntState.timer);
    completeWordHunt();
}

function closeWordHunt() {
    document.getElementById('wordHuntOverlay').classList.remove('active');
    renderHome();
}
