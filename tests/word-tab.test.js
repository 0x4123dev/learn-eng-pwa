// word-tab.test.js — the Word screen: Career Paths · Public Relations on the
// picture-dictionary engine, shared by the three Book buttons of the bottom bar.
//
// Three promises. (1) The bank IS the book: Book 1's first eight units (about
// thirty words each) and fifteen units for Books 2 and 3,
// every unit file valid, and js/word-data.js exactly what the build script
// makes of them — a hand edit to the generated file, or a unit file that never
// made it into the build, shows up here. (2) The engine has exactly one host:
// a Book practice draws on the Word screen, owes its words on the 'word'
// queue, and lands in the Word history. (3) The screen is wired: three Book
// buttons, screen pieces, lazy loader, precache.
const { suite, test, assert, runAll } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildSandbox } = require('./setup');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const { validateFile } = require(path.join(ROOT, 'scripts', 'validate-word-data.js'));
const { UNITS_PER_BOOK } = require(path.join(ROOT, 'scripts', 'build-word-data.js'));
const wordData = require(path.join(ROOT, 'js', 'word-data.js'));
const { UNIT_PR_TITLES, UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3 } = wordData;
const DATA_DIR = path.join(ROOT, 'data', 'career-paths');
const unitFiles = fs.readdirSync(DATA_DIR).filter(f => /^pr[123]-u\d\d\.json$/.test(f)).sort();

// ---- an engine sandbox with the Word screen's DOM pieces and a real retry engine ----
function loadEngine() {
    const sandbox = buildSandbox();
    sandbox.appState = { coins: 0, unitsHistory: [] };
    sandbox.currentUser = 'kid';
    sandbox.saveUserData = () => {};
    sandbox.showToast = () => {};
    const ctx = vm.createContext(sandbox);
    const files = ['js/word-data.js', 'js/wrong-priority.js', 'js/retrydrill.js', 'js/answer-audio.js', 'js/units.js'];
    let src = files.map(f => `\n//===== ${f} =====\n` + read(f)).join('');
    src += `
globalThis.__x = { UNIT_SETS, UNIT_HOSTS, unitHostSets, unitHostOfSet, unitCurrentHost, unitPracticeScreen,
  currentUnitSet, switchUnitSet, renderWordHome, renderUnitsBar, renderUnitSetTabsHTML,
  startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice, quitUnitPractice, isUnitPracticeActive,
  unitsRetryCount, unitsRetryKey, unitsHostHistory, unitsList, unitsBank, _unitPool, _unitParse, _unitLabel,
  unitTitle, RETRY_DRILLS, retryList, unitsForgetProfile, _unitExampleParts, _unitExampleHTML,
  unitSentenceAudio, unitSpeakSentence,
  quiz: () => _unitQuiz, setQuiz: (q) => { _unitQuiz = q; } };`;
    vm.runInContext(src, ctx, { filename: 'word-tab-engine.js' });
    return { sb: sandbox, x: sandbox.__x, html: id => sandbox.document.__getLastInnerHTML(id) || '' };
}

