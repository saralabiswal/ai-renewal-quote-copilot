import { test, expect } from '@playwright/test'

import {
  buildDefaultWorkedExamples,
  buildWorkedExampleOptionsFromSeeds,
  buildWorkedPolicyExamplesFromSeeds,
  type WorkedExampleView,
} from '../lib/policies/worked-example'
import { evaluateRenewalCase } from '../lib/rules/recommendation-engine'
import type { RenewalCaseEngineInput } from '../lib/rules/types'
import {
  getPolicyStudioExampleSeeds,
  getPricingPolicies,
  type PricingPolicyView,
} from '../lib/db/policies'

function buildEngineInputFromWorkedExample(example: WorkedExampleView): RenewalCaseEngineInput {
  return {
    account: {
      id: 'acct_worked_example_parity',
      name: 'Worked Example Parity Account',
      segment: example.product.accountSegment,
      healthScore: 80,
      npsBand: 'PROMOTER',
      openEscalationCount: 0,
    },
    items: [
      {
        id: `item_${example.product.id}`,
        subscription: {
          id: `sub_${example.product.id}`,
          subscriptionNumber: `SUB-${example.product.id.toUpperCase()}`,
          productId: `prod_${example.product.id}`,
          renewalDate: '2026-12-31',
          quantity: example.inputs.currentQuantity,
          listUnitPrice: example.inputs.listUnitPrice,
          netUnitPrice:
            example.inputs.listUnitPrice * (1 - example.inputs.currentDiscountPercent / 100),
          discountPercent: example.inputs.currentDiscountPercent,
          arr: example.inputs.currentArr,
        },
        product: {
          id: `prod_${example.product.id}`,
          sku: example.product.sku,
          name: example.product.name,
          productFamily: example.product.productFamily,
          chargeModel: null,
        },
        metricSnapshot: {
          id: `ms_${example.product.id}`,
          subscriptionId: `sub_${example.product.id}`,
          snapshotDate: '2026-04-19',
          usagePercentOfEntitlement: example.inputs.usagePercentOfEntitlement,
          activeUserPercent: example.inputs.activeUserPercent,
          loginTrend30d: example.inputs.loginTrend30d,
          ticketCount90d: example.inputs.ticketCount90d,
          sev1Count90d: example.inputs.sev1Count90d,
          csatScore: example.inputs.csatScore,
          paymentRiskBand: example.inputs.paymentRiskBand,
          adoptionBand: example.inputs.adoptionBand,
          notes: null,
        },
        pricingPolicy: {
          id: `policy_${example.product.id}`,
          name: example.policyContext.matchedPolicyName,
          accountSegment: example.product.accountSegment,
          productFamily: example.product.productFamily,
          maxAutoDiscountPercent: example.policyContext.maxAutoDiscountPercent,
          approvalDiscountPercent: example.policyContext.approvalDiscountPercent,
          floorPricePercentOfList: example.policyContext.floorPricePercentOfList,
          expansionThresholdUsagePercent: example.policyContext.expansionThresholdUsagePercent,
          requiresEscalationIfSev1Count: example.policyContext.requiresEscalationIfSev1Count,
        },
      },
    ],
  }
}

async function loadWorkedExamples(pricingPolicies: PricingPolicyView[]) {
  const seeds = await getPolicyStudioExampleSeeds(6)
  if (seeds.length > 0) {
    return {
      workedExamples: buildWorkedPolicyExamplesFromSeeds(pricingPolicies, seeds),
      workedExampleOptions: buildWorkedExampleOptionsFromSeeds(seeds),
    }
  }

  const workedExamples = buildDefaultWorkedExamples(pricingPolicies)
  const workedExampleOptions = Object.keys(workedExamples).map((id) => ({
    id,
    label: id,
  }))

  return {
    workedExamples,
    workedExampleOptions,
  }
}

test('worked policy examples remain in parity with live recommendation engine', async () => {
  const pricingPolicies = await getPricingPolicies()
  const { workedExamples, workedExampleOptions } = await loadWorkedExamples(pricingPolicies)

  for (const option of workedExampleOptions) {
    const example = workedExamples[option.id]
    expect(example, `${option.id}: example exists`).toBeDefined()
    if (!example) continue

    const output = evaluateRenewalCase(buildEngineInputFromWorkedExample(example))
    const item = output.itemResults[0]

    expect(item.riskScore, `${option.id}: riskScore`).toBe(example.scoring.finalRiskScore)
    expect(item.recommendedDisposition, `${option.id}: disposition`).toBe(
      example.recommendation.disposition,
    )
    expect(item.recommendedDiscountPercent, `${option.id}: targetDiscountPercent`).toBeCloseTo(
      example.recommendation.targetDiscountPercent,
      2,
    )
    expect(item.proposedQuantity, `${option.id}: proposedQuantity`).toBe(
      example.recommendation.proposedQuantity,
    )
    expect(item.proposedNetUnitPrice, `${option.id}: proposedNetUnitPrice`).toBeCloseTo(
      example.recommendation.proposedNetUnitPrice,
      2,
    )
    expect(item.proposedArr, `${option.id}: proposedArr`).toBeCloseTo(
      example.recommendation.proposedArr,
      2,
    )
    expect(item.guardrailResult, `${option.id}: guardrailResult`).toBe(
      example.guardrails.finalGuardrailResult,
    )
    expect(item.approvalRequired, `${option.id}: approvalRequired`).toBe(
      example.guardrails.approvalRequired,
    )
  }
})

test('worked policy guardrail formulas show the true evaluated comparison', async () => {
  const pricingPolicies = await getPricingPolicies()
  const { workedExamples, workedExampleOptions } = await loadWorkedExamples(pricingPolicies)

  for (const option of workedExampleOptions) {
    const example = workedExamples[option.id]
    expect(example, `${option.id}: example exists`).toBeDefined()
    if (!example) continue

    const maxAuto = example.guardrails.checks.find((check) => check.check === 'Max Auto Discount')
    const approvalThreshold = example.guardrails.checks.find(
      (check) => check.check === 'Approval Discount Threshold',
    )
    const floorPrice = example.guardrails.checks.find((check) => check.check === 'Floor Price Check')
    const sev1 = example.guardrails.checks.find((check) => check.check === 'Sev1 Escalation')

    expect(maxAuto, `${option.id}: max auto check exists`).toBeDefined()
    expect(approvalThreshold, `${option.id}: approval threshold check exists`).toBeDefined()
    expect(floorPrice, `${option.id}: floor price check exists`).toBeDefined()
    expect(sev1, `${option.id}: sev1 check exists`).toBeDefined()

    const maxAutoTriggered =
      example.recommendation.targetDiscountPercent > example.policyContext.maxAutoDiscountPercent
    const approvalTriggered =
      example.recommendation.targetDiscountPercent >= example.policyContext.approvalDiscountPercent
    const floorTriggered =
      (example.recommendation.proposedNetUnitPrice / example.inputs.listUnitPrice) * 100 <
      example.policyContext.floorPricePercentOfList
    const sev1Triggered =
      example.inputs.sev1Count90d >= example.policyContext.requiresEscalationIfSev1Count

    expect(maxAuto!.formula).toContain(maxAutoTriggered ? '>' : '<=')
    expect(approvalThreshold!.formula).toContain(approvalTriggered ? '>=' : '<')
    expect(floorPrice!.formula).toContain(floorTriggered ? '<' : '>=')
    expect(sev1!.formula).toContain(sev1Triggered ? '>=' : '<')
  }
})
