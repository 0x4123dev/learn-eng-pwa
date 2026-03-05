# Plan: Word Pet Improvements

> **Status**: Ready
> **Date**: 2026-03-05
> **Author**: planner-agent
> **Decision**: docs/decisions/2026-03-05-word-pet-improvements-decision.md
> **Total Effort**: ~20–24 hours (Phase 1: ~8–10h, Phase 2: ~12–14h)

---

## Overview

### Objective

Transform the Word Pet from a passive decoration (single emoji, 3 moods, wiggle-on-tap) into an engaging companion with a visible habitat, custom name, personality, milestone celebrations (Phase 1), and a full daily care loop via hunger, accessories, and quests (Phase 2).

### Decision Reference

Based on: `docs/decisions/2026-03-05-word-pet-improvements-decision.md`

**Chosen Approach**: Option B — Full Engagement Overhaul, phased delivery
**Key Constraints**: Vanilla JS only, emoji/CSS-only graphics, offline PWA, localStorage, mobile-first, pet card height under ~180px on mobile

### Success Criteria

- [ ] Pet card shows a habitat environment matching the evolution stage
- [ ] Child can name their pet; name persists across sessions
- [ ] Pet tap shows contextual phrases instead of always a raw word
- [ ] Evolution triggers a visible celebration screen (not a silent re-render)
- [ ] Hunger meter is visible and changes meaningfully based on study behaviour
- [ ] At least 3 accessories are earnable and visibly displayed on the pet
- [ ] Daily quest is shown and completable every day
- [ ] All features work fully offline — no new network requests
- [ ] Home screen load time does not increase measurably
- [ ] CSS animations wrapped in `@media (prefers-reduced-motion: no-preference)`

### Out of Scope

- Pet collection / Pokédex (Option C)
- Pet reacts during lesson screen (candidate idea 7, not in top 7)
- Additional evolution stages or branching paths
- Parent-mode hunger visibility (open question, deferred)
- Skippable daily quests with cooldown (open question, deferred)

---

## Phase 1: Quick Wins

**Estimate**: 8–10 hours
**Dependencies**: None — can start immediately

---

### Task 1.1: Restructure HTML — Pet Scene Wrapper

- **Description**: Replace the bare `<div class="pet-container" id="petContainer"></div>` in `index.html` with a scene wrapper that provides room for the habitat background layer. The outer `.pet-scene` div holds a `.pet-bg` layer (emoji decorations) and the inner `#petContainer` where JS renders the creature. Add an empty `id="evolutionOverlay"` div after the scene for Task 1.4.
- **Files**: `index.html` (line 128)
- **What to change**:
  - Wrap the existing `<div class="pet-container" id="petContainer">` in `<div class="pet-scene" id="petScene">` with a child `<div class="pet-bg" id="petBg"></div>` before `#petContainer`
  - Add `<div class="evolution-overlay" id="evolutionOverlay" style="display:none"></div>` after `#petScene` (inside the home card, outside `#petScene`)
- **Size**: XS
- **Acceptance**: Page loads without visual regression; `#petScene`, `#petBg`, `#petContainer`, and `#evolutionOverlay` elements are all present in the DOM

---

### Task 1.2: CSS — Habitat Scenes and Time-of-Day Tints

- **Description**: Add all new pet CSS below the existing pet block (after line 3147 in `css/styles.css`). Do not touch any existing pet CSS rules.
- **Files**: `css/styles.css`
- **What to add**:

  **Scene layout**:
  ```css
  .pet-scene {
      position: relative;
      border-radius: var(--border-radius);
      overflow: hidden;
      min-height: 130px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 8px;
  }

  .pet-bg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      pointer-events: none;
      font-size: 22px;
      padding: 4px 8px;
      gap: 4px;
  }
  ```

  **Stage background gradients** (via `data-stage` on `.pet-scene`):
  ```css
  .pet-scene[data-stage="egg"]      { background: linear-gradient(180deg, #d4f1c4 0%, #a8e6a0 100%); }
  .pet-scene[data-stage="chick"]    { background: linear-gradient(180deg, #fffde7 0%, #c8e6c9 100%); }
  .pet-scene[data-stage="bird"]     { background: linear-gradient(180deg, #bbdefb 0%, #c8e6c9 100%); }
  .pet-scene[data-stage="phoenix"]  { background: linear-gradient(180deg, #ff8a65 0%, #ffcc80 60%, #8d6e63 100%); }
  .pet-scene[data-stage="dragon"]   { background: linear-gradient(180deg, #546e7a 0%, #90a4ae 60%, #d7ccc8 100%); }
  ```

  **Time-of-day overlay tints** (on `.pet-scene`):
  ```css
  .pet-scene.time-morning  { filter: brightness(1.05) sepia(0.05); }
  .pet-scene.time-afternoon { filter: brightness(1.0); }
  .pet-scene.time-evening  { filter: brightness(0.95) sepia(0.15); }
  .pet-scene.time-night    { filter: brightness(0.75) saturate(0.8); }
  ```

  **Accessory spans** (used in Phase 2, add now to avoid re-opening CSS):
  ```css
  .pet-accessory {
      position: absolute;
      font-size: 20px;
      pointer-events: none;
  }
  .pet-accessory.hat   { top: -4px; left: 50%; transform: translateX(-50%); }
  .pet-accessory.glasses { top: 16px; left: 50%; transform: translateX(-50%); }
  .pet-accessory.bow   { top: -4px; right: calc(50% - 28px); }
  .pet-accessory.crown { top: -8px; left: 50%; transform: translateX(-50%); }
  .pet-accessory.scarf { bottom: -4px; left: 50%; transform: translateX(-50%); }
  .pet-accessory.rainbow { /* CSS ring handled by ::before below */ }
  .pet-accessory.flame { /* CSS ring handled by ::before below */ }
  .pet-accessory.diamond { bottom: -4px; right: calc(50% - 28px); }
  ```

  **Hunger hearts row** (Phase 2, add now):
  ```css
  .pet-hunger {
      display: flex;
      gap: 2px;
      font-size: 16px;
      margin-top: 2px;
  }
  ```

  **Quest banner** (Phase 2, add now):
  ```css
  .pet-quest {
      width: 100%;
      background: rgba(255,255,255,0.75);
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
      margin-top: 4px;
      color: #333;
  }
  .pet-quest.completed { background: rgba(76,175,80,0.25); color: #2e7d32; }
  ```

  **Evolution overlay**:
  ```css
  .evolution-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      cursor: pointer;
  }

  .evolution-pet-emoji {
      font-size: 96px;
      animation: evolutionPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  .evolution-title {
      color: white;
      font-size: 22px;
      font-weight: 800;
      margin-top: 16px;
      text-align: center;
  }

  .evolution-confetti {
      position: absolute;
      font-size: 24px;
      animation: confettiFall linear forwards;
  }

  @media (prefers-reduced-motion: no-preference) {
      @keyframes evolutionPop {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
      }

      @keyframes confettiFall {
          0%   { transform: translateY(-40px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
      }
  }
  ```

  **Naming prompt** (inline in pet card):
  ```css
  .pet-name-form {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 8px;
  }
  .pet-name-input {
      border: 2px solid var(--accent-green);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      outline: none;
      width: 160px;
  }
  .pet-name-btn {
      background: var(--accent-green);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 6px 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
  }
  ```

