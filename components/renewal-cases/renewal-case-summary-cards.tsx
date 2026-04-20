import { SummaryCard } from '@/types/renewal-case'

const PRIMARY_LABELS = new Set([
  'Baseline ARR (Subscription)',
  'Proposed ARR (Recommendation + Quote Insight)',
  'ARR Delta vs Baseline',
  'Approval Required',
])

export function RenewalCaseSummaryCards({ summary }: { summary: SummaryCard[] }) {
  const primaryCards = summary.filter((item) => PRIMARY_LABELS.has(item.label))
  const secondaryCards = summary.filter((item) => !PRIMARY_LABELS.has(item.label))

  return (
    <section className="card case-summary-group">
      <div className="section-header case-summary-header">
        <div>
          <h3 className="panel-title">Commercial Baseline vs AI Proposal</h3>
          <p className="section-subtitle">
            Baseline ARR comes from subscription data, while Proposed ARR reflects recommendation and quote insight outputs.
          </p>
        </div>
      </div>

      <div className="case-summary-primary-grid">
        {primaryCards.map((item) => (
          <div key={item.label} className="case-summary-primary-card">
            <div className="stat-label">{item.label}</div>
            <div className="case-summary-primary-value">{item.value}</div>
            {item.helperText ? (
              <div className="small muted case-summary-primary-helper">
                {item.helperText}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {secondaryCards.length > 0 ? (
        <div className="case-summary-secondary-grid">
          {secondaryCards.map((item) => (
            <div key={item.label} className="case-summary-secondary-item">
              <div className="muted">{item.label}</div>
              <div className="case-summary-secondary-value">{item.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
