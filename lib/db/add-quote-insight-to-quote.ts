import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function quoteInsightNarrativeType(quoteInsightId: string) {
  return `QUOTE_INSIGHT_${quoteInsightId}`
}

function decimal(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return new Prisma.Decimal(0)
  }
  return new Prisma.Decimal(value)
}

function isAdditiveInsight(insightType: string) {
  return (
    insightType === 'CROSS_SELL' ||
    insightType === 'EXPANSION' ||
    insightType === 'HYBRID_DEPLOYMENT_FIT' ||
    insightType === 'DATA_MODERNIZATION'
  )
}

function commentForInsight(insightType: string) {
  return `Quote insight applied: ${insightType.toLowerCase().replaceAll('_', ' ')}`
}

function maybeAdjustedPricing(args: {
  insightType: string
  existingNetUnitPrice: Prisma.Decimal
  existingDiscountPercent: Prisma.Decimal
  recommendedUnitPrice: Prisma.Decimal | null
  recommendedDiscountPercent: Prisma.Decimal | null
}) {
  const {
    insightType,
    existingNetUnitPrice,
    existingDiscountPercent,
    recommendedUnitPrice,
    recommendedDiscountPercent,
  } = args

  switch (insightType) {
    case 'CONCESSION':
      return {
        netUnitPrice: recommendedUnitPrice ?? existingNetUnitPrice,
        discountPercent: recommendedDiscountPercent ?? existingDiscountPercent,
      }

    case 'MARGIN_RECOVERY':
      return {
        netUnitPrice: recommendedUnitPrice ?? existingNetUnitPrice,
        discountPercent: recommendedDiscountPercent ?? existingDiscountPercent,
      }

    case 'RENEW_AS_IS':
    case 'RETENTION_PROTECTION':
    case 'DEFENSIVE_RENEWAL':
    case 'UPLIFT_RESTRAINT':
    case 'CONTROLLED_UPLIFT':
    default:
      return {
        netUnitPrice: recommendedUnitPrice ?? existingNetUnitPrice,
        discountPercent: recommendedDiscountPercent ?? existingDiscountPercent,
      }
  }
}

function computeListUnitPrice(netUnitPrice: Prisma.Decimal, discountPercent: Prisma.Decimal) {
  if (discountPercent.gt(0) && discountPercent.lt(100)) {
    return netUnitPrice
      .div(new Prisma.Decimal(1).minus(discountPercent.div(100)))
      .toDecimalPlaces(2)
  }

  return netUnitPrice
}

