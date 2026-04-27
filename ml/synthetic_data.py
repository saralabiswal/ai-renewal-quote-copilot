from __future__ import annotations

import csv
import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "ml" / "data"
DATA_PATH = DATA_DIR / "synthetic-renewal-training.csv"
SEED = 20260426
ROW_COUNT = 1000
CASE_COUNT = 300


SCENARIOS = [
    ("BASE_CASE", 0.45),
    ("ADOPTION_DECLINE", 0.18),
    ("EXPANSION_UPSIDE", 0.14),
    ("MARGIN_RECOVERY", 0.10),
    ("CUSTOMER_RISK_ESCALATION", 0.08),
    ("PAYMENT_APPROVAL_RISK", 0.05),
]

SEGMENTS = ["ENTERPRISE", "MID_MARKET", "STRATEGIC", "COMMERCIAL"]
INDUSTRIES = [
    "MANUFACTURING",
    "FINANCIAL_SERVICES",
    "HEALTHCARE",
    "TELECOM",
    "RETAIL",
    "PUBLIC_SECTOR",
    "TECHNOLOGY",
    "ENERGY",
]

PRODUCTS = [
    ("CORE_SAAS_SEATS", "Applications", "Per User / Annual", 78, "HIGH", "CORE", "CORE_SUITE", 1),
    ("PREMIUM_SAAS_SUITE", "Applications", "Annual Subscription", 82, "HIGH", "STRATEGIC", "CORE_SUITE", 1),
    ("USAGE_CLOUD_INFRA", "Infrastructure", "Annual / Consumption Commit", 62, "MEDIUM", "STRATEGIC", "CORE_PLATFORM", 1),
    ("DATA_PLATFORM", "AI / Data", "Annual Subscription", 74, "HIGH", "STRATEGIC", "CORE_PLATFORM", 1),
    ("AI_ADD_ON", "AI / Data", "Usage Add-on", 86, "HIGH", "STRATEGIC", "ADD_ON", 0),
    ("SECURITY_ADD_ON", "Security", "Annual Subscription", 80, "HIGH", "EXPANSION", "ADD_ON", 0),
    ("ANALYTICS_MODULE", "Analytics", "Annual Subscription", 76, "HIGH", "EXPANSION", "ADD_ON", 0),
    ("PREMIUM_SUPPORT", "Support", "Annual Subscription", 58, "MEDIUM", "ATTACH", "SUPPORT", 0),
    ("PRO_SERVICES", "Professional Services", "One Time", 34, "LOW", "SERVICES", "SERVICES", 0),
    ("MARKETPLACE_INTEGRATION", "Integrations", "Annual Subscription", 68, "MEDIUM", "ATTACH", "ADD_ON", 0),
    ("STORAGE_CAPACITY", "Infrastructure", "Consumption", 64, "MEDIUM", "EXPANSION", "CAPACITY", 0),
    ("COMPLIANCE_GOVERNANCE", "Compliance", "Annual Subscription", 79, "HIGH", "STRATEGIC", "ADD_ON", 0),
]

FIELDNAMES = [
    "case_id",
    "item_id",
    "account_segment",
    "account_industry",
    "health_score",
    "open_escalation_count",
    "product_archetype",
    "product_family",
    "charge_model",
    "gross_margin_percent",
    "gross_margin_band",
    "strategic_product_tier",
    "attach_product_type",
    "is_core_product",
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
    "payment_risk_band",
    "adoption_band",
    "demo_scenario_key",
    "rule_risk_score",
    "rule_disposition",
    "observed_renewal_outcome",
    "observed_discount_accepted",
    "observed_reviewer_override",
    "observed_arr_delta_percent",
    "risk_label",
    "expansion_label",
]


def weighted_choice(rng, values):
    total = sum(weight for _, weight in values)
    point = rng.random() * total
    cursor = 0
    for value, weight in values:
        cursor += weight
        if point <= cursor:
            return value
    return values[-1][0]


def clamp(value, low, high):
    return max(low, min(high, value))


def round1(value):
    return round(value, 1)


def band_for_usage(usage):
    if usage >= 92:
        return "VERY_STRONG"
    if usage >= 70:
        return "STRONG"
    if usage >= 45:
        return "MODERATE"
    return "WEAK"


def payment_band(rng, scenario, health_score):
    if scenario == "PAYMENT_APPROVAL_RISK":
        return weighted_choice(rng, [("HIGH", 0.62), ("MEDIUM", 0.28), ("LOW", 0.10)])
    if health_score < 45:
        return weighted_choice(rng, [("HIGH", 0.28), ("MEDIUM", 0.45), ("LOW", 0.27)])
    return weighted_choice(rng, [("LOW", 0.72), ("MEDIUM", 0.22), ("HIGH", 0.06)])


