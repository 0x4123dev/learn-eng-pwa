# Code review: defense pricing and garden entry

Approved.

The price change stays in the shared immutable catalog already consumed by the UI and purchase calculations, so there is no duplicated client price. The Daily Task link now delegates to the normal Night Raid entry point, and that entry point explicitly clears transient edit/shop state before rendering. Existing placed layouts remain compatible. Regression coverage asserts all requested prices and the clean-entry behavior.
