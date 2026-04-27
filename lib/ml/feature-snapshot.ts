import { toNumber } from '@/lib/rules/helpers'
import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export const FEATURE_SCHEMA_VERSION = 'renewal-features-v1'

export type RenewalFeatureSnapshot = {
  featureSchemaVersion: typeof FEATURE_SCHEMA_VERSION
  generatedAt: string
  account: {
    id: string
    segment: string
    healthScore: number | null
    npsBand: string | null
    openEscalationCount: number | null
  }
  items: Array<{
    itemId: string
    subscriptionId: string
    productId: string
    productFamily: string
    usagePercentOfEntitlement: number | null
    activeUserPercent: number | null
    loginTrend30d: number | null
    ticketCount90d: number | null
    sev1Count90d: number | null
    csatScore: number | null
    paymentRiskBand: string | null
    adoptionBand: string | null
    currentQuantity: number
    currentDiscountPercent: number
    currentArr: number
    ruleRiskScore: number | null
    ruleDisposition: string | null
  }>
}

export function buildRenewalFeatureSnapshot(
  input: RenewalCaseEngineInput,
  ruleOutput?: RenewalCaseEngineOutput,
): RenewalFeatureSnapshot {
  const ruleItemById = new Map((ruleOutput?.itemResults ?? []).map((item) => [item.itemId, item]))

  return {
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    account: {
      id: input.account.id,
      segment: input.account.segment,
      healthScore: input.account.healthScore,
      npsBand: input.account.npsBand,
      openEscalationCount: input.account.openEscalationCount,
    },
    items: input.items.map((item) => {
      const ruleItem = ruleItemById.get(item.id)
      const metric = item.metricSnapshot
      return {
        itemId: item.id,
        subscriptionId: item.subscription.id,
        productId: item.product.id,
        productFamily: item.product.productFamily,
        usagePercentOfEntitlement:
          metric?.usagePercentOfEntitlement == null
            ? null
            : toNumber(metric.usagePercentOfEntitlement),
        activeUserPercent:
          metric?.activeUserPercent == null ? null : toNumber(metric.activeUserPercent),
        loginTrend30d: metric?.loginTrend30d == null ? null : toNumber(metric.loginTrend30d),
        ticketCount90d: metric?.ticketCount90d == null ? null : toNumber(metric.ticketCount90d),
        sev1Count90d: metric?.sev1Count90d == null ? null : toNumber(metric.sev1Count90d),
        csatScore: metric?.csatScore == null ? null : toNumber(metric.csatScore),
        paymentRiskBand: metric?.paymentRiskBand ?? null,
        adoptionBand: metric?.adoptionBand ?? null,
        currentQuantity: toNumber(item.subscription.quantity),
        currentDiscountPercent: toNumber(item.subscription.discountPercent),
        currentArr: toNumber(item.subscription.arr),
        ruleRiskScore: ruleItem?.riskScore ?? null,
        ruleDisposition: ruleItem?.recommendedDisposition ?? null,
      }
    }),
  }
}
