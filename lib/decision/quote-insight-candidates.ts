import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export const QUOTE_INSIGHT_CANDIDATE_VERSION = 'quote-insight-candidates-v1'
export const QUOTE_INSIGHT_VALIDATION_VERSION = 'quote-insight-validation-v1'

export type QuoteInsightCandidate = {
  candidateId: string
  itemId: string
  productId: string
  productSku: string
  productName: string
  insightType: string
  eligibility: 'ALLOWED' | 'BLOCKED' | 'REQUIRES_APPROVAL'
  score: number
  reasonCodes: string[]
  policyRefs: string[]
  evidenceRefs: string[]
  recommendedQuantity: number
  recommendedUnitPrice: number
  recommendedDiscountPercent: number | null
  estimatedArrImpact: number
  deterministicLineAmount: number
  blockedReason: string | null
  selectedByRules: boolean
}

export type QuoteInsightCandidateEnvelope = {
  candidateVersion: typeof QUOTE_INSIGHT_CANDIDATE_VERSION
  generatedAt: string
  candidates: QuoteInsightCandidate[]
  allowedCandidateIds: string[]
  blockedCandidateIds: string[]
}

export type QuoteInsightValidationResult = {
  validationVersion: typeof QUOTE_INSIGHT_VALIDATION_VERSION
  status: 'PASSED' | 'REJECTED'
  acceptedCandidateIds: string[]
  rejectedCandidateIds: string[]
  checks: Array<{ name: string; status: 'PASSED' | 'FAILED' | 'WARN'; detail: string }>
}

function insightTypeForDisposition(disposition: string) {
  switch (disposition) {
    case 'EXPAND':
      return 'EXPANSION'
    case 'RENEW_WITH_CONCESSION':
      return 'CONCESSION'
    case 'ESCALATE':
      return 'DEFENSIVE_RENEWAL'
    case 'DROP':
      return 'RETENTION_REVIEW'
    case 'RENEW':
    default:
      return 'RENEW_AS_IS'
  }
}

function reasonCodesFor(insightType: string) {
  switch (insightType) {
    case 'EXPANSION':
      return ['EXPANSION_SIGNAL', 'ADOPTION_STRENGTH']
    case 'CONCESSION':
      return ['RETENTION_CONCESSION', 'POLICY_GUARDRAIL_REVIEW']
    case 'DEFENSIVE_RENEWAL':
      return ['RISK_ESCALATION_REQUIRED', 'PRICE_HOLD_PROTECTION']
    case 'RETENTION_REVIEW':
      return ['RETENTION_REVIEW', 'LOW_FIT']
    case 'RENEW_AS_IS':
    default:
      return ['STABLE_RENEWAL', 'NO_MATERIAL_EXCEPTION']
  }
}

function money(value: number) {
  return Math.round(value * 100) / 100
}

export function buildQuoteInsightCandidateEnvelope(args: {
  input: RenewalCaseEngineInput
  finalOutput: RenewalCaseEngineOutput
}): QuoteInsightCandidateEnvelope {
  const inputByItemId = new Map(args.input.items.map((item) => [item.id, item]))
  const candidates = args.finalOutput.itemResults.map((item) => {
    const inputItem = inputByItemId.get(item.itemId)
    const productSku = inputItem?.product.sku ?? item.productId
    const insightType = insightTypeForDisposition(item.recommendedDisposition)
    const estimatedArrImpact = money(item.proposedArr - (inputItem?.subscription.arr ?? 0))
    const lineAmount = money(item.proposedQuantity * item.proposedNetUnitPrice)
    const numericMismatch = Math.abs(lineAmount - item.proposedArr) > 0.01
    const eligibility = numericMismatch
      ? 'BLOCKED'
      : item.approvalRequired
        ? 'REQUIRES_APPROVAL'
        : 'ALLOWED'

    return {
      candidateId: `qic_${item.itemId}_${insightType.toLowerCase()}`,
      itemId: item.itemId,
      productId: item.productId,
      productSku,
      productName: item.productName,
      insightType,
      eligibility,
      score: Math.max(50, Math.min(95, Math.round(100 - item.riskScore / 3))),
      reasonCodes: reasonCodesFor(insightType),
      policyRefs: ['quote-insight-mapping-policy', 'renewal-pricing-guardrail-policy'],
      evidenceRefs: [
        `item.${item.itemId}.commercial.final_disposition`,
        `item.${item.itemId}.commercial.final_risk_score`,
        `item.${item.itemId}.commercial.current_arr`,
      ],
      recommendedQuantity: item.proposedQuantity,
      recommendedUnitPrice: item.proposedNetUnitPrice,
      recommendedDiscountPercent: item.recommendedDiscountPercent,
      estimatedArrImpact,
      deterministicLineAmount: lineAmount,
      blockedReason: numericMismatch
        ? 'Quote candidate math did not reconcile proposed quantity and unit price to proposed ARR.'
        : null,
      selectedByRules: true,
    } satisfies QuoteInsightCandidate
  })

  return {
    candidateVersion: QUOTE_INSIGHT_CANDIDATE_VERSION,
    generatedAt: new Date().toISOString(),
    candidates,
    allowedCandidateIds: candidates
      .filter((candidate) => candidate.eligibility === 'ALLOWED' || candidate.eligibility === 'REQUIRES_APPROVAL')
      .map((candidate) => candidate.candidateId),
    blockedCandidateIds: candidates
      .filter((candidate) => candidate.eligibility === 'BLOCKED')
      .map((candidate) => candidate.candidateId),
  }
}

export function validateQuoteInsightCandidates(
  envelope: QuoteInsightCandidateEnvelope,
): QuoteInsightValidationResult {
  const checks: QuoteInsightValidationResult['checks'] = []
  const acceptedCandidateIds: string[] = []
  const rejectedCandidateIds: string[] = []
  const supportedTypes = new Set([
    'RENEW_AS_IS',
    'CONCESSION',
    'MARGIN_RECOVERY',
    'EXPANSION',
    'CROSS_SELL',
    'HYBRID_DEPLOYMENT_FIT',
    'APPROVAL_WARNING',
    'DEFENSIVE_RENEWAL',
    'RETENTION_REVIEW',
  ])

  for (const candidate of envelope.candidates) {
    const typeSupported = supportedTypes.has(candidate.insightType)
    const mathMatches =
      Math.abs(
        money(candidate.recommendedQuantity * candidate.recommendedUnitPrice) -
          candidate.deterministicLineAmount,
      ) < 0.01
    const productExists = Boolean(candidate.productId && candidate.productSku && candidate.productName)
    const allowed = candidate.eligibility !== 'BLOCKED' && typeSupported && mathMatches && productExists

    checks.push({
      name: `QuoteInsightCandidate:${candidate.candidateId}`,
      status: allowed ? (candidate.eligibility === 'REQUIRES_APPROVAL' ? 'WARN' : 'PASSED') : 'FAILED',
      detail: allowed
        ? `${candidate.insightType} is bounded to catalog product ${candidate.productSku}; pricing math remains deterministic.`
        : `${candidate.insightType} failed support, catalog, or pricing validation.`,
    })

    if (allowed) acceptedCandidateIds.push(candidate.candidateId)
    else rejectedCandidateIds.push(candidate.candidateId)
  }

  return {
    validationVersion: QUOTE_INSIGHT_VALIDATION_VERSION,
    status: rejectedCandidateIds.length ? 'REJECTED' : 'PASSED',
    acceptedCandidateIds,
    rejectedCandidateIds,
    checks,
  }
}
