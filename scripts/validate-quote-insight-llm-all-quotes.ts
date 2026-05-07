import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { recalculateQuoteInsights } from '../lib/db/quote-insights'
import { getRuntimeSettings, saveRuntimeSettings } from '../lib/settings/runtime-settings'

type QuoteInsightCalculationTrace = {
  generatedBy?: string | null
  validationStatus?: string | null
  acceptedProductSkus?: string[]
  rejectedProductSkus?: string[]
  fallbackReason?: string | null
}

function parseQuoteInsightCalculation(raw: string | null): QuoteInsightCalculationTrace | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as {
      quoteInsightCalculation?: QuoteInsightCalculationTrace
    } | null
    return parsed?.quoteInsightCalculation ?? null
  } catch {
    return null
  }
}

async function main() {
  const settings = getRuntimeSettings()
  if (
    settings.guardedDecisioningMode !== 'LLM_ASSISTED_GUARDED' ||
    settings.llmJsonTimeoutMs < 60000
  ) {
    saveRuntimeSettings({
      guardedDecisioningMode: 'LLM_ASSISTED_GUARDED',
      llmJsonTimeoutMs: 60000,
    })
  }

  const renewalCases = (
    await prisma.renewalCase.findMany({
      orderBy: { caseNumber: 'asc' },
      select: {
        id: true,
        caseNumber: true,
        account: {
          select: {
            name: true,
          },
        },
        quoteDraft: {
          select: {
            id: true,
          },
        },
      },
    })
  ).filter((renewalCase) => Boolean(renewalCase.quoteDraft))

  assert.ok(renewalCases.length > 0, 'Expected seeded renewal cases with baseline quotes.')

  const failures: string[] = []

  for (const renewalCase of renewalCases) {
    const result = await recalculateQuoteInsights(renewalCase.id)
    const refreshed = await prisma.renewalCase.findUnique({
      where: { id: renewalCase.id },
      select: { lastInsightDiffJson: true },
    })
    const trace = parseQuoteInsightCalculation(refreshed?.lastInsightDiffJson ?? null)
    const acceptedCount = trace?.acceptedProductSkus?.length ?? 0
    const rejectedCount = trace?.rejectedProductSkus?.length ?? 0

    console.log(
      [
        renewalCase.caseNumber,
        renewalCase.id,
        renewalCase.account.name,
        `generatedBy=${trace?.generatedBy ?? result.quoteInsightCalculation.generatedBy}`,
        `validation=${trace?.validationStatus ?? result.quoteInsightCalculation.validationStatus}`,
        `accepted=${acceptedCount}`,
        `rejected=${rejectedCount}`,
        `regenerated=${result.regeneratedCount}`,
      ].join(' | '),
    )

    if (result.regeneratedCount < 1) {
      failures.push(`${renewalCase.caseNumber}: no Quote Insight candidates were regenerated.`)
    }
    if (trace?.generatedBy !== 'LLM' || trace.validationStatus !== 'PASSED') {
      failures.push(
        `${renewalCase.caseNumber}: expected LLM/PASSED, got ${
          trace?.generatedBy ?? 'UNKNOWN'
        }/${trace?.validationStatus ?? 'UNKNOWN'}${
          trace?.fallbackReason ? ` (${trace.fallbackReason})` : ''
        }.`,
      )
    }
    if (rejectedCount > 0) {
      failures.push(`${renewalCase.caseNumber}: LLM rejected ${rejectedCount} product SKU(s).`)
    }
    if (acceptedCount < result.regeneratedCount) {
      failures.push(
        `${renewalCase.caseNumber}: accepted ${acceptedCount} LLM proposals for ${result.regeneratedCount} regenerated insights.`,
      )
    }
  }

  await prisma.$disconnect()

  if (failures.length > 0) {
    console.error('\nQuote Insight LLM all-quotes sweep failed:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

  console.log(`Quote Insight LLM all-quotes sweep passed for ${renewalCases.length} quote(s).`)
}

main().catch(async (error) => {
  await prisma.$disconnect()
  console.error(error)
  process.exit(1)
})
