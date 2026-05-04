import Link from 'next/link'
import { WorkspaceNav } from '@/components/layout/workspace-nav'
import { Badge } from '@/components/ui/badge'
import { getRenewalCases } from '@/lib/db/renewal-cases'

export const dynamic = 'force-dynamic'

export default async function ScenarioQuotesPage() {
  const cases = await getRenewalCases()
  const scenarioReadyCount = cases.filter((item) => item.scenarioQuoteCount > 0).length
  const scenarioQuoteCount = cases.reduce((sum, item) => sum + item.scenarioQuoteCount, 0)
  const approvalCount = cases.filter((item) => item.requiresApproval).length

  return (
    <div className="page">
      <WorkspaceNav
        title="Business Workspace"
        subtitle="Operate the renewal from source context through quote approval."
        activeHref="/scenario-quotes"
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

      <section className="card scenario-index-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Scenario Quote Case Index</h2>
            <p className="section-subtitle">
              Choose a renewal case to compare baseline versus generated scenarios, inspect
              commercial deltas, and mark a preferred scenario.
            </p>
          </div>
          <div className="scenario-index-summary">
            <div>
              <span>Total Cases</span>
              <strong>{cases.length}</strong>
            </div>
            <div>
              <span>With Scenarios</span>
              <strong>{scenarioReadyCount}</strong>
            </div>
            <div>
              <span>Generated Scenarios</span>
              <strong>{scenarioQuoteCount}</strong>
            </div>
            <div>
              <span>Approval Cases</span>
              <strong>{approvalCount}</strong>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table scenario-index-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Account</th>
                <th>Risk</th>
                <th>Recommended Action</th>
                <th>Baseline ARR</th>
                <th>Studio Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="scenario-index-case">
                      <strong>{item.caseNumber}</strong>
                      <span>{item.windowLabel}</span>
                    </div>
                  </td>
                  <td>
                    <div className="scenario-index-account">
                      <strong>{item.accountName}</strong>
                      <span>
                        {item.segment} · {item.itemCount} line{item.itemCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge tone={item.riskTone}>{item.riskLevel}</Badge>
                  </td>
                  <td>
                    <div className="scenario-index-action">
                      <Badge tone={item.actionTone}>{item.recommendedActionLabel}</Badge>
                      {item.requiresApproval ? <span>Approval required</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="scenario-index-arr">
                      <strong>{item.bundleCurrentArrFormatted}</strong>
                      <span>Quote {item.quoteNumber ?? 'not created'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="scenario-index-actions">
                      <Link className="button-secondary-sm" href={`/scenario-quotes/${item.id}`}>
                        Open Studio
                      </Link>
                      <span
                        className={`scenario-index-count ${
                          item.scenarioQuoteCount > 0
                            ? 'scenario-index-count-ready'
                            : 'scenario-index-count-empty'
                        }`}
                      >
                        {item.scenarioQuoteCount} scenario{item.scenarioQuoteCount === 1 ? '' : 's'}
                      </span>
                      {item.quoteScenariosNeedRefresh ? (
                        <span className="scenario-index-count scenario-index-count-warn">
                          Refresh needed
                        </span>
                      ) : null}
                      <Link className="table-link" href={`/renewal-cases/${item.id}`}>
                        Decision trace
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
