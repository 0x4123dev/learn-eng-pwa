# Decision: Music-Based English Learning Feature

> **Status**: Proposed
> **Date**: 2026-03-05
> **Author**: brainstormer-agent
> **Deciders**: Product owner, developer

---

## Context

### Problem Statement

FlashLingo teaches 1,000 IELTS-level words through matching, flashcards, bubble games, word hunt, and speed challenges. The experience is entirely visual and text-based. Music and rhythm are among the strongest memory-encoding mechanisms in children's cognition — phonological awareness research consistently shows that rhythm training improves reading fluency, word retention, and second-language pronunciation accuracy. The app has no music dimension, leaving a high-impact learning modality entirely untapped.

### Constraints

- **No audio files** — no MP3s, no OGG, no hosted tracks
- **No external APIs** for music streaming or synthesis (network may be absent)
- **Offline-first** — all features must work completely without internet after installation
- **Vanilla JS only** — no frameworks, no bundlers
- **No copyrighted content** — no real songs, no copyrighted lyrics
- **Mobile-first** — touch UI, no keyboard/mouse assumptions
- **Lightweight** — localStorage state only; cannot add large new JS files casually
- **Available APIs**: Web Speech API (already in use via `speakWord()` / `speakWordFallback()`), Web Audio API (OscillatorNode, GainNode), CSS animations + setTimeout
- **Vocabulary data structure**: Each word has `.en`, `.ipa`, `.vi`, `.emoji`, `.ex` (example sentence) — rich enough to build rhythm and lyric content from
- **Target audience**: ages 6–14, Vietnamese learners of English

### Requirements

- **Must have**: Offline operation, use existing vocabulary data, fun for kids ages 6–14
- **Should have**: Clear English learning benefit (vocabulary retention, pronunciation), integration with existing points/achievements system
- **Nice to have**: Integration with SRS learned-word pool, replay value
- **Must NOT**: Require audio files, copyrighted music, network calls, frameworks

---

## Candidate Ideas — Full Longlist

Before narrowing, every option from the brainstorm was scored against five axes (1–5 scale):

| # | Idea | Fun | Learning Value | Feasibility | Effort (inv.) | Replay | Total |
|---|------|-----|----------------|-------------|---------------|--------|-------|
| 1 | Rhythm Tap / Syllable Clap | 5 | 5 | 5 | 4 | 4 | **23** |
| 2 | Word Melody Composer (word = note) | 4 | 3 | 4 | 3 | 5 | **19** |
| 3 | Chant Builder — TTS rap/chant | 4 | 4 | 5 | 5 | 3 | **21** |
| 4 | Karaoke Fill-in-the-Blank | 5 | 5 | 3 | 2 | 5 | **20** |
| 5 | Musical Dictation (hear melody, guess word) | 4 | 4 | 3 | 2 | 4 | **17** |
| 6 | Tone Memory (Simon-says with notes + words) | 3 | 2 | 4 | 4 | 3 | **16** |
| 7 | Word-to-Note Piano (tap letters → pitches) | 3 | 2 | 5 | 4 | 2 | **16** |
| 8 | Audio Memory Pairs (tone + word recall) | 3 | 3 | 4 | 4 | 3 | **17** |
| 9 | Beat Drop Quiz (answer before beat loops) | 4 | 3 | 4 | 3 | 3 | **17** |
| 10 | Pronunciation Rhythm Guide (IPA beat map) | 3 | 5 | 3 | 2 | 2 | **15** |

**Top 3 advance to full analysis**: #1 Rhythm Tap, #3 Chant Builder, #2 Word Melody Composer. #4 Karaoke is included as an optional stretch variant of #3.

---

## Options Considered

---

### Option A: Rhythm Tap — Syllable Clapping Game

**Description**

