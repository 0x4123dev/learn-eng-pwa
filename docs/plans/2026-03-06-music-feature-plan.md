# Plan: Music-Based Learning Feature

> **Status**: Ready
> **Date**: 2026-03-06
> **Author**: planner-agent
> **Decision**: docs/decisions/2026-03-05-music-feature-decision.md
> **Total Effort**: ~22–27 hours (4–5 developer days)

---

## Overview

### Objective

Add two music-based vocabulary games to FlashLingo — Rhythm Tap (syllable-clapping game) and Word Chant (TTS chant builder with fill-in-the-blank) — built on a shared Web Audio API engine. All sound is synthesized at runtime; no audio files are required.

### Decision Reference

Based on: `docs/decisions/2026-03-05-music-feature-decision.md`

**Chosen Approach**: Option A (Rhythm Tap) as primary, Option B (Word Chant) as complementary secondary. Option C (Melody Composer) deferred to V2.

**Key Constraints**:
- Vanilla JS only, no frameworks, no audio files
- Web Audio API for all sound (OscillatorNode, GainNode)
- Offline-first — all new JS files must be added to `sw.js` cache manifest
- Mobile-first touch UI
- Follow existing overlay pattern (like `bubblesOverlay`)
- AudioContext must be created inside a user gesture handler (browser security requirement)

### Success Criteria

- [ ] Rhythm Tap game is fully playable offline on iOS Safari and Android Chrome
- [ ] Beat stays in sync via AudioContext scheduling (not setTimeout)
- [ ] Syllable count is accurate for at least 95% of the 1,000 vocabulary words
- [ ] AudioContext resumes correctly after app backgrounding on mobile
- [ ] TTS and beat play simultaneously without one muting the other
- [ ] Word Chant generates a unique chant for any set of 5 words using all three templates
- [ ] Music nav tab launches Rhythm Tap; home screen cards for both games appear in `renderHome()`
- [ ] Five new achievements unlock correctly and appear in the existing achievements grid
- [ ] All three new JS files are in the SW cache manifest; feature works offline after first install

### Out of Scope

- Melody Composer (Option C) — deferred to V2
- Real-time multiplayer or server-side leaderboards
- Audio file caching or external music APIs
- Keyboard/desktop interaction patterns

---

## Phase 1: Shared Music Engine (`js/music.js`)

**Estimate**: 4–5 hours
**Dependencies**: None — this phase has no dependencies and can be developed first in isolation.

### Task 1.1: AudioContext singleton and lifecycle management

- **Description**: Create `js/music.js` with a module-level `_audioCtx` variable (initially `null`). Implement `MusicEngine.getContext()` that lazy-initialises the AudioContext on the first call (which must always be inside a user event handler) and calls `.resume()` if the context is in `'suspended'` state (iOS PWA requirement). Expose `MusicEngine.suspend()` to be called when a game overlay closes to stop the audio clock.
- **Files**: `js/music.js` (new file)
- **Size**: XS
- **Acceptance**: Calling `MusicEngine.getContext()` from a button `onclick` returns a running AudioContext with `state === 'running'`. Calling it a second time returns the same instance. After `suspend()` and a subsequent `onclick`, `getContext()` resumes and returns `'running'` again.

### Task 1.2: Beat drum sound primitives

- **Description**: Implement three synthesised drum sounds using `OscillatorNode` + `GainNode`. All functions accept `(ctx, time)` where `time` is an AudioContext timestamp (not wall clock).
  - `MusicEngine.playKick(ctx, time)` — sine wave at 80 Hz, gain envelope: 0.8 → 0.001 over 120ms. Gives a "thud" feel.
  - `MusicEngine.playHihat(ctx, time)` — noise-style: create a `bufferSource` with random noise (32 samples), `highpass` filter at 8000 Hz, gain 0.3 → 0.001 over 60ms.
  - `MusicEngine.playSnare(ctx, time)` — two oscillators mixed: sine at 200 Hz + white noise through bandpass at 2000 Hz, total gain 0.5 → 0.001 over 100ms.
- **Files**: `js/music.js`
- **Size**: S
- **Acceptance**: All three sounds are audible and tonally distinct when called in sequence from a browser console. No audio is produced on page load (lazy init).

### Task 1.3: Beat scheduler (BPM-driven, drift-free)

