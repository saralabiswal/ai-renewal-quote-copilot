import assert from 'node:assert/strict'
import {
  calculateQuoteInsightsWithLlm,
  validateQuoteInsightLlmDisposition,
  type QuoteInsightLlmCandidate,
} from '../lib/ai/quote-insight-disposition'
import type { AiJsonResult } from '../lib/ai/generate-json'

const candidate: QuoteInsightLlmCandidate = {
  insightKey: 'CONCESSION|ORCL-NETSUITE',
  productSkuSnapshot: 'ORCL-NETSUITE',
  productNameSnapshot: 'Oracle NetSuite',
  productFamilySnapshot: 'Applications',
  insightType: 'CONCESSION',
  title: 'Apply controlled concession on Oracle NetSuite',
  insightSummary: 'Commercial sensitivity supports a retention concession.',
  recommendedActionSummary: 'Renew NetSuite with a controlled concession.',
  confidenceScore: 82,
  fitScore: 78,
  recommendedQuantity: 1,
  recommendedUnitPrice: 36540.9,
  recommendedDiscountPercent: 10,
  estimatedArrImpact: -7200,
}

function jsonResult(value: unknown): AiJsonResult<unknown> {
  return {
    ok: true,
    mode: 'FALLBACK',
    modelLabel: 'test-json-model',
    value,
    error: null,
    rawText: JSON.stringify(value),
  }
}

const accepted = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  jsonResult: jsonResult({
    finalDisposition: 'RETENTION_OFFER',
    approvalRequired: true,
    approvalReason: 'Retention concession requires approval.',
    confidenceScore: 82,
    quoteInsights: [
      {
        productSku: 'ORCL-NETSUITE',
        insightType: 'CONCESSION',
        title: 'Protect NetSuite renewal with a validated concession',
        insightSummary: 'LLM confirms the concession inside the safe candidate envelope.',
        recommendedActionSummary: 'Renew NetSuite with a controlled concession.',
        recommendedQuantity: 1,
        recommendedUnitPrice: 36540.9,
        recommendedDiscountPercent: 10,
        estimatedArrImpact: -7200,
        confidenceScore: 84,
        fitScore: 80,
        reasonCodes: ['RETENTION_CONCESSION'],
        policyCitations: ['platform-policy-quote-insight-guardrails'],
        explanation: 'The proposal matches the deterministic candidate and can be accepted.',
      },
    ],
  }),
})

assert.equal(accepted.trace.validationStatus, 'PASSED')
assert.equal(accepted.trace.generatedBy, 'LLM')
assert.deepEqual(accepted.trace.acceptedProductSkus, ['ORCL-NETSUITE'])
assert.equal(accepted.acceptedBySku.get('ORCL-NETSUITE')?.title, 'Protect NetSuite renewal with a validated concession')

const acceptedWithOmittedCommercialNumbers = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  promptInput: {
    policyContext: [
      {
        policyId: 'default-platform-quote-insight-policy',
        chunkId: 'platform-policy-quote-insight-guardrails',
      },
    ],
  },
  jsonResult: jsonResult({
    finalDisposition: 'RETENTION_OFFER',
    approvalRequired: true,
    approvalReason: 'Retention concession requires approval.',
    confidenceScore: 82,
    quoteInsights: [
      {
        productSku: 'ORCL-NETSUITE',
        insightType: 'CONCESSION',
        title: 'Protect NetSuite renewal with candidate-backed economics',
        insightSummary: 'LLM omitted economics, so deterministic candidates must remain authoritative.',
        recommendedActionSummary: 'Renew NetSuite with a controlled concession.',
        confidenceScore: 84,
        fitScore: 80,
        reasonCodes: ['RETENTION_CONCESSION'],
        policyCitations: ['default-platform-quote-insight-policy'],
        explanation: 'The proposal matches product and type while omitting commercial numbers.',
      },
    ],
  }),
})

assert.equal(acceptedWithOmittedCommercialNumbers.trace.validationStatus, 'PASSED')
assert.equal(acceptedWithOmittedCommercialNumbers.trace.generatedBy, 'LLM')
assert.equal(
  acceptedWithOmittedCommercialNumbers.acceptedBySku.get('ORCL-NETSUITE')?.recommendedUnitPrice,
  candidate.recommendedUnitPrice,
)
assert.equal(
  acceptedWithOmittedCommercialNumbers.acceptedBySku.get('ORCL-NETSUITE')?.estimatedArrImpact,
  candidate.estimatedArrImpact,
)

