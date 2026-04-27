from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    mean_absolute_error,
    mean_squared_error,
    precision_recall_fscore_support,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from features import align_columns, one_hot_frame
from train import (
    EXPANSION_META_PATH,
    EXPANSION_MODEL_PATH,
    RISK_META_PATH,
    RISK_MODEL_PATH,
    XGBOOST_EXPANSION_META_PATH,
    XGBOOST_EXPANSION_MODEL_PATH,
    XGBOOST_RISK_META_PATH,
    XGBOOST_RISK_MODEL_PATH,
    build_training_rows,
    make_expansion_model,
    make_risk_model,
    make_xgboost_expansion_model,
    make_xgboost_risk_model,
)


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "ml" / "reports"
REPORT_PATH = REPORT_DIR / "evaluation.json"
REGISTRY_PATH = ROOT / "ml" / "model-registry.json"


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(path: Path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_meta(path: Path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def model_artifact(path: Path):
    if not path.exists():
        return None
    return {
        "path": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
    }


def split_data(frame, features):
    labels = frame["expansion_label"]
    can_stratify = labels.nunique() > 1 and labels.value_counts().min() >= 2
    return train_test_split(
        features,
        frame["risk_label"],
        frame["expansion_label"],
        test_size=0.3,
        random_state=42,
        stratify=labels if can_stratify else None,
    )


def candidate_status(name, model_type, framework, role, path: Path, meta_path: Path, metrics, available=True):
    return {
        "modelName": name,
        "modelType": model_type,
        "framework": framework,
        "role": role,
        "modelPath": str(path.relative_to(ROOT)),
        "metadataPath": str(meta_path.relative_to(ROOT)),
        "available": available and path.exists() and meta_path.exists(),
        "metrics": metrics,
    }


def risk_metrics(y_true, predictions):
    return {
        "mae": round(float(mean_absolute_error(y_true, predictions)), 4),
        "rmse": round(float(mean_squared_error(y_true, predictions) ** 0.5), 4),
        "r2": round(float(r2_score(y_true, predictions)), 4),
    }


def expansion_metrics(y_true, predictions, probabilities):
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true,
        predictions,
        average="binary",
        zero_division=0,
    )
    has_auc = len(set(y_true)) > 1
    return {
        "accuracy": round(float(accuracy_score(y_true, predictions)), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "rocAuc": round(float(roc_auc_score(y_true, probabilities)), 4) if has_auc else None,
    }


def choose_lowest_mae(candidates):
    available = [
        candidate
        for candidate in candidates
        if candidate["available"] and candidate["metrics"].get("mae") is not None
    ]
    if not available:
        return candidates[0]
    return min(available, key=lambda candidate: candidate["metrics"]["mae"])


def choose_highest_auc(candidates):
    available = [
        candidate
        for candidate in candidates
        if candidate["available"] and candidate["metrics"].get("rocAuc") is not None
    ]
    if not available:
        return candidates[0]
    return max(available, key=lambda candidate: candidate["metrics"]["rocAuc"])


def registry_entry_from_candidate(candidate, approved_for_hybrid):
    return {
        "activeVersion": "v0.1-synthetic",
        "modelName": candidate["modelName"],
        "modelPath": candidate["modelPath"],
        "metadataPath": candidate["metadataPath"],
        "featureSchemaVersion": "renewal-features-v1",
        "approvedForShadow": True,
        "approvedForHybrid": approved_for_hybrid,
        "owner": "RevOps Decision Intelligence",
        "notes": f"Active {candidate['framework']} {candidate['role']} selected by local holdout evaluation.",
        "artifactSha256": sha256(ROOT / candidate["modelPath"]),
        "latestEvaluationReport": "ml/reports/evaluation.json",
        "latestMetrics": candidate["metrics"],
    }


def update_registry(report):
    if not REGISTRY_PATH.exists():
        return

    with open(REGISTRY_PATH, "r", encoding="utf-8") as handle:
        registry = json.load(handle)

    models = registry.setdefault("models", {})
    risk_selected = report["modelSelection"]["renewalRisk"]["selected"]
    expansion_selected = report["modelSelection"]["expansionPropensity"]["selected"]
    models["renewal_risk"] = registry_entry_from_candidate(risk_selected, approved_for_hybrid=True)
    models["expansion_propensity"] = registry_entry_from_candidate(
        expansion_selected,
        approved_for_hybrid=False,
    )

    for candidate in report["modelSelection"]["renewalRisk"]["candidates"]:
        models[f"renewal_risk_{candidate['framework'].replace('-', '_')}"] = registry_entry_from_candidate(
            candidate,
            approved_for_hybrid=candidate["modelName"] == risk_selected["modelName"],
        )

    for candidate in report["modelSelection"]["expansionPropensity"]["candidates"]:
        models[
            f"expansion_propensity_{candidate['framework'].replace('-', '_')}"
        ] = registry_entry_from_candidate(candidate, approved_for_hybrid=False)

    with open(REGISTRY_PATH, "w", encoding="utf-8") as handle:
        json.dump(registry, handle, indent=2)
        handle.write("\n")


def main():
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    rows, data_info = build_training_rows()
    frame = pd.DataFrame(rows)
    risk_meta = load_meta(RISK_META_PATH)
    features = align_columns(one_hot_frame(rows, pd), risk_meta["featureColumns"])

    (
        x_train,
        x_test,
        risk_train,
        risk_test,
        expansion_train,
        expansion_test,
    ) = split_data(frame, features)

    risk_model = make_risk_model()
    risk_model.fit(x_train, risk_train)
    expansion_model = make_expansion_model()
    expansion_model.fit(x_train, expansion_train)

    risk_predictions = risk_model.predict(x_test)
    rule_risk_baseline = x_test["rule_risk_score"] if "rule_risk_score" in x_test else risk_predictions
    expansion_predictions = expansion_model.predict(x_test)
    expansion_probabilities = expansion_model.predict_proba(x_test)[:, 1]
    rule_expansion_baseline = frame.loc[x_test.index, "rule_disposition"].astype(str).str.upper().isin(
        ["EXPAND", "EXPANSION"]
    )
    sklearn_risk_metrics = risk_metrics(risk_test, risk_predictions)
    sklearn_expansion_metrics = expansion_metrics(
        expansion_test,
        expansion_predictions,
        expansion_probabilities,
    )
    xgboost_risk_candidate = None
    xgboost_expansion_candidate = None
    xgboost_error = None

    try:
        xgboost_risk_model = make_xgboost_risk_model()
        xgboost_risk_model.fit(x_train, risk_train)
        xgboost_risk_metrics = risk_metrics(risk_test, xgboost_risk_model.predict(x_test))
        xgboost_risk_candidate = candidate_status(
            "renewal_risk_xgboost",
            "XGBRegressor",
            "xgboost",
            "challenger",
            XGBOOST_RISK_MODEL_PATH,
            XGBOOST_RISK_META_PATH,
            xgboost_risk_metrics,
        )

        xgboost_expansion_model = make_xgboost_expansion_model()
        xgboost_expansion_model.fit(x_train, expansion_train)
        xgboost_expansion_metrics = expansion_metrics(
            expansion_test,
            xgboost_expansion_model.predict(x_test),
            xgboost_expansion_model.predict_proba(x_test)[:, 1],
        )
        xgboost_expansion_candidate = candidate_status(
            "expansion_propensity_xgboost",
            "XGBClassifier",
            "xgboost",
            "challenger",
            XGBOOST_EXPANSION_MODEL_PATH,
            XGBOOST_EXPANSION_META_PATH,
            xgboost_expansion_metrics,
        )
    except Exception as error:
        xgboost_error = str(error)

    risk_candidates = [
        candidate_status(
            "renewal_risk_sklearn",
            "GradientBoostingRegressor",
            "scikit-learn",
            "baseline",
            RISK_MODEL_PATH,
            RISK_META_PATH,
            sklearn_risk_metrics,
        )
    ]
    expansion_candidates = [
        candidate_status(
            "expansion_propensity_sklearn",
            "GradientBoostingClassifier",
            "scikit-learn",
            "baseline",
            EXPANSION_MODEL_PATH,
            EXPANSION_META_PATH,
            sklearn_expansion_metrics,
        )
    ]
    if xgboost_risk_candidate:
        risk_candidates.append(xgboost_risk_candidate)
    if xgboost_expansion_candidate:
        expansion_candidates.append(xgboost_expansion_candidate)

    selected_risk = choose_lowest_mae(risk_candidates)
    selected_expansion = choose_highest_auc(expansion_candidates)

    report = {
        "generatedAt": now_iso(),
        "data": {
            "source": data_info["source"],
            "trainingRows": len(rows),
            "holdoutRows": len(x_test),
            "labelSource": data_info["labelSource"],
            "evaluationProtocol": "70/30 stratified holdout; evaluation models are trained only on the train split; runtime artifacts are trained on all rows",
            "productionLabelExpectation": [
                "historical renewal outcome",
                "accepted discount and price realization",
                "approval override outcome",
                "expansion conversion",
                "churn or contraction outcome",
            ],
        },
        "featureSchemaVersion": "renewal-features-v1",
        "artifacts": {
            "renewalRiskSklearn": model_artifact(RISK_MODEL_PATH),
            "expansionPropensitySklearn": model_artifact(EXPANSION_MODEL_PATH),
            "renewalRiskXgboost": model_artifact(XGBOOST_RISK_MODEL_PATH),
            "expansionPropensityXgboost": model_artifact(XGBOOST_EXPANSION_MODEL_PATH),
        },
        "modelSelection": {
            "renewalRisk": {
                "criterion": "lowest holdout MAE",
                "selected": selected_risk,
                "candidates": risk_candidates,
            },
            "expansionPropensity": {
                "criterion": "highest holdout ROC AUC",
                "selected": selected_expansion,
                "candidates": expansion_candidates,
            },
            "xgboostStatus": {
                "available": xgboost_error is None,
                "error": xgboost_error,
            },
        },
        "models": {
            "renewalRisk": {
                "modelName": selected_risk["modelName"],
                "modelType": selected_risk["modelType"],
                "framework": selected_risk["framework"],
                "metrics": selected_risk["metrics"],
                "ruleBaselineMetrics": {
                    "mae": round(float(mean_absolute_error(risk_test, rule_risk_baseline)), 4),
                    "rmse": round(float(mean_squared_error(risk_test, rule_risk_baseline) ** 0.5), 4),
                },
            },
            "expansionPropensity": {
                "modelName": selected_expansion["modelName"],
                "modelType": selected_expansion["modelType"],
                "framework": selected_expansion["framework"],
                "metrics": selected_expansion["metrics"],
                "ruleBaselineMetrics": {
                    "accuracy": round(float(accuracy_score(expansion_test, rule_expansion_baseline)), 4),
                },
            },
            "renewalRiskSklearn": {
                "modelName": "renewal_risk_sklearn",
                "modelType": "GradientBoostingRegressor",
                "framework": "scikit-learn",
                "metrics": sklearn_risk_metrics,
            },
            "expansionPropensitySklearn": {
                "modelName": "expansion_propensity_sklearn",
                "modelType": "GradientBoostingClassifier",
                "framework": "scikit-learn",
                "metrics": sklearn_expansion_metrics,
            },
        },
        "limitations": [
            "Metrics are demo-readiness metrics, not production generalization evidence.",
            "The model currently learns from synthetic historical-like data generated from the app data model.",
            "The synthetic generator includes rule-derived signals, product archetypes, and non-rule observed outcome noise.",
            "Production promotion should require historical labels, drift monitoring, and approval workflow.",
        ],
    }

    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")

    update_registry(report)
    print(json.dumps({"status": "OK", "reportPath": str(REPORT_PATH), "summary": report}, indent=2))


if __name__ == "__main__":
    main()
