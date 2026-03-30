# Decision: Dog Level Progression — Harder, More Meaningful Leveling

> **Status**: Proposed
> **Date**: 2026-03-30
> **Author**: brainstormer-agent
> **Deciders**: Product owner

---

## Context

### Problem Statement

The virtual dog pet currently levels up too quickly. With 100 levels and the current XP formula (`2.5*(level-1)^2 + 10*(level-1)`), a consistent player earning ~140 XP/day from food purchases reaches max level (level 100) in approximately **174 days** — and could hit the first 3 dog evolutions (Chihuahua → Beagle → Poodle → Shiba) within the first **3–6 days**. This compresses what should be months of emotional investment into a few sessions, after which the progression system offers no long-term hook.

The goal is to make leveling feel meaningful, earned, and long-term — while keeping early levels approachable enough that kids feel progress in their first week.

### Measured Baseline (Current System)

**XP Formula**: `getPointsForLevel(l) = Math.floor(2.5*(l-1)^2 + 10*(l-1))`

| Milestone | Total XP Required | Approx. Days |
|-----------|------------------|--------------|
| Level 11 (Beagle) | 350 XP | ~2 days |
| Level 21 (Poodle) | 1,200 XP | ~8 days |
| Level 51 (Golden) | 6,750 XP | ~47 days |
| Level 91 (Diamond Dog) | 21,150 XP | ~143 days |
| Level 100 (MAX) | 25,492 XP | **~174 days** |

**XP Sources**:
- Bone: 5 XP / 5 coins
- Steak: 15 XP / 15 coins
- Chicken: 30 XP / 25 coins
- Cake: 50 XP / 40 coins
- Royal Feast: 120 XP / 80 coins (+ 30 bonus if studied today)
- Poop cleaning: 10 XP per poop
- Streak milestones: 30 + 60 + 100 + 200 + 300 + 500 = **1,190 XP total** (one-time)
- Daily quest completion: grants coins (indirectly funds food)

**Daily XP ceiling** (optimal play): ~140 XP/day from food + occasional poop XP

### Constraints

- **Tech**: Vanilla JS, no frameworks. One function change: `getPointsForLevel(level)` in `js/home.js` (line 701–703).
- **State migration**: Existing users have saved `dogGrowthXP` values. Any new curve must gracefully handle existing XP without losing progress or causing regressions.
- **10 dog stages**: `DOG_STAGES` array uses `minLevel` thresholds at 1, 11, 21, 31, 41, 51, 61, 71, 81, 91. Stage thresholds can be adjusted alongside the curve.
- **Kid audience (ages 6–14)**: Early levels MUST feel fast. Kids need a "win" in the first session and evolution milestones within the first week.
- **MAX_LEVEL reference**: Currently hardcoded as `100` in the progress bar render (`level >= 100 ? 'MAX LEVEL'`). Changing to 200 requires updating this constant.
- **No backend**: All state in localStorage. Migration must be additive (no data loss).

### Requirements

- **Must have**: Much longer time-to-max (target: 12–18 months of consistent daily play)
- **Must have**: Early levels still feel fast (first evolution within 3–5 days)
- **Must have**: Migration-safe (existing XP values map gracefully to new levels)
- **Should have**: Steeper curve in late levels so Diamond Dog / Royal Hound feel prestigious
- **Should have**: Minimal code changes (ideally just the formula)
- **Nice to have**: Curve shape that "accelerates" difficulty — level 50 feels noticeably harder than level 20

---

## Options Considered

### Option A: Steeper Quadratic (3x Multiplier, 100 Levels)

**Description**: Multiply the existing quadratic formula by 3. New formula: `Math.floor(7.5*(level-1)^2 + 30*(level-1))`. Keeps 100 levels, keeps all stage thresholds at 1/11/21/.../91. The only change is the two constants in `getPointsForLevel`.

**Key Numbers**:
| Level | XP Required (total) | Days to Reach |
|-------|---------------------|---------------|
| 11 (Beagle) | 1,050 XP | ~0 days (streak bonus covers this) |
| 21 (Poodle) | 3,600 XP | ~18 days |
| 51 (Golden) | 20,250 XP | ~137 days |
| 91 (Diamond Dog) | 63,450 XP | ~445 days |
| 100 (MAX) | 76,477 XP | **~538 days (~18 months)** |

Per-level XP cost at level 50: ~750 XP. At level 100: ~1,500 XP.

**Migration**: Existing users with 25,492 XP (old max) would land at level ~66 on the new curve. A user who grinded to max resets to upper-mid tier — potentially frustrating.

