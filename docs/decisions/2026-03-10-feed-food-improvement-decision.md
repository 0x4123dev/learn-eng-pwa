# Decision: Feed Food Feature Improvement

> **Status**: Proposed
> **Date**: 2026-03-10
> **Author**: brainstormer-agent
> **Deciders**: Product owner

---

## Context

### Problem Statement

The current food-feeding mechanic is a flat transaction: spend coins, receive growth XP, see a toast message. There is no strategy, no visual payoff, no daily reason to come back and feed, and no connection to the English learning mission. The hunger system exists in the data model but is invisible to the user. This means one of the most natural "daily return" mechanics in pet games is going completely to waste.

The dog is intended to be the emotional engine of FlashLingo — the reason a learner opens the app every day. Right now, feeding does not earn its weight in that mission.

### Constraints

- **Tech**: Vanilla JS, no frameworks. All logic lives in `js/home.js`. All styles in `css/styles.css`. Must be consistent with existing architecture.
- **State**: User data stored in `localStorage` via `saveUserData()`/`getUserData()`. No server-side state.
- **Existing systems to preserve**: `DOG_FOOD`, `buyFood()`, `applyGrowthDecay()`, `computeCurrentHunger()`, `HUNGER_DECAY_SCHEDULE`, `PET_QUESTS`, daily quest infrastructure. Do not break these.
- **Performance**: Mobile-first. Any animations must use only `transform` and `opacity`. Will-change budget is already near-full from pet animations.
- **Scope**: Do not add server calls, databases, or new tabs. Improvements must live within the existing PWA shell.

### Requirements

- **Must have**: Visual feedback when feeding (the dog must visibly react). Hunger must be visible to the user (it currently runs silently). A daily reason to feed (engagement loop). Connection between food and learning.
- **Should have**: More food variety or discovery. Some strategic depth (not just "buy the most expensive item every time"). Animated food delivery to the dog.
- **Nice to have**: Food combo bonuses. Themed food tied to dog breed/stage. Cooking or crafting. Food-related vocabulary teaching.

---

## Options Considered

### Option A: Visible Hunger + Animated Feeding

**Description**: Surface the hidden hunger system to the user. Show hunger hearts (or a meter) in the hero zone HUD. Animate food flying from the shop button to the dog's mouth when bought. The dog plays a distinct "eating" animation. Hunger decays visibly day by day, creating a daily pull.

The existing `computeCurrentHunger()` already calculates a 0-100 value on a 4-step schedule (0, 25, 50, 75, 100). Render this as 5 heart icons in the HUD. When the user taps "buy food," a food emoji animates in an arc from the shop button to the dog (using Web Animations API, same pattern as the coin-fly animation already researched). The dog plays a `petEat` CSS class that causes a brief head-bob or chomp.

No new data structures needed. `buyFood()` already calls `feedPet()` and `appState.petLastFed = Date.now()`. Only rendering changes are required.

**Pros**:
- Closes the feedback loop: user sees hunger, user feeds, user sees hunger refill
- Daily pull: hunger decays, user must return to feed
- Highest emotional impact per line of code — the dog "eating" is intrinsically delightful
- Zero new state fields required; works on existing `petLastFed` and `computeCurrentHunger()`
- Direct reading connection: hunger falls when not studying, feeding requires coins earned from lessons

**Cons**:
- Hunger hearts add UI real estate to the already-busy hero topbar (solvable: render below XP bar, or as overlay near the dog)
- The current decay schedule (0% at < 24h, max decay at 96h) is quite forgiving — may need tuning to feel urgent enough

**Effort**: Low. CSS animation for eating + hearts rendering in `renderWordPet()`. Approximately 60 lines of JS + 40 lines of CSS.
**Risk**: Low. Purely additive — no existing behavior changes, only new rendering.

---

### Option B: Food Mood Multiplier (Strategy Layer)

**Description**: Different food types give different XP-per-coin efficiency ratios AND mood bonuses. Feeding the right food at the right hunger level gives a multiplier. This adds the missing strategic depth.

Example rules:
- Bone (5 coins, 5 XP): Always 1:1. "Maintenance" food.
- Steak (15 coins, 15 XP → becomes 20 XP when hunger < 50%): "Efficient when hungry" food.
- Chicken (25 coins, 30 XP → +10 XP if dog is in `happy` mood): "Reward" food.
- Cake (40 coins, 50 XP → doubles to 100 XP once per day): "Daily special" food.
- Royal Feast (80 coins, 120 XP → 150 XP if purchased after completing a lesson today): "Study reward" food.

