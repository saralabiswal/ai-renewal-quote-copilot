import type {
  QuoteInsightCandidate,
  QuoteInsightCandidateEnvelope,
  QuoteInsightValidationResult,
} from '@/lib/decision/quote-insight-candidates'
import type { GuardedDecisioningMode } from '@/lib/settings/runtime-settings'

export const QUOTE_INSIGHT_FINALIZER_VERSION = 'quote-insight-finalizer-v1'

export type QuoteInsightFinalizerCheck = {
  name: string
  status: 'PASSED' | 'FAILED' | 'WARN' | 'SKIPPED'
  detail: string
}

export type QuoteInsightFinalizerResult = {
  finalizerVersion: typeof QUOTE_INSIGHT_FINALIZER_VERSION
  mode: GuardedDecisioningMode
  finalStateSource:
    | 'DETERMINISTIC_QUOTE_INSIGHT_ENGINE'
    | 'LLM_ASSISTED_GUARDED'
    | 'FALLBACK_DETERMINISTIC'
  candidateCount: number
  acceptedCandidateIds: string[]
  rejectedCandidateIds: string[]
  prioritizedCandidateIds: string[]
  approvalRequiredCandidateIds: string[]
  prioritizationOverrideApplied: boolean
  fallbackUsed: boolean
  fallbackReason: string | null
  checks: QuoteInsightFinalizerCheck[]
}

function deterministicPriority(candidate: QuoteInsightCandidate) {
  const approvalPenalty = candidate.eligibility === 'REQUIRES_APPROVAL' ? 6 : 0
  const blockedPenalty = candidate.eligibility === 'BLOCKED' ? 100 : 0
  return candidate.score - approvalPenalty - blockedPenalty
}

function deterministicOrder(candidates: QuoteInsightCandidate[]) {
  return [...candidates].sort(
    (a, b) =>
      Number(b.selectedByRules) - Number(a.selectedByRules) ||
      deterministicPriority(b) - deterministicPriority(a) ||
      a.productName.localeCompare(b.productName),
  )
}

export function finalizeQuoteInsightCandidates(args: {
  mode: GuardedDecisioningMode
  envelope: QuoteInsightCandidateEnvelope
  validation: QuoteInsightValidationResult
}): QuoteInsightFinalizerResult {
  const checks: QuoteInsightFinalizerCheck[] = []
  const acceptedSet = new Set(args.validation.acceptedCandidateIds)
  const orderedAccepted = deterministicOrder(args.envelope.candidates).filter((candidate) =>
    acceptedSet.has(candidate.candidateId),
  )
  const prioritizedCandidateIds = orderedAccepted.map((candidate) => candidate.candidateId)
  const approvalRequiredCandidateIds = orderedAccepted
    .filter((candidate) => candidate.eligibility === 'REQUIRES_APPROVAL')
    .map((candidate) => candidate.candidateId)

  checks.push({
    name: 'CandidateValidation',
    status: args.validation.status === 'PASSED' ? 'PASSED' : 'WARN',
    detail:
      args.validation.status === 'PASSED'
        ? 'All quote insight candidates passed catalog and pricing validation.'
        : 'Some quote insight candidates were rejected; accepted candidates remain available.',
  })
  checks.push({
    name: 'PricingMathDeterministic',
    status: orderedAccepted.every(
      (candidate) =>
        Math.abs(
          Math.round(candidate.recommendedQuantity * candidate.recommendedUnitPrice * 100) / 100 -
            candidate.deterministicLineAmount,
        ) < 0.01,
    )
      ? 'PASSED'
      : 'FAILED',
    detail: 'Quote insight finalizer recomputes accepted candidate line math before prioritization.',
  })
  checks.push({
    name: 'ApprovalRoutingPreserved',
    status: approvalRequiredCandidateIds.length > 0 ? 'WARN' : 'PASSED',
    detail:
      approvalRequiredCandidateIds.length > 0
        ? `${approvalRequiredCandidateIds.length} accepted quote insight candidates still require approval.`
        : 'No accepted quote insight candidates require approval.',
  })

  if (args.mode !== 'LLM_ASSISTED_GUARDED') {
    checks.push({
      name: 'ModeAllowsInsightInfluence',
      status: 'SKIPPED',
      detail: `Mode ${args.mode} does not allow LLM output to alter quote insight prioritization.`,
    })

    return {
      finalizerVersion: QUOTE_INSIGHT_FINALIZER_VERSION,
      mode: args.mode,
      finalStateSource: 'DETERMINISTIC_QUOTE_INSIGHT_ENGINE',
      candidateCount: args.envelope.candidates.length,
      acceptedCandidateIds: args.validation.acceptedCandidateIds,
      rejectedCandidateIds: args.validation.rejectedCandidateIds,
      prioritizedCandidateIds,
      approvalRequiredCandidateIds,
      prioritizationOverrideApplied: false,
      fallbackUsed: false,
      fallbackReason: 'LLM quote insight influence is disabled for this mode.',
      checks,
    }
  }

  checks.push({
    name: 'ModeAllowsInsightInfluence',
    status: 'PASSED',
    detail:
      'LLM_ASSISTED_GUARDED mode can influence quote insight prioritization only after validation.',
  })

  const failedChecks = checks.filter((check) => check.status === 'FAILED')
  const canUseGuardedPrioritization =
    failedChecks.length === 0 && args.validation.acceptedCandidateIds.length > 0

  return {
    finalizerVersion: QUOTE_INSIGHT_FINALIZER_VERSION,
    mode: args.mode,
    finalStateSource: canUseGuardedPrioritization
      ? 'LLM_ASSISTED_GUARDED'
      : 'FALLBACK_DETERMINISTIC',
    candidateCount: args.envelope.candidates.length,
    acceptedCandidateIds: args.validation.acceptedCandidateIds,
    rejectedCandidateIds: args.validation.rejectedCandidateIds,
    prioritizedCandidateIds,
    approvalRequiredCandidateIds,
    prioritizationOverrideApplied: false,
    fallbackUsed: !canUseGuardedPrioritization,
    fallbackReason: canUseGuardedPrioritization
      ? null
      : 'Quote insight finalizer fell back to deterministic prioritization because validation did not pass.',
    checks,
  }
}
