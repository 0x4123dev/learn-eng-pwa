# Decision: Word Pet Feature Improvements

> **Status**: Proposed
> **Date**: 2026-03-05
> **Author**: brainstormer-agent
> **Deciders**: Product owner, developer

---

## Context

### Problem Statement

The Word Pet feature on the home screen is visually bare and interactionally shallow. It is a single large emoji (64px) that bounces or sways based on study recency, and wiggles + speaks a word on tap. There is no habitat, no customization, no pet care loop, and no integration with the broader learning flow. Children who are the primary audience have no reason to check on the pet beyond the first tap. The feature does not currently drive daily return visits or reinforce learning motivation.

### Constraints

- **Tech**: Vanilla JS only — no frameworks, no bundler, no external image assets
- **Platform**: PWA, must work fully offline
- **Graphics**: Emojis and CSS-only visuals
- **Storage**: localStorage (no backend)
- **Performance**: Mobile-first, lightweight — avoid heavy JS loops or layout thrash
- **Scope**: The feature lives in a small card on `index.html`; it cannot dominate the page

### Current State (Baseline)

- 5 evolution stages tied to points (Egg → Chick → Bird → Phoenix → Dragon)
- 3 moods tied to last study date (happy/neutral/sleepy)
- Tap: wiggle + speech bubble showing a random learned word + TTS
- No background, no accessories, no pet-care mechanics, no daily quests

### Requirements

- **Must have**: Motivate kids to study daily; improve emotional connection to the pet
- **Should have**: Visual richness that feels rewarding without requiring external assets
- **Nice to have**: Collectible or unlock mechanics that extend the loop
- **Must NOT**: Add network-dependent features, break offline PWA behaviour, or significantly bloat bundle size

---

## Candidate Ideas — Full Longlist

The following 12 candidate ideas were evaluated before narrowing to the top selection.

| # | Idea | Fun | Motivation | Effort | Retention |
|---|------|-----|------------|--------|-----------|
| 1 | Habitat / environment scene | High | Medium | Low | Medium |
| 2 | Day/night cycle (real time) | Medium | Low | Low | Medium |
| 3 | Hunger / energy system | Very High | Very High | Medium | Very High |
| 4 | Pet phrases & personality | High | High | Low | High |
| 5 | Milestone celebration burst | High | High | Low | High |
| 6 | Accessories earned by studying | Very High | Very High | Medium | Very High |
| 7 | Pet reacts during lessons | High | High | Medium | High |
| 8 | More evolution stages / branching | Medium | Medium | Medium | Medium |
| 9 | Daily pet quest | High | Very High | Medium | Very High |
| 10 | Pet name (user sets it) | Medium | Medium | Low | High |
| 11 | Mini pet-care game | High | Medium | High | High |
| 12 | Collection / Pokédex of pets | Very High | High | High | Very High |

After scoring, **ideas 1, 3, 4, 5, 6, 9, 10** form the strongest set: high impact, achievable in vanilla JS, offline-safe.

---

## Options Considered

### Option A: Quick Wins Bundle (Phase 1 focus only)

**Description**: Implement only low-effort ideas that dramatically improve visual and emotional quality without adding complex game mechanics. Covers: habitat scene, day/night cycle, pet phrases, milestone celebrations, and pet naming.

**Pros**:
- Fastest to ship (est. 2–3 days total)
- Zero risk of breaking existing features
- Immediate visible improvement for kids
- No new localStorage keys needed beyond `petName`

**Cons**:
- Does not add a retention loop — kids may still stop caring after a week
- No unlock/reward system; no reason to keep studying *for the pet*

**Effort**: Low
**Risk**: Low

---

### Option B: Full Engagement Overhaul (Phase 1 + Phase 2)

**Description**: Implement the complete top-7 ideas across two phases. Phase 1 delivers quick wins (habitat, personality, names, celebrations). Phase 2 adds the retention engine (hunger system, accessories, daily pet quest).

**Pros**:
- Creates a genuine care loop: kids must study to keep pet fed and earn accessories
- Daily quest gives a specific reason to open the app every day
- Accessories are a visible, collectible reward tied directly to study behaviour
- Pet phrases can reinforce vocabulary (pet says the word the child got wrong)
- Fully feasible in vanilla JS with localStorage

**Cons**:
- Phase 2 features require 4–6 days of focused dev work
- Hunger system must be tuned carefully — if pet degrades too fast, it causes anxiety; too slow and it has no effect
- Accessories panel adds UI complexity to an already-dense home screen

