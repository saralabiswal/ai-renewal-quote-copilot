import { generateQuoteScenariosForRenewalCase } from '../lib/db/quote-scenarios'
import { prisma } from '../lib/prisma'

type ValidationRow = {
  caseId: string
  caseNumber: string
  hasBaselineQuote: boolean
  includedSubscriptionCount: number
  baselineLineCount: number
  baselineCoverageOk: boolean
  generatedCount: number
  suppressedReason: string | null
  scenarioCountInDb: number
  runSummaryCount: number | null
  needsRefresh: boolean
  errors: string[]
}

type RunSummaryJson = {
  generatedCount?: number
  suppressedReason?: string | null
}

function parseRunSummary(value: string | null): RunSummaryJson | null {
  if (!value) return null

  try {
    return JSON.parse(value) as RunSummaryJson
  } catch {
    return null
  }
}

async function validateAllRenewalCases() {
  const cases = await prisma.renewalCase.findMany({
    orderBy: {
      caseNumber: 'asc',
    },
    select: {
      id: true,
      caseNumber: true,
      quoteDraft: {
        select: {
          id: true,
          lines: {
            select: {
              id: true,
            },
          },
        },
      },
      items: {
        where: {
          includedInBundle: true,
        },
        select: {
          id: true,
        },
      },
    },
  })

  const rows: ValidationRow[] = []

  for (const renewalCase of cases) {
    const errors: string[] = []
    const includedSubscriptionCount = renewalCase.items.length
    const baselineLineCount = renewalCase.quoteDraft?.lines.length ?? 0
    const hasBaselineQuote = Boolean(renewalCase.quoteDraft)
    const baselineCoverageOk = hasBaselineQuote && baselineLineCount >= includedSubscriptionCount

    if (!hasBaselineQuote) {
      errors.push('Missing baseline quote draft.')
    } else if (!baselineCoverageOk) {
      errors.push(
        `Baseline quote lines (${baselineLineCount}) do not cover included subscriptions (${includedSubscriptionCount}).`,
      )
    }

    let generatedCount = 0
    let suppressedReason: string | null = null

    if (hasBaselineQuote) {
      try {
        const generated = await generateQuoteScenariosForRenewalCase(renewalCase.id)
        generatedCount = generated.generatedCount
        suppressedReason = generated.suppressedReason
      } catch (error) {
        errors.push(
          `Scenario generation failed: ${
            error instanceof Error ? error.message : 'Unexpected error'
          }`,
        )
      }
    }

    const refreshed = await prisma.renewalCase.findUnique({
      where: { id: renewalCase.id },
      select: {
        quoteScenariosNeedRefresh: true,
        lastQuoteScenarioRunJson: true,
        quoteScenarios: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!refreshed) {
      errors.push('Case missing after validation refresh query.')
    }

    const runSummary = parseRunSummary(refreshed?.lastQuoteScenarioRunJson ?? null)
    const scenarioCountInDb = refreshed?.quoteScenarios.length ?? 0
    const runSummaryCount = runSummary?.generatedCount ?? null
    const needsRefresh = refreshed?.quoteScenariosNeedRefresh ?? false

    if (hasBaselineQuote && runSummaryCount != null && runSummaryCount !== generatedCount) {
      errors.push(
        `Run summary generatedCount (${runSummaryCount}) does not match generator result (${generatedCount}).`,
      )
    }

    if (hasBaselineQuote && scenarioCountInDb !== generatedCount) {
      errors.push(
        `Scenario row count (${scenarioCountInDb}) does not match generator result (${generatedCount}).`,
      )
    }

    if (hasBaselineQuote && generatedCount === 0) {
      errors.push('Expected at least one read-only scenario quote for first-run demo coverage.')
    }

    if (hasBaselineQuote && needsRefresh) {
      errors.push('Scenario workspace is still marked as needing refresh after generation.')
    }

    rows.push({
      caseId: renewalCase.id,
      caseNumber: renewalCase.caseNumber,
      hasBaselineQuote,
      includedSubscriptionCount,
      baselineLineCount,
      baselineCoverageOk,
      generatedCount,
      suppressedReason,
      scenarioCountInDb,
      runSummaryCount,
      needsRefresh,
      errors,
    })
  }

  return rows
}

async function main() {
  const rows = await validateAllRenewalCases()
  const failedRows = rows.filter((row) => row.errors.length > 0)
  const withBaseline = rows.filter((row) => row.hasBaselineQuote)
  const generated = rows.filter((row) => row.generatedCount > 0)
  const withoutScenarios = rows.filter((row) => row.generatedCount === 0)

  console.log('\nScenario + Baseline Coverage Validation')
  console.log('--------------------------------------')
  console.log(`Total renewal cases: ${rows.length}`)
  console.log(`Cases with baseline quote: ${withBaseline.length}`)
  console.log(`Cases with generated scenarios: ${generated.length}`)
  console.log(`Cases without generated scenarios: ${withoutScenarios.length}`)
  console.log(`Cases with validation errors: ${failedRows.length}`)
  console.log('')

  for (const row of rows) {
    const status = row.errors.length > 0 ? 'FAIL' : 'PASS'
    const suppression = row.suppressedReason ? ` | suppressed: ${row.suppressedReason}` : ''
    console.log(
      `[${status}] ${row.caseNumber} | baseline lines ${row.baselineLineCount}/${row.includedSubscriptionCount} | generated ${row.generatedCount}${suppression}`,
    )

    for (const error of row.errors) {
      console.log(`  - ${error}`)
    }
  }

  if (failedRows.length > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('Scenario coverage validation failed unexpectedly.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
