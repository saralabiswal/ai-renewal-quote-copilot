import type { PricingPolicyView } from '@/lib/db/policies'

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export type WorkedExampleProductId = 'fusion_apps' | 'oci' | 'cpq'

export const WORKED_EXAMPLE_PRODUCT_OPTIONS: Array<{
  id: WorkedExampleProductId
  label: string
}> = [
  { id: 'fusion_apps', label: 'Oracle Fusion Applications' },
  { id: 'oci', label: 'Oracle Cloud Infrastructure (OCI)' },
  { id: 'cpq', label: 'Oracle CPQ' },
]

type ExamplePreset = {
  id: WorkedExampleProductId
  product: {
    name: string
    sku: string
    productFamily: string
    accountSegment: string
  }
  inputs: {
    currentQuantity: number
    listUnitPrice: number
    currentDiscountPercent: number
    currentArr: number
    usagePercentOfEntitlement: number
    activeUserPercent: number
    loginTrend30d: number
    ticketCount90d: number
    sev1Count90d: number
    csatScore: number
    paymentRiskBand: string
    adoptionBand: string
  }
}

const PRESETS: Record<WorkedExampleProductId, ExamplePreset> = {
  fusion_apps: {
    id: 'fusion_apps',
    product: {
      name: 'Oracle Fusion Applications',
      sku: 'ORCL-FUSION-APPS',
      productFamily: 'Applications',
      accountSegment: 'ENTERPRISE',
    },
    inputs: {
      currentQuantity: 1,
      listUnitPrice: 179550,
      currentDiscountPercent: 10.4,
      currentArr: 160876.8,
      usagePercentOfEntitlement: 92,
      activeUserPercent: 86,
      loginTrend30d: 9,
      ticketCount90d: 2,
      sev1Count90d: 0,
      csatScore: 4.7,
      paymentRiskBand: 'LOW',
      adoptionBand: 'VERY_STRONG',
    },
  },
  oci: {
    id: 'oci',
    product: {
      name: 'Oracle Cloud Infrastructure',
      sku: 'ORCL-OCI',
      productFamily: 'Infrastructure',
      accountSegment: 'ENTERPRISE',
    },
    inputs: {
      currentQuantity: 1,
      listUnitPrice: 151300,
      currentDiscountPercent: 11.5,
      currentArr: 133900.5,
      usagePercentOfEntitlement: 50,
      activeUserPercent: 54,
      loginTrend30d: -11,
      ticketCount90d: 10,
      sev1Count90d: 1,
      csatScore: 3.1,
      paymentRiskBand: 'LOW',
      adoptionBand: 'MODERATE',
    },
  },
  cpq: {
    id: 'cpq',
    product: {
      name: 'Oracle CPQ',
      sku: 'ORCL-CPQ',
      productFamily: 'Revenue Operations',
      accountSegment: 'ENTERPRISE',
    },
    inputs: {
      currentQuantity: 200,
      listUnitPrice: 336.34,
      currentDiscountPercent: 12.5,
      currentArr: 58860,
      usagePercentOfEntitlement: 30,
      activeUserPercent: 25,
      loginTrend30d: -15,
      ticketCount90d: 22,
      sev1Count90d: 3,
      csatScore: 2.9,
      paymentRiskBand: 'HIGH',
      adoptionBand: 'WEAK',
    },
  },
}

export type WorkedExampleScoreStep = {
  signal: string
  observedValue: string
  points: number
  runningScore: number
}

export type WorkedExampleGuardrailCheck = {
  check: string
  formula: string
  outcome: 'PASS' | 'TRIGGERED'
  impact: string
}