- **Size**: M
- **Acceptance**: No visual regression on existing pet; new CSS compiles (no parse errors); animations only play when `prefers-reduced-motion: no-preference`

---

### Task 1.3: JS — `renderWordPet()` Refactor with Habitat + Pet Naming

- **Description**: Rewrite `renderWordPet()` in `js/home.js` to:
  1. Determine stage and derive a `stageKey` string (`"egg"`, `"chick"`, `"bird"`, `"phoenix"`, `"dragon"`)
  2. Set `data-stage` and time-of-day class on `#petScene`
  3. Populate `#petBg` with stage-specific emoji decoration spans
  4. If `!appState.petName`, render an inline naming form in `#petContainer` instead of the creature
  5. Otherwise render the creature with mood class, pet name + stage subtitle
- **Files**: `js/home.js`
- **New constants** (add above `getPetStage()`):
  ```js
  const PET_STAGE_KEYS = ['egg','chick','bird','phoenix','dragon'];

  const PET_HABITATS = {
      egg:     { decorations: ['🌿','🌿','🌱'], groundLine: true },
      chick:   { decorations: ['🌸','🌿','🌼','🌸'], groundLine: true },
      bird:    { decorations: ['🌳','🍃','🌿'], groundLine: false },
      phoenix: { decorations: ['🌋','🔥','✨'], groundLine: false },
      dragon:  { decorations: ['🏔️','☁️','⛰️'], groundLine: false }
  };
  ```
- **Updated `getPetStage()`**: Add a `key` field to each returned object:
  ```js
  function getPetStage(points) {
      if (points >= 5000) return { emoji: '🐉', name: 'Dragon',  key: 'dragon'  };
      if (points >= 2000) return { emoji: '🦅', name: 'Phoenix', key: 'phoenix' };
      if (points >= 500)  return { emoji: '🐦', name: 'Bird',    key: 'bird'    };
      if (points >= 100)  return { emoji: '🐣', name: 'Chick',   key: 'chick'   };
      return                     { emoji: '🥚', name: 'Egg',     key: 'egg'     };
  }
  ```
- **New helper** `getTimeOfDayClass()`:
  ```js
  function getTimeOfDayClass() {
      const h = new Date().getHours();
      if (h >= 5  && h < 12) return 'time-morning';
      if (h >= 12 && h < 18) return 'time-afternoon';
      if (h >= 18 && h < 22) return 'time-evening';
      return 'time-night';
  }
  ```
- **New `renderWordPet()`** (replace existing):
  ```js
  function renderWordPet() {
      const container = document.getElementById('petContainer');
      const scene     = document.getElementById('petScene');
      const bg        = document.getElementById('petBg');
      if (!container || !scene) return;

      const pet  = getPetStage(appState.points);
      const mood = getPetMood();

      // --- Habitat ---
      scene.dataset.stage = pet.key;
      scene.className = 'pet-scene ' + getTimeOfDayClass();
      if (bg) {
          const habitat = PET_HABITATS[pet.key];
          bg.innerHTML = habitat.decorations.map(e => `<span>${e}</span>`).join('');
      }

      // --- Naming prompt ---
      if (!appState.petName) {
          container.innerHTML = `
              <div class="pet-creature ${mood}">${pet.emoji}</div>
              <div class="pet-name-form">
                  <div style="font-size:12px;font-weight:700;color:var(--text-secondary)">Name your pet!</div>
                  <input class="pet-name-input" id="petNameInput" type="text"
                         maxlength="12" placeholder="Enter a name…"
                         onkeydown="if(event.key==='Enter')savePetName()">
                  <button class="pet-name-btn" onclick="savePetName()">Name it! 🐾</button>
              </div>
          `;
          return;
      }

      // --- Normal render ---
      container.innerHTML = `
          <div class="pet-creature ${mood}" onclick="onPetTap()" style="position:relative">
              ${pet.emoji}
          </div>
          <div class="pet-name">${appState.petName} <span style="font-weight:400;opacity:0.7">· ${pet.name}</span></div>
      `;
  }
  ```
- **New function** `savePetName()`:
  ```js
  function savePetName() {
      const input = document.getElementById('petNameInput');
      if (!input) return;
      const name = input.value.trim();
      if (!name) return;
      appState.petName = name;
      saveUserData(currentUser, appState);
      renderWordPet();
  }
  ```
- **Size**: M
- **Acceptance**: On first load (no `petName`), naming form appears over the pet. After entering a name and confirming, the name persists on reload. Stage emoji + stage subtitle shown correctly for each of the 5 point thresholds. Habitat background and emoji decorations change per stage. Time-of-day tint class applied correctly.

