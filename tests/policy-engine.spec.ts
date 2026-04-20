import { test, expect } from '@playwright/test'

import { evaluateRenewalCase } from '../lib/rules/recommendation-engine'
import type { RenewalCaseEngineInput } from '../lib/rules/types'

type ItemInput = RenewalCaseEngineInput['items'][number]
type MetricSnapshot = NonNullable<ItemInput['metricSnapshot']>
type PricingPolicy = NonNullable<ItemInput['pricingPolicy']>

const baseAccount: RenewalCaseEngineInput['account'] = {
  id: 'acct_policy_tests',
  name: 'Policy Test Account',
  segment: 'ENTERPRISE',
  healthScore: 80,
  npsBand: 'PROMOTER',
  openEscalationCount: 0,
}

let idCounter = 0
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function buildItem({
  metricSnapshot = {},
  pricingPolicy = {},
  subscription = {},
  product = {},
}: {
  metricSnapshot?: Partial<MetricSnapshot>
  pricingPolicy?: Partial<PricingPolicy>
  subscription?: Partial<ItemInput['subscription']>
  product?: Partial<ItemInput['product']>
} = {}): ItemInput {
  const resolvedProduct: ItemInput['product'] = {
    id: nextId('prod'),
    sku: nextId('sku'),
    name: 'Oracle Fusion Applications',
    productFamily: 'Applications',
    chargeModel: null,
    ...product,
  }

  const resolvedSubscription: ItemInput['subscription'] = {
    id: nextId('sub'),
    subscriptionNumber: nextId('subnum'),
    productId: resolvedProduct.id,
    renewalDate: '2026-12-31',
    quantity: 100,
    listUnitPrice: 100,
    netUnitPrice: 90,
    discountPercent: 10,
    arr: 9000,
    ...subscription,
  }

  const resolvedMetricSnapshot: MetricSnapshot = {
    id: nextId('ms'),
    subscriptionId: resolvedSubscription.id,
    snapshotDate: '2026-04-19',
    usagePercentOfEntitlement: 70,
    activeUserPercent: 55,
    loginTrend30d: 0,
    ticketCount90d: 6,
    sev1Count90d: 0,
    csatScore: 4,
    paymentRiskBand: 'LOW',
    adoptionBand: null,
    notes: null,
    ...metricSnapshot,
  }

  const resolvedPricingPolicy: PricingPolicy = {
    id: nextId('policy'),
    name: 'Policy',
    accountSegment: 'ENTERPRISE',
    productFamily: resolvedProduct.productFamily,
    maxAutoDiscountPercent: 12,
    approvalDiscountPercent: 16,
    floorPricePercentOfList: 84,
    expansionThresholdUsagePercent: 90,
    requiresEscalationIfSev1Count: 2,
    ...pricingPolicy,
  }

  return {
    id: nextId('item'),
    subscription: resolvedSubscription,
    product: resolvedProduct,
    metricSnapshot: resolvedMetricSnapshot,
    pricingPolicy: resolvedPricingPolicy,
  }
}

function evaluateItems(items: ItemInput[]) {
  return evaluateRenewalCase({
    account: baseAccount,
    items,
  })
}

test('disposition boundary flips at risk score 55', () => {
  const risk54Item = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: 0,
      ticketCount90d: 10,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  })

  const risk55Item = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: -10,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  })

  const out54 = evaluateItems([risk54Item]).itemResults[0]
  const out55 = evaluateItems([risk55Item]).itemResults[0]

  expect(out54.riskScore).toBe(54)
  expect(out54.recommendedDisposition).toBe('RENEW')
  expect(out55.riskScore).toBe(55)
  expect(out55.recommendedDisposition).toBe('RENEW_WITH_CONCESSION')
})

