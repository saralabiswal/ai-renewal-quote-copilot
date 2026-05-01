import { strict as assert } from 'node:assert'
import {
  QUOTE_INSIGHT_CANDIDATE_VERSION,
  QUOTE_INSIGHT_VALIDATION_VERSION,
  type QuoteInsightCandidateEnvelope,
  type QuoteInsightValidationResult,
} from '../lib/decision/quote-insight-candidates'
import { finalizeQuoteInsightCandidates } from '../lib/decision/quote-insight-finalizer'

const envelope: QuoteInsightCandidateEnvelope = {
  candidateVersion: QUOTE_INSIGHT_CANDIDATE_VERSION,
  generatedAt: '2026-04-30T00:00:00.000Z',
  allowedCandidateIds: ['qic_expand', 'qic_approval'],
  blockedCandidateIds: ['qic_blocked'],
  candidates: [
    {
      candidateId: 'qic_expand',
      itemId: 'item_1',
      productId: 'prod_1',
      productSku: 'SKU-1',
      productName: 'Oracle CPQ',
      insightType: 'EXPANSION',
      eligibility: 'ALLOWED',
      score: 91,
      reasonCodes: ['EXPANSION_SIGNAL'],
      policyRefs: ['quote-insight-mapping-policy'],
      evidenceRefs: ['item.item_1.commercial.final_disposition'],
      recommendedQuantity: 11,
      recommendedUnitPrice: 100,
      recommendedDiscountPercent: 0,
      estimatedArrImpact: 100,
      deterministicLineAmount: 1100,
      blockedReason: null,
      selectedByRules: true,
    },
    {
      candidateId: 'qic_approval',
      itemId: 'item_2',
      productId: 'prod_2',
      productSku: 'SKU-2',
      productName: 'Oracle OCI',
      insightType: 'RENEW_AS_IS',
      eligibility: 'REQUIRES_APPROVAL',
      score: 84,
      reasonCodes: ['STABLE_RENEWAL'],
      policyRefs: ['renewal-pricing-guardrail-policy'],
      evidenceRefs: ['item.item_2.commercial.final_disposition'],
      recommendedQuantity: 1,
      recommendedUnitPrice: 500,
      recommendedDiscountPercent: 12,
      estimatedArrImpact: 0,
      deterministicLineAmount: 500,
      blockedReason: null,
      selectedByRules: true,
    },
    {
      candidateId: 'qic_blocked',
      itemId: 'item_3',
      productId: 'prod_3',
      productSku: 'SKU-3',
      productName: 'Oracle Test',
      insightType: 'EXPANSION',
      eligibility: 'BLOCKED',
      score: 95,
      reasonCodes: ['EXPANSION_SIGNAL'],
      policyRefs: ['quote-insight-mapping-policy'],
      evidenceRefs: ['item.item_3.commercial.final_disposition'],
      recommendedQuantity: 2,
      recommendedUnitPrice: 200,
      recommendedDiscountPercent: 0,
      estimatedArrImpact: 0,
      deterministicLineAmount: 401,
      blockedReason: 'Math mismatch.',
      selectedByRules: false,
    },
  ],
}

const validation: QuoteInsightValidationResult = {
  validationVersion: QUOTE_INSIGHT_VALIDATION_VERSION,
  status: 'REJECTED',
  acceptedCandidateIds: ['qic_expand', 'qic_approval'],
  rejectedCandidateIds: ['qic_blocked'],
  checks: [],
}

const shadow = finalizeQuoteInsightCandidates({
  mode: 'LLM_RANKING_SHADOW',
  envelope,
  validation,
})
assert.equal(shadow.finalStateSource, 'DETERMINISTIC_QUOTE_INSIGHT_ENGINE')
assert.equal(shadow.prioritizedCandidateIds[0], 'qic_expand')
assert.equal(shadow.approvalRequiredCandidateIds.length, 1)
assert.equal(shadow.fallbackUsed, false)

const guarded = finalizeQuoteInsightCandidates({
  mode: 'LLM_ASSISTED_GUARDED',
  envelope,
  validation,
})
assert.equal(guarded.finalStateSource, 'LLM_ASSISTED_GUARDED')
assert.equal(guarded.prioritizedCandidateIds.length, 2)
assert.equal(guarded.rejectedCandidateIds.length, 1)
assert.ok(guarded.checks.some((check) => check.name === 'ApprovalRoutingPreserved'))

console.log('Quote insight finalizer checks passed.')
