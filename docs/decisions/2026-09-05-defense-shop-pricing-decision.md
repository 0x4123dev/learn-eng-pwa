# Defense shop pricing decision

## Decision

The four placeable castle defenses use fixed prices above the 2,000-xu Pebble Pup baseline:

- Wooden Fence: 3,000 xu
- Stone Wall: 5,000 xu
- Spike Trap: 3,000 xu
- Water Cannon: 5,000 xu

These values follow the product-requested 1,000-xu steps and reflect the larger DEF/DAM contribution of Stone Wall and Water Cannon. `NightRaidRules.DEFENSES` remains the single price source used by the shop, purchase confirmation, local wallet deduction, upgrade cost, refunds, and server layout validation.

## Compatibility

Existing placed defenses are unchanged. Only future purchases, replacements, upgrades, and refunds use the new catalog prices.