test('expansion threshold is inclusive when risk is below 40', () => {
  const expansionItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 90,
      activeUserPercent: 85,
      loginTrend30d: 10,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4.7,
      paymentRiskBand: 'LOW',
      adoptionBand: 'VERY_STRONG',
    },
    pricingPolicy: {
      expansionThresholdUsagePercent: 90,
    },
  })

  const out = evaluateItems([expansionItem]).itemResults[0]

  expect(out.riskScore).toBe(0)
  expect(out.recommendedDisposition).toBe('EXPAND')
  expect(out.proposedQuantity).toBe(110)
})

test('sev1 escalation rule takes precedence over expansion conditions', () => {
  const escalateItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 95,
      activeUserPercent: 90,
      loginTrend30d: 10,
      ticketCount90d: 2,
      sev1Count90d: 3,
      csatScore: 4.7,
      paymentRiskBand: 'LOW',
      adoptionBand: 'VERY_STRONG',
    },
  })

  const out = evaluateItems([escalateItem]).itemResults[0]

  expect(out.riskScore).toBeLessThan(40)
  expect(out.recommendedDisposition).toBe('ESCALATE')
  expect(out.proposedQuantity).toBe(90)
})

test('bundle action precedence favors concession over expansion', () => {
  const concessionItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: -10,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  })
  const expansionItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 92,
      activeUserPercent: 86,
      loginTrend30d: 9,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4.7,
      paymentRiskBand: 'LOW',
      adoptionBand: 'VERY_STRONG',
    },
  })

  const out = evaluateItems([concessionItem, expansionItem]).bundleResult
  expect(out.recommendedAction).toBe('RENEW_WITH_CONCESSION')
})

test('bundle action precedence favors escalation over concession', () => {
  const concessionItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: -10,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  })
  const escalateItem = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 60,
      activeUserPercent: 60,
      loginTrend30d: 0,
      ticketCount90d: 6,
      sev1Count90d: 3,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  })

  const out = evaluateItems([concessionItem, escalateItem]).bundleResult
  expect(out.recommendedAction).toBe('ESCALATE')
})

test('guardrail precedence: floor-price exception overrides generic approval', () => {
  const item = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: -10,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
    pricingPolicy: {
      maxAutoDiscountPercent: 12,
      approvalDiscountPercent: 16,
      floorPricePercentOfList: 90,
      requiresEscalationIfSev1Count: 99,
    },
  })

  const out = evaluateItems([item]).itemResults[0]

  expect(out.recommendedDiscountPercent).toBe(15)
  expect(out.approvalRequired).toBe(true)
  expect(out.guardrailResult).toBe('FLOOR_PRICE_EXCEPTION')
})

test('guardrail precedence: sev1 escalation overrides other guardrail hits', () => {
  const item = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 30,
      activeUserPercent: 30,
      loginTrend30d: -10,
      ticketCount90d: 2,
      sev1Count90d: 1,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
    pricingPolicy: {
      maxAutoDiscountPercent: 12,
      approvalDiscountPercent: 16,
      floorPricePercentOfList: 90,
      requiresEscalationIfSev1Count: 1,
    },
  })

  const out = evaluateItems([item]).itemResults[0]

  expect(out.approvalRequired).toBe(true)
  expect(out.guardrailResult).toBe('SEV1_ESCALATION')
})

test('renew-as-is with approval required has non-contradictory summary text', () => {
  const item = buildItem({
    metricSnapshot: {
      usagePercentOfEntitlement: 70,
      activeUserPercent: 55,
      loginTrend30d: 0,
      ticketCount90d: 6,
      sev1Count90d: 0,
      csatScore: 4,
      paymentRiskBand: 'LOW',
      adoptionBand: null,
    },
    pricingPolicy: {
      maxAutoDiscountPercent: 6,
      approvalDiscountPercent: 8,
      floorPricePercentOfList: 84,
      requiresEscalationIfSev1Count: 99,
    },
  })

  const bundle = evaluateItems([item]).bundleResult

  expect(bundle.recommendedAction).toBe('RENEW_AS_IS')
  expect(bundle.approvalRequired).toBe(true)
  expect(bundle.summaryText).not.toContain('no material policy exceptions')
  expect(bundle.summaryText.toLowerCase()).toContain('requires approval')
})
