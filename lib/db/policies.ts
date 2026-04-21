import { prisma } from '@/lib/prisma'
import { labelize } from '@/lib/format/risk'
import { scoreRenewalCaseItem } from '@/lib/rules/renewal-scoring'

function toNumber(value: unknown): number {
  if (value == null) return 0
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toIsoDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toISOString().slice(0, 10)
}

export type PricingPolicyView = {
  id: string
  name: string
  accountSegment: string | null
  accountSegmentLabel: string
  productFamily: string | null
  productFamilyLabel: string
  maxAutoDiscountPercent: number
  approvalDiscountPercent: number
  floorPricePercentOfList: number
  expansionThresholdUsagePercent: number | null
  requiresEscalationIfSev1Count: number | null
  isActive: boolean
}

export type PolicyStudioExampleSeed = {
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
  subscription: {
    quantity: number
    listUnitPrice: number
    discountPercent: number
    arr: number
  }
  snapshots: Array<{
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
  }>
  latestRiskScore: number
}

export type PolicyStudioSeedProfile = {
  subscriptionCount: number
  snapshotCount: number
  averageSnapshotsPerSubscription: number
  snapshotWindowLabel: string
  improvingLoginTrendCount: number
  decliningLoginTrendCount: number
  highPaymentRiskCount: number
}

export async function getPricingPolicies(): Promise<PricingPolicyView[]> {
  const rows = await prisma.pricingPolicy.findMany({
    orderBy: [
      { isActive: 'desc' },
      { accountSegment: 'asc' },
      { productFamily: 'asc' },
      { name: 'asc' },
    ],
  })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    accountSegment: row.accountSegment,
    accountSegmentLabel: row.accountSegment ? labelize(row.accountSegment) : 'All segments',
    productFamily: row.productFamily,
    productFamilyLabel: row.productFamily ? labelize(row.productFamily) : 'All product families',
    maxAutoDiscountPercent: Number(row.maxAutoDiscountPercent),
    approvalDiscountPercent: Number(row.approvalDiscountPercent),
    floorPricePercentOfList: Number(row.floorPricePercentOfList),
    expansionThresholdUsagePercent:
      row.expansionThresholdUsagePercent != null
        ? Number(row.expansionThresholdUsagePercent)
        : null,
    requiresEscalationIfSev1Count:
      row.requiresEscalationIfSev1Count != null
        ? Number(row.requiresEscalationIfSev1Count)
        : null,
    isActive: row.isActive,
  }))
}

export async function getPolicyStudioSeedProfile(): Promise<PolicyStudioSeedProfile> {
  const subscriptions = await prisma.subscription.findMany({
    select: {
      id: true,
      metricSnapshots: {
        orderBy: {
          snapshotDate: 'asc',
        },
        select: {
          snapshotDate: true,
          loginTrend30d: true,
          paymentRiskBand: true,
        },
      },
    },
  })

  if (subscriptions.length === 0) {
    return {
      subscriptionCount: 0,
      snapshotCount: 0,
      averageSnapshotsPerSubscription: 0,
      snapshotWindowLabel: 'No snapshot data',
      improvingLoginTrendCount: 0,
      decliningLoginTrendCount: 0,
      highPaymentRiskCount: 0,
    }
  }

  const allSnapshots = subscriptions.flatMap((row) => row.metricSnapshots)
  const dates = allSnapshots.map((row) => row.snapshotDate).filter(Boolean) as Date[]
  dates.sort((a, b) => a.getTime() - b.getTime())
  const earliest = dates[0]
  const latest = dates[dates.length - 1]

  let improvingLoginTrendCount = 0
  let decliningLoginTrendCount = 0
  let highPaymentRiskCount = 0

  for (const subscription of subscriptions) {
    const latestSnapshot = subscription.metricSnapshots[subscription.metricSnapshots.length - 1]
    if (!latestSnapshot) continue

    const loginTrend = toNumber(latestSnapshot.loginTrend30d)
    if (loginTrend > 0) improvingLoginTrendCount += 1
    if (loginTrend < 0) decliningLoginTrendCount += 1
    if ((latestSnapshot.paymentRiskBand ?? '').toUpperCase() === 'HIGH') {
      highPaymentRiskCount += 1
    }
  }

  return {
    subscriptionCount: subscriptions.length,
    snapshotCount: allSnapshots.length,
    averageSnapshotsPerSubscription: Number((allSnapshots.length / subscriptions.length).toFixed(1)),
    snapshotWindowLabel:
      earliest && latest
        ? `${toIsoDate(earliest)} to ${toIsoDate(latest)}`
        : 'No snapshot data',
    improvingLoginTrendCount,
    decliningLoginTrendCount,
    highPaymentRiskCount,
  }
}

