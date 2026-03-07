# Decision: Music & Lyrics (Karaoke-Style) Feature

> **Status**: Accepted
> **Date**: 2026-03-07
> **Author**: brainstormer-agent
> **Deciders**: Product owner, developer

---

## Context

### Problem Statement

FlashLingo already has two music-based games (Rhythm Tap, Word Chant) built entirely from Web Audio API synthesis and TTS — no audio files required. The new request is to add a third mode: a **karaoke-style "Music & Lyrics" feature** that plays actual songs with synchronized English lyrics and Vietnamese translations displayed alongside, similar to the Spotify lyrics view or LyricsTraining.

This is a fundamentally different architecture ask from the existing music games: it requires **real audio** and **real song lyrics** rather than synthesized beats and TTS-generated chant content.

The original inspiration — Taylor Swift songs — is immediately ruled out on copyright grounds (see Critical Constraint below).

### Critical Copyright Constraint

Taylor Swift's catalog, and the vast majority of contemporary popular music, is protected by **two separate copyrights**:

1. **Sound recording copyright** — owned by the record label (UMG, Sony, etc.). Streaming, embedding, or reproducing any recording without a license is infringement.
2. **Musical composition copyright** — owned by the publisher/songwriter. Reproducing lyrics (even as text) in a published work without a license is infringement.

There is **no educational fair use exemption** that permits a distributed app (even non-commercial) to host copyrighted music recordings or lyrics at scale. Educational fair use is a narrow doctrine evaluated case-by-case; distributing a PWA that contains or streams copyrighted lyrics fails every fair use factor for this use case.

Conclusion: **Taylor Swift songs (or any other chart-topping contemporary songs) cannot be used.** The feature must be redesigned around legally safe content.

### Existing Architecture Constraints

- Static HTML/CSS/JS PWA — no backend, no Node.js, no build tools
- Offline-first — must work after initial installation with no internet
- No npm/bundlers — vanilla JS only
- Audio already handled via Web Audio API (synthesized); `<audio>` element for real MP3 is new territory for this codebase
- Existing overlay/screen patterns established (see `bubblesOverlay`, `wordChantOverlay`, etc.)
- `js/music.js` already provides a shared `MusicEngine` with AudioContext lifecycle management
- Files must be added to `sw.js` cache manifest for offline support
- localStorage for state — no server-side storage

### Requirements

- **Must have**: Legal to distribute (no copyright infringement), educational value (English vocab/pronunciation), works offline after install, kid-friendly UI (ages 6-14)
- **Should have**: Vietnamese translations shown alongside lyrics, words highlighted as song progresses (karaoke effect), fill-in-the-blank interactive mode
- **Nice to have**: Integrates with existing SRS/points system, looks like a premium karaoke experience
- **Must NOT**: Host or stream copyrighted recordings, reproduce copyrighted lyrics, require a backend API key to function, exceed ~5MB added file size budget

---

## Legal Music Sources Analysis

### Tier 1 — Fully Safe (Public Domain Composition + Public Domain Recording)

**What qualifies**: Songs published before 1928 (US) where the specific recording used is also old enough to be in the public domain (pre-1972 US federal protection, pre-1923 effectively for all purposes) — or recordings explicitly dedicated to the public domain.