The Royal Feast bonus directly ties expensive food to completing lessons — which is the core loop.

**Pros**:
- Adds genuine strategy: "should I feed cake now or wait until I'm hungry?"
- Royal Feast bonus is a direct learning-to-feeding loop
- Extends replay value of the shop significantly
- Makes cheaper food occasionally smarter than expensive food

**Cons**:
- Mood-conditional bonuses require UI communication (tooltip or hint) — user must know the rules to benefit
- Adds conditional logic to `buyFood()` — moderate complexity, but manageable
- Risk of confusing casual users who just want to tap and feed

**Effort**: Medium. Logic changes to `buyFood()`, new helper `getFoodBonus(food, mood, hunger)`, UI hints in the shop. Approximately 80 lines of JS + 30 lines of CSS.
**Risk**: Low-Medium. Logic is self-contained in `buyFood()`. Worst case: bonuses are ignored and it works like current system.

---

### Option C: Daily Food Rotation (Discovery Loop)

**Description**: One food item is "featured" each day, randomly seeded by date (like `getDailyQuest()` already does). The featured food is marked with a star in the shop and costs 20% less or gives 30% bonus XP that day only. This creates a daily reason to open the shop — "what's the deal today?"

Extend this with a "new food" discovery mechanic: after reaching certain levels or completing streaks, new specialty foods unlock (e.g., "Sushi 🍣" at Level 30, "Truffle Burger 🍔" at Level 50). Each new food has a unique effect not available on base foods.

**Pros**:
- Daily rotation creates a strong "check-in" habit (proven by Duolingo streaks, Neko Atsume rotation, Daily Deals in every mobile game)
- Level-gated food gives long-term players new things to discover
- No new economy complexity — just one item temporarily cheaper/better
- Seeded RNG means the deal is the same for all users on a given day (consistent, can be mentioned socially)

**Cons**:
- 5 foods is a very thin rotation — with only 5 items, the daily deal feels thin (need 8-10 foods for this to feel rich)
- Locked foods at high levels mean new users see locked content in the shop — requires careful UI treatment (show as "locked" not "hidden")
- Slightly more complex state (need to track which specialty foods are unlocked per user)

**Effort**: Medium. Daily featured food logic (seeded RNG), locked food rendering in shop, new food data entries. Approximately 100 lines of JS + 40 lines of CSS.
**Risk**: Low. Purely additive. Existing food items unaffected.

---

### Option D: Vocabulary-Gated Premium Foods (Learning Connector)

**Description**: Certain premium foods are "unlocked" by completing vocabulary milestones. For example: "Gourmet Treat 🧆" unlocks after mastering 50 SRS words. "Brain Food 🧠" unlocks after completing 20 lessons. Each unlocked food has a name tied to a vocabulary theme.

When a food item is unlocked, the dog's speech bubble says: "You learned so much — I can eat well tonight! 🎉"

The shop displays locked premium foods grayed out with the unlock condition ("Learn 50 words to unlock"). This makes vocabulary mastery directly visible in the pet economy.

**Pros**:
- Strongest possible learning-to-feeding connection — feeding IS learning progress
- Unlocked foods feel like genuine rewards; makes vocabulary milestones tangible
- Teaches vocabulary incidentally: food names like "Truffle", "Gourmet", "Cuisine" are real IELTS vocabulary
- "Your dog is hungry — complete a lesson to unlock better food" is a powerful motivational hook

**Cons**:
- Requires new data model: foods with `unlockCondition` fields, plus a function to evaluate unlock state
- Locked items in the shop can feel frustrating for new users with < 5 lessons completed
- Vocabulary milestone tracking already exists (SRS count, lesson count) but needs to be threaded into food unlock checks
- Adds complexity to shop rendering (locked state, unlock progress display)

**Effort**: Medium-High. New data model for premium foods, `checkFoodUnlocks()` function, locked-state shop UI, speech bubble integration. Approximately 150 lines of JS + 50 lines of CSS.
**Risk**: Medium. Changes food data model and `buyFood()` guard logic.

---

### Option E: Drag-to-Feed (Physical Interaction)