function uniqueById<T extends { id: string }>(rows: Array<T | null | undefined>): T[] {
  const seen = new Set<string>()
  const unique: T[] = []
  for (const row of rows) {
    if (!row || seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

export async function getPolicyStudioExampleSeeds(limit = 6): Promise<PolicyStudioExampleSeed[]> {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      account: {
        select: {
          name: true,
          segment: true,
        },
      },
      product: {
        select: {
          name: true,
          sku: true,
          productFamily: true,
        },
      },
      metricSnapshots: {
        orderBy: {
          snapshotDate: 'asc',
        },
        take: 3,
        select: {
          snapshotDate: true,
          usagePercentOfEntitlement: true,
          activeUserPercent: true,
          loginTrend30d: true,
          ticketCount90d: true,
          sev1Count90d: true,
          csatScore: true,
          paymentRiskBand: true,
          adoptionBand: true,
          notes: true,
        },
      },
    },
    orderBy: {
      subscriptionNumber: 'asc',
    },
  })

  const candidates = subscriptions
    .map((subscription) => {
      const latest = subscription.metricSnapshots[subscription.metricSnapshots.length - 1]
      if (!latest) return null

      const latestRisk = scoreRenewalCaseItem({
        id: subscription.id,
        subscription: {
          id: subscription.id,
          subscriptionNumber: subscription.subscriptionNumber,
          productId: subscription.productId,
          renewalDate: subscription.renewalDate,
          quantity: subscription.quantity,
          listUnitPrice: Number(subscription.listUnitPrice),
          netUnitPrice: Number(subscription.netUnitPrice),
          discountPercent: Number(subscription.discountPercent),
          arr: Number(subscription.arr),
        },
        product: {
          id: subscription.productId,
          sku: subscription.product.sku,
          name: subscription.product.name,
          productFamily: subscription.product.productFamily,
        },
        metricSnapshot: {
          id: `${subscription.id}-latest`,
          subscriptionId: subscription.id,
          snapshotDate: latest.snapshotDate,
          usagePercentOfEntitlement: toNumber(latest.usagePercentOfEntitlement),
          activeUserPercent: toNumber(latest.activeUserPercent),
          loginTrend30d: toNumber(latest.loginTrend30d),
          ticketCount90d: latest.ticketCount90d ?? 0,
          sev1Count90d: latest.sev1Count90d ?? 0,
          csatScore: toNumber(latest.csatScore),
          paymentRiskBand: latest.paymentRiskBand,
          adoptionBand: latest.adoptionBand,
          notes: latest.notes,
        },
        pricingPolicy: null,
      }).riskScore

      return {
        id: subscription.id,
        label: `${subscription.product.name} - ${subscription.account.name} (${subscription.subscriptionNumber})`,
        accountName: subscription.account.name,
        subscriptionNumber: subscription.subscriptionNumber,
        product: {
          name: subscription.product.name,
          sku: subscription.product.sku,
          productFamily: subscription.product.productFamily,
          accountSegment: subscription.account.segment,
        },
        subscription: {
          quantity: subscription.quantity,
          listUnitPrice: Number(subscription.listUnitPrice),
          discountPercent: Number(subscription.discountPercent),
          arr: Number(subscription.arr),
        },
        snapshots: subscription.metricSnapshots.map((snapshot) => ({
          snapshotDate: toIsoDate(snapshot.snapshotDate),
          usagePercentOfEntitlement: toNumber(snapshot.usagePercentOfEntitlement),
          activeUserPercent: toNumber(snapshot.activeUserPercent),
          loginTrend30d: toNumber(snapshot.loginTrend30d),
          ticketCount90d: snapshot.ticketCount90d ?? 0,
          sev1Count90d: snapshot.sev1Count90d ?? 0,
          csatScore: toNumber(snapshot.csatScore),
          paymentRiskBand: (snapshot.paymentRiskBand ?? 'LOW').toUpperCase(),
          adoptionBand: (snapshot.adoptionBand ?? 'MODERATE').toUpperCase(),
          notes: snapshot.notes,
        })),
        latestRiskScore: latestRisk,
      } satisfies PolicyStudioExampleSeed
    })
    .filter((row): row is PolicyStudioExampleSeed => row !== null)

  if (candidates.length === 0) return []

  const byRiskAsc = [...candidates].sort((a, b) => {
    if (a.latestRiskScore !== b.latestRiskScore) return a.latestRiskScore - b.latestRiskScore
    return a.subscriptionNumber.localeCompare(b.subscriptionNumber)
  })
  const byRiskDesc = [...candidates].sort((a, b) => {
    if (a.latestRiskScore !== b.latestRiskScore) return b.latestRiskScore - a.latestRiskScore
    return a.subscriptionNumber.localeCompare(b.subscriptionNumber)
  })

  const growthCandidate = byRiskAsc.find((row) => row.latestRiskScore < 40) ?? byRiskAsc[0]
  const watchCandidate =
    [...candidates]
      .filter((row) => row.latestRiskScore >= 40 && row.latestRiskScore < 70)
      .sort((a, b) => {
        const aDistance = Math.abs(a.latestRiskScore - 55)
        const bDistance = Math.abs(b.latestRiskScore - 55)
        if (aDistance !== bDistance) return aDistance - bDistance
        return a.subscriptionNumber.localeCompare(b.subscriptionNumber)
      })[0] ?? byRiskAsc[Math.floor(byRiskAsc.length / 2)]
  const escalationCandidate = byRiskDesc.find((row) => row.latestRiskScore >= 70) ?? byRiskDesc[0]

  const selected = uniqueById([growthCandidate, watchCandidate, escalationCandidate])

  if (selected.length < limit) {
    for (const candidate of byRiskDesc) {
      if (selected.some((row) => row.id === candidate.id)) continue
      selected.push(candidate)
      if (selected.length >= limit) break
    }
  }

  return selected.slice(0, limit)
}
