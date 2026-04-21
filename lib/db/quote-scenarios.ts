import { Prisma, QuoteInsight } from '@prisma/client'
import { formatCurrency } from '@/lib/format/currency'
import { formatPercent } from '@/lib/format/percent'
import { prisma } from '@/lib/prisma'

type StrategyType =
  | 'UPSELL_EXPANSION'
  | 'RIGHT_SIZING'
  | 'MARGIN_PROTECTION'
  | 'RETENTION_OFFER'
  | 'BUNDLE_OPTIMIZATION'

type ScenarioCandidate = {
  strategyType: StrategyType
  title: string
  summary: string
  insights: QuoteInsight[]
  confidenceScore: number
  expectedArrImpact: number
  expectedMarginImpact: number
  expectedRiskReduction: number
  rankingScore: number
}

type BaselineLine = {
  id: string
  lineNumber: number
  productSku: string
  productName: string
  chargeType: string | null
  quantity: number
  listUnitPrice: Prisma.Decimal
  netUnitPrice: Prisma.Decimal
  discountPercent: Prisma.Decimal | null
  lineNetAmount: Prisma.Decimal
  sourceType: string | null
  sourceInsightType: string | null
  sourceQuoteInsightId: string | null
  insightSummary: string | null
}

type MutableScenarioLine = {
  sourceQuoteDraftLineId: string | null
  sourceQuoteInsightId: string | null
  lineNumber: number
  productSku: string
  productName: string
  chargeType: string | null
  quantity: number
  listUnitPrice: Prisma.Decimal
  netUnitPrice: Prisma.Decimal
  discountPercent: Prisma.Decimal | null
  lineNetAmount: Prisma.Decimal
  sourceType: string | null
  sourceInsightType: string | null
  insightSummary: string | null
}

export type QuoteScenarioWorkspaceView = {
  caseId: string
  currencyCode: string
  needsRefresh: boolean
  generatedAtLabel: string | null
  preferredScenarioKey: string | null
  lastRunSummary: {
    generatedAt: string | null
    generatedCount: number
    suppressedReason: string | null
  } | null
  baselineQuote: {
    quoteDraftId: string
    quoteNumber: string
    lineCount: number
    totalNetAmount: number
    totalDiscountPercent: number
    totalListAmountFormatted: string
    totalNetAmountFormatted: string
    totalDiscountPercentFormatted: string
    lines: Array<{
      lineNumber: number
      productSku: string
      productName: string
      quantity: number
      netUnitPrice: number
      discountPercent: number
      lineNetAmount: number
      netUnitPriceFormatted: string
      discountPercentFormatted: string
      lineNetAmountFormatted: string
    }>
  } | null
  scenarios: Array<{
    id: string
    scenarioKey: string
    rank: number
    strategyType: string
    strategyLabel: string
    title: string
    summary: string
    confidenceScore: number | null
    expectedArrImpact: number | null
    expectedArrImpactFormatted: string | null
    expectedMarginImpact: number | null
    expectedMarginImpactFormatted: string | null
    expectedRiskReduction: number | null
    rankingScore: number | null
    sourceInsightCount: number
    quote: {
      lineCount: number
      totalNetAmount: number
      totalDiscountPercent: number
      totalNetAmountFormatted: string
      totalDiscountPercentFormatted: string
      lines: Array<{
        lineNumber: number
        productSku: string
        productName: string
        quantity: number
        netUnitPrice: number
        discountPercent: number
        lineNetAmount: number
        sourceType: string | null
        sourceInsightType: string | null
        sourceQuoteInsightId: string | null
        netUnitPriceFormatted: string
        discountPercentFormatted: string
        lineNetAmountFormatted: string
      }>
    } | null
  }>
}

const ADDITIVE_INSIGHT_TYPES = new Set([
  'EXPANSION',
  'CROSS_SELL',
  'HYBRID_DEPLOYMENT_FIT',
  'DATA_MODERNIZATION',
])

const STRATEGY_PRIORITY: StrategyType[] = [
  'UPSELL_EXPANSION',
  'MARGIN_PROTECTION',
  'RETENTION_OFFER',
  'RIGHT_SIZING',
  'BUNDLE_OPTIMIZATION',
]

const STRATEGY_TITLE: Record<StrategyType, string> = {
  UPSELL_EXPANSION: 'Capture expansion upside with additive options',
  RIGHT_SIZING: 'Align entitlement to current adoption reality',
  MARGIN_PROTECTION: 'Improve renewal margin with pricing discipline',
  RETENTION_OFFER: 'Protect renewal probability with controlled concessions',
  BUNDLE_OPTIMIZATION: 'Balance growth, retention, and margin as a bundle',
}

