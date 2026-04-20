import { getAiModel, getOpenAIClient } from './client'
import { fallbackResult } from './fallback'
import {
  generateMockQuoteInsightRationale,
  isOpenAiMockModeEnabled,
} from './mock-mode'
import { buildQuoteInsightInput, quoteInsightInstructions } from './prompts'
import type { AiTextResult, QuoteInsightRationaleInput } from './types'

function fallbackQuoteInsightNarrative(input: QuoteInsightRationaleInput) {
  const confidence =
    input.confidenceScore != null && input.fitScore != null
      ? `Confidence ${input.confidenceScore}, fit ${input.fitScore}.`
      : 'Confidence and fit not fully supplied.'

  return [
    'Decision',
    input.recommendedActionSummary ?? 'Align quote with current recommendation.',
    '',
    'Why',
    input.insightSummary,
    '',
    'Commercial Impact',
    `${input.expectedImpactSummary ?? 'Use quote totals for precise commercial impact.'} ${confidence}`.trim(),
    '',
    'What Changed',
    input.whatChangedSummary ?? 'No material change from previous insight.',
  ].join('\n')
}

export async function generateQuoteInsightRationale(
  input: QuoteInsightRationaleInput,
): Promise<AiTextResult> {
  const model = getAiModel()
  const instructions = quoteInsightInstructions()
  const promptInput = buildQuoteInsightInput(input)

  if (isOpenAiMockModeEnabled()) {
    return generateMockQuoteInsightRationale({
      model,
      instructions,
      promptInput,
      input,
    })
  }

  const client = getOpenAIClient()
  if (!client) {
    return fallbackResult(fallbackQuoteInsightNarrative(input), 'quote-insight-fallback-v1')
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

/**
 * Temporary compatibility export while older imports are still being cleaned up.
 */
export const generateOpportunityRationale = generateQuoteInsightRationale
