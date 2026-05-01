import { evaluateRenewalCase } from '@/lib/rules/recommendation-engine'
import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'
import { getMlRuntimeConfig } from '@/lib/ml/config'
import { getRuntimeSettings } from '@/lib/settings/runtime-settings'
import { buildRenewalFeatureSnapshot, FEATURE_SCHEMA_VERSION } from '@/lib/ml/feature-snapshot'
import { getMlPrediction } from '@/lib/ml/predict'
import type { MlCasePrediction } from '@/lib/ml/types'
import { buildDecisionCandidateEnvelope } from '@/lib/decision/candidates'
import { validateGuardedDecisionProposal } from '@/lib/decision/guarded-validator'
import {
  buildRenewalEvidenceSnapshot,
  EVIDENCE_SNAPSHOT_VERSION,
} from '@/lib/evidence/renewal-evidence'
import {
  buildPolicyEvaluationTrace,
  POLICY_REGISTRY_ID,
  POLICY_RUNTIME_VERSION,
} from '@/lib/policies/policy-runtime'
import {
  buildCriticPromptInput,
  buildLiveOrDeterministicLlmShadow,
  buildRankingPromptInput,
  LLM_SHADOW_PROMPT_VERSION,
} from '@/lib/decision/llm-shadow'
import {
  buildQuoteInsightCandidateEnvelope,
  validateQuoteInsightCandidates,
} from '@/lib/decision/quote-insight-candidates'
import { finalizeQuoteInsightCandidates } from '@/lib/decision/quote-insight-finalizer'
import {
  buildDecisionTelemetry,
  buildGovernanceSnapshot,
  buildReplayMetadata,
  GOVERNANCE_VERSION,
  REPLAY_METADATA_VERSION,
  TELEMETRY_VERSION,
} from '@/lib/decision/audit-governance'
import { finalizeGuardedRecommendation } from '@/lib/decision/guarded-finalizer'

export const RULE_ENGINE_VERSION = 'recommendation-engine-v1'
export const POLICY_VERSION = 'pricing-policy-matrix-2026-q2'

type PreviousCaseState = {
  riskLevel: string | null
  recommendedAction: string | null
  requiresApproval: boolean | null
}

type DriverChange = {
  itemId: string
  productName: string
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  notes: string | null
}

function mlPredictionByItem(prediction: MlCasePrediction | null | undefined) {
  return new Map((prediction?.itemPredictions ?? []).map((item) => [item.itemId, item]))
}

function buildMlPredictionRequest(
  caseId: string,
  mode: string,
  demoScenarioKey: string,
  input: RenewalCaseEngineInput,
  ruleOutput: RenewalCaseEngineOutput,
) {
  const itemById = new Map(ruleOutput.itemResults.map((item) => [item.itemId, item]))

  return {
    caseId,
    mode,
    demoScenarioKey,
    account: input.account,
    ruleBundle: ruleOutput.bundleResult,
    items: input.items.map((item) => {
      const ruleItem = itemById.get(item.id)
      return {
        ...item,
        ruleRiskScore: ruleItem?.riskScore ?? null,
        ruleRiskLevel: ruleItem?.riskLevel ?? null,
        ruleDisposition: ruleItem?.recommendedDisposition ?? null,
      }
    }),
  }
}

function buildHybridRiskOverrides(
  ruleOutput: RenewalCaseEngineOutput,
  prediction: MlCasePrediction | null,
) {
  if (!prediction || prediction.status !== 'OK') {
    return {
      itemRiskScoreOverrides: undefined,
      riskDriverSuffixByItemId: undefined,
    }
  }

  const predictedByItem = mlPredictionByItem(prediction)
  const itemRiskScoreOverrides: Record<string, number> = {}
  const riskDriverSuffixByItemId: Record<string, string[]> = {}

  for (const item of ruleOutput.itemResults) {
    const mlItem = predictedByItem.get(item.itemId)
    if (mlItem?.riskScore == null || !Number.isFinite(mlItem.riskScore)) continue

    const blendedScore = Math.round(item.riskScore * 0.7 + mlItem.riskScore * 0.3)
    itemRiskScoreOverrides[item.itemId] = blendedScore
    riskDriverSuffixByItemId[item.itemId] = [
      `ML-assisted risk overlay blended rule score ${item.riskScore} with model score ${Math.round(
        mlItem.riskScore,
      )}.`,
      ...(mlItem.topFeatures.length > 0
        ? [`Top ML drivers: ${mlItem.topFeatures.slice(0, 3).join(', ')}.`]
        : []),
    ]
  }

  return {
    itemRiskScoreOverrides,
    riskDriverSuffixByItemId,
  }
}