const STRATEGY_MARGIN_DELTA: Record<StrategyType, number> = {
  UPSELL_EXPANSION: 1.8,
  RIGHT_SIZING: 0.7,
  MARGIN_PROTECTION: 2.6,
  RETENTION_OFFER: -1.2,
  BUNDLE_OPTIMIZATION: 1.3,
}

const STRATEGY_RISK_REDUCTION: Record<StrategyType, number> = {
  UPSELL_EXPANSION: 6,
  RIGHT_SIZING: 12,
  MARGIN_PROTECTION: 8,
  RETENTION_OFFER: 18,
  BUNDLE_OPTIMIZATION: 10,
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function decimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0)
  }
  return new Prisma.Decimal(value)
}

function numberOrNull(value: Prisma.Decimal | null | undefined) {
  if (value == null) return null
  return Number(value)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.round(parsed)
}

function titleizeToken(value: string | null | undefined) {
  if (!value) return 'Unknown'
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function keyForLine(line: { productSku: string; lineNumber: number }) {
  return `${line.productSku}::${line.lineNumber}`
}

function hasMaterialDelta(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) > tolerance
}

function computeListUnitPrice(netUnitPrice: Prisma.Decimal, discountPercent: Prisma.Decimal) {
  if (discountPercent.gt(0) && discountPercent.lt(100)) {
    return netUnitPrice
      .div(new Prisma.Decimal(1).minus(discountPercent.div(100)))
      .toDecimalPlaces(2)
  }

  return netUnitPrice
}

function isAdditiveInsight(insightType: string) {
  return ADDITIVE_INSIGHT_TYPES.has(insightType)
}

function strategyForInsight(insight: QuoteInsight): StrategyType {
  if (isAdditiveInsight(insight.insightType)) {
    return 'UPSELL_EXPANSION'
  }

  switch (insight.insightType) {
    case 'MARGIN_RECOVERY':
    case 'CONTROLLED_UPLIFT':
      return 'MARGIN_PROTECTION'
    case 'CONCESSION':
    case 'DEFENSIVE_RENEWAL':
      return 'RETENTION_OFFER'
    case 'UPLIFT_RESTRAINT':
      return 'RIGHT_SIZING'
    case 'RENEW_AS_IS':
      return numberOrNull(insight.estimatedArrImpact) != null &&
        (numberOrNull(insight.estimatedArrImpact) ?? 0) < 0
        ? 'RIGHT_SIZING'
        : 'BUNDLE_OPTIMIZATION'
    default:
      return 'BUNDLE_OPTIMIZATION'
  }
}

function detectConflictingInsights(insights: QuoteInsight[]) {
  const byProduct = new Map<string, Set<string>>()

  for (const insight of insights) {
    const key = insight.productSkuSnapshot || insight.productNameSnapshot
    const existing = byProduct.get(key) ?? new Set<string>()
    const bucket =
      insight.insightType === 'MARGIN_RECOVERY' || insight.insightType === 'CONTROLLED_UPLIFT'
        ? 'MARGIN'
        : insight.insightType === 'CONCESSION' ||
            insight.insightType === 'DEFENSIVE_RENEWAL' ||
            insight.insightType === 'UPLIFT_RESTRAINT'
          ? 'RETENTION'
          : 'OTHER'

    existing.add(bucket)
    byProduct.set(key, existing)
  }

  return Array.from(byProduct.values()).some(
    (buckets) => buckets.has('MARGIN') && buckets.has('RETENTION'),
  )
}

function sortedInsights(insights: QuoteInsight[]) {
  return [...insights].sort((a, b) => {
    const impactDelta =
      Math.abs(numberOrNull(b.estimatedArrImpact) ?? 0) -
      Math.abs(numberOrNull(a.estimatedArrImpact) ?? 0)
    if (impactDelta !== 0) return impactDelta

    const fitDelta = (b.fitScore ?? 0) - (a.fitScore ?? 0)
    if (fitDelta !== 0) return fitDelta

    const confidenceDelta = (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0)
    if (confidenceDelta !== 0) return confidenceDelta

    return a.id.localeCompare(b.id)
  })
}

