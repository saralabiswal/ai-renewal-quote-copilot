import type { DecisionCandidateEnvelope } from '@/lib/decision/candidates'
import type { GuardedValidationResult } from '@/lib/decision/guarded-validator'
import type { LlmCandidateRanking, LlmCritique } from '@/lib/decision/llm-shadow'
import type {
  QuoteInsightCandidateEnvelope,
  QuoteInsightValidationResult,
} from '@/lib/decision/quote-insight-candidates'
import type { RenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import type { PolicyEvaluationTrace } from '@/lib/policies/policy-runtime'
import type { RenewalCaseEngineOutput } from '@/lib/rules/types'

export const REPLAY_METADATA_VERSION = 'decision-replay-v1'
export const TELEMETRY_VERSION = 'decision-telemetry-v1'
export const GOVERNANCE_VERSION = 'decision-governance-v1'

export function buildReplayMetadata(args: {
  caseId: string
  decisionRunId: string
  scenarioKey: string
  versions: Record<string, string | null | undefined>
}) {
  return {
    replayMetadataVersion: REPLAY_METADATA_VERSION,
    caseId: args.caseId,
    decisionRunId: args.decisionRunId,
    scenarioKey: args.scenarioKey,
    deterministicReplaySupported: true,
    replayInputs: [
      'ruleInputJson',
      'featureSnapshotJson',
      'evidenceSnapshotJson',
      'decisionCandidatesJson',
      'policyTraceJson',
      'ruleOutputJson',
      'finalOutputJson',
    ],
    versions: args.versions,
  }
}

export function buildDecisionTelemetry(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  validationResult: GuardedValidationResult
  llmCritique: LlmCritique
  llmRanking: LlmCandidateRanking
  policyTrace: PolicyEvaluationTrace
  quoteInsightValidation: QuoteInsightValidationResult
}) {
  const llmValidatorPassed =
    args.llmCritique.validation.status === 'PASSED' && args.llmRanking.validation.status === 'PASSED'

  return {
    telemetryVersion: TELEMETRY_VERSION,
    llmShadowPassRate: llmValidatorPassed ? 1 : 0,
    validationRejected: args.validationResult.status === 'REJECTED',
    fallbackUsed: args.validationResult.fallbackUsed,
    confidence: args.validationResult.confidence,
    staleEvidenceRate:
      args.evidenceSnapshot.quality.signalCount > 0
        ? args.evidenceSnapshot.quality.staleCount / args.evidenceSnapshot.quality.signalCount
        : 0,
    policyWarningCount: args.policyTrace.summary.warningCount,
    policyBlockedCount: args.policyTrace.summary.blockedCount,
    quoteInsightAcceptedCount: args.quoteInsightValidation.acceptedCandidateIds.length,
    quoteInsightRejectedCount: args.quoteInsightValidation.rejectedCandidateIds.length,
  }
}

export function buildGovernanceSnapshot(args: {
  mode: string
  candidateEnvelope: DecisionCandidateEnvelope
  quoteInsightCandidates: QuoteInsightCandidateEnvelope
  finalOutput: RenewalCaseEngineOutput
}) {
  const guardedModeAllowed = args.mode === 'LLM_ASSISTED_GUARDED'

  return {
    governanceVersion: GOVERNANCE_VERSION,
    roleControls: {
      enableGuardedMode: ['AI_GOVERNANCE_ADMIN', 'REVENUE_OPERATIONS_ADMIN'],
      approvePolicyChange: ['DEAL_DESK_ADMIN', 'AI_GOVERNANCE_ADMIN'],
      viewRawEvidence: ['TECHNICAL_REVIEWER', 'AI_GOVERNANCE_ADMIN'],
    },
    releaseGates: {
      shadowModeRequiredBeforeGuarded: true,
      minimumShadowPassRate: 0.95,
      humanApprovalRequiredForExceptions: true,
      guardedModeAllowedForThisRun: guardedModeAllowed,
      guardedModeReason: guardedModeAllowed
        ? 'Guarded mode requested; deterministic validator still controls final acceptance.'
        : 'Run is not in guarded mode, so LLM shadow outputs cannot affect final state.',
    },
    driftMonitors: {
      evidenceDistribution: 'TRACK_STALE_AND_MISSING_SIGNAL_RATES',
      mlScoreDrift: 'TRACK_BUNDLE_AND_ITEM_RISK_SCORE_DELTA',
      llmDisagreementRate: 'TRACK_SHADOW_RANKING_VS_RULE_WINNER',
      reviewerOverrideRate: 'TRACK_REVIEW_DECISION_VS_FINAL_RECOMMENDATION',
    },
    modeAdoption: {
      runMode: args.mode,
      ruleWinner: args.candidateEnvelope.ruleWinner,
      quoteInsightCandidateCount: args.quoteInsightCandidates.candidates.length,
      approvalRequired: args.finalOutput.bundleResult.approvalRequired,
    },
  }
}
