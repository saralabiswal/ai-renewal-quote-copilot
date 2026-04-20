import { PrismaClient } from '@prisma/client'

import { buildCaseNarrative, buildItemAnalysisSummary } from '../rules/driver-builder'
import { evaluateRenewalCase } from '../rules/recommendation-engine'
import { toNumber } from '../rules/helpers'
import type { RuleCaseItemInput } from '../rules/types'
import { DEMO_SCENARIOS, toDemoScenarioKey, type DemoScenarioKey } from '@/lib/scenarios/demo-scenarios'

const prisma = new PrismaClient()

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function applyScenarioToSnapshot(
  snapshot: RuleCaseItemInput['metricSnapshot'],
  scenarioKey: DemoScenarioKey,
): RuleCaseItemInput['metricSnapshot'] {
  if (!snapshot) {
    return null
  }

  if (scenarioKey === 'BASE_CASE') {
    return snapshot
  }

  const overrides = DEMO_SCENARIOS[scenarioKey].overrides
  const usagePercentOfEntitlement = toNumber(snapshot.usagePercentOfEntitlement, 0)
  const activeUserPercent = toNumber(snapshot.activeUserPercent, 0)
  const loginTrend30d = toNumber(snapshot.loginTrend30d, 0)
  const ticketCount90d = toNumber(snapshot.ticketCount90d, 0)
  const sev1Count90d = toNumber(snapshot.sev1Count90d, 0)
  const csatScore = toNumber(snapshot.csatScore, 0)

  const notes = [snapshot.notes, ...(overrides.tagNotes ?? [])].filter(Boolean).join(' | ')

  return {
    ...snapshot,
    usagePercentOfEntitlement: clamp(
      round1(usagePercentOfEntitlement + (overrides.usagePercentOfEntitlementDelta ?? 0)),
      0,
      100,
    ),
    activeUserPercent: clamp(
      round1(activeUserPercent + (overrides.activeUserPercentDelta ?? 0)),
      0,
      100,
    ),
    loginTrend30d: round1(loginTrend30d + (overrides.loginTrend30dDelta ?? 0)),
    ticketCount90d: Math.max(0, Math.round(ticketCount90d + (overrides.ticketCount90dDelta ?? 0))),
    sev1Count90d: Math.max(0, Math.round(sev1Count90d + (overrides.sev1Count90dDelta ?? 0))),
    csatScore: clamp(round1(csatScore + (overrides.csatScoreDelta ?? 0)), 1, 5),
    notes: notes || null,
  }
}

function buildDriverChanges(items: RuleCaseItemInput[]) {
  return items
    .filter((item) => item.metricSnapshot)
    .slice(0, 4)
    .map((item) => ({
      itemId: item.id,
      productName: item.product.name,
      usagePercentOfEntitlement: item.metricSnapshot?.usagePercentOfEntitlement ?? null,
      activeUserPercent: item.metricSnapshot?.activeUserPercent ?? null,
      loginTrend30d: item.metricSnapshot?.loginTrend30d ?? null,
      ticketCount90d: item.metricSnapshot?.ticketCount90d ?? null,
      sev1Count90d: item.metricSnapshot?.sev1Count90d ?? null,
      csatScore: item.metricSnapshot?.csatScore ?? null,
      notes: item.metricSnapshot?.notes ?? null,
    }))
}

function buildCaseExecutiveSummary(
  accountName: string,
  summaryText: string,
  recommendedAction: string,
  riskLevel: string,
  approvalRequired: boolean,
  primaryDrivers: string[],
) {
  const normalizedAction = recommendedAction.toLowerCase().split('_').join(' ')
  const topDriverText =
    primaryDrivers.length > 0
      ? `Top drivers: ${primaryDrivers.slice(0, 2).join('; ')}.`
      : 'Top drivers are not available.'

  return [
    `${accountName} is currently assessed as ${riskLevel.toLowerCase()} risk with a recommended action of ${normalizedAction}.`,
    summaryText,
    approvalRequired ? 'Approval is required for this renewal.' : 'Approval is not required for this renewal.',
    topDriverText,
  ].join(' ')
}