def rule_score(row):
    score = 0
    usage = row["usage_percent"]
    active = row["active_user_percent"]
    tickets = row["ticket_count_90d"]
    sev1 = row["sev1_count_90d"]
    csat = row["csat_score"]
    health = row["health_score"]
    discount = row["current_discount_percent"]

    if usage < 35:
        score += 28
    elif usage < 55:
        score += 16
    elif usage >= 90:
        score -= 8
    elif usage >= 75:
        score -= 4

    if active < 35:
        score += 16
    elif active >= 70:
        score -= 5

    if tickets >= 10:
        score += 15
    elif tickets >= 5:
        score += 8
    elif tickets <= 1:
        score -= 3

    if sev1 >= 2:
        score += 22
    elif sev1 == 1:
        score += 10

    if csat < 3.3:
        score += 12
    elif csat >= 4.5:
        score -= 4

    if health < 45:
        score += 15
    elif health < 65:
        score += 8
    elif health >= 85:
        score -= 6

    if row["payment_risk_band"] == "HIGH":
        score += 10
    elif row["payment_risk_band"] == "MEDIUM":
        score += 2

    if row["product_family"] in {"Infrastructure", "AI / Data"} and usage >= 90:
        score -= 6

    if discount >= 32:
        score += 8
    elif discount >= 24:
        score += 4

    return int(clamp(round(score), 0, 100))


def disposition_for(row):
    if row["rule_risk_score"] >= 80 or row["sev1_count_90d"] >= 3:
        return "ESCALATE"
    if row["usage_percent"] >= 92 and row["rule_risk_score"] < 40:
        return "EXPAND"
    if row["rule_risk_score"] >= 55:
        return "RENEW_WITH_CONCESSION"
    if row["usage_percent"] < 35 and row["active_user_percent"] < 40:
        return "DROP"
    return "RENEW"


def observed_outcomes(rng, row):
    risk_noise = rng.gauss(0, 7)
    product_stickiness = 8 if row["is_core_product"] else 0
    product_expansion = 8 if row["attach_product_type"] in {"ADD_ON", "CAPACITY"} else 0
    margin_penalty = 7 if row["gross_margin_band"] == "LOW" and row["current_discount_percent"] > 20 else 0
    risk_label = clamp(
        row["rule_risk_score"]
        + risk_noise
        - product_stickiness
        + margin_penalty
        + (10 if row["observed_reviewer_override"] else 0),
        0,
        100,
    )

    expansion_logit = (
        (row["usage_percent"] - 75) * 0.055
        + (row["active_user_percent"] - 70) * 0.025
        + product_expansion * 0.10
        + (8 if row["demo_scenario_key"] == "EXPANSION_UPSIDE" else 0) * 0.12
        - row["rule_risk_score"] * 0.025
    )
    expansion_probability = 1 / (1 + pow(2.71828, -expansion_logit))
    expansion_label = 1 if rng.random() < expansion_probability else 0

    arr_delta = rng.gauss(0, 4)
    if expansion_label:
        arr_delta += rng.uniform(8, 28)
    if row["rule_disposition"] == "DROP":
        arr_delta -= rng.uniform(20, 45)
    if row["rule_disposition"] == "RENEW_WITH_CONCESSION":
        arr_delta -= rng.uniform(3, 10)
    if row["rule_disposition"] == "ESCALATE":
        arr_delta -= rng.uniform(4, 16)

    renewal_outcome = "WON"
    if risk_label >= 78 and rng.random() < 0.38:
        renewal_outcome = "LOST"
    elif risk_label >= 58 and rng.random() < 0.18:
        renewal_outcome = "CONTRACTED"
    elif expansion_label and arr_delta > 6:
        renewal_outcome = "EXPANDED"

    discount_accepted = row["current_discount_percent"] <= 28 or rng.random() > 0.22

    return {
        "risk_label": round1(risk_label),
        "expansion_label": expansion_label,
        "observed_renewal_outcome": renewal_outcome,
        "observed_discount_accepted": int(discount_accepted),
        "observed_arr_delta_percent": round1(clamp(arr_delta, -55, 55)),
    }


