import { Prisma } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateQuoteScenariosForRenewalCase } from '../lib/db/quote-scenarios'
import { prisma } from '../lib/prisma'
import { saveRuntimeSettings } from '../lib/settings/runtime-settings'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const seedDataDir = path.join(__dirname, 'seed-data')

type JsonRecord = Record<string, unknown>

function readJsonFile<T>(filename: string): T {
  const fullPath = path.join(seedDataDir, filename)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  return JSON.parse(raw) as T
}

function optionalReadJsonFile<T>(filename: string): T | null {
  const fullPath = path.join(seedDataDir, filename)
  if (!fs.existsSync(fullPath)) return null
  const raw = fs.readFileSync(fullPath, 'utf-8')
  return JSON.parse(raw) as T
}

function asDate(value: unknown): Date | null | undefined {
  if (value === null) return null
  if (value === undefined || value === '') return undefined
  return new Date(String(value))
}

function asString(value: unknown): string | null | undefined {
  if (value === null) return null
  if (value === undefined) return undefined
  return String(value)
}

function asBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined
  return Boolean(value)
}

function asInt(value: unknown): number | null | undefined {
  if (value === null) return null
  if (value === undefined || value === '') return undefined
  return Number.parseInt(String(value), 10)
}

function asDecimal(value: unknown): Prisma.Decimal | null | undefined {
  if (value === null) return null
  if (value === undefined || value === '') return undefined
  return new Prisma.Decimal(String(value))
}