---

### Task 1.4: JS — Migration Guard for `petName`

- **Description**: Add a migration guard in `js/app.js` in the existing migration block (lines 499–509) so existing users are not prompted to name on every load if their data predates this feature.
- **Files**: `js/app.js`
- **What to add** (after line 509, alongside the other `=== undefined` guards):
  ```js
  if (appState.petName === undefined) appState.petName = null;
  ```
- **Size**: XS
- **Acceptance**: Existing user data loads without errors; `appState.petName` is `null` (not `undefined`) after migration, triggering the naming prompt exactly once on their next visit

---

### Task 1.5: JS — Personality Phrases in `onPetTap()`

- **Description**: Replace the current `onPetTap()` logic (which only shows a random SRS word) with a weighted phrase selector that covers all contextual categories from the decision doc. Keep the wiggle animation. Keep TTS for word-recall phrases.
- **Files**: `js/home.js`
- **New phrase constants** (add above `onPetTap()`):
  ```js
  const PET_PHRASES = {
      happy: [
          "I feel so smart today! 🌟",
          "You're amazing! Teach me more!",
          "Let's learn another word! 🎉",
          "I love studying with you! ❤️",
          "We're unstoppable! 💪"
      ],
      neutral: [
          "I missed you… will you study today? 🥺",
          "My tummy is rumbling…",
          "One lesson? Please? 🥺",
          "Come on, just one round! 🌱",
          "I'm waiting for you! ⏳"
      ],
      sleepy: [
          "Zzz… I'm so hungry… 💤",
          "Where have you been? I've been waiting…",
          "Please come back! I need you! 💤",
          "I'm fading away… study with me? 😢",
          "I miss learning new words… 😴"
      ]
  };
  ```
- **Updated `onPetTap()`** (replace existing):
  ```js
  function onPetTap() {
      const creature = document.querySelector('.pet-creature');
      if (!creature) return;
      creature.classList.add('wiggle');
      setTimeout(() => creature.classList.remove('wiggle'), 600);

      const mood = getPetMood();
      const pet  = getPetStage(appState.points);
      const srsWords = appState.srs ? Object.keys(appState.srs) : [];

      // Milestone proximity phrase (within 50 pts of next stage)
      const thresholds = [100, 500, 2000, 5000];
      const nextThreshold = thresholds.find(t => t > appState.points);
      if (nextThreshold && (nextThreshold - appState.points) <= 50) {
          showPetSpeechBubble("I feel something changing inside me! 🌟");
          return;
      }

      // Streak celebration phrase (7-day streak)
      if (appState.streak >= 7 && mood === 'happy') {
          const streakMsg = `We've studied together ${appState.streak} days in a row! I love you! 🎉`;
          if (Math.random() < 0.3) {
              showPetSpeechBubble(streakMsg);
              return;
          }
      }

      // Word recall phrase — 20% of taps when SRS words exist
      if (srsWords.length > 0 && Math.random() < 0.2) {
          const word = srsWords[Math.floor(Math.random() * srsWords.length)];
          const wordData = ieltsVocabulary.find(w => w.en === word);
          if (wordData) {
              showPetSpeechBubble(`${wordData.emoji} Do you remember "${wordData.en}"?`);
              speakWord(wordData.en);
              return;
          }
      }

      // Mood-based phrase
      const phrases = PET_PHRASES[mood] || PET_PHRASES.neutral;
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      showPetSpeechBubble(phrase);
  }
  ```
- **Size**: S
- **Acceptance**: Tapping the pet cycles through varied phrases. On a happy mood day, happy phrases appear. When streak >= 7 and mood is happy, celebration phrase appears occasionally. When within 50 pts of evolution, proximity phrase fires. 20% of taps with SRS words show word recall + TTS. No phrase shows just a raw word without context.

---

### Task 1.6: JS — Evolution Celebration Overlay

- **Description**: Detect when a lesson completion causes a stage change and display a full-screen evolution celebration. The check must happen in `js/lessons.js` (inside `completeLesson()`) because that is where points are applied and `renderHome()` is eventually called. A new function `showEvolutionCelebration(newStage)` lives in `js/home.js`.
- **Files**: `js/lessons.js`, `js/home.js`
- **What to add in `js/lessons.js`** (`completeLesson()` — after `appState.points += lessonState.lessonPoints` and before `saveUserData()`):
  ```js
  // Evolution check — capture old stage before points were added
  // NOTE: prevPoints must be captured BEFORE the += line, so add one line before it:
  // const _prevPoints = appState.points;  ← add this immediately before the += line
  // Then after the +=:
  const _newStage  = getPetStage(appState.points);
  const _prevStage = getPetStage(_prevPoints);
  if (_newStage.key !== _prevStage.key) {
      // Defer until after save and render so the overlay fires on top
      setTimeout(() => showEvolutionCelebration(_newStage), 300);
  }
  ```
  This same pattern applies to all three `appState.points +=` locations inside `completeLesson()` (review session, practice session, and regular lesson). For each, capture `_prevPoints` immediately before and run the stage-change check immediately after.

- **New function `showEvolutionCelebration(stage)`** in `js/home.js`:
  ```js
  function showEvolutionCelebration(stage) {
      const overlay = document.getElementById('evolutionOverlay');
      if (!overlay) return;

      // Build confetti
      const confettiEmojis = ['🎉','🌟','⭐','✨','🎊','💫'];
      const confettiHTML = Array.from({length: 20}, () => {
          const emoji = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
          const left  = Math.random() * 100;
          const delay = Math.random() * 1.5;
          const dur   = 2 + Math.random() * 1.5;
          return `<span class="evolution-confetti"
                        style="left:${left}%;top:0;animation-duration:${dur}s;animation-delay:${delay}s"
                  >${emoji}</span>`;
      }).join('');

      overlay.innerHTML = `
          ${confettiHTML}
          <div class="evolution-pet-emoji">${stage.emoji}</div>
          <div class="evolution-title">Your pet evolved into a ${stage.name}! ${stage.emoji}</div>
          <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:12px">Tap to continue</div>
      `;
      overlay.style.display = 'flex';
      overlay.onclick = () => { overlay.style.display = 'none'; };

      if (typeof speakWord === 'function') speakWord(stage.name);
  }
  ```
- **Size**: M
- **Acceptance**: After completing a lesson that crosses a point threshold (e.g. earning enough to go from Chick → Bird), the overlay fires. It shows the new emoji with a bounce animation and scattered confetti emoji. TTS speaks the stage name. Tapping anywhere dismisses it. No overlay fires when stage does not change. Works for all three lesson completion paths (review, practice, regular).

**Phase 1 Checkpoint**:
- [ ] `#petScene` shows the correct background colour/gradient for the current stage
- [ ] Time-of-day class applied on render (manually verify at different hours or mock `Date`)
- [ ] First-visit naming prompt appears; name saves and persists to localStorage
- [ ] Pet displays `name · Stage` subtitle after naming
- [ ] Tapping pet shows varied contextual phrases, not always a word
- [ ] Completing a lesson that crosses a threshold shows the evolution overlay
- [ ] All CSS animations gated behind `prefers-reduced-motion: no-preference`
- [ ] No console errors