suite('word tab: the pronunciation under the answer', () => {
    test('every word of all three Books carries an IPA line', () => {
        const all = [].concat(UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3);
        const missing = all.filter(w => !w.ipa || !w.ipa.trim()).map(w => w.en);
        assert.deepEqual(missing.slice(0, 10), [], `${missing.length} words have no pronunciation — run scripts/build-word-ipa.js`);
        // IPA, not a respelling: every character is one the converter emits
        // (its own phoneme table), plus the two stress marks and the space
        // between the words of a phrase. That rules out "AD-vuh-kit" and the
        // ASCII apostrophe people reach for instead of ˈ.
        const build = require(path.join(ROOT, 'scripts', 'build-word-ipa.js'));
        const allowed = new Set(['ˈ', 'ˌ', ' ', ...Object.values(build.PHONES).join(''), 'ə', 'ɚ', 'r']);
        const strange = all
            .map(w => [w.en, [...w.ipa].filter(ch => !allowed.has(ch))])
            .filter(([, bad]) => bad.length)
            .map(([en, bad]) => en + ': ' + bad.join(''));
        assert.deepEqual(strange.slice(0, 5), [], 'characters outside the phoneme table');
        // A multi-syllable word says where the stress is. Phrases are left
        // out: "sales lead" is two one-syllable words and neither takes a
        // mark (seɪlz lɛd), which is how a dictionary prints it too.
        const stressless = all
            .filter(w => !/\s/.test(w.en) && w.ipa.length > 7 && !/[ˈˌ]/.test(w.ipa))
            .map(w => w.en + ' ' + w.ipa);
        assert.deepEqual(stressless.slice(0, 5), [], 'a long word with no stress mark');
    });

    test('the IPA is generated from CMUdict, not written by hand', () => {
        // A model writing IPA from memory gets vowels and stress subtly
        // wrong and nobody notices; the mapping is mechanical on purpose.
        const ipa = JSON.parse(read('data/career-paths/ipa.json'));
        const bank = [].concat(UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3);
        for (const w of bank) assert.equal(w.ipa, ipa[w.en], w.en + ': js/word-data.js drifted from ipa.json');
        assert.deepEqual(Object.keys(ipa).sort(), [...new Set(bank.map(w => w.en))].sort(),
            'ipa.json holds exactly the bank words — no strays, nothing missing');
        const build = require(path.join(ROOT, 'scripts', 'build-word-ipa.js'));
        // The converter itself, on the ARPABET the dictionary would hand it.
        assert.equal(build.toIpa(['AE1', 'D', 'V', 'AH0', 'K', 'AH0', 'T']), 'ˈædvəkət');
        assert.equal(build.toIpa(['B', 'IH0', 'D']), 'bɪd', 'one syllable needs no stress mark');
        assert.equal(build.toIpa(['K', 'AH0', 'M', 'Y', 'UW2', 'N', 'AH0', 'K', 'EY1', 'SH', 'AH0', 'N']), 'kəˌmjunəˈkeɪʃən');
    });

    test('a revealed answer shows the pronunciation; an unanswered card does not', () => {
        const { x, html, sb } = loadEngine();
        sb.speakAnswer = () => {};
        x.startUnitPractice('pr1-1');
        const q = x.quiz().questions[x.quiz().idx];
        assert.falsy(html('wordDetail').includes('unit-ipa'), 'no pronunciation while the word is still hidden');
        sb.document.getElementById('unitTextInput').value = q.w.en;
        x.submitUnitAnswer();
        const shown = html('wordDetail');
        assert.truthy(shown.includes('class="unit-ipa"'), 'the answer card carries the IPA line');
        assert.truthy(shown.includes('/' + q.w.ipa + '/'), 'in slashes, as a dictionary prints it: ' + q.w.ipa);
        assert.truthy(/\.unit-ipa \{/.test(read('css/styles.css')), 'and it is styled');
    });
});

suite('word tab: hear the whole example sentence (Book 1)', () => {
    // The user asked for it on the answer screen: "khi có đáp án thì thêm cái
    // loa ở câu này … bấm vào để nghe được nguyên câu", Book 1 only.
    test('the 🔊 appears with the answer, never before it, and only for Book 1', () => {
        const { x, sb } = loadEngine();
        sb.speakSentence = () => true;   // js/app.js provides it in the app
        const b1 = UNIT_WORDS_PR1[0], b2 = UNIT_WORDS_PR2[0];
        assert.truthy(x.unitSentenceAudio(b1), 'Book 1 words have a sentence recording');
        assert.falsy(x.unitSentenceAudio(b2), 'Books 2 and 3 have none — no button');
        const hidden = x._unitExampleHTML(b1, false);
        assert.truthy(hidden.includes('unit-ex-blank'), 'the sentence is still blanked while answering');
        assert.falsy(hidden.includes('unit-ex-say'), 'no 🔊 before the answer: it would say the word out loud');
        const shown = x._unitExampleHTML(b1, true);
        assert.truthy(shown.includes('class="unit-ex-say"') && shown.includes('onclick="unitSpeakSentence()"'),
            'the revealed sentence carries the speaker button');
        assert.truthy(/aria-label="Nghe cả câu"/.test(shown), 'and it has an accessible name');
        assert.falsy(x._unitExampleHTML(b2, true).includes('unit-ex-say'), 'Book 2 keeps the plain sentence');
    });

    test('the button plays the sentence of the question on screen', () => {
        const { x, sb } = loadEngine();
        const played = [];
        sb.speakSentence = (word, text) => { played.push([word, text]); return true; };
        sb.speakAnswer = () => {};
        assert.falsy(x.unitSpeakSentence(), 'nothing on screen, nothing to play');
        x.startUnitPractice('pr1-1');
        const q = x.quiz().questions[x.quiz().idx];
        assert.truthy(x.unitSpeakSentence(), 'plays for the current question');
        assert.deepEqual(played, [[q.w.en, q.w.ex]], 'the word and its own sentence');
        // …and the NEXT question plays its own, not the one the button was
        // drawn with.
        x.submitUnitAnswer();
        x.nextUnitQuestion();
        const q2 = x.quiz().questions[x.quiz().idx];
        x.unitSpeakSentence();
        assert.deepEqual(played[played.length - 1], [q2.w.en, q2.w.ex]);
    });

    test('the styles for the button exist, and the service worker caches the recordings', () => {
        const css = read('css/styles.css');
        assert.truthy(/\.unit-ex-say \{/.test(css), 'the button is styled');
        assert.truthy(/\.unit-ex-say[\s\S]{0,240}width: 38px/.test(css), 'and is big enough to tap on a phone');
        const sw = read('sw.js');
        assert.truthy(sw.includes("includes('/audio/sentences/')"), 'sentence MP3s go to the long-lived audio cache');
    });
});

suite('word tab: the bank is the book', () => {
    test('38 unit files: Book 1 × eight, Books 2 and 3 × fifteen, each valid', () => {
        // Book 1 was re-cut on 2026-09-23 to the book's first eight units,
        // about thirty words each: the printed Vocabulary list plus the rest
        // of the new words on that unit's two pages. Files u09-u15 went with
        // the units they held.
        assert.equal(unitFiles.length, 38, 'unit files: ' + unitFiles.join(', '));
        for (const b of [1, 2, 3]) {
            for (let u = 1; u <= UNITS_PER_BOOK[b]; u++) {
                const f = `pr${b}-u${String(u).padStart(2, '0')}.json`;
                assert.truthy(unitFiles.includes(f), 'missing ' + f);
                const problems = validateFile(path.join(DATA_DIR, f));
                assert.deepEqual(problems, [], f + ': ' + problems.join('; '));
            }
            const beyond = unitFiles.filter(f => f.startsWith('pr' + b + '-') && Number(f.slice(6, 8)) > UNITS_PER_BOOK[b]);
            assert.deepEqual(beyond, [], `book ${b} carries ${UNITS_PER_BOOK[b]} units; these files are past the end`);
        }
    });

    test('js/word-data.js is exactly what scripts/build-word-data.js writes from data/career-paths', () => {
        // Build into a scratch file and compare, so a stale generated file or a
        // hand edit is caught without touching the tree.
        const { build } = require(path.join(ROOT, 'scripts', 'build-word-data.js'));
        const tmp = path.join(require('os').tmpdir(), 'word-data.' + process.pid + '.js');
        const log = console.log; console.log = () => {};
        let code;
        try { code = build(tmp); } finally { console.log = log; }
        assert.equal(code, 0, 'the build must succeed');
        const fresh = fs.readFileSync(tmp, 'utf8');
        fs.unlinkSync(tmp);
        assert.truthy(fresh === read('js/word-data.js'),
            'js/word-data.js is stale or hand-edited — run node scripts/build-word-data.js');
    });

    test('each book carries every unit and only the words its files list', () => {
        const banks = { 1: UNIT_WORDS_PR1, 2: UNIT_WORDS_PR2, 3: UNIT_WORDS_PR3 };
        const { practiceUnitOf, PRACTICE_UNITS } = require(path.join(ROOT, 'scripts', 'build-word-data.js'));
        const { UNIT_PR_BOOKS } = wordData;
        assert.deepEqual(PRACTICE_UNITS, { 1: 8, 2: 7, 3: 7 });
        assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(u => practiceUnitOf(u, 1)), [1, 2, 3, 4, 5, 6, 7, 8], 'Book 1: one practice unit per book unit');
        assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(u => practiceUnitOf(u, 2)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7], 'Books 2-3 merge 1-2 … 11-12, 13-15');
        const MAP = {
            1: { 1: [1], 2: [2], 3: [3], 4: [4], 5: [5], 6: [6], 7: [7], 8: [8] },
            2: { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9, 10], 6: [11, 12], 7: [13, 14, 15] },
        };
        for (const b of [1, 2, 3]) {
            const want = PRACTICE_UNITS[b];
            const units = new Set(banks[b].map(w => w.unit));
            assert.equal(units.size, want, 'book ' + b + ' has ' + want + ' practice units in the bank');
            assert.equal(Object.keys(UNIT_PR_TITLES['pr' + b]).length, want, 'book ' + b + ' has ' + want + ' titles');
            assert.deepEqual(UNIT_PR_BOOKS['pr' + b], MAP[b === 1 ? 1 : 2], 'book ' + b + ' unit map');
            let expected = 0;
            for (let u = 1; u <= UNITS_PER_BOOK[b]; u++) {
                const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `pr${b}-u${String(u).padStart(2, '0')}.json`), 'utf8'));
                expected += doc.words.length;
                const pu = practiceUnitOf(u, b);
                assert.truthy(UNIT_PR_TITLES['pr' + b][pu].split(' · ').includes(doc.title), `book ${b} unit ${u} title is part of practice unit ${pu}'s`);
                const inBank = banks[b].filter(w => w.bookUnit === u);
                assert.deepEqual(inBank.map(w => w.en), doc.words.map(w => w.en), `book ${b} unit ${u} words, in order`);
                assert.truthy(inBank.every(w => w.unit === pu), `book ${b} unit ${u} words are keyed to practice unit ${pu}`);
            }
            assert.equal(banks[b].length, expected, 'book ' + b + ' word count');
            assert.truthy(banks[b].every(w => w.book === b), 'every word of book ' + b + ' says so');
            const seen = new Set();
            for (const w of banks[b]) {
                assert.truthy(!seen.has(w.en.toLowerCase()), `book ${b}: "${w.en}" listed twice`);
                seen.add(w.en.toLowerCase());
            }
        }
        assert.truthy(UNIT_WORDS_PR1.length + UNIT_WORDS_PR2.length + UNIT_WORDS_PR3.length >= 500,
            'the three books are a real bank, not a stub');
    });

    test('every word can be drawn as a question: a picture, a Vietnamese meaning, letters to blank', () => {
        for (const w of [].concat(UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3)) {
            assert.truthy(/[A-Za-z]/.test(w.en), w.en + ': has letters to blank');
            assert.truthy(!/^[0-9:]+$/.test(w.emoji), w.en + ': emoji is a picture, not a number card');
            assert.truthy(w.vi && w.vi.length >= 3, w.en + ': has a meaning');
        }
    });

    test('every word carries an example sentence the engine can blank, and its translation', () => {
        // The card shows "The ______ holds the leaves up to the sunlight." while
        // answering: _unitExampleParts must find the exact spelling once.
        const { x } = loadEngine();
        for (const w of [].concat(UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3)) {
            assert.truthy(w.ex && w.exVi, w.en + ': ex/exVi present');
            const parts = x._unitExampleParts(w);
            assert.truthy(parts, w.en + ': the sentence contains the word: ' + w.ex);
            assert.equal(parts.term, w.en, w.en + ': blanked span is the exact spelling');
            assert.truthy(/[.!?]$/.test(w.ex.trim()) && /[.!?]$/.test(w.exVi.trim()), w.en + ': both are full sentences');
        }
    });
});

