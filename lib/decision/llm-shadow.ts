import type { DecisionCandidateEnvelope } from '@/lib/decision/candidates'
import type { GuardedValidationResult } from '@/lib/decision/guarded-validator'
import type { RenewalEvidenceSnapshot } from '@/lib/evidence/renewal-evidence'
import type { PolicyEvaluationTrace } from '@/lib/policies/policy-runtime'
import type { RenewalCaseEngineOutput } from '@/lib/rules/types'
import { generateJson, type AiJsonResult } from '@/lib/ai/generate-json'

export const LLM_CRITIQUE_SCHEMA_VERSION = 'llm-critique-v1'
export const LLM_RANKING_SCHEMA_VERSION = 'llm-ranking-v1'
export const LLM_SHADOW_PROMPT_VERSION = 'llm-shadow-prompts-2026-q2'

export type LlmCritique = {
  schemaVersion: typeof LLM_CRITIQUE_SCHEMA_VERSION
  mode: 'LLM_CRITIC_SHADOW'
  promptVersion: typeof LLM_SHADOW_PROMPT_VERSION
  generatedBy: 'DETERMINISTIC_SHADOW' | 'LLM' | 'LLM_REJECTED'
  modelLabel?: string | null
  fallbackReason?: string | null
  decisionQuality: 'STRONG' | 'REVIEW_REQUIRED' | 'WEAK'
  contradictions: string[]
  missingEvidence: string[]
  reviewerQuestions: string[]
  riskNarrative: string
  commercialTradeoffs: string[]
  evidenceRefs: string[]
  validation: {
    status: 'PASSED' | 'REJECTED'
    checks: Array<{ name: string; status: 'PASSED' | 'FAILED'; detail: string }>
  }
}

export type LlmCandidateRanking = {
  schemaVersion: typeof LLM_RANKING_SCHEMA_VERSION
  mode: 'LLM_RANKING_SHADOW'
  promptVersion: typeof LLM_SHADOW_PROMPT_VERSION
  generatedBy: 'DETERMINISTIC_SHADOW' | 'LLM' | 'LLM_REJECTED'
  modelLabel?: string | null
  fallbackReason?: string | null
  ruleWinner: string
  selectedCandidate: string
  confidence: number
  rankedCandidates: Array<{
    candidateType: string
    rank: number
    score: number
    reasonCodes: string[]
    evidenceRefs: string[]
  }>
  reviewerNarrative: string
  validation: {
    status: 'PASSED' | 'REJECTED'
    checks: Array<{ name: string; status: 'PASSED' | 'FAILED'; detail: string }>
    rejectionReasons: string[]
  }
}

export function buildCriticPromptInput(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  finalOutput: RenewalCaseEngineOutput
  policyTrace: PolicyEvaluationTrace
  validationResult: GuardedValidationResult
}) {
  return {
    promptVersion: LLM_SHADOW_PROMPT_VERSION,
    instruction:
      'Return strict JSON only. Critique the deterministic renewal decision using only supplied evidence, policy trace, guardrail state, and validation result. Do not invent products, prices, discounts, or approvals.',
    evidenceQuality: args.evidenceSnapshot.quality,
    finalDecision: args.finalOutput.bundleResult,
    policySummary: args.policyTrace.summary,
    validator: args.validationResult,
  }
}

export function criticJsonInstructions() {
  return [
    'You are an enterprise SaaS decision critic running in shadow mode.',
    'Return one strict JSON object only.',
    'Use only the supplied evidence, policy summary, final decision, and validator result.',
    'Do not invent customer facts, products, prices, discounts, approvals, evidence refs, or policy IDs.',
    'The output must match this shape exactly:',
    '{ "decisionQuality": "STRONG|REVIEW_REQUIRED|WEAK", "contradictions": string[], "missingEvidence": string[], "reviewerQuestions": string[], "riskNarrative": string, "commercialTradeoffs": string[], "evidenceRefs": string[] }',
  ].join(' ')
}

export function rankingJsonInstructions() {
  return [
    'You are an enterprise SaaS candidate ranking engine running in shadow mode.',
    'Return one strict JSON object only.',
    'Rank only supplied allowed candidates; never select blocked candidates.',
    'Use only evidence refs already present on candidates.',
    'Do not invent candidate types, products, prices, discounts, approvals, or evidence refs.',
    'The output must match this shape exactly:',
    '{ "selectedCandidate": string, "confidence": number, "rankedCandidates": [{ "candidateType": string, "rank": number, "score": number, "reasonCodes": string[], "evidenceRefs": string[] }], "reviewerNarrative": string }',
  ].join(' ')
}