---

## Phase 2: Retention Engine

**Estimate**: 12–14 hours
**Dependencies**: Phase 1 complete (especially `appState.petName` gating)

---

### Task 2.1: JS — State Schema for Phase 2 Fields

- **Description**: Add the three new state fields to `createDefaultUserData()` in `js/app.js` and add migration guards for existing users.
- **Files**: `js/app.js`
- **What to add in `createDefaultUserData()` return object** (after `battleHistory`):
  ```js
  petHunger:        100,
  petLastFed:       Date.now(),
  petAccessories:   [],   // Array of unlocked accessory IDs
  activeAccessories: [],  // Array of equipped IDs (max 3)
  petQuest:         { lastDate: null, questId: null, completed: false }
  ```
- **Migration guards** (add to the existing guard block in `js/app.js`, after the `petName` guard from Task 1.4):
  ```js
  if (appState.petHunger        === undefined) appState.petHunger        = appState.lastStudyDate === new Date().toDateString() ? 100 : 50;
  if (appState.petLastFed       === undefined) appState.petLastFed       = appState.lastStudyDate ? new Date(appState.lastStudyDate).getTime() : Date.now();
  if (appState.petAccessories   === undefined) appState.petAccessories   = [];
  if (appState.activeAccessories === undefined) appState.activeAccessories = [];
  if (appState.petQuest         === undefined) appState.petQuest         = { lastDate: null, questId: null, completed: false };
  ```
- **Size**: XS
- **Acceptance**: Existing users get sensible defaults (hunger 50 if not studied today, 100 if studied today). New users start at 100. No `undefined` errors at runtime.

---

### Task 2.2: JS — Hunger Computation and Display

- **Description**: Write the hunger system as a pure function that computes current hunger from the stored `petLastFed` timestamp. Hook feeding into lesson/challenge/SRS completion. Render the hunger hearts row in `renderWordPet()`.
- **Files**: `js/home.js`, `js/lessons.js`, `js/daily-challenge.js`

- **New constant** (add near top of `home.js`):
  ```js
  const HUNGER_DECAY_SCHEDULE = [
      { hoursWithout: 96, level: 0  },
      { hoursWithout: 72, level: 25 },
      { hoursWithout: 48, level: 50 },
      { hoursWithout: 24, level: 75 },
      { hoursWithout:  0, level: 100 }
  ];
  ```

- **New pure function `computeCurrentHunger(state)`** in `js/home.js`:
  ```js
  function computeCurrentHunger(state) {
      if (!state.petLastFed) return 50;
      const hoursSince = (Date.now() - state.petLastFed) / 3600000;
      for (const step of HUNGER_DECAY_SCHEDULE) {
          if (hoursSince >= step.hoursWithout) return step.level;
      }
      return 100;
  }
  ```

- **New function `feedPet(amount)`** in `js/home.js`:
  ```js
  function feedPet(amount) {
      if (!appState) return;
      appState.petHunger = Math.min(100, (appState.petHunger || 0) + amount);
      appState.petLastFed = Date.now();
      saveUserData(currentUser, appState);
  }
  ```

- **Updated `getPetMood()`** in `js/home.js` — extend to include hunger-aware states:
  ```js
  function getPetMood() {
      const hunger = computeCurrentHunger(appState);
      if (hunger === 0)  return 'starving';
      if (hunger <= 25)  return 'hungry';
      const today     = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (appState.lastStudyDate === today)      return 'happy';
      if (appState.lastStudyDate === yesterday)  return 'neutral';
      return 'sleepy';
  }
  ```

- **Hunger hearts render** — add to `renderWordPet()` after the creature div, before closing container:
  ```js
  // Add inside the "normal render" branch of renderWordPet(), append to container.innerHTML:
  const hunger = computeCurrentHunger(appState);
  const filledHearts  = Math.round(hunger / 20); // 0–5
  const heartsHTML = '❤️'.repeat(filledHearts) + '🖤'.repeat(5 - filledHearts);
  // Append <div class="pet-hunger">${heartsHTML}</div> to the container innerHTML
  ```

- **CSS additions** for `starving` and `hungry` mood classes in `css/styles.css`:
  ```css
  .pet-creature.starving {
      filter: grayscale(0.5) brightness(0.8);
      animation: petSway 2s ease infinite;
  }
  .pet-creature.hungry {
      animation: petSway 3s ease infinite;
  }
  ```

- **Feeding hooks**:
  - In `js/lessons.js` `completeLesson()`, after `saveUserData()` for each branch:
    - Regular lesson / practice: `if (typeof feedPet === 'function') feedPet(40);`
    - SRS review session: `if (typeof feedPet === 'function') feedPet(20);`
  - In `js/daily-challenge.js` `completeDailyChallenge()`, after bonus points are added:
    - `if (typeof feedPet === 'function') feedPet(25);`