**Effort**: Medium (Phase 1 Low, Phase 2 Medium)
**Risk**: Low–Medium

---

### Option C: Pet Collection / Pokédex Expansion

**Description**: Instead of improving the single pet, allow kids to collect multiple pets. Each pet type (cat, dog, robot, unicorn, etc.) has a different emoji set and is unlocked by reaching milestones. The current pet becomes "Starter Pet Alpha".

**Pros**:
- Very high collectible motivation for kids
- Natural viral hook ("which pet do you have?")
- Each pet can have its own personality phrases

**Cons**:
- Requires significant new data structures (multiple pet states, inventory)
- Emoji coverage for multi-stage pets is limited (hard to find 5 matching emojis per species)
- UI complexity is very high — collection screen, switching, storage
- Does not fix the core emotional connection problem with the *current* pet
- Risks becoming a feature that overshadows the learning product

**Effort**: High
**Risk**: Medium

---

## Comparison Matrix

| Criteria | Option A (Quick Wins) | Option B (Full Overhaul) | Option C (Collection) |
|----------|-----------------------|--------------------------|----------------------|
| Fun factor for kids | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Learning motivation | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Implementation effort | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Retention impact | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Offline / PWA safe | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Risk | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **Total** | **22** | **27** | **19** |

---

## Decision

**Chosen**: Option B — Full Engagement Overhaul, phased delivery

