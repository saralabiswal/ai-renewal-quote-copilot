import type {
  AiTextResult,
  ApprovalBriefInput,
  CaseRationaleInput,
  QuoteInsightRationaleInput,
} from './types'

type MockPromptContext<TInput> = {
  model: string
  instructions: string
  promptInput: string
  input: TInput
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7)
}

function buildTraceId(instructions: string, promptInput: string) {
  return stableHash(`${instructions}\n---\n${promptInput}`)
}

function normalizeAction(value: string) {
  return value.toLowerCase().replaceAll('_', ' ')
}

function mockResult(model: string, content: string): AiTextResult {
  return {
    mode: 'OPENAI',
    modelLabel: `${model}-mock`,
    content,
  }
}

function mockDriverBullets(drivers: string[], fallback: string) {
  const resolved = drivers.length > 0 ? drivers : [fallback]
  return resolved.map((driver) => `- ${driver}`).join('\n')
}

export function isOpenAiMockModeEnabled() {
  const raw = process.env.OPENAI_MOCK_MODE?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function generateMockCaseRationale({
  model,
  instructions,
  promptInput,
  input,
}: MockPromptContext<CaseRationaleInput>): AiTextResult {
  const traceId = buildTraceId(instructions, promptInput)

  const itemContext =
    input.itemSummaries.length > 0
      ? `Key line context includes ${input.itemSummaries
          .slice(0, 2)
          .map((item) => `${item.productName} (${normalizeAction(item.disposition)})`)
          .join(', ')}.`
      : 'No line-level summaries were supplied.'

  const content = [
    `${input.accountName} is currently assessed as ${input.riskLevel.toLowerCase()} risk with a recommended action of ${normalizeAction(input.recommendedAction)}.`,
    `${input.bundleSummaryText ?? 'Bundle-level commercial summary was not provided.'} ${
      input.approvalRequired
        ? 'The recommendation includes at least one approval-sensitive condition.'
        : 'No immediate approval escalation is indicated.'
    } ${itemContext}`,
    'Top Commercial Drivers',
    mockDriverBullets(
      input.primaryDrivers.slice(0, 3),
      'No primary drivers were provided by the scenario.',
    ),
    `Mock Trace ID: ${traceId}`,
  ].join('\n\n')

  return mockResult(model, content)
}

export function generateMockCaseExecutiveSummary({
  model,
  instructions,
  promptInput,
  input,
}: MockPromptContext<CaseRationaleInput>): AiTextResult {
  const traceId = buildTraceId(instructions, promptInput)
  const drivers = input.primaryDrivers.slice(0, 2)

  const content = [
    `${input.accountName} renewal posture is ${input.riskLevel.toLowerCase()} risk with a recommendation to ${normalizeAction(input.recommendedAction)}.`,
    input.bundleSummaryText ?? 'Bundle-level summary is currently unavailable.',
    input.approvalRequired
      ? 'Reviewer approval is currently required before execution.'
      : 'The recommendation can proceed without additional approval.',
    '',
    'Top Drivers',
    mockDriverBullets(drivers, 'No driver evidence was supplied.'),
    '',
    `Mock Trace ID: ${traceId}`,
  ].join('\n')

  return mockResult(model, content)
}

export function generateMockApprovalBrief({
  model,
  instructions,
  promptInput,
  input,
}: MockPromptContext<ApprovalBriefInput>): AiTextResult {
  const traceId = buildTraceId(instructions, promptInput)
  const driver = input.primaryDrivers[0] ?? 'No primary policy driver was provided.'

  const content = [
    'Situation',
    `${input.accountName} (${input.caseNumber}) is recommended for ${normalizeAction(input.recommendedAction)} at ${input.riskLevel.toLowerCase()} risk.`,
    '',
    'Why Approval Is Needed',
    input.approvalReason ?? driver,
    '',
    'Recommended Reviewer Posture',
    `Validate concession posture against ARR movement from ${input.currentArrFormatted} to ${input.proposedArrFormatted}, and confirm policy alignment before final approval.`,
    '',
    `Mock Trace ID: ${traceId}`,
  ].join('\n')

  return mockResult(model, content)
}

export function generateMockQuoteInsightRationale({
  model,
  instructions,
  promptInput,
  input,
}: MockPromptContext<QuoteInsightRationaleInput>): AiTextResult {
  const traceId = buildTraceId(instructions, promptInput)
  const confidenceText =
    input.confidenceScore != null && input.fitScore != null
      ? `Confidence ${input.confidenceScore}, fit ${input.fitScore}.`
      : 'Confidence and fit were not fully supplied.'
  const reasonCodeText =
    input.reasonCodes && input.reasonCodes.length > 0
      ? `Reason codes: ${input.reasonCodes.join(', ')}.`
      : 'Reason codes were not supplied.'

  const content = [
    'Decision',
    input.recommendedActionSummary ??
      `Align the quote line with the ${input.insightType.toLowerCase().replaceAll('_', ' ')} posture.`,
    '',
    'Why',
    `${input.insightSummary} ${reasonCodeText}`.trim(),
    '',
    'Commercial Impact',
    `${input.expectedImpactSummary ?? 'Commercial impact is directional and should be validated in quote totals.'} ${confidenceText}`.trim(),
    '',
    'What Changed',
    input.whatChangedSummary ?? 'No material change from the previous insight.',
    '',
    `Mock Trace ID: ${traceId}`,
  ].join('\n')

  return mockResult(model, content.trim())
}