export async function recalculateRenewalCaseById(caseId: string) {
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
      analyses: {
        orderBy: { analysisVersion: 'desc' },
        take: 1,
      },
      narratives: {
        orderBy: { createdAt: 'desc' },
        take: 1,
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

  const items: RuleCaseItemInput[] = renewalCase.items.map((item: any) => {
    const product = item.subscription.product
    const baseMetricSnapshot = item.subscription.metricSnapshots?.[0] ?? null
    const metricSnapshot = applyScenarioToSnapshot(
      baseMetricSnapshot
        ? {
            id: baseMetricSnapshot.id,
            subscriptionId: item.subscription.id,
            snapshotDate: baseMetricSnapshot.snapshotDate,
            usagePercentOfEntitlement: toNumber(baseMetricSnapshot.usagePercentOfEntitlement),
            activeUserPercent: toNumber(baseMetricSnapshot.activeUserPercent),
            loginTrend30d: toNumber(baseMetricSnapshot.loginTrend30d),
            ticketCount90d: toNumber(baseMetricSnapshot.ticketCount90d),
            sev1Count90d: toNumber(baseMetricSnapshot.sev1Count90d),
            csatScore: toNumber(baseMetricSnapshot.csatScore),
            paymentRiskBand: baseMetricSnapshot.paymentRiskBand,
            adoptionBand: baseMetricSnapshot.adoptionBand,
            notes: baseMetricSnapshot.notes,
          }
        : null,
      scenarioKey,
    )

    const matchedPolicy =
      pricingPolicies.find(
        (policy: any) =>
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
        listUnitPrice: toNumber(item.subscription.listUnitPrice ?? item.subscription.listPrice),
        netUnitPrice: toNumber(item.subscription.netUnitPrice ?? item.subscription.unitPrice),
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
      metricSnapshot,
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

  const previousCaseState = {
    riskLevel: renewalCase.riskLevel,
    recommendedAction: renewalCase.recommendedAction,
    requiresApproval: renewalCase.requiresApproval,
  }

  const engineOutput = evaluateRenewalCase({
    account: {
      id: renewalCase.account.id,
      name: renewalCase.account.name,
      segment: renewalCase.account.segment,
      healthScore: toNumber(renewalCase.account.healthScore, 0),
      npsBand: renewalCase.account.npsBand,
      openEscalationCount: toNumber(renewalCase.account.openEscalationCount, 0),
    },
    items,
  })

  const recommendationDiff = {
    scenarioKey,
    scenarioLabel: DEMO_SCENARIOS[scenarioKey].label,
    previous: previousCaseState,
    next: {
      riskLevel: engineOutput.bundleResult.riskLevel,
      recommendedAction: engineOutput.bundleResult.recommendedAction,
      requiresApproval: engineOutput.bundleResult.approvalRequired,
    },
    driverChanges: buildDriverChanges(items),
    recalculatedAt: new Date().toISOString(),
  }

  const nextCaseAnalysisVersion = (renewalCase.analyses[0]?.analysisVersion ?? 0) + 1

  await prisma.$transaction(async (tx) => {
    await tx.renewalCase.update({
      where: { id: caseId },
      data: {
        recommendedAction: engineOutput.bundleResult.recommendedAction,
        riskScore: engineOutput.bundleResult.riskScore,
        riskLevel: engineOutput.bundleResult.riskLevel,
        bundleCurrentArr: engineOutput.bundleResult.bundleCurrentArr,
        bundleProposedArr: engineOutput.bundleResult.bundleProposedArr,
        bundleDeltaArr: engineOutput.bundleResult.bundleDeltaArr,
        requiresApproval: engineOutput.bundleResult.approvalRequired,
        approvalReason: engineOutput.bundleResult.approvalRequired
          ? 'Generated recommendation includes at least one policy-triggering exception.'
          : null,
        status: 'UNDER_REVIEW',
        quoteInsightsNeedRefresh: true,
        lastRecommendationJson: JSON.stringify(recommendationDiff),
        lastScenarioChangedAt: new Date(),
      },
    })

    await tx.quoteDraft.updateMany({
      where: { renewalCaseId: caseId },
      data: {
        approvalRequired: engineOutput.bundleResult.approvalRequired,
      },
    })

    await tx.renewalCaseAnalysis.create({
      data: {
        id: makeId('rca'),
        renewalCaseId: caseId,
        analysisVersion: nextCaseAnalysisVersion,
        riskScore: engineOutput.bundleResult.riskScore,
        riskLevel: engineOutput.bundleResult.riskLevel,
        recommendedAction: engineOutput.bundleResult.recommendedAction,
        pricingPosture: engineOutput.bundleResult.pricingPosture,
        approvalRequired: engineOutput.bundleResult.approvalRequired,
        primaryDriversJson: JSON.stringify(engineOutput.bundleResult.primaryDrivers),
        bundleSummaryText: engineOutput.bundleResult.summaryText,
        generatedBy: 'RULE_ENGINE',
      },
    })

    await tx.recommendationNarrative.create({
      data: {
        id: makeId('rn'),
        scopeType: 'CASE',
        renewalCaseId: caseId,
        narrativeType: 'EXECUTIVE_SUMMARY',
        content: buildCaseExecutiveSummary(
          renewalCase.account.name,
          engineOutput.bundleResult.summaryText,
          engineOutput.bundleResult.recommendedAction,
          engineOutput.bundleResult.riskLevel,
          engineOutput.bundleResult.approvalRequired,
          engineOutput.bundleResult.primaryDrivers,
        ),
        modelLabel: 'rule-engine-v1',
      },
    })

    await tx.recommendationNarrative.create({
      data: {
        id: makeId('rn'),
        scopeType: 'CASE',
        renewalCaseId: caseId,
        narrativeType: 'RATIONALE',
        content: buildCaseNarrative(
          renewalCase.account.name,
          engineOutput.bundleResult.summaryText,
          engineOutput.bundleResult.primaryDrivers,
        ),
        modelLabel: 'rule-engine-v1',
      },
    })

    for (const itemResult of engineOutput.itemResults) {
      const latestItemAnalysis = await tx.renewalCaseItemAnalysis.findFirst({
        where: { renewalCaseItemId: itemResult.itemId },
        orderBy: { analysisVersion: 'desc' },
        select: { analysisVersion: true },
      })

      const nextItemAnalysisVersion = (latestItemAnalysis?.analysisVersion ?? 0) + 1

      await tx.renewalCaseItem.update({
        where: { id: itemResult.itemId },
        data: {
          recommendedDisposition: itemResult.recommendedDisposition,
          recommendedDiscountPercent: itemResult.recommendedDiscountPercent,
          proposedQuantity: itemResult.proposedQuantity,
          proposedNetUnitPrice: itemResult.proposedNetUnitPrice,
          proposedArr: itemResult.proposedArr,
          itemRiskScore: itemResult.riskScore,
          itemRiskLevel: itemResult.riskLevel,
          analysisSummary: buildItemAnalysisSummary(itemResult),
        },
      })

      await tx.renewalCaseItemAnalysis.create({
        data: {
          id: makeId('rcia'),
          renewalCaseItemId: itemResult.itemId,
          analysisVersion: nextItemAnalysisVersion,
          riskScore: itemResult.riskScore,
          riskLevel: itemResult.riskLevel,
          recommendedDisposition: itemResult.recommendedDisposition,
          recommendedDiscountPercent: itemResult.recommendedDiscountPercent,
          priceGuardrailResult: itemResult.guardrailResult,
          driverSummaryJson: JSON.stringify(itemResult.drivers),
          rationaleText: buildItemAnalysisSummary(itemResult),
        },
      })

      await tx.recommendationNarrative.create({
        data: {
          id: makeId('rn'),
          scopeType: 'ITEM',
          renewalCaseItemId: itemResult.itemId,
          narrativeType: 'RATIONALE',
          content: buildItemAnalysisSummary(itemResult),
          modelLabel: 'rule-engine-v1',
        },
      })
    }
  })

  return engineOutput
}