**Rationale**: Option A is too shallow to meaningfully change retention. Option C spreads effort across a large new feature that risks dwarfing the core learning product. Option B delivers immediate visual delight in Phase 1, then layers in a genuine daily care loop in Phase 2. The hunger + accessories + daily quest triad is the proven core mechanic of every successful virtual pet product (Tamagotchi, Nintendogs, Duolingo's streak owl) and is fully implementable in vanilla JS with localStorage. The phased approach de-risks delivery and lets us validate Phase 1 impact before committing to Phase 2.

---

## Top 7 Ideas — Detailed Specifications

### PHASE 1 — Quick Wins (est. 2–3 days)

---

#### Idea 1: Habitat / Environment Scene

**What it is**: Replace the blank pet card with a small illustrated environment that matches the pet's evolution stage. Built entirely with CSS + emoji layers.

**Stage environments**:
- Egg: 🌿 grass patch, simple ground line
- Chick: 🌿🌸 meadow with flowers
- Bird: 🌳 tree branch, sky background
- Phoenix: 🌋 volcano peak, glowing sky
- Dragon: 🏔️ mountain peak with clouds

**Implementation**:
- `.pet-scene` div wrapping `.pet-bg` (emoji decorations absolutely positioned) + `.pet-creature`
- Each stage adds a `data-stage="bird"` attribute, CSS handles the background-color, gradient sky, and emoji decorations
- No images, no canvas — pure CSS gradients + pseudo-elements + emoji spans
- Time-of-day tint: apply a CSS class (`morning`, `afternoon`, `evening`, `night`) based on `new Date().getHours()` at render time; adjusts the sky gradient (warm orange for morning, blue for afternoon, purple/dark for night)

**Why it matters**: First impression when a child opens the app. A rich environment immediately signals "my pet lives here" and creates a sense of place worth returning to.

**Effort**: Low (half a day CSS work)

---

#### Idea 2: Pet Name

**What it is**: Let the child name their pet. On first visit after the feature ships, a small prompt appears inside the pet card: "What will you name your pet?" with a text input.

**Implementation**:
- `appState.petName` (string, stored in localStorage with existing user data)
- If `petName` is null, show naming prompt inline in the pet card
- After naming, show the name below the pet emoji (replaces current static stage name)
- Stage name becomes a subtitle: "Dragon · named Sparky"

**Why it matters**: Naming a character is the single fastest way to create emotional investment. Kids who name their pet will not want to let it get sad or hungry.

**Effort**: Very Low (1–2 hours)

---

#### Idea 3: Pet Personality Phrases

**What it is**: Replace the current "shows a random learned word" tap behaviour with contextual pet phrases that vary by mood, time of day, streak, and occasionally reference a learned word.

**Phrase categories**:
- **Happy (studied today)**: "I feel so smart today!", "You're amazing! Teach me more!", "Let's learn another word! 🌟"
- **Neutral**: "I missed you... will you study today?", "My tummy is rumbling...", "One lesson? Please? 🥺"
- **Sleepy**: "Zzz... I'm so hungry...", "Where have you been? I've been waiting...", "Please come back! I need you! 💤"
- **Word recall**: 20% of taps show: "Hey, do you remember '{{word}}'? It means {{emoji}}!" (picks a word from SRS)
- **Milestone proximity**: When within 50 points of next evolution — "I feel something changing inside me! 🌟"
- **Streak celebration**: On tap after a 7-day streak — "We've studied together 7 days in a row! I love you!"

**Implementation**:
- Phrase arrays in `home.js`, weighted random selection in `onPetTap()`
- Phrases referencing SRS words pull from `appState.srs` keys (same as current behaviour)
- No new storage needed

**Effort**: Low (2–3 hours)

---

#### Idea 4: Milestone Celebration Burst

**What it is**: When the pet evolves (crosses a point threshold), trigger a full-screen celebration moment rather than a silent re-render.

**Implementation**:
- Track previous stage in a local variable at render time: `const prevStage = getPetStage(prevPoints)`
- After awarding points in `recordStudy()` / lesson completion, compare old vs new stage
- If stage changed: show a full-screen overlay (existing overlay pattern already used for WOTD) with:
  - New pet emoji animating in (scale 0 → 1.2 → 1 with bounce)
  - Confetti burst: 20 emoji spans (🎉🌟⭐✨) scattered with CSS animation
  - Text: "Your pet evolved into a [Dragon]! 🐉"
  - TTS: speak the new stage name
- Overlay taps away

**Why it matters**: Evolution is currently invisible. Children hit 500 points and the emoji just silently changes. Making it a "moment" turns it into a memory.

**Effort**: Low-Medium (3–4 hours; reuse existing overlay pattern from WOTD)

---

### PHASE 2 — Retention Engine (est. 3–4 days after Phase 1)

---

#### Idea 5: Hunger / Energy System

**What it is**: The pet has a hunger meter (0–100). It loses hunger over time and is refilled by studying. The meter is displayed as a simple emoji-bar inside the pet card.

**Hunger decay**:
- Full (100) → stays full for 24h after studying
- Drops to 75 after 24h without study
- Drops to 50 after 48h
- Drops to 25 after 72h (pet looks very sad, new `starving` CSS class: eyes become 😢, sway is more dramatic)
- Drops to 0 after 96h (pet collapses — drooping eyes, red tint, "Please feed me!" bubble auto-shows on app open)

**Refill**:
- Complete 1 lesson → +40 hunger
- Complete daily challenge → +25 bonus hunger
- Complete SRS review → +20 hunger
- Caps at 100

**Display**:
- A row of 5 emoji hearts below the pet: `❤️❤️❤️🖤🖤` (filled = fed, empty = hungry)
- Or a CSS progress bar with food emoji label
- The `sleepy` mood class is replaced by a richer state system: `hungry`, `starving`, `full`

**Storage**: Add `petHunger` (number 0–100) and `petLastFed` (timestamp) to `appState`

**Migration**: On login for existing users, set `petHunger = 100` if `lastStudyDate === today`, else `50`

**Why it matters**: Hunger is the core Tamagotchi loop. It creates urgency without being punitive — the pet doesn't die, it just gets sad. The recovery feeling (going from starving to full after a lesson) is genuinely rewarding.

**Effort**: Medium (4–5 hours)

---

#### Idea 6: Accessories Earned by Studying

**What it is**: Kids earn cosmetic accessories for their pet by hitting study milestones. Accessories are displayed as emoji overlaid on the pet.

**Accessory unlock list**:

| Accessory | Unlock Condition | Display |
|-----------|-----------------|---------|
| 🎩 Top Hat | 5-day streak | Positioned above pet |
| 🕶️ Sunglasses | 10 lessons complete | Overlaid on pet |
| 🎀 Bow | 25 lessons complete | Positioned above-right |
| ⭐ Star Crown | 7-day streak | Positioned above |
| 🧣 Scarf | 50 lessons complete | Positioned below pet |
| 🌈 Rainbow aura | 100 lessons complete | CSS glow ring |
| 🔥 Flame halo | 30-day streak | Animated CSS ring |
| 💎 Diamond | 5000 points (Dragon stage) | Positioned below-right |

**Implementation**:
- `appState.petAccessories` — array of unlocked accessory IDs (e.g. `['hat', 'sunglasses']`)
- `appState.activeAccessories` — array of equipped IDs (max 3 equipped at once)
- On the pet card: a small "accessories" tray below the pet (3 slots shown) that the child can tap to equip/unequip
- Accessories rendered as absolutely-positioned emoji spans over the `.pet-creature` div
- Unlock check runs inside `unlockAchievement()` / after lesson completion (same hook pattern already used)
- Unlock triggers a toast + small celebratory animation

**Why it matters**: Dress-up is one of the most powerful engagement mechanics for kids aged 6–12. The combination of "earn by studying" + "visible customization" creates a tight loop. Accessories are visible proof of effort.

**Effort**: Medium (5–6 hours including the equip/unequip UI)

---

#### Idea 7: Daily Pet Quest

**What it is**: Each day the pet has a small quest shown in the pet card. Completing it gives bonus points and a hunger refill. Quests are study-activity based.

**Quest types (rotate daily via seeded random)**:
- "Complete 1 lesson today" → +20 pts, +30 hunger
- "Get 100% accuracy in a lesson" → +30 pts, +40 hunger
- "Review 5 words with SRS" → +20 pts, +30 hunger
- "Open the Word of the Day" → +10 pts, +20 hunger
- "Play Word Bubbles" → +20 pts, +30 hunger
- "Complete the Daily Challenge" → +25 pts, +35 hunger (stacks with DC reward)
- "Study 3 days in a row" → +40 pts, +50 hunger

**Display**: A small banner below the pet creature inside the pet card:
```
[Quest icon] Feed me! Complete 1 lesson today ✅
```
When complete, the banner turns green with a checkmark and the pet does a happy jump.

**Implementation**:
- Daily quest selected by `seededRandom('quest-' + dateStr)` picking from quest array
- Quest completion tracked in `appState.petQuest: { lastDate, questId, completed }`
- Quest completion hooks added to existing `recordStudy()`, `completeDailyChallenge()`, and lesson end flow — same as achievement hooks

**Why it matters**: Daily quests are the single most powerful retention mechanic in mobile gaming (see: every major mobile game from Clash of Clans to Duolingo). They give a specific, achievable goal for today and a reason to open the app even when the child "doesn't feel like studying."

**Effort**: Medium (4–5 hours)

---

## Consequences

### Positive
- The pet card goes from a passive decoration to an active companion with needs, personality, and visible growth
- Daily quest + hunger system creates a specific pull-back reason beyond "I should study"
- Accessories give concrete, collectible proof of study effort that kids can show others
- Phase 1 alone is a meaningful improvement; Phase 2 multiplies it
- All features are offline-safe and use existing localStorage infrastructure
- Milestone celebrations make evolution emotionally memorable

### Negative (Trade-offs Accepted)
- `appState` gains 4–5 new fields (`petName`, `petHunger`, `petLastFed`, `petAccessories`, `petQuest`) — minor storage overhead, fully backward-compatible with migration guards
- The pet card grows taller to accommodate hunger hearts, accessories tray, and quest banner — the home screen becomes slightly more scrollable on small phones
- Hunger system requires careful difficulty tuning to avoid either irrelevance (too slow decay) or anxiety (too fast decay)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hunger decay rate causes distress for kids who miss a few days | Medium | Medium | Cap decay at "very hungry" (not dead/gone); pet is always recoverable; add gentle language ("I missed you") not punitive language |
| Accessories tray clutters the UI on small screens | Medium | Low | Make tray a secondary "tap to see accessories" toggle rather than always-visible |
| Daily quest type doesn't match user's current state (e.g. asks for SRS review but user has 0 SRS words) | Medium | Low | Add eligibility check; fall back to "complete 1 lesson" quest as safe default |
| Phase 2 scope creep delays delivery | Low | Medium | Phase boundary is a hard cut; Phase 2 can be deferred without any Phase 1 rework |

---

## Implementation Guidance

### Phase 1 — Approach

1. **Habitat scene**: Add `.pet-scene` wrapper in `index.html` around `#petContainer`. Update `renderWordPet()` to inject stage-specific background CSS class and emoji decoration spans. Add time-of-day class to `.pet-scene` on render.

2. **Pet naming**: Add `petName` to `createDefaultUserData()`. In `renderWordPet()`, if `!appState.petName`, render inline input form. On submit, save and re-render.

3. **Phrases**: Replace the single `showPetSpeechBubble` call in `onPetTap()` with a weighted phrase selector. Define phrase arrays at top of `home.js`.

4. **Milestone celebration**: In `completeLessonFlow()` (or wherever points are applied and `renderHome()` is called), compute old stage before and new stage after. If different, call `showEvolutionCelebration(newStage)`. Use existing overlay pattern.

### Phase 2 — Approach

5. **Hunger system**: Add hunger fields to `createDefaultUserData()`. Write `computeCurrentHunger(appState)` as a pure function (reads `petLastFed` timestamp, applies decay). Call it in `renderWordPet()`. Hook `feedPet(amount)` into lesson completion, SRS review completion, and daily challenge completion.

6. **Accessories**: Add `petAccessories` and `activeAccessories` to state. Write `checkAccessoryUnlocks(appState)` called from existing `unlockAchievement()`. Render active accessories as positioned spans over pet emoji. Add collapsible accessories tray below pet (3 equip slots).

7. **Daily quest**: Add `petQuest` to state. Write `getDailyQuest(dateStr)` using seeded random. Render quest banner inside pet card. Add `checkQuestCompletion(questId)` calls to: `recordStudy()`, lesson end, daily challenge end, word-of-day viewed, word bubbles end, SRS session end.

### Key Considerations

- All new `appState` fields need migration guards at login (check `=== undefined`, then set default) — follow the pattern already used for `srs`, `streakShields`, `dailyChallenge`
- Hunger computation must be **pure and idempotent** — compute from stored timestamp at render time, do not use intervals or timers
- Phase 2 features should not show at all until the pet has a name (Phase 1) — gate on `appState.petName`
- Keep the pet card's total height under ~180px on mobile to avoid excessive scrolling push on the home screen
- CSS animations should respect `prefers-reduced-motion` — wrap keyframe animations in `@media (prefers-reduced-motion: no-preference)`

### Dependencies

- Phase 1 has no dependencies — can start immediately
- Phase 2 depends on Phase 1 (especially pet naming, which gates Phase 2 features)
- No external libraries, no build step changes

### Success Criteria

- [ ] Pet card visually shows a habitat environment matching the evolution stage
- [ ] Child can name their pet; name persists across sessions
- [ ] Pet tap shows contextual phrases (not just a word)
- [ ] Evolution triggers a visible celebration screen, not a silent re-render
- [ ] Hunger meter is visible and changes meaningfully based on study behaviour
- [ ] At least 3 accessories are earnable and visibly displayed on the pet
- [ ] Daily quest is shown and completable every day
- [ ] All features work fully offline
- [ ] No new network requests introduced
- [ ] Home screen load time does not increase measurably

---

## Open Questions

- [ ] Should the hunger meter be shown to parents as well (e.g. on a parent-mode view)? Could drive parental involvement.
- [ ] Should accessory unlocks be retroactive for existing users (they've already hit the milestones)? Recommendation: yes — grant all earned accessories on first migration so existing users feel immediately rewarded rather than locked out.
- [ ] Should daily quests be skippable? If a child cannot do SRS (no words yet), the fallback to "complete 1 lesson" handles it — but explicit skip with a cooldown (skip once per day) could reduce frustration.
- [ ] Is 96h the right "full collapse" threshold? Might need playtesting with actual children. Consider making it configurable via a constant.

---

## Handoff

### For @planner:

Create an implementation plan based on this decision. The plan should be split into two phases:

- **Phase 1** (Quick Wins): Habitat scene, pet naming, personality phrases, milestone celebration — target: 2–3 days
- **Phase 2** (Retention Engine): Hunger system, accessories, daily pet quest — target: 3–4 days after Phase 1 ships

Files to modify:
- `/Users/chuzon/go/src/learn-eng-pwa/js/home.js` (primary: `renderWordPet`, `onPetTap`, `getPetStage`, `getPetMood`)
- `/Users/chuzon/go/src/learn-eng-pwa/js/app.js` (`createDefaultUserData`, `recordStudy`, achievement hooks)
- `/Users/chuzon/go/src/learn-eng-pwa/css/styles.css` (pet section, new animations)
- `/Users/chuzon/go/src/learn-eng-pwa/index.html` (pet card HTML structure)

Command:
`"@planner create plan from docs/decisions/2026-03-05-word-pet-improvements-decision.md"`

---

*Decision document by brainstormer-agent on 2026-03-05*
