import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/date'
import { formatPercent } from '@/lib/format/percent'
import { labelize, toneForAction, toneForRisk, toneForStatus } from '@/lib/format/risk'
import { primaryQuoteTrack, storyLaneForAction } from '@/lib/workflow/story-lanes'
import {
  RenewalCaseDetailView,
  RenewalCaseListItem,
  RenewalSubscriptionBaselineListItem,
  RenewalCaseAnalysisView,
  RenewalCaseItemView,
  ReviewDecisionView,
  RecommendationNarrativeView,
  RecommendationChangeView,
  QuoteInsightChangeView,
} from '@/types/renewal-case'

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeRecommendationChange(
  value: RecommendationChangeView | null,
  fallbackScenarioKey: string,
): RecommendationChangeView | null {
  if (!value) return null

  return {
    scenarioKey: value.scenarioKey ?? fallbackScenarioKey,
    scenarioLabel: value.scenarioLabel ?? null,
    previous: {
      riskLevel: value.previous?.riskLevel ?? null,
      recommendedAction: value.previous?.recommendedAction ?? null,
      requiresApproval: value.previous?.requiresApproval ?? null,
    },
    next: {
      riskLevel: value.next?.riskLevel ?? null,
      recommendedAction: value.next?.recommendedAction ?? null,
      requiresApproval: value.next?.requiresApproval ?? null,
    },
    driverChanges: Array.isArray(value.driverChanges) ? value.driverChanges : [],
    recalculatedAt: value.recalculatedAt ?? null,
  }
}

function normalizeInsightChange(
  value: QuoteInsightChangeView | null,
  fallbackScenarioKey: string,
): QuoteInsightChangeView | null {
  if (!value) return null

  return {
    added: Array.isArray(value.added) ? value.added : [],
    removed: Array.isArray(value.removed) ? value.removed : [],
    modified: Array.isArray(value.modified) ? value.modified : [],
    regeneratedAt: value.regeneratedAt ?? null,
    scenarioKey: value.scenarioKey ?? fallbackScenarioKey,
    decisionRunId: value.decisionRunId ?? null,
    engineVersion: value.engineVersion ?? null,
    policyVersion: value.policyVersion ?? null,
    scenarioVersion: value.scenarioVersion ?? null,
  }
}

function windowLabel(start: Date, end: Date) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return null

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function sumLineNetAmounts(lines: Array<{ lineNetAmount: unknown }> | null | undefined): number {
  if (!Array.isArray(lines)) return 0

  return lines.reduce((sum, line) => sum + Number(line.lineNetAmount ?? 0), 0)
}

export async function getRenewalCases(): Promise<RenewalCaseListItem[]> {
  const rows = await prisma.renewalCase.findMany({
    include: {
      account: true,
      items: { select: { id: true } },
      quoteDraft: {
        select: {
          id: true,
          quoteNumber: true,
          lines: {
            select: {
              lineNetAmount: true,
            },
          },
        },
      },
    },
    orderBy: [{ riskScore: 'desc' }, { caseNumber: 'asc' }],
  })

  return rows.map((row) => {
    const lane = storyLaneForAction(row.recommendedAction)
    const quoteTrack = primaryQuoteTrack()
    const proposedArrFromQuote = row.quoteDraft
      ? sumLineNetAmounts(row.quoteDraft.lines)
      : null
    const proposedArr = proposedArrFromQuote ?? Number(row.bundleProposedArr ?? 0)

    return {
      id: row.id,
      caseNumber: row.caseNumber,
      accountName: row.account.name,
      segment: labelize(row.account.segment),
      windowLabel: windowLabel(row.windowStartDate, row.windowEndDate),
      recommendedActionKey: row.recommendedAction ?? 'UNKNOWN',
      recommendedActionLabel: labelize(row.recommendedAction),
      actionTone: toneForAction(row.recommendedAction),
      storyLaneId: lane.id,
      storyLaneLabel: lane.label,
      storyLaneDescription: lane.description,
      storyLaneOrder: lane.order,
      riskLevel: labelize(row.riskLevel),
      riskTone: toneForRisk(row.riskLevel),
      bundleCurrentArrFormatted: formatCurrency(Number(row.bundleCurrentArr ?? 0), row.account.billingCurrency),
      bundleProposedArrFormatted: formatCurrency(proposedArr, row.account.billingCurrency),
      requiresApproval: row.requiresApproval,
      statusLabel: labelize(row.status),
      statusTone: toneForStatus(row.status),
      itemCount: row.items.length,
      quoteDraftId: row.quoteDraft?.id ?? null,
      quoteNumber: row.quoteDraft?.quoteNumber ?? null,
      quoteTrackLabel: quoteTrack.label,
      quoteTrackDescription: quoteTrack.description,
    }
  })
}

