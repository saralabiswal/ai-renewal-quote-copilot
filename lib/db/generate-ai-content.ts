import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { generateApprovalBrief } from '@/lib/ai/generate-approval-brief'
import { generateCaseExecutiveSummary } from '@/lib/ai/generate-case-executive-summary'
import { generateCaseRationale } from '@/lib/ai/generate-case-rationale'
import { generateQuoteInsightRationale } from '@/lib/ai/generate-quote-insight-rationale'
import { generateReasoningEvidence } from '@/lib/ai/generate-reasoning-evidence'
import type { ReasoningEvidenceInput } from '@/lib/ai/types'

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

const CASE_NARRATIVE_TYPES = [
  'EXECUTIVE_SUMMARY',
  'RATIONALE',
  'APPROVAL_BRIEF',
  'REASONING_RECOMMENDATION',
  'REASONING_DECISION_TRACE',
  'REASONING_APPROVAL',
  'REASONING_WHAT_CHANGED',
] as const

type CaseReasoningNarrativeType = Extract<
  (typeof CASE_NARRATIVE_TYPES)[number],
  | 'REASONING_RECOMMENDATION'
  | 'REASONING_DECISION_TRACE'
  | 'REASONING_APPROVAL'
  | 'REASONING_WHAT_CHANGED'
>

type ReasoningRenewalCaseSource = {
  id: string
  caseNumber: string
  demoScenarioKey: string | null
  recommendedAction: string | null
  riskLevel: string | null
  requiresApproval: boolean
  approvalReason: string | null
  lastRecommendationJson: string | null
  lastInsightDiffJson: string | null
  account: {
    name: string
  }
  quoteInsights: Array<{
    title: string
    insightType: string
    recommendedActionSummary: string | null
    confidenceScore: number | null
    fitScore: number | null
    estimatedArrImpact: unknown
    recommendedQuantity: number | null
    recommendedDiscountPercent: unknown
  }>
  decisionRuns: Array<{
    id: string
    mode: string
    mlMode: string | null
    ruleEngineVersion: string | null
    policyVersion: string | null
    featureSchemaVersion: string | null
    mlModelName: string | null
    mlModelVersion: string | null
    ruleOutputJson: string | null
    mlOutputJson: string | null
    finalOutputJson: string | null
    guardrailSummaryJson: string | null
  }>
}

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

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asText(value: unknown) {
  if (value == null || value === '') return null
  return String(value)
}

function asNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value: unknown) {
  const parsed = asNumber(value)
  if (parsed == null) return 'N/A'
  return parsed.toLocaleString('en-US', {
    maximumFractionDigits: Number.isInteger(parsed) ? 0 : 1,
  })
}

function summarizeOutput(prefix: string, output: Record<string, unknown> | null) {
  if (!output) return [`${prefix} output not available.`]

  return [
    `${prefix} risk score ${formatNumber(output.riskScore)}, risk level ${asText(output.riskLevel) ?? 'N/A'}, action ${asText(output.recommendedAction) ?? 'N/A'}.`,
    `${prefix} approval required: ${
      typeof output.approvalRequired === 'boolean' ? (output.approvalRequired ? 'yes' : 'no') : 'N/A'
    }.`,
  ]
}

function summarizeMlOutput(mlOutput: Record<string, unknown> | null) {
  if (!mlOutput) return ['ML output not available for this run.']

  const predictions = Array.isArray(mlOutput.itemPredictions) ? mlOutput.itemPredictions : []
  return [
    `ML status ${asText(mlOutput.status) ?? 'N/A'}, mode ${asText(mlOutput.mode) ?? 'N/A'}, bundle risk ${formatNumber(mlOutput.bundleRiskScore)}.`,
    `Model ${asText(mlOutput.modelName) ?? 'N/A'} ${asText(mlOutput.modelVersion) ?? ''}; item predictions ${predictions.length}.`.trim(),
  ]
}

