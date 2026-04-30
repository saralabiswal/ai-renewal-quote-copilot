import { getAiClient, getAiModel } from './client'
import { fallbackResult } from './fallback'
import { generateMockApprovalBrief, isOpenAiMockModeEnabled } from './mock-mode'
import { approvalBriefInstructions, buildApprovalBriefInput } from './prompts'
import { sanitizeAiText } from './text-format'
import type { AiTextResult, ApprovalBriefInput } from './types'

function fallbackApprovalBrief(input: ApprovalBriefInput) {
  return [
    'Situation',
    `${input.accountName} requires reviewer attention for ${input.caseNumber} with a recommended action of ${input.recommendedAction.toLowerCase().replaceAll('_', ' ')}.`,
    '',
    'Why Approval Is Needed',
    input.approvalReason ?? input.primaryDrivers[0] ?? 'The case includes at least one policy-triggering exception.',
    '',
    'Recommended Reviewer Posture',
    `Review the concession and risk posture against the current ARR of ${input.currentArrFormatted} and proposed ARR of ${input.proposedArrFormatted}.`,
  ].join('\n')
}

export async function generateApprovalBrief(input: ApprovalBriefInput): Promise<AiTextResult> {
  const model = getAiModel()
  const instructions = approvalBriefInstructions()
  const promptInput = buildApprovalBriefInput(input)

  if (isOpenAiMockModeEnabled()) {
    return generateMockApprovalBrief({
      model,
      instructions,
      promptInput,
      input,
    })
  }

  const aiRuntime = getAiClient()
  if (!aiRuntime) {
    return fallbackResult(fallbackApprovalBrief(input), 'approval-fallback-v1')
  }

  const response = await aiRuntime.client.responses.create({
    model: aiRuntime.model,
    instructions,
    input: promptInput,
  })

  return {
    mode: aiRuntime.mode,
    modelLabel: aiRuntime.model,
    content: sanitizeAiText(response.output_text),
  }
}