A fast-paced rhythm game where the app plays a vocabulary word through TTS (using the existing `speakWord()` infrastructure) and a beat plays underneath (Web Audio API oscillator pulse). The word's syllable count is shown as glowing dots. The kid taps each syllable on the beat. After tapping, the word is reinforced with definition + emoji.

**Mechanic Detail**

1. Select a random word from the learned SRS pool (or lesson pool if SRS is small).
2. Display the word with syllable-split annotation derived from IPA (e.g., `en·vi·ron·ment` → 4 dots).
3. A 4/4 beat pulse plays via a short Web Audio API oscillator kick drum (sine wave burst, ~80ms, 120 BPM).
4. TTS reads the word aloud, timed to the beat downbeat.
5. Player taps the screen once per syllable in time with the beat. Each tap triggers a visual ripple + note (higher oscillator tone).
6. Correct syllable count on tempo → green flash, points, combo counter.
7. Wrong count or mistimed → gentle failure sound (lower tone), show correct syllable count, TTS repeats word slowly.
8. After 10 words, show score, best combo, and words practiced.

**Syllable Count Source**

IPA strings are already in the vocabulary data. A simple function counts vowel-sound clusters in IPA notation to extract syllable count. This is deterministic and offline. Alternatively a small lookup table for ~200 most common words suffices; other words fall back to a vowel-count heuristic that works well for most English words.

**Web Audio Implementation Sketch**

```js
function playBeat(ctx, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 80; // kick drum feel
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(time); osc.stop(time + 0.1);
}

function playTapNote(ctx, syllableIndex, totalSyllables) {
  const notes = [523, 587, 659, 698, 784]; // C5, D5, E5, F5, G5
  const freq = notes[syllableIndex % notes.length];
  // ... same pattern, 0.12s duration
}
```

**Pros**

- Directly addresses phonological awareness — the single most research-validated benefit of rhythm in language learning (2024 studies: Zanto et al. on digital rhythm training improving reading fluency)
- IPA data is already in every vocabulary entry — syllable count can be derived without extra data
- Reuses `speakWord()` unchanged — zero TTS refactoring
- Extremely satisfying tactile loop — tap, hear, see — identical sensory pattern to existing games like Word Bubbles
- Works 100% offline: Web Audio API generates all sound programmatically
- Natural difficulty curve: start with 1-2 syllable words, graduate to 4-5 syllable IELTS words
- Combo mechanic fits the existing combo/points pattern already in Word Bubbles and Battle mode
- Ages 6–14: tapping to a beat is universally understood — no instructions needed

**Cons**

- Syllable parsing from IPA requires a careful implementation to be accurate; edge cases exist
- Timing precision on mobile Safari/Chrome WebView can be imperfect — need AudioContext scheduling (not `setTimeout`) for beat accuracy
- Screen taps during game conflict with tap-to-advance patterns; need clear UI separation

**Effort**: Low-Medium (1–2 weeks)
**Risk**: Low

---

### Option B: Word Chant Builder — TTS Rap / Rhythm Chant

**Description**

A "chant studio" where the app generates a rhythmic call-and-response chant from 3–5 vocabulary words in a lesson. The chant uses a fixed verse template. TTS narrates each line at a controlled pace. The child sees lyrics scroll with word-highlight (karaoke-style), and can tap along or repeat lines aloud.

**Chant Template Engine**

Using fixed verse templates with vocabulary slots — entirely generated from existing data, no copyrighted content:

```
Template A (noun/verb focus):
  LINE 1: "[word1]! [word1]! What does it mean?"
  LINE 2: "It means [vi_translation]! Now say it with me!"
  LINE 3: "[word1]... [word1]... [word1]!"
  LINE 4: "Good job! Now try [word2]..."

Template B (example sentence chant):
  LINE 1: "Listen carefully! [example_sentence]"
  LINE 2: "[word] — [emoji] — [word]!"
  LINE 3: "Say it again! [word]! [word]! [word]!"
```