suite('word tab: one host, one engine', () => {
    test('there is exactly one host, word, with the three Book sets', () => {
        const { x } = loadEngine();
        assert.deepEqual(Object.keys(x.UNIT_HOSTS), ['word']);
        assert.deepEqual(x.UNIT_SETS.map(s => s.id), ['pr1', 'pr2', 'pr3']);
        assert.deepEqual(x.unitHostSets('word').map(s => s.id), ['pr1', 'pr2', 'pr3']);
        assert.equal(x.unitHostOfSet('pr2'), 'word');
        assert.equal(x.UNIT_HOSTS.word.screen, 'wordScreen');
        assert.equal(x.UNIT_HOSTS.word.retryKey, 'word');
        for (const s of ['pr1', 'pr2', 'pr3']) {
            assert.equal(x.unitsList(s).length, s === 'pr1' ? 8 : 7, s + ' practice units');
            assert.truthy(x.unitsBank(s).length > 100, s + ' bank loaded');
            assert.truthy(x.unitsBank(s).every(w => w.set === s), s + ' words are tagged with their set');
        }
    });

    test('unit keys: pr2-7 and pr3-mix parse to their set; labels name the book', () => {
        const { x } = loadEngine();
        assert.deepEqual(x._unitParse('pr2-7'), { set: 'pr2', unit: 7 });
        assert.deepEqual(x._unitParse('pr3-mix'), { set: 'pr3', unit: 'mix' });
        assert.equal(x._unitParse('hk1-3').set, null, 'a key from a set that no longer exists parses to no set');
        assert.equal(x._unitPool('pr2-7').length, UNIT_WORDS_PR2.filter(w => w.unit === 7).length);
        assert.equal(x._unitPool('pr3-mix').length, UNIT_WORDS_PR3.length);
        assert.equal(x._unitLabel('pr2-7'), 'Book 2 · Unit 7');
        assert.equal(x._unitLabel('pr1-mix'), 'Book 1 · 🎲 Mix');
        assert.equal(x.unitTitle('pr1', 1), UNIT_PR_TITLES.pr1[1]);
    });

    test('the host remembers its set: Word defaults to Book 1, and a foreign id falls back', () => {
        const { x, sb } = loadEngine();
        assert.equal(x.currentUnitSet('word'), 'pr1');
        x.switchUnitSet('pr3');
        assert.equal(sb.appState.wordSet, 'pr3', 'the choice is stored under the host\'s own key');
        assert.equal(x.currentUnitSet('word'), 'pr3');
        // A set id from a bank that no longer exists is ignored.
        sb.appState.wordSet = 'hk2';
        assert.equal(x.currentUnitSet('word'), 'pr1', 'a foreign set id falls back to the host default');
        x.switchUnitSet('hk2');
        assert.equal(x.currentUnitSet('word'), 'pr1', 'and cannot be switched to');
    });

    test('the Word home draws on the Word pieces, with no set strip', () => {
        const { x, html } = loadEngine();
        x.renderWordHome();
        assert.equal(x.unitCurrentHost(), 'word');
        const bar = html('wordUnitsBar');
        assert.truthy(bar.includes('g4-grid'), 'unit cards drawn on #wordUnitsBar');
        assert.equal((bar.match(/startUnitPractice\('pr1-\d+'\)/g) || []).length, 8, 'eight unit cards for Book 1');
        assert.truthy(bar.includes('Bài 1') && bar.includes('Bài 8'), 'each Book 1 card says which book unit it is');
        assert.truthy(bar.includes("startUnitPractice('pr1-mix')"), 'and a Mix card');
        assert.equal(x.renderUnitSetTabsHTML(), '', 'the bottom bar chooses the book: no set strip');
        assert.truthy(!bar.includes('switchUnitSet('), 'no set tab on the Word screen');
        assert.truthy(bar.includes(UNIT_PR_TITLES.pr1[1]), 'unit titles come from the bank');
        assert.truthy(html('wordSubTabs').includes("renderWordHome('history')"), 'the history sub-tab goes to the Word home');
        // The header names the open book.
        x.switchUnitSet('pr2');
        x.renderWordHome();
        assert.equal((html('wordUnitsBar').match(/startUnitPractice\('pr2-\d+'\)/g) || []).length, 7, 'seven unit cards for Book 2');
    });

    test('a Book practice belongs to the Word screen and lands in the Word history', () => {
        const { x, sb, html } = loadEngine();
        x.startUnitPractice('pr1-1');
        const st = x.quiz();
        assert.truthy(st, 'practice started');
        assert.equal(x.unitCurrentHost(), 'word');
        assert.equal(x.unitPracticeScreen(), 'wordScreen', 'the leave guard is told the Word screen');
        assert.truthy(html('wordDetail').includes('unitTextInput'), 'the question is drawn in #wordDetail');
        assert.truthy(html('wordDetail').includes('unit-ex-blank'), 'the example sentence is shown with the word blanked');
        assert.truthy(!html('wordDetail').includes('unit-q-exvi'), 'its translation is withheld until answered');
        assert.truthy(st.questions.every(q => q.w.set === 'pr1' && q.w.unit === 1), 'only Book 1 Unit 1 words');
        // Answer the first right, the rest wrong.
        sb.document.getElementById('unitTextInput').value = st.questions[0].w.en;
        x.submitUnitAnswer();
        assert.equal(st.answers[0].isCorrect, true);
        for (let i = 1; i < st.questions.length; i++) {
            x.nextUnitQuestion();
            sb.document.getElementById('unitTextInput').value = 'zzzz';
            x.submitUnitAnswer();
        }
        x.finishUnitPractice();
        assert.equal(sb.appState.unitsHistory.length, 1, 'one history row');
        const row = sb.appState.unitsHistory[0];
        assert.equal(row.unit, 'pr1-1');
        assert.equal(row.score, 1);
        assert.equal(row.total, st.questions.length);
        assert.equal(sb.appState.coins, 5, 'five coins for the one right answer');
        assert.truthy(row.skills.every(s => s.skillKey.startsWith('word.unit.pr1.1.')), 'skill keys are the Word tab\'s: ' + row.skills.map(s => s.skillKey));
        assert.equal(x.unitsHostHistory('word').length, 1, 'the row is the Word host\'s');
        assert.truthy(html('wordDetail').includes('renderWordHome()'), 'the results screen goes back to the Word home');
    });

    test('missed words are owed on the word queue and gate the cards', () => {
        const { x, sb, html } = loadEngine();
        assert.deepEqual(Object.keys(x.RETRY_DRILLS), ['word'], 'the one host registers the one drill');
        assert.equal(x.RETRY_DRILLS.word.screenId, 'wordDetail');
        assert.equal(x.unitsRetryKey(), 'word');
        x.startUnitPractice('pr2-3');
        const st = x.quiz();
        for (let i = 0; i < st.questions.length; i++) {
            if (i) x.nextUnitQuestion();
            sb.document.getElementById('unitTextInput').value = 'zzzz';
            x.submitUnitAnswer();
        }
        x.finishUnitPractice();
        assert.equal(x.unitsRetryCount('word'), st.questions.length, 'every miss owed on the word queue');
        assert.truthy(sb.appState.wordRetry.every(id => /^pr2\|/.test(id)), 'owed ids carry their set: ' + sb.appState.wordRetry[0]);
        // The cards lock.
        x.renderWordHome();
        assert.truthy(html('wordUnitsBar').includes('locked'), 'cards are locked while words are owed');
        // Starting a new practice is refused and the drill opens instead.
        x.startUnitPractice('pr2-4');
        assert.equal(x.quiz(), null, 'no new practice while words are owed');
        assert.truthy(x.retryList('word').length > 0, 'the owed words resolve back to real words');
        assert.equal(x.retryList('word')[0].set, 'pr2', 'to the Book 2 word that was missed');
    });

    test('a profile change forgets the set choice', () => {
        const { x, sb } = loadEngine();
        x.switchUnitSet('pr2');
        sb.appState = null;   // no state: the fallback is what a fresh profile would see
        assert.equal(x.currentUnitSet('word'), 'pr2', 'the fallback remembers the choice…');
        x.unitsForgetProfile();
        assert.equal(x.currentUnitSet('word'), 'pr1', '…until the profile changes');
    });
});

