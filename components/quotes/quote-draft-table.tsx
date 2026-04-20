import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { QuoteDraftListItem } from '@/types/quote-draft'

export function QuoteDraftTable({ quotes }: { quotes: QuoteDraftListItem[] }) {
  const groupedQuotes = groupQuotesByLane(quotes)

  return (
    <div className="story-lane-stack">
      {groupedQuotes.map((lane) => (
        <section key={lane.id} className="story-lane-card">
          <div className="story-lane-head">
            <div>
              <h3 className="story-lane-title">{lane.label}</h3>
              <p className="story-lane-description">{lane.description}</p>
            </div>
            <div className="story-lane-chip-row">
              <span className="story-lane-chip">{lane.items.length} Quotes</span>
              <span className="story-lane-chip">{lane.approvalCount} Approval Required</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Renewal Case</th>
                  <th>Account</th>
                  <th>Quote Track</th>
                  <th>Action</th>
                  <th>Total Net</th>
                  <th>Approval</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {lane.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link className="secondary-link" href={`/quote-drafts/${item.id}`}>
                        {item.quoteNumber}
                      </Link>
                      <div className="small muted">
                        {item.lineCount} lines • Updated {item.updatedAt}
                      </div>
                    </td>

                    <td>
                      <Link className="secondary-link" href={`/renewal-cases/${item.caseId}`}>
                        {item.caseNumber}
                      </Link>
                      <div className="small muted">{item.windowLabel}</div>
                    </td>

                    <td>{item.accountName}</td>

                    <td>
                      <Badge tone="default">{item.quoteTrackLabel}</Badge>
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {item.quoteTrackDescription}
                      </div>
                    </td>

                    <td>
                      <Badge tone={item.recommendedActionTone}>{item.recommendedActionLabel}</Badge>
                    </td>

                    <td>{item.totalNetAmountFormatted}</td>

                    <td>
                      {item.approvalRequired ? (
                        <Badge tone="warn">Required</Badge>
                      ) : (
                        <Badge tone="success">Not Required</Badge>
                      )}
                    </td>

                    <td>
                      <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}

type QuoteStoryLaneGroup = {
  id: string
  label: string
  description: string
  order: number
  approvalCount: number
  items: QuoteDraftListItem[]
}

function groupQuotesByLane(quotes: QuoteDraftListItem[]): QuoteStoryLaneGroup[] {
  const groups = new Map<string, QuoteStoryLaneGroup>()

  for (const item of quotes) {
    const existing = groups.get(item.storyLaneId)
    if (existing) {
      existing.items.push(item)
      if (item.approvalRequired) existing.approvalCount += 1
      continue
    }

    groups.set(item.storyLaneId, {
      id: item.storyLaneId,
      label: item.storyLaneLabel,
      description: item.storyLaneDescription,
      order: item.storyLaneOrder,
      approvalCount: item.approvalRequired ? 1 : 0,
      items: [item],
    })
  }

  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.caseNumber.localeCompare(b.caseNumber)),
    }))
}
