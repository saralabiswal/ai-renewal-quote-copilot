import { PageHeader } from '@/components/layout/page-header'
import { QuoteDraftTable } from '@/components/quotes/quote-draft-table'
import { getQuoteDrafts } from '@/lib/db/quote-drafts'

export default async function QuoteDraftsPage() {
  const quotes = await getQuoteDrafts()

  return (
    <div className="page">
      <PageHeader
        title="Renewal Quotes"
        description="Track quote execution by storyline lane, anchored by a Primary Quote baseline for every renewal case."
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">Quote Storyboard</h2>
            <p className="section-subtitle">
              Every case starts with a Primary Quote today; AI strategic quote variants can layer in as phase two.
            </p>
          </div>
        </div>

        <QuoteDraftTable quotes={quotes} />
      </section>
    </div>
  )
}