function summarizeScenario(strategyType: StrategyType, selectedInsights: QuoteInsight[]) {
  const products = selectedInsights
    .map((item) => item.productNameSnapshot)
    .filter(Boolean)
    .slice(0, 3)
  const productText = products.length > 0 ? products.join(', ') : 'the renewal bundle'

  switch (strategyType) {
    case 'UPSELL_EXPANSION':
      return `Applies additive and expansion-focused actions across ${productText}.`
    case 'RIGHT_SIZING':
      return `Rebalances quantity and entitlement posture for ${productText}.`
    case 'MARGIN_PROTECTION':
      return `Targets stronger pricing posture while maintaining renewal momentum for ${productText}.`
    case 'RETENTION_OFFER':
      return `Uses controlled concession posture to de-risk retention on ${productText}.`
    case 'BUNDLE_OPTIMIZATION':
    default:
      return `Combines top signals into a balanced bundle option spanning ${productText}.`
  }
}

function rankingScoreForCandidate(candidate: Omit<ScenarioCandidate, 'rankingScore'>) {
  const arrComponent = candidate.expectedArrImpact / 5000
  const marginComponent = candidate.expectedMarginImpact * 8
  const riskComponent = candidate.expectedRiskReduction * 1.6
  const confidenceComponent = candidate.confidenceScore * 0.45

  return round2(arrComponent + marginComponent + riskComponent + confidenceComponent)
}

function buildScenarioCandidates(insights: QuoteInsight[]) {
  const groupedByStrategy = new Map<StrategyType, QuoteInsight[]>()

  for (const insight of sortedInsights(insights)) {
    const strategyType = strategyForInsight(insight)
    const bucket = groupedByStrategy.get(strategyType) ?? []
    bucket.push(insight)
    groupedByStrategy.set(strategyType, bucket)
  }

  const candidates: ScenarioCandidate[] = []

  for (const strategyType of STRATEGY_PRIORITY) {
    if (strategyType === 'BUNDLE_OPTIMIZATION') continue

    const bucket = groupedByStrategy.get(strategyType) ?? []
    if (bucket.length === 0) continue

    const selectedInsights = sortedInsights(bucket).slice(0, 3)
    const confidenceScore = toInt(
      selectedInsights.reduce((sum, item) => sum + (item.confidenceScore ?? 65), 0) /
        Math.max(selectedInsights.length, 1),
      65,
    )
    const expectedArrImpact = round2(
      selectedInsights.reduce((sum, item) => sum + (numberOrNull(item.estimatedArrImpact) ?? 0), 0),
    )

    if (Math.abs(expectedArrImpact) < 500 && confidenceScore < 65) {
      continue
    }

    const candidateBase = {
      strategyType,
      title: STRATEGY_TITLE[strategyType],
      summary: summarizeScenario(strategyType, selectedInsights),
      insights: selectedInsights,
      confidenceScore,
      expectedArrImpact,
      expectedMarginImpact: STRATEGY_MARGIN_DELTA[strategyType],
      expectedRiskReduction: STRATEGY_RISK_REDUCTION[strategyType],
    }

    candidates.push({
      ...candidateBase,
      rankingScore: rankingScoreForCandidate(candidateBase),
    })
  }

  if (candidates.length >= 2) {
    const bundledInsights = sortedInsights(
      candidates.flatMap((candidate) => candidate.insights.slice(0, 1)),
    ).slice(0, 3)

    const bundleBase = {
      strategyType: 'BUNDLE_OPTIMIZATION' as const,
      title: STRATEGY_TITLE.BUNDLE_OPTIMIZATION,
      summary: summarizeScenario('BUNDLE_OPTIMIZATION', bundledInsights),
      insights: bundledInsights,
      confidenceScore: toInt(
        bundledInsights.reduce((sum, item) => sum + (item.confidenceScore ?? 65), 0) /
          Math.max(bundledInsights.length, 1),
        65,
      ),
      expectedArrImpact: round2(
        bundledInsights.reduce(
          (sum, item) => sum + (numberOrNull(item.estimatedArrImpact) ?? 0),
          0,
        ),
      ),
      expectedMarginImpact: STRATEGY_MARGIN_DELTA.BUNDLE_OPTIMIZATION,
      expectedRiskReduction: STRATEGY_RISK_REDUCTION.BUNDLE_OPTIMIZATION,
    }

    candidates.push({
      ...bundleBase,
      rankingScore: rankingScoreForCandidate(bundleBase),
    })
  }

  return candidates
    .sort((a, b) => {
      const scoreDelta = b.rankingScore - a.rankingScore
      if (scoreDelta !== 0) return scoreDelta

      return STRATEGY_PRIORITY.indexOf(a.strategyType) - STRATEGY_PRIORITY.indexOf(b.strategyType)
    })
    .slice(0, 4)
}

