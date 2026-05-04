import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { MlRecommendationMode } from '@/lib/ml/config'
import { RenewalCaseListItem } from '@/types/renewal-case'

type RenewalCaseTableProps = {
  cases: RenewalCaseListItem[]
  mlMode: MlRecommendationMode
  mlEnabled: boolean
  mlAffectsRecommendations: boolean
  mlModelName: string | null
  mlModelVersion: string | null
}

export function RenewalCaseTable({
  cases,
  mlMode,
  mlEnabled,
  mlAffectsRecommendations,
  mlModelName,
  mlModelVersion,
}: RenewalCaseTableProps) {
  const groupedCases = groupCasesByLane(cases)
  const modeCopy = boardModeCopy(mlMode, mlEnabled, mlAffectsRecommendations)

  return (
    <div className="story-lane-stack">
      <div className="storyboard-guide">
        <strong>Workflow behavior:</strong> Story lanes are collapsed by default. Expand a lane, then
        start with the case row that has the strongest urgency signal.
      </div>
      <div className="case-board-mode-banner">
        <div>
          <div className="small muted">Current recommendation mode for future recalculations</div>
          <div className="case-board-mode-title">
            {mlModeLabel(mlMode)}
            <Badge tone={mlModeTone(mlMode, mlEnabled)}>
              {mlEnabled ? 'ML available' : mlMode === 'RULES_ONLY' ? 'Rules final' : 'ML not approved'}
            </Badge>
          </div>
          <p>{modeCopy.board}</p>
          {mlModelName && mlModelVersion ? (
            <div className="case-board-model-line">
              Model: {mlModelName} / {mlModelVersion}
            </div>
          ) : null}
        </div>
        <div className="case-board-mode-grid">
          <div className="case-board-mode-card">
            <span>Recommendation</span>
            <strong>{modeCopy.recommendation}</strong>
          </div>
          <div className="case-board-mode-card">
            <span>Quote Insight</span>
            <strong>{modeCopy.insight}</strong>
          </div>
        </div>
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
          <div className="story-lane-body">
            <div className="story-lane-body-inner">
              <SourceLegend mlMode={mlMode} />

              <div className="table-wrapper">
                <RenewalCaseDataTable items={lane.items} mlMode={mlMode} />
              </div>
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

function SourceLegend({ mlMode }: { mlMode: MlRecommendationMode }) {
  return (
    <div className="story-lane-source-note">
      <strong>Source legend:</strong> Subscription baseline: Case, Account, Baseline Quote, Baseline ARR.
      AI workflow output: {sourceLegendCopy(mlMode)}
    </div>
  )
}

function RenewalCaseDataTable({
  items,
  mlMode,
}: {
  items: RenewalCaseListItem[]
  mlMode: MlRecommendationMode
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Case</th>
          <th>Account</th>
          <th>Baseline Quote</th>
          <th>{recommendationColumnLabel(mlMode)}</th>
          <th>{riskColumnLabel(mlMode)}</th>
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
                <LatestRunChips item={item} currentMode={mlMode} />
              </td>

              <td>
                <Badge tone={item.riskTone}>{item.riskLevel}</Badge>
                <MlRiskChip item={item} />
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

function LatestRunChips({
  item,
  currentMode,
}: {
  item: RenewalCaseListItem
  currentMode: MlRecommendationMode
}) {
  if (!item.latestDecisionRunMode && !item.latestDecisionRunMlMode) return null

  const runMode = normalizeMlModeForDisplay(item.latestDecisionRunMlMode, item.latestDecisionRunMode)
  const isCurrentMode = runMode === currentMode

  return (
    <div className="case-board-chip-row">
      <span className={`case-board-chip ${isCurrentMode ? 'current' : 'stale'}`}>
        Latest run: {runMode ? mlModeLabel(runMode) : labelizeRunMode(item.latestDecisionRunMode)}
      </span>
      {item.latestDecisionRunMlAffectsRecommendation === true ? (
        <span className="case-board-chip hybrid">ML assist applied</span>
      ) : item.latestDecisionRunMlStatus ? (
        <span className="case-board-chip shadow">ML {labelizeRunMode(item.latestDecisionRunMlStatus)}</span>
      ) : null}
    </div>
  )
}

function MlRiskChip({ item }: { item: RenewalCaseListItem }) {
  if (item.latestDecisionRunMlBundleRiskScore == null) return null

  return (
    <div className="case-board-chip-row">
      <span className="case-board-chip">
        ML risk {Math.round(item.latestDecisionRunMlBundleRiskScore)}
      </span>
    </div>
  )
}

function mlModeLabel(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') return 'ML-Assisted Rules'
  if (mode === 'ML_SHADOW') return 'Shadow Mode'
  return 'Rules Only'
}

function mlModeTone(
  mode: MlRecommendationMode,
  mlEnabled: boolean,
): 'default' | 'info' | 'success' | 'warn' {
  if (mode === 'HYBRID_RULES_ML' && mlEnabled) return 'success'
  if (mode === 'ML_SHADOW' && mlEnabled) return 'info'
  if (mode !== 'RULES_ONLY') return 'warn'
  return 'default'
}

function boardModeCopy(
  mode: MlRecommendationMode,
  mlEnabled: boolean,
  mlAffectsRecommendations: boolean,
) {
  if (mode === 'HYBRID_RULES_ML') {
    return {
      board: mlEnabled
        ? 'The board continues to show persisted case outcomes; after recalculation, recommendations can reflect the 70/30 rules plus ML risk blend while pricing guardrails remain final.'
        : 'ML-Assisted Rules is selected, but the approved local ML artifact is not available. Recalculation falls back to deterministic rules.',
      recommendation: mlAffectsRecommendations
        ? 'ML-assisted score can change risk and action after recalculation.'
        : 'Rules remain final until the local model is approved and available.',
      insight: 'Quote insights use ML-assisted recommendation context and can surface ML evidence when present.',
    }
  }

  if (mode === 'ML_SHADOW') {
    return {
      board: mlEnabled
        ? 'The board keeps rules as the final decision path. ML runs in shadow during recalculation and is logged for comparison, audit, and quote insight evidence.'
        : 'Shadow is selected, but the approved local ML artifact is not available. Recalculation logs the rules-only path.',
      recommendation: 'Rules final; shadow ML is observed but cannot change the case decision.',
      insight: 'Quote insights can show shadow ML risk, expansion score, and top features as evidence.',
    }
  }

  return {
    board: 'The board is driven by deterministic recommendation rules and persisted workflow outputs. ML is not invoked for recalculation.',
    recommendation: 'Rules produce recommendation, risk, pricing posture, and approval state.',
    insight: 'Quote insights map from deterministic recommendation outputs without ML evidence.',
  }
}

function sourceLegendCopy(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') {
    return 'Recommendation and Risk may reflect ML-assisted rule outputs after recalculation; Proposed ARR, Policy Approval, and Workflow Status still honor deterministic guardrails.'
  }

  if (mode === 'ML_SHADOW') {
    return 'Recommendation and Risk remain rules-final; shadow ML evidence appears in the latest run trace and quote insights after recalculation.'
  }

  return 'Recommendation, Risk, Proposed ARR, Policy Approval, and Workflow Status are deterministic workflow outputs.'
}

function recommendationColumnLabel(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') return 'Recommendation (ML Assisted)'
  if (mode === 'ML_SHADOW') return 'Recommendation (Rules Final)'
  return 'Recommendation'
}

function riskColumnLabel(mode: MlRecommendationMode) {
  if (mode === 'HYBRID_RULES_ML') return 'Risk (ML Assisted)'
  if (mode === 'ML_SHADOW') return 'Risk (Rules Final)'
  return 'Risk'
}

function normalizeMlModeForDisplay(
  mlMode: string | null,
  runMode: string | null,
): MlRecommendationMode | null {
  const mode = mlMode ?? runMode
  if (mode === 'HYBRID_RULES_ML' || mode === 'HYBRID') return 'HYBRID_RULES_ML'
  if (mode === 'ML_SHADOW' || mode === 'SHADOW') return 'ML_SHADOW'
  if (mode === 'RULES_ONLY' || mode === 'RULES') return 'RULES_ONLY'
  return null
}

function labelizeRunMode(value: string | null) {
  if (!value) return 'Not run'
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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
      label: 'Open Generation Trace',
      helper: 'Decision is complete. Inspect the scenario quote generation trace.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Open Generation Trace',
      helper: 'Inspect rejection context and scenario quote generation trace.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (item.requiresApproval) {
    return {
      label: 'Open Generation Trace',
      helper: 'Inspect policy drivers, approval rationale, and generation steps.',
      href: `/renewal-cases/${item.id}`,
    }
  }

  if (status === 'under review') {
    return {
      label: 'Open Generation Trace',
      helper: 'Inspect or refresh scenario quote generation steps.',
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
    label: 'Open Generation Trace',
    helper: 'Inspect generation workflow and prepare quote actions.',
    href: `/renewal-cases/${item.id}`,
  }
}
