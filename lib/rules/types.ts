export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type RecommendedAction =
  | 'RENEW_AS_IS'
  | 'RENEW_WITH_CONCESSION'
  | 'EXPAND'
  | 'ESCALATE'

export type RecommendedDisposition =
  | 'RENEW'
  | 'RENEW_WITH_CONCESSION'
  | 'EXPAND'
  | 'ESCALATE'
  | 'DROP'

export type PricingPosture =
  | 'HOLD_PRICE'
  | 'LIMITED_CONCESSION'
  | 'STRATEGIC_CONCESSION'
  | 'ESCALATE'

export type GuardrailResult =
  | 'WITHIN_POLICY'
  | 'APPROVAL_REQUIRED'
  | 'FLOOR_PRICE_EXCEPTION'
  | 'SEV1_ESCALATION'

export type PaymentRiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | string
export type AdoptionBand = 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' | string

export interface RuleAccount {
  id: string
  name: string
  segment: string
  healthScore: number | null
  npsBand: string | null
  openEscalationCount: number | null
}

export interface RuleSubscription {
  id: string
  subscriptionNumber: string
  productId: string
  renewalDate: Date | string
  quantity: number
  listUnitPrice: number
  netUnitPrice: number
  discountPercent: number
  arr: number
}

export interface RuleMetricSnapshot {
  id: string
  subscriptionId: string
  snapshotDate?: Date | string | null
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  paymentRiskBand: PaymentRiskBand | null
  adoptionBand: AdoptionBand | null
  notes?: string | null
}

export interface RulePricingPolicy {
  id: string
  name: string
  accountSegment: string
  productFamily: string
  maxAutoDiscountPercent: number
  approvalDiscountPercent: number
  floorPricePercentOfList: number
  expansionThresholdUsagePercent: number
  requiresEscalationIfSev1Count: number
}

export interface RuleProduct {
  id: string
  sku: string
  name: string
  productFamily: string
  chargeModel?: string | null
}

export interface RuleCaseItemInput {
  id: string
  subscription: RuleSubscription
  product: RuleProduct
  metricSnapshot?: RuleMetricSnapshot | null
  pricingPolicy?: RulePricingPolicy | null
}

export interface ItemRiskResult {
  itemId: string
  subscriptionId: string
  productId: string
  productName: string
  riskScore: number
  riskLevel: RiskLevel
  drivers: string[]
  recommendedDisposition: RecommendedDisposition
  recommendedDiscountPercent: number
  proposedQuantity: number
  proposedNetUnitPrice: number
  proposedArr: number
  approvalRequired: boolean
  guardrailResult: GuardrailResult
}

export interface BundleRiskResult {
  riskScore: number
  riskLevel: RiskLevel
  recommendedAction: RecommendedAction
  pricingPosture: PricingPosture
  approvalRequired: boolean
  bundleCurrentArr: number
  bundleProposedArr: number
  bundleDeltaArr: number
  primaryDrivers: string[]
  summaryText: string
}

export interface RenewalCaseEngineInput {
  account: RuleAccount
  items: RuleCaseItemInput[]
}

export interface RenewalCaseEngineOutput {
  itemResults: ItemRiskResult[]
  bundleResult: BundleRiskResult
}