function summarizeGuardrails(guardrailSummary: Record<string, unknown> | null, approvalRequired: boolean) {
  if (!guardrailSummary) {
    return [approvalRequired ? 'Approval required by current case posture.' : 'No approval guardrail is active.']
  }

  const count = asNumber(guardrailSummary.approvalRequiredCount)
  const results = Array.isArray(guardrailSummary.guardrailResults)
    ? guardrailSummary.guardrailResults.map(String).filter(Boolean)
    : []
  return [
    `Approval-required guardrail count ${count ?? 0}.`,
    results.length ? `Guardrail results: ${results.join(', ')}.` : 'No guardrail result list supplied.',
  ]
}

function summarizeRecommendationChange(raw: string | null | undefined) {
  const parsed = parseJsonObject(raw)
  if (!parsed) return ['No recommendation change metadata is available.']

  const previous = parsed.previous && typeof parsed.previous === 'object'
    ? (parsed.previous as Record<string, unknown>)
    : null
  const next = parsed.next && typeof parsed.next === 'object'
    ? (parsed.next as Record<string, unknown>)
    : null

  return [
    `Recommendation changed from ${asText(previous?.recommendedAction) ?? 'N/A'} / ${asText(previous?.riskLevel) ?? 'N/A'} to ${asText(next?.recommendedAction) ?? 'N/A'} / ${asText(next?.riskLevel) ?? 'N/A'}.`,
    `Scenario ${asText(parsed.scenarioKey) ?? 'BASE_CASE'}; decision run ${asText(parsed.decisionRunId) ?? 'N/A'}.`,
  ]
}

function summarizeInsightChange(raw: string | null | undefined) {
  const parsed = parseJsonObject(raw)
  if (!parsed) return ['No quote insight change metadata is available.']
  const added = Array.isArray(parsed.added) ? parsed.added.length : 0
  const removed = Array.isArray(parsed.removed) ? parsed.removed.length : 0
  const modified = Array.isArray(parsed.modified) ? parsed.modified.length : 0
  return [
    `Quote insights changed: +${added}, ~${modified}, -${removed}.`,
    `Insight engine ${asText(parsed.engineVersion) ?? 'N/A'}; policy ${asText(parsed.policyVersion) ?? 'N/A'}.`,
  ]
}

