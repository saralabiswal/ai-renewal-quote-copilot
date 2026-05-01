import { strict as assert } from 'node:assert'
import {
  type DecisionCandidateEnvelope,
  DECISION_CANDIDATE_VERSION,
} from '../lib/decision/candidates'
import { finalizeGuardedRecommendation } from '../lib/decision/guarded-finalizer'
import {
  type GuardedValidationResult,
  VALIDATION_RESULT_VERSION,
} from '../lib/decision/guarded-validator'
import {
  EVIDENCE_SNAPSHOT_VERSION,
  type RenewalEvidenceSnapshot,
} from '../lib/evidence/renewal-evidence'
import type { LlmCandidateRanking } from '../lib/decision/llm-shadow'
import type { RenewalCaseEngineOutput } from '../lib/rules/types'

const evidenceSnapshot: RenewalEvidenceSnapshot = {
  evidenceSnapshotVersion: EVIDENCE_SNAPSHOT_VERSION,
  generatedAt: '2026-04-30T00:00:00.000Z',
  scenarioKey: 'BASE_CASE',
  quality: {
    signalCount: 4,
    currentCount: 4,
    staleCount: 0,
    missingCount: 0,
    completenessScore: 100,
    confidenceScore: 95,
  },
  account: {
    id: 'acct_finalizer',
    segment: 'ENTERPRISE',
    healthScore: 80,
    openEscalationCount: 0,
  },
  signals: [
    {
      evidenceRef: 'account.segment',
      subjectType: 'ACCOUNT',
      subjectId: 'acct_finalizer',
      signalKey: 'account.segment',
      label: 'Account Segment',
      value: 'ENTERPRISE',
      unit: null,
      sourceSystem: 'Account Profile',
      observedAt: '2026-04-30T00:00:00.000Z',
      freshnessStatus: 'CURRENT',
      confidence: 0.95,
      lineage: 'RenewalCase.account',
    },
    {
      evidenceRef: 'item.item_finalizer.metric.sev1_count_90d',
      subjectType: 'RENEWAL_CASE_ITEM',
      subjectId: 'item_finalizer',
      signalKey: 'sev1_count_90d',
      label: 'Sev1 Count 90d',
      value: 1,
      unit: 'count',
      sourceSystem: 'Subscription Telemetry',
      observedAt: '2026-04-30T00:00:00.000Z',
      freshnessStatus: 'CURRENT',
      confidence: 0.95,
      lineage: 'SubscriptionMetricSnapshot',
    },
    {
      evidenceRef: 'item.item_finalizer.commercial.final_risk_score',
      subjectType: 'RENEWAL_CASE_ITEM',
      subjectId: 'item_finalizer',
      signalKey: 'final_risk_score',
      label: 'Final Risk Score',
      value: 30,
      unit: 'score',
      sourceSystem: 'Decision Runtime',
      observedAt: '2026-04-30T00:00:00.000Z',
      freshnessStatus: 'CURRENT',
      confidence: 0.95,
      lineage: 'RenewalCaseEngineOutput',
    },
    {
      evidenceRef: 'item.item_finalizer.commercial.final_disposition',
      subjectType: 'RENEWAL_CASE_ITEM',
      subjectId: 'item_finalizer',
      signalKey: 'final_disposition',
      label: 'Final Disposition',
      value: 'RENEW',
      unit: null,
      sourceSystem: 'Decision Runtime',
      observedAt: '2026-04-30T00:00:00.000Z',
      freshnessStatus: 'CURRENT',
      confidence: 0.95,
      lineage: 'RenewalCaseEngineOutput',
    },
  ],
}

const deterministicOutput: RenewalCaseEngineOutput = {
  itemResults: [
    {
      itemId: 'item_finalizer',
      subscriptionId: 'sub_finalizer',
      productId: 'prod_finalizer',
      productName: 'Oracle Test Product',
      riskScore: 30,
      riskLevel: 'LOW',
      drivers: ['Approval-sensitive guardrail evidence exists.'],
      recommendedDisposition: 'RENEW',
      recommendedDiscountPercent: 14,
      proposedQuantity: 1,
      proposedNetUnitPrice: 86,
      proposedArr: 86,
      approvalRequired: true,
      guardrailResult: 'APPROVAL_REQUIRED',
    },
  ],
  bundleResult: {
    riskScore: 30,
    riskLevel: 'LOW',
    recommendedAction: 'EXPAND',
    pricingPosture: 'ESCALATE',
    approvalRequired: true,
    bundleCurrentArr: 80,
    bundleProposedArr: 86,
    bundleDeltaArr: 6,
    primaryDrivers: ['Approval-sensitive guardrail evidence exists.'],
    summaryText: 'Deterministic output selected expansion with approval.',
  },
}

