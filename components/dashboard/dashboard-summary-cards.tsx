type Metric = {
  label: string
  value: string
  helperText?: string
}

const PRIMARY_METRICS = new Set([
  'Renewal Portfolio',
  'Approval Required',
  'High-Risk Cases',
  'ARR Delta',
])

export function DashboardSummaryCards({ metrics }: { metrics: Metric[] }) {
  const filtered = metrics.filter((metric) => PRIMARY_METRICS.has(metric.label))

  return (
    <section
      className="dashboard-summary-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {filtered.map((metric) => (
        <div
          key={metric.label}
          className="summary-card card"
        >
          <div className="summary-label">{metric.label}</div>
          <div className="summary-value">{metric.value}</div>
          {metric.helperText ? <div className="summary-helper">{metric.helperText}</div> : null}
        </div>
      ))}
    </section>
  )
}
