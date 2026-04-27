from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor

from features import CATEGORICAL_DEFAULT, align_columns, one_hot_frame, text


ROOT = Path(__file__).resolve().parents[1]
SEED_DIR = ROOT / "prisma" / "seed-data"
SYNTHETIC_DATA_PATH = ROOT / "ml" / "data" / "synthetic-renewal-training.csv"
MODEL_DIR = ROOT / "ml" / "models"
RISK_MODEL_PATH = MODEL_DIR / "renewal_risk_sklearn.joblib"
RISK_META_PATH = MODEL_DIR / "renewal_risk_sklearn.meta.json"
EXPANSION_MODEL_PATH = MODEL_DIR / "expansion_propensity_sklearn.joblib"
EXPANSION_META_PATH = MODEL_DIR / "expansion_propensity_sklearn.meta.json"
XGBOOST_RISK_MODEL_PATH = MODEL_DIR / "renewal_risk_xgboost.joblib"
XGBOOST_RISK_META_PATH = MODEL_DIR / "renewal_risk_xgboost.meta.json"
XGBOOST_EXPANSION_MODEL_PATH = MODEL_DIR / "expansion_propensity_xgboost.joblib"
XGBOOST_EXPANSION_META_PATH = MODEL_DIR / "expansion_propensity_xgboost.meta.json"


def read_seed(name: str):
    with open(SEED_DIR / name, "r", encoding="utf-8") as handle:
        return json.load(handle)


def latest_snapshots_by_subscription():
    snapshots = read_seed("seed-subscription-metric-snapshots.json")
    by_subscription = {}
    for snapshot in snapshots:
        subscription_id = snapshot["subscriptionId"]
        existing = by_subscription.get(subscription_id)
        if not existing or snapshot.get("snapshotDate", "") > existing.get("snapshotDate", ""):
            by_subscription[subscription_id] = snapshot
    return by_subscription


def number(value, fallback=0.0):
    if value is None:
        return fallback
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def build_seed_training_rows():
    accounts = {row["id"]: row for row in read_seed("seed-accounts.json")}
    products = {row["id"]: row for row in read_seed("seed-products.json")}
    subscriptions = {row["id"]: row for row in read_seed("seed-subscriptions.json")}
    cases = {row["id"]: row for row in read_seed("seed-renewal-cases.json")}
    items = read_seed("seed-renewal-case-items.json")
    snapshots = latest_snapshots_by_subscription()

    rows = []
    for item in items:
        renewal_case = cases[item["renewalCaseId"]]
        account = accounts[renewal_case["accountId"]]
        subscription = subscriptions[item["subscriptionId"]]
        product = products[subscription["productId"]]
        metric = snapshots.get(subscription["id"], {})
        disposition = text(item.get("recommendedDisposition"))

        rows.append(
            {
                "item_id": item["id"],
                "usage_percent": number(metric.get("usagePercentOfEntitlement")),
                "active_user_percent": number(metric.get("activeUserPercent")),
                "login_trend_30d": number(metric.get("loginTrend30d")),
                "ticket_count_90d": number(metric.get("ticketCount90d")),
                "sev1_count_90d": number(metric.get("sev1Count90d")),
                "csat_score": number(metric.get("csatScore")),
                "current_quantity": number(item.get("currentQuantity")),
                "current_discount_percent": number(subscription.get("discountPercent")),
                "current_arr": number(item.get("currentArr")),
                "list_unit_price": number(item.get("currentListUnitPrice")),
                "net_unit_price": number(item.get("currentNetUnitPrice")),
                "health_score": number(account.get("healthScore")),
                "open_escalation_count": number(account.get("openEscalationCount")),
                "rule_risk_score": number(item.get("itemRiskScore")),
                "gross_margin_percent": 0,
                "gross_margin_band": CATEGORICAL_DEFAULT,
                "strategic_product_tier": CATEGORICAL_DEFAULT,
                "attach_product_type": CATEGORICAL_DEFAULT,
                "is_core_product": 0,
                "payment_risk_band": text(metric.get("paymentRiskBand")),
                "adoption_band": text(metric.get("adoptionBand")),
                "account_segment": text(account.get("segment")),
                "account_industry": text(account.get("industry")),
                "product_family": text(product.get("productFamily")),
                "charge_model": text(product.get("chargeModel")),
                "demo_scenario_key": text(renewal_case.get("demoScenarioKey", "BASE_CASE")),
                "rule_disposition": disposition or CATEGORICAL_DEFAULT,
                "risk_label": number(item.get("itemRiskScore")),
                "expansion_label": 1 if disposition in {"EXPAND", "EXPANSION"} else 0,
            }
        )

    return rows


