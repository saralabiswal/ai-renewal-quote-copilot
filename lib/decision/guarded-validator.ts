import type { DecisionCandidateEnvelope } from '@/lib/decision/candidates'
import type { RenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import type { RecommendedAction } from '@/lib/rules/types'

export const VALIDATION_RESULT_VERSION = 'guarded-validation-v1'

export type GuardedDecisionProposal = {
  proposalSource: 'RULE_ENGINE' | 'ML_OVERLAY' | 'LLM_SHADOW' | 'LLM_ASSISTED_GUARDED'
  selectedCandidate: string
  confidence: number
  reasonCodes: string[]
  evidenceRefs: string[]
}

export type ValidationCheck = {
  name: string
  status: 'PASSED' | 'FAILED' | 'WARN'
  detail: string
}

export type GuardedValidationResult = {
  validationVersion: typeof VALIDATION_RESULT_VERSION
  status: 'PASSED' | 'REJECTED'
  proposalSource: GuardedDecisionProposal['proposalSource']
  selectedCandidate: string
  acceptedCandidate: string
  fallbackCandidate: RecommendedAction
  fallbackUsed: boolean
  confidence: number
  checks: ValidationCheck[]
  rejectionReasons: string[]
}

const VALID_CANDIDATES = new Set([
  'RENEW_AS_IS',
  'RENEW_WITH_CONCESSION',
  'EXPAND',
  'ESCALATE',
])

function clampConfidence(value: number, snapshot: RenewalEvidenceSnapshot) {
  let cap = 95
  if (snapshot.quality.missingCount > 0) cap -= 10
  if (snapshot.quality.staleCount > 0) cap -= 10
  if (snapshot.quality.completenessScore < 80) cap -= 10
  if (snapshot.quality.confidenceScore < 80) cap -= 10
  return Math.max(0, Math.min(Math.round(value), cap))
}

function check(
  name: string,
  condition: boolean,
  passedDetail: string,
  failedDetail: string,
): ValidationCheck {
  return {
    name,
    status: condition ? 'PASSED' : 'FAILED',
    detail: condition ? passedDetail : failedDetail,
  }
}

function signalValues(snapshot: RenewalEvidenceSnapshot, signalKey: string) {
  return snapshot.signals
    .filter((signal) => signal.signalKey === signalKey)
    .map((signal) => signal.value)
}

function hasSignalValue(snapshot: RenewalEvidenceSnapshot, signalKey: string, value: string) {
  return signalValues(snapshot, signalKey).some(
    (item) => String(item ?? '').toUpperCase() === value.toUpperCase(),
  )
}

function maxNumericSignal(snapshot: RenewalEvidenceSnapshot, signalKey: string) {
  const values = signalValues(snapshot, signalKey)
    .map((value) => Number(value))
    .filter(Number.isFinite)
  return values.length ? Math.max(...values) : null
}

export function validateGuardedDecisionProposal(args: {
  proposal: GuardedDecisionProposal
  candidates: DecisionCandidateEnvelope
  evidenceSnapshot: RenewalEvidenceSnapshot
}): GuardedValidationResult {
  const { proposal, candidates, evidenceSnapshot } = args
  const allowedCandidateSet = new Set(candidates.allowedCandidates)
  const evidenceRefSet = new Set(evidenceSnapshot.signals.map((signal) => signal.evidenceRef))
  const citedEvidenceExists = proposal.evidenceRefs.every((ref) => evidenceRefSet.has(ref))
  const candidateIsKnown = VALID_CANDIDATES.has(proposal.selectedCandidate)
  const candidateIsAllowed = allowedCandidateSet.has(proposal.selectedCandidate)
  const confidenceIsValid =
    Number.isFinite(proposal.confidence) && proposal.confidence >= 0 && proposal.confidence <= 100
  const reasonCodesAreValid =
    Array.isArray(proposal.reasonCodes) &&
    proposal.reasonCodes.length > 0 &&
    proposal.reasonCodes.every((item) => typeof item === 'string' && item.length > 0)

  const checks: ValidationCheck[] = [
    check(
      'Schema',
      Boolean(proposal.selectedCandidate) && confidenceIsValid && reasonCodesAreValid,
      'Proposal included candidate, confidence, and reason codes.',
      'Proposal schema was incomplete or malformed.',
    ),
    check(
      'CandidateKnown',
      candidateIsKnown,
      'Selected candidate is a supported recommendation enum.',
      `Selected candidate ${proposal.selectedCandidate || 'N/A'} is not supported.`,
    ),
    check(
      'CandidateAllowed',
      candidateIsAllowed,
      'Selected candidate is inside the deterministic candidate envelope.',
      `Selected candidate ${proposal.selectedCandidate || 'N/A'} was not in allowedCandidates.`,
    ),
    check(
      'EvidenceReferences',
      citedEvidenceExists,
      'All cited evidence references exist in the evidence snapshot.',
      'One or more cited evidence references were not present in the evidence snapshot.',
    ),
  ]

  if (proposal.selectedCandidate === 'EXPAND') {
    const hasExpansionDisposition = hasSignalValue(
      evidenceSnapshot,
      'final_disposition',
      'EXPAND',
    )
    const highPaymentRisk = hasSignalValue(evidenceSnapshot, 'payment_risk_band', 'HIGH')
    checks.push(
      check(
        'PolicyExpansionEligibility',
        hasExpansionDisposition && !highPaymentRisk,
        'Expansion is backed by at least one expansion line and no high payment-risk signal.',
        'Expansion requires an expansion-eligible line and cannot pass with high payment risk.',
      ),
    )
  }

  if (proposal.selectedCandidate === 'RENEW_WITH_CONCESSION') {
    const maxRisk = maxNumericSignal(evidenceSnapshot, 'final_risk_score')
    checks.push(
      check(
        'PolicyConcessionEligibility',
        maxRisk == null || maxRisk >= 40 || hasSignalValue(evidenceSnapshot, 'final_disposition', 'RENEW_WITH_CONCESSION'),
        'Concession posture is backed by risk or line disposition evidence.',
        'Concession posture requires medium risk or a concession-eligible line.',
      ),
    )
  }

  if (proposal.selectedCandidate === 'ESCALATE') {
    const sev1Count = maxNumericSignal(evidenceSnapshot, 'sev1_count_90d')
    const maxRisk = maxNumericSignal(evidenceSnapshot, 'final_risk_score')
    checks.push(
      check(
        'PolicyEscalationEligibility',
        (sev1Count ?? 0) > 0 || (maxRisk ?? 0) >= 70 || hasSignalValue(evidenceSnapshot, 'final_disposition', 'ESCALATE'),
        'Escalation is backed by Sev1, high risk, or escalation disposition evidence.',
        'Escalation requires Sev1, high-risk, or escalation disposition evidence.',
      ),
    )
  }

  if (evidenceSnapshot.quality.staleCount > 0) {
    checks.push({
      name: 'EvidenceFreshness',
      status: 'WARN',
      detail: `${evidenceSnapshot.quality.staleCount} evidence signals are stale.`,
    })
  }

  if (evidenceSnapshot.quality.missingCount > 0) {
    checks.push({
      name: 'EvidenceCompleteness',
      status: 'WARN',
      detail: `${evidenceSnapshot.quality.missingCount} evidence signals are missing.`,
    })
  }

  const rejectionReasons = checks
    .filter((item) => item.status === 'FAILED')
    .map((item) => item.detail)
  const status = rejectionReasons.length > 0 ? 'REJECTED' : 'PASSED'
  const fallbackCandidate = candidates.ruleWinner
  const acceptedCandidate = status === 'PASSED' ? proposal.selectedCandidate : fallbackCandidate

  return {
    validationVersion: VALIDATION_RESULT_VERSION,
    status,
    proposalSource: proposal.proposalSource,
    selectedCandidate: proposal.selectedCandidate,
    acceptedCandidate,
    fallbackCandidate,
    fallbackUsed: status !== 'PASSED',
    confidence: clampConfidence(proposal.confidence, evidenceSnapshot),
    checks,
    rejectionReasons,
  }
}
