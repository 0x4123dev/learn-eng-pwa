# Decision: Word Topic Classification Across All Levels

**Date:** 2026-04-27
**Status:** 🟡 Brainstorming — awaiting user pick

---

## Context

- **1957 words** in `js/vocabulary.js`
- **Beginning level (112 words)** already has topic classification in `js/topic-vocab.js` with 7 categories: `Buildings, Kitchen, Bedroom, Bathroom, Living Room, Household, House Parts`
- **Other 1845 words** (Basic → Advanced + IELTS 1001-2050) have NO `topic`/`category` field
- Section comments in vocabulary.js already give natural groupings:
  - Basic: Everyday Essentials, Verbs & Actions, Adjectives & Qualities, Society & Life
  - Intermediate: Environment & Science, Health & Medicine, Business, Education
  - Upper-Intermediate: Technology, Law & Politics, Arts & Culture, Psychology
  - Advanced: Academic Writing, Sophisticated Vocabulary, Mastery
  - IELTS 1001+ themed: Academic, Law, Philosophy, Education, Environment, Tech, etc.

---

## Goals

1. Let users browse/learn by **interest topic** ("I want to learn body parts today") not just by lesson number
2. Increase engagement — topic-based learning is more motivating than abstract lesson numbers
3. Keep the existing lesson-number progression intact (don't break current users)
4. Topic classification should be **per-level** (Beginning has body parts; Advanced has cardiovascular terms)

---

## Brainstormed Topic Taxonomies

The user's example mentioned:
- **Body**: head, nose, ear, hand, foot, hair…
- **Characteristic**: humor, considerate, talkative, generous, shy…

Below are 4 possible taxonomies. They differ in granularity and abstraction.

### Taxonomy A — Concrete Domains (kid-friendly, ~15 topics)
Best for Beginning + Basic. Topics are tangible.
```
🏠 Home & Household        🍎 Food & Drinks        👕 Clothes & Appearance
👨‍👩‍👧 Family & People        🐶 Animals               🏥 Health & Body
🚗 Transport & Travel      🌳 Nature & Weather     🎨 Hobbies & Sports
🏫 School & Work           💰 Money & Shopping     🎉 Holidays & Events
🌐 Places & Cities         📱 Technology           🎵 Arts & Music
```

**Strength:** Easy to picture, kids/beginners love them
**Weakness:** Too few buckets for 1845 words; abstract words (verb "decide", adj "important") don't fit

---

### Taxonomy B — Word-Class + Theme (linguistically clean, ~25 topics)
Splits by part-of-speech first, then theme.
```
👤 People & Roles            😊 Emotions & Feelings
🎭 Personality & Character   🗣️ Communication
🏃 Actions & Movement        🤔 Thinking & Mind
👀 Perception & Senses       💼 Work & Business
🎯 Goals & Achievement       ⚖️ Society & Law
🧪 Science & Research        🏥 Health & Medicine
🌍 Environment & Nature      💻 Technology & Digital
🏛️ Politics & Government     📚 Education & Learning
🎨 Arts & Culture             🍴 Food & Cooking
🏠 Home & Daily Life          🚗 Travel & Transport
🐾 Animals & Plants           ⏰ Time & Change
🔢 Quantity & Measurement     🌟 Quality & Description
💭 Abstract Concepts
```

**Strength:** Covers 100% of vocab including abstract words; pedagogically sound
**Weakness:** Some topics overlap (where does "diplomat" go — People or Politics?)

---

### Taxonomy C — IELTS / CEFR Themes (test-prep aligned, ~12 topics)
Mirrors how IELTS Speaking/Writing prompts are organized.
```
🌍 Environment & Climate    💼 Work & Career         📚 Education
🏥 Health & Lifestyle       💻 Technology & Media     🎨 Arts & Culture
🚗 Transport & Travel       🏛️ Society & Politics     💰 Economy
🍴 Food & Daily Life        👥 Family & Relationships ⚖️ Crime & Law
```

**Strength:** Directly maps to IELTS topics; great for test prep users
**Weakness:** Beginning-level kids' words (spoon, slipper) don't fit naturally

---

### Taxonomy D — Hybrid Per-Level (recommended)
Different taxonomies for different levels — words are tagged with the topic that fits best at their level.

| Level | Topics |
|-------|--------|
| **Beginning** | Buildings, Kitchen, Bedroom, Bathroom, Living Room, House Parts, Household *(already done!)* |
| **Basic** | Body, Food, Family, Clothes, Colors, Numbers, Daily Actions, Feelings, School, Weather, Animals, Transport |
| **Intermediate** | Personality, Health & Medicine, Environment, Business, Education, Travel, Hobbies, Society, Communication, Money |
| **Upper-Intermediate** | Technology, Law & Politics, Arts & Culture, Psychology, Career, Media, Globalization, Innovation |
| **Advanced** | Academic Writing, Critical Thinking, Philosophy, Research, Diplomacy, Sophisticated Verbs, Abstract Concepts |

**Strength:** Each level gets age-appropriate topics; reuses existing 7-category structure for Beginning
**Weakness:** More complex to implement (multiple taxonomies)

---

## Implementation Strategies

### Strategy 1 — Add `topic` field to every word in `vocabulary.js`
```js
{ en: 'head', ipa: '/hed/', vi: 'đầu', emoji: '🧠', topic: 'body', ex: '...' }
```
- **Pro:** Single source of truth; trivial filtering
- **Con:** Modifies 1957 lines; merge conflicts if data changes

### Strategy 2 — Separate `js/topics.js` map
```js
const WORD_TOPICS = {
    body: { name: 'Body', icon: '👤', words: ['head', 'nose', 'ear', ...] },
    characteristic: { name: 'Personality', icon: '😊', words: ['humor', 'considerate', ...] }
};
```
- **Pro:** Vocabulary file untouched; topics easy to edit/reorder
- **Con:** Two files to keep in sync; lookup is O(n) without indexing

### Strategy 3 — Inverse map: `WORD_TO_TOPIC = { 'head': 'body', 'humor': 'characteristic' }`
- **Pro:** O(1) word→topic lookup; small file
- **Con:** Hard to scan visually; less natural for human editing

### Strategy 4 — Hybrid: Strategy 2 for editing + auto-built reverse index at runtime
- Best DX + best perf

---

## Population Strategies (How to actually classify 1845 words)

### Population A — Manual curation (slowest, best quality)
- ~30 hours of work
- 100% accuracy
- Tedious but you learn your own vocabulary

### Population B — LLM batch classification with fixed taxonomy
- Feed 50 words at a time to Claude with the taxonomy → get back JSON `{word: topic}`
- ~2 hours total
- 85-95% accuracy; needs spot-check
- **You can do this directly in this app via a one-time script**

### Population C — Reuse section comments in `vocabulary.js`
- Many sections already have semantic headers: "Verbs & Actions", "Health & Medicine", "Business & Economics"
- Free — just parse `// Words X-Y: TOPIC` and assign to all words in that range
- Coverage: ~70% (mostly Basic + IELTS 1001+)
- Quality: medium — sections lump unrelated words

### Population D — Hybrid: Comments seed + LLM fill gaps + manual review
- Use Strategy C for free coverage
- LLM for the missing gaps
- Manual fix the obvious wrong ones
- **Best ROI**

---

## UX Integration Options

### UX 1 — New "Topics" home tab
Adds a 7th nav button. User picks a topic → sees a 5-word lesson curated from that topic at their current level.

### UX 2 — Topic filter chips above existing lessons
Like the difficulty tabs, but for topics. "Filter Beginning lessons by: 🍴 Food"

### UX 3 — Topic browser inside Profile
Read-only list — view all words you've learned grouped by topic. Less actionable but lower-effort.

### UX 4 — Topic-based daily challenge
Daily challenge changes topic each day ("Today: Body Parts!"). Adds variety to the existing daily.

### UX 5 — Topic-grouped lesson packs
Replace lesson numbers with named packs ("Body Parts Lesson 1, 2, 3"). Big change — risky.

---

## Recommendation

**Taxonomy D (Hybrid Per-Level) + Strategy 2 (Separate `topics.js`) + Population D (Comments + LLM + review) + UX 1 + UX 2**

### Rationale
- **Taxonomy D** respects that topics naturally differ by level — kids don't think "diplomatic" belongs in any topic, but advanced learners think it goes in "Politics"
- **Strategy 2** keeps `vocabulary.js` clean and lets you add/edit topics without touching the data
- **Population D** is the only realistic path that doesn't take 30 hours of manual work
- **UX 1 + UX 2** gives both discovery (browse) and filtering (focus) without breaking lesson progression

### Phased rollout
1. **Phase 1 (1 hr)**: Build taxonomy D structure in `topics.js`. Reuse `topic-vocab.js` data for Beginning. Add 4-6 topics for Basic from existing section comments.
2. **Phase 2 (2 hr)**: Run a one-time LLM batch script to classify the remaining ~1700 words.
3. **Phase 3 (2 hr)**: Build UX 1 (Topics home tab) — topic picker + topic-based lesson generator.
4. **Phase 4 (1 hr)**: Build UX 2 (filter chips) on existing lesson view.
5. **Phase 5 (optional)**: Topic-based daily challenge variety.

---

## Open questions for user

1. **Taxonomy preference** — A (concrete only), B (word-class + theme), C (IELTS), or **D (per-level hybrid, recommended)**?
2. **Topic count per level** — keep ~7-12 (manageable) or go fine-grained ~25 (more discovery)?
3. **Multi-topic words allowed?** — Can "doctor" be in both "People" and "Health"? (Tag list vs single topic)
4. **UX priority** — Topics tab (UX 1), filter chips (UX 2), or both?
5. **Population approach** — happy to use LLM batch (B/D), or strict manual only (A)?
