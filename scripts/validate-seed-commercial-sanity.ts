import { Prisma } from '@prisma/client'
import { generateQuoteScenariosForRenewalCase } from '../lib/db/quote-scenarios'
import { prisma } from '../lib/prisma'

const ADDITIVE_INSIGHT_TYPES = new Set([
  'EXPANSION',
  'CROSS_SELL',
  'HYBRID_DEPLOYMENT_FIT',
  'DATA_MODERNIZATION',
])

const MARGIN_INSIGHT_TYPES = new Set(['MARGIN_RECOVERY', 'CONTROLLED_UPLIFT'])
const RETENTION_INSIGHT_TYPES = new Set(['CONCESSION'])
const STABLE_INSIGHT_TYPES = new Set(['RENEW_AS_IS', 'DEFENSIVE_RENEWAL', 'UPLIFT_RESTRAINT'])

function number(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function close(a: number | null, b: number | null, tolerance = 0.05) {
  if (a == null || b == null) return a === b
  return Math.abs(a - b) <= tolerance
}

function discountFromListAndNet(listUnitPrice: number | null, netUnitPrice: number | null) {
  if (listUnitPrice == null || netUnitPrice == null || listUnitPrice <= 0) return null
  return round2((1 - netUnitPrice / listUnitPrice) * 100)
}

function addError(errors: string[], context: string, message: string) {
  errors.push(`${context}: ${message}`)
}

async function main() {
  const errors: string[] = []
  const cases = await prisma.renewalCase.findMany({
    orderBy: { caseNumber: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
      },
      quoteDraft: {
        include: {
          lines: {
            orderBy: { lineNumber: 'asc' },
          },
        },
      },
      quoteInsights: true,
    },
  })

  for (const renewalCase of cases) {
    const context = renewalCase.caseNumber
    if (!renewalCase.quoteDraft) {
      addError(errors, context, 'Missing baseline quote draft.')
      continue
    }

    const quote = renewalCase.quoteDraft
    const baselineLineByItemId = new Map(
      quote.lines
        .filter((line) => line.renewalCaseItemId)
        .map((line) => [line.renewalCaseItemId as string, line]),
    )

    let quoteListTotal = 0
    let quoteNetTotal = 0
    for (const line of quote.lines) {
      const lineContext = `${context} baseline line ${line.lineNumber} ${line.productSku}`
      const quantity = line.quantity
      const listUnitPrice = number(line.listUnitPrice)
      const netUnitPrice = number(line.netUnitPrice)
      const discountPercent = number(line.discountPercent) ?? 0
      const lineNetAmount = number(line.lineNetAmount)
      const computedLineNet = netUnitPrice == null ? null : round2(netUnitPrice * quantity)
      const computedDiscount = discountFromListAndNet(listUnitPrice, netUnitPrice)

      if (!close(lineNetAmount, computedLineNet)) {
        addError(errors, lineContext, `line net amount ${lineNetAmount} does not equal quantity x net unit price ${computedLineNet}.`)
      }
      if (!close(discountPercent, computedDiscount)) {
        addError(errors, lineContext, `discount ${discountPercent}% does not reconcile to list/net ${computedDiscount}%.`)
      }

      quoteListTotal += (listUnitPrice ?? 0) * quantity
      quoteNetTotal += lineNetAmount ?? 0
    }

    const computedQuoteDiscount = discountFromListAndNet(quoteListTotal, quoteNetTotal)
    if (!close(number(quote.totalListAmount), round2(quoteListTotal))) {
      addError(errors, context, `baseline total list ${number(quote.totalListAmount)} does not equal summed list ${round2(quoteListTotal)}.`)
    }
    if (!close(number(quote.totalNetAmount), round2(quoteNetTotal))) {
      addError(errors, context, `baseline total net ${number(quote.totalNetAmount)} does not equal summed net ${round2(quoteNetTotal)}.`)
    }
    if (!close(number(quote.totalDiscountPercent), computedQuoteDiscount)) {
      addError(errors, context, `baseline discount ${number(quote.totalDiscountPercent)}% does not reconcile to summed list/net ${computedQuoteDiscount}%.`)
    }

    let bundleCurrentArr = 0
    let bundleProposedArr = 0
    for (const item of renewalCase.items) {
      const itemContext = `${context} ${item.productNameSnapshot}`
      const currentQuantity = item.currentQuantity
      const currentListUnitPrice = number(item.currentListUnitPrice)
      const currentNetUnitPrice = number(item.currentNetUnitPrice)
      const currentArr = number(item.currentArr)
      const proposedQuantity = item.proposedQuantity ?? item.currentQuantity
      const proposedNetUnitPrice = number(item.proposedNetUnitPrice) ?? currentNetUnitPrice
      const proposedArr = number(item.proposedArr) ?? currentArr
      const currentDiscount = discountFromListAndNet(currentListUnitPrice, currentNetUnitPrice)
      const proposedDiscount = discountFromListAndNet(currentListUnitPrice, proposedNetUnitPrice)
      const recommendedDiscount = number(item.recommendedDiscountPercent)
      const arrDelta = proposedArr == null || currentArr == null ? null : round2(proposedArr - currentArr)
      const quantityDelta = proposedQuantity - currentQuantity
      const normalizedDisposition = (item.recommendedDisposition ?? 'RENEW').toUpperCase()

      bundleCurrentArr += currentArr ?? 0
      bundleProposedArr += proposedArr ?? 0

      if (!close(currentArr, currentNetUnitPrice == null ? null : round2(currentNetUnitPrice * currentQuantity))) {
        addError(errors, itemContext, 'current ARR does not equal current quantity x current net unit price.')
      }
      if (!close(proposedArr, proposedNetUnitPrice == null ? null : round2(proposedNetUnitPrice * proposedQuantity))) {
        addError(errors, itemContext, 'proposed ARR does not equal proposed quantity x proposed net unit price.')
      }
      if (!close(recommendedDiscount, proposedDiscount)) {
        addError(errors, itemContext, `recommended discount ${recommendedDiscount}% does not reconcile to proposed net price ${proposedDiscount}%.`)
      }

      const baselineLine = baselineLineByItemId.get(item.id)
      if (!baselineLine) {
        addError(errors, itemContext, 'included renewal item is not represented in the baseline quote.')
      } else {
        if (baselineLine.quantity !== currentQuantity) {
          addError(errors, itemContext, 'baseline quantity does not match current renewal quantity.')
        }
        if (!close(number(baselineLine.netUnitPrice), currentNetUnitPrice)) {
          addError(errors, itemContext, 'baseline net unit price does not match current renewal net unit price.')
        }
      }

      if (normalizedDisposition === 'RENEW') {
        if (quantityDelta !== 0 || !close(arrDelta, 0) || !close(proposedNetUnitPrice, currentNetUnitPrice)) {
          addError(errors, itemContext, 'RENEW disposition must keep quantity, unit price, and ARR stable.')
        }
      }

      if (normalizedDisposition === 'MARGIN_RECOVERY' || normalizedDisposition === 'CONTROLLED_UPLIFT') {
        if ((arrDelta ?? 0) <= 0) {
          addError(errors, itemContext, `${normalizedDisposition} must increase proposed ARR.`)
        }
        if ((recommendedDiscount ?? 0) > (currentDiscount ?? 0) + 0.05) {
          addError(errors, itemContext, `${normalizedDisposition} must not deepen discount versus current posture.`)
        }
      }

      if (normalizedDisposition === 'CONCESSION') {
        if ((arrDelta ?? 0) >= 0) {
          addError(errors, itemContext, 'CONCESSION must reduce proposed ARR.')
        }
        if ((recommendedDiscount ?? 0) <= (currentDiscount ?? 0) + 0.05) {
          addError(errors, itemContext, 'CONCESSION must deepen discount versus current posture.')
        }
      }

      if (normalizedDisposition === 'EXPANSION') {
        if (quantityDelta <= 0 || (arrDelta ?? 0) <= 0) {
          addError(errors, itemContext, 'EXPANSION must increase quantity and ARR.')
        }
      }
    }

    const suggestedInsightArrImpact = renewalCase.quoteInsights
      .filter((insight) => insight.status === 'SUGGESTED')
      .reduce((sum, insight) => sum + (number(insight.estimatedArrImpact) ?? 0), 0)
    const expectedBundleProposedArr = round2(bundleCurrentArr + suggestedInsightArrImpact)

    if (!close(number(renewalCase.bundleCurrentArr), round2(bundleCurrentArr))) {
      addError(errors, context, `bundle current ARR ${number(renewalCase.bundleCurrentArr)} does not equal summed current ARR ${round2(bundleCurrentArr)}.`)
    }
    if (!close(number(renewalCase.bundleProposedArr), expectedBundleProposedArr)) {
      addError(errors, context, `bundle proposed ARR ${number(renewalCase.bundleProposedArr)} does not equal current ARR plus suggested insight impact ${expectedBundleProposedArr}.`)
    }
    if (!close(number(renewalCase.bundleDeltaArr), round2(suggestedInsightArrImpact))) {
      addError(errors, context, `bundle delta ARR ${number(renewalCase.bundleDeltaArr)} does not equal suggested insight impact ${round2(suggestedInsightArrImpact)}.`)
    }

    for (const insight of renewalCase.quoteInsights) {
      const insightContext = `${context} insight ${insight.productSkuSnapshot} ${insight.insightType}`
      if (ADDITIVE_INSIGHT_TYPES.has(insight.insightType)) continue
      if (STABLE_INSIGHT_TYPES.has(insight.insightType) && insight.recommendedUnitPrice == null) continue

      const baselineLine = quote.lines.find((line) => line.productSku === insight.productSkuSnapshot)
      if (!baselineLine) continue

      const recommendedUnitPrice = number(insight.recommendedUnitPrice)
      const recommendedDiscount = number(insight.recommendedDiscountPercent)
      const baselineListUnitPrice = number(baselineLine.listUnitPrice)
      const baselineNetAmount = number(baselineLine.lineNetAmount)
      const recommendedQuantity = insight.recommendedQuantity ?? baselineLine.quantity
      const expectedDiscount = discountFromListAndNet(baselineListUnitPrice, recommendedUnitPrice)
      const expectedArrImpact =
        recommendedUnitPrice == null || baselineNetAmount == null
          ? null
          : round2(recommendedUnitPrice * recommendedQuantity - baselineNetAmount)

      if (!close(recommendedDiscount, expectedDiscount)) {
        addError(errors, insightContext, `recommended discount ${recommendedDiscount}% does not reconcile to baseline list and recommended unit price ${expectedDiscount}%.`)
      }
      if (!close(number(insight.estimatedArrImpact), expectedArrImpact)) {
        addError(errors, insightContext, `ARR impact ${number(insight.estimatedArrImpact)} does not reconcile to recommended pricing ${expectedArrImpact}.`)
      }

      const baselineDiscount = number(baselineLine.discountPercent) ?? 0
      if (MARGIN_INSIGHT_TYPES.has(insight.insightType) && (recommendedDiscount ?? 0) > baselineDiscount + 0.05) {
        addError(errors, insightContext, 'margin/uplift insight deepens discount versus baseline.')
      }
      if (RETENTION_INSIGHT_TYPES.has(insight.insightType) && (recommendedDiscount ?? 0) <= baselineDiscount + 0.05) {
        addError(errors, insightContext, 'concession insight does not deepen discount versus baseline.')
      }
    }

    await generateQuoteScenariosForRenewalCase(renewalCase.id)
  }

  const scenarios = await prisma.quoteScenario.findMany({
    include: {
      renewalCase: {
        include: {
          quoteDraft: {
            include: {
              lines: true,
            },
          },
        },
      },
      scenarioQuote: {
        include: {
          lines: true,
        },
      },
    },
    orderBy: [{ renewalCaseId: 'asc' }, { rank: 'asc' }],
  })

  for (const scenario of scenarios) {
    const quote = scenario.scenarioQuote
    if (!quote) {
      addError(errors, `${scenario.renewalCase.caseNumber} ${scenario.scenarioKey}`, 'Missing scenario quote.')
      continue
    }

    let totalList = 0
    let totalNet = 0
    for (const line of quote.lines) {
      const lineContext = `${scenario.renewalCase.caseNumber} ${scenario.scenarioKey} line ${line.lineNumber} ${line.productSku}`
      const listUnitPrice = number(line.listUnitPrice)
      const netUnitPrice = number(line.netUnitPrice)
      const discount = number(line.discountPercent) ?? 0
      const lineNetAmount = number(line.lineNetAmount)
      const expectedLineNet = netUnitPrice == null ? null : round2(netUnitPrice * line.quantity)
      const expectedDiscount = discountFromListAndNet(listUnitPrice, netUnitPrice)

      if (!close(lineNetAmount, expectedLineNet)) {
        addError(errors, lineContext, 'line net amount does not equal quantity x net unit price.')
      }
      if (!close(discount, expectedDiscount)) {
        addError(errors, lineContext, `discount ${discount}% does not reconcile to list/net ${expectedDiscount}%.`)
      }

      const baselineLine = scenario.renewalCase.quoteDraft?.lines.find(
        (baseline) => baseline.id === line.sourceQuoteDraftLineId,
      )
      if (baselineLine) {
        const baselineList = number(baselineLine.listUnitPrice)
        const baselineNet = number(baselineLine.netUnitPrice)
        const baselineDiscount = number(baselineLine.discountPercent) ?? 0
        if (!close(listUnitPrice, baselineList)) {
          addError(errors, lineContext, 'existing-line scenario changed list unit price instead of changing quantity, discount, or net price against the baseline list.')
        }
        if (
          line.quantity === baselineLine.quantity &&
          close(discount, baselineDiscount) &&
          !close(netUnitPrice, baselineNet)
        ) {
          addError(errors, lineContext, 'net unit price changed while quantity and discount stayed the same.')
        }
      }

      totalList += (listUnitPrice ?? 0) * line.quantity
      totalNet += lineNetAmount ?? 0
    }

    const expectedDiscount = discountFromListAndNet(totalList, totalNet)
    if (!close(number(quote.totalListAmount), round2(totalList))) {
      addError(errors, `${scenario.renewalCase.caseNumber} ${scenario.scenarioKey}`, 'scenario total list does not match summed lines.')
    }
    if (!close(number(quote.totalNetAmount), round2(totalNet))) {
      addError(errors, `${scenario.renewalCase.caseNumber} ${scenario.scenarioKey}`, 'scenario total net does not match summed lines.')
    }
    if (!close(number(quote.totalDiscountPercent), expectedDiscount)) {
      addError(errors, `${scenario.renewalCase.caseNumber} ${scenario.scenarioKey}`, 'scenario discount does not reconcile to summed list/net.')
    }
  }

  console.log('\nSeed Commercial Sanity Validation')
  console.log('---------------------------------')
  console.log(`Renewal cases checked: ${cases.length}`)
  console.log(`Scenario quotes checked: ${scenarios.length}`)
  console.log(`Validation errors: ${errors.length}`)

  if (errors.length > 0) {
    for (const error of errors) console.log(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log('All seeded baseline, item, insight, and scenario commercial calculations are coherent.')
}

main()
  .catch((error) => {
    console.error('Seed commercial sanity validation failed unexpectedly.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
