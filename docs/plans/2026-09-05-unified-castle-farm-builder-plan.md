# Unified castle and farm builder implementation plan

- Ensure every normal entry into Night Raid resets edit/shop state so Daily Task “Xem vườn” displays the clean main map.
- Replace free-positioned isometric farm plots with axis-aligned square plots and eight shared snap docks immediately outside the castle boundary.
- During pointer drag, expose all dock grids, highlight the nearest legal target, reject occupied targets, then persist the snapped dock coordinates.

1. Extend layout normalization with bounded, deterministic farm plot positions and tests for legacy saves.
2. Replace the active-zone-only builder markup with a castle grid plus all farm grids in one estate map; remove zone tabs.
3. Route cell actions and shop drops using explicit zone ids.
4. Add edit-mode farm plot dragging with snapping, collision feedback, persistence, and accessible controls.
5. Update responsive CSS so plots read as land around the castle and remain usable on touch screens.
6. Update builder/server/UI tests, run the complete test and verification suites, then deploy and validate the live flow in a browser.