function applyInsightToScenarioLines(lines: MutableScenarioLine[], insight: QuoteInsight) {
  const quantity = insight.recommendedQuantity ?? 1
  const netUnitPrice = decimal(insight.recommendedUnitPrice)
  const discountPercent =
    insight.recommendedDiscountPercent != null ? decimal(insight.recommendedDiscountPercent) : null

  if (isAdditiveInsight(insight.insightType)) {
    const existingLine = lines.find((line) => line.productSku === insight.productSkuSnapshot)
    if (existingLine) return

    const effectiveDiscount = discountPercent ?? new Prisma.Decimal(0)
    const listUnitPrice = computeListUnitPrice(netUnitPrice, effectiveDiscount)
    const lineNetAmount = netUnitPrice.mul(quantity).toDecimalPlaces(2)
    const nextLineNumber =
      lines.length > 0 ? Math.max(...lines.map((line) => line.lineNumber)) + 1 : 1

    lines.push({
      sourceQuoteDraftLineId: null,
      sourceQuoteInsightId: insight.id,
      lineNumber: nextLineNumber,
      productSku: insight.productSkuSnapshot,
      productName: insight.productNameSnapshot,
      chargeType: null,
      quantity,
      listUnitPrice,
      netUnitPrice,
      discountPercent: effectiveDiscount,
      lineNetAmount,
      sourceType: 'SCENARIO_INSIGHT',
      sourceInsightType: insight.insightType,
      insightSummary: insight.insightSummary,
    })

    return
  }

  const line = lines.find(
    (candidate) =>
      candidate.productSku === insight.productSkuSnapshot ||
      candidate.productName === insight.productNameSnapshot,
  )

  if (!line) return

  const effectiveNetUnitPrice =
    insight.recommendedUnitPrice != null ? decimal(insight.recommendedUnitPrice) : line.netUnitPrice
  const effectiveDiscountPercent =
    insight.recommendedDiscountPercent != null
      ? decimal(insight.recommendedDiscountPercent)
      : (line.discountPercent ?? new Prisma.Decimal(0))

  line.quantity = insight.recommendedQuantity ?? line.quantity
  line.netUnitPrice = effectiveNetUnitPrice
  line.discountPercent = effectiveDiscountPercent
  line.listUnitPrice = computeListUnitPrice(effectiveNetUnitPrice, effectiveDiscountPercent)
  line.lineNetAmount = effectiveNetUnitPrice.mul(line.quantity).toDecimalPlaces(2)
  line.sourceType = 'SCENARIO_INSIGHT'
  line.sourceInsightType = insight.insightType
  line.sourceQuoteInsightId = insight.id
  line.insightSummary = insight.insightSummary
}

function computeScenarioTotals(lines: MutableScenarioLine[]) {
  const totalListAmount = lines
    .reduce((sum, line) => sum.add(decimal(line.listUnitPrice).mul(line.quantity)), new Prisma.Decimal(0))
    .toDecimalPlaces(2)
  const totalNetAmount = lines
    .reduce((sum, line) => sum.add(decimal(line.lineNetAmount)), new Prisma.Decimal(0))
    .toDecimalPlaces(2)
  const totalDiscountPercent = totalListAmount.gt(0)
    ? totalListAmount.minus(totalNetAmount).div(totalListAmount).mul(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0)

  return {
    totalListAmount,
    totalNetAmount,
    totalDiscountPercent,
  }
}

function computeChangedLineCount(baselineLines: BaselineLine[], scenarioLines: MutableScenarioLine[]) {
  const baselineMap = new Map(baselineLines.map((line) => [keyForLine(line), line]))
  const scenarioMap = new Map(scenarioLines.map((line) => [keyForLine(line), line]))
  const keys = new Set([...baselineMap.keys(), ...scenarioMap.keys()])

  let changed = 0

  for (const key of keys) {
    const baselineLine = baselineMap.get(key) ?? null
    const scenarioLine = scenarioMap.get(key) ?? null

    if (!baselineLine || !scenarioLine) {
      changed += 1
      continue
    }

    if (
      baselineLine.quantity !== scenarioLine.quantity ||
      hasMaterialDelta(Number(baselineLine.netUnitPrice), Number(scenarioLine.netUnitPrice)) ||
      hasMaterialDelta(
        Number(baselineLine.discountPercent ?? 0),
        Number(scenarioLine.discountPercent ?? 0),
      ) ||
      hasMaterialDelta(Number(baselineLine.lineNetAmount), Number(scenarioLine.lineNetAmount))
    ) {
      changed += 1
    }
  }

  return changed
}

