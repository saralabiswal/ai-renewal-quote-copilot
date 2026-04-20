import { getAiModel, getOpenAIClient } from './client'
import { fallbackResult } from './fallback'
import {
  generateMockCaseExecutiveSummary,
  isOpenAiMockModeEnabled,
} from './mock-mode'
import {
  buildCaseExecutiveSummaryInput,
  caseExecutiveSummaryInstructions,
} from './prompts'
import type { AiTextResult, CaseRationaleInput } from './types'

function fallbackCaseExecutiveSummary(input: CaseRationaleInput) {
  const topDrivers = input.primaryDrivers.slice(0, 2).map((driver) => `- ${driver}`).join('\n')

  return [
    `${input.accountName} is assessed as ${input.riskLevel.toLowerCase()} risk with a recommended action of ${input.recommendedAction.toLowerCase().replaceAll('_', ' ')}.`,
    input.bundleSummaryText ?? 'Bundle-level summary is not available.',
    input.approvalRequired ? 'Approval is currently required.' : 'Approval is not currently required.',
    '',
    topDrivers || '- No primary drivers were provided.',
  ].join('\n')
}

export async function generateCaseExecutiveSummary(
  input: CaseRationaleInput,
): Promise<AiTextResult> {
  const model = getAiModel()
  const instructions = caseExecutiveSummaryInstructions()
  const promptInput = buildCaseExecutiveSummaryInput(input)

  if (isOpenAiMockModeEnabled()) {
    return generateMockCaseExecutiveSummary({
      model,
      instructions,
      promptInput,
      input,
    })
  }

  const client = getOpenAIClient()
  if (!client) {
    return fallbackResult(fallbackCaseExecutiveSummary(input), 'executive-summary-fallback-v1')
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
