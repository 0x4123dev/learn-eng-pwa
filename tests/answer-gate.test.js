// answer-gate.test.js — after answering in Word form, Phrases, Collocation
// and Verbs, the correct answer is spoken aloud, and the student must tap 🔊
// to hear it again before moving on. The tap is the gate, not successful
// playback: a muted phone or a missing file must never trap a child inside a
// quiz with no way forward.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadAppCode } = require('./setup');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// A DOM stub just rich enough for the gate: class lists, data attributes,
// closest() and querySelector() over a tiny hand-built tree.
function makeEl(tag, attrs) {
    const el = {
        tagName: tag, disabled: false, textContent: '', innerHTML: '',
        dataset: {}, parentNode: null, children: [],
        classes: new Set(),
        classList: {
            add: (c) => el.classes.add(c),
            remove: (c) => el.classes.delete(c),
            contains: (c) => el.classes.has(c)
        },
        getAttribute: (k) => (el.dataset[k.replace(/^data-/, '')] ?? null),
        setAttribute: (k, v) => { el.dataset[k.replace(/^data-/, '')] = String(v); },
        removeAttribute: (k) => { delete el.dataset[k.replace(/^data-/, '')]; },
        append(child) { child.parentNode = el; el.children.push(child); return child; },
        closest(sel) {
            const want = sel.replace(/^\./, '');
            let n = el;
            while (n) { if (n.classes.has(want)) return n; n = n.parentNode; }
            return null;
        },
        querySelector(sel) {
            const want = sel.replace(/^\./, '');
            const walk = (n) => {
                for (const c of n.children) {
                    if (c.classes.has(want)) return c;
                    const hit = walk(c);
                    if (hit) return hit;
                }
                return null;
            };
            return walk(el);
        }
    };
    for (const [k, v] of Object.entries(attrs || {})) {
        if (k === 'class') String(v).split(/\s+/).forEach(c => c && el.classes.add(c));
        else el.dataset[k.replace(/^data-/, '')] = v;
    }
    return el;
}

function loadGate(extra) {
    const spoken = [];
    const sandbox = {
        console,
        module: { exports: {} },
        speakWord: (w, onDone) => { spoken.push(w); if (typeof onDone === 'function') onDone(); },
        document: { getElementById: () => null, querySelector: () => null }
    };
    Object.assign(sandbox, extra || {});
    sandbox.globalThis = sandbox; sandbox.global = sandbox; sandbox.window = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(read('js/answer-audio.js'), ctx, { filename: 'answer-audio.js' });
    return { gate: sandbox.module.exports, spoken };
}

// Build the DOM the gate HTML describes: a wrapper holding the gate and the
// Next button as siblings.
function mountGate(answer) {
    const wrap = makeEl('div', { class: 'gate-wrap' });
    const gate = wrap.append(makeEl('div', { class: 'answer-gate', 'data-answer': answer }));
    const btn = gate.append(makeEl('button', { class: 'answer-gate-btn' }));
    gate.append(makeEl('span', { class: 'answer-gate-hint' }));
    const next = wrap.append(makeEl('button', { class: 'grammar-next-btn' }));
    next.disabled = true;
    return { wrap, gate, btn, next };
}

suite('answer gate: speaking the answer', () => {
    test('a plain answer is spoken as one word', () => {
        const { gate, spoken } = loadGate();
        gate.speakAnswer('education');
        assert.deepEqual(spoken, ['education']);
    });

    test('a collocation pair is spoken as its two words, in order', () => {
        // "conclusive/ resign" fills two blanks — one recording of the whole
        // string would be nonsense, and no such file exists.
        const { gate, spoken } = loadGate();
        gate.speakAnswer('conclusive/ resign');
        assert.deepEqual(spoken, ['conclusive', 'resign']);
    });

    test('irregular verb forms like "was/were" are both spoken', () => {
        const { gate, spoken } = loadGate();
        gate.speakAnswer('was/were');
        assert.deepEqual(spoken, ['was', 'were']);
    });

    test('a verb speaks all three forms in order', () => {
        // "weave → wove → woven": the base form is part of what the student
        // is learning to say, not just the two forms they had to type.
        const { gate, spoken } = loadGate();
        gate.speakAnswer('weave/ wove/ woven');
        assert.deepEqual(spoken, ['weave', 'wove', 'woven']);
    });

    test('an empty answer speaks nothing and does not throw', () => {
        const { gate, spoken } = loadGate();
        assert.equal(gate.speakAnswer(''), 0);
        assert.equal(gate.speakAnswer(null), 0);
        assert.deepEqual(spoken, []);
    });
});

