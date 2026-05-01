import { evaluateRenewalCase } from '@/lib/rules/recommendation-engine'
import type { BundleRiskResult, RenewalCaseEngineInput } from '@/lib/rules/types'

export const DECISION_REPLAY_VERIFICATION_VERSION = 'decision-replay-verification-v1'

export type DecisionReplayCheck = {
  name: string
  status: 'PASSED' | 'FAILED' | 'WARN' | 'SKIPPED'
  detail: string
}

export type DecisionReplayVerification = {
  verificationVersion: typeof DECISION_REPLAY_VERIFICATION_VERSION
  status: 'PASSED' | 'FAILED' | 'NOT_REPLAYABLE'
  deterministicReplaySupported: boolean
  replayedAt: string
  checks: DecisionReplayCheck[]
  replayedRuleOutput: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    approvalRequired: boolean | null
    bundleDeltaArr: number | null
  } | null
  persistedRuleOutput: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    approvalRequired: boolean | null
    bundleDeltaArr: number | null
  } | null
  persistedFinalOutput: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    approvalRequired: boolean | null
    bundleDeltaArr: number | null
  } | null
}

type ReplayableDecisionRun = {
  id: string
  ruleInputJson: string | null
  ruleOutputJson: string | null
  finalOutputJson: string | null
  finalizerJson: string | null
  replayMetadataJson: string | null
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function nullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function summarizeBundle(value: Record<string, unknown> | BundleRiskResult | null) {
  if (!value) return null

  return {
    riskScore: nullableNumber(value.riskScore),
    riskLevel: nullableString(value.riskLevel),
    recommendedAction: nullableString(value.recommendedAction),
    approvalRequired: nullableBoolean(value.approvalRequired),
    bundleDeltaArr: nullableNumber(value.bundleDeltaArr),
  }
}

function valuesMatch(left: unknown, right: unknown) {
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber)
      ? Math.abs(leftNumber - rightNumber) < 0.01
      : left === right
  }

  return left === right
}

function compareBundleFields(args: {
  checkName: string
  leftLabel: string
  rightLabel: string
  left: ReturnType<typeof summarizeBundle>
  right: ReturnType<typeof summarizeBundle>
}): DecisionReplayCheck {
  if (!args.left || !args.right) {
    return {
      name: args.checkName,
      status: 'FAILED',
      detail: `Cannot compare ${args.leftLabel} and ${args.rightLabel} because one side is missing.`,
    }
  }

  const fields: Array<keyof NonNullable<ReturnType<typeof summarizeBundle>>> = [
    'riskScore',
    'riskLevel',
    'recommendedAction',
    'approvalRequired',
    'bundleDeltaArr',
  ]
  const mismatches = fields.filter((field) => !valuesMatch(args.left?.[field], args.right?.[field]))

  return {
    name: args.checkName,
    status: mismatches.length ? 'FAILED' : 'PASSED',
    detail: mismatches.length
      ? `${args.leftLabel} and ${args.rightLabel} differ on ${mismatches.join(', ')}.`
      : `${args.leftLabel} and ${args.rightLabel} match on core deterministic fields.`,
  }
}

export function verifyDecisionRunReplay(
  run: ReplayableDecisionRun,
): DecisionReplayVerification {
  const checks: DecisionReplayCheck[] = []
  const replayMetadata = parseJsonObject(run.replayMetadataJson)
  const deterministicReplaySupported =
    replayMetadata?.deterministicReplaySupported === true ||
    replayMetadata?.deterministicReplaySupported === 'true'

  checks.push({
    name: 'ReplayMetadata',
    status: deterministicReplaySupported ? 'PASSED' : 'WARN',
    detail: deterministicReplaySupported
      ? 'Decision run declares deterministic replay support.'
      : 'Decision run does not declare deterministic replay support.',
  })

  const ruleInput = parseJsonObject(run.ruleInputJson)
  const persistedRuleOutput = summarizeBundle(parseJsonObject(run.ruleOutputJson))
  const persistedFinalOutput = summarizeBundle(parseJsonObject(run.finalOutputJson))
  const finalizer = parseJsonObject(run.finalizerJson)
  const finalizerCandidate = nullableString(finalizer?.finalCandidate)

  if (!ruleInput || !persistedRuleOutput || !persistedFinalOutput) {
    checks.push({
      name: 'ReplayInputsPresent',
      status: 'FAILED',
      detail: 'Replay requires rule input, persisted rule output, and persisted final output.',
    })

    return {
      verificationVersion: DECISION_REPLAY_VERIFICATION_VERSION,
      status: 'NOT_REPLAYABLE',
      deterministicReplaySupported,
      replayedAt: new Date().toISOString(),
      checks,
      replayedRuleOutput: null,
      persistedRuleOutput,
      persistedFinalOutput,
    }
  }

  checks.push({
    name: 'ReplayInputsPresent',
    status: 'PASSED',
    detail: 'Rule input, persisted rule output, and persisted final output are present.',
  })

  let replayedRuleOutput: ReturnType<typeof summarizeBundle> = null
  try {
    const replayed = evaluateRenewalCase(ruleInput as unknown as RenewalCaseEngineInput)
    replayedRuleOutput = summarizeBundle(replayed.bundleResult)
    checks.push({
      name: 'RuleEngineReexecution',
      status: 'PASSED',
      detail: 'Rule engine re-executed from stored rule input.',
    })
  } catch (error) {
    checks.push({
      name: 'RuleEngineReexecution',
      status: 'FAILED',
      detail: error instanceof Error ? error.message : 'Rule engine replay failed.',
    })
  }

  checks.push(
    compareBundleFields({
      checkName: 'RuleOutputConsistency',
      leftLabel: 'Replayed rule output',
      rightLabel: 'persisted rule output',
      left: replayedRuleOutput,
      right: persistedRuleOutput,
    }),
  )

  if (finalizerCandidate) {
    checks.push({
      name: 'FinalizerCandidateConsistency',
      status: valuesMatch(finalizerCandidate, persistedFinalOutput.recommendedAction)
        ? 'PASSED'
        : 'FAILED',
      detail: valuesMatch(finalizerCandidate, persistedFinalOutput.recommendedAction)
        ? 'Persisted final output action matches finalizer final candidate.'
        : `Finalizer candidate ${finalizerCandidate} does not match persisted final action ${persistedFinalOutput.recommendedAction ?? 'unknown'}.`,
    })
  } else {
    checks.push({
      name: 'FinalizerCandidateConsistency',
      status: 'WARN',
      detail: 'No finalizer candidate was persisted for this run.',
    })
  }

  const failedChecks = checks.filter((check) => check.status === 'FAILED')

  return {
    verificationVersion: DECISION_REPLAY_VERIFICATION_VERSION,
    status: failedChecks.length ? 'FAILED' : 'PASSED',
    deterministicReplaySupported,
    replayedAt: new Date().toISOString(),
    checks,
    replayedRuleOutput,
    persistedRuleOutput,
    persistedFinalOutput,
  }
}
