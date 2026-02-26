// sentence-builder.js - Emoji Sentence Builder

const emojiPalette = [
    '😊', '😍', '🥳', '😎', '🤩', '😂',
    '❤️', '⭐', '🌟', '✨', '🔥', '💪',
    '🎉', '🎊', '🎈', '🎁', '🏆', '👑',
    '🌈', '🌸', '🌺', '🍀', '🦋', '🐾',
    '🎵', '🎶', '📚', '✏️', '💡', '🚀'
];

let sentenceBuilderState = {
    word: null,
    sentence: '',
    emojis: [],
    lessonPoints: 0,
    accuracy: 0,
    bonusText: ''
};

function offerSentenceBuilder(lessonWords, lessonPoints, accuracy, bonusText) {
    // Find a word with an example sentence
    const wordWithExample = lessonWords.find(w => w.ex) || lessonWords[0];
    if (!wordWithExample) {
        showLessonCompleteUI(lessonPoints, accuracy, bonusText);
        return;
    }

    sentenceBuilderState = {
        word: wordWithExample,
        sentence: wordWithExample.ex || wordWithExample.en,
        emojis: [],
        lessonPoints: lessonPoints,
        accuracy: accuracy,
        bonusText: bonusText
    };

    const overlay = document.getElementById('sentenceBuilderOverlay');
    if (!overlay) {
        showLessonCompleteUI(lessonPoints, accuracy, bonusText);
        return;
    }

    renderSentenceBuilder();
    overlay.classList.add('active');
}

function renderSentenceBuilder() {
    const overlay = document.getElementById('sentenceBuilderOverlay');
    if (!overlay) return;

    const state = sentenceBuilderState;
    const decoratedSentence = state.emojis.length > 0
        ? state.emojis.join('') + ' ' + state.sentence + ' ' + state.emojis.slice().reverse().join('')
        : state.sentence;

    overlay.innerHTML = `
        <div class="sb-content">
            <div class="sb-header">
                <div class="sb-title">Decorate your sentence!</div>
                <div class="sb-word">${state.word.emoji} ${state.word.en}</div>
            </div>
            <div class="sb-sentence" id="sbSentenceDisplay">${decoratedSentence}</div>
            <div class="sb-palette">
                ${emojiPalette.map(e => `<button class="sb-emoji-btn" onclick="addEmojiToSentence('${e}')">${e}</button>`).join('')}
            </div>
            <div class="sb-actions">
                <button class="sb-undo-btn" onclick="removeLastEmoji()">↩️ Undo</button>
                <button class="primary-btn sb-save-btn" onclick="saveSentence()">💾 Save</button>
                <button class="sb-skip-btn" onclick="skipSentenceBuilder()">Skip →</button>
            </div>
        </div>
    `;
}

function addEmojiToSentence(emoji) {
    sentenceBuilderState.emojis.push(emoji);
    renderSentenceBuilder();
}

function removeLastEmoji() {
    sentenceBuilderState.emojis.pop();
    renderSentenceBuilder();
}

function saveSentence() {
    const state = sentenceBuilderState;
    if (!appState.sentences) appState.sentences = [];

    const decoratedText = state.emojis.length > 0
        ? state.emojis.join('') + ' ' + state.sentence + ' ' + state.emojis.slice().reverse().join('')
        : state.sentence;

    appState.sentences.push({
        word: state.word.en,
        text: decoratedText,
        date: Date.now()
    });

    // Keep max 20 sentences
    if (appState.sentences.length > 20) {
        appState.sentences = appState.sentences.slice(-20);
    }

    saveUserData(currentUser, appState);
    showToast('Sentence saved! 📝');

    document.getElementById('sentenceBuilderOverlay').classList.remove('active');
    showLessonCompleteUI(state.lessonPoints, state.accuracy, state.bonusText);
}

function skipSentenceBuilder() {
    const state = sentenceBuilderState;
    document.getElementById('sentenceBuilderOverlay').classList.remove('active');
    showLessonCompleteUI(state.lessonPoints, state.accuracy, state.bonusText);
}
