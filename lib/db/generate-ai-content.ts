import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { generateApprovalBrief } from '@/lib/ai/generate-approval-brief'
import { generateCaseExecutiveSummary } from '@/lib/ai/generate-case-executive-summary'
import { generateCaseRationale } from '@/lib/ai/generate-case-rationale'
import { generateQuoteInsightRationale } from '@/lib/ai/generate-quote-insight-rationale'

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

type QuoteInsightNarrativeSource = {
  id: string
  title: string
  insightType: string
  productNameSnapshot: string
  insightSummary: string
  recommendedActionSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  reasonCodes: string[]
  structuredReasoning: string[]
  whatChangedSummary: string | null
  expectedImpactSummary: string | null
}

const CASE_NARRATIVE_TYPES = ['EXECUTIVE_SUMMARY', 'RATIONALE', 'APPROVAL_BRIEF'] as const

function quoteInsightNarrativeType(quoteInsightId: string) {
  return `QUOTE_INSIGHT_${quoteInsightId}`
}

function parseNarrativeContextFromJustification(raw: string | null | undefined) {
  if (!raw) {
    return {
      reasonCodes: [] as string[],
      structuredReasoning: [] as string[],
      whatChangedSummary: null as string | null,
      expectedImpactSummary: null as string | null,
    }
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const reasonCodes = Array.isArray(parsed.reasonCodes)
      ? parsed.reasonCodes.map((item) => String(item)).filter(Boolean)
      : []
    const structuredReasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning.map((item) => String(item)).filter(Boolean)
      : []

    let expectedImpactSummary: string | null = null
    if (parsed.expectedImpact && typeof parsed.expectedImpact === 'object') {
      const impact = parsed.expectedImpact as Record<string, unknown>
      const arrDelta =
        impact.arrDelta != null && Number.isFinite(Number(impact.arrDelta))
          ? Number(impact.arrDelta)
          : null
      const marginDirection =
        typeof impact.marginDirection === 'string' ? impact.marginDirection : 'UNKNOWN'
      const retentionRisk =
        typeof impact.retentionRisk === 'string' ? impact.retentionRisk : 'UNKNOWN'
      if (arrDelta != null) {
        expectedImpactSummary = `Estimated ARR delta ${arrDelta >= 0 ? '+' : ''}${arrDelta}; margin direction ${marginDirection.toLowerCase()}; retention risk ${retentionRisk.toLowerCase()}.`
      }
    }

    let whatChangedSummary: string | null = null
    if (parsed.changeLog && typeof parsed.changeLog === 'object') {
      const changeLog = parsed.changeLog as Record<string, unknown>
      const changedFields = Array.isArray(changeLog.changedFields)
        ? changeLog.changedFields.map((item) => String(item)).filter(Boolean)
        : []
      const fromSummary = typeof changeLog.fromSummary === 'string' ? changeLog.fromSummary : null
      const toSummary = typeof changeLog.toSummary === 'string' ? changeLog.toSummary : null
      if (changedFields.length > 0 || fromSummary || toSummary) {
        whatChangedSummary = fromSummary
          ? `Changed fields: ${changedFields.join(', ') || 'summary'}. Previous: ${fromSummary}. Current: ${toSummary ?? 'N/A'}.`
          : `New insight added in the latest regeneration. Current: ${toSummary ?? 'N/A'}.`
      }
    }

    return {
      reasonCodes,
      structuredReasoning,
      whatChangedSummary,
      expectedImpactSummary,
    }
  } catch {
    return {
      reasonCodes: [] as string[],
      structuredReasoning: [] as string[],
      whatChangedSummary: null as string | null,
      expectedImpactSummary: null as string | null,
    }
  }
}

