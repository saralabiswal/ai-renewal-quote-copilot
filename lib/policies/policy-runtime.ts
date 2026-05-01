import type { DecisionCandidateEnvelope } from '@/lib/decision/candidates'
import type { GuardedValidationResult } from '@/lib/decision/guarded-validator'
import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export const POLICY_RUNTIME_VERSION = 'policy-runtime-v1'
export const POLICY_REGISTRY_ID = 'renewal-policy-registry-2026-q2'

export type PolicyArtifactType =
  | 'RISK_SCORING'
  | 'DISPOSITION_ELIGIBILITY'
  | 'PRICING_GUARDRAIL'
  | 'APPROVAL_ROUTING'
  | 'QUOTE_INSIGHT_MAPPING'
  | 'SCENARIO_GENERATION'
  | 'LLM_VALIDATION'

export type PolicyArtifact = {
  id: string
  version: string
  type: PolicyArtifactType
  label: string
  owner: string
  sourceRefs: string[]
}

export type PolicyRuleHit = {
  policyId: string
  policyVersion: string
  ruleId: string
  scope: 'CASE' | 'LINE'
  subjectId: string
  outcome: 'APPLIED' | 'SKIPPED' | 'WARN' | 'BLOCKED'
  detail: string
  evidenceRefs: string[]
}

export type PolicyEvaluationTrace = {
  policyRuntimeVersion: typeof POLICY_RUNTIME_VERSION
  policyRegistryId: typeof POLICY_REGISTRY_ID
  generatedAt: string
  activeArtifacts: PolicyArtifact[]
  ruleHits: PolicyRuleHit[]
  summary: {
    artifactCount: number
    ruleHitCount: number
    appliedCount: number
    warningCount: number
    blockedCount: number
    approvalRequiredCount: number
  }
}

export const ACTIVE_POLICY_ARTIFACTS: PolicyArtifact[] = [
  {
    id: 'renewal-risk-scoring-policy',
    version: '2026.2.0',
    type: 'RISK_SCORING',
    label: 'Renewal Risk Scoring Policy',
    owner: 'Revenue Operations',
    sourceRefs: ['lib/rules/renewal-scoring.ts'],
  },
  {
    id: 'renewal-disposition-policy',
    version: '2026.2.0',
    type: 'DISPOSITION_ELIGIBILITY',
    label: 'Renewal Disposition Eligibility Policy',
    owner: 'Customer Success Operations',
    sourceRefs: ['lib/rules/recommendation-engine.ts'],
  },
  {
    id: 'renewal-pricing-guardrail-policy',
    version: '2026.2.0',
    type: 'PRICING_GUARDRAIL',
    label: 'Renewal Pricing Guardrail Policy',
    owner: 'Deal Desk',
    sourceRefs: ['lib/rules/pricing-guardrails.ts'],
  },
  {
    id: 'renewal-approval-routing-policy',
    version: '2026.2.0',
    type: 'APPROVAL_ROUTING',
    label: 'Renewal Approval Routing Policy',
    owner: 'Deal Desk',
    sourceRefs: ['lib/rules/pricing-guardrails.ts', 'lib/rules/recommendation-engine.ts'],
  },
  {
    id: 'quote-insight-mapping-policy',
    version: '2026.2.0',
    type: 'QUOTE_INSIGHT_MAPPING',
    label: 'Quote Insight Mapping Policy',
    owner: 'Product GTM',
    sourceRefs: ['lib/db/quote-insights.ts'],
  },
  {
    id: 'scenario-generation-policy',
    version: '2026.2.0',
    type: 'SCENARIO_GENERATION',
    label: 'Scenario Generation Policy',
    owner: 'Revenue Operations',
    sourceRefs: ['lib/db/quote-scenarios.ts'],
  },
  {
    id: 'guarded-llm-validation-policy',
    version: '2026.2.0',
    type: 'LLM_VALIDATION',
    label: 'Guarded LLM Validation Policy',
    owner: 'AI Governance',
    sourceRefs: ['lib/decision/guarded-validator.ts'],
  },
]

const artifactById = new Map(ACTIVE_POLICY_ARTIFACTS.map((artifact) => [artifact.id, artifact]))

function policy(id: string) {
  const artifact = artifactById.get(id)
  if (!artifact) throw new Error(`Policy artifact ${id} is not registered.`)
  return artifact
}

function hit(args: Omit<PolicyRuleHit, 'policyVersion'>): PolicyRuleHit {
  const artifact = policy(args.policyId)
  return {
    ...args,
    policyVersion: artifact.version,
  }
}

function metricEvidenceRefs(itemId: string) {
  return [
    `item.${itemId}.metric.usage_percent`,
    `item.${itemId}.metric.active_user_percent`,
    `item.${itemId}.metric.login_trend_30d`,
    `item.${itemId}.metric.ticket_count_90d`,
    `item.${itemId}.metric.sev1_count_90d`,
    `item.${itemId}.metric.csat_score`,
    `item.${itemId}.metric.payment_risk_band`,
    `item.${itemId}.metric.adoption_band`,
  ]
}

function commercialEvidenceRefs(itemId: string) {
  return [
    `item.${itemId}.commercial.rule_risk_score`,
    `item.${itemId}.commercial.final_risk_score`,
    `item.${itemId}.commercial.final_disposition`,
  ]
}

