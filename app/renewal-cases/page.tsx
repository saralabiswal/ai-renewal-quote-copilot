import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { RenewalCaseTable } from '@/components/renewal-cases/renewal-case-table'
import { RenewalSubscriptionBaselineTable } from '@/components/renewal-cases/renewal-subscription-baseline-table'
import { getRenewalCases, getRenewalSubscriptionBaselines } from '@/lib/db/renewal-cases'

type SearchParams = Promise<{ view?: string }>

export default async function RenewalCasesPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const view = resolvedSearchParams?.view === 'list' ? 'list' : 'storyboard'
  const isListView = view === 'list'
  const [cases, subscriptions] = await Promise.all([
    isListView ? Promise.resolve([] as Awaited<ReturnType<typeof getRenewalCases>>) : getRenewalCases(),
    isListView
      ? getRenewalSubscriptionBaselines()
      : Promise.resolve([] as Awaited<ReturnType<typeof getRenewalSubscriptionBaselines>>),
  ])

  return (
    <div className="page">
      <PageHeader
        title={isListView ? 'Renewal Subscriptions' : 'Renewal Quote Queue'}
        description={
          isListView
            ? 'Baseline subscription data grouped by account.'
            : 'Review renewal cases by storyline lane. Subscription data provides baseline context; AI workflow computes recommendation, risk, proposed ARR, approval need, and status progression.'
        }
        actions={
          isListView
            ? (
              <Link className="button-secondary" href="/renewal-cases">
                Back to Renewal Queue
              </Link>
            )
            : undefined
        }
      />

      <section className="card">
        <div className="section-header">
          <div>
            <h2 className="section-title">{isListView ? 'Subscriptions by Account' : 'Renewal Quote Story Board'}</h2>
            <p className="section-subtitle">
              {isListView
                ? 'Collapsed by default. Expand an account to view subscription lines.'
                : 'Cases are grouped by business storyline with explicit source labeling to separate subscription baseline from AI workflow decisions.'}
            </p>
          </div>
        </div>

        {isListView ? (
          <RenewalSubscriptionBaselineTable items={subscriptions} />
        ) : (
          <RenewalCaseTable cases={cases} />
        )}
      </section>
    </div>
  )
}
