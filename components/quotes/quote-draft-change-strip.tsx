import type { QuoteDraftChangeSummaryView } from '@/types/quote-draft'

function toneForDelta(value: string) {
  if (value.startsWith('+')) return 'delta-positive'
  if (value.startsWith('-')) return 'delta-negative'
  return 'delta-neutral'
}

export function QuoteDraftChangeStrip({
  summary,
}: {
  summary: QuoteDraftChangeSummaryView
}) {
  return (
    <section className="card quote-change-strip">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div>
          <h3 className="panel-title">What Changed From Baseline</h3>
          <p className="section-subtitle">
            Compact commercial read before line-level review and decision actions.
          </p>
        </div>
      </div>

      <div className="quote-change-strip-grid">
        <div className="quote-change-strip-item">
          <div className="small muted">Net Amount</div>
          <div>
            {summary.baselineNetAmountFormatted} → {summary.currentNetAmountFormatted}
          </div>
          <div className={`small ${toneForDelta(summary.netDeltaFormatted)}`}>
            Δ {summary.netDeltaFormatted}
          </div>
        </div>

        <div className="quote-change-strip-item">
          <div className="small muted">Discount</div>
          <div>
            {summary.baselineDiscountPercentFormatted} → {summary.currentDiscountPercentFormatted}
          </div>
          <div className={`small ${toneForDelta(summary.discountDeltaFormatted)}`}>
            Δ {summary.discountDeltaFormatted}
          </div>
        </div>

        <div className="quote-change-strip-item">
          <div className="small muted">Line Impact</div>
          <div>
            Changed {summary.changedLineCount} of {summary.baselineLineCount} baseline lines
          </div>
          <div className="small muted">AI Added {summary.aiAddedLineCount}</div>
        </div>
      </div>

      <div className="quote-change-strip-narrative">{summary.narrative}</div>
    </section>
  )
}