- **Auto-show "starving" bubble** — in `renderWordPet()`, after rendering, if `hunger === 0` and pet has a name:
  ```js
  if (computeCurrentHunger(appState) === 0 && appState.petName) {
      setTimeout(() => showPetSpeechBubble("Please feed me! 😢"), 500);
  }
  ```

- **Size**: M
- **Acceptance**: After studying, hearts fill to 5. Hearts visually decrease at the correct intervals (can be verified by temporarily setting `petLastFed` to a past timestamp in devtools). At 0 hunger, pet shows `starving` class and auto-shows "Please feed me!" bubble. `computeCurrentHunger` called at render time, no polling intervals used.

---

### Task 2.3: JS — Accessories Data + Unlock Checks

- **Description**: Define the accessory data catalogue and a function `checkAccessoryUnlocks(state)` that grants newly earned accessories and shows a toast. Called from `unlockAchievement()` and from `completeLesson()`.
- **Files**: `js/home.js` (data + unlock logic), `js/profile.js` (hook into `unlockAchievement`), `js/lessons.js` (hook into `completeLesson`)

- **New constant `PET_ACCESSORIES`** in `js/home.js`:
  ```js
  const PET_ACCESSORIES = [
      { id: 'hat',      emoji: '🎩', label: 'Top Hat',      cssClass: 'hat',
        condition: s => (s.streak || 0) >= 5 },
      { id: 'glasses',  emoji: '🕶️', label: 'Sunglasses',   cssClass: 'glasses',
        condition: s => (s.lessonsCompleted || 0) >= 10 },
      { id: 'bow',      emoji: '🎀', label: 'Bow',           cssClass: 'bow',
        condition: s => (s.lessonsCompleted || 0) >= 25 },
      { id: 'crown',    emoji: '⭐', label: 'Star Crown',    cssClass: 'crown',
        condition: s => (s.streak || 0) >= 7 },
      { id: 'scarf',    emoji: '🧣', label: 'Scarf',         cssClass: 'scarf',
        condition: s => (s.lessonsCompleted || 0) >= 50 },
      { id: 'rainbow',  emoji: '🌈', label: 'Rainbow Aura',  cssClass: 'rainbow',
        condition: s => (s.lessonsCompleted || 0) >= 100 },
      { id: 'flame',    emoji: '🔥', label: 'Flame Halo',    cssClass: 'flame',
        condition: s => (s.streak || 0) >= 30 },
      { id: 'diamond',  emoji: '💎', label: 'Diamond',       cssClass: 'diamond',
        condition: s => (s.points || 0) >= 5000 }
  ];
  ```

- **New function `checkAccessoryUnlocks(state)`** in `js/home.js`:
  ```js
  function checkAccessoryUnlocks(state) {
      if (!state || !state.petName) return; // Phase 2 gated on pet being named
      const owned = state.petAccessories || [];
      PET_ACCESSORIES.forEach(acc => {
          if (!owned.includes(acc.id) && acc.condition(state)) {
              state.petAccessories.push(acc.id);
              // Auto-equip if fewer than 3 active
              if ((state.activeAccessories || []).length < 3) {
                  state.activeAccessories.push(acc.id);
              }
              saveUserData(currentUser, state);
              showToast(`${acc.emoji} New accessory unlocked: ${acc.label}!`);
          }
      });
  }
  ```

- **Retroactive migration** — in the migration guard block of `js/app.js`, after `petAccessories` is initialised, add:
  ```js
  // Retroactively grant accessories for existing users who already meet conditions
  if (appState.petAccessories !== undefined && appState.petName) {
      if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);
  }
  ```

- **Hook `checkAccessoryUnlocks`**:
  - In `js/profile.js` `unlockAchievement()`, after `saveUserData()`: `if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);`
  - In `js/lessons.js` `completeLesson()`, after `saveUserData()`: same one-liner

- **Size**: S
- **Acceptance**: A user with 5-day streak has `hat` in `petAccessories` after login migration. A new user earning their 10th lesson gets a toast "🕶️ New accessory unlocked: Sunglasses!". Accessories are stored in `appState` and persist across sessions. No unlock fires unless `petName` is set.

---

### Task 2.4: JS + CSS — Render Active Accessories on Pet

- **Description**: Render equipped accessories as absolutely-positioned emoji spans inside `.pet-creature`'s wrapper div. Add a collapsible accessories tray (tap icon → expand inline) below the hunger hearts for equip/unequip.
- **Files**: `js/home.js`, `css/styles.css`

- **Update `renderWordPet()` normal render branch** to:
  1. Make `.pet-creature`'s parent a `position:relative` wrapper div (not the creature itself)
  2. Append accessory spans inside the wrapper
  3. Append the hunger hearts row
  4. Append the accessories tray toggle button
  5. If tray is open (tracked by a module-level `_accTrayOpen = false` variable), render the tray

  ```js
  // Accessory spans for active accessories
  let _accTrayOpen = false; // module-level variable, add at top of home.js section

  // Inside renderWordPet() normal render branch:
  const active = (appState.activeAccessories || []);
  const accSpans = active.map(id => {
      const acc = PET_ACCESSORIES.find(a => a.id === id);
      if (!acc) return '';
      return `<span class="pet-accessory ${acc.cssClass}">${acc.emoji}</span>`;
  }).join('');

  const owned = (appState.petAccessories || []);
  const trayToggleHTML = owned.length > 0
      ? `<button class="pet-acc-toggle" onclick="toggleAccTray()" title="Accessories">
             👗 ${owned.length} <span style="font-size:10px">${_accTrayOpen ? '▲' : '▼'}</span>
         </button>`
      : '';

  const trayHTML = _accTrayOpen ? renderAccTray() : '';

  container.innerHTML = `
      <div class="pet-wrapper" style="position:relative;display:inline-block">
          <div class="pet-creature ${mood}" onclick="onPetTap()">${pet.emoji}</div>
          ${accSpans}
      </div>
      <div class="pet-name">${appState.petName} <span style="font-weight:400;opacity:0.7">· ${pet.name}</span></div>
      <div class="pet-hunger">${heartsHTML}</div>
      ${trayToggleHTML}
      ${trayHTML}
  `;
  ```

