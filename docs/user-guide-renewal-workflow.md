# User Guide: Renewal Workflow

This guide walks through the end-to-end demo workflow with the seeded reference case.

Reference case:

- Account: Redwood Energy Operations
- Renewal Case Number: `RC-ACCT-1007`
- Renewal Case ID: `rcase_redwood_energy`
- Baseline Quote Number: `Q-ACCT-1007`
- Baseline Quote Draft ID: `qd_redwood_energy`

The app is designed to run standalone with local data, local ML artifacts, and local-first LLM support through Ollama. The default recommendation posture is **ML-Assisted Rules** with deterministic pricing guardrails.

## 1. Start the App

From the repository root:

```bash
npm install
npm run db:setup
make install-ml
npm run ml:generate-data
npm run ml:train
npm run ml:evaluate
npm run dev
```

Open `http://localhost:3000`.

The Flow Map is the default entry point. It routes users into Business Workspace, Architecture Console, or Developer Workbench. The business path is Renewal Subscriptions, Baseline Quote Review, Scenario Quote Review, and optional Scenario Quote Generation Trace.

The interface is intentionally organized like an operational enterprise console: compact headings, left navigation, visible workflow steps, and direct action controls rather than a marketing-style demo shell.

![Flow Map and Business Home](assets/user-guide/01-dashboard.png)

## 2. Confirm Decisioning Setup

Open `Decisioning Setup` from the sidebar.

Use `Business View` for the quick demo posture. Use `Technical View` when you need to change runtime settings.

In `Technical View`, the Recommendation Mode tab is organized as a 1-2-3 flow:

1. `Recommendation`: choose `ML-Assisted Rules` for the main demo.
2. `Role`: choose `AI Governance Admin` when testing restricted guarded modes.
3. `Guarded LLM`: choose `LLM-Assisted Guarded` when demonstrating validator-gated LLM influence.

Click `Apply Settings` only when changing a selected setting. The selected settings summary shows exactly what will be applied.

The long ML readiness section is collapsed by default. Expand it when you need to show local model artifact status, model registry, approval gates, and evaluation metrics.

The LLM Provider tab shows the text-generation provider. Ollama is the local default; OpenAI can be selected by environment configuration.

![Decisioning Setup](assets/user-guide/08-settings.png)

## 3. Review AI Architecture

Open `AI Architecture`.

Use this page to explain the AI/ML implementation to a technical audience:

1. Active model registry and artifact status.
2. Model selection across baseline and challenger candidates.
3. XGBoost renewal risk model and sklearn expansion propensity model.
4. Local subprocess prediction or optional service boundary.
5. Evaluation metrics and artifact checksums.
6. Decision trace and prompt governance surfaces.

![AI Architecture](assets/user-guide/09-technical-architecture.png)

## 4. Review Policy Playbook

Open `Policy Playbook`.

This page explains what the app is allowed to do:

1. Recommendation policy and scoring behavior.
2. Quote insight policy and mapping behavior.
3. Worked examples for seeded products and accounts.
4. Journey view for how policy turns into workflow actions.
5. Prompt governance for optional narrative generation.

The important message: deterministic policy and pricing guardrails remain visible even when ML is enabled.

![Policy Playbook](assets/user-guide/07-policy-studio.png)

## 5. Review Renewal Subscriptions

Open `Renewal Subscriptions`.

Use this page to inspect the source subscription context before running a case:

1. Account and subscription grouping.
2. Product families and quote context.
3. Baseline quantity, price, discount, and ARR.
4. Usage, support, adoption, payment, and renewal health signals.

For the reference walkthrough, find Redwood Energy Operations.

![Renewal Subscriptions](assets/user-guide/02-renewal-subscriptions.png)

## 6. Review the Baseline Quote

Open `Baseline Quote Review`.

Baseline Quote Review lists the editable baseline quotes. Use it to:

1. Open the baseline quote for `RC-ACCT-1007`.
2. Review quote status and approval posture.
3. Compare baseline lines with AI-applied or changed lines.
4. Inspect quote traceability and source insight evidence.

![Baseline Quote Review](assets/user-guide/06-quote-draft-review.png)

## 7. Review Scenario Quotes

