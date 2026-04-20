import React from 'react'
import { Badge } from '@/components/ui/badge'
import { QuoteDraftLineView } from '@/types/quote-draft'

function labelize(value: string | null) {
  if (!value) return null

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

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

export function QuoteDraftLinesTable({ lines }: { lines: QuoteDraftLineView[] }) {
  const baselineLineCount = lines.filter(isBaselineRenewalLine).length
  const aiAddedLineCount = lines.filter(isAiAddedLine).length
  const changedLineCount = lines.length - baselineLineCount

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
          {lines.map((line) => {
            const sourceTypeLabel = labelize(line.traceability.sourceType)
            const insightTypeLabel = labelize(line.traceability.sourceInsightType)
            const additiveChange = isAdditiveCommercialChange(line)
            const defaultOpen = shouldExpandByDefault(line)
            const sectionLabel = detailSectionLabel(line)

            return (
              <React.Fragment key={line.id}>
                <tr>
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
                    <details open={defaultOpen}>
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