export function buildGuardrailSummary(output: RenewalCaseEngineOutput) {
  return {
    approvalRequiredCount: output.itemResults.filter((item) => item.approvalRequired).length,
    guardrailResults: [...new Set(output.itemResults.map((item) => item.guardrailResult))],
    itemResults: output.itemResults.map((item) => ({
      itemId: item.itemId,
      productName: item.productName,
      approvalRequired: item.approvalRequired,
      guardrailResult: item.guardrailResult,
    })),
  }
}

export async function runRecommendationDecision(args: {
  caseId: string
  decisionRunId: string
  scenarioKey: string
  scenarioLabel: string
  previousCaseState: PreviousCaseState
  engineInput: RenewalCaseEngineInput
  driverChanges: DriverChange[]
}) {
  const ruleEngineOutput = evaluateRenewalCase(args.engineInput)
  const featureSnapshot = buildRenewalFeatureSnapshot(args.engineInput, ruleEngineOutput)
  const mlConfig = getMlRuntimeConfig()
  const runtimeSettings = getRuntimeSettings()
  const mlPrediction = await getMlPrediction(
    buildMlPredictionRequest(
      args.caseId,
      mlConfig.mode,
      args.scenarioKey,
      args.engineInput,
      ruleEngineOutput,
    ),
  )
  const mlOverlay = buildHybridRiskOverrides(ruleEngineOutput, mlPrediction)
  let finalOutput =
    mlConfig.affectsRecommendations && mlOverlay.itemRiskScoreOverrides
      ? evaluateRenewalCase(args.engineInput, mlOverlay)
      : ruleEngineOutput
  const evidenceSnapshot = buildRenewalEvidenceSnapshot({
    input: args.engineInput,
    ruleOutput: ruleEngineOutput,
    finalOutput,
    scenarioKey: args.scenarioKey,
  })
  const decisionCandidates = buildDecisionCandidateEnvelope({
    caseId: args.caseId,
    input: args.engineInput,
    finalOutput,
    evidenceSnapshot,
  })
  const generatedBy =
    mlConfig.affectsRecommendations && mlPrediction?.status === 'OK'
      ? 'HYBRID_RULES_ML'
      : mlPrediction
        ? 'RULE_ENGINE_WITH_ML_SHADOW'
        : 'RULE_ENGINE'
  const guardedProposal = {
    proposalSource:
      generatedBy === 'HYBRID_RULES_ML' ? ('ML_OVERLAY' as const) : ('RULE_ENGINE' as const),
    selectedCandidate: finalOutput.bundleResult.recommendedAction,
    confidence: Math.max(
      50,
      Math.min(95, Math.round((100 - finalOutput.bundleResult.riskScore / 3 + evidenceSnapshot.quality.confidenceScore) / 2)),
    ),
    reasonCodes: finalOutput.bundleResult.primaryDrivers.length
      ? finalOutput.bundleResult.primaryDrivers.slice(0, 5)
      : [finalOutput.bundleResult.recommendedAction],
    evidenceRefs: decisionCandidates.candidates
      .find(
        (candidate) =>
          candidate.scope === 'BUNDLE_RECOMMENDATION' &&
          candidate.candidateType === finalOutput.bundleResult.recommendedAction,
      )
      ?.evidenceRefs.slice(0, 8) ?? [],
  }
  const validationResult = validateGuardedDecisionProposal({
    proposal: guardedProposal,
    candidates: decisionCandidates,
    evidenceSnapshot,
  })
  const policyTrace = buildPolicyEvaluationTrace({
    input: args.engineInput,
    ruleOutput: ruleEngineOutput,
    finalOutput,
    decisionCandidates,
    validationResult,
  })
  const liveShadow = await buildLiveOrDeterministicLlmShadow({
    evidenceSnapshot,
    finalOutput,
    policyTrace,
    validationResult,
    candidates: decisionCandidates,
    liveCritiqueEnabled:
      runtimeSettings.guardedDecisioningMode === 'LLM_CRITIC_SHADOW' ||
      runtimeSettings.guardedDecisioningMode === 'LLM_RANKING_SHADOW' ||
      runtimeSettings.guardedDecisioningMode === 'LLM_ASSISTED_GUARDED',
    liveRankingEnabled:
      runtimeSettings.guardedDecisioningMode === 'LLM_RANKING_SHADOW' ||
      runtimeSettings.guardedDecisioningMode === 'LLM_ASSISTED_GUARDED',
  })
  const llmCritique = liveShadow.critique
  const llmRanking = liveShadow.ranking
  const guardedFinalization = finalizeGuardedRecommendation({
    mode: runtimeSettings.guardedDecisioningMode,
    deterministicOutput: finalOutput,
    candidates: decisionCandidates,
    evidenceSnapshot,
    deterministicValidation: validationResult,
    llmRanking,
  })
  finalOutput = guardedFinalization.finalOutput
  const quoteInsightCandidates = buildQuoteInsightCandidateEnvelope({
    input: args.engineInput,
    finalOutput,
  })
  const quoteInsightValidation = validateQuoteInsightCandidates(quoteInsightCandidates)
  const quoteInsightFinalizer = finalizeQuoteInsightCandidates({
    mode: runtimeSettings.guardedDecisioningMode,
    envelope: quoteInsightCandidates,
    validation: quoteInsightValidation,
  })
  const versions = {
    ruleEngineVersion: RULE_ENGINE_VERSION,
    policyVersion: POLICY_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    evidenceSnapshotVersion: EVIDENCE_SNAPSHOT_VERSION,
    policyRuntimeVersion: POLICY_RUNTIME_VERSION,
    policyRegistryId: POLICY_REGISTRY_ID,
    llmShadowPromptVersion: LLM_SHADOW_PROMPT_VERSION,
    replayMetadataVersion: REPLAY_METADATA_VERSION,
    telemetryVersion: TELEMETRY_VERSION,
    governanceVersion: GOVERNANCE_VERSION,
  }
  const replayMetadata = buildReplayMetadata({
    caseId: args.caseId,
    decisionRunId: args.decisionRunId,
    scenarioKey: args.scenarioKey,
    versions,
  })
  const telemetry = buildDecisionTelemetry({
    evidenceSnapshot,
    validationResult,
    llmCritique,
    llmRanking,
    policyTrace,
    quoteInsightValidation,
  })
  const governance = buildGovernanceSnapshot({
    mode: runtimeSettings.guardedDecisioningMode,
    candidateEnvelope: decisionCandidates,
    quoteInsightCandidates,
    finalOutput,
  })

  const recommendationDiff = {
    scenarioKey: args.scenarioKey,
    scenarioLabel: args.scenarioLabel,
    previous: args.previousCaseState,
    next: {
      riskLevel: finalOutput.bundleResult.riskLevel,
      recommendedAction: finalOutput.bundleResult.recommendedAction,
      requiresApproval: finalOutput.bundleResult.approvalRequired,
    },
    ruleBaseline: {
      riskScore: ruleEngineOutput.bundleResult.riskScore,
      riskLevel: ruleEngineOutput.bundleResult.riskLevel,
      recommendedAction: ruleEngineOutput.bundleResult.recommendedAction,
      requiresApproval: ruleEngineOutput.bundleResult.approvalRequired,
    },
    ml: mlPrediction
      ? {
          mode: mlConfig.mode,
          status: mlPrediction.status,
          affectsRecommendation: mlConfig.affectsRecommendations && mlPrediction.status === 'OK',
          modelName: mlPrediction.modelName ?? mlConfig.registryModelName,
          modelVersion: mlPrediction.modelVersion ?? mlConfig.registryModelVersion,
          bundleRiskScore: mlPrediction.bundleRiskScore,
          error: mlPrediction.error ?? null,
          itemPredictions: mlPrediction.itemPredictions,
        }
      : {
          mode: mlConfig.mode,
          status: 'DISABLED',
          affectsRecommendation: false,
          modelName: mlConfig.registryModelName,
          modelVersion: mlConfig.registryModelVersion,
          bundleRiskScore: null,
          error: null,
          itemPredictions: [],
        },
    driverChanges: args.driverChanges,
    decisionRunId: args.decisionRunId,
    recalculatedAt: new Date().toISOString(),
  }

  return {
    ruleEngineOutput,
    finalOutput,
    mlConfig,
    mlPrediction,
    generatedBy,
    recommendationDiff,
    featureSnapshot,
    evidenceSnapshot,
    decisionCandidates,
    guardedProposal,
    validationResult,
    policyTrace,
    llmCritique,
    llmRanking,
    llmPromptInputs: {
      critic: buildCriticPromptInput({
        evidenceSnapshot,
        finalOutput,
        policyTrace,
        validationResult,
      }),
      ranking: buildRankingPromptInput({
        evidenceSnapshot,
        candidates: decisionCandidates,
        policyTrace,
      }),
      rawResults: liveShadow.rawResults,
    },
    quoteInsightCandidates,
    quoteInsightValidation,
    quoteInsightFinalizer,
    replayMetadata,
    telemetry,
    governance,
    guardedFinalizer: guardedFinalization.finalizer,
    guardrailSummary: buildGuardrailSummary(finalOutput),
    versions,
  }
}