def build_synthetic_training_rows():
    frame = pd.read_csv(SYNTHETIC_DATA_PATH)
    return frame.to_dict(orient="records")


def build_training_rows():
    if SYNTHETIC_DATA_PATH.exists():
        return build_synthetic_training_rows(), {
            "source": "ml/data/synthetic-renewal-training.csv",
            "labelSource": "synthetic historical-like outcomes generated from renewal data model",
        }

    return build_seed_training_rows(), {
        "source": "prisma/seed-data",
        "labelSource": "synthetic proxy labels derived from current seeded recommendation outcomes",
    }


def save_meta(
    path: Path,
    feature_columns,
    label_name: str,
    training_rows: int,
    data_info: dict,
    *,
    model_type: str,
    framework: str,
    role: str,
):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "modelName": path.name.replace(".meta.json", ""),
                "modelVersion": "v0.1-synthetic",
                "modelType": model_type,
                "framework": framework,
                "role": role,
                "label": label_name,
                "trainingRows": training_rows,
                "featureColumns": feature_columns,
                "source": data_info["source"],
                "labelSource": data_info["labelSource"],
            },
            handle,
            indent=2,
        )
        handle.write("\n")


def make_risk_model():
    return GradientBoostingRegressor(
        n_estimators=80,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.95,
        random_state=42,
    )


def make_expansion_model():
    return GradientBoostingClassifier(
        n_estimators=60,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.95,
        random_state=42,
    )


def make_xgboost_risk_model():
    from xgboost import XGBRegressor

    return XGBRegressor(
        n_estimators=160,
        max_depth=3,
        learning_rate=0.06,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=2,
    )


def make_xgboost_expansion_model():
    from xgboost import XGBClassifier

    return XGBClassifier(
        n_estimators=140,
        max_depth=3,
        learning_rate=0.06,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=2,
    )


def train_optional_xgboost(features, frame, feature_columns, data_info):
    try:
        risk_model = make_xgboost_risk_model()
        risk_model.fit(features, frame["risk_label"])
        joblib.dump(risk_model, XGBOOST_RISK_MODEL_PATH)
        save_meta(
            XGBOOST_RISK_META_PATH,
            feature_columns,
            "observedRiskScore",
            len(frame),
            data_info,
            model_type="XGBRegressor",
            framework="xgboost",
            role="challenger",
        )

        expansion_model = make_xgboost_expansion_model()
        expansion_model.fit(features, frame["expansion_label"])
        joblib.dump(expansion_model, XGBOOST_EXPANSION_MODEL_PATH)
        save_meta(
            XGBOOST_EXPANSION_META_PATH,
            feature_columns,
            "observedExpansionAccepted",
            len(frame),
            data_info,
            model_type="XGBClassifier",
            framework="xgboost",
            role="challenger",
        )

        return {
            "status": "OK",
            "riskModelPath": str(XGBOOST_RISK_MODEL_PATH),
            "expansionModelPath": str(XGBOOST_EXPANSION_MODEL_PATH),
        }
    except Exception as error:
        return {
            "status": "UNAVAILABLE",
            "error": str(error),
            "installHint": "Install xgboost and the native OpenMP runtime. On macOS: brew install libomp.",
        }


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    rows, data_info = build_training_rows()
    frame = pd.DataFrame(rows)
    features = one_hot_frame(rows, pd)
    feature_columns = list(features.columns)
    features = align_columns(features, feature_columns)

    risk_model = make_risk_model()
    risk_model.fit(features, frame["risk_label"])
    joblib.dump(risk_model, RISK_MODEL_PATH)
    save_meta(
        RISK_META_PATH,
        feature_columns,
        "observedRiskScore",
        len(rows),
        data_info,
        model_type="GradientBoostingRegressor",
        framework="scikit-learn",
        role="baseline",
    )

    expansion_model = make_expansion_model()
    expansion_model.fit(features, frame["expansion_label"])
    joblib.dump(expansion_model, EXPANSION_MODEL_PATH)
    save_meta(
        EXPANSION_META_PATH,
        feature_columns,
        "observedExpansionAccepted",
        len(rows),
        data_info,
        model_type="GradientBoostingClassifier",
        framework="scikit-learn",
        role="baseline",
    )
    xgboost_status = train_optional_xgboost(features, frame, feature_columns, data_info)

    print(
        json.dumps(
            {
                "status": "OK",
                "trainingRows": len(rows),
                "source": data_info["source"],
                "riskModelPath": str(RISK_MODEL_PATH),
                "expansionModelPath": str(EXPANSION_MODEL_PATH),
                "xgboost": xgboost_status,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
