import Link from 'next/link'
import { getDashboardData } from '@/lib/db/dashboard'
import { DashboardSummaryCards } from '@/components/dashboard/dashboard-summary-cards'
import { DashboardCaseTable } from '@/components/dashboard/dashboard-case-table'
import { RecentReviewActivity } from '@/components/dashboard/recent-review-activity'
import { WorkspaceNav } from '@/components/layout/workspace-nav'

export const dynamic = 'force-dynamic'

export default async function BusinessHomePage() {
  const dashboard = await getDashboardData()

  return (
    <div className="page dashboard-page">
      <WorkspaceNav
        title="Business Workspace"
        subtitle="Operate the renewal from source context through quote approval."
        activeHref="/business-home"
        items={[
          {
            label: 'Business Home',
            href: '/business-home',
            description: 'Queue and workspace chooser',
          },
          {
            label: 'Review Subscriptions',
            href: '/renewal-cases?view=list',
            description: 'Review subscription baseline',
          },
          {
            label: 'Review Baseline Quote',
            href: '/quote-drafts',
            description: 'Review editable quote',
          },
          {
            label: 'Review Scenario Quote',
            href: '/scenario-quotes',
            description: 'Review options',
          },
          {
            label: 'Generation Trace',
            href: '/renewal-cases',
            description: 'Inspect generation steps',
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
            <h2 className="section-title">Renewal Portfolio</h2>
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
