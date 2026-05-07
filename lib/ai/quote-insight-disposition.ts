import { generateJson, type AiJsonResult } from '@/lib/ai/generate-json'
import type { GuardedDecisioningMode } from '@/lib/settings/runtime-settings'
import {
  buildQuoteInsightDispositionPromptInput,
  QUOTE_INSIGHT_LLM_PROMPT_VERSION,
  QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
  quoteInsightDispositionJsonInstructions,
  type QuoteInsightLlmCandidate,
  type QuoteInsightLlmCaseContext,
  type QuoteInsightLlmDisposition,
  type QuoteInsightLlmProposal,
  type QuoteInsightLlmTrace,
} from '@/lib/ai/quote-insight-disposition-prompt'

export type {
  QuoteInsightLlmCandidate,
  QuoteInsightLlmCaseContext,
  QuoteInsightLlmDisposition,
  QuoteInsightLlmProposal,
  QuoteInsightLlmTrace,
} from '@/lib/ai/quote-insight-disposition-prompt'

export type QuoteInsightLlmResult = {
  insights: QuoteInsightLlmCandidate[]
  trace: QuoteInsightLlmTrace
}

const QUOTE_INSIGHT_LLM_BATCH_SIZE = 3

const SUPPORTED_INSIGHT_TYPES = new Set([
  'RENEW_AS_IS',
  'CONCESSION',
  'MARGIN_RECOVERY',
  'EXPANSION',
  'CROSS_SELL',
  'HYBRID_DEPLOYMENT_FIT',
  'DATA_MODERNIZATION',
  'CONTROLLED_UPLIFT',
  'UPLIFT_RESTRAINT',
  'DEFENSIVE_RENEWAL',
])

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function chunkCandidates(candidates: QuoteInsightLlmCandidate[]) {
  const chunks: QuoteInsightLlmCandidate[][] = []
  for (let index = 0; index < candidates.length; index += QUOTE_INSIGHT_LLM_BATCH_SIZE) {
    chunks.push(candidates.slice(index, index + QUOTE_INSIGHT_LLM_BATCH_SIZE))
  }
  return chunks
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? round2(parsed) : null
}

