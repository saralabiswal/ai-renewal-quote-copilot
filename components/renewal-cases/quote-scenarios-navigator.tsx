'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { QuoteScenarioWorkspaceView } from '@/lib/db/quote-scenarios'

type BaselineLine = NonNullable<QuoteScenarioWorkspaceView['baselineQuote']>['lines'][number]
type ScenarioLine = NonNullable<
  NonNullable<QuoteScenarioWorkspaceView['scenarios'][number]['quote']>
>['lines'][number]

type ComparisonStatus = 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED'

type ComparisonRow = {
  key: string
  status: ComparisonStatus
  baselineLine: BaselineLine | null
  scenarioLine: ScenarioLine | null
  quantityDelta: number
  netUnitPriceDelta: number
  discountDelta: number
  lineNetDelta: number
}

function keyForLine(line: { productSku: string; lineNumber: number }) {
  return `${line.productSku}::${line.lineNumber}`
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function hasChanged(a: number, b: number, tolerance = 0.01) {
  return Math.abs(a - b) > tolerance
}

function determineStatus(
  baselineLine: BaselineLine | null,
  scenarioLine: ScenarioLine | null,
): ComparisonStatus {
  if (!baselineLine && scenarioLine) return 'ADDED'
  if (baselineLine && !scenarioLine) return 'REMOVED'
  if (!baselineLine || !scenarioLine) return 'UNCHANGED'

  const changed =
    hasChanged(baselineLine.quantity, scenarioLine.quantity, 0) ||
    hasChanged(baselineLine.netUnitPrice, scenarioLine.netUnitPrice) ||
    hasChanged(baselineLine.discountPercent, scenarioLine.discountPercent) ||
    hasChanged(baselineLine.lineNetAmount, scenarioLine.lineNetAmount)

  return changed ? 'CHANGED' : 'UNCHANGED'
}

function buildComparisonRows(
  baselineLines: BaselineLine[],
  scenarioLines: ScenarioLine[],
): ComparisonRow[] {
  const baselineMap = new Map(baselineLines.map((line) => [keyForLine(line), line]))
  const scenarioMap = new Map(scenarioLines.map((line) => [keyForLine(line), line]))
  const keys = Array.from(new Set([...baselineMap.keys(), ...scenarioMap.keys()])).sort((a, b) => {
    const left = baselineMap.get(a) ?? scenarioMap.get(a)
    const right = baselineMap.get(b) ?? scenarioMap.get(b)
    if (!left || !right) return a.localeCompare(b)

    const byLine = left.lineNumber - right.lineNumber
    if (byLine !== 0) return byLine
    return left.productName.localeCompare(right.productName)
  })

  return keys.map((key) => {
    const baselineLine = baselineMap.get(key) ?? null
    const scenarioLine = scenarioMap.get(key) ?? null
    const quantityDelta = round2((scenarioLine?.quantity ?? 0) - (baselineLine?.quantity ?? 0))
    const netUnitPriceDelta = round2(
      (scenarioLine?.netUnitPrice ?? 0) - (baselineLine?.netUnitPrice ?? 0),
    )
    const discountDelta = round2(
      (scenarioLine?.discountPercent ?? 0) - (baselineLine?.discountPercent ?? 0),
    )
    const lineNetDelta = round2((scenarioLine?.lineNetAmount ?? 0) - (baselineLine?.lineNetAmount ?? 0))

    return {
      key,
      status: determineStatus(baselineLine, scenarioLine),
      baselineLine,
      scenarioLine,
      quantityDelta,
      netUnitPriceDelta,
      discountDelta,
      lineNetDelta,
    }
  })
}

function deltaClassName(value: number) {
  if (value > 0) return 'delta-positive'
  if (value < 0) return 'delta-negative'
  return 'delta-neutral'
}

function formatSignedInt(value: number) {
  if (value > 0) return `+${Math.round(value)}`
  if (value < 0) return `${Math.round(value)}`
  return '0'
}

function formatSignedPercent(value: number) {
  if (value > 0) return `+${value.toFixed(2)}%`
  if (value < 0) return `${value.toFixed(2)}%`
  return '0.00%'
}

function formatSignedCurrency(value: number, currencyCode: string) {
  const absolute = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))

  if (value > 0) return `+${absolute}`
  if (value < 0) return `-${absolute}`
  return absolute
}

