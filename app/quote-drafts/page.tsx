import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { QuoteDraftTable } from '@/components/quotes/quote-draft-table'
import { getQuoteDrafts } from '@/lib/db/quote-drafts'

export default async function QuoteDraftsPage() {
  const quotes = await getQuoteDrafts()

  return (
    <div className="page">
      <PageHeader
        title="Quote Review Center"
        description="Manage baseline quotes and review status by commercial storyline after renewal decisions are made."
        purpose="Execute quote-level review after case recommendation and insight application."
        nextStep="Open a quote draft to validate line changes, then submit decision."
      />

      <WorkflowJourney
        title="Renewal Workflow"
        subtitle="This center is the final decision stage after renewal command and scenario work."
        steps={[
          {
            id: 'subscriptions',
            label: 'Renewal Subscriptions',
            description: 'Baseline subscription scope confirmed.',
            href: '/renewal-cases?view=list',
            state: 'complete',
          },
          {
            id: 'decision-board',
            label: 'Renewal Command Center',
            description: 'Recommendation posture finalized per case.',
            href: '/renewal-cases',
            state: 'complete',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Studio',
            description: 'Scenario alternatives reviewed as needed.',
            href: '/scenario-quotes',
            state: 'complete',
          },
          {
            id: 'quote-review',
            label: 'Quote Review Center',
            description: 'Approve or reject quote drafts with line-level evidence.',
            href: '/quote-drafts',
            state: 'current',
          },
        ]}
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Quote Review Queue</h2>
            <p className="section-subtitle">
              Each row is the working baseline quote tied to a renewal case. Use this center for
              quote-level execution and review transitions.
            </p>
          </div>
        </div>

        <QuoteDraftTable quotes={quotes} />
      </section>
    </div>
  )
}
