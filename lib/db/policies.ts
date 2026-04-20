import { prisma } from '@/lib/prisma'
import { labelize } from '@/lib/format/risk'

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