suite('word tab: a practice interrupted and brought back', () => {
    // The study checkpoint (js/app.js) names the screen a practice belongs
    // to; a restored one must come back on the Word screen and, on finish, be
    // scored under the Word skill keys and owed to the 'word' queue. Run it
    // for real: interrupt, "reload", restore.
    const { mountApp, loginTestUser } = require('./verify/client.js');
    const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
    const tick = () => new Promise((r) => setImmediate(r));
    const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

    test('a Book practice restored from the checkpoint lands on the Word screen and scores as Word', async () => {
        const h = mountApp();
        assert.deepEqual(h.loadErrors, [], 'the app must boot cleanly');
        loginTestUser(h, { coins: 100 });
        h.sandbox.startStudyCheckpointing();
        h.sandbox.switchScreen('wordScreen');
        await settle();
        h.sandbox.startUnitPractice('pr1-2');
        const st = h.peek('_unitQuiz');
        assert.truthy(st, 'practice started');
        h.el('unitTextInput').value = st.questions[0].w.en;
        h.sandbox.submitUnitAnswer();
        h.sandbox.nextUnitQuestion();
        const saved = JSON.parse(h.store[CHECKPOINT_KEY]);
        assert.equal(saved.kind, 'units');
        assert.equal(saved.screen, 'wordScreen', 'the checkpoint names the Word screen');
        // "reload"
        const h2 = mountApp({ storage: Object.assign({}, h.store) });
        h2.sandbox.startStudyCheckpointing();
        h2.sandbox.loginUser('BeNa');
        assert.equal(h2.sandbox.restoreStudyCheckpoint(), false, 'waits for the lazy Word bank first');
        await settle(12);
        assert.truthy(h2.sandbox.isUnitPracticeActive(), 'the round came back');
        assert.truthy(h2.el('wordScreen').classList.contains('active'), 'on the Word screen');
        assert.truthy(!h2.el('homeScreen').classList.contains('active'), 'not on Home');
        assert.equal(h2.sandbox.unitPracticeScreen(), 'wordScreen');
        assert.equal(h2.sandbox.unitCurrentHost(), 'word');
        assert.truthy(h2.el('wordDetail').querySelector('#unitTextInput'), 'the question is drawn in #wordDetail');
        assert.equal(h2.peek('_unitQuiz').idx, 1, 'on the second question, as left');
        // Leaving asks — and the Word drill/practice guard sends the child back to wordScreen on Cancel.
        h2.sandbox.__confirmAnswer = false;
        assert.equal(h2.sandbox.switchScreen('homeScreen'), false, 'the bottom bar asks before leaving');
        assert.truthy(h2.sandbox.isUnitPracticeActive(), 'Cancel keeps the round');
        // Finish the rest wrong: scored as Word, owed to Word.
        const q = h2.peek('_unitQuiz');
        for (let i = q.idx; i < q.questions.length; i++) {
            if (i > q.idx) h2.sandbox.nextUnitQuestion();
            h2.el('unitTextInput').value = 'zzzz';
            h2.sandbox.submitUnitAnswer();
        }
        h2.sandbox.finishUnitPractice();
        const app = h2.peek('appState');
        assert.equal(String(app.unitsHistory[0].unit), 'pr1-2');
        assert.truthy(app.unitsHistory[0].skills.every(k => k.skillKey.startsWith('word.unit.')), 'scored under the Word skill keys');
        assert.truthy(h2.sandbox.unitsRetryCount('word') > 0, 'owed on the word queue');
        assert.equal(h2.store[CHECKPOINT_KEY], undefined, 'finished → the checkpoint is gone');
    });
});

