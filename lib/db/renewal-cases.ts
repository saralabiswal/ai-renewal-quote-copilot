import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/date'
import { formatPercent } from '@/lib/format/percent'
import { labelize, toneForAction, toneForRisk, toneForStatus } from '@/lib/format/risk'
import { baselineQuoteTrack, storyLaneForAction } from '@/lib/workflow/story-lanes'
import {
  RenewalCaseDetailView,
  RenewalCaseListItem,
  RenewalSubscriptionBaselineListItem,
  RenewalCaseAnalysisView,
  RenewalCaseItemView,
  DecisionRunTraceView,
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
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
    ruleBaseline: value.ruleBaseline ?? null,
    ml: value.ml
      ? {
          mode: value.ml.mode ?? 'RULES_ONLY',
          status: value.ml.status ?? 'DISABLED',
          affectsRecommendation: Boolean(value.ml.affectsRecommendation),
          modelName: value.ml.modelName ?? null,
          modelVersion: value.ml.modelVersion ?? null,
          bundleRiskScore:
            value.ml.bundleRiskScore == null ? null : Number(value.ml.bundleRiskScore),
          error: value.ml.error ?? null,
          itemPredictions: Array.isArray(value.ml.itemPredictions)
            ? value.ml.itemPredictions.map((item) => ({
                itemId: String(item.itemId ?? ''),
                riskScore: item.riskScore == null ? null : Number(item.riskScore),
                riskProbability:
                  item.riskProbability == null ? null : Number(item.riskProbability),
                expansionScore:
                  item.expansionScore == null ? null : Number(item.expansionScore),
                expansionProbability:
                  item.expansionProbability == null ? null : Number(item.expansionProbability),
                topFeatures: Array.isArray(item.topFeatures) ? item.topFeatures.map(String) : [],
              }))
            : [],
        }
      : null,
    driverChanges: Array.isArray(value.driverChanges) ? value.driverChanges : [],
    decisionRunId: value.decisionRunId ?? null,
    recalculatedAt: value.recalculatedAt ?? null,
  }
}