async function createQuoteInsightNarratives(
  renewalCaseId: string,
  accountName: string,
  quoteInsights: QuoteInsightNarrativeSource[],
) {
  await prisma.recommendationNarrative.deleteMany({
    where: {
      scopeType: 'CASE',
      renewalCaseId,
      narrativeType: {
        startsWith: 'QUOTE_INSIGHT_',
      },
    },
  })

  for (const quoteInsight of quoteInsights) {
    const quoteInsightNarrative = await generateQuoteInsightRationale({
      accountName,
      title: quoteInsight.title,
      insightType: quoteInsight.insightType,
      productName: quoteInsight.productNameSnapshot,
      insightSummary: quoteInsight.insightSummary,
      recommendedActionSummary: quoteInsight.recommendedActionSummary,
      confidenceScore: quoteInsight.confidenceScore,
      fitScore: quoteInsight.fitScore,
      reasonCodes: quoteInsight.reasonCodes,
      structuredReasoning: quoteInsight.structuredReasoning,
      whatChangedSummary: quoteInsight.whatChangedSummary,
      expectedImpactSummary: quoteInsight.expectedImpactSummary,
    })

    await prisma.recommendationNarrative.create({
      data: {
        id: makeId('rn'),
        scopeType: 'CASE',
        renewalCaseId,
        narrativeType: quoteInsightNarrativeType(quoteInsight.id),
        content: quoteInsightNarrative.content,
        modelLabel: quoteInsightNarrative.modelLabel,
      },
    })
  }

  return quoteInsights.length
}

export async function generateAiContentForRenewalCase(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
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
      quoteInsights: {
        orderBy: [{ fitScore: 'desc' }, { confidenceScore: 'desc' }],
      },
    },
  })

  if (!renewalCase) {
    throw new Error(`Renewal case ${caseId} not found.`)
  }

  const latestAnalysis = renewalCase.analyses[0]
  const currency = renewalCase.account.billingCurrency || 'USD'
  const primaryDrivers = parseJsonArray(latestAnalysis?.primaryDriversJson)
  const caseInput = {
    accountName: renewalCase.account.name,
    segment: renewalCase.account.segment,
    industry: renewalCase.account.industry,
    recommendedAction: renewalCase.recommendedAction ?? 'UNKNOWN',
    riskLevel: renewalCase.riskLevel ?? 'UNKNOWN',
    approvalRequired: renewalCase.requiresApproval,
    bundleSummaryText: latestAnalysis?.bundleSummaryText ?? null,
    primaryDrivers,
    itemSummaries: renewalCase.items
      .filter((item) => Boolean(item.analysisSummary))
      .map((item) => ({
        productName: item.productNameSnapshot,
        disposition: item.recommendedDisposition ?? 'UNKNOWN',
        riskLevel: item.itemRiskLevel ?? 'UNKNOWN',
        summary: item.analysisSummary ?? '',
      })),
  }

  const [caseExecutiveSummary, caseRationale] = await Promise.all([
    generateCaseExecutiveSummary(caseInput),
    generateCaseRationale(caseInput),
  ])

  await prisma.recommendationNarrative.deleteMany({
    where: {
      scopeType: 'CASE',
      renewalCaseId: renewalCase.id,
      narrativeType: {
        in: [...CASE_NARRATIVE_TYPES],
      },
    },
  })

  await prisma.recommendationNarrative.create({
    data: {
      id: makeId('rn'),
      scopeType: 'CASE',
      renewalCaseId: renewalCase.id,
      narrativeType: 'EXECUTIVE_SUMMARY',
      content: caseExecutiveSummary.content,
      modelLabel: caseExecutiveSummary.modelLabel,
    },
  })

  await prisma.recommendationNarrative.create({
    data: {
      id: makeId('rn'),
      scopeType: 'CASE',
      renewalCaseId: renewalCase.id,
      narrativeType: 'RATIONALE',
      content: caseRationale.content,
      modelLabel: caseRationale.modelLabel,
    },
  })

  if (renewalCase.requiresApproval) {
    const approvalBrief = await generateApprovalBrief({
      accountName: renewalCase.account.name,
      caseNumber: renewalCase.caseNumber,
      recommendedAction: renewalCase.recommendedAction ?? 'UNKNOWN',
      riskLevel: renewalCase.riskLevel ?? 'UNKNOWN',
      approvalReason: renewalCase.approvalReason,
      primaryDrivers,
      currentArrFormatted: formatCurrency(Number(renewalCase.bundleCurrentArr ?? 0), currency),
      proposedArrFormatted: formatCurrency(Number(renewalCase.bundleProposedArr ?? 0), currency),
    })

    await prisma.recommendationNarrative.create({
      data: {
        id: makeId('rn'),
        scopeType: 'CASE',
        renewalCaseId: renewalCase.id,
        narrativeType: 'APPROVAL_BRIEF',
        content: approvalBrief.content,
        modelLabel: approvalBrief.modelLabel,
      },
    })
  }

  const quoteInsightNarrativeSources: QuoteInsightNarrativeSource[] = renewalCase.quoteInsights.map(
    (quoteInsight) => {
      const context = parseNarrativeContextFromJustification(quoteInsight.justificationJson)
      return {
        id: quoteInsight.id,
        title: quoteInsight.title,
        insightType: quoteInsight.insightType,
        productNameSnapshot: quoteInsight.productNameSnapshot,
        insightSummary: quoteInsight.insightSummary,
        recommendedActionSummary: quoteInsight.recommendedActionSummary,
        confidenceScore: quoteInsight.confidenceScore,
        fitScore: quoteInsight.fitScore,
        reasonCodes: context.reasonCodes,
        structuredReasoning: context.structuredReasoning,
        whatChangedSummary: context.whatChangedSummary,
        expectedImpactSummary: context.expectedImpactSummary,
      }
    },
  )

  const quoteInsightNarrativesCount = await createQuoteInsightNarratives(
    renewalCase.id,
    renewalCase.account.name,
    quoteInsightNarrativeSources,
  )

  return {
    ok: true,
    caseId,
    generated: {
      caseExecutiveSummary: true,
      caseRationale: true,
      approvalBrief: renewalCase.requiresApproval,
      quoteInsightNarratives: quoteInsightNarrativesCount,
    },
  }
}

