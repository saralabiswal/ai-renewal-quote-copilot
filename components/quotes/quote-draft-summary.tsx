import { QuoteDraftSummaryItem } from '@/types/quote-draft'

const PRIMARY_LABELS = new Set([
  'Total List Amount',
  'Total Net Amount',
  'Total Discount',
  'Approval Required',
])

export function QuoteDraftSummary({ summary }: { summary: QuoteDraftSummaryItem[] }) {
  const primaryCards = summary.filter((item) => PRIMARY_LABELS.has(item.label))
  const secondaryCards = summary.filter((item) => !PRIMARY_LABELS.has(item.label))

  return (
    <section className="card quote-summary-group">
      <div className="section-header" style={{ marginBottom: 0 }}>
        <div>
          <h3 className="panel-title">Quote Commercial Snapshot</h3>
          <p className="section-subtitle">
            Fast read of totals, discount posture, and approval status for this draft.
          </p>
        </div>
      </div>

      <div className="quote-summary-primary-grid">
        {primaryCards.map((item) => (
          <div key={item.label} className="quote-summary-primary-card">
            <div className="stat-label">{item.label}</div>
            <div className="quote-summary-value">{item.value}</div>
          </div>
        ))}
      </div>

      {secondaryCards.length > 0 ? (
        <div className="quote-summary-secondary-grid">
          {secondaryCards.map((item) => (
            <div key={item.label} className="quote-summary-secondary-item">
              <div className="muted">{item.label}</div>
              <div className="quote-summary-secondary-value">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
