import type { GuardedDecisioningMode } from '@/lib/settings/runtime-settings'

export const QUOTE_INSIGHT_LLM_PROMPT_VERSION = 'quote-insight-disposition-rag-v1'
export const QUOTE_INSIGHT_LLM_VALIDATION_VERSION = 'quote-insight-llm-validation-v1'

export type QuoteInsightLlmCandidate = {
  insightKey: string
  productSkuSnapshot: string
  productNameSnapshot: string
  productFamilySnapshot: string
  insightType: string
  title: string
  insightSummary: string
  recommendedActionSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPrice: number | null
  recommendedDiscountPercent: number | null
  estimatedArrImpact: number | null
}

export type QuoteInsightLlmCaseContext = {
  caseId: string
  accountName: string
  accountIndustry: string | null
  accountSegment: string | null
  recommendedAction: string | null
  riskLevel: string | null
  riskScore: number | null
  scenarioKey: string | null
}

export type QuoteInsightLlmProposal = {
  productSku: string
  insightType: string
  title: string
  insightSummary: string
  recommendedActionSummary: string
  recommendedQuantity: number | null
  recommendedUnitPrice: number | null
  recommendedDiscountPercent: number | null
  estimatedArrImpact: number | null
  confidenceScore: number
  fitScore: number
  reasonCodes: string[]
  policyCitations: string[]
  explanation: string
}

export type QuoteInsightLlmDisposition = {
  finalDisposition: string
  quoteInsights: QuoteInsightLlmProposal[]
  approvalRequired: boolean
  approvalReason: string | null
  confidenceScore: number
}

export type QuoteInsightLlmTrace = {
  promptVersion: typeof QUOTE_INSIGHT_LLM_PROMPT_VERSION
  validationVersion: typeof QUOTE_INSIGHT_LLM_VALIDATION_VERSION
  mode: GuardedDecisioningMode
  generatedBy: 'DETERMINISTIC_RULES' | 'LLM' | 'LLM_REJECTED'
  modelLabel: string | null
  fallbackReason: string | null
  validationStatus: 'PASSED' | 'REJECTED' | 'SKIPPED'
  acceptedProductSkus: string[]
  rejectedProductSkus: string[]
  checks: Array<{ name: string; status: 'PASSED' | 'FAILED' | 'SKIPPED'; detail: string }>
  systemPrompt: string | null
  promptInput: unknown | null
  rawText: string | null
}

export function buildQuoteInsightDispositionPromptInput(args: {
  caseContext: QuoteInsightLlmCaseContext
  candidates: QuoteInsightLlmCandidate[]
}) {
  return {
    promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
    task:
      'Generate final Quote Insight dispositions from the supplied renewal evidence and safe candidates.',
    hardRules: [
      'Return strict JSON only.',
      'Use only the supplied candidates. Do not invent products, SKUs, quantities, discounts, prices, or ARR impacts.',
      'Use only allowedPolicyCitations values in policyCitations; do not create placeholder citations such as PCITE_1.',
      'Do not create placeholder reason codes such as RCODE_1; use clear business reason codes derived from the candidate and case.',
      'Each returned quoteInsight.productSku must match one supplied candidate.',
      'Each returned insightType must match the candidate for that productSku.',
      'Commercial numbers must reconcile to the supplied candidate values.',
      'Echo recommendedQuantity, recommendedUnitPrice, recommendedDiscountPercent, and estimatedArrImpact exactly from the supplied candidate when returning a quoteInsight.',
      'Every returned quoteInsight must include all requiredOutputShape fields. If unsure, echo the supplied candidate text and use policyCitations ["platform-policy-quote-insight-guardrails"].',
      'Right sizing must only be represented when quantity changes.',
      'If evidence is insufficient, keep the supplied candidate and explain the review concern.',
    ],
    allowedPolicyCitations: [
      'default-platform-quote-insight-policy',
      'platform-policy-quote-insight-guardrails',
    ],
    policyContext: [
      {
        policyId: 'default-platform-quote-insight-policy',
        chunkId: 'platform-policy-quote-insight-guardrails',
        text:
          'Deterministic quote insight candidates define the safe commercial envelope. LLM output may explain and confirm the candidate, but deterministic validators own math, product catalog boundaries, and approval routing.',
      },
    ],
    case: args.caseContext,
    candidates: args.candidates,
    requiredOutputShape: {
      finalDisposition: 'string',
      approvalRequired: 'boolean',
      approvalReason: 'string|null',
      confidenceScore: 'number 0..100',
      quoteInsights: [
        {
          productSku: 'string',
          insightType: 'string',
          title: 'string',
          insightSummary: 'string',
          recommendedActionSummary: 'string',
          recommendedQuantity: 'number|null',
          recommendedUnitPrice: 'number|null',
          recommendedDiscountPercent: 'number|null',
          estimatedArrImpact: 'number|null',
          confidenceScore: 'number 0..100',
          fitScore: 'number 0..100',
          reasonCodes: ['string'],
          policyCitations: ['string'],
          explanation: 'string',
        },
      ],
    },
  }
}

export function quoteInsightDispositionJsonInstructions() {
  return [
    'You are an enterprise quote insight disposition engine.',
    'Return one strict JSON object only.',
    'Use only the supplied case, policyContext, and candidates.',
    'Do not invent products, SKUs, quantities, discounts, prices, ARR impacts, policy IDs, or citations.',
    'Never use placeholder citations or reason codes such as PCITE_1 or RCODE_1.',
    'For policyCitations, use only IDs supplied in allowedPolicyCitations.',
    'The deterministic validator will reject any product, insightType, or numeric field that does not match the supplied safe candidate.',
    'The output must match the requiredOutputShape exactly.',
  ].join(' ')
}