suite('word tab: wired into the app', () => {
    const html = read('index.html');
    const lazy = read('js/lazy-data.js');
    const sw = read('sw.js');

    test('the bottom bar has three Book buttons, each opening the Word screen on its set', () => {
        const keys = [...html.matchAll(/data-nav-key="([a-z0-9]+)"/g)].map(m => m[1]);
        assert.deepEqual(keys, ['home', 'book1', 'book2', 'book3', 'farm']);
        for (const b of [1, 2, 3]) {
            assert.truthy(new RegExp(`data-nav-key="book${b}"[^>]*onclick="openBook\\('pr${b}'\\)"`).test(html),
                'Book ' + b + ' opens its set');
        }
        assert.truthy(/function openBook\(set\)[\s\S]*?switchUnitSet\(set, \{ silent: true \}\)[\s\S]*?switchScreen\('wordScreen'\)/.test(read('js/app.js')),
            'openBook chooses the set, then opens wordScreen');
        assert.truthy(!html.includes('id="examScreen"'), 'the Exam screen is gone');
        assert.truthy(!fs.existsSync(path.join(ROOT, 'js', 'exam-data.js')), 'the HCMC bank is gone');
    });

    test('the Word screen carries the header and the four pieces the engine draws into', () => {
        assert.truthy(html.includes('id="wordScreen"'));
        for (const id of ['wordTitle', 'wordSubtitle', 'wordSubTabs', 'wordUnitsBar', 'wordHistory', 'wordDetail']) {
            assert.truthy(html.includes(`id="${id}"`), 'missing #' + id);
        }
        assert.truthy(/id="wordScreen"[^>]*/.test(html) && /class="screen[^"]*grade4-screen[^"]*"\s+id="wordScreen"/.test(html),
            'it carries the card-grid styling class (css/styles.css .grade4-screen rules)');
    });

    test('the bank is lazy, precached, and never on the startup path', () => {
        assert.truthy(/wordScreen:\s*\['js\/word-data\.js'\]/.test(lazy), 'SCREEN_FILES.wordScreen lists the bank (its rules live in css/styles.css)');
        assert.truthy(!/<script src="js\/word-data\.js">/.test(html), 'js/word-data.js must not be a startup <script>');
        assert.truthy(/'\/js\/word-data\.js':\s*'[0-9a-f]{16}'/.test(sw), 'sw.js PRECACHE lists /js/word-data.js');
        assert.truthy(!sw.includes('/js/exam-data.js') && !sw.includes('/js/exam-lessons.js'), 'the old bank left the precache');
        assert.truthy(!lazy.includes('examScreen'), 'the loader no longer knows examScreen');
    });

    test('js/app.js paints the Word home after the lazy bank lands and guards its practice', () => {
        const app = read('js/app.js');
        assert.truthy(/screenId === 'wordScreen' && typeof renderWordHome === 'function'\) renderWordHome\(\)/.test(app));
        assert.truthy(/NAV_KEY_BY_BOOK = Object\.freeze\(\{ pr1: 'book1', pr2: 'book2', pr3: 'book3' \}\)/.test(app),
            'wordScreen maps to the nav key of the open book');
        assert.truthy(app.includes('unitPracticeScreen()'), 'the leave guard asks the engine which screen the practice is on');
        assert.truthy(!app.includes("'examScreen'"), 'no examScreen left in app.js');
    });

    test('the home screen counts each Book\'s rows as its own skill', () => {
        const home = read('js/home.js');
        for (const b of [1, 2, 3]) {
            assert.truthy(new RegExp(`key: 'book${b}', set: 'pr${b}', re: /\\^pr${b}-/, label: 'Book ${b}'`).test(home), 'Book ' + b + ' skill row');
        }
        assert.truthy(/function goToSkillTab\(key\)[\s\S]*?openBook\(book\.set\)/.test(home), 'the skill row deep-links to its Book');
        assert.truthy(!/key: 'exam'/.test(home), 'the Exam skill is gone');
    });

    test('generated-file discipline: CLAUDE.md names the build and validate commands', () => {
        const md = read('CLAUDE.md');
        assert.truthy(md.includes('scripts/build-word-data.js'), 'CLAUDE.md lists node scripts/build-word-data.js');
        assert.truthy(md.includes('scripts/validate-word-data.js'), 'CLAUDE.md lists the validator');
    });
});

if (require.main === module) {
    runAll().then(code => process.exit(code));
}
