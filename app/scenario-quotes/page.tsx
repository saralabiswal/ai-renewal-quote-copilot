import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
import { Badge } from '@/components/ui/badge'
import { getRenewalCases } from '@/lib/db/renewal-cases'

export default async function ScenarioQuotesPage() {
  const cases = await getRenewalCases()
  const scenarioReadyCount = cases.filter((item) => item.scenarioQuoteCount > 0).length
  const scenarioQuoteCount = cases.reduce((sum, item) => sum + item.scenarioQuoteCount, 0)
  const approvalCount = cases.filter((item) => item.requiresApproval).length

  return (
    <div className="page">
      <PageHeader
        title="Scenario Studio"
        description="Dedicated navigation for baseline-vs-scenario comparison without cluttering the renewal command workflow."
        purpose="Compare commercial alternatives while keeping baseline quote as the editable source."
        nextStep="Choose a case and open its Scenario Studio."
        actions={
          <ActionRail
            primary={
              <Link className="button-link" href="/renewal-cases">
                Open Renewal Command Center
              </Link>
            }
            secondary={
              <Link className="button-secondary" href="/quote-drafts">
                Open Quote Review Center
              </Link>
            }
            tertiary={
              <Link className="button-tertiary" href="/renewal-cases?view=list">
                Open Renewal Subscriptions
              </Link>
            }
          />
        }
      />

      <WorkflowJourney
        title="Renewal Workflow"
        subtitle="Scenario comparison is the bridge between decisioning and quote approval."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Baseline context already established.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'decision-board',
            label: 'Renewal Command Center',
            description: 'Recommendation and risk posture already generated.',
            href: '/renewal-cases',
            state: 'complete',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Studio',
            description: 'Pick a case and compare ranked scenario alternatives.',
            href: '/scenario-quotes',
            state: 'current',
          },
          {
            id: 'quote-review',
            label: 'Quote Review Center',
            description: 'Move to final quote review after selecting preferred scenario.',
            href: '/quote-drafts',
            state: 'upcoming',
          },
        ]}
      />

      <section className="card scenario-index-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Scenario Studio Case Index</h2>
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
