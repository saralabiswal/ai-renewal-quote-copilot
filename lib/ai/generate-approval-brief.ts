import { getAiModel, getOpenAIClient } from './client'
import { fallbackResult } from './fallback'
import { generateMockApprovalBrief, isOpenAiMockModeEnabled } from './mock-mode'
import { approvalBriefInstructions, buildApprovalBriefInput } from './prompts'
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

  const client = getOpenAIClient()
  if (!client) {
    return fallbackResult(fallbackApprovalBrief(input), 'approval-fallback-v1')
  }

  const response = await client.responses.create({
    model,
    instructions,
    input: promptInput,
  })

  return {
    mode: 'OPENAI',
    modelLabel: model,
    content: response.output_text.trim(),
  }
}