- **New function `renderAccTray()`**:
  ```js
  function renderAccTray() {
      const owned  = appState.petAccessories  || [];
      const active = appState.activeAccessories || [];
      const slots  = owned.map(id => {
          const acc   = PET_ACCESSORIES.find(a => a.id === id);
          if (!acc) return '';
          const equipped = active.includes(id);
          return `<span class="acc-slot ${equipped ? 'equipped' : ''}"
                        onclick="toggleAccessory('${id}')"
                        title="${acc.label}">${acc.emoji}</span>`;
      }).join('');
      return `<div class="pet-acc-tray">${slots}</div>`;
  }
  ```

- **New function `toggleAccTray()`**:
  ```js
  function toggleAccTray() {
      _accTrayOpen = !_accTrayOpen;
      renderWordPet();
  }
  ```

- **New function `toggleAccessory(id)`**:
  ```js
  function toggleAccessory(id) {
      const active = appState.activeAccessories || [];
      if (active.includes(id)) {
          appState.activeAccessories = active.filter(a => a !== id);
      } else if (active.length < 3) {
          appState.activeAccessories.push(id);
      } else {
          showToast('Only 3 accessories can be equipped at once!');
          return;
      }
      saveUserData(currentUser, appState);
      renderWordPet();
  }
  ```

- **CSS additions** in `css/styles.css`:
  ```css
  .pet-acc-toggle {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      cursor: pointer;
      margin-top: 4px;
      color: var(--text-secondary);
  }

  .pet-acc-tray {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: center;
      padding: 6px 4px;
      background: rgba(255,255,255,0.5);
      border-radius: 10px;
      margin-top: 4px;
      max-width: 200px;
  }

  .acc-slot {
      font-size: 22px;
      cursor: pointer;
      border-radius: 8px;
      padding: 2px 4px;
      border: 2px solid transparent;
  }
  .acc-slot.equipped {
      border-color: var(--accent-green);
      background: rgba(76,175,80,0.1);
  }
  ```

- **Size**: M
- **Acceptance**: Active accessories appear as emoji overlaid at the correct position on the pet (hat above, glasses mid, etc.). Tapping the 👗 button expands the tray. Tapping an owned accessory toggles equip/unequip. Equipping a 4th item shows a toast instead. State persists. Tray opens/closes without full page reload.

---

### Task 2.5: JS — Daily Pet Quest

- **Description**: Add the daily quest system: seeded random quest selection, quest state in `appState`, quest banner rendered inside the pet card, and completion hooks in all relevant activity end-flows.
- **Files**: `js/home.js`, `js/lessons.js`, `js/daily-challenge.js`, `js/app.js` (or wherever WOTD viewed is tracked)

- **New constant `PET_QUESTS`** in `js/home.js`:
  ```js
  const PET_QUESTS = [
      { id: 'lesson',    text: 'Complete 1 lesson today',          pts: 20, hunger: 30,
        eligible: s => true },
      { id: 'perfect',   text: 'Get 100% accuracy in a lesson',   pts: 30, hunger: 40,
        eligible: s => true },
      { id: 'srs',       text: 'Complete an SRS review session',  pts: 20, hunger: 30,
        eligible: s => s.srs && Object.keys(s.srs).length >= 3 },
      { id: 'wotd',      text: 'Open the Word of the Day',         pts: 10, hunger: 20,
        eligible: s => true },
      { id: 'bubbles',   text: 'Play Word Bubbles',                pts: 20, hunger: 30,
        eligible: s => true },
      { id: 'challenge', text: 'Complete the Daily Challenge',     pts: 25, hunger: 35,
        eligible: s => true },
      { id: 'streak3',   text: 'Study 3 days in a row',            pts: 40, hunger: 50,
        eligible: s => true }
  ];
  ```

- **New function `getDailyQuest(state)`** in `js/home.js`:
  ```js
  function getDailyQuest(state) {
      const dateStr = new Date().toDateString();
      const eligible = PET_QUESTS.filter(q => q.eligible(state));
      const fallback = PET_QUESTS.find(q => q.id === 'lesson');
      if (eligible.length === 0) return fallback;
      const rng   = seededRandom('pet-quest-' + dateStr);
      const index = Math.floor(rng() * eligible.length);
      return eligible[index] || fallback;
  }
  ```

- **New function `checkQuestCompletion(triggerQuestId, extraContext)`** in `js/home.js`:
  ```js
  function checkQuestCompletion(triggerQuestId, extraContext) {
      if (!appState || !appState.petName) return;
      const today = new Date().toDateString();
      if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
      const q = appState.petQuest;

      // Reset if new day
      if (q.lastDate !== today) {
          const quest = getDailyQuest(appState);
          q.lastDate  = today;
          q.questId   = quest.id;
          q.completed = false;
      }
      if (q.completed) return;

      const quest = PET_QUESTS.find(p => p.id === q.questId);
      if (!quest) return;

      // Streak-3 special check
      if (quest.id === 'streak3' && triggerQuestId === 'lesson' && (appState.streak || 0) >= 3) {
          _completeQuest(quest);
          return;
      }

      // Perfect quest check — extraContext carries accuracy
      if (quest.id === 'perfect' && triggerQuestId === 'lesson' && extraContext?.accuracy === 100) {
          _completeQuest(quest);
          return;
      }

      if (quest.id === triggerQuestId) {
          _completeQuest(quest);
      }
  }

  function _completeQuest(quest) {
      appState.petQuest.completed = true;
      appState.points   += quest.pts;
      feedPet(quest.hunger);
      saveUserData(currentUser, appState);
      showToast(`🐾 Quest complete! +${quest.pts} pts, pet fed!`);
      const creature = document.querySelector('.pet-creature');
      if (creature) {
          creature.classList.add('wiggle');
          setTimeout(() => creature.classList.remove('wiggle'), 600);
      }
      renderWordPet();
  }
  ```

