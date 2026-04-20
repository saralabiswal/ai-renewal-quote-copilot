import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RenewalCaseListItem } from '@/types/renewal-case'

export function RenewalCaseTable({ cases }: { cases: RenewalCaseListItem[] }) {
  const groupedCases = groupCasesByLane(cases)

  return (
    <div className="story-lane-stack">
      {groupedCases.map((lane) => (
        <section key={lane.id} className="story-lane-card">
          <div className="story-lane-head">
            <div>
              <h3 className="story-lane-title">{lane.label}</h3>
              <p className="story-lane-description">{lane.description}</p>
            </div>
            <div className="story-lane-chip-row">
              <span className="story-lane-chip">{lane.items.length} Cases</span>
              <span className="story-lane-chip">{lane.approvalCount} Policy Approval Required</span>
            </div>
          </div>

          <SourceLegend />

          <div className="table-wrapper">
            <RenewalCaseDataTable items={lane.items} />
          </div>
        </section>
      ))}
    </div>
  )
}

function SourceLegend() {
  return (
    <div className="story-lane-source-note">
      <strong>Source legend:</strong> Subscription baseline: Case, Account, Primary Quote, Baseline ARR.
      AI workflow output: Recommendation, Risk, Proposed ARR, Policy Approval, Workflow Status.
    </div>
  )
}

function RenewalCaseDataTable({ items }: { items: RenewalCaseListItem[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Case</th>
          <th>Account</th>
          <th>Primary Quote</th>
          <th>AI Recommendation</th>
          <th>AI Risk</th>
          <th>ARR Flow</th>
          <th>Policy Approval</th>
          <th>Workflow Status</th>
        </tr>
      </thead>

      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>
              <Link className="secondary-link" href={`/renewal-cases/${item.id}`}>
                {item.caseNumber}
              </Link>
              <div className="small muted">
                {item.itemCount} included subscriptions • {item.windowLabel}
              </div>
            </td>

            <td>
              <div>{item.accountName}</div>
              <div className="small muted">{item.segment}</div>
            </td>

            <td>
              {item.quoteDraftId && item.quoteNumber ? (
                <>
                  <Link className="secondary-link" href={`/quote-drafts/${item.quoteDraftId}`}>
                    {item.quoteNumber}
                  </Link>
                  <div className="small muted">{item.quoteTrackLabel}</div>
                </>
              ) : (
                <span className="small muted">Not generated</span>
              )}
            </td>

            <td>
              <Badge tone={item.actionTone}>{item.recommendedActionLabel}</Badge>
            </td>

            <td>
              <Badge tone={item.riskTone}>{item.riskLevel}</Badge>
            </td>

            <td>
              <div className="arr-flow-stack">
                <div className="arr-flow-row">
                  <span className="arr-flow-label">Baseline ARR (Subscription)</span>
                  <span className="arr-flow-value">{item.bundleCurrentArrFormatted}</span>
                </div>
                <div className="arr-flow-row">
                  <span className="arr-flow-label">Proposed ARR (AI Workflow)</span>
                  <span className="arr-flow-value">{item.bundleProposedArrFormatted}</span>
                </div>
              </div>
            </td>

            <td>
              {item.requiresApproval ? (
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
  )
}

type RenewalCaseStoryLaneGroup = {
  id: string
  label: string
  description: string
  order: number
  approvalCount: number
  items: RenewalCaseListItem[]
}

function groupCasesByLane(cases: RenewalCaseListItem[]): RenewalCaseStoryLaneGroup[] {
  const groups = new Map<string, RenewalCaseStoryLaneGroup>()

  for (const item of cases) {
    const existing = groups.get(item.storyLaneId)
    if (existing) {
      existing.items.push(item)
      if (item.requiresApproval) existing.approvalCount += 1
      continue
    }

    groups.set(item.storyLaneId, {
      id: item.storyLaneId,
      label: item.storyLaneLabel,
      description: item.storyLaneDescription,
      order: item.storyLaneOrder,
      approvalCount: item.requiresApproval ? 1 : 0,
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
