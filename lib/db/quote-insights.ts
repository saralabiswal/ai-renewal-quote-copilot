import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/date'
import { formatPercent } from '@/lib/format/percent'
import { labelize, toneForStatus } from '@/lib/format/risk'
import {
  calculateQuoteInsightsWithLlm,
  type QuoteInsightLlmCandidate,
  type QuoteInsightLlmTrace,
} from '@/lib/ai/quote-insight-disposition'
import { getRuntimeSettings } from '@/lib/settings/runtime-settings'

export type QuoteInsightView = {
  id: string
  title: string
  insightType: string
  insightTypeLabel: string
  statusLabel: string
  statusTone?: 'default' | 'info' | 'success' | 'warn' | 'danger'
  isAddedToQuote?: boolean
  productName: string
  productSku: string
  productFamily: string
  insightSummary: string
  recommendedActionSummary: string | null
  aiExplanation: string | null
  aiModelLabel: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPriceFormatted: string | null
  recommendedDiscountPercentFormatted: string | null
  estimatedArrImpactFormatted: string | null
  justification: QuoteInsightJustificationView | null
}

type EvidenceValue = string | number | boolean | null

type MlInsightPrediction = {
  itemId: string
  riskScore: number | null
  riskProbability: number | null
  expansionScore: number | null
  expansionProbability: number | null
  topFeatures: string[]
}

export type QuoteInsightEvidenceSignalView = {
  label: string
  value: EvidenceValue
}

export type QuoteInsightCommercialDeltaView = {
  currentQuantity: number | null
  proposedQuantity: number | null
  quantityDelta: number | null
  currentArr: number | null
  proposedArr: number | null
  arrDelta: number | null
  currentUnitPrice: number | null
  proposedUnitPrice: number | null
  recommendedDiscountPercent: number | null
}

export type QuoteInsightDecisionMetaView = {
  decisionRunId: string | null
  generatedAt: string | null
  actor: string | null
  engineVersion: string | null
  policyVersion: string | null
  scenarioVersion: string | null
  sourceRecordVersion: string | null
}

export type QuoteInsightRuleHitView = {
  ruleId: string
  reasonCode: string
  outcome: string
  weight: number | null
  detail: string
}

export type QuoteInsightAlternativeView = {
  action: string
  reasonRejected: string
}

export type QuoteInsightExpectedImpactView = {
  arrDelta: number | null
  marginDirection: string | null
  retentionRisk: string | null
}

export type QuoteInsightChangeLogView = {
  fromSummary: string | null
  toSummary: string | null
  changedFields: string[]
  changedAt: string | null
}

export type QuoteInsightObjectiveView = {
  primaryObjective: 'RETAIN_REVENUE' | 'PROTECT_MARGIN' | 'GROW_ACCOUNT' | 'GOVERN_RISK'
  objectiveScore: number | null
  businessKpi: string
  signalDrivers: string[]
}

export type QuoteInsightJustificationView = {
  version: 'v1' | 'v2'
  sourceType: string
  insightType: string
  scenarioKey: string | null
  reasoning: string[]
  signals: QuoteInsightEvidenceSignalView[]
  commercialDelta: QuoteInsightCommercialDeltaView | null
  decisionMeta?: QuoteInsightDecisionMetaView | null
  reasonCodes?: string[]
  ruleHits?: QuoteInsightRuleHitView[]
  alternativesConsidered?: QuoteInsightAlternativeView[]
  expectedImpact?: QuoteInsightExpectedImpactView | null
  changeLog?: QuoteInsightChangeLogView | null
  objectiveLens?: QuoteInsightObjectiveView | null
  ml?: {
    status: string
    affectsRecommendation: boolean
    riskScore: number | null
    riskProbability: number | null
    expansionScore: number | null
    expansionProbability: number | null
    topFeatures: string[]
  } | null
}

const SKU_TO_PRODUCT_ID: Record<string, string> = {
  'ORCL-FUSION-APPS': 'prod_fusion_apps',
  'ORCL-SUBSCRIPTION-MGMT': 'prod_subscription_mgmt',
  'ORCL-CPQ': 'prod_cpq',
  'ORCL-OCI': 'prod_oci',
  'ORCL-AUTONOMOUS-AI-DB': 'prod_autonomous_ai_db',
  'ORCL-AI-DATA-PLATFORM': 'prod_ai_data_platform',
  'ORCL-CLOUD-AT-CUSTOMER': 'prod_cloud_at_customer',
  'ORCL-EXADATA-CAC': 'prod_exadata_cac',
  'ORCL-DATABASE-AZURE': 'prod_db_azure',
  'ORCL-DATABASE-AWS': 'prod_db_aws',
  'ORCL-INDUSTRY-APPS': 'prod_industry_apps',
  'ORCL-HEALTH-SUITE': 'prod_health_suite',
  'ORCL-NETSUITE': 'prod_netsuite',
}

const PRODUCT_NAME_TO_SKU: Record<string, string> = {
  'Oracle Fusion Applications': 'ORCL-FUSION-APPS',
  'Oracle Subscription Management': 'ORCL-SUBSCRIPTION-MGMT',
  'Oracle CPQ': 'ORCL-CPQ',
  'Oracle Cloud Infrastructure': 'ORCL-OCI',
  'Oracle Autonomous AI Database': 'ORCL-AUTONOMOUS-AI-DB',
  'Oracle AI Data Platform': 'ORCL-AI-DATA-PLATFORM',
  'Oracle Cloud@Customer': 'ORCL-CLOUD-AT-CUSTOMER',
  'Oracle Exadata Cloud@Customer': 'ORCL-EXADATA-CAC',
  'Oracle Database@Azure': 'ORCL-DATABASE-AZURE',
  'Oracle Database@AWS': 'ORCL-DATABASE-AWS',
  'Oracle Industry Applications': 'ORCL-INDUSTRY-APPS',
  'Oracle Health Suite': 'ORCL-HEALTH-SUITE',
  'Oracle NetSuite': 'ORCL-NETSUITE',
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function decimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0)
  }
  return new Prisma.Decimal(value)
}

function clampScore(value: number) {
  return Math.max(50, Math.min(95, Math.round(value)))
}

function clampObjectiveScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  return Math.max(50, Math.min(95, Math.round(value)))
}

function normalizeObjective(
  raw: unknown,
): QuoteInsightObjectiveView['primaryObjective'] {
  if (typeof raw !== 'string') return 'RETAIN_REVENUE'
  switch (raw.toUpperCase()) {
    case 'PROTECT_MARGIN':
      return 'PROTECT_MARGIN'
    case 'GROW_ACCOUNT':
      return 'GROW_ACCOUNT'
    case 'GOVERN_RISK':
      return 'GOVERN_RISK'
    case 'RETAIN_REVENUE':
    default:
      return 'RETAIN_REVENUE'
  }
}

function toEvidenceNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100) / 100
}

function toEvidenceValue(value: unknown): EvidenceValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