TTS reads each line using `speechSynthesis.speak()` with a slightly elevated `rate` (1.1–1.2) for a rhythmic feel. A metronome pulse plays underneath via Web Audio API. Words are highlighted in the displayed lyric as TTS reads each syllable (approximated by timing + word index).

**Karaoke Stretch Variant (Fill-in-the-Blank)**

After the full chant plays once, run it again with one word blanked out — displayed as `____`. The child taps the word when they hear it in the chant. This is effectively a listening comprehension drill wrapped in musical enjoyment, mimicking LyricsTraining's proven approach but built entirely offline with generated content.

**Pros**

- Zero audio files — pure TTS + Web Audio API — fully offline
- Utilizes all existing vocabulary fields: `.en`, `.vi`, `.emoji`, `.ex`
- Chant templates are static strings in JS — tiny code footprint
- Karaoke variant adds a listening comprehension layer without additional implementation complexity
- Replay value: every lesson's 5 words generate a unique chant; 200 lessons = 200 unique chants
- Strong learning value: repetition-in-rhythm is the most ancient mnemonic technique (multiplication tables, alphabet songs); same mechanism for IELTS vocabulary
- Well-suited for ages 8–14 (younger kids may find it slightly abstract)
- Natural lesson integration point: offer Chant after lesson completion, alongside the existing Sentence Builder offer

**Cons**

- TTS rhythm is robotic — speech synthesis does not produce natural musical timing on most mobile voices; the "rap" feel depends heavily on device TTS quality
- Karaoke word highlighting sync with TTS is approximate (TTS does not expose character-level timing events in all browsers); must rely on word-count timing heuristic
- Less kinesthetic than Rhythm Tap — watching and listening without a clear action reduces engagement for younger kids (ages 6–9)
- Template variety is limited; chants may feel repetitive after many lessons without more templates

**Effort**: Low (1 week for basic chant; +0.5 weeks for karaoke fill-in variant)
**Risk**: Low-Medium (TTS timing reliability varies by browser/OS)

---

### Option C: Word Melody Composer — Words as Musical Notes

**Description**

A creative sandbox where each vocabulary word in the current lesson is assigned a unique musical note (C4 through B4). Kids arrange the words in any order to compose a short melody, hear it play back, and then name the words in the melody — embedding vocabulary recall inside a creative music act.

**Mechanic Detail**

1. After completing a lesson, 5 vocabulary words appear as colored note cards on a staff or row.
2. Each word is pre-assigned a note: word[0]→C4 (261Hz), word[1]→E4, word[2]→G4, word[3]→A4, word[4]→C5.
3. Child arranges words by tapping to add them to a sequence (max 8 slots).
4. Tap "Play" → Web Audio API plays notes in sequence (250ms each, sine wave + gentle gain envelope).
5. TTS reads each word aloud as its note sounds.
6. Child sees the melody they composed as a simple graphic (higher note = higher position).
7. "Quiz mode": play back the melody with words hidden → child must tap the correct word for each note heard.
8. High score: longest melody recalled correctly.

**Note Assignment**

```js
const MELODY_NOTES = {
  0: 261.63, // C4
  1: 293.66, // D4
  2: 329.63, // E4
  3: 392.00, // G4
  4: 440.00, // A4
};
// word index mod 5 → note frequency
```

**Pros**

- Highest creative engagement and differentiation from all existing game modes
- Strong replay value: infinite compositional variety; kids will replay to make "better songs"
- Deepest integration of Web Audio API — demonstrates technical capability
- Naturally multi-session: kids compose, save (localStorage), share melody sequence as emoji string
- Unique in the market — no direct equivalent exists in offline vocabulary apps
- Visual music (note height display) doubles as a spatial memory aid for word recall

**Cons**

