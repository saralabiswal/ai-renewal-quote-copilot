import { Badge } from '@/components/ui/badge'
import { ReviewDecisionView } from '@/types/renewal-case'

export function ReviewHistoryPanel({ reviewHistory }: { reviewHistory: ReviewDecisionView[] }) {
  const visibleHistory = reviewHistory.slice(0, 3)

  return (
    <div className="card">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <h3 className="panel-title">Review History</h3>
          <p className="section-subtitle">Recent reviewer actions on this renewal quote.</p>
        </div>
      </div>

      {visibleHistory.length === 0 ? (
        <p className="muted">No review events yet.</p>
      ) : (
        <div className="stack">
          {visibleHistory.map((entry) => (
            <div
              key={entry.id}
              style={{
                paddingBottom: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div className="actions" style={{ justifyContent: 'space-between' }}>
                <Badge tone={entry.decisionTone}>{entry.decisionLabel}</Badge>
                <span className="small muted">{entry.createdAt}</span>
              </div>
              <div style={{ marginTop: 8 }}>{entry.comment ?? 'No comment provided.'}</div>
              <div className="small muted" style={{ marginTop: 6 }}>
                {entry.reviewerName}
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewHistory.length > 3 ? (
        <div className="small muted" style={{ marginTop: 12 }}>
          Showing {visibleHistory.length} of {reviewHistory.length} review events.
        </div>
      ) : null}
    </div>
  )
}
