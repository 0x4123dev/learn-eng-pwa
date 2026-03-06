// word-chant.js - Word Chant TTS rap mode with fill-in-the-blank quiz

const CHANT_TEMPLATES = [
    // Template A — call and response
    [
        { type: 'chant', text: '{en}! {en}! What does it mean?' },
        { type: 'chant', text: 'It means {vi}! Now say it with me!' },
        { type: 'chant', text: '{en}... {en}... {en}!' },
        { type: 'pause', ms: 600 }
    ],
    // Template B — example sentence focus
    [
        { type: 'chant', text: 'Listen up! {ex}' },
        { type: 'chant', text: '{en} — {emoji} — {en}!' },
        { type: 'chant', text: 'Say it again! {en}! {en}!' },
        { type: 'pause', ms: 600 }
    ],
    // Template C — definition drill
    [
        { type: 'chant', text: '{emoji} {en}!' },
        { type: 'chant', text: '{en} means {vi}.' },
        { type: 'chant', text: 'Remember: {en}!' },
        { type: 'pause', ms: 400 }
    ]
];

let wordChantState = {
    words: [],
    script: [],
    currentLine: 0,
    isActive: false,
    quizWord: null
};

let _chantLessonWords = null; // stored for lesson-complete flow

function buildChantScript(words) {
    const script = [];
    words.forEach((word, i) => {
        const template = CHANT_TEMPLATES[i % CHANT_TEMPLATES.length];
        template.forEach(line => {
            if (line.type === 'pause') {
                script.push({ type: 'pause', ms: line.ms });
            } else {
                let text = line.text
                    .replace(/\{en\}/g, word.en)
                    .replace(/\{vi\}/g, word.vi)
                    .replace(/\{emoji\}/g, word.emoji || '')
                    .replace(/\{ex\}/g, word.ex || word.en + ' is an important word.');
                script.push({ type: 'chant', text: text, wordRef: word });
            }
        });
    });
    return script;
}

