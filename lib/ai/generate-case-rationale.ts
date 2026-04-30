import { getAiClient, getAiModel } from './client'
import { fallbackResult } from './fallback'
import { generateMockCaseRationale, isOpenAiMockModeEnabled } from './mock-mode'
import { buildCaseRationaleInput, caseRationaleInstructions } from './prompts'
import { sanitizeAiText } from './text-format'
import type { AiTextResult, CaseRationaleInput } from './types'

function fallbackCaseNarrative(input: CaseRationaleInput) {
  const drivers = input.primaryDrivers.slice(0, 3).map((driver) => `- ${driver}`).join('\n')
  return [
    `${input.accountName} is currently assessed as ${input.riskLevel.toLowerCase()} risk with a recommended action of ${input.recommendedAction.toLowerCase().replaceAll('_', ' ')}.` ,
    input.bundleSummaryText ?? 'The renewal recommendation is based on the current bundle-level commercial signals.',
    drivers || '- No additional drivers available.',
  ].join('\n\n')
}

export async function generateCaseRationale(input: CaseRationaleInput): Promise<AiTextResult> {
  const model = getAiModel()
  const instructions = caseRationaleInstructions()
  const promptInput = buildCaseRationaleInput(input)

  if (isOpenAiMockModeEnabled()) {
    return generateMockCaseRationale({
      model,
      instructions,
      promptInput,
      input,
    })
  }

  const aiRuntime = getAiClient()
  if (!aiRuntime) {
    return fallbackResult(fallbackCaseNarrative(input))
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
