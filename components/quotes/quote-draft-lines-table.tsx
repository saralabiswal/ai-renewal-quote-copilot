'use client'

import React, { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { labelize } from '@/lib/format/risk'
import { QuoteDraftLineView } from '@/types/quote-draft'

function deltaClass(value: string | null) {
  if (!value) return 'delta-neutral'
  if (value.startsWith('+')) return 'delta-positive'
  if (value.startsWith('-')) return 'delta-negative'
  return 'delta-neutral'
}

function discountDeltaClass(value: string | null) {
  if (!value) return 'delta-neutral'
  if (value.startsWith('-')) return 'delta-positive'
  if (value.startsWith('+')) return 'delta-negative'
  return 'delta-neutral'
}

function isAdditiveInsight(insightType: string | null) {
  return (
    insightType === 'EXPANSION' ||
    insightType === 'CROSS_SELL' ||
    insightType === 'HYBRID_DEPLOYMENT_FIT' ||
    insightType === 'DATA_MODERNIZATION'
  )
}

function isAiAddedLine(line: QuoteDraftLineView) {
  return line.traceability.sourceType === 'AI_SUGGESTED'
}

function isAdditiveCommercialChange(line: QuoteDraftLineView) {
  return (
    isAiAddedLine(line) &&
    isAdditiveInsight(line.traceability.sourceInsightType) &&
    line.commercialChange &&
    !line.commercialChange.beforeNetUnitPriceFormatted
  )
}

function isBaselineRenewalLine(line: QuoteDraftLineView) {
  return (
    line.traceability.sourceType === 'RENEWAL' &&
    !line.traceability.sourceQuoteInsightId &&
    !isAiAddedLine(line)
  )
}

function shouldExpandByDefault(line: QuoteDraftLineView) {
  return !isBaselineRenewalLine(line)
}

function detailSectionLabel(line: QuoteDraftLineView) {
  if (isAiAddedLine(line)) {
    return 'AI Added Line'
  }

  if (isBaselineRenewalLine(line)) {
    return 'Baseline Pricing'
  }

  return 'Commercial Change'
}

type LineFilter = 'all' | 'focus' | 'baseline'
type ExpandMode = 'smart' | 'all' | 'collapsed'

export function QuoteDraftLinesTable({ lines }: { lines: QuoteDraftLineView[] }) {
  const [lineFilter, setLineFilter] = useState<LineFilter>('all')
  const [expandMode, setExpandMode] = useState<ExpandMode>('smart')
  const baselineLineCount = lines.filter(isBaselineRenewalLine).length
  const aiAddedLineCount = lines.filter(isAiAddedLine).length
  const changedLineCount = lines.length - baselineLineCount

  const visibleLines = useMemo(() => {
    if (lineFilter === 'focus') {
      return lines.filter((line) => !isBaselineRenewalLine(line))
    }

    if (lineFilter === 'baseline') {
      return lines.filter(isBaselineRenewalLine)
    }

    return lines
  }, [lineFilter, lines])

  function defaultOpenForLine(line: QuoteDraftLineView) {
    if (expandMode === 'all') return true
    if (expandMode === 'collapsed') return false
    return shouldExpandByDefault(line)
  }

  return (
    <div className="card table-wrapper">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="panel-title">Quote Lines</h3>
          <p className="section-subtitle">
            Baseline renewal lines are collapsed. Changed and AI-added lines expand by default so
            reviewers can focus where it matters first.
          </p>
        </div>
      </div>

      <div className="quote-line-guide">
        <div className="small muted" style={{ fontWeight: 700 }}>
          Line Review Legend
        </div>
        <div className="quote-line-guide-row">
          <div className="quote-line-guide-chip">
            <span className="quote-line-guide-dot quote-line-guide-dot-baseline" />
            <span>
              Baseline Renewal Lines: <strong>{baselineLineCount}</strong>
            </span>
          </div>
          <div className="quote-line-guide-chip">
            <span className="quote-line-guide-dot quote-line-guide-dot-updated" />
            <span>
              Updated / Changed Lines: <strong>{changedLineCount}</strong>
            </span>
          </div>
          <div className="quote-line-guide-chip">
            <span className="quote-line-guide-dot quote-line-guide-dot-ai" />
            <span>
              AI-Added Lines: <strong>{aiAddedLineCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="quote-line-controls">
        <div className="quote-line-control-group">
          <span className="small muted">Line View</span>
          <button
            type="button"
            className={`quote-line-control ${lineFilter === 'all' ? 'active' : ''}`}
            onClick={() => setLineFilter('all')}
          >
            All Lines
          </button>
          <button
            type="button"
            className={`quote-line-control ${lineFilter === 'focus' ? 'active' : ''}`}
            onClick={() => setLineFilter('focus')}
          >
            Changed + AI
          </button>
          <button
            type="button"
            className={`quote-line-control ${lineFilter === 'baseline' ? 'active' : ''}`}
            onClick={() => setLineFilter('baseline')}
          >
            Baseline Only
          </button>
        </div>

        <div className="quote-line-control-group">
          <span className="small muted">Detail Expansion</span>
          <button
            type="button"
            className={`quote-line-control ${expandMode === 'smart' ? 'active' : ''}`}
            onClick={() => setExpandMode('smart')}
          >
            Smart Default
          </button>
          <button
            type="button"
            className={`quote-line-control ${expandMode === 'all' ? 'active' : ''}`}
            onClick={() => setExpandMode('all')}
          >
            Expand All
          </button>
          <button
            type="button"
            className={`quote-line-control ${expandMode === 'collapsed' ? 'active' : ''}`}
            onClick={() => setExpandMode('collapsed')}
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="small muted" style={{ marginBottom: 12 }}>
        Showing {visibleLines.length} of {lines.length} lines.
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Line</th>
            <th>Product</th>
            <th>Disposition</th>
            <th>Quantity</th>
            <th>List Unit Price</th>
            <th>Net Unit Price</th>
            <th>Discount</th>
            <th>Line Net Amount</th>
          </tr>
        </thead>

        <tbody>
          {visibleLines.map((line) => {
            const sourceTypeLabel = labelize(line.traceability.sourceType)
            const insightTypeLabel = labelize(line.traceability.sourceInsightType)
            const additiveChange = isAdditiveCommercialChange(line)
            const defaultOpen = defaultOpenForLine(line)
            const sectionLabel = detailSectionLabel(line)

            return (
              <React.Fragment key={line.id}>
                <tr
                  className={
                    isBaselineRenewalLine(line)
                      ? 'quote-line-row-baseline'
                      : isAiAddedLine(line)
                        ? 'quote-line-row-ai'
                        : 'quote-line-row-changed'
                  }
                >
                  <td>{line.lineNumber}</td>

                  <td>
                    <div>{line.productName}</div>
                    <div className="small muted">{line.productSku}</div>
                  </td>

                  <td>
                    {line.dispositionLabel ? (
                      <Badge tone={line.dispositionTone}>{line.dispositionLabel}</Badge>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td>{line.quantity}</td>
                  <td>{line.listUnitPriceFormatted}</td>
                  <td>{line.netUnitPriceFormatted}</td>
                  <td>{line.discountPercentFormatted ?? '—'}</td>
                  <td>{line.lineNetAmountFormatted}</td>
                </tr>

                <tr>
                  <td colSpan={8}>
                    <details open={defaultOpen} key={`${line.id}-${expandMode}`}>
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '8px 0',
                        }}
                      >
                        {defaultOpen ? sectionLabel : 'View details'}
                      </summary>

                      <div className="quote-traceability" style={{ marginTop: 8 }}>
                        <div className="quote-traceability-badges">
                          {sourceTypeLabel ? (
                            <span className="trace-badge trace-badge-source">{sourceTypeLabel}</span>
                          ) : null}

                          {insightTypeLabel ? (
                            <span className="trace-badge trace-badge-insight">{insightTypeLabel}</span>
                          ) : null}
                        </div>

                        {line.traceability.insightSummary ? (
                          <div className="quote-traceability-block">
                            <div className="quote-traceability-label">
                              {isBaselineRenewalLine(line) ? 'Baseline Context' : 'Commercial Insight'}
                            </div>
                            <div>{line.traceability.insightSummary}</div>
                          </div>
                        ) : null}

                        {line.traceability.aiExplanation ? (
                          <div className="quote-traceability-block">
                            <div className="quote-traceability-label">AI Reviewer Rationale</div>
                            <div>{line.traceability.aiExplanation}</div>
                          </div>
                        ) : line.traceability.sourceQuoteInsightId ? (
                          <div className="quote-traceability-block">
                            <div className="quote-traceability-label">AI Reviewer Rationale</div>
                            <div className="small muted">
                              AI rationale was not generated for this insight yet.
                            </div>
                          </div>
                        ) : null}

                        {line.commercialChange ? (
                          <div className="quote-traceability-block">
                            <div className="quote-traceability-label">{sectionLabel}</div>

                            {additiveChange ? (
                              <div className="quote-commercial-change-grid">
                                <div>
                                  <div className="small muted">Quantity Added</div>
                                  <div>+{line.quantity}</div>
                                </div>

                                <div>
                                  <div className="small muted">Net Unit Price</div>
                                  <div>{line.commercialChange.afterNetUnitPriceFormatted ?? '—'}</div>
                                  <div className="small delta-neutral">New line pricing</div>
                                </div>

                                <div>
                                  <div className="small muted">ARR Added</div>
                                  <div>{line.commercialChange.afterArrFormatted ?? '—'}</div>
                                  <div
                                    className={`small ${deltaClass(
                                      line.commercialChange.arrDeltaFormatted,
                                    )}`}
                                  >
                                    Δ {line.commercialChange.arrDeltaFormatted ?? '—'}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="quote-commercial-change-grid">
                                <div>
                                  <div className="small muted">Net Unit Price</div>
                                  <div>
                                    {line.commercialChange.beforeNetUnitPriceFormatted ?? '—'} →{' '}
                                    {line.commercialChange.afterNetUnitPriceFormatted ?? '—'}
                                  </div>
                                  <div
                                    className={`small ${deltaClass(
                                      line.commercialChange.netUnitPriceDeltaFormatted,
                                    )}`}
                                  >
                                    Δ {line.commercialChange.netUnitPriceDeltaFormatted ?? '—'}
                                  </div>
                                </div>

                                <div>
                                  <div className="small muted">Discount</div>
                                  <div>
                                    {line.commercialChange.beforeDiscountPercentFormatted ?? '—'} →{' '}
                                    {line.commercialChange.afterDiscountPercentFormatted ?? '—'}
                                  </div>
                                  <div
                                    className={`small ${discountDeltaClass(
                                      line.commercialChange.discountDeltaFormatted,
                                    )}`}
                                  >
                                    Δ {line.commercialChange.discountDeltaFormatted ?? '—'}
                                  </div>
                                </div>

                                <div>
                                  <div className="small muted">
                                    {isBaselineRenewalLine(line) ? 'ARR Baseline' : 'ARR Impact'}
                                  </div>
                                  <div>
                                    {line.commercialChange.beforeArrFormatted ?? '—'} →{' '}
                                    {line.commercialChange.afterArrFormatted ?? '—'}
                                  </div>
                                  <div
                                    className={`small ${deltaClass(
                                      line.commercialChange.arrDeltaFormatted,
                                    )}`}
                                  >
                                    Δ {line.commercialChange.arrDeltaFormatted ?? '—'}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {line.comment ? (
                          <div className="quote-traceability-block">
                            <div className="quote-traceability-label">Comment</div>
                            <div>{line.comment}</div>
                          </div>
                        ) : null}

                        {line.traceability.sourceQuoteInsightId ? (
                          <div className="quote-traceability-meta">
                            Source Quote Insight: {line.traceability.sourceQuoteInsightId}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  </td>
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
