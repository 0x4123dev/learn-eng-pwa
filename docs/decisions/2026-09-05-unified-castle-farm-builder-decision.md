# Unified castle and farm builder

## Decision

The Daily Task “Xem vườn” entry opens this unified screen in its normal viewing state. It must not carry over edit mode, show the placement grid, or reopen the shop; the child explicitly enters placement mode with the Sửa button.

Render the castle board and every purchased farm plot in one pannable, zoomable meadow. Remove the castle/farm tab switcher.

Keep each farm as a separate logical zone in persisted data so planting, harvesting, anti-minting checks, and combat rules remain unchanged. Add sanitized `x` and `y` placement coordinates to each farm for its visual position around the castle.

Every visible cell carries its zone id. Shop drag/drop, tap placement, harvesting, and moving an existing item resolve the destination from that cell instead of from a global selected tab. Farm plots themselves get an edit-mode drag handle and snap to the meadow coordinate grid.

## Constraints

- Existing saves without farm coordinates receive stable default positions.
- At most three farm plots remain allowed.
- Defenses are valid only on the castle board; crops and farm decorations work on both castle and farm boards.
- Touch controls remain at least 44px and keyboard-accessible.
- The server normalizes plot coordinates before persistence.
