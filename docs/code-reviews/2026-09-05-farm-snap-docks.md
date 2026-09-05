# Code review: farm snap docks

Approved.

Dock coordinates are centralized in the renderer-free shared rules module, so browser and server normalize positions identically. Legacy free-form positions migrate to the nearest distinct dock without touching farm contents. Drag state is transient and always cleaned on pointer up/cancel. The CSS guide provides color, border style, and occupancy feedback, retains a 44px handle, and disables transitions for reduced-motion users.
