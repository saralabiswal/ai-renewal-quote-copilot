from __future__ import annotations

from typing import Any, Dict, Iterable, List


CATEGORICAL_DEFAULT = "UNKNOWN"


NUMERIC_FEATURES = [
    "usage_percent",
    "active_user_percent",
    "login_trend_30d",
    "ticket_count_90d",
    "sev1_count_90d",
    "csat_score",
    "current_quantity",
    "current_discount_percent",
    "current_arr",
    "list_unit_price",
    "net_unit_price",
    "health_score",
    "open_escalation_count",
    "rule_risk_score",
    "gross_margin_percent",
    "is_core_product",
]

CATEGORICAL_FEATURES = [
    "payment_risk_band",
    "adoption_band",
    "account_segment",
    "account_industry",
    "product_family",
    "charge_model",
    "gross_margin_band",
    "strategic_product_tier",
    "attach_product_type",
    "demo_scenario_key",
    "rule_disposition",
]


def number(value: Any, fallback: float = 0.0) -> float:
    if value is None:
        return fallback
    try:
        parsed = float(value)
        if parsed != parsed:
            return fallback
        return parsed
    except (TypeError, ValueError):
        return fallback


def text(value: Any) -> str:
    if value is None or value == "":
        return CATEGORICAL_DEFAULT
    return str(value).upper().replace(" ", "_")


def feature_row_from_runtime_item(request: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    account = request.get("account") or {}
    subscription = item.get("subscription") or {}
    product = item.get("product") or {}
    metric = item.get("metricSnapshot") or {}

    return {
        "item_id": item.get("id"),
        "usage_percent": number(metric.get("usagePercentOfEntitlement")),
        "active_user_percent": number(metric.get("activeUserPercent")),
        "login_trend_30d": number(metric.get("loginTrend30d")),
        "ticket_count_90d": number(metric.get("ticketCount90d")),
        "sev1_count_90d": number(metric.get("sev1Count90d")),
        "csat_score": number(metric.get("csatScore")),
        "current_quantity": number(subscription.get("quantity")),
        "current_discount_percent": number(subscription.get("discountPercent")),
        "current_arr": number(subscription.get("arr")),
        "list_unit_price": number(subscription.get("listUnitPrice")),
        "net_unit_price": number(subscription.get("netUnitPrice")),
        "health_score": number(account.get("healthScore")),
        "open_escalation_count": number(account.get("openEscalationCount")),
        "rule_risk_score": number(item.get("ruleRiskScore")),
        "payment_risk_band": text(metric.get("paymentRiskBand")),
        "adoption_band": text(metric.get("adoptionBand")),
        "account_segment": text(account.get("segment")),
        "account_industry": text(account.get("industry")),
        "product_family": text(product.get("productFamily")),
        "charge_model": text(product.get("chargeModel")),
        "gross_margin_percent": number(product.get("grossMarginPercent")),
        "gross_margin_band": text(product.get("grossMarginBand")),
        "strategic_product_tier": text(product.get("strategicProductTier")),
        "attach_product_type": text(product.get("attachProductType")),
        "is_core_product": 1.0 if product.get("isCoreProduct") is True else 0.0,
        "demo_scenario_key": text(request.get("demoScenarioKey")),
        "rule_disposition": text(item.get("ruleDisposition")),
    }


def one_hot_frame(rows: Iterable[Dict[str, Any]], pandas_module: Any):
    frame = pandas_module.DataFrame(list(rows))
    for column in NUMERIC_FEATURES:
        if column not in frame:
            frame[column] = 0
        frame[column] = frame[column].fillna(0).astype(float)
    for column in CATEGORICAL_FEATURES:
        if column not in frame:
            frame[column] = CATEGORICAL_DEFAULT
        frame[column] = frame[column].fillna(CATEGORICAL_DEFAULT).astype(str)
    return pandas_module.get_dummies(frame[NUMERIC_FEATURES + CATEGORICAL_FEATURES])


def align_columns(frame: Any, feature_columns: List[str]):
    for column in feature_columns:
        if column not in frame:
            frame[column] = 0
    return frame[feature_columns]
