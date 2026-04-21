import type {
  PolicyStudioExampleSeed,
  PricingPolicyView,
} from '@/lib/db/policies'

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export type WorkedExampleProductId = string

export const DEFAULT_WORKED_EXAMPLE_PRODUCT_OPTIONS: Array<{
  id: WorkedExampleProductId
  label: string
}> = [
  { id: 'fusion_apps', label: 'Oracle Fusion Applications (Default)' },
  { id: 'oci', label: 'Oracle Cloud Infrastructure (Default)' },
  { id: 'cpq', label: 'Oracle CPQ (Default)' },
]

type ExamplePreset = {
  id: WorkedExampleProductId
  label: string
  accountName: string
  subscriptionNumber: string
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

const PRESETS: Record<'fusion_apps' | 'oci' | 'cpq', ExamplePreset> = {
  fusion_apps: {
    id: 'fusion_apps',
    label: 'Oracle Fusion Applications (Default)',
    accountName: 'Apex Manufacturing Group',
    subscriptionNumber: 'SUB-ACCT-1001',
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
    label: 'Oracle Cloud Infrastructure (Default)',
    accountName: 'Vertex Industrial Systems',
    subscriptionNumber: 'SUB-ACCT-1004',
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
    label: 'Oracle CPQ (Default)',
    accountName: 'BluePeak Retail Holdings',
    subscriptionNumber: 'SUB-ACCT-1007',
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

type WorkedExampleSnapshotPoint = {
  snapshotDate: string
  usagePercentOfEntitlement: number
  activeUserPercent: number
  loginTrend30d: number
  ticketCount90d: number
  sev1Count90d: number
  csatScore: number
  paymentRiskBand: string
  adoptionBand: string
  notes: string | null
}

type WorkedExampleSourceInput = {
  id: string
  label: string
  accountName: string
  subscriptionNumber: string
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
  snapshots: WorkedExampleSnapshotPoint[]
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
  sourceContext: {
    label: string
    accountName: string
    subscriptionNumber: string
    snapshotCount: number
    snapshotWindowLabel: string
    latestSnapshotDate: string
  }
  signalTrend: {
    trendDirection: 'IMPROVING' | 'DETERIORATING' | 'MIXED'
    usageDelta: number
    activeUserDelta: number
    loginTrendDelta: number
    ticketDelta: number
    sev1Delta: number
    csatDelta: number
    timeline: WorkedExampleSnapshotPoint[]
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
    topContributors: WorkedExampleScoreStep[]
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

function compareSnapshotDate(a: WorkedExampleSnapshotPoint, b: WorkedExampleSnapshotPoint) {
  return new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()
}

function buildSourceFromPreset(preset: ExamplePreset): WorkedExampleSourceInput {
  const latestSnapshot: WorkedExampleSnapshotPoint = {
    snapshotDate: '2026-04-01',
    usagePercentOfEntitlement: preset.inputs.usagePercentOfEntitlement,
    activeUserPercent: preset.inputs.activeUserPercent,
    loginTrend30d: preset.inputs.loginTrend30d,
    ticketCount90d: preset.inputs.ticketCount90d,
    sev1Count90d: preset.inputs.sev1Count90d,
    csatScore: preset.inputs.csatScore,
    paymentRiskBand: preset.inputs.paymentRiskBand,
    adoptionBand: preset.inputs.adoptionBand,
    notes: null,
  }

  return {
    id: preset.id,
    label: preset.label,
    accountName: preset.accountName,
    subscriptionNumber: preset.subscriptionNumber,
    product: preset.product,
    inputs: preset.inputs,
    snapshots: [latestSnapshot],
  }
}

function buildSourceFromSeed(seed: PolicyStudioExampleSeed): WorkedExampleSourceInput {
  const timeline = [...seed.snapshots].sort(compareSnapshotDate)
  const latest = timeline[timeline.length - 1] ?? {
    snapshotDate: 'Unknown',
    usagePercentOfEntitlement: 0,
    activeUserPercent: 0,
    loginTrend30d: 0,
    ticketCount90d: 0,
    sev1Count90d: 0,
    csatScore: 0,
    paymentRiskBand: 'LOW',
    adoptionBand: 'MODERATE',
    notes: null,
  }

  return {
    id: seed.id,
    label: seed.label,
    accountName: seed.accountName,
    subscriptionNumber: seed.subscriptionNumber,
    product: seed.product,
    inputs: {
      currentQuantity: seed.subscription.quantity,
      listUnitPrice: seed.subscription.listUnitPrice,
      currentDiscountPercent: seed.subscription.discountPercent,
      currentArr: seed.subscription.arr,
      usagePercentOfEntitlement: latest.usagePercentOfEntitlement,
      activeUserPercent: latest.activeUserPercent,
      loginTrend30d: latest.loginTrend30d,
      ticketCount90d: latest.ticketCount90d,
      sev1Count90d: latest.sev1Count90d,
      csatScore: latest.csatScore,
      paymentRiskBand: latest.paymentRiskBand,
      adoptionBand: latest.adoptionBand,
    },
    snapshots: timeline,
  }
}

function computeSignalTrend(snapshots: WorkedExampleSnapshotPoint[]) {
  const ordered = [...snapshots].sort(compareSnapshotDate)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]

  if (!first || !last) {
    return {
      trendDirection: 'MIXED' as const,
      usageDelta: 0,
      activeUserDelta: 0,
      loginTrendDelta: 0,
      ticketDelta: 0,
      sev1Delta: 0,
      csatDelta: 0,
      timeline: ordered,
      snapshotWindowLabel: 'No snapshot history',
      latestSnapshotDate: 'Unknown',
    }
  }

  const usageDelta = round2(last.usagePercentOfEntitlement - first.usagePercentOfEntitlement)
  const activeUserDelta = round2(last.activeUserPercent - first.activeUserPercent)
  const loginTrendDelta = round2(last.loginTrend30d - first.loginTrend30d)
  const ticketDelta = round2(last.ticketCount90d - first.ticketCount90d)
  const sev1Delta = round2(last.sev1Count90d - first.sev1Count90d)
  const csatDelta = round2(last.csatScore - first.csatScore)

  let directionalScore = 0
  if (usageDelta > 0) directionalScore += 1
  if (activeUserDelta > 0) directionalScore += 1
  if (loginTrendDelta > 0) directionalScore += 1
  if (ticketDelta < 0) directionalScore += 1
  if (sev1Delta < 0) directionalScore += 1
  if (csatDelta > 0) directionalScore += 1

  if (usageDelta < 0) directionalScore -= 1
  if (activeUserDelta < 0) directionalScore -= 1
  if (loginTrendDelta < 0) directionalScore -= 1
  if (ticketDelta > 0) directionalScore -= 1
  if (sev1Delta > 0) directionalScore -= 1
  if (csatDelta < 0) directionalScore -= 1

  const trendDirection: 'IMPROVING' | 'DETERIORATING' | 'MIXED' =
    directionalScore >= 3 ? 'IMPROVING' : directionalScore <= -3 ? 'DETERIORATING' : 'MIXED'

  return {
    trendDirection,
    usageDelta,
    activeUserDelta,
    loginTrendDelta,
    ticketDelta,
    sev1Delta,
    csatDelta,
    timeline: ordered,
    snapshotWindowLabel: `${first.snapshotDate} to ${last.snapshotDate}`,
    latestSnapshotDate: last.snapshotDate,
  }
}

function buildWorkedPolicyExampleFromSource(
  policies: PricingPolicyView[],
  source: WorkedExampleSourceInput,
): WorkedExampleView {
  const { product, inputs } = source
  const signalTrend = computeSignalTrend(source.snapshots)

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

  if (inputs.paymentRiskBand.toUpperCase() === 'HIGH') {
    push('Payment Risk Band', 'HIGH', 15)
  } else if (inputs.paymentRiskBand.toUpperCase() === 'MEDIUM') {
    push('Payment Risk Band', 'MEDIUM', 8)
  } else {
    push('Payment Risk Band', inputs.paymentRiskBand, 0)
  }

  if (inputs.adoptionBand.toUpperCase() === 'WEAK' || inputs.adoptionBand.toUpperCase() === 'LOW') {
    push('Adoption Band', `${inputs.adoptionBand} (weak)`, 10)
  } else if (
    inputs.adoptionBand.toUpperCase() === 'MODERATE' ||
    inputs.adoptionBand.toUpperCase() === 'MEDIUM'
  ) {
    push('Adoption Band', `${inputs.adoptionBand} (moderate)`, 2)
  } else if (
    inputs.adoptionBand.toUpperCase() === 'STRONG' ||
    inputs.adoptionBand.toUpperCase() === 'HIGH'
  ) {
    push('Adoption Band', `${inputs.adoptionBand} (strong)`, -3)
  } else if (inputs.adoptionBand.toUpperCase() === 'VERY_STRONG') {
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
    targetDiscountPercent = Math.max(
      inputs.currentDiscountPercent,
      inputs.currentDiscountPercent + 3,
    )
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
    targetDiscountPercent = Math.max(
      inputs.currentDiscountPercent + 5,
      inputs.currentDiscountPercent,
    )
    proposedQuantity = inputs.currentQuantity
  }

  const proposedNetUnitPrice = round2(inputs.listUnitPrice * (1 - targetDiscountPercent / 100))
  const proposedArr = round2(proposedQuantity * proposedNetUnitPrice)
  const arrDelta = round2(proposedArr - inputs.currentArr)
  const priceAsPercentOfList =
    inputs.listUnitPrice === 0 ? 0 : round2((proposedNetUnitPrice / inputs.listUnitPrice) * 100)

  const checks: WorkedExampleGuardrailCheck[] = []
  let approvalRequired = false
  let finalGuardrailResult: WorkedExampleView['guardrails']['finalGuardrailResult'] =
    'WITHIN_POLICY'

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
    impact: exceedsMaxAutoDiscount ? 'Approval required' : 'Within auto-approval range',
  })

  const exceedsApprovalDiscount =
    targetDiscountPercent >= policyContext.approvalDiscountPercent
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

  const topContributors = [...scoringSteps]
    .filter((step) => step.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 4)

  return {
    product: {
      id: source.id,
      name: product.name,
      sku: product.sku,
      productFamily: product.productFamily,
      accountSegment: product.accountSegment,
    },
    sourceContext: {
      label: source.label,
      accountName: source.accountName,
      subscriptionNumber: source.subscriptionNumber,
      snapshotCount: source.snapshots.length,
      snapshotWindowLabel: signalTrend.snapshotWindowLabel,
      latestSnapshotDate: signalTrend.latestSnapshotDate,
    },
    signalTrend: {
      trendDirection: signalTrend.trendDirection,
      usageDelta: signalTrend.usageDelta,
      activeUserDelta: signalTrend.activeUserDelta,
      loginTrendDelta: signalTrend.loginTrendDelta,
      ticketDelta: signalTrend.ticketDelta,
      sev1Delta: signalTrend.sev1Delta,
      csatDelta: signalTrend.csatDelta,
      timeline: signalTrend.timeline,
    },
    policyContext,
    inputs,
    scoring: {
      steps: scoringSteps,
      topContributors,
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

export function buildWorkedPolicyExamplesFromSeeds(
  policies: PricingPolicyView[],
  seeds: PolicyStudioExampleSeed[],
): Record<WorkedExampleProductId, WorkedExampleView> {
  if (seeds.length === 0) {
    return buildWorkedPolicyExamples(policies)
  }

  return seeds.reduce<Record<WorkedExampleProductId, WorkedExampleView>>((acc, seed) => {
    acc[seed.id] = buildWorkedPolicyExampleFromSource(policies, buildSourceFromSeed(seed))
    return acc
  }, {})
}

export function buildWorkedPolicyExamples(
  policies: PricingPolicyView[],
): Record<WorkedExampleProductId, WorkedExampleView> {
  return {
    fusion_apps: buildWorkedPolicyExampleFromSource(
      policies,
      buildSourceFromPreset(PRESETS.fusion_apps),
    ),
    oci: buildWorkedPolicyExampleFromSource(policies, buildSourceFromPreset(PRESETS.oci)),
    cpq: buildWorkedPolicyExampleFromSource(policies, buildSourceFromPreset(PRESETS.cpq)),
  }
}

export function buildWorkedExampleOptionsFromSeeds(
  seeds: PolicyStudioExampleSeed[],
): Array<{ id: WorkedExampleProductId; label: string }> {
  if (seeds.length === 0) return DEFAULT_WORKED_EXAMPLE_PRODUCT_OPTIONS
  return seeds.map((seed) => ({
    id: seed.id,
    label: seed.label,
  }))
}

export function buildDefaultWorkedExamples(
  policies: PricingPolicyView[],
): Record<WorkedExampleProductId, WorkedExampleView> {
  return buildWorkedPolicyExamples(policies)
}
