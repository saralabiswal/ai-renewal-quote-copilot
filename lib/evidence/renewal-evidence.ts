import { toNumber } from '@/lib/rules/helpers'
import type { RenewalCaseEngineInput, RenewalCaseEngineOutput } from '@/lib/rules/types'

export const EVIDENCE_SNAPSHOT_VERSION = 'renewal-evidence-v1'
export const SIGNAL_DEFINITION_VERSION = 'signal-definitions-v1'

export type EvidenceFreshnessStatus = 'CURRENT' | 'STALE' | 'MISSING' | 'NOT_APPLICABLE'

export type EvidenceSignalObservation = {
  evidenceRef: string
  subjectType: 'ACCOUNT' | 'RENEWAL_CASE_ITEM' | 'SUBSCRIPTION' | 'PRODUCT' | 'PRICING_POLICY'
  subjectId: string
  signalKey: string
  label: string
  value: string | number | boolean | null
  unit: string | null
  sourceSystem: string
  observedAt: string | null
  freshnessStatus: EvidenceFreshnessStatus
  confidence: number
  lineage: string
}

export type SignalDefinitionContract = {
  signalKey: string
  label: string
  dataType: 'STRING' | 'NUMBER' | 'BOOLEAN'
  unit: string | null
  validRange: { min?: number; max?: number; values?: string[] } | null
  freshnessWindowDays: number | null
  sourceCategory: string
  description: string
}

export type RenewalEvidenceSnapshot = {
  evidenceSnapshotVersion: typeof EVIDENCE_SNAPSHOT_VERSION
  generatedAt: string
  scenarioKey: string
  quality: {
    signalCount: number
    currentCount: number
    staleCount: number
    missingCount: number
    completenessScore: number
    confidenceScore: number
  }
  account: {
    id: string
    segment: string
    healthScore: number | null
    openEscalationCount: number | null
  }
  signals: EvidenceSignalObservation[]
}

const STALE_SIGNAL_DAYS = 45

function dataTypeFor(value: EvidenceSignalObservation['value']): SignalDefinitionContract['dataType'] {
  if (typeof value === 'number') return 'NUMBER'
  if (typeof value === 'boolean') return 'BOOLEAN'
  return 'STRING'
}

function sourceCategoryFor(subjectType: EvidenceSignalObservation['subjectType']) {
  switch (subjectType) {
    case 'ACCOUNT':
      return 'ACCOUNT_PROFILE'
    case 'RENEWAL_CASE_ITEM':
    case 'SUBSCRIPTION':
      return 'SUBSCRIPTION_TELEMETRY'
    case 'PRODUCT':
      return 'PRODUCT_CATALOG'
    case 'PRICING_POLICY':
      return 'POLICY'
  }
}