export async function getRenewalSubscriptionBaselines(): Promise<RenewalSubscriptionBaselineListItem[]> {
  const rows = await prisma.renewalCaseItem.findMany({
    where: {
      includedInBundle: true,
    },
    include: {
      renewalCase: {
        include: {
          account: true,
        },
      },
    },
    orderBy: [
      { renewalDate: 'asc' },
      { subscriptionNumberSnapshot: 'asc' },
    ],
  })

  return rows.map((row) => ({
    id: row.id,
    caseId: row.renewalCaseId,
    caseNumber: row.renewalCase.caseNumber,
    accountName: row.renewalCase.account.name,
    segment: labelize(row.renewalCase.account.segment),
    subscriptionNumber: row.subscriptionNumberSnapshot,
    productName: row.productNameSnapshot,
    renewalDate: formatDate(row.renewalDate),
    quantity: row.currentQuantity,
    netUnitPriceFormatted: formatCurrency(
      Number(row.currentNetUnitPrice),
      row.renewalCase.account.billingCurrency,
    ),
    baselineArrFormatted: formatCurrency(
      Number(row.currentArr),
      row.renewalCase.account.billingCurrency,
    ),
    renewalWindowLabel: windowLabel(
      row.renewalCase.windowStartDate,
      row.renewalCase.windowEndDate,
    ),
  }))
}

