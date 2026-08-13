// answer-audio.js — hear the correct answer before moving on.
//
// In Word form, Phrases, Collocation and Verbs, answering a question reveals
// the correct answer and speaks it aloud. The student must then tap 🔊 to
// hear it once more before Next unlocks, so the pronunciation is heard
// deliberately rather than in passing.
//
// The gate opens on the TAP, never on successful playback: a muted phone, a
// missing recording or an audio error must not strand a child inside a quiz.

// No icon here — the 🔊 button sits immediately to its left.
const ANSWER_GATE_HINT = 'Nghe đáp án để tiếp tục';      // "listen to continue"
const ANSWER_GATE_DONE = '✓ Tốt lắm!';                    // "well done"

// "conclusive/ resign" fills two blanks and "was/were" is two verb forms —
// each half is its own word to pronounce, and there is no recording of the
// combined string.
function answerAudioParts(answer) {
    return String(answer == null ? '' : answer)
        .split('/')
        .map(s => s.trim())
        .filter(Boolean);
}

// Speak each part in turn, waiting for one to finish before the next starts.
// Returns how many parts were queued.
// opts.auto — this is the automatic pronunciation fired when the answer is
// revealed, not a deliberate tap. Browsers may refuse it (no user gesture),
// and when they do it must stay SILENT: the student still has to tap 🔊 to
// continue, and that tap plays the real recording. Substituting the device's
// robot voice here is what makes an answer come out in two different voices.
function speakAnswer(answer, opts) {
    const parts = answerAudioParts(answer);
    if (!parts.length) return 0;
    // Preferred path: the audio layer plays the whole run through the one
    // element the student's tap unlocked, so no part falls back partway.
    if (typeof speakSequence === 'function') {
        return speakSequence(parts, { fallback: !(opts && opts.auto) });
    }
    if (typeof speakWord !== 'function') return 0;
    let i = 0;
    const playNext = () => {
        if (i >= parts.length) return;
        const word = parts[i++];
        try {
            speakWord(word, playNext);
        } catch (e) {
            // One bad part must not swallow the rest.
            try { playNext(); } catch (e2) {}
        }
    };
    playNext();
    return parts.length;
}

function answerAudioEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// The listen row plus the Next button it guards. Tabs pass their own next
// handler so each keeps its own flow.
function answerGateHTML(answer, nextOnclick, nextLabel) {
    const a = answerAudioEsc(answer);
    return `<div class="answer-gate" data-answer="${a}">
      <button class="answer-gate-btn" onclick="hearAnswer(this)" aria-label="Nghe đáp án">🔊</button>
      <span class="answer-gate-hint">${ANSWER_GATE_HINT}</span>
    </div>
    <button class="grammar-next-btn" disabled onclick="${nextOnclick}">${nextLabel}</button>`;
}

// Tapping the speaker: play the answer, then open the gate — in that order,
// but independently, so a throw on the way in still unlocks Next.
function hearAnswer(btn) {
    const gate = btn && btn.closest ? btn.closest('.answer-gate') : null;
    try {
        const answer = gate ? (gate.getAttribute('data-answer') || '') : '';
        speakAnswer(answer);
    } catch (e) {}
    if (!gate) return;
    gate.classList.add('heard');
    const hint = gate.querySelector('.answer-gate-hint');
    if (hint) hint.textContent = ANSWER_GATE_DONE;
    const wrap = gate.parentNode;
    const next = wrap && wrap.querySelector ? wrap.querySelector('.grammar-next-btn') : null;
    if (next) {
        next.disabled = false;
        if (next.classList) next.classList.add('unlocked');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        answerAudioParts, speakAnswer, answerGateHTML, hearAnswer, answerAudioEsc,
        ANSWER_GATE_HINT, ANSWER_GATE_DONE
    };
}
