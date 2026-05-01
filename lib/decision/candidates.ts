import type { RenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import type { RecommendedAction, RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export const DECISION_CANDIDATE_VERSION = 'decision-candidates-v1'

export type CandidateEligibility = 'ALLOWED' | 'BLOCKED' | 'REQUIRES_APPROVAL'
export type CandidateScope = 'BUNDLE_RECOMMENDATION' | 'LINE_RECOMMENDATION'

export type DecisionCandidate = {
  candidateId: string
  scope: CandidateScope
  subjectId: string
  candidateType: string
  eligibility: CandidateEligibility
  score: number
  reasonCodes: string[]
  evidenceRefs: string[]
  policyRefs: string[]
  selectedByRules: boolean
  blockedReason: string | null
}

export type DecisionCandidateEnvelope = {
  candidateVersion: typeof DECISION_CANDIDATE_VERSION
  generatedAt: string
  ruleWinner: RecommendedAction
  allowedCandidates: string[]
  blockedCandidates: string[]
  candidates: DecisionCandidate[]
}

function itemEvidenceRefs(itemId: string, keys: string[]) {
  return keys.map((key) => `item.${itemId}.${key}`)
}

function allowedOrBlocked(condition: boolean, blockedReason: string): {
  eligibility: CandidateEligibility
  blockedReason: string | null
} {
  return condition
    ? { eligibility: 'ALLOWED', blockedReason: null }
    : { eligibility: 'BLOCKED', blockedReason }
}

function candidate(args: Omit<DecisionCandidate, 'candidateId'>): DecisionCandidate {
  return {
    ...args,
    candidateId: `${args.scope.toLowerCase()}_${args.subjectId}_${args.candidateType.toLowerCase()}`,
  }
}

export function buildDecisionCandidateEnvelope(args: {
  caseId: string
  input: RenewalCaseEngineInput
  finalOutput: RenewalCaseEngineOutput
  evidenceSnapshot: RenewalEvidenceSnapshot
}): DecisionCandidateEnvelope {
  const generatedAt = new Date().toISOString()
  const output = args.finalOutput
  const riskScore = output.bundleResult.riskScore
  const hasApproval = output.bundleResult.approvalRequired
  const hasExpansionLine = output.itemResults.some((item) => item.recommendedDisposition === 'EXPAND')
  const hasConcessionLine = output.itemResults.some(
    (item) => item.recommendedDisposition === 'RENEW_WITH_CONCESSION',
  )
  const hasEscalationLine = output.itemResults.some(
    (item) => item.recommendedDisposition === 'ESCALATE' || item.guardrailResult === 'SEV1_ESCALATION',
  )

  const bundleDefinitions: Array<{
    type: RecommendedAction
    score: number
    condition: boolean
    blockedReason: string
    reasonCodes: string[]
  }> = [
    {
      type: 'RENEW_AS_IS',
      score: Math.max(0, 100 - riskScore),
      condition: riskScore < 40 && !hasApproval,
      blockedReason: 'Risk or approval posture does not support a clean renew-as-is recommendation.',
      reasonCodes: ['LOW_RISK', 'STABLE_RENEWAL'],
    },
    {
      type: 'EXPAND',
      score: hasExpansionLine ? 85 : Math.max(0, 70 - riskScore),
      condition: hasExpansionLine,
      blockedReason: 'No renewal line met expansion eligibility thresholds.',
      reasonCodes: ['EXPANSION_ELIGIBLE', 'STRONG_ADOPTION'],
    },
    {
      type: 'RENEW_WITH_CONCESSION',
      score: hasConcessionLine ? 82 : Math.max(0, riskScore),
      condition: hasConcessionLine || riskScore >= 55,
      blockedReason: 'Risk and line disposition do not justify concession posture.',
      reasonCodes: ['RETENTION_RISK', 'CONCESSION_ELIGIBLE'],
    },
    {
      type: 'ESCALATE',
      score: hasEscalationLine || riskScore >= 70 ? 90 : Math.max(0, riskScore - 10),
      condition: hasEscalationLine || riskScore >= 70 || hasApproval,
      blockedReason: 'No escalation, high-risk, or approval trigger was present.',
      reasonCodes: ['GOVERNANCE_REVIEW', 'HIGH_RISK_OR_APPROVAL'],
    },
  ]

  const bundleCandidates = bundleDefinitions.map((definition) => {
    const eligibility = allowedOrBlocked(definition.condition, definition.blockedReason)
    return candidate({
      scope: 'BUNDLE_RECOMMENDATION',
      subjectId: args.caseId,
      candidateType: definition.type,
      eligibility: eligibility.eligibility,
      score: Math.round(definition.score),
      reasonCodes: definition.reasonCodes,
      evidenceRefs: [
        'account.segment',
        'account.health_score',
        ...args.input.items.flatMap((item) =>
          itemEvidenceRefs(item.id, [
            'metric.usage_percent',
            'metric.ticket_count_90d',
            'metric.sev1_count_90d',
            'commercial.final_risk_score',
            'commercial.final_disposition',
          ]),
        ),
      ],
      policyRefs: ['recommendation-engine-v1', 'pricing-policy-matrix-2026-q2'],
      selectedByRules: output.bundleResult.recommendedAction === definition.type,
      blockedReason: eligibility.blockedReason,
    })
  })

  const lineCandidates = output.itemResults.map((item) =>
    candidate({
      scope: 'LINE_RECOMMENDATION',
      subjectId: item.itemId,
      candidateType: item.recommendedDisposition,
      eligibility: item.approvalRequired ? 'REQUIRES_APPROVAL' : 'ALLOWED',
      score: item.riskScore,
      reasonCodes: [item.recommendedDisposition, item.guardrailResult],
      evidenceRefs: itemEvidenceRefs(item.itemId, [
        'metric.usage_percent',
        'metric.active_user_percent',
        'metric.ticket_count_90d',
        'metric.sev1_count_90d',
        'commercial.final_risk_score',
        'commercial.final_disposition',
      ]),
      policyRefs: ['recommendation-engine-v1', 'pricing-policy-matrix-2026-q2'],
      selectedByRules: true,
      blockedReason: null,
    }),
  )

  const candidates = [...bundleCandidates, ...lineCandidates]
  const allowedCandidates = candidates
    .filter(
      (item) =>
        item.scope === 'BUNDLE_RECOMMENDATION' &&
        (item.eligibility === 'ALLOWED' || item.eligibility === 'REQUIRES_APPROVAL'),
    )
    .map((item) => item.candidateType)
  const blockedCandidates = candidates
    .filter((item) => item.scope === 'BUNDLE_RECOMMENDATION' && item.eligibility === 'BLOCKED')
    .map((item) => item.candidateType)

  return {
    candidateVersion: DECISION_CANDIDATE_VERSION,
    generatedAt,
    ruleWinner: output.bundleResult.recommendedAction,
    allowedCandidates,
    blockedCandidates,
    candidates: candidates.map((item) => ({
      ...item,
      evidenceRefs: item.evidenceRefs.filter((ref) =>
        args.evidenceSnapshot.signals.some((signal) => signal.evidenceRef === ref),
      ),
    })),
  }
}
