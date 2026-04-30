import type {
  ApprovalBriefInput,
  CaseRationaleInput,
  QuoteInsightRationaleInput,
  ReasoningEvidenceInput,
} from './types'

const plainTextOutputInstructions = [
  'Use plain text only.',
  'Do not use Markdown formatting, bold markers, tables, code fences, or decorative symbols.',
  'If bullets are requested, use simple hyphen bullets only.',
].join(' ')

export function caseRationaleInstructions() {
  return [
    'You are an enterprise SaaS renewal copilot.',
    'Write concise, executive-ready internal commercial guidance.',
    'Do not invent facts outside the supplied structured data.',
    'Be specific about renewal risk, guardrails, and why the recommendation makes sense.',
    'Keep the tone professional and reviewer-friendly.',
    plainTextOutputInstructions,
  ].join(' ')
}

export function caseExecutiveSummaryInstructions() {
  return [
    'You are an enterprise SaaS renewal copilot.',
    'Write a concise executive summary for a quote reviewer.',
    'Do not invent facts outside the supplied structured data.',
    'Keep the tone crisp, commercial, and decision-oriented.',
    plainTextOutputInstructions,
  ].join(' ')
}

export function buildCaseExecutiveSummaryInput(input: CaseRationaleInput) {
  return [
    `Account: ${input.accountName}`,
    `Segment: ${input.segment}`,
    `Industry: ${input.industry ?? 'Unknown'}`,
    `Risk level: ${input.riskLevel}`,
    `Recommended action: ${input.recommendedAction}`,
    `Approval required: ${input.approvalRequired ? 'Yes' : 'No'}`,
    `Bundle summary: ${input.bundleSummaryText ?? 'Not available'}`,
    `Primary drivers: ${input.primaryDrivers.join(' | ') || 'None supplied'}`,
    'Write exactly in this order:',
    'First, one paragraph of 3-5 sentences covering current renewal posture, commercial impact or risk, and reviewer takeaway.',
    'Then add exactly 2 plain hyphen bullets for the top drivers.',
    'Do not add headings.',
  ].join('\n')
}

export function buildCaseRationaleInput(input: CaseRationaleInput) {
  return [
    `Account: ${input.accountName}`,
    `Segment: ${input.segment}`,
    `Industry: ${input.industry ?? 'Unknown'}`,
    `Risk level: ${input.riskLevel}`,
    `Recommended action: ${input.recommendedAction}`,
    `Approval required: ${input.approvalRequired ? 'Yes' : 'No'}`,
    `Bundle summary: ${input.bundleSummaryText ?? 'Not available'}`,
    `Primary drivers: ${input.primaryDrivers.join(' | ') || 'None supplied'}`,
    'Item summaries:',
    ...input.itemSummaries.map(
      (item, idx) =>
        `${idx + 1}. ${item.productName} | disposition=${item.disposition} | risk=${item.riskLevel} | summary=${item.summary}`,
    ),
    'Write exactly in this order:',
    'First, 2 short paragraphs explaining why the recommendation is commercially defensible.',
    'Then add exactly 3 plain hyphen bullets for the strongest drivers.',
    'Do not add headings.',
  ].join('\n')
}

export function approvalBriefInstructions() {
  return [
    'You are preparing an internal approval brief for a renewal reviewer.',
    'Be concise, commercial, and decision-oriented.',
    'Do not invent pricing terms or policy details beyond what is supplied.',
    plainTextOutputInstructions,
  ].join(' ')
}

export function buildApprovalBriefInput(input: ApprovalBriefInput) {
  return [
    `Account: ${input.accountName}`,
    `Case number: ${input.caseNumber}`,
    `Recommended action: ${input.recommendedAction}`,
    `Risk level: ${input.riskLevel}`,
    `Approval reason: ${input.approvalReason ?? 'Not supplied'}`,
    `Current ARR: ${input.currentArrFormatted}`,
    `Proposed ARR: ${input.proposedArrFormatted}`,
    `Primary drivers: ${input.primaryDrivers.join(' | ') || 'None supplied'}`,
    'Write a short internal approval brief with exactly these heading lines: Situation, Why Approval Is Needed, Recommended Reviewer Posture.',
    'Use 1-2 concise sentences under each heading.',
  ].join('\n')
}