const rejectedBadMath = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  jsonResult: jsonResult({
    finalDisposition: 'RETENTION_OFFER',
    approvalRequired: true,
    approvalReason: 'Retention concession requires approval.',
    confidenceScore: 82,
    quoteInsights: [
      {
        productSku: 'ORCL-NETSUITE',
        insightType: 'CONCESSION',
        title: 'Invented discount movement',
        insightSummary: 'This should be rejected because the number is outside the candidate.',
        recommendedActionSummary: 'Renew NetSuite with a controlled concession.',
        recommendedQuantity: 1,
        recommendedUnitPrice: 1,
        recommendedDiscountPercent: 99,
        estimatedArrImpact: -999999,
        confidenceScore: 84,
        fitScore: 80,
        reasonCodes: ['RETENTION_CONCESSION'],
        policyCitations: ['platform-policy-quote-insight-guardrails'],
        explanation: 'Bad math.',
      },
    ],
  }),
})

assert.equal(rejectedBadMath.trace.validationStatus, 'REJECTED')
assert.equal(rejectedBadMath.trace.generatedBy, 'LLM_REJECTED')
assert.deepEqual(rejectedBadMath.trace.acceptedProductSkus, [])

const rejectedWrongType = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  jsonResult: jsonResult({
    finalDisposition: 'EXPANSION',
    approvalRequired: false,
    approvalReason: null,
    confidenceScore: 88,
    quoteInsights: [
      {
        productSku: 'ORCL-NETSUITE',
        insightType: 'EXPANSION',
        title: 'Wrong insight type',
        insightSummary: 'This should be rejected because type changed outside the candidate.',
        recommendedActionSummary: 'Expand NetSuite.',
        recommendedQuantity: 1,
        recommendedUnitPrice: 36540.9,
        recommendedDiscountPercent: 10,
        estimatedArrImpact: -7200,
        confidenceScore: 88,
        fitScore: 88,
        reasonCodes: ['WRONG_TYPE'],
        policyCitations: ['platform-policy-quote-insight-guardrails'],
        explanation: 'Unsupported type change.',
      },
    ],
  }),
})

assert.equal(rejectedWrongType.trace.validationStatus, 'REJECTED')
assert.equal(rejectedWrongType.trace.acceptedProductSkus.length, 0)

const rejectedUnknownProduct = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  jsonResult: jsonResult({
    finalDisposition: 'EXPAND',
    approvalRequired: false,
    approvalReason: null,
    confidenceScore: 88,
    quoteInsights: [
      {
        productSku: 'ORCL-FAKE-PRODUCT',
        insightType: 'CROSS_SELL',
        title: 'Invented product',
        insightSummary: 'This should be rejected because the SKU is unsupported.',
        recommendedActionSummary: 'Add fake product.',
        recommendedQuantity: 1,
        recommendedUnitPrice: 100,
        recommendedDiscountPercent: 0,
        estimatedArrImpact: 100,
        confidenceScore: 88,
        fitScore: 88,
        reasonCodes: ['INVENTED'],
        policyCitations: ['platform-policy-quote-insight-guardrails'],
        explanation: 'Unsupported product.',
      },
    ],
  }),
})

assert.equal(rejectedUnknownProduct.trace.validationStatus, 'REJECTED')
assert.equal(rejectedUnknownProduct.trace.acceptedProductSkus.length, 0)

const rejectedBadCitation = validateQuoteInsightLlmDisposition({
  candidates: [candidate],
  jsonResult: jsonResult({
    finalDisposition: 'RETENTION_OFFER',
    approvalRequired: true,
    approvalReason: 'Retention concession requires approval.',
    confidenceScore: 82,
    quoteInsights: [
      {
        productSku: 'ORCL-NETSUITE',
        insightType: 'CONCESSION',
        title: 'Unsupported citation',
        insightSummary: 'This should be rejected because citation is outside allowed policy IDs.',
        recommendedActionSummary: 'Renew NetSuite with a controlled concession.',
        recommendedQuantity: 1,
        recommendedUnitPrice: 36540.9,
        recommendedDiscountPercent: 10,
        estimatedArrImpact: -7200,
        confidenceScore: 84,
        fitScore: 80,
        reasonCodes: ['RETENTION_CONCESSION'],
        policyCitations: ['invented-policy-id'],
        explanation: 'Unsupported citation.',
      },
    ],
  }),
})

assert.equal(rejectedBadCitation.trace.validationStatus, 'REJECTED')
assert.equal(rejectedBadCitation.trace.acceptedProductSkus.length, 0)

async function main() {
  const skipped = await calculateQuoteInsightsWithLlm({
    mode: 'LLM_CRITIC_SHADOW',
    caseContext: {
      caseId: 'rcase_test',
      accountName: 'Test Account',
      accountIndustry: 'Retail',
      accountSegment: 'ENTERPRISE',
      recommendedAction: 'RENEW_WITH_CONCESSION',
      riskLevel: 'MEDIUM',
      riskScore: 48,
      scenarioKey: 'BASE_CASE',
    },
    candidates: [candidate],
  })

  assert.equal(skipped.trace.validationStatus, 'SKIPPED')
  assert.equal(skipped.trace.generatedBy, 'DETERMINISTIC_RULES')
  assert.equal(skipped.insights[0].title, candidate.title)

  console.log('Quote Insight LLM disposition checks passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
