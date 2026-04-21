import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { RenewalCaseListItem } from '@/types/renewal-case'

export function RenewalCaseTable({ cases }: { cases: RenewalCaseListItem[] }) {
  const groupedCases = groupCasesByLane(cases)

  return (
    <div className="story-lane-stack">
      <div className="storyboard-guide">
        <strong>Board behavior:</strong> Story lanes are collapsed by default. Expand a lane, then
        start with the case row that has the strongest urgency signal.
      </div>

      {groupedCases.map((lane) => (
        <details key={lane.id} className={`story-lane-card story-lane-urgency-${lane.urgency}`}>
          <summary className="story-lane-head story-lane-summary">
            <div className="story-lane-head-main">
              <div className="story-lane-title-row">
                <h3 className="story-lane-title">{lane.label}</h3>
                <span className={`story-lane-urgency-chip ${lane.urgency}`}>{lane.urgencyLabel}</span>
              </div>
              <p className="story-lane-description">{lane.description}</p>
              <p className="story-lane-hint">{lane.discoverabilityHint}</p>
            </div>
            <div className="story-lane-chip-row">
              <span className="story-lane-chip">{lane.items.length} Cases</span>
              <span className="story-lane-chip">{lane.highRiskCount} High Risk</span>
              <span className="story-lane-chip">{lane.approvalCount} Policy Approval Required</span>
              <span className="story-lane-chip">{lane.openCount} Active</span>
            </div>
          </summary>

          <SourceLegend />

          <div className="table-wrapper">
            <RenewalCaseDataTable items={lane.items} />
          </div>
        </details>
      ))}
    </div>
  )
}

function SourceLegend() {
  return (
    <div className="story-lane-source-note">
      <strong>Source legend:</strong> Subscription baseline: Case, Account, Baseline Quote, Baseline ARR.
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
          <th>Baseline Quote</th>
          <th>AI Recommendation</th>
          <th>AI Risk</th>
          <th>ARR Flow</th>
          <th>Policy Approval</th>
          <th>Workflow Status</th>
          <th>Next Action</th>
        </tr>
      </thead>

      <tbody>
        {items.map((item) => {
          const nextAction = nextActionForCase(item)

          return (
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

              <td>
                <div className="case-next-action">
                  <Link
                    className="button-secondary-sm case-next-action-link"
                    href={nextAction.href as never}
                  >
                    {nextAction.label}
                  </Link>
                  <div className="small muted">{nextAction.helper}</div>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

type LaneUrgency = 'high' | 'medium' | 'low'

type RenewalCaseStoryLaneGroup = {
  id: string
  label: string
  description: string
  order: number
  approvalCount: number
  highRiskCount: number
  openCount: number
  urgency: LaneUrgency
  urgencyLabel: string
  discoverabilityHint: string
  items: RenewalCaseListItem[]
}

function groupCasesByLane(cases: RenewalCaseListItem[]): RenewalCaseStoryLaneGroup[] {
  const groups = new Map<string, RenewalCaseStoryLaneGroup>()

  for (const item of cases) {
    const existing = groups.get(item.storyLaneId)
    if (existing) {
      existing.items.push(item)
      if (item.requiresApproval) existing.approvalCount += 1
      if (isHighRisk(item.riskLevel)) existing.highRiskCount += 1
      if (!isTerminalStatus(item.statusLabel)) existing.openCount += 1
      continue
    }

    groups.set(item.storyLaneId, {
      id: item.storyLaneId,
      label: item.storyLaneLabel,
      description: item.storyLaneDescription,
      order: item.storyLaneOrder,
      approvalCount: item.requiresApproval ? 1 : 0,
      highRiskCount: isHighRisk(item.riskLevel) ? 1 : 0,
      openCount: isTerminalStatus(item.statusLabel) ? 0 : 1,
      urgency: 'low',
      urgencyLabel: 'Urgency: Routine',
      discoverabilityHint: '',
      items: [item],
    })
  }

  return Array.from(groups.values())
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.caseNumber.localeCompare(b.caseNumber)),
      urgency: laneUrgency(group.highRiskCount, group.approvalCount, group.openCount),
      urgencyLabel: laneUrgencyLabel(
        laneUrgency(group.highRiskCount, group.approvalCount, group.openCount),
      ),
      discoverabilityHint: laneDiscoverabilityHint(
        laneUrgency(group.highRiskCount, group.approvalCount, group.openCount),
      ),
    }))
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

function isHighRisk(riskLevel: string) {
  const key = normalizeKey(riskLevel)
  return key.includes('critical') || key.includes('high')
}

function isTerminalStatus(statusLabel: string) {
  const key = normalizeKey(statusLabel)
  return key === 'approved' || key === 'rejected'
}

function laneUrgency(highRiskCount: number, approvalCount: number, openCount: number): LaneUrgency {
  if (highRiskCount > 0 || approvalCount > 0) return 'high'
  if (openCount > 0) return 'medium'
  return 'low'
}

function laneUrgencyLabel(urgency: LaneUrgency) {
  if (urgency === 'high') return 'Urgency: High'
  if (urgency === 'medium') return 'Urgency: Active'
  return 'Urgency: Routine'
}

function laneDiscoverabilityHint(urgency: LaneUrgency) {
  if (urgency === 'high') {
    return 'Collapsed by default. Expand first for high-risk or approval-required cases.'
  }

  if (urgency === 'medium') {
    return 'Collapsed by default. Expand to continue active renewal decision work.'
  }

  return 'Collapsed by default. Expand when you are ready for routine follow-up.'
}

function nextActionForCase(item: RenewalCaseListItem) {
  const status = normalizeKey(item.statusLabel)

  if (status === 'approved') {
    return {
      label: 'View Approved Outcome',
      helper: 'Decision is complete. Open for audit trail and handoff.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Review Rejected Outcome',
      helper: 'Inspect rejection context before rerouting work.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (item.requiresApproval) {
    return {
      label: 'Open Approval Review',
      helper: 'Review policy drivers and approval rationale first.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (status === 'under review') {
    return {
      label: 'Continue Case Review',
      helper: 'Regenerate insights and finalize quote direction.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (item.quoteDraftId) {
    return {
      label: 'Open Baseline Quote',
      helper: 'Move from case decisioning into quote-level execution.',
      href: `/quote-drafts/${item.quoteDraftId}`,
    }
  }

  return {
    label: 'Open Decision Workspace',
    helper: 'Run recommendation workflow and prepare quote actions.',
    href: `/renewal-cases/${item.id}`,
  }
}