export async function addQuoteInsightToQuote(caseId: string, quoteInsightId: string) {
  const quoteInsight = await prisma.quoteInsight.findUnique({
    where: { id: quoteInsightId },
    include: {
      renewalCase: true,
      product: true,
      addedQuoteDraft: true,
    },
  })

  if (!quoteInsight) {
    throw new Error(`QuoteInsight ${quoteInsightId} not found.`)
  }

  if (quoteInsight.renewalCaseId !== caseId) {
    throw new Error('Quote insight does not belong to the requested renewal case.')
  }

  const quoteDraft = await prisma.quoteDraft.findUnique({
    where: { renewalCaseId: caseId },
    include: {
      lines: {
        orderBy: { lineNumber: 'asc' },
      },
    },
  })

  if (!quoteDraft) {
    throw new Error('No quote draft exists for this renewal case.')
  }

  const latestAiNarrative = await prisma.recommendationNarrative.findFirst({
    where: {
      scopeType: 'CASE',
      renewalCaseId: caseId,
      narrativeType: quoteInsightNarrativeType(quoteInsight.id),
    },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  })
  const aiRationale = latestAiNarrative?.content ?? null

  const alreadyAppliedLine = quoteDraft.lines.find(
    (line) => line.sourceQuoteInsightId === quoteInsight.id,
  )

  if (alreadyAppliedLine) {
    if (!alreadyAppliedLine.aiExplanation && aiRationale) {
      await prisma.quoteDraftLine.update({
        where: { id: alreadyAppliedLine.id },
        data: {
          aiExplanation: aiRationale,
          updatedAt: new Date(),
        },
      })
    }

    await prisma.quoteInsight.update({
      where: { id: quoteInsight.id },
      data: {
        status: 'ADDED_TO_QUOTE',
        addedQuoteDraftId: quoteDraft.id,
        addedQuoteDraftLineId: alreadyAppliedLine.id,
      },
    })

    return {
      alreadyAdded: true,
      quoteDraftId: quoteDraft.id,
      quoteDraftLineId: alreadyAppliedLine.id,
      mode: 'EXISTING',
    }
  }

  const additive = isAdditiveInsight(quoteInsight.insightType)

  if (additive) {
    const nextLineNumber =
      quoteDraft.lines.length > 0
        ? Math.max(...quoteDraft.lines.map((line) => line.lineNumber)) + 1
        : 1

    const quantity = quoteInsight.recommendedQuantity ?? 1
    const discountPercent = quoteInsight.recommendedDiscountPercent ?? new Prisma.Decimal(0)
    const netUnitPrice = decimal(quoteInsight.recommendedUnitPrice)
    const listUnitPrice = computeListUnitPrice(netUnitPrice, discountPercent)
    const lineNetAmount = netUnitPrice.mul(quantity).toDecimalPlaces(2)

    const totalListAmount = quoteDraft.lines
      .reduce(
        (sum, line) => sum.add(decimal(line.listUnitPrice).mul(line.quantity)),
        new Prisma.Decimal(0),
      )
      .add(listUnitPrice.mul(quantity))
      .toDecimalPlaces(2)

    const totalNetAmount = quoteDraft.lines
      .reduce((sum, line) => sum.add(decimal(line.lineNetAmount)), new Prisma.Decimal(0))
      .add(lineNetAmount)
      .toDecimalPlaces(2)

    const totalDiscountPercent = totalListAmount.gt(0)
      ? totalListAmount
          .minus(totalNetAmount)
          .div(totalListAmount)
          .mul(100)
          .toDecimalPlaces(2)
      : new Prisma.Decimal(0)

    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.quoteDraftLine.create({
        data: {
          id: makeId('qdl'),
          quoteDraftId: quoteDraft.id,
          renewalCaseItemId: null,
          lineNumber: nextLineNumber,
          productSku: quoteInsight.productSkuSnapshot,
          productName: quoteInsight.productNameSnapshot,
          chargeType: quoteInsight.product.chargeModel,
          quantity,
          listUnitPrice,
          netUnitPrice,
          discountPercent,
          lineNetAmount,
          disposition: quoteInsight.insightType,
          comment: commentForInsight(quoteInsight.insightType),
          sourceType: 'AI_SUGGESTED',
          sourceInsightType: quoteInsight.insightType,
          sourceQuoteInsightId: quoteInsight.id,
          insightSummary: quoteInsight.insightSummary,
          aiExplanation: aiRationale,
        },
      })

      await tx.quoteDraft.update({
        where: { id: quoteDraft.id },
        data: {
          totalListAmount,
          totalNetAmount,
          totalDiscountPercent,
          updatedAt: new Date(),
        },
      })

      await tx.quoteInsight.update({
        where: { id: quoteInsight.id },
        data: {
          status: 'ADDED_TO_QUOTE',
          addedQuoteDraftId: quoteDraft.id,
          addedQuoteDraftLineId: line.id,
        },
      })

      return line
    })

    return {
      alreadyAdded: false,
      quoteDraftId: quoteDraft.id,
      quoteDraftLineId: result.id,
      mode: 'ADDITIVE',
    }
  }

  const targetLine = quoteDraft.lines.find(
    (line) =>
      line.productSku === quoteInsight.productSkuSnapshot ||
      line.productName === quoteInsight.productNameSnapshot,
  )

  if (!targetLine) {
    throw new Error(
      `No existing renewal line found to apply ${quoteInsight.insightType} for ${quoteInsight.productNameSnapshot}.`,
    )
  }

  const existingNetUnitPrice = decimal(targetLine.netUnitPrice)
  const existingDiscountPercent = decimal(targetLine.discountPercent)
  const recommendedUnitPrice =
    quoteInsight.recommendedUnitPrice != null ? decimal(quoteInsight.recommendedUnitPrice) : null
  const recommendedDiscountPercent =
    quoteInsight.recommendedDiscountPercent != null
      ? decimal(quoteInsight.recommendedDiscountPercent)
      : null

  const adjusted = maybeAdjustedPricing({
    insightType: quoteInsight.insightType,
    existingNetUnitPrice,
    existingDiscountPercent,
    recommendedUnitPrice,
    recommendedDiscountPercent,
  })

  const newNetUnitPrice = adjusted.netUnitPrice
  const newDiscountPercent = adjusted.discountPercent
  const newListUnitPrice = computeListUnitPrice(newNetUnitPrice, newDiscountPercent)
  const newLineNetAmount = newNetUnitPrice.mul(targetLine.quantity).toDecimalPlaces(2)

  const result = await prisma.$transaction(async (tx) => {
    const updatedLine = await tx.quoteDraftLine.update({
      where: { id: targetLine.id },
      data: {
        listUnitPrice: newListUnitPrice,
        netUnitPrice: newNetUnitPrice,
        discountPercent: newDiscountPercent,
        lineNetAmount: newLineNetAmount,
        disposition: quoteInsight.insightType,
        comment: commentForInsight(quoteInsight.insightType),
        sourceType: targetLine.sourceType ?? 'RENEWAL',
        sourceInsightType: quoteInsight.insightType,
        sourceQuoteInsightId: quoteInsight.id,
        insightSummary: quoteInsight.insightSummary,
        aiExplanation: aiRationale,
        updatedAt: new Date(),
      },
    })

    const refreshedLines = await tx.quoteDraftLine.findMany({
      where: { quoteDraftId: quoteDraft.id },
    })

    const totalListAmount = refreshedLines
      .reduce(
        (sum, line) => sum.add(decimal(line.listUnitPrice).mul(line.quantity)),
        new Prisma.Decimal(0),
      )
      .toDecimalPlaces(2)

    const totalNetAmount = refreshedLines
      .reduce((sum, line) => sum.add(decimal(line.lineNetAmount)), new Prisma.Decimal(0))
      .toDecimalPlaces(2)

    const totalDiscountPercent = totalListAmount.gt(0)
      ? totalListAmount
          .minus(totalNetAmount)
          .div(totalListAmount)
          .mul(100)
          .toDecimalPlaces(2)
      : new Prisma.Decimal(0)

    await tx.quoteDraft.update({
      where: { id: quoteDraft.id },
      data: {
        totalListAmount,
        totalNetAmount,
        totalDiscountPercent,
        updatedAt: new Date(),
      },
    })

    await tx.quoteInsight.update({
      where: { id: quoteInsight.id },
      data: {
        status: 'ADDED_TO_QUOTE',
        addedQuoteDraftId: quoteDraft.id,
        addedQuoteDraftLineId: updatedLine.id,
      },
    })

    return updatedLine
  })

  return {
    alreadyAdded: false,
    quoteDraftId: quoteDraft.id,
    quoteDraftLineId: result.id,
    mode: 'MODIFIED_EXISTING',
  }
}