Open `Scenario Quote Review` from the sidebar first when you want to choose a case from the index.

The index shows:

1. Total renewal cases.
2. Cases with generated scenarios.
3. Total scenario quote count.
4. Approval case count.
5. Per-case scenario count next to the open action.

Then open:

```text
/scenario-quotes/rcase_redwood_energy
```

Use this page to compare commercial alternatives before editing the baseline quote:

1. Review generated scenario quote candidates.
2. Compare ARR, discount, quantity, and line-level changes.
3. Inspect what changed commercially.
4. Mark a preferred scenario when useful.

Scenarios are read-only comparison artifacts. The baseline quote remains the editable source.

![Scenario Quote Review](assets/user-guide/05-scenario-workspace.png)

## 8. Inspect Scenario Quote Generation Trace

Open:

```text
/renewal-cases/rcase_redwood_energy
```

Scenario Quote Generation Trace is optional for business review, but useful when you need to explain how the scenario quote evidence was generated. It uses a guided five-step internal workflow:

1. `Generate Scenario Quote`: choose a scenario and run the AI workflow.
2. `Review Generated Changes`: confirm recommendation and quote-insight deltas.
3. `Apply Quote Actions`: apply selected quote insights to the baseline quote.
4. `Decision Trace`: review rules, ML output, guardrails, and decision reasoning.
5. `AI Review Guidance`: read review guidance, approval details, and renewal case structure.

For the reference walkthrough:

1. Open `Generate Scenario Quote`.
2. Select `Customer Risk Escalation`.
3. Click `Run End-to-End AI Workflow`.
4. Watch the AI Live Run Console progress through:
   - recalculate recommendation
   - generate quote insights and AI rationales
   - generate full AI review guidance
5. Expand `View Prompt Used` only when you need prompt transparency.

After the run:

1. Open `Review Generated Changes` to see how risk, recommendation, approval, and quote insights changed.
2. Open `Apply Quote Actions` to review and apply suggested quote changes.
3. Open `Decision Trace` to see ML output, rule output, final output, guardrails, and reasoning.
4. Open `AI Review Guidance` to read the reviewer summary, approval guidance, evidence, bundle analysis, subscription items, and review history.

The screenshot below shows the workflow after selecting `Customer Risk Escalation`, running the end-to-end AI workflow, and opening `Review Generated Changes`.

![Scenario Quote Generation Trace](assets/user-guide/04-case-decision-workspace.png)

## 9. Final Baseline Quote Decision

Open:

```text
/quote-drafts/qd_redwood_energy
```

Use Baseline Quote Review to:

1. Review quote status and approval posture.
2. Compare baseline lines with AI-applied or changed lines.
3. Filter quote lines by all, changed plus AI, and baseline only.
4. Inspect quote traceability and source insight evidence.
5. Approve, reject, or request revision.

Quote decisions are quote-scoped, not case-scoped.

![Baseline Quote Review](assets/user-guide/06-quote-draft-review.png)

## 10. Verify Completion

After quote review:

1. Return to Scenario Quote Generation Trace and review history when explanation is needed.
2. Return to Baseline Quote Review and confirm quote status.
3. Keep the preferred scenario selection for audit context if it was used.
4. Use Decision Trace to explain why the final recommendation changed or stayed the same.

## Recommended Technical Demo Flow

For a VP engineering or architecture review:

1. Start at `Decisioning Setup` and show ML-Assisted Rules, AI Governance Admin, and LLM-Assisted Guarded.
2. Open `AI Architecture` and show model selection plus local artifacts.
3. Open `Policy Playbook` and show rule/guardrail transparency.
4. Open `Scenario Quote Generation Trace` and run the internal workflow.
5. Open Decision Trace and explain selected settings, rule baseline, ML output, guarded LLM finalizer, and final output.
6. Open Quote Insight structured evidence and show ML metadata.
7. Open Baseline Quote Review and show the human approval endpoint.

## Troubleshooting

If a stale chunk error appears after a production build:

```bash
rm -rf .next
npm run dev
```

If seeded data needs to be rebuilt:

```bash
npm run db:reset:clean
```

If ML readiness is missing:

```bash
make install-ml
npm run ml:generate-data
npm run ml:train
npm run ml:evaluate
```