export async function getRenewalCaseById(caseId: string): Promise<RenewalCaseDetailView | null> {
  const row = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    include: {
      account: true,
      items: {
        orderBy: { sortOrder: 'asc' },
      },
      analyses: {
        orderBy: { analysisVersion: 'desc' },
        take: 1,
      },
      narratives: {
        orderBy: { createdAt: 'desc' },
      },
      reviewDecisions: {
        orderBy: { createdAt: 'desc' },
      },
      quoteDraft: {
        include: {
          lines: {
            select: {
              lineNetAmount: true,
            },
          },
        },
      },
    },
  })

  if (!row) return null

  const analysisRow = row.analyses[0]
  const analysis: RenewalCaseAnalysisView | null = analysisRow
    ? {
        recommendedActionLabel: labelize(analysisRow.recommendedAction),
        actionTone: toneForAction(analysisRow.recommendedAction),
        riskLevel: labelize(analysisRow.riskLevel),
        riskTone: toneForRisk(analysisRow.riskLevel),
        pricingPostureLabel: labelize(analysisRow.pricingPosture),
        approvalRequired: analysisRow.approvalRequired,
        primaryDrivers: parseJsonArray(analysisRow.primaryDriversJson),
        bundleSummaryText: analysisRow.bundleSummaryText,
      }
    : null

  const latestNarrative = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'RATIONALE',
    ) ?? null
  )

  const latestExecutiveSummary = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'EXECUTIVE_SUMMARY',
    ) ?? null
  )

  const latestApprovalBrief = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'APPROVAL_BRIEF',
    ) ?? null
  )

  const narrative: RecommendationNarrativeView | null = latestNarrative
    ? {
        content: latestNarrative.content,
        modelLabel: latestNarrative.modelLabel ?? 'Unknown model',
      }
    : null

  const aiExecutiveSummary: RecommendationNarrativeView | null = latestExecutiveSummary
    ? {
        content: latestExecutiveSummary.content,
        modelLabel: latestExecutiveSummary.modelLabel ?? 'Unknown model',
      }
    : null

  const aiApprovalBrief: RecommendationNarrativeView | null = latestApprovalBrief
    ? {
        content: latestApprovalBrief.content,
        modelLabel: latestApprovalBrief.modelLabel ?? 'Unknown model',
      }
    : null

  const reviewHistory: ReviewDecisionView[] = row.reviewDecisions.map((decision) => ({
    id: decision.id,
    decisionLabel: labelize(decision.decision),
    decisionTone: toneForStatus(decision.decision),
    reviewerName: decision.reviewerName ?? 'Unknown reviewer',
    comment: decision.comment,
    createdAt: formatDate(decision.createdAt),
  }))

  const items: RenewalCaseItemView[] = row.items.map((item) => ({
    id: item.id,
    productName: item.productNameSnapshot,
    subscriptionNumber: item.subscriptionNumberSnapshot,
    renewalDate: formatDate(item.renewalDate),
    currentArrFormatted: formatCurrency(Number(item.currentArr), row.account.billingCurrency),
    proposedArrFormatted: formatCurrency(Number(item.proposedArr), row.account.billingCurrency),
    dispositionLabel: labelize(item.recommendedDisposition),
    dispositionTone: toneForAction(item.recommendedDisposition),
    discountPercentFormatted: formatPercent(Number(item.recommendedDiscountPercent)),
    riskLevel: labelize(item.itemRiskLevel),
    riskTone: toneForRisk(item.itemRiskLevel),
    analysisSummary: item.analysisSummary ?? 'No item analysis summary available.',
  }))

  const quoteDraftRow = row.quoteDraft
  const baselineArr = Number(row.bundleCurrentArr ?? 0)
  const proposedArrFromQuote = quoteDraftRow
    ? sumLineNetAmounts(quoteDraftRow.lines)
    : null
  const proposedArr = proposedArrFromQuote ?? Number(row.bundleProposedArr ?? 0)
  const deltaArr = proposedArr - baselineArr
  const demoScenarioKey = row.demoScenarioKey ?? 'BASE_CASE'
  const recommendationChange = normalizeRecommendationChange(
    parseJsonObject<RecommendationChangeView>(row.lastRecommendationJson),
    demoScenarioKey,
  )
  const insightChange = normalizeInsightChange(
    parseJsonObject<QuoteInsightChangeView>(row.lastInsightDiffJson),
    demoScenarioKey,
  )

  const recalculationMeta = {
    analysisVersion: analysisRow?.analysisVersion ?? null,
    generatedBy: analysisRow?.generatedBy ?? null,
    updatedAtLabel: formatDateTime(analysisRow?.createdAt),
    approvalRequired: analysisRow?.approvalRequired ?? row.requiresApproval ?? false,
    drivers: analysisRow ? parseJsonArray(analysisRow.primaryDriversJson) : [],
  }

  return {
    id: row.id,
    caseNumber: row.caseNumber,
    windowLabel: windowLabel(row.windowStartDate, row.windowEndDate),
    demoScenarioKey,
    account: {
      name: row.account.name,
      industry: row.account.industry,
      segment: labelize(row.account.segment),
    },
    accountCurrencyCode: row.account.billingCurrency,
    recommendedActionLabel: labelize(row.recommendedAction),
    actionTone: toneForAction(row.recommendedAction),
    riskLevel: labelize(row.riskLevel),
    riskTone: toneForRisk(row.riskLevel),
    summaryCards: [
      {
        label: 'Baseline ARR (Subscription)',
        value: formatCurrency(baselineArr, row.account.billingCurrency),
        helperText: 'Sourced from subscription products in the renewal bundle.',
      },
      {
        label: 'Proposed ARR (Recommendation + Quote Insight)',
        value: formatCurrency(proposedArr, row.account.billingCurrency),
        helperText: 'AI workflow output after recommendation and quote insight updates.',
      },
      {
        label: 'ARR Delta vs Baseline',
        value: formatCurrency(deltaArr, row.account.billingCurrency),
        helperText: 'Difference between proposed ARR and the subscription baseline.',
      },
      { label: 'Included Subscriptions', value: String(row.items.length) },
      { label: 'Approval Required', value: row.requiresApproval ? 'Yes' : 'No', helperText: row.approvalReason ?? undefined },
      { label: 'Open Escalations', value: String(row.account.openEscalationCount) },
    ],
    analysis,
    recalculationMeta,
    items,
    narrative,
    aiExecutiveSummary,
    aiApprovalBrief,
    reviewHistory,
    whatChanged: {
      recommendation: recommendationChange,
      insights: insightChange,
    },
    quoteDraft: quoteDraftRow
      ? {
          id: quoteDraftRow.id,
          quoteNumber: quoteDraftRow.quoteNumber,
          status: labelize(quoteDraftRow.status),
          totalNetAmountFormatted: formatCurrency(
            proposedArrFromQuote ?? Number(quoteDraftRow.totalNetAmount ?? 0),
            row.account.billingCurrency,
          ),
        }
      : null,
  }
}