function hasField(record: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(record, field)
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function allowedPolicyCitations(promptInput: unknown) {
  const allowed = new Set(['platform-policy-quote-insight-guardrails'])
  const input = asRecord(promptInput)
  const explicitCitations = Array.isArray(input?.allowedPolicyCitations)
    ? input.allowedPolicyCitations
    : []
  for (const citation of explicitCitations) {
    if (typeof citation === 'string') allowed.add(citation)
  }

  const policyContext = Array.isArray(input?.policyContext) ? input.policyContext : []

  for (const rawPolicy of policyContext) {
    const policy = asRecord(rawPolicy)
    const policyId = typeof policy?.policyId === 'string' ? policy.policyId : null
    const chunkId = typeof policy?.chunkId === 'string' ? policy.chunkId : null
    if (policyId) allowed.add(policyId)
    if (chunkId) allowed.add(chunkId)
  }

  return allowed
}

function sameNullableNumber(a: number | null, b: number | null) {
  if (a === null || b === null) return a === b
  return Math.abs(a - b) < 0.01
}

function omittedOrSameNumber(args: {
  record: Record<string, unknown>
  field: string
  candidateValue: number | null
}) {
  if (!hasField(args.record, args.field)) return true
  return sameNullableNumber(numberOrNull(args.record[args.field]), args.candidateValue)
}

function candidateBackedNumber(args: {
  record: Record<string, unknown>
  field: string
  candidateValue: number | null
}) {
  if (!hasField(args.record, args.field)) return args.candidateValue
  return numberOrNull(args.record[args.field])
}

function buildSkippedTrace(args: {
  mode: GuardedDecisioningMode
  reason: string
}): QuoteInsightLlmTrace {
  return {
    promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
    validationVersion: QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
    mode: args.mode,
    generatedBy: 'DETERMINISTIC_RULES',
    modelLabel: null,
    fallbackReason: args.reason,
    validationStatus: 'SKIPPED',
    acceptedProductSkus: [],
    rejectedProductSkus: [],
    checks: [
      {
        name: 'ModeAllowsLlmCalculation',
        status: 'SKIPPED',
        detail: args.reason,
      },
    ],
    systemPrompt: null,
    promptInput: null,
    rawText: null,
  }
}

export function validateQuoteInsightLlmDisposition(args: {
  candidates: QuoteInsightLlmCandidate[]
  jsonResult: AiJsonResult<unknown>
  systemPrompt?: string
  promptInput?: unknown
}): {
  acceptedBySku: Map<string, QuoteInsightLlmProposal>
  trace: QuoteInsightLlmTrace
} {
  const record = asRecord(args.jsonResult.value)
  const candidateBySku = new Map(args.candidates.map((candidate) => [candidate.productSkuSnapshot, candidate]))
  const rawInsights = Array.isArray(record?.quoteInsights) ? record.quoteInsights : []
  const acceptedBySku = new Map<string, QuoteInsightLlmProposal>()
  const rejectedProductSkus: string[] = []
  const checks: QuoteInsightLlmTrace['checks'] = []
  const allowedCitations = allowedPolicyCitations(args.promptInput)

  if (!record) {
    return {
      acceptedBySku,
      trace: {
        promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
        validationVersion: QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
        mode: 'LLM_ASSISTED_GUARDED',
        generatedBy: 'LLM_REJECTED',
        modelLabel: args.jsonResult.modelLabel,
        fallbackReason: args.jsonResult.error ?? 'LLM returned no structured disposition object.',
        validationStatus: 'REJECTED',
        acceptedProductSkus: [],
        rejectedProductSkus: args.candidates.map((candidate) => candidate.productSkuSnapshot),
        checks: [
          {
            name: 'Schema',
            status: 'FAILED',
            detail: 'LLM output did not include a supported quoteInsights array.',
          },
        ],
        systemPrompt: args.systemPrompt ?? null,
        promptInput: args.promptInput ?? null,
        rawText: args.jsonResult.rawText,
      },
    }
  }

  for (const rawInsight of rawInsights) {
    const insight = asRecord(rawInsight)
    const productSku = typeof insight?.productSku === 'string' ? insight.productSku : ''
    const candidate = candidateBySku.get(productSku)
    const insightType = typeof insight?.insightType === 'string' ? insight.insightType : ''
    const recommendedQuantity =
      insight && candidate
        ? candidateBackedNumber({
            record: insight,
            field: 'recommendedQuantity',
            candidateValue: candidate.recommendedQuantity,
          })
        : null
    const recommendedUnitPrice =
      insight && candidate
        ? candidateBackedNumber({
            record: insight,
            field: 'recommendedUnitPrice',
            candidateValue: candidate.recommendedUnitPrice,
          })
        : null
    const recommendedDiscountPercent =
      insight && candidate
        ? candidateBackedNumber({
            record: insight,
            field: 'recommendedDiscountPercent',
            candidateValue: candidate.recommendedDiscountPercent,
          })
        : null
    const estimatedArrImpact =
      insight && candidate
        ? candidateBackedNumber({
            record: insight,
            field: 'estimatedArrImpact',
            candidateValue: candidate.estimatedArrImpact,
          })
        : null
    const confidenceScore = hasField(insight ?? {}, 'confidenceScore')
      ? Number(insight?.confidenceScore)
      : Number(candidate?.confidenceScore)
    const fitScore = hasField(insight ?? {}, 'fitScore')
      ? Number(insight?.fitScore)
      : Number(candidate?.fitScore)

    const typeSupported = SUPPORTED_INSIGHT_TYPES.has(insightType)
    const typeMatches = candidate?.insightType === insightType
    const numericMatches =
      Boolean(candidate) &&
      Boolean(insight) &&
      omittedOrSameNumber({
        record: insight!,
        field: 'recommendedQuantity',
        candidateValue: candidate!.recommendedQuantity,
      }) &&
      omittedOrSameNumber({
        record: insight!,
        field: 'recommendedUnitPrice',
        candidateValue: candidate!.recommendedUnitPrice,
      }) &&
      omittedOrSameNumber({
        record: insight!,
        field: 'recommendedDiscountPercent',
        candidateValue: candidate!.recommendedDiscountPercent,
      }) &&
      omittedOrSameNumber({
        record: insight!,
        field: 'estimatedArrImpact',
        candidateValue: candidate!.estimatedArrImpact,
      })
    const scoreValid =
      Number.isFinite(confidenceScore) &&
      confidenceScore >= 0 &&
      confidenceScore <= 100 &&
      Number.isFinite(fitScore) &&
      fitScore >= 0 &&
      fitScore <= 100
    const citationValid = stringArray(insight?.policyCitations).every((citation) =>
      allowedCitations.has(citation),
    )
    const accepted =
      Boolean(candidate) && typeSupported && typeMatches && numericMatches && scoreValid && citationValid

    checks.push({
      name: `QuoteInsightLlmProposal:${productSku || 'UNKNOWN'}`,
      status: accepted ? 'PASSED' : 'FAILED',
      detail: accepted
        ? `LLM proposal stayed inside the safe candidate envelope for ${productSku}; omitted commercial numbers were filled from deterministic candidates.`
        : `LLM proposal was rejected for ${productSku || 'UNKNOWN'} because product, type, numeric math, score, or citation validation failed.`,
    })

    if (!accepted || !candidate || !insight) {
      if (productSku) rejectedProductSkus.push(productSku)
      continue
    }

    acceptedBySku.set(productSku, {
      productSku,
      insightType,
      title: typeof insight.title === 'string' ? insight.title : candidate.title,
      insightSummary:
        typeof insight.insightSummary === 'string' ? insight.insightSummary : candidate.insightSummary,
      recommendedActionSummary:
        typeof insight.recommendedActionSummary === 'string'
          ? insight.recommendedActionSummary
          : (candidate.recommendedActionSummary ?? candidate.insightSummary),
      recommendedQuantity,
      recommendedUnitPrice,
      recommendedDiscountPercent,
      estimatedArrImpact,
      confidenceScore: Math.round(confidenceScore),
      fitScore: Math.round(fitScore),
      reasonCodes: stringArray(insight.reasonCodes),
      policyCitations: stringArray(insight.policyCitations),
      explanation: typeof insight.explanation === 'string' ? insight.explanation : candidate.insightSummary,
    })
  }

  const missingSkus = args.candidates
    .map((candidate) => candidate.productSkuSnapshot)
    .filter((sku) => !acceptedBySku.has(sku))
  rejectedProductSkus.push(...missingSkus)

  return {
    acceptedBySku,
    trace: {
      promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
      validationVersion: QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
      mode: 'LLM_ASSISTED_GUARDED',
      generatedBy: acceptedBySku.size === args.candidates.length ? 'LLM' : 'LLM_REJECTED',
      modelLabel: args.jsonResult.modelLabel,
      fallbackReason:
        acceptedBySku.size === args.candidates.length
          ? null
          : 'One or more LLM quote insight proposals failed guarded validation; deterministic candidates were used for rejected products.',
      validationStatus: acceptedBySku.size === args.candidates.length ? 'PASSED' : 'REJECTED',
      acceptedProductSkus: Array.from(acceptedBySku.keys()),
      rejectedProductSkus: Array.from(new Set(rejectedProductSkus)),
      checks,
      systemPrompt: args.systemPrompt ?? null,
      promptInput: args.promptInput ?? null,
      rawText: args.jsonResult.rawText,
    },
  }
}

export async function calculateQuoteInsightsWithLlm(args: {
  mode: GuardedDecisioningMode
  caseContext: QuoteInsightLlmCaseContext
  candidates: QuoteInsightLlmCandidate[]
}): Promise<QuoteInsightLlmResult> {
  if (args.mode !== 'LLM_ASSISTED_GUARDED') {
    return {
      insights: args.candidates,
      trace: buildSkippedTrace({
        mode: args.mode,
        reason: `Mode ${args.mode} keeps Quote Insight calculation deterministic.`,
      }),
    }
  }

  if (args.candidates.length === 0) {
    return {
      insights: args.candidates,
      trace: buildSkippedTrace({
        mode: args.mode,
        reason: 'No Quote Insight candidates were available for LLM calculation.',
      }),
    }
  }

  if (args.candidates.length > QUOTE_INSIGHT_LLM_BATCH_SIZE) {
    const batchResults: Array<{
      candidateSkus: string[]
      result: QuoteInsightLlmResult
    }> = []

    for (const candidateBatch of chunkCandidates(args.candidates)) {
      batchResults.push({
        candidateSkus: candidateBatch.map((candidate) => candidate.productSkuSnapshot),
        result: await calculateQuoteInsightsWithSingleLlmRequest({
          mode: args.mode,
          caseContext: args.caseContext,
          candidates: candidateBatch,
        }),
      })
    }

    const insightBySku = new Map(args.candidates.map((candidate) => [candidate.productSkuSnapshot, candidate]))
    const acceptedProductSkus = new Set<string>()
    const rejectedProductSkus = new Set<string>()
    const checks: QuoteInsightLlmTrace['checks'] = []

    for (const batch of batchResults) {
      for (const insight of batch.result.insights) {
        insightBySku.set(insight.productSkuSnapshot, insight)
      }
      for (const sku of batch.result.trace.acceptedProductSkus) acceptedProductSkus.add(sku)
      for (const sku of batch.result.trace.rejectedProductSkus) rejectedProductSkus.add(sku)
      checks.push(...batch.result.trace.checks)
    }

    const allAccepted = acceptedProductSkus.size === args.candidates.length
    const systemPrompt = quoteInsightDispositionJsonInstructions()

    return {
      insights: args.candidates.map(
        (candidate) => insightBySku.get(candidate.productSkuSnapshot) ?? candidate,
      ),
      trace: {
        promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
        validationVersion: QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
        mode: args.mode,
        generatedBy: allAccepted ? 'LLM' : 'LLM_REJECTED',
        modelLabel: batchResults.find((batch) => batch.result.trace.modelLabel)?.result.trace.modelLabel ?? null,
        fallbackReason: allAccepted
          ? null
          : 'One or more batched LLM quote insight proposals failed guarded validation; deterministic candidates were used for rejected products.',
        validationStatus: allAccepted ? 'PASSED' : 'REJECTED',
        acceptedProductSkus: Array.from(acceptedProductSkus),
        rejectedProductSkus: Array.from(rejectedProductSkus),
        checks,
        systemPrompt,
        promptInput: {
          promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
          batched: true,
          batchSize: QUOTE_INSIGHT_LLM_BATCH_SIZE,
          batchCount: batchResults.length,
          batches: batchResults.map((batch) => ({
            candidateSkus: batch.candidateSkus,
            promptInput: batch.result.trace.promptInput,
          })),
        },
        rawText: JSON.stringify(
          batchResults.map((batch) => ({
            candidateSkus: batch.candidateSkus,
            validationStatus: batch.result.trace.validationStatus,
            generatedBy: batch.result.trace.generatedBy,
            rawText: batch.result.trace.rawText,
          })),
          null,
          2,
        ),
      },
    }
  }

  return calculateQuoteInsightsWithSingleLlmRequest(args)
}

async function calculateQuoteInsightsWithSingleLlmRequest(args: {
  mode: GuardedDecisioningMode
  caseContext: QuoteInsightLlmCaseContext
  candidates: QuoteInsightLlmCandidate[]
}): Promise<QuoteInsightLlmResult> {
  const systemPrompt = quoteInsightDispositionJsonInstructions()
  const promptInput = buildQuoteInsightDispositionPromptInput({
    caseContext: args.caseContext,
    candidates: args.candidates,
  })

  const jsonResult = await generateJson<QuoteInsightLlmDisposition>({
    instructions: systemPrompt,
    input: promptInput,
    fallbackLabel: 'deterministic-quote-insight-engine',
  })

  if (!jsonResult.ok) {
    return {
      insights: args.candidates,
      trace: {
        promptVersion: QUOTE_INSIGHT_LLM_PROMPT_VERSION,
        validationVersion: QUOTE_INSIGHT_LLM_VALIDATION_VERSION,
        mode: args.mode,
        generatedBy: 'LLM_REJECTED',
        modelLabel: jsonResult.modelLabel,
        fallbackReason: jsonResult.error ?? 'LLM quote insight calculation failed.',
        validationStatus: 'REJECTED',
        acceptedProductSkus: [],
        rejectedProductSkus: args.candidates.map((candidate) => candidate.productSkuSnapshot),
        checks: [
          {
            name: 'LlmRuntime',
            status: 'FAILED',
            detail: jsonResult.error ?? 'LLM quote insight calculation failed.',
          },
        ],
        systemPrompt,
        promptInput,
        rawText: jsonResult.rawText,
      },
    }
  }

  const validated = validateQuoteInsightLlmDisposition({
    candidates: args.candidates,
    jsonResult,
    systemPrompt,
    promptInput,
  })

  return {
    insights: args.candidates.map((candidate) => {
      const accepted = validated.acceptedBySku.get(candidate.productSkuSnapshot)
      if (!accepted) return candidate

      return {
        ...candidate,
        insightType: accepted.insightType,
        title: accepted.title,
        insightSummary: accepted.insightSummary,
        recommendedActionSummary: accepted.recommendedActionSummary,
        confidenceScore: accepted.confidenceScore,
        fitScore: accepted.fitScore,
        recommendedQuantity: accepted.recommendedQuantity,
        recommendedUnitPrice: accepted.recommendedUnitPrice,
        recommendedDiscountPercent: accepted.recommendedDiscountPercent,
        estimatedArrImpact: accepted.estimatedArrImpact,
      }
    }),
    trace: validated.trace,
  }
}