def scenario_metrics(rng, scenario):
    if scenario == "ADOPTION_DECLINE":
        return rng.uniform(20, 58), rng.uniform(18, 60), rng.uniform(-28, -4), rng.randint(3, 11), rng.randint(0, 2), rng.uniform(2.7, 4.0)
    if scenario == "EXPANSION_UPSIDE":
        return rng.uniform(88, 125), rng.uniform(78, 98), rng.uniform(6, 35), rng.randint(0, 3), 0, rng.uniform(4.1, 5.0)
    if scenario == "MARGIN_RECOVERY":
        return rng.uniform(58, 92), rng.uniform(55, 88), rng.uniform(-3, 15), rng.randint(1, 5), rng.randint(0, 1), rng.uniform(3.7, 4.8)
    if scenario == "CUSTOMER_RISK_ESCALATION":
        return rng.uniform(28, 70), rng.uniform(25, 68), rng.uniform(-22, 5), rng.randint(7, 18), rng.randint(1, 4), rng.uniform(2.2, 3.6)
    if scenario == "PAYMENT_APPROVAL_RISK":
        return rng.uniform(45, 85), rng.uniform(42, 82), rng.uniform(-10, 12), rng.randint(2, 8), rng.randint(0, 2), rng.uniform(3.1, 4.4)
    return rng.uniform(62, 96), rng.uniform(58, 92), rng.uniform(-4, 18), rng.randint(0, 4), rng.randint(0, 1), rng.uniform(3.8, 5.0)


def generate_rows():
    rng = random.Random(SEED)
    rows = []
    for index in range(ROW_COUNT):
        scenario = weighted_choice(rng, SCENARIOS)
        segment = rng.choice(SEGMENTS)
        industry = rng.choice(INDUSTRIES)
        product = rng.choice(PRODUCTS)
        (
            product_archetype,
            product_family,
            charge_model,
            margin,
            margin_band,
            tier,
            attach_type,
            is_core,
        ) = product

        usage, active, login, tickets, sev1, csat = scenario_metrics(rng, scenario)
        health = clamp(rng.gauss(78, 14), 18, 98)
        if scenario in {"CUSTOMER_RISK_ESCALATION", "ADOPTION_DECLINE"}:
            health = clamp(health - rng.uniform(14, 32), 12, 95)
        escalations = 0 if health > 75 else rng.randint(0, 4)
        if scenario == "CUSTOMER_RISK_ESCALATION":
            escalations += rng.randint(1, 4)

        quantity = rng.choice([1, 1, 1, 2, 3, 5, 10, 25, 50, 100])
        list_unit_price = rng.choice([1200, 2400, 6000, 12000, 24000, 48000, 90000, 150000])
        if charge_model in {"One Time", "Consumption", "Usage Add-on"}:
            quantity = rng.choice([1, 1, 2, 5, 10])
        discount = clamp(rng.gauss(14, 8), 0, 42)
        if scenario == "MARGIN_RECOVERY":
            discount = clamp(discount + rng.uniform(8, 20), 12, 48)
        net_unit_price = list_unit_price * (1 - discount / 100)
        arr = net_unit_price * quantity

        row = {
            "case_id": f"syn_case_{index % CASE_COUNT:04d}",
            "item_id": f"syn_item_{index:04d}",
            "account_segment": segment,
            "account_industry": industry,
            "health_score": round1(health),
            "open_escalation_count": escalations,
            "product_archetype": product_archetype,
            "product_family": product_family,
            "charge_model": charge_model,
            "gross_margin_percent": margin,
            "gross_margin_band": margin_band,
            "strategic_product_tier": tier,
            "attach_product_type": attach_type,
            "is_core_product": is_core,
            "usage_percent": round1(clamp(usage, 0, 135)),
            "active_user_percent": round1(clamp(active, 0, 100)),
            "login_trend_30d": round1(login),
            "ticket_count_90d": tickets,
            "sev1_count_90d": sev1,
            "csat_score": round1(clamp(csat, 1, 5)),
            "current_quantity": quantity,
            "current_discount_percent": round1(discount),
            "current_arr": round1(arr),
            "list_unit_price": round1(list_unit_price),
            "net_unit_price": round1(net_unit_price),
            "payment_risk_band": "LOW",
            "adoption_band": band_for_usage(usage),
            "demo_scenario_key": scenario,
        }
        row["payment_risk_band"] = payment_band(rng, scenario, row["health_score"])
        row["rule_risk_score"] = rule_score(row)
        row["rule_disposition"] = disposition_for(row)
        row["observed_reviewer_override"] = int(
            row["rule_disposition"] in {"ESCALATE", "RENEW_WITH_CONCESSION"}
            and rng.random() < 0.24
        )
        row.update(observed_outcomes(rng, row))
        rows.append(row)
    return rows


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = generate_rows()
    with open(DATA_PATH, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    scenario_counts = {}
    disposition_counts = {}
    for row in rows:
        scenario_counts[row["demo_scenario_key"]] = scenario_counts.get(row["demo_scenario_key"], 0) + 1
        disposition_counts[row["rule_disposition"]] = disposition_counts.get(row["rule_disposition"], 0) + 1

    print(
        json.dumps(
            {
                "status": "OK",
                "path": str(DATA_PATH),
                "rows": len(rows),
                "cases": CASE_COUNT,
                "productArchetypes": len(PRODUCTS),
                "scenarioCounts": scenario_counts,
                "ruleDispositionCounts": disposition_counts,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