// Phones only allow audio that a user gesture started. The tap unlocks the
// ONE element it played; a freshly-created element for the second word was
// never unlocked, so play() is refused and speakWord falls back to the
// device's robot voice — which is why "drink → drank → drunk" came out as
// one real voice followed by a different, male one. Every part of a sequence
// must therefore go through the same, already-unlocked element.
suite('answer gate: a sequence plays through one unlocked element', () => {
    function loadAppWithAudio() {
        const created = [];
        const played = [];
        class FakeAudio {
            constructor(src) {
                this._src = src || '';
                this.currentTime = 0; this.preload = '';
                created.push(this);
            }
            get src() { return this._src; }
            set src(v) { this._src = v; }
            cloneNode() { return new FakeAudio(this._src); }
            pause() {}
            play() {
                played.push(this._src);
                const self = this;
                // Fire 'ended' synchronously so the whole chain runs inside the
                // test — the harness does not await, so an async test cannot fail.
                const p = { catch() { return p; }, then(fn) { if (fn) fn(); return p; } };
                self.onended && self.onended();
                return p;
            }
        }
        const synth = { calls: [], cancel() {}, resume() {}, getVoices() { return []; },
                        speak(u) { this.calls.push(u && u.text); }, speaking: false, pending: false };
        const app = loadAppCode({
            includeHome: false,
            extraGlobals: {
                Audio: FakeAudio,
                SpeechSynthesisUtterance: function (t) { this.text = String(t); },
                window: { speechSynthesis: synth }
            }
        });
        return { app, created, played, synth };
    }

    test('speakSequence uses a single Audio element for every word', () => {
        const { app, created, played } = loadAppWithAudio();
        app.speakSequence(['drink', 'drank', 'drunk']);
        assert.deepEqual(played, [
            app.WORD_AUDIO_PATH + 'drink.mp3',
            app.WORD_AUDIO_PATH + 'drank.mp3',
            app.WORD_AUDIO_PATH + 'drunk.mp3'
        ]);
        assert.equal(created.length, 1,
            `made ${created.length} elements — only the first is gesture-unlocked, the rest get refused`);
    });

    test('the same element is reused on the next question too', () => {
        const { app, created } = loadAppWithAudio();
        app.speakSequence(['drink', 'drank']);
        const afterFirst = created.length;
        app.speakSequence(['go', 'went']);
        assert.equal(created.length, afterFirst, 'a new element per question loses the unlock again');
    });

    test('speakAnswer routes through speakSequence rather than chaining speakWord', () => {
        const src = read('js/answer-audio.js');
        assert.truthy(/speakSequence\(/.test(src),
            'answer-audio.js must hand the whole sequence to the audio layer');
    });
});

suite('answer gate: the required tap', () => {
    test('the rendered Next button starts disabled and the hint explains why', () => {
        const { gate } = loadGate();
        const html = gate.answerGateHTML('education', 'nextWfQuestion()', 'Next →');
        assert.truthy(/class="grammar-next-btn"[^>]*disabled/.test(html) ||
                      /disabled[^>]*class="grammar-next-btn"/.test(html),
            'Next must render disabled — that is the gate');
        assert.truthy(html.includes('nextWfQuestion()'), 'the tab keeps its own next handler');
        assert.truthy(html.includes(gate.ANSWER_GATE_HINT), 'the student must be told why Next is locked');
        assert.truthy(/data-answer="education"/.test(html));
    });

    test('an answer containing quotes cannot break out of the attribute', () => {
        const { gate } = loadGate();
        const raw = 'say "hello"/ don\'t';
        const html = gate.answerGateHTML(raw, 'next()', 'Next →');
        // Read back just the attribute value: it must terminate where we
        // expect, with the quotes encoded rather than closing it early.
        const m = /data-answer="([^"]*)"/.exec(html);
        assert.truthy(m, 'data-answer must be parseable');
        assert.truthy(m[1].includes('&quot;'), `quotes not encoded: ${m[1]}`);
        assert.truthy(m[1].includes('&#39;'), `apostrophe not encoded: ${m[1]}`);
        // And it must still decode back to the real answer.
        assert.deepEqual(gate.answerAudioParts(raw), ['say "hello"', "don't"]);
    });

    test('tapping the speaker plays the answer and unlocks Next', () => {
        const { gate, spoken } = loadGate();
        const { btn, next } = mountGate('conclusive/ resign');
        assert.equal(next.disabled, true, 'precondition: locked');
        gate.hearAnswer(btn);
        assert.deepEqual(spoken, ['conclusive', 'resign']);
        assert.equal(next.disabled, false, 'Next must unlock after the tap');
    });

    test('the gate opens on the tap even when playback fails', () => {
        // A muted phone, a missing file, an audio error — none of them may
        // leave a child stuck on a question forever.
        const { gate } = loadGate({ speakWord: () => { throw new Error('no audio'); } });
        const { btn, next } = mountGate('education');
        gate.hearAnswer(btn);
        assert.equal(next.disabled, false, 'a playback failure must not trap the student');
    });

    test('tapping again just replays, and Next stays unlocked', () => {
        const { gate, spoken } = loadGate();
        const { btn, next } = mountGate('education');
        gate.hearAnswer(btn);
        gate.hearAnswer(btn);
        assert.deepEqual(spoken, ['education', 'education']);
        assert.equal(next.disabled, false);
    });
});