- The link between a word and its note is arbitrary (word 0 = C4) — the musical note does not reinforce word meaning, reducing direct learning value compared to Options A and B
- "Quiz mode" (melody recall) tests musical memory more than vocabulary knowledge — the educational mechanism is weaker
- More complex UI to implement: note staff or card-sequencing drag interface is non-trivial in vanilla JS on mobile
- Kids ages 6–9 may struggle with the abstraction of "compose then recall" — the cognitive load is higher
- Effort is Medium-High for a polished experience

**Effort**: Medium-High (2–3 weeks)
**Risk**: Medium (UI complexity, drag-and-drop on mobile)

---

## Comparison Matrix

| Criteria | A: Rhythm Tap | B: Word Chant | C: Melody Composer |
|----------|:---:|:---:|:---:|
| Fun factor (ages 6–14) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| English learning value | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Technical feasibility | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Implementation effort | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Replay value | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Age range breadth | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Offline reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Total** | **33** | **30** | **27** |

---

## Decision

**Chosen**: Option A (Rhythm Tap) as the primary feature, with Option B (Word Chant / Karaoke) as a complementary secondary mode that reuses much of the same infrastructure.

Option C (Melody Composer) is shelved as a future V2 enhancement.

### Rationale

**Why Rhythm Tap wins**:

1. **Learning mechanism is direct and proven.** Syllable awareness — the ability to segment spoken words into their rhythmic units — is the single strongest predictor of second-language phonological acquisition in children. The 2024 Zanto et al. study on digital rhythm training showed persistent improvements in reading fluency even weeks after training ended. Rhythm Tap makes syllable segmentation the core mechanic, not a side effect.

2. **Existing data supports it perfectly.** Every vocabulary entry already has an IPA string. Syllable count can be computed from IPA vowel clusters (a ~20-line function), meaning no new data entry is required.

3. **Architecture reuse is maximal.** `speakWord()` is called unchanged. Web Audio API is added once in a small `musicUtils.js` module shared by both features. Points, combo, and achievement hooks already exist in `app.js` and can be wired in the same pattern as Word Bubbles.

4. **Age-range universality.** Tapping to a beat requires zero literacy — a 6-year-old can play it immediately. The syllable count display and IPA text add a layer for older kids.