export function buildPolicyEvaluationTrace(args: {
  input: RenewalCaseEngineInput
  ruleOutput: RenewalCaseEngineOutput
  finalOutput: RenewalCaseEngineOutput
  decisionCandidates: DecisionCandidateEnvelope
  validationResult: GuardedValidationResult
}): PolicyEvaluationTrace {
  const generatedAt = new Date().toISOString()
  const finalItemById = new Map(args.finalOutput.itemResults.map((item) => [item.itemId, item]))
  const ruleHits: PolicyRuleHit[] = []

  for (const inputItem of args.input.items) {
    const item = finalItemById.get(inputItem.id)
    if (!item) continue

    ruleHits.push(
      hit({
        policyId: 'renewal-risk-scoring-policy',
        ruleId: 'risk-score-line',
        scope: 'LINE',
        subjectId: inputItem.id,
        outcome: 'APPLIED',
        detail: `${item.productName} scored ${item.riskScore} (${item.riskLevel}) from telemetry, support, payment, and adoption signals.`,
        evidenceRefs: metricEvidenceRefs(inputItem.id),
      }),
    )

    ruleHits.push(
      hit({
        policyId: 'renewal-disposition-policy',
        ruleId: `disposition-${item.recommendedDisposition.toLowerCase()}`,
        scope: 'LINE',
        subjectId: inputItem.id,
        outcome: 'APPLIED',
        detail: `${item.productName} selected ${item.recommendedDisposition} with ${item.recommendedDiscountPercent}% target discount and quantity ${item.proposedQuantity}.`,
        evidenceRefs: [
          ...metricEvidenceRefs(inputItem.id),
          ...commercialEvidenceRefs(inputItem.id),
        ],
      }),
    )

    ruleHits.push(
      hit({
        policyId: 'renewal-pricing-guardrail-policy',
        ruleId: `guardrail-${item.guardrailResult.toLowerCase()}`,
        scope: 'LINE',
        subjectId: inputItem.id,
        outcome:
          item.guardrailResult === 'WITHIN_POLICY'
            ? 'APPLIED'
            : item.guardrailResult === 'APPROVAL_REQUIRED'
              ? 'WARN'
              : 'BLOCKED',
        detail: `${item.productName} guardrail result is ${item.guardrailResult}; approval required: ${item.approvalRequired ? 'yes' : 'no'}.`,
        evidenceRefs: [
          `item.${inputItem.id}.commercial.current_discount_percent`,
          `item.${inputItem.id}.commercial.current_arr`,
          ...commercialEvidenceRefs(inputItem.id),
        ],
      }),
    )

    if (item.approvalRequired) {
      ruleHits.push(
        hit({
          policyId: 'renewal-approval-routing-policy',
          ruleId: 'approval-required',
          scope: 'LINE',
          subjectId: inputItem.id,
          outcome: 'WARN',
          detail: `${item.productName} requires approval because pricing or escalation guardrails were triggered.`,
          evidenceRefs: commercialEvidenceRefs(inputItem.id),
        }),
      )
    }
  }

  ruleHits.push(
    hit({
      policyId: 'renewal-disposition-policy',
      ruleId: `bundle-action-${args.finalOutput.bundleResult.recommendedAction.toLowerCase()}`,
      scope: 'CASE',
      subjectId: args.input.account.id,
      outcome: 'APPLIED',
      detail: `Bundle action resolved to ${args.finalOutput.bundleResult.recommendedAction} with ${args.finalOutput.bundleResult.riskLevel} risk and ${args.finalOutput.bundleResult.bundleDeltaArr} ARR delta.`,
      evidenceRefs: ['account.segment', 'account.health_score'],
    }),
  )

  ruleHits.push(
    hit({
      policyId: 'quote-insight-mapping-policy',
      ruleId: 'mark-insights-refresh-required',
      scope: 'CASE',
      subjectId: args.input.account.id,
      outcome: 'APPLIED',
      detail:
        'Recommendation recalculation completed; quote insights should be regenerated explicitly so downstream suggestions stay traceable.',
      evidenceRefs: ['account.segment'],
    }),
  )

  ruleHits.push(
    hit({
      policyId: 'guarded-llm-validation-policy',
      ruleId: `validator-${args.validationResult.status.toLowerCase()}`,
      scope: 'CASE',
      subjectId: args.input.account.id,
      outcome: args.validationResult.status === 'PASSED' ? 'APPLIED' : 'BLOCKED',
      detail: `Guarded proposal ${args.validationResult.status.toLowerCase()}; accepted candidate ${args.validationResult.acceptedCandidate}; fallback used: ${args.validationResult.fallbackUsed ? 'yes' : 'no'}.`,
      evidenceRefs: ['account.segment', 'account.health_score'],
    }),
  )

  const appliedCount = ruleHits.filter((item) => item.outcome === 'APPLIED').length
  const warningCount = ruleHits.filter((item) => item.outcome === 'WARN').length
  const blockedCount = ruleHits.filter((item) => item.outcome === 'BLOCKED').length
  const approvalRequiredCount = args.finalOutput.itemResults.filter(
    (item) => item.approvalRequired,
  ).length

  return {
    policyRuntimeVersion: POLICY_RUNTIME_VERSION,
    policyRegistryId: POLICY_REGISTRY_ID,
    generatedAt,
    activeArtifacts: ACTIVE_POLICY_ARTIFACTS,
    ruleHits,
    summary: {
      artifactCount: ACTIVE_POLICY_ARTIFACTS.length,
      ruleHitCount: ruleHits.length,
      appliedCount,
      warningCount,
      blockedCount,
      approvalRequiredCount,
    },
  }
}