- **Description**: Implement `MusicEngine.startBeat(bpm, pattern, onVisualTick)`. The `pattern` parameter is an array of beat objects, e.g. `['kick', 'hihat', 'snare', 'hihat']` for a 4/4 pattern. The scheduler uses the AudioContext clock (`ctx.currentTime`) to pre-schedule beats 200ms ahead using a `setTimeout` lookahead loop (the "clock-accurate lookahead" pattern from Chris Wilson's Web Audio scheduling article). Each tick calls `onVisualTick(beatIndex)` so the UI can flash in sync. Implement `MusicEngine.stopBeat()` to clear the lookahead timeout and release the beat scheduler. Expose `MusicEngine.setBpm(bpm)` to change BPM without restarting — used for difficulty ramp in Rhythm Tap.
- **Files**: `js/music.js`
- **Size**: M
- **Acceptance**: Beat runs at exactly the requested BPM (verifiable by counting ticks over 10 seconds). BPM change via `setBpm()` takes effect within the next lookahead window without audible gap or skip. `stopBeat()` produces silence within 200ms.

### Task 1.4: Note and feedback sound primitives

- **Description**: Implement:
  - `MusicEngine.playNote(ctx, freq, duration)` — sine wave oscillator, gain 0.6 → 0.001 over `duration` seconds. Used for syllable tap feedback.
  - `MusicEngine.playSuccess(ctx)` — short ascending two-note figure (C5 then E5, 80ms each).
  - `MusicEngine.playFail(ctx)` — descending two-note figure (E4 then C4, 100ms each, lower gain 0.4).
  - `MusicEngine.playCountIn(ctx, beats, bpm, onBeat)` — plays `beats` kick sounds at the given BPM, calling `onBeat(i)` callback on each. Used for the 4-beat count-in before Rhythm Tap starts.
- **Files**: `js/music.js`
- **Size**: S
- **Acceptance**: All four functions produce audible output. `playCountIn` callback fires in sync with audible beats (within 10ms).

### Task 1.5: IPA syllable counter

- **Description**: Implement `MusicEngine.countSyllables(ipaString)`. Algorithm:
  1. Strip IPA delimiters: remove `/`, `[`, `]`, `ˈ`, `ˌ` characters.
  2. Match vowel clusters using the regex `/[aeiouæɑɒʌəɜɪʊiːuːeɪaɪɔɪaʊəʊ]+/gi`.
  3. Return the count of matches; minimum return value is 1.
  4. Edge case: if `ipaString` is empty or null, fall back to English vowel-cluster heuristic on the English word itself: `/[aeiouy]+/gi` match count, minimum 1.

  Also implement `MusicEngine.splitWordForDisplay(ipaString, englishWord)` that returns a syllable count as a number (used to render dot indicators in the UI). This wraps `countSyllables`.
- **Files**: `js/music.js`
- **Size**: S
- **Acceptance**: Run against a spot-check of 20 words from `ieltsVocabulary`: `important` (3), `environment` (4), `cat` (1), `beautiful` (3), `communication` (5), `the` (1). All match expected counts. Words with null/missing IPA return at least 1.

**Phase 1 Checkpoint**:
- [ ] `js/music.js` loads without errors in browser console
- [ ] All five exported functions/objects are accessible as `MusicEngine.*`
- [ ] No sound plays on page load (AudioContext not created until first user gesture)
- [ ] `countSyllables` spot-check passes for ≥18/20 test words

---

## Phase 2: Rhythm Tap Game (`js/rhythm-tap.js` + HTML + CSS)

**Estimate**: 9–11 hours
**Dependencies**: Phase 1 complete (`js/music.js` exists and exports `MusicEngine`)

### Task 2.1: Game state and word pool

- **Description**: Create `js/rhythm-tap.js`. Define `rhythmTapState` object at module scope (mirrors `bubblesState` structure):
  ```js
  let rhythmTapState = {
      pool: [],
      correctWords: [],
      currentWord: null,
      expectedSyllables: 0,
      tappedSyllables: 0,
      round: 0,
      totalRounds: 10,
      score: 0,
      lives: 3,
      combo: 0,
      bestCombo: 0,
      currentBpm: 80,
      beatSchedulerRunning: false,
      roundPhase: 'waiting',   // 'counting-in' | 'listening' | 'tapping' | 'feedback' | 'done'
      isActive: false,
      wordsResults: []         // { word, expected, tapped, correct } per round
  };
  ```
  Implement `getRhythmWordPool()` mirroring `getGameWordPool()` from `word-bubbles.js` exactly: SRS-learned words first (if ≥ 20), else fallback to `ieltsVocabulary.slice(0, 50)`. Filter to words that have a non-empty `.ipa` field so the syllable counter always has data.
- **Files**: `js/rhythm-tap.js` (new file)
- **Size**: S
- **Acceptance**: `getRhythmWordPool()` returns ≥ 10 entries when called with an `appState` that has 0 SRS words. Entries all have `.ipa` defined.

### Task 2.2: Game entry point and overlay rendering

- **Description**: Implement `startRhythmTap()`. Steps:
  1. Pull word pool; if fewer than 5 words, call `showToast('Learn more words first!')` and return.
  2. Pre-select 10 unique correct words (`correctWords = shuffleArray(pool).slice(0, 10)`).
  3. Reset `rhythmTapState` with pool and `isActive: true`.
  4. Get or create the AudioContext via `MusicEngine.getContext()` (this call is inside the user-gesture chain from the button click).
  5. Show `#rhythmTapOverlay` by adding `active` class; hide `#bottomNav`.
  6. Call `renderRhythmTapUI()` to inject the overlay's inner HTML.
  7. Call `startRhythmTapRound()` to begin round 1.

  Implement `renderRhythmTapUI()` which sets `overlay.innerHTML` to the full game UI:
  - Header row: exit button (`closeRhythmTap()`), score display (`#rtScore`), lives (`#rtLives`), round counter (`#rtRound`).
  - Combo banner (`#rtComboBanner`).
  - Word display area (`#rtWordDisplay`): shows the English word in large text, IPA in smaller text below, syllable dots row (`#rtDots`).
  - Count-in display (`#rtCountIn`): large number shown during the 4-beat intro.
  - Tap zone (`#rtTapZone`): the full-screen tappable area with a ripple effect container.
  - Instruction text (`#rtInstruction`): "Tap once per syllable!"
  - BPM display (`#rtBpm`): small label showing current tempo.
- **Files**: `js/rhythm-tap.js`, `index.html` (add `<div class="rhythm-tap-overlay" id="rhythmTapOverlay"></div>` before closing `</div>` of `.app`, alongside the other overlays at lines 390–409)
- **Size**: M
- **Acceptance**: Clicking a "Rhythm Tap" launch button shows the overlay covering the full screen. The bottom nav is hidden. The overlay renders all required UI sections. No game logic runs yet (just UI shell visible).

### Task 2.3: Round lifecycle — count-in and word display

- **Description**: Implement `startRhythmTapRound()`:
  1. Increment round; if `> totalRounds` or `lives <= 0`, call `onRhythmTapEnd()`.
  2. Pick the pre-selected `correctWords[round - 1]` as `currentWord`.
  3. Compute `expectedSyllables = MusicEngine.countSyllables(currentWord.ipa)`.
  4. Reset `tappedSyllables = 0`.
  5. Set `roundPhase = 'counting-in'`.
  6. Compute BPM ramp: start 80 BPM; add 5 BPM per 2 rounds completed (round 3 → 85, round 5 → 90, etc.), cap at 120 BPM. Update `currentBpm`.
  7. Render syllable dots: update `#rtDots` with `expectedSyllables` empty dot elements (`●` in grey, will turn green as tapped).
  8. Show word and IPA in `#rtWordDisplay`; show count-in number (4) in `#rtCountIn`.
  9. Call `speakWord(currentWord.en)` to queue TTS pronunciation.
  10. Call `MusicEngine.playCountIn(ctx, 4, currentBpm, (i) => { updateCountInDisplay(4 - i); })` — as each beat fires, decrement count-in display 4 → 3 → 2 → 1. On completion callback (after 4 beats), call `beginTappingPhase()`.
- **Files**: `js/rhythm-tap.js`
- **Size**: M
- **Acceptance**: Each round shows the correct word, IPA, correct number of dots, and a 4-beat count-in that visually counts down. TTS fires on word display. After count-in completes, the tapping phase begins.

### Task 2.4: Tapping phase — input handling, visual feedback, and scoring

- **Description**: Implement `beginTappingPhase()` and `onRhythmTapTap()`.

  `beginTappingPhase()`:
  - Set `roundPhase = 'tapping'`.
  - Start beat loop via `MusicEngine.startBeat(currentBpm, ['kick','hihat','kick','hihat'], onBeatVisualTick)`.
  - `onBeatVisualTick(i)` pulses the tap zone background (brief `active` CSS class toggle).
  - Attach a single `touchstart` (and `mousedown` for desktop testing) listener on `#rtTapZone` → calls `onRhythmTapTap()`.
  - Set a round timeout: if player does not complete tapping within `(expectedSyllables + 2) * (60000 / currentBpm)` ms, call `onRhythmTapRoundFail('timeout')`.

  `onRhythmTapTap(event)`:
  - If `roundPhase !== 'tapping'` return early.
  - Increment `tappedSyllables`.
  - Light up the next dot in `#rtDots` (green).
  - Play `MusicEngine.playNote(ctx, tapNoteFreqs[tappedSyllables % 5], 0.12)` where `tapNoteFreqs = [523, 587, 659, 698, 784]` (C5–G5 pentatonic).
  - Spawn a ripple element at the tap coordinates inside `#rtTapZone`.
  - If `tappedSyllables >= expectedSyllables`, call `onRhythmTapRoundComplete()`.

  `onRhythmTapRoundComplete()`:
  - Stop beat: `MusicEngine.stopBeat()`.
  - Set `roundPhase = 'feedback'`.
  - Compute score: base 10 points + combo bonus (`combo * 5`). Award points to `rhythmTapState.score`.
  - Increment `combo`; update `bestCombo`.
  - Update SRS for `currentWord.en`: call `updateSRSAfterReview(currentWord.en, true)` if that function exists in `srs.js` (check before calling).
  - Call `MusicEngine.playSuccess(ctx)`.
  - Flash `#rtWordDisplay` green, show "Correct! X syllables" in `#rtInstruction`.
  - Show combo banner if combo ≥ 2 (same pattern as `showComboBanner()` in `word-bubbles.js`).
  - After 1200ms, call `startRhythmTapRound()`.

  `onRhythmTapRoundFail(reason)`:
  - Stop beat.
  - Set `roundPhase = 'feedback'`.
  - `rhythmTapState.combo = 0`.
  - Decrement `lives`; update `#rtLives`.
  - Call `MusicEngine.playFail(ctx)`.
  - Flash `#rtWordDisplay` red. Show "X syllables — try again!" in `#rtInstruction`.
  - After 1500ms: if `lives <= 0` call `onRhythmTapEnd()`, else `startRhythmTapRound()`.
- **Files**: `js/rhythm-tap.js`
- **Size**: M
- **Acceptance**: Tapping the correct number of times on beat completes the round with green feedback, score increase, and combo increment. Tapping wrong number (timeout fires) triggers red feedback and life loss. Dots illuminate one per tap.

### Task 2.5: End screen and stats save

- **Description**: Implement `onRhythmTapEnd()`:
  1. `rhythmTapState.isActive = false`.
  2. `MusicEngine.stopBeat()` and `MusicEngine.suspend()`.
  3. Calculate `wordsCorrect` count from `wordsResults`.
  4. Save stats to `appState.musicStats`:
     ```js
     appState.musicStats.rhythmTap.gamesPlayed++;
     if (score > appState.musicStats.rhythmTap.highScore) appState.musicStats.rhythmTap.highScore = score;
     if (bestCombo > appState.musicStats.rhythmTap.bestCombo) appState.musicStats.rhythmTap.bestCombo = bestCombo;
     ```
  5. Save to localStorage via `saveUserData(currentUser, appState)`.
  6. Trigger achievements (see Phase 5 for the full list).
  7. Trigger pet quest: `checkPetQuest('rhythm')`.
  8. Award points to `appState.points` (same as `appState.points += rhythmTapState.score`); save again.
  9. Replace overlay content with the end screen:
     - "Game Over" or "Round Complete" heading.
     - Score, best combo, words correct count.
     - Words practiced list: show each word as `[emoji] [en] — [vi]` in a scrollable list.
     - Two buttons: "Play Again" (calls `startRhythmTap()`) and "Close" (calls `closeRhythmTap()`).
  10. `renderHome()` and `renderProfile()` in background to update point displays.

  Implement `closeRhythmTap()`:
  - `MusicEngine.stopBeat()`, `MusicEngine.suspend()`.
  - Remove `active` from `#rhythmTapOverlay`.
  - Show `#bottomNav`.
  - `renderHome()`.
- **Files**: `js/rhythm-tap.js`
- **Size**: S
- **Acceptance**: End screen shows correct score, words list, and working buttons. `appState.musicStats.rhythmTap.gamesPlayed` increments by 1 each game. Points are added to profile. Pet quest fires for quest id `'rhythm'`.

**Phase 2 Checkpoint**:
- [ ] Full game loop plays start-to-finish with 10 rounds
- [ ] Score, combo, and lives update correctly each round
- [ ] AudioContext beat stays in sync for 10+ rounds (no audible drift)
- [ ] End screen shows and buttons work
- [ ] Stats are persisted to localStorage after game ends

---

## Phase 3: Word Chant Mode (`js/word-chant.js` + HTML + CSS)

**Estimate**: 5–6 hours
**Dependencies**: Phase 1 complete; Phase 2 overlay pattern provides a clear template.

### Task 3.1: Chant template engine

- **Description**: Create `js/word-chant.js`. Define three static chant templates as arrays of line-spec objects:
  ```js
  const CHANT_TEMPLATES = [
      // Template A — call and response
      [
          { type: 'chant', text: '{en}! {en}! What does it mean?' },
          { type: 'chant', text: 'It means {vi}! Now say it with me!' },
          { type: 'chant', text: '{en}... {en}... {en}!' },
          { type: 'pause', ms: 600 },
      ],
      // Template B — example sentence focus
      [
          { type: 'chant', text: 'Listen up! {ex}' },
          { type: 'chant', text: '{en} — {emoji} — {en}!' },
          { type: 'chant', text: 'Say it again! {en}! {en}!' },
          { type: 'pause', ms: 600 },
      ],
      // Template C — definition drill
      [
          { type: 'chant', text: '{emoji} {en}!' },
          { type: 'chant', text: '{en} means {vi}.' },
          { type: 'chant', text: 'Remember: {en}!' },
          { type: 'pause', ms: 400 },
      ]
  ];
  ```
  Implement `buildChantScript(words)` that takes an array of 3–5 vocabulary objects and returns a flat array of `{ text, wordRef }` line objects by cycling through the templates (word 0 → template 0, word 1 → template 1, etc., cycling). Each `{en}`, `{vi}`, `{emoji}`, `{ex}` placeholder is substituted with the word's actual values. If a word has no `.ex`, use `'{en} is an important word.'` as the fallback example line. Return the full script as an array: `[{ text: 'important! important! What does it mean?', wordRef: wordObj }, ...]`.
- **Files**: `js/word-chant.js` (new file)
- **Size**: S
- **Acceptance**: `buildChantScript([word1, word2, word3])` returns an array of at least 12 lines. Each line's `text` has no remaining `{placeholder}` tokens.

### Task 3.2: Game entry point, overlay rendering, and TTS sequencing

- **Description**: Implement `startWordChant(lessonWords)`. This function is called either from the home-screen card (with a random 5-word pool) or from the lesson-complete flow (with the just-completed lesson's words).

  Steps:
  1. Derive `chantWords`: if `lessonWords` provided and length ≥ 3, use them; else draw 5 words from `getRhythmWordPool()` (reuse from rhythm-tap.js — note: both files will be loaded, so the function is shared).
  2. Get AudioContext via `MusicEngine.getContext()`.
  3. Build chant script: `const script = buildChantScript(chantWords)`.
  4. Show `#wordChantOverlay`; hide `#bottomNav`.
  5. Call `renderWordChantUI(chantWords, script)`.
  6. Start background beat: `MusicEngine.startBeat(90, ['kick','hihat','kick','hihat'], null)` (no visual tick needed for chant, beat is purely audio backing).
  7. Begin TTS sequencing: call `runChantSequence(script, 0)`.

  `renderWordChantUI(words, script)` injects overlay HTML:
  - Header: exit button (`closeWordChant()`), title "Word Chant".
  - Words row: 3–5 word pills showing `{emoji} {en}`.
  - Lyric display area (`#chantLyrics`): current line text, highlighted.
  - Progress bar (`#chantProgress`).
  - Phase label (`#chantPhase`): "Chant" or "Quiz".
  - After chant: a "Quiz Round" button will appear.

  `runChantSequence(script, index)`:
  - If `index >= script.length`, call `offerChantQuiz(chantWords)`.
  - If line is `type: 'pause'`, use `setTimeout(() => runChantSequence(script, index + 1), line.ms)`.
  - If `type: 'chant'`:
    - Update `#chantLyrics` with the line text; highlight the `wordRef.en` token in the text with a `<mark>` tag.
    - Update `#chantProgress` width.
    - Call `speakWordFallback(line.text)` — speak the full line.
    - Estimate speaking duration: `Math.max(1000, line.text.split(' ').length * 350)` ms; after that delay, call `runChantSequence(script, index + 1)`.
- **Files**: `js/word-chant.js`, `index.html` (add `<div class="word-chant-overlay" id="wordChantOverlay"></div>` with the other overlays)
- **Size**: M
- **Acceptance**: `startWordChant()` with any 3+ vocabulary objects plays through the entire chant script, updating the lyric display on each line. TTS fires for each line. Beat plays underneath throughout. After all lines, the quiz offer appears.

### Task 3.3: Fill-in-the-blank quiz round

- **Description**: Implement `offerChantQuiz(words)` and `runChantQuiz(words)`.

  `offerChantQuiz(words)`:
  - Stop beat temporarily.
  - Show a "Quiz Time!" interstitial in `#wordChantOverlay` with a "Let's go!" button that calls `runChantQuiz(words)`.

  `runChantQuiz(words)`:
  - Pick one word from `words` as the "blank word" (`blankWord = words[Math.floor(Math.random() * words.length)]`).
  - Build a quiz line from the template: `'{en} means ____'` (substitute `blankWord.en` in the first slot, keep the blank in the definition slot).
  - Build 3 answer choices: `blankWord.vi` (correct) + 2 random distractors from `ieltsVocabulary` (different `.vi` values). Shuffle choices.
  - Restart beat at 90 BPM.
  - Render quiz UI in the overlay:
    - Lyric with `____` where the answer goes.
    - TTS speaks the line (with blank spoken as "blank").
    - 3 answer buttons showing Vietnamese translations.
  - On correct tap: flash green, `MusicEngine.playSuccess(ctx)`, `+15` points, update `appState.musicStats.wordChant.correctQuizAnswers`, show result, after 1200ms call `onWordChantEnd(true)`.
  - On wrong tap: flash red, `MusicEngine.playFail(ctx)`, show correct answer highlighted, after 1500ms call `onWordChantEnd(false)`.

  `onWordChantEnd(quizPassed)`:
  - Stop beat; suspend AudioContext.
  - Update `appState.musicStats.wordChant.gamesPlayed++`.
  - Save; fire achievements; fire pet quest `'rhythm'`.
  - Show end screen: "Chant complete!", word list, quiz result, "Play Again" and "Close" buttons.
- **Files**: `js/word-chant.js`
- **Size**: M
- **Acceptance**: After the chant plays through, the quiz round shows one blank-word question with 3 choices. Tapping correct choice shows green feedback and awards points. End screen appears and buttons work.

**Phase 3 Checkpoint**:
- [ ] Full chant plays through all lines with TTS for all 5 words
- [ ] Beat plays throughout without stopping TTS
- [ ] Quiz shows a valid question derived from the chant words
- [ ] Stats (`wordChant.gamesPlayed`) increment correctly
- [ ] `closeWordChant()` restores the bottom nav

---

## Phase 4: HTML Additions (overlays + nav tab)

**Estimate**: 1–2 hours
**Dependencies**: Phases 2 and 3 (need to know exact overlay IDs)

### Task 4.1: Add overlay divs to `index.html`

- **Description**: Insert two new overlay `<div>` elements inside the `.app` container at `index.html`, alongside the existing overlays (lines 390–409). Add them after the `#bubblesOverlay` line:
  ```html
  <!-- Rhythm Tap Overlay -->
  <div class="rhythm-tap-overlay" id="rhythmTapOverlay"></div>

  <!-- Word Chant Overlay -->
  <div class="word-chant-overlay" id="wordChantOverlay"></div>
  ```
  No content is needed here — both overlays are fully rendered by their respective JS files, matching the `bubblesOverlay` pattern.
- **Files**: `index.html`
- **Size**: XS
- **Acceptance**: Both `document.getElementById('rhythmTapOverlay')` and `document.getElementById('wordChantOverlay')` return non-null in the browser console.

### Task 4.2: Add Music nav tab to bottom nav

- **Description**: Add a fifth nav button to the `<nav class="bottom-nav" id="bottomNav">` in `index.html` (lines 370–387). The new button goes after the Bubbles button:
  ```html
  <button class="nav-item" onclick="startRhythmTap()">
      <span class="icon">🎵</span>
      <span>Music</span>
  </button>
  ```
  This satisfies the user's explicit request for "menu music" — a dedicated nav tab for the music games. Tapping it directly launches Rhythm Tap (the primary game). Word Chant is accessible from the home screen card.

  Also update `navigateFromProfile()` in `app.js`: the `screenToNav` map has indices 0–2; no change needed since Music is an overlay (not a screen), but verify the nav item count is still handled correctly.
- **Files**: `index.html`
- **Size**: XS
- **Acceptance**: Bottom nav shows 5 buttons. Tapping the Music tab shows the Rhythm Tap overlay. Existing nav items are unaffected.

### Task 4.3: Add `<script>` tags to `index.html`

- **Description**: Add script tags for the three new JS files in `index.html`. They must be loaded after `app.js` and `vocabulary.js` (since they depend on `ieltsVocabulary`, `appState`, `speakWord`, `shuffleArray`). Add them just before `</body>` or at the same position as existing game script tags:
  ```html
  <script src="js/music.js"></script>
  <script src="js/rhythm-tap.js"></script>
  <script src="js/word-chant.js"></script>
  ```
  Verify load order by checking what the last existing `<script>` tag is in `index.html`.
- **Files**: `index.html`
- **Size**: XS
- **Acceptance**: Browser console shows no `ReferenceError` for `MusicEngine`, `startRhythmTap`, or `startWordChant`. All three files load without parse errors.

---

## Phase 5: CSS Additions (`css/styles.css`)

**Estimate**: 2–3 hours
**Dependencies**: Phase 4 (need to know all class names used by the new overlays)

### Task 5.1: Rhythm Tap overlay layout and animations

- **Description**: Add CSS rules to `css/styles.css` for the Rhythm Tap overlay. Model them on the existing `.bubbles-overlay` and `.bubbles-container` rules. Required classes:
  - `.rhythm-tap-overlay` — `position: fixed; inset: 0; z-index: 200; background: linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); display: none;` (or `opacity: 0; pointer-events: none;`). When `.active`: `display: flex; flex-direction: column;`.
  - `.rt-header` — flex row, `justify-content: space-between`, `padding: 16px`, same pattern as `.bubbles-header`.
  - `.rt-score`, `.rt-lives`, `.rt-round` — inline stat displays matching bubbles style.
  - `.rt-word-display` — centered, large word text (`font-size: 2.2rem; font-weight: 800`), IPA below in smaller monospace.
  - `.rt-dots` — flex row centered, `gap: 12px`. Each dot child (`.rt-dot`): `width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.2); transition: background 0.15s`.  `.rt-dot.active`: `background: #58cc02; box-shadow: 0 0 10px #58cc0280`.
  - `.rt-count-in` — absolute centered overlay within the overlay, large number (`font-size: 5rem; font-weight: 900; color: white`), CSS keyframe `@keyframes countPulse { 0% { transform: scale(1.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }`.
  - `.rt-tap-zone` — `flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden`. On `.pulse` class: brief background flash (`background: rgba(255,255,255,0.08); transition: background 0.05s`).
  - `.rt-ripple` — CSS ripple element spawned on each tap: `position: absolute; border-radius: 50%; background: rgba(88, 204, 2, 0.4); animation: rippleExpand 0.6s ease-out forwards`. `@keyframes rippleExpand { to { transform: scale(4); opacity: 0; } }`.
  - `.rt-combo-banner` — same pattern as `.bubbles-combo-banner`.
  - `.rt-instruction` — bottom text label, `color: rgba(255,255,255,0.7); font-size: 0.9rem`.
  - `.rt-bpm` — small label `color: rgba(255,255,255,0.5); font-size: 0.75rem`.
  - `.rt-end-screen` — end screen container: scrollable, centered, white card look on dark background.
  - `.rt-word-result-list` — scrollable list of word results.
  - `.rt-word-result-item` — each row: emoji + word + vi + correct/incorrect icon.
- **Files**: `css/styles.css`
- **Size**: M
- **Acceptance**: Overlay appears full-screen with dark blue gradient. Dots illuminate green on tap. Tap zone shows ripple animation. Count-in number pulses in. End screen is readable and scrollable.

### Task 5.2: Word Chant overlay layout

- **Description**: Add CSS for Word Chant overlay. Simpler layout than Rhythm Tap:
  - `.word-chant-overlay` — same base as `.rhythm-tap-overlay` but with `background: linear-gradient(160deg, #2d1b69 0%, #11998e 100%)` (purple-to-teal chant feel).
  - `.chant-header` — flex row with exit + title.
  - `.chant-words-row` — horizontal scrollable row of word pills. `.chant-word-pill`: `background: rgba(255,255,255,0.15); border-radius: 20px; padding: 6px 14px; font-size: 0.85rem; color: white`.
  - `.chant-lyrics` — large central text area, `font-size: 1.4rem; font-weight: 700; color: white; text-align: center; padding: 20px; line-height: 1.6`. `mark` inside: `background: #ffd700; color: #1a1a2e; border-radius: 4px; padding: 0 4px`.
  - `.chant-progress` — thin bar at bottom of lyrics area.
  - `.chant-quiz-container` — quiz phase container with answer buttons.
  - `.chant-answer-btn` — large tap targets (`min-height: 56px; border-radius: 16px`), default white on semi-transparent background, `.correct` green, `.wrong` red.
  - `.chant-end-screen` — same as `.rt-end-screen`.
- **Files**: `css/styles.css`
- **Size**: S
- **Acceptance**: Word Chant overlay renders with purple-teal gradient. Lyrics are readable in large text with word highlighted in gold. Quiz buttons are large and easily tappable. Progress bar advances.

### Task 5.3: Pet dancing animation

- **Description**: Add a CSS keyframe for the pet dancing state used during music games. When `#petScene .pet-creature` has class `dancing` (added by music JS when music is playing, removed when closed):
  ```css
  @keyframes petDance {
      0%, 100% { transform: rotate(-8deg) scale(1); }
      25%       { transform: rotate(8deg) scale(1.1); }
      50%       { transform: rotate(-4deg) scale(1); }
      75%       { transform: rotate(4deg) scale(1.05); }
  }
  .pet-creature.dancing {
      animation: petDance 0.5s ease-in-out infinite;
  }
  ```
  In `startRhythmTap()` and `startWordChant()`, add `document.querySelector('.pet-creature')?.classList.add('dancing')` after showing the overlay. In `closeRhythmTap()` and `closeWordChant()`, remove the class.
- **Files**: `css/styles.css`, `js/rhythm-tap.js`, `js/word-chant.js`
- **Size**: XS
- **Acceptance**: When a music game overlay is open, the pet (if visible behind the overlay — it isn't since overlay is full-screen, but this fires for the next time the home screen is visible after close) animates with a dance. The class is cleaned up on game close.

**Phase 5 Checkpoint**:
- [ ] All CSS classes referenced in JS exist in `styles.css`
- [ ] No CSS conflicts with existing rules (use unique `rt-` and `chant-` prefixes)
- [ ] Overlays render correctly on 375px-wide mobile viewport
- [ ] Animations are smooth (no jank on 60fps)

---

## Phase 6: State Migration, Achievements, and Integration Hooks

**Estimate**: 2–3 hours
**Dependencies**: Phases 2–5 complete; Phase 6 touches `app.js` and `home.js` which both need final function names from the game files.

### Task 6.1: Add `musicStats` to default user data and state migration

- **Description**: Edit `js/app.js` in two places:

  1. In `createDefaultUserData()` (line ~141), add `musicStats` to the returned object:
     ```js
     musicStats: {
         rhythmTap:  { gamesPlayed: 0, highScore: 0, bestCombo: 0 },
         wordChant:  { gamesPlayed: 0, correctQuizAnswers: 0 }
     }
     ```

  2. In the `loginUser()` migration block (around line 504–520, where existing migrations like `if (appState.bubblesStats === undefined)` live), add:
     ```js
     if (appState.musicStats === undefined) {
         appState.musicStats = {
             rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0 },
             wordChant:  { gamesPlayed: 0, correctQuizAnswers: 0 }
         };
     }
     ```
- **Files**: `js/app.js`
- **Size**: XS
- **Acceptance**: `appState.musicStats.rhythmTap.gamesPlayed` is accessible without error for both new users and users migrated from a previous save. No existing fields are modified.

### Task 6.2: Add music achievements to the achievements array

- **Description**: Edit `js/app.js` in the `achievements` array (line ~9–70). Add the following five entries, in the "Games" section after the existing bubbles achievements:
  ```js
  // Music
  { id: 'rhythm-first',   name: 'Beat Maker',     icon: '🥁' },
  { id: 'rhythm-10',      name: 'Rhythm Star',    icon: '⭐' },
  { id: 'rhythm-perfect', name: 'Perfect Rhythm',  icon: '🎵' },
  { id: 'chant-first',    name: 'Chant Champion',  icon: '🎤' },
  { id: 'syllable-sage',  name: 'Syllable Sage',   icon: '🔤' }
  ```
- **Files**: `js/app.js`
- **Size**: XS
- **Acceptance**: `achievements.find(a => a.id === 'rhythm-first')` returns the correct object. After completing a Rhythm Tap game, the toast shows "🥁 Beat Maker unlocked!" on first play.

### Task 6.3: Wire achievement triggers in game end functions

- **Description**: In `onRhythmTapEnd()` in `js/rhythm-tap.js`, add after saving stats:
  ```js
  if (appState.musicStats.rhythmTap.gamesPlayed === 1) unlockAchievement('rhythm-first');
  if (appState.musicStats.rhythmTap.gamesPlayed >= 10) unlockAchievement('rhythm-10');
  if (rhythmTapState.lives === 3 && rhythmTapState.round > rhythmTapState.totalRounds) unlockAchievement('rhythm-perfect');
  // Syllable sage: 50+ correct rounds total (accumulate in musicStats.rhythmTap.correctRounds)
  if ((appState.musicStats.rhythmTap.correctRounds || 0) >= 50) unlockAchievement('syllable-sage');
  ```
  Add `correctRounds` field to `musicStats.rhythmTap` (and migration) to track cumulative correct rounds across all games.

  In `onWordChantEnd()` in `js/word-chant.js`, add:
  ```js
  if (appState.musicStats.wordChant.gamesPlayed === 1) unlockAchievement('chant-first');
  ```
- **Files**: `js/rhythm-tap.js`, `js/word-chant.js`, `js/app.js` (add `correctRounds: 0` to schema)
- **Size**: XS
- **Acceptance**: Each achievement fires exactly once (the `unlockAchievement` function already guards duplicate unlocks via `appState.achievements.includes(id)`). Achievements display in the profile grid without error.

### Task 6.4: Add music pet quest type to `PET_QUESTS`

- **Description**: Edit `js/home.js` in the `PET_QUESTS` array (line ~499). Add one new quest entry:
  ```js
  { id: 'rhythm', text: 'Play a music game', pts: 20, hunger: 30,
    eligible: () => true }
  ```
  The quest `id: 'rhythm'` is what `checkPetQuest('rhythm')` looks for in the existing `checkPetQuest(triggerQuestId)` function (line ~718). No changes to `checkPetQuest` itself are needed — it already handles arbitrary `triggerQuestId` values by comparing `quest.id === triggerQuestId`.
- **Files**: `js/home.js`
- **Size**: XS
- **Acceptance**: If the day's quest is `'rhythm'`, completing a Rhythm Tap or Word Chant game marks the quest complete, feeds the pet 30 hunger points, and awards 20 bonus points.

### Task 6.5: Add home screen cards for both music games

- **Description**: Edit `js/home.js` in `renderHome()` (line ~86–90) where other game cards are rendered. Add a call:
  ```js
  if (typeof renderMusicGamesCard === 'function') renderMusicGamesCard();
  ```
  Implement `renderMusicGamesCard()` in `js/rhythm-tap.js` (it needs access to both game launchers, and rhythm-tap.js is loaded before word-chant.js):
  ```js
  function renderMusicGamesCard() {
      const container = document.getElementById('musicGamesCard');
      if (!container) return;
      const rtGames = (appState.musicStats && appState.musicStats.rhythmTap.gamesPlayed) || 0;
      const wcGames = (appState.musicStats && appState.musicStats.wordChant.gamesPlayed) || 0;
      container.style.display = 'block';
      container.innerHTML = `
          <div class="music-card-title">🎵 Music Games</div>
          <div class="music-card-games">
              <div class="music-game-btn" onclick="startRhythmTap()">
                  <div class="music-game-icon">🥁</div>
                  <div class="music-game-name">Rhythm Tap</div>
                  <div class="music-game-stat">${rtGames} games</div>
              </div>
              <div class="music-game-btn" onclick="startWordChant()">
                  <div class="music-game-icon">🎤</div>
                  <div class="music-game-name">Word Chant</div>
                  <div class="music-game-stat">${wcGames} games</div>
              </div>
          </div>
      `;
  }
  ```
  Add `<div class="music-games-card" id="musicGamesCard" style="display:none;"></div>` to `index.html` in the home screen section, after `#wordHuntCard` (line ~178).
- **Files**: `js/rhythm-tap.js`, `js/home.js`, `index.html`, `css/styles.css`
- **Size**: S
- **Acceptance**: Home screen shows a "Music Games" card with two tappable buttons for Rhythm Tap and Word Chant. Game play count is displayed and updates after each game. Card appears even with 0 games played.

### Task 6.6: Offer Word Chant from lesson-complete flow

- **Description**: Edit `js/lessons.js` in the `onLessonComplete()` function (around line 420–428), after the `offerSentenceBuilder` block. Add a second offer:
  ```js
  // Offer Word Chant for good performance (accuracy >= 60)
  if (!lessonState.isPracticeSession && !lessonState.isReviewSession &&
      accuracy >= 60 && typeof startWordChant === 'function') {
      // Don't block sentence builder offer — Word Chant is offered from the
      // lesson complete screen via a button, not as a redirect.
      // Add a "Chant these words!" button to the lessonComplete overlay.
      addChantButtonToLessonComplete(lessonState.words);
  }
  ```
  Implement `addChantButtonToLessonComplete(words)` in `js/word-chant.js`:
  - Find `#lessonComplete` overlay.
  - Append (don't replace) a secondary button: `<button class="secondary-btn chant-offer-btn" onclick="startWordChant(lessonWords)">🎵 Chant these words!</button>`.
  - Store `lessonWords` in a module-level variable accessible to `startWordChant`.
  - When `closeLessonComplete()` fires, remove this button (it already removes `active` class; the button is inside the overlay so it goes with it).
- **Files**: `js/lessons.js`, `js/word-chant.js`
- **Size**: S
- **Acceptance**: After completing a lesson with ≥ 60% accuracy, the lesson complete overlay shows a secondary "Chant these words!" button. Tapping it closes the lesson complete overlay and opens Word Chant with exactly the lesson's 5 words. Existing "Continue" behavior is unaffected.

**Phase 6 Checkpoint**:
- [ ] `appState.musicStats` exists for all users (new and migrated)
- [ ] All 5 achievement IDs fire correctly on first trigger
- [ ] Music pet quest appears in rotation and completes when a music game is played
- [ ] Home screen music card renders and both buttons launch their games
- [ ] Lesson complete overlay shows chant offer button for qualifying lessons

---

## Phase 7: Service Worker Cache Update

**Estimate**: 30 minutes
**Dependencies**: Phases 1–6 complete (all JS files are finalized and named)

### Task 7.1: Add new JS files to SW cache manifest

- **Description**: Edit `sw.js`. Increment `CACHE_NAME` from `'flashlingo-v10'` to `'flashlingo-v11'` (forcing all clients to download the new cache). Add the three new JS files to the `ASSETS` array:
  ```js
  '/js/music.js',
  '/js/rhythm-tap.js',
  '/js/word-chant.js',
  ```
  Add them after `/js/word-bubbles.js` (line ~19) in the array. No other changes to `sw.js` are needed — the install/activate/fetch handlers are already generic.
- **Files**: `sw.js`
- **Size**: XS
- **Acceptance**: After `npm run build` (or manual browser refresh), the browser's Application > Cache Storage shows `flashlingo-v11` containing all three new JS files. With network offline, `js/music.js` can be fetched from cache (verify in DevTools Network tab with "Offline" throttling).

**Phase 7 Checkpoint**:
- [ ] Cache version bumped
- [ ] All three new files appear in DevTools cache
- [ ] Feature works fully with network set to Offline in DevTools

---

## Testing Strategy

### Manual Testing Checklist

**Rhythm Tap — Core Loop**
- [ ] Launch from nav Music tab: overlay appears, AudioContext starts
- [ ] 4-beat count-in plays and visual countdown shows 4→3→2→1
- [ ] Word and IPA displayed correctly; correct number of dots shown
- [ ] Each tap illuminates one dot and plays a note
- [ ] Correct tap count: green feedback, score increases, combo increments
- [ ] Incorrect tap count (too many or timeout): red feedback, life decremented
- [ ] 3 lives lost: game ends immediately
- [ ] 10 rounds complete: end screen shows
- [ ] End screen shows score, words list, both buttons work
- [ ] BPM increases every 2 rounds (verify audio feels faster)

**Rhythm Tap — Edge Cases**
- [ ] Words with 1 syllable (e.g., "cat"): 1 dot shown, 1 tap completes round
- [ ] Words with 5 syllables (e.g., "communication"): 5 dots shown
- [ ] Word with missing IPA: fallback to English vowel heuristic, still shows ≥ 1 dot
- [ ] Rapid double-tap does not count as 2 taps in 1 syllable (no debounce needed — each tap counts)
- [ ] App backgrounded mid-game and foregrounded: AudioContext resumes, beat continues
- [ ] "Play Again" resets state and starts a new game with a fresh word pool

**Word Chant — Core Loop**
- [ ] Launch from home card: overlay appears, chant plays through all lines with TTS
- [ ] Each line updates `#chantLyrics` with the current line text
- [ ] Word highlighted (`<mark>`) in each line
- [ ] Progress bar advances
- [ ] After all lines: quiz offer appears
- [ ] Quiz shows a fill-in-the-blank question with 3 choices
- [ ] Correct choice: green, points awarded
- [ ] Wrong choice: red, correct answer revealed
- [ ] End screen appears with results

**Word Chant — Lesson-Complete Offer**
- [ ] Complete a lesson with ≥ 60% accuracy → "Chant these words!" button appears
- [ ] Tapping it opens Word Chant with the lesson's exact 5 words
- [ ] "Continue" button still works normally

**Integration**
- [ ] Profile achievements grid shows all 5 music achievements (unlocked state after triggering)
- [ ] Pet quest "Play a music game" marks complete after one music game
- [ ] Points added to `appState.points` are reflected on home screen and profile immediately
- [ ] Nav Music tab is 5th button, does not displace existing nav items visually
- [ ] Existing Word Bubbles, Verbs, Essays tabs still navigate correctly

**Offline**
- [ ] Disable network in DevTools; hard reload; all three new JS files load from cache
- [ ] Rhythm Tap plays fully offline (no network calls at any point)
- [ ] Word Chant plays fully offline

### Edge Cases

- [ ] `ieltsVocabulary` entry with `ipa: ''` (empty string) — syllable counter returns 1
- [ ] `ieltsVocabulary` entry with `ipa: undefined` — fallback to English vowel heuristic
- [ ] `ieltsVocabulary` entry with `ex: undefined` — chant template uses fallback example line
- [ ] User has 0 SRS words — word pool falls back to first 50 vocab entries; game still starts
- [ ] `window.AudioContext` undefined (very old browser) — wrap in `try/catch`, show toast "Music not supported on this device" and return early from `startRhythmTap()`
- [ ] `speechSynthesis` unavailable — TTS lines are skipped silently; beat continues
- [ ] User taps Music nav tab while Word Bubbles is open — both overlays would be visible; guard by checking `bubblesState.isActive` in `startRhythmTap()` and showing toast "Finish Bubbles first!" if true

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AudioContext autoplay blocked on first load (mobile) | Medium | Medium | `getContext()` is always called inside a user gesture handler (tap → `startRhythmTap` → `getContext()`). Never call it on page load or in a `setTimeout`. |
| iOS Safari WKWebView suspends AudioContext on background | Low-Medium | Medium | Call `getContext()` at the top of each round start. If `ctx.state === 'suspended'`, call `ctx.resume()` and wait for the promise before scheduling beats. |
| IPA syllable count wrong for edge-case words | Low-Medium | Low | Fallback to English vowel heuristic. UI shows dot count before tapping — user can self-correct mentally. Accuracy ≥ 95% is acceptable. |
| TTS and beat timer drift (Word Chant) | Medium | Low | TTS is not rhythmically critical in Word Chant. Use estimated timing (`words.length * 350ms`) for sequencing; beat is independent and does not need to sync to TTS word-for-word. |
| 5th nav tab causes layout overflow on narrow screens (320px) | Low | Low | Use `font-size: 0.65rem` for nav labels and `gap: 0` between items. Test on 320px viewport. Alternatively drop the "Music" text label if it overflows (icon-only is acceptable). |
| `updateSRSAfterReview` function name may differ in `srs.js` | Low | Low | Wrap in `if (typeof updateSRSAfterReview === 'function')` guard. Check actual function name in `js/srs.js` before wiring. |

---

## Dependencies

### Internal (must exist before implementation)

- [ ] `js/music.js` must be complete before `js/rhythm-tap.js` and `js/word-chant.js` can be written
- [ ] `#rhythmTapOverlay` and `#wordChantOverlay` must be in `index.html` before any game JS runs
- [ ] `appState.musicStats` migration must be in `app.js` before game end functions reference it

### External Functions Used (verify names before coding)

| Function | File | Used By |
|----------|------|---------|
| `speakWord(word)` | `js/app.js` | `rhythm-tap.js` (word pronunciation on round start) |
| `speakWordFallback(text)` | `js/app.js` | `word-chant.js` (chant line TTS) |
| `shuffleArray(arr)` | `js/app.js` | both game files |
| `showToast(msg)` | `js/app.js` | both game files |
| `saveUserData(user, data)` | `js/app.js` | both game files |
| `unlockAchievement(id)` | `js/profile.js` | both game files |
| `renderHome()` | `js/home.js` | both game files (on close) |
| `checkPetQuest(id)` | `js/home.js` | both game files (on end) |
| `getGameWordPool(min)` | `js/word-bubbles.js` | `rhythm-tap.js` can copy this pattern (do not import — reimplement as `getRhythmWordPool()`) |
| `updateSRSAfterReview(word, correct)` | `js/srs.js` | `rhythm-tap.js` (guard with typeof check) |

---

## Progress Tracking

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 1: Music Engine | Not Started | | |
| Phase 2: Rhythm Tap Game | Not Started | | |
| Phase 3: Word Chant Mode | Not Started | | |
| Phase 4: HTML Additions | Not Started | | |
| Phase 5: CSS Additions | Not Started | | |
| Phase 6: State & Integration | Not Started | | |
| Phase 7: Service Worker | Not Started | | |

---

## Open Questions

- [ ] **SRS credit for correct taps**: Verify `updateSRSAfterReview` is the correct function name in `js/srs.js` before wiring. If the function signature differs, adapt accordingly.
- [ ] **Word pool restriction**: Decision doc recommends SRS pool first, fallback to lesson pool if < 20 words. This plan uses 20 as the threshold, matching the existing `getGameWordPool(20)` pattern. Confirm this is acceptable.
- [ ] **5th nav tab layout**: Confirm 5-button nav fits without overflow on the minimum supported viewport (375px is standard; 320px devices exist). If not, the Music tab can be icon-only (no label), or Music can be a home-screen card only (nav tab removed).
- [ ] **IPA completeness**: Decision doc flags that IPA may not be present for all 1,000 words. Before Phase 2 Task 2.1, run a quick console check: `ieltsVocabulary.filter(w => !w.ipa).length` to know the fallback rate.

---

## Handoff

### For @senior-developer

Start with Phase 1 (`js/music.js`) — it has no dependencies and unlocks all subsequent phases.

Suggested command:
`"@senior-developer implement Phase 1 from docs/plans/2026-03-06-music-feature-plan.md"`

After Phase 1 passes its checkpoint, Phases 2–4 can proceed in parallel (2 and 3 are independent of each other; 4 is HTML-only and can be done alongside either).

### For @tester

Test strategy is defined in the Testing Strategy section above. Write manual test cases after each phase checkpoint. The most critical paths to test are:

1. AudioContext lifecycle on mobile (Task 1.1) — must be tested on a real iOS device, not just Chrome desktop.
2. Syllable counter accuracy (Task 1.5) — run the spot-check against the full `ieltsVocabulary` array.
3. Beat drift over 10 rounds (Task 1.3) — count ticks with `console.log` timestamps.

---

*Plan created by planner-agent on 2026-03-06*
