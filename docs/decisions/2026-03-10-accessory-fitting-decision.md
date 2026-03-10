# Decision: Pet Accessory Fitting System

> **Status**: Accepted
> **Date**: 2026-03-10
> **Author**: brainstormer-agent
> **Deciders**: Project owner

---

## Context

### Problem Statement

The pet dog is the hero element of the app, occupying 48dvh (240–380px) of screen space. It has 50 accessories across 6 slots (head, eyes, neck, body, effect, toy). Currently all 10 dog breeds share identical CSS percentage-based offsets. The result: accessories float in wrong positions relative to the actual emoji art, are too small (35% of dog size = ~28–55px on 72–156px dogs), and fail across platforms because emoji rendering is inconsistent.

The specific failures by breed:
- **🐶 Chihuahua** — frontal face emoji, head is centered and large. Generic offsets mostly work but head slot sits too high above.
- **🐕 Beagle** — full-body walking-left emoji. Head is in top-left quadrant, not top-center. All accessories land on the body.
- **🐩 Poodle** — side-profile standing emoji. Head is left-of-center and high. Neck is mid-left. Centered accessories miss badly.
- **🦮 Retriever** — full-body walking-left emoji (similar to Beagle). Same offset problems.
- **🐾 Dalmatian** — paw print emoji. Has NO head, neck, or body to target. Accessories are meaningless anatomically.
- **🐺 Husky** — forward-facing wolf face. Similar to Chihuahua but slightly different proportions.
- **🐕‍🦺 Shepherd** — side-profile working dog. Same problems as Poodle/Retriever.
- **🦊 Akita** — frontal fox face. Head-centered, works OK.
- **🦁 Royal Hound** — frontal lion face. Head-centered, works OK.
- **🐉 Diamond Dog** — dragon emoji. Completely different silhouette from all others.

### Constraints

- Vanilla JS/CSS only (no frameworks, no npm)
- Mobile-first, 375px+ viewport width
- Pet hero zone: 48dvh height (240–380px actual pixels)
- Dog sizes: 72px (Chihuahua) to 156px (Diamond Dog)
- 50 accessories, 6 slots
- Accessories are emoji characters — not custom images
- Performance: PWA on mobile, low-end Android must hold 60fps
- One CSS file (`css/styles.css`), one JS file (`js/home.js`)

### Requirements

- **Must have**: Head/eyes/neck accessories visually appear to be ON the dog in the right anatomical zone
- **Must have**: Works on iOS Safari, Chrome Android, desktop Chrome (top 3 platforms)
- **Must have**: No new dependencies or build steps
- **Should have**: Toy slot looks natural (dog holding/near the toy)
- **Should have**: Effect/body slots look good (these are more forgiving — ambient around dog)
- **Nice to have**: Accessory size feels right for the dog's actual body proportion
- **Nice to have**: Easy to add new breeds in future

---

## The Root Problem: Emoji Anatomy Is Not Uniform

Before evaluating options, it helps to document what each emoji actually looks like as a rendered glyph. This is the ground truth any solution must account for.

### Breed Anatomy Analysis (as emoji render on iOS/Android)

| Stage | Emoji | Type | Head Location | Notes |
|-------|-------|------|---------------|-------|
| Chihuahua | 🐶 | Frontal face | ~center-top | Round face, ~80% of glyph width. Good candidate for accessories. |
| Beagle | 🐕 | Full-body, facing left | ~top-left (25% x, 20% y) | Body spans full width. Head is small relative to body. |
| Poodle | 🐩 | Full-body, facing left | ~top-left (20% x, 15% y) | Distinctive pom-pom head. Neck is thin. |
| Retriever | 🦮 | Full-body, facing left | ~top-left (25% x, 20% y) | Guide harness visible. Similar to Beagle. |
| Dalmatian | 🐾 | Paw print (abstract) | N/A — no anatomy | Four paw pads + big pad. Cannot place anatomical accessories. |
| Husky | 🐺 | Frontal face (wolf) | ~center-top | Similar to 🐶 but slightly wider snout. |
| Shepherd | 🐕‍🦺 | Full-body, facing left | ~top-left (20% x, 15% y) | Service vest visible. Similar to Poodle layout. |
| Akita | 🦊 | Frontal face (fox) | ~center-top, slightly right | Pointed ears. |
| Royal Hound | 🦁 | Frontal face (lion) | ~center, large | Mane makes head very wide. |
| Diamond Dog | 🐉 | Full-body dragon | ~top-right (70% x, 10% y) | Completely different from all others. |

