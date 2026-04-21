import { PageHeader } from '@/components/layout/page-header'
import { WorkflowJourney } from '@/components/layout/workflow-journey'
import { QuoteDraftTable } from '@/components/quotes/quote-draft-table'
import { getQuoteDrafts } from '@/lib/db/quote-drafts'

export default async function QuoteDraftsPage() {
  const quotes = await getQuoteDrafts()

  return (
    <div className="page">
      <PageHeader
        title="Quote Draft Board"
        description="Manage baseline quote drafts and review status by storyline lane after case decisions are made."
        purpose="Execute quote-level review after case recommendation and insight application."
        nextStep="Open a quote draft to validate line changes, then submit decision."
      />

      <WorkflowJourney
        title="Renewal Flow Progress"
        subtitle="This board is the final decision stage after case and scenario work."
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
            label: 'Case Decision Board',
            description: 'Recommendation posture finalized per case.',
            href: '/renewal-cases',
            state: 'complete',
          },
          {
            id: 'scenario-workspace',
            label: 'Scenario Quotes',
            description: 'Scenario alternatives reviewed as needed.',
            href: '/scenario-quotes',
            state: 'complete',
          },
          {
            id: 'quote-review',
            label: 'Quote Draft Board',
            description: 'Approve or reject quote drafts with line-level evidence.',
            href: '/quote-drafts',
            state: 'current',
          },
        ]}
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Quote Execution Storyboard</h2>
            <p className="section-subtitle">
              Each row is the working Baseline Quote tied to a renewal case. Use this board for
              quote-level execution and review transitions.
            </p>
          </div>
        </div>

        <QuoteDraftTable quotes={quotes} />
      </section>
    </div>
  )
}
