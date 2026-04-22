import Link from 'next/link'
import { getDashboardData } from '@/lib/db/dashboard'
import { DashboardSummaryCards } from '@/components/dashboard/dashboard-summary-cards'
import { DashboardCaseTable } from '@/components/dashboard/dashboard-case-table'
import { RecentReviewActivity } from '@/components/dashboard/recent-review-activity'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'

export default async function HomePage() {
  const dashboard = await getDashboardData()

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero card">
        <div>
          <h1 className="dashboard-title">AI Renewal Quote Copilot</h1>
          <p className="dashboard-subtitle">
            Prioritize renewal cases, review AI recommendations, and move high-value renewal quotes
            forward with clear workflow traceability.
          </p>
          <div className="page-header-guidance" style={{ marginTop: 10 }}>
            <p className="page-header-purpose">
              <strong>Purpose:</strong> Start here to triage the renewal queue and choose the right
              workflow entry point.
            </p>
            <p className="page-header-next">
              <strong>Next:</strong> Open Case Decision Board for active decision work, or open
              Renewal Subscriptions if baseline context needs review first.
            </p>
          </div>
        </div>

        <ActionRail
          className="dashboard-entry-rail"
          primary={
            <Link className="button-link" href="/renewal-cases">
              Open Case Decision Board
            </Link>
          }
          secondary={
            <Link className="button-secondary" href="/renewal-cases?view=list">
              Open Renewal Subscriptions
            </Link>
          }
          tertiary={
            <Link className="button-tertiary" href="/quote-drafts">
              Open Quote Draft Board
            </Link>
          }
          hint="Recommended start: Case Decision Board. Use Renewal Subscriptions for baseline context; open Quote Draft Board for final-stage reviews."
        />
      </section>

      <WorkflowJourney
        title="Self-Serve Workflow"
        subtitle="New users can follow these four steps without external documentation."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Start with baseline subscription context grouped by account.',
            href: '/renewal-cases?view=list',
            state: 'current',
          },
          {
            id: 'case-board',
            label: 'Case Decision Board',
            description: 'Open the highest-risk case and run the AI recommendation workflow.',
            href: '/renewal-cases',
            state: 'upcoming',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Quotes',
            description: 'Compare alternatives against the baseline quote and choose preferred.',
            href: '/scenario-quotes',
            state: 'upcoming',
          },
          {
            id: 'quote-review',
            label: 'Quote Draft Board',
            description: 'Validate line-level impact and submit final approval decision.',
            href: '/quote-drafts',
            state: 'upcoming',
          },
        ]}
      />

      <DashboardSummaryCards metrics={dashboard.metrics} />

      <section className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">Needs Attention</h2>
            <p className="section-subtitle">
              Focus on the renewal cases that need reviewer attention first.
            </p>
          </div>
        </div>

        <div className="attention-list">
          {dashboard.needsAttention.map((item) => (
            <Link
              key={item.id}
              href={`/renewal-cases/${item.id}`}
              className="attention-item"
            >
              <div className="attention-main">
                <div className="attention-title-row">
                  <div className="attention-title">{item.accountName}</div>
                  <span className="scenario-chip">{item.scenarioLabel}</span>
                </div>

                <div className="attention-meta">
                  <span>{item.caseNumber}</span>
                  <span>•</span>
                  <span>{item.recommendedActionLabel}</span>
                  <span>•</span>
                  <span>{item.riskLevel}</span>
                </div>
              </div>

              <div className="attention-side">
                <div className="attention-arr">{item.bundleProposedArrFormatted}</div>
                {item.requiresApproval ? (
                  <div className="attention-flag">Approval Required</div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <RecentReviewActivity items={dashboard.recentReviewActivity} />

      <section className="card" style={{ marginTop: 24 }}>
        <div className="section-header">
          <div>
            <h2 className="section-title">All Renewal Cases</h2>
            <p className="section-subtitle">
              Browse the full renewal queue across scenarios and approval states.
            </p>
          </div>
        </div>

        <DashboardCaseTable items={dashboard.caseTable} />
      </section>
    </div>
  )
}
