import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { ActionRail } from '@/components/layout/action-rail'
import { getRenewalCases } from '@/lib/db/renewal-cases'

export default async function ScenarioQuotesPage() {
  const cases = await getRenewalCases()

  return (
    <div className="page">
      <PageHeader
        title="Scenario Quotes"
        description="Dedicated navigation for baseline-vs-scenario comparison without cluttering the Decision Workspace."
        purpose="Compare commercial alternatives while keeping baseline quote as the editable source."
        nextStep="Choose a case and open its Scenario Quotes."
        actions={
          <ActionRail
            primary={
              <Link className="button-link" href="/renewal-cases">
                Open Case Decision Board
              </Link>
            }
            secondary={
              <Link className="button-secondary" href="/quote-drafts">
                Open Quote Draft Board
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
        title="Renewal Flow Progress"
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
            label: 'Case Decision Board',
            description: 'Recommendation and risk posture already generated.',
            href: '/renewal-cases',
            state: 'complete',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Quotes',
            description: 'Pick a case and compare ranked scenario alternatives.',
            href: '/scenario-quotes',
            state: 'current',
          },
          {
            id: 'quote-review',
            label: 'Quote Draft Board',
            description: 'Move to final quote review after selecting preferred scenario.',
            href: '/quote-drafts',
            state: 'upcoming',
          },
        ]}
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Renewal Cases</h2>
            <p className="section-subtitle">
              Open any case to compare scenario quotes, view commercial deltas, and set preferred
              scenario.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Account</th>
                <th>Risk</th>
                <th>Recommended Action</th>
                <th>Scenario Workspace</th>
                <th>Case Decision Board</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id}>
                  <td>{item.caseNumber}</td>
                  <td>{item.accountName}</td>
                  <td>{item.riskLevel}</td>
                  <td>{item.recommendedActionLabel}</td>
                  <td>
                    <Link className="button-secondary-sm" href={`/scenario-quotes/${item.id}`}>
                      Open Scenario Quotes
                    </Link>
                  </td>
                  <td>
                    <Link className="button-secondary-sm" href={`/renewal-cases/${item.id}`}>
                      Open Case Decision Board
                    </Link>
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