export function buildRankingPromptInput(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  candidates: DecisionCandidateEnvelope
  policyTrace: PolicyEvaluationTrace
}) {
  return {
    promptVersion: LLM_SHADOW_PROMPT_VERSION,
    instruction:
      'Return strict JSON only. Rank only the allowed candidates. Do not select blocked candidates or cite evidence refs outside the evidence snapshot.',
    evidenceQuality: args.evidenceSnapshot.quality,
    allowedCandidates: args.candidates.allowedCandidates,
    blockedCandidates: args.candidates.blockedCandidates,
    candidates: args.candidates.candidates,
    policySummary: args.policyTrace.summary,
  }
}

function validateEvidenceRefs(refs: string[], snapshot: RenewalEvidenceSnapshot) {
  const allowed = new Set(snapshot.signals.map((signal) => signal.evidenceRef))
  return refs.every((ref) => allowed.has(ref))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function validateCritiquePayload(args: {
  payload: unknown
  fallback: LlmCritique
  snapshot: RenewalEvidenceSnapshot
  jsonResult: AiJsonResult<unknown>
}): LlmCritique {
  const record = asRecord(args.payload)
  const quality = record?.decisionQuality
  const evidenceRefs = stringArray(record?.evidenceRefs)
  const refsValid = validateEvidenceRefs(evidenceRefs, args.snapshot)
  const qualityValid =
    quality === 'STRONG' || quality === 'REVIEW_REQUIRED' || quality === 'WEAK'

  if (!record || !qualityValid || !refsValid) {
    return {
      ...args.fallback,
      generatedBy: 'LLM_REJECTED',
      modelLabel: args.jsonResult.modelLabel,
      fallbackReason: !qualityValid
        ? 'LLM critique returned an unsupported decisionQuality.'
        : 'LLM critique cited evidence refs outside the evidence snapshot.',
    }
  }

  return {
    ...args.fallback,
    generatedBy: 'LLM',
    modelLabel: args.jsonResult.modelLabel,
    fallbackReason: null,
    decisionQuality: quality,
    contradictions: stringArray(record.contradictions),
    missingEvidence: stringArray(record.missingEvidence),
    reviewerQuestions: stringArray(record.reviewerQuestions),
    riskNarrative:
      typeof record.riskNarrative === 'string'
        ? record.riskNarrative
        : args.fallback.riskNarrative,
    commercialTradeoffs: stringArray(record.commercialTradeoffs),
    evidenceRefs,
    validation: {
      status: 'PASSED',
      checks: [
        {
          name: 'Schema',
          status: 'PASSED',
          detail: 'LLM critique JSON matched the supported shadow schema.',
        },
        {
          name: 'EvidenceReferences',
          status: 'PASSED',
          detail: 'LLM critique evidence references exist in the evidence snapshot.',
        },
      ],
    },
  }
}

function validateRankingPayload(args: {
  payload: unknown
  fallback: LlmCandidateRanking
  snapshot: RenewalEvidenceSnapshot
  candidates: DecisionCandidateEnvelope
  jsonResult: AiJsonResult<unknown>
}): LlmCandidateRanking {
  const record = asRecord(args.payload)
  const selectedCandidate =
    typeof record?.selectedCandidate === 'string' ? record.selectedCandidate : ''
  const selectedAllowed = args.candidates.allowedCandidates.includes(selectedCandidate)
  const rawRanked = Array.isArray(record?.rankedCandidates) ? record.rankedCandidates : []
  const rankedCandidates = rawRanked.flatMap((item, index) => {
    const ranked = asRecord(item)
    if (!ranked || typeof ranked.candidateType !== 'string') return []
    return [
      {
        candidateType: ranked.candidateType,
        rank: Number.isFinite(Number(ranked.rank)) ? Number(ranked.rank) : index + 1,
        score: Number.isFinite(Number(ranked.score)) ? Number(ranked.score) : 50,
        reasonCodes: stringArray(ranked.reasonCodes),
        evidenceRefs: stringArray(ranked.evidenceRefs),
      },
    ]
  })
  const refsValid = validateEvidenceRefs(
    rankedCandidates.flatMap((candidate) => candidate.evidenceRefs),
    args.snapshot,
  )
  const confidence = Number(record?.confidence)
  const confidenceValid = Number.isFinite(confidence) && confidence >= 0 && confidence <= 100

  if (!record || !selectedAllowed || !refsValid || !confidenceValid) {
    return {
      ...args.fallback,
      generatedBy: 'LLM_REJECTED',
      modelLabel: args.jsonResult.modelLabel,
      fallbackReason: !selectedAllowed
        ? 'LLM ranking selected a candidate outside the allowed candidate envelope.'
        : !refsValid
          ? 'LLM ranking cited evidence refs outside the evidence snapshot.'
          : 'LLM ranking returned invalid confidence or schema.',
    }
  }

  return {
    ...args.fallback,
    generatedBy: 'LLM',
    modelLabel: args.jsonResult.modelLabel,
    fallbackReason: null,
    selectedCandidate,
    confidence: Math.round(confidence),
    rankedCandidates,
    reviewerNarrative:
      typeof record.reviewerNarrative === 'string'
        ? record.reviewerNarrative
        : args.fallback.reviewerNarrative,
    validation: {
      status: 'PASSED',
      checks: [
        {
          name: 'SelectedCandidateAllowed',
          status: 'PASSED',
          detail: 'LLM ranking selected a candidate from the allowed candidate envelope.',
        },
        {
          name: 'EvidenceReferences',
          status: 'PASSED',
          detail: 'LLM ranking evidence references exist in the evidence snapshot.',
        },
      ],
      rejectionReasons: [],
    },
  }
}

export function buildDeterministicLlmCritique(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  finalOutput: RenewalCaseEngineOutput
  policyTrace: PolicyEvaluationTrace
  validationResult: GuardedValidationResult
}): LlmCritique {
  const missingEvidence = args.evidenceSnapshot.signals
    .filter((signal) => signal.freshnessStatus === 'MISSING' || signal.freshnessStatus === 'STALE')
    .slice(0, 8)
    .map((signal) => signal.evidenceRef)
  const warningCount = args.policyTrace.summary.warningCount + args.policyTrace.summary.blockedCount
  const approvalRequired = args.finalOutput.bundleResult.approvalRequired
  const decisionQuality =
    args.validationResult.status === 'REJECTED' || warningCount > 3
      ? 'REVIEW_REQUIRED'
      : args.evidenceSnapshot.quality.completenessScore < 80
        ? 'REVIEW_REQUIRED'
        : 'STRONG'
  const contradictions =
    args.validationResult.fallbackUsed
      ? [`Validator rejected selected candidate and fell back to ${args.validationResult.fallbackCandidate}.`]
      : []
  const evidenceRefs = args.evidenceSnapshot.signals.slice(0, 8).map((signal) => signal.evidenceRef)

  return {
    schemaVersion: LLM_CRITIQUE_SCHEMA_VERSION,
    mode: 'LLM_CRITIC_SHADOW',
    promptVersion: LLM_SHADOW_PROMPT_VERSION,
    generatedBy: 'DETERMINISTIC_SHADOW',
    modelLabel: 'deterministic-shadow-v1',
    fallbackReason: null,
    decisionQuality,
    contradictions,
    missingEvidence,
    reviewerQuestions: [
      approvalRequired
        ? 'Confirm approval owner and policy exception reason before quote approval.'
        : 'Confirm no late-breaking commercial or support events changed the renewal posture.',
      missingEvidence.length
        ? 'Review missing or stale evidence before relying on the shadow reasoning.'
        : 'Confirm evidence freshness aligns with reviewer expectations.',
    ],
    riskNarrative: `${args.finalOutput.bundleResult.recommendedAction} was selected with ${args.finalOutput.bundleResult.riskLevel} bundle risk and ${args.policyTrace.summary.ruleHitCount} policy rule hits.`,
    commercialTradeoffs: [
      `ARR delta is ${args.finalOutput.bundleResult.bundleDeltaArr}.`,
      approvalRequired
        ? 'Pricing guardrails require approval before final commercial acceptance.'
        : 'No approval flag is present in the final bundle output.',
    ],
    evidenceRefs,
    validation: {
      status: validateEvidenceRefs(evidenceRefs, args.evidenceSnapshot) ? 'PASSED' : 'REJECTED',
      checks: [
        {
          name: 'EvidenceReferences',
          status: validateEvidenceRefs(evidenceRefs, args.evidenceSnapshot) ? 'PASSED' : 'FAILED',
          detail: 'Critique evidence references must exist in the evidence snapshot.',
        },
      ],
    },
  }
}

