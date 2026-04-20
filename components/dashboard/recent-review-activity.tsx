type ReviewActivityItem = {
  id: string
  decisionLabel: string
  accountName: string
  caseNumber: string
  reviewerName: string
  createdAtLabel: string
  comment: string | null
}

export function RecentReviewActivity({ items }: { items: ReviewActivityItem[] }) {
  const visibleItems = items.slice(0, 3)

  return (
    <section className="card recent-activity-card">
      <div className="section-header">
        <div>
          <h2 className="section-title">Recent Review Activity</h2>
          <p className="section-subtitle">Latest approval and revision actions across the queue.</p>
        </div>
      </div>

      <div className="activity-list">
        {visibleItems.length === 0 ? (
          <div className="empty-note">No recent review activity.</div>
        ) : (
          visibleItems.map((item) => (
            <div key={item.id} className="activity-item">
              <div className="activity-top">
                <div className="activity-decision">{item.decisionLabel}</div>
                <div className="activity-time">{item.createdAtLabel}</div>
              </div>

              <div className="activity-account">{item.accountName}</div>

              <div className="activity-meta">
                <span>{item.caseNumber}</span>
                <span>•</span>
                <span>{item.reviewerName}</span>
              </div>

              {item.comment ? <div className="activity-comment">{item.comment}</div> : null}
            </div>
          ))
        )}
      </div>

      {items.length > 3 ? (
        <div className="small muted" style={{ marginTop: 12 }}>
          Showing {visibleItems.length} of {items.length} recent events.
        </div>
      ) : null}
    </section>
  )
}