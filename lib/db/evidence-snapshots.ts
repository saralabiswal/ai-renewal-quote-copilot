import { prisma } from '@/lib/prisma'
import { buildRenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import { persistEvidenceSnapshot } from '@/lib/evidence/evidence-ledger'
import { evaluateRenewalCase } from '@/lib/rules/recommendation-engine'
import { toNumber } from '@/lib/rules/helpers'
import type { RuleCaseItemInput } from '@/lib/rules/types'
import { toDemoScenarioKey } from '@/lib/scenarios/demo-scenarios'

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export async function createStandaloneEvidenceSnapshot(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    include: {
      account: true,
      items: {
        include: {
          subscription: {
            include: {
              product: true,
              metricSnapshots: {
                orderBy: { snapshotDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  })

  if (!renewalCase) {
    throw new Error(`RenewalCase ${caseId} not found.`)
  }

  const pricingPolicies = await prisma.pricingPolicy.findMany({
    where: {
      isActive: true,
      accountSegment: renewalCase.account.segment,
    },
  })
  const scenarioKey = toDemoScenarioKey(renewalCase.demoScenarioKey)
  const items: RuleCaseItemInput[] = renewalCase.items.map((item) => {
    const product = item.subscription.product
    const metric = item.subscription.metricSnapshots[0] ?? null
    const matchedPolicy =
      pricingPolicies.find(
        (policy) =>
          policy.accountSegment === renewalCase.account.segment &&
          policy.productFamily === product.productFamily,
      ) ?? null

    return {
      id: item.id,
      subscription: {
        id: item.subscription.id,
        subscriptionNumber: item.subscription.subscriptionNumber,
        productId: product.id,
        renewalDate: item.subscription.renewalDate,
        quantity: toNumber(item.subscription.quantity),
        listUnitPrice: toNumber(item.subscription.listUnitPrice),
        netUnitPrice: toNumber(item.subscription.netUnitPrice),
        discountPercent: toNumber(item.subscription.discountPercent),
        arr: toNumber(item.subscription.arr),
      },
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        productFamily: product.productFamily,
        chargeModel: product.chargeModel,
      },
      metricSnapshot: metric
        ? {
            id: metric.id,
            subscriptionId: item.subscription.id,
            snapshotDate: metric.snapshotDate,
            usagePercentOfEntitlement: toNumber(metric.usagePercentOfEntitlement),
            activeUserPercent: toNumber(metric.activeUserPercent),
            loginTrend30d: toNumber(metric.loginTrend30d),
            ticketCount90d: toNumber(metric.ticketCount90d),
            sev1Count90d: toNumber(metric.sev1Count90d),
            csatScore: toNumber(metric.csatScore),
            paymentRiskBand: metric.paymentRiskBand,
            adoptionBand: metric.adoptionBand,
            notes: metric.notes,
          }
        : null,
      pricingPolicy: matchedPolicy
        ? {
            id: matchedPolicy.id,
            name: matchedPolicy.name,
            accountSegment: matchedPolicy.accountSegment ?? renewalCase.account.segment,
            productFamily: matchedPolicy.productFamily ?? product.productFamily,
            maxAutoDiscountPercent: toNumber(matchedPolicy.maxAutoDiscountPercent),
            approvalDiscountPercent: toNumber(matchedPolicy.approvalDiscountPercent),
            floorPricePercentOfList: toNumber(matchedPolicy.floorPricePercentOfList),
            expansionThresholdUsagePercent: toNumber(matchedPolicy.expansionThresholdUsagePercent),
            requiresEscalationIfSev1Count: toNumber(matchedPolicy.requiresEscalationIfSev1Count),
          }
        : null,
    }
  })

  const engineInput = {
    account: {
      id: renewalCase.account.id,
      name: renewalCase.account.name,
      segment: renewalCase.account.segment,
      healthScore: toNumber(renewalCase.account.healthScore, 0),
      npsBand: renewalCase.account.npsBand,
      openEscalationCount: toNumber(renewalCase.account.openEscalationCount, 0),
    },
    items,
  }
  const ruleOutput = evaluateRenewalCase(engineInput)
  const snapshot = buildRenewalEvidenceSnapshot({
    input: engineInput,
    ruleOutput,
    finalOutput: ruleOutput,
    scenarioKey,
  })

  const persisted = await prisma.$transaction((tx) =>
    persistEvidenceSnapshot({
      tx,
      renewalCaseId: caseId,
      decisionRunId: null,
      generatedBy: 'STANDALONE_EVIDENCE_SNAPSHOT',
      snapshot,
    }),
  )

  return {
    ok: true,
    caseId,
    evidenceSnapshotId: persisted.id,
    generatedRequestId: makeId('evreq'),
    snapshot: {
      evidenceSnapshotVersion: snapshot.evidenceSnapshotVersion,
      scenarioKey: snapshot.scenarioKey,
      quality: snapshot.quality,
      signalCount: snapshot.signals.length,
    },
  }
}
