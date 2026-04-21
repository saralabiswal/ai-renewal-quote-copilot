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

export type RuleFlowStep = {
  id: string
  title: string
  detail: string
  outcome: string
}

export const recommendationRuleSources = [
  'lib/rules/renewal-scoring.ts',
  'lib/rules/recommendation-engine.ts',
  'lib/rules/pricing-guardrails.ts',
] as const

export const quoteInsightRuleSources = ['lib/db/quote-insights.ts'] as const

export const recommendationFlowSteps: RuleFlowStep[] = [
  {
    id: 'R1',
    title: 'Ingest Baseline Signals',
    detail:
      'Read latest subscription metrics, commercial baselines, and matched pricing policy thresholds.',
    outcome: 'Normalized line inputs',
  },
  {
    id: 'R2',
    title: 'Score Renewal Risk',
    detail: 'Apply weighted risk signals and clamp each line score to 0..100.',
    outcome: 'Risk score + key drivers per line',
  },
  {
    id: 'R3',
    title: 'Select Disposition',
    detail: 'Apply precedence rules: ESCALATE > EXPAND > RENEW_WITH_CONCESSION > RENEW.',
    outcome: 'Provisional action + target terms',
  },
  {
    id: 'R4',
    title: 'Apply Guardrails',
    detail:
      'Evaluate max auto-discount, approval threshold, floor price, and Sev1 escalation policy gates.',
    outcome: 'Guardrail result + approval flag',
  },
  {
    id: 'R5',
    title: 'Roll Up Bundle Action',
    detail: 'Combine line outcomes into bundle-level recommendation using fixed precedence.',
    outcome: 'Case action, bundle risk level, ARR delta',
  },
  {
    id: 'R6',
    title: 'Publish Recommendation State',
    detail:
      'Persist recommendation output and mark quote insights stale so downstream insight refresh is explicit.',
    outcome: 'Case ready for insight regeneration',
  },
]

export const insightFlowSteps: RuleFlowStep[] = [
  {
    id: 'I1',
    title: 'Start from Recommended Lines',
    detail:
      'Take latest recommendation output (disposition, risk, pricing deltas, policy context) as primary input.',
    outcome: 'Line recommendation context',
  },
  {
    id: 'I2',
    title: 'Map to Insight Types',
    detail: 'Translate dispositions to quote insight types and default action summaries.',
    outcome: 'Base quote insight candidates',
  },
  {
    id: 'I3',
    title: 'Apply Additive Rules',
    detail:
      'Add strategic optional lines (for example Cloud@Customer or AI Data Platform) only when eligibility conditions pass.',
    outcome: 'Expanded candidate set',
  },
  {
    id: 'I4',
    title: 'Score Confidence and Fit',
    detail:
      'Compute confidence/fit bands and expected commercial impact values to prioritize reviewer attention.',
    outcome: 'Rankable insight quality metrics',
  },
  {
    id: 'I5',
    title: 'Deduplicate and Preserve Applied',
    detail:
      'Prevent duplicates by insightType+productSku key and keep already-added insights stable across regenerations.',
    outcome: 'Deterministic suggestion set',
  },
  {
    id: 'I6',
    title: 'Persist and Link Narratives',
    detail:
      'Persist quote insights with structured evidence and AI narrative linkage for reviewer traceability.',
    outcome: 'Actionable insight cards in Quote Insights panel',
  },
]