function buildReasoningInputs(args: {
  renewalCase: ReasoningRenewalCaseSource
  latestAnalysis: { primaryDriversJson: string | null; bundleSummaryText: string | null } | undefined
  currency: string
}): Array<{ narrativeType: CaseReasoningNarrativeType; input: ReasoningEvidenceInput }> {
  const { renewalCase, latestAnalysis, currency } = args
  const latestDecisionRun = renewalCase.decisionRuns[0] ?? null
  const quoteInsights = renewalCase.quoteInsights
  const account = renewalCase.account

  const ruleOutput = parseJsonObject(latestDecisionRun?.ruleOutputJson)
  const mlOutput = parseJsonObject(latestDecisionRun?.mlOutputJson)
  const finalOutput = parseJsonObject(latestDecisionRun?.finalOutputJson)
  const guardrailSummary = parseJsonObject(latestDecisionRun?.guardrailSummaryJson)
  const primaryDrivers = parseJsonArray(latestAnalysis?.primaryDriversJson)
  const ruleSummary = [
    ...summarizeOutput('Rule', ruleOutput),
    ...primaryDrivers.slice(0, 3).map((driver) => `Primary driver: ${driver}`),
  ]
  const mlSummary = summarizeMlOutput(mlOutput)
  const finalSummary = summarizeOutput('Final', finalOutput)
  const guardrails = summarizeGuardrails(guardrailSummary, Boolean(renewalCase.requiresApproval))
  const quoteInsightSummary = quoteInsights.slice(0, 5).map((insight) => {
    return `${insight.title} (${insight.insightType}) recommends ${insight.recommendedActionSummary ?? 'N/A'}; confidence ${insight.confidenceScore ?? 'N/A'}, fit ${insight.fitScore ?? 'N/A'}.`
  })
  const quoteDeltaSummary = quoteInsights.slice(0, 5).map((insight) => {
    return `ARR impact ${formatCurrency(Number(insight.estimatedArrImpact ?? 0), currency)}, quantity ${insight.recommendedQuantity ?? 'N/A'}, discount ${formatNumber(insight.recommendedDiscountPercent)}.`
  })
  const changeSummary = [
    ...summarizeRecommendationChange(String(renewalCase.lastRecommendationJson ?? '')),
    ...summarizeInsightChange(String(renewalCase.lastInsightDiffJson ?? '')),
  ]
  const evidenceReferences = [
    latestDecisionRun?.id ? `DecisionRun:${latestDecisionRun.id}` : 'DecisionRun:N/A',
    latestDecisionRun?.ruleEngineVersion ? `Rules:${latestDecisionRun.ruleEngineVersion}` : 'Rules:N/A',
    latestDecisionRun?.policyVersion ? `Policy:${latestDecisionRun.policyVersion}` : 'Policy:N/A',
    latestDecisionRun?.featureSchemaVersion
      ? `FeatureSchema:${latestDecisionRun.featureSchemaVersion}`
      : 'FeatureSchema:N/A',
    latestDecisionRun?.mlModelName && latestDecisionRun?.mlModelVersion
      ? `Model:${latestDecisionRun.mlModelName}:${latestDecisionRun.mlModelVersion}`
      : 'Model:N/A',
  ]

  const baseInput = {
    accountName: account.name,
    caseNumber: String(renewalCase.caseNumber ?? 'N/A'),
    recommendationMode: String(latestDecisionRun?.mode ?? latestDecisionRun?.mlMode ?? 'UNKNOWN'),
    scenarioKey: typeof renewalCase.demoScenarioKey === 'string' ? renewalCase.demoScenarioKey : null,
    recommendedAction: String(renewalCase.recommendedAction ?? 'UNKNOWN'),
    riskLevel: String(renewalCase.riskLevel ?? 'UNKNOWN'),
    approvalRequired: Boolean(renewalCase.requiresApproval),
    approvalReason: typeof renewalCase.approvalReason === 'string' ? renewalCase.approvalReason : null,
    ruleSummary,
    mlSummary,
    finalSummary,
    guardrailSummary: guardrails,
    quoteInsightSummary,
    quoteDeltaSummary,
    changeSummary,
    evidenceReferences,
  }

  const inputs: Array<{ narrativeType: CaseReasoningNarrativeType; input: ReasoningEvidenceInput }> = [
    {
      narrativeType: 'REASONING_RECOMMENDATION',
      input: { ...baseInput, reasoningType: 'RECOMMENDATION' },
    },
    {
      narrativeType: 'REASONING_DECISION_TRACE',
      input: { ...baseInput, reasoningType: 'DECISION_TRACE' },
    },
    {
      narrativeType: 'REASONING_WHAT_CHANGED',
      input: { ...baseInput, reasoningType: 'WHAT_CHANGED' },
    },
  ]

  if (baseInput.approvalRequired) {
    inputs.push({
      narrativeType: 'REASONING_APPROVAL',
      input: { ...baseInput, reasoningType: 'APPROVAL' },
    })
  }

  return inputs
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
      decisionRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
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

  const reasoningInputs = buildReasoningInputs({
    renewalCase,
    latestAnalysis,
    currency,
  })
  const reasoningNarratives = await Promise.all(
    reasoningInputs.map(async ({ narrativeType, input }) => {
      const reasoningEvidence = await generateReasoningEvidence(input)
      await prisma.recommendationNarrative.create({
        data: {
          id: makeId('rn'),
          scopeType: 'CASE',
          renewalCaseId: renewalCase.id,
          narrativeType,
          content: reasoningEvidence.content,
          modelLabel: reasoningEvidence.modelLabel,
        },
      })
      return narrativeType
    }),
  )

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
      reasoningNarratives: reasoningNarratives.length,
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