export type WorkedExampleView = {
  product: {
    id: WorkedExampleProductId
    name: string
    sku: string
    productFamily: string
    accountSegment: string
  }
  policyContext: {
    matchedPolicyName: string
    matchingRule: string
    maxAutoDiscountPercent: number
    approvalDiscountPercent: number
    floorPricePercentOfList: number
    expansionThresholdUsagePercent: number
    requiresEscalationIfSev1Count: number
  }
  inputs: {
    currentQuantity: number
    listUnitPrice: number
    currentDiscountPercent: number
    currentArr: number
    usagePercentOfEntitlement: number
    activeUserPercent: number
    loginTrend30d: number
    ticketCount90d: number
    sev1Count90d: number
    csatScore: number
    paymentRiskBand: string
    adoptionBand: string
  }
  scoring: {
    steps: WorkedExampleScoreStep[]
    finalRiskScore: number
    finalRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  recommendation: {
    disposition: 'RENEW' | 'RENEW_WITH_CONCESSION' | 'EXPAND' | 'ESCALATE'
    ruleTriggered: string
    targetDiscountPercent: number
    proposedQuantity: number
    proposedNetUnitPrice: number
    proposedArr: number
    arrDelta: number
  }
  guardrails: {
    checks: WorkedExampleGuardrailCheck[]
    approvalRequired: boolean
    finalGuardrailResult:
      | 'WITHIN_POLICY'
      | 'APPROVAL_REQUIRED'
      | 'FLOOR_PRICE_EXCEPTION'
      | 'SEV1_ESCALATION'
  }
  quoteInsight: {
    insightType: string
    mappingRule: string
    confidenceScore: number
    fitScore: number
    incrementalQuantity: number
    estimatedArrImpact: number
  }
}

function mapDispositionToInsight(
  disposition: WorkedExampleView['recommendation']['disposition'],
) {
  switch (disposition) {
    case 'EXPAND':
      return {
        insightType: 'EXPANSION',
        mappingRule: 'Disposition EXPAND -> insightType EXPANSION',
      }
    case 'ESCALATE':
      return {
        insightType: 'DEFENSIVE_RENEWAL',
        mappingRule: 'Disposition ESCALATE -> insightType DEFENSIVE_RENEWAL',
      }
    case 'RENEW_WITH_CONCESSION':
      return {
        insightType: 'CONCESSION',
        mappingRule: 'Disposition RENEW_WITH_CONCESSION -> insightType CONCESSION',
      }
    case 'RENEW':
    default:
      return {
        insightType: 'RENEW_AS_IS',
        mappingRule: 'Default mapping -> insightType RENEW_AS_IS',
      }
  }
}

export function buildWorkedPolicyExample(
  policies: PricingPolicyView[],
  productId: WorkedExampleProductId,
): WorkedExampleView {
  const preset = PRESETS[productId]
  const { product, inputs } = preset

  const matchedPolicy =
    policies.find(
      (policy) =>
        policy.isActive &&
        policy.accountSegment === product.accountSegment &&
        policy.productFamily === product.productFamily,
    ) ?? null

  const policyContext = {
    matchedPolicyName: matchedPolicy?.name ?? 'Default Engine Fallback',
    matchingRule: matchedPolicy
      ? `Matched on segment ${product.accountSegment} and family ${matchedPolicy.productFamilyLabel}`
      : 'No exact segment+family policy match. Engine fallback thresholds are used.',
    maxAutoDiscountPercent: matchedPolicy?.maxAutoDiscountPercent ?? 12,
    approvalDiscountPercent: matchedPolicy?.approvalDiscountPercent ?? 15,
    floorPricePercentOfList: matchedPolicy?.floorPricePercentOfList ?? 80,
    expansionThresholdUsagePercent: matchedPolicy?.expansionThresholdUsagePercent ?? 90,
    requiresEscalationIfSev1Count: matchedPolicy?.requiresEscalationIfSev1Count ?? 99,
  }

  const scoringSteps: WorkedExampleScoreStep[] = []
  let runningScore = 0

  function push(signal: string, observedValue: string, points: number) {
    runningScore += points
    scoringSteps.push({
      signal,
      observedValue,
      points,
      runningScore,
    })
  }

  if (inputs.usagePercentOfEntitlement < 35) {
    push('Usage Signal', `${inputs.usagePercentOfEntitlement}% (< 35%)`, 28)
  } else if (inputs.usagePercentOfEntitlement < 55) {
    push('Usage Signal', `${inputs.usagePercentOfEntitlement}% (35-54%)`, 16)
  } else if (inputs.usagePercentOfEntitlement > 90) {
    push('Usage Signal', `${inputs.usagePercentOfEntitlement}% (> 90%)`, -8)
  } else if (inputs.usagePercentOfEntitlement > 75) {
    push('Usage Signal', `${inputs.usagePercentOfEntitlement}% (> 75%)`, -4)
  } else {
    push('Usage Signal', `${inputs.usagePercentOfEntitlement}%`, 0)
  }

  if (inputs.activeUserPercent < 35) {
    push('Active User Penetration', `${inputs.activeUserPercent}% (< 35%)`, 16)
  } else if (inputs.activeUserPercent > 80) {
    push('Active User Penetration', `${inputs.activeUserPercent}% (> 80%)`, -5)
  } else {
    push('Active User Penetration', `${inputs.activeUserPercent}%`, 0)
  }

  if (inputs.loginTrend30d <= -10) {
    push('Login Trend (30d)', `${inputs.loginTrend30d}% (<= -10%)`, 12)
  } else if (inputs.loginTrend30d >= 8) {
    push('Login Trend (30d)', `${inputs.loginTrend30d}% (>= +8%)`, -4)
  } else {
    push('Login Trend (30d)', `${inputs.loginTrend30d}%`, 0)
  }

  if (inputs.ticketCount90d >= 20) {
    push('Support Tickets (90d)', `${inputs.ticketCount90d} (>= 20)`, 15)
  } else if (inputs.ticketCount90d >= 10) {
    push('Support Tickets (90d)', `${inputs.ticketCount90d} (10-19)`, 8)
  } else if (inputs.ticketCount90d <= 3) {
    push('Support Tickets (90d)', `${inputs.ticketCount90d} (<= 3)`, -3)
  } else {
    push('Support Tickets (90d)', `${inputs.ticketCount90d}`, 0)
  }

  if (inputs.sev1Count90d >= 3) {
    push('Sev1 Incidents (90d)', `${inputs.sev1Count90d} (>= 3)`, 22)
  } else if (inputs.sev1Count90d >= 1) {
    push('Sev1 Incidents (90d)', `${inputs.sev1Count90d} (1-2)`, 10)
  } else {
    push('Sev1 Incidents (90d)', `${inputs.sev1Count90d}`, 0)
  }

  if (inputs.csatScore > 0 && inputs.csatScore < 3.3) {
    push('CSAT', `${inputs.csatScore.toFixed(1)} (< 3.3)`, 12)
  } else if (inputs.csatScore >= 4.5) {
    push('CSAT', `${inputs.csatScore.toFixed(1)} (>= 4.5)`, -4)
  } else {
    push('CSAT', `${inputs.csatScore.toFixed(1)}`, 0)
  }

  if (inputs.paymentRiskBand === 'HIGH') {
    push('Payment Risk Band', 'HIGH', 15)
  } else if (inputs.paymentRiskBand === 'MEDIUM') {
    push('Payment Risk Band', 'MEDIUM', 8)
  } else {
    push('Payment Risk Band', inputs.paymentRiskBand, 0)
  }

  if (inputs.adoptionBand === 'WEAK' || inputs.adoptionBand === 'LOW') {
    push('Adoption Band', `${inputs.adoptionBand} (weak)`, 10)
  } else if (inputs.adoptionBand === 'MODERATE' || inputs.adoptionBand === 'MEDIUM') {
    push('Adoption Band', `${inputs.adoptionBand} (moderate)`, 2)
  } else if (inputs.adoptionBand === 'STRONG' || inputs.adoptionBand === 'HIGH') {
    push('Adoption Band', `${inputs.adoptionBand} (strong)`, -3)
  } else if (inputs.adoptionBand === 'VERY_STRONG') {
    push('Adoption Band', 'VERY_STRONG', -6)
  } else {
    push('Adoption Band', inputs.adoptionBand, 0)
  }

  const finalRiskScore = Math.max(0, Math.min(100, runningScore))
  const finalRiskLevel = finalRiskScore >= 70 ? 'HIGH' : finalRiskScore >= 40 ? 'MEDIUM' : 'LOW'

  let disposition: WorkedExampleView['recommendation']['disposition'] = 'RENEW'
  let ruleTriggered = 'Default renew rule.'
  let targetDiscountPercent = inputs.currentDiscountPercent
  let proposedQuantity = inputs.currentQuantity

  if (finalRiskScore >= 80 || inputs.sev1Count90d >= 3) {
    disposition = 'ESCALATE'
    ruleTriggered = 'Risk >= 80 OR Sev1 >= 3 -> ESCALATE.'
    targetDiscountPercent = Math.max(inputs.currentDiscountPercent, inputs.currentDiscountPercent + 3)
    proposedQuantity = Math.max(Math.round(inputs.currentQuantity * 0.9), 1)
  } else if (
    inputs.usagePercentOfEntitlement >= policyContext.expansionThresholdUsagePercent &&
    finalRiskScore < 40
  ) {
    disposition = 'EXPAND'
    ruleTriggered = `Usage >= ${policyContext.expansionThresholdUsagePercent}% AND risk < 40 -> EXPAND.`
    targetDiscountPercent = Math.max(inputs.currentDiscountPercent - 2, 0)
    proposedQuantity = Math.max(
      Math.round(inputs.currentQuantity * 1.1),
      inputs.currentQuantity + 1,
    )
  } else if (finalRiskScore >= 55) {
    disposition = 'RENEW_WITH_CONCESSION'
    ruleTriggered = 'Risk >= 55 -> renew with concession.'
    targetDiscountPercent = Math.max(inputs.currentDiscountPercent + 5, inputs.currentDiscountPercent)
    proposedQuantity = inputs.currentQuantity
  }

  const proposedNetUnitPrice = round2(inputs.listUnitPrice * (1 - targetDiscountPercent / 100))
  const proposedArr = round2(proposedQuantity * proposedNetUnitPrice)
  const arrDelta = round2(proposedArr - inputs.currentArr)
  const priceAsPercentOfList =
    inputs.listUnitPrice === 0
      ? 0
      : round2((proposedNetUnitPrice / inputs.listUnitPrice) * 100)

  const checks: WorkedExampleGuardrailCheck[] = []
  let approvalRequired = false
  let finalGuardrailResult: WorkedExampleView['guardrails']['finalGuardrailResult'] = 'WITHIN_POLICY'

  const exceedsMaxAutoDiscount = targetDiscountPercent > policyContext.maxAutoDiscountPercent
  if (exceedsMaxAutoDiscount) {
    approvalRequired = true
    finalGuardrailResult = 'APPROVAL_REQUIRED'
  }
  checks.push({
    check: 'Max Auto Discount',
    formula: `${round2(targetDiscountPercent)}% ${
      exceedsMaxAutoDiscount ? '>' : '<='
    } ${policyContext.maxAutoDiscountPercent}%`,
    outcome: exceedsMaxAutoDiscount ? 'TRIGGERED' : 'PASS',
    impact:
      exceedsMaxAutoDiscount ? 'Approval required' : 'Within auto-approval range',
  })

  const exceedsApprovalDiscount = targetDiscountPercent >= policyContext.approvalDiscountPercent
  if (exceedsApprovalDiscount) {
    approvalRequired = true
    finalGuardrailResult = 'APPROVAL_REQUIRED'
  }
  checks.push({
    check: 'Approval Discount Threshold',
    formula: `${round2(targetDiscountPercent)}% ${
      exceedsApprovalDiscount ? '>=' : '<'
    } ${policyContext.approvalDiscountPercent}%`,
    outcome: exceedsApprovalDiscount ? 'TRIGGERED' : 'PASS',
    impact: exceedsApprovalDiscount ? 'Approval required' : 'Not triggered',
  })

  const belowFloorPrice = priceAsPercentOfList < policyContext.floorPricePercentOfList
  if (belowFloorPrice) {
    approvalRequired = true
    finalGuardrailResult = 'FLOOR_PRICE_EXCEPTION'
  }
  checks.push({
    check: 'Floor Price Check',
    formula: `${priceAsPercentOfList}% ${
      belowFloorPrice ? '<' : '>='
    } ${policyContext.floorPricePercentOfList}% of list`,
    outcome: belowFloorPrice ? 'TRIGGERED' : 'PASS',
    impact: belowFloorPrice ? 'Floor exception' : 'Floor preserved',
  })

  const requiresSev1Escalation =
    inputs.sev1Count90d >= policyContext.requiresEscalationIfSev1Count
  if (requiresSev1Escalation) {
    approvalRequired = true
    finalGuardrailResult = 'SEV1_ESCALATION'
  }
  checks.push({
    check: 'Sev1 Escalation',
    formula: `${inputs.sev1Count90d} ${
      requiresSev1Escalation ? '>=' : '<'
    } ${policyContext.requiresEscalationIfSev1Count}`,
    outcome: requiresSev1Escalation ? 'TRIGGERED' : 'PASS',
    impact: requiresSev1Escalation ? 'Escalation required' : 'No escalation trigger',
  })

  const insightMapping = mapDispositionToInsight(disposition)
  const confidenceScore = Math.max(50, Math.min(95, Math.round(100 - finalRiskScore / 2)))
  const fitScore = Math.max(50, Math.min(95, Math.round(100 - finalRiskScore / 3)))
  const incrementalQuantity = Math.max(proposedQuantity - inputs.currentQuantity, 0)
  const estimatedArrImpact =
    insightMapping.insightType === 'EXPANSION'
      ? round2(proposedNetUnitPrice * incrementalQuantity)
      : round2(proposedArr - inputs.currentArr)

  return {
    product: {
      id: preset.id,
      name: product.name,
      sku: product.sku,
      productFamily: product.productFamily,
      accountSegment: product.accountSegment,
    },
    policyContext,
    inputs,
    scoring: {
      steps: scoringSteps,
      finalRiskScore,
      finalRiskLevel,
    },
    recommendation: {
      disposition,
      ruleTriggered,
      targetDiscountPercent: round2(targetDiscountPercent),
      proposedQuantity,
      proposedNetUnitPrice,
      proposedArr,
      arrDelta,
    },
    guardrails: {
      checks,
      approvalRequired,
      finalGuardrailResult,
    },
    quoteInsight: {
      insightType: insightMapping.insightType,
      mappingRule: insightMapping.mappingRule,
      confidenceScore,
      fitScore,
      incrementalQuantity,
      estimatedArrImpact,
    },
  }
}

export function buildWorkedPolicyExamples(
  policies: PricingPolicyView[],
): Record<WorkedExampleProductId, WorkedExampleView> {
  return {
    fusion_apps: buildWorkedPolicyExample(policies, 'fusion_apps'),
    oci: buildWorkedPolicyExample(policies, 'oci'),
    cpq: buildWorkedPolicyExample(policies, 'cpq'),
  }
}
