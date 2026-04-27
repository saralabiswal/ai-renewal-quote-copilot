from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from features import align_columns, feature_row_from_runtime_item, one_hot_frame


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "ml" / "model-registry.json"


def registry_model_path(model_key: str, fallback: Path):
    if not REGISTRY_PATH.exists():
        return fallback
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as handle:
            registry = json.load(handle)
        configured = registry.get("models", {}).get(model_key, {}).get("modelPath")
        if not configured:
            return fallback
        path = Path(configured)
        return path if path.is_absolute() else ROOT / path
    except Exception:
        return fallback


RISK_MODEL_PATH = Path(
    os.environ.get(
        "ML_MODEL_PATH",
        registry_model_path("renewal_risk", ROOT / "ml/models/renewal_risk_sklearn.joblib"),
    )
)
RISK_META_PATH = RISK_MODEL_PATH.with_suffix(".meta.json")
EXPANSION_MODEL_PATH = Path(
    os.environ.get(
        "ML_EXPANSION_MODEL_PATH",
        registry_model_path(
            "expansion_propensity",
            RISK_MODEL_PATH.parent / "expansion_propensity_sklearn.joblib",
        ),
    )
)
EXPANSION_META_PATH = EXPANSION_MODEL_PATH.with_suffix(".meta.json")


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def response(status, mode="HYBRID_RULES_ML", **kwargs):
    print(json.dumps(response_payload(status, mode=mode, **kwargs)))


def response_payload(status, mode="HYBRID_RULES_ML", **kwargs):
    payload = {
        "status": status,
        "mode": mode,
        "modelName": kwargs.get("modelName"),
        "modelVersion": kwargs.get("modelVersion"),
        "generatedAt": now_iso(),
        "error": kwargs.get("error"),
        "bundleRiskScore": kwargs.get("bundleRiskScore"),
        "itemPredictions": kwargs.get("itemPredictions", []),
    }
    return payload


def load_meta(path: Path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def top_features(model, row, limit=3):
    importances = getattr(model, "feature_importances_", [])
    scores = {
        column: float(importances[index])
        for index, column in enumerate(row.index)
        if index < len(importances)
    }

    ranked = []
    for column, value in row.items():
        if float(value) == 0:
            continue
        ranked.append((column, scores.get(column, 0.0)))

    ranked.sort(key=lambda item: item[1], reverse=True)
    return [name for name, _ in ranked[:limit]]


def predict_payload(request):
    mode = str(request.get("mode") or os.environ.get("ML_RECOMMENDATION_MODE") or "HYBRID_RULES_ML")

    if not RISK_MODEL_PATH.exists() or not RISK_META_PATH.exists():
        return response_payload(
            "MODEL_MISSING",
            mode=mode,
            error="Risk model or metadata file is missing.",
        )

    import joblib
    import pandas as pd

    risk_meta = load_meta(RISK_META_PATH)
    feature_columns = risk_meta["featureColumns"]
    rows = [feature_row_from_runtime_item(request, item) for item in request.get("items", [])]
    if not rows:
        return response_payload("ERROR", mode=mode, error="Prediction request did not include items.")

    features = align_columns(one_hot_frame(rows, pd), feature_columns)

    risk_model = joblib.load(RISK_MODEL_PATH)
    risk_scores = risk_model.predict(features)

    expansion_scores = [None for _ in rows]
    if EXPANSION_MODEL_PATH.exists() and EXPANSION_META_PATH.exists():
        expansion_model = joblib.load(EXPANSION_MODEL_PATH)
        expansion_scores = expansion_model.predict_proba(features)[:, 1]

    item_predictions = []
    for index, row in enumerate(rows):
        risk_score = max(0.0, min(100.0, float(risk_scores[index])))
        expansion_probability = (
            None if expansion_scores[index] is None else max(0.0, min(1.0, float(expansion_scores[index])))
        )
        feature_row = features.iloc[index]
        item_predictions.append(
            {
                "itemId": row["item_id"],
                "riskScore": round(risk_score, 2),
                "riskProbability": round(risk_score / 100.0, 4),
                "expansionScore": None
                if expansion_probability is None
                else round(expansion_probability * 100.0, 2),
                "expansionProbability": None
                if expansion_probability is None
                else round(expansion_probability, 4),
                "topFeatures": top_features(risk_model, feature_row),
            }
        )

    bundle_risk_score = round(
        sum(item["riskScore"] for item in item_predictions) / max(len(item_predictions), 1),
        2,
    )

    return response_payload(
        "OK",
        mode=mode,
        modelName=risk_meta.get("modelName", "renewal_risk_sklearn"),
        modelVersion=risk_meta.get("modelVersion", "v0.1-synthetic"),
        bundleRiskScore=bundle_risk_score,
        itemPredictions=item_predictions,
    )


def main():
    raw = sys.stdin.read()
    request = json.loads(raw or "{}")
    print(json.dumps(predict_payload(request)))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        response("ERROR", error=str(error))