export function buildDeterministicLlmRanking(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  candidates: DecisionCandidateEnvelope
}): LlmCandidateRanking {
  const allowed = args.candidates.candidates
    .filter(
      (candidate) =>
        candidate.scope === 'BUNDLE_RECOMMENDATION' &&
        args.candidates.allowedCandidates.includes(candidate.candidateType),
    )
    .sort((a, b) => Number(b.selectedByRules) - Number(a.selectedByRules) || b.score - a.score)
  const rankedCandidates = allowed.map((candidate, index) => ({
    candidateType: candidate.candidateType,
    rank: index + 1,
    score: candidate.score,
    reasonCodes: candidate.reasonCodes,
    evidenceRefs: candidate.evidenceRefs.slice(0, 6),
  }))
  const selectedCandidate = rankedCandidates[0]?.candidateType ?? args.candidates.ruleWinner
  const evidenceRefs = rankedCandidates.flatMap((candidate) => candidate.evidenceRefs)
  const selectedAllowed = args.candidates.allowedCandidates.includes(selectedCandidate)
  const refsValid = validateEvidenceRefs(evidenceRefs, args.evidenceSnapshot)
  const rejectionReasons = [
    ...(selectedAllowed ? [] : ['Selected candidate is not allowed.']),
    ...(refsValid ? [] : ['One or more ranking evidence references are invalid.']),
  ]

  return {
    schemaVersion: LLM_RANKING_SCHEMA_VERSION,
    mode: 'LLM_RANKING_SHADOW',
    promptVersion: LLM_SHADOW_PROMPT_VERSION,
    generatedBy: 'DETERMINISTIC_SHADOW',
    modelLabel: 'deterministic-shadow-v1',
    fallbackReason: null,
    ruleWinner: args.candidates.ruleWinner,
    selectedCandidate,
    confidence: Math.max(50, Math.min(95, args.evidenceSnapshot.quality.confidenceScore)),
    rankedCandidates,
    reviewerNarrative:
      selectedCandidate === args.candidates.ruleWinner
        ? `Shadow ranking agrees with the deterministic rule winner: ${selectedCandidate}.`
        : `Shadow ranking prefers ${selectedCandidate}, while rules remain final with ${args.candidates.ruleWinner}.`,
    validation: {
      status: rejectionReasons.length ? 'REJECTED' : 'PASSED',
      checks: [
        {
          name: 'SelectedCandidateAllowed',
          status: selectedAllowed ? 'PASSED' : 'FAILED',
          detail: 'Shadow ranking can only select candidates from the deterministic allowed list.',
        },
        {
          name: 'EvidenceReferences',
          status: refsValid ? 'PASSED' : 'FAILED',
          detail: 'Shadow ranking evidence references must exist in the evidence snapshot.',
        },
      ],
      rejectionReasons,
    },
  }
}

