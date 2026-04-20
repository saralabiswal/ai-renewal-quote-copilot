import { roundMoney, toNumber, uniqueStrings } from './helpers'
import { applyPricingGuardrails } from './pricing-guardrails'
import { scoreRenewalCaseItem } from './renewal-scoring'
import type {
  BundleRiskResult,
  ItemRiskResult,
  PricingPosture,
  RecommendedAction,
  RecommendedDisposition,
  RenewalCaseEngineInput,
  RenewalCaseEngineOutput,
} from './types'

function determineDisposition(input: RenewalCaseEngineInput['items'][number], riskScore: number): {
  disposition: RecommendedDisposition
  targetDiscountPercent: number
  proposedQuantity: number
} {
  const usage = toNumber(input.metricSnapshot?.usagePercentOfEntitlement, 0)
  const sev1Count = toNumber(input.metricSnapshot?.sev1Count90d, 0)
  const currentQuantity = toNumber(input.subscription.quantity, 0)
  const currentDiscount = toNumber(input.subscription.discountPercent, 0)
  const expansionThreshold = toNumber(input.pricingPolicy?.expansionThresholdUsagePercent, 90)

  if (riskScore >= 80 || sev1Count >= 3) {
    return {
      disposition: 'ESCALATE',
      targetDiscountPercent: Math.max(currentDiscount, currentDiscount + 3),
      proposedQuantity: Math.max(Math.round(currentQuantity * 0.9), 1),
    }
  }

  if (usage >= expansionThreshold && riskScore < 40) {
    return {
      disposition: 'EXPAND',
      targetDiscountPercent: Math.max(currentDiscount - 2, 0),
      proposedQuantity: Math.max(Math.round(currentQuantity * 1.1), currentQuantity + 1),
    }
  }

  if (riskScore >= 55) {
    return {
      disposition: 'RENEW_WITH_CONCESSION',
      targetDiscountPercent: Math.max(currentDiscount + 5, currentDiscount),
      proposedQuantity: currentQuantity,
    }
  }

  return {
    disposition: 'RENEW',
    targetDiscountPercent: currentDiscount,
    proposedQuantity: currentQuantity,
  }
}

function determineBundleAction(itemResults: ItemRiskResult[]): RecommendedAction {
  if (itemResults.some((item) => item.recommendedDisposition === 'ESCALATE')) return 'ESCALATE'
  if (itemResults.some((item) => item.recommendedDisposition === 'RENEW_WITH_CONCESSION')) return 'RENEW_WITH_CONCESSION'
  if (itemResults.some((item) => item.recommendedDisposition === 'EXPAND')) return 'EXPAND'
  return 'RENEW_AS_IS'
}

function determinePricingPosture(action: RecommendedAction, approvalRequired: boolean): PricingPosture {
  if (action === 'ESCALATE' || approvalRequired) return 'ESCALATE'
  if (action === 'RENEW_WITH_CONCESSION') return 'STRATEGIC_CONCESSION'
  if (action === 'EXPAND') return 'HOLD_PRICE'
  return 'HOLD_PRICE'
}

function summarizeBundle(
  accountName: string,
  action: RecommendedAction,
  approvalRequired: boolean,
  itemResults: ItemRiskResult[],
): string {
  const expandCount = itemResults.filter((item) => item.recommendedDisposition === 'EXPAND').length
  const approvalSuffix = approvalRequired
    ? ' At least one line still requires approval due to pricing guardrails.'
    : ''

  if (action === 'ESCALATE') {
    return `${accountName} requires escalation because one or more renewal lines exceed normal risk or policy thresholds.`
  }
  if (action === 'RENEW_WITH_CONCESSION') {
    return `${accountName} should renew with targeted concessions to protect the broader bundle value while limiting unnecessary discounting.${approvalSuffix}`
  }
  if (action === 'EXPAND') {
    return `${accountName} is a strong expansion candidate at renewal with ${expandCount} expansion-oriented line${expandCount === 1 ? '' : 's'} and no major risk signals.${approvalSuffix}`
  }
  if (approvalRequired) {
    return `${accountName} is a generally low-risk renewal bundle, but at least one line triggered a policy exception that requires approval.`
  }
  return `${accountName} is a low-risk renewal bundle with stable adoption and no material policy exceptions.`
}

export function evaluateRenewalCase(input: RenewalCaseEngineInput): RenewalCaseEngineOutput {
  const itemResults: ItemRiskResult[] = input.items.map((item) => {
    const scored = scoreRenewalCaseItem(item)
    const recommendation = determineDisposition(item, scored.riskScore)
    const priced = applyPricingGuardrails(item, recommendation.targetDiscountPercent, recommendation.proposedQuantity)

    return {
      ...scored,
      recommendedDisposition: recommendation.disposition,
      recommendedDiscountPercent: priced.recommendedDiscountPercent,
      proposedQuantity: priced.proposedQuantity,
      proposedNetUnitPrice: priced.proposedNetUnitPrice,
      proposedArr: priced.proposedArr,
      approvalRequired: priced.approvalRequired,
      guardrailResult: priced.guardrailResult,
    }
  })

  const bundleCurrentArr = roundMoney(
    itemResults.reduce((sum, item, index) => sum + toNumber(input.items[index]?.subscription.arr, 0), 0),
  )
  const bundleProposedArr = roundMoney(itemResults.reduce((sum, item) => sum + toNumber(item.proposedArr, 0), 0))
  const bundleDeltaArr = roundMoney(bundleProposedArr - bundleCurrentArr)
  const riskScore = Math.round(itemResults.reduce((sum, item) => sum + item.riskScore, 0) / Math.max(itemResults.length, 1))
  const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW'
  const approvalRequired = itemResults.some((item) => item.approvalRequired)
  const recommendedAction = determineBundleAction(itemResults)
  const pricingPosture = determinePricingPosture(recommendedAction, approvalRequired)
  const primaryDrivers = uniqueStrings(itemResults.flatMap((item) => item.drivers).slice(0, 8))

  const bundleResult: BundleRiskResult = {
    riskScore,
    riskLevel,
    recommendedAction,
    pricingPosture,
    approvalRequired,
    bundleCurrentArr,
    bundleProposedArr,
    bundleDeltaArr,
    primaryDrivers,
    summaryText: summarizeBundle(input.account.name, recommendedAction, approvalRequired, itemResults),
  }

  return {
    itemResults,
    bundleResult,
  }
}
