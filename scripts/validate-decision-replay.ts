import { strict as assert } from 'node:assert'
import { verifyDecisionRunReplay } from '../lib/decision/replay-verifier'
import { evaluateRenewalCase } from '../lib/rules/recommendation-engine'
import type { RenewalCaseEngineInput } from '../lib/rules/types'

const ruleInput: RenewalCaseEngineInput = {
  account: {
    id: 'acct_demo',
    name: 'Demo Account',
    segment: 'STRATEGIC',
    healthScore: 82,
    npsBand: 'Promoter',
    openEscalationCount: 0,
  },
  items: [
    {
      id: 'item_expand',
      subscription: {
        id: 'sub_expand',
        subscriptionNumber: 'SUB-EXPAND',
        productId: 'prod_cpq',
        renewalDate: '2026-06-30T00:00:00.000Z',
        quantity: 100,
        listUnitPrice: 120,
        netUnitPrice: 108,
        discountPercent: 10,
        arr: 10800,
      },
      product: {
        id: 'prod_cpq',
        sku: 'ORCL-CPQ',
        name: 'Oracle CPQ',
        productFamily: 'Revenue Operations',
        chargeModel: 'Per User / Annual',
      },
      metricSnapshot: {
        id: 'metric_expand',
        subscriptionId: 'sub_expand',
        snapshotDate: '2026-04-01T00:00:00.000Z',
        usagePercentOfEntitlement: 94,
        activeUserPercent: 88,
        loginTrend30d: 12,
        ticketCount90d: 1,
        sev1Count90d: 0,
        csatScore: 4.6,
        paymentRiskBand: 'LOW',
        adoptionBand: 'HIGH',
      },
      pricingPolicy: {
        id: 'pp_demo',
        name: 'Demo Policy',
        accountSegment: 'STRATEGIC',
        productFamily: 'Revenue Operations',
        maxAutoDiscountPercent: 9,
        approvalDiscountPercent: 13,
        floorPricePercentOfList: 88,
        expansionThresholdUsagePercent: 90,
        requiresEscalationIfSev1Count: 1,
      },
    },
  ],
}

const replayed = evaluateRenewalCase(ruleInput)
const baseRun = {
  id: 'dr_replay_fixture',
  ruleInputJson: JSON.stringify(ruleInput),
  ruleOutputJson: JSON.stringify(replayed.bundleResult),
  finalOutputJson: JSON.stringify(replayed.bundleResult),
  finalizerJson: JSON.stringify({
    finalCandidate: replayed.bundleResult.recommendedAction,
  }),
  replayMetadataJson: JSON.stringify({
    deterministicReplaySupported: true,
  }),
}

const passed = verifyDecisionRunReplay(baseRun)
assert.equal(passed.status, 'PASSED')
assert.equal(passed.replayedRuleOutput?.recommendedAction, 'EXPAND')
assert.ok(passed.checks.every((check) => check.status !== 'FAILED'))

const failed = verifyDecisionRunReplay({
  ...baseRun,
  ruleOutputJson: JSON.stringify({
    ...replayed.bundleResult,
    recommendedAction: 'RENEW_AS_IS',
  }),
})
assert.equal(failed.status, 'FAILED')
assert.ok(failed.checks.some((check) => check.name === 'RuleOutputConsistency' && check.status === 'FAILED'))

const missing = verifyDecisionRunReplay({
  ...baseRun,
  ruleInputJson: null,
})
assert.equal(missing.status, 'NOT_REPLAYABLE')

console.log('Decision replay verification checks passed.')