5. **Lower risk than alternatives.** The timing-sensitive part (beat scheduling) uses AudioContext timestamps, not `setTimeout`, which is the correct approach and works reliably on mobile. TTS reliability (Option B's main risk) is not a primary dependency.

**Why Word Chant is included as secondary**:

The Chant Builder can be implemented in ~1 week as an additive post-lesson mode (alongside the existing Sentence Builder offer screen). It reuses the same `musicUtils.js` beat engine and speaks to older children (10–14) who benefit more from listening comprehension over raw tapping. The karaoke fill-in-the-blank variant creates a distinct second engagement mode without duplicating architecture.

**Why Melody Composer is deferred**:

The educational link between arbitrary note assignment and vocabulary meaning is weak. The implementation effort is Medium-High for a game that teaches music memory more than English. It is a great V2 feature once the music infrastructure is established by Options A and B.

---

## Consequences

### Positive

- Adds a research-backed phonological awareness dimension to vocabulary learning
- Zero new data files required — all generated from existing vocabulary + IPA
- Web Audio API module is reusable across both features and any future audio features
- Unlocks a new category of achievements ("Rhythm Master", "Chant Champion") to deepen the gamification layer
- Natural hook for the Word Pet: pet can "dance" or animate during music modes

### Negative (Trade-offs Accepted)

- Syllable parsing from IPA adds a small utility function that must be tested against edge cases (irregular IPA, loanwords)
- Web Audio API requires user gesture before AudioContext can start — must design UI so the first tap always triggers the context (standard browser security requirement)
- TTS and Web Audio API play simultaneously; volume balance needs care on mobile

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AudioContext autoplay blocked (mobile) | Medium | Medium | Gate AudioContext creation on explicit user tap; show "Tap to start music" prompt |
| IPA syllable count inaccurate for some words | Low-Medium | Low | Fallback to simple vowel-cluster heuristic; display syllable count and let user self-correct if wrong |
| TTS and beat timer drift (Word Chant) | Medium | Low | Use AudioContext time as master clock; TTS is supplementary, not rhythmically critical |
| Safari WKWebView Audio restrictions (iOS PWA) | Low | Medium | Test on iOS Safari early; use `audioContext.resume()` on first interaction |

---

## Implementation Guidance

### Recommended Build Order

**Phase 1 — Shared Music Infrastructure (2–3 days)**

Create `js/music.js` containing:
- `MusicEngine` object with `init()`, `playBeat(bpm)`, `stopBeat()`, `playNote(freq, duration)`, `playSuccess()`, `playFail()`
- `countSyllables(ipaString)` utility function
- AudioContext singleton with lazy init on first user gesture

**Phase 2 — Rhythm Tap Game (5–7 days)**

Create `js/rhythm-tap.js`:
- `startRhythmTap()` — entry point, pulls words from SRS learned pool (same pattern as `getGameWordPool()` in `word-bubbles.js`)
- UI overlay (same overlay pattern as `bubblesOverlay`, `wordHuntOverlay`)
- Beat engine: 120 BPM pulse, 4-beat intro count-in, word spoken on beat 1
- Tap handler: compare tap count to expected syllable count + timing window (±150ms is generous for kids)
- Score, combo, lives (3 lives) — mirror `bubblesState` structure
- End screen with words-practiced list + total score
- Hook into `appState.points` and `checkAchievements()`

State shape:
```js
let rhythmTapState = {
  pool: [],
  currentWord: null,
  expectedSyllables: 0,
  tappedSyllables: 0,
  round: 0,
  totalRounds: 10,
  score: 0,
  lives: 3,
  combo: 0,
  bestCombo: 0,
  beatInterval: null,
  audioCtx: null,
  isActive: false
};
```

**Phase 3 — Word Chant Mode (3–5 days)**

Create `js/word-chant.js`:
- `startWordChant(lessonWords)` — called from lesson complete flow (alongside `offerSentenceBuilder`)
- 3 chant templates as static JS arrays; words substituted in at runtime
- TTS sequencing: build an array of `{text, delay}` objects, fire `speakWordFallback()` calls with `setTimeout` delays
- Beat oscillator plays continuously underneath
- Lyric display with word highlighting cycling per line
- Optional "fill-in-the-blank" replay round: blank one word, show 3 choices, player taps correct answer on next TTS reading

**Phase 4 — Achievements & Integration (1–2 days)**

Add to `achievements` array in `app.js`:
```js
{ id: 'rhythm-first', name: 'Beat Maker', icon: '🥁' },
{ id: 'rhythm-10', name: 'Rhythm Star', icon: '⭐' },
{ id: 'rhythm-perfect', name: 'Perfect Rhythm', icon: '🎵' },
{ id: 'chant-first', name: 'Chant Champion', icon: '🎤' },
{ id: 'syllable-master', name: 'Syllable Sage', icon: '🔤' }
```

Add "Music" section to home screen alongside "Word Bubbles" and "Speed Challenge" game cards.

### Key Technical Considerations

**AudioContext Lifecycle**

```js
// In music.js
let _audioCtx = null;
function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}
```

Always call `getAudioContext()` inside a user event handler, never on module load.

**Beat Scheduling (Avoid setTimeout Drift)**

Use AudioContext's internal clock for all beat timing:
```js
function scheduleBeat(ctx, startTime, bpm, count) {
  const interval = 60 / bpm;
  for (let i = 0; i < count; i++) {
    playBeat(ctx, startTime + i * interval);
  }
}
```

**Syllable Count from IPA**

```js
function countSyllables(ipa) {
  // IPA vowels: a, e, i, o, u, æ, ɑ, ɒ, ʌ, ə, ɜ, ɪ, ʊ, iː, uː, eɪ, aɪ, ɔɪ, aʊ, əʊ
  const syllablePattern = /[aeiouæɑɒʌəɜɪʊ]+/gi;
  const matches = ipa.replace(/[\/\[\]ˈˌ]/g, '').match(syllablePattern);
  return matches ? matches.length : 1;
}
```

**Service Worker Cache**

Add `js/music.js`, `js/rhythm-tap.js`, `js/word-chant.js` to the SW cache list in `sw.js`. No audio files to cache — all sound is synthesized.

### Integration Points

- **Home screen**: Add "🎵 Music Games" card in the games section (below Word Bubbles card)
- **Lesson complete flow**: After completing a lesson, alongside the Sentence Builder offer, offer "🎵 Chant this lesson's words!"
- **Profile/achievements**: Music achievements display in existing achievement grid
- **Word Pet**: During music games, pet displays a dancing animation (CSS keyframe added to existing pet stages)

### Success Criteria

- [ ] Rhythm Tap game is playable offline on iOS Safari and Android Chrome
- [ ] Beat stays in sync (AudioContext scheduling, not setTimeout)
- [ ] Syllable count is accurate for at least 95% of the 1,000 vocabulary words (verify with test run)
- [ ] AudioContext correctly resumes after background/foreground switch on mobile
- [ ] TTS + beat play simultaneously without clipping or one muting the other
- [ ] Word Chant generates a chant for every lesson's 5 words using all three templates
- [ ] New achievements appear in profile after triggering conditions
- [ ] All music code is added to SW cache manifest; feature works fully offline after first load

---

## Open Questions

- [ ] Should Rhythm Tap draw from the full vocabulary (200 lessons) or restrict to SRS-learned words only? Recommendation: SRS pool first, fall back to lesson pool if pool < 20 words (mirrors `getGameWordPool()` logic in word-bubbles.js).
- [ ] Should the beat BPM increase as difficulty rises (like how `animationDuration` decreases in Word Bubbles)? Recommendation: yes — start at 80 BPM, increase to 120 BPM by round 8.
- [ ] IPA is provided for all 1,000 words — but is it always present in the data object? Verify `vocabulary.js` completeness before relying on IPA-based syllable count.
- [ ] Should music games award SRS credit (updating the SRS schedule for practiced words)? Recommendation: yes, a correct rhythm tap earns the same SRS credit as a lesson correct answer — this makes the music mode a first-class SRS practice path.

---

## Handoff

### For @planner

Create implementation plan based on this decision. Suggested plan structure:

1. `js/music.js` — shared audio engine (Phase 1)
2. `js/rhythm-tap.js` + HTML overlay + CSS — Rhythm Tap game (Phase 2)
3. `js/word-chant.js` + HTML overlay + CSS — Word Chant mode (Phase 3)
4. `app.js` achievement additions + home screen card + lesson-complete chant offer (Phase 4)
5. `sw.js` cache manifest update (Phase 4)

Command:
`"@planner create plan from docs/decisions/2026-03-05-music-feature-decision.md"`

---

## Research Sources

- [Digital rhythm training improves reading fluency in children (Zanto et al., 2024)](https://onlinelibrary.wiley.com/doi/10.1111/desc.13473)
- [Effects of a phonics-integrated music rhythm intervention on reading fluency and accuracy with children — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12325194/)
- [JMIR Serious Games — Rhythm game for dyslexia training (2024)](https://games.jmir.org/2024/1/e42733)
- [Syllable Clapping for phonological awareness — Early Learning Ideas](https://earlylearningideas.com/syllable-clapping/)
- [LyricsTraining — karaoke/fill-in-the-blank language learning benchmark](https://lyricstraining.com/)
- [MDN — Web Audio API Advanced Techniques](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques)
- [MDN — OscillatorNode API reference](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode)

---

*Decision document by brainstormer-agent on 2026-03-05*
