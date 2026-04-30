# Seed Data

This folder contains synthetic reference and scenario data for the Subscription Renewal Copilot demo.
The records are intentionally business-readable so seeded data can be used directly in walkthroughs without explaining fixture internals.

## Demo Case Mix

- Apex / Vertex — low-risk renewal and controlled-uplift examples
- BluePeak / SummitOne / Redwood / Horizon — retention, concession, and defensive-renewal examples
- Lumina / ArcLight — expansion-led renewals
- Harbor / Crestview / Meridian / NovaCare / Skyline — cross-sell and deployment-fit examples
- Aster / Helio / Quantum — mixed action plans with margin recovery, concession, expansion, and add-on motions

## Demo Language

- Pricing policies use current guardrail vocabulary: auto-discount limit, approval threshold, floor-price threshold, expansion threshold, and Sev1 escalation threshold.
- Quote insights should read as reviewer guidance, not seed-fixture metadata.
- Structured evidence in `justificationJson` should explain subscription, risk, pricing, and product-fit signals in business terms.

## Load order

The Prisma seed loader inserts data in this dependency-safe order:

1. accounts
2. products
3. pricing policies
4. subscriptions
5. subscription metric snapshots
6. renewal cases
7. renewal case items
8. renewal case analyses
9. renewal case item analyses
10. quote drafts
11. quote draft lines
12. review decisions
13. recommendation narratives
14. quote insights
15. materialized scenario quotes
