export type Tone = 'default' | 'info' | 'success' | 'warn' | 'danger'

export type SummaryCard = {
  label: string
  value: string
  helperText?: string
}

export type RenewalCaseListItem = {
  id: string
  caseNumber: string
  accountName: string
  segment: string
  windowLabel: string
  recommendedActionKey: string
  recommendedActionLabel: string
  actionTone: Tone
  storyLaneId: string
  storyLaneLabel: string
  storyLaneDescription: string
  storyLaneOrder: number
  riskLevel: string
  riskTone: Tone
  bundleCurrentArrFormatted: string
  bundleProposedArrFormatted: string
  requiresApproval: boolean
  statusLabel: string
  statusTone: Tone
  itemCount: number
  quoteDraftId: string | null
  quoteNumber: string | null
  quoteTrackLabel: string
  quoteTrackDescription: string
}

export type RenewalSubscriptionBaselineListItem = {
  id: string
  caseId: string
  caseNumber: string
  accountName: string
  segment: string
  subscriptionNumber: string
  productName: string
  renewalDate: string
  quantity: number
  netUnitPriceFormatted: string
  baselineArrFormatted: string
  renewalWindowLabel: string
}

export type RenewalCaseAnalysisView = {
  recommendedActionLabel: string
  actionTone: Tone
  riskLevel: string
  riskTone: Tone
  pricingPostureLabel: string
  approvalRequired: boolean
  primaryDrivers: string[]
  bundleSummaryText: string | null
}

export type RenewalCaseItemView = {
  id: string
  productName: string
  subscriptionNumber: string
  renewalDate: string
  currentArrFormatted: string
  proposedArrFormatted: string
  arrDeltaFormatted: string
  dispositionLabel: string
  dispositionTone: Tone
  discountPercentFormatted: string
  recommendedDiscountPercent: number | null
  itemRiskScore: number | null
  riskLevel: string
  riskTone: Tone
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  paymentRiskBand: string | null
  adoptionBand: string | null
  signalNotes: string | null
  analysisSummary: string
}

export type RecommendationNarrativeView = {
  content: string
  modelLabel: string
}

export type ReviewDecisionView = {
  id: string
  decisionLabel: string
  decisionTone: Tone
  reviewerName: string
  comment: string | null
  createdAt: string
}

export type RecalculationMetaView = {
  analysisVersion: number | null
  generatedBy: string | null
  updatedAtLabel: string | null
  approvalRequired: boolean
  drivers: string[]
}

export type RecommendationStateSnapshot = {
  riskLevel: string | null
  recommendedAction: string | null
  requiresApproval: boolean | null
}

export type RecommendationDriverChange = {
  itemId: string
  productName: string
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  notes: string | null
}

export type RecommendationChangeView = {
  scenarioKey: string | null
  scenarioLabel: string | null
  previous: RecommendationStateSnapshot
  next: RecommendationStateSnapshot
  driverChanges: RecommendationDriverChange[]
  recalculatedAt: string | null
}

export type QuoteInsightDeltaView = {
  insightType: string
  productSkuSnapshot: string
  title: string | null
}

export type QuoteInsightModifiedView = {
  insightType: string
  productSkuSnapshot: string
  title: string | null
  changedFields: string[]
  previous: {
    title: string | null
    insightSummary: string | null
    recommendedActionSummary: string | null
    confidenceScore: number | null
    fitScore: number | null
    recommendedQuantity: number | null
    recommendedUnitPrice: number | null
    recommendedDiscountPercent: number | null
    estimatedArrImpact: number | null
  }
  next: {
    title: string | null
    insightSummary: string | null
    recommendedActionSummary: string | null
    confidenceScore: number | null
    fitScore: number | null
    recommendedQuantity: number | null
    recommendedUnitPrice: number | null
    recommendedDiscountPercent: number | null
    estimatedArrImpact: number | null
  }
}

export type QuoteInsightChangeView = {
  added: QuoteInsightDeltaView[]
  removed: QuoteInsightDeltaView[]
  modified: QuoteInsightModifiedView[]
  regeneratedAt: string | null
  scenarioKey: string | null
  decisionRunId?: string | null
  engineVersion?: string | null
  policyVersion?: string | null
  scenarioVersion?: string | null
}

export type RenewalCaseDetailView = {
  id: string
  caseNumber: string
  windowLabel: string
  demoScenarioKey: string
  account: {
    name: string
    industry: string | null
    segment: string
  }
  accountCurrencyCode: string
  recommendedActionLabel: string
  actionTone: Tone
  riskLevel: string
  riskTone: Tone
  summaryCards: SummaryCard[]
  analysis: RenewalCaseAnalysisView | null
  recalculationMeta: RecalculationMetaView
  items: RenewalCaseItemView[]
  narrative: RecommendationNarrativeView | null
  aiExecutiveSummary: RecommendationNarrativeView | null
  aiApprovalBrief: RecommendationNarrativeView | null
  reviewHistory: ReviewDecisionView[]
  whatChanged: {
    recommendation: RecommendationChangeView | null
    insights: QuoteInsightChangeView | null
  }
  quoteDraft: {
    id: string
    quoteNumber: string
    status: string
    totalNetAmountFormatted: string
  } | null
}
