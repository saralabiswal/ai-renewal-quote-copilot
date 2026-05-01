import type { DecisionCandidateEnvelope } from '@/lib/decision/candidates'
import {
  type GuardedDecisionProposal,
  type GuardedValidationResult,
  validateGuardedDecisionProposal,
} from '@/lib/decision/guarded-validator'
import type { LlmCandidateRanking } from '@/lib/decision/llm-shadow'
import type { RenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import type {
  PricingPosture,
  RecommendedAction,
  RenewalCaseEngineOutput,
} from '@/lib/rules/types'
import type { GuardedDecisioningMode } from '@/lib/settings/runtime-settings'

export const GUARDED_FINALIZER_VERSION = 'guarded-finalizer-v1'

export type GuardedFinalizerCheck = {
  name: string
  status: 'PASSED' | 'FAILED' | 'WARN' | 'SKIPPED'
  detail: string
}

export type GuardedFinalizerResult = {
  finalizerVersion: typeof GUARDED_FINALIZER_VERSION
  mode: GuardedDecisioningMode
  ruleWinner: RecommendedAction
  llmSelectedCandidate: string | null
  acceptedCandidate: string
  finalCandidate: RecommendedAction
  validatorStatus: GuardedValidationResult['status']
  finalStateSource: 'DETERMINISTIC_RULES' | 'LLM_ASSISTED_GUARDED' | 'FALLBACK_RULES'
  recommendationOverrideApplied: boolean
  fallbackUsed: boolean
  fallbackReason: string | null
  checks: GuardedFinalizerCheck[]
  validationResult: GuardedValidationResult
}

function asRecommendedAction(value: string): RecommendedAction | null {
  if (
    value === 'RENEW_AS_IS' ||
    value === 'RENEW_WITH_CONCESSION' ||
    value === 'EXPAND' ||
    value === 'ESCALATE'
  ) {
    return value
  }

  return null
}

function pricingPostureFor(action: RecommendedAction, approvalRequired: boolean): PricingPosture {
  if (action === 'ESCALATE' || approvalRequired) return 'ESCALATE'
  if (action === 'RENEW_WITH_CONCESSION') return 'STRATEGIC_CONCESSION'
  return 'HOLD_PRICE'
}

function canMaterializeCandidate(output: RenewalCaseEngineOutput, candidate: RecommendedAction) {
  if (candidate === output.bundleResult.recommendedAction) {
    return {
      canMaterialize: true,
      detail: 'Candidate matches the deterministic bundle recommendation.',
    }
  }

  if (candidate === 'ESCALATE') {
    const hasEscalationBasis =
      output.bundleResult.approvalRequired ||
      output.itemResults.some(
        (item) =>
          item.recommendedDisposition === 'ESCALATE' ||
          item.guardrailResult === 'SEV1_ESCALATION' ||
          item.guardrailResult === 'FLOOR_PRICE_EXCEPTION' ||
          item.guardrailResult === 'APPROVAL_REQUIRED',
      )
    return {
      canMaterialize: hasEscalationBasis,
      detail: hasEscalationBasis
        ? 'Escalate can be materialized because approval or guardrail evidence is present.'
        : 'Escalate cannot be materialized without approval, risk, or guardrail evidence.',
    }
  }

  if (candidate === 'EXPAND') {
    const hasExpansionLine = output.itemResults.some((item) => item.recommendedDisposition === 'EXPAND')
    return {
      canMaterialize: hasExpansionLine,
      detail: hasExpansionLine
        ? 'Expand can be materialized because at least one line is expansion-oriented.'
        : 'Expand cannot be materialized without an expansion-oriented line.',
    }
  }

  if (candidate === 'RENEW_WITH_CONCESSION') {
    const hasConcessionLine = output.itemResults.some(
      (item) => item.recommendedDisposition === 'RENEW_WITH_CONCESSION',
    )
    return {
      canMaterialize: hasConcessionLine,
      detail: hasConcessionLine
        ? 'Renew with concession can be materialized because at least one line is concession-oriented.'
        : 'Renew with concession cannot be materialized without a concession-oriented line.',
    }
  }

  const canRenewAsIs =
    !output.bundleResult.approvalRequired &&
    output.bundleResult.riskLevel === 'LOW' &&
    output.itemResults.every((item) => item.recommendedDisposition === 'RENEW')

  return {
    canMaterialize: canRenewAsIs,
    detail: canRenewAsIs
      ? 'Renew as-is can be materialized because all lines are clean renewals.'
      : 'Renew as-is cannot bypass approval, expansion, concession, or escalation line evidence.',
  }
}

function materializeOutput(
  output: RenewalCaseEngineOutput,
  finalCandidate: RecommendedAction,
): RenewalCaseEngineOutput {
  if (finalCandidate === output.bundleResult.recommendedAction) return output

  return {
    ...output,
    bundleResult: {
      ...output.bundleResult,
      recommendedAction: finalCandidate,
      pricingPosture: pricingPostureFor(finalCandidate, output.bundleResult.approvalRequired),
      summaryText: [
        output.bundleResult.summaryText,
        `Guarded finalizer selected ${finalCandidate.toLowerCase().replaceAll('_', ' ')} from the validated candidate envelope.`,
      ].join(' '),
    },
  }
}

function proposalFromRanking(args: {
  ranking: LlmCandidateRanking
  deterministicOutput: RenewalCaseEngineOutput
}): GuardedDecisionProposal {
  const selectedRanking = args.ranking.rankedCandidates.find(
    (candidate) => candidate.candidateType === args.ranking.selectedCandidate,
  )

  return {
    proposalSource: 'LLM_ASSISTED_GUARDED',
    selectedCandidate: args.ranking.selectedCandidate,
    confidence: args.ranking.confidence,
    reasonCodes:
      selectedRanking?.reasonCodes.length
        ? selectedRanking.reasonCodes
        : [args.deterministicOutput.bundleResult.recommendedAction],
    evidenceRefs: selectedRanking?.evidenceRefs ?? [],
  }
}

export function finalizeGuardedRecommendation(args: {
  mode: GuardedDecisioningMode
  deterministicOutput: RenewalCaseEngineOutput
  candidates: DecisionCandidateEnvelope
  evidenceSnapshot: RenewalEvidenceSnapshot
  deterministicValidation: GuardedValidationResult
  llmRanking: LlmCandidateRanking
}): {
  finalOutput: RenewalCaseEngineOutput
  finalizer: GuardedFinalizerResult
} {
  const ruleWinner = args.candidates.ruleWinner
  const checks: GuardedFinalizerCheck[] = []

  if (args.mode !== 'LLM_ASSISTED_GUARDED') {
    checks.push({
      name: 'ModeAllowsInfluence',
      status: 'SKIPPED',
      detail: `Mode ${args.mode} does not allow LLM output to influence final recommendation.`,
    })

    return {
      finalOutput: args.deterministicOutput,
      finalizer: {
        finalizerVersion: GUARDED_FINALIZER_VERSION,
        mode: args.mode,
        ruleWinner,
        llmSelectedCandidate: args.llmRanking.selectedCandidate,
        acceptedCandidate: ruleWinner,
        finalCandidate: ruleWinner,
        validatorStatus: args.deterministicValidation.status,
        finalStateSource: 'DETERMINISTIC_RULES',
        recommendationOverrideApplied: false,
        fallbackUsed: false,
        fallbackReason: 'LLM influence is disabled for this mode.',
        checks,
        validationResult: args.deterministicValidation,
      },
    }
  }

  checks.push({
    name: 'ModeAllowsInfluence',
    status: 'PASSED',
    detail: 'LLM_ASSISTED_GUARDED mode can influence final recommendation only through validator acceptance.',
  })

  const guardedValidation = validateGuardedDecisionProposal({
    proposal: proposalFromRanking({
      ranking: args.llmRanking,
      deterministicOutput: args.deterministicOutput,
    }),
    candidates: args.candidates,
    evidenceSnapshot: args.evidenceSnapshot,
  })
  const acceptedCandidate = asRecommendedAction(guardedValidation.acceptedCandidate) ?? ruleWinner
  const materialization = canMaterializeCandidate(args.deterministicOutput, acceptedCandidate)

  checks.push({
    name: 'RankingValidation',
    status: args.llmRanking.validation.status === 'PASSED' ? 'PASSED' : 'FAILED',
    detail:
      args.llmRanking.validation.status === 'PASSED'
        ? 'LLM ranking passed shadow validation.'
        : args.llmRanking.validation.rejectionReasons.join(' ') || 'LLM ranking failed validation.',
  })
  checks.push({
    name: 'GuardedValidator',
    status: guardedValidation.status === 'PASSED' ? 'PASSED' : 'FAILED',
    detail:
      guardedValidation.status === 'PASSED'
        ? `Validator accepted ${guardedValidation.acceptedCandidate}.`
        : guardedValidation.rejectionReasons.join(' '),
  })
  checks.push({
    name: 'MaterializationCoherence',
    status: materialization.canMaterialize ? 'PASSED' : 'FAILED',
    detail: materialization.detail,
  })

  const canApply =
    args.llmRanking.validation.status === 'PASSED' &&
    guardedValidation.status === 'PASSED' &&
    materialization.canMaterialize
  const finalCandidate = canApply ? acceptedCandidate : ruleWinner
  const recommendationOverrideApplied =
    canApply && finalCandidate !== args.deterministicOutput.bundleResult.recommendedAction

  return {
    finalOutput: canApply
      ? materializeOutput(args.deterministicOutput, finalCandidate)
      : args.deterministicOutput,
    finalizer: {
      finalizerVersion: GUARDED_FINALIZER_VERSION,
      mode: args.mode,
      ruleWinner,
      llmSelectedCandidate: args.llmRanking.selectedCandidate,
      acceptedCandidate,
      finalCandidate,
      validatorStatus: guardedValidation.status,
      finalStateSource: canApply ? 'LLM_ASSISTED_GUARDED' : 'FALLBACK_RULES',
      recommendationOverrideApplied,
      fallbackUsed: !canApply,
      fallbackReason: canApply
        ? null
        : 'Finalizer fell back to deterministic rules because ranking, validator, or materialization checks did not pass.',
      checks,
      validationResult: guardedValidation,
    },
  }
}
