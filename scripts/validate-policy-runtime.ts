import { strict as assert } from 'node:assert'
import { buildDecisionCandidateEnvelope } from '../lib/decision/candidates'
import { validateGuardedDecisionProposal } from '../lib/decision/guarded-validator'
import { buildRenewalEvidenceSnapshot } from '../lib/evidence/renewal-evidence'
import {
  buildPolicyEvaluationTrace,
  POLICY_REGISTRY_ID,
  POLICY_RUNTIME_VERSION,
} from '../lib/policies/policy-runtime'
import { evaluateRenewalCase } from '../lib/rules/recommendation-engine'
import type { RenewalCaseEngineInput } from '../lib/rules/types'

const input: RenewalCaseEngineInput = {
  account: {
    id: 'acct_policy_runtime',
    name: 'Policy Runtime Account',
    segment: 'ENTERPRISE',
    healthScore: 86,
    npsBand: 'PROMOTER',
    openEscalationCount: 0,
  },
  items: [
    {
      id: 'item_policy_runtime',
      product: {
        id: 'prod_policy_runtime',
        sku: 'SKU-POLICY-RUNTIME',
        name: 'Oracle CPQ',
        productFamily: 'Applications',
        chargeModel: null,
      },
      subscription: {
        id: 'sub_policy_runtime',
        subscriptionNumber: 'SUB-POLICY-RUNTIME',
        productId: 'prod_policy_runtime',
        renewalDate: '2026-12-31',
        quantity: 100,
        listUnitPrice: 100,
        netUnitPrice: 88,
        discountPercent: 12,
        arr: 8800,
      },
      metricSnapshot: {
        id: 'metric_policy_runtime',
        subscriptionId: 'sub_policy_runtime',
        snapshotDate: '2026-04-20',
        usagePercentOfEntitlement: 93,
        activeUserPercent: 88,
        loginTrend30d: 12,
        ticketCount90d: 2,
        sev1Count90d: 0,
        csatScore: 4.7,
        paymentRiskBand: 'LOW',
        adoptionBand: 'VERY_STRONG',
        notes: null,
      },
      pricingPolicy: {
        id: 'pricing_policy_runtime',
        name: 'Enterprise Applications Policy',
        accountSegment: 'ENTERPRISE',
        productFamily: 'Applications',
        maxAutoDiscountPercent: 12,
        approvalDiscountPercent: 16,
        floorPricePercentOfList: 84,
        expansionThresholdUsagePercent: 90,
        requiresEscalationIfSev1Count: 2,
      },
    },
  ],
}

const ruleOutput = evaluateRenewalCase(input)
const finalOutput = ruleOutput
const evidenceSnapshot = buildRenewalEvidenceSnapshot({
  input,
  ruleOutput,
  finalOutput,
  scenarioKey: 'BASE_CASE',
})
const decisionCandidates = buildDecisionCandidateEnvelope({
  caseId: 'case_policy_runtime',
  input,
  finalOutput,
  evidenceSnapshot,
})
const selectedCandidate = finalOutput.bundleResult.recommendedAction
const selectedCandidateRefs =
  decisionCandidates.candidates.find(
    (candidate) =>
      candidate.scope === 'BUNDLE_RECOMMENDATION' &&
      candidate.candidateType === selectedCandidate,
  )?.evidenceRefs ?? []
const validationResult = validateGuardedDecisionProposal({
  proposal: {
    proposalSource: 'RULE_ENGINE',
    selectedCandidate,
    confidence: 90,
    reasonCodes: [selectedCandidate],
    evidenceRefs: selectedCandidateRefs.slice(0, 4),
  },
  candidates: decisionCandidates,
  evidenceSnapshot,
})

const trace = buildPolicyEvaluationTrace({
  input,
  ruleOutput,
  finalOutput,
  decisionCandidates,
  validationResult,
})

assert.equal(trace.policyRuntimeVersion, POLICY_RUNTIME_VERSION)
assert.equal(trace.policyRegistryId, POLICY_REGISTRY_ID)
assert.equal(trace.activeArtifacts.length, 7)
assert.ok(trace.ruleHits.length >= 5)
assert.ok(trace.ruleHits.some((hit) => hit.policyId === 'renewal-risk-scoring-policy'))
assert.ok(trace.ruleHits.some((hit) => hit.policyId === 'renewal-disposition-policy'))
assert.ok(trace.ruleHits.some((hit) => hit.policyId === 'renewal-pricing-guardrail-policy'))
assert.ok(trace.ruleHits.some((hit) => hit.policyId === 'guarded-llm-validation-policy'))
assert.equal(trace.summary.ruleHitCount, trace.ruleHits.length)
assert.equal(
  trace.summary.appliedCount + trace.summary.warningCount + trace.summary.blockedCount,
  trace.ruleHits.length,
)

console.log('Policy runtime trace checks passed.')