**Pros**:
- Single-line formula change, zero new logic
- Keeps 10 familiar stages at familiar level numbers
- 538 days to max is solidly in the 12–18 month target
- Early levels still fast (Chihuahua → Beagle with just streak XP)

**Cons**:
- Migration pain: dedicated users lose perceived progress (max → level 66)
- Quadratic still feels predictable — no "wall" at high levels
- No new motivational hooks, just slower same loop

**Effort**: Very Low (2 number changes)
**Risk**: Medium (migration disappointment for existing max-level users)

---

### Option B: Exponential XP Curve (100 Levels)

**Description**: Replace the quadratic with a true exponential: each level costs 20% more XP than the previous. Per-level cost: `Math.floor(40 * 1.18^(level-1))`. Cumulative XP is the sum of these.

**Key Numbers** (with `40 * 1.18^(n-1)` per level):
| Level | Total XP | Days |
|-------|----------|------|
| 11 | ~700 XP | ~5 days |
| 21 | ~3,900 XP | ~20 days |
| 51 | ~130,000 XP | ~920 days |
| 100 | ~25,000,000 XP | ~180,000 days (astronomically long) |

The exponential hits an "impossible" wall. By level 60–70, a single level costs more XP than a player could earn in a year. This is not engaging — it is discouraging.

**Pros**:
- Mathematically elegant
- Late levels feel genuinely impossible to reach (prestige feel)

**Cons**:
- Level 60+ becomes unreachable even for dedicated users — breaks the contract that "play = progress"
- No one ever reaches Diamond Dog or Royal Hound
- Kids will feel the game is broken, not challenging
- Can't easily tune without breaking early/late balance simultaneously

**Effort**: Low (formula change)
**Risk**: Very High (progression breaks entirely past level 50)

**Verdict**: Rejected. Exponential curves only work in games with additional income multipliers (prestige bonuses, etc.) that this app does not have.

---

### Option C: Prestige / Evolution System (Evolve and Reset)

**Description**: After reaching level 100, the dog "ascends" into a prestige form, resets to level 1 with a permanent "+10% XP gain" bonus, and the player earns a unique prestige badge/title. A dog can prestige up to 5 times. Each prestige requires harder XP to re-reach level 100 (current curve * prestige multiplier).

**Implementation**:
- New state field: `appState.dogPrestige` (0–5)
- `getPointsForLevel` uses prestige multiplier: `currentFormula * (1 + 0.5 * prestige)`
- Prestige 0: same as current (174 days)
- Prestige 1: 1.5x curve (~261 days per cycle)
- Prestige 5: 3.5x curve (~609 days per cycle)
- Total for all 5 prestiges: ~1,700+ days of content

New visual rewards: prestige crown overlays, special speech bubbles, unique titles ("Veteran Dog", "Elder Champion", etc.)

**Pros**:
- Essentially infinite long-term content
- Prestige is a proven mechanic in mobile games (Clash of Clans, etc.)
- Existing max-level users get a natural "what's next" answer
- The dog always stays meaningful — no "done forever" state

**Cons**:
- **Significant new logic**: prestige state, prestige multiplier, prestige UI overlay, prestige celebration
- Resetting to level 1 can feel punishing to kids even with rewards ("my dog got small again!")
- More complex than the core feature needs to be at this stage
- Risk: kids don't understand why their powerful dog "shrank" — needs very clear UI/messaging

**Effort**: Medium-High (new state field, new UI overlay, multiplier math)
**Risk**: Medium (UX confusion risk with reset mechanic for young users)

---

### Option D: Expand to 200 Levels with Steeper Curve (Recommended Hybrid)

**Description**: Expand `MAX_LEVEL` from 100 to 200. Double the number of dog stages to 20 (one evolution every 10 levels). Use a tuned quadratic formula that is ~3x harder than current per level: `Math.floor(3*(level-1)^2 + 15*(level-1))`.

**Key Numbers**:
| Level | Total XP | Approx. Days |
|-------|----------|--------------|
| 11 | 480 XP | ~3 days |
| 21 | 1,500 XP | ~10 days |
| 51 | 7,938 XP | ~50 days |
| 101 | 31,500 XP | ~217 days |
| 151 | 69,900 XP | ~491 days |
| 200 (MAX) | 121,788 XP | **~862 days (~2.4 years)** |

Per-level XP cost at level 50: 306 XP. At level 100: 606 XP. At level 200: 1,206 XP.

**Migration**: A user at old max XP (25,492 XP) would land at level ~92 on the new curve — they retain their perceived "elite" status and still have 108 levels left to explore. This is the most migration-friendly option.

