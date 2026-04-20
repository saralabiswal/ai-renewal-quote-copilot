# Seed Data

This folder contains synthetic reference and scenario data for the Subscription Renewal Copilot demo.

## Scenarios

- BluePeak Logistics — low-risk renewal
- Redwood Health Systems — retention with targeted concession
- Northstar Retail Holdings — expansion-led renewal
- SummitOne Financial Services — escalation / approval-heavy renewal

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
