import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/date'
import { formatPercent } from '@/lib/format/percent'
import { labelize, toneForAction, toneForStatus } from '@/lib/format/risk'
import { primaryQuoteTrack, storyLaneForAction } from '@/lib/workflow/story-lanes'
import { QuoteDraftDetailView, QuoteDraftListItem } from '@/types/quote-draft'

function formatCurrencyDelta(value: number, currencyCode: string) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(value), currencyCode)}`
}

function formatPercentDelta(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

function windowLabel(start: Date, end: Date) {
  return `${formatDate(start)} – ${formatDate(end)}`
}

export async function getQuoteDrafts(): Promise<QuoteDraftListItem[]> {
  const rows = await prisma.quoteDraft.findMany({
    include: {
      renewalCase: {
        include: {
          account: true,
        },
      },
      lines: {
        select: {
          id: true,
          lineNetAmount: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { quoteNumber: 'asc' }],
  })

  return rows.map((row) => {
    const liveTotalNetAmount = row.lines.reduce(
      (sum, line) => sum + Number(line.lineNetAmount),
      0,
    )
    const approvalRequired = row.renewalCase.requiresApproval
    const lane = storyLaneForAction(row.renewalCase.recommendedAction)
    const quoteTrack = primaryQuoteTrack()

    return {
      id: row.id,
      quoteNumber: row.quoteNumber,
      quoteTrackLabel: quoteTrack.label,
      quoteTrackDescription: quoteTrack.description,
      caseId: row.renewalCase.id,
      caseNumber: row.renewalCase.caseNumber,
      accountName: row.renewalCase.account.name,
      recommendedActionKey: row.renewalCase.recommendedAction ?? 'UNKNOWN',
      recommendedActionLabel: labelize(row.renewalCase.recommendedAction),
      recommendedActionTone: toneForAction(row.renewalCase.recommendedAction),
      storyLaneId: lane.id,
      storyLaneLabel: lane.label,
      storyLaneDescription: lane.description,
      storyLaneOrder: lane.order,
      windowLabel: windowLabel(row.renewalCase.windowStartDate, row.renewalCase.windowEndDate),
      lineCount: row.lines.length,
      totalNetAmountFormatted: formatCurrency(liveTotalNetAmount, row.currencyCode),
      approvalRequired,
      statusLabel: labelize(row.status),
      statusTone: toneForStatus(row.status),
      updatedAt: formatDate(row.updatedAt),
    }
  })
}

export async function getQuoteDraftById(quoteDraftId: string): Promise<QuoteDraftDetailView | null> {
  const row = await prisma.quoteDraft.findUnique({
    where: { id: quoteDraftId },
    include: {
      renewalCase: {
        include: { account: true },
      },
      lines: {
        include: {
          renewalCaseItem: true,
        },
        orderBy: { lineNumber: 'asc' },
      },
    },
  })

  if (!row) return null

  const liveTotalListAmount = row.lines.reduce(
    (sum, line) => sum + Number(line.listUnitPrice) * line.quantity,
    0,
  )

  const liveTotalNetAmount = row.lines.reduce(
    (sum, line) => sum + Number(line.lineNetAmount),
    0,
  )

  const rawLiveTotalDiscountPercent =
  liveTotalListAmount > 0
    ? ((liveTotalListAmount - liveTotalNetAmount) / liveTotalListAmount) * 100
    : 0

  const liveTotalDiscountPercent = Number(rawLiveTotalDiscountPercent.toFixed(2))
  const approvalRequired = row.renewalCase.requiresApproval

  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    statusLabel: labelize(row.status),
    statusTone: toneForStatus(row.status),
    summary: [
      { label: 'Effective Date', value: formatDate(row.effectiveDate) },
      { label: 'Expiration Date', value: formatDate(row.expirationDate) },
      {
        label: 'Total List Amount',
        value: formatCurrency(liveTotalListAmount, row.currencyCode),
      },
      {
        label: 'Total Net Amount',
        value: formatCurrency(liveTotalNetAmount, row.currencyCode),
      },
      {
        label: 'Total Discount',
        value: formatPercent(liveTotalDiscountPercent),
      },
      { label: 'Approval Required', value: approvalRequired ? 'Yes' : 'No' },
    ],
    lines: row.lines.map((line) => {
      const before = line.renewalCaseItem
      const beforeNet = before ? Number(before.currentNetUnitPrice) : null
      const beforeDiscount =
        before?.recommendedDiscountPercent != null
          ? Number(before.recommendedDiscountPercent)
          : null
      const beforeArr = before ? Number(before.currentArr) : null

      const afterNet = Number(line.netUnitPrice)
      const afterDiscount = line.discountPercent != null ? Number(line.discountPercent) : null
      const afterArr = Number(line.lineNetAmount)

      const commercialChange = before
        ? {
            beforeNetUnitPriceFormatted: formatCurrency(beforeNet ?? 0, row.currencyCode),
            afterNetUnitPriceFormatted: formatCurrency(afterNet, row.currencyCode),
            netUnitPriceDeltaFormatted:
              beforeNet != null
                ? formatCurrencyDelta(afterNet - beforeNet, row.currencyCode)
                : null,
            beforeDiscountPercentFormatted:
              beforeDiscount != null ? formatPercent(beforeDiscount) : '—',
            afterDiscountPercentFormatted:
              afterDiscount != null ? formatPercent(afterDiscount) : '—',
            discountDeltaFormatted:
              beforeDiscount != null && afterDiscount != null
                ? formatPercentDelta(afterDiscount - beforeDiscount)
                : null,
            beforeArrFormatted:
              beforeArr != null ? formatCurrency(beforeArr, row.currencyCode) : null,
            afterArrFormatted: formatCurrency(afterArr, row.currencyCode),
            arrDeltaFormatted:
              beforeArr != null
                ? formatCurrencyDelta(afterArr - beforeArr, row.currencyCode)
                : null,
          }
        : line.sourceType === 'AI_SUGGESTED'
          ? {
              beforeNetUnitPriceFormatted: null,
              afterNetUnitPriceFormatted: formatCurrency(afterNet, row.currencyCode),
              netUnitPriceDeltaFormatted: null,
              beforeDiscountPercentFormatted: null,
              afterDiscountPercentFormatted:
                afterDiscount != null ? formatPercent(afterDiscount) : '—',
              discountDeltaFormatted: null,
              beforeArrFormatted: formatCurrency(0, row.currencyCode),
              afterArrFormatted: formatCurrency(afterArr, row.currencyCode),
              arrDeltaFormatted: formatCurrencyDelta(afterArr, row.currencyCode),
            }
          : null

      return {
        id: line.id,
        lineNumber: line.lineNumber,
        productSku: line.productSku,
        productName: line.productName,
        dispositionLabel: line.disposition ? labelize(line.disposition) : null,
        dispositionTone: line.disposition ? toneForAction(line.disposition) : 'default',
        quantity: line.quantity,
        listUnitPriceFormatted: formatCurrency(Number(line.listUnitPrice), row.currencyCode),
        netUnitPriceFormatted: formatCurrency(Number(line.netUnitPrice), row.currencyCode),
        discountPercentFormatted:
          line.discountPercent != null ? formatPercent(Number(line.discountPercent)) : null,
        lineNetAmountFormatted: formatCurrency(Number(line.lineNetAmount), row.currencyCode),
        comment: line.comment,
        traceability: {
          sourceType: line.sourceType,
          sourceInsightType: line.sourceInsightType,
          sourceQuoteInsightId: line.sourceQuoteInsightId,
          insightSummary: line.insightSummary,
          aiExplanation: line.aiExplanation,
        },
        commercialChange,
      }
    }),
    renewalCase: {
      id: row.renewalCase.id,
      caseNumber: row.renewalCase.caseNumber,
      accountName: row.renewalCase.account.name,
    },
  }
}