- **Quest banner render** — add to `renderWordPet()` normal render branch, after the accessories tray HTML:
  ```js
  const today = new Date().toDateString();
  if (!appState.petQuest || appState.petQuest.lastDate !== today) {
      const quest = getDailyQuest(appState);
      if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
      appState.petQuest.lastDate = today;
      appState.petQuest.questId  = quest.id;
      appState.petQuest.completed = false;
  }
  const questData  = PET_QUESTS.find(q => q.id === appState.petQuest.questId) || PET_QUESTS[0];
  const questDone  = appState.petQuest.completed;
  const questHTML  = `<div class="pet-quest ${questDone ? 'completed' : ''}">
      ${questDone ? '✅' : '🐾'} ${questData.text}
  </div>`;
  // Append questHTML to the container's innerHTML
  ```

- **Completion hooks** (add `checkQuestCompletion` calls):
  - `js/lessons.js` `completeLesson()` — regular lesson branch, after `saveUserData()`:
    ```js
    if (typeof checkQuestCompletion === 'function') {
        checkQuestCompletion('lesson', { accuracy });
    }
    ```
  - `js/lessons.js` `completeLesson()` — SRS review branch, after `saveUserData()`:
    ```js
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('srs');
    ```
  - `js/daily-challenge.js` `completeDailyChallenge()`, after bonus points:
    ```js
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('challenge');
    ```
  - Word Bubbles end (`js/word-bubbles.js`, after `appState.points +=`):
    ```js
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('bubbles');
    ```
  - WOTD viewed — find where `appState.wordOfDayViewed` is set in `js/home.js`, add after it:
    ```js
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('wotd');
    ```

- **Size**: M
- **Acceptance**: Quest banner appears daily in the pet card. Quest changes each day (seeded by date). Completing the relevant activity triggers the quest completion toast and pet wiggle. Completed quest banner turns green with checkmark. Quest resets next day. Ineligible quests (e.g. SRS with 0 words) never appear — falls back to "Complete 1 lesson".

---

### Task 2.6: Phrase Extensions for Hunger States

- **Description**: Add `starving` and `hungry` entries to `PET_PHRASES` so `onPetTap()` shows appropriate phrases when hunger is critical.
- **Files**: `js/home.js`
- **What to add** to `PET_PHRASES` constant:
  ```js
  starving: [
      "Please feed me! I'm so hungry! 😢",
      "I can barely move… please study with me!",
      "My tummy is so empty… 💔",
      "I've been waiting so long… please come back! 😭"
  ],
  hungry: [
      "I'm getting hungry… can we study? 🍖",
      "My tummy is rumbling…",
      "Feed me? Just one lesson? 🥺",
      "I feel a bit weak… let's study!"
  ]
  ```
- **Update `onPetTap()`** — the `PET_PHRASES[mood]` lookup already handles this, no structural change needed; only the constant addition is required.
- **Size**: XS
- **Acceptance**: Tapping a `starving` pet shows one of the starving phrases. Tapping a `hungry` pet shows one of the hungry phrases.

**Phase 2 Checkpoint**:
- [ ] Hunger hearts (0–5) display correctly and update after studying
- [ ] `starving` pet shows grayscale/dim CSS class and auto-shows "Please feed me!" bubble on render
- [ ] Completing a lesson refills 40 hunger; daily challenge +25; SRS review +20
- [ ] After earning 10th lesson, Sunglasses accessory unlocks with toast
- [ ] Active accessories are rendered as emoji overlaid on the creature at correct positions
- [ ] Accessories tray toggles open/closed; equip/unequip works; max 3 enforced
- [ ] Daily quest banner displays correct quest for the day
- [ ] Completing the quest activity fires the toast and marks quest complete
- [ ] Quest resets at midnight (new day)
- [ ] All Phase 2 UI is hidden until `appState.petName` is set
- [ ] No console errors

---

## Testing Strategy

### Manual Smoke Tests (after Phase 1)

- [ ] Fresh user (no data): naming prompt appears, name saves, persists on reload
- [ ] Verify 5 stage backgrounds by setting `appState.points` to 0 / 100 / 500 / 2000 / 5000 in devtools
- [ ] Verify time-of-day class by checking at morning, afternoon, evening, night (or mock `Date`)
- [ ] Tap pet 10+ times — verify happy/neutral/sleepy phrases, word recall phrase (20%), proximity phrase near threshold
- [ ] Complete a lesson that crosses a point threshold — evolution overlay fires and dismisses on tap

### Manual Smoke Tests (after Phase 2)

- [ ] Set `appState.petLastFed = Date.now() - 100 * 3600000` — verify 0 hearts and starving state
- [ ] Set `appState.petLastFed = Date.now() - 30 * 3600000` — verify 3 hearts and neutral state
- [ ] Complete a lesson — verify hearts increase and `petLastFed` is updated
- [ ] Reach 10th lesson — verify Sunglasses unlock toast and appearance in accessories tray
- [ ] Equip 3 accessories — verify 4th shows "Only 3…" toast
- [ ] Equip an accessory — verify it appears overlaid on pet; verify it persists on reload
- [ ] Quest for "complete 1 lesson" — complete a lesson — verify quest completion fires
- [ ] Change date (or mock) — verify quest resets to a new quest
- [ ] Verify `checkQuestCompletion('wotd')` fires when WOTD is opened
- [ ] Verify all features are absent when `appState.petName` is `null`

### Edge Cases