export async function generateQuoteInsightNarrativesForRenewalCase(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      account: {
        select: {
          name: true,
        },
      },
      quoteInsights: {
        orderBy: [{ fitScore: 'desc' }, { confidenceScore: 'desc' }],
        select: {
          id: true,
          title: true,
          insightType: true,
          productNameSnapshot: true,
          insightSummary: true,
          recommendedActionSummary: true,
          confidenceScore: true,
          fitScore: true,
          justificationJson: true,
        },
      },
    },
  })

  if (!renewalCase) {
    throw new Error(`Renewal case ${caseId} not found.`)
  }

  const quoteInsightNarrativeSources: QuoteInsightNarrativeSource[] = renewalCase.quoteInsights.map(
    (quoteInsight) => {
      const context = parseNarrativeContextFromJustification(quoteInsight.justificationJson)
      return {
        id: quoteInsight.id,
        title: quoteInsight.title,
        insightType: quoteInsight.insightType,
        productNameSnapshot: quoteInsight.productNameSnapshot,
        insightSummary: quoteInsight.insightSummary,
        recommendedActionSummary: quoteInsight.recommendedActionSummary,
        confidenceScore: quoteInsight.confidenceScore,
        fitScore: quoteInsight.fitScore,
        reasonCodes: context.reasonCodes,
        structuredReasoning: context.structuredReasoning,
        whatChangedSummary: context.whatChangedSummary,
        expectedImpactSummary: context.expectedImpactSummary,
      }
    },
  )

  const generatedCount = await createQuoteInsightNarratives(
    renewalCase.id,
    renewalCase.account.name,
    quoteInsightNarrativeSources,
  )

  return {
    ok: true,
    caseId,
    generated: {
      quoteInsightNarratives: generatedCount,
    },
  }
}