function parseQuoteInsightJustification(
  raw: string | null | undefined,
): QuoteInsightJustificationView | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== 'object') return null

    const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : []
    const signals = rawSignals
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const rec = item as Record<string, unknown>
        const label = typeof rec.label === 'string' ? rec.label : null
        if (!label) return null
        return {
          label,
          value: toEvidenceValue(rec.value),
        }
      })
      .filter(Boolean) as QuoteInsightEvidenceSignalView[]

    let commercialDelta: QuoteInsightCommercialDeltaView | null = null
    if (parsed.commercialDelta && typeof parsed.commercialDelta === 'object') {
      const rec = parsed.commercialDelta as Record<string, unknown>
      commercialDelta = {
        currentQuantity: toEvidenceNumber(rec.currentQuantity as number | null),
        proposedQuantity: toEvidenceNumber(rec.proposedQuantity as number | null),
        quantityDelta: toEvidenceNumber(rec.quantityDelta as number | null),
        currentArr: toEvidenceNumber(rec.currentArr as number | null),
        proposedArr: toEvidenceNumber(rec.proposedArr as number | null),
        arrDelta: toEvidenceNumber(rec.arrDelta as number | null),
        currentUnitPrice: toEvidenceNumber(rec.currentUnitPrice as number | null),
        proposedUnitPrice: toEvidenceNumber(rec.proposedUnitPrice as number | null),
        recommendedDiscountPercent: toEvidenceNumber(
          rec.recommendedDiscountPercent as number | null,
        ),
      }
    }

    let decisionMeta: QuoteInsightDecisionMetaView | null = null
    if (parsed.decisionMeta && typeof parsed.decisionMeta === 'object') {
      const rec = parsed.decisionMeta as Record<string, unknown>
      decisionMeta = {
        decisionRunId: typeof rec.decisionRunId === 'string' ? rec.decisionRunId : null,
        generatedAt: typeof rec.generatedAt === 'string' ? rec.generatedAt : null,
        actor: typeof rec.actor === 'string' ? rec.actor : null,
        engineVersion: typeof rec.engineVersion === 'string' ? rec.engineVersion : null,
        policyVersion: typeof rec.policyVersion === 'string' ? rec.policyVersion : null,
        scenarioVersion: typeof rec.scenarioVersion === 'string' ? rec.scenarioVersion : null,
        sourceRecordVersion:
          typeof rec.sourceRecordVersion === 'string' ? rec.sourceRecordVersion : null,
      }
    }

    const reasonCodes = Array.isArray(parsed.reasonCodes)
      ? parsed.reasonCodes.map((item) => String(item)).filter(Boolean)
      : []

    const ruleHits = Array.isArray(parsed.ruleHits)
      ? parsed.ruleHits
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const rec = item as Record<string, unknown>
            const ruleId = typeof rec.ruleId === 'string' ? rec.ruleId : null
            const reasonCode = typeof rec.reasonCode === 'string' ? rec.reasonCode : null
            const detail = typeof rec.detail === 'string' ? rec.detail : null
            if (!ruleId || !reasonCode || !detail) return null
            return {
              ruleId,
              reasonCode,
              outcome: typeof rec.outcome === 'string' ? rec.outcome : 'INFERRED',
              weight: toEvidenceNumber(rec.weight as number | null),
              detail,
            } as QuoteInsightRuleHitView
          })
          .filter(Boolean) as QuoteInsightRuleHitView[]
      : []

    const alternativesConsidered = Array.isArray(parsed.alternativesConsidered)
      ? parsed.alternativesConsidered
          .map((item) => {
            if (!item || typeof item !== 'object') return null
            const rec = item as Record<string, unknown>
            const action = typeof rec.action === 'string' ? rec.action : null
            const reasonRejected =
              typeof rec.reasonRejected === 'string' ? rec.reasonRejected : null
            if (!action || !reasonRejected) return null
            return { action, reasonRejected } as QuoteInsightAlternativeView
          })
          .filter(Boolean) as QuoteInsightAlternativeView[]
      : []

    let expectedImpact: QuoteInsightExpectedImpactView | null = null
    if (parsed.expectedImpact && typeof parsed.expectedImpact === 'object') {
      const rec = parsed.expectedImpact as Record<string, unknown>
      expectedImpact = {
        arrDelta: toEvidenceNumber(rec.arrDelta as number | null),
        marginDirection: typeof rec.marginDirection === 'string' ? rec.marginDirection : null,
        retentionRisk: typeof rec.retentionRisk === 'string' ? rec.retentionRisk : null,
      }
    }

    let changeLog: QuoteInsightChangeLogView | null = null
    if (parsed.changeLog && typeof parsed.changeLog === 'object') {
      const rec = parsed.changeLog as Record<string, unknown>
      changeLog = {
        fromSummary: typeof rec.fromSummary === 'string' ? rec.fromSummary : null,
        toSummary: typeof rec.toSummary === 'string' ? rec.toSummary : null,
        changedFields: Array.isArray(rec.changedFields)
          ? rec.changedFields.map((item) => String(item)).filter(Boolean)
          : [],
        changedAt: typeof rec.changedAt === 'string' ? rec.changedAt : null,
      }
    }

    let objectiveLens: QuoteInsightObjectiveView | null = null
    if (parsed.objectiveLens && typeof parsed.objectiveLens === 'object') {
      const rec = parsed.objectiveLens as Record<string, unknown>
      objectiveLens = {
        primaryObjective: normalizeObjective(rec.primaryObjective),
        objectiveScore: clampObjectiveScore(toEvidenceNumber(rec.objectiveScore as number | null)),
        businessKpi:
          typeof rec.businessKpi === 'string' && rec.businessKpi.trim().length > 0
            ? rec.businessKpi
            : 'Renewal outcome quality',
        signalDrivers: Array.isArray(rec.signalDrivers)
          ? rec.signalDrivers.map((item) => String(item)).filter(Boolean)
          : [],
      }
    }

    let ml: QuoteInsightJustificationView['ml'] = null
    if (parsed.ml && typeof parsed.ml === 'object') {
      const rec = parsed.ml as Record<string, unknown>
      ml = {
        status: typeof rec.status === 'string' ? rec.status : 'UNKNOWN',
        affectsRecommendation: Boolean(rec.affectsRecommendation),
        riskScore: toNullableNumber(rec.riskScore),
        riskProbability: toNullableNumber(rec.riskProbability),
        expansionScore: toNullableNumber(rec.expansionScore),
        expansionProbability: toNullableNumber(rec.expansionProbability),
        topFeatures: Array.isArray(rec.topFeatures)
          ? rec.topFeatures.map((item) => String(item)).filter(Boolean)
          : [],
      }
    }

    return {
      version: parsed.version === 'v2' ? 'v2' : 'v1',
      sourceType: typeof parsed.sourceType === 'string' ? parsed.sourceType : 'UNKNOWN',
      insightType: typeof parsed.insightType === 'string' ? parsed.insightType : 'UNKNOWN',
      scenarioKey: typeof parsed.scenarioKey === 'string' ? parsed.scenarioKey : null,
      reasoning: Array.isArray(parsed.reasoning)
        ? parsed.reasoning.map((item) => String(item)).filter(Boolean)
        : [],
      signals,
      commercialDelta,
      decisionMeta,
      reasonCodes,
      ruleHits,
      alternativesConsidered,
      expectedImpact,
      changeLog,
      objectiveLens,
      ml,
    }
  } catch {
    return null
  }
}

function buildJustificationJson(payload: QuoteInsightJustificationView): string {
  return JSON.stringify(payload)
}

function fallbackRetentionRisk(confidenceScore: number | null, fitScore: number | null): string {
  const score = Math.round(((confidenceScore ?? 60) + (fitScore ?? 60)) / 2)
  if (score >= 85) return 'LOW'
  if (score >= 70) return 'MEDIUM'
  return 'HIGH'
}

function buildFallbackQuoteInsightJustification(args: {
  sourceType: string
  insightType: string
  title: string
  insightSummary: string
  recommendedActionSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPrice: Prisma.Decimal | null
  recommendedDiscountPercent: Prisma.Decimal | null
  estimatedArrImpact: Prisma.Decimal | null
  createdAt: Date
}): QuoteInsightJustificationView {
  const {
    sourceType,
    insightType,
    title,
    insightSummary,
    recommendedActionSummary,
    confidenceScore,
    fitScore,
    recommendedQuantity,
    recommendedUnitPrice,
    recommendedDiscountPercent,
    estimatedArrImpact,
    createdAt,
  } = args

  const arrDelta = toEvidenceNumber(estimatedArrImpact)
  const reasonCodes = lineReasonCodes(insightType)
  const primaryObjective = primaryObjectiveForInsight({
    insightType,
    normalizedDisposition: insightType,
  })
  const objectiveScore = objectiveScoreForInsight({
    primaryObjective,
    confidenceScore: confidenceScore ?? 60,
    fitScore: fitScore ?? 60,
    itemRiskScore: null,
    arrDelta,
    quantityDelta: null,
    scenarioKey: null,
  })

  return {
    version: 'v2',
    sourceType,
    insightType,
    scenarioKey: null,
    reasoning: [
      insightSummary,
      recommendedActionSummary ?? `Recommended action aligns to ${humanizeInsightToken(insightType)} posture.`,
      `Fallback structured evidence generated because seed insight "${title}" has no persisted justification payload.`,
    ],
    signals: [
      { label: 'Confidence Score', value: confidenceScore },
      { label: 'Fit Score', value: fitScore },
      { label: 'Recommended Quantity', value: recommendedQuantity },
      { label: 'Recommended Unit Price', value: toEvidenceNumber(recommendedUnitPrice) },
      {
        label: 'Recommended Discount Percent',
        value: toEvidenceNumber(recommendedDiscountPercent),
      },
      { label: 'Estimated ARR Impact', value: arrDelta },
    ],
    commercialDelta: {
      currentQuantity: null,
      proposedQuantity: recommendedQuantity,
      quantityDelta: null,
      currentArr: null,
      proposedArr: arrDelta,
      arrDelta,
      currentUnitPrice: null,
      proposedUnitPrice: toEvidenceNumber(recommendedUnitPrice),
      recommendedDiscountPercent: toEvidenceNumber(recommendedDiscountPercent),
    },
    decisionMeta: {
      decisionRunId: null,
      generatedAt: createdAt.toISOString(),
      actor: 'SEED_FALLBACK',
      engineVersion: DECISION_ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      sourceRecordVersion: null,
    },
    reasonCodes,
    ruleHits: [
      {
        ruleId: `FALLBACK_${insightType}`,
        reasonCode: reasonCodes[0] ?? 'SEED_FALLBACK',
        outcome: 'INFERRED',
        weight: 60,
        detail: 'Fallback structured evidence inferred from seeded quote insight fields.',
      },
    ],
    alternativesConsidered: defaultAlternatives(insightType),
    expectedImpact: {
      arrDelta,
      marginDirection: marginDirectionFromArrDelta(arrDelta),
      retentionRisk: fallbackRetentionRisk(confidenceScore, fitScore),
    },
    changeLog: null,
    objectiveLens: {
      primaryObjective,
      objectiveScore,
      businessKpi: businessKpiForObjective(primaryObjective),
      signalDrivers: [
        'Fallback mode: structured seed fields used because no native justification payload was stored.',
        `Insight mapped to objective ${primaryObjective.replaceAll('_', ' ')}.`,
        `Confidence ${formatSignalNumber(confidenceScore)} and fit ${formatSignalNumber(fitScore)} were used to compute objective score.`,
      ],
    },
  }
}