**Key insight**: There are really 3 emoji archetypes:
1. **Frontal face** (🐶🐺🦊🦁): Head centered-top, good for hats/glasses/collars
2. **Side-profile body** (🐕🐩🦮🐕‍🦺): Head top-left, body stretches right, accessories must shift left
3. **Abstract/non-dog** (🐾🐉): No viable anatomical placement

**Platform rendering note**: The CSS `font-size` sets the em-square height. On iOS/Android, different emoji fonts (Apple Color Emoji vs Noto Color Emoji) have different internal padding. The actual rendered glyph is typically 70–80% of the em-square. This means a `font-size: 100px` dog emoji renders the actual dog at ~70–80px within a 100px box. Percentage-based positioning on the outer box must account for this internal padding offset.

---

## Options Considered

### Option A: Per-Breed Anchor Points (JS data-driven offsets)

**Description**: Define a lookup table in JS with `{ top, left, size }` per slot per breed (10 breeds × 6 slots = 60 entries). Each entry overrides the generic CSS with inline styles applied dynamically in `renderWordPet()`. The CSS classes (`acc-head`, `acc-eyes`, etc.) become fallbacks only.

**Implementation sketch**:
```javascript
const BREED_ANCHORS = {
  chihuahua: {
    head:   { top: '-18%', left: '50%',  size: 0.42 },
    eyes:   { top: '22%',  left: '50%',  size: 0.30 },
    neck:   { top: '68%',  left: '50%',  size: 0.28 },
    body:   { top: '30%',  left: '50%',  size: 0.45 },
    effect: { top: '-25%', left: '50%',  size: 0.35 },
    toy:    { top: '70%',  left: '85%',  size: 0.32 }
  },
  beagle: {
    head:   { top: '5%',   left: '20%',  size: 0.38 },
    eyes:   { top: '20%',  left: '22%',  size: 0.26 },
    neck:   { top: '38%',  left: '28%',  size: 0.26 },
    body:   { top: '35%',  left: '55%',  size: 0.42 },
    effect: { top: '-10%', left: '30%',  size: 0.32 },
    toy:    { top: '60%',  left: '85%',  size: 0.32 }
  },
  // ... 8 more breeds
};
```

In `renderWordPet()`:
```javascript
const anchors = BREED_ANCHORS[stage.stageCss] || BREED_ANCHORS.chihuahua;
const accSpans = active.map(id => {
    const acc = DOG_ACCESSORIES.find(a => a.id === id);
    if (!acc) return '';
    const a = anchors[acc.slot];
    const sz = Math.round(stage.size * a.size);
    return `<span class="pet-accessory"
        style="font-size:${sz}px;top:${a.top};left:${a.left};transform:translateX(-50%)"
    >${acc.emoji}</span>`;
}).join('');
```

**Pros**:
- Maximum visual precision — each breed gets exactly the right positions
- Pure JS/CSS, no new dependencies
- Accessories feel genuinely "worn" by the dog
- Easy to tune: change a number, see the result
- Works identically on all platforms (no platform-specific behavior)
- Low performance cost: a lookup, not a calculation

**Cons**:
- 60 position configs to write and test — meaningful upfront effort
- Abstract breeds (🐾 Dalmatian, 🐉 Diamond Dog) still have no natural anatomy to target
- Must be re-tested when emoji fonts update (rare, but possible)
- New breeds in future need new anchor entries

**Effort**: Medium (1–2 hours writing configs, 1 hour testing on devices)
**Risk**: Low

---

### Option B: Replace Emojis with Custom SVG/PNG Dogs

**Description**: Replace the emoji dog glyphs with custom image assets (SVG or PNG sprite sheets). Body parts have known pixel coordinates, making accessory placement trivial and precise.

**Implementation sketch**:
```html
<!-- Dog becomes an image, not a text node -->
<img class="pet-creature" src="img/dogs/chihuahua.svg" width="92" height="92">
```

Accessories positioned relative to known pixel coords in the image:
```javascript
// Absolute pixel offsets baked into SVG design
const SVG_ANCHORS = {
  chihuahua: { head: { x: 46, y: -10 }, eyes: { x: 46, y: 30 } }
};
```