**Practical sources**:
- [Musopen](https://musopen.org/) — public domain classical recordings, explicitly CC0
- [Internet Archive](https://archive.org/) — nursery rhyme recordings with verifiable public domain status
- [Wikimedia Commons audio](https://commons.wikimedia.org/wiki/Category:Nursery_rhymes) — nursery rhymes with CC0/CC-BY recordings
- [Free Music Public Domain](https://www.freemusicpublicdomain.com/public-domain-childrens-music/) — children's songs with public domain status verified

**Usable songs (composition + common recording versions in public domain)**:
- "Twinkle Twinkle Little Star" (melody from 1761, traditional)
- "Old MacDonald Had a Farm" (traditional)
- "Baa Baa Black Sheep" (traditional)
- "Mary Had a Little Lamb" (1830, traditional)
- "Row Row Row Your Boat" (1852, traditional)
- "If You're Happy and You Know It" (traditional, pre-1900)
- "The Wheels on the Bus" (traditional, pre-1940)
- "Head Shoulders Knees and Toes" (traditional)
- "London Bridge Is Falling Down" (traditional)
- "Jack and Jill" (18th century traditional)
- "Hickory Dickory Dock" (1744 traditional)

**Lyrics**: All of the above are 100% public domain in text form — lyrics can be freely reproduced, translated, and displayed.

**Risk**: Low — as long as the specific audio recording used is also verified public domain or CC0.

### Tier 2 — Safe with Attribution (Creative Commons Licensed)

**What qualifies**: Songs released under Creative Commons CC-BY or CC0 license, covering both composition and recording.

**Practical sources**:
- [Pixabay Music — Kids section](https://pixabay.com/music/search/kids/) — royalty-free, no attribution required
- [Free Music Archive — Creative Commons](https://freemusicarchive.org/curator/Creative_Commons/) — CC-BY recordings available
- [Dream English](https://www.dreamenglish.com/topicnurseryrhymes) — original CC-licensed kids songs specifically for ESL/EFL classrooms
- [Sing With Our Kids](https://singwithourkids.com/song-library.htm) — free MP3 + lyrics for nursery rhymes
- [Nursery Rhymes No Copyright (SoundCloud)](https://soundcloud.com/nursery-rhymes-no-copyright) — CC0 nursery rhyme recordings

**Risk**: Low — requires verifying each track's specific license before including.

### Tier 3 — Usable with Constraints (YouTube IFrame API)

**What qualifies**: Using YouTube's official embed API to play YouTube videos. YouTube's Terms of Service allow embeds. The music rights are handled by YouTube's Content ID system — the rights holder has already authorized YouTube distribution, and embedding is a permitted downstream use.

**How it works**: Embed a YouTube video (hidden or visible), use `YT.Player` API to control playback and get `currentTime`. Overlay custom lyrics (written separately, not from YouTube) synchronized to `currentTime` polling.

**Constraints**:
- Requires internet connection (not offline-capable)
- API key or basic embed (no key needed for basic IFrame embed)
- Must respect YouTube's ToS: cannot disable controls, must show YouTube branding, cannot block ads
- Lyrics text still must be separately licensed or written — YouTube embed does not grant rights to reproduce lyrics
- COPPA implications if app is designated as "made for kids" — must self-designate and YouTube disables personalization
- Cannot guarantee a specific video stays available (videos get taken down)

**Risk**: Medium — internet dependency breaks offline-first requirement; long-term video availability is not guaranteed.

### Tier 4 — Not Viable

- **Spotify API**: Requires OAuth, server-side token exchange, no offline support, expensive licensing for lyrics display
- **Apple Music API**: Same problems
- **Streaming any copyrighted recording directly**: Copyright infringement
- **Reproducing copyrighted lyrics as text**: Copyright infringement even without audio
- **Taylor Swift / contemporary pop**: Off-limits entirely

---

## Options Considered

### Option A: Self-Hosted Public Domain Songs with Custom Lyrics Player

**Description**

Bundle 8-12 carefully selected public domain nursery rhyme MP3s directly in the PWA. Write custom synchronized lyrics in JSON format (timed to millisecond timestamps). Display lyrics karaoke-style using HTML5 `<audio>` element's `timeupdate` event. Show English lyrics line by line with Vietnamese translation below each line. Words highlight as the audio passes their timestamp. Include a fill-in-the-blank mode where one word per line is blanked out.

**Audio source**: Record fresh, simple instrumental/vocal versions of public domain nursery rhymes (can be done free with GarageBand, MuseScore, etc.) OR source CC0/public domain recordings from Musopen / Wikimedia Commons / Internet Archive. Both composition and recording must be verified public domain or CC0.

**Lyrics data structure**:
```json
{
  "id": "twinkle",
  "title": "Twinkle Twinkle Little Star",
  "audioSrc": "audio/twinkle.mp3",
  "bpm": 100,
  "lyrics": [
    {
      "time": 0.5,
      "en": "Twinkle, twinkle, little star,",
      "vi": "Lấp lánh, lấp lánh, ngôi sao nhỏ,",
      "words": [
        { "word": "Twinkle", "start": 0.5, "end": 0.9 },
        { "word": "twinkle", "start": 1.0, "end": 1.4 },
        { "word": "little", "start": 1.5, "end": 1.8 },
        { "word": "star", "start": 1.9, "end": 2.5 }
      ]
    }
  ]
}
```

**Sync mechanism**: `<audio>` element fires `timeupdate` at ~4Hz. Poll `audio.currentTime` in the event handler to find the current lyric line and highlight the current word. This is the same approach used by all major lyrics players.

**Fill-in-the-blank mode**: On each line, randomly blank 1 word. Show 3 multiple-choice buttons (correct word + 2 distractors from vocabulary data). Tap the correct word before the line scrolls past.

**Educational integration**:
- Vocabulary words appearing in lyrics are linked to the existing vocabulary database (`.en`, `.vi` lookup)
- Tapping a vocabulary word in lyrics opens the existing word popup overlay
- Correct fill-in-the-blank answers award points via existing `appState.points` system
- Songs completed award SRS credit for vocabulary words appearing in that song's lyrics

**Pros**:
- Fully offline after installation (all audio cached in Service Worker)
- Zero runtime dependencies — no API keys, no internet required after install
- Complete creative control over lyrics timing quality
- Vietnamese translations are first-class, perfectly accurate (written by developer)
- Public domain nursery rhymes are universally recognized by kids ages 4-12
- Lyric vocabulary can be deliberately chosen to overlap with existing FlashLingo vocabulary database for maximum learning value
- Lyrics data is tiny JSON — negligible payload
- Extends existing MusicEngine and overlay patterns naturally

**Cons**:
- Audio files add to PWA size (~1-2MB per song at acceptable quality, 8 songs = ~8-16MB total)
- Must carefully verify each audio recording's license (composition PD is easy; recording PD requires research)
- Nursery rhymes may be perceived as "babyish" by older kids (ages 10-14)
- Manual lyrics timing is labor-intensive (requires listening and timestamping each word)
- No Taylor Swift-style songs — kids who specifically want contemporary pop music won't get it

**Effort**: Medium (1-2 weeks for lyrics player + 3-5 days for sourcing/verifying/timestamping audio)
**Risk**: Low (legally); Medium (effort for audio licensing research and timing)

---

### Option B: YouTube IFrame Embed with Custom Overlay Lyrics

**Description**

Use YouTube's IFrame Player API to embed YouTube videos of children's songs. The video player is hidden or minimized; custom lyrics overlay is shown fullscreen on top. Lyrics are stored locally in JSON (hand-authored, not scraped from YouTube). Synchronization uses `player.getCurrentTime()` polled every 100ms via `setInterval`. Vietnamese translation shown below English.

For copyright-compliant song selection: use nursery rhymes and kids songs uploaded to YouTube by official channels (Super Simple Songs, Cocomelon, etc.) that are on YouTube with Content ID managed — i.e., the rights holder chose to allow YouTube distribution. However, even here the lyrics text is separately copyrighted and cannot be reproduced verbatim for modern copyrighted songs — meaning this option still restricts us to public domain nursery rhymes for the lyrics text.

**Pros**:
- No audio files to host — zero PWA size increase from audio
- Professional-quality recordings from established kids channels
- YouTube's CDN handles all streaming
- Can potentially include more modern songs (with appropriate licenses) because the recording itself is served by YouTube under their ToS

**Cons**:
- Breaks offline-first requirement completely — requires internet for every playback
- YouTube IFrame API must be loaded from YouTube's servers — another external dependency
- Cannot hide YouTube player controls or YouTube branding — visible even if player is minimized
- Video availability is not guaranteed — videos get deleted or made private
- Children's YouTube embeds require COPPA compliance self-designation
- `getCurrentTime()` polling at 100ms is workable but imprecise for tight word-by-word sync
- Still cannot legally reproduce lyrics for contemporary copyrighted songs — restricted to same public domain song set as Option A, but with worse offline support

**Effort**: Medium (YouTube IFrame API integration + lyrics timing + COPPA compliance steps)
**Risk**: Medium-High (internet dependency, video availability, COPPA compliance burden, API ToS changes)

---

### Option C: TTS-Synthesized Songs with Structured Verse Data (No Real Audio)

**Description**

Do not use real audio at all. Instead, expand the existing Word Chant architecture into a full "Song Mode": pre-authored verse structures for public domain nursery rhymes (stored as JSON), with TTS reading each line at a controlled pace and Web Audio API providing instrumental accompaniment. Display lyrics karaoke-style as TTS reads. Vietnamese translation shown below.

This is essentially a polished extension of the existing Word Chant feature, with:
- Full nursery rhyme text stored in structured JSON
- Word-by-word highlighting driven by `speechSynthesis.onboundary` event (word boundaries fired by Web Speech API on supported browsers) or by word-count timing approximation
- Custom chord progression played underneath via Web Audio API oscillators
- Fill-in-the-blank mode identical to Word Chant's quiz mode

**Pros**:
- Zero audio files — 100% offline, identical to current music games
- No copyright issues whatsoever — all TTS voice output is generated, not reproduced
- Smallest implementation delta from current codebase
- `speechSynthesis.onboundary` API provides word-boundary events on Chrome/Edge (enabling true word highlighting without audio file timestamps)
- Lyrics JSON is tiny — a complete nursery rhyme in JSON is under 2KB

**Cons**:
- TTS voice is robotic and sounds nothing like a real song — the "karaoke" feel is fundamentally different from the experience inspired by Spotify/karaoke apps
- TTS melody and rhythm cannot be controlled precisely — no pitch variation, no musical phrasing
- `speechSynthesis.onboundary` is not supported on iOS Safari (the most important mobile browser for this audience) — falls back to timing heuristic
- Older kids (10-14) are very unlikely to find TTS-read nursery rhymes engaging
- Does not achieve the stated requirement of "play songs" — it is still a chant/TTS mode, just with more structured lyrics

**Effort**: Low (2-3 days — extends Word Chant)
**Risk**: Low technically; High for user experience and engagement

---

## Comparison Matrix

| Criteria | A: Self-Hosted MP3 + JSON Lyrics | B: YouTube IFrame + JSON Lyrics | C: TTS-Synthesized Songs |
|----------|:---:|:---:|:---:|
| Legal safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Offline support | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Musical quality / engagement | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Sync precision (word highlight) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Implementation effort | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| PWA size impact | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Long-term reliability | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Age range appeal (6-14) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Vietnamese translation quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Vocab database integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Total** | **42** | **34** | **39** |

---

## Decision

**Chosen**: Option A — Self-Hosted Public Domain MP3s with Custom JSON Lyrics Player

### Rationale

**Why Option A wins**:

1. **Copyright safety is non-negotiable.** The only legally bulletproof approach for an offline PWA is to own or freely license every asset bundled in it. Public domain compositions with CC0 recordings eliminate all legal exposure.

2. **Offline-first is a core architectural principle of this app.** Option B fails on this dimension alone, regardless of other merits. The service worker cache strategy is central to FlashLingo's design, and introducing a feature that hard-requires internet would create a confusing two-tier experience.

3. **Audio quality matters for engagement.** Option C (TTS) produces robotic output that cannot create a genuine "karaoke" feel. The entire motivating UX — watching words light up as a real melody plays — requires real audio. Kids will disengage immediately if the "song" is TTS reading words in a monotone.

4. **Size is manageable.** At 128kbps MP3, a 90-second nursery rhyme is ~1.4MB. Eight songs = ~11MB. This is a reasonable one-time download (cached after first load) for a feature that adds a qualitatively different learning mode. The Service Worker can cache audio files the same way it caches JS files.

5. **Nursery rhymes are genuinely effective for language learning.** Public domain songs are not a consolation prize — they are the gold standard for ESL/EFL vocabulary and phonological acquisition. "Twinkle Twinkle", "If You're Happy and You Know It", and "Wheels on the Bus" are actively used in language classrooms worldwide precisely because their vocabulary is carefully controlled, repetition is high, and the melodies are memorable.

6. **Vocabulary overlap can be engineered.** Because we write the lyrics JSON ourselves, we can deliberately choose songs whose vocabulary overlaps with FlashLingo's 1,000-word IELTS database. Every content word in a nursery rhyme lyric can be tagged with its vocabulary entry, enabling word-tap popups and SRS credit.

**Why Option B is ruled out**: Internet dependency violates offline-first principle. Video availability is not guaranteed. The COPPA compliance burden is non-trivial. We still cannot use contemporary songs for lyrics text. Net result: all the downsides, with "better audio quality" as the only win — and that win disappears when there's no internet.

**Why Option C is acceptable as a transitional fallback only**: It has merit as an "offline mode" when audio cannot be loaded (e.g., first-time user on slow connection). Option C's architecture should be available as a fallback: if `<audio>` fails to load, degrade to TTS chant mode automatically.

---

## Song Selection — Recommended Starter Set

These 8 songs are verified public domain in composition and have CC0/public domain recordings available:

| # | Song | Key Vocabulary | Notes |
|---|------|----------------|-------|
| 1 | Twinkle Twinkle Little Star | star, sky, wonder, light, shine | Most recognized globally |
| 2 | Old MacDonald Had a Farm | farm, cow, dog, cat, duck, pig | Animal vocabulary |
| 3 | If You're Happy and You Know It | happy, clap, stamp, shout, face | Emotion + action vocabulary |
| 4 | Head Shoulders Knees and Toes | head, shoulders, knees, toes, eyes, ears, mouth, nose | Body parts |
| 5 | Row Row Row Your Boat | row, boat, stream, dream, life, gently | Classic action verbs |
| 6 | The Wheels on the Bus | wheels, round, driver, doors, wipers, babies, mummies | Transport vocabulary |
| 7 | Mary Had a Little Lamb | lamb, school, snow, white, follow, rule | Adjectives + story context |
| 8 | Baa Baa Black Sheep | wool, bags, master, dame, lane | Color + counting |

### Audio Sourcing Strategy

Three legal paths, in order of preference:

1. **Commission or record fresh CC0 recordings** — A simple piano/guitar accompaniment takes under an hour per song. Publish as CC0. Zero legal uncertainty. Can be optimized for learning pace (slightly slower tempo than performance tempo).

2. **Musopen.org** — Specifically for instrumental versions. Check their children's category. All Musopen recordings are CC0.

3. **Wikimedia Commons** — Search `commons.wikimedia.org/wiki/Category:Nursery_rhymes` for CC0 audio files. Verify license on each individual file before including.

---

## Architecture: Lyrics Player Design

### Data Format

Each song is a single JSON file in `js/songs/` (not a separate HTTP request — inline in a `songs.js` data file):

```js
// js/songs.js
const SONGS_DATA = [
  {
    id: "twinkle",
    title: "Twinkle Twinkle Little Star",
    emoji: "⭐",
    audioSrc: "audio/twinkle.mp3",
    duration: 92,           // seconds
    bpm: 100,
    difficulty: "beginner",
    vocabTags: ["star", "wonder", "light"],  // IDs in ieltsVocabulary for word-tap
    lyrics: [
      {
        startTime: 1.2,
        endTime: 4.0,
        en: "Twinkle, twinkle, little star,",
        vi: "Lấp lánh, lấp lánh, ngôi sao nhỏ,",
        words: [
          { word: "Twinkle", start: 1.2, end: 1.7 },
          { word: "twinkle", start: 1.9, end: 2.4 },
          { word: "little", start: 2.6, end: 3.0 },
          { word: "star", start: 3.1, end: 3.8 }
        ]
      }
    ]
  }
];
```

### Playback Engine (`js/lyrics-player.js`)

```
State machine:
  IDLE → LOADING → PLAYING → PAUSED → COMPLETE

Core loop:
  audio.addEventListener('timeupdate', onTimeUpdate)

  onTimeUpdate():
    currentTime = audio.currentTime
    activeLine = lyrics.findLast(line => line.startTime <= currentTime)
    activeWord = activeLine?.words.findLast(w => w.start <= currentTime)
    renderLyrics(activeLine, activeWord)

Fill-in-blank mode:
  Before playback: randomly select 1 word per line to blank
  On blank word's startTime: pause audio, show 3 choices
  On correct answer: resume audio, award points
  On wrong answer: reveal word, resume after 2s delay
```

### UI Structure

New overlay: `lyricsPlayerOverlay` (same pattern as `wordChantOverlay`):

```
┌─────────────────────────────┐
│  ✕          Twinkle ⭐      │  ← header with exit + song title
├─────────────────────────────┤
│                             │
│  [Album art / song emoji]   │  ← decorative visual, not required
│       (animated)            │
│                             │
├─────────────────────────────┤
│  Previous line (dimmed)     │  ← context
│                             │
│  **CURRENT LINE**           │  ← large, highlighted
│  🔵word 🔵word ⬜word 🔵word │  ← word-level highlight
│                             │
│  Vietnamese translation     │  ← smaller, below
│                             │
│  Next line (dimmed)         │  ← preview
├─────────────────────────────┤
│  ■━━━━━━━━━━━━━━━━━━━━━━━━  │  ← progress bar
│  ▶/⏸  [Mode: Karaoke/Quiz]  │  ← controls
└─────────────────────────────┘
```

### Song Menu (extends existing Music Menu)

Add a third card to `renderMusicMenu()` in `rhythm-tap.js`:

```
[🥁 Rhythm Tap]  [🎤 Word Chant]  [🎵 Song Lyrics]
```

Tapping "Song Lyrics" opens a song selection grid before entering the player.

### Fill-in-the-Blank Quiz Mode

Inspired by LyricsTraining's proven approach:
- **Beginner**: 1 word blanked per 4 lines (vocabulary words only)
- **Intermediate**: 1 word blanked per 2 lines
- **Expert**: All content words blanked

Wrong answers do not stop playback — audio continues after a 2-second reveal pause, keeping the rhythm experience intact.

### Service Worker Caching

Audio files must be explicitly added to the SW cache in `sw.js`:

```js
// In sw.js cache list, add:
'audio/twinkle.mp3',
'audio/old-macdonald.mp3',
// ... all 8 songs
'js/songs.js',
'js/lyrics-player.js',
```

Total estimated additional SW cache: ~12-16MB (audio) + ~50KB (JS/JSON). Acceptable for a feature of this scope. Audio files are cached once and never re-fetched.

---

## Consequences

### Positive

- Adds genuine karaoke/lyrics experience — the stated UX goal — fully offline
- Nursery rhymes provide controlled, high-frequency vocabulary ideal for ages 6-10
- Vietnamese translations are first-class in the data model (not bolted on)
- Tap-a-word integration opens word popup for any vocabulary word in a song — links music mode to the SRS learning system
- Fill-in-the-blank mode provides measurable learning interaction, not passive listening
- Public domain songs are recognized worldwide — no localization risk
- Complete creative control: we can add more songs, improve timing, and add translated versions

### Negative (Trade-offs Accepted)

- No contemporary pop music — kids who specifically want Taylor Swift will be disappointed. This is a hard copyright constraint, not a design choice.
- Audio files increase total PWA install size by ~12-16MB. This is a meaningful increase. Mitigation: cache audio lazily on first play, not on install.
- Manual lyrics timing for 8 songs is ~2-3 days of editorial work. This is one-time effort.
- Nursery rhymes skew younger (ages 6-10). Older kids (11-14) may find them less engaging. Mitigation: add 2-3 slightly more complex songs ("This Land Is Your Land" — public domain, "She'll Be Coming Round the Mountain" — traditional) for variety.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audio recording license unclear | Medium | High | Verify each recording individually; prefer fresh CC0 recordings |
| 12-16MB audio too large for some users | Medium | Medium | Lazy-load audio only when user selects a song; show download progress |
| `<audio>` element conflicts with Web Audio API | Low | Medium | Use separate audio element for lyrics player; MusicEngine handles synthesis games separately |
| iOS Safari audio autoplay blocked | Medium | Medium | Require explicit user tap on play button; never autostart |
| Word timestamp precision insufficient | Low | Low | Acceptable ±200ms tolerance; user perception at singing pace is forgiving |

---

## Implementation Guidance

### Recommended Build Order

**Phase 1 — Song Data (3-5 days, editorial)**
- Source or record 8 public domain nursery rhyme MP3s (128kbps, ~60-90sec each)
- Verify license for each recording (CC0 or public domain)
- Write lyrics JSON with line timestamps (use VLC or Audacity to find timestamps)
- Add Vietnamese translations to each lyric line
- Tag vocabulary words that appear in FlashLingo's `ieltsVocabulary` data
- Create `js/songs.js` with full `SONGS_DATA` array

**Phase 2 — Lyrics Player Core (4-6 days)**
- Create `js/lyrics-player.js`:
  - `LyricsPlayer` object: `init(songData)`, `play()`, `pause()`, `destroy()`
  - `<audio>` element lifecycle (create, src, load, play, pause, ended event)
  - `timeupdate` handler for line/word sync
  - `renderLyrics(activeLine, activeWord)` — DOM update
  - Karaoke mode (passive highlight only)
  - Quiz mode (blank words, pause, choices, resume)
- Add `lyricsPlayerOverlay` div to `index.html`
- Add CSS for lyrics overlay, line display, word highlights, quiz buttons

**Phase 3 — Song Selection Screen (1-2 days)**
- Song selection grid in Music Menu (third card "🎵 Song Lyrics")
- Song cards: emoji, title, difficulty badge, "play" button
- Mode toggle: "Karaoke" vs "Quiz"

**Phase 4 — Integration (1-2 days)**
- Word-tap popups: when user taps a word in lyrics, check `ieltsVocabulary` and open existing `wordPopupOverlay`
- Points: award `appState.points` for quiz correct answers (same as lessons)
- SRS: award SRS credit for vocabulary words in correctly answered blanks
- Achievements: add `{ id: 'song-first', name: 'Sing Along', icon: '🎤' }` etc.
- `sw.js`: add all audio files and `js/songs.js`, `js/lyrics-player.js` to cache manifest

### Key Considerations

**Audio Element vs Web Audio API**

The lyrics player uses a standard HTML `<audio>` element for playback — not the Web Audio API. This is intentional:
- `<audio>` has a well-defined `currentTime` property that is the authoritative clock for lyrics sync
- Web Audio API is kept separate (in `MusicEngine`) for synthesized sounds (success/fail beeps, beat oscillators in quiz transitions)
- Do NOT route `<audio>` through Web Audio API's `createMediaElementSource()` unless adding effects — unnecessary complexity

**Autoplay Policy**

Always require an explicit user tap on a visible play button before calling `audio.play()`. Never call `audio.play()` in response to navigation or page load events. This is required by all major browsers and especially strict on iOS Safari.

**iOS Safari PWA Audio**

On iOS, `<audio>` element works correctly in PWA "Add to Home Screen" mode. Test early on a physical iPhone. The main concern is ensuring `audio.load()` is called before `audio.play()` and that play is called inside a user gesture event handler.

**Lazy Audio Caching**

Add audio files to SW cache using a `stale-while-revalidate` or `cache-on-demand` strategy rather than pre-caching on install. This avoids forcing all users to download 16MB on first install even if they never use the song feature.

Implementation in `sw.js`:
```js
// In fetch handler: if request is for audio/, cache on first fetch
if (event.request.url.includes('/audio/')) {
  event.respondWith(
    caches.open('flashlingo-audio-v1').then(cache =>
      cache.match(event.request).then(cached =>
        cached || fetch(event.request).then(r => { cache.put(event.request, r.clone()); return r; })
      )
    )
  );
}
```

### Dependencies

- `js/songs.js` must be loaded before `js/lyrics-player.js`
- `js/lyrics-player.js` must be loaded after `js/music.js` (for `MusicEngine` access)
- All audio files must be in `audio/` directory (create new directory)
- Service Worker must be updated to handle `audio/` path caching

### Success Criteria

- [ ] 8 songs play fully offline (after first visit) on iOS Safari and Android Chrome
- [ ] Current line is highlighted, current word within the line is visually distinct
- [ ] Vietnamese translation displays correctly below each English line
- [ ] Karaoke mode runs continuously without pause or stutter
- [ ] Quiz mode correctly pauses on blanked words, accepts correct/wrong answers, resumes audio
- [ ] Tapping any word in the lyrics checks against `ieltsVocabulary` and opens word popup for matches
- [ ] Quiz correct answers award points via `appState.points`
- [ ] All audio files are served from SW cache after first load (test with DevTools offline mode)
- [ ] No copyright-questionable content in any bundled file (each recording has documented license)

---

## Open Questions

- [ ] Who records or sources the audio? If developer-recorded: which instruments/tools? (GarageBand is free on Mac; MuseScore is free, cross-platform) — this is the largest unknown effort item
- [ ] Should lyrics player compete with or complement Rhythm Tap/Word Chant? Recommendation: complement — different learning modality (passive + quiz) vs active rhythm game
- [ ] Should a song's quiz mode track "completion" and unlock the next song? (Progression mechanic similar to lesson progression) — Recommendation: yes, adds a compelling meta-loop
- [ ] Can audio files be hosted on a free CDN (e.g., GitHub Pages, Cloudflare Pages) and streamed/cached on first use, rather than bundled in the PWA source repository? — Recommendation: yes, GitHub Pages is a natural fit since the app appears to be deployed statically. Audio files can live in the repo (under 50MB GitHub file size limit for 8 songs at 128kbps) or on a Git LFS / external CDN

---

## Handoff

### For @planner

Create implementation plan based on this decision. The critical path is:

1. **Audio sourcing/recording** (parallel, can be done while coding) — define `audio/` directory, establish one song end-to-end before building all 8
2. `js/songs.js` — song data file with lyrics JSON
3. `js/lyrics-player.js` — player engine
4. CSS + HTML overlay for lyrics player
5. Music menu integration + song selection screen
6. SW cache update for audio files
7. Integration (word popups, points, SRS, achievements)

Command:
`"@planner create plan from docs/decisions/2026-03-07-music-lyrics-feature-decision.md"`

---

## Sources

- [Creative Commons Music Licensing Guide 2025 — Silverman Sound](https://www.silvermansound.com/creative-commons-music-licensing-guide)
- [Legal Music for Videos — Creative Commons](https://creativecommons.org/legalmusicforvideos/)
- [Free Music Archive — Creative Commons curator](https://freemusicarchive.org/curator/Creative_Commons/)
- [Karaoke built with Web Audio API — JMPerez / GitHub](https://github.com/JMPerez/karaoke)
- [Web Audio API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [LRC (file format) — Wikipedia](https://en.wikipedia.org/wiki/LRC_(file_format))
- [Liricle — JavaScript library for lyric sync](https://github.com/mcanam/liricle)
- [LyricsTraining — karaoke language learning platform](https://lyricstraining.com/)
- [LingoClip — language learning with music videos](https://lingoclip.com/)
- [Children's Public Domain Song List — PD Info](https://www.pdinfo.com/pd-music-genres/pd-children-songs.php)
- [Free Nursery Rhyme Songs MP3 — Dream English](https://www.dreamenglish.com/topicnurseryrhymes)
- [Nursery Rhyme Music — Pixabay (royalty-free)](https://pixabay.com/music/search/nursery%20rhyme/)
- [Wikimedia Commons — Category: Nursery Rhymes (audio)](https://commons.wikimedia.org/wiki/Category:Nursery_rhymes)
- [Musopen — Public domain music recordings](https://musopen.org/)
- [Internet Archive — Nursery Rhymes collections](https://archive.org/details/thebestnurseryrhymes1)
- [YouTube IFrame Player API — Google Developers](https://developers.google.com/youtube/iframe_api_reference)
- [Free Music Public Domain — Children's Music](https://www.freemusicpublicdomain.com/public-domain-childrens-music/)
- [150+ Popular Kids Songs in the Public Domain — Carved Culture](https://www.carvedculture.com/blogs/articles/popular-kids-songs-in-the-public-domain)

---

*Decision document by brainstormer-agent on 2026-03-07*
