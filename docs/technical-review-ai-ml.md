# Technical Review Notes: AI, ML, and LLM

This note is a reviewer checklist for the AI Renewal Quote Copilot demo. For the full customer-facing architecture explanation, see [AI Architecture](technical-architecture.md).

## Review Positioning

The app is a standalone, local-first renewal decisioning system. It demonstrates how deterministic rules, local open-source ML, local-first LLM support, guarded validators, and human approval can work together in an auditable enterprise workflow.

The system is intentionally not positioned as autonomous pricing. The operating model is:

- deterministic rules own policy decisions and guardrails
- local ML provides risk and expansion evidence
- ML-Assisted Rules can blend ML risk into recommendation scoring
- Ollama or OpenAI can generate reviewer-ready narratives and guarded shadow/ranking proposals
- guarded validators decide whether any LLM-assisted candidate is allowed to influence output
- humans approve final quote outcomes
- decision traces preserve settings, input, rule, evidence, ML, guarded finalizer, final, model, and guardrail evidence

## What Exists Today

### Local Data

All app data is local and seeded through Prisma:

- accounts
- products
- subscriptions
- metric snapshots
- pricing policies
- renewal cases
- quote drafts
- quote insights
- scenario quotes
- review decisions
- decision runs

### Recommendation Modes

| Mode | UI Label | Review Message |
| --- | --- | --- |
| `RULES_ONLY` | Rules Only | Deterministic rules are final. |
| `ML_SHADOW` | Shadow Mode | ML is recorded but does not affect recommendations. |
| `HYBRID_RULES_ML` | ML-Assisted Rules | ML risk can influence recommendation scoring; guardrails remain final. |

The app defaults to ML-Assisted Rules.

### Guarded LLM Modes

Guarded LLM mode is separate from recommendation mode.

| Mode | UI Label | Review Message |
| --- | --- | --- |
| `RULES_ONLY` | Rules Only | No LLM critique or ranking is used in decision finalization. |
| `LLM_CRITIC_SHADOW` | LLM Critic Shadow | LLM critique is recorded; final output is unchanged. |
| `LLM_RANKING_SHADOW` | LLM Ranking Shadow | LLM ranking is validated and recorded for comparison. |
| `LLM_ASSISTED_GUARDED` | LLM-Assisted Guarded | LLM can influence selected candidates only after deterministic validation passes. |
| `HUMAN_APPROVAL_REQUIRED` | Human Approval Required | LLM supports review while exception posture routes to a human approver. |

Restricted modes are role-gated in the demo. `LLM_ASSISTED_GUARDED` requires AI Governance Admin or Revenue Ops Admin authority. `HUMAN_APPROVAL_REQUIRED` requires AI Governance Admin or Deal Desk Admin authority.

### Rules

The deterministic recommendation engine calculates:

- item risk score and risk level
- recommended line disposition
- proposed quantity
- recommended discount
- proposed net unit price
- proposed ARR
- approval requirement
- guardrail result
- bundle-level recommended action
- pricing posture

Pricing guardrails remain final even when ML is enabled.

### ML

The standalone ML bundle includes baseline and challenger artifacts.

| Task | Active Model | Framework | Selection |
| --- | --- | --- | --- |
| Renewal risk | `renewal_risk_xgboost` | XGBoost | Lowest holdout MAE |
| Expansion propensity | `expansion_propensity_sklearn` | scikit-learn | Highest holdout ROC AUC |

Training and evaluation files:

- `ml/synthetic_data.py`
- `ml/train.py`
- `ml/evaluate.py`
- `ml/predict.py`
- `ml/serve.py`
- `ml/model-registry.json`
- `ml/reports/evaluation.json`
- `ml/MODEL_CARD.md`

The current ML data is synthetic and generated from the app data model. Metrics are useful for demo readiness and integration review, not production predictive claims.

### Serving

Two local serving modes are supported:

- subprocess mode: Next.js invokes `ml/predict.py`
- service mode: Next.js calls `ML_SERVICE_URL/predict`

This gives the demo a production-shaped inference boundary while keeping it runnable on a laptop.

### Quote Insights

Quote insights are structured actions generated from recommendation output. The insight engine maps item dispositions and scenario context into quote actions, attaches commercial delta, objective score, rule evidence, ML evidence, and alternatives considered, then diffs against the prior generation.

Optional text generation explains the structured insight; it does not decide the price.

### LLM

LLM-dependent text can run in these modes:

- local Ollama generation by default
- hosted OpenAI generation when configured
- deterministic mock mode
- deterministic fallback mode

Prompt governance surfaces exact prompt artifacts and prompt inputs in the UI. Guarded JSON calls use short timeouts and deterministic fallback so unavailable local LLM services do not block the demo.

### Traceability

Decision Trace captures:

- settings used for the run
- rule input
- evidence snapshot
- candidate envelope
- feature snapshot
- rule output
- ML output
- guarded validator/finalizer output
- final output
- guardrail summary
- replay verification
- rule engine version
- policy version
- feature schema version
- model name and version

## Recommended Review Flow

1. Open `Settings`.
   - Show the 1-2-3 setup: ML-Assisted Rules, AI Governance Admin, LLM-Assisted Guarded.
   - Expand local model readiness only if the audience wants artifact, registry, approval gate, and evaluation details.
2. Open `AI Architecture`.
   - Show active XGBoost renewal risk model.
   - Show sklearn expansion propensity model.
   - Show baseline/challenger model selection.
   - Show artifact checksum and service boundary.
3. Open `Policy Studio`.
   - Show recommendation and quote insight policy.
   - Show prompt governance.
4. Open `Renewal Command Center`.
   - Run the end-to-end workflow.
   - Open Decision Trace.
   - Explain Settings Used, rule baseline, ML output, guarded LLM finalizer, final output, and guardrails.
5. Open Quote Insights.
   - Show structured evidence and ML metadata.
6. Open `Quote Review Center`.
   - Show human approval and quote-scoped final decision.

## Known Limitations

- ML training labels are synthetic historical-like labels.
- Current explainability exposes top feature names, not full contribution values.
- No production drift monitor is included.
- No real CRM, CPQ, billing, usage, or support integration is included.
- Multi-tenant isolation and access controls are outside the demo scope.

## Production Hardening Requirements

Before production promotion, require:

- historical labeled outcomes
- time-based validation
- challenger promotion workflow
- shadow-mode burn-in reports
- model drift and feature-quality monitoring
- reviewer override feedback loop
- explainability with per-prediction contribution values
- model rollback plan
- tenant isolation
- enterprise audit retention

## Why This Is Credible

The app is honest about where ML sits:

- rules remain policy truth
- ML is versioned, gated, and auditable
- hybrid mode is explicit
- guardrails remain deterministic
- prompt inputs are visible
- guarded LLM proposals are validator-gated
- final quote decisions stay human-approved
