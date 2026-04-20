export type RulebookLine = {
  trigger: string
  effect: string
  notes?: string
}

export type RulebookSection = {
  title: string
  description: string
  rows: RulebookLine[]
}

export const recommendationRuleSources = [
  'lib/rules/renewal-scoring.ts',
  'lib/rules/recommendation-engine.ts',
  'lib/rules/pricing-guardrails.ts',
] as const

export const quoteInsightRuleSources = [
  'lib/db/quote-insights.ts',
] as const

export const recommendationRuleSections: RulebookSection[] = [
  {
    title: 'Item Risk Scoring Signals',
    description:
      'Each renewal line receives a risk score from product usage, support, and customer-health signals.',
    rows: [
      { trigger: 'Usage < 35% entitlement', effect: '+28 risk' },
      { trigger: 'Usage 35% to 54%', effect: '+16 risk' },
      { trigger: 'Usage > 75%', effect: '-4 risk' },
      { trigger: 'Usage > 90%', effect: '-8 risk' },
      { trigger: 'Active users < 35%', effect: '+16 risk' },
      { trigger: 'Active users > 80%', effect: '-5 risk' },
      { trigger: '30-day login trend <= -10%', effect: '+12 risk' },
      { trigger: '30-day login trend >= +8%', effect: '-4 risk' },
      { trigger: 'Tickets >= 20 (90d)', effect: '+15 risk' },
      { trigger: 'Tickets >= 10 (90d)', effect: '+8 risk' },
      { trigger: 'Tickets <= 3 (90d)', effect: '-3 risk' },
      { trigger: 'Sev1 incidents >= 3 (90d)', effect: '+22 risk' },
      { trigger: 'Sev1 incidents >= 1 (90d)', effect: '+10 risk' },
      { trigger: 'CSAT < 3.3', effect: '+12 risk' },
      { trigger: 'CSAT >= 4.5', effect: '-4 risk' },
      { trigger: 'Payment risk = HIGH / MEDIUM', effect: '+15 / +8 risk' },
      { trigger: 'Adoption band = WEAK / LOW', effect: '+10 risk' },
      { trigger: 'Adoption band = MODERATE / MEDIUM', effect: '+2 risk' },
      { trigger: 'Adoption band = STRONG / HIGH', effect: '-3 risk' },
      { trigger: 'Adoption band = VERY_STRONG', effect: '-6 risk' },
      {
        trigger: 'AI / Data family product with usage < 40%',
        effect: '+6 risk',
        notes: 'AI/data adoption penalty.',
      },
      {
        trigger: 'Final line risk score',
        effect: 'Clamp to 0-100',
      },
    ],
  },
  {
    title: 'Disposition Decision Rules',
    description:
      'After scoring, each line gets a commercial disposition and target price/quantity treatment.',
    rows: [
      {
        trigger: 'Risk >= 80 OR Sev1 >= 3',
        effect: 'Disposition: ESCALATE; discount +3 points minimum; quantity ~ -10%',
      },
      {
        trigger: 'Usage >= expansion threshold AND risk < 40',
        effect: 'Disposition: EXPAND; discount -2 points (or floor at 0); quantity ~ +10%',
      },
      {
        trigger: 'Risk >= 55',
        effect: 'Disposition: RENEW_WITH_CONCESSION; discount +5 points',
      },
      {
        trigger: 'Else',
        effect: 'Disposition: RENEW (no discount or quantity change)',
      },
    ],
  },
  {
    title: 'Bundle Rollup Rules',
    description: 'Bundle-level recommendation is based on line outcomes with fixed precedence.',
    rows: [
      {
        trigger: 'Any line = ESCALATE',
        effect: 'Bundle action = ESCALATE',
      },
      {
        trigger: 'Else any line = RENEW_WITH_CONCESSION',
        effect: 'Bundle action = RENEW_WITH_CONCESSION',
      },
      {
        trigger: 'Else any line = EXPAND',
        effect: 'Bundle action = EXPAND',
      },
      {
        trigger: 'Else',
        effect: 'Bundle action = RENEW_AS_IS',
      },
      {
        trigger: 'Bundle risk level',
        effect: 'HIGH if score >= 70, MEDIUM if >= 40, else LOW',
      },
    ],
  },
  {
    title: 'Pricing Guardrail Checks',
    description:
      'Line recommendations are evaluated against pricing policy thresholds before final output.',
    rows: [
      {
        trigger: 'Proposed discount > maxAutoDiscountPercent',
        effect: 'Approval required (APPROVAL_REQUIRED)',
      },
      {
        trigger: 'Proposed discount >= approvalDiscountPercent',
        effect: 'Approval required (APPROVAL_REQUIRED)',
      },
      {
        trigger: 'Proposed price as % of list < floorPricePercentOfList',
        effect: 'Approval required (FLOOR_PRICE_EXCEPTION)',
      },
      {
        trigger: 'Sev1 count >= requiresEscalationIfSev1Count',
        effect: 'Approval required (SEV1_ESCALATION)',
      },
    ],
  },
]