// Explanations are Vietnamese teaching notes with English grammar jargon mixed
// in. They are rendered escaped, never through tapwordsWrap — which is what
// keeps words like "danh"/"trong"/"sai" from becoming tappable and being read
// aloud by an English voice. Easy to undo by accident.
suite('tap words: explanations stay untappable', () => {
    test('no tab passes an explanation through the word wrapper', () => {
        const offenders = ['js/wordform.js', 'js/phrases.js', 'js/collocation.js',
                           'js/grammar-ui.js', 'js/exam.js', 'js/rewrite.js']
            .filter(f => /(?:tapwordsWrap|twrap|twrapG|\bwrap)\(\s*[a-z]\.explanation/.test(read(f)));
        assert.deepEqual(offenders, [],
            `these would make Vietnamese explanation text tappable: ${offenders.join(', ')}`);
    });

    test('question text, options and answers DO stay tappable', () => {
        // The other half of the rule — this is the English the student is learning.
        const wf = read('js/wordform.js');
        assert.truthy(/wrap\(q\.q\)/.test(wf), 'the question stem must stay tappable');
        assert.truthy(/wrap\(opt\)/.test(wf), 'options must stay tappable');
    });
});

suite('answer gate: wired into every tab that asks for it', () => {
    const TABS = [
        ['js/wordform.js', 'nextWfQuestion()'],
        ['js/phrases.js', 'nextPhrQuestion()'],
        ['js/collocation.js', 'nextCollocQuestion()'],
        ['js/verbs.js', 'nextSpeedQuestion()'],
        ['js/units.js', 'nextUnitQuestion()']      // Grade 4 picture-dictionary units
    ];

    test('each tab renders its Next button through the gate', () => {
        const missing = TABS.filter(([f]) => !/answerGateHTML\(/.test(read(f))).map(([f]) => f);
        assert.deepEqual(missing, [], `tabs still rendering an ungated Next: ${missing.join(', ')}`);
    });

    test('no tab lets a student skip a listen that applies to them', () => {
        // An ungated Next is only legitimate where there is nothing to hear:
        // the Vietnamese meaning questions in Phrases, and the Word form
        // understanding check — both are answered in Vietnamese, and the Word
        // form one comes AFTER the gated screen that already spoke the answer.
        // Anywhere else it means the student can walk past the pronunciation.
        const leaks = TABS.filter(([f]) => {
            const src = read(f);
            const bare = /<button class="grammar-next-btn" onclick=|'<button class="grammar-next-btn" onclick="/.test(src);
            if (!bare) return false;
            return !/if \(q\.meaning\)|q\.followup/.test(src);   // guarded by "nothing to pronounce"
        }).map(([f]) => f);
        assert.deepEqual(leaks, [], `these bypass the gate entirely: ${leaks.join(', ')}`);
    });

    test('Verbs speaks v1, v2 and v3 — the whole pattern, not just the typed forms', () => {
        const src = read('js/verbs.js');
        const m = /const answer = ([^;]+);/.exec(src);
        assert.truthy(m, 'speedAnswerGate must build the spoken answer');
        for (const form of ['v1', 'v2', 'v3']) {
            assert.truthy(m[1].includes('.' + form), `the spoken answer omits ${form}: ${m[1]}`);
        }
    });

    test('the hint does not repeat the speaker icon the button already shows', () => {
        const { gate } = loadGate();
        assert.falsy(/🔊/.test(gate.ANSWER_GATE_HINT),
            'the 🔊 button sits right beside this text — two icons read as a glitch');
    });

    test('Phrases speaks the whole collocation, not the bare preposition', () => {
        // The answer to a Phrases question is a preposition — "in". Hearing
        // "in" on its own teaches nothing; the thing being learned is the
        // collocation, "rise in", which every question carries as q.phrase.
        const src = read('js/phrases.js');
        assert.truthy(/speakAnswer\(\s*q\.phrase/.test(src),
            'the spoken answer must start from q.phrase');
        assert.truthy(/answerGateHTML\(\s*q\.phrase/.test(src),
            'and the 🔊 button must replay the same phrase');
    });

    test('meaning questions carry no listen gate', () => {
        // "What is the meaning of \"rise in\"?" is answered in Vietnamese.
        // There is no English to pronounce, so requiring a listen is a step
        // that teaches nothing and blocks the student for no reason.
        const src = read('js/phrases.js');
        const fn = src.slice(src.indexOf('function phrFooterHTML'),
                             src.indexOf('function renderPhrQuestion'));
        assert.truthy(fn, 'phrases.js must decide its footer in one place');
        assert.truthy(/if \(q\.meaning\)/.test(fn), 'the meaning follow-up must be branched on');
        // The bare Next belongs to the meaning branch, the gate to the other.
        const meaningBranch = fn.slice(fn.indexOf('if (q.meaning)'), fn.indexOf('return answerGateHTML'));
        assert.truthy(/grammar-next-btn/.test(meaningBranch), 'meaning questions get a plain Next');
        assert.falsy(/answerGateHTML/.test(meaningBranch), 'and must not be gated');
    });

    test('Collocation speaks the collocation, not the word that filled the gap', () => {
        // "___ an effort" is answered with "make", but the lesson is "make an
        // effort". Collocation questions carry no phrase field; the English
        // collocation is the head of the vi gloss, before the em dash.
        Object.assign(global, require('../js/answer-audio.js'));
        global.COLLOCATION_QUESTIONS = require(path.join(root, 'js', 'collocation-data.js')).COLLOCATION_QUESTIONS;
        const col = require(path.join(root, 'js', 'collocation.js'));

        assert.equal(col.collocSpokenPhrase({ type: 'mcq', answer: 'make', vi: 'make an effort — nỗ lực' }),
            'make an effort');
        // A pair fills two gaps; the gloss documents only the first, so the
        // half it does not cover still has to be spoken.
        assert.equal(col.collocSpokenPhrase({ type: 'pair', answer: 'conclusive/ resign', vi: 'conclusive proof — bằng chứng' }),
            'conclusive proof/ resign');
        // 25 glosses are pure Vietnamese with no English head. Speaking those
        // would point an English voice at Vietnamese text.
        assert.equal(col.collocSpokenPhrase({ type: 'open', answer: 'across', vi: 'tình cờ tìm thấy hoặc gặp' }),
            'across');
    });

    test('no collocation is ever spoken as Vietnamese', () => {
        Object.assign(global, require('../js/answer-audio.js'));
        global.COLLOCATION_QUESTIONS = require(path.join(root, 'js', 'collocation-data.js')).COLLOCATION_QUESTIONS;
        const col = require(path.join(root, 'js', 'collocation.js'));
        const VN = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
        const bad = global.COLLOCATION_QUESTIONS
            .filter(q => VN.test(col.collocSpokenPhrase(q) || ''))
            .slice(0, 5).map(q => col.collocSpokenPhrase(q));
        assert.deepEqual(bad, [], 'these would be read aloud in English by mistake');
    });

    test('the Grade 4 units show exactly one speaker after answering', () => {
        // The answered view already had its own 🔊 beside the word. Leaving it
        // next to the gate's 🔊 would offer two buttons where only one unlocks
        // Next — the student taps the wrong one and thinks the app is stuck.
        const src = read('js/units.js');
        const answered = src.slice(src.indexOf('let body;'), src.indexOf('function nextUnitQuestion'));
        assert.falsy(/unit-say-btn/.test(answered),
            'the answered view must not keep a second speaker alongside the gate');
        assert.truthy(/answerGateHTML\(/.test(answered), 'the gate is what speaks there now');
    });

    test('the Check button tells the student it will speak the answer', () => {
        const m = /<button class="speed-submit-btn" id="speedSubmitBtn">\s*([^<]+)/.exec(read('index.html'));
        assert.truthy(m, 'the Check button was not found');
        assert.truthy(/🔊/.test(m[1]),
            `label "${m[1].trim()}" does not say it pronounces — pressing it is the reliable way to hear the answer`);
    });

    test('checking is treated as a gesture, timing out is not', () => {
        // Pressing Check is a real tap, so the browser will allow the audio and
        // a missing recording may fall back to speech. A timed-out question has
        // no gesture behind it: the browser refuses playback, and silence beats
        // finishing the answer in a different voice.
        const src = read('js/verbs.js');
        const timeUp = src.slice(src.indexOf('function handleTimeUp'),
                                src.indexOf('function speedAnswerGate'));
        assert.truthy(/speedAnswerGate\(verb,\s*false\)/.test(timeUp),
            'the timer path must declare that no gesture is behind it');
        const submit = src.slice(src.indexOf('function submitSpeedAnswer'));
        assert.truthy(/speedAnswerGate\(verb,\s*true\)/.test(submit),
            'the Check button path must declare its gesture');
        assert.equal((submit.match(/speedAnswerGate\(verb,\s*true\)/g) || []).length, 2,
            'both the correct and the wrong branch of Check must pass the gesture');
    });

    test('the Verbs speed challenge no longer auto-advances past the answer', () => {
        // It used to jump to the next verb on a timer, which would skip the
        // required listen. The gate replaces that.
        const src = read('js/verbs.js');
        assert.falsy(/setTimeout\(\s*\(\s*\)\s*=>\s*\{?\s*nextSpeedQuestion\(\)/.test(src),
            'an auto-advance timer would race past the required listen');
    });

    test('every tab speaks the answer automatically on answering', () => {
        const missing = TABS.filter(([f]) => !/speakAnswer\(/.test(read(f))).map(([f]) => f);
        assert.deepEqual(missing, [], `tabs that never auto-pronounce: ${missing.join(', ')}`);
    });

    test('answer-audio.js is loaded before every tab that calls it, and precached', () => {
        const html = read('index.html');
        const gate = html.indexOf('js/answer-audio.js');
        assert.truthy(gate !== -1, 'index.html must load it');
        // Each tab calls answerGateHTML() unconditionally, so the definition
        // has to exist by the time that script's screen renders. Ordering it
        // ahead of all five keeps that true even if a call ever moves to load
        // time.
        for (const tab of ['units', 'wordform', 'phrases', 'collocation', 'verbs']) {
            const at = html.indexOf(`js/${tab}.js`);
            assert.truthy(at !== -1, `index.html does not load js/${tab}.js`);
            assert.truthy(gate < at, `answer-audio.js loads after js/${tab}.js, which calls it`);
        }
        assert.truthy(/answer-audio\.js/.test(read('sw.js')), 'sw.js ASSETS must include it');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
