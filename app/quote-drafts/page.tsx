import { WorkspaceNav } from '@/components/layout/workspace-nav'
import { QuoteDraftTable } from '@/components/quotes/quote-draft-table'
import { getQuoteDrafts } from '@/lib/db/quote-drafts'

export const dynamic = 'force-dynamic'

export default async function QuoteDraftsPage() {
  const quotes = await getQuoteDrafts()

  return (
    <div className="page">
      <WorkspaceNav
        title="Business Workspace"
        subtitle="Operate the renewal from source context through quote approval."
        activeHref="/quote-drafts"
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

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Baseline Quote Queue</h2>
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