export function quoteInsightInstructions() {
  return [
    'You are writing a quote insight explanation for an enterprise renewal reviewer.',
    'Keep the language commercially useful and grounded in the supplied data.',
    'Focus on how the subscription signal translates into a quote insight and quote action for business users.',
    'Do not oversell or invent hard ROI numbers.',
    plainTextOutputInstructions,
    'Format output with exactly these heading lines: Decision, Why, Commercial Impact, What Changed.',
    'Each heading should have 1-2 short sentences.',
    'If no previous change context exists, state that there is no material change from prior insight.',
  ].join(' ')
}

export function buildQuoteInsightInput(input: QuoteInsightRationaleInput) {
  return [
    `Account: ${input.accountName}`,
    `Quote insight title: ${input.title}`,
    `Quote insight type: ${input.insightType}`,
    `Product: ${input.productName}`,
    `Insight summary: ${input.insightSummary}`,
    `Recommended action summary: ${input.recommendedActionSummary ?? 'Not supplied'}`,
    `Confidence score: ${input.confidenceScore ?? 'N/A'}`,
    `Fit score: ${input.fitScore ?? 'N/A'}`,
    `Reason codes: ${input.reasonCodes?.join(' | ') || 'Not supplied'}`,
    `Structured reasoning: ${input.structuredReasoning?.join(' | ') || 'Not supplied'}`,
    `Expected impact: ${input.expectedImpactSummary ?? 'Not supplied'}`,
    `What changed from previous insight: ${input.whatChangedSummary ?? 'No material change context supplied'}`,
    'Write business-ready copy with exactly these heading lines: Decision, Why, Commercial Impact, What Changed.',
  ].join('\n')
}

export function reasoningInstructions() {
  return [
    'You are an enterprise AI reasoning layer for a renewal decision system.',
    'Explain the decision using only the supplied structured evidence.',
    'Do not invent customer facts, pricing policy, ROI, discounts, or model behavior.',
    'Clearly separate rule evidence, ML evidence, guardrails, and final human-review posture.',
    'Do not present the AI text generator as the final decision maker.',
    plainTextOutputInstructions,
    'Format output with exactly these heading lines: Reasoning Summary, Evidence Used, Guardrail Position, Reviewer Action.',
    'Each heading should contain 1-3 concise sentences or bullets.',
  ].join(' ')
}

export function buildReasoningEvidenceInput(input: ReasoningEvidenceInput) {
  return [
    `Reasoning type: ${input.reasoningType}`,
    `Account: ${input.accountName}`,
    `Case number: ${input.caseNumber}`,
    `Recommendation mode: ${input.recommendationMode}`,
    `Scenario: ${input.scenarioKey ?? 'BASE_CASE'}`,
    `Final recommended action: ${input.recommendedAction}`,
    `Final risk level: ${input.riskLevel}`,
    `Approval required: ${input.approvalRequired ? 'Yes' : 'No'}`,
    `Approval reason: ${input.approvalReason ?? 'Not supplied'}`,
    `Rule evidence: ${input.ruleSummary.join(' | ') || 'Not supplied'}`,
    `ML evidence: ${input.mlSummary.join(' | ') || 'Not supplied'}`,
    `Final output: ${input.finalSummary.join(' | ') || 'Not supplied'}`,
    `Guardrails: ${input.guardrailSummary.join(' | ') || 'Not supplied'}`,
    `Quote insights: ${input.quoteInsightSummary.join(' | ') || 'Not supplied'}`,
    `Quote deltas: ${input.quoteDeltaSummary.join(' | ') || 'Not supplied'}`,
    `What changed: ${input.changeSummary.join(' | ') || 'Not supplied'}`,
    `Evidence references: ${input.evidenceReferences.join(' | ') || 'Not supplied'}`,
    'Write reviewer-ready reasoning. Keep it auditable and concise.',
  ].join('\n')
}