**Stage expansions needed** (currently 10 stages): Expand `DOG_STAGES` to 20 entries by adding new dog breeds, or sub-stages (e.g., "Beagle Puppy" → "Beagle Adult" → "Beagle Elder"). Alternatively, keep 10 stages but space them at every 20 levels instead of every 10.

**Minimum viable approach** (keeping 10 stages): Adjust `minLevel` thresholds to `[1, 21, 41, 61, 81, 101, 121, 141, 161, 181]`. Same 10 breeds, just spaced further apart. One `MAX_LEVEL` constant change in the render code.

**Pros**:
- No migration pain: existing max-level users land at ~level 92, feel properly rewarded
- Early levels remain fast and motivating (first stage at day 3)
- Late game is genuinely long — 2+ years of daily play to max
- Steeper late curve: each stage evolution in the 160s+ costs 10,000+ XP between thresholds
- Low code complexity: change formula constants + MAX_LEVEL + stage thresholds
- No new state fields needed

**Cons**:
- 200 levels requires either 20 dog breeds/stages or stages every 20 levels (slightly less frequent evolution rewards)
- Progress bar label changes from "MAX LEVEL" to rendering properly at 200
- Slightly more code change than pure Option A

**Effort**: Low (formula + 2 constants + stage threshold adjustment)
**Risk**: Low

---

## Comparison Matrix

| Criteria | Option A (3x, 100 lvl) | Option B (Exponential) | Option C (Prestige) | Option D (200 lvl, hybrid) |
|----------|----------------------|----------------------|---------------------|---------------------------|
| Fun / Longevity | 3/5 | 1/5 | 5/5 | 4/5 |
| Migration Friendliness | 2/5 | 3/5 | 4/5 | 5/5 |
| Implementation Effort | 5/5 | 4/5 | 2/5 | 4/5 |
| Early Game Feel | 4/5 | 3/5 | 4/5 | 5/5 |
| Late Game Prestige | 3/5 | 1/5 | 5/5 | 4/5 |
| Risk | 4/5 | 1/5 | 3/5 | 5/5 |
| **Total** | **21** | **13** | **23** | **27** |

---

## Decision

**Chosen**: Option D — 200 Levels with Steeper Quadratic Curve

**Rationale**:

Option D wins decisively on migration friendliness (the single biggest practical concern — dedicated users who are at max level today land at level ~92, not level 66) while delivering a 2.4-year progression arc for truly committed players. The implementation is small: two constants in `getPointsForLevel`, the `MAX_LEVEL` sentinel (currently hardcoded as `100` in the XP bar render), and the stage `minLevel` thresholds in `DOG_STAGES`.

Option C (Prestige) was close on fun potential but carries meaningful UX risk for kids (seeing their dog "shrink" after prestige), requires new state fields and new UI, and is premature complexity for the current stage of the app. It remains viable as a future enhancement *on top of* Option D if the user base demands it.

Option A is the simplest path but wastes the opportunity to keep existing power users engaged — they'd drop from level 100 to level 66 on day one of the update.

Option B (exponential) is rejected outright. A pure exponential curve without income multipliers becomes astronomically impossible by level 60–70 and is not appropriate for a kids' learning app.

---

## Consequences

### Positive
- Existing max-level users retain elite status (~level 92 out of 200) and see a clear horizon ahead
- New users experience a 2+ year progression arc
- Dog stages at level 181+ (Diamond Dog territory) become genuinely prestigious and rare
- Minimal code surface area — one formula, one constant, one stage array

### Negative (Trade-offs Accepted)
- Dog stages now transition every 20 levels instead of every 10 — slightly less frequent evolution moments
- "MAX LEVEL" is reached later; power users won't get the dopamine of max for much longer (this is the intent)
- Very casual users may never see high dog stages — acceptable, as this is aspirational content

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing users feel penalized | Low | High | Users at old max (25,492 XP) land at level ~92/200 — clearly elite, with upside remaining |
| Migration bug — XP maps to wrong level | Low | Medium | `getDogLevel()` loop already iterates 1–N checking thresholds; expanding N to 200 is automatic |
| Kids feel max is "too far away" | Medium | Medium | First evolution stays fast (day 3); show level-up celebrations frequently in early levels |
| MAX_LEVEL hardcoded in other places | Low | Low | Grep for `>= 100` and `=== 100` checks in XP bar code; two known occurrences in `home.js` |

---

## Implementation Guidance

### Approach

**Step 1**: Update `getPointsForLevel` formula (1 line)
```js
// OLD
return Math.floor(2.5 * Math.pow(level - 1, 2) + 10 * (level - 1));

// NEW
return Math.floor(3 * Math.pow(level - 1, 2) + 15 * (level - 1));
```

