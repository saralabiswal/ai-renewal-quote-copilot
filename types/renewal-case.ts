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
  scenarioQuoteCount: number
  quoteScenariosNeedRefresh: boolean
  quoteTrackLabel: string
  quoteTrackDescription: string
  latestDecisionRunMode: string | null
  latestDecisionRunMlMode: string | null
  latestDecisionRunMlStatus: string | null
  latestDecisionRunMlAffectsRecommendation: boolean | null
  latestDecisionRunMlModelName: string | null
  latestDecisionRunMlModelVersion: string | null
  latestDecisionRunMlBundleRiskScore: number | null
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
  ml: RecommendationChangeView['ml']
}

export type DecisionRunTraceView = {
  id: string
  runType: string
  mode: string
  status: string
  scenarioKey: string | null
  createdAt: string
  ruleEngineVersion: string | null
  policyVersion: string | null
  featureSchemaVersion: string | null
  evidenceSnapshotVersion: string | null
  mlMode: string | null
  mlModelName: string | null
  mlModelVersion: string | null
  ruleInputSummary: {
    itemCount: number
    accountSegment: string | null
  } | null
  featureSnapshotSummary: {
    featureSchemaVersion: string | null
    itemCount: number
    generatedAt: string | null
  } | null
  evidenceSummary: {
    evidenceSnapshotVersion: string | null
    signalCount: number
    completenessScore: number | null
    confidenceScore: number | null
    missingCount: number
    staleCount: number
  } | null
  candidateSummary: {
    ruleWinner: string | null
    allowedCandidates: string[]
    blockedCandidates: string[]
    candidateCount: number
  } | null
  validationSummary: {
    status: string | null
    proposalSource: string | null
    selectedCandidate: string | null
    acceptedCandidate: string | null
    fallbackUsed: boolean | null
    confidence: number | null
    checks: Array<{
      name: string
      status: string
      detail: string
    }>
    rejectionReasons: string[]
  } | null
  policyTraceSummary: {
    policyRuntimeVersion: string | null
    policyRegistryId: string | null
    artifactCount: number
    ruleHitCount: number
    appliedCount: number
    warningCount: number
    blockedCount: number
    approvalRequiredCount: number
    ruleHits: Array<{
      policyId: string
      ruleId: string
      scope: string
      subjectId: string
      outcome: string
      detail: string
    }>
  } | null
  llmShadowSummary: {
    critiqueStatus: string | null
    critiqueQuality: string | null
    rankingStatus: string | null
    rankingSelectedCandidate: string | null
    rankingAgreesWithRules: boolean | null
    promptVersion: string | null
    critiqueGeneratedBy: string | null
    rankingGeneratedBy: string | null
    modelLabel: string | null
    fallbackReason: string | null
  } | null
  quoteInsightCandidateSummary: {
    candidateCount: number
    acceptedCount: number
    rejectedCount: number
    validationStatus: string | null
    finalizerSource: string | null
    prioritizedCount: number
    approvalRequiredCount: number
    fallbackUsed: boolean | null
    checks: Array<{
      name: string
      status: string
      detail: string
    }>
  } | null
  replayVerificationSummary: {
    status: string
    deterministicReplaySupported: boolean
    checkCount: number
    failedCount: number
    warningCount: number
    replayedAction: string | null
    persistedRuleAction: string | null
    persistedFinalAction: string | null
    checks: Array<{
      name: string
      status: string
      detail: string
    }>
  } | null
  governanceSummary: {
    guardedModeAllowed: boolean | null
    minimumShadowPassRate: number | null
    roleControls: string[]
    driftMonitors: string[]
  } | null
  telemetrySummary: {
    llmShadowPassRate: number | null
    validationRejected: boolean | null
    fallbackUsed: boolean | null
    staleEvidenceRate: number | null
    policyWarningCount: number | null
    policyBlockedCount: number | null
  } | null
  finalizerSummary: {
    mode: string | null
    ruleWinner: string | null
    llmSelectedCandidate: string | null
    acceptedCandidate: string | null
    finalCandidate: string | null
    finalStateSource: string | null
    recommendationOverrideApplied: boolean | null
    fallbackUsed: boolean | null
    fallbackReason: string | null
    checks: Array<{
      name: string
      status: string
      detail: string
    }>
  } | null
  ruleOutputSummary: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    approvalRequired: boolean | null
  } | null
  mlOutputSummary: {
    status: string | null
    mode: string | null
    modelName: string | null
    modelVersion: string | null
    generatedAt: string | null
    bundleRiskScore: number | null
    itemPredictionCount: number
    error: string | null
    itemPredictions: Array<{
      itemId: string
      riskScore: number | null
      riskProbability: number | null
      expansionScore: number | null
      expansionProbability: number | null
      topFeatures: string[]
    }>
  } | null
  finalOutputSummary: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    approvalRequired: boolean | null
  } | null
  guardrailSummary: {
    approvalRequiredCount: number
    guardrailResults: string[]
  } | null
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
  ruleBaseline?: {
    riskScore: number | null
    riskLevel: string | null
    recommendedAction: string | null
    requiresApproval: boolean | null
  } | null
  ml?: {
    mode: string
    status: string
    affectsRecommendation: boolean
    modelName: string | null
    modelVersion: string | null
    bundleRiskScore: number | null
    error: string | null
    itemPredictions: Array<{
      itemId: string
      riskScore: number | null
      riskProbability: number | null
      expansionScore: number | null
      expansionProbability: number | null
      topFeatures: string[]
    }>
  } | null
  driverChanges: RecommendationDriverChange[]
  decisionRunId?: string | null
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
  latestDecisionRun: DecisionRunTraceView | null
  items: RenewalCaseItemView[]
  narrative: RecommendationNarrativeView | null
  aiExecutiveSummary: RecommendationNarrativeView | null
  aiApprovalBrief: RecommendationNarrativeView | null
  reasoningRecommendation: RecommendationNarrativeView | null
  reasoningDecisionTrace: RecommendationNarrativeView | null
  reasoningApproval: RecommendationNarrativeView | null
  reasoningWhatChanged: RecommendationNarrativeView | null
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
