# Review Tab Logic

## Overview

The Review tab collects all words the user got wrong during lessons, groups them into review lessons of 5 words each, and lets users practice those words again through the matching game.

## Data Structure

Mistakes are stored in `appState.mistakes` as an array:

```js
appState.mistakes = [
    {
        word: "apartment",        // English word (matches ieltsVocabulary[].en)
        count: 5,                 // How many times user got it wrong
        firstMistake: 1711234567, // Timestamp of first mistake
        lastMistake: 1711345678   // Timestamp of most recent mistake
    },
    // ...
]
```

## How Mistakes Are Tracked

### During Lessons (`js/lessons.js`)

1. **Wrong answer** — When user taps a wrong pair in the matching game, `trackMistake(word)` is called for both selected words:
   - If the word already exists in `appState.mistakes`, increment `count` and update `lastMistake`
   - If new, push a new entry with `count: 1`

2. **Correct answer** — When user matches correctly, `reduceMistake(word)` is called:
   - Decrements the `count` for that word
   - If `count` reaches 0, the word is removed from the mistakes array entirely

This means words naturally leave the review list as users practice and get them right.

## Review Tab Rendering (`js/home.js`)

### Flow

```
User clicks "🔄 Review" tab
    → switchHistoryTab('mistakes')
        → renderMistakes()
```

### `getReviewLessonGroups()`

1. Read `appState.mistakes`
2. Sort by `count` descending (most wrong words first)
3. Chunk into groups of `WORDS_PER_LESSON` (5 words per group)
4. Last group may have fewer than 5 words
5. Return array of groups

Example with 12 mistakes:
```
Group 0: [word1(5x), word2(4x), word3(4x), word4(3x), word5(3x)]  → Review Lesson 1
Group 1: [word6(3x), word7(3x), word8(2x), word9(2x), word10(2x)] → Review Lesson 2
Group 2: [word11(1x), word12(1x)]                                   → Review Lesson 3
```

### `renderMistakes()`

1. If no mistakes → show "Great job! No mistakes to review" message
2. Call `getReviewLessonGroups()` to get grouped lessons
3. Render summary header: "📝 X words to review (Y lessons)"
4. For each group, render a review lesson card showing:
   - Lesson number: "📖 Review Lesson 1"
   - Word count badge: "5 words"
   - Word preview: comma-separated English words
   - Total wrong count: "19x wrong total"
   - START REVIEW button → calls `startReviewLesson(groupIndex)`
5. Render "Clear All Mistakes" button at bottom

### `startReviewLesson(groupIndex)`

1. Get the group at `groupIndex` from `getReviewLessonGroups()`
2. Look up each mistake word in `ieltsVocabulary` to get full word objects
3. **Padding**: If group has fewer than 5 words (matching game requires 5 pairs):
   - Build a pool of all vocabulary words not already in the review group
   - Randomly pick words from the pool until we have 5
4. Create `lessonState` with `isPracticeSession: true` and `lessonNumber: -1`
5. Hide bottom nav, show lesson screen
6. Preload pronunciation audio
7. Call `renderMatchingRound()` — reuses the entire existing lesson engine

### `clearMistakes()`

1. Show confirmation dialog
2. If confirmed: clear `appState.mistakes`, save, re-render, update badge count

## UI Location

- **Button**: In `index.html` inside `.history-tabs` section, next to the History tab
- **Container**: `<div id="mistakesContainer">` — toggled via `.show` CSS class
- **Badge**: `<span id="mistakesCount">` — updated in `renderLessonHistory()`

## Key Files

| File | What |
|------|------|
| `js/home.js:272-368` | `getReviewLessonGroups()`, `renderMistakes()`, `startReviewLesson()`, `clearMistakes()` |
| `js/lessons.js:210-237` | `trackMistake()`, `reduceMistake()` |
| `js/lessons.js:124` | `checkMatch()` — calls trackMistake/reduceMistake during gameplay |
| `css/styles.css:1273-1370` | `.review-lesson-card`, `.review-lesson-btn`, `.review-summary` styles |
| `index.html:156-169` | Review tab button and mistakes container HTML |

## Constants

- `WORDS_PER_LESSON = 5` — words per review lesson group (defined in `js/app.js`)
