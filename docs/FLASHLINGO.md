# FlashLingo - English Vocabulary Learning PWA

A Progressive Web App for learning IELTS English vocabulary with matching games, multi-user support, difficulty levels, and offline support.

---

## Quick Start

1. Open `index.html` in a mobile browser
2. Create a user profile with avatar and 4-digit passcode
3. Select a difficulty level and start learning!
4. Tap "Install" when prompted (or use browser menu → "Add to Home Screen")

---

## Features

### Matching Game System

| Feature | Description |
|---------|-------------|
| Word Matching | Match English words with Vietnamese meanings |
| Visual Feedback | Green for correct, red for wrong matches |
| Progress Bar | Shows completion progress during lessons |
| Points Display | Real-time points earned in lesson |

### Vocabulary Database (2000+ IELTS Words)

| Difficulty | Lessons | Word Range | Examples |
|------------|---------|------------|----------|
| Basic | 1-93 | Words 1-465 | explain, require, describe |
| Intermediate | 94-185 | Words 466-925 | negotiate, accommodate, facilitate |
| Upper-Intermediate | 186-277 | Words 926-1385 | unprecedented, consolidate, mitigate |
| Advanced | 278-369 | Words 1386-1845 | paradigm, dichotomy, juxtaposition |

**Additional:** 100 Irregular Verbs for conjugation practice

**Word Data Structure:**
```javascript
{
  en: "appreciate",
  ipa: "/əˈpriːʃieɪt/",
  vi: "đánh giá cao, cảm kích",
  emoji: "🙏",
  ex: "I really appreciate your help."
}
```

**Irregular Verb Structure:**
```javascript
{
  base: "begin",
  v2: "began",
  v3: "begun",
  ipa: "/bɪˈɡɪn/",
  ipaV2: "/bɪˈɡæn/",
  ipaV3: "/bɪˈɡʌn/",
  meaning: "bắt đầu"
}
```

### Multi-User System

| Feature | Description |
|---------|-------------|
| User Profiles | Multiple users with avatars |
| Passcode Protection | 4-digit PIN for each user |
| Auto-submit | Automatically logs in after 4 digits |
| Independent Progress | Each user has separate stats |

### Difficulty Levels & Point Multipliers

| Level | Point Multiplier | Lesson Range |
|-------|------------------|--------------|
| Basic | 1x | Lessons 1-93 |
| Intermediate | 1.5x | Lessons 94-185 |
| Upper-Intermediate | 2x | Lessons 186-277 |
| Advanced | 2.5x | Lessons 278-369 |

### Lesson History

| Feature | Description |
|---------|-------------|
| Table View | Compact list of completed lessons |
| Click to Expand | Tap to see words and re-learn option |
| Filter by Difficulty | View history for specific levels |
| Today's Count | Track lessons completed today |

### Review Mistakes Tab

| Feature | Description |
|---------|-------------|
| Mistake Tracking | Automatically tracks wrong answers |
| Mistake Count | Shows how many times each word was missed |
| Practice Mode | Practice your top 5 most-missed words |
| Auto-reduce | Correct answers reduce mistake count |

### Text-to-Speech Pronunciation

| Feature | Description |
|---------|-------------|
| Click to Speak | Tap any word to hear pronunciation |
| Speaker Icon | 🔊 indicates clickable words |
| English Voice | Uses device's English TTS voice |
| Works Offline | Once voices are loaded |

### Irregular Verbs Practice

| Feature | Description |
|---------|-------------|
| V1/V2/V3 Quiz | Test verb conjugations |
| Multiple Choice | 4 options per question |
| Difficulty Levels | Easy (10), Medium (15), Hard (20) questions |
| Leaderboard | Track best scores |

### Scoring & Gamification

**Points System:**
| Action | Points |
|--------|--------|
| Correct match | +10 (× difficulty multiplier) |
| Complete lesson | Accumulated points |
| Practice mistakes | +10 per correct |

**Stats Tracked:**
- Total Points
- Lessons Completed
- Today's Lessons
- Current Streak

### Screens

1. **Home** - Stats, difficulty tabs, lesson card, history
2. **Lesson** - Matching game with progress bar
3. **Lesson Complete** - Score summary, accuracy percentage
4. **Irregular Verbs** - V1/V2/V3 practice mode
5. **Profile** - User stats, achievements, settings

---

## Technical Details

### Architecture