function formatStatusLabel(value: ComparisonStatus) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function commercialNarrative({
  arrImpactValue,
  marginImpactValue,
  riskReductionValue,
}: {
  arrImpactValue: number
  marginImpactValue: number
  riskReductionValue: number
}) {
  const arrText =
    arrImpactValue > 0
      ? 'increases ARR'
      : arrImpactValue < 0
        ? 'reduces ARR'
        : 'keeps ARR flat'
  const marginText =
    marginImpactValue > 0
      ? 'improves margin posture'
      : marginImpactValue < 0
        ? 'trades margin for retention'
        : 'keeps margin posture neutral'
  const riskText =
    riskReductionValue > 0
      ? `and lowers risk by ${Math.round(riskReductionValue)} points`
      : 'with limited risk posture change'

  return `Compared with baseline, this scenario ${arrText}, ${marginText}, ${riskText}.`
}

export function QuoteScenariosNavigator({
  workspace,
}: {
  workspace: QuoteScenarioWorkspaceView
}) {
  const router = useRouter()
  const initialSelectedScenario = workspace.scenarios.find(
    (scenario) => scenario.scenarioKey === workspace.preferredScenarioKey,
  )
  const [selectedKey, setSelectedKey] = useState<string>(
    initialSelectedScenario?.id ?? workspace.scenarios[0]?.id ?? 'baseline',
  )
  const [isSavingPreferred, setIsSavingPreferred] = useState(false)
  const [preferredError, setPreferredError] = useState<string | null>(null)
  const [showOnlyChanges, setShowOnlyChanges] = useState(true)

  const selectedScenario = useMemo(
    () => workspace.scenarios.find((scenario) => scenario.id === selectedKey) ?? null,
    [selectedKey, workspace.scenarios],
  )
  const baselineQuote = workspace.baselineQuote

  const comparisonRows = useMemo(() => {
    if (!baselineQuote || !selectedScenario?.quote) return []
    return buildComparisonRows(baselineQuote.lines, selectedScenario.quote.lines)
  }, [baselineQuote, selectedScenario])

  const changedLineCount = useMemo(
    () => comparisonRows.filter((row) => row.status !== 'UNCHANGED').length,
    [comparisonRows],
  )
  const preferredScenario = useMemo(
    () =>
      workspace.scenarios.find((scenario) => scenario.scenarioKey === workspace.preferredScenarioKey) ??
      null,
    [workspace.preferredScenarioKey, workspace.scenarios],
  )

  const visibleComparisonRows = showOnlyChanges
    ? comparisonRows.filter((row) => row.status !== 'UNCHANGED')
    : comparisonRows
  const preferredLabel = preferredScenario
    ? `#${preferredScenario.rank} ${preferredScenario.strategyLabel}`
    : 'Baseline Quote'
  const generatedScenarioCount =
    workspace.lastRunSummary?.generatedCount ?? workspace.scenarios.length

  async function updatePreferredScenario(nextScenarioKey: string | null) {
    try {
      setPreferredError(null)
      setIsSavingPreferred(true)

      const response = await fetch(
        `/api/renewal-cases/${workspace.caseId}/preferred-quote-scenario`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scenarioKey: nextScenarioKey,
          }),
        },
      )

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to save preferred scenario.')
      }

      router.refresh()
    } catch (error) {
      setPreferredError(error instanceof Error ? error.message : 'Failed to save preferred scenario.')
    } finally {
      setIsSavingPreferred(false)
    }
  }

  return (
    <div className="scenario-nav-grid">
      <div className="card scenario-nav-rail">
        <div className="small muted" style={{ fontWeight: 700 }}>
          Scenario Quote Navigator
        </div>
        <p className="scenario-nav-subtitle">
          Select one read-only scenario to compare against the baseline quote.
        </p>
        <div className="scenario-preferred-summary">
          <span className="small muted">Current Preferred</span>
          <span>{preferredLabel}</span>
        </div>

        <div className="scenario-nav-list">
          <button
            type="button"
            onClick={() => setSelectedKey('baseline')}
            className={`scenario-nav-button ${selectedKey === 'baseline' ? 'active' : ''}`}
          >
            <span className="scenario-nav-button-row">
              <span>Baseline Quote</span>
              <span className="scenario-nav-badges">
                {!workspace.preferredScenarioKey ? <span className="scenario-chip">Preferred</span> : null}
                {selectedKey === 'baseline' ? <span className="scenario-chip">Selected</span> : null}
              </span>
            </span>
            <span className="small muted scenario-nav-title">Editable source quote for final approval.</span>
            <span className="small muted scenario-nav-title">
              System generated scenarios: {generatedScenarioCount}
            </span>
          </button>

          {workspace.scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedKey(scenario.id)}
              className={`scenario-nav-button ${selectedKey === scenario.id ? 'active' : ''}`}
            >
              <span className="scenario-nav-button-row">
                <span>
                  #{scenario.rank} {scenario.strategyLabel}
                </span>
                <span className="scenario-nav-badges">
                  {workspace.preferredScenarioKey === scenario.scenarioKey ? (
                    <span className="scenario-chip">Preferred</span>
                  ) : null}
                  {selectedKey === scenario.id ? <span className="scenario-chip">Selected</span> : null}
                </span>
              </span>
              <span className="small scenario-nav-title">{scenario.title}</span>
              <span className="small muted">
                ARR {scenario.expectedArrImpactFormatted ?? '—'} · Margin{' '}
                {scenario.expectedMarginImpactFormatted ?? '—'} · Risk{' '}
                {scenario.expectedRiskReduction ?? '—'}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {selectedScenario ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              className={`scenario-selection-strip ${
                workspace.preferredScenarioKey === selectedScenario.scenarioKey ? 'is-preferred' : ''
              }`}
            >
              <div className="small muted" style={{ fontWeight: 700 }}>
                Selection State
              </div>
              <div>
                Comparing <strong>#{selectedScenario.rank} {selectedScenario.strategyLabel}</strong> against
                baseline. Current preferred: <strong>{preferredLabel}</strong>.
              </div>
            </div>

            <div className="opportunity-title-row">
              <div className="opportunity-title">
                #{selectedScenario.rank} {selectedScenario.title}
              </div>
              <span className="scenario-chip">{selectedScenario.strategyLabel}</span>
              <span className="scenario-chip">Read-only</span>
              {workspace.preferredScenarioKey === selectedScenario.scenarioKey ? (
                <span className="scenario-chip">Preferred</span>
              ) : null}
            </div>

            <p className="opportunity-reason">{selectedScenario.summary}</p>

            <div
              className="opportunity-metrics-grid"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              <Metric
                label="Scenario Net"
                value={selectedScenario.quote?.totalNetAmountFormatted ?? '—'}
              />
              <Metric
                label="Discount"
                value={selectedScenario.quote?.totalDiscountPercentFormatted ?? '—'}
              />
              <Metric
                label="ARR Impact"
                value={selectedScenario.expectedArrImpactFormatted ?? '—'}
              />
              <Metric
                label="Margin Impact"
                value={selectedScenario.expectedMarginImpactFormatted ?? '—'}
              />
            </div>

            <div
              className="opportunity-metrics-grid"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              <Metric
                label="Confidence"
                value={
                  selectedScenario.confidenceScore != null
                    ? `${selectedScenario.confidenceScore}`
                    : '—'
                }
              />
              <Metric
                label="Risk Reduction"
                value={
                  selectedScenario.expectedRiskReduction != null
                    ? `${selectedScenario.expectedRiskReduction}`
                    : '—'
                }
              />
              <Metric
                label="Scenario Lines"
                value={selectedScenario.quote ? String(selectedScenario.quote.lineCount) : '—'}
              />
              <Metric label="Source Insights" value={String(selectedScenario.sourceInsightCount)} />
            </div>

            <div className="scenario-preference-row">
              <button
                type="button"
                className={
                  workspace.preferredScenarioKey === selectedScenario.scenarioKey
                    ? 'button-secondary'
                    : 'button-link'
                }
                disabled={
                  isSavingPreferred || workspace.preferredScenarioKey === selectedScenario.scenarioKey
                }
                onClick={() => updatePreferredScenario(selectedScenario.scenarioKey)}
              >
                {workspace.preferredScenarioKey === selectedScenario.scenarioKey
                  ? 'Preferred Scenario'
                  : isSavingPreferred
                    ? 'Saving Preferred Scenario...'
                    : 'Mark as Preferred Scenario'}
              </button>

              {preferredError ? <span className="text-sm text-red-600">{preferredError}</span> : null}
            </div>

            {baselineQuote && selectedScenario.quote ? (
              <div className="scenario-compare-shell">
                <div className="scenario-compare-head">
                  <div className="small muted" style={{ fontWeight: 700 }}>
                    Compare vs Baseline
                  </div>
                  <span className="small muted">
                    Baseline {baselineQuote.quoteNumber} against Scenario #{selectedScenario.rank}
                  </span>
                </div>

                <div className="scenario-compare-summary-grid">
                  <Metric label="Baseline Net" value={baselineQuote.totalNetAmountFormatted} />
                  <Metric label="Scenario Net" value={selectedScenario.quote.totalNetAmountFormatted} />
                  <Metric
                    label="Net Delta"
                    value={formatSignedCurrency(
                      selectedScenario.quote.totalNetAmount - baselineQuote.totalNetAmount,
                      workspace.currencyCode,
                    )}
                    valueClassName={deltaClassName(
                      selectedScenario.quote.totalNetAmount - baselineQuote.totalNetAmount,
                    )}
                  />
                  <Metric
                    label="Discount Delta"
                    value={formatSignedPercent(
                      selectedScenario.quote.totalDiscountPercent - baselineQuote.totalDiscountPercent,
                    )}
                    valueClassName={deltaClassName(
                      selectedScenario.quote.totalDiscountPercent - baselineQuote.totalDiscountPercent,
                    )}
                  />
                  <Metric
                    label="Line Delta"
                    value={formatSignedInt(selectedScenario.quote.lineCount - baselineQuote.lineCount)}
                    valueClassName={deltaClassName(
                      selectedScenario.quote.lineCount - baselineQuote.lineCount,
                    )}
                  />
                </div>

                <div className="scenario-commercial-strip">
                  <div className="scenario-commercial-title">What Changed Commercially</div>
                  <div className="scenario-commercial-stats">
                    <span className="scenario-chip">
                      ARR: {selectedScenario.expectedArrImpactFormatted ?? '—'}
                    </span>
                    <span className="scenario-chip">
                      Margin: {selectedScenario.expectedMarginImpactFormatted ?? '—'}
                    </span>
                    <span className="scenario-chip">
                      Risk: {selectedScenario.expectedRiskReduction ?? 0}
                    </span>
                  </div>
                  <p className="scenario-commercial-narrative">
                    {commercialNarrative({
                      arrImpactValue:
                        selectedScenario.expectedArrImpact ??
                        selectedScenario.quote.totalNetAmount - baselineQuote.totalNetAmount,
                      marginImpactValue:
                        selectedScenario.expectedMarginImpact ??
                        baselineQuote.totalDiscountPercent -
                          selectedScenario.quote.totalDiscountPercent,
                      riskReductionValue: selectedScenario.expectedRiskReduction ?? 0,
                    })}
                  </p>
                </div>

                <div className="scenario-compare-head">
                  <div className="small muted" style={{ fontWeight: 700 }}>
                    Line-Level Comparison
                  </div>
                  <label className="scenario-compare-filter">
                    <input
                      type="checkbox"
                      checked={showOnlyChanges}
                      onChange={(event) => setShowOnlyChanges(event.target.checked)}
                    />
                    Show only changed lines
                  </label>
                </div>

                <div className="small muted">
                  {changedLineCount} changed line(s) out of {comparisonRows.length}.
                </div>

                <div className="scenario-compare-table-wrap">
                  <table className="scenario-compare-table">
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Product</th>
                        <th>Status</th>
                        <th>Base Qty</th>
                        <th>Scn Qty</th>
                        <th>Qty Δ</th>
                        <th>Base Net</th>
                        <th>Scn Net</th>
                        <th>Net Δ</th>
                        <th>Base Disc</th>
                        <th>Scn Disc</th>
                        <th>Disc Δ</th>
                        <th>Base Line Net</th>
                        <th>Scn Line Net</th>
                        <th>Line Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleComparisonRows.map((row) => (
                        <tr key={row.key}>
                          <td>{row.scenarioLine?.lineNumber ?? row.baselineLine?.lineNumber ?? '—'}</td>
                          <td>
                            {row.scenarioLine?.productName ?? row.baselineLine?.productName ?? '—'}
                          </td>
                          <td>
                            <span className="scenario-chip">{formatStatusLabel(row.status)}</span>
                          </td>
                          <td>{row.baselineLine ? row.baselineLine.quantity : '—'}</td>
                          <td>{row.scenarioLine ? row.scenarioLine.quantity : '—'}</td>
                          <td className={deltaClassName(row.quantityDelta)}>
                            {formatSignedInt(row.quantityDelta)}
                          </td>
                          <td>
                            {row.baselineLine ? row.baselineLine.netUnitPriceFormatted : '—'}
                          </td>
                          <td>
                            {row.scenarioLine ? row.scenarioLine.netUnitPriceFormatted : '—'}
                          </td>
                          <td className={deltaClassName(row.netUnitPriceDelta)}>
                            {formatSignedCurrency(row.netUnitPriceDelta, workspace.currencyCode)}
                          </td>
                          <td>
                            {row.baselineLine ? row.baselineLine.discountPercentFormatted : '—'}
                          </td>
                          <td>
                            {row.scenarioLine ? row.scenarioLine.discountPercentFormatted : '—'}
                          </td>
                          <td className={deltaClassName(row.discountDelta)}>
                            {formatSignedPercent(row.discountDelta)}
                          </td>
                          <td>
                            {row.baselineLine ? row.baselineLine.lineNetAmountFormatted : '—'}
                          </td>
                          <td>
                            {row.scenarioLine ? row.scenarioLine.lineNetAmountFormatted : '—'}
                          </td>
                          <td className={deltaClassName(row.lineNetDelta)}>
                            {formatSignedCurrency(row.lineNetDelta, workspace.currencyCode)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="small muted">
                Baseline and scenario totals are required for line-level comparison.
              </div>
            )}

            <div className="small muted">
              Preferred scenario marks the working option, while baseline quote remains the only
              editable draft.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="scenario-selection-strip is-preferred">
              <div className="small muted" style={{ fontWeight: 700 }}>
                Selection State
              </div>
              <div>
                Baseline Quote is selected for review. Current preferred: <strong>{preferredLabel}</strong>.
              </div>
            </div>

            <div className="opportunity-title">Baseline Quote</div>
            <div
              className="opportunity-metrics-grid"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              <Metric label="Quote" value={workspace.baselineQuote?.quoteNumber ?? '—'} />
              <Metric
                label="Lines"
                value={
                  workspace.baselineQuote ? String(workspace.baselineQuote.lineCount) : '—'
                }
              />
              <Metric
                label="Total Net"
                value={workspace.baselineQuote?.totalNetAmountFormatted ?? '—'}
              />
              <Metric
                label="Total Discount"
                value={workspace.baselineQuote?.totalDiscountPercentFormatted ?? '—'}
              />
            </div>
            <div
              className="opportunity-metrics-grid"
              style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
            >
              <Metric label="Generated Scenarios" value={String(generatedScenarioCount)} />
              <Metric
                label="Scenario Run Time"
                value={workspace.generatedAtLabel ?? workspace.lastRunSummary?.generatedAt ?? '—'}
              />
              <Metric
                label="Suppression"
                value={workspace.lastRunSummary?.suppressedReason ? 'Yes' : 'No'}
              />
              <Metric
                label="Preferred Selection"
                value={!workspace.preferredScenarioKey ? 'Baseline Quote' : preferredLabel}
              />
            </div>

            <div className="scenario-preference-row">
              <button
                type="button"
                className={!workspace.preferredScenarioKey ? 'button-secondary' : 'button-link'}
                disabled={isSavingPreferred || !workspace.preferredScenarioKey}
                onClick={() => updatePreferredScenario(null)}
              >
                {!workspace.preferredScenarioKey
                  ? 'Baseline is Preferred'
                  : isSavingPreferred
                    ? 'Saving Baseline Preference...'
                    : 'Set Baseline as Preferred'}
              </button>

              {preferredError ? <span className="text-sm text-red-600">{preferredError}</span> : null}
            </div>

            {workspace.baselineQuote ? (
              <div>
                <Link
                  href={`/quote-drafts/${workspace.baselineQuote.quoteDraftId}`}
                  className="button-secondary"
                >
                  Open Baseline Quote
                </Link>
              </div>
            ) : null}

            <div className="small muted">
              Choose a scenario on the left to compare quote-level and line-level deltas against
              baseline.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="opportunity-metric">
      <div className="muted">{label}</div>
      <div className={valueClassName}>{value}</div>
    </div>
  )
}