**Pros**:
- Perfect anatomical precision across all platforms (no emoji font variance)
- Custom dogs can be designed to have exact, consistent proportions
- The dog can have a real visual "upgrade" at each stage (actual art, not just emojis)
- Accessories can be layered as SVG/PNG overlays with sub-pixel accuracy

**Cons**:
- Requires creating 10 custom dog illustrations — significant design effort (days, not hours)
- Breaks the current charm of emoji-based dogs that players are already familiar with
- Adds asset pipeline complexity (image optimization, multiple sizes for retina)
- Increases PWA bundle size and time-to-paint
- Loss of native emoji rendering means loss of platform-native feel
- The paw print (Dalmatian) and dragon stages cannot be drawn as "real dogs" without breaking the stage progression theme

**Effort**: High (requires design work, new assets, restructured rendering)
**Risk**: High (scope expansion, may change visual identity)

---

### Option C: Accessory Badge System (floating UI, not on-emoji)

**Description**: Stop trying to place accessories ON the emoji. Instead, render accessories as floating UI elements positioned around the pet area — a crown badge above, glasses below face area, collar under, toy to the side. The accessories become part of the habitat/UI layer, not anatomically attached.

**Implementation sketch**:
```css
/* Accessories float in fixed zones around the pet, not on it */
.acc-head-zone   { position: absolute; bottom: 75%; left: 50%; transform: translateX(-50%); }
.acc-eyes-zone   { position: absolute; bottom: 58%; left: 50%; transform: translateX(-50%); }
.acc-neck-zone   { position: absolute; bottom: 42%; left: 50%; transform: translateX(-50%); }
.acc-body-zone   { position: absolute; bottom: 30%; left: 50%; transform: translateX(-50%); }
.acc-effect-zone { position: absolute; bottom: 85%; left: 50%; transform: translateX(-50%); animation: effectFloat; }
.acc-toy-zone    { position: absolute; bottom: 20%; left: 80%; }
```

Each "zone" is relative to the pet-hero-zone container, not the pet-wrapper — so they always hit the right visual region regardless of emoji layout.

**Pros**:
- Works identically for all 10 breeds including 🐾 and 🐉 (no anatomy required)
- Zero per-breed configuration
- Simple, predictable CSS
- Very easy to add new breeds or accessories

**Cons**:
- Accessories do NOT appear to be worn by the dog — they float near it
- Breaks the core fantasy of "dressing up your dog"
- Head accessories above the zone won't land ON the emoji's head
- Eyes accessories below the zone won't sit on actual eyes
- Reduces the emotional satisfaction of the accessory system