```
index.html (Single File)
├── <head>
│   ├── Meta tags (PWA, viewport, theme)
│   ├── Favicon (inline SVG)
│   ├── Google Fonts (Nunito)
│   └── <style> (all CSS inline)
├── <body>
│   ├── App container
│   │   ├── Screens container
│   │   │   ├── Onboarding screen
│   │   │   ├── Home screen
│   │   │   ├── Lesson screen
│   │   │   ├── Speed challenge screen
│   │   │   └── Profile screen
│   │   └── Bottom navigation
│   ├── Overlays (modals, popups)
│   └── <script> (all JavaScript inline)

js/vocabulary.js (External)
├── ieltsVocabulary[] - 1845 IELTS words
└── irregularVerbs[] - 100 irregular verbs
```

### Data Storage (localStorage)

```javascript
// Key: 'flashlingo-users' - List of usernames
["user1", "user2"]

// Key: 'flashlingo-user-{username}' - Per-user data
{
  username: "John",
  avatar: "😊",
  passcode: "1234",
  points: 1500,
  streak: 7,
  lastStudyDate: "Sun Feb 23 2025",
  lessonsCompleted: 45,
  currentLesson: 46,
  lessonHistory: [
    { lessonNum: 0, date: 1708790400000, points: 100, accuracy: 90 }
  ],
  mistakes: [
    { word: "appreciate", count: 3, firstMistake: 1708790400000, lastMistake: 1708876800000 }
  ],
  achievements: ["first-lesson", "streak-7"],
  totalCorrect: 500,
  totalAnswers: 550,
  speedChallenge: { easy: 180, medium: 250, hard: 300 }
}
```

### PWA Components

**Service Worker (inline blob):**
- Caches app for offline use
- Network-first with cache fallback

**Web App Manifest (inline blob):**
```json
{
  "name": "FlashLingo",
  "short_name": "FlashLingo",
  "display": "standalone",
  "background_color": "#fff9f0",
  "theme_color": "#ffffff",
  "orientation": "portrait"
}
```

### CSS Design System

**Colors:**
```css
--bg-primary: #fff9f0;
--bg-secondary: #fff3e0;
--bg-card: #ffffff;
--accent-green: #4caf50;
--accent-orange: #ff9800;
--accent-red: #ef5350;
--accent-blue: #42a5f5;
--accent-purple: #ab47bc;
```

**Typography:**
- Font: Nunito (400-800 weight)

**Animations:**
- Card match: Scale + color transition
- Wrong answer: Shake animation
- Confetti: Fall animation on perfect score
- Button press: Scale down feedback

### Key Functions Reference

| Function | Purpose |
|----------|---------|
| `init()` | Initialize app, check users |
| `loginUser(username)` | Load user data, render home |
| `startLesson(lessonNum)` | Start matching game |
| `checkMatch()` | Verify word pair match |
| `trackMistake(word)` | Record wrong answer |
| `reduceMistake(word)` | Reduce count on correct |
| `speakWord(word)` | Text-to-speech pronunciation |
| `renderLessonHistory()` | Display history table |
| `renderMistakes()` | Display review tab |
| `practiceMistakes()` | Start mistake practice session |
| `filterByDifficulty(level)` | Filter by difficulty |
| `getDifficultyLevel(lessonNum)` | Get level info |
| `completeLesson()` | Handle lesson completion |
| `saveUserData()` | Persist to localStorage |

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome (Android) | Full PWA + TTS support |
| Safari (iOS) | PWA + TTS support |
| Firefox (Android) | Full PWA + TTS support |
| Edge (Android) | Full PWA + TTS support |
| Desktop browsers | Works but designed for mobile |

---

## File Structure

```
learn-eng-pwa/
├── index.html              # Main application
├── js/
│   └── vocabulary.js       # IELTS vocabulary data
├── docs/
│   └── FLASHLINGO.md       # This documentation
└── README.md               # Project overview
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-02-24 | Initial release with 60 words |
| 2.0.0 | 2025-02-25 | Added 2000 IELTS words, matching game, multi-user system |
| 2.1.0 | 2025-02-26 | Added difficulty levels, point multipliers |
| 2.2.0 | 2025-02-26 | Redesigned history UI, added Review Mistakes tab |
| 2.3.0 | 2025-02-26 | Added text-to-speech pronunciation, favicon |

---

## License

MIT License - Free to use and modify.