function validRangeFor(signal: EvidenceSignalObservation): SignalDefinitionContract['validRange'] {
  if (signal.unit === 'percent') return { min: 0, max: 100 }
  if (signal.unit === 'score' && typeof signal.value === 'number') {
    return signal.signalKey.includes('csat') ? { min: 1, max: 5 } : { min: 0, max: 100 }
  }
  if (signal.signalKey.includes('payment_risk_band')) return { values: ['LOW', 'MEDIUM', 'HIGH'] }
  if (signal.signalKey.includes('adoption_band')) {
    return { values: ['WEAK', 'MODERATE', 'STRONG', 'VERY_STRONG'] }
  }
  return null
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function daysOld(value: Date | string | null | undefined, now: Date) {
  const observedAt = isoDate(value)
  if (!observedAt) return null
  return Math.floor((now.getTime() - new Date(observedAt).getTime()) / (1000 * 60 * 60 * 24))
}

function freshnessFor(value: unknown, observedAt: Date | string | null | undefined, now: Date) {
  if (value === null || value === undefined || value === '') return 'MISSING'
  const age = daysOld(observedAt, now)
  if (age != null && age > STALE_SIGNAL_DAYS) return 'STALE'
  return 'CURRENT'
}

function confidenceFor(freshnessStatus: EvidenceFreshnessStatus) {
  switch (freshnessStatus) {
    case 'CURRENT':
      return 0.95
    case 'STALE':
      return 0.55
    case 'MISSING':
      return 0
    case 'NOT_APPLICABLE':
      return 0.7
  }
}

function signal(args: Omit<EvidenceSignalObservation, 'confidence'>): EvidenceSignalObservation {
  return {
    ...args,
    confidence: confidenceFor(args.freshnessStatus),
  }
}

export function evidenceSummary(snapshot: RenewalEvidenceSnapshot) {
  return {
    evidenceSnapshotVersion: snapshot.evidenceSnapshotVersion,
    signalCount: snapshot.quality.signalCount,
    completenessScore: snapshot.quality.completenessScore,
    confidenceScore: snapshot.quality.confidenceScore,
    missingCount: snapshot.quality.missingCount,
    staleCount: snapshot.quality.staleCount,
  }
}

export function signalDefinitionsForSnapshot(
  snapshot: RenewalEvidenceSnapshot,
): SignalDefinitionContract[] {
  const byKey = new Map<string, SignalDefinitionContract>()

  for (const signal of snapshot.signals) {
    if (byKey.has(signal.signalKey)) continue
    byKey.set(signal.signalKey, {
      signalKey: signal.signalKey,
      label: signal.label,
      dataType: dataTypeFor(signal.value),
      unit: signal.unit,
      validRange: validRangeFor(signal),
      freshnessWindowDays:
        signal.subjectType === 'ACCOUNT' || signal.subjectType === 'PRICING_POLICY'
          ? null
          : STALE_SIGNAL_DAYS,
      sourceCategory: sourceCategoryFor(signal.subjectType),
      description: `${signal.label} used by renewal decisioning evidence snapshot.`,
    })
  }

  return [...byKey.values()]
}

export function buildRenewalEvidenceSnapshot(args: {
  input: RenewalCaseEngineInput
  ruleOutput: RenewalCaseEngineOutput
  finalOutput: RenewalCaseEngineOutput
  scenarioKey: string
}): RenewalEvidenceSnapshot {
  const now = new Date()
  const generatedAt = now.toISOString()
  const signals: EvidenceSignalObservation[] = []

  const account = args.input.account
  const accountSignals = [
    {
      key: 'account.segment',
      label: 'Account Segment',
      value: account.segment,
      unit: null,
    },
    {
      key: 'account.health_score',
      label: 'Account Health Score',
      value: account.healthScore,
      unit: 'score',
    },
    {
      key: 'account.open_escalation_count',
      label: 'Open Escalation Count',
      value: account.openEscalationCount,
      unit: 'count',
    },
  ]

  for (const item of accountSignals) {
    const freshnessStatus = item.value == null ? 'MISSING' : 'CURRENT'
    signals.push(
      signal({
        evidenceRef: item.key,
        subjectType: 'ACCOUNT',
        subjectId: account.id,
        signalKey: item.key,
        label: item.label,
        value: item.value,
        unit: item.unit,
        sourceSystem: 'Account Profile',
        observedAt: generatedAt,
        freshnessStatus,
        lineage: 'RenewalCase.account',
      }),
    )
  }

  const ruleItemById = new Map(args.ruleOutput.itemResults.map((item) => [item.itemId, item]))
  const finalItemById = new Map(args.finalOutput.itemResults.map((item) => [item.itemId, item]))

  for (const item of args.input.items) {
    const metric = item.metricSnapshot
    const observedAt = metric?.snapshotDate ?? null
    const metricSignals = [
      {
        key: 'usage_percent',
        label: 'Usage Percent of Entitlement',
        value: metric?.usagePercentOfEntitlement ?? null,
        unit: 'percent',
      },
      {
        key: 'active_user_percent',
        label: 'Active User Percent',
        value: metric?.activeUserPercent ?? null,
        unit: 'percent',
      },
      {
        key: 'login_trend_30d',
        label: 'Login Trend 30d',
        value: metric?.loginTrend30d ?? null,
        unit: 'percent_change',
      },
      {
        key: 'ticket_count_90d',
        label: 'Ticket Count 90d',
        value: metric?.ticketCount90d ?? null,
        unit: 'count',
      },
      {
        key: 'sev1_count_90d',
        label: 'Sev1 Count 90d',
        value: metric?.sev1Count90d ?? null,
        unit: 'count',
      },
      {
        key: 'csat_score',
        label: 'CSAT Score',
        value: metric?.csatScore ?? null,
        unit: 'score',
      },
      {
        key: 'payment_risk_band',
        label: 'Payment Risk Band',
        value: metric?.paymentRiskBand ?? null,
        unit: null,
      },
      {
        key: 'adoption_band',
        label: 'Adoption Band',
        value: metric?.adoptionBand ?? null,
        unit: null,
      },
    ]

    for (const metricSignal of metricSignals) {
      signals.push(
        signal({
          evidenceRef: `item.${item.id}.metric.${metricSignal.key}`,
          subjectType: 'RENEWAL_CASE_ITEM',
          subjectId: item.id,
          signalKey: metricSignal.key,
          label: metricSignal.label,
          value: metricSignal.value,
          unit: metricSignal.unit,
          sourceSystem: 'Subscription Telemetry',
          observedAt: isoDate(observedAt),
          freshnessStatus: freshnessFor(metricSignal.value, observedAt, now),
          lineage: 'SubscriptionMetricSnapshot',
        }),
      )
    }

    const commercialSignals = [
      {
        key: 'current_quantity',
        label: 'Current Quantity',
        value: item.subscription.quantity,
        unit: 'count',
      },
      {
        key: 'current_discount_percent',
        label: 'Current Discount Percent',
        value: item.subscription.discountPercent,
        unit: 'percent',
      },
      {
        key: 'current_arr',
        label: 'Current ARR',
        value: item.subscription.arr,
        unit: 'currency',
      },
      {
        key: 'rule_risk_score',
        label: 'Rule Risk Score',
        value: ruleItemById.get(item.id)?.riskScore ?? null,
        unit: 'score',
      },
      {
        key: 'final_risk_score',
        label: 'Final Risk Score',
        value: finalItemById.get(item.id)?.riskScore ?? null,
        unit: 'score',
      },
      {
        key: 'final_disposition',
        label: 'Final Disposition',
        value: finalItemById.get(item.id)?.recommendedDisposition ?? null,
        unit: null,
      },
    ]

    for (const commercialSignal of commercialSignals) {
      const freshnessStatus = commercialSignal.value == null ? 'MISSING' : 'CURRENT'
      signals.push(
        signal({
          evidenceRef: `item.${item.id}.commercial.${commercialSignal.key}`,
          subjectType: 'RENEWAL_CASE_ITEM',
          subjectId: item.id,
          signalKey: commercialSignal.key,
          label: commercialSignal.label,
          value:
            typeof commercialSignal.value === 'number'
              ? toNumber(commercialSignal.value)
              : commercialSignal.value,
          unit: commercialSignal.unit,
          sourceSystem: 'Renewal Workspace',
          observedAt: generatedAt,
          freshnessStatus,
          lineage: 'RenewalCaseItem + recommendation engine',
        }),
      )
    }

    const policy = item.pricingPolicy
    const policySignals = [
      {
        key: 'max_auto_discount_percent',
        label: 'Max Auto Discount Percent',
        value: policy?.maxAutoDiscountPercent ?? null,
        unit: 'percent',
      },
      {
        key: 'approval_discount_percent',
        label: 'Approval Discount Percent',
        value: policy?.approvalDiscountPercent ?? null,
        unit: 'percent',
      },
      {
        key: 'floor_price_percent_of_list',
        label: 'Floor Price Percent of List',
        value: policy?.floorPricePercentOfList ?? null,
        unit: 'percent',
      },
      {
        key: 'expansion_threshold_usage_percent',
        label: 'Expansion Threshold Usage Percent',
        value: policy?.expansionThresholdUsagePercent ?? null,
        unit: 'percent',
      },
    ]

    for (const policySignal of policySignals) {
      signals.push(
        signal({
          evidenceRef: `item.${item.id}.policy.${policySignal.key}`,
          subjectType: 'PRICING_POLICY',
          subjectId: policy?.id ?? `missing_policy_${item.id}`,
          signalKey: policySignal.key,
          label: policySignal.label,
          value: policySignal.value,
          unit: policySignal.unit,
          sourceSystem: 'Pricing Policy',
          observedAt: generatedAt,
          freshnessStatus: policySignal.value == null ? 'MISSING' : 'CURRENT',
          lineage: 'PricingPolicy',
        }),
      )
    }
  }

  const currentCount = signals.filter((item) => item.freshnessStatus === 'CURRENT').length
  const staleCount = signals.filter((item) => item.freshnessStatus === 'STALE').length
  const missingCount = signals.filter((item) => item.freshnessStatus === 'MISSING').length
  const scoredSignals = signals.filter((item) => item.freshnessStatus !== 'NOT_APPLICABLE')
  const completenessScore = Math.round((currentCount / Math.max(scoredSignals.length, 1)) * 100)
  const confidenceScore = Math.round(
    (scoredSignals.reduce((sum, item) => sum + item.confidence, 0) /
      Math.max(scoredSignals.length, 1)) *
      100,
  )

  return {
    evidenceSnapshotVersion: EVIDENCE_SNAPSHOT_VERSION,
    generatedAt,
    scenarioKey: args.scenarioKey,
    quality: {
      signalCount: signals.length,
      currentCount,
      staleCount,
      missingCount,
      completenessScore,
      confidenceScore,
    },
    account: {
      id: account.id,
      segment: account.segment,
      healthScore: account.healthScore,
      openEscalationCount: account.openEscalationCount,
    },
    signals,
  }
}