export const recommendationRuleSections: RulebookSection[] = [
  {
    title: 'Item Risk Scoring Signals',
    description:
      'Each renewal line receives a risk score from product usage, support, and customer-health signals.',
    rows: [
      {
        trigger: 'Usage < 35% entitlement',
        effect: '+28 risk',
        notes: 'Strong underutilization signal; highest adoption-risk weight.',
      },
      {
        trigger: 'Usage 35% to 54%',
        effect: '+16 risk',
        notes: 'Moderate underuse; recovery likely needed before renewal.',
      },
      {
        trigger: 'Usage > 75%',
        effect: '-4 risk',
        notes: 'Healthy utilization lowers churn pressure.',
      },
      {
        trigger: 'Usage > 90%',
        effect: '-8 risk',
        notes: 'Very strong adoption can support expansion posture.',
      },
      {
        trigger: 'Active users < 35%',
        effect: '+16 risk',
        notes: 'Low penetration indicates weak end-user stickiness.',
      },
      {
        trigger: 'Active users > 80%',
        effect: '-5 risk',
        notes: 'Broad engagement generally improves retention confidence.',
      },
      {
        trigger: '30-day login trend <= -10%',
        effect: '+12 risk',
        notes: 'Rapid engagement decline is an early churn signal.',
      },
      {
        trigger: '30-day login trend >= +8%',
        effect: '-4 risk',
        notes: 'Improving engagement reduces near-term risk.',
      },
      {
        trigger: 'Tickets >= 20 (90d)',
        effect: '+15 risk',
        notes: 'High support burden implies adoption friction.',
      },
      {
        trigger: 'Tickets >= 10 (90d)',
        effect: '+8 risk',
        notes: 'Elevated support volume still increases risk.',
      },
      {
        trigger: 'Tickets <= 3 (90d)',
        effect: '-3 risk',
        notes: 'Low support load indicates operational stability.',
      },
      {
        trigger: 'Sev1 incidents >= 3 (90d)',
        effect: '+22 risk',
        notes: 'Critical incidents strongly force escalation posture.',
      },
      {
        trigger: 'Sev1 incidents >= 1 (90d)',
        effect: '+10 risk',
        notes: 'Any sev1 event is treated as material risk.',
      },
      {
        trigger: 'CSAT < 3.3',
        effect: '+12 risk',
        notes: 'Low customer sentiment can outweigh healthy usage.',
      },
      {
        trigger: 'CSAT >= 4.5',
        effect: '-4 risk',
        notes: 'High sentiment supports renewal confidence.',
      },
      {
        trigger: 'Payment risk = HIGH / MEDIUM',
        effect: '+15 / +8 risk',
        notes: 'Commercial collection risk is explicitly modeled.',
      },
      {
        trigger: 'Adoption band = WEAK / LOW',
        effect: '+10 risk',
        notes: 'Qualitative adoption weakness confirms churn pressure.',
      },
      {
        trigger: 'Adoption band = MODERATE / MEDIUM',
        effect: '+2 risk',
        notes: 'Slightly negative modifier; not a blocker by itself.',
      },
      {
        trigger: 'Adoption band = STRONG / HIGH',
        effect: '-3 risk',
        notes: 'Strong adoption quality offsets other soft risks.',
      },
      {
        trigger: 'Adoption band = VERY_STRONG',
        effect: '-6 risk',
        notes: 'Best adoption posture receives strongest reduction.',
      },
      {
        trigger: 'AI / Data family product with usage < 40%',
        effect: '+6 risk',
        notes: 'AI/data products are penalized more when adoption is weak.',
      },
      {
        trigger: 'Final line risk score',
        effect: 'Clamp to 0-100',
        notes: 'Prevents out-of-range score artifacts.',
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
        notes: 'Safety-first rule; overrides expansion eligibility.',
      },
      {
        trigger: 'Usage >= expansion threshold AND risk < 40',
        effect: 'Disposition: EXPAND; discount -2 points (or floor at 0); quantity ~ +10%',
        notes: 'Growth motion only when adoption is strong and risk is low.',
      },
      {
        trigger: 'Risk >= 55',
        effect: 'Disposition: RENEW_WITH_CONCESSION; discount +5 points',
        notes: 'Retention protection posture for moderate/high risk lines.',
      },
      {
        trigger: 'Else',
        effect: 'Disposition: RENEW (no discount or quantity change)',
        notes: 'Default action when no forcing rule is triggered.',
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
        notes: 'Highest precedence to avoid hidden critical risk.',
      },
      {
        trigger: 'Else any line = RENEW_WITH_CONCESSION',
        effect: 'Bundle action = RENEW_WITH_CONCESSION',
        notes: 'Second precedence; concession beats expansion at bundle level.',
      },
      {
        trigger: 'Else any line = EXPAND',
        effect: 'Bundle action = EXPAND',
        notes: 'Growth path when no concession or escalation blockers exist.',
      },
      {
        trigger: 'Else',
        effect: 'Bundle action = RENEW_AS_IS',
        notes: 'Stable bundle with no active risk or growth forcing rule.',
      },
      {
        trigger: 'Bundle risk level',
        effect: 'HIGH if score >= 70, MEDIUM if >= 40, else LOW',
        notes: 'Used for lane placement, badges, and reviewer triage.',
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
        notes: 'Above auto-approve threshold; still processable but routed for approval.',
      },
      {
        trigger: 'Proposed discount >= approvalDiscountPercent',
        effect: 'Approval required (APPROVAL_REQUIRED)',
        notes: 'Hard approval gate for higher concession depth.',
      },
      {
        trigger: 'Proposed price as % of list < floorPricePercentOfList',
        effect: 'Approval required (FLOOR_PRICE_EXCEPTION)',
        notes: 'Floor-price breach supersedes generic approval reason.',
      },
      {
        trigger: 'Sev1 count >= requiresEscalationIfSev1Count',
        effect: 'Approval required (SEV1_ESCALATION)',
        notes: 'Operational instability forces escalation regardless of discount posture.',
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
        notes: 'Margin recapture motion for lines drifting below policy comfort.',
      },
      {
        trigger: 'CONCESSION',
        effect: 'Insight type: CONCESSION; guidance: controlled concession to protect renewal',
        notes: 'Retention posture with constrained concession depth.',
      },
      {
        trigger: 'RENEW_WITH_CONCESSION',
        effect: 'Insight type: CONCESSION; guidance: controlled concession with reviewer guardrails',
        notes: 'Normalized to same insight family for reviewer consistency.',
      },
      {
        trigger: 'ESCALATE',
        effect: 'Insight type: DEFENSIVE_RENEWAL; guidance: hold pricing and route to escalation review',
        notes: 'Protective mode; avoid aggressive commercial moves.',
      },
      {
        trigger: 'EXPANSION or EXPAND',
        effect: 'Insight type: EXPANSION; guidance: increase quantity',
        notes: 'Growth action for low-risk/high-adoption conditions.',
      },
      {
        trigger: 'DEFENSIVE_RENEWAL',
        effect: 'Insight type: DEFENSIVE_RENEWAL; guidance: hold price and avoid pressure',
        notes: 'Preserves defensive posture end-to-end.',
      },
      {
        trigger: 'UPLIFT_RESTRAINT',
        effect: 'Insight type: UPLIFT_RESTRAINT; guidance: avoid uplift',
        notes: 'Explicitly suppresses uplift despite possible price recovery opportunities.',
      },
      {
        trigger: 'CONTROLLED_UPLIFT or UPLIFT',
        effect: 'Insight type: CONTROLLED_UPLIFT; guidance: modest uplift for low-risk posture',
        notes: 'Measured uplift for healthy accounts where risk remains low.',
      },
      {
        trigger: 'Default / RENEW',
        effect: 'Insight type: RENEW_AS_IS; guidance: keep draft unchanged',
        notes: 'Fallback when no specialized motion is justified.',
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
        notes: 'Hybrid additive line is gated by eligibility and suppression rules.',
      },
      {
        trigger:
          '(OCI OR Autonomous AI DB present) AND AI Data Platform absent AND not risk scenario',
        effect:
          'Add AI Data Platform insight as CROSS_SELL (or DATA_MODERNIZATION for Healthcare)',
        notes: 'Requires platform adjacency plus whitespace in current product mix.',
      },
      {
        trigger: 'Scenario = CUSTOMER_RISK_ESCALATION or ADOPTION_DECLINE',
        effect: 'Suppress additive upsell insights',
        notes: 'Risk scenarios intentionally block upsell-style additive motions.',
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
        notes: 'Confidence drops faster than fit as risk rises.',
      },
      {
        trigger: 'Line insight fit score',
        effect: 'Clamp(100 - riskScore/3, 50..95)',
        notes: 'Commercial fit degrades more gradually than confidence.',
      },
      {
        trigger: 'Duplicate prevention key',
        effect: 'insightType + productSku',
        notes: 'Ensures only one active suggestion per motion+product pair.',
      },
      {
        trigger: 'Already ADDED_TO_QUOTE insights',
        effect: 'Retained and excluded from re-generated suggested set',
        notes: 'Protects user-applied decisions from regeneration churn.',
      },
      {
        trigger: 'Regeneration',
        effect: 'Rebuild suggested insights and store added/removed/modified diff summary',
        notes: 'Powers What Changed audit visibility between runs.',
      },
    ],
  },
]