export async function buildLiveOrDeterministicLlmShadow(args: {
  evidenceSnapshot: RenewalEvidenceSnapshot
  finalOutput: RenewalCaseEngineOutput
  policyTrace: PolicyEvaluationTrace
  validationResult: GuardedValidationResult
  candidates: DecisionCandidateEnvelope
  liveCritiqueEnabled: boolean
  liveRankingEnabled: boolean
}) {
  const deterministicCritique = buildDeterministicLlmCritique(args)
  const deterministicRanking = buildDeterministicLlmRanking({
    evidenceSnapshot: args.evidenceSnapshot,
    candidates: args.candidates,
  })

  let critique = deterministicCritique
  let ranking = deterministicRanking
  let critiqueJsonResult: AiJsonResult<unknown> | null = null
  let rankingJsonResult: AiJsonResult<unknown> | null = null

  if (args.liveCritiqueEnabled) {
    critiqueJsonResult = await generateJson<unknown>({
      instructions: criticJsonInstructions(),
      input: buildCriticPromptInput(args),
      fallbackLabel: 'deterministic-shadow-v1',
    })

    critique = critiqueJsonResult.ok
      ? validateCritiquePayload({
          payload: critiqueJsonResult.value,
          fallback: deterministicCritique,
          snapshot: args.evidenceSnapshot,
          jsonResult: critiqueJsonResult,
        })
      : {
          ...deterministicCritique,
          generatedBy: 'LLM_REJECTED',
          modelLabel: critiqueJsonResult.modelLabel,
          fallbackReason: critiqueJsonResult.error,
        }
  }

  if (args.liveRankingEnabled) {
    rankingJsonResult = await generateJson<unknown>({
      instructions: rankingJsonInstructions(),
      input: buildRankingPromptInput({
        evidenceSnapshot: args.evidenceSnapshot,
        candidates: args.candidates,
        policyTrace: args.policyTrace,
      }),
      fallbackLabel: 'deterministic-shadow-v1',
    })

    ranking = rankingJsonResult.ok
      ? validateRankingPayload({
          payload: rankingJsonResult.value,
          fallback: deterministicRanking,
          snapshot: args.evidenceSnapshot,
          candidates: args.candidates,
          jsonResult: rankingJsonResult,
        })
      : {
          ...deterministicRanking,
          generatedBy: 'LLM_REJECTED',
          modelLabel: rankingJsonResult.modelLabel,
          fallbackReason: rankingJsonResult.error,
        }
  }

  return {
    critique,
    ranking,
    rawResults: {
      critique: critiqueJsonResult,
      ranking: rankingJsonResult,
    },
  }
}