**Step 2**: Update `getDogLevel` loop ceiling (1 number)
```js
// OLD
for (let l = 100; l >= 1; l--) {

// NEW
for (let l = 200; l >= 1; l--) {
```

**Step 3**: Update XP bar render — MAX_LEVEL sentinel (2 occurrences in `home.js`)
```js
// OLD (line ~885, ~1003)
const nextLevelXP = level < 100 ? getPointsForLevel(level + 1) : currentLevelXP;
const xpPercent = level >= 100 ? 100 : ...
// ...label...
level >= 100 ? 'MAX LEVEL' : `${xpInLevel}/${xpNeeded} XP`

// NEW
const nextLevelXP = level < 200 ? getPointsForLevel(level + 1) : currentLevelXP;
const xpPercent = level >= 200 ? 100 : ...
level >= 200 ? 'MAX LEVEL' : `${xpInLevel}/${xpNeeded} XP`
```

**Step 4**: Update `DOG_STAGES` `minLevel` thresholds — spread 10 stages across 200 levels
```js
// OLD (stages every 10 levels)
{ minLevel: 1  ... },  // Chihuahua
{ minLevel: 11 ... },  // Beagle
{ minLevel: 21 ... },  // Poodle
// ...
{ minLevel: 91 ... },  // Diamond Dog

// NEW (stages every 20 levels)
{ minLevel: 1   ... },  // Chihuahua
{ minLevel: 21  ... },  // Beagle
{ minLevel: 41  ... },  // Poodle
{ minLevel: 61  ... },  // Shiba
{ minLevel: 81  ... },  // Husky
{ minLevel: 101 ... },  // Golden
{ minLevel: 121 ... },  // Border Collie
{ minLevel: 141 ... },  // German Shepherd
{ minLevel: 161 ... },  // Royal Hound
{ minLevel: 181 ... },  // Diamond Dog
```

**Step 5** (optional enhancement): Update pet info overlay to show `/200` in the stage display and re-label the stages grid title.

**Step 6**: No data migration needed. `dogGrowthXP` values are preserved. The `getDogLevel()` function recomputes level from raw XP on every call.

### Key Considerations

- The `getDogLevel` function loops from max down to 1 and returns the first level where `xp >= getPointsForLevel(l)`. Extending from 100 to 200 iterations is O(200) — negligible.
- The decay system (`applyGrowthDecay`) uses a percentage-based decay (2%/day), so it automatically scales with the new XP magnitudes. No change needed.
- The poop clean XP (10 XP) and streak milestone XP (30–500 XP) remain meaningful at the new scale. They are small but consistent contributors — no tuning needed.
- Food XP values (5, 15, 30, 50, 120) remain unchanged. They are the primary XP source and the difficulty increase comes purely from the curve, not reduced rewards.
- The pet info overlay (`showPetInfo`) uses `DOG_STAGES.map(s => ...)` to render all stages — it automatically reflects updated `minLevel` values.

### Dependencies

- None. This is self-contained in `js/home.js`.
- No new npm packages, no new image assets, no new state fields.

### Success Criteria

- [ ] A new user reaches Beagle (first evolution) within 3–7 days of consistent play
- [ ] Level 100/200 (halfway) requires approximately 6 months of daily play
- [ ] Level 200 (MAX) requires approximately 18–24 months of daily play
- [ ] Existing user with 25,492 XP (old max) sees their level displayed as ~92/200
- [ ] XP bar and "MAX LEVEL" label render correctly at level 200
- [ ] `getDogLevel(25492)` returns ~92 with new curve
- [ ] No visual regression on pet hero zone, shop overlay, or pet info overlay
- [ ] Decay system still applies correctly (percentage-based, no formula dependency)

---

## Open Questions

- [ ] Should stage names be updated to reflect the longer journey? (e.g., "Diamond Dog" at level 181 feels more earned than at level 91 — no label change needed, but worth noting)
- [ ] Should a future update add 10 more dog stages (one every 20 levels) to fill out the 200-level arc with more evolution moments? Deferred to future enhancement.
- [ ] Should the prestige system (Option C) be revisited after 200-level content is shipped? Recommended: revisit when the first users approach level 180+.

---

## Handoff

### For @planner:
Create implementation plan based on this decision.

The change is small: 4 targeted edits to `js/home.js` (formula constants, loop ceiling, two XP bar sentinels, stage `minLevel` thresholds). No new files, no new state, no migration logic.

Command:
`"@planner create plan from docs/decisions/2026-03-30-dog-level-progression-decision.md"`

---

*Decision document by brainstormer-agent on 2026-03-30*