export async function generateQuoteScenariosForRenewalCase(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      preferredQuoteScenarioKey: true,
      quoteDraft: {
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
          },
        },
      },
      quoteInsights: {
        where: {
          status: 'SUGGESTED',
        },
      },
    },
  })

  if (!renewalCase) {
    throw new Error(`Renewal case ${caseId} not found.`)
  }

  if (!renewalCase.quoteDraft) {
    throw new Error('No baseline quote draft is linked to this renewal case.')
  }
  const baselineQuote = renewalCase.quoteDraft

  const sortedSuggestedInsights = sortedInsights(renewalCase.quoteInsights)
  const now = new Date()
  const generatedAtIso = now.toISOString()

  let suppressedReason: string | null = null

  if (sortedSuggestedInsights.length === 0) {
    suppressedReason = 'No meaningful signals were found for scenario generation.'
  } else if (detectConflictingInsights(sortedSuggestedInsights)) {
    suppressedReason = 'Conflicting insights detected across the same product lines.'
  } else {
    const topImpact = Math.max(
      ...sortedSuggestedInsights.map((item) => Math.abs(numberOrNull(item.estimatedArrImpact) ?? 0)),
    )
    const hasStrongConfidence = sortedSuggestedInsights.some((item) => (item.confidenceScore ?? 0) >= 70)

    if (topImpact < 1000 && !hasStrongConfidence) {
      suppressedReason = 'Signal changes are negligible relative to baseline quote impact.'
    }
  }

  if (suppressedReason) {
    await prisma.$transaction(async (tx) => {
      await tx.quoteScenario.deleteMany({
        where: {
          renewalCaseId: caseId,
        },
      })

      await tx.renewalCase.update({
        where: { id: caseId },
        data: {
          quoteScenariosNeedRefresh: false,
          quoteScenariosGeneratedAt: now,
          preferredQuoteScenarioKey: null,
          lastQuoteScenarioRunJson: JSON.stringify({
            generatedAt: generatedAtIso,
            generatedCount: 0,
            suppressedReason,
          }),
        },
      })
    })

    return {
      caseId,
      generatedCount: 0,
      suppressedReason,
      scenarioKeys: [] as string[],
    }
  }

  const baselineLines: BaselineLine[] = baselineQuote.lines.map((line) => ({
    id: line.id,
    lineNumber: line.lineNumber,
    productSku: line.productSku,
    productName: line.productName,
    chargeType: line.chargeType,
    quantity: line.quantity,
    listUnitPrice: decimal(line.listUnitPrice),
    netUnitPrice: decimal(line.netUnitPrice),
    discountPercent: line.discountPercent != null ? decimal(line.discountPercent) : null,
    lineNetAmount: decimal(line.lineNetAmount),
    sourceType: line.sourceType,
    sourceInsightType: line.sourceInsightType,
    sourceQuoteInsightId: line.sourceQuoteInsightId,
    insightSummary: line.insightSummary,
  }))

  const candidates = buildScenarioCandidates(sortedSuggestedInsights)
  const materializedCandidates = candidates
    .map((candidate) => {
      const scenarioLines: MutableScenarioLine[] = baselineLines.map((line) => ({
        sourceQuoteDraftLineId: line.id,
        sourceQuoteInsightId: line.sourceQuoteInsightId,
        lineNumber: line.lineNumber,
        productSku: line.productSku,
        productName: line.productName,
        chargeType: line.chargeType,
        quantity: line.quantity,
        listUnitPrice: line.listUnitPrice,
        netUnitPrice: line.netUnitPrice,
        discountPercent: line.discountPercent,
        lineNetAmount: line.lineNetAmount,
        sourceType: line.sourceType,
        sourceInsightType: line.sourceInsightType,
        insightSummary: line.insightSummary,
      }))

      for (const insight of sortedInsights(candidate.insights)) {
        applyInsightToScenarioLines(scenarioLines, insight)
      }

      const totals = computeScenarioTotals(scenarioLines)
      const changedLineCount = computeChangedLineCount(baselineLines, scenarioLines)

      return {
        ...candidate,
        scenarioLines,
        totals,
        changedLineCount,
      }
    })
    .filter((candidate) => candidate.changedLineCount > 0)

  if (materializedCandidates.length === 0) {
    suppressedReason = 'Generated scenarios matched baseline quote with no commercial changes.'
  }

  if (suppressedReason) {
    await prisma.$transaction(async (tx) => {
      await tx.quoteScenario.deleteMany({
        where: {
          renewalCaseId: caseId,
        },
      })

      await tx.renewalCase.update({
        where: { id: caseId },
        data: {
          quoteScenariosNeedRefresh: false,
          quoteScenariosGeneratedAt: now,
          preferredQuoteScenarioKey: null,
          lastQuoteScenarioRunJson: JSON.stringify({
            generatedAt: generatedAtIso,
            generatedCount: 0,
            suppressedReason,
          }),
        },
      })
    })

    return {
      caseId,
      generatedCount: 0,
      suppressedReason,
      scenarioKeys: [] as string[],
    }
  }

  const rankedCandidates = materializedCandidates.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    scenarioKey: `${candidate.strategyType}_${String(index + 1).padStart(2, '0')}`,
  }))
  const rankedScenarioKeys = rankedCandidates.map((candidate) => candidate.scenarioKey)
  const preferredQuoteScenarioKey =
    renewalCase.preferredQuoteScenarioKey &&
    rankedScenarioKeys.includes(renewalCase.preferredQuoteScenarioKey)
      ? renewalCase.preferredQuoteScenarioKey
      : (rankedScenarioKeys[0] ?? null)

  await prisma.$transaction(async (tx) => {
    await tx.quoteScenario.deleteMany({
      where: {
        renewalCaseId: caseId,
      },
    })

    for (const candidate of rankedCandidates) {
      const scenarioId = makeId('qscn')
      const scenarioQuoteId = makeId('sq')

      await tx.quoteScenario.create({
        data: {
          id: scenarioId,
          renewalCaseId: caseId,
          scenarioKey: candidate.scenarioKey,
          strategyType: candidate.strategyType,
          title: candidate.title,
          summary: candidate.summary,
          rank: candidate.rank,
          confidenceScore: candidate.confidenceScore,
          expectedArrImpact: new Prisma.Decimal(candidate.expectedArrImpact),
          expectedMarginImpact: new Prisma.Decimal(candidate.expectedMarginImpact),
          expectedRiskReduction: candidate.expectedRiskReduction,
          rankingScore: new Prisma.Decimal(candidate.rankingScore),
          sourceInsightIdsJson: JSON.stringify(candidate.insights.map((item) => item.id)),
          generatedBy: 'scenario-engine-v1',
          generatedAt: now,
          scenarioQuote: {
            create: {
              id: scenarioQuoteId,
              currencyCode: baselineQuote.currencyCode,
              totalListAmount: candidate.totals.totalListAmount,
              totalNetAmount: candidate.totals.totalNetAmount,
              totalDiscountPercent: candidate.totals.totalDiscountPercent,
              generatedBy: 'scenario-engine-v1',
              lines: {
                createMany: {
                  data: candidate.scenarioLines.map((line) => ({
                    id: makeId('sql'),
                    sourceQuoteDraftLineId: line.sourceQuoteDraftLineId,
                    sourceQuoteInsightId: line.sourceQuoteInsightId,
                    lineNumber: line.lineNumber,
                    productSku: line.productSku,
                    productName: line.productName,
                    chargeType: line.chargeType,
                    quantity: line.quantity,
                    listUnitPrice: line.listUnitPrice,
                    netUnitPrice: line.netUnitPrice,
                    discountPercent: line.discountPercent,
                    lineNetAmount: line.lineNetAmount,
                    sourceType: line.sourceType,
                    sourceInsightType: line.sourceInsightType,
                    insightSummary: line.insightSummary,
                  })),
                },
              },
            },
          },
        },
      })
    }

    await tx.renewalCase.update({
      where: { id: caseId },
      data: {
        quoteScenariosNeedRefresh: false,
        quoteScenariosGeneratedAt: now,
        preferredQuoteScenarioKey,
        lastQuoteScenarioRunJson: JSON.stringify({
          generatedAt: generatedAtIso,
          generatedCount: rankedCandidates.length,
          suppressedReason: null,
          scenarioKeys: rankedCandidates.map((item) => item.scenarioKey),
        }),
      },
    })
  })

  return {
    caseId,
    generatedCount: rankedCandidates.length,
    suppressedReason: null,
    scenarioKeys: rankedCandidates.map((item) => item.scenarioKey),
  }
}

