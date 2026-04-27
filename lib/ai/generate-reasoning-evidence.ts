import { getAiModel, getOpenAIClient } from './client'
import { fallbackResult } from './fallback'
import { generateMockReasoningEvidence, isOpenAiMockModeEnabled } from './mock-mode'
import { buildReasoningEvidenceInput, reasoningInstructions } from './prompts'
import type { AiTextResult, ReasoningEvidenceInput } from './types'

function fallbackReasoning(input: ReasoningEvidenceInput) {
  const ruleEvidence = input.ruleSummary.slice(0, 2)
  const mlEvidence = input.mlSummary.slice(0, 2)
  const guardrails = input.guardrailSummary.slice(0, 2)
  const references = input.evidenceReferences.slice(0, 4)

  return [
    'Reasoning Summary',
    `${input.accountName} is currently ${input.riskLevel.toLowerCase()} risk with a final recommendation of ${input.recommendedAction.toLowerCase().replaceAll('_', ' ')}. This explanation summarizes structured rule, ML, quote, and guardrail evidence; it does not replace the decision engine.`,
    '',
    'Evidence Used',
    ...(ruleEvidence.length ? ruleEvidence.map((item) => `- Rules: ${item}`) : ['- Rules: No rule evidence supplied.']),
    ...(mlEvidence.length ? mlEvidence.map((item) => `- ML: ${item}`) : ['- ML: No ML evidence supplied.']),
    ...(references.length ? references.map((item) => `- Reference: ${item}`) : []),
    '',
    'Guardrail Position',
    guardrails.length
      ? guardrails.map((item) => `- ${item}`).join('\n')
      : `- ${input.approvalRequired ? 'Approval is required.' : 'No approval guardrail is active.'}`,
    '',
    'Reviewer Action',
    input.approvalRequired
      ? 'Validate the approval reason, quote deltas, and guardrail posture before final quote review.'
      : 'Validate the evidence and continue through normal quote review.',
  ].join('\n')
}

export async function generateReasoningEvidence(
  input: ReasoningEvidenceInput,
): Promise<AiTextResult> {
  const model = getAiModel()
  const instructions = reasoningInstructions()
  const promptInput = buildReasoningEvidenceInput(input)

  if (isOpenAiMockModeEnabled()) {
    return generateMockReasoningEvidence({
      model,
      instructions,
      promptInput,
      input,
    })
  }

  const client = getOpenAIClient()
  if (!client) {
    return fallbackResult(fallbackReasoning(input), 'local-reasoning-evidence-v1')
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
