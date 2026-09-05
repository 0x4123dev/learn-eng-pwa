# Design QA — Night Raid isometric home and combat

## Sources and evidence

- Primary reference: `/Users/chuzon/Downloads/IMG_4332.jpg`
- Combat reference: `/Users/chuzon/Downloads/IMG_4330.jpg`
- Phone implementation: `tmp/night-raid-pet-3d-fight.png` at 390 × 844
- Combined comparison: `tmp/night-raid-design-comparison.jpg`
- Isometric board art: `img/night-raid/isometric-home-board-skin-pad.webp`
- 3D raider art: `img/night-raid/raider-squad.webp`

## Visual comparison

- The builder and battle now share the reference's bright, premium isometric diorama language: a square floating garden, dense trees and flowers, a pond, workshop, quarry, granary, stone borders, paths, and a large castle pad.
- The target's real castle skin occupies the upper-left pad. Paid skins render from the castle atlas; structural damage remains visible when combat resolves.
- The attacking party is a cohesive set of polished 3D toy-like characters rather than canvas blobs. The clash uses concentrated yellow-white sparks at the gate, matching the combat reference.
- The user's pet is a breed-matched 3D four-legged runner selected from two ten-breed atlases. Its combat scale matches one raider, while compact name and level badges preserve identity. QA used Milo, level 86, English Bulldog.
- HUD and primary command remain outside the artwork, keeping the scene readable and the one-tap interaction obvious.

## Responsive and interaction checks

- iPhone 390 × 844: passed. Full map, pet, army, castle, DAM/DEF HUD and fixed command are visible without horizontal scrolling.
- iPad 1024 × 1366: passed. The square map is capped at 800px and centered rather than stretched.
- Ready state: pet and ten raiders gather inside the lower-right map boundary.
- Fighting state: one `TIẾN QUÂN` tap disables the command, moves the entire formation to the castle, animates the real pet leader, and shows clash sparks.
- DOM accessibility exposes the battle summary, the pet's breed/name/level, a live status, and a labeled retreat control.
- Reduced-motion mode removes continuous pet bobbing and movement transitions while preserving the result.

## Automated verification

- Full suite after implementation: 9,964 passed after fixing the two reported regressions; both corrected checks now pass.
- Focused iPad suite: 101 passed.
- Focused cache/integrity suite: 153 passed.
- Night Raid rules, API and UI suites pass.

final result: passed

## Armored pet formation + interactive home map QA — 2026-08-20

- Replaced the realistic pet cutouts with two new five-breed atlases in the same blue/gold polished 3D toy style as the attacking army. All ten dog levels retain their correct breed.
- The pet is now painted inside the canvas depth order rather than floating as a DOM overlay. Milo (English Bulldog, level 86) is visually the size of one small soldier, leads from the front-left, and follows the same gradual march/fight/retreat path as the squad.
- Increased the visible raid from 10 to 18 soldiers, added a staggered road formation, march dust and a denser spark cluster to match the supplied 3.68-second battle reference.
- The home map supports one-finger panning, two-finger pinch zoom from 40–165%, keyboard/touch ± controls, and focal-point-preserving zoom.
- Shop is permanently discoverable at the upper-right, clear of the bottom navigation. Existing buildings expose descriptive drag handles and can be moved to any free same-layer grid cell without repurchase.
- Browser QA passed for ready, mid-march and Shop-open states. Zoom label updated from 100% to 115%; the 12 × 12 grid and purchased items stayed aligned after zoom.
- Full automated suite: 9,975 passed.

final result: passed

## 3D defensive army QA — 2026-08-20

- Replaced the temporary canvas primitives in combat with the exact polished 3D assets shown in the Shop and home builder: Pebble Pup, Wooden Fence, Stone Wall, Spike Trap and Water Cannon.
- Defense art now has consistent isometric perspective, transparent cutout edges, soft ground shadows, damage cracks, HP bars and a clear toppled/faded defeated state.
- Water Cannon is mirrored in battle so its barrel faces the incoming army.
- iPhone 390 × 844: defenders remain distinct beside the castle and do not cover the attack formation or fixed battle controls.
- iPad 1024 × 1366: all four visible above-ground defenses render sharply at the 800 × 800 battle canvas size and match the attacker squad's 3D toy style.
- The battle and builder reuse one asset set, so the object a player buys is the object that appears during defense.

final result: passed

## Full-screen home builder QA — 2026-08-20

- Removed the five “guard dog area” controls from the builder. Dog lane remains internal combat data only.
- Replaced the compact card with a full-screen, pannable 12 × 12 home world. Existing five-lane saves migrate deterministically without losing buildings or changing DAM/DEF.
- The build grid is hidden during normal viewing and appears when Shop is open, an item is selected, or an item is dragged.
- Shop is a floating, touch-sized control and opens a compact bottom tray. Both direct drag-and-drop and the accessible tap-item-then-tap-cell fallback purchase and place correctly.
- iPhone 390 × 844: 1180 × 1180 map scrolls horizontally and vertically; document overflow is zero. A placed Water Cannon deducted 500 coins and added 50 DAM.
- iPad 1024 × 1366: home world uses the complete viewport with a 1434 × 1434 pannable map; document overflow is zero. A real pointer drag placed Pebble Pup and deducted 250 coins.
- HUD, Shop, focus rings, safe-area insets, reduced motion and 44px+ controls remain visible and usable above the world.

final result: passed

## Toán 4 Pre perfect-score reward QA — 2026-09-05

- A 10/10 result shows a separate reward card immediately below the normal coin summary, without covering the score, review area or `Xong` button.
- The card names the reason (`Thưởng đúng 100%`), amount (`+100 xu`) and scope (`Toán 4 Pre`).
- Gold/cream styling reuses the existing coin-reward visual language and remains readable on a phone.
- Imperfect Toán 4 Pre results and perfect results from every other Maths chapter do not render or pay this bonus.
- Focused Toán 4 suite: 44/44 passed; integrated verification: 267/267 passed; full suite: 11,819/11,819 passed.

final result: passed
