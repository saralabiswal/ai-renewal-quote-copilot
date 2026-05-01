# Demo Recording Runbook: RC-ACCT-1016

Use this runbook for a consistent, repeatable, step-by-step recording that supplements the user guide.

- Renewal Case Number: `RC-ACCT-1016`
- Renewal Case ID: `rcase_aster_commerce`
- Baseline Quote Draft ID: `qd_aster_commerce`
- Target runtime: `6 to 9 minutes`

## 1. Recording Preparation (2 to 3 minutes)

Run from repo root:

```bash
npm run db:reset
rm -rf .next
npm run dev
```

Open app at:

- `http://localhost:3000`

Recording quality checklist:

1. Use one browser tab only.
2. Use desktop viewport (at least 1440 px wide).
3. Hide bookmarks/extensions and enable Do Not Disturb.
4. Keep zoom at 100%.
5. Pause one second after each navigation before speaking.
6. Confirm `Settings` shows:
   - Recommendation: `ML-Assisted Rules`
   - Governance Role: `AI Governance Admin`
   - Guarded LLM: `LLM-Assisted Guarded`

## 2. Suggested Recording Structure (Timestamped)

## 0:00-0:30 Intro

Screen:

1. Open dashboard (`/`).

Talk track:

1. “This demo walks a full renewal decision lifecycle for case RC-ACCT-1016 from baseline subscriptions to final quote decision.”

## 0:30-1:30 Step 0: Policy Studio (Logic Transparency)

Screen:

1. Open `Policy Studio` (`/policies`).
2. Show `Seed Data Context`.
3. Show `How the engine works under the hood (business view)`.
4. Show `Signal Trajectory`.
5. Change `Example Subscription` once to prove dynamic context.
6. Open `Prompt Governance` and show `Current LLM Prompts`.

Talk track:

1. “Policy Studio explains why recommendations are produced using seeded business signals.”
2. “We can review trend direction, risk contribution, guardrail impact, and the exact current LLM prompt.”

## 1:30-2:15 Step 1: Renewal Subscriptions

Screen:

1. Open `/renewal-cases?view=list`.
2. Locate Aster Commerce and expand baseline subscription rows.

Talk track:

1. “This is baseline commercial context, before AI workflow actions.”

## Optional Setup Cutaway: Decisioning Setup

Screen:

1. Open `Settings`.
2. Switch to `Technical View`.
3. Show the 1-2-3 settings tabs:
   - `Recommendation`
   - `Role`
   - `Guarded LLM`
4. Show the selected settings summary.

Talk track:

1. “The runtime posture is explicit: ML-assisted recommendation scoring, governance-admin authority, and validator-gated LLM assistance. Pricing and approvals remain deterministic.”

## 2:15-3:00 Step 2: Renewal Command Center

Screen:

1. Open `/renewal-cases`.
2. Locate `RC-ACCT-1016`.
3. Open case detail `/renewal-cases/rcase_aster_commerce`.

Talk track:

1. “This transitions from portfolio context to case-level decision execution.”

## 3:00-4:30 Step 3: Run AI Workflow

Screen:

1. Keep scenario as `BASE_CASE`.
2. Click `Run End-to-End AI Workflow`.
3. Keep cursor still and let `AI Live Run Console` stream.
4. Show completion summary.

Talk track:

1. “This is the live AI execution sequence, with typed streaming output as each workflow step runs.”
2. “The run refreshes recommendation posture, quote insights, and review narratives.”

## 4:30-5:30 Step 4: Review What Changed + Apply Insights

Screen:

1. In Section B, show `What Changed`.
2. In Section C, open top quote insights and show `Decision`, `Why`, and `AI Added Context`.
3. In a Quote Insight card, click `View Prompt Used` and show:
   - exact `System Prompt`
   - exact `Input Sent To LLM`
4. Apply one insight to quote (if not already applied).

Talk track:

1. “This section makes decision traceability explicit, including commercial change, rationale, and exact prompt context.”

## 5:30-6:30 Step 5: Scenario Workspace

Screen:

1. Open `Scenario Studio` (`/scenario-quotes`).
2. Show the case index, including total scenario count and per-case scenario count.
3. Open `/scenario-quotes/rcase_aster_commerce`.
4. Click `Regenerate Quote Scenarios` only if a refresh warning is shown.
5. Select one scenario in navigator.
6. Show `What Changed Commercially` and line-level comparison.
7. Mark a preferred scenario.

Talk track:

1. “Scenario quotes are compare-only options; baseline quote remains the execution source.”

## 6:30-7:30 Step 6: Quote Review Center + Final Decision

Screen:

1. Open `/quote-drafts/qd_aster_commerce`.
2. Show `What Changed From Baseline`.
3. Show line detail controls (`Changed + AI`, expand/collapse).
4. Use `Decision Actions` (Approve/Reject/Revision) as desired.

Talk track:

1. “Final governance is quote-scoped, with traceability back to the applied insights.”

## 7:30-8:00 Close

Screen:

1. Optionally return to `/renewal-cases/rcase_aster_commerce`.
2. Show review history/status confirmation.

Talk track:

1. “That completes the loop from policy logic to quote-level decision outcome.”

## 3. Contingency Lines During Recording

If any panel is stale:

1. Say: “I will refresh the latest AI context for accuracy.”
2. Click `Regenerate Insights + AI Rationale`.

If scenario cards are empty:

1. Say: “I will generate scenario options for comparison.”
2. Click `Regenerate Quote Scenarios`.

If Next runtime cache error appears:

```bash
rm -rf .next
npm run dev
```

## 4. Post-Recording QA Checklist

1. Confirm all four flow steps were shown: Renewal Subscriptions -> Renewal Command Center -> Scenario Studio -> Quote Review Center.
2. Confirm AI Live typed streaming output is clearly visible.
3. Confirm one applied insight is shown in quote traceability.
4. Confirm scenario comparison and preferred scenario are visible.
5. Confirm final quote decision action is shown.
6. Confirm at least one `View Prompt Used` example is shown in recording.
