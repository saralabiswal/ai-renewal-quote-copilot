import { WorkspaceNav } from '@/components/layout/workspace-nav'
import { RenewalCaseTable } from '@/components/renewal-cases/renewal-case-table'
import { RenewalSubscriptionBaselineTable } from '@/components/renewal-cases/renewal-subscription-baseline-table'
import { getRenewalCases, getRenewalSubscriptionBaselines } from '@/lib/db/renewal-cases'
import { getMlRuntimeConfig } from '@/lib/ml/config'

type SearchParams = Promise<{ view?: string }>

export const dynamic = 'force-dynamic'

export default async function RenewalCasesPage({ searchParams }: { searchParams?: SearchParams }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const view = resolvedSearchParams?.view === 'list' ? 'list' : 'storyboard'
  const isListView = view === 'list'
  const mlConfig = getMlRuntimeConfig()
  const [cases, subscriptions] = await Promise.all([
    isListView ? Promise.resolve([] as Awaited<ReturnType<typeof getRenewalCases>>) : getRenewalCases(),
    isListView
      ? getRenewalSubscriptionBaselines()
      : Promise.resolve([] as Awaited<ReturnType<typeof getRenewalSubscriptionBaselines>>),
  ])

  return (
    <div className="page">
      <WorkspaceNav
        title="Business Workspace"
        subtitle="Operate the renewal from source context through quote approval."
        activeHref={isListView ? '/renewal-cases?view=list' : '/renewal-cases'}
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
            <h2 className="section-title">{isListView ? 'Subscriptions by Account' : 'Renewal Decision Portfolio'}</h2>
            <p className="section-subtitle">
              {isListView
                ? 'Collapsed by default. Expand an account to view subscription lines.'
                : 'Open this optional console only when you need to explain how recommendation, insight, and scenario quote evidence was generated.'}
            </p>
          </div>
        </div>

        {isListView ? (
          <RenewalSubscriptionBaselineTable items={subscriptions} />
        ) : (
          <RenewalCaseTable
            cases={cases}
            mlMode={mlConfig.mode}
            mlEnabled={mlConfig.enabled}
            mlAffectsRecommendations={mlConfig.affectsRecommendations}
            mlModelName={mlConfig.registryModelName}
            mlModelVersion={mlConfig.registryModelVersion}
          />
        )}
      </section>
    </div>
  )
}
