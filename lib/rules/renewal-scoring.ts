import { clamp, riskLevelFromScore, toNumber } from './helpers'
import type { ItemRiskResult, RuleCaseItemInput } from './types'

export function scoreRenewalCaseItem(input: RuleCaseItemInput): Omit<ItemRiskResult, 'recommendedDisposition' | 'recommendedDiscountPercent' | 'proposedQuantity' | 'proposedNetUnitPrice' | 'proposedArr' | 'approvalRequired' | 'guardrailResult'> {
  const metric = input.metricSnapshot
  const subscription = input.subscription

  const usage = toNumber(metric?.usagePercentOfEntitlement, 0)
  const activeUserPercent = toNumber(metric?.activeUserPercent, 0)
  const loginTrend30d = toNumber(metric?.loginTrend30d, 0)
  const ticketCount90d = toNumber(metric?.ticketCount90d, 0)
  const sev1Count90d = toNumber(metric?.sev1Count90d, 0)
  const csatScore = toNumber(metric?.csatScore, 0)

  let riskScore = 0
  const drivers: string[] = []

  if (usage < 35) {
    riskScore += 28
    drivers.push(`Usage is low at ${usage}% of entitlement.`)
  } else if (usage < 55) {
    riskScore += 16
    drivers.push(`Usage is soft at ${usage}% of entitlement.`)
  } else if (usage > 90) {
    riskScore -= 8
    drivers.push(`Usage is very strong at ${usage}% of entitlement.`)
  } else if (usage > 75) {
    riskScore -= 4
    drivers.push(`Usage is healthy at ${usage}% of entitlement.`)
  }

  if (activeUserPercent < 35) {
    riskScore += 16
    drivers.push(`Active-user penetration is low at ${activeUserPercent}%.`)
  } else if (activeUserPercent > 80) {
    riskScore -= 5
    drivers.push(`Active-user penetration is strong at ${activeUserPercent}%.`)
  }

  if (loginTrend30d <= -10) {
    riskScore += 12
    drivers.push(`Login trend is deteriorating over the last 30 days (${loginTrend30d}%).`)
  } else if (loginTrend30d >= 8) {
    riskScore -= 4
    drivers.push(`Login trend is improving over the last 30 days (+${loginTrend30d}%).`)
  }

  if (ticketCount90d >= 20) {
    riskScore += 15
    drivers.push(`Support burden is high with ${ticketCount90d} tickets in the last 90 days.`)
  } else if (ticketCount90d >= 10) {
    riskScore += 8
    drivers.push(`Support burden is elevated with ${ticketCount90d} tickets in the last 90 days.`)
  } else if (ticketCount90d <= 3) {
    riskScore -= 3
    drivers.push(`Support burden is low with ${ticketCount90d} tickets in the last 90 days.`)
  }

  if (sev1Count90d >= 3) {
    riskScore += 22
    drivers.push(`Severe support incidents are elevated with ${sev1Count90d} sev1 cases in the last 90 days.`)
  } else if (sev1Count90d >= 1) {
    riskScore += 10
    drivers.push(`There were ${sev1Count90d} sev1 incidents in the last 90 days.`)
  }

  if (csatScore > 0 && csatScore < 3.3) {
    riskScore += 12
    drivers.push(`CSAT is weak at ${csatScore.toFixed(1)}.`)
  } else if (csatScore >= 4.5) {
    riskScore -= 4
    drivers.push(`CSAT is strong at ${csatScore.toFixed(1)}.`)
  }

  const paymentRiskBand = metric?.paymentRiskBand?.toUpperCase?.() ?? ''
  if (paymentRiskBand === 'HIGH') {
    riskScore += 15
    drivers.push('Payment risk is high.')
  } else if (paymentRiskBand === 'MEDIUM') {
    riskScore += 8
    drivers.push('Payment risk is moderate.')
  }

  const adoptionBand = metric?.adoptionBand?.toUpperCase?.() ?? ''
  if (adoptionBand === 'WEAK' || adoptionBand === 'LOW') {
    riskScore += 10
    drivers.push('Adoption band is weak.')
  } else if (adoptionBand === 'MODERATE' || adoptionBand === 'MEDIUM') {
    riskScore += 2
    drivers.push('Adoption band is moderate.')
  } else if (adoptionBand === 'STRONG' || adoptionBand === 'HIGH') {
    riskScore -= 3
    drivers.push('Adoption band is strong.')
  } else if (adoptionBand === 'VERY_STRONG') {
    riskScore -= 6
    drivers.push('Adoption band is very strong.')
  }

  const normalizedProductFamily = input.product.productFamily.toLowerCase()
  const isAiDataFamily =
    normalizedProductFamily.includes('ai') || normalizedProductFamily.includes('data')
  if (isAiDataFamily && usage < 40) {
    riskScore += 6
    drivers.push('Low adoption on AI/data products increases retention risk.')
  }

  riskScore = clamp(riskScore, 0, 100)

  return {
    itemId: input.id,
    subscriptionId: subscription.id,
    productId: input.product.id,
    productName: input.product.name,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    drivers,
  }
}