export async function getQuoteScenarioWorkspaceByRenewalCaseId(
  caseId: string,
): Promise<QuoteScenarioWorkspaceView> {
  const row = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      quoteScenariosNeedRefresh: true,
      quoteScenariosGeneratedAt: true,
      preferredQuoteScenarioKey: true,
      lastQuoteScenarioRunJson: true,
      account: {
        select: {
          billingCurrency: true,
        },
      },
      quoteDraft: {
        select: {
          id: true,
          quoteNumber: true,
          currencyCode: true,
          lines: {
            orderBy: { lineNumber: 'asc' },
            select: {
              id: true,
              lineNumber: true,
              productSku: true,
              productName: true,
              netUnitPrice: true,
              discountPercent: true,
              lineNetAmount: true,
              listUnitPrice: true,
              quantity: true,
            },
          },
        },
      },
      quoteScenarios: {
        orderBy: [{ rank: 'asc' }, { generatedAt: 'desc' }],
        select: {
          id: true,
          scenarioKey: true,
          rank: true,
          strategyType: true,
          title: true,
          summary: true,
          confidenceScore: true,
          expectedArrImpact: true,
          expectedMarginImpact: true,
          expectedRiskReduction: true,
          rankingScore: true,
          generatedAt: true,
          sourceInsightIdsJson: true,
          scenarioQuote: {
            select: {
              totalNetAmount: true,
              totalDiscountPercent: true,
              lines: {
                orderBy: { lineNumber: 'asc' },
                select: {
                  id: true,
                  lineNumber: true,
                  productSku: true,
                  productName: true,
                  quantity: true,
                  netUnitPrice: true,
                  discountPercent: true,
                  lineNetAmount: true,
                  sourceType: true,
                  sourceInsightType: true,
                  sourceQuoteInsightId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!row) {
    return {
      caseId,
      currencyCode: 'USD',
      needsRefresh: false,
      generatedAtLabel: null,
      preferredScenarioKey: null,
      lastRunSummary: null,
      baselineQuote: null,
      scenarios: [],
    }
  }

  const currencyCode = row.quoteDraft?.currencyCode ?? row.account.billingCurrency ?? 'USD'
  const baselineLineCount = row.quoteDraft?.lines.length ?? 0
  const baselineListAmount = row.quoteDraft
    ? row.quoteDraft.lines.reduce(
        (sum, line) => sum.add(decimal(line.listUnitPrice).mul(line.quantity)),
        new Prisma.Decimal(0),
      )
    : new Prisma.Decimal(0)
  const baselineNetAmount = row.quoteDraft
    ? row.quoteDraft.lines.reduce((sum, line) => sum.add(decimal(line.lineNetAmount)), new Prisma.Decimal(0))
    : new Prisma.Decimal(0)
  const baselineDiscountPercent = baselineListAmount.gt(0)
    ? baselineListAmount.minus(baselineNetAmount).div(baselineListAmount).mul(100)
    : new Prisma.Decimal(0)

  const parsedRunSummary = (() => {
    if (!row.lastQuoteScenarioRunJson) return null
    try {
      const parsed = JSON.parse(row.lastQuoteScenarioRunJson) as {
        generatedAt?: string | null
        generatedCount?: number
        suppressedReason?: string | null
      }
      return {
        generatedAt: parsed.generatedAt ?? null,
        generatedCount: parsed.generatedCount ?? 0,
        suppressedReason: parsed.suppressedReason ?? null,
      }
    } catch {
      return null
    }
  })()

  const baselineLines = row.quoteDraft
    ? row.quoteDraft.lines.map((line) => {
        const netUnitPrice = Number(line.netUnitPrice ?? 0)
        const discountPercent = Number(line.discountPercent ?? 0)
        const lineNetAmount = Number(line.lineNetAmount ?? 0)

        return {
          lineNumber: line.lineNumber,
          productSku: line.productSku,
          productName: line.productName,
          quantity: line.quantity,
          netUnitPrice,
          discountPercent,
          lineNetAmount,
          netUnitPriceFormatted: formatCurrency(netUnitPrice, currencyCode),
          discountPercentFormatted: formatPercent(discountPercent),
          lineNetAmountFormatted: formatCurrency(lineNetAmount, currencyCode),
        }
      })
    : []

  const scenarioKeys = new Set(row.quoteScenarios.map((scenario) => scenario.scenarioKey))
  const preferredScenarioKey =
    row.preferredQuoteScenarioKey && scenarioKeys.has(row.preferredQuoteScenarioKey)
      ? row.preferredQuoteScenarioKey
      : null

  return {
    caseId: row.id,
    currencyCode,
    needsRefresh: row.quoteScenariosNeedRefresh,
    generatedAtLabel: formatDateTime(row.quoteScenariosGeneratedAt),
    preferredScenarioKey,
    lastRunSummary: parsedRunSummary,
    baselineQuote: row.quoteDraft
      ? {
          quoteDraftId: row.quoteDraft.id,
          quoteNumber: row.quoteDraft.quoteNumber,
          lineCount: baselineLineCount,
          totalNetAmount: Number(baselineNetAmount),
          totalDiscountPercent: Number(baselineDiscountPercent),
          totalListAmountFormatted: formatCurrency(Number(baselineListAmount), currencyCode),
          totalNetAmountFormatted: formatCurrency(Number(baselineNetAmount), currencyCode),
          totalDiscountPercentFormatted: formatPercent(Number(baselineDiscountPercent)),
          lines: baselineLines,
        }
      : null,
    scenarios: row.quoteScenarios.map((scenario) => {
      const sourceInsightIds = (() => {
        if (!scenario.sourceInsightIdsJson) return []
        try {
          const parsed = JSON.parse(scenario.sourceInsightIdsJson)
          return Array.isArray(parsed) ? parsed.map(String) : []
        } catch {
          return []
        }
      })()

      return {
        id: scenario.id,
        scenarioKey: scenario.scenarioKey,
        rank: scenario.rank,
        strategyType: scenario.strategyType,
        strategyLabel: titleizeToken(scenario.strategyType),
        title: scenario.title,
        summary: scenario.summary,
        confidenceScore: scenario.confidenceScore,
        expectedArrImpact:
          scenario.expectedArrImpact != null ? Number(scenario.expectedArrImpact) : null,
        expectedArrImpactFormatted:
          scenario.expectedArrImpact != null
            ? formatCurrency(Number(scenario.expectedArrImpact), currencyCode)
            : null,
        expectedMarginImpact:
          scenario.expectedMarginImpact != null ? Number(scenario.expectedMarginImpact) : null,
        expectedMarginImpactFormatted:
          scenario.expectedMarginImpact != null
            ? `${Number(scenario.expectedMarginImpact) >= 0 ? '+' : ''}${Number(
                scenario.expectedMarginImpact,
              ).toFixed(1)} pts`
            : null,
        expectedRiskReduction: scenario.expectedRiskReduction,
        rankingScore: scenario.rankingScore != null ? Number(scenario.rankingScore) : null,
        quote: scenario.scenarioQuote
          ? {
              lineCount: scenario.scenarioQuote.lines.length,
              totalNetAmount: Number(scenario.scenarioQuote.totalNetAmount ?? 0),
              totalDiscountPercent: Number(scenario.scenarioQuote.totalDiscountPercent ?? 0),
              totalNetAmountFormatted: formatCurrency(
                Number(scenario.scenarioQuote.totalNetAmount ?? 0),
                currencyCode,
              ),
              totalDiscountPercentFormatted: formatPercent(
                Number(scenario.scenarioQuote.totalDiscountPercent ?? 0),
              ),
              lines: scenario.scenarioQuote.lines.map((line) => {
                const netUnitPrice = Number(line.netUnitPrice ?? 0)
                const discountPercent = Number(line.discountPercent ?? 0)
                const lineNetAmount = Number(line.lineNetAmount ?? 0)

                return {
                  lineNumber: line.lineNumber,
                  productSku: line.productSku,
                  productName: line.productName,
                  quantity: line.quantity,
                  netUnitPrice,
                  discountPercent,
                  lineNetAmount,
                  sourceType: line.sourceType,
                  sourceInsightType: line.sourceInsightType,
                  sourceQuoteInsightId: line.sourceQuoteInsightId,
                  netUnitPriceFormatted: formatCurrency(netUnitPrice, currencyCode),
                  discountPercentFormatted: formatPercent(discountPercent),
                  lineNetAmountFormatted: formatCurrency(lineNetAmount, currencyCode),
                }
              }),
            }
          : null,
        sourceInsightCount: sourceInsightIds.length,
      }
    }),
  }
}

export async function setPreferredQuoteScenarioForRenewalCase(
  caseId: string,
  scenarioKey: string | null,
) {
  if (!scenarioKey) {
    await prisma.renewalCase.update({
      where: { id: caseId },
      data: { preferredQuoteScenarioKey: null },
    })

    return {
      caseId,
      preferredScenarioKey: null,
    }
  }

  const scenario = await prisma.quoteScenario.findFirst({
    where: {
      renewalCaseId: caseId,
      scenarioKey,
    },
    select: {
      scenarioKey: true,
    },
  })

  if (!scenario) {
    throw new Error(`Scenario key "${scenarioKey}" is not available for this renewal case.`)
  }

  await prisma.renewalCase.update({
    where: { id: caseId },
    data: {
      preferredQuoteScenarioKey: scenario.scenarioKey,
    },
  })

  return {
    caseId,
    preferredScenarioKey: scenario.scenarioKey,
  }
}