function humanizeInsightToken(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getSkuForProductName(productName: string) {
  return PRODUCT_NAME_TO_SKU[productName] ?? productName
}

function getProductFamilyForProductName(productName: string) {
  if (productName.includes('CPQ') || productName.includes('Subscription')) {
    return 'Revenue Operations'
  }

  if (productName.includes('Cloud@Customer') || productName.includes('Exadata')) {
    return 'Hybrid Deployment'
  }

  if (productName.includes('Azure') || productName.includes('AWS')) {
    return 'Multicloud Data'
  }

  if (productName.includes('OCI') || productName.includes('Cloud Infrastructure')) {
    return 'Infrastructure'
  }

  if (
    productName.includes('Autonomous AI Database') ||
    productName.includes('AI Data Platform')
  ) {
    return 'AI / Data'
  }

  if (productName.includes('Health')) {
    return 'Industry Applications'
  }

  if (productName.includes('Industry Applications')) {
    return 'Industry Applications'
  }

  if (productName.includes('NetSuite')) {
    return 'Applications'
  }

  return 'Applications'
}

const DECISION_ENGINE_VERSION = 'quote-insight-engine-v2'
const POLICY_VERSION = 'pricing-policy-matrix-2026-q2'
const SCENARIO_VERSION = 'demo-scenarios-v1'

function retentionRiskBandFromScore(score: number | null): string {
  if (score == null) return 'UNKNOWN'
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

function marginDirectionFromArrDelta(arrDelta: number | null): string {
  if (arrDelta == null) return 'UNKNOWN'
  if (arrDelta > 0) return 'UP'
  if (arrDelta < 0) return 'DOWN'
  return 'FLAT'
}

function primaryObjectiveForInsight(args: {
  insightType: string
  normalizedDisposition: string
}): QuoteInsightObjectiveView['primaryObjective'] {
  const insightType = args.insightType.toUpperCase()
  const normalizedDisposition = args.normalizedDisposition.toUpperCase()

  if (normalizedDisposition === 'ESCALATE' || insightType === 'DEFENSIVE_RENEWAL') {
    return 'GOVERN_RISK'
  }

  if (insightType === 'MARGIN_RECOVERY' || insightType === 'CONTROLLED_UPLIFT') {
    return 'PROTECT_MARGIN'
  }

  if (
    insightType === 'EXPANSION' ||
    insightType === 'CROSS_SELL' ||
    insightType === 'HYBRID_DEPLOYMENT_FIT' ||
    insightType === 'DATA_MODERNIZATION'
  ) {
    return 'GROW_ACCOUNT'
  }

  return 'RETAIN_REVENUE'
}

function businessKpiForObjective(
  objective: QuoteInsightObjectiveView['primaryObjective'],
): string {
  switch (objective) {
    case 'PROTECT_MARGIN':
      return 'Gross margin improvement and discount normalization'
    case 'GROW_ACCOUNT':
      return 'Net-new ARR and attach rate'
    case 'GOVERN_RISK':
      return 'Policy compliance and escalation SLA adherence'
    case 'RETAIN_REVENUE':
    default:
      return 'Renewal ARR retention and churn-risk reduction'
  }
}

function formatSignalNumber(value: number | null, suffix = '') {
  if (value == null || !Number.isFinite(value)) return 'N/A'
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}${suffix}`
}

function formatSignedSignal(value: number | null, suffix = '') {
  if (value == null || !Number.isFinite(value)) return 'N/A'
  const prefix = value >= 0 ? '+' : ''
  return `${prefix}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(value)}${suffix}`
}

function objectiveScoreForInsight(args: {
  primaryObjective: QuoteInsightObjectiveView['primaryObjective']
  confidenceScore: number
  fitScore: number
  itemRiskScore: number | null
  arrDelta: number | null
  quantityDelta: number | null
  scenarioKey: string | null
}): number {
  const {
    primaryObjective,
    confidenceScore,
    fitScore,
    itemRiskScore,
    arrDelta,
    quantityDelta,
    scenarioKey,
  } = args

  let score = Math.round((confidenceScore + fitScore) / 2)

  if (primaryObjective === 'RETAIN_REVENUE') {
    if ((itemRiskScore ?? 0) >= 70) score += 8
    else if ((itemRiskScore ?? 0) >= 40) score += 4
    else score -= 2
  }

  if (primaryObjective === 'PROTECT_MARGIN') {
    if ((arrDelta ?? 0) > 0) score += 6
    else if ((arrDelta ?? 0) === 0) score += 2
    else score -= 6
  }

  if (primaryObjective === 'GROW_ACCOUNT') {
    if ((quantityDelta ?? 0) > 0 || (arrDelta ?? 0) > 0) score += 6
    else score -= 5
    if (scenarioKey === 'EXPANSION_UPSIDE') score += 3
  }

  if (primaryObjective === 'GOVERN_RISK') {
    if ((itemRiskScore ?? 0) >= 80) score += 10
    else if ((itemRiskScore ?? 0) >= 55) score += 6
    else score += 2
  }

  return clampObjectiveScore(score) ?? 50
}

function buildLineObjectiveDrivers(args: {
  primaryObjective: QuoteInsightObjectiveView['primaryObjective']
  scenarioKey: string | null
  itemRiskScore: number | null
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  paymentRiskBand: string | null
  arrDelta: number | null
  quantityDelta: number | null
  recommendedDiscountPercent: number | null
}): string[] {
  const {
    primaryObjective,
    scenarioKey,
    itemRiskScore,
    usagePercentOfEntitlement,
    activeUserPercent,
    loginTrend30d,
    ticketCount90d,
    sev1Count90d,
    paymentRiskBand,
    arrDelta,
    quantityDelta,
    recommendedDiscountPercent,
  } = args

  const drivers = [`Scenario context: ${scenarioKey ?? 'BASE_CASE'}.`]

  if (primaryObjective === 'RETAIN_REVENUE') {
    drivers.push(
      `Risk score ${formatSignalNumber(itemRiskScore)} with login trend ${formatSignedSignal(loginTrend30d, '%')} informs churn-protection posture.`,
    )
    drivers.push(
      `Customer health signals: usage ${formatSignalNumber(usagePercentOfEntitlement, '%')}, active users ${formatSignalNumber(activeUserPercent, '%')}, payment risk ${paymentRiskBand ?? 'UNKNOWN'}.`,
    )
  }

  if (primaryObjective === 'PROTECT_MARGIN') {
    drivers.push(
      `Commercial protection signals: ARR delta ${formatSignedSignal(arrDelta)} and recommended discount ${formatSignalNumber(recommendedDiscountPercent, '%')}.`,
    )
    drivers.push(
      `Support burden check: tickets ${formatSignalNumber(ticketCount90d)} and sev1 ${formatSignalNumber(sev1Count90d)} to avoid margin actions on unstable lines.`,
    )
  }

  if (primaryObjective === 'GROW_ACCOUNT') {
    drivers.push(
      `Expansion signals: usage ${formatSignalNumber(usagePercentOfEntitlement, '%')} and active users ${formatSignalNumber(activeUserPercent, '%')}.`,
    )
    drivers.push(
      `Commercial growth signal: quantity delta ${formatSignedSignal(quantityDelta)} with ARR delta ${formatSignedSignal(arrDelta)}.`,
    )
  }

  if (primaryObjective === 'GOVERN_RISK') {
    drivers.push(
      `Risk controls: risk score ${formatSignalNumber(itemRiskScore)}, sev1 incidents ${formatSignalNumber(sev1Count90d)}, tickets ${formatSignalNumber(ticketCount90d)}.`,
    )
    drivers.push(
      `Operational trend signal: login trend ${formatSignedSignal(loginTrend30d, '%')} and payment risk ${paymentRiskBand ?? 'UNKNOWN'}.`,
    )
  }

  return drivers.slice(0, 3)
}

function buildAdditiveObjectiveDrivers(args: {
  scenarioKey: string | null
  accountIndustry: string | null
  accountSegment: string | null
  confidenceScore: number
  fitScore: number
}): string[] {
  const { scenarioKey, accountIndustry, accountSegment, confidenceScore, fitScore } = args
  return [
    `Scenario context: ${scenarioKey ?? 'BASE_CASE'} with account segment ${accountSegment ?? 'Unknown'}.`,
    `Industry profile ${accountIndustry ?? 'Unknown'} is eligible for adjacent portfolio motion.`,
    `Expansion confidence ${formatSignalNumber(confidenceScore)} and fit ${formatSignalNumber(fitScore)} support growth objective prioritization.`,
  ]
}

function lineReasonCodes(normalizedDisposition: string): string[] {
  switch (normalizedDisposition) {
    case 'ESCALATE':
    case 'DEFENSIVE_RENEWAL':
      return ['RISK_ESCALATION_REQUIRED', 'PRICE_HOLD_PROTECTION']
    case 'RENEW_WITH_CONCESSION':
    case 'STRATEGIC_CONCESSION':
    case 'CONCESSION':
      return ['RETENTION_CONCESSION', 'POLICY_GUARDRAIL_REVIEW']
    case 'EXPANSION':
    case 'EXPAND':
      return ['EXPANSION_SIGNAL', 'ADOPTION_STRENGTH']
    case 'MARGIN_RECOVERY':
    case 'PRICE_ADJUST':
      return ['MARGIN_RECOVERY', 'DISCOUNT_NORMALIZATION']
    case 'UPLIFT_RESTRAINT':
      return ['UPLIFT_RESTRAINT', 'RETENTION_PRIORITY']
    case 'CONTROLLED_UPLIFT':
    case 'UPLIFT':
      return ['CONTROLLED_UPLIFT', 'LOW_RISK_MONETIZATION']
    case 'RENEW_AS_IS':
    case 'RENEW':
    default:
      return ['STABLE_RENEWAL', 'NO_MATERIAL_EXCEPTION']
  }
}

function lineRuleHits(args: {
  normalizedDisposition: string
  insightType: string
  itemRiskScore: number | null
}): QuoteInsightRuleHitView[] {
  const { normalizedDisposition, insightType, itemRiskScore } = args
  const riskScore = itemRiskScore ?? 60
  return [
    {
      ruleId: `DISPOSITION_${normalizedDisposition}`,
      reasonCode: lineReasonCodes(normalizedDisposition)[0] ?? 'POLICY_MATCH',
      outcome: 'TRIGGERED',
      weight: Math.max(55, Math.min(95, Math.round(100 - riskScore / 3))),
      detail: `Line disposition ${normalizedDisposition} selected by recommendation engine.`,
    },
    {
      ruleId: `INSIGHT_MAP_${insightType}`,
      reasonCode: `${insightType}_MAPPING`,
      outcome: 'TRIGGERED',
      weight: Math.max(55, Math.min(95, Math.round(100 - riskScore / 4))),
      detail: `Disposition ${normalizedDisposition} mapped to quote insight ${insightType}.`,
    },
  ]
}

function defaultAlternatives(insightType: string): QuoteInsightAlternativeView[] {
  return [
    {
      action: 'RENEW_AS_IS',
      reasonRejected:
        insightType === 'RENEW_AS_IS'
          ? 'Selected as preferred action for this signal set.'
          : 'Rejected because current signals indicate a higher-impact action is needed.',
    },
    {
      action: 'CONCESSION',
      reasonRejected:
        insightType === 'CONCESSION'
          ? 'Selected as preferred action for this signal set.'
          : 'Rejected to avoid unnecessary concession against current risk profile.',
    },
    {
      action: 'DEFENSIVE_RENEWAL',
      reasonRejected:
        insightType === 'DEFENSIVE_RENEWAL'
          ? 'Selected because escalation posture is required.'
          : 'Rejected because current profile does not require defensive escalation handling.',
    },
  ]
}

function buildLineInsightJustification(args: {
  insightType: string
  normalizedDisposition: string
  scenarioKey: string | null
  decisionRunId: string
  generatedAtIso: string
  sourceRecordVersion: string | null
  itemRiskScore: number | null
  confidenceScore: number
  fitScore: number
  currentQuantity: number
  proposedQuantity: number
  currentArr: Prisma.Decimal
  proposedArr: Prisma.Decimal
  currentNetUnitPrice: Prisma.Decimal
  proposedNetUnitPrice: Prisma.Decimal
  recommendedDiscountPercent: Prisma.Decimal | null
  analysisSummary: string | null
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  paymentRiskBand: string | null
  adoptionBand: string | null
  signalSnapshotDate: string | null
  mlPrediction?: MlInsightPrediction | null
  mlAffectsRecommendation?: boolean
}): string {
  const {
    insightType,
    normalizedDisposition,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
    sourceRecordVersion,
    itemRiskScore,
    confidenceScore,
    fitScore,
    currentQuantity,
    proposedQuantity,
    currentArr,
    proposedArr,
    currentNetUnitPrice,
    proposedNetUnitPrice,
    recommendedDiscountPercent,
    analysisSummary,
    usagePercentOfEntitlement,
    activeUserPercent,
    loginTrend30d,
    ticketCount90d,
    sev1Count90d,
    csatScore,
    paymentRiskBand,
    adoptionBand,
    signalSnapshotDate,
    mlPrediction,
    mlAffectsRecommendation,
  } = args

  const quantityDelta = proposedQuantity - currentQuantity
  const currentArrNumber = toEvidenceNumber(currentArr)
  const proposedArrNumber = toEvidenceNumber(proposedArr)
  const arrDelta =
    currentArrNumber != null && proposedArrNumber != null
      ? Math.round((proposedArrNumber - currentArrNumber) * 100) / 100
      : null

  const reasoning = [
    `Recommendation disposition ${normalizedDisposition} mapped to quote insight type ${insightType}.`,
    quantityDelta > 0
      ? `Quantity increases from ${currentQuantity} to ${proposedQuantity}.`
      : quantityDelta < 0
        ? `Quantity decreases from ${currentQuantity} to ${proposedQuantity}.`
        : `Quantity remains stable at ${currentQuantity}.`,
    arrDelta != null
      ? `Estimated ARR impact is ${arrDelta >= 0 ? '+' : ''}${arrDelta}.`
      : 'Estimated ARR impact could not be calculated from current inputs.',
    analysisSummary
      ? 'Line-level analysis summary was included as supporting context.'
      : 'No line-level analysis summary was available; decision used structured signals only.',
    mlPrediction
      ? `ML layer returned risk score ${formatSignalNumber(
          mlPrediction.riskScore,
        )}; affects recommendation: ${mlAffectsRecommendation ? 'yes' : 'no'}.`
      : 'No ML prediction was attached to this insight.',
  ]

  const signals: QuoteInsightEvidenceSignalView[] = [
    { label: 'Signal Snapshot Date', value: signalSnapshotDate },
    { label: 'Scenario', value: scenarioKey ?? 'BASE_CASE' },
    { label: 'Disposition', value: normalizedDisposition },
    { label: 'Risk Score', value: itemRiskScore },
    { label: 'Usage Percent of Entitlement', value: usagePercentOfEntitlement },
    { label: 'Active User Percent', value: activeUserPercent },
    { label: 'Login Trend 30d', value: loginTrend30d },
    { label: 'Ticket Count 90d', value: ticketCount90d },
    { label: 'Sev1 Count 90d', value: sev1Count90d },
    { label: 'CSAT', value: csatScore },
    { label: 'Payment Risk Band', value: paymentRiskBand },
    { label: 'Adoption Band', value: adoptionBand },
    { label: 'Confidence Score', value: confidenceScore },
    { label: 'Fit Score', value: fitScore },
    { label: 'ML Risk Score', value: mlPrediction?.riskScore ?? null },
    { label: 'ML Risk Probability', value: mlPrediction?.riskProbability ?? null },
    { label: 'ML Expansion Score', value: mlPrediction?.expansionScore ?? null },
    {
      label: 'ML Expansion Probability',
      value: mlPrediction?.expansionProbability ?? null,
    },
    {
      label: 'ML Top Features',
      value: mlPrediction?.topFeatures?.slice(0, 3).join(', ') || null,
    },
    { label: 'Current Quantity', value: currentQuantity },
    { label: 'Proposed Quantity', value: proposedQuantity },
    { label: 'Quantity Delta', value: quantityDelta },
    { label: 'Current ARR', value: currentArrNumber },
    { label: 'Proposed ARR', value: proposedArrNumber },
    { label: 'ARR Delta', value: arrDelta },
    { label: 'Current Unit Price', value: toEvidenceNumber(currentNetUnitPrice) },
    { label: 'Proposed Unit Price', value: toEvidenceNumber(proposedNetUnitPrice) },
    {
      label: 'Recommended Discount Percent',
      value: toEvidenceNumber(recommendedDiscountPercent),
    },
  ]

  const reasonCodes = lineReasonCodes(normalizedDisposition)
  const ruleHits = lineRuleHits({
    normalizedDisposition,
    insightType,
    itemRiskScore,
  })
  const primaryObjective = primaryObjectiveForInsight({
    insightType,
    normalizedDisposition,
  })
  const objectiveScore = objectiveScoreForInsight({
    primaryObjective,
    confidenceScore,
    fitScore,
    itemRiskScore,
    arrDelta,
    quantityDelta,
    scenarioKey,
  })
  const expectedImpact: QuoteInsightExpectedImpactView = {
    arrDelta,
    marginDirection: marginDirectionFromArrDelta(arrDelta),
    retentionRisk: retentionRiskBandFromScore(itemRiskScore),
  }

  return buildJustificationJson({
    version: 'v2',
    sourceType: 'RULE_ENGINE',
    insightType,
    scenarioKey,
    reasoning,
    signals,
    commercialDelta: {
      currentQuantity,
      proposedQuantity,
      quantityDelta,
      currentArr: currentArrNumber,
      proposedArr: proposedArrNumber,
      arrDelta,
      currentUnitPrice: toEvidenceNumber(currentNetUnitPrice),
      proposedUnitPrice: toEvidenceNumber(proposedNetUnitPrice),
      recommendedDiscountPercent: toEvidenceNumber(recommendedDiscountPercent),
    },
    decisionMeta: {
      decisionRunId,
      generatedAt: generatedAtIso,
      actor: 'RULE_ENGINE',
      engineVersion: DECISION_ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      sourceRecordVersion,
    },
    reasonCodes,
    ruleHits,
    alternativesConsidered: defaultAlternatives(insightType),
    expectedImpact,
    changeLog: null,
    objectiveLens: {
      primaryObjective,
      objectiveScore,
      businessKpi: businessKpiForObjective(primaryObjective),
      signalDrivers: buildLineObjectiveDrivers({
        primaryObjective,
        scenarioKey,
        itemRiskScore,
        usagePercentOfEntitlement,
        activeUserPercent,
        loginTrend30d,
        ticketCount90d,
        sev1Count90d,
        paymentRiskBand,
        arrDelta,
        quantityDelta,
        recommendedDiscountPercent: toEvidenceNumber(recommendedDiscountPercent),
      }),
    },
    ml: mlPrediction
      ? {
          status: 'OK',
          affectsRecommendation: Boolean(mlAffectsRecommendation),
          riskScore: mlPrediction.riskScore,
          riskProbability: mlPrediction.riskProbability,
          expansionScore: mlPrediction.expansionScore,
          expansionProbability: mlPrediction.expansionProbability,
          topFeatures: mlPrediction.topFeatures,
        }
      : null,
  })
}

function buildAdditiveInsightJustification(args: {
  insightType: string
  scenarioKey: string | null
  decisionRunId: string
  generatedAtIso: string
  accountSegment: string | null
  accountIndustry: string | null
  reasoning: string[]
  signals: QuoteInsightEvidenceSignalView[]
  recommendedQuantity: number
  recommendedUnitPrice: Prisma.Decimal
  estimatedArrImpact: Prisma.Decimal
  recommendedDiscountPercent: Prisma.Decimal | null
  confidenceScore: number
  fitScore: number
}): string {
  const {
    insightType,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
    accountSegment,
    accountIndustry,
    reasoning,
    signals,
    recommendedQuantity,
    recommendedUnitPrice,
    estimatedArrImpact,
    recommendedDiscountPercent,
    confidenceScore,
    fitScore,
  } = args

  const arrDelta = toEvidenceNumber(estimatedArrImpact)
  const primaryObjective = primaryObjectiveForInsight({
    insightType,
    normalizedDisposition: insightType,
  })
  const objectiveScore = objectiveScoreForInsight({
    primaryObjective,
    confidenceScore,
    fitScore,
    itemRiskScore: null,
    arrDelta,
    quantityDelta: recommendedQuantity,
    scenarioKey,
  })
  const reasonCodes =
    insightType === 'HYBRID_DEPLOYMENT_FIT'
      ? ['HYBRID_DEPLOYMENT_FIT', 'STRATEGIC_ADJACENCY']
      : insightType === 'DATA_MODERNIZATION'
        ? ['DATA_MODERNIZATION', 'INDUSTRY_ALIGNMENT']
        : ['CROSS_SELL_SIGNAL', 'ADJACENT_EXPANSION']

  return buildJustificationJson({
    version: 'v2',
    sourceType: 'HYBRID',
    insightType,
    scenarioKey,
    reasoning,
    signals: [
      { label: 'Scenario', value: scenarioKey ?? 'BASE_CASE' },
      { label: 'Account Segment', value: accountSegment ?? 'Unknown' },
      { label: 'Account Industry', value: accountIndustry ?? 'Unknown' },
      { label: 'Confidence Score', value: confidenceScore },
      { label: 'Fit Score', value: fitScore },
      ...signals,
    ],
    commercialDelta: {
      currentQuantity: null,
      proposedQuantity: recommendedQuantity,
      quantityDelta: recommendedQuantity,
      currentArr: null,
      proposedArr: toEvidenceNumber(estimatedArrImpact),
      arrDelta: toEvidenceNumber(estimatedArrImpact),
      currentUnitPrice: null,
      proposedUnitPrice: toEvidenceNumber(recommendedUnitPrice),
      recommendedDiscountPercent: toEvidenceNumber(recommendedDiscountPercent),
    },
    decisionMeta: {
      decisionRunId,
      generatedAt: generatedAtIso,
      actor: 'HYBRID_RULE_ENGINE',
      engineVersion: DECISION_ENGINE_VERSION,
      policyVersion: POLICY_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      sourceRecordVersion: null,
    },
    reasonCodes,
    ruleHits: [
      {
        ruleId: `ADDITIVE_${insightType}`,
        reasonCode: reasonCodes[0] ?? 'ADDITIVE_RULE',
        outcome: 'TRIGGERED',
        weight: 78,
        detail: `Additive rule created ${insightType} from account profile and product mix.`,
      },
    ],
    alternativesConsidered: [
      {
        action: 'NO_ADDITIVE_ACTION',
        reasonRejected: 'Rejected because additive fit conditions were satisfied in this scenario.',
      },
      {
        action: 'QUEUE_FOR_NEXT_RENEWAL',
        reasonRejected:
          'Rejected because current scenario supports an immediate adjacent quote option.',
      },
    ],
    expectedImpact: {
      arrDelta,
      marginDirection: marginDirectionFromArrDelta(arrDelta),
      retentionRisk: 'LOW',
    },
    changeLog: null,
    objectiveLens: {
      primaryObjective,
      objectiveScore,
      businessKpi: businessKpiForObjective(primaryObjective),
      signalDrivers: buildAdditiveObjectiveDrivers({
        scenarioKey,
        accountIndustry,
        accountSegment,
        confidenceScore,
        fitScore,
      }),
    },
  })
}

function buildLineInsight(args: {
  caseId: string
  scenarioKey: string | null
  decisionRunId: string
  generatedAtIso: string
  productSkuSnapshot: string
  productNameSnapshot: string
  productFamilySnapshot: string
  currentQuantity: number
  currentNetUnitPrice: Prisma.Decimal
  currentArr: Prisma.Decimal
  recommendedDisposition: string | null
  proposedQuantity: number
  proposedNetUnitPrice: Prisma.Decimal
  proposedArr: Prisma.Decimal
  recommendedDiscountPercent: Prisma.Decimal | null
  itemRiskScore: number | null
  analysisSummary: string | null
  sourceRecordVersion: string | null
  usagePercentOfEntitlement: number | null
  activeUserPercent: number | null
  loginTrend30d: number | null
  ticketCount90d: number | null
  sev1Count90d: number | null
  csatScore: number | null
  paymentRiskBand: string | null
  adoptionBand: string | null
  signalSnapshotDate: string | null
  mlPrediction?: MlInsightPrediction | null
  mlAffectsRecommendation?: boolean
}) {
  const {
    caseId,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
    productSkuSnapshot,
    productNameSnapshot,
    productFamilySnapshot,
    currentQuantity,
    currentNetUnitPrice,
    currentArr,
    recommendedDisposition,
    proposedQuantity,
    proposedNetUnitPrice,
    proposedArr,
    recommendedDiscountPercent,
    itemRiskScore,
    analysisSummary,
    sourceRecordVersion,
    usagePercentOfEntitlement,
    activeUserPercent,
    loginTrend30d,
    ticketCount90d,
    sev1Count90d,
    csatScore,
    paymentRiskBand,
    adoptionBand,
    signalSnapshotDate,
    mlPrediction,
    mlAffectsRecommendation,
  } = args

  const normalizedDisposition = recommendedDisposition ?? 'RENEW'
  const baseScore = itemRiskScore ?? 60
  const productId = SKU_TO_PRODUCT_ID[productSkuSnapshot]

  if (!productId) return null

  const estimatedArrImpact = decimal(proposedArr).minus(decimal(currentArr)).toDecimalPlaces(2)

  let insightType = 'RENEW_AS_IS'
  let title = `Renew ${productNameSnapshot} at current posture`
  let insightSummary =
    analysisSummary ??
    `Maintain the current commercial posture on ${productNameSnapshot} based on the latest renewal recommendation.`
  let recommendedActionSummary = `Keep ${productNameSnapshot} aligned to the current quote recommendation.`

  switch (normalizedDisposition) {
    case 'MARGIN_RECOVERY':
    case 'PRICE_ADJUST':
      insightType = 'MARGIN_RECOVERY'
      title = `Recover margin on ${productNameSnapshot}`
      recommendedActionSummary =
        `Reduce discount depth on ${productNameSnapshot} and move the line closer to policy.`
      break

    case 'RENEW_WITH_CONCESSION':
    case 'STRATEGIC_CONCESSION':
    case 'CONCESSION':
      insightType = 'CONCESSION'
      title = `Apply controlled concession on ${productNameSnapshot}`
      recommendedActionSummary =
        `Renew ${productNameSnapshot} with a controlled concession to preserve renewal momentum.`
      break

    case 'EXPANSION':
    case 'EXPAND':
      insightType = 'EXPANSION'
      title = `Expand ${productNameSnapshot}`
      recommendedActionSummary =
        `Increase quantity on ${productNameSnapshot} in line with the current quote recommendation.`
      break

    case 'ESCALATE':
    case 'DEFENSIVE_RENEWAL':
      insightType = 'DEFENSIVE_RENEWAL'
      title = `Protect ${productNameSnapshot} with a defensive renewal`
      recommendedActionSummary =
        `Route ${productNameSnapshot} for escalation review and hold pricing stable until risk is cleared.`
      break

    case 'UPLIFT_RESTRAINT':
      insightType = 'UPLIFT_RESTRAINT'
      title = `Restrain uplift on ${productNameSnapshot}`
      recommendedActionSummary =
        `Hold ${productNameSnapshot} flat and avoid uplift in the current quote recommendation.`
      break

    case 'CONTROLLED_UPLIFT':
    case 'UPLIFT':
      insightType = 'CONTROLLED_UPLIFT'
      title = `Apply controlled uplift on ${productNameSnapshot}`
      recommendedActionSummary =
        `Renew ${productNameSnapshot} with a modest uplift aligned to low-risk posture.`
      break

    case 'RENEW_AS_IS':
    case 'RENEW':
    default:
      insightType = 'RENEW_AS_IS'
      title = `Renew ${productNameSnapshot} at current posture`
      recommendedActionSummary =
        `Keep ${productNameSnapshot} unchanged in the draft and preserve the current pricing posture.`
      break
  }

  const heuristicConfidenceScore = clampScore(100 - baseScore / 2)
  const heuristicFitScore = clampScore(100 - baseScore / 3)
  const confidenceScore =
    mlPrediction?.riskScore != null
      ? clampScore(
          Math.round(
            heuristicConfidenceScore * 0.7 +
              (100 - Math.abs(baseScore - mlPrediction.riskScore)) * 0.3,
          ),
        )
      : heuristicConfidenceScore
  const fitScore =
    insightType === 'EXPANSION' && mlPrediction?.expansionScore != null
      ? clampScore(Math.round(heuristicFitScore * 0.6 + mlPrediction.expansionScore * 0.4))
      : heuristicFitScore

  const recommendedQuantity =
    insightType === 'EXPANSION'
      ? Math.max(proposedQuantity - currentQuantity, 0)
      : proposedQuantity

  const effectiveEstimatedArrImpact =
    insightType === 'EXPANSION'
      ? decimal(proposedNetUnitPrice)
          .mul(Math.max(proposedQuantity - currentQuantity, 0))
          .toDecimalPlaces(2)
      : estimatedArrImpact

  const justificationJson = buildLineInsightJustification({
    insightType,
    normalizedDisposition,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
    sourceRecordVersion,
    itemRiskScore,
    confidenceScore,
    fitScore,
    currentQuantity,
    proposedQuantity,
    currentArr: decimal(currentArr),
    proposedArr: decimal(proposedArr),
    currentNetUnitPrice: decimal(currentNetUnitPrice),
    proposedNetUnitPrice: decimal(proposedNetUnitPrice),
    recommendedDiscountPercent,
    analysisSummary,
    usagePercentOfEntitlement,
    activeUserPercent,
    loginTrend30d,
    ticketCount90d,
    sev1Count90d,
    csatScore,
    paymentRiskBand,
    adoptionBand,
    signalSnapshotDate,
    mlPrediction,
    mlAffectsRecommendation,
  })

  return {
    id: makeId('qi'),
    renewalCaseId: caseId,
    sourceType: 'RULE_ENGINE',
    insightType,
    status: 'SUGGESTED',
    productId,
    productSkuSnapshot,
    productNameSnapshot,
    productFamilySnapshot,
    title,
    insightSummary,
    recommendedActionSummary,
    confidenceScore,
    fitScore,
    recommendedQuantity,
    recommendedUnitPrice: decimal(proposedNetUnitPrice),
    recommendedDiscountPercent: recommendedDiscountPercent
      ? decimal(recommendedDiscountPercent)
      : null,
    estimatedArrImpact: effectiveEstimatedArrImpact,
    justificationJson,
    addedQuoteDraftId: null,
    addedQuoteDraftLineId: null,
    dismissedReason: null,
  }
}

function buildAdditiveInsights(args: {
  caseId: string
  account: { industry: string | null; segment: string | null; name: string }
  existingSkus: Set<string>
  existingAppliedFingerprints: Set<string>
  scenarioKey?: string | null
  decisionRunId: string
  generatedAtIso: string
}) {
  const {
    caseId,
    account,
    existingSkus,
    existingAppliedFingerprints,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
  } = args
  const insights: any[] = []

  const isExpansionScenario = scenarioKey === 'EXPANSION_UPSIDE'
  const isRiskScenario = scenarioKey === 'CUSTOMER_RISK_ESCALATION' || scenarioKey === 'ADOPTION_DECLINE'

  const isRegulated =
    ['Healthcare', 'Public Sector', 'Government', 'Utilities'].includes(account.industry ?? '') ||
    account.segment === 'STRATEGIC'

  const canAddCloudAtCustomer =
    !existingSkus.has('ORCL-CLOUD-AT-CUSTOMER') &&
    !existingAppliedFingerprints.has('HYBRID_DEPLOYMENT_FIT|ORCL-CLOUD-AT-CUSTOMER')

  if ((isRegulated || isExpansionScenario) && canAddCloudAtCustomer && !isRiskScenario) {
    const recommendedQuantity = 1
    const recommendedUnitPrice = new Prisma.Decimal(134900)
    const recommendedDiscountPercent = new Prisma.Decimal(4)
    const estimatedArrImpact = new Prisma.Decimal(134900)

    const reasoning = [
      isRegulated
        ? 'Regulated/strategic account profile supports deployment-controlled hybrid options.'
        : 'Account profile is eligible for hybrid deployment cross-sell.',
      isExpansionScenario
        ? 'Expansion Upside scenario increases confidence for additive hybrid motion.'
        : 'Base scenario still supports hybrid fit without risk escalation triggers.',
      'Cloud@Customer is not already present in the current subscription mix.',
      'No risk-escalation scenario is active, so additive motion is allowed.',
    ]

    insights.push({
      id: makeId('qi'),
      renewalCaseId: caseId,
      sourceType: 'HYBRID',
      insightType: 'HYBRID_DEPLOYMENT_FIT',
      status: 'SUGGESTED',
      productId: 'prod_cloud_at_customer',
      productSkuSnapshot: 'ORCL-CLOUD-AT-CUSTOMER',
      productNameSnapshot: 'Oracle Cloud@Customer',
      productFamilySnapshot: 'Hybrid Deployment',
      title: 'Position Cloud@Customer for deployment-sensitive workloads',
      insightSummary:
        'The current quote recommendation and account profile suggest a credible hybrid deployment motion alongside the base renewal.',
      recommendedActionSummary:
        'Add Cloud@Customer as an optional strategic line and route for approval.',
      confidenceScore: isExpansionScenario ? 78 : 70,
      fitScore: isExpansionScenario ? 84 : 78,
      recommendedQuantity,
      recommendedUnitPrice,
      recommendedDiscountPercent,
      estimatedArrImpact,
      justificationJson: buildAdditiveInsightJustification({
        insightType: 'HYBRID_DEPLOYMENT_FIT',
        scenarioKey: scenarioKey ?? null,
        decisionRunId,
        generatedAtIso,
        accountSegment: account.segment,
        accountIndustry: account.industry,
        reasoning,
        signals: [
          { label: 'Regulated or Strategic Profile', value: isRegulated },
          { label: 'Expansion Scenario Active', value: isExpansionScenario },
          { label: 'Risk Scenario Active', value: isRiskScenario },
          { label: 'Cloud@Customer Already Present', value: existingSkus.has('ORCL-CLOUD-AT-CUSTOMER') },
          {
            label: 'Cloud@Customer Already Applied',
            value: existingAppliedFingerprints.has('HYBRID_DEPLOYMENT_FIT|ORCL-CLOUD-AT-CUSTOMER'),
          },
        ],
        recommendedQuantity,
        recommendedUnitPrice,
        estimatedArrImpact,
        recommendedDiscountPercent,
        confidenceScore: isExpansionScenario ? 78 : 70,
        fitScore: isExpansionScenario ? 84 : 78,
      }),
      addedQuoteDraftId: null,
      addedQuoteDraftLineId: null,
      dismissedReason: null,
    })
  }

  const hasDataPlatformBase =
    existingSkus.has('ORCL-OCI') || existingSkus.has('ORCL-AUTONOMOUS-AI-DB')

  const canAddAiDataPlatform =
    hasDataPlatformBase &&
    !existingSkus.has('ORCL-AI-DATA-PLATFORM') &&
    !existingAppliedFingerprints.has('CROSS_SELL|ORCL-AI-DATA-PLATFORM') &&
    !existingAppliedFingerprints.has('DATA_MODERNIZATION|ORCL-AI-DATA-PLATFORM')

  if (canAddAiDataPlatform && !isRiskScenario) {
    const insightType =
      account.industry === 'Healthcare' ? 'DATA_MODERNIZATION' : 'CROSS_SELL'
    const recommendedQuantity = 1
    const recommendedUnitPrice = new Prisma.Decimal(97250)
    const recommendedDiscountPercent = new Prisma.Decimal(10)
    const estimatedArrImpact = new Prisma.Decimal(97250)

    const reasoning = [
      hasDataPlatformBase
        ? 'Existing OCI/Autonomous footprint enables adjacent data-platform expansion.'
        : 'No base infrastructure footprint detected for additive data-platform motion.',
      account.industry === 'Healthcare'
        ? 'Healthcare profile maps to data modernization positioning.'
        : 'General enterprise profile maps to governed data cross-sell positioning.',
      'AI Data Platform is not already included in current subscription lines.',
      'No risk-escalation scenario is active, so additive motion is allowed.',
    ]

    insights.push({
      id: makeId('qi'),
      renewalCaseId: caseId,
      sourceType: 'HYBRID',
      insightType,
      status: 'SUGGESTED',
      productId: 'prod_ai_data_platform',
      productSkuSnapshot: 'ORCL-AI-DATA-PLATFORM',
      productNameSnapshot: 'Oracle AI Data Platform',
      productFamilySnapshot: 'AI / Data',
      title:
        insightType === 'DATA_MODERNIZATION'
          ? 'Add AI Data Platform to modernize governed analytics'
          : 'Add AI Data Platform as a governed data layer',
      insightSummary:
        'The latest quote recommendation suggests a credible adjacent data-platform motion based on the current infrastructure footprint.',
      recommendedActionSummary:
        'Add Oracle AI Data Platform as a new strategic quote line.',
      confidenceScore: isExpansionScenario ? 82 : 76,
      fitScore: isExpansionScenario ? 87 : 82,
      recommendedQuantity,
      recommendedUnitPrice,
      recommendedDiscountPercent,
      estimatedArrImpact,
      justificationJson: buildAdditiveInsightJustification({
        insightType,
        scenarioKey: scenarioKey ?? null,
        decisionRunId,
        generatedAtIso,
        accountSegment: account.segment,
        accountIndustry: account.industry,
        reasoning,
        signals: [
          { label: 'Data Platform Base Present', value: hasDataPlatformBase },
          { label: 'Expansion Scenario Active', value: isExpansionScenario },
          { label: 'Risk Scenario Active', value: isRiskScenario },
          { label: 'AI Data Platform Already Present', value: existingSkus.has('ORCL-AI-DATA-PLATFORM') },
          {
            label: 'AI Data Platform Already Applied',
            value:
              existingAppliedFingerprints.has('CROSS_SELL|ORCL-AI-DATA-PLATFORM') ||
              existingAppliedFingerprints.has('DATA_MODERNIZATION|ORCL-AI-DATA-PLATFORM'),
          },
        ],
        recommendedQuantity,
        recommendedUnitPrice,
        estimatedArrImpact,
        recommendedDiscountPercent,
        confidenceScore: isExpansionScenario ? 82 : 76,
        fitScore: isExpansionScenario ? 87 : 82,
      }),
      addedQuoteDraftId: null,
      addedQuoteDraftLineId: null,
      dismissedReason: null,
    })
  }

  return insights
}

type InsightComparisonSnapshot = {
  key: string
  insightType: string
  productSkuSnapshot: string
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

function buildInsightKey(insightType: string, productSkuSnapshot: string) {
  return `${insightType}|${productSkuSnapshot}`
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sameNullableNumber(a: number | null, b: number | null) {
  if (a === null || b === null) {
    return a === b
  }

  return Math.abs(a - b) < 0.0001
}

function normalizeInsightForDiff(item: {
  insightType: string
  productSkuSnapshot: string
  title?: string | null
  insightSummary?: string | null
  recommendedActionSummary?: string | null
  confidenceScore?: number | null
  fitScore?: number | null
  recommendedQuantity?: number | null
  recommendedUnitPrice?: unknown
  recommendedDiscountPercent?: unknown
  estimatedArrImpact?: unknown
}): InsightComparisonSnapshot {
  return {
    key: buildInsightKey(item.insightType, item.productSkuSnapshot),
    insightType: item.insightType,
    productSkuSnapshot: item.productSkuSnapshot,
    title: item.title ?? null,
    insightSummary: item.insightSummary ?? null,
    recommendedActionSummary: item.recommendedActionSummary ?? null,
    confidenceScore: item.confidenceScore ?? null,
    fitScore: item.fitScore ?? null,
    recommendedQuantity: item.recommendedQuantity ?? null,
    recommendedUnitPrice: toNullableNumber(item.recommendedUnitPrice),
    recommendedDiscountPercent: toNullableNumber(item.recommendedDiscountPercent),
    estimatedArrImpact: toNullableNumber(item.estimatedArrImpact),
  }
}

function toLlmQuoteInsightCandidate(item: {
  insightType: string
  productSkuSnapshot: string
  productNameSnapshot: string
  productFamilySnapshot: string
  title: string
  insightSummary: string
  recommendedActionSummary?: string | null
  confidenceScore?: number | null
  fitScore?: number | null
  recommendedQuantity?: number | null
  recommendedUnitPrice?: unknown
  recommendedDiscountPercent?: unknown
  estimatedArrImpact?: unknown
}): QuoteInsightLlmCandidate {
  return {
    insightKey: buildInsightKey(item.insightType, item.productSkuSnapshot),
    productSkuSnapshot: item.productSkuSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    productFamilySnapshot: item.productFamilySnapshot,
    insightType: item.insightType,
    title: item.title,
    insightSummary: item.insightSummary,
    recommendedActionSummary: item.recommendedActionSummary ?? null,
    confidenceScore: item.confidenceScore ?? null,
    fitScore: item.fitScore ?? null,
    recommendedQuantity: item.recommendedQuantity ?? null,
    recommendedUnitPrice: toNullableNumber(item.recommendedUnitPrice),
    recommendedDiscountPercent: toNullableNumber(item.recommendedDiscountPercent),
    estimatedArrImpact: toNullableNumber(item.estimatedArrImpact),
  }
}

function mergeLlmCandidateIntoInsight<T extends {
  productSkuSnapshot: string
  title: string
  insightSummary: string
  recommendedActionSummary?: string | null
  confidenceScore?: number | null
  fitScore?: number | null
  recommendedQuantity?: number | null
  recommendedUnitPrice?: unknown
  recommendedDiscountPercent?: unknown
  estimatedArrImpact?: unknown
  sourceType: string
  justificationJson?: string | null
}>(item: T, candidate: QuoteInsightLlmCandidate | null, trace: QuoteInsightLlmTrace): T {
  if (!candidate || !trace.acceptedProductSkus.includes(item.productSkuSnapshot)) {
    return item
  }

  const justification = parseQuoteInsightJustification(item.justificationJson)
  const nextJustification = justification
    ? buildJustificationJson({
        ...justification,
        sourceType: 'LLM_ASSISTED_GUARDED',
        reasoning: [
          `LLM-assisted guarded calculation accepted this ${candidate.insightType} Quote Insight inside the deterministic safe candidate envelope.`,
          ...justification.reasoning,
        ].slice(0, 8),
        signals: [
          ...justification.signals,
          { label: 'LLM Calculation Mode', value: trace.mode },
          { label: 'LLM Model', value: trace.modelLabel },
          { label: 'LLM Validation Status', value: trace.validationStatus },
          { label: 'LLM Prompt Version', value: trace.promptVersion },
        ],
        decisionMeta: justification.decisionMeta
          ? {
              ...justification.decisionMeta,
              actor: 'LLM_ASSISTED_GUARDED',
            }
          : justification.decisionMeta,
        ruleHits: [
          ...(justification.ruleHits ?? []),
          {
            ruleId: 'LLM_QUOTE_INSIGHT_CALCULATION_ACCEPTED',
            reasonCode: 'LLM_GUARDED_VALIDATION_PASSED',
            outcome: 'ACCEPTED',
            weight: 80,
            detail:
              'LLM proposal matched the supported product, insight type, and deterministic commercial math.',
          },
        ],
      })
    : item.justificationJson

  return {
    ...item,
    sourceType: 'LLM_ASSISTED_GUARDED',
    title: candidate.title,
    insightSummary: candidate.insightSummary,
    recommendedActionSummary: candidate.recommendedActionSummary,
    confidenceScore: candidate.confidenceScore,
    fitScore: candidate.fitScore,
    recommendedQuantity: candidate.recommendedQuantity,
    recommendedUnitPrice:
      candidate.recommendedUnitPrice == null ? null : decimal(candidate.recommendedUnitPrice),
    recommendedDiscountPercent:
      candidate.recommendedDiscountPercent == null
        ? null
        : decimal(candidate.recommendedDiscountPercent),
    estimatedArrImpact:
      candidate.estimatedArrImpact == null ? null : decimal(candidate.estimatedArrImpact),
    justificationJson: nextJustification,
  }
}

function parseMlInsightPredictions(raw: string | null | undefined) {
  if (!raw) {
    return {
      affectsRecommendation: false,
      predictionsByItemId: new Map<string, MlInsightPrediction>(),
    }
  }

  try {
    const parsed = JSON.parse(raw) as {
      ml?: {
        affectsRecommendation?: boolean
        itemPredictions?: MlInsightPrediction[]
      } | null
    }
    const predictions = Array.isArray(parsed.ml?.itemPredictions)
      ? parsed.ml.itemPredictions
      : []
    return {
      affectsRecommendation: Boolean(parsed.ml?.affectsRecommendation),
      predictionsByItemId: new Map(
        predictions.map((item) => [
          String(item.itemId),
          {
            itemId: String(item.itemId),
            riskScore: item.riskScore == null ? null : Number(item.riskScore),
            riskProbability:
              item.riskProbability == null ? null : Number(item.riskProbability),
            expansionScore:
              item.expansionScore == null ? null : Number(item.expansionScore),
            expansionProbability:
              item.expansionProbability == null ? null : Number(item.expansionProbability),
            topFeatures: Array.isArray(item.topFeatures) ? item.topFeatures.map(String) : [],
          },
        ]),
      ),
    }
  } catch {
    return {
      affectsRecommendation: false,
      predictionsByItemId: new Map<string, MlInsightPrediction>(),
    }
  }
}

export async function recalculateQuoteInsights(caseId: string) {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: caseId },
    include: {
      account: true,
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          subscription: {
            select: {
              metricSnapshots: {
                orderBy: { snapshotDate: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
      quoteInsights: true,
    },
  })

  if (!renewalCase) {
    throw new Error(`Renewal case ${caseId} not found.`)
  }

  const scenarioKey = renewalCase.demoScenarioKey ?? 'BASE_CASE'
  const generatedAtIso = new Date().toISOString()
  const decisionRunId = makeId('qirun')
  const mlContext = parseMlInsightPredictions(renewalCase.lastRecommendationJson)

  const appliedFingerprints = new Set(
    renewalCase.quoteInsights
      .filter((item) => item.status === 'ADDED_TO_QUOTE')
      .map((item) => `${item.insightType}|${item.productSkuSnapshot}`),
  )

  const previousSuggested = renewalCase.quoteInsights
    .filter((item) => item.status !== 'ADDED_TO_QUOTE')
    .map((item) => normalizeInsightForDiff(item))

  const lineInsights = renewalCase.items
    .map((item) => {
      const productSkuSnapshot = getSkuForProductName(item.productNameSnapshot)
      const latestSnapshot = item.subscription.metricSnapshots[0] ?? null
      return buildLineInsight({
        caseId,
        scenarioKey,
        decisionRunId,
        generatedAtIso,
        productSkuSnapshot,
        productNameSnapshot: item.productNameSnapshot,
        productFamilySnapshot: getProductFamilyForProductName(item.productNameSnapshot),
        currentQuantity: item.currentQuantity,
        currentNetUnitPrice: decimal(item.currentNetUnitPrice),
        currentArr: decimal(item.currentArr),
        recommendedDisposition: item.recommendedDisposition,
        proposedQuantity: item.proposedQuantity ?? item.currentQuantity,
        proposedNetUnitPrice: decimal(item.proposedNetUnitPrice),
        proposedArr: decimal(item.proposedArr),
        recommendedDiscountPercent:
          item.recommendedDiscountPercent != null
            ? decimal(item.recommendedDiscountPercent)
            : null,
        itemRiskScore: item.itemRiskScore,
        analysisSummary: item.analysisSummary,
        sourceRecordVersion: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
        usagePercentOfEntitlement: toEvidenceNumber(latestSnapshot?.usagePercentOfEntitlement),
        activeUserPercent: toEvidenceNumber(latestSnapshot?.activeUserPercent),
        loginTrend30d: toEvidenceNumber(latestSnapshot?.loginTrend30d),
        ticketCount90d: latestSnapshot?.ticketCount90d ?? null,
        sev1Count90d: latestSnapshot?.sev1Count90d ?? null,
        csatScore: toEvidenceNumber(latestSnapshot?.csatScore),
        paymentRiskBand: latestSnapshot?.paymentRiskBand ?? null,
        adoptionBand: latestSnapshot?.adoptionBand ?? null,
        signalSnapshotDate: latestSnapshot ? latestSnapshot.snapshotDate.toISOString() : null,
        mlPrediction: mlContext.predictionsByItemId.get(item.id) ?? null,
        mlAffectsRecommendation: mlContext.affectsRecommendation,
      })
    })
    .filter(Boolean)
    .filter(
      (item) =>
        !appliedFingerprints.has(`${item!.insightType}|${item!.productSkuSnapshot}`),
    ) as any[]

  const existingSkus = new Set(
    renewalCase.items.map((item) => getSkuForProductName(item.productNameSnapshot)),
  )

  const additiveInsights = buildAdditiveInsights({
    caseId,
    account: {
      industry: renewalCase.account.industry,
      segment: renewalCase.account.segment,
      name: renewalCase.account.name,
    },
    existingSkus,
    existingAppliedFingerprints: appliedFingerprints,
    scenarioKey,
    decisionRunId,
    generatedAtIso,
  })

  const deterministicInsights = [...lineInsights, ...additiveInsights]
  const runtimeSettings = getRuntimeSettings()
  const llmCalculation = await calculateQuoteInsightsWithLlm({
    mode: runtimeSettings.guardedDecisioningMode,
    caseContext: {
      caseId,
      accountName: renewalCase.account.name,
      accountIndustry: renewalCase.account.industry,
      accountSegment: renewalCase.account.segment,
      recommendedAction: renewalCase.recommendedAction,
      riskLevel: renewalCase.riskLevel,
      riskScore: renewalCase.riskScore,
      scenarioKey,
    },
    candidates: deterministicInsights.map((item) => toLlmQuoteInsightCandidate(item)),
  })
  const llmCandidateBySku = new Map(
    llmCalculation.insights.map((candidate) => [candidate.productSkuSnapshot, candidate]),
  )
  const calculatedInsights = deterministicInsights.map((item) =>
    mergeLlmCandidateIntoInsight(
      item,
      llmCandidateBySku.get(item.productSkuSnapshot) ?? null,
      llmCalculation.trace,
    ),
  )
  const bundleCurrentArr = renewalCase.items.reduce(
    (sum, item) => sum.add(decimal(item.currentArr)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2)
  const bundleDeltaArr = calculatedInsights.reduce(
    (sum, item) => sum.add(decimal(item.estimatedArrImpact)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2)
  const bundleProposedArr = bundleCurrentArr.add(bundleDeltaArr).toDecimalPlaces(2)

  const nextSuggested = calculatedInsights.map((item) =>
    normalizeInsightForDiff(item),
  )

  const previousByKey = new Map(previousSuggested.map((item) => [item.key, item]))
  const nextByKey = new Map(nextSuggested.map((item) => [item.key, item]))

  const added = nextSuggested.filter(
    (next) => !previousByKey.has(next.key),
  ).map((item) => ({
    insightType: item.insightType,
    productSkuSnapshot: item.productSkuSnapshot,
    title: item.title,
  }))

  const removed = previousSuggested.filter(
    (prev) => !nextByKey.has(prev.key),
  ).map((item) => ({
    insightType: item.insightType,
    productSkuSnapshot: item.productSkuSnapshot,
    title: item.title,
  }))

  const modified = nextSuggested.flatMap((next) => {
    const previous = previousByKey.get(next.key)
    if (!previous) return []

    const changedFields: string[] = []

    if (previous.title !== next.title) changedFields.push('title')
    if (previous.insightSummary !== next.insightSummary) changedFields.push('insightSummary')
    if (previous.recommendedActionSummary !== next.recommendedActionSummary) {
      changedFields.push('recommendedActionSummary')
    }
    if (!sameNullableNumber(previous.confidenceScore, next.confidenceScore)) {
      changedFields.push('confidenceScore')
    }
    if (!sameNullableNumber(previous.fitScore, next.fitScore)) {
      changedFields.push('fitScore')
    }
    if (!sameNullableNumber(previous.recommendedQuantity, next.recommendedQuantity)) {
      changedFields.push('recommendedQuantity')
    }
    if (!sameNullableNumber(previous.recommendedUnitPrice, next.recommendedUnitPrice)) {
      changedFields.push('recommendedUnitPrice')
    }
    if (!sameNullableNumber(previous.recommendedDiscountPercent, next.recommendedDiscountPercent)) {
      changedFields.push('recommendedDiscountPercent')
    }
    if (!sameNullableNumber(previous.estimatedArrImpact, next.estimatedArrImpact)) {
      changedFields.push('estimatedArrImpact')
    }

    if (changedFields.length === 0) return []

    return [
      {
        insightType: next.insightType,
        productSkuSnapshot: next.productSkuSnapshot,
        title: next.title,
        changedFields,
        previous: {
          title: previous.title,
          insightSummary: previous.insightSummary,
          recommendedActionSummary: previous.recommendedActionSummary,
          confidenceScore: previous.confidenceScore,
          fitScore: previous.fitScore,
          recommendedQuantity: previous.recommendedQuantity,
          recommendedUnitPrice: previous.recommendedUnitPrice,
          recommendedDiscountPercent: previous.recommendedDiscountPercent,
          estimatedArrImpact: previous.estimatedArrImpact,
        },
        next: {
          title: next.title,
          insightSummary: next.insightSummary,
          recommendedActionSummary: next.recommendedActionSummary,
          confidenceScore: next.confidenceScore,
          fitScore: next.fitScore,
          recommendedQuantity: next.recommendedQuantity,
          recommendedUnitPrice: next.recommendedUnitPrice,
          recommendedDiscountPercent: next.recommendedDiscountPercent,
          estimatedArrImpact: next.estimatedArrImpact,
        },
      },
    ]
  })

  const modifiedByKey = new Map(
    modified.map((item) => [buildInsightKey(item.insightType, item.productSkuSnapshot), item]),
  )

  const enrichedSuggestedInsights = calculatedInsights.map((item) => {
    const key = buildInsightKey(item.insightType, item.productSkuSnapshot)
    const previous = previousByKey.get(key)
    const modifiedEntry = modifiedByKey.get(key)

    const changeLog: QuoteInsightChangeLogView | null = !previous
      ? {
          fromSummary: null,
          toSummary: item.recommendedActionSummary ?? item.insightSummary ?? null,
          changedFields: ['added'],
          changedAt: generatedAtIso,
        }
      : modifiedEntry
        ? {
            fromSummary:
              modifiedEntry.previous.recommendedActionSummary ??
              modifiedEntry.previous.insightSummary ??
              null,
            toSummary:
              modifiedEntry.next.recommendedActionSummary ?? modifiedEntry.next.insightSummary ?? null,
            changedFields: modifiedEntry.changedFields,
            changedAt: generatedAtIso,
          }
        : null

    const justification = parseQuoteInsightJustification(item.justificationJson)
    if (!justification) {
      return item
    }

    return {
      ...item,
      justificationJson: buildJustificationJson({
        ...justification,
        version: 'v2',
        changeLog,
      }),
    }
  })

  await prisma.$transaction(async (tx) => {
    await tx.quoteInsight.deleteMany({
      where: {
        renewalCaseId: caseId,
        status: { not: 'ADDED_TO_QUOTE' },
      },
    })

    if (enrichedSuggestedInsights.length > 0) {
      await tx.quoteInsight.createMany({
        data: enrichedSuggestedInsights,
      })
    }

    await tx.renewalCase.update({
      where: { id: caseId },
      data: {
        quoteInsightsNeedRefresh: false,
        quoteInsightsGeneratedAt: new Date(),
        quoteScenariosNeedRefresh: true,
        bundleCurrentArr,
        bundleProposedArr,
        bundleDeltaArr,
        lastInsightDiffJson: JSON.stringify({
          added,
          removed,
          modified,
          regeneratedAt: generatedAtIso,
          scenarioKey,
          decisionRunId,
          engineVersion: DECISION_ENGINE_VERSION,
          policyVersion: POLICY_VERSION,
          scenarioVersion: SCENARIO_VERSION,
          quoteInsightCalculation: llmCalculation.trace,
        }),
      },
    })
  })

  return {
    caseId,
    regeneratedCount: enrichedSuggestedInsights.length,
    diffSummary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
    },
    quoteInsightCalculation: {
      mode: llmCalculation.trace.mode,
      generatedBy: llmCalculation.trace.generatedBy,
      validationStatus: llmCalculation.trace.validationStatus,
      acceptedProductSkus: llmCalculation.trace.acceptedProductSkus,
      fallbackReason: llmCalculation.trace.fallbackReason,
    },
  }
}

export async function getQuoteInsightsByRenewalCaseId(
  renewalCaseId: string,
): Promise<{
  caseId: string
  currencyCode: string
  needsRefresh: boolean
  generatedAtLabel: string | null
  items: QuoteInsightView[]
}> {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: renewalCaseId },
    select: {
      id: true,
      quoteInsightsNeedRefresh: true,
      quoteInsightsGeneratedAt: true,
      account: {
        select: {
          billingCurrency: true,
        },
      },
      quoteInsights: {
        orderBy: [
          { status: 'asc' },
          { fitScore: 'desc' },
          { confidenceScore: 'desc' },
          { createdAt: 'desc' },
        ],
      },
      narratives: {
        where: {
          scopeType: 'CASE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          narrativeType: true,
          content: true,
          modelLabel: true,
        },
      },
    },
  })

  if (!renewalCase) {
    return {
      caseId: renewalCaseId,
      currencyCode: 'USD',
      needsRefresh: false,
      generatedAtLabel: null,
      items: [],
    }
  }

  const currencyCode = renewalCase.account.billingCurrency || 'USD'

  const narrativeMap = new Map<string, { content: string; modelLabel: string | null }>()

  for (const narrative of renewalCase.narratives) {
    if (
      narrative.narrativeType.startsWith('QUOTE_INSIGHT_') &&
      !narrativeMap.has(narrative.narrativeType)
    ) {
      narrativeMap.set(narrative.narrativeType, {
        content: narrative.content,
        modelLabel: narrative.modelLabel,
      })
    }
  }

  return {
    caseId: renewalCase.id,
    currencyCode,
    needsRefresh: renewalCase.quoteInsightsNeedRefresh,
    generatedAtLabel: renewalCase.quoteInsightsGeneratedAt
      ? formatDate(renewalCase.quoteInsightsGeneratedAt)
      : null,
    items: renewalCase.quoteInsights.map((item) => {
      const isAddedToQuote = item.status === 'ADDED_TO_QUOTE'
      const narrative = narrativeMap.get(`QUOTE_INSIGHT_${item.id}`)
      const parsedJustification = parseQuoteInsightJustification(item.justificationJson)
      const justification =
        parsedJustification ??
        buildFallbackQuoteInsightJustification({
          sourceType: item.sourceType,
          insightType: item.insightType,
          title: item.title,
          insightSummary: item.insightSummary,
          recommendedActionSummary: item.recommendedActionSummary,
          confidenceScore: item.confidenceScore,
          fitScore: item.fitScore,
          recommendedQuantity: item.recommendedQuantity,
          recommendedUnitPrice: item.recommendedUnitPrice,
          recommendedDiscountPercent: item.recommendedDiscountPercent,
          estimatedArrImpact: item.estimatedArrImpact,
          createdAt: item.createdAt,
        })

      return {
        id: item.id,
        title: item.title,
        insightType: item.insightType,
        insightTypeLabel: labelize(item.insightType),
        statusLabel: labelize(item.status),
        statusTone: toneForStatus(item.status),
        isAddedToQuote,
        productName: item.productNameSnapshot,
        productSku: item.productSkuSnapshot,
        productFamily: item.productFamilySnapshot,
        insightSummary: item.insightSummary,
        recommendedActionSummary: item.recommendedActionSummary,
        aiExplanation: narrative?.content ?? null,
        aiModelLabel: narrative?.modelLabel ?? null,
        confidenceScore: item.confidenceScore,
        fitScore: item.fitScore,
        recommendedQuantity: item.recommendedQuantity,
        recommendedUnitPriceFormatted:
          item.recommendedUnitPrice != null
            ? formatCurrency(Number(item.recommendedUnitPrice), currencyCode)
            : null,
        recommendedDiscountPercentFormatted:
          item.recommendedDiscountPercent != null
            ? formatPercent(Number(item.recommendedDiscountPercent))
            : null,
        estimatedArrImpactFormatted:
          item.estimatedArrImpact != null
            ? formatCurrency(Number(item.estimatedArrImpact), currencyCode)
            : null,
        justification,
      }
    }),
  }
}
