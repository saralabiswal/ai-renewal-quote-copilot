import { prisma } from '@/lib/prisma'

export type ExpansionOpportunityView = {
  id: string
  title: string
  opportunityTypeLabel: string
  statusLabel: string
  statusTone?: 'default' | 'info' | 'success' | 'warn' | 'danger'
  isAddedToQuote?: boolean
  productName: string
  productSku: string
  productFamily: string
  reasonSummary: string
  expectedValueSummary: string | null
  confidenceScore: number | null
  fitScore: number | null
  recommendedQuantity: number | null
  recommendedUnitPriceFormatted: string | null
  recommendedDiscountPercentFormatted: string | null
  estimatedArrImpactFormatted: string | null
}

export async function getExpansionOpportunitiesByRenewalCaseId(
  renewalCaseId: string,
): Promise<{
  caseId: string
  currencyCode: string
  items: ExpansionOpportunityView[]
}> {
  const renewalCase = await prisma.renewalCase.findUnique({
    where: { id: renewalCaseId },
    select: {
      id: true,
      account: {
        select: {
          billingCurrency: true,
        },
      },
    },
  })

  if (!renewalCase) {
    return { caseId: renewalCaseId, currencyCode: 'USD', items: [] }
  }

  const currencyCode = renewalCase.account.billingCurrency || 'USD'

  return {
    caseId: renewalCase.id,
    currencyCode,
    items: [],
  }
}