const candidates: DecisionCandidateEnvelope = {
  candidateVersion: DECISION_CANDIDATE_VERSION,
  generatedAt: '2026-04-30T00:00:00.000Z',
  ruleWinner: 'EXPAND',
  allowedCandidates: ['EXPAND', 'ESCALATE'],
  blockedCandidates: ['RENEW_AS_IS'],
  candidates: [
    {
      candidateId: 'bundle_case_expand',
      scope: 'BUNDLE_RECOMMENDATION',
      subjectId: 'case_finalizer',
      candidateType: 'EXPAND',
      eligibility: 'ALLOWED',
      score: 85,
      reasonCodes: ['EXPANSION_ELIGIBLE'],
      evidenceRefs: ['account.segment'],
      policyRefs: ['recommendation-engine-v1'],
      selectedByRules: true,
      blockedReason: null,
    },
    {
      candidateId: 'bundle_case_escalate',
      scope: 'BUNDLE_RECOMMENDATION',
      subjectId: 'case_finalizer',
      candidateType: 'ESCALATE',
      eligibility: 'ALLOWED',
      score: 90,
      reasonCodes: ['GOVERNANCE_REVIEW'],
      evidenceRefs: ['item.item_finalizer.metric.sev1_count_90d'],
      policyRefs: ['recommendation-engine-v1'],
      selectedByRules: false,
      blockedReason: null,
    },
  ],
}

const deterministicValidation: GuardedValidationResult = {
  validationVersion: VALIDATION_RESULT_VERSION,
  status: 'PASSED',
  proposalSource: 'RULE_ENGINE',
  selectedCandidate: 'EXPAND',
  acceptedCandidate: 'EXPAND',
  fallbackCandidate: 'EXPAND',
  fallbackUsed: false,
  confidence: 90,
  checks: [],
  rejectionReasons: [],
}

const llmRanking: LlmCandidateRanking = {
  schemaVersion: 'llm-ranking-v1',
  mode: 'LLM_RANKING_SHADOW',
  promptVersion: 'llm-shadow-prompts-2026-q2',
  generatedBy: 'LLM',
  modelLabel: 'test-json-model',
  fallbackReason: null,
  ruleWinner: 'EXPAND',
  selectedCandidate: 'ESCALATE',
  confidence: 88,
  rankedCandidates: [
    {
      candidateType: 'ESCALATE',
      rank: 1,
      score: 90,
      reasonCodes: ['GOVERNANCE_REVIEW'],
      evidenceRefs: ['item.item_finalizer.metric.sev1_count_90d'],
    },
  ],
  reviewerNarrative: 'Escalation is preferred because approval-sensitive evidence exists.',
  validation: {
    status: 'PASSED',
    checks: [],
    rejectionReasons: [],
  },
}

const shadowMode = finalizeGuardedRecommendation({
  mode: 'LLM_RANKING_SHADOW',
  deterministicOutput,
  candidates,
  evidenceSnapshot,
  deterministicValidation,
  llmRanking,
})
assert.equal(shadowMode.finalizer.finalStateSource, 'DETERMINISTIC_RULES')
assert.equal(shadowMode.finalOutput.bundleResult.recommendedAction, 'EXPAND')

const guardedMode = finalizeGuardedRecommendation({
  mode: 'LLM_ASSISTED_GUARDED',
  deterministicOutput,
  candidates,
  evidenceSnapshot,
  deterministicValidation,
  llmRanking,
})
assert.equal(guardedMode.finalizer.validatorStatus, 'PASSED')
assert.equal(guardedMode.finalizer.finalStateSource, 'LLM_ASSISTED_GUARDED')
assert.equal(guardedMode.finalizer.recommendationOverrideApplied, true)
assert.equal(guardedMode.finalOutput.bundleResult.recommendedAction, 'ESCALATE')
assert.equal(guardedMode.finalOutput.bundleResult.pricingPosture, 'ESCALATE')

console.log('Guarded finalizer checks passed.')
