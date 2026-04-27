# Standalone ML Recommendation Layer

This folder contains the local ML layer for AI Renewal Quote Copilot.

The Next.js app defaults to ML-Assisted Rules. Deterministic rules still run first,
ML assists risk scoring when the local artifact is approved and available, and pricing
guardrails remain final. Settings supports:

1. `RULES_ONLY`: deterministic rules only.
2. `ML_SHADOW`: run ML and store metadata without changing recommendations.
3. `HYBRID_RULES_ML`: shown as ML-Assisted Rules in the UI; blends ML risk scores into recommendation scoring while pricing guardrails still win.

## Setup

```bash
python3 -m venv .venv-ml
. .venv-ml/bin/activate
pip install -r ml/requirements.txt
npm run ml:generate-data
npm run ml:train
npm run ml:evaluate
```

If your default `python3` is not suitable, create the venv with a specific interpreter:

```bash
/path/to/python3 -m venv .venv-ml
```

The training script writes:

```text
ml/models/renewal_risk_sklearn.joblib
ml/models/renewal_risk_sklearn.meta.json
ml/models/expansion_propensity_sklearn.joblib
ml/models/expansion_propensity_sklearn.meta.json
ml/models/renewal_risk_xgboost.joblib
ml/models/renewal_risk_xgboost.meta.json
ml/models/expansion_propensity_xgboost.joblib
ml/models/expansion_propensity_xgboost.meta.json
```

The evaluation script compares the scikit-learn baseline and XGBoost challenger
on the same holdout split, then updates `ml/model-registry.json` with the active
model selected by the evaluation criterion.

The synthetic dataset generator writes:

```text
ml/data/synthetic-renewal-training.csv
```

The generated dataset contains 1,000 renewal line examples across 300 synthetic cases and 12 product archetypes. It is based on the app's renewal data model and includes historical-like outcome labels such as renewal outcome, discount acceptance, reviewer override, ARR delta, observed risk, and expansion acceptance.

## Runtime

By default, the app calls `ml/predict.py` with JSON over stdin. You can test it manually by piping a prediction payload into:

```bash
npm run ml:predict
```

For a production-shaped local boundary, start the standalone model service:

```bash
npm run ml:serve
```

Then set:

```bash
ML_SERVICE_URL="http://127.0.0.1:8010"
```

The service exposes:

```text
GET /health
POST /predict
```

If the model file or Python dependencies are missing, the app records ML as unavailable and falls back to rules.
If XGBoost cannot load on macOS, install the native OpenMP runtime:

```bash
brew install libomp
```

## Review Artifacts

- Model card: `ml/MODEL_CARD.md`
- Evaluation report: `ml/reports/evaluation.json`
- Registry: `ml/model-registry.json`

The current model uses synthetic historical-like labels generated from the app data model. Metrics demonstrate local readiness and integration correctness, not production predictive performance.
