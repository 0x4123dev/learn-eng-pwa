// answer-gate.test.js — after answering in Word form, Phrases, Collocation
// and Verbs, the correct answer is spoken aloud, and the student must tap 🔊
// to hear it again before moving on. The tap is the gate, not successful
// playback: a muted phone or a missing file must never trap a child inside a
// quiz with no way forward.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

    test('an empty answer speaks nothing and does not throw', () => {
        const { gate, spoken } = loadGate();
        assert.equal(gate.speakAnswer(''), 0);
        assert.equal(gate.speakAnswer(null), 0);
        assert.deepEqual(spoken, []);
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

suite('answer gate: wired into every tab that asks for it', () => {
    const TABS = [
        ['js/wordform.js', 'nextWfQuestion()'],
        ['js/phrases.js', 'nextPhrQuestion()'],
        ['js/collocation.js', 'nextCollocQuestion()'],
        ['js/verbs.js', 'nextSpeedQuestion()']
    ];

    test('each tab renders its Next button through the gate', () => {
        const missing = TABS.filter(([f]) => !/answerGateHTML\(/.test(read(f))).map(([f]) => f);
        assert.deepEqual(missing, [], `tabs still rendering an ungated Next: ${missing.join(', ')}`);
    });

    test('no tab still renders a bare, always-enabled Next button', () => {
        const leaks = TABS.filter(([f]) =>
            /<button class="grammar-next-btn" onclick=/.test(read(f))).map(([f]) => f);
        assert.deepEqual(leaks, [], `these bypass the gate entirely: ${leaks.join(', ')}`);
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

    test('answer-audio.js is loaded by the page and precached', () => {
        const html = read('index.html');
        assert.truthy(html.includes('js/answer-audio.js'), 'index.html must load it');
        assert.truthy(html.indexOf('js/answer-audio.js') < html.indexOf('js/wordform.js'),
            'it must load before the tabs that call it');
        assert.truthy(/answer-audio\.js/.test(read('sw.js')), 'sw.js ASSETS must include it');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