function normalizeDecisionRun(row: {
  id: string
  runType: string
  mode: string
  status: string
  scenarioKey: string | null
  createdAt: Date
  ruleEngineVersion: string | null
  policyVersion: string | null
  featureSchemaVersion: string | null
  mlMode: string | null
  mlModelName: string | null
  mlModelVersion: string | null
  ruleInputJson: string | null
  featureSnapshotJson: string | null
  ruleOutputJson: string | null
  mlOutputJson: string | null
  finalOutputJson: string | null
  guardrailSummaryJson: string | null
}): DecisionRunTraceView {
  const ruleInput = asRecord(parseJsonObject<unknown>(row.ruleInputJson))
  const featureSnapshot = asRecord(parseJsonObject<unknown>(row.featureSnapshotJson))
  const ruleInputAccount = asRecord(ruleInput?.account)
  const ruleInputItems = Array.isArray(ruleInput?.items) ? ruleInput.items : []
  const featureSnapshotItems = Array.isArray(featureSnapshot?.items) ? featureSnapshot.items : []
  const ruleOutput = asRecord(parseJsonObject<unknown>(row.ruleOutputJson))
  const mlOutput = asRecord(parseJsonObject<unknown>(row.mlOutputJson))
  const finalOutput = asRecord(parseJsonObject<unknown>(row.finalOutputJson))
  const guardrailSummary = asRecord(parseJsonObject<unknown>(row.guardrailSummaryJson))
  const guardrailResults = Array.isArray(guardrailSummary?.guardrailResults)
    ? guardrailSummary.guardrailResults.map(String)
    : []
  const itemPredictions = Array.isArray(mlOutput?.itemPredictions)
    ? mlOutput.itemPredictions
    : []

  return {
    id: row.id,
    runType: labelize(row.runType),
    mode: labelize(row.mode),
    status: labelize(row.status),
    scenarioKey: row.scenarioKey,
    createdAt: formatDateTime(row.createdAt) ?? formatDate(row.createdAt),
    ruleEngineVersion: row.ruleEngineVersion,
    policyVersion: row.policyVersion,
    featureSchemaVersion: row.featureSchemaVersion,
    mlMode: row.mlMode,
    mlModelName: row.mlModelName,
    mlModelVersion: row.mlModelVersion,
    ruleInputSummary: ruleInput
      ? {
          itemCount: ruleInputItems.length,
          accountSegment:
            typeof ruleInputAccount?.segment === 'string' ? ruleInputAccount.segment : null,
        }
      : null,
    featureSnapshotSummary: featureSnapshot
      ? {
          featureSchemaVersion:
            typeof featureSnapshot.featureSchemaVersion === 'string'
              ? featureSnapshot.featureSchemaVersion
              : null,
          itemCount: featureSnapshotItems.length,
          generatedAt:
            typeof featureSnapshot.generatedAt === 'string' ? featureSnapshot.generatedAt : null,
        }
      : null,
    ruleOutputSummary: ruleOutput
      ? {
          riskScore: nullableNumber(ruleOutput.riskScore),
          riskLevel: typeof ruleOutput.riskLevel === 'string' ? ruleOutput.riskLevel : null,
          recommendedAction:
            typeof ruleOutput.recommendedAction === 'string' ? ruleOutput.recommendedAction : null,
          approvalRequired: nullableBoolean(ruleOutput.approvalRequired),
        }
      : null,
    mlOutputSummary: mlOutput
      ? {
          status: typeof mlOutput.status === 'string' ? mlOutput.status : null,
          mode: typeof mlOutput.mode === 'string' ? mlOutput.mode : row.mlMode,
          modelName:
            typeof mlOutput.modelName === 'string' ? mlOutput.modelName : row.mlModelName,
          modelVersion:
            typeof mlOutput.modelVersion === 'string'
              ? mlOutput.modelVersion
              : row.mlModelVersion,
          generatedAt:
            typeof mlOutput.generatedAt === 'string' ? mlOutput.generatedAt : null,
          bundleRiskScore: nullableNumber(mlOutput.bundleRiskScore),
          itemPredictionCount: itemPredictions.length,
          error: typeof mlOutput.error === 'string' ? mlOutput.error : null,
          itemPredictions: itemPredictions.map((item) => {
            const record = asRecord(item)
            return {
              itemId: typeof record?.itemId === 'string' ? record.itemId : '—',
              riskScore: nullableNumber(record?.riskScore),
              riskProbability: nullableNumber(record?.riskProbability),
              expansionScore: nullableNumber(record?.expansionScore),
              expansionProbability: nullableNumber(record?.expansionProbability),
              topFeatures: Array.isArray(record?.topFeatures)
                ? record.topFeatures.map(String)
                : [],
            }
          }),
        }
      : null,
    finalOutputSummary: finalOutput
      ? {
          riskScore: nullableNumber(finalOutput.riskScore),
          riskLevel: typeof finalOutput.riskLevel === 'string' ? finalOutput.riskLevel : null,
          recommendedAction:
            typeof finalOutput.recommendedAction === 'string'
              ? finalOutput.recommendedAction
              : null,
          approvalRequired: nullableBoolean(finalOutput.approvalRequired),
        }
      : null,
    guardrailSummary: guardrailSummary
      ? {
          approvalRequiredCount: nullableNumber(guardrailSummary.approvalRequiredCount) ?? 0,
          guardrailResults,
        }
      : null,
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

function narrativeView(
  row: { content: string; modelLabel: string | null } | null | undefined,
): RecommendationNarrativeView | null {
  if (!row) return null
  return {
    content: row.content,
    modelLabel: row.modelLabel ?? 'Unknown model',
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
      items: { select: { id: true, currentArr: true } },
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
      quoteScenarios: {
        select: {
          scenarioQuote: {
            select: {
              id: true,
            },
          },
        },
      },
      decisionRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          mode: true,
          mlMode: true,
          mlModelName: true,
          mlModelVersion: true,
          mlOutputJson: true,
        },
      },
    },
    orderBy: [{ riskScore: 'desc' }, { caseNumber: 'asc' }],
  })

  return rows.map((row) => {
    const lane = storyLaneForAction(row.recommendedAction)
    const quoteTrack = baselineQuoteTrack()
    const baselineArr = row.items.reduce((sum, item) => sum + Number(item.currentArr ?? 0), 0)
    const proposedArrFromQuote = row.quoteDraft
      ? sumLineNetAmounts(row.quoteDraft.lines)
      : null
    const proposedArr = proposedArrFromQuote ?? Number(row.bundleProposedArr ?? 0)
    const latestRun = row.decisionRuns[0]
    const latestMlOutput = asRecord(parseJsonObject<unknown>(latestRun?.mlOutputJson))
    const latestMlStatus = typeof latestMlOutput?.status === 'string' ? latestMlOutput.status : null
    const latestMlAffectsRecommendation =
      latestRun?.mode === 'HYBRID_RULES_ML' && latestMlStatus === 'OK'

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
      bundleCurrentArrFormatted: formatCurrency(baselineArr, row.account.billingCurrency),
      bundleProposedArrFormatted: formatCurrency(proposedArr, row.account.billingCurrency),
      requiresApproval: row.requiresApproval,
      statusLabel: labelize(row.status),
      statusTone: toneForStatus(row.status),
      itemCount: row.items.length,
      quoteDraftId: row.quoteDraft?.id ?? null,
      quoteNumber: row.quoteDraft?.quoteNumber ?? null,
      scenarioQuoteCount: row.quoteScenarios.filter((scenario) => scenario.scenarioQuote).length,
      quoteScenariosNeedRefresh: row.quoteScenariosNeedRefresh,
      quoteTrackLabel: quoteTrack.label,
      quoteTrackDescription: quoteTrack.description,
      latestDecisionRunMode: latestRun?.mode ?? null,
      latestDecisionRunMlMode: latestRun?.mlMode ?? null,
      latestDecisionRunMlStatus: latestMlStatus,
      latestDecisionRunMlAffectsRecommendation: latestMlOutput ? latestMlAffectsRecommendation : null,
      latestDecisionRunMlModelName: latestRun?.mlModelName ?? null,
      latestDecisionRunMlModelVersion: latestRun?.mlModelVersion ?? null,
      latestDecisionRunMlBundleRiskScore: nullableNumber(latestMlOutput?.bundleRiskScore),
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
        include: {
          subscription: {
            select: {
              metricSnapshots: {
                orderBy: {
                  snapshotDate: 'desc',
                },
                take: 1,
                select: {
                  usagePercentOfEntitlement: true,
                  activeUserPercent: true,
                  loginTrend30d: true,
                  ticketCount90d: true,
                  sev1Count90d: true,
                  csatScore: true,
                  paymentRiskBand: true,
                  adoptionBand: true,
                  notes: true,
                },
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
      decisionRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!row) return null

  const analysisRow = row.analyses[0]
  const latestDecisionRun = row.decisionRuns[0]
    ? normalizeDecisionRun(row.decisionRuns[0])
    : null
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

  const latestReasoningRecommendation = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'REASONING_RECOMMENDATION',
    ) ?? null
  )

  const latestReasoningDecisionTrace = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'REASONING_DECISION_TRACE',
    ) ?? null
  )

  const latestReasoningApproval = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'REASONING_APPROVAL',
    ) ?? null
  )

  const latestReasoningWhatChanged = (
    row.narratives.find(
      (n) => n.scopeType === 'CASE' && n.narrativeType === 'REASONING_WHAT_CHANGED',
    ) ?? null
  )

  const narrative = narrativeView(latestNarrative)
  const aiExecutiveSummary = narrativeView(latestExecutiveSummary)
  const aiApprovalBrief = narrativeView(latestApprovalBrief)
  const reasoningRecommendation = narrativeView(latestReasoningRecommendation)
  const reasoningDecisionTrace = narrativeView(latestReasoningDecisionTrace)
  const reasoningApproval = narrativeView(latestReasoningApproval)
  const reasoningWhatChanged = narrativeView(latestReasoningWhatChanged)

  const reviewHistory: ReviewDecisionView[] = row.reviewDecisions.map((decision) => ({
    id: decision.id,
    decisionLabel: labelize(decision.decision),
    decisionTone: toneForStatus(decision.decision),
    reviewerName: decision.reviewerName ?? 'Unknown reviewer',
    comment: decision.comment,
    createdAt: formatDate(decision.createdAt),
  }))

  const items: RenewalCaseItemView[] = row.items.map((item) => {
    const metric = item.subscription.metricSnapshots[0]
    const currentArr = Number(item.currentArr ?? 0)
    const proposedArr = Number(item.proposedArr ?? item.currentArr ?? 0)
    const arrDelta = proposedArr - currentArr
    const recommendedDiscountPercent =
      item.recommendedDiscountPercent != null
        ? Number(item.recommendedDiscountPercent)
        : null

    return {
      id: item.id,
      productName: item.productNameSnapshot,
      subscriptionNumber: item.subscriptionNumberSnapshot,
      renewalDate: formatDate(item.renewalDate),
      currentArrFormatted: formatCurrency(currentArr, row.account.billingCurrency),
      proposedArrFormatted: formatCurrency(proposedArr, row.account.billingCurrency),
      arrDeltaFormatted: formatCurrency(arrDelta, row.account.billingCurrency),
      dispositionLabel: labelize(item.recommendedDisposition),
      dispositionTone: toneForAction(item.recommendedDisposition),
      discountPercentFormatted:
        recommendedDiscountPercent != null
          ? formatPercent(recommendedDiscountPercent)
          : '—',
      recommendedDiscountPercent,
      itemRiskScore: item.itemRiskScore ?? null,
      riskLevel: labelize(item.itemRiskLevel),
      riskTone: toneForRisk(item.itemRiskLevel),
      usagePercentOfEntitlement:
        metric?.usagePercentOfEntitlement != null
          ? Number(metric.usagePercentOfEntitlement)
          : null,
      activeUserPercent:
        metric?.activeUserPercent != null ? Number(metric.activeUserPercent) : null,
      loginTrend30d: metric?.loginTrend30d != null ? Number(metric.loginTrend30d) : null,
      ticketCount90d: metric?.ticketCount90d ?? null,
      sev1Count90d: metric?.sev1Count90d ?? null,
      csatScore: metric?.csatScore != null ? Number(metric.csatScore) : null,
      paymentRiskBand: metric?.paymentRiskBand ?? null,
      adoptionBand: metric?.adoptionBand ?? null,
      signalNotes: metric?.notes ?? null,
      analysisSummary: item.analysisSummary ?? 'No item analysis summary available.',
    }
  })

  const quoteDraftRow = row.quoteDraft
  const baselineArr = row.items.reduce((sum, item) => sum + Number(item.currentArr ?? 0), 0)
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
    ml: recommendationChange?.ml ?? null,
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
    latestDecisionRun,
    items,
    narrative,
    aiExecutiveSummary,
    aiApprovalBrief,
    reasoningRecommendation,
    reasoningDecisionTrace,
    reasoningApproval,
    reasoningWhatChanged,
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
