export type AiGenerationMode = 'OPENAI' | 'FALLBACK'

export type CaseRationaleInput = {
  accountName: string
  segment: string
  industry: string | null
  riskLevel: string
  recommendedAction: string
  approvalRequired: boolean
  bundleSummaryText: string | null
  primaryDrivers: string[]
  itemSummaries: Array<{
    productName: string
    disposition: string
    riskLevel: string
    summary: string
  }>
}

export type ApprovalBriefInput = {
  accountName: string
  caseNumber: string
  recommendedAction: string
  riskLevel: string
  approvalReason: string | null
  primaryDrivers: string[]
  currentArrFormatted: string
  proposedArrFormatted: string
}

export type QuoteInsightRationaleInput = {
  accountName: string
  title: string
  insightType: string
  productName: string
  insightSummary: string
  recommendedActionSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  reasonCodes?: string[]
  structuredReasoning?: string[]
  whatChangedSummary?: string | null
  expectedImpactSummary?: string | null
}

/**
 * Temporary compatibility alias.
 * Keep this until all AI generation files are fully renamed from
 * Opportunity -> Quote Insight terminology.
 */
export type OpportunityRationaleInput = {
  accountName: string
  title: string
  opportunityType: string
  productName: string
  reasonSummary: string
  expectedValueSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
}

export type AiTextResult = {
  mode: AiGenerationMode
  modelLabel: string
  content: string
}