export const quoteInsightRuleSections: RulebookSection[] = [
  {
    title: 'Line Insight Mapping',
    description:
      'Each recommended line disposition maps to a quote insight type and suggested quote action.',
    rows: [
      {
        trigger: 'MARGIN_RECOVERY or PRICE_ADJUST',
        effect: 'Insight type: MARGIN_RECOVERY; guidance: reduce discount depth toward policy',
      },
      {
        trigger: 'CONCESSION',
        effect: 'Insight type: CONCESSION; guidance: controlled concession to protect renewal',
      },
      {
        trigger: 'RENEW_WITH_CONCESSION',
        effect: 'Insight type: CONCESSION; guidance: controlled concession with reviewer guardrails',
      },
      {
        trigger: 'ESCALATE',
        effect: 'Insight type: DEFENSIVE_RENEWAL; guidance: hold pricing and route to escalation review',
      },
      {
        trigger: 'EXPANSION or EXPAND',
        effect: 'Insight type: EXPANSION; guidance: increase quantity',
      },
      {
        trigger: 'DEFENSIVE_RENEWAL',
        effect: 'Insight type: DEFENSIVE_RENEWAL; guidance: hold price and avoid pressure',
      },
      {
        trigger: 'UPLIFT_RESTRAINT',
        effect: 'Insight type: UPLIFT_RESTRAINT; guidance: avoid uplift',
      },
      {
        trigger: 'CONTROLLED_UPLIFT or UPLIFT',
        effect: 'Insight type: CONTROLLED_UPLIFT; guidance: modest uplift for low-risk posture',
      },
      {
        trigger: 'Default / RENEW',
        effect: 'Insight type: RENEW_AS_IS; guidance: keep draft unchanged',
      },
    ],
  },
  {
    title: 'Additive Insight Rules',
    description: 'The engine may add new strategic lines when account context supports it.',
    rows: [
      {
        trigger:
          '(Regulated industry OR EXPANSION_UPSIDE scenario) AND no Cloud@Customer already applied AND not risk scenario',
        effect: 'Add HYBRID_DEPLOYMENT_FIT insight for Oracle Cloud@Customer',
      },
      {
        trigger:
          '(OCI OR Autonomous AI DB present) AND AI Data Platform absent AND not risk scenario',
        effect:
          'Add AI Data Platform insight as CROSS_SELL (or DATA_MODERNIZATION for Healthcare)',
      },
      {
        trigger: 'Scenario = CUSTOMER_RISK_ESCALATION or ADOPTION_DECLINE',
        effect: 'Suppress additive upsell insights',
      },
    ],
  },
  {
    title: 'Scoring, Dedupe, and Refresh Behavior',
    description:
      'Scoring and persistence logic keeps suggestion quality stable while preventing duplicates.',
    rows: [
      {
        trigger: 'Line insight confidence score',
        effect: 'Clamp(100 - riskScore/2, 50..95)',
      },
      {
        trigger: 'Line insight fit score',
        effect: 'Clamp(100 - riskScore/3, 50..95)',
      },
      {
        trigger: 'Duplicate prevention key',
        effect: 'insightType + productSku',
      },
      {
        trigger: 'Already ADDED_TO_QUOTE insights',
        effect: 'Retained and excluded from re-generated suggested set',
      },
      {
        trigger: 'Regeneration',
        effect: 'Rebuild suggested insights and store added/removed/modified diff summary',
      },
    ],
  },
]