async function main() {
  const products = readJsonFile<JsonRecord[]>('seed-products.json')
  const pricingPolicies = readJsonFile<JsonRecord[]>('seed-pricing-policies.json')
  const accounts = readJsonFile<JsonRecord[]>('seed-accounts.json')
  const subscriptions = readJsonFile<JsonRecord[]>('seed-subscriptions.json')
  const metricSnapshots = readJsonFile<JsonRecord[]>('seed-subscription-metric-snapshots.json')
  const renewalCases = readJsonFile<JsonRecord[]>('seed-renewal-cases.json')
  const renewalCaseItems = readJsonFile<JsonRecord[]>('seed-renewal-case-items.json')
  const renewalCaseAnalyses = readJsonFile<JsonRecord[]>('seed-renewal-case-analyses.json')
  const quoteDrafts = readJsonFile<JsonRecord[]>('seed-quote-drafts.json')
  const quoteDraftLines = readJsonFile<JsonRecord[]>('seed-quote-draft-lines.json')
  const reviewDecisions = readJsonFile<JsonRecord[]>('seed-review-decisions.json')
  const recommendationNarratives = readJsonFile<JsonRecord[]>('seed-recommendation-narratives.json')
  const renewalCaseItemAnalyses =
    optionalReadJsonFile<JsonRecord[]>('seed-renewal-case-item-analyses.json') ?? []
  const quoteInsights =
    optionalReadJsonFile<JsonRecord[]>('seed-quote-insights.json') ?? []

  const subscriptionById = new Map(
    subscriptions.map((subscription) => [String(subscription.id), subscription]),
  )
  const renewalCaseApprovalById = new Map(
    renewalCases.map((renewalCase) => [
      String(renewalCase.id),
      asBoolean(renewalCase.requiresApproval) ?? false,
    ]),
  )

  console.log('Clearing existing seed data...')

  await prisma.$transaction([
    prisma.scenarioQuoteLine.deleteMany(),
    prisma.scenarioQuote.deleteMany(),
    prisma.quoteScenario.deleteMany(),
    prisma.quoteInsight.deleteMany(),
    prisma.quoteDraftLine.deleteMany(),
    prisma.reviewDecision.deleteMany(),
    prisma.recommendationNarrative.deleteMany(),
    prisma.renewalCaseItemAnalysis.deleteMany(),
    prisma.renewalCaseAnalysis.deleteMany(),
    prisma.quoteDraft.deleteMany(),
    prisma.renewalCaseItem.deleteMany(),
    prisma.renewalCase.deleteMany(),
    prisma.subscriptionMetricSnapshot.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.pricingPolicy.deleteMany(),
    prisma.product.deleteMany(),
    prisma.account.deleteMany(),
  ])

  console.log('Loading base reference data...')

  await prisma.account.createMany({
    data: accounts.map((row) => ({
      id: String(row.id),
      accountNumber: String(row.accountNumber),
      name: String(row.name),
      segment: String(row.segment),
      industry: asString(row.industry),
      region: asString(row.region),
      billingCurrency: asString(row.billingCurrency) ?? 'USD',
      csmName: asString(row.csmName),
      accountExecutiveName: asString(row.accountExecutiveName),
      healthScore: asInt(row.healthScore),
      npsBand: asString(row.npsBand),
      openEscalationCount: asInt(row.openEscalationCount) ?? 0,
    })),
  })

  await prisma.product.createMany({
    data: products.map((row) => ({
      id: String(row.id),
      sku: String(row.sku),
      name: String(row.name),
      productFamily: String(row.productFamily),
      chargeModel: String(row.chargeModel),
      isActive: asBoolean(row.isActive) ?? true,
    })),
  })

  await prisma.pricingPolicy.createMany({
    data: pricingPolicies.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      accountSegment: asString(row.accountSegment),
      productFamily: asString(row.productFamily),
      maxAutoDiscountPercent: asDecimal(row.maxAutoDiscountPercent)!,
      approvalDiscountPercent: asDecimal(row.approvalDiscountPercent)!,
      floorPricePercentOfList: asDecimal(row.floorPricePercentOfList)!,
      expansionThresholdUsagePercent: asDecimal(row.expansionThresholdUsagePercent),
      requiresEscalationIfSev1Count: asInt(row.requiresEscalationIfSev1Count),
      isActive: asBoolean(row.isActive) ?? true,
    })),
  })

  console.log('Loading subscriptions and signal snapshots...')

  await prisma.subscription.createMany({
    data: subscriptions.map((row) => ({
      id: String(row.id),
      subscriptionNumber: String(row.subscriptionNumber),
      accountId: String(row.accountId),
      productId: String(row.productId),
      status: String(row.status),
      termStartDate: asDate(row.termStartDate)!,
      termEndDate: asDate(row.termEndDate)!,
      renewalDate: asDate(row.renewalDate)!,
      billingFrequency: asString(row.billingFrequency),
      quantity: asInt(row.quantity)!,
      listUnitPrice: asDecimal(row.listUnitPrice ?? row.listPrice)!,
      netUnitPrice: asDecimal(row.netUnitPrice ?? row.unitPrice)!,
      discountPercent: asDecimal(row.discountPercent)!,
      netAmount: asDecimal(row.netAmount)!,
      arr: asDecimal(row.arr)!,
      autoRenewFlag: asBoolean(row.autoRenewFlag) ?? false,
      cancellationNoticeDate: asDate(row.cancellationNoticeDate),
      lastAmendmentDate: asDate(row.lastAmendmentDate),
    })),
  })

  await prisma.subscriptionMetricSnapshot.createMany({
    data: metricSnapshots.map((row) => ({
      id: String(row.id),
      subscriptionId: String(row.subscriptionId),
      snapshotDate: asDate(row.snapshotDate)!,
      usagePercentOfEntitlement: asDecimal(row.usagePercentOfEntitlement),
      activeUserPercent: asDecimal(row.activeUserPercent),
      loginTrend30d: asDecimal(row.loginTrend30d),
      ticketCount90d: asInt(row.ticketCount90d),
      sev1Count90d: asInt(row.sev1Count90d),
      csatScore: asDecimal(row.csatScore),
      paymentRiskBand: asString(row.paymentRiskBand),
      adoptionBand: asString(row.adoptionBand),
      notes: asString(row.notes),
    })),
  })

  console.log('Loading renewal bundles...')

  await prisma.renewalCase.createMany({
    data: renewalCases.map((row) => ({
      id: String(row.id),
      caseNumber: String(row.caseNumber),
      accountId: String(row.accountId),
      status: String(row.status),
      bundleStrategy: String(row.bundleStrategy),
      evaluationDate: asDate(row.evaluationDate)!,
      windowStartDate: asDate(row.windowStartDate)!,
      windowEndDate: asDate(row.windowEndDate)!,
      recommendedAction: asString(row.recommendedAction),
      riskScore: asInt(row.riskScore),
      riskLevel: asString(row.riskLevel),
      bundleCurrentArr: asDecimal(row.bundleCurrentArr),
      bundleProposedArr: asDecimal(row.bundleProposedArr),
      bundleDeltaArr: asDecimal(row.bundleDeltaArr),
      requiresApproval: asBoolean(row.requiresApproval) ?? false,
      approvalReason: asString(row.approvalReason),
      ownerUserName: asString(row.ownerUserName),
      reviewerUserName: asString(row.reviewerUserName),
      approvedAt: asDate(row.approvedAt),
      rejectedAt: asDate(row.rejectedAt),
    })),
  })

  await prisma.renewalCaseItem.createMany({
    data: renewalCaseItems.map((row) => {
      const subscription = subscriptionById.get(String(row.subscriptionId))
      if (!subscription) {
        throw new Error(
          `Missing subscription for RenewalCaseItem ${String(row.id)} -> ${String(
            row.subscriptionId,
          )}`,
        )
      }

      return {
        id: String(row.id),
        renewalCaseId: String(row.renewalCaseId),
        subscriptionId: String(row.subscriptionId),
        itemStatus: String(row.itemStatus),
        includedInBundle: asBoolean(row.includedInBundle) ?? true,
        productNameSnapshot: String(row.productNameSnapshot),
        subscriptionNumberSnapshot: String(row.subscriptionNumberSnapshot),
        renewalDate: asDate(row.renewalDate)!,
        currentQuantity: asInt(row.currentQuantity)!,
        currentListUnitPrice: asDecimal(
          (subscription as JsonRecord).listUnitPrice ?? (subscription as JsonRecord).listPrice,
        )!,
        currentNetUnitPrice: asDecimal(row.currentNetUnitPrice ?? row.currentUnitPrice)!,
        currentArr: asDecimal(row.currentArr)!,
        recommendedDisposition: asString(row.recommendedDisposition),
        recommendedDiscountPercent: asDecimal(row.recommendedDiscountPercent),
        proposedQuantity: asInt(row.proposedQuantity),
        proposedNetUnitPrice: asDecimal(row.proposedNetUnitPrice ?? row.proposedUnitPrice),
        proposedArr: asDecimal(row.proposedArr),
        itemRiskScore: asInt(row.itemRiskScore),
        itemRiskLevel: asString(row.itemRiskLevel),
        analysisSummary: asString(row.analysisSummary),
        sortOrder: asInt(row.sortOrder),
      }
    }),
  })

  await prisma.renewalCaseAnalysis.createMany({
    data: renewalCaseAnalyses.map((row) => ({
      id: String(row.id),
      renewalCaseId: String(row.renewalCaseId),
      analysisVersion: asInt(row.analysisVersion) ?? 1,
      riskScore: asInt(row.riskScore),
      riskLevel: asString(row.riskLevel),
      recommendedAction: asString(row.recommendedAction),
      pricingPosture: asString(row.pricingPosture),
      approvalRequired: asBoolean(row.approvalRequired) ?? false,
      primaryDriversJson: asString(row.primaryDriversJson),
      bundleSummaryText: asString(row.bundleSummaryText),
      generatedBy: asString(row.generatedBy) ?? 'HYBRID',
      createdAt: asDate(row.createdAt) ?? new Date(),
    })),
  })

  if (renewalCaseItemAnalyses.length > 0) {
    await prisma.renewalCaseItemAnalysis.createMany({
      data: renewalCaseItemAnalyses.map((row) => ({
        id: String(row.id),
        renewalCaseItemId: String(row.renewalCaseItemId),
        analysisVersion: asInt(row.analysisVersion) ?? 1,
        riskScore: asInt(row.riskScore),
        riskLevel: asString(row.riskLevel),
        recommendedDisposition: asString(row.recommendedDisposition),
        recommendedDiscountPercent: asDecimal(row.recommendedDiscountPercent),
        priceGuardrailResult: asString(row.priceGuardrailResult),
        driverSummaryJson: asString(row.driverSummaryJson),
        rationaleText: asString(row.rationaleText),
        createdAt: asDate(row.createdAt) ?? new Date(),
      })),
    })
  }

  await prisma.recommendationNarrative.createMany({
    data: recommendationNarratives.map((row) => ({
      id: String(row.id),
      scopeType: String(row.scopeType),
      renewalCaseId: asString(row.renewalCaseId),
      renewalCaseItemId: asString(row.renewalCaseItemId),
      narrativeType: String(row.narrativeType),
      content: String(row.content),
      modelLabel: asString(row.modelLabel),
      createdAt: asDate(row.createdAt) ?? new Date(),
    })),
  })

  await prisma.reviewDecision.createMany({
    data: reviewDecisions.map((row) => ({
      id: String(row.id),
      renewalCaseId: String(row.renewalCaseId),
      decision: String(row.decision),
      reviewerName: asString(row.reviewerName),
      comment: asString(row.comment),
      createdAt: asDate(row.createdAt) ?? new Date(),
    })),
  })

  await prisma.quoteDraft.createMany({
    data: quoteDrafts.map((row) => ({
      id: String(row.id),
      renewalCaseId: String(row.renewalCaseId),
      quoteNumber: String(row.quoteNumber),
      status: String(row.status),
      currencyCode: asString(row.currencyCode) ?? 'USD',
      effectiveDate: asDate(row.effectiveDate),
      expirationDate: asDate(row.expirationDate),
      totalListAmount: asDecimal(row.totalListAmount),
      totalNetAmount: asDecimal(row.totalNetAmount),
      totalDiscountPercent: asDecimal(row.totalDiscountPercent),
      approvalRequired:
        renewalCaseApprovalById.get(String(row.renewalCaseId)) ??
        (asBoolean(row.approvalRequired) ?? false),
      generatedBy: asString(row.generatedBy),
    })),
  })

  await prisma.quoteDraftLine.createMany({
    data: quoteDraftLines.map((row) => ({
      id: String(row.id),
      quoteDraftId: String(row.quoteDraftId),
      renewalCaseItemId: asString(row.renewalCaseItemId),
      lineNumber: asInt(row.lineNumber)!,
      productSku: String(row.productSku),
      productName: String(row.productName),
      chargeType: asString(row.chargeType),
      quantity: asInt(row.quantity)!,
      listUnitPrice: asDecimal(row.listUnitPrice)!,
      netUnitPrice: asDecimal(row.netUnitPrice)!,
      discountPercent: asDecimal(row.discountPercent),
      lineNetAmount: asDecimal(row.lineNetAmount)!,
      disposition: asString(row.disposition),
      comment: asString(row.comment),
      sourceType: asString(row.sourceType),
      sourceInsightType: asString(row.sourceInsightType),
      sourceQuoteInsightId: asString(row.sourceQuoteInsightId),
      insightSummary: asString(row.insightSummary),
      aiExplanation: asString(row.aiExplanation),
      createdAt: asDate(row.createdAt) ?? new Date(),
      updatedAt: asDate(row.updatedAt) ?? new Date(),
    })),
  })

  if (quoteInsights.length > 0) {
    await prisma.quoteInsight.createMany({
      data: quoteInsights.map((row) => ({
        id: String(row.id),
        renewalCaseId: String(row.renewalCaseId),
        sourceType: String(row.sourceType),
        insightType: String(row.insightType),
        status: String(row.status),
        productId: String(row.productId),
        productSkuSnapshot: String(row.productSkuSnapshot),
        productNameSnapshot: String(row.productNameSnapshot),
        productFamilySnapshot: String(row.productFamilySnapshot),
        title: String(row.title),
        insightSummary: String(row.insightSummary),
        recommendedActionSummary: asString(row.recommendedActionSummary),
        confidenceScore: asInt(row.confidenceScore),
        fitScore: asInt(row.fitScore),
        recommendedQuantity: asInt(row.recommendedQuantity),
        recommendedUnitPrice: asDecimal(row.recommendedUnitPrice),
        recommendedDiscountPercent: asDecimal(row.recommendedDiscountPercent),
        estimatedArrImpact: asDecimal(row.estimatedArrImpact),
        justificationJson: asString(row.justificationJson),
        addedQuoteDraftId: asString(row.addedQuoteDraftId),
        addedQuoteDraftLineId: asString(row.addedQuoteDraftLineId),
        dismissedReason: asString(row.dismissedReason),
        createdAt: asDate(row.createdAt) ?? new Date(),
        updatedAt: asDate(row.updatedAt) ?? new Date(),
      })),
    })
  }

  console.log('Materializing read-only scenario quotes...')

  let materializedScenarioQuoteCount = 0
  for (const renewalCase of renewalCases) {
    const generated = await generateQuoteScenariosForRenewalCase(String(renewalCase.id))
    materializedScenarioQuoteCount += generated.generatedCount
  }

  saveRuntimeSettings({ mlRecommendationMode: 'HYBRID_RULES_ML' })

  const [
    accountCount,
    subscriptionCount,
    renewalCaseCount,
    quoteDraftCount,
    quoteInsightCount,
    scenarioQuoteCount,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.subscription.count(),
    prisma.renewalCase.count(),
    prisma.quoteDraft.count(),
    prisma.quoteInsight.count(),
    prisma.scenarioQuote.count(),
  ])

  console.log('Seed complete.')
  console.log({
    accountCount,
    subscriptionCount,
    renewalCaseCount,
    quoteDraftCount,
    quoteInsightCount,
    scenarioQuoteCount,
    materializedScenarioQuoteCount,
  })
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
