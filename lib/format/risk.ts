import { Tone } from '@/types/renewal-case'

export function toneForRisk(risk: string | null | undefined): Tone {
  switch (risk) {
    case 'LOW':
      return 'success'
    case 'MEDIUM':
      return 'warn'
    case 'HIGH':
      return 'danger'
    default:
      return 'default'
  }
}

export function toneForAction(action: string | null | undefined): Tone {
  switch (action) {
    case 'RENEW_AS_IS':
    case 'RENEW':
      return 'success'
    case 'CONTROLLED_UPLIFT':
      return 'info'
    case 'RENEW_WITH_CONCESSION':
    case 'DEFENSIVE_RENEWAL':
    case 'UPLIFT_RESTRAINT':
      return 'warn'
    case 'EXPAND':
    case 'CROSS_SELL':
    case 'MARGIN_RECOVERY':
      return 'info'
    case 'MIXED_ACTION_PLAN':
      return 'warn'
    case 'ESCALATE':
      return 'danger'
    default:
      return 'default'
  }
}

export function toneForStatus(status: string | null | undefined): Tone {
  switch (status) {
    case 'READY_FOR_REVIEW':
      return 'info'
    case 'UNDER_REVIEW':
      return 'warn'
    case 'REVISED':
    case 'REQUEST_REVISION':
      return 'warn'
    case 'APPROVED':
      return 'success'
    case 'REJECTED':
      return 'danger'
    case 'DRAFT':
    default:
      return 'default'
  }
}

export function labelize(value: string | null | undefined) {
  if (!value) return 'Unknown'

  const normalized = value.trim()
  const knownLabels: Record<string, string> = {
    ADOPTION_DECLINE: 'Adoption Decline',
    AI: 'AI',
    API: 'API',
    APPROVED: 'Approved',
    ARR: 'ARR',
    BASE_CASE: 'Base Case',
    COMPLETED: 'Completed',
    CONTROLLED_UPLIFT: 'Controlled Uplift',
    CUSTOMER_RISK_ESCALATION: 'Customer Risk Escalation',
    DEFENSIVE_RENEWAL: 'Defensive Renewal',
    DISABLED: 'Disabled',
    ERROR: 'Error',
    EXPANSION_PROPENSITY_SKLEARN: 'Expansion Propensity sklearn',
    EXPANSION_UPSIDE: 'Expansion Upside',
    FLOOR_PRICE_EXCEPTION: 'Floor Price Exception',
    HIGH: 'High',
    HYBRID_RULES_ML: 'ML-Assisted Rules',
    HUMAN_APPROVAL_REQUIRED: 'Human Approval Required',
    LLM_ASSISTED_GUARDED: 'LLM-Assisted Guarded',
    LLM_CRITIC_SHADOW: 'LLM Critic Shadow',
    LLM_RANKING_SHADOW: 'LLM Ranking Shadow',
    LOW: 'Low',
    MEDIUM: 'Medium',
    MIXED_ACTION_PLAN: 'Mixed Action Plan',
    ML_SHADOW: 'Shadow Mode',
    MODEL_MISSING: 'Model Missing',
    OK: 'OK',
    READY_FOR_REVIEW: 'Ready for Review',
    RECOMMENDATION_RECALCULATION: 'Recommendation Recalculation',
    RENEW_AS_IS: 'Renew as Is',
    RENEW_WITH_CONCESSION: 'Renew with Concession',
    RULES_ONLY: 'Rules Only',
    RULE_ENGINE: 'Rule Engine',
    RULE_ENGINE_WITH_ML_SHADOW: 'Rule Engine with ML Shadow',
    SKU: 'SKU',
    UNDER_REVIEW: 'Under Review',
    UNAVAILABLE: 'Unavailable',
    UPLIFT_RESTRAINT: 'Uplift Restraint',
    accuracy: 'Accuracy',
    f1: 'F1',
    mae: 'MAE',
    precision: 'Precision',
    r2: 'R2',
    recall: 'Recall',
    rmse: 'RMSE',
    rocAuc: 'ROC AUC',
  }

  if (knownLabels[normalized]) return knownLabels[normalized]

  return normalized
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .replace(/\b(Ai|Api|Arr|Cac|Cogs|Csv|Id|Llm|Ml|Ok|Sku|Url)\b/g, (match) =>
      match.toUpperCase(),
    )
}