**Description**: Replace the "tap to buy in shop, dog gets XP silently" with a direct drag-from-shop-to-dog interaction. User opens shop, drags a food item toward the dog image. When the food item is dropped on the dog, the dog opens its mouth and "catches" the food. Purchase is confirmed on drop.

This is the "Pou/My Talking Tom" feeding pattern — the most emotionally engaging feeding mechanic in mobile pet games.

**Pros**:
- Maximum delight factor: dragging food to the dog's mouth is the single most satisfying pet interaction possible
- Creates a physical, embodied connection between player and pet
- Completely unique to this app — no competitor language app does this
- Dog's animated "mouth open to catch food" creates an iconic moment

**Cons**:
- Significant implementation complexity: touch drag events, collision detection with dog bounding box, mouth-open animation triggered by proximity
- Requires the shop to either be an overlay (current) that shows the dog behind it, or a side-panel layout redesign
- High risk of UX confusion: user may not know they need to drag (vs. tap)
- The current shop is a modal overlay that covers the dog — would need a layout restructure to make drag-to-dog possible
- Touch drag can interfere with scroll behavior on mobile

**Effort**: High. Touch drag implementation, proximity detection, modal layout restructure, eating animation with mouth-open state. Approximately 300+ lines of JS + 100+ lines of CSS.
**Risk**: High. Major UX pattern change. Could confuse users. Would likely need a tutorial overlay.

---

## Comparison Matrix

| Criteria | A: Hunger Visible | B: Mood Multiplier | C: Daily Rotation | D: Vocab-Gated | E: Drag-to-Feed |
|----------|-------------------|--------------------|--------------------|----------------|-----------------|
| Fun Factor | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Learning Connection | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Retention Impact | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Implementation Effort | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| Risk | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Total** | **22** | **17** | **17** | **17** | **11** |

(5 stars = best/easiest/lowest risk)

---

## Decision

**Chosen**: Option A + B in combination, with Option C's daily rotation as a follow-up.

**Phase 1 (implement now)**: Option A — Visible Hunger + Animated Feeding
**Phase 2 (add in same sprint)**: Option B — Food Mood Multiplier (the Royal Feast learning bonus specifically)

**Rationale**:

Option A wins decisively on the criteria that matter most for this project: retention impact and implementation effort. The hunger system already exists, fully functional, behind the scenes. Surfacing it is the highest-ROI change available. The dog "eating" animation is the single most iconic missing interaction — every successful pet app (Pou, Tamagotchi, My Talking Tom) treats eating as the central physical loop. Adding 5 hunger hearts and a food-arc animation transforms feeding from a shop transaction into a relational act.

Option B's Royal Feast bonus (specifically: +30 bonus XP when purchased after completing a lesson today) is low-complexity but creates the strongest learning-to-feeding feedback arc available without restructuring the data model. The user's behavior becomes: complete lesson → earn coins → feed Royal Feast → maximum XP growth. That three-step loop is the entire game design goal of FlashLingo compressed into a feeding decision. The other multipliers (steak when hungry, chicken when happy) add strategic texture without requiring tutorials.

Option E (drag-to-feed) is the most delightful idea but is 5x the implementation complexity with the highest risk of mobile UX failure. It should be considered for a later major version, not this sprint. The layout restructure alone (making the dog visible behind the shop) is a significant project.

Option D (vocab-gated foods) is the strongest learning connector but adds friction for new users. It is better suited as a v2 expansion after Options A+B establish the feeding habit.

Option C (daily rotation) is straightforward and will be done after A+B since the rotation requires more than 5 food items to feel meaningful.

---

## Consequences

### Positive
- Hunger hearts give users a concrete daily task: "feed my dog before it hits 0 hearts"
- The food-arc animation and eating reaction will be the most emotionally engaging moment in the app since level-up celebrations
- Royal Feast lesson bonus creates a direct study → feed → grow loop that reinforces the app's core value proposition
- Hunger visibility makes the hidden decay mechanic (2% XP loss per missed day) feel fair and understandable rather than mysterious

### Negative (Trade-offs Accepted)
- Hero topbar HUD becomes slightly more complex with hunger hearts; must be rendered carefully to avoid clutter
- The conditional bonus logic in `buyFood()` adds ~25 lines of logic that must be tested across mood/hunger states

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hunger hearts clutter the HUD | Medium | Low | Render below XP bar (not in topbar), 5 small hearts at 16px — minimal space |
| Eating animation conflicts with existing pet animations | Low | Medium | Use `classList.add/remove` pattern already used for `pet-tapped`, `wiggle` — not simultaneous |
| Royal Feast bonus is ignored by users who don't read shop descriptions | Medium | Low | Speech bubble on purchase: "Delicious after studying! Bonus XP! 🌟" |
| Hunger urgency feels punishing to casual users | Low | Medium | Keep decay schedule forgiving (current 24h grace period is appropriate); frame as "reward to feed" not "punishment for not feeding" |