- [ ] User with 0 SRS words — no raw "word recall" phrase fires (guard already in `onPetTap`)
- [ ] SRS quest with <3 SRS words — falls back to "complete 1 lesson" quest
- [ ] Evolution overlay with multiple rapid lesson completions — only fires when stage actually changes
- [ ] `petLastFed` far in the past (months) — hunger clamps at 0, never negative
- [ ] `activeAccessories` contains an ID no longer in `petAccessories` — render gracefully (filter undefined)

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hunger decay too fast, causing child anxiety | Medium | Medium | Cap at `starving` (never "dead"); all language is gentle ("I missed you") not punitive; 96h threshold is a constant, easy to adjust post-launch |
| Accessories tray makes card too tall on small phones | Medium | Low | Tray is hidden by default (collapsed); only opens on tap |
| Quest type ineligible (SRS quest with 0 words) | Medium | Low | `eligible` guard in `getDailyQuest()` filters it out; safe default to "complete 1 lesson" |
| Phase 2 scope creep | Low | Medium | Phase boundary is a hard cut; each task is independently mergeable |
| Evolution overlay fires on practice/review sessions | Low | Low | Capture `_prevPoints` before points are applied in every branch; check is per-branch |

---

## Dependencies

### Internal

- [ ] `seededRandom()` already exists in `js/home.js` — reuse for daily quest selection
- [ ] `showToast()` exists in `js/app.js` — reuse for accessory unlock toasts
- [ ] `createConfetti()` exists in `js/lessons.js` — optionally reuse confetti logic for evolution overlay (or re-implement with emoji spans as specified)
- [ ] `speakWord()` exists globally — reuse for evolution TTS and word-recall TTS
- [ ] `saveUserData()` / `currentUser` available globally — used throughout

### External

- None — no new libraries, no new network requests, no build step changes

---

## File Change Summary

| File | Phase | Change Type |
|------|-------|-------------|
| `index.html` | 1 | Add `.pet-scene`, `.pet-bg`, `#evolutionOverlay` wrappers (Task 1.1) |
| `css/styles.css` | 1+2 | Add ~130 lines of new CSS — all additive, no existing rules removed (Task 1.2) |
| `js/home.js` | 1 | Refactor `renderWordPet()`, `onPetTap()`, `getPetStage()`, `getPetMood()`; add `savePetName()`, `getTimeOfDayClass()`, `showEvolutionCelebration()`, `PET_PHRASES`, `PET_HABITATS`, `PET_STAGE_KEYS` (Tasks 1.3, 1.5, 1.6) |
| `js/home.js` | 2 | Add `computeCurrentHunger()`, `feedPet()`, `checkAccessoryUnlocks()`, `renderAccTray()`, `toggleAccTray()`, `toggleAccessory()`, `getDailyQuest()`, `checkQuestCompletion()`, `_completeQuest()`, `PET_ACCESSORIES`, `PET_QUESTS`, `HUNGER_DECAY_SCHEDULE`, phrase extensions (Tasks 2.2–2.6) |
| `js/app.js` | 1+2 | Add migration guards for `petName`, `petHunger`, `petLastFed`, `petAccessories`, `activeAccessories`, `petQuest`; add new fields to `createDefaultUserData()` (Tasks 1.4, 2.1) |
| `js/lessons.js` | 1+2 | Add evolution check around all `points +=` branches; add `feedPet()` calls; add `checkQuestCompletion()` calls; add `checkAccessoryUnlocks()` call (Tasks 1.6, 2.2, 2.3, 2.5) |
| `js/profile.js` | 2 | Add `checkAccessoryUnlocks()` call at end of `unlockAchievement()` (Task 2.3) |
| `js/daily-challenge.js` | 2 | Add `feedPet(25)` and `checkQuestCompletion('challenge')` (Tasks 2.2, 2.5) |
| `js/word-bubbles.js` | 2 | Add `checkQuestCompletion('bubbles')` (Task 2.5) |

---

## Progress Tracking

| Phase | Task | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | 1.1 HTML restructure | Not Started | | |
| 1 | 1.2 CSS habitat + animations | Not Started | | |
| 1 | 1.3 renderWordPet() refactor | Not Started | | |
| 1 | 1.4 petName migration guard | Not Started | | |
| 1 | 1.5 Personality phrases | Not Started | | |
| 1 | 1.6 Evolution celebration | Not Started | | |
| 2 | 2.1 Phase 2 state schema | Not Started | | |
| 2 | 2.2 Hunger system | Not Started | | |
| 2 | 2.3 Accessories unlock logic | Not Started | | |
| 2 | 2.4 Render accessories + tray | Not Started | | |
| 2 | 2.5 Daily pet quest | Not Started | | |
| 2 | 2.6 Hunger phrase extensions | Not Started | | |

---

## Open Questions (from Decision Doc)

- [ ] Should the hunger meter be shown in a parent-mode view? (deferred)
- [ ] Should accessory unlocks be retroactive? **Recommendation: yes** — Task 2.3 migration block handles this
- [ ] Should daily quests be explicitly skippable (once per day)? (deferred — current eligibility fallback handles the common case)
- [ ] Is 96h the right full-collapse threshold? Expose as a named constant `PET_HUNGER_COLLAPSE_HOURS = 96` so it can be tuned without a code search

---

## Handoff

### For @senior-developer:

Start with Phase 1, tasks in order (1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6). Tasks 1.1 and 1.2 can be done in parallel. Task 1.3 depends on 1.1 and 1.2. Tasks 1.4 and 1.5 are independent. Task 1.6 depends on 1.3.

After Phase 1 is verified working end-to-end, proceed with Phase 2 (2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6). Task 2.1 must come first. Tasks 2.2 and 2.3 can be done in parallel after 2.1. Task 2.4 depends on 2.3. Task 2.5 depends on 2.2 (for `feedPet`). Task 2.6 is a standalone addition to an existing constant.

```
"@senior-developer implement Phase 1 from docs/plans/2026-03-05-word-pet-improvements-plan.md"
```

### For @tester:

Test strategy and edge cases defined above. Execute manual smoke tests after each phase checkpoint. Pay special attention to:
- Migration path for existing users (must not lose existing pet state)
- The 5 hunger decay thresholds (can be tested by manipulating `petLastFed` in devtools)
- Evolution overlay not double-firing in the practice/review branches

---

*Plan created by planner-agent on 2026-03-05*