**Effort**: Low (refactor CSS only)
**Risk**: Low technically, but High product risk (reduces the feature's core value)

---

### Option D: Hybrid — Per-Breed Anchors for Critical Slots Only (head/eyes/neck)

**Description**: Apply per-breed precise anchoring for the 3 visible anatomical slots (head, eyes, neck). For body, effect, and toy — which are ambient/decorative by nature — keep a simpler zone-based approach since they do not need to land on specific anatomy.

This gives 10 breeds × 3 precise slots = **30 configs** instead of 60, plus 3 generic zone rules.

**The rationale**: Head/eyes/neck are anatomical — placing them wrong is obviously wrong. Body (cape, armor) is meant to drape over the torso which is less precise. Effect (sparkles, rainbow) floats ambiguously. Toy sits next to the dog, not on anatomy.

**Implementation sketch**:
```javascript
const BREED_ANCHORS = {
  chihuahua: {
    head: { top: '-18%', left: '50%', sizeMul: 0.42 },
    eyes: { top: '22%',  left: '50%', sizeMul: 0.28 },
    neck: { top: '65%',  left: '50%', sizeMul: 0.26 }
  },
  beagle: {
    head: { top: '5%',   left: '22%', sizeMul: 0.36 },
    eyes: { top: '20%',  left: '24%', sizeMul: 0.24 },
    neck: { top: '38%',  left: '30%', sizeMul: 0.24 }
  },
  poodle: {
    head: { top: '2%',   left: '20%', sizeMul: 0.38 },
    eyes: { top: '22%',  left: '22%', sizeMul: 0.26 },
    neck: { top: '42%',  left: '28%', sizeMul: 0.22 }
  },
  retriever: {
    head: { top: '4%',   left: '24%', sizeMul: 0.36 },
    eyes: { top: '20%',  left: '26%', sizeMul: 0.24 },
    neck: { top: '36%',  left: '32%', sizeMul: 0.24 }
  },
  dalmatian: {
    // Paw print — no anatomy, use abstract aesthetic positions
    head: { top: '-18%', left: '50%', sizeMul: 0.40 },
    eyes: { top: '15%',  left: '35%', sizeMul: 0.28 },
    neck: { top: '65%',  left: '50%', sizeMul: 0.28 }
  },
  husky: {
    head: { top: '-16%', left: '50%', sizeMul: 0.42 },
    eyes: { top: '24%',  left: '50%', sizeMul: 0.28 },
    neck: { top: '66%',  left: '50%', sizeMul: 0.26 }
  },
  shepherd: {
    head: { top: '0%',   left: '20%', sizeMul: 0.38 },
    eyes: { top: '18%',  left: '22%', sizeMul: 0.26 },
    neck: { top: '40%',  left: '28%', sizeMul: 0.22 }
  },
  akita: {
    head: { top: '-18%', left: '52%', sizeMul: 0.42 },
    eyes: { top: '22%',  left: '52%', sizeMul: 0.28 },
    neck: { top: '65%',  left: '52%', sizeMul: 0.26 }
  },
  royal: {
    head: { top: '-22%', left: '50%', sizeMul: 0.45 },
    eyes: { top: '20%',  left: '50%', sizeMul: 0.30 },
    neck: { top: '68%',  left: '50%', sizeMul: 0.28 }
  },
  diamond: {
    // Dragon — head is top-right area
    head: { top: '-10%', left: '65%', sizeMul: 0.40 },
    eyes: { top: '12%',  left: '65%', sizeMul: 0.26 },
    neck: { top: '35%',  left: '55%', sizeMul: 0.24 }
  }
};

// CSS for non-anatomical slots stays generic (zone-based)
// .acc-body   — overlaid center
// .acc-effect — floats above
// .acc-toy    — lower right
```

**Accessory size problem fix**: The current 0.35 multiplier is too small. Correct sizes per slot type:
- Head: 0.40–0.45× dog size (crown should look prominent)
- Eyes: 0.26–0.30× (glasses fit the face)
- Neck: 0.24–0.28× (collar/scarf wraps around neck)
- Body: 0.50× (cape/armor is large by design)
- Effect: 0.38× (sparkles should be noticeable)
- Toy: 0.32× (ball/stick next to dog)

**Pros**:
- Best visual quality for the most visible and emotionally important slots
- Half the configs of full Option A (30 vs 60)
- Body/effect/toy naturally work as ambient elements — zone-based is actually correct for them
- Pure JS/CSS, no new dependencies
- Measurable improvement visible immediately in screenshots

**Cons**:
- Still requires writing 30 configs and testing them
- Dalmatian (paw print) and Dragon require creative workarounds — no true anatomy
- Platform rendering variance means configs calibrated on iOS may be slightly off on Android (typically ±5–10% — acceptable)

**Effort**: Medium-low (30 configs, roughly half the work of Option A)
**Risk**: Low

---

### Option E: Canvas-Based Compositing

**Description**: Render the pet scene onto an HTML `<canvas>` element. Draw the emoji using `ctx.fillText()`, then draw accessory emojis at precise computed coordinates relative to the drawn glyph's bounding box.

**Implementation sketch**:
```javascript
function renderPetCanvas(stage, accessories) {
  const canvas = document.getElementById('petCanvas');
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.6; // dog sits on lower portion

  // Draw dog emoji
  ctx.font = `${stage.size}px sans-serif`;
  ctx.fillText(stage.emoji, cx - stage.size/2, cy);

  // Use measureText for rough bounding
  const metrics = ctx.measureText(stage.emoji);
  // Place accessories relative to measured bounds
  const headY = cy - metrics.actualBoundingBoxAscent - 10;
  ctx.font = `${Math.round(stage.size * 0.4)}px sans-serif`;
  accessories.filter(a => a.slot === 'head').forEach(a => {
    ctx.fillText(a.emoji, cx - 10, headY);
  });
}
```

**Pros**:
- Could theoretically measure actual emoji bounds with `measureText`
- Compositing is pixel-perfect once coordinates are known

**Cons**:
- `measureText` for emoji is unreliable — it measures character advance width, not visual glyph bounds
- Canvas emoji rendering is platform-inconsistent (worse than DOM emoji rendering)
- Tap interactions (onclick) require manual hit-testing — no DOM events on canvas
- Animations (breathing, bouncing) must be redrawn every frame — replaces GPU-composited CSS with JS-driven paint, **destroying performance**
- The existing CSS animation system (petBreath, petHeroBounce, petSway, etc.) cannot be reused
- This is a full rewrite of the rendering layer for no clear gain over Option D

**Effort**: Very High (full rewrite of pet rendering, animation, interaction)
**Risk**: Very High (likely performance regression, complex debugging, breaks existing animations)

---

## Comparison Matrix

| Criteria | A: Full Per-Breed | B: Custom SVG/PNG | C: Badge Zones | D: Hybrid (Critical Slots) | E: Canvas |
|----------|-------------------|-------------------|-----------------|------------------------------|-----------|
| Visual quality (head/eyes/neck) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Visual quality (body/effect/toy) | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Platform reliability | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Implementation effort | ⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| Maintainability | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Performance | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Preserves emoji charm | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Total** | **31** | **24** | **32** | **30** | **13** |

*Note: Option C scores highly on maintainability/effort but its visual quality score is misleading — it fails the core product goal of "dog is wearing the accessory."*

---

## Decision

**Chosen**: Option D — Hybrid Per-Breed Anchors for Critical Slots (head, eyes, neck) + Zone-Based for Ambient Slots (body, effect, toy)

### Rationale

Option D delivers the maximum visual impact for the minimum configuration effort. The decision rests on a key anatomical insight: **not all 6 slots need equal anatomical precision**.

- **Head, eyes, neck** — these are inherently anatomical. A crown floating 5px above the wrong spot is obviously wrong. A collar around the belly looks absurd. These 3 slots *must* be precisely calibrated per breed. That is 30 configs total.

- **Body, effect, toy** — these are inherently ambient. A cape drapes over the whole dog (center body is correct for any breed). Sparkles float around the dog (above-center is always correct). A toy sits next to the dog (lower-right is always correct). Zone-based CSS works well here. No per-breed config needed.

The **accessory size problem is equally important** and is fixed as part of this decision: the current 0.35× multiplier is insufficient. Head accessories should be 0.40–0.45× the dog's font-size. This alone will dramatically improve visual impact.

**Why not Option A (full per-breed)?** The additional 30 configs (body/effect/toy) provide marginal visual improvement for inherently ambient accessories. YAGNI — solve the real problem, not the theoretical one.

**Why not Option B (custom SVG)?** Would require days of illustration work and breaks the emoji-native aesthetic that is the app's visual identity. The emoji dogs are charming *because* they are recognizable platform emoji. This is not the right time to diverge from that.

**Why not Option C (badge zones)?** It solves the implementation problem while making the product problem worse. The core fantasy of the accessory system is "my dog is wearing a crown." Badge zones make it "there is a crown floating near my dog." That destroys the feature.

**Why not Option E (canvas)?** Performance regression, animation regression, full rewrite, and unreliable emoji measurement. All cost, no benefit over Option D.

---

## Consequences

### Positive
- Head/eyes/neck accessories will visually land on the dog's actual head, eyes, and neck area for 8 of 10 breeds
- Accessories will feel appropriately sized (larger and more visible)
- The "dressing up" fantasy is fulfilled for the most emotionally important slots
- Zero performance impact — the approach is a lookup table + inline styles
- No new dependencies, no build changes, fits within the existing architecture

### Negative (Trade-offs Accepted)
- Dalmatian (🐾) and Diamond Dog (🐉) cannot have truly anatomical placement — their emoji have no conventional dog anatomy. Creative aesthetic positioning will be used (above the glyph for head, at visual center for eyes, below for neck).
- Platform rendering variance (iOS Apple Color Emoji vs Android Noto Color Emoji) means configs calibrated on one platform will be ±5–10% off on another. This is acceptable — accessories will still be in the right "zone."
- 30 configs must be maintained and re-checked if emoji designs change in OS updates (very rare — once per year at most, and changes are usually minor).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| iOS/Android rendering offset difference makes configs wrong on one platform | Medium | Medium | Test on both platforms before shipping. Use slightly more forgiving sizes (larger accessories are more tolerant of small position errors). |
| Future breed addition requires new anchor config | High (certainty — it will happen) | Low | The BREED_ANCHORS lookup table is easy to extend. Document the pattern in code comments. |
| Emoji OS update changes glyph proportions | Low | Low | The configs use percentage-based offsets which are proportionally stable across minor glyph changes. |
| Dalmatian (paw) accessory placement looks absurd | Low | Medium | Paw print is an abstract stage. Place head accessory above the glyph, eyes in center. Players understand the paw is a symbol, not a literal dog. |

---

## Implementation Guidance

### Approach

The implementation is a surgical modification to two files: `js/home.js` and `css/styles.css`.

#### Step 1: Add BREED_ANCHORS lookup table to `js/home.js`

Place immediately after the `DOG_ACCESSORIES` constant (around line 513):

```javascript
// Per-breed anchor points for anatomical accessory slots (head, eyes, neck).
// Values are CSS percentages relative to the pet-wrapper bounding box.
// sizeMul: multiplier applied to stage.size to get the accessory font-size.
// Platform note: Apple Color Emoji and Noto Color Emoji render at ~75% of em-square.
// Offsets account for this — the pet-wrapper box equals font-size px, but the
// visual glyph occupies roughly the inner 75%, offset slightly from the box top.

const BREED_ANCHORS = {
  // --- Frontal face breeds --- (head is centered and large)
  chihuahua: {
    head:   { top: '-20%', left: '50%', sizeMul: 0.44 },
    eyes:   { top:  '22%', left: '50%', sizeMul: 0.28 },
    neck:   { top:  '65%', left: '50%', sizeMul: 0.26 }
  },
  husky: {
    head:   { top: '-18%', left: '50%', sizeMul: 0.44 },
    eyes:   { top:  '24%', left: '50%', sizeMul: 0.28 },
    neck:   { top:  '66%', left: '50%', sizeMul: 0.26 }
  },
  akita: {
    // Fox face — slightly right of center, pointed ears shift head up
    head:   { top: '-22%', left: '52%', sizeMul: 0.44 },
    eyes:   { top:  '22%', left: '52%', sizeMul: 0.28 },
    neck:   { top:  '66%', left: '52%', sizeMul: 0.26 }
  },
  royal: {
    // Lion face — mane is very wide, head center is high
    head:   { top: '-24%', left: '50%', sizeMul: 0.48 },
    eyes:   { top:  '18%', left: '50%', sizeMul: 0.30 },
    neck:   { top:  '64%', left: '50%', sizeMul: 0.28 }
  },

  // --- Side-profile full-body breeds --- (head is top-left quadrant)
  beagle: {
    head:   { top:   '4%', left: '22%', sizeMul: 0.38 },
    eyes:   { top:  '20%', left: '24%', sizeMul: 0.24 },
    neck:   { top:  '36%', left: '30%', sizeMul: 0.22 }
  },
  poodle: {
    // Pom-pom head slightly higher and further left
    head:   { top:  '-2%', left: '18%', sizeMul: 0.40 },
    eyes:   { top:  '20%', left: '20%', sizeMul: 0.24 },
    neck:   { top:  '40%', left: '26%', sizeMul: 0.20 }
  },
  retriever: {
    head:   { top:   '4%', left: '24%', sizeMul: 0.38 },
    eyes:   { top:  '20%', left: '26%', sizeMul: 0.24 },
    neck:   { top:  '36%', left: '32%', sizeMul: 0.22 }
  },
  shepherd: {
    head:   { top:   '2%', left: '20%', sizeMul: 0.38 },
    eyes:   { top:  '18%', left: '22%', sizeMul: 0.24 },
    neck:   { top:  '38%', left: '28%', sizeMul: 0.20 }
  },

  // --- Abstract/non-dog breeds --- (creative aesthetic placement)
  dalmatian: {
    // Paw print: place head above center pad, eyes at center, neck below
    head:   { top: '-22%', left: '50%', sizeMul: 0.42 },
    eyes:   { top:  '10%', left: '35%', sizeMul: 0.26 },
    neck:   { top:  '62%', left: '50%', sizeMul: 0.26 }
  },
  diamond: {
    // Dragon: head is top-right, neck area follows down-right
    head:   { top:  '-8%', left: '68%', sizeMul: 0.40 },
    eyes:   { top:  '10%', left: '65%', sizeMul: 0.24 },
    neck:   { top:  '30%', left: '58%', sizeMul: 0.22 }
  }
};

// Slot multipliers for ambient (non-anatomical) slots — same for all breeds
const AMBIENT_SLOT_SIZES = {
  body:   0.52,  // Cape/armor should be large
  effect: 0.38,  // Sparkles/rainbow — noticeable but not dominating
  toy:    0.32   // Ball/stick next to dog
};
```

#### Step 2: Update the accessory rendering in `renderWordPet()`

Replace lines 742–748 (the accSpans generation):

```javascript
// Active accessories — per-breed anchor points for anatomical slots
const active = appState.activeAccessories || [];
const anchors = BREED_ANCHORS[stage.stageCss] || BREED_ANCHORS.chihuahua;

const accSpans = active.map(id => {
    const acc = DOG_ACCESSORIES.find(a => a.id === id);
    if (!acc) return '';

    let styleStr;
    if (anchors[acc.slot]) {
        // Anatomical slot: use per-breed anchor
        const a = anchors[acc.slot];
        const sz = Math.max(18, Math.round(stage.size * a.sizeMul));
        styleStr = `font-size:${sz}px;top:${a.top};left:${a.left};transform:translateX(-50%)`;
    } else {
        // Ambient slot: use CSS class-based zone (body/effect/toy)
        const sz = Math.max(18, Math.round(stage.size * (AMBIENT_SLOT_SIZES[acc.slot] || 0.35)));
        styleStr = `font-size:${sz}px`;
    }
    return `<span class="pet-accessory acc-${acc.slot}" style="${styleStr}">${acc.emoji}</span>`;
}).join('');
```

#### Step 3: Update CSS for ambient slots in `css/styles.css`

The CSS for `.acc-body`, `.acc-effect`, `.acc-toy` needs improvement. `.acc-head`, `.acc-eyes`, `.acc-neck` become fallback-only (inline styles from JS take precedence):

```css
/* Accessory positions */
.pet-wrapper {
    position: relative;
    display: inline-block;
}
.pet-accessory {
    position: absolute;
    pointer-events: none;
    z-index: 2;
    line-height: 1;
}

/* Anatomical slots — JS inline styles will override these for precise breeds.
   These are fallbacks if BREED_ANCHORS lookup fails. */
.pet-accessory.acc-head   { top: -18%; left: 50%; transform: translateX(-50%); }
.pet-accessory.acc-eyes   { top: 24%;  left: 50%; transform: translateX(-50%); }
.pet-accessory.acc-neck   { top: 64%;  left: 50%; transform: translateX(-50%); }

/* Ambient slots — zone-based, same for all breeds */
.pet-accessory.acc-body   {
    top: 20%; left: 50%;
    transform: translateX(-50%);
    z-index: 0;
    opacity: 0.85;
}
.pet-accessory.acc-effect {
    top: -20%; left: 50%;
    transform: translateX(-50%);
    animation: effectFloat 2.5s ease-in-out infinite;
}
.pet-accessory.acc-toy    {
    bottom: -8%; right: -8%;
    transform: rotate(15deg);
}
```

### Key Considerations

1. **Testing approach**: The fastest calibration workflow is to set each breed as current (`appState.dogLevel = 11` etc.) in DevTools console, equip a head accessory, and visually verify on the device. Take screenshots at each breed stage. The `data-stage` attribute on `.pet-creature` makes this easy to target.

2. **Emoji font variance**: After initial calibration on one platform, test on the other. If an offset is >10% off, average the two values. Both platforms will then be slightly imperfect but acceptably accurate. Accept ±8% as the tolerance threshold.

3. **Accessory z-index**: The `acc-body` slot should render **behind** the dog emoji (z-index: 0 vs dog's default). The `acc-head`, `acc-eyes`, `acc-neck`, `acc-effect` slots should render **in front** (z-index: 2). The `acc-toy` sits next to the dog, so z-index doesn't matter much.

4. **The 75% em-square rule**: When calibrating, remember the visual glyph occupies ~75% of the `font-size` box. A dog at `font-size: 100px` has its visual body spanning roughly `y: 10px` to `y: 85px` (with ~10px internal top padding, ~5px bottom). Percentage offsets in CSS `top` are relative to the outer box (100px), not the visual glyph. So `top: 10%` = `10px` from box top ≈ start of visual glyph.

5. **The side-profile breeds (Beagle, Poodle, Retriever, Shepherd)**: These are walking-left dogs. The head occupies roughly the left 30% of the glyph width. Setting `left: 22%` (with `transform: translateX(-50%)`) centers the accessory over the head zone. Fine-tune per breed — Poodle's pom-pom head has a distinct raised shape.

### Dependencies

- No new dependencies
- Requires `BREED_ANCHORS` to be defined before `renderWordPet()` is called — placement after `DOG_ACCESSORIES` constant satisfies this
- `AMBIENT_SLOT_SIZES` must also be defined before `renderWordPet()`

### Success Criteria

- [ ] Crown (🎩 head slot) appears on or immediately above the dog's head on 🐶, 🐺, 🦊, 🦁 (frontal breeds)
- [ ] Crown appears over the left-quadrant head area on 🐕, 🐩, 🦮, 🐕‍🦺 (profile breeds)
- [ ] Sunglasses (👓 eyes slot) appear near the dog's eye area on frontal breeds
- [ ] Scarf (🧣 neck slot) appears below the dog's head/chin on all breeds
- [ ] Accessories are visibly larger and more prominent than current (0.35× → 0.40–0.44×)
- [ ] Effects (✨ effect slot) float visibly above the dog with animation
- [ ] Toy (🎾 toy slot) appears to the side of/below the dog
- [ ] Visual check passes on both iOS Safari and Chrome Android

---

## Breed Anchor Data Summary (for implementation reference)

| Breed | Head Top | Head Left | Eyes Top | Eyes Left | Neck Top | Neck Left |
|-------|----------|-----------|----------|-----------|----------|-----------|
| chihuahua 🐶 | -20% | 50% | 22% | 50% | 65% | 50% |
| beagle 🐕 | 4% | 22% | 20% | 24% | 36% | 30% |
| poodle 🐩 | -2% | 18% | 20% | 20% | 40% | 26% |
| retriever 🦮 | 4% | 24% | 20% | 26% | 36% | 32% |
| dalmatian 🐾 | -22% | 50% | 10% | 35% | 62% | 50% |
| husky 🐺 | -18% | 50% | 24% | 50% | 66% | 50% |
| shepherd 🐕‍🦺 | 2% | 20% | 18% | 22% | 38% | 28% |
| akita 🦊 | -22% | 52% | 22% | 52% | 66% | 52% |
| royal 🦁 | -24% | 50% | 18% | 50% | 64% | 50% |
| diamond 🐉 | -8% | 68% | 10% | 65% | 30% | 58% |

*All sizeMul values: head 0.38–0.48, eyes 0.24–0.30, neck 0.20–0.28 (see BREED_ANCHORS for per-breed)*

---

## Open Questions

- [ ] Should the Dalmatian stage (🐾) display a note in the shop indicating accessories are "decorative" since the paw has no anatomy? Or just silently do creative placement?
- [ ] Should the Dragon stage (🐉) accessories lean into the dragon fantasy (place crown over the "horns" area) or try to follow standard dog-like conventions?
- [ ] After device testing, some anchor values will need tuning. Should there be a hidden debug mode (e.g., `?debug=anchors` URL param) that shows anchor crosshairs?

---

## Handoff

### For @planner:

Create implementation plan based on this decision. The plan needs:
1. Write `BREED_ANCHORS` and `AMBIENT_SLOT_SIZES` constants in `js/home.js` (after `DOG_ACCESSORIES`)
2. Refactor the `accSpans` generation block in `renderWordPet()` to use the anchor lookup
3. Update `css/styles.css` accessory slot rules (ambient slots only — anatomical become fallbacks)
4. Manual QA step: cycle through all 10 breeds, equip head/eyes/neck accessories, screenshot

Command:
"@planner create plan from docs/decisions/2026-03-10-accessory-fitting-decision.md"

---

*Decision document by brainstormer-agent on 2026-03-10*
