export type Tone = 'default' | 'info' | 'success' | 'warn' | 'danger'

export type DashboardMetric = {
  label: string
  value: string
  helperText?: string
}

export type DashboardNeedsAttentionItem = {
  id: string
  caseNumber: string
  accountName: string
  scenarioLabel: string
  recommendedActionLabel: string
  riskLevel: string
  bundleProposedArrFormatted: string
  requiresApproval: boolean
}

export type DashboardCaseTableItem = {
  id: string
  caseNumber: string
  accountName: string
  scenarioLabel: string
  recommendedActionLabel: string
  riskLevel: string
  bundleCurrentArrFormatted: string
  bundleProposedArrFormatted: string
  requiresApproval: boolean
  statusLabel: string
}

export type DashboardRecentReviewActivityItem = {
  id: string
  decisionLabel: string
  accountName: string
  caseNumber: string
  reviewerName: string
  createdAtLabel: string
  comment: string | null
}

export type DashboardData = {
  metrics: DashboardMetric[]
  needsAttention: DashboardNeedsAttentionItem[]
  caseTable: DashboardCaseTableItem[]
  recentReviewActivity: DashboardRecentReviewActivityItem[]
}

export type DashboardCaseRow = DashboardCaseTableItem
export type RecentReviewActivityItem = DashboardRecentReviewActivityItem
export type DashboardView = DashboardData