function startWordChant(lessonWords) {
    let words;
    if (lessonWords && lessonWords.length >= 3) {
        words = lessonWords;
    } else if (_chantLessonWords && _chantLessonWords.length >= 3) {
        words = _chantLessonWords;
        _chantLessonWords = null;
    } else {
        words = (typeof getRhythmWordPool === 'function' ? getRhythmWordPool() : shuffleArray(ieltsVocabulary.slice(0, 50))).slice(0, 5);
    }

    const script = buildChantScript(words);

    wordChantState = {
        words: words,
        script: script,
        currentLine: 0,
        isActive: true,
        quizWord: null
    };

    MusicEngine.getContext();

    const overlay = document.getElementById('wordChantOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';

    renderWordChantUI(words);

    // Start beat
    MusicEngine.startBeat(90, ['kick', 'hihat', 'snare', 'hihat'], null);

    // Begin chant sequence
    setTimeout(() => runChantSequence(0), 500);
}

function renderWordChantUI(words) {
    const overlay = document.getElementById('wordChantOverlay');
    const pillsHTML = words.map(w => `<span class="chant-word-pill">${w.emoji || ''} ${w.en}</span>`).join('');

    overlay.innerHTML = `
        <div class="chant-container">
            <div class="chant-header">
                <button class="chant-exit-btn" onclick="closeWordChant()">✕</button>
                <div class="chant-title">🎤 Word Chant</div>
            </div>
            <div class="chant-words-row">${pillsHTML}</div>
            <div class="chant-lyrics" id="chantLyrics">
                <div class="chant-phase-label" id="chantPhase">🎵 Chanting...</div>
                <div class="chant-line" id="chantLine">Get ready!</div>
            </div>
            <div class="chant-progress-bar">
                <div class="chant-progress" id="chantProgress" style="width:0%"></div>
            </div>
        </div>
    `;
}

function runChantSequence(index) {
    if (!wordChantState.isActive) return;
    if (index >= wordChantState.script.length) {
        offerChantQuiz();
        return;
    }

    const line = wordChantState.script[index];

    // Update progress
    const progressEl = document.getElementById('chantProgress');
    if (progressEl) {
        progressEl.style.width = Math.round((index / wordChantState.script.length) * 100) + '%';
    }

    if (line.type === 'pause') {
        setTimeout(() => runChantSequence(index + 1), line.ms);
        return;
    }

    // Display line with highlighted word
    const lineEl = document.getElementById('chantLine');
    if (lineEl) {
        let displayText = line.text;
        if (line.wordRef) {
            displayText = displayText.replace(
                new RegExp(line.wordRef.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                `<mark>${line.wordRef.en}</mark>`
            );
        }
        lineEl.innerHTML = displayText;
        lineEl.style.animation = 'none';
        lineEl.offsetHeight;
        lineEl.style.animation = 'chantLineIn 0.3s ease';
    }

    // Speak the line
    if (typeof speakWord === 'function') {
        speakWord(line.text);
    }

    // Estimate speaking duration and advance
    const duration = Math.max(1200, line.text.split(' ').length * 400);
    setTimeout(() => runChantSequence(index + 1), duration);
}

function offerChantQuiz() {
    MusicEngine.stopBeat();

    const phaseEl = document.getElementById('chantPhase');
    if (phaseEl) phaseEl.textContent = '🧠 Quiz Time!';

    const lineEl = document.getElementById('chantLine');
    if (lineEl) {
        lineEl.innerHTML = `
            <div style="margin-bottom:16px">Can you remember the words?</div>
            <button class="chant-quiz-start-btn" onclick="runChantQuiz()">Let's Go!</button>
        `;
    }

    const progressEl = document.getElementById('chantProgress');
    if (progressEl) progressEl.style.width = '100%';
}

function runChantQuiz() {
    const words = wordChantState.words;
    const blankWord = words[Math.floor(Math.random() * words.length)];
    wordChantState.quizWord = blankWord;

    // Build distractors
    const distractors = shuffleArray(
        ieltsVocabulary.filter(w => w.vi !== blankWord.vi)
    ).slice(0, 2).map(w => w.vi);
    const choices = shuffleArray([blankWord.vi, ...distractors]);

    // Restart beat for quiz phase
    MusicEngine.startBeat(90, ['kick', 'hihat', 'kick', 'hihat'], null);

    // Speak the question
    if (typeof speakWord === 'function') {
        speakWord(blankWord.en + ' means what?');
    }

    const phaseEl = document.getElementById('chantPhase');
    if (phaseEl) phaseEl.textContent = '🧠 Quiz Round';

    const lineEl = document.getElementById('chantLine');
    if (lineEl) {
        const choicesHTML = choices.map(c => `
            <button class="chant-answer-btn" onclick="onChantAnswer(this, '${c.replace(/'/g, "\\'")}')">${c}</button>
        `).join('');

        lineEl.innerHTML = `
            <div class="chant-quiz-question">
                <span class="chant-quiz-emoji">${blankWord.emoji || ''}</span>
                <span class="chant-quiz-word">${blankWord.en}</span> means ____?
            </div>
            <div class="chant-quiz-choices">${choicesHTML}</div>
        `;
    }
}

function onChantAnswer(btn, answer) {
    if (!wordChantState.quizWord) return;
    const correct = answer === wordChantState.quizWord.vi;
    const ctx = MusicEngine.getContext();

    // Disable all buttons
    document.querySelectorAll('.chant-answer-btn').forEach(b => {
        b.onclick = null;
        if (b.textContent === wordChantState.quizWord.vi) {
            b.classList.add('correct');
        }
    });

    if (correct) {
        btn.classList.add('correct');
        MusicEngine.playSuccess(ctx);

        // Award points
        if (appState) {
            appState.points += 15;
            if (!appState.musicStats) appState.musicStats = { rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0, correctRounds: 0 }, wordChant: { gamesPlayed: 0, correctQuizAnswers: 0 } };
            appState.musicStats.wordChant.correctQuizAnswers = (appState.musicStats.wordChant.correctQuizAnswers || 0) + 1;
        }
    } else {
        btn.classList.add('wrong');
        MusicEngine.playFail(ctx);
    }

    setTimeout(() => onWordChantEnd(correct), 1500);
}

function onWordChantEnd(quizPassed) {
    wordChantState.isActive = false;
    MusicEngine.stopBeat();
    MusicEngine.suspend();

    if (!appState) return;

    if (!appState.musicStats) {
        appState.musicStats = { rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0, correctRounds: 0 }, wordChant: { gamesPlayed: 0, correctQuizAnswers: 0 } };
    }
    appState.musicStats.wordChant.gamesPlayed++;
    saveUserData(currentUser, appState);

    // Achievements
    if (appState.musicStats.wordChant.gamesPlayed === 1) unlockAchievement('chant-first');

    // Pet hooks
    if (typeof feedPet === 'function') feedPet(25);
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('rhythm');
    if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);

    // End screen
    const overlay = document.getElementById('wordChantOverlay');
    const wordsHTML = wordChantState.words.map(w =>
        `<div class="chant-end-word">${w.emoji || ''} ${w.en} — ${w.vi}</div>`
    ).join('');

    overlay.innerHTML = `
        <div class="chant-container">
            <div class="chant-end-screen">
                <div class="chant-end-icon">${quizPassed ? '🎉' : '🎤'}</div>
                <h2>Chant Complete!</h2>
                <div class="chant-end-quiz">${quizPassed ? '✅ Quiz passed!' : '❌ Quiz missed — keep practicing!'}</div>
                <div class="chant-end-words">${wordsHTML}</div>
                <button class="chant-action-btn" onclick="startWordChant()">Chant Again</button>
                <button class="chant-close-btn" onclick="closeWordChant()">Close</button>
            </div>
        </div>
    `;
}

function closeWordChant() {
    wordChantState.isActive = false;
    MusicEngine.stopBeat();
    MusicEngine.suspend();

    const overlay = document.getElementById('wordChantOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
    if (typeof renderHome === 'function') renderHome();
}

// Called from lesson-complete to offer chant
function addChantButtonToLessonComplete(words) {
    _chantLessonWords = words;
    const lessonComplete = document.getElementById('lessonComplete');
    if (!lessonComplete) return;
    // Check if button already exists
    if (lessonComplete.querySelector('.chant-offer-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'secondary-btn chant-offer-btn';
    btn.textContent = '🎵 Chant these words!';
    btn.onclick = function() {
        lessonComplete.classList.remove('active');
        document.getElementById('bottomNav').style.display = 'none';
        startWordChant(_chantLessonWords);
    };
    lessonComplete.querySelector('.complete-btn').parentNode.insertBefore(btn, lessonComplete.querySelector('.complete-btn').nextSibling);
}
