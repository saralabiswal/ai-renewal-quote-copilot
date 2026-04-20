export type Tone = 'default' | 'info' | 'success' | 'warn' | 'danger'

export type QuoteDraftSummaryItem = {
  label: string
  value: string
}

export type QuoteLineTraceabilityView = {
  sourceType: string | null
  sourceInsightType: string | null
  sourceQuoteInsightId: string | null
  insightSummary: string | null
  aiExplanation: string | null
}

export type QuoteLineCommercialChangeView = {
  beforeNetUnitPriceFormatted: string | null
  afterNetUnitPriceFormatted: string | null
  netUnitPriceDeltaFormatted: string | null
  beforeDiscountPercentFormatted: string | null
  afterDiscountPercentFormatted: string | null
  discountDeltaFormatted: string | null
  beforeArrFormatted: string | null
  afterArrFormatted: string | null
  arrDeltaFormatted: string | null
}

export type QuoteDraftLineView = {
  id: string
  lineNumber: number
  productSku: string
  productName: string
  dispositionLabel: string | null
  dispositionTone: Tone
  quantity: number
  listUnitPriceFormatted: string
  netUnitPriceFormatted: string
  discountPercentFormatted: string | null
  lineNetAmountFormatted: string
  comment: string | null
  traceability: QuoteLineTraceabilityView
  commercialChange: QuoteLineCommercialChangeView | null
}

export type QuoteDraftDetailView = {
  id: string
  quoteNumber: string
  statusLabel: string
  statusTone: Tone
  summary: QuoteDraftSummaryItem[]
  lines: QuoteDraftLineView[]
  renewalCase: {
    id: string
    caseNumber: string
    accountName: string
  }
}

export type QuoteDraftListItem = {
  id: string
  quoteNumber: string
  quoteTrackLabel: string
  quoteTrackDescription: string
  caseId: string
  caseNumber: string
  accountName: string
  recommendedActionKey: string
  recommendedActionLabel: string
  recommendedActionTone: Tone
  storyLaneId: string
  storyLaneLabel: string
  storyLaneDescription: string
  storyLaneOrder: number
  windowLabel: string
  lineCount: number
  totalNetAmountFormatted: string
  approvalRequired: boolean
  statusLabel: string
  statusTone: Tone
  updatedAt: string
}
