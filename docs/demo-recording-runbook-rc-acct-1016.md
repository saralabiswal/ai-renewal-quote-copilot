# Demo Recording Runbook: RC-ACCT-1016

Use this for a clean, repeatable, step-by-step video recording that supplements the user guide.

- Renewal Case Number: `RC-ACCT-1016`
- Renewal Case ID: `rcase_aster_commerce`
- Baseline Quote Draft ID: `qd_aster_commerce`
- Target runtime: `6-9 minutes`

## 1. Recording Prep (2-3 min)

Run from repo root:

```bash
npm run db:seed
rm -rf .next
npm run dev
```

Open app at:

- `http://localhost:3000`

Recording hygiene checklist:

1. Use one browser tab only.
2. Use desktop viewport (at least 1440 px wide).
3. Hide bookmarks/extensions and enable Do Not Disturb.
4. Keep zoom at 100%.
5. Pause 1 second after each navigation before speaking.

## 2. Suggested Video Structure (Timestamped)

## 0:00-0:30 Intro

Screen:

1. Open dashboard (`/`).

Talk track:

1. “This demo walks a full renewal decision lifecycle for case RC-ACCT-1016 from baseline subscriptions to final quote decision.”

## 0:30-1:30 Step 0: Policy Studio (How it works under the hood)

Screen:

1. Open `Policy Studio` (`/policies`).
2. Show `Seed Data Context`.
3. Show `How the engine works under the hood (business view)`.
4. Show `Signal Trajectory`.
5. Change `Example Subscription` once to prove dynamic context.

Talk track:

1. “Policy Studio explains why recommendations are made using real seeded signals.”
2. “We can see trend direction, risk contribution, and guardrail impact before touching a quote.”

## 1:30-2:15 Step 1: Renewal Subscriptions

Screen:

1. Open `/renewal-cases?view=list`.
2. Locate Aster Commerce and expand baseline subscription rows.

Talk track:

1. “This is baseline commercial context, before AI workflow actions.”

## 2:15-3:00 Step 2: Case Decision Board

Screen:

1. Open `/renewal-cases`.
2. Locate `RC-ACCT-1016`.
3. Open case detail `/renewal-cases/rcase_aster_commerce`.

Talk track:

1. “Now we move from portfolio view to case-level decision workspace.”

## 3:00-4:30 Step 3: Run AI Workflow

Screen:

1. Keep scenario as `BASE_CASE`.
2. Click `Run End-to-End AI Workflow`.
3. Keep cursor still and let `AI Live Run Console` stream.
4. Show completion summary.

Talk track:

1. “This is the AI moment: live workflow steps and typed reasoning as the case is recalculated.”
2. “The run refreshes recommendation posture, quote insights, and narratives.”

## 4:30-5:30 Step 4: Review What Changed + Apply Insights

Screen:

1. In Section B, show `What Changed`.
2. In Section C, open top quote insights and show `Decision`, `Why`, and `AI Added Context`.
3. Apply one insight to quote (if not already applied).

Talk track:

1. “This section makes decision traceability explicit, including commercial change and rationale.”

## 5:30-6:30 Step 5: Scenario Workspace

Screen:

1. Open `/scenario-quotes/rcase_aster_commerce`.
2. Click `Regenerate Quote Scenarios` (only if needed).
3. Select one scenario in navigator.
4. Show `What Changed Commercially` and line-level comparison.
5. Mark a preferred scenario.

Talk track:

1. “Scenario quotes are compare-only options; baseline quote remains the execution source.”

## 6:30-7:30 Step 6: Quote Draft Board + Final Decision

Screen:

1. Open `/quote-drafts/qd_aster_commerce`.
2. Show `What Changed From Baseline`.
3. Show line detail controls (`Changed + AI`, expand/collapse).
4. Use `Decision Actions` (Approve/Reject/Revision) as desired.

Talk track:

1. “Final governance is quote-scoped, with full traceability back to insights.”

## 7:30-8:00 Close

Screen:

1. Optionally return to `/renewal-cases/rcase_aster_commerce`.
2. Show review history/status confirmation.

Talk track:

1. “That completes the loop from policy logic to quote-level decision outcome.”

## 3. Backup / Recovery Lines During Recording

If any panel is stale:

1. Say: “I’ll refresh the latest AI context for accuracy.”
2. Click `Regenerate Insights + AI Rationale`.

If scenario cards are empty:

1. Say: “I’ll generate scenario options for comparison.”
2. Click `Regenerate Quote Scenarios`.

If Next runtime cache error appears:

```bash
rm -rf .next
npm run dev
```

## 4. Post-Recording QA Checklist

1. Confirm all 4 flow steps were shown: Subscriptions -> Case Decision -> Scenario Quotes -> Quote Draft.
2. Confirm AI Live typed streaming moment is clearly visible.
3. Confirm one applied insight is shown in quote traceability.
4. Confirm scenario comparison and preferred scenario are visible.
5. Confirm final quote decision action is shown.