---

## Implementation Guidance

### Approach

**Step 1: Render Hunger Hearts in the Hero Zone**

In `renderWordPet()`, after the XP bar block, add a hunger hearts display. Use `computeCurrentHunger(appState)` which returns 0-100. Map to 0-5 hearts: `heartCount = Math.ceil(hunger / 20)`.

Render below the XP bar or as a small row at the bottom of `xpbar_el`. Use full heart (❤️) for filled, empty heart (🤍) for unfilled. Only show when `appState.petName` exists (not during naming prompt).

```js
const heartCount = Math.ceil(computeCurrentHunger(appState) / 20);
const heartsHTML = Array.from({length: 5}, (_, i) =>
    `<span class="hunger-heart ${i < heartCount ? 'full' : 'empty'}">${i < heartCount ? '❤️' : '🤍'}</span>`
).join('');
```

**Step 2: Food Arc Animation on Purchase**

In `buyFood()`, after state changes and before `refreshShop()`, fire the food animation. The food emoji flies in an arc from the shop button (`.pet-shop-btn-hero`) to the dog (`.pet-creature`).

Use Web Animations API (same pattern as coin-fly in research doc Finding 4):

```js
function animateFoodTodog(foodEmoji) {
    const shopBtn = document.querySelector('.pet-shop-btn-hero');
    const petCreature = document.querySelector('.pet-creature');
    if (!shopBtn || !petCreature) return;

    const srcRect = shopBtn.getBoundingClientRect();
    const dstRect = petCreature.getBoundingClientRect();

    const food = document.createElement('div');
    food.textContent = foodEmoji;
    food.style.cssText = `
        position: fixed;
        font-size: 28px;
        left: ${srcRect.left + srcRect.width / 2}px;
        top: ${srcRect.top + srcRect.height / 2}px;
        pointer-events: none;
        z-index: 1000;
        will-change: transform;
    `;
    document.body.appendChild(food);

    const tx = dstRect.left + dstRect.width / 2 - srcRect.left - srcRect.width / 2;
    const ty = dstRect.top + dstRect.height / 2 - srcRect.top - srcRect.height / 2;

    food.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx * 0.4}px), calc(-50% + ${ty * 0.2 - 60}px)) scale(1.3)`, offset: 0.45 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0.4)`, opacity: 0 }
    ], {
        duration: 650,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        fill: 'forwards'
    }).finished.then(() => food.remove());
}
```

**Step 3: Dog Eating Animation**

Add CSS class `pet-eating` that plays a chomp/head-bob animation. Apply for 800ms after food arc arrives (match the 650ms arc duration).

```css
@keyframes petChomp {
    0%   { transform: scale(1) rotate(0deg); }
    25%  { transform: scale(1.08) rotate(-4deg); }
    50%  { transform: scale(1.12) rotate(4deg); }
    75%  { transform: scale(1.05) rotate(-2deg); }
    100% { transform: scale(1) rotate(0deg); }
}
.pet-creature.pet-eating {
    animation: petChomp 0.5s ease-in-out forwards;
}
```

In `buyFood()`:
```js
setTimeout(() => {
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        creature.classList.add('pet-eating');
        setTimeout(() => creature.classList.remove('pet-eating'), 500);
    }
}, 650); // matches arc duration
```

**Step 4: Royal Feast Lesson Bonus (Option B)**

In `buyFood()`, detect whether the user studied today. If `food.id === 'feast'` and `appState.lastStudyDate === new Date().toDateString()`, grant +30 bonus XP and show a special toast.

```js
let bonusXP = 0;
if (food.id === 'feast') {
    const today = new Date().toDateString();
    if (appState.lastStudyDate === today) {
        bonusXP = 30;
    }
}
appState.dogGrowthXP = (appState.dogGrowthXP || 0) + food.growth + bonusXP;
// ...
const bonusText = bonusXP > 0 ? ` (+${bonusXP} study bonus!)` : '';
showToast(`${food.emoji} +${food.growth + bonusXP} growth XP!${bonusText}`);
```

