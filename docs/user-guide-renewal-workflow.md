# User Guide: End-to-End Flow (RC-ACCT-1016)

This guide walks through the complete self-serve flow using the seeded example:

- Renewal Case Number: `RC-ACCT-1016`
- Renewal Case ID: `rcase_aster_commerce`
- Baseline Quote Number: `Q-ACCT-1016`
- Baseline Quote Draft ID: `qd_aster_commerce`

For a narrated, step-by-step recording flow, use:

- `docs/demo-recording-runbook-rc-acct-1016.md`

## 1. Start the app

From repo root:

```bash
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:3000` (or the fallback port shown in terminal).

![Dashboard](assets/user-guide/01-dashboard.png)

## 2. Step 0 (Recommended): Policy Studio

Go to `Policy Studio` from the sidebar (`/policies`).

What to review:

1. `Seed Data Context` for snapshot coverage and trend mix.
2. `Example Subscription` selector to switch among seeded subscriptions.
3. `Business Interpretation` plus `How the engine works under the hood (business view)`.
4. `Signal Trajectory` to see historical shifts across snapshot dates.
5. `Technical calculation breakdown (optional)` for full formula-level traceability.

![Policy Studio](assets/user-guide/07-policy-studio.png)

## 3. Step 1: Renewal Subscriptions

Go to `Renewal Subscriptions` from the sidebar (`/renewal-cases?view=list`).

What to do:

1. Find Aster Commerce account rows.
2. Expand an account to review baseline subscription lines.
3. Confirm this baseline context before decisioning.

![Renewal Subscriptions](assets/user-guide/02-renewal-subscriptions.png)

## 4. Step 2: Case Decision Board

Go to `Case Decision Board` (`/renewal-cases`).

What to do:

1. Expand relevant storyboard lanes.
2. Find case `RC-ACCT-1016`.
3. Open the case page from the row link.

![Case Decision Board](assets/user-guide/03-case-decision-board.png)

## 5. Run case workflow for RC-ACCT-1016

Open: `/renewal-cases/rcase_aster_commerce`

What to do in Section A:

1. Keep scenario selection at `BASE_CASE` for first run.
2. Click `Run End-to-End AI Workflow`.
3. Watch `AI Live Run Console`:
   - typed streaming reasoning
   - step-by-step progress
   - workflow summary

Then review:

1. Section B `What Changed`.
2. Section C `Quote Insights` and apply selected actions to the Baseline Quote.
3. If needed, click `Regenerate Insights + AI Rationale` to refresh narratives for the latest run.

![Case Decision Workspace](assets/user-guide/04-case-decision-workspace.png)

## 6. Step 3: Scenario Quotes

Open: `/scenario-quotes/rcase_aster_commerce`

What to do:

1. Let the page auto-generate scenarios on load (default behavior when baseline and insights are ready).
2. Click `Regenerate Quote Scenarios` only if scenarios are stale or you want a fresh run.
3. Select a scenario in `Scenario Quote Navigator`.
4. Review:
   - `What Changed Commercially`
   - line-level comparison vs baseline
5. Click `Mark as Preferred Scenario` if appropriate.

Note:

- Scenario quotes are read-only compare artifacts.
- Baseline Quote remains the editable quote source.

![Scenario Quotes](assets/user-guide/05-scenario-workspace.png)

## 7. Step 4: Quote Draft Board

Open board: `/quote-drafts`

What to do:

1. Find `Q-ACCT-1016` and review the row-level scenario cues next to `Open Scenario Quotes`:
   - `N Scenarios` (generated count)
   - `Refresh Needed` (appears when scenario data is stale)
2. Open quote detail: `/quote-drafts/qd_aster_commerce`.
3. Review `What Changed From Baseline`.
4. Use line filters (`All`, `Changed + AI`, `Baseline Only`) and expansion controls.
5. Use `Decision Actions` to approve/reject/request revision for this quote draft.

Important:

- Decisions are quote-scoped (not subscription-case scoped).

![Quote Draft Board](assets/user-guide/06-quote-draft-review.png)

## 8. Verify completion

After decision:

1. Return to `Case Decision Board` case page and check review history.
2. Confirm quote status on `Quote Draft Board` (`/quote-drafts`).
3. Keep preferred scenario selection for audit context if needed.

## Troubleshooting

- If you see stale-chunk runtime errors:

```bash
rm -rf .next
npm run dev
```

- If data looks unexpected, reseed:

```bash
npm run db:reset:clean
```