Also add a hint in the shop item description for Royal Feast: change `+${f.growth} growth XP` to `+${f.growth} XP${appState.lastStudyDate === today ? ' +30 STUDY BONUS' : ' (study today for +30 bonus)'}`.

**Step 5: Update hunger text in dog speech bubbles**

Replace the current catch-all "I'm so hungry… buy me food! 😢" message with tiered messages matching the hearts display:
- 0 hearts: "I'm starving! Feed me now! 😢" (existing behavior, keep)
- 1 heart: "I'm really hungry… 🥺" (triggered by `hunger <= 20` in `renderWordPet`)
- 2 hearts: Already handled by `PET_PHRASES.hungry` — no change needed

### Key Considerations

1. The hunger hearts must render even when the user is just opening the app and not interacting with the shop. They live in `renderWordPet()` which fires on tab switch and after every action.

2. The food arc animation targets `.pet-shop-btn-hero` as the source. That button is rendered inside `stage_el.innerHTML` in `renderWordPet()`. It will always exist on the DOM when `buyFood()` is called (since the shop is only accessible after the pet is rendered). No null-guard concerns.

3. The `pet-eating` animation must not override the `pet-tapped` or `wiggle` class animations. Since they are applied to the same element (`classList.add`), the most recently added class wins. This is acceptable — eating cancels tap-squish which is the correct priority.

4. The Royal Feast bonus description in the shop must use a closure-captured `today` variable, not rely on global scope. Check `appState.lastStudyDate` at render time inside `renderShopContent()`.

5. Hunger hearts should not appear during the naming prompt (the `if (!appState.petName) return;` guard in `renderWordPet()` already handles this — hearts are added after that guard).

### Dependencies

- Existing `computeCurrentHunger()` function must remain unchanged (Option A depends on it)
- `buyFood()` refactor must preserve all existing behavior (coins deducted, XP added, hunger reset, level-up check)
- Web Animations API is already used in the codebase (confirmed in research) — no polyfill needed

### Success Criteria

- [ ] 5 hunger hearts visible in pet hero zone below the XP bar
- [ ] Hearts update immediately after feeding (hunger reaches 100%, all 5 hearts filled)
- [ ] Hearts decay visibly across sessions (0 hearts after 96h without feeding)
- [ ] Food emoji flies in visible arc from shop button to dog when any food is purchased
- [ ] Dog plays eating animation (chomp) that is visually distinct from tap-squish
- [ ] Royal Feast shows "+30 STUDY BONUS" in shop description when user has studied today
- [ ] Royal Feast grants bonus XP reflected in toast and XP bar update
- [ ] No regression in existing level-up celebration, accessory equipping, or quest completion flows

---

## Open Questions

- [ ] Should hunger hearts appear in the hero topbar (next to level/coins) or below the XP bar? Below XP bar is less cluttered but requires the user to look at the bottom of the hero zone. Recommend below XP bar as a first implementation and adjust based on feedback.
- [ ] Should the "steak when hungry" and "chicken when happy" bonuses from Option B also be implemented, or only the Royal Feast bonus? Recommendation: start with Royal Feast only (it has the clearest purpose) and add the others in a follow-up if the mechanic tests well.
- [ ] Should the eating animation vary by food (bigger chomp for steak, happy spin for cake)? This would be delightful but adds complexity. Not needed for v1.
- [ ] After Option A ships, evaluate whether the 24-hour hunger grace period needs tightening. Current schedule (100% at 0h, 75% at 24h, 50% at 48h, 25% at 72h, 0% at 96h) is appropriate for casual learners — probably keep as-is.

---

## Handoff

### For @planner:

Create implementation plan based on this decision. The work is cleanly separated into 5 implementation steps above. Key files:

- Primary: `/js/home.js` — `renderWordPet()`, `buyFood()`, `renderShopContent()`
- Secondary: `/css/styles.css` — `.pet-eating`, `.hunger-heart`, `.hunger-hearts` CSS additions

The steps can be executed in order (1 through 5) with each step independently testable. Steps 1-3 (hunger hearts + food arc + eating animation) form a self-contained "Phase 1" that can ship independently of steps 4-5 (Royal Feast bonus).

Command:
"@planner create plan from docs/decisions/2026-03-10-feed-food-improvement-decision.md"

---

*Decision document by brainstormer-agent on 2026-03-10*
